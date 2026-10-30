import { NextRequest, NextResponse } from 'next/server';
import { getMarketplaceManualAccess } from '../../../../lib/marketplace-manual-access';
import { normalizeAdvertPublication } from '../../../../lib/advert-publication';
import { publishStudioAdvert } from '../../../../lib/marketplace-db';
import { getOrCreateMiddlemanShowroom } from '../../../../lib/middleman-showroom-db';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ ok: false, error: 'Invalid request origin.' }, { status: 403 });
  const access = await getMarketplaceManualAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'You do not have permission to publish listings.' }, { status: 403 });
  let input;
  try { input = normalizeAdvertPublication(await request.json()); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Check the advert details.' }, { status: 400 }); }
  try {
    const showroom = access.profile.accountType === 'dealer' ? await getOrCreateMiddlemanShowroom(access.profile) : null;
    const listing = await publishStudioAdvert(access.userId, input);
    return NextResponse.json({ ok: true, listing, showroomUrl: showroom ? `/showroom/${showroom.slug}` : null, showroomPublic: showroom?.isPublic ?? false });
  } catch (error) {
    console.error('Manual marketplace publication failed', error);
    return NextResponse.json({ ok: false, error: 'Could not publish. Your draft remains here; please try again.' }, { status: 500 });
  }
}
