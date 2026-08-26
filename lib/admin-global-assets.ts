import { ensureAccountProfileColumns } from "./account-profile";
import { ensureAssetRegisterTables } from "./asset-registers";
import {
  ADMIN_DISCOVERY_PAGE_SIZES,
  hasAdminAssetCoordinates,
  type AdminAssetFilterOption,
  type AdminAssetInterestFilter,
  type AdminAssetLocationFilter,
  type AdminAssetMapReport,
  type AdminAssetParticipationFilter,
  type AdminAssetSort,
  type AdminDiscoveryFilters,
  type AdminDiscoveryReport,
  type AdminGlobalAsset,
  type AdminGlobalAssetOptions,
  type AdminGlobalAssetSummary,
} from "./admin-global-assets-shared";
import { getDb } from "./db";
import { ensureAssetDiscoveryViewTracking } from "./discovery-views";

type DatabaseValue = string | number | boolean | Date | null | undefined;

type AdminGlobalAssetRow = {
  asset_id: DatabaseValue;
  owner_user_id: DatabaseValue;
  register_id: DatabaseValue;
  register_label: DatabaseValue;
  title: DatabaseValue;
  kind: DatabaseValue;
  asset_type_label: DatabaseValue;
  sector_key: DatabaseValue;
  sector_label: DatabaseValue;
  asset_value: DatabaseValue;
  has_saved_value: DatabaseValue;
  selected_method: DatabaseValue;
  brand_name: DatabaseValue;
  model_name: DatabaseValue;
  typed_model_name: DatabaseValue;
  year_model: DatabaseValue;
  hours: DatabaseValue;
  life_worked_percent: DatabaseValue;
  usage_metric: DatabaseValue;
  condition: DatabaseValue;
  serial_number: DatabaseValue;
  registration_number: DatabaseValue;
  public_asset_code: DatabaseValue;
  plate_label: DatabaseValue;
  qr_status: DatabaseValue;
  lifecycle_state: DatabaseValue;
  last_scanned_at: DatabaseValue;
  last_known_lat: DatabaseValue;
  last_known_lng: DatabaseValue;
  last_known_location_text: DatabaseValue;
  created_at: DatabaseValue;
  updated_at: DatabaseValue;
  owner_label: DatabaseValue;
  owner_name: DatabaseValue;
  owner_business_name: DatabaseValue;
  owner_email: DatabaseValue;
  owner_phone: DatabaseValue;
  owner_account_type: DatabaseValue;
  owner_account_subtype: DatabaseValue;
  owner_account_status: DatabaseValue;
  owner_province: DatabaseValue;
  owner_town_city: DatabaseValue;
  owner_address_line_1: DatabaseValue;
  owner_address_line_2: DatabaseValue;
  discovery_participation_enabled: DatabaseValue;
  total_views: DatabaseValue;
  account_views: DatabaseValue;
  unknown_views: DatabaseValue;
  unique_viewers: DatabaseValue;
  last_viewed_at: DatabaseValue;
  repeat_viewer_views: DatabaseValue;
  repeat_viewer_label: DatabaseValue;
  repeat_viewer_account_type: DatabaseValue;
  repeat_viewer_last_viewed_at: DatabaseValue;
  has_repeat_interest: DatabaseValue;
};

type SummaryRow = {
  total_assets: DatabaseValue;
  mapped_assets: DatabaseValue;
  owner_accounts: DatabaseValue;
  total_value_ex_vat: DatabaseValue;
  valued_assets: DatabaseValue;
  discovery_enabled_assets: DatabaseValue;
  total_views: DatabaseValue;
  account_views: DatabaseValue;
  unknown_views: DatabaseValue;
  viewed_assets: DatabaseValue;
  repeat_interest_assets: DatabaseValue;
};

type OptionRow = {
  option_group: DatabaseValue;
  value: DatabaseValue;
  label: DatabaseValue;
  count: DatabaseValue;
};

const SAFE_LATITUDE_SQL = `(case
  when nullif(to_jsonb(asset)->>'last_known_lat', '') ~ '^[-+]?[0-9]+([.][0-9]+)?$'
    then (to_jsonb(asset)->>'last_known_lat')::double precision
  else null
end)`;
const SAFE_LONGITUDE_SQL = `(case
  when nullif(to_jsonb(asset)->>'last_known_lng', '') ~ '^[-+]?[0-9]+([.][0-9]+)?$'
    then (to_jsonb(asset)->>'last_known_lng')::double precision
  else null
end)`;

