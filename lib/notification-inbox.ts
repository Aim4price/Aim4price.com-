import { getDb } from './db';
import {
  listComputedHeaderNotifications,
  type HeaderNotificationItem,
  type HeaderNotificationCategory,
  type HeaderNotificationTone,
} from './notifications';
import type { AccountRole } from './partner-access';

export type NotificationInboxState = 'needs_action' | 'new' | 'history';
export type NotificationInboxAction = 'mark_read' | 'archive' | 'resolve';

export type NotificationInboxItem = HeaderNotificationItem & {
  state: NotificationInboxState;
  actionRequired: boolean;
  isRead: boolean;
  isArchived: boolean;
  readAtIso: string | null;
  archivedAtIso: string | null;
  resolvedAtIso: string | null;
};

type NotificationInboxRow = {
  event_key: string;
  category: string;
  tone: string;
  title: string;
  body: string;
  href: string;
  source_created_at: Date | string;
  action_required: boolean;
  payload: unknown;
  read_at: Date | string | null;
  archived_at: Date | string | null;
  resolved_at: Date | string | null;
};

type ListNotificationInboxInput = {
  userId: string;
  accountType: AccountRole | string | null | undefined;
  viewerKey?: string | null;
};

const MAX_INBOX_HISTORY = 500;
const MAX_STATE_UPDATE_IDS = 250;

let ensureNotificationInboxPromise: Promise<void> | null = null;

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function cleanStateKey(value: unknown): string {
  return String(value ?? '').trim().slice(0, 240);
}

function inboxStateKey(input: Pick<ListNotificationInboxInput, 'userId' | 'viewerKey'>): string {
  return cleanStateKey(input.viewerKey) || cleanStateKey(input.userId);
}

function isActionRequired(item: HeaderNotificationItem): boolean {
  return Boolean(
    item.assetDiscoveryEnquiryId
    || item.dealerAssetCorrectionId
    || item.dealerMaintenanceScheduleProposalId
    || item.dealerCostInvoiceId
    || item.captureRequestId,
  );
}

function payloadFor(item: HeaderNotificationItem): Record<string, unknown> {
  return {
    assetId: item.assetId,
    assetDiscoveryEnquiryId: item.assetDiscoveryEnquiryId,
    dealerAssetCorrectionId: item.dealerAssetCorrectionId,
    dealerAssetCorrectionAction: item.dealerAssetCorrectionAction,
    dealerMaintenanceScheduleProposalId: item.dealerMaintenanceScheduleProposalId,
    dealerCostInvoiceId: item.dealerCostInvoiceId,
    dealerCostAction: item.dealerCostAction,
    captureRequestId: item.captureRequestId,
    priority: Boolean(item.priority),
  };
}

export async function ensureNotificationInboxTables(): Promise<void> {
  if (!ensureNotificationInboxPromise) {
    ensureNotificationInboxPromise = (async () => {
      const db = getDb();
      await db.query(`
        create table if not exists public.user_notifications (
          id uuid primary key default gen_random_uuid(),
          user_id text not null,
          event_key text not null,
          category text not null,
          tone text not null,
          title text not null,
          body text not null,
          href text not null default '',
          source_created_at timestamptz not null,
          action_required boolean not null default false,
          payload jsonb not null default '{}'::jsonb,
          read_at timestamptz,
          archived_at timestamptz,
          resolved_at timestamptz,
          last_seen_at timestamptz not null default now(),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (user_id, event_key)
        )
      `);
      await db.query(`
        create index if not exists user_notifications_user_activity_idx
          on public.user_notifications (user_id, source_created_at desc)
      `);
      await db.query(`
        create index if not exists user_notifications_user_state_idx
          on public.user_notifications (user_id, action_required, read_at, archived_at)
      `);
    })().catch((error) => {
      ensureNotificationInboxPromise = null;
      throw error;
    });
  }

  await ensureNotificationInboxPromise;
}

async function syncNotificationSnapshots(
  stateKey: string,
  notifications: HeaderNotificationItem[],
): Promise<void> {
  if (!notifications.length) return;

  const snapshots = notifications.map((item) => ({
    event_key: item.id,
    category: item.category,
    tone: item.tone,
    title: item.title,
    body: item.body,
    href: item.href,
    source_created_at: item.createdAtIso,
    action_required: isActionRequired(item),
    payload: payloadFor(item),
  }));

  await getDb().query(
    `
      insert into public.user_notifications (
        user_id,
        event_key,
        category,
        tone,
        title,
        body,
        href,
        source_created_at,
        action_required,
        payload,
        last_seen_at,
        created_at,
        updated_at
      )
      select
        $1,
        snapshot.event_key,
        snapshot.category,
        snapshot.tone,
        snapshot.title,
        snapshot.body,
        snapshot.href,
        snapshot.source_created_at,
        snapshot.action_required,
        snapshot.payload,
        now(),
        now(),
        now()
      from jsonb_to_recordset($2::jsonb) as snapshot(
        event_key text,
        category text,
        tone text,
        title text,
        body text,
        href text,
        source_created_at timestamptz,
        action_required boolean,
        payload jsonb
      )
      on conflict (user_id, event_key) do update
      set
        category = excluded.category,
        tone = excluded.tone,
        title = excluded.title,
        body = excluded.body,
        href = excluded.href,
        source_created_at = excluded.source_created_at,
        action_required = excluded.action_required,
        payload = excluded.payload,
        last_seen_at = now(),
        updated_at = now()
    `,
    [stateKey, JSON.stringify(snapshots)],
  );
}

