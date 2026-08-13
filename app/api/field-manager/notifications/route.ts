import { NextRequest, NextResponse } from 'next/server';
import {
  listFieldManagerNotifications,
  markFieldManagerNotificationsRead,
} from '../../../../lib/field-manager-notifications';
import { requireActiveFieldManagerSession } from '../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = await requireActiveFieldManagerSession(request);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  try {
    const notifications = await listFieldManagerNotifications({
      ownerUserId: access.session.ownerUserId,
      managerId: access.session.managerId,
    });
    return NextResponse.json({
      ok: true,
      notifications,
      unreadCount: notifications.filter((notification) => !notification.isRead).length,
    });
  } catch (error) {
    console.error('Field Manager notifications GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load notifications.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireActiveFieldManagerSession(request);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json().catch(() => null) as { notificationIds?: unknown[] } | null;
    const notificationIds = Array.isArray(body?.notificationIds)
      ? body.notificationIds.map((value) => String(value ?? '').trim()).filter(Boolean)
      : [];

    await markFieldManagerNotificationsRead({
      ownerUserId: access.session.ownerUserId,
      managerId: access.session.managerId,
      notificationIds,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Field Manager notifications PATCH failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to clear notifications.' }, { status: 500 });
  }
}
