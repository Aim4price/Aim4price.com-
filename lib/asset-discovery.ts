import { ensureAccountProfileColumns } from "./account-profile";
import { getLegacyAssetRegisterUploadResponse } from "./asset-register-uploads";
import { ensureDealerMaintenanceTrackerTables } from "./dealer-maintenance-tracker";
import { getDb } from "./db";
import { createAssetLead, ensurePartnerAccessTables } from "./partner-access";

export type AssetDiscoveryEnquiryStatus =
  | "pending"
  | "approved"
  | "temporarily_denied"
  | "retracted"
  | "expired"
  | "revoked";
export type AssetDiscoveryAccountType =
  "owner" | "dealer" | "finance" | "insurance" | string;
export type AssetDiscoveryRenewalTiming =
  | "overdue"
  | "next_30_days"
  | "next_6_months"
  | "later";

export type SafeAssetSummary = {
  type: string;
  brand: string;
  model: string;
  year: string;
  usage: string;
  condition: string;
  province: string;
  renewalWindow: string;
  renewalTiming: AssetDiscoveryRenewalTiming | null;
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

export type AssetDiscoveryPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type AssetDiscoverySummary = {
  totalAssets: number;
  typeCount: number;
  provinceCount: number;
  dueSoonCount: number;
  overdueCount: number;
};

export type AssetDiscoveryListResult = {
  assets: AssetDiscoveryAsset[];
  provinceOptions: AssetDiscoveryOption[];
  typeOptions: AssetDiscoveryOption[];
  summary: AssetDiscoverySummary;
  pagination: AssetDiscoveryPagination;
};

export type AssetDiscoveryBrowseAccess = {
  accountType: "owner" | "dealer" | "licensing";
  canBrowse: boolean;
  participationEnabled: boolean;
  eligibleAssetCount: number;
  reason: "allowed" | "participation_disabled" | "no_eligible_assets";
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
  requesterAccountType: "owner" | "dealer" | "licensing";
  requesterMessage: string;
  requesterContact: AssetDiscoveryContactDetails | null;
  dealerContact: AssetDiscoveryContactDetails | null;
  ownerContact: AssetDiscoveryContactDetails | null;
};

export type AssetDiscoveryAssetDetails = {
  asset: SafeAssetSummary & { id: string };
  enquiryId: string | null;
  enquiryStatus: AssetDiscoveryEnquiryStatus | null;
  photosUnlocked: boolean;
  contactUnlocked: boolean;
  accessSource: "approved_enquiry" | "dealer_share" | null;
  photoUrls: string[];
  ownerContact: AssetDiscoveryContactDetails | null;
};

export type AssetDiscoveryNotification = {
  id: string;
  assetId: string;
  status: AssetDiscoveryEnquiryStatus;
  createdAtIso: string;
  updatedAtIso: string;
  requestAgainAtIso: string | null;
  requesterAccountType: "owner" | "dealer" | "licensing";
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
  owner_account_status: string | null;
  owner_discovery_participation_enabled: boolean | null;
  requester_user_id: string;
  requester_account_type: string | null;
  requester_account_status: string | null;
  requester_discovery_participation_enabled: boolean | null;
  status: string | null;
  requester_message: string | null;
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
  requester_business_name: string | null;
  requester_display_name: string | null;
  requester_phone: string | null;
  requester_email: string | null;
  requester_account_email: string | null;
  requester_province: string | null;
  requester_town_city: string | null;
};

type ExistingEnquiryRow = {
  id: string;
  status: string | null;
  request_again_at: string | null;
  approved_at: string | null;
};

type OptionRow = {
  value: string | null;
  count: number | string | null;
};

type AssetDiscoverySummaryRow = {
  total_assets: number | string | null;
  type_count: number | string | null;
  province_count: number | string | null;
  due_soon_count: number | string | null;
  overdue_count: number | string | null;
};

type AssetOwnerRow = AssetDiscoveryRow & {
  owner_user_id: string;
};

type AssetDiscoveryDetailRow = AssetOwnerRow & {
  photos: unknown;
  owner_business_name: string | null;
  owner_display_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  owner_account_email: string | null;
  owner_town_city: string | null;
};

export type AssetDiscoveryPhoto = {
  data: Buffer;
  contentType: string;
  fileName: string;
};

const ASSET_DISCOVERY_STATUSES = new Set<AssetDiscoveryEnquiryStatus>([
  "pending",
  "approved",
  "temporarily_denied",
  "retracted",
  "expired",
  "revoked",
]);
const ASSET_SPECS_JSON_SQL = "coalesce(asset.specs_json, '{}'::jsonb)";
const RESOLVED_ASSET_TYPE_SQL =
  "coalesce(nullif(trim(family.family_label), ''), nullif(trim(asset.kind), ''), 'Asset')";
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
const LICENSE_RENEWAL_DATE_SQL = `coalesce(
  nullif(trim((${ASSET_SPECS_JSON_SQL}->>'licenseRenewalDate')), ''),
  nullif(trim((${ASSET_SPECS_JSON_SQL}->>'license_renewal_date')), ''),
  nullif(trim((${ASSET_SPECS_JSON_SQL}->>'licenceRenewalDate')), ''),
  nullif(trim((${ASSET_SPECS_JSON_SQL}->>'licence_renewal_date')), '')
)`;
const SAFE_LICENSE_RENEWAL_DATE_SQL = `(case
  when ${LICENSE_RENEWAL_DATE_SQL} ~ '^\\d{4}-\\d{2}-\\d{2}$'
    then (${LICENSE_RENEWAL_DATE_SQL})::date
  else null
end)`;
const LICENSING_DISCOVERY_ASSET_SQL = `
  ${SAFE_LICENSE_RENEWAL_DATE_SQL} is not null
`;
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
const PROPERTY_LIKE_ASSET_PATTERN =
  "(property|building|land|house|office|shed|storage|warehouse)";
const ASSET_DISCOVERY_DEFAULT_PAGE_SIZE = 10;
const ASSET_DISCOVERY_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
let assetDiscoveryTablesPromise: Promise<void> | null = null;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asInt(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function positiveInt(value: unknown, fallback: number): number {
  const numeric = asInt(value);
  return numeric > 0 ? numeric : fallback;
}

function activeApproval(value: string | null | undefined): boolean {
  const approvalTime = Date.parse(value || "");
  if (!Number.isFinite(approvalTime)) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  return approvalTime > cutoff.getTime();
}

function normalizeDiscoveryPageSize(value: unknown): number {
  const numeric = positiveInt(value, ASSET_DISCOVERY_DEFAULT_PAGE_SIZE);
  return (
    ASSET_DISCOVERY_PAGE_SIZE_OPTIONS.find((option) => option === numeric) ??
    ASSET_DISCOVERY_DEFAULT_PAGE_SIZE
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function normalizeStatus(value: unknown): AssetDiscoveryEnquiryStatus {
  const normalized = asText(value).toLowerCase();
  return ASSET_DISCOVERY_STATUSES.has(normalized as AssetDiscoveryEnquiryStatus)
    ? (normalized as AssetDiscoveryEnquiryStatus)
    : "pending";
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function numericValue(value: unknown): number | null {
  if (value === null || typeof value === "undefined" || value === "")
    return null;

  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function positiveNumericValue(value: unknown): number | null {
  const numeric = numericValue(value);
  return numeric !== null && numeric > 0 ? numeric : null;
}

function pickSpecsNumber(
  specs: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const numeric = numericValue(specs[key]);
    if (numeric !== null) return numeric;
  }

  return null;
}

function pickSpecsPositiveNumber(
  specs: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const numeric = positiveNumericValue(specs[key]);
    if (numeric !== null) return numeric;
  }

  return null;
}

function readFirstText(values: unknown[]): string {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }

  return "";
}

function isPercentUsageValue(value: unknown): boolean {
  const normalized = asText(value)
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return [
    "percent",
    "percentage",
    "%",
    "percent used",
    "percentage used",
    "percentage depreciation",
    "life worked percent",
    "life worked percentage",
    "worked percent",
    "lifetime percent",
    "lifetime worked percent",
    "lifetime used percent",
    "wear class",
    "semi depreciation",
  ].includes(normalized);
}

function isKilometreUsageValue(value: unknown): boolean {
  const normalized = asText(value)
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return [
    "km",
    "kms",
    "kilometre",
    "kilometres",
    "kilometer",
    "kilometers",
    "odometer",
    "mileage",
    "vehicle",
  ].includes(normalized);
}

function isVehicleLikeAsset(
  kind: string,
  typeLabel: string,
  specs: Record<string, unknown>,
): boolean {
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
    .join(" ")
    .toLowerCase();

  return /\b(vehicle|motor|car|cars|suv|sedan|hatch|hatchback|bakkie|ldv|truck|trucks|bus|buses|trailer|trailers|motorcycle|motorcycles|quad|quadbike|quadbikes|side[ -]?by[ -]?side|sxs|utv)\b/.test(
    haystack,
  );
}

function readUsageMetric(
  row: Pick<
    AssetDiscoveryRow,
    | "kind"
    | "type_label"
    | "specs_json"
    | "depreciation_method_used"
    | "family_usage_metric_type"
  >,
): "km" | "hours" | "percent" {
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

  if (isPercentUsageValue(usageMode) || isPercentUsageValue(usageMetric))
    return "percent";
  if (
    isKilometreUsageValue(usageMetric) ||
    isVehicleLikeAsset(kind, typeLabel, specs)
  )
    return "km";

  return "hours";
}

function formatWholeNumber(value: number): string {
  return Math.round(value).toLocaleString("en-ZA");
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const formatted = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1);
  return `${formatted}% worked`;
}

function buildUsage(
  row: Pick<
    AssetDiscoveryRow,
    | "hours"
    | "life_worked_percent"
    | "specs_json"
    | "kind"
    | "type_label"
    | "depreciation_method_used"
    | "family_usage_metric_type"
  >,
): string {
  const specs = isRecord(row.specs_json) ? row.specs_json : {};
  const metric = readUsageMetric(row);
  // A zero meter reading is normally the database default for an unsaved
  // reading. Discovery must not present that default as real usage.
  const savedReading = positiveNumericValue(row.hours);
  const storedPercent = numericValue(row.life_worked_percent);
  const kmReading = pickSpecsPositiveNumber(specs, [
    "km",
    "kms",
    "kilometres",
    "kilometers",
    "odometer",
    "odometerKm",
    "odometer_km",
    "mileage",
    "usageAmount",
    "usage_amount",
    "savedUsage",
    "saved_usage",
    "currentUsage",
    "current_usage",
  ]);
  const hoursReading =
    savedReading ??
    pickSpecsPositiveNumber(specs, [
      "hours",
      "engineHours",
      "engine_hours",
      "machineHours",
      "machine_hours",
      "usageAmount",
      "usage_amount",
      "savedUsage",
      "saved_usage",
      "currentUsage",
      "current_usage",
    ]);
  const percent =
    storedPercent ??
    pickSpecsNumber(specs, [
      "lifeWorkedPercent",
      "life_worked_percent",
      "workedPercent",
      "worked_percent",
      "percentWorked",
      "percent_worked",
      "lifetimeWorkedPercent",
      "lifetime_worked_percent",
      "lifetimeUsedPercent",
      "lifetime_used_percent",
    ]);
  const fallbackPercent =
    percent !== null && percent > 0 ? percent : null;

  if (metric === "percent") {
    return percent !== null ? formatPercent(percent) : "Unknown";
  }

  if (metric === "km") {
    const value = savedReading ?? kmReading;
    if (value !== null) return `${formatWholeNumber(value)} km`;
    return fallbackPercent !== null ? formatPercent(fallbackPercent) : "Unknown";
  }

  if (hoursReading !== null) return `${formatWholeNumber(hoursReading)} hours`;
  if (fallbackPercent !== null) return formatPercent(fallbackPercent);
  if (kmReading !== null) return `${formatWholeNumber(kmReading)} km`;

  return "Unknown";
}

function safeSummary(
  row: Pick<
    AssetDiscoveryRow,
    | "type_label"
    | "kind"
    | "brand_name"
    | "model_name"
    | "typed_model_name"
    | "year_model"
    | "hours"
    | "life_worked_percent"
    | "specs_json"
    | "condition"
    | "province"
    | "depreciation_method_used"
    | "family_usage_metric_type"
  >,
): SafeAssetSummary {
  const type = asText(row.type_label) || titleCase(asText(row.kind) || "Asset");
  const brand = asText(row.brand_name) || "Unknown";
  const model =
    asText(row.model_name) || asText(row.typed_model_name) || "Unknown";
  const year =
    asInt(row.year_model) > 0 ? String(asInt(row.year_model)) : "Unknown";
  const condition = asText(row.condition)
    ? titleCase(asText(row.condition))
    : "Unknown";
  const province = asText(row.province) || "Province not saved";
  const specs = isRecord(row.specs_json) ? row.specs_json : {};
  const renewalDate = readFirstText([
    specs.licenseRenewalDate,
    specs.license_renewal_date,
    specs.licenceRenewalDate,
    specs.licence_renewal_date,
  ]);
  const renewalTimestamp = /^\d{4}-\d{2}-\d{2}$/.test(renewalDate)
    ? Date.parse(`${renewalDate}T00:00:00.000Z`)
    : Number.NaN;
  const renewalWindow = Number.isFinite(renewalTimestamp)
    ? new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(renewalTimestamp))
    : '';
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const in30Days = todayUtc + 30 * 24 * 60 * 60 * 1000;
  const in6Months = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 6, today.getUTCDate());
  const renewalTiming: AssetDiscoveryRenewalTiming | null = !Number.isFinite(renewalTimestamp)
    ? null
    : renewalTimestamp < todayUtc
      ? 'overdue'
      : renewalTimestamp <= in30Days
        ? 'next_30_days'
        : renewalTimestamp <= in6Months
          ? 'next_6_months'
          : 'later';

  return {
    type,
    brand,
    model,
    year,
    usage: buildUsage(row),
    condition,
    province,
    renewalWindow,
    renewalTiming,
  };
}

