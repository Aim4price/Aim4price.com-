import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../lib/account-profile';
import { getAssetAcquisitionDetails, saveAssetAcquisitionDetails } from '../../../lib/asset-lifecycle';
import { getAssetRegisterItemById } from '../../../lib/asset-register-db';
import { getServerSession } from '../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ownerSession() {
  const session = await getServerSession();
  if (!session?.user?.id) return { session: null, response: NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 }) };
  const profile = await getAccountProfile(session.user);
  if (profile.accountType !== 'owner') return { session: null, response: NextResponse.json({ ok: false, error: 'Only the asset owner can change acquisition details.' }, { status: 403 }) };
  return { session, response: null };
}

export async function GET(request: NextRequest) {
  const auth = await ownerSession();
  if (!auth.session) return auth.response;
  const assetId = new URL(request.url).searchParams.get('assetId') || '';
  const asset = await getAssetRegisterItemById(auth.session.user.id, assetId);
  if (!asset) return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, acquisition: await getAssetAcquisitionDetails(auth.session.user.id, assetId) });
}

export async function PUT(request: NextRequest) {
  const auth = await ownerSession();
  if (!auth.session) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const acquisition = await saveAssetAcquisitionDetails({
      ownerUserId: auth.session.user.id,
      assetId: String(body.assetId ?? ''),
      newlyAcquired: body.newlyAcquired === true,
      acquisitionDate: body.acquisitionDate,
      acquisitionAmountExVat: body.acquisitionAmountExVat,
      note: body.note,
      sourceDocumentReference: body.sourceDocumentReference,
      actorName: auth.session.user.name,
    });
    return NextResponse.json({ ok: true, acquisition });
  } catch (error) {
    console.error('asset acquisition PUT failed', error);
    const message = error instanceof Error && error.message === 'ASSET_NOT_FOUND' ? 'Asset not found.' : 'Acquisition details could not be saved.';
    return NextResponse.json({ ok: false, error: message }, { status: message === 'Asset not found.' ? 404 : 400 });
  }
}
