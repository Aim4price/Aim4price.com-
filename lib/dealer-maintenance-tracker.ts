import { maintenanceIdentity, type MaintenanceIdentity } from './maintenance-catalogue';
import { getAccountProfile } from './account-profile';
import { getAssetRegisterItemById, type AssetRegisterItem } from './asset-register-db';
import {
  calculateAssetMaintenanceSummary,
  completeAssetMaintenanceRecord,
  ensureAssetMaintenanceTables,
  listAssetMaintenanceData,
  listAssetMaintenanceRecords,
  recordStandaloneAssetMaintenanceCompletion,
  updateAssetMaintenanceRecord,
  type AssetMaintenanceListFilters,
  type AssetMaintenanceListResult,
  type AssetMaintenanceComputedStatus,
  type AssetMaintenanceDraftInput,
  type AssetMaintenanceCompleteInput,
  type AssetMaintenanceIntervalUnit,
  type AssetMaintenanceRecord,
  type AssetMaintenanceStatus,
  type AssetMaintenanceTriggerType,
  type AssetMaintenanceType,
  type AssetMaintenanceUsageMetric,
} from './asset-maintenance';
import {
  listIssueNotesForAssets,
  type AssetIssueNoteStatus,
} from './asset-issue-notes';
import {
  listPendingDealerAssetCorrections,
  type DealerAssetCorrectionRequest,
} from './dealer-asset-corrections';
import { isDatabaseSchemaReady } from './database-schema-readiness';
import { getDb } from './db';

export type DealerMaintenanceTrackerStatus =
  | 'overdue'
  | 'due'
  | 'due_soon'
  | 'usage_needed'
  | 'upcoming'
  | 'done'
  | 'no_open';

export type DealerMaintenancePermissions = {
  canViewLoggedProblems: boolean;
  canViewMaintenanceReports: boolean;
  canViewCostOfOwnership: boolean;
  canCreateMaintenanceSchedules: boolean;
  canUpdateSerial: boolean;
  canUpdateReplacementPrice: boolean;
};

export type DealerMaintenanceScheduleProposalStatus = 'pending' | 'approved' | 'declined';

export type DealerMaintenanceScheduleProposal = {
  id: string;
  accessId: string;
  ownerUserId: string;
  dealerUserId: string;
  assetId: string;
  leadId: string | null;
  assetTitle: string;
  dealerName: string;
  status: DealerMaintenanceScheduleProposalStatus;
  maintenanceType: AssetMaintenanceType;
  triggerType: AssetMaintenanceTriggerType;
  title: string;
  notes: string;
  dueDate: string | null;
  dueUsage: number | null;
  usageMetric: AssetMaintenanceUsageMetric | null;
  alertBeforeValue: number | null;
  alertBeforeUnit: AssetMaintenanceIntervalUnit | null;
  recurringEnabled: boolean;
  recurringIntervalValue: number | null;
  recurringIntervalUnit: AssetMaintenanceIntervalUnit | null;
  createdMaintenanceRecordId: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  decidedAtIso: string | null;
};

export type DealerMaintenanceScheduleProposalInput = {
  accessId?: unknown;
  leadId?: unknown;
  maintenanceType?: unknown;
  triggerType?: unknown;
  title?: unknown;
  notes?: unknown;
  dueDate?: unknown;
  dueUsage?: unknown;
  usageMetric?: unknown;
  alertBeforeValue?: unknown;
  alertBeforeUnit?: unknown;
  recurringEnabled?: unknown;
  recurringIntervalValue?: unknown;
  recurringIntervalUnit?: unknown;
};

export type DealerMaintenanceLeadAccess = {
  accessId: string;
  ownerUserId: string;
  dealerUserId: string;
  assetId: string;
  isActive: true;
  hasMaintenanceRecords: boolean;
  permissions: DealerMaintenancePermissions;
};

export type DealerMaintenanceRecordSummary = {
  id: string;
  maintenanceType: 'service' | 'checkup';
  triggerType: AssetMaintenanceTriggerType;
  status: AssetMaintenanceStatus;
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
  assignedFieldManagerId: string | null;
  assignedName: string;
  recurringEnabled: boolean;
  recurringIntervalValue: number | null;
  recurringIntervalUnit: string | null;
  completedAtIso: string | null;
  completedUsage: number | null;
  completedNotes: string;
  completedBy: string;
  createdAtIso: string;
  updatedAtIso: string;
};

export type DealerMaintenanceTrackedAsset = {
  accessId: string;
  ownerUserId: string;
  dealerUserId: string;
  assetId: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  assetTitle: string;
  assetKind: string;
  maintenanceIdentity?: MaintenanceIdentity;
  brandName: string;
  modelName: string;
  yearModel: number | null;
  condition: string;
  serialNumber: string;
  registrationNumber: string;
  replacementPriceExVat: number | null;
  dealerCorrection: DealerAssetCorrectionRequest | null;
  photoUrl: string;
  photoUrls: string[];
  currentUsage: number | null;
  usageMetric: AssetMaintenanceUsageMetric;
  usageUpdatedAtIso: string | null;
  status: DealerMaintenanceTrackerStatus;
  statusLabel: string;
  nextMaintenance: DealerMaintenanceRecordSummary | null;
  openMaintenanceRecords: DealerMaintenanceRecordSummary[];
  completedMaintenanceRecords: DealerMaintenanceRecordSummary[];
  maintenanceRecords: DealerMaintenanceRecordSummary[];
  loggedProblems: AssetIssueNoteStatus[];
  scheduleProposals: DealerMaintenanceScheduleProposal[];
  permissions: DealerMaintenancePermissions;
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
  permissions: DealerMaintenancePermissions;
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
  can_view_logged_problems: boolean | null;
  can_view_maintenance_reports: boolean | null;
  can_view_cost_of_ownership: boolean | null;
  can_create_maintenance_schedules: boolean | null;
  can_update_serial: boolean | null;
  can_update_replacement_price: boolean | null;
  has_maintenance_records: boolean | null;
  owner_display_name: string | null;
  owner_business_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
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

type DealerMaintenanceScheduleProposalRow = {
  id: string;
  access_id: string;
  owner_user_id: string;
  dealer_user_id: string;
  asset_register_item_id: string;
  lead_id: string | null;
  proposal_status: string | null;
  maintenance_type: string | null;
  trigger_type: string | null;
  title: string | null;
  notes: string | null;
  due_date: string | Date | null;
  due_usage: string | number | null;
  usage_metric: string | null;
  alert_before_value: string | number | null;
  alert_before_unit: string | null;
  recurring_enabled: boolean | null;
  recurring_interval_value: string | number | null;
  recurring_interval_unit: string | null;
  created_maintenance_record_id: string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  decided_at: string | Date | null;
  asset_title: string | null;
  dealer_display_name: string | null;
  dealer_business_name: string | null;
};

let dealerMaintenanceTablesPromise: Promise<void> | null = null;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function iso(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function optionalIso(value: string | Date | null | undefined): string | null {
  return value ? iso(value) : null;
}

function finiteNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const numeric = finiteNumber(value);
  return numeric !== null && numeric >= 0 ? numeric : null;
}

function positiveNumber(value: unknown): number | null {
  const numeric = finiteNumber(value);
  return numeric !== null && numeric > 0 ? numeric : null;
}

function dateOnly(value: unknown): string | null {
  const text = asText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text ? null : text;
}

function storedDateOnly(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return dateOnly(String(value).slice(0, 10));
}

function normalizeProposalMaintenanceType(value: unknown): AssetMaintenanceType {
  return asText(value).toLowerCase() === 'checkup' ? 'checkup' : 'service';
}

function normalizeProposalTriggerType(value: unknown): AssetMaintenanceTriggerType {
  return asText(value).toLowerCase() === 'usage' ? 'usage' : 'date';
}

function normalizeProposalUsageMetric(
  value: unknown,
  fallback: AssetMaintenanceUsageMetric,
): AssetMaintenanceUsageMetric {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'km' || normalized === 'percentage' || normalized === 'hours') return normalized;
  return fallback;
}