const ADMIN_ASSET_CURRENT_VALUE_SOURCES = [
  "to_jsonb(asset)->>'selected_value_ex_vat'",
  "to_jsonb(asset)->>'value'",
  "to_jsonb(asset)->>'selected_value'",
  "to_jsonb(asset)->>'saved_value_ex_vat'",
  "to_jsonb(asset)->>'saved_value'",
  "to_jsonb(asset)->>'current_value'",
  "to_jsonb(asset)->>'currentValue'",
  "to_jsonb(asset)->>'value_ex_vat'",
  "to_jsonb(asset)->>'opening_value'",
  "to_jsonb(asset)->>'valuation_amount'",
  "to_jsonb(asset)->>'manual_value'",
  "to_jsonb(asset)->>'manual_value_ex_vat'",
  "to_jsonb(asset)->>'aim4price_value_ex_vat'",
  "to_jsonb(asset)->>'aim4price_value'",
  "to_jsonb(asset)->'specs_json'->>'selectedValueExVat'",
  "to_jsonb(asset)->'specs_json'->>'selected_value_ex_vat'",
  "to_jsonb(asset)->'specs_json'->>'currentValueExVat'",
  "to_jsonb(asset)->'specs_json'->>'current_value_ex_vat'",
  "to_jsonb(asset)->'specs_json'->>'currentValue'",
  "to_jsonb(asset)->'specs_json'->>'current_value'",
  "to_jsonb(asset)->'specs_json'->>'valueExVat'",
  "to_jsonb(asset)->'specs_json'->>'value_ex_vat'",
  "to_jsonb(asset)->'specs_json'->>'value'",
  "to_jsonb(asset)->'specs_json'->>'manualValueExVat'",
  "to_jsonb(asset)->'specs_json'->>'manual_value_ex_vat'",
  "to_jsonb(asset)->'specs_json'->>'manualValue'",
  "to_jsonb(asset)->'specs_json'->>'manual_value'",
  "to_jsonb(asset)->'specs_json'->>'valuationValueExVat'",
  "to_jsonb(asset)->'specs_json'->>'valuation_value_ex_vat'",
  "to_jsonb(asset)->'specs_json'->>'valuationValue'",
  "to_jsonb(asset)->'specs_json'->>'valuation_value'",
  "to_jsonb(valuation)->>'selected_value_ex_vat'",
  "to_jsonb(valuation)->>'valuation_mid_ex_vat'",
  "to_jsonb(valuation)->>'aim4price_value_ex_vat'",
  "to_jsonb(valuation)->>'aim4price_value'",
] as const;

function safePositiveMoneySql(source: string): string {
  const normalized = `nullif(regexp_replace(coalesce(${source}, ''), '[^0-9.-]', '', 'g'), '')`;
  return `(case
    when ${normalized} ~ '^[0-9]+([.][0-9]+)?$'
      then nullif(greatest((${normalized})::numeric, 0), 0)
    else null
  end)`;
}

const ADMIN_ASSET_CURRENT_VALUE_SQL = `coalesce(
  ${ADMIN_ASSET_CURRENT_VALUE_SOURCES.map(safePositiveMoneySql).join(",\n  ")}
)`;