function mapAsset(row: AssetDiscoveryRow): AssetDiscoveryAsset {
  return {
    id: row.id,
    ...safeSummary(row),
    enquiryId: row.enquiry_id,
    enquiryStatus: row.enquiry_status
      ? normalizeStatus(row.enquiry_status)
      : null,
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
  const name = businessName || asText(input.displayName) || "Aim4price account";
  const email = asText(input.profileEmail) || asText(input.accountEmail);
  const location = [asText(input.townCity), asText(input.province)]
    .filter(Boolean)
    .join(", ");

  return {
    name,
    businessName,
    phone: asText(input.phone),
    email,
    location,
  };
}

function mapEnquiryForAudience(
  row: EnquiryRow,
  audience: "target_owner" | "requester",
): AssetDiscoveryEnquiryDetail {
  const status = normalizeStatus(row.status);
  const isApproved = status === "approved";
  const savedRequesterType = asText(row.requester_account_type).toLowerCase();
  const requesterAccountType = savedRequesterType === "owner"
    ? "owner"
    : savedRequesterType === "licensing"
      ? "licensing"
      : "dealer";
  const requesterContact =
    audience === "target_owner" && isApproved
      ? contactDetails({
          businessName: row.requester_business_name,
          displayName: row.requester_display_name,
          phone: row.requester_phone,
          profileEmail: row.requester_email,
          accountEmail: row.requester_account_email,
          province: row.requester_province,
          townCity: row.requester_town_city,
        })
      : null;

  return {
    id: row.id,
    assetId: row.asset_register_item_id,
    status,
    createdAtIso: row.created_at || new Date().toISOString(),
    approvedAtIso: row.approved_at,
    deniedAtIso: row.denied_at,
    requestAgainAtIso: row.request_again_at,
    asset: safeSummary({ ...row, province: row.owner_province }),
    requesterAccountType,
    requesterMessage: isApproved ? asText(row.requester_message) : "",
    requesterContact,
    // Kept as a response alias so older dealer clients remain compatible
    // while all new code uses requesterContact.
    dealerContact:
      requesterAccountType === "dealer" ? requesterContact : null,
    ownerContact:
      audience === "requester" && isApproved
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
  const savedRequesterType = asText(row.requester_account_type).toLowerCase();
  return {
    id: row.id,
    assetId: row.asset_register_item_id,
    status: normalizeStatus(row.status),
    createdAtIso: row.created_at || new Date().toISOString(),
    updatedAtIso: row.updated_at || row.created_at || new Date().toISOString(),
    requestAgainAtIso: row.request_again_at,
    requesterAccountType: savedRequesterType === "owner"
      ? "owner"
      : savedRequesterType === "licensing"
        ? "licensing"
        : "dealer",
    asset: safeSummary({ ...row, province: row.owner_province }),
  };
}

async function ensureAssetDiscoveryTablesOnce(): Promise<void> {
  await ensureAccountProfileColumns();
  const db = getDb();
  await db.query("create extension if not exists pgcrypto");

  await db.query(`
    create table if not exists public.asset_discovery_enquiries (
      id uuid primary key default gen_random_uuid(),
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      owner_user_id text not null,
      requester_user_id text not null,
      requester_account_type text not null check (requester_account_type in ('owner', 'dealer', 'licensing')),
      requester_message text not null default '',
      dealer_user_id text,
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
      add column if not exists requester_user_id text,
      add column if not exists requester_account_type text,
      add column if not exists requester_message text not null default '',
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
    set
      requester_user_id = coalesce(nullif(trim(requester_user_id), ''), dealer_user_id),
      requester_account_type = case
        when requester_account_type in ('owner', 'dealer', 'licensing') then requester_account_type
        else 'dealer'
      end,
      requester_message = coalesce(nullif(requester_message, ''), dealer_message, '')
    where requester_user_id is null
       or trim(requester_user_id) = ''
       or requester_account_type is null
       or requester_account_type not in ('owner', 'dealer', 'licensing')
       or requester_message = ''
  `);

  await db.query(`
    alter table public.asset_discovery_enquiries
      alter column requester_user_id set not null,
      alter column requester_account_type set not null,
      alter column requester_account_type set default 'dealer',
      alter column dealer_user_id drop not null
  `);

  await db.query(`
    update public.asset_discovery_enquiries
    set status = case
      when status in ('pending', 'approved', 'temporarily_denied', 'retracted', 'expired', 'revoked') then status
      when status in ('denied', 'declined') then 'temporarily_denied'
      else 'pending'
    end
  `);

  await db.query(`
    do $$
    begin
      alter table public.asset_discovery_enquiries
        drop constraint if exists asset_discovery_enquiries_requester_type_check;
      alter table public.asset_discovery_enquiries
        drop constraint if exists asset_discovery_enquiries_requester_account_type_check;
      alter table public.asset_discovery_enquiries
        add constraint asset_discovery_enquiries_requester_type_check
        check (requester_account_type in ('owner', 'dealer', 'licensing'));
    end $$
  `);

  await db.query(`
    alter table public.asset_discovery_enquiries
      drop constraint if exists asset_discovery_enquiries_status_check
  `);
  await db.query(`
    alter table public.asset_discovery_enquiries
      add constraint asset_discovery_enquiries_status_check
      check (status in ('pending', 'approved', 'temporarily_denied', 'retracted', 'expired', 'revoked'))
  `);
  await db.query(`
    create index if not exists idx_asset_discovery_owner_status_created
      on public.asset_discovery_enquiries(owner_user_id, status, created_at desc)
  `);
  await db.query(`
    create index if not exists idx_asset_discovery_requester_status_created
      on public.asset_discovery_enquiries(requester_user_id, status, created_at desc)
  `);
  await db.query(`
    create index if not exists idx_asset_discovery_asset_requester
      on public.asset_discovery_enquiries(asset_register_item_id, requester_user_id)
  `);
  await db.query(`
    drop index if exists public.idx_asset_discovery_pending_once
  `);
  await db.query(`
    create unique index if not exists idx_asset_discovery_requester_pending_once
      on public.asset_discovery_enquiries(asset_register_item_id, requester_user_id)
      where status = 'pending'
  `);
  await db.query(`
    create index if not exists idx_asset_discovery_active_denial
      on public.asset_discovery_enquiries(asset_register_item_id, request_again_at desc)
      where status = 'temporarily_denied'
  `);
  await db.query(`
    create index if not exists idx_asset_discovery_requester_approval_expiry
      on public.asset_discovery_enquiries(requester_user_id, approved_at desc)
      where status = 'approved'
  `);

}

export async function ensureAssetDiscoveryTables(): Promise<void> {
  if (!assetDiscoveryTablesPromise) {
    assetDiscoveryTablesPromise = ensureAssetDiscoveryTablesOnce().catch(
      (error) => {
        assetDiscoveryTablesPromise = null;
        throw error;
      },
    );
  }
  await assetDiscoveryTablesPromise;
}

export async function getAssetDiscoveryBrowseAccess(input: {
  userId: string;
  accountType: string;
}): Promise<AssetDiscoveryBrowseAccess> {
  await ensureAssetDiscoveryTables();
  const requestedType = asText(input.accountType).toLowerCase();
  const accountType = requestedType === "owner"
    ? "owner"
    : requestedType === "licensing"
      ? "licensing"
      : "dealer";
  const db = getDb();

  if (accountType === "dealer" || accountType === "licensing") {
    const dealer = await db.query<{ allowed: boolean }>(
      `
        select (
          account_type = $2
          and account_status = 'active'
        ) as allowed
        from public.account_profiles
        where user_id = $1
        limit 1
      `,
      [input.userId, accountType],
    );

    if (!dealer.rows[0]?.allowed) {
      throw new Error("Asset Discovery is available to active owners, dealers and licence renewal experts.");
    }

    return {
      accountType,
      canBrowse: true,
      participationEnabled: true,
      eligibleAssetCount: 0,
      reason: "allowed",
    };
  }

  const result = await db.query<{
    participation_enabled: boolean | null;
    eligible_asset_count: number | string | null;
  }>(
    `
      select
        profile.discovery_participation_enabled as participation_enabled,
        count(eligible_asset.id)::int as eligible_asset_count
      from public.account_profiles profile
      left join (
        select asset.id, asset.user_id
        from public.asset_register_items asset
        left join public.equipment_families family
          on family.id = asset.equipment_family_id
        left join public.equipment_models model
          on model.id = asset.equipment_model_id
        left join public.brands brand
          on brand.id = model.brand_id
        where (${DISCOVERY_ELIGIBLE_ASSET_SQL})
          and ${RESOLVED_ASSET_TYPE_SQL} !~* '${PROPERTY_LIKE_ASSET_PATTERN}'
          and coalesce(asset.title, '') !~* '${PROPERTY_LIKE_ASSET_PATTERN}'
      ) eligible_asset on eligible_asset.user_id = profile.user_id
      where profile.user_id = $1
        and profile.account_type = 'owner'
        and profile.account_status = 'active'
      group by profile.discovery_participation_enabled
      limit 1
    `,
    [input.userId],
  );
  const row = result.rows[0];

  if (!row) {
    throw new Error("Asset Discovery is available to active owners and dealers.");
  }

  const participationEnabled = Boolean(row.participation_enabled);
  const eligibleAssetCount = Math.max(0, asInt(row.eligible_asset_count));
  const reason = !participationEnabled
    ? "participation_disabled"
    : eligibleAssetCount < 1
      ? "no_eligible_assets"
      : "allowed";

  return {
    accountType,
    canBrowse: reason === "allowed",
    participationEnabled,
    eligibleAssetCount,
    reason,
  };
}

export async function setOwnerDiscoveryParticipation(input: {
  ownerUserId: string;
  enabled: boolean;
}): Promise<AssetDiscoveryBrowseAccess> {
  await ensureAssetDiscoveryTables();
  const db = getDb();
  const updated = await db.query<{ user_id: string }>(
    `
      update public.account_profiles
      set discovery_participation_enabled = $2,
          updated_at = now()
      where user_id = $1
        and account_type = 'owner'
      returning user_id
    `,
    [input.ownerUserId, input.enabled],
  );

  if (!updated.rows[0]) {
    throw new Error("Only an owner can change Discovery participation.");
  }

  if (!input.enabled) {
    await db.query(
      `
        update public.asset_discovery_enquiries
        set status = 'revoked',
            approved_at = null,
            updated_at = now()
        where (owner_user_id = $1 or requester_user_id = $1)
          and status in ('pending', 'approved')
      `,
      [input.ownerUserId],
    );
  }

  return getAssetDiscoveryBrowseAccess({
    userId: input.ownerUserId,
    accountType: "owner",
  });
}

async function assertAssetDiscoveryRequesterEligible(input: {
  userId: string;
  accountType: string;
}): Promise<AssetDiscoveryBrowseAccess> {
  const access = await getAssetDiscoveryBrowseAccess(input);
  if (!access.canBrowse) {
    throw new Error(
      access.reason === "participation_disabled"
        ? "Enable Discovery participation before browsing or sending enquiries."
        : "Add an eligible Aim4price asset before browsing or sending enquiries.",
    );
  }
  return access;
}

function baseAssetWhere(input: {
  viewerUserId: string;
  viewerAccountType?: string;
  search?: string;
  province?: string;
  type?: string;
  renewalTiming?: string;
  enquiryStatus?: string;
}) {
  const licensingViewer = asText(input.viewerAccountType).toLowerCase() === 'licensing';
  const params: unknown[] = [input.viewerUserId];
  const where = [
    "owner.account_type = 'owner'",
    "owner.account_status = 'active'",
    "owner.discovery_participation_enabled = true",
    "asset.user_id <> $1",
    `(${licensingViewer ? LICENSING_DISCOVERY_ASSET_SQL : DISCOVERY_ELIGIBLE_ASSET_SQL})`,
    `${RESOLVED_ASSET_TYPE_SQL} !~* '${PROPERTY_LIKE_ASSET_PATTERN}'`,
    `coalesce(asset.title, '') !~* '${PROPERTY_LIKE_ASSET_PATTERN}'`,
  ];
  if (!licensingViewer) {
    where.push(`(
      not exists (
        select 1
        from public.asset_discovery_enquiries blocked_enquiry
        where blocked_enquiry.asset_register_item_id = asset.id
          and blocked_enquiry.status = 'temporarily_denied'
          and blocked_enquiry.request_again_at > now()
      )
      or exists (
        select 1
        from public.asset_discovery_enquiries viewer_denial
        where viewer_denial.asset_register_item_id = asset.id
          and viewer_denial.requester_user_id = $1
          and viewer_denial.status = 'temporarily_denied'
          and viewer_denial.request_again_at > now()
      )
    )`);
  }
  if (licensingViewer) {
    const renewalTiming = asText(input.renewalTiming).toLowerCase();
    if (renewalTiming === 'overdue') {
      where.push(`${SAFE_LICENSE_RENEWAL_DATE_SQL} < current_date`);
    } else if (renewalTiming === 'next_30_days') {
      where.push(`${SAFE_LICENSE_RENEWAL_DATE_SQL} between current_date and current_date + interval '30 days'`);
    } else if (renewalTiming === 'next_6_months') {
      where.push(`${SAFE_LICENSE_RENEWAL_DATE_SQL} between current_date and current_date + interval '6 months'`);
    } else if (renewalTiming === 'later') {
      where.push(`${SAFE_LICENSE_RENEWAL_DATE_SQL} > current_date + interval '6 months'`);
    }

    const requestedStatus = asText(input.enquiryStatus).toLowerCase();
    const savedStatus = requestedStatus === 'won'
      ? 'approved'
      : requestedStatus === 'denied'
        ? 'temporarily_denied'
        : requestedStatus;
    const latestStatusSql = `(select latest_enquiry.status
      from public.asset_discovery_enquiries latest_enquiry
      where latest_enquiry.asset_register_item_id = asset.id
        and latest_enquiry.requester_user_id = $1
        and latest_enquiry.requester_account_type = 'licensing'
        and latest_enquiry.status in ('pending', 'approved', 'temporarily_denied')
      order by latest_enquiry.created_at desc
      limit 1)`;
    if (requestedStatus === 'available') {
      where.push(`${latestStatusSql} is null`);
    } else if (['pending', 'approved', 'temporarily_denied'].includes(savedStatus)) {
      params.push(savedStatus);
      where.push(`${latestStatusSql} = $${params.length}`);
    }
  }

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
      or concat_ws(' ', nullif(asset.hours::text, ''), 'hours') ilike ${p} escape '\\'
      or concat_ws(' ', nullif(asset.hours::text, ''), 'km') ilike ${p} escape '\\'
      or coalesce(asset.life_worked_percent::text, '') ilike ${p} escape '\\'
      or concat_ws(' ', nullif(asset.life_worked_percent::text, ''), '% worked') ilike ${p} escape '\\'
      or coalesce(asset.condition, '') ilike ${p} escape '\\'
      or coalesce(owner.province, '') ilike ${p} escape '\\'
      or ${PROVINCE_ABBREVIATION_SQL} ilike ${p} escape '\\'
    )`);
  }

  const province = asText(input.province);
  if (province === "__province_not_saved__") {
    where.push("coalesce(nullif(trim(owner.province), ''), '') = ''");
  } else if (province && province !== "all") {
    params.push(province.toLowerCase());
    where.push(`lower(coalesce(owner.province, '')) = $${params.length}`);
  }

  const type = asText(input.type);
  if (type && type !== "all") {
    params.push(type.toLowerCase());
    where.push(`lower(${RESOLVED_ASSET_TYPE_SQL}) = $${params.length}`);
  }

  return { params, whereClause: `where ${where.join(" and ")}` };
}

export async function listAssetDiscoveryAssets(input: {
  viewerUserId: string;
  viewerAccountType: string;
  search?: string;
  province?: string;
  type?: string;
  renewalTiming?: string;
  enquiryStatus?: string;
  focusAssetId?: string;
  page?: number;
  pageSize?: number;
}): Promise<AssetDiscoveryListResult> {
  await ensureAssetDiscoveryTables();
  await assertAssetDiscoveryRequesterEligible({
    userId: input.viewerUserId,
    accountType: input.viewerAccountType,
  });
  const db = getDb();
  const { params, whereClause } = baseAssetWhere(input);
  const requestedPage = positiveInt(input.page, 1);
  const pageSize = normalizeDiscoveryPageSize(input.pageSize);

  const summarySql = `
    select
      count(*)::int as total_assets,
      count(distinct ${RESOLVED_ASSET_TYPE_SQL})::int as type_count,
      count(distinct nullif(trim(owner.province), ''))::int as province_count,
      count(*) filter (
        where ${SAFE_LICENSE_RENEWAL_DATE_SQL} between current_date and current_date + interval '30 days'
      )::int as due_soon_count,
      count(*) filter (
        where ${SAFE_LICENSE_RENEWAL_DATE_SQL} < current_date
      )::int as overdue_count
    from public.asset_register_items asset
    join public.account_profiles owner on owner.user_id = asset.user_id
    left join public.equipment_families family on family.id = asset.equipment_family_id
    left join public.equipment_models model on model.id = asset.equipment_model_id
    left join public.brands brand on brand.id = model.brand_id
    ${whereClause}
  `;

  const optionWhere = baseAssetWhere({
    viewerUserId: input.viewerUserId,
    viewerAccountType: input.viewerAccountType,
  });
  const [summaryRows, provinceRows, typeRows] = await Promise.all([
    db.query<AssetDiscoverySummaryRow>(summarySql, params),
    db.query<OptionRow>(
      `
        select nullif(trim(owner.province), '') as value, count(*)::int as count
        from public.asset_register_items asset
        join public.account_profiles owner on owner.user_id = asset.user_id
        left join public.equipment_families family on family.id = asset.equipment_family_id
        left join public.equipment_models model on model.id = asset.equipment_model_id
        left join public.brands brand on brand.id = model.brand_id
        ${optionWhere.whereClause}
        group by nullif(trim(owner.province), '')
        order by nullif(trim(owner.province), '') asc nulls last
      `,
      optionWhere.params,
    ),
    db.query<OptionRow>(
      `
        select ${RESOLVED_ASSET_TYPE_SQL} as value, count(*)::int as count
        from public.asset_register_items asset
        join public.account_profiles owner on owner.user_id = asset.user_id
        left join public.equipment_families family on family.id = asset.equipment_family_id
        left join public.equipment_models model on model.id = asset.equipment_model_id
        left join public.brands brand on brand.id = model.brand_id
        ${optionWhere.whereClause}
        group by ${RESOLVED_ASSET_TYPE_SQL}
        order by ${RESOLVED_ASSET_TYPE_SQL} asc
      `,
      optionWhere.params,
    ),
  ]);

  const summaryRow = summaryRows.rows[0];
  const totalItems = Math.max(0, asInt(summaryRow?.total_assets));
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const offset = (page - 1) * pageSize;

  const listParams = [...params];
  const licensingViewer = asText(input.viewerAccountType).toLowerCase() === 'licensing';
  const focusAssetId = asText(input.focusAssetId);
  let focusOrderSql = "";
  if (focusAssetId) {
    listParams.push(focusAssetId);
    focusOrderSql = `case when asset.id::text = $${listParams.length} then 0 else 1 end,`;
  }
  listParams.push(pageSize, offset);
  const limitParam = `$${listParams.length - 1}`;
  const offsetParam = `$${listParams.length}`;

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
      case when enquiry.is_active then enquiry.id::text else null end as enquiry_id,
      case when enquiry.is_active then enquiry.status else null end as enquiry_status,
      case when enquiry.is_active then enquiry.request_again_at::text else null end as request_again_at,
      case when enquiry.is_active then enquiry.approved_at::text else null end as approved_at
    from public.asset_register_items asset
    join public.account_profiles owner on owner.user_id = asset.user_id
    left join public.equipment_families family on family.id = asset.equipment_family_id
    left join public.equipment_models model on model.id = asset.equipment_model_id
    left join public.brands brand on brand.id = model.brand_id
    left join lateral (
      select
        e.id,
        e.status,
        e.request_again_at,
        e.approved_at,
        e.created_at,
        case
          when e.requester_account_type = 'licensing' and e.status in ('approved', 'temporarily_denied') then true
          when e.status = 'approved' then
            coalesce(e.approved_at, e.updated_at, e.created_at) > now() - interval '3 months'
          when e.status = 'temporarily_denied' then
            e.request_again_at > now()
          else true
        end as is_active
      from public.asset_discovery_enquiries e
      where e.asset_register_item_id = asset.id
        and e.requester_user_id = $1
        and e.status in ('pending', 'approved', 'temporarily_denied')
      order by e.created_at desc
      limit 1
    ) enquiry on true
    ${whereClause}
    order by
      ${focusOrderSql}
      case
        when enquiry.is_active and enquiry.status = 'approved' then 0
        when enquiry.is_active and enquiry.status = 'pending' then 1
        when enquiry.is_active and enquiry.status = 'temporarily_denied' then 2
        else 3
      end,
      case when enquiry.is_active then enquiry.created_at end desc nulls last,
      ${licensingViewer ? `${SAFE_LICENSE_RENEWAL_DATE_SQL} asc nulls last,` : ''}
      asset.updated_at desc nulls last,
      asset.created_at desc nulls last,
      asset.id desc
    limit ${limitParam}
    offset ${offsetParam}
  `;

  const assetRows = await db.query<AssetDiscoveryRow>(listSql, listParams);
  const rangeStart = totalItems ? offset + 1 : 0;
  const rangeEnd = totalItems ? Math.min(offset + pageSize, totalItems) : 0;

  return {
    assets: assetRows.rows.map(mapAsset),
    provinceOptions: provinceRows.rows
      .map((row) => ({
        value: asText(row.value) || "__province_not_saved__",
        label: asText(row.value) || "Province not saved",
        count: asInt(row.count),
      }))
      .filter((row) => row.count > 0),
    typeOptions: typeRows.rows
      .map((row) => ({
        value: asText(row.value),
        label: asText(row.value),
        count: asInt(row.count),
      }))
      .filter((row) => row.value && row.count > 0),
    summary: {
      totalAssets: totalItems,
      typeCount: Math.max(0, asInt(summaryRow?.type_count)),
      provinceCount: Math.max(0, asInt(summaryRow?.province_count)),
      dueSoonCount: Math.max(0, asInt(summaryRow?.due_soon_count)),
      overdueCount: Math.max(0, asInt(summaryRow?.overdue_count)),
    },
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      rangeStart,
      rangeEnd,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
  };
}

async function findSafeAssetForEnquiry(
  assetId: string,
  requesterUserId: string,
  requesterAccountType: "owner" | "dealer" | "licensing",
): Promise<AssetOwnerRow | null> {
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
        and owner.discovery_participation_enabled = true
        and (
          ($3 = 'licensing' and (${LICENSING_DISCOVERY_ASSET_SQL}))
          or ($3 <> 'licensing' and (${DISCOVERY_ELIGIBLE_ASSET_SQL}))
        )
        and (
          $3 <> 'licensing'
          or not exists (
            select 1
            from public.asset_discovery_enquiries permanent_licensing_denial
            where permanent_licensing_denial.asset_register_item_id = asset.id
              and permanent_licensing_denial.requester_user_id = $2
              and permanent_licensing_denial.requester_account_type = 'licensing'
              and permanent_licensing_denial.status = 'temporarily_denied'
          )
        )
        and ${RESOLVED_ASSET_TYPE_SQL} !~* '${PROPERTY_LIKE_ASSET_PATTERN}'
        and coalesce(asset.title, '') !~* '${PROPERTY_LIKE_ASSET_PATTERN}'
        and ($3 = 'licensing' or not exists (
          select 1
          from public.asset_discovery_enquiries blocked_enquiry
          where blocked_enquiry.asset_register_item_id = asset.id
            and blocked_enquiry.status = 'temporarily_denied'
            and blocked_enquiry.request_again_at > now()
        ))
      limit 1
    `,
    [assetId, requesterUserId, requesterAccountType],
  );

  return result.rows[0] ?? null;
}

export async function createAssetDiscoveryEnquiry(input: {
  requesterUserId: string;
  requesterAccountType: "owner" | "dealer" | "licensing";
  assetId: string;
  message: string;
}): Promise<AssetDiscoveryEnquiryDetail> {
  await ensureAssetDiscoveryTables();

  const assetId = asText(input.assetId);
  if (!assetId) throw new Error("Asset is required.");

  await assertAssetDiscoveryRequesterEligible({
    userId: input.requesterUserId,
    accountType: input.requesterAccountType,
  });

  const asset = await findSafeAssetForEnquiry(
    assetId,
    input.requesterUserId,
    input.requesterAccountType,
  );
  if (!asset) throw new Error("Asset is not available for Discovery.");

  const db = getDb();
  const existing = await db.query<ExistingEnquiryRow>(
    `
      select id::text, status, request_again_at::text, approved_at::text
      from public.asset_discovery_enquiries
      where asset_register_item_id = $1::uuid
        and requester_user_id = $2
      order by created_at desc
      limit 1
    `,
    [assetId, input.requesterUserId],
  );
  const current = existing.rows[0];
  const approvalCutoff = new Date();
  approvalCutoff.setMonth(approvalCutoff.getMonth() - 3);

  if (current?.status === "pending") {
    throw new Error("You already have a pending enquiry for this asset.");
  }

  if (
    current?.status === "approved" &&
    current.approved_at &&
    Date.parse(current.approved_at) > approvalCutoff.getTime()
  ) {
    throw new Error("Contact access is already open for this asset.");
  }

  if (
    current?.status === "temporarily_denied" &&
    input.requesterAccountType === "licensing"
  ) {
    throw new Error("The owner declined renewal help for this asset. You cannot offer again.");
  }

  if (
    current?.status === "temporarily_denied" &&
    current.request_again_at &&
    Date.parse(current.request_again_at) > Date.now()
  ) {
    throw new Error(
      `This enquiry was temporarily denied. You can enquire again after ${new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Johannesburg" }).format(new Date(current.request_again_at))}.`,
    );
  }

  const message = asText(input.message).slice(0, 600);
  const result = await db.query<{ id: string }>(
    `
      insert into public.asset_discovery_enquiries (
        asset_register_item_id,
        owner_user_id,
        requester_user_id,
        requester_account_type,
        requester_message,
        dealer_user_id,
        status,
        dealer_message,
        created_at,
        updated_at
      )
      select
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        case when $4 = 'dealer' then $3 else null end,
        'pending',
        case when $4 = 'dealer' then $5 else '' end,
        now(),
        now()
      where not exists (
        select 1
        from public.asset_discovery_enquiries blocked_enquiry
        where blocked_enquiry.asset_register_item_id = $1::uuid
          and blocked_enquiry.status = 'temporarily_denied'
          and blocked_enquiry.request_again_at > now()
      )
        and (
          $4 <> 'licensing'
          or not exists (
            select 1
            from public.asset_discovery_enquiries permanent_licensing_denial
            where permanent_licensing_denial.asset_register_item_id = $1::uuid
              and permanent_licensing_denial.requester_user_id = $3
              and permanent_licensing_denial.requester_account_type = 'licensing'
              and permanent_licensing_denial.status = 'temporarily_denied'
          )
        )
      returning id::text
    `,
    [
      asset.id,
      asset.owner_user_id,
      input.requesterUserId,
      input.requesterAccountType,
      message,
    ],
  );

  const enquiryId = result.rows[0]?.id;
  if (!enquiryId) throw new Error("Asset is not available for Discovery.");

  return getAssetDiscoveryEnquiryForUser({
    enquiryId,
    userId: input.requesterUserId,
    accountType: input.requesterAccountType,
  });
}

