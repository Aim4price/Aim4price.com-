import { NextResponse } from 'next/server';
import { listManagerFuelStorages } from '../../../../lib/manager-operational-assets';
import { getOwnerAppAccess, managerCanAccessTank } from '../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await getOwnerAppAccess();
  if (!access) {
    return NextResponse.json({ ok: false, error: 'You must sign in to Aim4price Manager.' }, { status: 401 });
  }

  try {
    const storages = await listManagerFuelStorages(access.ownerUserId);
    return NextResponse.json({ ok: true, storages: storages.filter(storage => managerCanAccessTank(access, storage.id)) });
  } catch (error) {
    console.error('Manager App fuel storage GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load fuel storage units.' }, { status: 500 });
  }
}
