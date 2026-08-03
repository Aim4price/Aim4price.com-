import { listAssetMaintenanceRecords } from './asset-maintenance';
import { getDb } from './db';

export type AssetActivityItem = {
  id: string;
  kind: 'work' | 'fuel' | 'maintenance' | 'lifecycle';
  title: string;
  detail: string;
  actorName: string;
  occurredAtIso: string;
};

type ScanRow = {
  id: string;
  operator_name: string | null;
  activity_text: string | null;
  work_area_text: string | null;
  hours: string | number | null;
  condition: string | null;
  note: string | null;
  location_text: string | null;
  created_at: string;
};

type FuelRow = {
  id: string;
  litres: string | number | null;
  operator_name: string | null;
  activity_text: string | null;
  work_area_text: string | null;
  note: string | null;
  storage_name: string | null;
  occurred_at: string;
};

type LifecycleRow = {
  id: string;
  event_type: string | null;
  reason: string | null;
  effective_date: string | null;
  amount_ex_vat: string | number | null;
  note: string | null;
  actor_name: string | null;
  created_at: string;
};

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function number(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sentence(parts: Array<string | null | undefined>): string {
  return parts.map(text).filter(Boolean).join(' · ');
}

function lifecycleTitle(eventType: string, reason: string): string {
  if (eventType === 'acquired') return 'Asset acquired';
  if (eventType === 'existing_added') return 'Asset added';
  if (eventType === 'disposed') return reason === 'sold' ? 'Asset sold' : 'Asset disposed';
  if (eventType === 'deleted_duplicate') return 'Asset record removed';
  return 'Asset record updated';
}

function reasonLabel(value: string): string {
  const normalized = text(value).replace(/_/g, ' ');
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : '';
}

async function listScanActivity(assetId: string): Promise<AssetActivityItem[]> {
  const result = await getDb().query<ScanRow>(
    `select id::text, operator_name, activity_text, work_area_text, hours, condition, note,
            location_text, created_at::text
       from public.asset_scan_events
      where asset_id = $1::uuid
        and fuel_storage_event_id is null
        and fuel_slip_id is null
      order by created_at desc
      limit 60`,
    [assetId],
  );

  return result.rows.map((row) => {
    const note = text(row.note);
    const procedure = /^serviced\b/i.test(note)
      ? 'Service recorded'
      : /^repaired\b/i.test(note)
        ? 'Repair recorded'
        : /^checked\b/i.test(note)
          ? 'Check recorded'
          : 'Asset update recorded';
    const hours = number(row.hours);
    return {
      id: `work:${row.id}`,
      kind: 'work',
      title: procedure,
      detail: sentence([
        text(row.activity_text),
        text(row.work_area_text),
        hours === null ? '' : `${hours.toLocaleString('en-ZA')} hours`,
        text(row.condition),
        note,
        text(row.location_text),
      ]),
      actorName: text(row.operator_name),
      occurredAtIso: row.created_at,
    };
  });
}

async function listFuelActivity(ownerUserId: string, assetId: string): Promise<AssetActivityItem[]> {
  const result = await getDb().query<FuelRow>(
    `select e.id::text, e.litres, e.operator_name, e.activity_text, e.work_area_text, e.note,
            s.name as storage_name, coalesce(e.issue_at, e.created_at)::text as occurred_at
       from public.fuel_storage_events e
       left join public.fuel_storage_units s on s.id = e.storage_id
      where e.user_id = $1
        and e.asset_register_item_id = $2::text
        and e.event_type = 'asset_issue'
      order by coalesce(e.issue_at, e.created_at) desc
      limit 60`,
    [ownerUserId, assetId],
  );

  return result.rows.map((row) => {
    const litres = number(row.litres);
    return {
      id: `fuel:${row.id}`,
      kind: 'fuel',
      title: 'Fuel recorded',
      detail: sentence([
        litres === null ? '' : `${litres.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} litres`,
        text(row.storage_name),
        text(row.activity_text),
        text(row.work_area_text),
        text(row.note),
      ]),
      actorName: text(row.operator_name),
      occurredAtIso: row.occurred_at,
    };
  });
}

async function listLifecycleActivity(ownerUserId: string, assetId: string): Promise<AssetActivityItem[]> {
  const result = await getDb().query<LifecycleRow>(
    `select id::text, event_type, reason, effective_date::text, amount_ex_vat, note,
            actor_name, created_at::text
       from public.asset_lifecycle_events
      where owner_user_id = $1 and asset_register_item_id = $2::uuid
      order by effective_date desc, created_at desc
      limit 30`,
    [ownerUserId, assetId],
  );

  return result.rows.map((row) => {
    const amount = number(row.amount_ex_vat);
    const eventType = text(row.event_type);
    const reason = text(row.reason);
    return {
      id: `lifecycle:${row.id}`,
      kind: 'lifecycle',
      title: lifecycleTitle(eventType, reason),
      detail: sentence([
        reasonLabel(reason),
        text(row.effective_date),
        amount === null ? '' : `R ${Math.round(amount).toLocaleString('en-ZA')}`,
        text(row.note),
      ]),
      actorName: text(row.actor_name),
      occurredAtIso: row.created_at,
    };
  });
}

async function listMaintenanceActivity(ownerUserId: string, assetId: string): Promise<AssetActivityItem[]> {
  const records = await listAssetMaintenanceRecords(ownerUserId, { assetId });
  return records.map((record) => ({
    id: `maintenance:${record.id}`,
    kind: 'maintenance' as const,
    title: record.status === 'done'
      ? `${record.maintenanceType === 'checkup' ? 'Checkup' : 'Service'} completed`
      : record.status === 'cancelled'
        ? 'Maintenance cancelled'
        : 'Maintenance scheduled',
    detail: sentence([
      text(record.title),
      record.dueDate ? `Due ${record.dueDate}` : '',
      record.completedNotes,
      record.notes,
    ]),
    actorName: record.status === 'done' ? text(record.completedBy) : text(record.assignedName),
    occurredAtIso: record.completedAtIso || record.updatedAtIso || record.createdAtIso,
  }));
}

export async function listAssetActivity(ownerUserId: string, assetId: string): Promise<AssetActivityItem[]> {
  const sources = await Promise.all([
    listScanActivity(assetId).catch(() => []),
    listFuelActivity(ownerUserId, assetId).catch(() => []),
    listMaintenanceActivity(ownerUserId, assetId).catch(() => []),
    listLifecycleActivity(ownerUserId, assetId).catch(() => []),
  ]);

  return sources.flat().sort((left, right) => {
    const leftTime = new Date(left.occurredAtIso).getTime();
    const rightTime = new Date(right.occurredAtIso).getTime();
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  }).slice(0, 100);
}