function normalizePhotoSources(value: unknown): string[] {
  let entries: unknown[] = [];

  if (Array.isArray(value)) {
    entries = value;
  } else if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      entries = Array.isArray(parsed) ? parsed : [];
    } catch {
      entries = [];
    }
  }

  const seen = new Set<string>();
  return entries
    .map((entry) =>
      typeof entry === "string"
        ? entry.trim()
        : isRecord(entry)
          ? asText(entry.url) || asText(entry.photoUrl)
          : "",
    )
    .filter((entry) => {
      if (!entry || seen.has(entry)) return false;
      seen.add(entry);
      return true;
    })
    .slice(0, 12);
}

async function loadDiscoveryDetailRow(
  assetId: string,
): Promise<AssetDiscoveryDetailRow | null> {
  const result = await getDb().query<AssetDiscoveryDetailRow>(
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
        coalesce(
          to_jsonb(asset)->'photos',
          to_jsonb(asset)->'photo_urls',
          to_jsonb(asset)->'image_urls',
          to_jsonb(asset)->'images',
          '[]'::jsonb
        ) as photos,
        owner.province,
        owner.business_name as owner_business_name,
        owner.display_name as owner_display_name,
        owner.phone as owner_phone,
        owner.marketplace_email as owner_email,
        ownerUser.email as owner_account_email,
        owner.town_city as owner_town_city,
        asset.selected_method,
        asset.depreciation_method_used,
        family.usage_metric_type as family_usage_metric_type,
        null::text as enquiry_id,
        null::text as enquiry_status,
        null::text as request_again_at,
        null::text as approved_at
      from public.asset_register_items asset
      join public.account_profiles owner on owner.user_id = asset.user_id
      left join public."user" ownerUser on ownerUser.id = asset.user_id
      left join public.equipment_families family on family.id = asset.equipment_family_id
      left join public.equipment_models model on model.id = asset.equipment_model_id
      left join public.brands brand on brand.id = model.brand_id
      where asset.id = $1::uuid
        and owner.account_type = 'owner'
        and owner.account_status = 'active'
        and ((${DISCOVERY_ELIGIBLE_ASSET_SQL}) or (${LICENSING_DISCOVERY_ASSET_SQL}))
        and ${RESOLVED_ASSET_TYPE_SQL} !~* '${PROPERTY_LIKE_ASSET_PATTERN}'
        and coalesce(asset.title, '') !~* '${PROPERTY_LIKE_ASSET_PATTERN}'
      limit 1
    `,
    [assetId],
  );

  return result.rows[0] ?? null;
}

async function resolveDiscoveryAssetAccess(input: {
  asset: AssetDiscoveryDetailRow;
  viewerUserId: string;
  viewerAccountType: "owner" | "dealer" | "licensing";
  requireDiscoveryExposure: boolean;
}): Promise<{
  enquiryId: string | null;
  enquiryStatus: AssetDiscoveryEnquiryStatus | null;
  approvedEnquiry: boolean;
  dealerShare: boolean;
}> {
  if (input.asset.owner_user_id === input.viewerUserId) {
    throw new Error("Discovery asset not found.");
  }

  const db = getDb();
  const ownerState = await db.query<{
    discovery_participation_enabled: boolean | null;
  }>(
    `
      select discovery_participation_enabled
      from public.account_profiles
      where user_id = $1
        and account_type = 'owner'
        and account_status = 'active'
      limit 1
    `,
    [input.asset.owner_user_id],
  );
  const ownerParticipates = Boolean(
    ownerState.rows[0]?.discovery_participation_enabled,
  );

  if (input.requireDiscoveryExposure && !ownerParticipates) {
    throw new Error("Discovery asset not found.");
  }

  const enquiry = await db.query<{
    id: string;
    status: string | null;
    approved_at: string | null;
    updated_at: string | null;
    created_at: string | null;
  }>(
    `
      select
        id::text,
        status,
        approved_at::text,
        updated_at::text,
        created_at::text
      from public.asset_discovery_enquiries
      where asset_register_item_id = $1::uuid
        and requester_user_id = $2
      order by created_at desc
      limit 1
    `,
    [input.asset.id, input.viewerUserId],
  );
  const enquiryRow = enquiry.rows[0];
  const enquiryStatus = enquiryRow?.status
    ? normalizeStatus(enquiryRow.status)
    : null;
  let requesterEligible = false;
  try {
    requesterEligible = (
      await getAssetDiscoveryBrowseAccess({
        userId: input.viewerUserId,
        accountType: input.viewerAccountType,
      })
    ).canBrowse;
  } catch {
    requesterEligible = false;
  }
  const approvedEnquiry =
    ownerParticipates &&
    requesterEligible &&
    enquiryStatus === "approved" &&
    activeApproval(
      enquiryRow?.approved_at ||
        enquiryRow?.updated_at ||
        enquiryRow?.created_at,
    );

  let dealerShare = false;
  if (input.viewerAccountType === "dealer") {
    await Promise.all([
      ensurePartnerAccessTables(),
      ensureDealerMaintenanceTrackerTables(),
    ]);
    const directShare = await db.query<{ allowed: boolean }>(
      `
        select (
          exists (
            select 1
            from public.asset_leads lead
            where lead.asset_register_item_id = $1::uuid
              and lead.owner_user_id = $2
              and lead.partner_user_id = $3
              and lead.status in ('sent', 'viewed', 'accepted', 'quoted')
          )
          or exists (
            select 1
            from public.dealer_maintenance_access access
            where access.asset_register_item_id = $1::uuid
              and access.owner_user_id = $2
              and access.dealer_user_id = $3
              and access.is_active = true
          )
        ) as allowed
      `,
      [input.asset.id, input.asset.owner_user_id, input.viewerUserId],
    );
    dealerShare = requesterEligible && Boolean(directShare.rows[0]?.allowed);
  }

  return {
    enquiryId: enquiryRow?.id ?? null,
    enquiryStatus,
    approvedEnquiry,
    dealerShare,
  };
}

export async function getAssetDiscoveryAssetDetails(input: {
  assetId: string;
  viewerUserId: string;
  viewerAccountType: "owner" | "dealer" | "licensing";
}): Promise<AssetDiscoveryAssetDetails> {
  await ensureAssetDiscoveryTables();
  await assertAssetDiscoveryRequesterEligible({
    userId: input.viewerUserId,
    accountType: input.viewerAccountType,
  });

  const asset = await loadDiscoveryDetailRow(asText(input.assetId));
  if (!asset) throw new Error("Discovery asset not found.");

  const access = await resolveDiscoveryAssetAccess({
    asset,
    viewerUserId: input.viewerUserId,
    viewerAccountType: input.viewerAccountType,
    requireDiscoveryExposure: true,
  });
  const photoSources = normalizePhotoSources(asset.photos);
  const photosUnlocked = access.approvedEnquiry || access.dealerShare;
  const ownerContact = access.approvedEnquiry
    ? contactDetails({
        businessName: asset.owner_business_name,
        displayName: asset.owner_display_name,
        phone: asset.owner_phone,
        profileEmail: asset.owner_email,
        accountEmail: asset.owner_account_email,
        province: asset.province,
        townCity: asset.owner_town_city,
      })
    : null;

  return {
    asset: { id: asset.id, ...safeSummary(asset) },
    enquiryId: access.enquiryId,
    enquiryStatus: access.enquiryStatus,
    photosUnlocked,
    contactUnlocked: Boolean(ownerContact),
    accessSource: access.approvedEnquiry
      ? "approved_enquiry"
      : access.dealerShare
        ? "dealer_share"
        : null,
    photoUrls: photosUnlocked
      ? photoSources.map(
          (_source, index) =>
            `/api/asset-discovery/assets/${encodeURIComponent(asset.id)}/photos/${index}`,
        )
      : [],
    ownerContact,
  };
}

function decodeDataImage(source: string): AssetDiscoveryPhoto | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\s]+)$/i.exec(
    source,
  );
  if (!match) return null;
  const data = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (!data.length) return null;
  return {
    data,
    contentType: match[1].toLowerCase(),
    fileName: `asset-photo.${match[1].split("/")[1] === "jpeg" ? "jpg" : match[1].split("/")[1]}`,
  };
}

function internalUploadId(source: string): string {
  const match = /^\/api\/asset-register\/uploads\/([a-f0-9-]{20,})(?:[/?#]|$)/i.exec(
    source,
  );
  return match?.[1] ?? "";
}

function isSafeRemotePhotoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function getAssetDiscoveryPhoto(input: {
  assetId: string;
  photoIndex: number;
  viewerUserId: string;
  viewerAccountType: "owner" | "dealer" | "licensing";
}): Promise<AssetDiscoveryPhoto> {
  await ensureAssetDiscoveryTables();
  const asset = await loadDiscoveryDetailRow(asText(input.assetId));
  if (!asset) throw new Error("Discovery photo not found.");

  const access = await resolveDiscoveryAssetAccess({
    asset,
    viewerUserId: input.viewerUserId,
    viewerAccountType: input.viewerAccountType,
    requireDiscoveryExposure: false,
  });
  if (!access.approvedEnquiry && !access.dealerShare) {
    throw new Error("Discovery photo not found.");
  }

  const photoSources = normalizePhotoSources(asset.photos);
  const source = photoSources[input.photoIndex];
  if (!source) throw new Error("Discovery photo not found.");

  const inline = decodeDataImage(source);
  if (inline) return inline;

  const uploadId = internalUploadId(source);
  if (uploadId) {
    const upload = await getLegacyAssetRegisterUploadResponse(uploadId);
    if (!upload || !upload.mimeType.toLowerCase().startsWith("image/")) {
      throw new Error("Discovery photo not found.");
    }
    return {
      data: upload.data,
      contentType: upload.mimeType,
      fileName: upload.fileName,
    };
  }

  if (!isSafeRemotePhotoUrl(source)) {
    throw new Error("Discovery photo not found.");
  }

  const response = await fetch(source, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  const contentType = asText(response.headers.get("content-type"))
    .split(";")[0]
    .toLowerCase();
  if (!response.ok || !contentType.startsWith("image/")) {
    throw new Error("Discovery photo not found.");
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length || data.length > 12 * 1024 * 1024) {
    throw new Error("Discovery photo not found.");
  }

  return {
    data,
    contentType,
    fileName: `asset-photo.${contentType.split("/")[1] || "jpg"}`,
  };
}

function enquirySelectSql(whereClause: string): string {
  return `
    select
      enquiry.id::text,
      enquiry.asset_register_item_id::text,
      enquiry.owner_user_id,
      owner.account_status as owner_account_status,
      owner.discovery_participation_enabled as owner_discovery_participation_enabled,
      enquiry.requester_user_id,
      enquiry.requester_account_type,
      requester.account_status as requester_account_status,
      requester.discovery_participation_enabled as requester_discovery_participation_enabled,
      enquiry.status,
      enquiry.requester_message,
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
      requester.business_name as requester_business_name,
      requester.display_name as requester_display_name,
      requester.phone as requester_phone,
      requester.marketplace_email as requester_email,
      requesterUser.email as requester_account_email,
      requester.province as requester_province,
      requester.town_city as requester_town_city
    from public.asset_discovery_enquiries enquiry
    join public.asset_register_items asset on asset.id = enquiry.asset_register_item_id
    left join public.equipment_families family on family.id = asset.equipment_family_id
    left join public.equipment_models model on model.id = asset.equipment_model_id
    left join public.brands brand on brand.id = model.brand_id
    join public.account_profiles owner on owner.user_id = enquiry.owner_user_id
    join public.account_profiles requester on requester.user_id = enquiry.requester_user_id
    left join public."user" ownerUser on ownerUser.id = enquiry.owner_user_id
    left join public."user" requesterUser on requesterUser.id = enquiry.requester_user_id
    ${whereClause}
  `;
}

export async function getAssetDiscoveryEnquiryForUser(input: {
  enquiryId: string;
  userId: string;
  accountType: AssetDiscoveryAccountType;
}): Promise<AssetDiscoveryEnquiryDetail> {
  await ensureAssetDiscoveryTables();
  const db = getDb();
  const accountType = asText(input.accountType).toLowerCase();
  if (
    accountType !== "owner" &&
    accountType !== "dealer" &&
    accountType !== "licensing"
  ) {
    throw new Error("Discovery enquiry not found.");
  }

  const result = await db.query<EnquiryRow>(
    enquirySelectSql(
      `where enquiry.id = $1::uuid
        and (enquiry.owner_user_id = $2 or enquiry.requester_user_id = $2)
       limit 1`,
    ),
    [input.enquiryId, input.userId],
  );

  const row = result.rows[0];
  if (!row) throw new Error("Discovery enquiry not found.");

  if (
    asText(row.owner_account_status) !== "active" ||
    !row.owner_discovery_participation_enabled
  ) {
    throw new Error("Discovery enquiry not found.");
  }

  await assertAssetDiscoveryRequesterEligible({
    userId: row.requester_user_id,
    accountType: row.requester_account_type || "dealer",
  });

  const audience =
    row.owner_user_id === input.userId ? "target_owner" : "requester";

  if (
    normalizeStatus(row.status) === "approved" &&
    !activeApproval(row.approved_at || row.updated_at || row.created_at)
  ) {
    await db.query(
      `
        update public.asset_discovery_enquiries
        set status = 'expired', updated_at = now()
        where id = $1::uuid and status = 'approved'
      `,
      [input.enquiryId],
    );
    throw new Error("Discovery enquiry access has expired.");
  }

  return mapEnquiryForAudience(row, audience);
}

export async function retractAssetDiscoveryEnquiry(input: {
  enquiryId: string;
  requesterUserId: string;
  requesterAccountType: "owner" | "dealer" | "licensing";
}): Promise<void> {
  await ensureAssetDiscoveryTables();
  await assertAssetDiscoveryRequesterEligible({
    userId: input.requesterUserId,
    accountType: input.requesterAccountType,
  });
  const db = getDb();
  const result = await db.query<{ id: string }>(
    `
      update public.asset_discovery_enquiries
      set status = 'retracted',
          updated_at = now()
      where id = $1::uuid
        and requester_user_id = $2
        and status = 'pending'
      returning id::text
    `,
    [input.enquiryId, input.requesterUserId],
  );

  if (!result.rows[0]?.id) {
    throw new Error("Discovery enquiry not found or already decided.");
  }
}

export async function updateAssetDiscoveryOwnerDecision(input: {
  enquiryId: string;
  ownerUserId: string;
  decision: string;
}): Promise<AssetDiscoveryEnquiryDetail> {
  await ensureAssetDiscoveryTables();
  await getAssetDiscoveryEnquiryForUser({
    enquiryId: input.enquiryId,
    userId: input.ownerUserId,
    accountType: "owner",
  });
  const decision = asText(input.decision).toLowerCase();
  const nextStatus =
    decision === "yes" || decision === "approved" || decision === "approve"
      ? "approved"
      : decision === "no" || decision === "denied" || decision === "deny"
        ? "temporarily_denied"
        : null;

  if (!nextStatus) throw new Error("Choose Yes or No.");

  const db = getDb();
  const result = await db.query<{ id: string }>(
    nextStatus === "temporarily_denied"
      ? `
        with target as (
          select candidate.id, candidate.asset_register_item_id, candidate.requester_account_type
          from public.asset_discovery_enquiries candidate
          where candidate.id = $1::uuid
            and candidate.owner_user_id = $2
            and candidate.status = 'pending'
            and exists (
              select 1
              from public.account_profiles owner
              where owner.user_id = $2
                and owner.account_type = 'owner'
                and owner.account_status = 'active'
                and owner.discovery_participation_enabled = true
            )
            and exists (
              select 1
              from public.account_profiles requester
              where requester.user_id = candidate.requester_user_id
                and requester.account_status = 'active'
                and (
                  (
                    candidate.requester_account_type = 'dealer'
                    and requester.account_type = 'dealer'
                  )
                  or (
                    candidate.requester_account_type = 'licensing'
                    and requester.account_type = 'licensing'
                  )
                  or (
                    candidate.requester_account_type = 'owner'
                    and requester.account_type = 'owner'
                    and requester.discovery_participation_enabled = true
                  )
                )
            )
          limit 1
        ), denied as (
          update public.asset_discovery_enquiries enquiry
          set
            status = 'temporarily_denied',
            denied_at = now(),
            request_again_at = case
              when target.requester_account_type = 'licensing' then null
              else now() + interval '90 days'
            end,
            updated_at = now()
          from target
          where (
              (
                target.requester_account_type = 'licensing'
                and enquiry.id = target.id
              )
              or (
                target.requester_account_type <> 'licensing'
                and enquiry.asset_register_item_id = target.asset_register_item_id
              )
            )
            and enquiry.owner_user_id = $2
            and enquiry.status = 'pending'
          returning enquiry.id
        )
        select target.id::text
        from target
      `
      : `
        update public.asset_discovery_enquiries candidate
        set
          status = 'approved',
          approved_at = now(),
          denied_at = null,
          request_again_at = null,
          updated_at = now()
        where candidate.id = $1::uuid
          and candidate.owner_user_id = $2
          and candidate.status = 'pending'
          and exists (
            select 1
            from public.account_profiles owner
            where owner.user_id = $2
              and owner.account_type = 'owner'
              and owner.account_status = 'active'
              and owner.discovery_participation_enabled = true
          )
          and exists (
            select 1
            from public.account_profiles requester
            where requester.user_id = candidate.requester_user_id
              and requester.account_status = 'active'
              and (
                (
                  candidate.requester_account_type = 'dealer'
                  and requester.account_type = 'dealer'
                )
                or (
                  candidate.requester_account_type = 'licensing'
                  and requester.account_type = 'licensing'
                )
                or (
                  candidate.requester_account_type = 'owner'
                  and requester.account_type = 'owner'
                  and requester.discovery_participation_enabled = true
                )
              )
          )
        returning id::text
      `,
    [input.enquiryId, input.ownerUserId],
  );

  if (!result.rows[0]?.id)
    throw new Error("Discovery enquiry not found or already decided.");

  if (nextStatus === "approved") {
    const approved = await db.query<{
      asset_register_item_id: string;
      requester_user_id: string;
      requester_account_type: string;
      requester_message: string | null;
    }>(
      `
        select
          asset_register_item_id::text,
          requester_user_id,
          requester_account_type,
          requester_message
        from public.asset_discovery_enquiries
        where id = $1::uuid
        limit 1
      `,
      [result.rows[0].id],
    );
    const approvedEnquiry = approved.rows[0];

    if (approvedEnquiry?.requester_account_type === "licensing") {
      try {
        await createAssetLead({
          ownerUserId: input.ownerUserId,
          assetId: approvedEnquiry.asset_register_item_id,
          partnerUserId: approvedEnquiry.requester_user_id,
          leadType: "license_renewal",
          ownerMessage: approvedEnquiry.requester_message,
          includedSections: {
            assetDetails: true,
            mainPhoto: true,
            photos: true,
            documents: true,
            source: "asset_discovery",
          },
        });
      } catch (error) {
        await db.query(
          `
            update public.asset_discovery_enquiries
            set status = 'pending',
                approved_at = null,
                updated_at = now()
            where id = $1::uuid
              and status = 'approved'
          `,
          [result.rows[0].id],
        );
        throw error;
      }
    }
  }

  return getAssetDiscoveryEnquiryForUser({
    enquiryId: result.rows[0].id,
    userId: input.ownerUserId,
    accountType: "owner",
  });
}

export async function listPendingAssetDiscoveryEnquiriesForOwner(
  ownerUserId: string,
): Promise<AssetDiscoveryNotification[]> {
  await ensureAssetDiscoveryTables();
  const db = getDb();
  const result = await db.query<EnquiryRow>(
    enquirySelectSql(
      `where enquiry.owner_user_id = $1
         and enquiry.status = 'pending'
         and owner.account_status = 'active'
         and owner.discovery_participation_enabled = true
         and requester.account_status = 'active'
         and (
           (
             enquiry.requester_account_type = 'dealer'
             and requester.account_type = 'dealer'
           )
           or (
             enquiry.requester_account_type = 'licensing'
             and requester.account_type = 'licensing'
           )
           or (
             enquiry.requester_account_type = 'owner'
             and requester.account_type = 'owner'
             and requester.discovery_participation_enabled = true
           )
         )
       order by enquiry.created_at desc
       limit 10`,
    ),
    [ownerUserId],
  );

  return result.rows.map(mapNotification);
}

export async function listRecentAssetDiscoveryEnquiriesForRequester(
  requesterUserId: string,
): Promise<AssetDiscoveryNotification[]> {
  await ensureAssetDiscoveryTables();
  const db = getDb();
  const result = await db.query<EnquiryRow>(
    enquirySelectSql(`
      where enquiry.requester_user_id = $1
        and enquiry.status in ('approved', 'temporarily_denied')
        and owner.account_status = 'active'
        and owner.discovery_participation_enabled = true
        and requester.account_status = 'active'
        and (
          (
            enquiry.requester_account_type = 'dealer'
            and requester.account_type = 'dealer'
          )
          or (
            enquiry.requester_account_type = 'licensing'
            and requester.account_type = 'licensing'
          )
          or (
            enquiry.requester_account_type = 'owner'
            and requester.account_type = 'owner'
            and requester.discovery_participation_enabled = true
          )
        )
        and enquiry.updated_at >= now() - interval '45 days'
        and (
          enquiry.status <> 'approved'
          or coalesce(enquiry.approved_at, enquiry.updated_at, enquiry.created_at) > now() - interval '3 months'
        )
      order by enquiry.updated_at desc
      limit 10
    `),
    [requesterUserId],
  );

  return result.rows.map(mapNotification);
}

export async function listLicensingAssetDiscoveryLeadOpportunities(
  requesterUserId: string,
): Promise<AssetDiscoveryNotification[]> {
  await ensureAssetDiscoveryTables();
  const result = await getDb().query<EnquiryRow>(
    enquirySelectSql(`
      where enquiry.requester_user_id = $1
        and enquiry.requester_account_type = 'licensing'
        and enquiry.status in ('pending', 'temporarily_denied')
        and owner.account_status = 'active'
        and requester.account_status = 'active'
        and requester.account_type = 'licensing'
      order by enquiry.updated_at desc
      limit 100
    `),
    [requesterUserId],
  );

  return result.rows.map(mapNotification);
}

/** @deprecated Use listRecentAssetDiscoveryEnquiriesForRequester. */
export const listRecentAssetDiscoveryEnquiriesForDealer =
  listRecentAssetDiscoveryEnquiriesForRequester;
