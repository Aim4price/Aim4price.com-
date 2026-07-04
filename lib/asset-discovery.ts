import { ensureAccountProfileColumns } from './account-profile';
import { getDb } from './db';

export type AssetDiscoveryEnquiryStatus = 'pending' | 'approved' | 'temporarily_denied';
export type AssetDiscoveryAccountType = 'owner' | 'dealer' | 'finance' | 'insurance' | string;

export type SafeAssetSummary = {
  type: string;
  brand: string;
  model: string;
  year: string;
  usage: string;
  condition: string;
  province: string;
};

export type AssetDiscoveryAsset = SafeAssetSummary & {
  id: string;
  enquiryId: string | null;
  enquiryStatus: AssetDiscoveryEnquiryStatus | null;
  requestAgainAtIso: string | null;
  approvedAtIso: string | null;
};

export type AssetDiscoveryOption = {
  value: string;
  label: string;
  count: number;
};

export type AssetDiscoveryListResult = {
  assets: AssetDiscoveryAsset[];
  provinceOptions: AssetDiscoveryOption[];
  typeOptions: AssetDiscoveryOption[];
};

export type AssetDiscoveryContactDetails = {
  name: string;
  businessName: string;
  phone: string;
  email: string;
  location: string;
};

export type AssetDiscoveryEnquiryDetail = {
  id: string;
  assetId: string;
  status: AssetDiscoveryEnquiryStatus;
  createdAtIso: string;
  approvedAtIso: string | null;
  deniedAtIso: string | null;
  requestAgainAtIso: string | null;
  asset: SafeAssetSummary;
  dealerMessage: string;
  dealerContact: AssetDiscoveryContactDetails | null;
  ownerContact: AssetDiscoveryContactDetails | null;
};

export type AssetDiscoveryNotification = {
  id: string;
  status: AssetDiscoveryEnquiryStatus;
  createdAtIso: string;
  updatedAtIso: string;
  asset: SafeAssetSummary;
};

type AssetDiscoveryRow = {
  id: string;
  type_label: string | null;
  kind: string | null;
  brand_name: string | null;
  model_name: string | null;
  typed_model_name: string | null;
  year_model: number | string | null;
  hours: number | string | null;
  life_worked_percent: number | string | null;
  specs_json: unknown;
  condition: string | null;
  province: string | null;
  selected_method: string | null;
  depreciation_method_used: string | null;
  family_usage_metric_type: string | null;
  enquiry_id: string | null;
  enquiry_status: string | null;
  request_again_at: string | null;
  approved_at: string | null;
};

type EnquiryRow = {
  id: string;
  asset_register_item_id: string;
  owner_user_id: string;
  dealer_user_id: string;
  status: string | null;
  dealer_message: string | null;
  created_at: string | null;
  approved_at: string | null;
  denied_at: string | null;
  request_again_at: string | null;
  updated_at: string | null;
  type_label: string | null;
  kind: string | null;
  brand_name: string | null;
  model_name: string | null;
  typed_model_name: string | null;
  year_model: number | string | null;
  hours: number | string | null;
  life_worked_percent: number | string | null;
  specs_json: unknown;
  condition: string | null;
  selected_method: string | null;
  depreciation_method_used: string | null;
  family_usage_metric_type: string | null;
  owner_province: string | null;
  owner_business_name: string | null;
  owner_display_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  owner_account_email: string | null;
  owner_town_city: string | null;
  dealer_business_name: string | null;
  dealer_display_name: string | null;
  dealer_phone: string | null;
  dealer_email: string | null;
  dealer_account_email: string | null;
  dealer_province: string | null;
  dealer_town_city: string | null;
};

type ExistingEnquiryRow = {
  id: string;
  status: string | null;
  request_again_at: string | null;
};

type OptionRow = {
  value: string | null;
  count: number | string | null;
};

type AssetOwnerRow = AssetDiscoveryRow & {
  owner_user_id: string;
};