function normalizeProposalIntervalUnit(
  value: unknown,
  fallback: AssetMaintenanceIntervalUnit,
): AssetMaintenanceIntervalUnit {
  const normalized = asText(value).toLowerCase();
  if (['days', 'weeks', 'months', 'hours', 'km', 'percentage'].includes(normalized)) {
    return normalized as AssetMaintenanceIntervalUnit;
  }
  return fallback;
}

function normalizeProposalStatus(value: unknown): DealerMaintenanceScheduleProposalStatus {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'approved' || normalized === 'declined') return normalized;
  return 'pending';
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
  if (status === 'done') return 'Done';
  if (status === 'no_open') return 'Tracking';
  return 'Upcoming';
}

function statusPriority(status: DealerMaintenanceTrackerStatus): number {
  if (status === 'overdue') return 0;
  if (status === 'due') return 1;
  if (status === 'due_soon') return 2;
  if (status === 'usage_needed') return 3;
  if (status === 'upcoming') return 4;
  if (status === 'done') return 5;
  return 6;
}

function recordSummary(record: AssetMaintenanceRecord): DealerMaintenanceRecordSummary {
  return {
    id: record.id,
    maintenanceType: record.maintenanceType,
    triggerType: record.triggerType,
    status: record.status,
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
    assignedFieldManagerId: record.assignedFieldManagerId,
    assignedName: record.assignedName,
    recurringEnabled: record.recurringEnabled,
    recurringIntervalValue: record.recurringIntervalValue,
    recurringIntervalUnit: record.recurringIntervalUnit,
    completedAtIso: record.completedAtIso,
    completedUsage: record.completedUsage,
    completedNotes: record.completedNotes,
    completedBy: record.completedBy,
    createdAtIso: record.createdAtIso,
    updatedAtIso: record.updatedAtIso,
  };
}

function rowPermissions(row: DealerMaintenanceAccessRow): DealerMaintenancePermissions {
  return {
    canViewLoggedProblems: Boolean(row.can_view_logged_problems),
    canViewMaintenanceReports: Boolean(row.can_view_maintenance_reports),
    canViewCostOfOwnership: Boolean(row.can_view_cost_of_ownership),
    canCreateMaintenanceSchedules: row.can_create_maintenance_schedules !== false,
    canUpdateSerial: row.can_update_serial !== false,
    canUpdateReplacementPrice: row.can_update_replacement_price !== false,
  };
}

function accessOwnerName(row: DealerMaintenanceAccessRow): string {
  return asText(row.owner_business_name) || asText(row.owner_display_name) || 'Asset owner';
}

function accessDealerName(row: DealerMaintenanceAccessRow): string {
  return asText(row.dealer_business_name) || asText(row.dealer_display_name) || 'Dealer';
}

function assetUsageMetric(asset: AssetRegisterItem, record?: AssetMaintenanceRecord | null): AssetMaintenanceUsageMetric {
  if (record?.usageMetric) return record.usageMetric;
  if (record?.assetUsageMetric) return record.assetUsageMetric;
  const savedMetric = asText(asset.specsJson?.usageMetric).toLowerCase();
  if (savedMetric === 'km' || savedMetric === 'percentage') return savedMetric;
  return 'hours';
}

function currentAssetUsage(asset: AssetRegisterItem, metric: AssetMaintenanceUsageMetric): number | null {
  if (metric === 'percentage') return asset.lifeWorkedPercent;
  return asset.hours;
}