const ADMIN_GLOBAL_ASSET_CTE = `
  with admin_asset_rows as (
    select
      asset.id::text as asset_id,
      asset.user_id::text as owner_user_id,
      coalesce(asset_register.id::text, '') as register_id,
      coalesce(
        nullif(trim(asset_register.business_name), ''),
        nullif(trim(profile.business_name), ''),
        nullif(trim(profile.display_name), ''),
        nullif(trim(auth_user.name), ''),
        nullif(trim(auth_user.email), ''),
        'Unlabelled register'
      ) as register_label,
      coalesce(nullif(trim(asset.title), ''), 'Saved asset') as title,
      coalesce(nullif(trim(asset.kind), ''), 'asset') as kind,
      coalesce(nullif(trim(family.family_label), ''), nullif(trim(asset.kind), ''), 'Asset')
        as asset_type_label,
      coalesce(nullif(trim(sector.sector_key), ''), 'uncategorised') as sector_key,
      coalesce(nullif(trim(sector.sector_label), ''), 'Uncategorised') as sector_label,
      ${ADMIN_ASSET_CURRENT_VALUE_SQL} as saved_asset_value,
      coalesce(nullif(trim(asset.selected_method), ''), 'manual') as selected_method,
      coalesce(
        nullif(trim(asset.brand_name), ''),
        nullif(trim(brand.name), ''),
        nullif(trim(coalesce(asset.specs_json, '{}'::jsonb)->>'brandName'), ''),
        nullif(trim(coalesce(asset.specs_json, '{}'::jsonb)->>'brand_name'), ''),
        ''
      ) as brand_name,
      coalesce(
        nullif(trim(asset.model_name), ''),
        nullif(trim(model.model_name), ''),
        nullif(trim(model.display_name), ''),
        nullif(trim(asset.typed_model_name), ''),
        nullif(trim(coalesce(asset.specs_json, '{}'::jsonb)->>'modelName'), ''),
        nullif(trim(coalesce(asset.specs_json, '{}'::jsonb)->>'model_name'), ''),
        ''
      ) as model_name,
      coalesce(asset.typed_model_name, '') as typed_model_name,
      asset.year_model,
      asset.hours,
      asset.life_worked_percent,
      coalesce(nullif(trim(family.usage_metric_type), ''), '') as usage_metric,
      coalesce(asset.condition, '') as condition,
      coalesce(asset.serial_number, '') as serial_number,
      coalesce(asset.license_registration_number, '') as registration_number,
      coalesce(asset.public_asset_code, '') as public_asset_code,
      coalesce(asset.plate_label, '') as plate_label,
      coalesce(nullif(trim(to_jsonb(asset)->>'qr_status'), ''), 'active') as qr_status,
      coalesce(nullif(trim(to_jsonb(asset)->>'lifecycle_state'), ''), 'active') as lifecycle_state,
      nullif(to_jsonb(asset)->>'last_scanned_at', '') as last_scanned_at,
      ${SAFE_LATITUDE_SQL} as last_known_lat,
      ${SAFE_LONGITUDE_SQL} as last_known_lng,
      coalesce(to_jsonb(asset)->>'last_known_location_text', '') as last_known_location_text,
      nullif(to_jsonb(asset)->>'created_at', '') as created_at,
      nullif(to_jsonb(asset)->>'updated_at', '') as updated_at,
      coalesce(
        nullif(trim(profile.business_name), ''),
        nullif(trim(profile.display_name), ''),
        nullif(trim(auth_user.name), ''),
        nullif(trim(auth_user.email), ''),
        asset.user_id::text
      ) as owner_label,
      coalesce(nullif(trim(profile.display_name), ''), nullif(trim(auth_user.name), ''), '')
        as owner_name,
      coalesce(profile.business_name, '') as owner_business_name,
      coalesce(
        nullif(trim(profile.marketplace_email), ''),
        nullif(trim(auth_user.email), ''),
        ''
      ) as owner_email,
      coalesce(nullif(trim(profile.phone), ''), nullif(trim(profile.marketplace_phone), ''), '')
        as owner_phone,
      coalesce(nullif(trim(profile.account_type), ''), 'owner') as owner_account_type,
      coalesce(nullif(trim(profile.account_subtype), ''), '') as owner_account_subtype,
      coalesce(nullif(trim(profile.account_status), ''), 'unknown') as owner_account_status,
      coalesce(profile.province, '') as owner_province,
      coalesce(profile.town_city, '') as owner_town_city,
      coalesce(profile.address_line_1, '') as owner_address_line_1,
      coalesce(profile.address_line_2, '') as owner_address_line_2,
      coalesce(profile.discovery_participation_enabled, false)
        as discovery_participation_enabled
    from public.asset_register_items asset
    left join public.asset_registers asset_register on asset_register.id = asset.register_id
    left join public.valuation_runs valuation
      on valuation.id::text = nullif(to_jsonb(asset)->>'valuation_run_id', '')
    left join public.account_profiles profile on profile.user_id = asset.user_id
    left join public."user" auth_user on auth_user.id = asset.user_id
    left join public.equipment_families family on family.id = asset.equipment_family_id
    left join public.equipment_models model on model.id = asset.equipment_model_id
    left join public.brands brand on brand.id = model.brand_id
    left join public.sectors sector on sector.id = coalesce(asset.sector_id, family.sector_id)
    where coalesce(
      nullif(trim(to_jsonb(asset)->>'lifecycle_state'), ''),
      'active'
    ) in ('active', 'transfer_pending')
  ), admin_assets as (
    select
      admin_asset_rows.*,
      greatest(coalesce(saved_asset_value, 0), 0)::numeric as asset_value,
      (saved_asset_value is not null) as has_saved_value,
      (
        last_known_lat between -90 and 90
        and last_known_lng between -180 and 180
        and not (last_known_lat = 0 and last_known_lng = 0)
      ) as has_location
    from admin_asset_rows
  )
`;

