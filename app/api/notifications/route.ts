import { NextResponse } from 'next/server';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession } from '../../../lib/auth-session';
import {
  listNotificationInbox,
  updateNotificationInboxState,
  type NotificationInboxAction,
} from '../../../lib/notification-inbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

async function notificationViewer() {
  const session = await getServerSession();
  if (!session?.user?.id) return null;

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  return {
    userId: session.user.id,
    accountType: profile.accountType,
    viewerKey: `account:${session.user.id}`,
  };
}

export async function GET() {
  const viewer = await notificationViewer();
  if (!viewer) return unauthorized();

  try {
    const notifications = await listNotificationInbox(viewer);
    return NextResponse.json({
      ok: true,
      notifications,
      needsActionCount: notifications.filter((item) => item.state === 'needs_action').length,
      unreadCount: notifications.filter((item) => item.state === 'new').length,
    });
  } catch (error) {
    console.error('notifications GET failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to load notifications.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const viewer = await notificationViewer();
  if (!viewer) return unauthorized();

  try {
    const body = await request.json().catch(() => null) as {
      action?: NotificationInboxAction;
      notificationIds?: unknown[];
    } | null;
    const action = body?.action;
    const rawNotificationIds = body?.notificationIds;
    const notificationIds = Array.isArray(rawNotificationIds)
      ? rawNotificationIds.map((value) => String(value ?? ''))
      : [];

    if (!action || !['mark_read', 'archive', 'resolve'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'A valid notification action is required.' }, { status: 400 });
    }

    await updateNotificationInboxState({
      userId: viewer.viewerKey,
      action,
      notificationIds,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('notifications PATCH failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to update notifications.' }, { status: 500 });
  }
}
