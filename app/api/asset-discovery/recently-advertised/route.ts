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

type RecentAdvertAccessReason =
  | 'allowed'
  | 'sign_in_required'
  | 'account_not_eligible'
  | 'discovery_permission_required';

type RecentAdvertViewer = {
  userId: string | null;
  authenticated: boolean;
  canContact: boolean;
  identityVisible: boolean;
  reason: RecentAdvertAccessReason;
};

async function getRecentAdvertViewer(): Promise<RecentAdvertViewer> {
  const session = await getServerSession({
    allowDealerApp: true,
    allowOwnerApp: true,
  });
  if (!session?.user?.id) {
    return {
      userId: null,
      authenticated: false,
      canContact: false,
      identityVisible: false,
      reason: 'sign_in_required',
    };
  }

  const dealerAppSession = await getDealerAppSession();
  if (
    dealerAppSession
    && !dealerRoleCan(dealerAppSession.role, 'discovery')
  ) {
    return {
      userId: session.user.id,
      authenticated: true,
      canContact: false,
      identityVisible: false,
      reason: 'discovery_permission_required',
    };
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
    return {
      userId: session.user.id,
      authenticated: true,
      canContact: false,
      identityVisible: false,
      reason: 'account_not_eligible',
    };
  }

  return {
    userId: session.user.id,
    authenticated: true,
    canContact: true,
    identityVisible: true,
    reason: 'allowed',
  };
}

export async function GET(request: NextRequest) {
  try {
    const viewer = await getRecentAdvertViewer();

    const { searchParams } = request.nextUrl;
    const result = await listRecentMarketplaceAdverts({
      viewerUserId: viewer.userId,
      identityVisible: viewer.identityVisible,
      search: searchParams.get('search') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      province: searchParams.get('province') ?? undefined,
      page: positiveInt(searchParams.get('page'), 1),
      pageSize: positiveInt(searchParams.get('pageSize'), 10),
    });

    return json({
      ok: true,
      access: {
        authenticated: viewer.authenticated,
        canContact: viewer.canContact,
        identityVisible: viewer.identityVisible,
        reason: viewer.reason,
      },
      canContactAdvertisers: viewer.canContact,
      ...result,
    });
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
    if (!viewer.authenticated) {
      return json({ ok: false, error: 'You must be signed in.' }, 401);
    }
    if (!viewer.canContact || !viewer.userId) {
      return json(
        {
          ok: false,
          error: 'Contact requests are available to active owner and dealer accounts.',
        },
        403,
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Choose a valid advert.' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ ok: false, error: 'Choose a valid advert.' }, 400);
    }

    const sourcingRequest = await createMarketplaceSourcingRequest({
      requesterUserId: viewer.userId,
      listingId: String(
        (body as { listingId?: unknown }).listingId ?? '',
      ).trim(),
    });
    return json(
      { ok: true, request: sourcingRequest },
      sourcingRequest.alreadyRequested ? 200 : 201,
    );
  } catch (error) {
    console.error('recently advertised Discovery contact POST failed', error);
    const code = error instanceof Error ? error.message : '';
    if (code === 'MARKETPLACE_SOURCING_REQUESTER_CONTACT_REQUIRED') {
      return json(
        {
          ok: false,
          error: 'Add a Marketplace phone number or email in Manage before sending a contact request.',
        },
        400,
      );
    }
    if (code === 'MARKETPLACE_SOURCING_REQUESTER_INELIGIBLE') {
      return json(
        { ok: false, error: 'Only active owner and dealer accounts can send contact requests.' },
        403,
      );
    }
    if (code === 'MARKETPLACE_SOURCING_RATE_LIMITED') {
      return json(
        { ok: false, error: 'You have sent several contact requests. Please try again later.' },
        429,
      );
    }
    if (
      code === 'MARKETPLACE_SOURCING_REFERENCE_INVALID'
      || code === 'MARKETPLACE_SOURCING_ADVERT_NOT_AVAILABLE'
    ) {
      return json(
        { ok: false, error: 'This advertiser is not available for contact.' },
        404,
      );
    }
    return json(
      {
        ok: false,
        error: 'Failed to send the contact request.',
      },
      500,
    );
  }
}
