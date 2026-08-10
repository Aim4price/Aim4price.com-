import { NextResponse } from 'next/server';
import { listAssetActivity } from '../../../../../../lib/asset-activity';
import { getAssetRegisterItemById } from '../../../../../../lib/asset-register-db';
import { getOwnerAppAccess, ownerAppCanAccessAsset } from '../../../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { assetId: string } }) {
  const access = await getOwnerAppAccess();
  if (!access) {
    return NextResponse.json({ ok: false, error: 'You must sign in to Aim4price Owner.' }, { status: 401 });
  }
  if (!ownerAppCanAccessAsset(access, params.assetId)) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }

  const asset = await getAssetRegisterItemById(access.ownerUserId, params.assetId);
  if (!asset) return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });

  try {
    const items = await listAssetActivity(access.ownerUserId, asset.id);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error('Owner App asset activity failed.', error);
    return NextResponse.json({ ok: false, error: 'Asset activity could not be loaded.' }, { status: 500 });
  }
}
