import { NextResponse } from 'next/server';
import { listHeaderNotifications } from '../../../../lib/notifications';
import { getOwnerAppAccess } from '../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'You must sign in to Aim4price Owner.' }, { status: 401 });
  try {
    const notifications = await listHeaderNotifications({ userId: access.ownerUserId, accountType: 'owner' });
    return NextResponse.json({ ok: true, notifications });
  } catch (error) {
    console.error('Owner App notifications GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load notifications.' }, { status: 500 });
  }
}