const ADMIN_DISCOVERY_ASSET_CTE = `
  ${ADMIN_GLOBAL_ASSET_CTE},
  discovery_viewer_counts as (
    select
      view.asset_register_item_id::text as asset_id,
      view.viewer_user_id,
      view.anonymous_viewer_hash,
      coalesce(
        nullif(profile.business_name, ''),
        nullif(profile.display_name, ''),
        nullif(auth_user.name, ''),
        nullif(auth_user.email, ''),
        case
          when view.viewer_user_id is null then
            'Unknown viewer ' || upper(left(coalesce(view.anonymous_viewer_hash, ''), 6))
          else 'Aim4price account'
        end
      ) as viewer_label,
      coalesce(nullif(profile.account_type, ''), '') as viewer_account_type,
      count(*)::bigint as view_count,
      min(view.viewed_at) as first_viewed_at,
      max(view.viewed_at) as last_viewed_at
    from public.asset_discovery_views view
    left join public.account_profiles profile on profile.user_id = view.viewer_user_id
    left join public."user" auth_user on auth_user.id = view.viewer_user_id
    group by
      view.asset_register_item_id,
      view.viewer_user_id,
      view.anonymous_viewer_hash,
      profile.business_name,
      profile.display_name,
      profile.account_type,
      auth_user.name,
      auth_user.email
  ), discovery_view_metrics as (
    select
      asset_id,
      coalesce(sum(view_count), 0)::bigint as total_views,
      coalesce(sum(view_count) filter (where viewer_user_id is not null), 0)::bigint
        as account_views,
      coalesce(sum(view_count) filter (where viewer_user_id is null), 0)::bigint
        as unknown_views,
      count(*)::bigint as unique_viewers,
      max(last_viewed_at) as last_viewed_at,
      coalesce(max(view_count), 0)::bigint as repeat_viewer_views,
      (array_agg(viewer_label order by view_count desc, last_viewed_at desc))[1]
        as repeat_viewer_label,
      (array_agg(viewer_account_type order by view_count desc, last_viewed_at desc))[1]
        as repeat_viewer_account_type,
      (array_agg(last_viewed_at order by view_count desc, last_viewed_at desc))[1]
        as repeat_viewer_last_viewed_at,
      bool_or(view_count >= 3) as has_repeat_interest
    from discovery_viewer_counts
    group by asset_id
  ), discovery_assets as (
    select
      admin_assets.*,
      coalesce(view_metrics.total_views, 0)::bigint as total_views,
      coalesce(view_metrics.account_views, 0)::bigint as account_views,
      coalesce(view_metrics.unknown_views, 0)::bigint as unknown_views,
      coalesce(view_metrics.unique_viewers, 0)::bigint as unique_viewers,
      view_metrics.last_viewed_at,
      coalesce(view_metrics.repeat_viewer_views, 0)::bigint as repeat_viewer_views,
      coalesce(view_metrics.repeat_viewer_label, '') as repeat_viewer_label,
      coalesce(view_metrics.repeat_viewer_account_type, '') as repeat_viewer_account_type,
      view_metrics.repeat_viewer_last_viewed_at,
      coalesce(view_metrics.has_repeat_interest, false) as has_repeat_interest
    from admin_assets
    left join discovery_view_metrics view_metrics
      on view_metrics.asset_id = admin_assets.asset_id
  )
`;

const EMPTY_OPTIONS: AdminGlobalAssetOptions = {
  owners: [],
  provinces: [],
  sectors: [],
  lifecycleStates: [],
};

function text(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function number(value: DatabaseValue): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: DatabaseValue): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boolean(value: DatabaseValue): boolean {
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "on"].includes(text(value).toLowerCase());
}

