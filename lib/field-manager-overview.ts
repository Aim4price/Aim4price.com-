import {
  buildAssetLicenseRenewalAlert,
  johannesburgDateKey,
  parseAssetLicenseDateKey,
} from './asset-license-renewal';
import {
  listAssetMaintenanceRecords,
  type AssetMaintenanceRecord,
  type AssetMaintenanceUsageMetric,
} from './asset-maintenance';
import { listOpenIssueNoteGroupsForAssets } from './asset-issue-notes';
import { getDb } from './db';
import {
  dismissOwnerAppOverviewSourceForEveryone,
  listOwnerAppOverviewGlobalDismissalKeys,
} from './owner-app-overview';
import {
  ensureFieldManagerTables,
  listFieldManagerAssets,
  type FieldManagerAssetSummary,
} from './field-manager';

export type FieldManagerOverviewRange = 'week' | 'upcoming';
export type FieldManagerOverviewItemType =
  | 'problem'
  | 'service'
  | 'checkup'
  | 'license';
export type FieldManagerOverviewSection = 'needs_attention' | 'coming_up';
export type FieldManagerOverviewStatus =
  | 'problem'
  | 'overdue'
  | 'due'
  | 'due_soon'
  | 'upcoming'
  | 'usage_needed';
export type FieldManagerOverviewSourceKind =
  | 'maintenance'
  | 'problem'
  | 'license';

export type FieldManagerOverviewItem = {
  id: string;
  sourceId: string;
  type: FieldManagerOverviewItemType;
  section: FieldManagerOverviewSection;
  status: FieldManagerOverviewStatus;
  statusLabel: string;
  assetId: string;
  assetTitle: string;
  headline: string;
  detail: string;
  notes: string;
  isRecurringFollowUp: boolean;
  createdAtIso: string;
  sortTimestamp: string | null;
  sortValue: number | null;
  openAsset: true;
};

export type FieldManagerOverviewResult = {
  ok: true;
  range: FieldManagerOverviewRange;
  summary: {
    totalCount: number;
    needsAttentionCount: number;
    comingUpCount: number;
  };
  items: FieldManagerOverviewItem[];
};

type LicenseAssetRow = {
  id: string;
  kind: string | null;
  is_licensed: boolean | null;
  license_registration_number: string | null;
  specs_json: unknown;
  license_renewal_alert_noted_for_date: string | null;
};

type FieldManagerOverviewDismissalRow = {
  source_kind: string | null;
  source_id: string | null;
};

const DAY_MS = 86_400_000;
let overviewDismissalTablePromise: Promise<void> | null = null;

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function overviewSourceKind(
  item: FieldManagerOverviewItem,
): FieldManagerOverviewSourceKind {
  if (item.type === 'service' || item.type === 'checkup') {
    return 'maintenance';
  }

  return item.type;
}

function overviewDismissalKey(
  sourceKind: FieldManagerOverviewSourceKind,
  sourceId: string,
): string {
  return `${sourceKind}\u0000${sourceId}`;
}

async function ensureFieldManagerOverviewDismissalTableOnce(): Promise<void> {
  await ensureFieldManagerTables();

  const db = getDb();
  await db.query(`
    create table if not exists public.field_manager_overview_dismissals (
      field_manager_id uuid not null
        references public.field_managers(id) on delete cascade,
      source_kind text not null
        check (source_kind in ('maintenance', 'problem', 'license')),
      source_id text not null,
      overview_item_id text not null,
      asset_register_item_id uuid not null,
      dismissed_at timestamptz not null default now(),
      primary key (field_manager_id, source_kind, source_id)
    )
  `);
  await db.query(`
    create index if not exists idx_field_manager_overview_dismissals_asset
      on public.field_manager_overview_dismissals(asset_register_item_id)
  `);
}

async function ensureFieldManagerOverviewDismissalTable(): Promise<void> {
  if (!overviewDismissalTablePromise) {
    overviewDismissalTablePromise = ensureFieldManagerOverviewDismissalTableOnce()
      .catch((error) => {
        overviewDismissalTablePromise = null;
        throw error;
      });
  }

  return overviewDismissalTablePromise;
}

