import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import {
  adminDeleteMarketplaceAsset,
  getAdminMarketplaceViewDetails,
} from '../../../../lib/admin-marketplace';

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

export async function GET(request: NextRequest) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;

  const { searchParams } = new URL(request.url);
  const sourceAssetId = String(searchParams.get('assetId') ?? '').trim();
  if (!sourceAssetId) {
    return NextResponse.json(
      { ok: false, error: 'Choose a marketplace asset to view its activity.' },
      { status: 400 },
    );
  }

  try {
    const details = await getAdminMarketplaceViewDetails({
      sourceAssetId,
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 100),
    });

    return NextResponse.json(
      { ok: true, details },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'ADMIN_MARKETPLACE_VIEW_REFERENCE_INVALID') {
      return NextResponse.json(
        { ok: false, error: 'The marketplace asset reference is invalid.' },
        { status: 400 },
      );
    }

    console.error('admin marketplace view activity failed', error);
    return NextResponse.json(
      { ok: false, error: 'Marketplace view activity could not be loaded.' },
      { status: 500 },
    );
  }
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
