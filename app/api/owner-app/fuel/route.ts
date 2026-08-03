import { NextResponse } from 'next/server';
import { listFieldManagerFuelStorages } from '../../../../lib/field-manager';
import { getOwnerAppAccess } from '../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await getOwnerAppAccess();
  if (!access) {
    return NextResponse.json({ ok: false, error: 'You must sign in to Aim4price Owner.' }, { status: 401 });
  }

  try {
    const storages = await listFieldManagerFuelStorages(access.ownerUserId);
    return NextResponse.json({ ok: true, storages });
  } catch (error) {
    console.error('Owner App fuel storage GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load fuel storage units.' }, { status: 500 });
  }
}