async function ensureDealerMaintenanceTablesOnce(): Promise<void> {
  const db = getDb();
  const schemaReady = await isDatabaseSchemaReady(() => db.query(`
    with access_schema as (
      select
        id,
        owner_user_id,
        dealer_user_id,
        asset_register_item_id,
        is_active,
        can_view_logged_problems,
        can_view_maintenance_reports,
        can_view_cost_of_ownership,
        can_create_maintenance_schedules,
        can_update_serial,
        can_update_replacement_price,
        created_at,
        updated_at
      from public.dealer_maintenance_access
      where false
    ), proposal_schema as (
      select id, access_id, owner_user_id, dealer_user_id, asset_register_item_id, proposal_status
      from public.dealer_maintenance_schedule_proposals
      where false
    ), notification_schema as (
      select id, dealer_user_id, access_id, asset_register_item_id, maintenance_record_id, notification_status
      from public.dealer_maintenance_notifications
      where false
    ), maintenance_schema as (
      select id, user_id, asset_register_item_id, status
      from public.asset_maintenance_records
      where false
    )
    select 1
    from access_schema
    cross join proposal_schema
    cross join notification_schema
    cross join maintenance_schema
  `));

  if (schemaReady) {
    return;
  }

  await ensureAssetMaintenanceTables();
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
    alter table public.dealer_maintenance_access
      add column if not exists can_view_logged_problems boolean not null default false,
      add column if not exists can_view_maintenance_reports boolean not null default false,
      add column if not exists can_view_cost_of_ownership boolean not null default false,
      add column if not exists can_create_maintenance_schedules boolean not null default true,
      add column if not exists can_update_serial boolean not null default true,
      add column if not exists can_update_replacement_price boolean not null default true
  `);
  await db.query(`
    alter table public.dealer_maintenance_access
      alter column can_view_maintenance_reports set default true,
      alter column can_create_maintenance_schedules set default true
  `);
  await db.query(`
    create table if not exists public.dealer_maintenance_schedule_proposals (
      id uuid primary key default gen_random_uuid(),
      access_id uuid not null references public.dealer_maintenance_access(id) on delete cascade,
      owner_user_id text not null,
      dealer_user_id text not null,
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      lead_id uuid,
      proposal_status text not null default 'pending'
        check (proposal_status in ('pending', 'approved', 'declined')),
      maintenance_type text not null
        check (maintenance_type in ('service', 'checkup')),
      trigger_type text not null
        check (trigger_type in ('date', 'usage')),
      title text not null default '',
      notes text not null default '',
      due_date date,
      due_usage numeric,
      usage_metric text,
      alert_before_value numeric,
      alert_before_unit text,
      recurring_enabled boolean not null default false,
      recurring_interval_value numeric,
      recurring_interval_unit text,
      created_maintenance_record_id uuid references public.asset_maintenance_records(id) on delete set null,
      decided_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await db.query(`
    create index if not exists dealer_maintenance_schedule_proposals_dealer_idx
      on public.dealer_maintenance_schedule_proposals (dealer_user_id, access_id, created_at desc)
  `);
  await db.query(`
    create index if not exists dealer_maintenance_schedule_proposals_owner_pending_idx
      on public.dealer_maintenance_schedule_proposals (owner_user_id, proposal_status, created_at desc)
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
        access.can_view_logged_problems,
        access.can_view_maintenance_reports,
        access.can_view_cost_of_ownership,
        access.can_create_maintenance_schedules,
        access.can_update_serial,
        access.can_update_replacement_price,
        exists (
          select 1
          from public.asset_maintenance_records maintenance
          where maintenance.user_id = access.owner_user_id
            and maintenance.asset_register_item_id = access.asset_register_item_id
            and maintenance.status in ('upcoming', 'done')
        ) as has_maintenance_records,
        owner.display_name as owner_display_name,
        owner.business_name as owner_business_name,
        owner.phone as owner_phone,
        owner_user.email as owner_email,
        dealer.display_name as dealer_display_name,
        dealer.business_name as dealer_business_name
      from public.dealer_maintenance_access access
      left join public.account_profiles owner on owner.user_id = access.owner_user_id
      left join public."user" owner_user on owner_user.id = access.owner_user_id
      left join public.account_profiles dealer on dealer.user_id = access.dealer_user_id
      ${whereSql}
      order by access.updated_at desc, access.created_at desc
    `,
    values,
  );
  return result.rows;
}

export async function listActiveDealerMaintenanceLeadAccess(input: {
  dealerUserId: string;
  leads: Array<{ ownerUserId: string; assetId: string }>;
}): Promise<DealerMaintenanceLeadAccess[]> {
  const requestedKeys = new Set(
    input.leads.map((lead) => `${asText(lead.ownerUserId)}::${asText(lead.assetId)}`),
  );
  if (!requestedKeys.size) return [];
  const rows = await listAccessRows(
    'where access.dealer_user_id = $1 and access.is_active = true',
    [input.dealerUserId],
  );
  return rows
    .filter((row) => requestedKeys.has(`${row.owner_user_id}::${row.asset_register_item_id}`))
    .map((row) => ({
      accessId: row.id,
      ownerUserId: row.owner_user_id,
      dealerUserId: row.dealer_user_id,
      assetId: row.asset_register_item_id,
      isActive: true as const,
      hasMaintenanceRecords: Boolean(row.has_maintenance_records),
      permissions: rowPermissions(row),
    }));
}

export async function grantDealerMaintenanceTracking(input: {
  ownerUserId: string;
  dealerUserId: string;
  assetId: string;
  actorType: 'owner' | 'field_manager';
  actorId?: string | null;
  actorName?: string | null;
  permissions?: DealerMaintenancePermissions | null;
}): Promise<{ id: string }> {
  await ensureDealerMaintenanceTrackerTables();
  const [asset, dealer] = await Promise.all([
    getAssetRegisterItemById(input.ownerUserId, input.assetId),
    getAccountProfile({ id: input.dealerUserId }),
  ]);
  if (!asset) throw new Error('ASSET_NOT_FOUND');
  if (dealer.accountType !== 'dealer' || dealer.accountStatus !== 'active') throw new Error('DEALER_NOT_FOUND');
  const permissions: DealerMaintenancePermissions = input.permissions ?? {
    canViewLoggedProblems: false,
    canViewMaintenanceReports: true,
    canViewCostOfOwnership: false,
    canCreateMaintenanceSchedules: true,
    canUpdateSerial: true,
    canUpdateReplacementPrice: true,
  };

  const result = await getDb().query<{ id: string }>(
    `
      insert into public.dealer_maintenance_access (
        owner_user_id,
        dealer_user_id,
        asset_register_item_id,
        granted_by_actor_type,
        granted_by_actor_id,
        granted_by_name,
        can_view_logged_problems,
        can_view_maintenance_reports,
        can_view_cost_of_ownership,
        can_create_maintenance_schedules,
        can_update_serial,
        can_update_replacement_price,
        is_active,
        revoked_at,
        created_at,
        updated_at
      )
      values ($1, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, null, now(), now())
      on conflict (owner_user_id, dealer_user_id, asset_register_item_id)
      do update set
        granted_by_actor_type = excluded.granted_by_actor_type,
        granted_by_actor_id = excluded.granted_by_actor_id,
        granted_by_name = excluded.granted_by_name,
        can_view_logged_problems = excluded.can_view_logged_problems,
        can_view_maintenance_reports = excluded.can_view_maintenance_reports,
        can_view_cost_of_ownership = excluded.can_view_cost_of_ownership,
        can_create_maintenance_schedules = excluded.can_create_maintenance_schedules,
        can_update_serial = excluded.can_update_serial,
        can_update_replacement_price = excluded.can_update_replacement_price,
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
      permissions.canViewLoggedProblems,
      permissions.canViewMaintenanceReports,
      permissions.canViewCostOfOwnership,
      permissions.canCreateMaintenanceSchedules,
      permissions.canUpdateSerial,
      permissions.canUpdateReplacementPrice,
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
    permissions: rowPermissions(row),
  }));
}

export async function updateDealerMaintenancePermissions(input: {
  ownerUserId: string;
  assetId: string;
  accessId: string;
  permissions: DealerMaintenancePermissions;
}): Promise<DealerMaintenanceAccessSummary | null> {
  await ensureDealerMaintenanceTrackerTables();
  const result = await getDb().query(
    `
      update public.dealer_maintenance_access
      set
        can_view_logged_problems = $4,
        can_view_maintenance_reports = $5,
        can_view_cost_of_ownership = $6,
        can_create_maintenance_schedules = $7,
        can_update_serial = $8,
        can_update_replacement_price = $9,
        updated_at = now()
      where owner_user_id = $1
        and asset_register_item_id = $2::uuid
        and id = $3::uuid
        and is_active = true
    `,
    [
      input.ownerUserId,
      input.assetId,
      input.accessId,
      input.permissions.canViewLoggedProblems,
      input.permissions.canViewMaintenanceReports,
      input.permissions.canViewCostOfOwnership,
      input.permissions.canCreateMaintenanceSchedules,
      input.permissions.canUpdateSerial,
      input.permissions.canUpdateReplacementPrice,
    ],
  );
  if (!result.rowCount) return null;
  const access = await listOwnerDealerMaintenanceAccess(input.ownerUserId, input.assetId);
  return access.find((entry) => entry.id === input.accessId) ?? null;
}

export async function revokeDealerMaintenanceTracking(input: {
  ownerUserId: string;
  assetId: string;
  dealerUserId?: string;
  accessId?: string;
}): Promise<boolean> {
  await ensureDealerMaintenanceTrackerTables();
  const accessId = asText(input.accessId);
  const dealerUserId = asText(input.dealerUserId);
  if (!accessId && !dealerUserId) return false;
  const result = await getDb().query(
    `
      update public.dealer_maintenance_access
      set is_active = false, revoked_at = now(), updated_at = now()
      where owner_user_id = $1
        and asset_register_item_id = $2::uuid
        and (
          ($3 <> '' and id = nullif($3, '')::uuid)
          or ($3 = '' and dealer_user_id = $4)
        )
        and is_active = true
    `,
    [input.ownerUserId, input.assetId, accessId, dealerUserId],
  );
  return Boolean(result.rowCount);
}

function proposalSelectSql(whereSql: string): string {
  return `
    select
      proposal.id::text,
      proposal.access_id::text,
      proposal.owner_user_id,
      proposal.dealer_user_id,
      proposal.asset_register_item_id::text,
      proposal.lead_id::text,
      proposal.proposal_status,
      proposal.maintenance_type,
      proposal.trigger_type,
      proposal.title,
      proposal.notes,
      proposal.due_date,
      proposal.due_usage,
      proposal.usage_metric,
      proposal.alert_before_value,
      proposal.alert_before_unit,
      proposal.recurring_enabled,
      proposal.recurring_interval_value,
      proposal.recurring_interval_unit,
      proposal.created_maintenance_record_id::text,
      proposal.created_at,
      proposal.updated_at,
      proposal.decided_at,
      asset.title as asset_title,
      dealer.display_name as dealer_display_name,
      dealer.business_name as dealer_business_name
    from public.dealer_maintenance_schedule_proposals proposal
    inner join public.dealer_maintenance_access access on access.id = proposal.access_id
    inner join public.asset_register_items asset on asset.id = proposal.asset_register_item_id
    left join public.account_profiles dealer on dealer.user_id = proposal.dealer_user_id
    ${whereSql}
  `;
}

function mapScheduleProposal(row: DealerMaintenanceScheduleProposalRow): DealerMaintenanceScheduleProposal {
  const usageMetric = asText(row.usage_metric).toLowerCase();
  const alertBeforeUnit = asText(row.alert_before_unit).toLowerCase();
  const recurringIntervalUnit = asText(row.recurring_interval_unit).toLowerCase();
  return {
    id: row.id,
    accessId: row.access_id,
    ownerUserId: row.owner_user_id,
    dealerUserId: row.dealer_user_id,
    assetId: row.asset_register_item_id,
    leadId: row.lead_id,
    assetTitle: asText(row.asset_title) || 'Tracked asset',
    dealerName: asText(row.dealer_business_name) || asText(row.dealer_display_name) || 'Dealer',
    status: normalizeProposalStatus(row.proposal_status),
    maintenanceType: normalizeProposalMaintenanceType(row.maintenance_type),
    triggerType: normalizeProposalTriggerType(row.trigger_type),
    title: asText(row.title) || (row.maintenance_type === 'checkup' ? 'Scheduled checkup' : 'Scheduled service'),
    notes: asText(row.notes),
    dueDate: storedDateOnly(row.due_date),
    dueUsage: nonNegativeNumber(row.due_usage),
    usageMetric: usageMetric === 'hours' || usageMetric === 'km' || usageMetric === 'percentage'
      ? usageMetric
      : null,
    alertBeforeValue: nonNegativeNumber(row.alert_before_value),
    alertBeforeUnit: ['days', 'weeks', 'months', 'hours', 'km', 'percentage'].includes(alertBeforeUnit)
      ? alertBeforeUnit as AssetMaintenanceIntervalUnit
      : null,
    recurringEnabled: Boolean(row.recurring_enabled),
    recurringIntervalValue: positiveNumber(row.recurring_interval_value),
    recurringIntervalUnit: ['days', 'weeks', 'months', 'hours', 'km', 'percentage'].includes(recurringIntervalUnit)
      ? recurringIntervalUnit as AssetMaintenanceIntervalUnit
      : null,
    createdMaintenanceRecordId: row.created_maintenance_record_id,
    createdAtIso: iso(row.created_at),
    updatedAtIso: iso(row.updated_at),
    decidedAtIso: optionalIso(row.decided_at),
  };
}

export async function listDealerMaintenanceScheduleProposals(input: {
  dealerUserId: string;
  accessId?: string | null;
}): Promise<DealerMaintenanceScheduleProposal[]> {
  await ensureDealerMaintenanceTrackerTables();
  const accessId = asText(input.accessId);
  if (accessId && !UUID_PATTERN.test(accessId)) return [];
  const result = await getDb().query<DealerMaintenanceScheduleProposalRow>(
    `
      ${proposalSelectSql(`
        where proposal.dealer_user_id = $1
          and access.dealer_user_id = $1
          and access.is_active = true
          and ($2 = '' or proposal.access_id = nullif($2, '')::uuid)
      `)}
      order by proposal.created_at desc, proposal.id desc
      limit 100
    `,
    [input.dealerUserId, accessId],
  );
  return result.rows.map(mapScheduleProposal);
}

export async function listPendingOwnerDealerMaintenanceScheduleProposals(
  ownerUserId: string,
): Promise<DealerMaintenanceScheduleProposal[]> {
  await ensureDealerMaintenanceTrackerTables();
  const result = await getDb().query<DealerMaintenanceScheduleProposalRow>(
    `
      ${proposalSelectSql(`
        where proposal.owner_user_id = $1
          and proposal.proposal_status = 'pending'
          and access.owner_user_id = $1
          and access.is_active = true
      `)}
      order by proposal.created_at desc, proposal.id desc
      limit 50
    `,
    [ownerUserId],
  );
  return result.rows.map(mapScheduleProposal);
}

export async function createDealerMaintenanceScheduleProposal(input: {
  dealerUserId: string;
  draft: DealerMaintenanceScheduleProposalInput;
}): Promise<DealerMaintenanceScheduleProposal> {
  await ensureDealerMaintenanceTrackerTables();
  const accessId = asText(input.draft.accessId);
  const leadId = asText(input.draft.leadId);
  if (!UUID_PATTERN.test(accessId) || (leadId && !UUID_PATTERN.test(leadId))) {
    throw new Error('TRACKING_ACCESS_NOT_FOUND');
  }

  const accessRows = await listAccessRows(
    'where access.dealer_user_id = $1 and access.id = $2::uuid and access.is_active = true',
    [input.dealerUserId, accessId],
  );
  const access = accessRows[0];
  if (!access) throw new Error('TRACKING_ACCESS_NOT_FOUND');
  if (!rowPermissions(access).canCreateMaintenanceSchedules) {
    throw new Error('MAINTENANCE_SCHEDULE_PERMISSION_REQUIRED');
  }

  if (leadId) {
    const leadResult = await getDb().query<{ id: string }>(
      `
        select id::text
        from public.asset_leads
        where id = $1::uuid
          and owner_user_id = $2
          and partner_user_id = $3
          and asset_register_item_id = $4::uuid
        limit 1
      `,
      [leadId, access.owner_user_id, input.dealerUserId, access.asset_register_item_id],
    );
    if (!leadResult.rows[0]) throw new Error('LEAD_NOT_FOUND');
  }

  const asset = await getAssetRegisterItemById(access.owner_user_id, access.asset_register_item_id);
  if (!asset) throw new Error('ASSET_NOT_FOUND');

  const maintenanceType = normalizeProposalMaintenanceType(input.draft.maintenanceType);
  const [currentProposals, currentOpenMaintenance] = await Promise.all([
    listDealerMaintenanceScheduleProposals({
      dealerUserId: input.dealerUserId,
      accessId,
    }),
    listAssetMaintenanceRecords(access.owner_user_id, {
      assetId: access.asset_register_item_id,
      type: maintenanceType,
      status: 'upcoming',
    }),
  ]);
  if (
    currentProposals.some(
      (proposal) =>
        proposal.status === 'pending'
        && proposal.maintenanceType === maintenanceType,
    )
  ) {
    throw new Error('MAINTENANCE_PROPOSAL_ALREADY_EXISTS');
  }
  if (
    currentOpenMaintenance.some(
      (record) =>
        record.status === 'upcoming'
        && record.maintenanceType === maintenanceType,
    )
  ) {
    throw new Error('MAINTENANCE_ALREADY_SCHEDULED');
  }
  const triggerType = normalizeProposalTriggerType(input.draft.triggerType);
  const defaultUsageMetric = assetUsageMetric(asset);
  const usageMetric = triggerType === 'usage'
    ? normalizeProposalUsageMetric(input.draft.usageMetric, defaultUsageMetric)
    : null;
  const dueDate = triggerType === 'date' ? dateOnly(input.draft.dueDate) : null;
  const dueUsage = triggerType === 'usage' ? nonNegativeNumber(input.draft.dueUsage) : null;
  if (triggerType === 'date' && !dueDate) throw new Error('DUE_DATE_REQUIRED');
  if (triggerType === 'usage' && dueUsage === null) throw new Error('DUE_USAGE_REQUIRED');

  const defaultAlertUnit: AssetMaintenanceIntervalUnit = triggerType === 'date'
    ? 'days'
    : usageMetric ?? defaultUsageMetric;
  const alertBeforeValue = nonNegativeNumber(input.draft.alertBeforeValue)
    ?? (triggerType === 'date' ? 7 : usageMetric === 'km' ? 1000 : usageMetric === 'percentage' ? 5 : 20);
  const alertBeforeUnit = normalizeProposalIntervalUnit(input.draft.alertBeforeUnit, defaultAlertUnit);
  const recurringEnabled = input.draft.recurringEnabled === true;
  const recurringIntervalValue = recurringEnabled
    ? positiveNumber(input.draft.recurringIntervalValue)
    : null;
  if (recurringEnabled && recurringIntervalValue === null) {
    throw new Error('RECURRING_INTERVAL_REQUIRED');
  }
  const recurringFallbackUnit: AssetMaintenanceIntervalUnit = triggerType === 'date'
    ? 'months'
    : usageMetric ?? defaultUsageMetric;
  const recurringIntervalUnit = recurringEnabled
    ? normalizeProposalIntervalUnit(input.draft.recurringIntervalUnit, recurringFallbackUnit)
    : null;
  const title = asText(input.draft.title).slice(0, 180)
    || (maintenanceType === 'checkup' ? 'Scheduled checkup' : 'Scheduled service');
  const notes = asText(input.draft.notes).slice(0, 4000);

  const result = await getDb().query<{ id: string }>(
    `
      insert into public.dealer_maintenance_schedule_proposals (
        access_id,
        owner_user_id,
        dealer_user_id,
        asset_register_item_id,
        lead_id,
        proposal_status,
        maintenance_type,
        trigger_type,
        title,
        notes,
        due_date,
        due_usage,
        usage_metric,
        alert_before_value,
        alert_before_unit,
        recurring_enabled,
        recurring_interval_value,
        recurring_interval_unit,
        created_at,
        updated_at
      )
      values (
        $1::uuid, $2, $3, $4::uuid, $5::uuid, 'pending', $6, $7, $8, $9,
        $10::date, $11, $12, $13, $14, $15, $16, $17, now(), now()
      )
      returning id::text
    `,
    [
      accessId,
      access.owner_user_id,
      input.dealerUserId,
      access.asset_register_item_id,
      leadId || null,
      maintenanceType,
      triggerType,
      title,
      notes,
      dueDate,
      dueUsage,
      usageMetric,
      alertBeforeValue,
      alertBeforeUnit,
      recurringEnabled,
      recurringIntervalValue,
      recurringIntervalUnit,
    ],
  );
  const proposalId = result.rows[0]?.id;
  const proposals = await listDealerMaintenanceScheduleProposals({
    dealerUserId: input.dealerUserId,
    accessId,
  });
  const proposal = proposals.find((entry) => entry.id === proposalId);
  if (!proposal) throw new Error('MAINTENANCE_PROPOSAL_NOT_FOUND');
  return proposal;
}

export async function updateDealerMaintenanceScheduleProposal(input: {
  dealerUserId: string;
  proposalId: string;
  draft: DealerMaintenanceScheduleProposalInput;
}): Promise<DealerMaintenanceScheduleProposal> {
  await ensureDealerMaintenanceTrackerTables();
  const accessId = asText(input.draft.accessId);
  if (!UUID_PATTERN.test(accessId) || !UUID_PATTERN.test(input.proposalId)) {
    throw new Error('MAINTENANCE_PROPOSAL_NOT_FOUND');
  }

  const accessRows = await listAccessRows(
    'where access.dealer_user_id = $1 and access.id = $2::uuid and access.is_active = true',
    [input.dealerUserId, accessId],
  );
  const access = accessRows[0];
  if (!access) throw new Error('TRACKING_ACCESS_NOT_FOUND');
  if (!rowPermissions(access).canCreateMaintenanceSchedules) {
    throw new Error('MAINTENANCE_SCHEDULE_PERMISSION_REQUIRED');
  }

  const proposals = await listDealerMaintenanceScheduleProposals({
    dealerUserId: input.dealerUserId,
    accessId,
  });
  const current = proposals.find(
    (proposal) =>
      proposal.id === input.proposalId
      && proposal.status === 'pending',
  );
  if (!current) throw new Error('MAINTENANCE_PROPOSAL_NOT_FOUND');

  const asset = await getAssetRegisterItemById(
    access.owner_user_id,
    access.asset_register_item_id,
  );
  if (!asset) throw new Error('ASSET_NOT_FOUND');

  const maintenanceType = normalizeProposalMaintenanceType(
    input.draft.maintenanceType ?? current.maintenanceType,
  );
  const triggerType = normalizeProposalTriggerType(
    input.draft.triggerType ?? current.triggerType,
  );
  const defaultUsageMetric = assetUsageMetric(asset);
  const usageMetric = triggerType === 'usage'
    ? normalizeProposalUsageMetric(
        input.draft.usageMetric ?? current.usageMetric,
        defaultUsageMetric,
      )
    : null;
  const dueDate = triggerType === 'date'
    ? dateOnly(input.draft.dueDate ?? current.dueDate)
    : null;
  const dueUsage = triggerType === 'usage'
    ? nonNegativeNumber(input.draft.dueUsage ?? current.dueUsage)
    : null;
  if (triggerType === 'date' && !dueDate) throw new Error('DUE_DATE_REQUIRED');
  if (triggerType === 'usage' && dueUsage === null) throw new Error('DUE_USAGE_REQUIRED');

  const defaultAlertUnit: AssetMaintenanceIntervalUnit = triggerType === 'date'
    ? 'days'
    : usageMetric ?? defaultUsageMetric;
  const alertBeforeValue = nonNegativeNumber(
    input.draft.alertBeforeValue ?? current.alertBeforeValue,
  ) ?? (triggerType === 'date'
    ? 7
    : usageMetric === 'km'
      ? 1000
      : usageMetric === 'percentage'
        ? 5
        : 20);
  const alertBeforeUnit = normalizeProposalIntervalUnit(
    input.draft.alertBeforeUnit ?? current.alertBeforeUnit,
    defaultAlertUnit,
  );
  const recurringEnabled = input.draft.recurringEnabled === undefined
    ? current.recurringEnabled
    : input.draft.recurringEnabled === true;
  const recurringIntervalValue = recurringEnabled
    ? positiveNumber(
        input.draft.recurringIntervalValue ?? current.recurringIntervalValue,
      )
    : null;
  if (recurringEnabled && recurringIntervalValue === null) {
    throw new Error('RECURRING_INTERVAL_REQUIRED');
  }
  const recurringFallbackUnit: AssetMaintenanceIntervalUnit = triggerType === 'date'
    ? 'months'
    : usageMetric ?? defaultUsageMetric;
  const recurringIntervalUnit = recurringEnabled
    ? normalizeProposalIntervalUnit(
        input.draft.recurringIntervalUnit ?? current.recurringIntervalUnit,
        recurringFallbackUnit,
      )
    : null;
  const title = asText(input.draft.title ?? current.title).slice(0, 180)
    || (maintenanceType === 'checkup' ? 'Scheduled checkup' : 'Scheduled service');
  const notes = asText(input.draft.notes ?? current.notes).slice(0, 4000);

  const result = await getDb().query<{ id: string }>(
    `
      update public.dealer_maintenance_schedule_proposals
      set
        maintenance_type = $4,
        trigger_type = $5,
        title = $6,
        notes = $7,
        due_date = $8::date,
        due_usage = $9,
        usage_metric = $10,
        alert_before_value = $11,
        alert_before_unit = $12,
        recurring_enabled = $13,
        recurring_interval_value = $14,
        recurring_interval_unit = $15,
        updated_at = now()
      where id = $1::uuid
        and dealer_user_id = $2
        and access_id = $3::uuid
        and proposal_status = 'pending'
      returning id::text
    `,
    [
      input.proposalId,
      input.dealerUserId,
      accessId,
      maintenanceType,
      triggerType,
      title,
      notes,
      dueDate,
      dueUsage,
      usageMetric,
      alertBeforeValue,
      alertBeforeUnit,
      recurringEnabled,
      recurringIntervalValue,
      recurringIntervalUnit,
    ],
  );
  if (!result.rows[0]) throw new Error('MAINTENANCE_PROPOSAL_NOT_FOUND');

  const updated = await listDealerMaintenanceScheduleProposals({
    dealerUserId: input.dealerUserId,
    accessId,
  });
  const proposal = updated.find((entry) => entry.id === input.proposalId);
  if (!proposal) throw new Error('MAINTENANCE_PROPOSAL_NOT_FOUND');
  return proposal;
}

export async function resolveDealerMaintenanceScheduleProposal(input: {
  ownerUserId: string;
  proposalId: string;
  decision: 'approve' | 'decline';
}): Promise<DealerMaintenanceScheduleProposal> {
  await ensureDealerMaintenanceTrackerTables();
  if (!UUID_PATTERN.test(input.proposalId)) throw new Error('MAINTENANCE_PROPOSAL_NOT_FOUND');
  const client = await getDb().connect();
  try {
    await client.query('begin');
    const currentResult = await client.query<DealerMaintenanceScheduleProposalRow>(
      `
        ${proposalSelectSql(`
          where proposal.id = $1::uuid
            and proposal.owner_user_id = $2
            and access.owner_user_id = $2
            and access.is_active = true
        `)}
        limit 1
        for update of proposal
      `,
      [input.proposalId, input.ownerUserId],
    );
    const currentRow = currentResult.rows[0];
    if (!currentRow) throw new Error('MAINTENANCE_PROPOSAL_NOT_FOUND');
    if (normalizeProposalStatus(currentRow.proposal_status) !== 'pending') {
      throw new Error('MAINTENANCE_PROPOSAL_ALREADY_RESOLVED');
    }

    let maintenanceRecordId: string | null = null;
    if (input.decision === 'approve') {
      const recordResult = await client.query<{ id: string }>(
        `
          insert into public.asset_maintenance_records (
            user_id,
            asset_register_item_id,
            maintenance_type,
            trigger_type,
            status,
            title,
            notes,
            assigned_field_manager_id,
            assigned_name,
            due_date,
            due_usage,
            usage_metric,
            alert_before_value,
            alert_before_unit,
            recurring_enabled,
            recurring_interval_value,
            recurring_interval_unit,
            created_at,
            updated_at
          )
          values (
            $1, $2::uuid, $3, $4, 'upcoming', $5, $6, null, '',
            $7::date, $8, $9, $10, $11, $12, $13, $14, now(), now()
          )
          returning id::text
        `,
        [
          input.ownerUserId,
          currentRow.asset_register_item_id,
          normalizeProposalMaintenanceType(currentRow.maintenance_type),
          normalizeProposalTriggerType(currentRow.trigger_type),
          asText(currentRow.title),
          asText(currentRow.notes),
          storedDateOnly(currentRow.due_date),
          nonNegativeNumber(currentRow.due_usage),
          asText(currentRow.usage_metric) || null,
          nonNegativeNumber(currentRow.alert_before_value),
          asText(currentRow.alert_before_unit) || null,
          Boolean(currentRow.recurring_enabled),
          positiveNumber(currentRow.recurring_interval_value),
          asText(currentRow.recurring_interval_unit) || null,
        ],
      );
      maintenanceRecordId = recordResult.rows[0]?.id ?? null;
      if (!maintenanceRecordId) throw new Error('MAINTENANCE_NOT_CREATED');
    }

    const nextStatus: DealerMaintenanceScheduleProposalStatus = input.decision === 'approve'
      ? 'approved'
      : 'declined';
    await client.query(
      `
        update public.dealer_maintenance_schedule_proposals
        set
          proposal_status = $3,
          created_maintenance_record_id = $4::uuid,
          decided_at = now(),
          updated_at = now()
        where id = $1::uuid
          and owner_user_id = $2
          and proposal_status = 'pending'
      `,
      [input.proposalId, input.ownerUserId, nextStatus, maintenanceRecordId],
    );
    await client.query('commit');

    return mapScheduleProposal({
      ...currentRow,
      proposal_status: nextStatus,
      created_maintenance_record_id: maintenanceRecordId,
      decided_at: new Date(),
      updated_at: new Date(),
    });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function buildTrackedAsset(row: DealerMaintenanceAccessRow): Promise<DealerMaintenanceTrackedAsset | null> {
  const permissions = rowPermissions(row);
  const [asset, records, scheduleProposals] = await Promise.all([
    getAssetRegisterItemById(row.owner_user_id, row.asset_register_item_id),
    listAssetMaintenanceRecords(row.owner_user_id, {
      assetId: row.asset_register_item_id,
    }),
    listDealerMaintenanceScheduleProposals({
      dealerUserId: row.dealer_user_id,
      accessId: row.id,
    }),
  ]);
  if (!asset) return null;
  const openRecords = records.filter(
    (record) => record.assetId === row.asset_register_item_id && record.status === 'upcoming',
  );
  const completedRecords = records.filter(
    (record) => record.assetId === row.asset_register_item_id && record.status === 'done',
  );
  const percentageBasedAsset = openRecords.some(
    (record) => (record.assetUsageMetric ?? record.usageMetric) === 'percentage',
  );

  const ranked = [...openRecords].sort((left, right) => {
    if (percentageBasedAsset && left.triggerType !== right.triggerType) {
      return left.triggerType === 'date' ? -1 : 1;
    }
    const priority = statusPriority(trackerStatus(left)) - statusPriority(trackerStatus(right));
    if (priority) return priority;
    const leftRemaining = left.remainingUsage ?? left.daysUntilDue ?? Number.POSITIVE_INFINITY;
    const rightRemaining = right.remainingUsage ?? right.daysUntilDue ?? Number.POSITIVE_INFINITY;
    return leftRemaining - rightRemaining;
  });
  const next = ranked[0] ?? null;
  const nextStatus: DealerMaintenanceTrackerStatus = next ? trackerStatus(next) : 'no_open';
  // A recurring completion creates a new open record. Keep the aggregate asset
  // on that live record's status; the client renders the completed cycle as its
  // own Done card instead of allowing history to hide the replacement schedule.
  const status: DealerMaintenanceTrackerStatus = next
    ? nextStatus
    : completedRecords.length
      ? 'done'
      : nextStatus;
  const usageMetric = assetUsageMetric(asset, next);
  const currentUsage = next?.currentUsage ?? next?.assetUsageReading ?? currentAssetUsage(asset, usageMetric);
  const loggedProblems = permissions.canViewLoggedProblems
    ? await listIssueNotesForAssets([asset.id], { includeNoted: true })
    : [];
  const openSummaries = ranked.map(recordSummary);
  const completedSummaries = completedRecords.map(recordSummary);

  return {
    accessId: row.id,
    ownerUserId: row.owner_user_id,
    dealerUserId: row.dealer_user_id,
    assetId: asset.id,
    ownerName: accessOwnerName(row),
    ownerPhone: asText(row.owner_phone),
    ownerEmail: asText(row.owner_email),
    assetTitle: asset.title,
    assetKind: asset.kind,
    maintenanceIdentity: records[0]?.maintenanceIdentity || maintenanceIdentity(asset),
    brandName: asset.brandName,
    modelName: asset.modelName || asset.typedModelName,
    yearModel: asset.yearModel,
    condition: asset.condition,
    serialNumber: asset.serialNumber,
    registrationNumber: asset.licenseRegistrationNumber,
    replacementPriceExVat: asset.replacementPriceExVat,
    dealerCorrection: null,
    photoUrl: asset.photos[0] ?? '',
    photoUrls: [...asset.photos],
    currentUsage,
    usageMetric,
    usageUpdatedAtIso: asset.lastScannedAtIso || asset.updatedAtIso || null,
    status,
    statusLabel: trackerStatusLabel(status),
    nextMaintenance: next ? recordSummary(next) : null,
    openMaintenanceRecords: openSummaries,
    completedMaintenanceRecords: completedSummaries,
    maintenanceRecords: [...openSummaries, ...completedSummaries],
    loggedProblems,
    scheduleProposals,
    permissions,
    grantedByName: asText(row.granted_by_name),
    createdAtIso: iso(row.created_at),
    updatedAtIso: iso(row.updated_at),
  };
}

async function hydrateTrackedAssetCorrections(
  dealerUserId: string,
  assets: DealerMaintenanceTrackedAsset[],
): Promise<DealerMaintenanceTrackedAsset[]> {
  if (!assets.length) return assets;
  const corrections = await listPendingDealerAssetCorrections(
    dealerUserId,
    assets.map((asset) => asset.assetId),
  );
  const correctionsByAssetId = new Map(corrections.map((correction) => [correction.assetId, correction]));

  return assets.map((asset) => {
    const correction = correctionsByAssetId.get(asset.assetId);
    if (!correction) return asset;
    return {
      ...asset,
      serialNumber: correction.serialNumberChanged && correction.proposedSerialNumber
        ? correction.proposedSerialNumber
        : asset.serialNumber,
      replacementPriceExVat: correction.replacementPriceChanged
        ? correction.proposedReplacementPriceExVat
        : asset.replacementPriceExVat,
      dealerCorrection: correction,
    };
  });
}

export async function listDealerTrackedAssets(dealerUserId: string): Promise<DealerMaintenanceTrackedAsset[]> {
  const rows = await listAccessRows(
    'where access.dealer_user_id = $1 and access.is_active = true',
    [dealerUserId],
  );
  const builtAssets = await Promise.all(rows.map(buildTrackedAsset));
  const assets = await hydrateTrackedAssetCorrections(
    dealerUserId,
    builtAssets.filter(
      (asset): asset is DealerMaintenanceTrackedAsset =>
        asset !== null
      && (
        asset.maintenanceRecords.length > 0
        || asset.scheduleProposals.some((proposal) => proposal.status === 'pending')
      ),
    ),
  );
  return assets
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
  if (!rows[0]) return null;
  const asset = await buildTrackedAsset(rows[0]);
  if (!asset) return null;
  const [hydratedAsset] = await hydrateTrackedAssetCorrections(dealerUserId, [asset]);
  return hydratedAsset ?? null;
}

export async function recordDealerStandaloneMaintenance(input: {
  dealerUserId: string;
  accessId: string;
  maintenanceId: string;
  completion: AssetMaintenanceCompleteInput;
  clientEventId: string;
}): Promise<{
  asset: DealerMaintenanceTrackedAsset;
  completed: AssetMaintenanceRecord;
}> {
  const asset = await getDealerTrackedAsset(input.dealerUserId, input.accessId);
  if (!asset) throw new Error('DEALER_MAINTENANCE_ACCESS_NOT_FOUND');

  const referenceRecord = asset.openMaintenanceRecords.find(
    (record) => record.id === input.maintenanceId,
  );
  if (!referenceRecord) throw new Error('DEALER_MAINTENANCE_RECORD_NOT_FOUND');

  const completed = await recordStandaloneAssetMaintenanceCompletion(
    asset.ownerUserId,
    {
      assetId: asset.assetId,
      maintenanceType: referenceRecord.maintenanceType,
      sourceScanEventId: input.clientEventId,
      completedAt: input.completion.completedAt,
      completedUsage: input.completion.completedUsage,
      completedNotes: input.completion.completedNotes,
      maintenanceWork: input.completion.maintenanceWork,
      completedBy: input.completion.completedBy,
    },
  );
  const refreshedAsset = await getDealerTrackedAsset(
    input.dealerUserId,
    input.accessId,
  );
  if (!refreshedAsset) throw new Error('DEALER_MAINTENANCE_ACCESS_NOT_FOUND');
  return { asset: refreshedAsset, completed };
}

export async function updateDealerTrackedMaintenanceSchedule(input: {
  dealerUserId: string;
  accessId: string;
  maintenanceId: string;
  draft: AssetMaintenanceDraftInput;
}): Promise<{
  asset: DealerMaintenanceTrackedAsset;
  record: AssetMaintenanceRecord;
}> {
  const asset = await getDealerTrackedAsset(input.dealerUserId, input.accessId);
  if (!asset) throw new Error('DEALER_MAINTENANCE_ACCESS_NOT_FOUND');
  if (!asset.permissions.canCreateMaintenanceSchedules) {
    throw new Error('MAINTENANCE_SCHEDULE_PERMISSION_REQUIRED');
  }
  const openRecord = asset.openMaintenanceRecords.find(
    (record) => record.id === input.maintenanceId,
  );
  if (!openRecord) throw new Error('DEALER_MAINTENANCE_RECORD_NOT_FOUND');

  const record = await updateAssetMaintenanceRecord(
    asset.ownerUserId,
    openRecord.id,
    {
      ...input.draft,
      assetId: asset.assetId,
    },
  );
  const refreshedAsset = await getDealerTrackedAsset(
    input.dealerUserId,
    input.accessId,
  );
  if (!refreshedAsset) throw new Error('DEALER_MAINTENANCE_ACCESS_NOT_FOUND');
  return { asset: refreshedAsset, record };
}

export async function completeDealerTrackedMaintenance(input: {
  dealerUserId: string;
  accessId: string;
  maintenanceId: string;
  completion: AssetMaintenanceCompleteInput;
}): Promise<{
  asset: DealerMaintenanceTrackedAsset;
  completed: AssetMaintenanceRecord;
  nextRecord: AssetMaintenanceRecord | null;
}> {
  const asset = await getDealerTrackedAsset(input.dealerUserId, input.accessId);
  if (!asset) throw new Error('DEALER_MAINTENANCE_ACCESS_NOT_FOUND');

  const openRecord = asset.openMaintenanceRecords.find((record) => record.id === input.maintenanceId);
  if (!openRecord) throw new Error('DEALER_MAINTENANCE_RECORD_NOT_FOUND');

  const result = await completeAssetMaintenanceRecord(
    asset.ownerUserId,
    openRecord.id,
    input.completion,
    { assetId: asset.assetId },
  );
  const refreshedAsset = await getDealerTrackedAsset(input.dealerUserId, input.accessId);
  if (!refreshedAsset) throw new Error('DEALER_MAINTENANCE_ACCESS_NOT_FOUND');

  return { asset: refreshedAsset, ...result };
}

export async function listDealerMaintenanceReportData(input: {
  dealerUserId: string;
  accessId: string;
  filters?: AssetMaintenanceListFilters;
}): Promise<{
  ownerUserId: string;
  data: AssetMaintenanceListResult;
}> {
  const contextRows = await listAccessRows(
    'where access.dealer_user_id = $1 and access.id = $2::uuid and access.is_active = true',
    [input.dealerUserId, input.accessId],
  );
  const context = contextRows[0];
  if (!context || !rowPermissions(context).canViewMaintenanceReports) {
    throw new Error('MAINTENANCE_REPORT_FORBIDDEN');
  }

  const filters = input.filters ?? {};

  if (filters.assetId && filters.assetId !== context.asset_register_item_id) {
    throw new Error('MAINTENANCE_REPORT_FORBIDDEN');
  }

  const rawData = await listAssetMaintenanceData(context.owner_user_id, {
    ...filters,
    assetId: context.asset_register_item_id,
  });
  const records = rawData.records.filter((record) => record.assetId === context.asset_register_item_id);
  const assets = rawData.assets.filter((asset) => asset.id === context.asset_register_item_id);

  return {
    ownerUserId: context.owner_user_id,
    data: {
      assets,
      fieldManagers: rawData.fieldManagers,
      records,
      summary: calculateAssetMaintenanceSummary(records),
    },
  };
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
