import { buildAssetLicenseRenewalAlert, johannesburgDateKey, parseAssetLicenseDateKey } from './asset-license-renewal';
import { listAssetMaintenanceRecords, type AssetMaintenanceRecord } from './asset-maintenance';
import { listOpenIssueNoteGroupsForAssets } from './asset-issue-notes';
import { getDb } from './db';
import { listAllOwnerAppAssets, type OwnerAppAssetSummary } from './owner-app-assets';
import { ensureOwnerAppTables } from './owner-app';

export type OwnerAppOverviewRange = 'week' | 'upcoming';
export type OwnerAppOverviewItem = {
  id: string; sourceId: string; sourceKind: 'maintenance' | 'problem' | 'license';
  type: 'problem' | 'service' | 'checkup' | 'license'; section: 'needs_attention' | 'coming_up';
  status: string; statusLabel: string; assetId: string; assetTitle: string; headline: string;
  detail: string; notes: string; isRecurringFollowUp: boolean; createdAtIso: string;
  sortValue: number | null; sortTimestamp: string | null;
};

type LicenseRow = {
  id: string; kind: string | null; is_licensed: boolean | null; license_registration_number: string | null;
  specs_json: unknown; license_renewal_alert_noted_for_date: string | null;
};

function text(value: unknown) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function rangeDays(range: OwnerAppOverviewRange): number | null { return range === 'week' ? 7 : null; }
function dateIso(value: string | null) { const parsed = parseAssetLicenseDateKey(value); return parsed ? new Date(parsed.timestamp).toISOString() : null; }
function dayDifference(left: string, right: string) {
  const a = parseAssetLicenseDateKey(left); const b = parseAssetLicenseDateKey(right);
  return a && b ? Math.round((a.timestamp - b.timestamp) / 86_400_000) : null;
}
function dateLabel(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeZone: 'Africa/Johannesburg' }).format(parsed);
}
function usage(value: number | null, metric: string | null) {
  if (value === null || !Number.isFinite(value)) return '';
  return metric === 'percentage' ? `${value}%` : `${value.toLocaleString('en-ZA')} ${metric === 'km' ? 'km' : 'hours'}`;
}

function maintenanceItem(item: AssetMaintenanceRecord, asset: OwnerAppAssetSummary): OwnerAppOverviewItem {
  const needsUsage = item.triggerType === 'usage' && item.currentUsage === null;
  const urgent = needsUsage || item.computedStatus === 'overdue' || item.computedStatus === 'due';
  const typeLabel = item.maintenanceType === 'checkup' ? 'Checkup' : 'Service';
  let detail = `${typeLabel} is upcoming.`;
  if (needsUsage) detail = `${typeLabel} needs a current usage reading.`;
  else if (item.triggerType === 'date' && item.dueDate) detail = `${typeLabel} ${item.computedStatus === 'overdue' ? 'was due' : 'is due'} on ${item.dueDate}.`;
  else if (item.triggerType === 'usage' && item.dueUsage !== null) detail = `${typeLabel} is due at ${usage(item.dueUsage, item.usageMetric)}.`;
  return {
    id: `maintenance:${item.id}`, sourceId: item.id, sourceKind: 'maintenance', type: item.maintenanceType,
    section: urgent ? 'needs_attention' : 'coming_up', status: needsUsage ? 'usage_needed' : item.computedStatus,
    statusLabel: needsUsage ? 'Usage needed' : item.computedStatusLabel, assetId: asset.id, assetTitle: asset.title,
    headline: text(item.title) || `Scheduled ${typeLabel.toLowerCase()}`, detail, notes: text(item.notes),
    isRecurringFollowUp: Boolean(item.generatedFromMaintenanceId), createdAtIso: item.createdAtIso,
    sortValue: item.triggerType === 'date' ? item.daysUntilDue : item.remainingUsage,
    sortTimestamp: item.triggerType === 'date' ? dateIso(item.dueDate) : null,
  };
}