async function listFieldManagerOverviewDismissalKeys(
  managerId: string,
): Promise<Set<string>> {
  await ensureFieldManagerOverviewDismissalTable();

  const result = await getDb().query<FieldManagerOverviewDismissalRow>(
    `
      select source_kind, source_id
      from public.field_manager_overview_dismissals
      where field_manager_id = $1::uuid
    `,
    [managerId],
  );

  return new Set(
    result.rows.flatMap((row) => {
      const sourceKind = asText(row.source_kind) as FieldManagerOverviewSourceKind;
      const sourceId = asText(row.source_id);

      return sourceKind && sourceId
        ? [overviewDismissalKey(sourceKind, sourceId)]
        : [];
    }),
  );
}

function rangeDays(range: FieldManagerOverviewRange): number | null {
  return range === 'week' ? 7 : null;
}

function dateKeyToIso(value: string | null | undefined): string | null {
  const parsed = parseAssetLicenseDateKey(value);
  return parsed ? new Date(parsed.timestamp).toISOString() : null;
}

function daysBetweenDateKeys(left: string, right: string): number | null {
  const leftDate = parseAssetLicenseDateKey(left);
  const rightDate = parseAssetLicenseDateKey(right);

  if (!leftDate || !rightDate) {
    return null;
  }

  return Math.round((leftDate.timestamp - rightDate.timestamp) / DAY_MS);
}

function formatDateLabel(value: string): string {
  const parsed = parseAssetLicenseDateKey(value);
  if (!parsed) return value;

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(parsed.timestamp));
}

function formatReportedDateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  }).format(parsed);
}

function formatUsage(
  value: number | null,
  metric: AssetMaintenanceUsageMetric | null,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }

  if (metric === 'percentage') {
    return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}%`;
  }

  const unit = metric === 'km' ? 'km' : 'hours';
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} ${unit}`;
}

function maintenanceTypeLabel(record: AssetMaintenanceRecord): string {
  return record.maintenanceType === 'checkup' ? 'Checkup' : 'Service';
}

function maintenanceDetail(record: AssetMaintenanceRecord): string {
  const typeLabel = maintenanceTypeLabel(record);

  if (record.triggerType === 'date') {
    const dueDateLabel = record.dueDate ? formatDateLabel(record.dueDate) : '';

    if (record.computedStatus === 'overdue' && typeof record.daysUntilDue === 'number') {
      const overdueDays = Math.abs(record.daysUntilDue);
      return `${typeLabel} overdue by ${overdueDays.toLocaleString('en-ZA')} day${overdueDays === 1 ? '' : 's'}${dueDateLabel ? ` (due ${dueDateLabel})` : ''}.`;
    }

    if (record.computedStatus === 'due') {
      return `${typeLabel} is due today${dueDateLabel ? ` (${dueDateLabel})` : ''}.`;
    }

    if (typeof record.daysUntilDue === 'number') {
      return `${typeLabel} due in ${record.daysUntilDue.toLocaleString('en-ZA')} day${record.daysUntilDue === 1 ? '' : 's'}${dueDateLabel ? ` (${dueDateLabel})` : ''}.`;
    }

    return dueDateLabel
      ? `${typeLabel} due on ${dueDateLabel}.`
      : `${typeLabel} is upcoming.`;
  }

  const metric = record.usageMetric ?? record.assetUsageMetric;
  const dueUsage = formatUsage(record.dueUsage, metric);

  if (record.currentUsage === null) {
    return dueUsage
      ? `${typeLabel} is due at ${dueUsage}. Add a current usage reading.`
      : `${typeLabel} needs a current usage reading.`;
  }

  if (record.computedStatus === 'overdue' && typeof record.remainingUsage === 'number') {
    return `${typeLabel} overdue by ${formatUsage(Math.abs(record.remainingUsage), metric)}.`;
  }

  if (record.computedStatus === 'due') {
    return `${typeLabel} is due now${dueUsage ? ` at ${dueUsage}` : ''}.`;
  }

  if (typeof record.remainingUsage === 'number') {
    return `${formatUsage(record.remainingUsage, metric)} remaining before this ${typeLabel.toLowerCase()} is due.`;
  }

  return dueUsage
    ? `${typeLabel} due at ${dueUsage}.`
    : `${typeLabel} is upcoming.`;
}

