import type { QueryResultRow } from "pg";
import { getDb } from "./db";
import type { CaptureRequestType } from "./capture-requests";
import { resolveAssetUsage } from "./asset-usage";

export type AdminCaptureTarget = {
  targetType: "asset" | "fuel_storage";
  ownerUserId: string;
  ownerDisplayName: string;
  targetId: string;
  targetDisplayName: string;
  reference: string;
  meta: string;
  assetUsageMetric: "hours" | "km" | "percentage" | "not_applicable" | null;
  assetUsageReading: number | null;
};

export type AdminCaptureTargetIdentity = {
  ownerUserId: string | null;
  assetId: string | null;
  fuelStorageId: string | null;
};

type TargetRow = QueryResultRow & {
  target_type: "asset" | "fuel_storage";
  owner_user_id: string;
  owner_display_name: string | null;
  target_id: string;
  target_display_name: string | null;
  reference: string | null;
  meta: string | null;
  asset_kind?: string | null;
  asset_hours?: unknown;
  asset_life_worked_percent?: unknown;
  asset_specs_json?: unknown;
};

function normaliseSearch(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f%_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function rowToTarget(row: TargetRow): AdminCaptureTarget {
  const usage = row.target_type === "asset"
    ? resolveAssetUsage({
        kind: row.asset_kind,
        hours: row.asset_hours,
        lifeWorkedPercent: row.asset_life_worked_percent,
        specsJson: row.asset_specs_json,
      })
    : null;
  return {
    targetType: row.target_type,
    ownerUserId: String(row.owner_user_id),
    ownerDisplayName: String(row.owner_display_name ?? "Asset owner").trim() || "Asset owner",
    targetId: String(row.target_id),
    targetDisplayName: String(row.target_display_name ?? "Saved asset").trim() || "Saved asset",
    reference: String(row.reference ?? "").trim(),
    meta: String(row.meta ?? "").trim(),
    assetUsageMetric: usage?.metric ?? null,
    assetUsageReading: usage?.value ?? null,
  };
}

export function adminCaptureTargetKey(
  input: AdminCaptureTargetIdentity,
): string | null {
  const ownerUserId = String(input.ownerUserId ?? "").trim();
  const assetId = String(input.assetId ?? "").trim();
  const fuelStorageId = String(input.fuelStorageId ?? "").trim();
  if (!ownerUserId || Boolean(assetId) === Boolean(fuelStorageId)) return null;
  return assetId
    ? `${ownerUserId}|asset|${assetId}`
    : `${ownerUserId}|fuel_storage|${fuelStorageId}`;
}

export async function getAdminCaptureTargets(
  inputs: readonly AdminCaptureTargetIdentity[],
): Promise<Map<string, AdminCaptureTarget>> {
  const assetInputs = new Map<string, { ownerUserId: string; targetId: string }>();
  const storageInputs = new Map<string, { ownerUserId: string; targetId: string }>();

  for (const input of inputs) {
    const key = adminCaptureTargetKey(input);
    if (!key) continue;
    const ownerUserId = String(input.ownerUserId).trim();
    const assetId = String(input.assetId ?? "").trim();
    const fuelStorageId = String(input.fuelStorageId ?? "").trim();
    if (assetId) {
      assetInputs.set(key, { ownerUserId, targetId: assetId });
    } else {
      storageInputs.set(key, { ownerUserId, targetId: fuelStorageId });
    }
  }

  const assetValues = [...assetInputs.values()];
  const storageValues = [...storageInputs.values()];
  const [assetResult, storageResult] = await Promise.all([
    assetValues.length
      ? getDb().query<TargetRow>(
          `
            with requested(owner_user_id, target_id) as (
              select * from unnest($1::text[], $2::text[])
            )
            select
              'asset'::text as target_type,
              asset.user_id as owner_user_id,
              coalesce(
                nullif(profile.business_name, ''),
                nullif(profile.display_name, ''),
                nullif(auth_user.name, ''),
                nullif(auth_user.email, ''),
                nullif(to_jsonb(profile)->>'email', ''),
                'Asset owner'
              ) as owner_display_name,
              asset.id::text as target_id,
              coalesce(nullif(asset.title, ''), nullif(asset.model_name, ''), 'Saved asset') as target_display_name,
              coalesce(
                nullif(to_jsonb(asset)->>'public_asset_code', ''),
                nullif(to_jsonb(asset)->>'serial_number', ''),
                nullif(to_jsonb(asset)->>'serial', ''),
                nullif(to_jsonb(asset)->>'vin', ''),
                nullif(to_jsonb(asset)->>'serialNumber', ''),
                nullif(to_jsonb(asset)->>'plate_label', ''),
                ''
              ) as reference,
              concat_ws(' · ',
                nullif(asset.brand_name, ''),
                nullif(asset.model_name, ''),
                nullif(to_jsonb(asset)->>'serial_number', ''),
                nullif(to_jsonb(asset)->>'serial', ''),
                nullif(to_jsonb(asset)->>'vin', ''),
                nullif(to_jsonb(asset)->>'serialNumber', ''),
                nullif(to_jsonb(asset)->>'plate_label', '')
              ) as meta,
              asset.kind as asset_kind,
              asset.hours as asset_hours,
              asset.life_worked_percent as asset_life_worked_percent,
              asset.specs_json as asset_specs_json
            from requested
            join public.asset_register_items asset
              on asset.id::text = requested.target_id
             and asset.user_id::text = requested.owner_user_id
            left join public.account_profiles profile on profile.user_id = asset.user_id
            left join public."user" auth_user on auth_user.id = asset.user_id
          `,
          [assetValues.map((entry) => entry.ownerUserId), assetValues.map((entry) => entry.targetId)],
        )
      : Promise.resolve({ rows: [] as TargetRow[] }),
    storageValues.length
      ? getDb().query<TargetRow>(
          `
            with requested(owner_user_id, target_id) as (
              select * from unnest($1::text[], $2::text[])
            )
            select
              'fuel_storage'::text as target_type,
              storage.user_id as owner_user_id,
              coalesce(
                nullif(profile.business_name, ''),
                nullif(profile.display_name, ''),
                nullif(auth_user.name, ''),
                nullif(auth_user.email, ''),
                nullif(to_jsonb(profile)->>'email', ''),
                'Asset owner'
              ) as owner_display_name,
              storage.id::text as target_id,
              coalesce(nullif(storage.name, ''), 'Fuel storage') as target_display_name,
              coalesce(nullif(storage.public_fuel_storage_code, ''), '') as reference,
              concat_ws(' · ', nullif(storage.fuel_type, ''), nullif(storage.location_label, '')) as meta
            from requested
            join public.fuel_storage_units storage
              on storage.id::text = requested.target_id
             and storage.user_id::text = requested.owner_user_id
             and storage.status = 'active'
            left join public.account_profiles profile on profile.user_id = storage.user_id
            left join public."user" auth_user on auth_user.id = storage.user_id
          `,
          [storageValues.map((entry) => entry.ownerUserId), storageValues.map((entry) => entry.targetId)],
        )
      : Promise.resolve({ rows: [] as TargetRow[] }),
  ]);

  const targets = new Map<string, AdminCaptureTarget>();
  for (const row of [...assetResult.rows, ...storageResult.rows]) {
    const target = rowToTarget(row);
    const key = adminCaptureTargetKey({
      ownerUserId: target.ownerUserId,
      assetId: target.targetType === "asset" ? target.targetId : null,
      fuelStorageId: target.targetType === "fuel_storage" ? target.targetId : null,
    });
    if (key) targets.set(key, target);
  }
  return targets;
}

export async function getAdminCaptureTarget(
  input: AdminCaptureTargetIdentity,
): Promise<AdminCaptureTarget | null> {
  const key = adminCaptureTargetKey(input);
  if (!key) return null;
  return (await getAdminCaptureTargets([input])).get(key) ?? null;
}

export async function searchAdminCaptureTargets(input: {
  query: unknown;
  requestType: CaptureRequestType;
  limit?: number;
}): Promise<AdminCaptureTarget[]> {
  const search = normaliseSearch(input.query);
  if (search.length < 2) return [];
  const limit = Math.min(30, Math.max(1, Math.trunc(Number(input.limit) || 20)));
  const pattern = `%${search}%`;

  const assetResult = await getDb().query<TargetRow>(
    `
      select
        'asset'::text as target_type,
        asset.user_id as owner_user_id,
        coalesce(
          nullif(profile.business_name, ''),
          nullif(profile.display_name, ''),
          nullif(auth_user.name, ''),
          nullif(auth_user.email, ''),
          nullif(to_jsonb(profile)->>'email', ''),
          'Asset owner'
        ) as owner_display_name,
        asset.id::text as target_id,
        coalesce(nullif(asset.title, ''), nullif(asset.model_name, ''), 'Saved asset') as target_display_name,
        coalesce(
          nullif(to_jsonb(asset)->>'public_asset_code', ''),
          nullif(to_jsonb(asset)->>'serial_number', ''),
          nullif(to_jsonb(asset)->>'serial', ''),
          nullif(to_jsonb(asset)->>'vin', ''),
          nullif(to_jsonb(asset)->>'serialNumber', ''),
          nullif(to_jsonb(asset)->>'plate_label', ''),
          ''
        ) as reference,
        concat_ws(' · ',
          nullif(asset.brand_name, ''),
          nullif(asset.model_name, ''),
          nullif(to_jsonb(asset)->>'serial_number', ''),
          nullif(to_jsonb(asset)->>'serial', ''),
          nullif(to_jsonb(asset)->>'vin', ''),
          nullif(to_jsonb(asset)->>'serialNumber', ''),
          nullif(to_jsonb(asset)->>'plate_label', '')
        ) as meta,
        asset.kind as asset_kind,
        asset.hours as asset_hours,
        asset.life_worked_percent as asset_life_worked_percent,
        asset.specs_json as asset_specs_json
      from public.asset_register_items asset
      left join public.account_profiles profile on profile.user_id = asset.user_id
      left join public."user" auth_user on auth_user.id = asset.user_id
      where lower(concat_ws(' ',
        coalesce(profile.business_name, ''),
        coalesce(profile.display_name, ''),
        coalesce(auth_user.name, ''),
        coalesce(auth_user.email, ''),
        coalesce(to_jsonb(profile)->>'email', ''),
        coalesce(asset.title, ''),
        coalesce(asset.brand_name, ''),
        coalesce(asset.model_name, ''),
        coalesce(to_jsonb(asset)->>'public_asset_code', ''),
        coalesce(to_jsonb(asset)->>'serial_number', ''),
        coalesce(to_jsonb(asset)->>'serial', ''),
        coalesce(to_jsonb(asset)->>'vin', ''),
        coalesce(to_jsonb(asset)->>'serialNumber', ''),
        coalesce(to_jsonb(asset)->>'plate_label', '')
      )) like lower($1)
      order by
        case when lower($2) in (
          lower(coalesce(to_jsonb(asset)->>'public_asset_code', '')),
          lower(coalesce(to_jsonb(asset)->>'serial_number', '')),
          lower(coalesce(to_jsonb(asset)->>'serial', '')),
          lower(coalesce(to_jsonb(asset)->>'vin', '')),
          lower(coalesce(to_jsonb(asset)->>'serialNumber', '')),
          lower(coalesce(to_jsonb(asset)->>'plate_label', ''))
        ) then 0 else 1 end,
        owner_display_name asc,
        target_display_name asc
      limit $3
    `,
    [pattern, search, limit],
  );
  const targets = assetResult.rows.map(rowToTarget);

  if (input.requestType !== "fuel_slip" || targets.length >= limit) {
    return targets.slice(0, limit);
  }

  const storageResult = await getDb().query<TargetRow>(
    `
      select
        'fuel_storage'::text as target_type,
        storage.user_id as owner_user_id,
        coalesce(
          nullif(profile.business_name, ''),
          nullif(profile.display_name, ''),
          nullif(auth_user.name, ''),
          nullif(auth_user.email, ''),
          nullif(to_jsonb(profile)->>'email', ''),
          'Asset owner'
        ) as owner_display_name,
        storage.id::text as target_id,
        coalesce(nullif(storage.name, ''), 'Fuel storage') as target_display_name,
        coalesce(nullif(storage.public_fuel_storage_code, ''), '') as reference,
        concat_ws(' · ', nullif(storage.fuel_type, ''), nullif(storage.location_label, '')) as meta
      from public.fuel_storage_units storage
      left join public.account_profiles profile on profile.user_id = storage.user_id
      left join public."user" auth_user on auth_user.id = storage.user_id
      where storage.status = 'active'
        and lower(concat_ws(' ',
          coalesce(profile.business_name, ''),
          coalesce(profile.display_name, ''),
          coalesce(auth_user.name, ''),
          coalesce(auth_user.email, ''),
          coalesce(to_jsonb(profile)->>'email', ''),
          coalesce(storage.name, ''),
          coalesce(storage.public_fuel_storage_code, ''),
          coalesce(storage.location_label, '')
        )) like lower($1)
      order by owner_display_name asc, target_display_name asc
      limit $2
    `,
    [pattern, limit - targets.length],
  );

  return [...targets, ...storageResult.rows.map(rowToTarget)].slice(0, limit);
}
