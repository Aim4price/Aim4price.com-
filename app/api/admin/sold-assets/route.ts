import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import { adminAllocateDisposedAsset, adminDeleteDisposedAsset } from '../../../../lib/asset-transfers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function value(body: Record<string, unknown>, key: string): string {
  return String(body[key] ?? '').trim();
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'ADMIN_ASSET_ALLOCATION_ACCOUNT_REQUIRED') return NextResponse.json({ ok: false, error: 'Assets can only be allocated to an active Owner or Dealer account.' }, { status: 400 });
  if (code === 'ADMIN_ASSET_ALLOCATION_NOT_FOUND' || code === 'ADMIN_DISPOSED_ASSET_NOT_FOUND') return NextResponse.json({ ok: false, error: 'This asset outcome record could not be found.' }, { status: 404 });
  if (code === 'ADMIN_ASSET_ALLOCATION_NOT_AVAILABLE') return NextResponse.json({ ok: false, error: 'This asset has already moved or is no longer available to allocate.' }, { status: 409 });
  if (code === 'ADMIN_DISPOSED_ASSET_DELETE_NOT_AVAILABLE') return NextResponse.json({ ok: false, error: 'An allocated or already moved asset cannot be deleted from its source account.' }, { status: 409 });
  const postgresCode = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
  if (postgresCode === '40P01' || postgresCode === '40001') {
    console.error('admin asset outcome action exhausted database retries', error);
    return NextResponse.json({
      ok: false,
      error: 'The database was briefly busy. No asset data was changed. Please try once more.',
    }, { status: 503 });
  }
  console.error('admin asset outcome action failed', error);
  return NextResponse.json({ ok: false, error: 'The asset outcome action could not be completed.' }, { status: 500 });
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
      return NextResponse.json({ ok: false, error: 'The asset outcome reference is incomplete.' }, { status: 400 });
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
      await adminDeleteDisposedAsset({
        lifecycleEventId,
        assetId,
        sellerUserId,
        adminUserId: access.actor.userId,
        adminName: access.actor.displayName,
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: 'Unsupported asset outcome action.' }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
