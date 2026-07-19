import { NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getServerSession } from '../../../../../lib/auth-session';
import {
  listDealerMaintenanceNotifications,
  markDealerMaintenanceNotificationsRead,
} from '../../../../../lib/dealer-maintenance-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function dealerUserId(): Promise<string> {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) return '';
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  return profile.accountType === 'dealer' && profile.accountStatus === 'active' ? session.user.id : '';
}

export async function GET() {
  const userId = await dealerUserId();
  if (!userId) return NextResponse.json({ ok: false, error: 'Dealer App login is required.' }, { status: 401 });
  try {
    const notifications = await listDealerMaintenanceNotifications(userId);
    return NextResponse.json({
      ok: true,
      notifications,
      unreadCount: notifications.filter((notification) => !notification.isRead).length,
    });
  } catch (error) {
    console.error('Dealer maintenance notifications GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load maintenance notifications.' }, { status: 500 });
  }
}

export async function POST() {
  const userId = await dealerUserId();
  if (!userId) return NextResponse.json({ ok: false, error: 'Dealer App login is required.' }, { status: 401 });
  try {
    await markDealerMaintenanceNotificationsRead(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Dealer maintenance notifications POST failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to mark notifications as read.' }, { status: 500 });
  }
}
