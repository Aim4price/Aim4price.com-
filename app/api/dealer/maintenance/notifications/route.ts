import { NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getServerSession, isDealerAppSession } from '../../../../../lib/auth-session';
import {
  listDealerMaintenanceNotificationsForViewer,
  markDealerMaintenanceNotificationsReadForViewer,
} from '../../../../../lib/dealer-maintenance-notification-inbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DealerNotificationContext = {
  dealerUserId: string;
  viewerKey: string;
  staffId: string | null;
};

async function dealerNotificationContext(): Promise<DealerNotificationContext | null> {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) return null;

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') return null;

  const dealerAppSession = isDealerAppSession(session) ? session.dealerApp : null;
  return {
    dealerUserId: session.user.id,
    viewerKey: dealerAppSession
      ? `dealer-staff:${dealerAppSession.staffId}`
      : `account:${session.user.id}`,
    staffId: dealerAppSession?.staffId ?? null,
  };
}

export async function GET() {
  const context = await dealerNotificationContext();
  if (!context) return NextResponse.json({ ok: false, error: 'Dealer App login is required.' }, { status: 401 });

  try {
    const notifications = await listDealerMaintenanceNotificationsForViewer(context);
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

export async function POST(request: Request) {
  const context = await dealerNotificationContext();
  if (!context) return NextResponse.json({ ok: false, error: 'Dealer App login is required.' }, { status: 401 });

  try {
    const body = await request.json().catch(() => null) as { notificationIds?: unknown[] } | null;
    let notificationIds = Array.isArray(body?.notificationIds)
      ? body.notificationIds.map((value) => String(value ?? '').trim()).filter(Boolean)
      : [];

    // Keep older clients safe: an empty body still means "mark all checked" for
    // this viewer only, never for the whole dealership.
    if (!notificationIds.length) {
      const notifications = await listDealerMaintenanceNotificationsForViewer(context);
      notificationIds = notifications.filter((notification) => !notification.isRead).map((notification) => notification.id);
    }

    await markDealerMaintenanceNotificationsReadForViewer({
      ...context,
      notificationIds,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Dealer maintenance notifications POST failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to mark notifications as read.' }, { status: 500 });
  }
}

