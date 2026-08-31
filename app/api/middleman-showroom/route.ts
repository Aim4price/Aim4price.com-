import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession, isDealerAppSession } from '../../../lib/auth-session';
import { dealerRoleCan } from '../../../lib/dealer-app-access';
import { listPublishedMarketplaceAssetListings } from '../../../lib/marketplace-db';
import {
  deleteMiddlemanShowroomAndAdverts,
  getOrCreateMiddlemanShowroom,
  updateMiddlemanShowroom,
} from '../../../lib/middleman-showroom-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getMiddlemanContext() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) return null;
  if (isDealerAppSession(session) && !dealerRoleCan(session.dealerApp.role, 'showroom')) return null;
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  return { session, profile };
}

export async function DELETE() {
  try {
    const context = await getMiddlemanContext();
    if (!context) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
    const deletedAdvertCount = await deleteMiddlemanShowroomAndAdverts(context.profile);
    return NextResponse.json({ ok: true, deletedAdvertCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete your showroom.';
    if (message === 'SHOWROOM_LIVE_ADVERTS_REQUIRE_OUTCOMES') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Remove each live advert and record its outcome before deleting the showroom.',
        },
        { status: 409 },
      );
    }
    const status = message === 'SHOWROOM_FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function GET() {
  try {
    const context = await getMiddlemanContext();
    if (!context) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
    const showroom = await getOrCreateMiddlemanShowroom(context.profile);
    const listings = await listPublishedMarketplaceAssetListings({
      viewerUserId: context.session.user.id,
      sellerUserId: context.session.user.id,
      exposeContact: true,
    });
    return NextResponse.json({ ok: true, showroom, listings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load your showroom.';
    const status = message === 'SHOWROOM_FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await getMiddlemanContext();
    if (!context) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
    const body = (await request.json()) as { slug?: unknown; bio?: unknown; isPublic?: unknown; logoUrl?: unknown };
    const showroom = await updateMiddlemanShowroom({
      profile: context.profile,
      slug: String(body.slug ?? ''),
      bio: String(body.bio ?? ''),
      isPublic: body.isPublic !== false,
      logoUrl: typeof body.logoUrl === 'string' ? body.logoUrl : body.logoUrl === null ? null : undefined,
    });
    return NextResponse.json({ ok: true, showroom });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save your showroom.';
    const status = message === 'SHOWROOM_FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}