function maintenanceStatus(record: AssetMaintenanceRecord): {
  section: FieldManagerOverviewSection;
  status: FieldManagerOverviewStatus;
  statusLabel: string;
} {
  if (record.triggerType === 'usage' && record.currentUsage === null) {
    return {
      section: 'needs_attention',
      status: 'usage_needed',
      statusLabel: 'Usage reading needed',
    };
  }

  if (record.computedStatus === 'overdue') {
    return { section: 'needs_attention', status: 'overdue', statusLabel: 'Overdue' };
  }

  if (record.computedStatus === 'due') {
    return { section: 'needs_attention', status: 'due', statusLabel: 'Due' };
  }

  if (record.computedStatus === 'due_soon') {
    return { section: 'coming_up', status: 'due_soon', statusLabel: 'Due soon' };
  }

  return { section: 'coming_up', status: 'upcoming', statusLabel: 'Upcoming' };
}

function shouldIncludeMaintenance(
  record: AssetMaintenanceRecord,
  horizonDays: number | null,
): boolean {
  if (record.status !== 'upcoming') {
    return false;
  }

  if (horizonDays === null) {
    return true;
  }

  if (record.triggerType === 'usage') {
    if (record.currentUsage === null) {
      return true;
    }

    return ['overdue', 'due', 'due_soon'].includes(record.computedStatus);
  }

  return typeof record.daysUntilDue === 'number'
    && (record.daysUntilDue < 0 || record.daysUntilDue <= horizonDays);
}

function maintenanceToOverviewItem(
  record: AssetMaintenanceRecord,
  asset: FieldManagerAssetSummary,
): FieldManagerOverviewItem {
  const status = maintenanceStatus(record);
  const sortValue = record.triggerType === 'date'
    ? record.daysUntilDue
    : record.remainingUsage;

  return {
    id: `maintenance:${record.id}`,
    sourceId: record.id,
    type: record.maintenanceType,
    section: status.section,
    status: status.status,
    statusLabel: status.statusLabel,
    assetId: asset.id,
    assetTitle: asset.title,
    headline: asText(record.title) || `Scheduled ${maintenanceTypeLabel(record).toLowerCase()}`,
    detail: maintenanceDetail(record),
    notes: asText(record.notes),
    isRecurringFollowUp: Boolean(record.generatedFromMaintenanceId),
    createdAtIso: record.createdAtIso,
    sortTimestamp: record.triggerType === 'date' ? dateKeyToIso(record.dueDate) : null,
    sortValue: typeof sortValue === 'number' && Number.isFinite(sortValue) ? sortValue : null,
    openAsset: true,
  };
}

async function listLicenseRows(assetIds: string[]): Promise<LicenseAssetRow[]> {
  if (!assetIds.length) {
    return [];
  }

  const result = await getDb().query<LicenseAssetRow>(
    `
      select
        id::text as id,
        kind,
        is_licensed,
        license_registration_number,
        coalesce(specs_json, '{}'::jsonb) as specs_json,
        license_renewal_alert_noted_for_date::text as license_renewal_alert_noted_for_date
      from public.asset_register_items
      where id::text = any($1::text[])
    `,
    [assetIds],
  );

  return result.rows;
}

