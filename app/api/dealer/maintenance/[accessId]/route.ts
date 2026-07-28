import { NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getServerSession } from '../../../../../lib/auth-session';
import {
  getDealerTrackedAsset,
  revokeDealerMaintenanceTracking,
} from '../../../../../lib/dealer-maintenance-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { accessId: string } }) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Dealer App login is required.' }, { status: 401 });
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    return NextResponse.json({ ok: false, error: 'Dealer App access is not available.' }, { status: 403 });
  }

  try {
    const asset = await getDealerTrackedAsset(session.user.id, String(params.accessId ?? '').trim());
    if (!asset) {
      return NextResponse.json({ ok: false, error: 'This tracked asset is no longer available.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    console.error('Dealer tracked asset GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load the tracked asset.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { accessId: string } }) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Dealer App login is required.' }, { status: 401 });
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    return NextResponse.json({ ok: false, error: 'Dealer App access is not available.' }, { status: 403 });
  }

  try {
    const accessId = String(params.accessId ?? '').trim();
    const asset = await getDealerTrackedAsset(session.user.id, accessId);
    if (!asset) {
      return NextResponse.json({ ok: false, error: 'This tracked asset is no longer available.' }, { status: 404 });
    }

    const revoked = await revokeDealerMaintenanceTracking({
      ownerUserId: asset.ownerUserId,
      assetId: asset.assetId,
      accessId: asset.accessId,
    });
    if (!revoked) {
      return NextResponse.json({ ok: false, error: 'This tracked asset is no longer available.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Dealer tracked asset DELETE failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to delete the tracked asset.' }, { status: 500 });
  }
}
