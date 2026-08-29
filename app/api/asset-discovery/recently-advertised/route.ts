import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import { dealerRoleCan } from '../../../../lib/dealer-app-access';
import { getDealerAppSession } from '../../../../lib/dealer-app-session';
import { listRecentMarketplaceAdverts } from '../../../../lib/recent-marketplace-adverts';
import { createMarketplaceSourcingRequest } from '../../../../lib/marketplace-sourcing-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Cookie',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: PRIVATE_NO_STORE_HEADERS,
  });
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.trunc(parsed)
    : fallback;
}

type RecentAdvertViewer =
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'allowed'; userId: string };

async function getRecentAdvertViewer(): Promise<RecentAdvertViewer> {
  const session = await getServerSession({
    allowDealerApp: true,
    allowOwnerApp: true,
  });
  if (!session?.user?.id) return { status: 'unauthenticated' };

  const dealerAppSession = await getDealerAppSession();
  if (
    dealerAppSession
    && !dealerRoleCan(dealerAppSession.role, 'discovery')
  ) {
    return { status: 'forbidden' };
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (
    !['owner', 'dealer'].includes(profile.accountType)
    || profile.accountStatus !== 'active'
  ) {
    return { status: 'forbidden' };
  }

  return { status: 'allowed', userId: session.user.id };
}

export async function GET(request: NextRequest) {
  try {
    const viewer = await getRecentAdvertViewer();
    if (viewer.status === 'unauthenticated') {
      return json({ ok: false, error: 'You must be signed in.' }, 401);
    }
    if (viewer.status === 'forbidden') {
      return json(
        {
          ok: false,
          error: 'Recently advertised equipment is available to active owner and dealer accounts.',
        },
        403,
      );
    }

    const { searchParams } = request.nextUrl;
    const result = await listRecentMarketplaceAdverts({
      viewerUserId: viewer.userId,
      search: searchParams.get('search') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      province: searchParams.get('province') ?? undefined,
      page: positiveInt(searchParams.get('page'), 1),
      pageSize: positiveInt(searchParams.get('pageSize'), 10),
    });

    return json({ ok: true, ...result });
  } catch (error) {
    console.error('recently advertised Discovery GET failed', error);
    return json(
      {
        ok: false,
        error: 'Failed to load recently advertised equipment.',
      },
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await getRecentAdvertViewer();
    if (viewer.status === 'unauthenticated') {
      return json({ ok: false, error: 'You must be signed in.' }, 401);
    }
    if (viewer.status === 'forbidden') {
      return json(
        {
          ok: false,
          error: 'Recently advertised equipment is available to active owner and dealer accounts.',
        },
        403,
      );
    }

    let body: { listingId?: unknown };
    try {
      body = (await request.json()) as { listingId?: unknown };
    } catch {
      return json({ ok: false, error: 'Choose a valid advert.' }, 400);
    }

    const sourcingRequest = await createMarketplaceSourcingRequest({
      requesterUserId: viewer.userId,
      listingId: String(body.listingId ?? '').trim(),
    });
    return json(
      { ok: true, request: sourcingRequest },
      sourcingRequest.alreadyRequested ? 200 : 201,
    );
  } catch (error) {
    console.error('recently advertised Discovery sourcing POST failed', error);
    const code = error instanceof Error ? error.message : '';
    if (code === 'MARKETPLACE_SOURCING_REQUESTER_CONTACT_REQUIRED') {
      return json(
        {
          ok: false,
          error: 'Add a Marketplace phone number or email in Manage before sending a sourcing request.',
        },
        400,
      );
    }
    if (code === 'MARKETPLACE_SOURCING_REQUESTER_INELIGIBLE') {
      return json(
        { ok: false, error: 'Only active owner and dealer accounts can send sourcing requests.' },
        403,
      );
    }
    if (code === 'MARKETPLACE_SOURCING_RATE_LIMITED') {
      return json(
        { ok: false, error: 'You have sent several sourcing requests. Please try again later.' },
        429,
      );
    }
    if (
      code === 'MARKETPLACE_SOURCING_REFERENCE_INVALID'
      || code === 'MARKETPLACE_SOURCING_ADVERT_NOT_AVAILABLE'
    ) {
      return json(
        { ok: false, error: 'This advert is no longer available for a sourcing request.' },
        404,
      );
    }
    return json(
      {
        ok: false,
        error: 'Failed to send the sourcing request.',
      },
      500,
    );
  }
}