function sortOverviewItems(items: FieldManagerOverviewItem[]): FieldManagerOverviewItem[] {
  const attentionPriority: Record<FieldManagerOverviewStatus, number> = {
    problem: 0,
    overdue: 1,
    due: 2,
    usage_needed: 3,
    due_soon: 4,
    upcoming: 5,
  };

  return [...items].sort((left, right) => {
    if (left.section !== right.section) {
      return left.section === 'needs_attention' ? -1 : 1;
    }

    if (left.section === 'needs_attention') {
      const priorityDifference = attentionPriority[left.status] - attentionPriority[right.status];
      if (priorityDifference !== 0) return priorityDifference;

      if (left.status === 'problem' && right.status === 'problem') {
        const leftTime = left.sortTimestamp ? new Date(left.sortTimestamp).getTime() : 0;
        const rightTime = right.sortTimestamp ? new Date(right.sortTimestamp).getTime() : 0;
        if (leftTime !== rightTime) return rightTime - leftTime;
      }
    }

    const recurringDifference = Number(right.isRecurringFollowUp) - Number(left.isRecurringFollowUp);
    if (recurringDifference !== 0) return recurringDifference;

    if (left.isRecurringFollowUp && right.isRecurringFollowUp) {
      const leftCreatedTime = new Date(left.createdAtIso).getTime();
      const rightCreatedTime = new Date(right.createdAtIso).getTime();
      if (leftCreatedTime !== rightCreatedTime) return rightCreatedTime - leftCreatedTime;
    }

    const leftValue = left.sortValue ?? Number.POSITIVE_INFINITY;
    const rightValue = right.sortValue ?? Number.POSITIVE_INFINITY;
    if (leftValue !== rightValue) return leftValue - rightValue;

    const leftTime = left.sortTimestamp ? new Date(left.sortTimestamp).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right.sortTimestamp ? new Date(right.sortTimestamp).getTime() : Number.POSITIVE_INFINITY;
    if (leftTime !== rightTime) return leftTime - rightTime;

    const titleDifference = left.assetTitle.localeCompare(right.assetTitle);
    return titleDifference || left.id.localeCompare(right.id);
  });
}

async function buildFieldManagerOverview(input: {
  ownerUserId: string;
  managerId: string;
  range: FieldManagerOverviewRange;
}): Promise<FieldManagerOverviewResult> {
  const assets = await listFieldManagerAssets(input.ownerUserId, input.managerId);
  const assetIds = assets.map((asset) => asset.id);
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const allowedAssetIds = new Set(assetIds);
  const horizonDays = rangeDays(input.range);
  const todayKey = johannesburgDateKey();

  if (!assetIds.length) {
    return {
      ok: true,
      range: input.range,
      summary: { totalCount: 0, needsAttentionCount: 0, comingUpCount: 0 },
      items: [],
    };
  }

  const [maintenanceRecords, problemGroups, licenseRows] = await Promise.all([
    listAssetMaintenanceRecords(input.ownerUserId, {
      status: 'upcoming',
    }),
    listOpenIssueNoteGroupsForAssets(assetIds),
    listLicenseRows(assetIds),
  ]);

  const items: FieldManagerOverviewItem[] = [];

  maintenanceRecords.forEach((record) => {
    if (
      !allowedAssetIds.has(record.assetId)
      || !shouldIncludeMaintenance(record, horizonDays)
    ) {
      return;
    }

    const asset = assetById.get(record.assetId);
    if (!asset) return;
    items.push(maintenanceToOverviewItem(record, asset));
  });

  problemGroups.forEach((group) => {
    if (!allowedAssetIds.has(group.assetRegisterItemId)) return;
    const asset = assetById.get(group.assetRegisterItemId);
    if (!asset) return;

    const reporter = asText(group.latest.operatorName);
    const reportedDate = formatReportedDateLabel(group.latest.createdAtIso);
    const supportingDetails = [
      reporter ? `Reported by ${reporter}` : '',
      reportedDate ? `Reported ${reportedDate}` : '',
      group.earlierCount > 0
        ? `${group.earlierCount.toLocaleString('en-ZA')} earlier open problem${group.earlierCount === 1 ? '' : 's'}`
        : '',
    ].filter(Boolean);

    items.push({
      id: `problem:${asset.id}`,
      sourceId: group.latest.id,
      type: 'problem',
      section: 'needs_attention',
      status: 'problem',
      statusLabel: 'Needs attention',
      assetId: asset.id,
      assetTitle: asset.title,
      headline: 'Problem reported',
      detail: group.latest.note,
      notes: supportingDetails.join(' • '),
      isRecurringFollowUp: false,
      createdAtIso: group.latest.createdAtIso,
      sortTimestamp: group.latest.createdAtIso || null,
      sortValue: null,
      openAsset: true,
    });
  });

  licenseRows.forEach((row) => {
    if (!allowedAssetIds.has(row.id)) return;
    const asset = assetById.get(row.id);
    if (!asset) return;

    const alert = buildAssetLicenseRenewalAlert(
      {
        id: row.id,
        kind: row.kind,
        isLicensed: row.is_licensed,
        licenseRegistrationNumber: row.license_registration_number,
        specsJson: asRecord(row.specs_json),
      },
      row.license_renewal_alert_noted_for_date,
      todayKey,
    );

    if (!alert) return;
    const daysUntilDue = daysBetweenDateKeys(alert.renewalDate, todayKey);
    if (
      daysUntilDue === null
      || (horizonDays !== null && daysUntilDue > horizonDays && daysUntilDue >= 0)
    ) return;

    const needsAttention = alert.computedStatus === 'overdue' || alert.computedStatus === 'due';
    items.push({
      id: alert.id,
      sourceId: alert.id,
      type: 'license',
      section: needsAttention ? 'needs_attention' : 'coming_up',
      status: alert.computedStatus,
      statusLabel: alert.computedStatusLabel,
      assetId: asset.id,
      assetTitle: asset.title,
      headline: 'License renewal',
      detail: alert.body,
      notes: '',
      isRecurringFollowUp: false,
      createdAtIso: dateKeyToIso(alert.renewalDate) ?? new Date(0).toISOString(),
      sortTimestamp: dateKeyToIso(alert.renewalDate),
      sortValue: daysUntilDue,
      openAsset: true,
    });
  });

  const sortedItems = sortOverviewItems(items);
  const needsAttentionCount = sortedItems.filter((item) => item.section === 'needs_attention').length;

  return {
    ok: true,
    range: input.range,
    summary: {
      totalCount: sortedItems.length,
      needsAttentionCount,
      comingUpCount: sortedItems.length - needsAttentionCount,
    },
    items: sortedItems,
  };
}