async function resolveStaleCaptureSnapshots(
  stateKey: string,
  ownerUserId: string,
): Promise<void> {
  await getDb().query(
    `
      update public.user_notifications notification
      set
        read_at = coalesce(read_at, now()),
        resolved_at = coalesce(resolved_at, now()),
        updated_at = now()
      where notification.user_id = $1
        and notification.category = 'capture'
        and notification.action_required = true
        and notification.resolved_at is null
        and not exists (
          select 1
          from public.document_capture_requests request
          where request.id::text = notification.payload->>'captureRequestId'
            and request.owner_user_id = $2
            and request.request_type = 'invoice'
            and request.status = 'awaiting_owner'
        )
    `,
    [stateKey, ownerUserId],
  );
}

function mapInboxItem(row: NotificationInboxRow, currentKeys: Set<string>): NotificationInboxItem {
  const payload = asRecord(row.payload);
  const readAtIso = iso(row.read_at);
  const archivedAtIso = iso(row.archived_at);
  const current = currentKeys.has(row.event_key);
  const resolvedAtIso = iso(row.resolved_at)
    || (row.action_required && !current ? new Date().toISOString() : null);

  const state: NotificationInboxState =
    current && !readAtIso && !archivedAtIso
      ? row.action_required && !resolvedAtIso
        ? 'needs_action'
        : 'new'
      : 'history';

  return {
    id: row.event_key,
    category: row.category as HeaderNotificationCategory,
    tone: row.tone as HeaderNotificationTone,
    title: row.title,
    body: row.body,
    href: row.href,
    createdAtIso: iso(row.source_created_at) || new Date(0).toISOString(),
    assetId: asOptionalText(payload.assetId),
    assetDiscoveryEnquiryId: asOptionalText(payload.assetDiscoveryEnquiryId),
    dealerAssetCorrectionId: asOptionalText(payload.dealerAssetCorrectionId),
    dealerAssetCorrectionAction: asOptionalText(payload.dealerAssetCorrectionAction) as NotificationInboxItem['dealerAssetCorrectionAction'],
    dealerMaintenanceScheduleProposalId: asOptionalText(payload.dealerMaintenanceScheduleProposalId),
    dealerCostInvoiceId: asOptionalText(payload.dealerCostInvoiceId),
    dealerCostAction: asOptionalText(payload.dealerCostAction) as NotificationInboxItem['dealerCostAction'],
    captureRequestId: asOptionalText(payload.captureRequestId),
    priority: payload.priority === true,
    state,
    actionRequired: row.action_required,
    isRead: Boolean(readAtIso),
    isArchived: Boolean(archivedAtIso),
    readAtIso,
    archivedAtIso,
    resolvedAtIso,
  };
}

export async function listNotificationInbox(
  input: ListNotificationInboxInput,
): Promise<NotificationInboxItem[]> {
  await ensureNotificationInboxTables();

  const stateKey = inboxStateKey(input);
  const currentNotifications = await listComputedHeaderNotifications({
    userId: input.userId,
    accountType: input.accountType,
  });
  await syncNotificationSnapshots(stateKey, currentNotifications);
  await resolveStaleCaptureSnapshots(stateKey, input.userId);

  const result = await getDb().query<NotificationInboxRow>(
    `
      select
        event_key,
        category,
        tone,
        title,
        body,
        href,
        source_created_at,
        action_required,
        payload,
        read_at,
        archived_at,
        resolved_at
      from public.user_notifications
      where user_id = $1
      order by
        case when action_required and resolved_at is null then 0 else 1 end,
        source_created_at desc,
        event_key desc
      limit $2
    `,
    [stateKey, MAX_INBOX_HISTORY],
  );

  const currentKeys = new Set(currentNotifications.map((item) => item.id));
  return result.rows
    .map((row) => mapInboxItem(row, currentKeys))
    .sort((left, right) => {
      const stateOrder: Record<NotificationInboxState, number> = {
        needs_action: 0,
        new: 1,
        history: 2,
      };
      return stateOrder[left.state] - stateOrder[right.state]
        || Date.parse(right.createdAtIso) - Date.parse(left.createdAtIso);
    });
}

export async function updateNotificationInboxState(input: {
  userId: string;
  action: NotificationInboxAction;
  notificationIds: string[];
}): Promise<void> {
  await ensureNotificationInboxTables();

  const stateKey = cleanStateKey(input.userId);
  if (!stateKey) return;

  const notificationIds = Array.from(new Set(
    input.notificationIds
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  )).slice(0, MAX_STATE_UPDATE_IDS);

  if (!notificationIds.length) return;

  if (input.action === 'mark_read') {
    await getDb().query(
      `
        update public.user_notifications
        set read_at = coalesce(read_at, now()), updated_at = now()
        where user_id = $1 and event_key = any($2::text[])
      `,
      [stateKey, notificationIds],
    );
    return;
  }

  if (input.action === 'archive') {
    await getDb().query(
      `
        update public.user_notifications
        set
          read_at = coalesce(read_at, now()),
          archived_at = coalesce(archived_at, now()),
          updated_at = now()
        where user_id = $1
          and event_key = any($2::text[])
          and action_required = false
      `,
      [stateKey, notificationIds],
    );
    return;
  }

  await getDb().query(
    `
      update public.user_notifications
      set
        read_at = coalesce(read_at, now()),
        resolved_at = coalesce(resolved_at, now()),
        updated_at = now()
      where user_id = $1
        and event_key = any($2::text[])
        and action_required = true
    `,
    [stateKey, notificationIds],
  );
}