function iso(value: DatabaseValue): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function mapAsset(row: AdminGlobalAssetRow): AdminGlobalAsset {
  const kind = text(row.kind) || "asset";
  const ownerUserId = text(row.owner_user_id);
  return {
    id: text(row.asset_id),
    ownerUserId,
    registerId: text(row.register_id),
    registerLabel: text(row.register_label) || "Unlabelled register",
    title: text(row.title) || "Saved asset",
    kind,
    assetTypeLabel: text(row.asset_type_label) || titleCase(kind) || "Asset",
    sectorKey: text(row.sector_key) || "uncategorised",
    sectorLabel: text(row.sector_label) || "Uncategorised",
    value: Math.max(0, number(row.asset_value)),
    hasSavedValue: boolean(row.has_saved_value),
    selectedMethod: text(row.selected_method) || "manual",
    brandName: text(row.brand_name),
    modelName: text(row.model_name),
    typedModelName: text(row.typed_model_name),
    yearModel: nullableNumber(row.year_model),
    hours: nullableNumber(row.hours),
    lifeWorkedPercent: nullableNumber(row.life_worked_percent),
    usageMetric: text(row.usage_metric),
    condition: text(row.condition),
    serialNumber: text(row.serial_number),
    registrationNumber: text(row.registration_number),
    publicAssetCode: text(row.public_asset_code),
    plateLabel: text(row.plate_label),
    qrStatus: text(row.qr_status) || "active",
    lifecycleState: text(row.lifecycle_state) || "active",
    lastScannedAtIso: iso(row.last_scanned_at),
    lastKnownLat: nullableNumber(row.last_known_lat),
    lastKnownLng: nullableNumber(row.last_known_lng),
    lastKnownLocationText: text(row.last_known_location_text),
    createdAtIso: iso(row.created_at),
    updatedAtIso: iso(row.updated_at),
    totalViews: Math.max(0, Math.round(number(row.total_views))),
    accountViews: Math.max(0, Math.round(number(row.account_views))),
    unknownViews: Math.max(0, Math.round(number(row.unknown_views))),
    uniqueViewers: Math.max(0, Math.round(number(row.unique_viewers))),
    lastViewedAtIso: iso(row.last_viewed_at),
    repeatViewerViews: Math.max(0, Math.round(number(row.repeat_viewer_views))),
    repeatViewerLabel: text(row.repeat_viewer_label),
    repeatViewerAccountType: text(row.repeat_viewer_account_type),
    repeatViewerLastViewedAtIso: iso(row.repeat_viewer_last_viewed_at),
    hasRepeatInterest: boolean(row.has_repeat_interest),
    owner: {
      userId: ownerUserId,
      label: text(row.owner_label) || "Unknown account",
      name: text(row.owner_name),
      businessName: text(row.owner_business_name),
      email: text(row.owner_email),
      phone: text(row.owner_phone),
      accountType: text(row.owner_account_type) || "owner",
      accountSubtype: text(row.owner_account_subtype),
      accountStatus: text(row.owner_account_status) || "unknown",
      province: text(row.owner_province),
      townCity: text(row.owner_town_city),
      addressLine1: text(row.owner_address_line_1),
      addressLine2: text(row.owner_address_line_2),
      discoveryParticipationEnabled: boolean(row.discovery_participation_enabled),
    },
  };
}

function summarizeAssets(assets: AdminGlobalAsset[]): AdminGlobalAssetSummary {
  const mappedAssets = assets.filter(hasAdminAssetCoordinates).length;
  const valuedAssets = assets.filter((asset) => asset.hasSavedValue).length;
  return {
    totalAssets: assets.length,
    mappedAssets,
    missingLocationAssets: Math.max(0, assets.length - mappedAssets),
    ownerAccounts: new Set(assets.map((asset) => asset.ownerUserId)).size,
    totalValueExVat: assets.reduce((total, asset) => total + Math.max(0, asset.value), 0),
    valuedAssets,
    missingValueAssets: Math.max(0, assets.length - valuedAssets),
    discoveryEnabledAssets: assets.filter(
      (asset) => asset.owner.discoveryParticipationEnabled,
    ).length,
    discoveryDisabledAssets: assets.filter(
      (asset) => !asset.owner.discoveryParticipationEnabled,
    ).length,
    totalViews: assets.reduce((total, asset) => total + asset.totalViews, 0),
    accountViews: assets.reduce((total, asset) => total + asset.accountViews, 0),
    unknownViews: assets.reduce((total, asset) => total + asset.unknownViews, 0),
    viewedAssets: assets.filter((asset) => asset.totalViews > 0).length,
    repeatInterestAssets: assets.filter((asset) => asset.hasRepeatInterest).length,
  };
}

