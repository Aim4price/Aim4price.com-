import { NextRequest, NextResponse } from 'next/server';
import { getOwnerAppAccess } from '../../../../lib/owner-app-access';
import { dismissOwnerAppOverviewItem, listOwnerAppOverview, type OwnerAppOverviewRange } from '../../../../lib/owner-app-overview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function range(value: unknown): OwnerAppOverviewRange {
  return String(value ?? '') === 'week' ? 'week' : 'upcoming';
}

export async function GET(request: NextRequest) {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'You must sign in to Aim4price Owner.' }, { status: 401 });
  try {
    return NextResponse.json(await listOwnerAppOverview(
      access.ownerUserId,
      access.viewerKey,
      range(request.nextUrl.searchParams.get('range')),
      access.assetScope === 'selected' ? access.accessibleAssetIds : null,
    ));
  }
  catch (error) { console.error('Owner App attention GET failed.', error); return NextResponse.json({ ok: false, error: 'Failed to load Needs Attention.' }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'You must sign in to Aim4price Owner.' }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    await dismissOwnerAppOverviewItem(
      access.ownerUserId,
      access.viewerKey,
      range(body.range),
      String(body.itemId ?? ''),
      String(body.sourceId ?? ''),
      access.assetScope === 'selected' ? access.accessibleAssetIds : null,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Owner App attention dismiss failed.', error);
    return NextResponse.json({ ok: false, error: 'This item could not be cleared.' }, { status: 400 });
  }
}