async function buildOverview(
  ownerUserId: string,
  range: OwnerAppOverviewRange,
  allowedAssetIds: readonly string[] | null = null,
): Promise<OwnerAppOverviewItem[]> {
  const { items } = await listAllOwnerAppAssets(ownerUserId);
  const allowed = allowedAssetIds ? new Set(allowedAssetIds) : null;
  const assets = allowed ? items.filter((asset) => allowed.has(asset.id)) : items;
  const ids = assets.map((asset) => asset.id);
  if (!ids.length) return [];
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const horizon = rangeDays(range);
  const today = johannesburgDateKey();
  const [maintenance, problems, licenses] = await Promise.all([
    listAssetMaintenanceRecords(ownerUserId, { status: 'upcoming' }),
    listOpenIssueNoteGroupsForAssets(ids),
    getDb().query<LicenseRow>(`select id::text as id, kind, is_licensed, license_registration_number,
      coalesce(specs_json, '{}'::jsonb) as specs_json, license_renewal_alert_noted_for_date::text
      from public.asset_register_items where user_id = $1 and id::text = any($2::text[])`, [ownerUserId, ids]),
  ]);
  const result: OwnerAppOverviewItem[] = [];

  maintenance.forEach((entry) => {
    const asset = byId.get(entry.assetId);
    if (!asset || entry.status !== 'upcoming') return;
    const include = horizon === null
      ? true
      : entry.triggerType === 'usage'
        ? entry.currentUsage === null || ['overdue', 'due', 'due_soon'].includes(entry.computedStatus)
        : entry.daysUntilDue !== null && (entry.daysUntilDue < 0 || entry.daysUntilDue <= horizon);
    if (include) result.push(maintenanceItem(entry, asset));
  });

  problems.forEach((group) => {
    const asset = byId.get(group.assetRegisterItemId); if (!asset) return;
    const reporter = text(group.latest.operatorName); const reported = dateLabel(group.latest.createdAtIso);
    result.push({
      id: `problem:${asset.id}`, sourceId: group.latest.id, sourceKind: 'problem', type: 'problem',
      section: 'needs_attention', status: 'problem', statusLabel: 'Needs attention', assetId: asset.id,
      assetTitle: asset.title, headline: 'Problem reported', detail: group.latest.note,
      notes: [reporter ? `Reported by ${reporter}` : '', reported ? `Reported ${reported}` : ''].filter(Boolean).join(' • '),
      isRecurringFollowUp: false, createdAtIso: group.latest.createdAtIso,
      sortValue: null, sortTimestamp: group.latest.createdAtIso || null,
    });
  });

  licenses.rows.forEach((row) => {
    const asset = byId.get(row.id); if (!asset) return;
    const alert = buildAssetLicenseRenewalAlert({ id: row.id, kind: row.kind, isLicensed: row.is_licensed, licenseRegistrationNumber: row.license_registration_number, specsJson: record(row.specs_json) }, row.license_renewal_alert_noted_for_date, today);
    if (!alert) return;
    const days = dayDifference(alert.renewalDate, today);
    if (days === null || (horizon !== null && days > horizon && days >= 0)) return;
    const urgent = alert.computedStatus === 'overdue' || alert.computedStatus === 'due';
    result.push({ id: alert.id, sourceId: alert.id, sourceKind: 'license', type: 'license', section: urgent ? 'needs_attention' : 'coming_up', status: alert.computedStatus, statusLabel: alert.computedStatusLabel, assetId: asset.id, assetTitle: asset.title, headline: 'Licence renewal', detail: alert.body, notes: '', isRecurringFollowUp: false, createdAtIso: dateIso(alert.renewalDate) ?? new Date(0).toISOString(), sortValue: days, sortTimestamp: dateIso(alert.renewalDate) });
  });

  return result.sort((a, b) => {
    if (a.section !== b.section) return a.section === 'needs_attention' ? -1 : 1;
    const priority = (value: string) => ({ problem: 0, overdue: 1, due: 2, usage_needed: 3, due_soon: 4, upcoming: 5 }[value] ?? 9);
    const difference = priority(a.status) - priority(b.status); if (difference) return difference;
    const recurringDifference = Number(b.isRecurringFollowUp) - Number(a.isRecurringFollowUp);
    if (recurringDifference) return recurringDifference;
    if (a.isRecurringFollowUp && b.isRecurringFollowUp) {
      const createdDifference = new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime();
      if (createdDifference) return createdDifference;
    }
    return (a.sortValue ?? Number.POSITIVE_INFINITY) - (b.sortValue ?? Number.POSITIVE_INFINITY) || a.assetTitle.localeCompare(b.assetTitle);
  });
}

export async function listOwnerAppOverview(
  ownerUserId: string,
  viewerKey: string,
  range: OwnerAppOverviewRange,
  allowedAssetIds: readonly string[] | null = null,
) {
  await ensureOwnerAppTables();
  const [items, dismissed] = await Promise.all([
    buildOverview(ownerUserId, range, allowedAssetIds),
    getDb().query<{ source_kind: string; source_id: string }>('select source_kind, source_id from public.owner_app_overview_dismissals where parent_owner_user_id = $1 and viewer_key = $2', [ownerUserId, viewerKey]),
  ]);
  const hidden = new Set(dismissed.rows.map((row) => `${row.source_kind}\u0000${row.source_id}`));
  const visible = items.filter((item) => !hidden.has(`${item.sourceKind}\u0000${item.sourceId}`));
  const needsAttentionCount = visible.filter((item) => item.section === 'needs_attention').length;
  return { ok: true as const, range, items: visible, summary: { totalCount: visible.length, needsAttentionCount, comingUpCount: visible.length - needsAttentionCount } };
}

export async function dismissOwnerAppOverviewItem(
  ownerUserId: string,
  viewerKey: string,
  range: OwnerAppOverviewRange,
  itemId: string,
  sourceId: string,
  allowedAssetIds: readonly string[] | null = null,
) {
  await ensureOwnerAppTables();
  const items = await buildOverview(ownerUserId, range, allowedAssetIds);
  const item = items.find((entry) => entry.id === itemId && entry.sourceId === sourceId);
  if (!item) throw new Error('OVERVIEW_ITEM_NOT_FOUND');
  await getDb().query(`insert into public.owner_app_overview_dismissals (
    parent_owner_user_id, viewer_key, source_kind, source_id, overview_item_id, asset_register_item_id, dismissed_at
  ) values ($1, $2, $3, $4, $5, $6::uuid, now())
  on conflict (parent_owner_user_id, viewer_key, source_kind, source_id) do update set
    overview_item_id = excluded.overview_item_id, asset_register_item_id = excluded.asset_register_item_id, dismissed_at = now()`,
  [ownerUserId, viewerKey, item.sourceKind, item.sourceId, item.id, item.assetId]);
}