function optionFromMap(values: Map<string, { label: string; count: number }>): AdminAssetFilterOption[] {
  return Array.from(values, ([value, entry]) => ({
    value,
    label: entry.label,
    count: entry.count,
  })).sort((left, right) =>
    left.label.localeCompare(right.label, "en-ZA", { sensitivity: "base" }),
  );
}

function optionsFromAssets(assets: AdminGlobalAsset[]): AdminGlobalAssetOptions {
  const owners = new Map<string, { label: string; count: number }>();
  const provinces = new Map<string, { label: string; count: number }>();
  const sectors = new Map<string, { label: string; count: number }>();
  const lifecycleStates = new Map<string, { label: string; count: number }>();

  for (const asset of assets) {
    const owner = owners.get(asset.ownerUserId);
    owners.set(asset.ownerUserId, {
      label: asset.owner.label,
      count: (owner?.count ?? 0) + 1,
    });

    const provinceValue = asset.owner.province || "__not_saved__";
    const province = provinces.get(provinceValue);
    provinces.set(provinceValue, {
      label: asset.owner.province || "Province not saved",
      count: (province?.count ?? 0) + 1,
    });

    const sector = sectors.get(asset.sectorKey);
    sectors.set(asset.sectorKey, {
      label: asset.sectorLabel,
      count: (sector?.count ?? 0) + 1,
    });

    const lifecycleValue = asset.lifecycleState || "active";
    const lifecycle = lifecycleStates.get(lifecycleValue);
    lifecycleStates.set(lifecycleValue, {
      label: titleCase(lifecycleValue),
      count: (lifecycle?.count ?? 0) + 1,
    });
  }

  return {
    owners: optionFromMap(owners),
    provinces: optionFromMap(provinces),
    sectors: optionFromMap(sectors),
    lifecycleStates: optionFromMap(lifecycleStates),
  };
}

function mapSummary(row: SummaryRow | undefined): AdminGlobalAssetSummary {
  const totalAssets = Math.max(0, number(row?.total_assets));
  const mappedAssets = Math.max(0, number(row?.mapped_assets));
  const valuedAssets = Math.max(0, number(row?.valued_assets));
  const discoveryEnabledAssets = Math.max(0, number(row?.discovery_enabled_assets));
  return {
    totalAssets,
    mappedAssets,
    missingLocationAssets: Math.max(0, totalAssets - mappedAssets),
    ownerAccounts: Math.max(0, number(row?.owner_accounts)),
    totalValueExVat: Math.max(0, number(row?.total_value_ex_vat)),
    valuedAssets,
    missingValueAssets: Math.max(0, totalAssets - valuedAssets),
    discoveryEnabledAssets,
    discoveryDisabledAssets: Math.max(0, totalAssets - discoveryEnabledAssets),
    totalViews: Math.max(0, number(row?.total_views)),
    accountViews: Math.max(0, number(row?.account_views)),
    unknownViews: Math.max(0, number(row?.unknown_views)),
    viewedAssets: Math.max(0, number(row?.viewed_assets)),
    repeatInterestAssets: Math.max(0, number(row?.repeat_interest_assets)),
  };
}

function asOption(row: OptionRow): AdminAssetFilterOption {
  return {
    value: text(row.value),
    label: text(row.label),
    count: Math.max(0, number(row.count)),
  };
}

