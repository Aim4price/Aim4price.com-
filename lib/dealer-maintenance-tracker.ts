import { getAccountProfile } from './account-profile';
import { getAssetRegisterItemById, type AssetRegisterItem } from './asset-register-db';
import {
  ensureAssetMaintenanceTables,
  listAssetMaintenanceRecords,
  type AssetMaintenanceComputedStatus,
  type AssetMaintenanceRecord,
  type AssetMaintenanceTriggerType,
  type AssetMaintenanceUsageMetric,
} from './asset-maintenance';
import { getDb } from './db';

export type DealerMaintenanceTrackerStatus =
  | 'overdue'
  | 'due'
  | 'due_soon'
  | 'usage_needed'
  | 'upcoming';

export type DealerMaintenanceRecordSummary = {
  id: string;
  maintenanceType: 'service' | 'checkup';
  triggerType: AssetMaintenanceTriggerType;
  title: string;
  notes: string;
  computedStatus: AssetMaintenanceComputedStatus;
  computedStatusLabel: string;
  dueDate: string | null;
  dueUsage: number | null;
  currentUsage: number | null;
  remainingUsage: number | null;
  usageMetric: AssetMaintenanceUsageMetric | null;
  alertBeforeValue: number | null;
  alertBeforeUnit: string | null;
  updatedAtIso: string;
};

export type DealerMaintenanceTrackedAsset = {
  accessId: string;
  ownerUserId: string;
  dealerUserId: string;
  assetId: string;
  ownerName: string;
  assetTitle: string;
  assetKind: string;
  brandName: string;
  modelName: string;
  yearModel: number | null;
  serialNumber: string;
  photoUrl: string;
  currentUsage: number | null;
  usageMetric: AssetMaintenanceUsageMetric;
  usageUpdatedAtIso: string | null;
  status: DealerMaintenanceTrackerStatus;
  statusLabel: string;
  nextMaintenance: DealerMaintenanceRecordSummary;
  maintenanceRecords: DealerMaintenanceRecordSummary[];
  grantedByName: string;
  createdAtIso: string;
  updatedAtIso: string;
};

export type DealerMaintenanceAccessSummary = {
  id: string;
  dealerUserId: string;
  dealerName: string;
  grantedByName: string;
  createdAtIso: string;
};

export type DealerMaintenanceNotification = {
  id: string;
  accessId: string;
  assetId: string;
  maintenanceRecordId: string;
  status: 'due_soon' | 'due' | 'overdue';
  title: string;
  body: string;
  isRead: boolean;
  createdAtIso: string;
};

type DealerMaintenanceAccessRow = {
  id: string;
  owner_user_id: string;
  dealer_user_id: string;
  asset_register_item_id: string;
  granted_by_name: string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  owner_display_name: string | null;
  owner_business_name: string | null;
  dealer_display_name: string | null;
  dealer_business_name: string | null;
};

type DealerMaintenanceNotificationRow = {
  id: string;
  access_id: string;
  asset_register_item_id: string;
  maintenance_record_id: string;
  notification_status: string;
  title: string;
  body: string;
  read_at: string | Date | null;
  created_at: string | Date | null;
};

