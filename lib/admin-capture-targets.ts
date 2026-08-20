import type { QueryResultRow } from "pg";
import { getDb } from "./db";
import type { CaptureRequestType } from "./capture-requests";

export type AdminCaptureTarget = {
  targetType: "asset" | "fuel_storage";
  ownerUserId: string;
  ownerDisplayName: string;
  targetId: string;
  targetDisplayName: string;
  reference: string;
  meta: string;
};

type TargetRow = QueryResultRow & {
  target_type: "asset" | "fuel_storage";
  owner_user_id: string;
  owner_display_name: string | null;
  target_id: string;
  target_display_name: string | null;
  reference: string | null;
  meta: string | null;
};

function normaliseSearch(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f%_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function rowToTarget(row: TargetRow): AdminCaptureTarget {
  return {
    targetType: row.target_type,
    ownerUserId: String(row.owner_user_id),
    ownerDisplayName: String(row.owner_display_name ?? "Asset owner").trim() || "Asset owner",
    targetId: String(row.target_id),
    targetDisplayName: String(row.target_display_name ?? "Saved asset").trim() || "Saved asset",
    reference: String(row.reference ?? "").trim(),
    meta: String(row.meta ?? "").trim(),
  };
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
          nullif(to_jsonb(profile)->>'email', ''),
          'Asset owner'
        ) as owner_display_name,
        asset.id::text as target_id,
        coalesce(nullif(asset.title, ''), nullif(asset.model_name, ''), 'Saved asset') as target_display_name,
        coalesce(
          nullif(to_jsonb(asset)->>'public_asset_code', ''),
          nullif(to_jsonb(asset)->>'serial_number', ''),
          nullif(to_jsonb(asset)->>'plate_label', ''),
          ''
        ) as reference,
        concat_ws(' · ',
          nullif(asset.brand_name, ''),
          nullif(asset.model_name, ''),
          nullif(to_jsonb(asset)->>'serial_number', ''),
          nullif(to_jsonb(asset)->>'plate_label', '')
        ) as meta
      from public.asset_register_items asset
      left join public.account_profiles profile on profile.user_id = asset.user_id
      where lower(concat_ws(' ',
        coalesce(profile.business_name, ''),
        coalesce(profile.display_name, ''),
        coalesce(to_jsonb(profile)->>'email', ''),
        coalesce(asset.title, ''),
        coalesce(asset.brand_name, ''),
        coalesce(asset.model_name, ''),
        coalesce(to_jsonb(asset)->>'public_asset_code', ''),
        coalesce(to_jsonb(asset)->>'serial_number', ''),
        coalesce(to_jsonb(asset)->>'plate_label', '')
      )) like lower($1)
      order by
        case when lower(coalesce(to_jsonb(asset)->>'public_asset_code', '')) = lower($2) then 0 else 1 end,
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
          nullif(to_jsonb(profile)->>'email', ''),
          'Asset owner'
        ) as owner_display_name,
        storage.id::text as target_id,
        coalesce(nullif(storage.name, ''), 'Fuel storage') as target_display_name,
        coalesce(nullif(storage.public_fuel_storage_code, ''), '') as reference,
        concat_ws(' · ', nullif(storage.fuel_type, ''), nullif(storage.location_label, '')) as meta
      from public.fuel_storage_units storage
      left join public.account_profiles profile on profile.user_id = storage.user_id
      where storage.status = 'active'
        and lower(concat_ws(' ',
          coalesce(profile.business_name, ''),
          coalesce(profile.display_name, ''),
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