const ASSET_DISCOVERY_STATUSES = new Set<AssetDiscoveryEnquiryStatus>(['pending', 'approved', 'temporarily_denied']);
const ASSET_SPECS_JSON_SQL = "coalesce(asset.specs_json, '{}'::jsonb)";
const RESOLVED_ASSET_TYPE_SQL = "coalesce(nullif(trim(family.family_label), ''), nullif(trim(asset.kind), ''), 'Asset')";
const RESOLVED_ASSET_BRAND_SQL = `coalesce(
  nullif(trim(asset.brand_name), ''),
  nullif(trim(brand.name), ''),
  nullif(trim((${ASSET_SPECS_JSON_SQL}->>'brandName')), ''),
  nullif(trim((${ASSET_SPECS_JSON_SQL}->>'brand_name')), ''),
  nullif(trim((${ASSET_SPECS_JSON_SQL}->>'brand')), '')
)`;
const RESOLVED_ASSET_MODEL_SQL = `coalesce(
  nullif(trim(asset.model_name), ''),
  nullif(trim(model.model_name), ''),
  nullif(trim(model.display_name), ''),
  nullif(trim(asset.typed_model_name), ''),
  nullif(trim((${ASSET_SPECS_JSON_SQL}->>'modelName')), ''),
  nullif(trim((${ASSET_SPECS_JSON_SQL}->>'model_name')), ''),
  nullif(trim((${ASSET_SPECS_JSON_SQL}->>'model')), '')
)`;
const PROVINCE_ABBREVIATION_SQL = `case lower(nullif(trim(owner.province), ''))
  when 'western cape' then 'WC'
  when 'gauteng' then 'GP'
  when 'kwazulu-natal' then 'KZN'
  when 'kwazulu natal' then 'KZN'
  when 'eastern cape' then 'EC'
  when 'free state' then 'FS'
  when 'limpopo' then 'LP'
  when 'mpumalanga' then 'MP'
  when 'northern cape' then 'NC'
  when 'north west' then 'NW'
  else coalesce(owner.province, '')
end`;
const DISCOVERY_ELIGIBLE_ASSET_SQL = `
  (
    lower(coalesce(asset.selected_method, '')) = 'aim4price'
    or asset.valuation_run_id is not null
    or asset.equipment_family_id is not null
    or asset.equipment_model_id is not null
  )
  and lower(coalesce(asset.selected_method, '')) <> 'manual'
  and lower(coalesce(asset.kind, '')) not in ('manual', 'other', 'tools', 'tool', 'property', 'building', 'land')
  and lower(${RESOLVED_ASSET_TYPE_SQL}) not in ('manual', 'other', 'tools', 'tool', 'property', 'building', 'land')
  and (
    asset.equipment_family_id is not null
    or asset.equipment_model_id is not null
    or nullif(trim(family.family_label), '') is not null
    or (
      lower(coalesce(asset.selected_method, '')) = 'aim4price'
      and (
        nullif(trim(coalesce(asset.brand_name, '')), '') is not null
        or nullif(trim(coalesce(asset.model_name, '')), '') is not null
        or nullif(trim(coalesce(asset.typed_model_name, '')), '') is not null
        or nullif(trim((${ASSET_SPECS_JSON_SQL}->>'brandName')), '') is not null
        or nullif(trim((${ASSET_SPECS_JSON_SQL}->>'brand_name')), '') is not null
        or nullif(trim((${ASSET_SPECS_JSON_SQL}->>'brand')), '') is not null
        or nullif(trim((${ASSET_SPECS_JSON_SQL}->>'modelName')), '') is not null
        or nullif(trim((${ASSET_SPECS_JSON_SQL}->>'model_name')), '') is not null
        or nullif(trim((${ASSET_SPECS_JSON_SQL}->>'model')), '') is not null
      )
    )
  )
  and (
    lower(${RESOLVED_ASSET_TYPE_SQL}) <> 'equipment'
    or asset.equipment_family_id is not null
    or asset.equipment_model_id is not null
    or lower(coalesce(asset.selected_method, '')) = 'aim4price'
  )
`;
const PROPERTY_LIKE_ASSET_PATTERN = '(property|building|land|house|office|shed|storage|warehouse)';
let assetDiscoveryTablesEnsured = false;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asInt(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function normalizeStatus(value: unknown): AssetDiscoveryEnquiryStatus {
  const normalized = asText(value).toLowerCase();
  return ASSET_DISCOVERY_STATUSES.has(normalized as AssetDiscoveryEnquiryStatus)
    ? (normalized as AssetDiscoveryEnquiryStatus)
    : 'pending';
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function numericValue(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;

  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function pickSpecsNumber(specs: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const numeric = numericValue(specs[key]);
    if (numeric !== null) return numeric;
  }

  return null;
}

function readFirstText(values: unknown[]): string {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }

  return '';
}

function isPercentUsageValue(value: unknown): boolean {
  const normalized = asText(value).toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

  return [
    'percent',
    'percentage',
    '%',
    'percent used',
    'percentage used',
    'percentage depreciation',
    'life worked percent',
    'life worked percentage',
    'worked percent',
    'lifetime percent',
    'lifetime worked percent',
    'lifetime used percent',
    'wear class',
    'semi depreciation',
  ].includes(normalized);
}

function isKilometreUsageValue(value: unknown): boolean {
  const normalized = asText(value).toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

  return [
    'km',
    'kms',
    'kilometre',
    'kilometres',
    'kilometer',
    'kilometers',
    'odometer',
    'mileage',
    'vehicle',
  ].includes(normalized);
}

function isVehicleLikeAsset(kind: string, typeLabel: string, specs: Record<string, unknown>): boolean {
  const haystack = [
    kind,
    typeLabel,
    asText(specs.sectorKey),
    asText(specs.sector_key),
    asText(specs.familyKey),
    asText(specs.family_key),
    asText(specs.familyLabel),
    asText(specs.family_label),
    asText(specs.equipmentFamilyLabel),
    asText(specs.equipment_family_label),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /\b(vehicle|motor|car|cars|suv|sedan|hatch|hatchback|bakkie|ldv|truck|trucks|bus|buses|trailer|trailers|motorcycle|motorcycles|quad|quadbike|quadbikes|side[ -]?by[ -]?side|sxs|utv)\b/.test(haystack);
}

function readUsageMetric(
  row: Pick<AssetDiscoveryRow, 'kind' | 'type_label' | 'specs_json' | 'depreciation_method_used' | 'family_usage_metric_type'>,
): 'km' | 'hours' | 'percent' {
  const specs = isRecord(row.specs_json) ? row.specs_json : {};
  const kind = asText(row.kind).toLowerCase();
  const typeLabel = asText(row.type_label);
  const depreciationMethod = readFirstText([
    row.depreciation_method_used,
    specs.depreciationMethodUsed,
    specs.depreciation_method_used,
    specs.selectedDepreciationMethod,
    specs.selected_depreciation_method,
  ]);
  const usageMode = readFirstText([
    specs.usageMode,
    specs.usage_mode,
    specs.usageBasis,
    specs.usage_basis,
    specs.selectedUsageMode,
    specs.selected_usage_mode,
    specs.selectedUsageBasis,
    specs.selected_usage_basis,
    specs.valuationMode,
    specs.valuation_mode,
    depreciationMethod,
  ]);
  const usageMetric = readFirstText([
    specs.usageMetric,
    specs.usage_metric,
    specs.usageUnit,
    specs.usage_unit,
    specs.usageMetricType,
    specs.usage_metric_type,
    row.family_usage_metric_type,
  ]);

  if (isPercentUsageValue(usageMode) || isPercentUsageValue(usageMetric)) return 'percent';
  if (isKilometreUsageValue(usageMetric) || isVehicleLikeAsset(kind, typeLabel, specs)) return 'km';

  return 'hours';
}

function formatWholeNumber(value: number): string {
  return Math.round(value).toLocaleString('en-ZA');
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const formatted = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${formatted}% worked`;
}

function buildUsage(
  row: Pick<
    AssetDiscoveryRow,
    'hours' | 'life_worked_percent' | 'specs_json' | 'kind' | 'type_label' | 'depreciation_method_used' | 'family_usage_metric_type'
  >,
): string {
  const specs = isRecord(row.specs_json) ? row.specs_json : {};
  const metric = readUsageMetric(row);
  const savedReading = numericValue(row.hours);
  const storedPercent = numericValue(row.life_worked_percent);
  const kmReading = pickSpecsNumber(specs, [
    'km',
    'kms',
    'kilometres',
    'kilometers',
    'odometer',
    'odometerKm',
    'odometer_km',
    'mileage',
    'usageAmount',
    'usage_amount',
    'savedUsage',
    'saved_usage',
    'currentUsage',
    'current_usage',
  ]);
  const hoursReading = savedReading ?? pickSpecsNumber(specs, [
    'hours',
    'engineHours',
    'engine_hours',
    'machineHours',
    'machine_hours',
    'usageAmount',
    'usage_amount',
    'savedUsage',
    'saved_usage',
    'currentUsage',
    'current_usage',
  ]);
  const percent = storedPercent ?? pickSpecsNumber(specs, [
    'lifeWorkedPercent',
    'life_worked_percent',
    'workedPercent',
    'worked_percent',
    'percentWorked',
    'percent_worked',
    'lifetimeWorkedPercent',
    'lifetime_worked_percent',
    'lifetimeUsedPercent',
    'lifetime_used_percent',
  ]);

  if (metric === 'percent') {
    return percent !== null ? formatPercent(percent) : 'Unknown';
  }

  if (metric === 'km') {
    const value = savedReading ?? kmReading;
    if (value !== null) return `${formatWholeNumber(value)} km`;
    return percent !== null ? formatPercent(percent) : 'Unknown';
  }

  if (hoursReading !== null) return `${formatWholeNumber(hoursReading)} hours`;
  if (percent !== null) return formatPercent(percent);
  if (kmReading !== null) return `${formatWholeNumber(kmReading)} km`;

  return 'Unknown';
}

function safeSummary(row: Pick<AssetDiscoveryRow, 'type_label' | 'kind' | 'brand_name' | 'model_name' | 'typed_model_name' | 'year_model' | 'hours' | 'life_worked_percent' | 'specs_json' | 'condition' | 'province' | 'depreciation_method_used' | 'family_usage_metric_type'>): SafeAssetSummary {
  const type = asText(row.type_label) || titleCase(asText(row.kind) || 'Asset');
  const brand = asText(row.brand_name) || 'Unknown';
  const model = asText(row.model_name) || asText(row.typed_model_name) || 'Unknown';
  const year = asInt(row.year_model) > 0 ? String(asInt(row.year_model)) : 'Unknown';
  const condition = asText(row.condition) ? titleCase(asText(row.condition)) : 'Unknown';
  const province = asText(row.province) || 'Province not saved';

  return {
    type,
    brand,
    model,
    year,
    usage: buildUsage(row),
    condition,
    province,
  };
}

function mapAsset(row: AssetDiscoveryRow): AssetDiscoveryAsset {
  return {
    id: row.id,
    ...safeSummary(row),
    enquiryId: row.enquiry_id,
    enquiryStatus: row.enquiry_status ? normalizeStatus(row.enquiry_status) : null,
    requestAgainAtIso: row.request_again_at,
    approvedAtIso: row.approved_at,
  };
}

function contactDetails(input: {
  businessName?: string | null;
  displayName?: string | null;
  phone?: string | null;
  profileEmail?: string | null;
  accountEmail?: string | null;
  province?: string | null;
  townCity?: string | null;
}): AssetDiscoveryContactDetails {
  const businessName = asText(input.businessName);
  const name = businessName || asText(input.displayName) || 'Aim4price account';
  const email = asText(input.profileEmail) || asText(input.accountEmail);
  const location = [asText(input.townCity), asText(input.province)].filter(Boolean).join(', ');

  return {
    name,
    businessName,
    phone: asText(input.phone),
    email,
    location,
  };
}

function mapEnquiryForAudience(row: EnquiryRow, audience: 'owner' | 'dealer'): AssetDiscoveryEnquiryDetail {
  const status = normalizeStatus(row.status);
  const isApproved = status === 'approved';

  return {
    id: row.id,
    assetId: row.asset_register_item_id,
    status,
    createdAtIso: row.created_at || new Date().toISOString(),
    approvedAtIso: row.approved_at,
    deniedAtIso: row.denied_at,
    requestAgainAtIso: row.request_again_at,
    asset: safeSummary({ ...row, province: row.owner_province }),
    dealerMessage: isApproved ? asText(row.dealer_message) : '',
    dealerContact:
      audience === 'owner' && isApproved
        ? contactDetails({
            businessName: row.dealer_business_name,
            displayName: row.dealer_display_name,
            phone: row.dealer_phone,
            profileEmail: row.dealer_email,
            accountEmail: row.dealer_account_email,
            province: row.dealer_province,
            townCity: row.dealer_town_city,
          })
        : null,
    ownerContact:
      audience === 'dealer' && isApproved
        ? contactDetails({
            businessName: row.owner_business_name,
            displayName: row.owner_display_name,
            phone: row.owner_phone,
            profileEmail: row.owner_email,
            accountEmail: row.owner_account_email,
            province: row.owner_province,
            townCity: row.owner_town_city,
          })
        : null,
  };
}

function mapNotification(row: EnquiryRow): AssetDiscoveryNotification {
  return {
    id: row.id,
    status: normalizeStatus(row.status),
    createdAtIso: row.created_at || new Date().toISOString(),
    updatedAtIso: row.updated_at || row.created_at || new Date().toISOString(),
    asset: safeSummary({ ...row, province: row.owner_province }),
  };
}

export async function ensureAssetDiscoveryTables(): Promise<void> {
  if (assetDiscoveryTablesEnsured) return;

  await ensureAccountProfileColumns();
  const db = getDb();
  await db.query('create extension if not exists pgcrypto');

  await db.query(`
    create table if not exists public.asset_discovery_enquiries (
      id uuid primary key default gen_random_uuid(),
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      owner_user_id text not null,
      dealer_user_id text not null,
      status text not null default 'pending',
      dealer_message text not null default '',
      created_at timestamptz not null default now(),
      approved_at timestamptz,
      denied_at timestamptz,
      request_again_at timestamptz,
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`
    alter table public.asset_discovery_enquiries
      add column if not exists asset_register_item_id uuid references public.asset_register_items(id) on delete cascade,
      add column if not exists owner_user_id text,
      add column if not exists dealer_user_id text,
      add column if not exists status text not null default 'pending',
      add column if not exists dealer_message text not null default '',
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists approved_at timestamptz,
      add column if not exists denied_at timestamptz,
      add column if not exists request_again_at timestamptz,
      add column if not exists updated_at timestamptz not null default now()
  `);

  await db.query(`
    update public.asset_discovery_enquiries
    set status = case
      when status in ('pending', 'approved', 'temporarily_denied') then status
      when status in ('denied', 'declined') then 'temporarily_denied'
      else 'pending'
    end
  `);

  await db.query(`
    do $$
    begin
      if not exists (
        select 1
        from pg_constraint
        where conname = 'asset_discovery_enquiries_status_check'
          and conrelid = 'public.asset_discovery_enquiries'::regclass
      ) then
        alter table public.asset_discovery_enquiries
          add constraint asset_discovery_enquiries_status_check
          check (status in ('pending', 'approved', 'temporarily_denied'));
      end if;
    end $$
  `);

  await db.query(`
    create index if not exists idx_asset_discovery_owner_status_created
      on public.asset_discovery_enquiries(owner_user_id, status, created_at desc)
  `);
  await db.query(`
    create index if not exists idx_asset_discovery_dealer_status_created
      on public.asset_discovery_enquiries(dealer_user_id, status, created_at desc)
  `);
  await db.query(`
    create index if not exists idx_asset_discovery_asset_dealer
      on public.asset_discovery_enquiries(asset_register_item_id, dealer_user_id)
  `);
  await db.query(`
    create unique index if not exists idx_asset_discovery_pending_once
      on public.asset_discovery_enquiries(asset_register_item_id, dealer_user_id)
      where status = 'pending'
  `);

  assetDiscoveryTablesEnsured = true;
}

function baseAssetWhere(input: { dealerUserId: string; search?: string; province?: string; type?: string }) {
  const params: unknown[] = [input.dealerUserId];
  const where = [
    "owner.account_type = 'owner'",
    "owner.account_status = 'active'",
    'asset.user_id <> $1',
    `(${DISCOVERY_ELIGIBLE_ASSET_SQL})`,
    `${RESOLVED_ASSET_TYPE_SQL} !~* '${PROPERTY_LIKE_ASSET_PATTERN}'`,
    `coalesce(asset.title, '') !~* '${PROPERTY_LIKE_ASSET_PATTERN}'`,
  ];

  const search = asText(input.search);
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    const p = `$${params.length}`;
    where.push(`(
      ${RESOLVED_ASSET_TYPE_SQL} ilike ${p} escape '\\'
      or ${RESOLVED_ASSET_BRAND_SQL} ilike ${p} escape '\\'
      or ${RESOLVED_ASSET_MODEL_SQL} ilike ${p} escape '\\'
      or coalesce(asset.typed_model_name, '') ilike ${p} escape '\\'
      or coalesce(asset.year_model::text, 'Unknown') ilike ${p} escape '\\'
      or coalesce(asset.hours::text, '') ilike ${p} escape '\\'
      or coalesce(asset.life_worked_percent::text, '') ilike ${p} escape '\\'
      or coalesce(asset.condition, '') ilike ${p} escape '\\'
      or coalesce(owner.province, '') ilike ${p} escape '\\'
      or ${PROVINCE_ABBREVIATION_SQL} ilike ${p} escape '\\'
    )`);
  }

  const province = asText(input.province);
  if (province === '__province_not_saved__') {
    where.push("coalesce(nullif(trim(owner.province), ''), '') = ''");
  } else if (province && province !== 'all') {
    params.push(province.toLowerCase());
    where.push(`lower(coalesce(owner.province, '')) = $${params.length}`);
  }

  const type = asText(input.type);
  if (type && type !== 'all') {
    params.push(type.toLowerCase());
    where.push(`lower(${RESOLVED_ASSET_TYPE_SQL}) = $${params.length}`);
  }

  return { params, whereClause: `where ${where.join(' and ')}` };
}

export async function listAssetDiscoveryAssets(input: { dealerUserId: string; search?: string; province?: string; type?: string }): Promise<AssetDiscoveryListResult> {
  await ensureAssetDiscoveryTables();
  const db = getDb();
  const { params, whereClause } = baseAssetWhere(input);

  const listSql = `
    select
      asset.id::text,
      ${RESOLVED_ASSET_TYPE_SQL} as type_label,
      asset.kind,
      ${RESOLVED_ASSET_BRAND_SQL} as brand_name,
      ${RESOLVED_ASSET_MODEL_SQL} as model_name,
      asset.typed_model_name,
      asset.year_model,
      asset.hours,
      asset.life_worked_percent,
      ${ASSET_SPECS_JSON_SQL} as specs_json,
      asset.condition,
      owner.province,
      asset.selected_method,
      asset.depreciation_method_used,
      family.usage_metric_type as family_usage_metric_type,
      enquiry.id::text as enquiry_id,
      enquiry.status as enquiry_status,
      enquiry.request_again_at::text,
      enquiry.approved_at::text
    from public.asset_register_items asset
    join public.account_profiles owner on owner.user_id = asset.user_id
    left join public.equipment_families family on family.id = asset.equipment_family_id
    left join public.equipment_models model on model.id = asset.equipment_model_id
    left join public.brands brand on brand.id = model.brand_id
    left join lateral (
      select e.id, e.status, e.request_again_at, e.approved_at, e.created_at
      from public.asset_discovery_enquiries e
      where e.asset_register_item_id = asset.id
        and e.dealer_user_id = $1
      order by e.created_at desc
      limit 1
    ) enquiry on true
    ${whereClause}
    order by asset.updated_at desc nulls last, asset.created_at desc nulls last, asset.id desc
    limit 250
  `;

  const [assetRows, provinceRows, typeRows] = await Promise.all([
    db.query<AssetDiscoveryRow>(listSql, params),
    db.query<OptionRow>(
      `
        select nullif(trim(owner.province), '') as value, count(*)::int as count
        from public.asset_register_items asset
        join public.account_profiles owner on owner.user_id = asset.user_id
        left join public.equipment_families family on family.id = asset.equipment_family_id
        left join public.equipment_models model on model.id = asset.equipment_model_id
        left join public.brands brand on brand.id = model.brand_id
        ${baseAssetWhere({ dealerUserId: input.dealerUserId }).whereClause}
        group by nullif(trim(owner.province), '')
        order by nullif(trim(owner.province), '') asc nulls last
      `,
      [input.dealerUserId],
    ),
    db.query<OptionRow>(
      `
        select ${RESOLVED_ASSET_TYPE_SQL} as value, count(*)::int as count
        from public.asset_register_items asset
        join public.account_profiles owner on owner.user_id = asset.user_id
        left join public.equipment_families family on family.id = asset.equipment_family_id
        left join public.equipment_models model on model.id = asset.equipment_model_id
        left join public.brands brand on brand.id = model.brand_id
        ${baseAssetWhere({ dealerUserId: input.dealerUserId }).whereClause}
        group by ${RESOLVED_ASSET_TYPE_SQL}
        order by ${RESOLVED_ASSET_TYPE_SQL} asc
      `,
      [input.dealerUserId],
    ),
  ]);

  return {
    assets: assetRows.rows.map(mapAsset),
    provinceOptions: provinceRows.rows
      .map((row) => ({
        value: asText(row.value) || '__province_not_saved__',
        label: asText(row.value) || 'Province not saved',
        count: asInt(row.count),
      }))
      .filter((row) => row.count > 0),
    typeOptions: typeRows.rows
      .map((row) => ({ value: asText(row.value), label: asText(row.value), count: asInt(row.count) }))
      .filter((row) => row.value && row.count > 0),
  };
}

async function findSafeAssetForEnquiry(assetId: string, dealerUserId: string): Promise<AssetOwnerRow | null> {
  const db = getDb();
  const result = await db.query<AssetOwnerRow>(
    `
      select
        asset.id::text,
        asset.user_id as owner_user_id,
        ${RESOLVED_ASSET_TYPE_SQL} as type_label,
        asset.kind,
        ${RESOLVED_ASSET_BRAND_SQL} as brand_name,
        ${RESOLVED_ASSET_MODEL_SQL} as model_name,
        asset.typed_model_name,
        asset.year_model,
        asset.hours,
        asset.life_worked_percent,
        ${ASSET_SPECS_JSON_SQL} as specs_json,
        asset.condition,
        owner.province,
        asset.selected_method,
        asset.depreciation_method_used,
        family.usage_metric_type as family_usage_metric_type,
        null::text as enquiry_id,
        null::text as enquiry_status,
        null::text as request_again_at,
        null::text as approved_at
      from public.asset_register_items asset
      join public.account_profiles owner on owner.user_id = asset.user_id
      left join public.equipment_families family on family.id = asset.equipment_family_id
      left join public.equipment_models model on model.id = asset.equipment_model_id
      left join public.brands brand on brand.id = model.brand_id
      where asset.id = $1::uuid
        and asset.user_id <> $2
        and owner.account_type = 'owner'
        and owner.account_status = 'active'
        and (${DISCOVERY_ELIGIBLE_ASSET_SQL})
        and ${RESOLVED_ASSET_TYPE_SQL} !~* '${PROPERTY_LIKE_ASSET_PATTERN}'
        and coalesce(asset.title, '') !~* '${PROPERTY_LIKE_ASSET_PATTERN}'
      limit 1
    `,
    [assetId, dealerUserId],
  );

  return result.rows[0] ?? null;
}

export async function createAssetDiscoveryEnquiry(input: { dealerUserId: string; assetId: string; message: string }): Promise<AssetDiscoveryEnquiryDetail> {
  await ensureAssetDiscoveryTables();

  const assetId = asText(input.assetId);
  if (!assetId) throw new Error('Asset is required.');

  const asset = await findSafeAssetForEnquiry(assetId, input.dealerUserId);
  if (!asset) throw new Error('Asset is not available for Discovery.');

  const db = getDb();
  const existing = await db.query<ExistingEnquiryRow>(
    `
      select id::text, status, request_again_at::text
      from public.asset_discovery_enquiries
      where asset_register_item_id = $1::uuid
        and dealer_user_id = $2
      order by created_at desc
      limit 1
    `,
    [assetId, input.dealerUserId],
  );
  const current = existing.rows[0];

  if (current?.status === 'pending') {
    throw new Error('You already have a pending enquiry for this asset.');
  }

  if (current?.status === 'temporarily_denied' && current.request_again_at && Date.parse(current.request_again_at) > Date.now()) {
    throw new Error(`This enquiry was temporarily denied. You can enquire again after ${new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' }).format(new Date(current.request_again_at))}.`);
  }

  const message = asText(input.message).slice(0, 600);
  const result = await db.query<{ id: string }>(
    `
      insert into public.asset_discovery_enquiries (
        asset_register_item_id,
        owner_user_id,
        dealer_user_id,
        status,
        dealer_message,
        created_at,
        updated_at
      )
      values ($1::uuid, $2, $3, 'pending', $4, now(), now())
      returning id::text
    `,
    [asset.id, asset.owner_user_id, input.dealerUserId, message],
  );

  return getAssetDiscoveryEnquiryForUser({
    enquiryId: result.rows[0]?.id ?? '',
    userId: input.dealerUserId,
    accountType: 'dealer',
  });
}

function enquirySelectSql(whereClause: string): string {
  return `
    select
      enquiry.id::text,
      enquiry.asset_register_item_id::text,
      enquiry.owner_user_id,
      enquiry.dealer_user_id,
      enquiry.status,
      enquiry.dealer_message,
      enquiry.created_at::text,
      enquiry.approved_at::text,
      enquiry.denied_at::text,
      enquiry.request_again_at::text,
      enquiry.updated_at::text,
      ${RESOLVED_ASSET_TYPE_SQL} as type_label,
      asset.kind,
      ${RESOLVED_ASSET_BRAND_SQL} as brand_name,
      ${RESOLVED_ASSET_MODEL_SQL} as model_name,
      asset.typed_model_name,
      asset.year_model,
      asset.hours,
      asset.life_worked_percent,
      ${ASSET_SPECS_JSON_SQL} as specs_json,
      asset.condition,
      asset.selected_method,
      asset.depreciation_method_used,
      family.usage_metric_type as family_usage_metric_type,
      owner.province as owner_province,
      owner.business_name as owner_business_name,
      owner.display_name as owner_display_name,
      owner.phone as owner_phone,
      owner.marketplace_email as owner_email,
      ownerUser.email as owner_account_email,
      owner.town_city as owner_town_city,
      dealer.business_name as dealer_business_name,
      dealer.display_name as dealer_display_name,
      dealer.phone as dealer_phone,
      dealer.marketplace_email as dealer_email,
      dealerUser.email as dealer_account_email,
      dealer.province as dealer_province,
      dealer.town_city as dealer_town_city
    from public.asset_discovery_enquiries enquiry
    join public.asset_register_items asset on asset.id = enquiry.asset_register_item_id
    left join public.equipment_families family on family.id = asset.equipment_family_id
    left join public.equipment_models model on model.id = asset.equipment_model_id
    left join public.brands brand on brand.id = model.brand_id
    join public.account_profiles owner on owner.user_id = enquiry.owner_user_id
    join public.account_profiles dealer on dealer.user_id = enquiry.dealer_user_id
    left join public."user" ownerUser on ownerUser.id = enquiry.owner_user_id
    left join public."user" dealerUser on dealerUser.id = enquiry.dealer_user_id
    ${whereClause}
  `;
}

export async function getAssetDiscoveryEnquiryForUser(input: { enquiryId: string; userId: string; accountType: AssetDiscoveryAccountType }): Promise<AssetDiscoveryEnquiryDetail> {
  await ensureAssetDiscoveryTables();
  const db = getDb();
  const accountType = asText(input.accountType).toLowerCase();
  const audience = accountType === 'owner' ? 'owner' : accountType === 'dealer' ? 'dealer' : null;

  if (!audience) throw new Error('Discovery enquiry not found.');

  const result = await db.query<EnquiryRow>(
    enquirySelectSql(`where enquiry.id = $1::uuid and enquiry.${audience === 'owner' ? 'owner_user_id' : 'dealer_user_id'} = $2 limit 1`),
    [input.enquiryId, input.userId],
  );

  const row = result.rows[0];
  if (!row) throw new Error('Discovery enquiry not found.');

  return mapEnquiryForAudience(row, audience);
}

export async function updateAssetDiscoveryOwnerDecision(input: { enquiryId: string; ownerUserId: string; decision: string }): Promise<AssetDiscoveryEnquiryDetail> {
  await ensureAssetDiscoveryTables();
  const decision = asText(input.decision).toLowerCase();
  const nextStatus = decision === 'yes' || decision === 'approved' || decision === 'approve' ? 'approved' : decision === 'no' || decision === 'denied' || decision === 'deny' ? 'temporarily_denied' : null;

  if (!nextStatus) throw new Error('Choose Yes or No.');

  const db = getDb();
  const result = await db.query<{ id: string }>(
    `
      update public.asset_discovery_enquiries
      set
        status = $3,
        approved_at = case when $3 = 'approved' then now() else approved_at end,
        denied_at = case when $3 = 'temporarily_denied' then now() else denied_at end,
        request_again_at = case when $3 = 'temporarily_denied' then now() + interval '90 days' else request_again_at end,
        updated_at = now()
      where id = $1::uuid
        and owner_user_id = $2
        and status = 'pending'
      returning id::text
    `,
    [input.enquiryId, input.ownerUserId, nextStatus],
  );

  if (!result.rows[0]?.id) throw new Error('Discovery enquiry not found or already decided.');

  return getAssetDiscoveryEnquiryForUser({
    enquiryId: result.rows[0].id,
    userId: input.ownerUserId,
    accountType: 'owner',
  });
}

export async function listPendingAssetDiscoveryEnquiriesForOwner(ownerUserId: string): Promise<AssetDiscoveryNotification[]> {
  await ensureAssetDiscoveryTables();
  const db = getDb();
  const result = await db.query<EnquiryRow>(
    enquirySelectSql(`where enquiry.owner_user_id = $1 and enquiry.status = 'pending' order by enquiry.created_at desc limit 10`),
    [ownerUserId],
  );

  return result.rows.map(mapNotification);
}

export async function listRecentAssetDiscoveryEnquiriesForDealer(dealerUserId: string): Promise<AssetDiscoveryNotification[]> {
  await ensureAssetDiscoveryTables();
  const db = getDb();
  const result = await db.query<EnquiryRow>(
    enquirySelectSql(`
      where enquiry.dealer_user_id = $1
        and enquiry.status in ('approved', 'temporarily_denied')
        and enquiry.updated_at >= now() - interval '45 days'
      order by enquiry.updated_at desc
      limit 10
    `),
    [dealerUserId],
  );

  return result.rows.map(mapNotification);
}
