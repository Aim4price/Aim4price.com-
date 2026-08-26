import { NextRequest, NextResponse } from 'next/server';
import { isAim4priceAdminEmail } from '../../../../lib/account-constants';
import {
  getServerSession,
  isAdminSupportSession,
} from '../../../../lib/auth-session';
import { recordMarketplaceListingView } from '../../../../lib/marketplace-views';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getOptionalMarketplaceViewer() {
  try {
    return await getServerSession({
      allowAdmin: true,
      allowDealerApp: true,
      allowOwnerApp: true,
    });
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    viewEventId?: unknown;
    listingReference?: unknown;
    sourceAssetId?: unknown;
    anonymousViewerId?: unknown;
  } | null;

  if (!body) {
    return NextResponse.json({ ok: false, error: 'Invalid view event.' }, { status: 400 });
  }

  const session = await getOptionalMarketplaceViewer();

  // Keep internal Admin/support checks out of Marketplace demand signals.
  if (
    session &&
    (isAim4priceAdminEmail(session.user.email) || isAdminSupportSession(session))
  ) {
    return NextResponse.json(
      { ok: true },
      { status: 202, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    await recordMarketplaceListingView({
      viewEventId: String(body.viewEventId ?? '').trim(),
      listingReference: String(body.listingReference ?? '').trim(),
      sourceAssetId: String(body.sourceAssetId ?? '').trim(),
      viewerUserId: session?.user?.id ?? null,
      anonymousViewerId: String(body.anonymousViewerId ?? '').trim() || null,
    });

    return NextResponse.json(
      { ok: true },
      {
        status: 202,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message.includes('INVALID') ? 400 : 500;

    if (status === 500) {
      console.error('marketplace view tracking failed', error);
    }

    return NextResponse.json(
      {
        ok: false,
        error: status === 400 ? 'Invalid view event.' : 'View event could not be recorded.',
      },
      { status },
    );
  }
}
