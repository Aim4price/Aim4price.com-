import { NextRequest, NextResponse } from 'next/server';
import { getAssetRegisterItemById } from '../../../lib/asset-register-db';
import {
  listOwnerDealerMaintenanceAccess,
  revokeDealerMaintenanceTracking,
} from '../../../lib/dealer-maintenance-tracker';
import { getOwnerAppAccess } from '../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'Owner App login is required.' }, { status: 401 });
  const assetId = String(request.nextUrl.searchParams.get('assetId') ?? '').trim();
  if (!assetId || !(await getAssetRegisterItemById(access.ownerUserId, assetId))) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }
  try {
    const trackingAccess = await listOwnerDealerMaintenanceAccess(access.ownerUserId, assetId);
    return NextResponse.json({ ok: true, trackingAccess });
  } catch (error) {
    console.error('Owner dealer maintenance access GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load dealer tracking settings.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'Owner App login is required.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { assetId?: unknown; dealerUserId?: unknown } | null;
  const assetId = String(body?.assetId ?? '').trim();
  const dealerUserId = String(body?.dealerUserId ?? '').trim();
  if (!assetId || !dealerUserId || !(await getAssetRegisterItemById(access.ownerUserId, assetId))) {
    return NextResponse.json({ ok: false, error: 'Tracked asset or dealer not found.' }, { status: 404 });
  }
  try {
    const revoked = await revokeDealerMaintenanceTracking({
      ownerUserId: access.ownerUserId,
      assetId,
      dealerUserId,
    });
    return NextResponse.json({ ok: true, revoked });
  } catch (error) {
    console.error('Owner dealer maintenance access DELETE failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to stop dealer tracking.' }, { status: 500 });
  }
}
