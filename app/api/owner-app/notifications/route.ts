import { NextResponse } from 'next/server';
import { isTrustedNotificationRequest } from '../../../../lib/notification-request-origin';
import { listOwnerNotificationInbox, markOwnerNotificationsRead } from '../../../../lib/owner-notification-inbox';
import type { NotificationInboxAction } from '../../../../lib/notification-inbox';
import { getOwnerAppAccess } from '../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'You must sign in to Aim4price Owner.' }, { status: 401 });

  try {
    const notifications = await listOwnerNotificationInbox(access);
    return NextResponse.json({
      ok: true,
      notifications,
      needsActionCount: notifications.filter((item) => item.state === 'needs_action').length,
      unreadCount: notifications.filter((item) => item.state === 'new').length,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Owner App notifications GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load notifications.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isTrustedNotificationRequest(request)) return NextResponse.json({ ok: false, error: 'Open notifications from Aim4price.' }, { status: 403 });
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'You must sign in to Aim4price Owner.' }, { status: 401 });

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

    await markOwnerNotificationsRead(access, action, notificationIds);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Owner App notifications PATCH failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to update notifications.' }, { status: 500 });
  }
}

