import { NextResponse } from 'next/server';
import {
  listNotificationInbox,
  updateNotificationInboxState,
  type NotificationInboxAction,
} from '../../../../lib/notification-inbox';
import { getOwnerAppAccess, ownerAppCan } from '../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'You must sign in to Aim4price Owner.' }, { status: 401 });

  try {
    const includeCostBudgetNotifications = ownerAppCan(access, 'manage_finance')
      && access.assetScope === 'all';
    const inbox = await listNotificationInbox({
      userId: access.ownerUserId,
      accountType: 'owner',
      viewerKey: access.viewerKey,
      includeCostBudgetNotifications,
    });
    const allowedAssetIds = access.assetScope === 'selected' ? new Set(access.accessibleAssetIds) : null;
    const notifications = inbox.filter((item) => {
      if (item.category === 'cost_budget' && !includeCostBudgetNotifications) return false;
      return !allowedAssetIds || !item.assetId || allowedAssetIds.has(item.assetId);
    });
    return NextResponse.json({
      ok: true,
      notifications,
      needsActionCount: notifications.filter((item) => item.state === 'needs_action').length,
      unreadCount: notifications.filter((item) => item.state === 'new').length,
    });
  } catch (error) {
    console.error('Owner App notifications GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load notifications.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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

    await updateNotificationInboxState({
      userId: access.viewerKey,
      action,
      notificationIds,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Owner App notifications PATCH failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to update notifications.' }, { status: 500 });
  }
}
