import { listAssetMaintenanceRecords, type AssetMaintenanceRecord } from './asset-maintenance';
import {
  listReadNotificationEventKeys,
  markNotificationEventKeysRead,
} from './app-notification-read-state';

export type FieldManagerNotification = {
  id: string;
  maintenanceRecordId: string;
  assetId: string;
  title: string;
  body: string;
  href: string;
  createdAtIso: string;
  isRead: boolean;
  assignedToViewer: boolean;
};

function statusPriority(record: AssetMaintenanceRecord): number {
  if (record.computedStatus === 'overdue') return 0;
  if (record.computedStatus === 'due') return 1;
  if (record.computedStatus === 'due_soon') return 2;
  return 3;
}

function isSharedMaintenanceNotification(record: AssetMaintenanceRecord): boolean {
  return ['overdue', 'due', 'due_soon'].includes(record.computedStatus);
}

function dueText(record: AssetMaintenanceRecord): string {
  if (record.computedStatus === 'overdue') return 'This maintenance is overdue.';
  if (record.computedStatus === 'due') return 'This maintenance is due now.';

  if (record.triggerType === 'date' && record.dueDate) {
    const parsed = new Date(`${record.dueDate.slice(0, 10)}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      const date = new Intl.DateTimeFormat('en-ZA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(parsed);
      return `Due ${date}.`;
    }
  }

  if (record.triggerType === 'usage' && record.dueUsage !== null) {
    const unit = record.usageMetric === 'km'
      ? 'km'
      : record.usageMetric === 'percentage'
        ? '%'
        : 'hours';
    return `Due at ${record.dueUsage.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} ${unit}.`;
  }

  return 'Open Overview to review the maintenance target.';
}

function sharedTitle(record: AssetMaintenanceRecord, maintenanceLabel: string): string {
  if (record.computedStatus === 'overdue') return `${maintenanceLabel} overdue`;
  if (record.computedStatus === 'due') return `${maintenanceLabel} due now`;
  if (record.computedStatus === 'due_soon') return `${maintenanceLabel} due soon`;
  return `${maintenanceLabel} update`;
}

function eventKey(record: AssetMaintenanceRecord): string {
  return `field-manager-maintenance:${record.id}:${record.computedStatus}`;
}

function viewerKey(managerId: string): string {
  return `field-manager:${managerId}`;
}

async function currentNotificationRecords(input: {
  ownerUserId: string;
  managerId: string;
}): Promise<AssetMaintenanceRecord[]> {
  const records = await listAssetMaintenanceRecords(input.ownerUserId, { status: 'upcoming' });
  return records
    .filter((record) => (
      isSharedMaintenanceNotification(record)
      || record.assignedFieldManagerId === input.managerId
    ))
    .sort((left, right) => {
      const leftAssigned = left.assignedFieldManagerId === input.managerId;
      const rightAssigned = right.assignedFieldManagerId === input.managerId;
      if (leftAssigned !== rightAssigned) return leftAssigned ? -1 : 1;
      const priority = statusPriority(left) - statusPriority(right);
      if (priority) return priority;
      return Date.parse(right.updatedAtIso) - Date.parse(left.updatedAtIso);
    });
}

export async function listFieldManagerNotifications(input: {
  ownerUserId: string;
  managerId: string;
}): Promise<FieldManagerNotification[]> {
  const records = await currentNotificationRecords(input);
  const keys = records.map(eventKey);
  const readKeys = await listReadNotificationEventKeys(viewerKey(input.managerId), keys);

  return records.map((record) => {
    const key = eventKey(record);
    const maintenanceLabel = record.maintenanceType === 'checkup' ? 'Check-up' : 'Service';
    const assignedToViewer = record.assignedFieldManagerId === input.managerId;
    return {
      id: key,
      maintenanceRecordId: record.id,
      assetId: record.assetId,
      title: assignedToViewer
        ? `${maintenanceLabel} assigned to you`
        : sharedTitle(record, maintenanceLabel),
      body: `${record.assetTitle}: ${record.title}. ${dueText(record)}`,
      href: '/field-manager/overview',
      createdAtIso: record.updatedAtIso || record.createdAtIso,
      isRead: readKeys.has(key),
      assignedToViewer,
    };
  });
}

export async function markFieldManagerNotificationsRead(input: {
  ownerUserId: string;
  managerId: string;
  notificationIds: string[];
}): Promise<void> {
  const requested = new Set(
    input.notificationIds.map((value) => String(value ?? '').trim()).filter(Boolean),
  );
  if (!requested.size) return;

  const records = await currentNotificationRecords(input);
  const allowedKeys = records.map(eventKey).filter((key) => requested.has(key));
  await markNotificationEventKeysRead(viewerKey(input.managerId), allowedKeys);
}