let dealerMaintenanceTablesPromise: Promise<void> | null = null;

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function iso(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function trackerStatus(record: AssetMaintenanceRecord): DealerMaintenanceTrackerStatus {
  if (record.triggerType === 'usage' && record.currentUsage === null) return 'usage_needed';
  if (record.computedStatus === 'overdue') return 'overdue';
  if (record.computedStatus === 'due') return 'due';
  if (record.computedStatus === 'due_soon') return 'due_soon';
  return 'upcoming';
}

function trackerStatusLabel(status: DealerMaintenanceTrackerStatus): string {
  if (status === 'overdue') return 'Overdue';
  if (status === 'due') return 'Due now';
  if (status === 'due_soon') return 'Due soon';
  if (status === 'usage_needed') return 'Usage needed';
  return 'Upcoming';
}

function statusPriority(status: DealerMaintenanceTrackerStatus): number {
  if (status === 'overdue') return 0;
  if (status === 'due') return 1;
  if (status === 'due_soon') return 2;
  if (status === 'usage_needed') return 3;
  return 4;
}

function recordSummary(record: AssetMaintenanceRecord): DealerMaintenanceRecordSummary {
  return {
    id: record.id,
    maintenanceType: record.maintenanceType,
    triggerType: record.triggerType,
    title: record.title || (record.maintenanceType === 'checkup' ? 'Scheduled checkup' : 'Scheduled service'),
    notes: record.notes,
    computedStatus: record.computedStatus,
    computedStatusLabel: record.computedStatusLabel,
    dueDate: record.dueDate,
    dueUsage: record.dueUsage,
    currentUsage: record.currentUsage,
    remainingUsage: record.remainingUsage,
    usageMetric: record.usageMetric,
    alertBeforeValue: record.alertBeforeValue,
    alertBeforeUnit: record.alertBeforeUnit,
    updatedAtIso: record.updatedAtIso,
  };
}

function accessOwnerName(row: DealerMaintenanceAccessRow): string {
  return asText(row.owner_business_name) || asText(row.owner_display_name) || 'Asset owner';
}

function accessDealerName(row: DealerMaintenanceAccessRow): string {
  return asText(row.dealer_business_name) || asText(row.dealer_display_name) || 'Dealer';
}

function assetUsageMetric(asset: AssetRegisterItem, record: AssetMaintenanceRecord): AssetMaintenanceUsageMetric {
  if (record.usageMetric) return record.usageMetric;
  if (record.assetUsageMetric) return record.assetUsageMetric;
  const savedMetric = asText(asset.specsJson?.usageMetric).toLowerCase();
  if (savedMetric === 'km' || savedMetric === 'percentage') return savedMetric;
  return 'hours';
}

async function ensureDealerMaintenanceTablesOnce(): Promise<void> {
  await ensureAssetMaintenanceTables();
  const db = getDb();
  await db.query('create extension if not exists pgcrypto');
  await db.query(`
    create table if not exists public.dealer_maintenance_access (
      id uuid primary key default gen_random_uuid(),
      owner_user_id text not null,
      dealer_user_id text not null,
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      granted_by_actor_type text not null default 'owner',
      granted_by_actor_id text,
      granted_by_name text,
      is_active boolean not null default true,
      revoked_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (owner_user_id, dealer_user_id, asset_register_item_id)
    )
  `);
  await db.query(`
    create index if not exists dealer_maintenance_access_dealer_active_idx
      on public.dealer_maintenance_access (dealer_user_id, is_active, updated_at desc)
  `);
  await db.query(`
    create index if not exists dealer_maintenance_access_owner_asset_idx
      on public.dealer_maintenance_access (owner_user_id, asset_register_item_id, is_active)
  `);
  await db.query(`
    create table if not exists public.dealer_maintenance_notifications (
      id uuid primary key default gen_random_uuid(),
      dealer_user_id text not null,
      access_id uuid not null references public.dealer_maintenance_access(id) on delete cascade,
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      maintenance_record_id uuid not null references public.asset_maintenance_records(id) on delete cascade,
      notification_status text not null check (notification_status in ('due_soon', 'due', 'overdue')),
      title text not null,
      body text not null,
      read_at timestamptz,
      created_at timestamptz not null default now(),
      unique (access_id, maintenance_record_id, notification_status)
    )
  `);
  await db.query(`
    create index if not exists dealer_maintenance_notifications_dealer_idx
      on public.dealer_maintenance_notifications (dealer_user_id, created_at desc)
  `);
}

export async function ensureDealerMaintenanceTrackerTables(): Promise<void> {
  if (!dealerMaintenanceTablesPromise) {
    dealerMaintenanceTablesPromise = ensureDealerMaintenanceTablesOnce().catch((error) => {
      dealerMaintenanceTablesPromise = null;
      throw error;
    });
  }
  await dealerMaintenanceTablesPromise;
}

async function listAccessRows(whereSql: string, values: unknown[]): Promise<DealerMaintenanceAccessRow[]> {
  await ensureDealerMaintenanceTrackerTables();
  const result = await getDb().query<DealerMaintenanceAccessRow>(
    `
      select
        access.id::text,
        access.owner_user_id,
        access.dealer_user_id,
        access.asset_register_item_id::text,
        access.granted_by_name,
        access.created_at,
        access.updated_at,
        owner.display_name as owner_display_name,
        owner.business_name as owner_business_name,
        dealer.display_name as dealer_display_name,
        dealer.business_name as dealer_business_name
      from public.dealer_maintenance_access access
      left join public.account_profiles owner on owner.user_id = access.owner_user_id
      left join public.account_profiles dealer on dealer.user_id = access.dealer_user_id
      ${whereSql}
      order by access.updated_at desc, access.created_at desc
    `,
    values,
  );
  return result.rows;
}

export async function assertAssetHasOpenMaintenance(ownerUserId: string, assetId: string): Promise<void> {
  const records = await listAssetMaintenanceRecords(ownerUserId, { assetId, status: 'upcoming' });
  if (!records.some((record) => record.assetId === assetId && record.status === 'upcoming')) {
    throw new Error('OPEN_MAINTENANCE_REQUIRED');
  }
}

export async function grantDealerMaintenanceTracking(input: {
  ownerUserId: string;
  dealerUserId: string;
  assetId: string;
  actorType: 'owner' | 'field_manager';
  actorId?: string | null;
  actorName?: string | null;
}): Promise<{ id: string }> {
  await ensureDealerMaintenanceTrackerTables();
  const [asset, dealer] = await Promise.all([
    getAssetRegisterItemById(input.ownerUserId, input.assetId),
    getAccountProfile({ id: input.dealerUserId }),
  ]);
  if (!asset) throw new Error('ASSET_NOT_FOUND');
  if (dealer.accountType !== 'dealer' || dealer.accountStatus !== 'active') throw new Error('DEALER_NOT_FOUND');
  await assertAssetHasOpenMaintenance(input.ownerUserId, input.assetId);

  const result = await getDb().query<{ id: string }>(
    `
      insert into public.dealer_maintenance_access (
        owner_user_id,
        dealer_user_id,
        asset_register_item_id,
        granted_by_actor_type,
        granted_by_actor_id,
        granted_by_name,
        is_active,
        revoked_at,
        created_at,
        updated_at
      )
      values ($1, $2, $3::uuid, $4, $5, $6, true, null, now(), now())
      on conflict (owner_user_id, dealer_user_id, asset_register_item_id)
      do update set
        granted_by_actor_type = excluded.granted_by_actor_type,
        granted_by_actor_id = excluded.granted_by_actor_id,
        granted_by_name = excluded.granted_by_name,
        is_active = true,
        revoked_at = null,
        updated_at = now()
      returning id::text
    `,
    [
      input.ownerUserId,
      input.dealerUserId,
      input.assetId,
      input.actorType,
      asText(input.actorId) || null,
      asText(input.actorName) || (input.actorType === 'field_manager' ? 'Field Manager' : 'Owner'),
    ],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error('TRACKING_ACCESS_NOT_CREATED');
  return { id };
}

export async function listOwnerDealerMaintenanceAccess(
  ownerUserId: string,
  assetId: string,
): Promise<DealerMaintenanceAccessSummary[]> {
  const rows = await listAccessRows(
    'where access.owner_user_id = $1 and access.asset_register_item_id = $2::uuid and access.is_active = true',
    [ownerUserId, assetId],
  );
  return rows.map((row) => ({
    id: row.id,
    dealerUserId: row.dealer_user_id,
    dealerName: accessDealerName(row),
    grantedByName: asText(row.granted_by_name),
    createdAtIso: iso(row.created_at),
  }));
}

export async function revokeDealerMaintenanceTracking(input: {
  ownerUserId: string;
  assetId: string;
  dealerUserId: string;
}): Promise<boolean> {
  await ensureDealerMaintenanceTrackerTables();
  const result = await getDb().query(
    `
      update public.dealer_maintenance_access
      set is_active = false, revoked_at = now(), updated_at = now()
      where owner_user_id = $1
        and dealer_user_id = $2
        and asset_register_item_id = $3::uuid
        and is_active = true
    `,
    [input.ownerUserId, input.dealerUserId, input.assetId],
  );
  return Boolean(result.rowCount);
}

async function buildTrackedAsset(row: DealerMaintenanceAccessRow): Promise<DealerMaintenanceTrackedAsset | null> {
  const [asset, records] = await Promise.all([
    getAssetRegisterItemById(row.owner_user_id, row.asset_register_item_id),
    listAssetMaintenanceRecords(row.owner_user_id, {
      assetId: row.asset_register_item_id,
      status: 'upcoming',
    }),
  ]);
  if (!asset) return null;
  const openRecords = records.filter(
    (record) => record.assetId === row.asset_register_item_id && record.status === 'upcoming',
  );
  if (!openRecords.length) return null;

  const ranked = [...openRecords].sort((left, right) => {
    const priority = statusPriority(trackerStatus(left)) - statusPriority(trackerStatus(right));
    if (priority) return priority;
    const leftRemaining = left.remainingUsage ?? left.daysUntilDue ?? Number.POSITIVE_INFINITY;
    const rightRemaining = right.remainingUsage ?? right.daysUntilDue ?? Number.POSITIVE_INFINITY;
    return leftRemaining - rightRemaining;
  });
  const next = ranked[0];
  const status = trackerStatus(next);
  const usageMetric = assetUsageMetric(asset, next);
  const currentUsage = next.currentUsage ?? next.assetUsageReading ?? null;

  return {
    accessId: row.id,
    ownerUserId: row.owner_user_id,
    dealerUserId: row.dealer_user_id,
    assetId: asset.id,
    ownerName: accessOwnerName(row),
    assetTitle: asset.title,
    assetKind: asset.kind,
    brandName: asset.brandName,
    modelName: asset.modelName || asset.typedModelName,
    yearModel: asset.yearModel,
    serialNumber: asset.serialNumber,
    photoUrl: asset.photos[0] ?? '',
    currentUsage,
    usageMetric,
    usageUpdatedAtIso: asset.lastScannedAtIso || asset.updatedAtIso || null,
    status,
    statusLabel: trackerStatusLabel(status),
    nextMaintenance: recordSummary(next),
    maintenanceRecords: ranked.map(recordSummary),
    grantedByName: asText(row.granted_by_name),
    createdAtIso: iso(row.created_at),
    updatedAtIso: iso(row.updated_at),
  };
}

export async function listDealerTrackedAssets(dealerUserId: string): Promise<DealerMaintenanceTrackedAsset[]> {
  const rows = await listAccessRows(
    'where access.dealer_user_id = $1 and access.is_active = true',
    [dealerUserId],
  );
  const assets = await Promise.all(rows.map(buildTrackedAsset));
  return assets
    .filter((asset): asset is DealerMaintenanceTrackedAsset => Boolean(asset))
    .sort((left, right) => {
      const priority = statusPriority(left.status) - statusPriority(right.status);
      if (priority) return priority;
      return left.assetTitle.localeCompare(right.assetTitle);
    });
}

export async function getDealerTrackedAsset(
  dealerUserId: string,
  accessId: string,
): Promise<DealerMaintenanceTrackedAsset | null> {
  const rows = await listAccessRows(
    'where access.dealer_user_id = $1 and access.id = $2::uuid and access.is_active = true',
    [dealerUserId, accessId],
  );
  return rows[0] ? buildTrackedAsset(rows[0]) : null;
}

function usageLabel(value: number | null, metric: AssetMaintenanceUsageMetric | null): string {
  if (value === null || !Number.isFinite(value)) return 'a current usage reading';
  if (metric === 'percentage') return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}%`;
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} ${metric === 'km' ? 'km' : 'hours'}`;
}

function notificationBody(asset: DealerMaintenanceTrackedAsset, record: DealerMaintenanceRecordSummary): string {
  const label = record.maintenanceType === 'checkup' ? 'checkup' : 'service';
  if (record.computedStatus === 'overdue') {
    return record.triggerType === 'usage'
      ? `${asset.assetTitle} is overdue for ${label} by ${usageLabel(Math.abs(record.remainingUsage ?? 0), record.usageMetric)}.`
      : `${asset.assetTitle} is overdue for ${label}.`;
  }
  if (record.computedStatus === 'due') return `${asset.assetTitle} is due for ${label} now.`;
  if (record.triggerType === 'usage') {
    return `${asset.assetTitle} has ${usageLabel(record.remainingUsage, record.usageMetric)} remaining before ${label}.`;
  }
  return `${asset.assetTitle} is approaching its ${label} due date.`;
}

export async function syncDealerMaintenanceNotifications(dealerUserId: string): Promise<void> {
  await ensureDealerMaintenanceTrackerTables();
  const assets = await listDealerTrackedAssets(dealerUserId);
  const db = getDb();
  for (const asset of assets) {
    for (const record of asset.maintenanceRecords) {
      if (!['due_soon', 'due', 'overdue'].includes(record.computedStatus)) continue;
      const status = record.computedStatus as 'due_soon' | 'due' | 'overdue';
      await db.query(
        `
          insert into public.dealer_maintenance_notifications (
            dealer_user_id,
            access_id,
            asset_register_item_id,
            maintenance_record_id,
            notification_status,
            title,
            body,
            created_at
          )
          values ($1, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, now())
          on conflict (access_id, maintenance_record_id, notification_status) do nothing
        `,
        [
          dealerUserId,
          asset.accessId,
          asset.assetId,
          record.id,
          status,
          status === 'overdue' ? 'Maintenance overdue' : status === 'due' ? 'Maintenance due' : 'Maintenance due soon',
          notificationBody(asset, record),
        ],
      );
    }
  }
}

export async function listDealerMaintenanceNotifications(
  dealerUserId: string,
): Promise<DealerMaintenanceNotification[]> {
  await syncDealerMaintenanceNotifications(dealerUserId);
  const result = await getDb().query<DealerMaintenanceNotificationRow>(
    `
      select
        notification.id::text,
        notification.access_id::text,
        notification.asset_register_item_id::text,
        notification.maintenance_record_id::text,
        notification.notification_status,
        notification.title,
        notification.body,
        notification.read_at,
        notification.created_at
      from public.dealer_maintenance_notifications notification
      where notification.dealer_user_id = $1
      order by notification.created_at desc, notification.id desc
      limit 50
    `,
    [dealerUserId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    accessId: row.access_id,
    assetId: row.asset_register_item_id,
    maintenanceRecordId: row.maintenance_record_id,
    status: row.notification_status as 'due_soon' | 'due' | 'overdue',
    title: row.title,
    body: row.body,
    isRead: Boolean(row.read_at),
    createdAtIso: iso(row.created_at),
  }));
}

export async function markDealerMaintenanceNotificationsRead(dealerUserId: string): Promise<void> {
  await ensureDealerMaintenanceTrackerTables();
  await getDb().query(
    `
      update public.dealer_maintenance_notifications
      set read_at = coalesce(read_at, now())
      where dealer_user_id = $1 and read_at is null
    `,
    [dealerUserId],
  );
}
