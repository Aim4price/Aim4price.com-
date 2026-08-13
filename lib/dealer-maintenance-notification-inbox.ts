import {
  listDealerMaintenanceNotifications,
  type DealerMaintenanceNotification,
} from './dealer-maintenance-tracker';
import {
  listReadNotificationEventKeys,
  markNotificationEventKeysRead,
} from './app-notification-read-state';
import { getDb } from './db';

export type DealerMaintenanceViewerNotification = {
  id: string;
  accessId: string;
  assetId: string;
  maintenanceRecordId: string;
  status: DealerMaintenanceNotification['status'] | 'assigned_problem';
  title: string;
  body: string;
  isRead: boolean;
  createdAtIso: string;
  assignedToViewer: boolean;
};

type AssignedProblemRow = {
  assignment_id: string;
  access_id: string;
  asset_id: string;
  asset_title: string | null;
  priority: string | null;
  workflow_status: string | null;
  due_date: string | Date | null;
  assigned_at: string | Date | null;
  updated_at: string | Date | null;
};

function eventKey(notificationId: string): string {
  return `dealer-notification:${notificationId}`;
}

function iso(value: string | Date | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function formatDueDate(value: string | Date | null): string {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

async function listAssignedProblemNotifications(input: {
  dealerUserId: string;
  staffId: string | null | undefined;
}): Promise<DealerMaintenanceViewerNotification[]> {
  if (!input.staffId) return [];

  const tableCheck = await getDb().query<{ table_name: string | null }>(
    `select to_regclass('public.dealer_problem_assignments')::text as table_name`,
  );
  if (!tableCheck.rows[0]?.table_name) return [];

  const result = await getDb().query<AssignedProblemRow>(
    `
      select
        assignment.id::text as assignment_id,
        access.id::text as access_id,
        assignment.asset_register_item_id::text as asset_id,
        asset.title as asset_title,
        assignment.priority,
        assignment.workflow_status,
        assignment.due_date,
        assignment.assigned_at,
        assignment.updated_at
      from public.dealer_problem_assignments assignment
      inner join public.dealer_maintenance_access access
        on access.dealer_user_id = assignment.dealer_user_id
       and access.asset_register_item_id = assignment.asset_register_item_id
       and access.is_active = true
      inner join public.asset_register_items asset
        on asset.id = assignment.asset_register_item_id
      where assignment.dealer_user_id = $1
        and assignment.assigned_staff_id = $2::uuid
        and assignment.workflow_status <> 'resolved'
      order by assignment.updated_at desc, assignment.id desc
      limit 30
    `,
    [input.dealerUserId, input.staffId],
  );

  return result.rows.map((row) => {
    const priority = String(row.priority ?? 'normal').trim().toLowerCase();
    const workflow = String(row.workflow_status ?? 'assigned').trim().replace(/_/g, ' ');
    const dueDate = formatDueDate(row.due_date);
    const assetTitle = String(row.asset_title ?? '').trim() || 'Tracked asset';
    const details = [
      priority !== 'normal' ? `${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority` : '',
      workflow ? `${workflow.charAt(0).toUpperCase()}${workflow.slice(1)}` : '',
      dueDate ? `Due ${dueDate}` : '',
    ].filter(Boolean).join(' · ');

    return {
      id: `assigned-problem:${row.assignment_id}:${iso(row.updated_at)}`,
      accessId: row.access_id,
      assetId: row.asset_id,
      maintenanceRecordId: '',
      status: 'assigned_problem' as const,
      title: 'Problem assigned to you',
      body: `${assetTitle}${details ? ` · ${details}` : ''}. Open Maintenance to review the reported problem or note.`,
      isRead: false,
      createdAtIso: iso(row.assigned_at || row.updated_at),
      assignedToViewer: true,
    };
  });
}

export async function listDealerMaintenanceNotificationsForViewer(input: {
  dealerUserId: string;
  viewerKey: string;
  staffId?: string | null;
}): Promise<DealerMaintenanceViewerNotification[]> {
  const [maintenanceNotifications, assignedProblemNotifications] = await Promise.all([
    listDealerMaintenanceNotifications(input.dealerUserId),
    listAssignedProblemNotifications({
      dealerUserId: input.dealerUserId,
      staffId: input.staffId,
    }),
  ]);

  const notifications: DealerMaintenanceViewerNotification[] = [
    ...assignedProblemNotifications,
    ...maintenanceNotifications.map((notification) => ({
      ...notification,
      assignedToViewer: false,
    })),
  ].sort((left, right) => {
    if (left.assignedToViewer !== right.assignedToViewer) return left.assignedToViewer ? -1 : 1;
    return Date.parse(right.createdAtIso) - Date.parse(left.createdAtIso);
  });

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
  staffId?: string | null;
  notificationIds: string[];
}): Promise<void> {
  const requestedIds = new Set(
    input.notificationIds.map((value) => String(value ?? '').trim()).filter(Boolean),
  );
  if (!requestedIds.size) return;

  const notifications = await listDealerMaintenanceNotificationsForViewer(input);
  const allowedIds = notifications
    .map((notification) => notification.id)
    .filter((id) => requestedIds.has(id));

  await markNotificationEventKeysRead(
    input.viewerKey,
    allowedIds.map(eventKey),
  );
}

