import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import { adminDeleteMarketplaceAsset } from '../../../../lib/admin-marketplace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function value(body: Record<string, unknown>, key: string): string {
  return String(body[key] ?? '').trim();
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (
    code === 'ADMIN_MARKETPLACE_REFERENCE_REQUIRED' ||
    code === 'ADMIN_MARKETPLACE_REFERENCE_INVALID'
  ) {
    return NextResponse.json(
      { ok: false, error: 'The marketplace listing reference is incomplete or invalid.' },
      { status: 400 },
    );
  }
  if (code === 'ADMIN_MARKETPLACE_LISTING_NOT_FOUND') {
    return NextResponse.json({ ok: false, error: 'This marketplace record no longer exists.' }, { status: 404 });
  }

  console.error('admin marketplace listing deletion failed', error);
  return NextResponse.json({ ok: false, error: 'The marketplace record could not be deleted.' }, { status: 500 });
}

export async function DELETE(request: NextRequest) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;

  try {
    const body = await request.json() as Record<string, unknown>;
    const accountUserId = value(body, 'accountUserId');
    const sourceAssetId = value(body, 'sourceAssetId') || null;
    const latestListingId = value(body, 'latestListingId');
    if (!accountUserId || !latestListingId) {
      return NextResponse.json(
        { ok: false, error: 'The marketplace listing reference is incomplete.' },
        { status: 400 },
      );
    }

    const deletion = await adminDeleteMarketplaceAsset({
      accountUserId,
      sourceAssetId,
      latestListingId,
      adminUserId: access.actor.userId,
      adminName: access.actor.displayName,
    });
    return NextResponse.json({ ok: true, deletion });
  } catch (error) {
    return errorResponse(error);
  }
}
