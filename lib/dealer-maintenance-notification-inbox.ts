import {
  listDealerMaintenanceNotifications,
  type DealerMaintenanceNotification,
} from './dealer-maintenance-tracker';
import {
  listReadNotificationEventKeys,
  markNotificationEventKeysRead,
} from './app-notification-read-state';

export type DealerMaintenanceViewerNotification = DealerMaintenanceNotification & {
  assignedToViewer?: boolean;
};

function eventKey(notificationId: string): string {
  return `dealer-maintenance:${notificationId}`;
}

export async function listDealerMaintenanceNotificationsForViewer(input: {
  dealerUserId: string;
  viewerKey: string;
}): Promise<DealerMaintenanceViewerNotification[]> {
  const notifications = await listDealerMaintenanceNotifications(input.dealerUserId);
  const readKeys = await listReadNotificationEventKeys(
    input.viewerKey,
    notifications.map((notification) => eventKey(notification.id)),
  );

  return notifications.map((notification) => ({
    ...notification,
    isRead: readKeys.has(eventKey(notification.id)),
  }));
}

export async function markDealerMaintenanceNotificationsReadForViewer(input: {
  dealerUserId: string;
  viewerKey: string;
  notificationIds: string[];
}): Promise<void> {
  const requestedIds = new Set(
    input.notificationIds.map((value) => String(value ?? '').trim()).filter(Boolean),
  );
  if (!requestedIds.size) return;

  const notifications = await listDealerMaintenanceNotifications(input.dealerUserId);
  const allowedIds = notifications
    .map((notification) => notification.id)
    .filter((id) => requestedIds.has(id));

  await markNotificationEventKeysRead(
    input.viewerKey,
    allowedIds.map(eventKey),
  );
}