function mapOptions(rows: OptionRow[]): AdminGlobalAssetOptions {
  const options: AdminGlobalAssetOptions = {
    owners: [],
    provinces: [],
    sectors: [],
    lifecycleStates: [],
  };
  for (const row of rows) {
    const option = asOption(row);
    if (text(row.option_group) === "owner") options.owners.push(option);
    if (text(row.option_group) === "province") options.provinces.push(option);
    if (text(row.option_group) === "sector") options.sectors.push(option);
    if (text(row.option_group) === "lifecycle") options.lifecycleStates.push(option);
  }
  return options;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function clampPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeParticipation(value: unknown): AdminAssetParticipationFilter {
  return value === "enabled" || value === "disabled" ? value : "all";
}

function normalizeLocation(value: unknown): AdminAssetLocationFilter {
  return value === "mapped" || value === "missing" ? value : "all";
}

function normalizeInterest(value: unknown): AdminAssetInterestFilter {
  return value === "viewed" || value === "repeat" || value === "unviewed"
    ? value
    : "all";
}

function normalizeSort(value: unknown): AdminAssetSort {
  return [
    "updated",
    "popular",
    "repeat-interest",
    "recent-view",
    "value-high",
    "value-low",
    "owner",
    "asset",
  ].includes(text(value))
    ? (text(value) as AdminAssetSort)
    : "updated";
}

export function normalizeAdminDiscoveryFilters(
  input: Partial<AdminDiscoveryFilters> = {},
): AdminDiscoveryFilters {
  const requestedPageSize = clampPositiveInteger(input.pageSize, 50);
  const pageSize = ADMIN_DISCOVERY_PAGE_SIZES.includes(
    requestedPageSize as (typeof ADMIN_DISCOVERY_PAGE_SIZES)[number],
  )
    ? requestedPageSize
    : 50;
  const focusAssetId = text(input.focusAssetId).slice(0, 100);
  return {
    search: text(input.search).slice(0, 200),
    ownerUserId: text(input.ownerUserId).slice(0, 200),
    province: text(input.province).slice(0, 100),
    sector: text(input.sector).slice(0, 100),
    participation: normalizeParticipation(input.participation),
    location: normalizeLocation(input.location),
    interest: normalizeInterest(input.interest),
    lifecycleState: text(input.lifecycleState).slice(0, 100),
    sort: normalizeSort(input.sort),
    page: focusAssetId ? 1 : clampPositiveInteger(input.page, 1),
    pageSize,
    focusAssetId,
  };
}

async function ensureAdminGlobalAssetSources(): Promise<void> {
  await Promise.all([ensureAssetRegisterTables(), ensureAccountProfileColumns()]);
}

export async function getAdminAssetMapReport(): Promise<AdminAssetMapReport> {
  await ensureAdminGlobalAssetSources();
  const result = await getDb().query<AdminGlobalAssetRow>(`
    ${ADMIN_GLOBAL_ASSET_CTE}
    select *
    from admin_assets
    order by updated_at desc nulls last, title asc
  `);
  const assets = result.rows.map(mapAsset);
  return {
    generatedAtIso: new Date().toISOString(),
    assets,
    summary: summarizeAssets(assets),
    options: optionsFromAssets(assets),
  };
}

function buildDiscoveryWhere(filters: AdminDiscoveryFilters): {
  whereSql: string;
  params: unknown[];
} {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    params.push(`%${escapeLike(filters.search)}%`);
    const parameter = `$${params.length}`;
    where.push(`concat_ws(' ',
      title, asset_type_label, sector_label, brand_name, model_name, typed_model_name,
      year_model::text, serial_number, registration_number, public_asset_code,
      plate_label, register_label, last_known_location_text, owner_label, owner_name,
      owner_business_name, owner_email, owner_phone, owner_province, owner_town_city,
      repeat_viewer_label, repeat_viewer_account_type
    ) ilike ${parameter} escape '\\'`);
  }
  if (filters.ownerUserId) {
    params.push(filters.ownerUserId);
    where.push(`owner_user_id = $${params.length}`);
  }
  if (filters.province === "__not_saved__") {
    where.push("nullif(trim(owner_province), '') is null");
  } else if (filters.province) {
    params.push(filters.province.toLowerCase());
    where.push(`lower(owner_province) = $${params.length}`);
  }
  if (filters.sector) {
    params.push(filters.sector.toLowerCase());
    where.push(`lower(sector_key) = $${params.length}`);
  }
  if (filters.participation === "enabled") {
    where.push("discovery_participation_enabled = true");
  } else if (filters.participation === "disabled") {
    where.push("discovery_participation_enabled = false");
  }
  if (filters.location === "mapped") {
    where.push("has_location = true");
  } else if (filters.location === "missing") {
    where.push("coalesce(has_location, false) = false");
  }
  if (filters.interest === "viewed") {
    where.push("total_views > 0");
  } else if (filters.interest === "repeat") {
    where.push("has_repeat_interest = true");
  } else if (filters.interest === "unviewed") {
    where.push("total_views = 0");
  }
  if (filters.lifecycleState) {
    params.push(filters.lifecycleState.toLowerCase());
    where.push(`lower(lifecycle_state) = $${params.length}`);
  }

  return {
    whereSql: where.length ? `where ${where.join(" and ")}` : "",
    params,
  };
}

