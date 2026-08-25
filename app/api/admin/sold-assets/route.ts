import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import { adminAllocateDisposedAsset, adminDeleteSoldAsset } from '../../../../lib/asset-transfers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function value(body: Record<string, unknown>, key: string): string {
  return String(body[key] ?? '').trim();
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'ADMIN_ASSET_ALLOCATION_SAME_ACCOUNT') return NextResponse.json({ ok: false, error: 'Choose a different destination account.' }, { status: 400 });
  if (code === 'ADMIN_ASSET_ALLOCATION_ACCOUNT_REQUIRED') return NextResponse.json({ ok: false, error: 'Assets can only be allocated to an active Owner or Dealer account.' }, { status: 400 });
  if (code === 'ADMIN_ASSET_ALLOCATION_NOT_FOUND' || code === 'ADMIN_SOLD_ASSET_NOT_FOUND') return NextResponse.json({ ok: false, error: 'This sold asset record could not be found.' }, { status: 404 });
  if (code === 'ADMIN_ASSET_ALLOCATION_NOT_AVAILABLE') return NextResponse.json({ ok: false, error: 'This asset has already moved or is no longer available to allocate.' }, { status: 409 });
  if (code === 'ADMIN_SOLD_ASSET_DELETE_NOT_AVAILABLE') return NextResponse.json({ ok: false, error: 'A claimed or already moved asset cannot be deleted from the seller account.' }, { status: 409 });
  console.error('admin sold asset action failed', error);
  return NextResponse.json({ ok: false, error: 'The sold asset action could not be completed.' }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = value(body, 'action');
    const lifecycleEventId = value(body, 'lifecycleEventId');
    const assetId = value(body, 'assetId');
    const sellerUserId = value(body, 'sellerUserId');
    if (!lifecycleEventId || !assetId || !sellerUserId) {
      return NextResponse.json({ ok: false, error: 'The sold asset reference is incomplete.' }, { status: 400 });
    }
    if (action === 'allocate') {
      const buyerUserId = value(body, 'buyerUserId');
      if (!buyerUserId) return NextResponse.json({ ok: false, error: 'Choose a destination account.' }, { status: 400 });
      const allocation = await adminAllocateDisposedAsset({
        lifecycleEventId,
        assetId,
        sellerUserId,
        buyerUserId,
        adminUserId: access.actor.userId,
        adminName: access.actor.displayName,
      });
      return NextResponse.json({ ok: true, allocation });
    }
    if (action === 'delete') {
      await adminDeleteSoldAsset({
        lifecycleEventId,
        assetId,
        sellerUserId,
        adminUserId: access.actor.userId,
        adminName: access.actor.displayName,
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: 'Unsupported sold asset action.' }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