export async function listFieldManagerOverview(input: {
  ownerUserId: string;
  managerId: string;
  range: FieldManagerOverviewRange;
}): Promise<FieldManagerOverviewResult> {
  const [overview, dismissedKeys, globallyDismissedKeys] = await Promise.all([
    buildFieldManagerOverview(input),
    listFieldManagerOverviewDismissalKeys(input.managerId),
    listOwnerAppOverviewGlobalDismissalKeys(input.ownerUserId),
  ]);
  const items = overview.items.filter((item) => {
    const key = overviewDismissalKey(overviewSourceKind(item), item.sourceId);
    return !dismissedKeys.has(key) && !globallyDismissedKeys.has(key);
  });
  const needsAttentionCount = items.filter(
    (item) => item.section === 'needs_attention',
  ).length;

  return {
    ...overview,
    summary: {
      totalCount: items.length,
      needsAttentionCount,
      comingUpCount: items.length - needsAttentionCount,
    },
    items,
  };
}

export async function dismissFieldManagerOverviewItem(input: {
  ownerUserId: string;
  managerId: string;
  range: FieldManagerOverviewRange;
  itemId: string;
  sourceId: string;
}): Promise<{ itemId: string; sourceId: string }> {
  const itemId = asText(input.itemId);
  const sourceId = asText(input.sourceId);

  if (!itemId || !sourceId) {
    throw new Error('OVERVIEW_ITEM_NOT_FOUND');
  }

  const overview = await buildFieldManagerOverview({
    ownerUserId: input.ownerUserId,
    managerId: input.managerId,
    range: input.range,
  });
  const item = overview.items.find(
    (candidate) => candidate.id === itemId && candidate.sourceId === sourceId,
  );

  if (!item) {
    throw new Error('OVERVIEW_ITEM_NOT_FOUND');
  }

  await dismissOwnerAppOverviewSourceForEveryone({
    ownerUserId: input.ownerUserId,
    sourceKind: overviewSourceKind(item),
    sourceId: item.sourceId,
    itemId: item.id,
    assetId: item.assetId,
  });

  return { itemId: item.id, sourceId: item.sourceId };
}