function discoverySortSql(sort: AdminAssetSort): string {
  if (sort === "popular") return "total_views desc, last_viewed_at desc nulls last";
  if (sort === "repeat-interest") {
    return "repeat_viewer_views desc, total_views desc, last_viewed_at desc nulls last";
  }
  if (sort === "recent-view") return "last_viewed_at desc nulls last, total_views desc";
  if (sort === "value-high") return "asset_value desc, updated_at desc nulls last";
  if (sort === "value-low") return "asset_value asc, updated_at desc nulls last";
  if (sort === "owner") return "lower(owner_label) asc, lower(title) asc";
  if (sort === "asset") return "lower(title) asc, lower(owner_label) asc";
  return "updated_at desc nulls last, lower(title) asc";
}

async function getAdminGlobalAssetOptions(): Promise<AdminGlobalAssetOptions> {
  const result = await getDb().query<OptionRow>(`
    ${ADMIN_GLOBAL_ASSET_CTE}
    select 'owner'::text as option_group, owner_user_id as value,
      max(owner_label) as label, count(*)::bigint as count
    from admin_assets
    group by owner_user_id
    union all
    select 'province',
      coalesce(nullif(trim(owner_province), ''), '__not_saved__') as value,
      coalesce(nullif(trim(owner_province), ''), 'Province not saved') as label,
      count(*)::bigint as count
    from admin_assets
    group by nullif(trim(owner_province), '')
    union all
    select 'sector', sector_key, max(sector_label), count(*)::bigint
    from admin_assets
    group by sector_key
    union all
    select 'lifecycle', lifecycle_state,
      initcap(replace(lifecycle_state, '_', ' ')), count(*)::bigint
    from admin_assets
    group by lifecycle_state
    order by option_group, label
  `);
  return mapOptions(result.rows);
}

export async function getAdminDiscoveryReport(
  input: Partial<AdminDiscoveryFilters> = {},
): Promise<AdminDiscoveryReport> {
  await ensureAdminGlobalAssetSources();
  await ensureAssetDiscoveryViewTracking();
  const filters = normalizeAdminDiscoveryFilters(input);
  const { whereSql, params } = buildDiscoveryWhere(filters);
  const [summaryResult, options] = await Promise.all([
    getDb().query<SummaryRow>(
      `
        ${ADMIN_DISCOVERY_ASSET_CTE}
        select
          count(*)::bigint as total_assets,
          count(*) filter (where has_location)::bigint as mapped_assets,
          count(distinct owner_user_id)::bigint as owner_accounts,
          coalesce(sum(asset_value), 0)::numeric as total_value_ex_vat,
          count(*) filter (where has_saved_value)::bigint as valued_assets,
          count(*) filter (where discovery_participation_enabled)::bigint
            as discovery_enabled_assets,
          coalesce(sum(total_views), 0)::bigint as total_views,
          coalesce(sum(account_views), 0)::bigint as account_views,
          coalesce(sum(unknown_views), 0)::bigint as unknown_views,
          count(*) filter (where total_views > 0)::bigint as viewed_assets,
          count(*) filter (where has_repeat_interest)::bigint as repeat_interest_assets
        from discovery_assets
        ${whereSql}
      `,
      params,
    ),
    getAdminGlobalAssetOptions(),
  ]);

  const summary = mapSummary(summaryResult.rows[0]);
  const totalItems = summary.totalAssets;
  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const offset = (page - 1) * filters.pageSize;
  const listParams = [...params];
  let focusOrder = "";
  if (filters.focusAssetId) {
    listParams.push(filters.focusAssetId);
    focusOrder = `case when asset_id = $${listParams.length} then 0 else 1 end,`;
  }
  listParams.push(filters.pageSize, offset);
  const limitParameter = `$${listParams.length - 1}`;
  const offsetParameter = `$${listParams.length}`;
  const listResult = await getDb().query<AdminGlobalAssetRow>(
    `
      ${ADMIN_DISCOVERY_ASSET_CTE}
      select *
      from discovery_assets
      ${whereSql}
      order by ${focusOrder} ${discoverySortSql(filters.sort)}
      limit ${limitParameter}
      offset ${offsetParameter}
    `,
    listParams,
  );

  return {
    generatedAtIso: new Date().toISOString(),
    assets: listResult.rows.map(mapAsset),
    summary,
    options: options ?? EMPTY_OPTIONS,
    filters: { ...filters, page },
    pagination: {
      page,
      pageSize: filters.pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
  };
}
