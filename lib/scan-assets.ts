import { getDb } from "./db";
import {
  normalizePublicAssetCode,
  resolveAssetOwnerByAssetId,
  resolveAssetOwnerByPublicAssetCode,
  type CanonicalAssetOwnerResolution,
} from "./asset-owner-resolver";
import { MAX_ASSET_REGISTER_PHOTOS } from "./asset-register-uploads";
import { resolveAssetUsage } from "./asset-usage";
import { ensureFuelLedgerTables } from "./fuel-ledger";
import { ensureAccountProfileColumns } from "./account-profile";
import {
  captureAssetDepreciationLogEntryForAssetId,
  type DepreciationLogAssetInput,
} from "./asset-depreciation-timeline";
import { toFiniteNumberOrNull } from "./usage-readings";

export { normalizePublicAssetCode } from "./asset-owner-resolver";

export type ScanAssetQrStatus =
  "active" | "transferred" | "retired" | "deleted" | "";
export type ScanAssetUsageMode = "hours" | "percent" | "km" | "none";
export type ScanAssetStatusChoice = "yes" | "no" | "unknown" | "not_applicable";
export type ScanAccessMode = "owner_session" | "scan_pin" | "field_manager";
export type ScanEventActorType = ScanAccessMode | "admin_session";

export type ScanSafeAsset = {
  id: string;
  userId: string;
  publicAssetCode: string;
  plateLabel: string;
  qrStatus: ScanAssetQrStatus;
  title: string;
  kind: string;
  equipmentFamilyKey: string;
  equipmentFamilyLabel: string;
  serialNumber: string;
  yearModel: number | null;
  financeStatus: ScanAssetStatusChoice;
  insuranceStatus: ScanAssetStatusChoice;
  licenseStatus: ScanAssetStatusChoice;
  licenseRegistrationNumber: string;
  hours: number | null;
  usageMode: ScanAssetUsageMode;
  usageMetric: "hours" | "km";
  lifeWorkedPercent: number | null;
  isPropelled: boolean;
  canUpdateFuel: boolean;
  fuelPercent: number | null;
  condition: string;
  note: string;
  photos: string[];
  lastScannedAtIso: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastKnownLocationText: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

export type ScanAssetAccessContext = {
  asset: ScanSafeAsset;
  scanPinHash: string;
  scanPinEnabled: boolean;
  scanPinUpdatedAtIso: string | null;
};

export type ScanEventRecord = {
  id: string;
  actorType: ScanEventActorType;
  operatorName: string;
  activityText: string;
  workAreaText: string;
  hours: number | null;
  fuelPercent: number | null;
  fuelLitres: number | null;
  fuelStorageId: string;
  fuelStorageEventId: string;
  fuelStorageName: string;
  fuelStoragePublicCode: string;
  fuelLedgerEventType: string;
  fuelSlipId: string;
  fuelSlipSupplierName: string;
  fuelSlipTotalAmount: number | null;
  fuelSlipDocumentFileUrl: string;
  fuelStorageLevelBefore: number | null;
  fuelStorageLevelAfter: number | null;
  assetFuelPercentBefore: number | null;
  assetFuelPercentAfter: number | null;
  assetUsageReading: number | null;
  assetUsageMetric: "hours" | "km" | "percentage" | "none" | "";
  isLateEntry: boolean;
  sourceType: string;
  sourceLabel: string;
  issueDate: string;
  issueTime: string;
  issueTimeRecorded: boolean;
  entryAddedAtIso: string | null;
  addedByName: string;
  addedByEmail: string;
  lateEntryReason: string;
  evidenceType: string;
  evidenceReference: string;
  evidenceStatus: string;
  evidenceFileName: string;
  evidenceFileUrl: string;
  tankBalanceTreatment: string;
  gpsCaptureStatus: string;
  workUseExcluded: boolean;
  workUseExclusionReason: string;
  condition: string;
  note: string;
  photoUrls: string[];
  latitude: number | null;
  longitude: number | null;
  locationText: string;
  createdAtIso: string;
  reportOccurredAtIso: string;
};

export type AssetMaintenanceStatusKind = "checked" | "serviced" | "repaired";

export type AssetMaintenanceStatus = {
  id: string;
  assetRegisterItemId: string;
  kind: AssetMaintenanceStatusKind;
  summary: string;
  note: string;
  sourceNote: string;
  operatorName: string;
  usageReading: number | null;
  photoUrls: string[];
  photoCount: number;
  latitude: number | null;
  longitude: number | null;
  locationText: string;
  createdAtIso: string;
  notedAtIso: string | null;
};

export type SaveScanAssetEventInput = {
  publicAssetCode: string;
  assetId?: string | null;
  actorType: ScanEventActorType;
  operatorName?: string | null;
  ownerUserId?: string | null;
  hours?: number | null;
  lifeWorkedPercent?: number | null;
  fuelPercent?: number | null;
  condition?: string | null;
  note?: string | null;
  photoUrls?: string[];
  latitude?: number | null;
  longitude?: number | null;
  locationText?: string | null;
  clientEventId?: string | null;
  clientCapturedAt?: string | null;
  gpsAccuracyMeters?: number | null;
  fieldManagerId?: string | null;
  fieldManagerDisplayName?: string | null;
  fieldManagerSessionId?: string | null;
};

type ScanAccessRow = {
  id: string | number;
  user_id: string | null;
  owner_user_id?: string | null;
  register_id?: string | null;
  sector_id?: string | number | null;
  equipment_family_id?: string | number | null;
  brand_name?: string | null;
  model_name?: string | null;
  typed_model_name?: string | null;
  year_model?: string | number | null;
  value?: string | number | null;
  selected_value_ex_vat?: string | number | null;
  replacement_price_used_ex_vat?: string | number | null;
  user_replacement_price_ex_vat?: string | number | null;
  public_asset_code: string | null;
  plate_label: string | null;
  qr_status: string | null;
  title: string | null;
  kind: string | null;
  equipment_family_key: string | null;
  equipment_family_label: string | null;
  depreciation_method_used: string | null;
  life_worked_percent: string | number | null;
  estimated_hours: string | number | null;
  max_lifetime_hours: string | number | null;
  specs_json: unknown;
  family_is_propelled: boolean | string | number | null;
  family_usage_metric_type: string | null;
  serial_number: string | null;
  is_financed: unknown;
  is_insured: unknown;
  is_licensed: unknown;
  license_registration_number: string | null;
  hours: string | number | null;
  fuel_percent: string | number | null;
  condition: string | null;
  note: string | null;
  photo_urls: unknown;
  last_scanned_at: string | null;
  last_known_lat: string | number | null;
  last_known_lng: string | number | null;
  last_known_location_text: string | null;
  created_at: string | null;
  updated_at: string | null;
  valuation_run_id?: string | number | null;
  selected_method?: string | null;
  scan_pin_hash: string | null;
  scan_pin_enabled: boolean | null;
  scan_pin_updated_at: string | null;
};

type ScanEventRow = {
  id: string | number;
  actor_type: string | null;
  operator_name: string | null;
  activity_text: string | null;
  work_area_text: string | null;
  hours: string | number | null;
  fuel_percent: string | number | null;
  fuel_litres: string | number | null;
  fuel_storage_id: string | number | null;
  fuel_storage_event_id: string | number | null;
  fuel_ledger_storage_id: string | number | null;
  fuel_ledger_litres: string | number | null;
  fuel_storage_name: string | null;
  fuel_storage_public_code: string | null;
  fuel_ledger_event_type: string | null;
  fuel_slip_id?: string | number | null;
  fuel_slip_supplier_name?: string | null;
  fuel_slip_total_amount?: string | number | null;
  fuel_slip_document_file_url?: string | null;
  fuel_storage_level_before_litres: string | number | null;
  fuel_storage_level_after_litres: string | number | null;
  asset_fuel_percent_before: string | number | null;
  asset_fuel_percent_after: string | number | null;
  asset_usage_reading: string | number | null;
  asset_usage_metric?: string | null;
  is_late_entry?: boolean | string | number | null;
  source_type?: string | null;
  source_label?: string | null;
  issue_date?: string | null;
  issue_time?: string | null;
  issue_time_recorded?: boolean | string | number | null;
  entry_added_at?: string | Date | null;
  added_by_name?: string | null;
  added_by_email?: string | null;
  late_entry_reason?: string | null;
  evidence_type?: string | null;
  evidence_reference?: string | null;
  evidence_status?: string | null;
  evidence_file_name?: string | null;
  tank_balance_treatment?: string | null;
  gps_capture_status?: string | null;
  work_use_excluded?: boolean | string | number | null;
  work_use_exclusion_reason?: string | null;
  condition: string | null;
  note: string | null;
  photo_urls: unknown;
  latitude: string | number | null;
  longitude: string | number | null;
  location_text: string | null;
  maintenance_noted_at?: string | Date | null;
  created_at: string | Date | null;
  report_occurred_at?: string | Date | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLicenseRegistrationNumber(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function asId(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return "";
}

function asNumber(value: unknown): number | null {
  return toFiniteNumberOrNull(value);
}

function asIsoTimestamp(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned) return null;

  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeClientEventId(value: unknown): string | null {
  const normalized = asText(value)
    .replace(/[^a-zA-Z0-9:._-]/g, "")
    .slice(0, 140);
  return normalized || null;
}

function normalizeClientCapturedAt(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeGpsAccuracyMeters(value: unknown): number | null {
  if (value === null || typeof value === "undefined" || value === "")
    return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 50000) return null;
  return Math.round(parsed * 100) / 100;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "yes" ||
      normalized === "y"
    )
      return true;
    if (
      normalized === "false" ||
      normalized === "0" ||
      normalized === "no" ||
      normalized === "n"
    )
      return false;
  }

  return null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function asPercent(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed === null || parsed < 0 || parsed > 100
    ? null
    : clampPercent(parsed);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => asText(entry)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.map((entry) => asText(entry)).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

function uniquePhotoUrls(value: unknown): string[] {
  const seen = new Set<string>();

  return asStringArray(value).filter((entry) => {
    if (!entry || seen.has(entry)) {
      return false;
    }

    seen.add(entry);
    return true;
  });
}

function normalizePhotos(value: unknown): string[] {
  return uniquePhotoUrls(value).slice(0, MAX_ASSET_REGISTER_PHOTOS);
}

function collectScanManagedPhotoUrls(
  rows: Array<{ photo_urls: unknown }>,
): string[] {
  const combined: string[] = [];

  rows.forEach((row) => {
    combined.push(...asStringArray(row.photo_urls));
  });

  return uniquePhotoUrls(combined);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function normalizeAssetStatusChoice(
  value: unknown,
  fallback: ScanAssetStatusChoice = "unknown",
): ScanAssetStatusChoice {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    [
      "yes",
      "y",
      "true",
      "financed",
      "insured",
      "licensed",
      "licenced",
    ].includes(normalized)
  ) {
    return "yes";
  }

  if (
    [
      "no",
      "n",
      "false",
      "not_financed",
      "not_insured",
      "not_licensed",
      "not_licenced",
      "unfinanced",
      "uninsured",
      "unlicensed",
      "unlicenced",
    ].includes(normalized)
  ) {
    return "no";
  }

  if (
    [
      "na",
      "n_a",
      "not_applicable",
      "not_aplicable",
      "not_relevant",
      "does_not_apply",
    ].includes(normalized)
  ) {
    return "not_applicable";
  }

  if (["unknown", "not_sure", "unsure", "maybe", ""].includes(normalized)) {
    return normalized ? "unknown" : fallback;
  }

  return fallback;
}

function statusFallbackFromBoolean(value: unknown): ScanAssetStatusChoice {
  const parsed = asBoolean(value);
  if (parsed === null) return "unknown";
  return parsed ? "yes" : "no";
}

function readStatusFromSpecs(
  specs: Record<string, unknown>,
  keys: string[],
  fallback: ScanAssetStatusChoice,
): ScanAssetStatusChoice {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(specs, key)) {
      return normalizeAssetStatusChoice(specs[key], fallback);
    }
  }

  return fallback;
}

function readLicenseRegistrationFromSpecs(
  specs: Record<string, unknown>,
): string {
  return normalizeLicenseRegistrationNumber(
    specs.licenseRegistrationNumber ??
      specs.license_registration_number ??
      specs.licenceRegistrationNumber ??
      specs.licence_registration_number ??
      specs.licenseRegistration ??
      specs.license_registration ??
      specs.licenceRegistration ??
      specs.licence_registration ??
      specs.registrationNumber ??
      specs.registration_number ??
      specs.numberPlate ??
      specs.number_plate ??
      specs.numberplate,
  );
}

function percentFromSpecs(specs: Record<string, unknown>): number | null {
  return (
    asPercent(specs.life_worked_percent) ??
    asPercent(specs.worked_percent) ??
    asPercent(specs.lifetime_worked_percent) ??
    asPercent(specs.percent_worked) ??
    asPercent(specs.lifetime_used_percent)
  );
}

function applyLifeWorkedPercent(
  specs: Record<string, unknown>,
  lifeWorkedPercent: number,
): Record<string, unknown> {
  const nextPercent = clampPercent(lifeWorkedPercent);

  return {
    ...specs,
    life_worked_percent: nextPercent,
    worked_percent: nextPercent,
    percent_worked: nextPercent,
    lifetime_worked_percent: nextPercent,
    lifetime_used_percent: nextPercent,
  };
}

function normalizeUsageMetric(value: unknown, kind = ""): "hours" | "km" {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (
    normalized === "km" ||
    normalized === "kms" ||
    normalized === "kilometres" ||
    normalized === "kilometers"
  )
    return "km";
  return kind === "vehicle" ? "km" : "hours";
}

function readSpecUsageMode(
  specs: Record<string, unknown>,
  kind: string,
): ScanAssetUsageMode | null {
  for (const value of [
    specs.usageBasis,
    specs.usage_basis,
    specs.selectedUsageBasis,
    specs.selected_usage_basis,
    specs.usageMode,
    specs.usage_mode,
    specs.selectedUsageMode,
    specs.selected_usage_mode,
    specs.usageMetricType,
    specs.usage_metric_type,
    specs.valuationMode,
    specs.valuation_mode,
  ]) {
    const raw = String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    if (!raw) continue;
    if (
      raw === "not_applicable" ||
      raw === "not_app" ||
      raw === "n/a" ||
      raw === "na" ||
      raw === "none" ||
      raw === "no_usage"
    )
      return "none";
    if (
      raw === "percent" ||
      raw === "percentage" ||
      raw === "percentage_depreciation" ||
      raw === "percent_used" ||
      raw === "wear_class" ||
      raw.includes("percent")
    )
      return "percent";
    if (
      raw === "km" ||
      raw === "kms" ||
      raw === "kilometre" ||
      raw === "kilometres" ||
      raw === "kilometer" ||
      raw === "kilometers"
    )
      return "km";
    if (
      raw === "hours" ||
      raw === "hour" ||
      raw === "engine_hours" ||
      raw === "hour_meter"
    )
      return "hours";
    if (raw === "reading") {
      return normalizeUsageMetric(
        specs.usageMetric ??
          specs.usage_metric ??
          specs.usageUnit ??
          specs.usage_unit,
        kind,
      );
    }
  }

  return null;
}

function scanLifeWorkedPercent(
  row: Pick<ScanAccessRow, "life_worked_percent" | "specs_json">,
): number | null {
  return (
    asPercent(row.life_worked_percent) ??
    percentFromSpecs(asRecord(row.specs_json))
  );
}

function inferScanUsageMode(row: ScanAccessRow): ScanAssetUsageMode {
  const specs = asRecord(row.specs_json);
  const kind = asText(row.kind).toLowerCase();
  const specUsageMode = readSpecUsageMode(specs, kind);
  const familyUsageMetricType = asText(
    row.family_usage_metric_type,
  ).toLowerCase();
  const depreciationMethod = asText(row.depreciation_method_used).toLowerCase();
  const usageMetric = normalizeUsageMetric(
    specs.usageMetric ??
      specs.usage_metric ??
      specs.usageUnit ??
      specs.usage_unit,
    kind,
  );
  const lifeWorkedPercent = scanLifeWorkedPercent(row);
  const hours = asNumber(row.hours);
  const resolvedUsage = resolveAssetUsage({
    kind,
    hours,
    lifeWorkedPercent,
    specsJson: specs,
  });

  if (kind === "property") return "none";
  if (resolvedUsage.metric === "not_applicable") return "none";
  if (resolvedUsage.metric === "percentage") return "percent";
  if (specUsageMode) return specUsageMode;
  if (kind === "vehicle") return usageMetric === "km" ? "km" : "hours";
  if (resolvedUsage.value !== null) {
    return resolvedUsage.metric === "km" ? "km" : "hours";
  }
  if (
    familyUsageMetricType === "wear_class" ||
    familyUsageMetricType === "percent_used" ||
    familyUsageMetricType === "percentage"
  )
    return "percent";
  if (depreciationMethod === "percentage_depreciation") return "percent";
  if (
    lifeWorkedPercent !== null &&
    (!hours || hours <= 0 || depreciationMethod === "semi_depreciation")
  )
    return "percent";
  if (hours !== null && hours > 0) return "hours";
  if (kind === "tractor" || familyUsageMetricType === "hours") return "hours";
  if (lifeWorkedPercent !== null) return "percent";
  return "none";
}

function inferIsPropelled(row: ScanAccessRow): boolean {
  const specs = asRecord(row.specs_json);
  const kind = asText(row.kind).toLowerCase();
  const specValue = asBoolean(
    specs.is_propelled ??
      specs.isPropelled ??
      specs.self_propelled ??
      specs.selfPropelled,
  );
  const familyValue = asBoolean(row.family_is_propelled);

  if (kind === "tractor" || kind === "vehicle") return true;
  if (specValue !== null) return specValue;
  if (familyValue !== null) return familyValue;
  return false;
}

function hasSavedValuation(row: ScanAccessRow): boolean {
  const selectedMethod = asText(row.selected_method).toLowerCase();
  return Boolean(row.valuation_run_id && selectedMethod !== "manual");
}

function markValuationNeedsUpdate(
  specs: Record<string, unknown>,
  reasons: string[],
): Record<string, unknown> {
  const uniqueReasons = Array.from(
    new Set(reasons.map((reason) => reason.trim()).filter(Boolean)),
  );

  if (!uniqueReasons.length) {
    return specs;
  }

  const nowIso = new Date().toISOString();
  const existingSince =
    asText(specs.valuation_stale_since) ||
    asText(specs.valuationStaleSince) ||
    nowIso;

  return {
    ...specs,
    valuationNeedsUpdate: true,
    valuation_needs_update: true,
    valuationStaleSince: existingSince,
    valuation_stale_since: existingSince,
    valuationStaleReason: uniqueReasons.join(", "),
    valuation_stale_reason: uniqueReasons.join(", "),
    valuationStaleReasons: uniqueReasons,
    valuation_stale_reasons: uniqueReasons,
  };
}

function normalizeQrStatus(value: unknown): ScanAssetQrStatus {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    normalized === "active" ||
    normalized === "transferred" ||
    normalized === "retired" ||
    normalized === "deleted"
  ) {
    return normalized;
  }

  return "";
}

function normalizeCondition(value: unknown): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "excellent") return "excellent";
  if (normalized === "good") return "good";
  if (normalized === "fair") return "fair";
  if (normalized === "used") return "used";
  if (
    normalized === "serious" ||
    normalized === "requires attention" ||
    normalized === "requires serious attention"
  ) {
    return "serious";
  }

  return "";
}

function normalizeActorType(value: unknown): ScanEventActorType {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "owner_session") return "owner_session";
  if (normalized === "admin_session") return "admin_session";
  if (normalized === "field_manager") return "field_manager";
  return "scan_pin";
}


let scanAssetSaveColumnsEnsured = false;

async function ensureScanAssetSaveColumns(): Promise<void> {
  if (scanAssetSaveColumnsEnsured) {
    return;
  }

  const db = getDb();
  const tableCheck = await db.query<{ exists: boolean }>(
    "select to_regclass('public.asset_register_items') is not null as exists",
  );

  if (!tableCheck.rows[0]?.exists) {
    throw new Error("Asset register table not found.");
  }

  await db.query(`
    alter table public.asset_register_items
      add column if not exists register_id uuid,
      add column if not exists sector_id bigint,
      add column if not exists equipment_family_id bigint,
      add column if not exists brand_name text,
      add column if not exists model_name text,
      add column if not exists typed_model_name text,
      add column if not exists year_model integer,
      add column if not exists value numeric(14,2),
      add column if not exists selected_value_ex_vat numeric(14,2),
      add column if not exists replacement_price_used_ex_vat numeric(14,2),
      add column if not exists user_replacement_price_ex_vat numeric(14,2),
      add column if not exists public_asset_code text,
      add column if not exists plate_label text,
      add column if not exists qr_status text default 'active',
      add column if not exists title text,
      add column if not exists kind text,
      add column if not exists depreciation_method_used text,
      add column if not exists life_worked_percent numeric(5,2),
      add column if not exists life_remaining_percent numeric(5,2),
      add column if not exists estimated_hours numeric(14,2),
      add column if not exists max_lifetime_hours numeric(14,2),
      add column if not exists specs_json jsonb default '{}'::jsonb,
      add column if not exists serial_number text,
      add column if not exists is_financed boolean,
      add column if not exists is_insured boolean,
      add column if not exists is_licensed boolean,
      add column if not exists license_registration_number text,
      add column if not exists hours numeric(14,2),
      add column if not exists fuel_percent integer,
      add column if not exists condition text,
      add column if not exists note text,
      add column if not exists photo_urls jsonb default '[]'::jsonb,
      add column if not exists last_scanned_at timestamptz,
      add column if not exists last_known_lat double precision,
      add column if not exists last_known_lng double precision,
      add column if not exists last_known_location_text text,
      add column if not exists created_at timestamptz default now(),
      add column if not exists updated_at timestamptz default now(),
      add column if not exists valuation_run_id bigint,
      add column if not exists selected_method text
  `);

  scanAssetSaveColumnsEnsured = true;
}

function mergePhotos(
  existing: string[],
  next: string[],
  scanManagedPhotos: string[] = [],
): string[] {
  const existingPhotos = uniquePhotoUrls(existing);
  const incomingScanPhotos = uniquePhotoUrls(next);
  const scanManagedPhotoSet = new Set(uniquePhotoUrls(scanManagedPhotos));
  const protectedAssetRegisterPhotos = existingPhotos.filter(
    (photo) => !scanManagedPhotoSet.has(photo),
  );

  const availableScanSlots = Math.max(
    0,
    MAX_ASSET_REGISTER_PHOTOS - protectedAssetRegisterPhotos.length,
  );

  if (availableScanSlots <= 0) {
    return protectedAssetRegisterPhotos.slice(0, MAX_ASSET_REGISTER_PHOTOS);
  }

  const retainedScanPhotos = uniquePhotoUrls([
    ...existingPhotos.filter((photo) => scanManagedPhotoSet.has(photo)),
    ...incomingScanPhotos,
  ]).slice(-availableScanSlots);
  const retainedScanPhotoSet = new Set(retainedScanPhotos);
  const retainedExistingPhotos = existingPhotos.filter(
    (photo) =>
      !scanManagedPhotoSet.has(photo) || retainedScanPhotoSet.has(photo),
  );
  const retainedExistingPhotoSet = new Set(retainedExistingPhotos);
  const newScanPhotos = retainedScanPhotos.filter(
    (photo) => !retainedExistingPhotoSet.has(photo),
  );

  return [...retainedExistingPhotos, ...newScanPhotos].slice(
    0,
    MAX_ASSET_REGISTER_PHOTOS,
  );
}

function mapScanSafeAsset(row: ScanAccessRow): ScanSafeAsset {
  const kind = asText(row.kind).toLowerCase();
  const specs = asRecord(row.specs_json);
  const usageMetric = normalizeUsageMetric(
    specs.usageMetric ??
      specs.usage_metric ??
      specs.usageUnit ??
      specs.usage_unit,
    kind,
  );
  const isPropelled = inferIsPropelled(row);

  return {
    id: asId(row.id),
    userId: asText(row.owner_user_id) || asText(row.user_id),
    publicAssetCode: asText(row.public_asset_code),
    plateLabel: asText(row.plate_label),
    qrStatus: normalizeQrStatus(row.qr_status),
    title: asText(row.title),
    kind,
    equipmentFamilyKey: asText(row.equipment_family_key),
    equipmentFamilyLabel: asText(row.equipment_family_label),
    serialNumber: asText(row.serial_number),
    yearModel: asNumber(row.year_model),
    financeStatus: readStatusFromSpecs(
      specs,
      ["financeStatus", "finance_status", "financedStatus", "financed_status"],
      statusFallbackFromBoolean(row.is_financed),
    ),
    insuranceStatus: readStatusFromSpecs(
      specs,
      [
        "insuranceStatus",
        "insurance_status",
        "insuredStatus",
        "insured_status",
      ],
      statusFallbackFromBoolean(row.is_insured),
    ),
    licenseStatus: readStatusFromSpecs(
      specs,
      [
        "licenseStatus",
        "license_status",
        "licensedStatus",
        "licensed_status",
        "licenceStatus",
        "licence_status",
        "licencedStatus",
        "licenced_status",
      ],
      statusFallbackFromBoolean(row.is_licensed),
    ),
    licenseRegistrationNumber:
      normalizeLicenseRegistrationNumber(row.license_registration_number) ||
      readLicenseRegistrationFromSpecs(specs),
    hours: asNumber(row.hours),
    usageMode: inferScanUsageMode(row),
    usageMetric,
    lifeWorkedPercent: scanLifeWorkedPercent(row),
    isPropelled,
    canUpdateFuel: isPropelled,
    fuelPercent: asNumber(row.fuel_percent),
    condition: normalizeCondition(row.condition),
    note: asText(row.note),
    photos: normalizePhotos(row.photo_urls),
    lastScannedAtIso: row.last_scanned_at ?? null,
    lastKnownLat: asNumber(row.last_known_lat),
    lastKnownLng: asNumber(row.last_known_lng),
    lastKnownLocationText: asText(row.last_known_location_text),
    createdAtIso: row.created_at ?? null,
    updatedAtIso: row.updated_at ?? null,
  };
}

function mapScanAccessRowToDepreciationAsset(
  row: ScanAccessRow,
): DepreciationLogAssetInput {
  return {
    id: asId(row.id),
    userId: asText(row.owner_user_id) || asText(row.user_id),
    registerId: asText(row.register_id) || null,
    valuationRunId: asNumber(row.valuation_run_id),
    title: asText(row.title),
    kind: asText(row.kind),
    sectorId: asNumber(row.sector_id),
    equipmentFamilyId: asNumber(row.equipment_family_id),
    equipmentFamilyKey: asText(row.equipment_family_key),
    equipmentFamilyLabel: asText(row.equipment_family_label),
    brandName: asText(row.brand_name),
    modelName: asText(row.model_name),
    typedModelName: asText(row.typed_model_name),
    yearModel: asNumber(row.year_model),
    hours: asNumber(row.hours),
    lifeWorkedPercent: asNumber(row.life_worked_percent),
    condition: normalizeCondition(row.condition),
    replacementPriceUsedExVat: asNumber(row.replacement_price_used_ex_vat),
    userReplacementPriceExVat: asNumber(row.user_replacement_price_ex_vat),
    value: asNumber(row.value),
    selectedValueExVat: asNumber(row.selected_value_ex_vat),
    selectedMethod: asText(row.selected_method),
    depreciationMethodUsed: asText(row.depreciation_method_used),
    specsJson: asRecord(row.specs_json),
  };
}

function mapScanEventRow(row: ScanEventRow): ScanEventRecord {
  const fuelLedgerLitres = asNumber(row.fuel_ledger_litres);
  const assetFuelPercentAfter =
    asNumber(row.asset_fuel_percent_after) ?? asNumber(row.fuel_percent);
  const assetUsageReading =
    asNumber(row.asset_usage_reading) ?? asNumber(row.hours);
  const createdAtIso = asIsoTimestamp(row.created_at) ?? "";
  const reportOccurredAtIso =
    asIsoTimestamp(row.report_occurred_at) ?? createdAtIso;
  const fuelStorageEventId = asId(row.fuel_storage_event_id);
  const fuelSlipId = asId(row.fuel_slip_id);

  return {
    id: asId(row.id),
    actorType: normalizeActorType(row.actor_type),
    operatorName: asText(row.operator_name),
    activityText: asText(row.activity_text),
    workAreaText: asText(row.work_area_text),
    hours: asNumber(row.hours),
    fuelPercent: assetFuelPercentAfter,
    fuelLitres: asNumber(row.fuel_litres) ?? fuelLedgerLitres,
    fuelStorageId:
      asId(row.fuel_storage_id) || asId(row.fuel_ledger_storage_id),
    fuelStorageEventId,
    fuelStorageName: asText(row.fuel_storage_name),
    fuelStoragePublicCode: asText(row.fuel_storage_public_code),
    fuelLedgerEventType: asText(row.fuel_ledger_event_type),
    fuelSlipId,
    fuelSlipSupplierName: asText(row.fuel_slip_supplier_name),
    fuelSlipTotalAmount: asNumber(row.fuel_slip_total_amount),
    fuelSlipDocumentFileUrl: asText(row.fuel_slip_document_file_url),
    fuelStorageLevelBefore: asNumber(row.fuel_storage_level_before_litres),
    fuelStorageLevelAfter: asNumber(row.fuel_storage_level_after_litres),
    assetFuelPercentBefore: asNumber(row.asset_fuel_percent_before),
    assetFuelPercentAfter,
    assetUsageReading,
    assetUsageMetric: row.asset_usage_metric === "hours" || row.asset_usage_metric === "km" || row.asset_usage_metric === "percentage" || row.asset_usage_metric === "none" ? row.asset_usage_metric : "",
    isLateEntry: Boolean(asBoolean(row.is_late_entry)),
    sourceType: asText(row.source_type),
    sourceLabel: asText(row.source_label),
    issueDate: asText(row.issue_date),
    issueTime: asText(row.issue_time),
    issueTimeRecorded: asBoolean(row.issue_time_recorded) !== false,
    entryAddedAtIso: asIsoTimestamp(row.entry_added_at),
    addedByName: asText(row.added_by_name),
    addedByEmail: asText(row.added_by_email),
    lateEntryReason: asText(row.late_entry_reason),
    evidenceType: asText(row.evidence_type),
    evidenceReference: asText(row.evidence_reference),
    evidenceStatus: asText(row.evidence_status),
    evidenceFileName: asText(row.evidence_file_name)
      || (asText(row.fuel_slip_document_file_url) ? "Fuel slip document" : ""),
    evidenceFileUrl: Boolean(asText(row.evidence_file_name)) && fuelStorageEventId
      ? `/api/fuel/missing-entry-evidence/${encodeURIComponent(fuelStorageEventId)}`
      : asText(row.fuel_slip_document_file_url),
    tankBalanceTreatment: asText(row.tank_balance_treatment),
    gpsCaptureStatus: asText(row.gps_capture_status),
    workUseExcluded: Boolean(asBoolean(row.work_use_excluded)),
    workUseExclusionReason: asText(row.work_use_exclusion_reason),
    condition: normalizeCondition(row.condition),
    note: asText(row.note),
    photoUrls: normalizePhotos(row.photo_urls),
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    locationText: asText(row.location_text),
    createdAtIso,
    reportOccurredAtIso,
  };
}

function splitMaintenanceNoteLines(note: string): string[] {
  return String(note ?? "")
    .split(/\r?\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function maintenanceLabelPrefixes(label: string): string[] {
  const normalized = String(label ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "notes" || normalized === "notes/problems") {
    return ["notes/problems:", "notes:"];
  }

  return [`${normalized}:`];
}

function extractMaintenanceNoteValue(note: string, label: string): string {
  const prefixes = maintenanceLabelPrefixes(label);
  const line = splitMaintenanceNoteLines(note).find((entry) => {
    const lowerEntry = entry.toLowerCase();
    return prefixes.some((prefix) => lowerEntry.startsWith(prefix));
  });

  if (!line) {
    return "";
  }

  const lowerLine = line.toLowerCase();
  const matchedPrefix =
    prefixes.find((prefix) => lowerLine.startsWith(prefix)) ?? "";
  return line.slice(matchedPrefix.length).replace(/\s+/g, " ").trim();
}

function resolveMaintenanceStatusKind(
  note: string,
): AssetMaintenanceStatusKind | null {
  const lines = splitMaintenanceNoteLines(note);
  const firstLine = (lines[0] ?? "").toLowerCase();
  const compactNote = lines.join(" ").toLowerCase();

  if (
    /^repaired(?:\b|$)/.test(firstLine) ||
    compactNote.includes("repair details:")
  ) {
    return "repaired";
  }

  if (
    /^serviced(?:\b|$)/.test(firstLine) ||
    compactNote.includes("work done:") ||
    compactNote.includes("service items:") ||
    compactNote.includes("serviced items:")
  ) {
    return "serviced";
  }

  if (
    /^checked(?:\b|$)/.test(firstLine) ||
    compactNote.includes("checked items:")
  ) {
    return "checked";
  }

  return null;
}

function summarizeMaintenanceStatus(
  note: string,
  kind: AssetMaintenanceStatusKind,
): { summary: string; note: string } {
  const actionLabel =
    kind === "checked"
      ? "Checked"
      : kind === "repaired"
        ? "Repaired"
        : "Serviced";
  const detail =
    kind === "checked"
      ? extractMaintenanceNoteValue(note, "Checked items")
      : kind === "repaired"
        ? extractMaintenanceNoteValue(note, "Repair details")
        : extractMaintenanceNoteValue(note, "Work done") ||
          extractMaintenanceNoteValue(note, "Service items") ||
          extractMaintenanceNoteValue(note, "Serviced items");
  const company = extractMaintenanceNoteValue(note, "Company");
  const mechanic = extractMaintenanceNoteValue(note, "Mechanic");
  const noteText = extractMaintenanceNoteValue(note, "Notes/Problems");
  const providerText = [company, mechanic].filter(Boolean).join(" · ");
  const summaryParts = [
    detail
      ? `${actionLabel}: ${detail}`
      : `${actionLabel} maintenance has been recorded.`,
    providerText ? `By ${providerText}` : "",
  ].filter(Boolean);

  return {
    summary: summaryParts.join(" • "),
    note: noteText,
  };
}

function mapMaintenanceStatusFromScanEvent(
  row: ScanEventRow & { asset_id?: string | number | null },
): AssetMaintenanceStatus | null {
  const note = asText(row.note);
  const kind = resolveMaintenanceStatusKind(note);

  if (!kind) {
    return null;
  }

  const summary = summarizeMaintenanceStatus(note, kind);
  const photoUrls = normalizePhotos(row.photo_urls);

  return {
    id: asId(row.id),
    assetRegisterItemId: asId(row.asset_id),
    kind,
    summary: summary.summary,
    note: summary.note,
    sourceNote: note,
    operatorName: asText(row.operator_name),
    usageReading: asNumber(row.asset_usage_reading) ?? asNumber(row.hours),
    photoUrls,
    photoCount: photoUrls.length,
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    locationText: asText(row.location_text),
    createdAtIso: asIsoTimestamp(row.created_at) ?? "",
    notedAtIso: asIsoTimestamp(row.maintenance_noted_at),
  };
}

async function getScanAssetAccessContextForResolvedOwner(
  resolvedOwner: CanonicalAssetOwnerResolution,
): Promise<ScanAssetAccessContext | null> {
  const db = getDb();
  await ensureAccountProfileColumns();

  const result = await db.query<ScanAccessRow>(
    `
      select
        a.id,
        to_jsonb(a)->>'user_id' as user_id,
        $2::text as owner_user_id,
        nullif(trim(coalesce(to_jsonb(a)->>'register_id', '')), '') as register_id,
        nullif(trim(coalesce(to_jsonb(a)->>'sector_id', '')), '') as sector_id,
        coalesce(
          nullif(trim(coalesce(to_jsonb(a)->>'equipment_family_id', '')), ''),
          nullif(trim(coalesce(to_jsonb(vr)->>'equipment_family_id', '')), '')
        ) as equipment_family_id,
        coalesce(to_jsonb(a)->>'brand_name', to_jsonb(a)->>'brand', '') as brand_name,
        coalesce(to_jsonb(a)->>'model_name', to_jsonb(a)->>'model', '') as model_name,
        coalesce(to_jsonb(a)->>'typed_model_name', to_jsonb(vr)->>'typed_model_name', '') as typed_model_name,
        nullif(trim(coalesce(to_jsonb(a)->>'year_model', to_jsonb(a)->>'year', '')), '') as year_model,
        nullif(trim(coalesce(to_jsonb(a)->>'value', to_jsonb(a)->>'selected_value_ex_vat', to_jsonb(a)->>'selected_value', '')), '') as value,
        nullif(trim(coalesce(to_jsonb(a)->>'selected_value_ex_vat', to_jsonb(a)->>'selected_value', to_jsonb(a)->>'value', '')), '') as selected_value_ex_vat,
        nullif(trim(coalesce(to_jsonb(a)->>'replacement_price_used_ex_vat', to_jsonb(a)->>'replacement_price_ex_vat', '')), '') as replacement_price_used_ex_vat,
        nullif(trim(coalesce(to_jsonb(a)->>'user_replacement_price_ex_vat', '')), '') as user_replacement_price_ex_vat,
        to_jsonb(a)->>'public_asset_code' as public_asset_code,
        coalesce(to_jsonb(a)->>'plate_label', '') as plate_label,
        coalesce(nullif(trim(to_jsonb(a)->>'qr_status'), ''), 'active') as qr_status,
        coalesce(to_jsonb(a)->>'title', to_jsonb(a)->>'name', '') as title,
        coalesce(to_jsonb(a)->>'kind', to_jsonb(a)->>'equipment_type', to_jsonb(a)->>'asset_type', 'manual') as kind,
        coalesce(to_jsonb(ef)->>'family_key', '') as equipment_family_key,
        coalesce(to_jsonb(ef)->>'family_label', '') as equipment_family_label,
        coalesce(to_jsonb(a)->>'depreciation_method_used', '') as depreciation_method_used,
        nullif(trim(coalesce(to_jsonb(a)->>'life_worked_percent', '')), '') as life_worked_percent,
        nullif(trim(coalesce(to_jsonb(a)->>'estimated_hours', '')), '') as estimated_hours,
        nullif(trim(coalesce(to_jsonb(a)->>'max_lifetime_hours', '')), '') as max_lifetime_hours,
        coalesce(to_jsonb(a)->'specs_json', to_jsonb(vr)->'specs_json', '{}'::jsonb) as specs_json,
        to_jsonb(ef)->>'is_propelled' as family_is_propelled,
        to_jsonb(ef)->>'usage_metric_type' as family_usage_metric_type,
        coalesce(to_jsonb(a)->>'serial_number', to_jsonb(a)->>'serial', to_jsonb(a)->>'vin', '') as serial_number,
        to_jsonb(a)->>'is_financed' as is_financed,
        to_jsonb(a)->>'is_insured' as is_insured,
        to_jsonb(a)->>'is_licensed' as is_licensed,
        coalesce(
          to_jsonb(a)->>'license_registration_number',
          to_jsonb(a)->>'licence_registration_number',
          to_jsonb(a)->>'registration_number',
          to_jsonb(a)->>'number_plate',
          to_jsonb(a)->>'numberplate'
        ) as license_registration_number,
        nullif(trim(coalesce(to_jsonb(a)->>'hours', to_jsonb(a)->>'engine_hours', '')), '') as hours,
        nullif(trim(coalesce(to_jsonb(a)->>'fuel_percent', '')), '') as fuel_percent,
        coalesce(to_jsonb(a)->>'condition', '') as condition,
        coalesce(to_jsonb(a)->>'note', to_jsonb(a)->>'notes', to_jsonb(a)->>'description', '') as note,
        coalesce(to_jsonb(a)->'photo_urls', to_jsonb(a)->'photos', to_jsonb(a)->'image_urls', '[]'::jsonb) as photo_urls,
        nullif(trim(coalesce(to_jsonb(a)->>'last_scanned_at', '')), '') as last_scanned_at,
        nullif(trim(coalesce(to_jsonb(a)->>'last_known_lat', '')), '') as last_known_lat,
        nullif(trim(coalesce(to_jsonb(a)->>'last_known_lng', '')), '') as last_known_lng,
        coalesce(to_jsonb(a)->>'last_known_location_text', '') as last_known_location_text,
        nullif(trim(coalesce(to_jsonb(a)->>'created_at', '')), '') as created_at,
        nullif(trim(coalesce(to_jsonb(a)->>'updated_at', '')), '') as updated_at,
        nullif(trim(coalesce(to_jsonb(a)->>'valuation_run_id', to_jsonb(a)->>'run_id', '')), '') as valuation_run_id,
        coalesce(to_jsonb(a)->>'selected_method', to_jsonb(a)->>'method', to_jsonb(a)->>'valuation_method', 'manual') as selected_method,
        coalesce(p.scan_pin_hash, '') as scan_pin_hash,
        coalesce(p.scan_pin_enabled, false) as scan_pin_enabled,
        p.scan_pin_updated_at
      from asset_register_items a
      left join valuation_runs vr
        on vr.id::text = nullif(trim(coalesce(to_jsonb(a)->>'valuation_run_id', to_jsonb(a)->>'run_id', '')), '')
      left join equipment_families ef
        on ef.id::text = coalesce(
          nullif(trim(coalesce(to_jsonb(a)->>'equipment_family_id', '')), ''),
          nullif(trim(coalesce(to_jsonb(vr)->>'equipment_family_id', '')), '')
        )
      left join account_profiles p
        on p.user_id = $2::text
      where a.id::text = $1
      limit 1
    `,
    [resolvedOwner.assetId, resolvedOwner.ownerUserId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    asset: mapScanSafeAsset(row),
    scanPinHash: asText(row.scan_pin_hash),
    scanPinEnabled:
      Boolean(row.scan_pin_enabled) && Boolean(asText(row.scan_pin_hash)),
    scanPinUpdatedAtIso: row.scan_pin_updated_at ?? null,
  };
}

export async function getScanAssetAccessContext(
  publicAssetCode: string,
  options: {
    assetId?: string | null;
    expectedOwnerUserId?: string | null;
  } = {},
): Promise<ScanAssetAccessContext | null> {
  const normalizedCode = normalizePublicAssetCode(publicAssetCode);

  if (!normalizedCode) {
    return null;
  }

  const resolvedOwner = await resolveAssetOwnerByPublicAssetCode(
    normalizedCode,
    {
      assetId: options.assetId ?? null,
      expectedOwnerUserId: options.expectedOwnerUserId ?? null,
      purpose: "scan-asset-access-context",
    },
  );

  return getScanAssetAccessContextForResolvedOwner(resolvedOwner);
}

export async function getScanAssetAccessContextByAssetId(
  assetId: string,
  options: {
    publicAssetCode?: string | null;
    expectedOwnerUserId?: string | null;
  } = {},
): Promise<ScanAssetAccessContext | null> {
  const normalizedAssetId = asId(assetId);

  if (!normalizedAssetId) {
    return null;
  }

  const resolvedOwner = await resolveAssetOwnerByAssetId(normalizedAssetId, {
    publicAssetCode: options.publicAssetCode ?? null,
    expectedOwnerUserId: options.expectedOwnerUserId ?? null,
    purpose: "field-manager-scan-asset-context",
  });

  return getScanAssetAccessContextForResolvedOwner(resolvedOwner);
}

export type ScanEventListFilters = {
  fromIso?: string;
  toIso?: string;
  onlyFuel?: boolean;
};

export async function listScanEventsForAsset(
  assetId: string,
  limit: number | null = 250,
  filters?: ScanEventListFilters,
): Promise<ScanEventRecord[]> {
  await ensureFuelLedgerTables();

  const db = getDb();
  const safeLimit = limit === null
    ? null
    : Math.max(1, Math.min(500, Math.round(limit || 250)));
  const limitClause = safeLimit === null ? "" : `limit ${safeLimit}`;
  const fuelSlipDateExpression = `
    case
      when fs.document_date is not null then
        (
          fs.document_date::text || ' ' ||
          case
            when coalesce(fs.document_time, '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
              then fs.document_time
            else '00:00:00'
          end
        )::timestamp at time zone 'Africa/Johannesburg'
      else null
    end
  `;
  const reportDateExpression = filters?.onlyFuel
    ? `coalesce(fse.issue_at, ${fuelSlipDateExpression}, e.created_at)`
    : "e.created_at";
  const queryParams: unknown[] = [assetId];
  const whereClauses = ["e.asset_id = $1"];

  if (filters?.fromIso) {
    queryParams.push(filters.fromIso);
    whereClauses.push(`${reportDateExpression} >= $${queryParams.length}::timestamptz`);
  }

  if (filters?.toIso) {
    queryParams.push(filters.toIso);
    whereClauses.push(`${reportDateExpression} < $${queryParams.length}::timestamptz`);
  }

  if (filters?.onlyFuel) {
    whereClauses.push(`(
          e.fuel_percent is not null
          or nullif(to_jsonb(e)->>'fuel_litres', '')::numeric > 0
          or nullif(to_jsonb(e)->>'fuel_storage_event_id', '') is not null
          or nullif(to_jsonb(e)->>'fuel_slip_id', '') is not null
          or fse.id is not null
          or fs.id is not null
        )`);
  }

  const result = await db.query<ScanEventRow>(
    `
      select
        e.id,
        e.actor_type,
        e.operator_name,
        to_jsonb(e)->>'activity_text' as activity_text,
        to_jsonb(e)->>'work_area_text' as work_area_text,
        e.hours,
        e.fuel_percent,
        to_jsonb(e)->>'fuel_litres' as fuel_litres,
        to_jsonb(e)->>'fuel_storage_id' as fuel_storage_id,
        to_jsonb(e)->>'fuel_storage_event_id' as fuel_storage_event_id,
        fse.storage_id::text as fuel_ledger_storage_id,
        fse.litres as fuel_ledger_litres,
        coalesce(fsu.name, case when fs.id is not null then 'External fuel purchase' end, '') as fuel_storage_name,
        coalesce(fsu.public_fuel_storage_code, '') as fuel_storage_public_code,
        coalesce(fse.event_type, case when fs.target_type = 'asset' then 'asset_issue' else '' end, '') as fuel_ledger_event_type,
        coalesce(nullif(to_jsonb(e)->>'fuel_slip_id', ''), fs.id::text, '') as fuel_slip_id,
        coalesce(fs.supplier_name, '') as fuel_slip_supplier_name,
        fs.total_amount as fuel_slip_total_amount,
        coalesce(fs.document_file_url, '') as fuel_slip_document_file_url,
        fse.storage_level_before_litres as fuel_storage_level_before_litres,
        fse.storage_level_after_litres as fuel_storage_level_after_litres,
        coalesce(fse.asset_fuel_percent_before, fs.asset_fuel_percent_before) as asset_fuel_percent_before,
        coalesce(fse.asset_fuel_percent_after, fs.asset_fuel_percent_after) as asset_fuel_percent_after,
        coalesce(
          fse.asset_usage_reading,
          nullif(to_jsonb(e)->>'asset_usage_reading', '')::numeric,
          fs.odometer_reading,
          fs.hour_meter_reading,
          e.hours
        ) as asset_usage_reading,
        coalesce(
          nullif(fse.asset_usage_metric, ''),
          nullif(to_jsonb(e)->>'asset_usage_metric', ''),
          case when fs.odometer_reading is not null then 'km' when fs.hour_meter_reading is not null then 'hours' end,
          ''
        ) as asset_usage_metric,
        coalesce(fse.is_late_entry, false) as is_late_entry,
        coalesce(nullif(fse.source_type, ''), case when fs.id is not null then 'fuel_slip' end, to_jsonb(e)->>'source_type', '') as source_type,
        coalesce(nullif(fse.source_label, ''), case when fs.id is not null then 'Fuel Slip' end, to_jsonb(e)->>'source_label', '') as source_label,
        coalesce(fse.issue_date::text, fs.document_date::text, to_jsonb(e)->>'issue_date', '') as issue_date,
        coalesce(fse.issue_time::text, fs.document_time, to_jsonb(e)->>'issue_time', '') as issue_time,
        case
          when fse.id is not null then coalesce(fse.issue_time_recorded, true)
          when fs.id is not null then nullif(fs.document_time, '') is not null
          else coalesce(nullif(to_jsonb(e)->>'issue_time_recorded', '')::boolean, true)
        end as issue_time_recorded,
        coalesce(fse.entry_added_at, fs.created_at, nullif(to_jsonb(e)->>'entry_added_at', '')::timestamptz, e.created_at)::text as entry_added_at,
        coalesce(fse.added_by_name, '') as added_by_name,
        coalesce(fse.added_by_email, '') as added_by_email,
        coalesce(fse.late_entry_reason, '') as late_entry_reason,
        coalesce(fse.evidence_type, '') as evidence_type,
        coalesce(fse.evidence_reference, '') as evidence_reference,
        coalesce(fse.evidence_status, '') as evidence_status,
        coalesce(evidence.file_name, '') as evidence_file_name,
        coalesce(fse.tank_balance_treatment, '') as tank_balance_treatment,
        coalesce(fse.gps_capture_status, '') as gps_capture_status,
        coalesce(fse.work_use_excluded, fs.work_use_excluded, false) as work_use_excluded,
        coalesce(fse.work_use_exclusion_reason, fs.work_use_exclusion_reason, '') as work_use_exclusion_reason,
        e.condition,
        e.note,
        e.photo_urls,
        e.latitude,
        e.longitude,
        e.location_text,
        e.maintenance_noted_at::text as maintenance_noted_at,
        e.created_at,
        ${reportDateExpression} as report_occurred_at
      from public.asset_scan_events e
      left join public.fuel_storage_events fse
        on fse.id::text = nullif(to_jsonb(e)->>'fuel_storage_event_id', '')
      left join public.fuel_slips fs
        on fs.id::text = nullif(to_jsonb(e)->>'fuel_slip_id', '')
      left join public.fuel_storage_units fsu
        on fsu.id = coalesce(fse.storage_id, fs.storage_id)
      left join public.fuel_late_entry_evidence evidence
        on evidence.fuel_storage_event_id = fse.id and evidence.user_id = fse.user_id
      where ${whereClauses.join("\n        and ")}
      order by ${reportDateExpression} desc, e.id desc
      ${limitClause}
    `,
    queryParams,
  );

  return result.rows.map(mapScanEventRow);
}

export async function listRecentScanEvents(
  assetId: string,
  limit = 10,
): Promise<ScanEventRecord[]> {
  return listScanEventsForAsset(
    assetId,
    Math.max(1, Math.min(25, Math.round(limit || 10))),
  );
}

export async function attachLatestMaintenanceStatusToAssets<
  T extends { id: string },
>(
  assets: T[],
): Promise<
  Array<T & { latestMaintenanceStatus: AssetMaintenanceStatus | null }>
> {
  if (!assets.length) {
    return [];
  }

  await ensureFuelLedgerTables();

  const db = getDb();
  const assetIds = assets.map((asset) => asset.id).filter(Boolean);

  if (!assetIds.length) {
    return assets.map((asset) => ({ ...asset, latestMaintenanceStatus: null }));
  }

  const result = await db.query<
    ScanEventRow & { asset_id: string | number | null }
  >(
    `
      select
        e.id,
        e.asset_id,
        e.actor_type,
        e.operator_name,
        to_jsonb(e)->>'activity_text' as activity_text,
        to_jsonb(e)->>'work_area_text' as work_area_text,
        e.hours,
        e.fuel_percent,
        to_jsonb(e)->>'fuel_litres' as fuel_litres,
        to_jsonb(e)->>'fuel_storage_id' as fuel_storage_id,
        to_jsonb(e)->>'fuel_storage_event_id' as fuel_storage_event_id,
        null::text as fuel_ledger_storage_id,
        null::numeric as fuel_ledger_litres,
        ''::text as fuel_storage_name,
        ''::text as fuel_storage_public_code,
        ''::text as fuel_ledger_event_type,
        null::numeric as fuel_storage_level_before_litres,
        null::numeric as fuel_storage_level_after_litres,
        null::numeric as asset_fuel_percent_before,
        null::numeric as asset_fuel_percent_after,
        nullif(to_jsonb(e)->>'asset_usage_reading', '')::numeric as asset_usage_reading,
        coalesce(to_jsonb(e)->>'asset_usage_metric', '') as asset_usage_metric,
        e.condition,
        e.note,
        e.photo_urls,
        e.latitude,
        e.longitude,
        e.location_text,
        e.maintenance_noted_at::text as maintenance_noted_at,
        e.created_at
      from public.asset_scan_events e
      where e.asset_id = any($1::uuid[])
        and nullif(trim(coalesce(e.note, '')), '') is not null
        and (
          lower(coalesce(e.note, '')) like 'checked%'
          or lower(coalesce(e.note, '')) like 'serviced%'
          or lower(coalesce(e.note, '')) like 'repaired%'
          or lower(coalesce(e.note, '')) like '%checked items:%'
          or lower(coalesce(e.note, '')) like '%work done:%'
          or lower(coalesce(e.note, '')) like '%service items:%'
          or lower(coalesce(e.note, '')) like '%serviced items:%'
          or lower(coalesce(e.note, '')) like '%repair details:%'
        )
      order by e.asset_id, e.created_at desc, e.id desc
    `,
    [assetIds],
  );
  const latestByAssetId = new Map<string, AssetMaintenanceStatus>();
  const latestMaintenanceSeenAssetIds = new Set<string>();

  result.rows.forEach(
    (row: ScanEventRow & { asset_id: string | number | null }) => {
      const maintenanceStatus = mapMaintenanceStatusFromScanEvent(row);
      const assetId = maintenanceStatus?.assetRegisterItemId ?? "";

      if (
        !maintenanceStatus ||
        !assetId ||
        latestMaintenanceSeenAssetIds.has(assetId)
      ) {
        return;
      }

      latestMaintenanceSeenAssetIds.add(assetId);

      if (!maintenanceStatus.notedAtIso) {
        latestByAssetId.set(assetId, maintenanceStatus);
      }
    },
  );

  return assets.map((asset) => ({
    ...asset,
    latestMaintenanceStatus: latestByAssetId.get(asset.id) ?? null,
  }));
}

function assetMaintenanceStatusSelectSql(whereClause: string): string {
  return `
    select
      e.id,
      e.asset_id,
      e.actor_type,
      e.operator_name,
      to_jsonb(e)->>'activity_text' as activity_text,
      to_jsonb(e)->>'work_area_text' as work_area_text,
      e.hours,
      e.fuel_percent,
      to_jsonb(e)->>'fuel_litres' as fuel_litres,
      to_jsonb(e)->>'fuel_storage_id' as fuel_storage_id,
      to_jsonb(e)->>'fuel_storage_event_id' as fuel_storage_event_id,
      null::text as fuel_ledger_storage_id,
      null::numeric as fuel_ledger_litres,
      ''::text as fuel_storage_name,
      ''::text as fuel_storage_public_code,
      ''::text as fuel_ledger_event_type,
      null::numeric as fuel_storage_level_before_litres,
      null::numeric as fuel_storage_level_after_litres,
      null::numeric as asset_fuel_percent_before,
      null::numeric as asset_fuel_percent_after,
      nullif(to_jsonb(e)->>'asset_usage_reading', '')::numeric as asset_usage_reading,
      coalesce(to_jsonb(e)->>'asset_usage_metric', '') as asset_usage_metric,
      e.condition,
      e.note,
      e.photo_urls,
      e.latitude,
      e.longitude,
      e.location_text,
      e.maintenance_noted_at::text as maintenance_noted_at,
      e.created_at,
      a.user_id::text as asset_owner_user_id
    from public.asset_scan_events e
    inner join public.asset_register_items a
      on a.id = e.asset_id
    ${whereClause}
  `;
}

export async function listCompletedMaintenanceScanEventsForAssets(
  assetIdsInput: string[],
): Promise<AssetMaintenanceStatus[]> {
  const assetIds = Array.from(new Set(assetIdsInput.map(asId).filter(Boolean)));
  if (!assetIds.length) return [];

  const result = await getDb().query<
    ScanEventRow & { asset_id: string | number | null }
  >(
    `
      select
        e.id,
        e.asset_id,
        coalesce(to_jsonb(e)->>'operator_name', '') as operator_name,
        nullif(to_jsonb(e)->>'hours', '') as hours,
        nullif(to_jsonb(e)->>'asset_usage_reading', '')::numeric as asset_usage_reading,
        coalesce(to_jsonb(e)->>'asset_usage_metric', '') as asset_usage_metric,
        coalesce(to_jsonb(e)->>'note', '') as note,
        coalesce(to_jsonb(e)->'photo_urls', '[]'::jsonb) as photo_urls,
        nullif(to_jsonb(e)->>'latitude', '')::double precision as latitude,
        nullif(to_jsonb(e)->>'longitude', '')::double precision as longitude,
        coalesce(to_jsonb(e)->>'location_text', '') as location_text,
        null::text as maintenance_noted_at,
        e.created_at
      from public.asset_scan_events e
      where e.asset_id = any($1::uuid[])
        and nullif(trim(coalesce(to_jsonb(e)->>'note', '')), '') is not null
        and (
          lower(coalesce(to_jsonb(e)->>'note', '')) like 'checked%'
          or lower(coalesce(to_jsonb(e)->>'note', '')) like 'serviced%'
          or lower(coalesce(to_jsonb(e)->>'note', '')) like 'repaired%'
          or lower(coalesce(to_jsonb(e)->>'note', '')) like '%checked items:%'
          or lower(coalesce(to_jsonb(e)->>'note', '')) like '%work done:%'
          or lower(coalesce(to_jsonb(e)->>'note', '')) like '%service items:%'
          or lower(coalesce(to_jsonb(e)->>'note', '')) like '%serviced items:%'
          or lower(coalesce(to_jsonb(e)->>'note', '')) like '%repair details:%'
        )
      order by e.created_at desc, e.id desc
    `,
    [assetIds],
  );

  return result.rows
    .map(mapMaintenanceStatusFromScanEvent)
    .filter((entry): entry is AssetMaintenanceStatus => Boolean(entry));
}

export async function markAssetMaintenanceStatusNoted(input: {
  currentUserId: string;
  maintenanceStatusId: string;
}): Promise<AssetMaintenanceStatus> {
  await ensureFuelLedgerTables();

  const db = getDb();
  const current = await db.query<
    ScanEventRow & {
      asset_id: string | number | null;
      asset_owner_user_id: string | null;
    }
  >(`${assetMaintenanceStatusSelectSql("where e.id = $1::uuid")} limit 1`, [
    input.maintenanceStatusId,
  ]);
  const currentRow = current.rows[0] ?? null;
  const currentStatus = currentRow
    ? mapMaintenanceStatusFromScanEvent(currentRow)
    : null;

  if (!currentRow || !currentStatus || !currentStatus.assetRegisterItemId) {
    throw new Error("MAINTENANCE_STATUS_NOT_FOUND");
  }

  if (asText(currentRow.asset_owner_user_id) !== input.currentUserId) {
    throw new Error("MAINTENANCE_STATUS_FORBIDDEN");
  }

  await db.query(
    `
      update public.asset_scan_events
      set maintenance_noted_at = coalesce(maintenance_noted_at, now())
      where id = $1::uuid
    `,
    [input.maintenanceStatusId],
  );

  const updated = await db.query<
    ScanEventRow & {
      asset_id: string | number | null;
      asset_owner_user_id: string | null;
    }
  >(`${assetMaintenanceStatusSelectSql("where e.id = $1::uuid")} limit 1`, [
    input.maintenanceStatusId,
  ]);
  const updatedStatus = updated.rows[0]
    ? mapMaintenanceStatusFromScanEvent(updated.rows[0])
    : null;

  if (!updatedStatus) {
    throw new Error("MAINTENANCE_STATUS_NOT_FOUND");
  }

  return updatedStatus;
}

export async function saveScanAssetEvent(
  input: SaveScanAssetEventInput,
): Promise<{
  asset: ScanSafeAsset;
  event: ScanEventRecord;
}> {
  await ensureFuelLedgerTables();
  await ensureScanAssetSaveColumns();
  const db = getDb();
  const normalizedCode = normalizePublicAssetCode(input.publicAssetCode);

  if (!normalizedCode) {
    throw new Error("Asset code is required.");
  }

  const expectedOwnerUserId = asText(input.ownerUserId) || null;
  const resolvedOwner = await resolveAssetOwnerByPublicAssetCode(
    normalizedCode,
    {
      assetId: asText(input.assetId) || null,
      expectedOwnerUserId,
      purpose: "save-scan-asset-event",
    },
  );
  const scopedOwnerUserId = resolvedOwner.ownerUserId;
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const assetLookup = await client.query<ScanAccessRow>(
      `
        select
          a.id,
          to_jsonb(a)->>'user_id' as user_id,
          $2::text as owner_user_id,
          nullif(trim(coalesce(to_jsonb(a)->>'register_id', '')), '') as register_id,
          nullif(trim(coalesce(to_jsonb(a)->>'sector_id', '')), '') as sector_id,
          coalesce(
            nullif(trim(coalesce(to_jsonb(a)->>'equipment_family_id', '')), ''),
            nullif(trim(coalesce(to_jsonb(vr)->>'equipment_family_id', '')), '')
          ) as equipment_family_id,
          coalesce(to_jsonb(a)->>'brand_name', to_jsonb(a)->>'brand', '') as brand_name,
          coalesce(to_jsonb(a)->>'model_name', to_jsonb(a)->>'model', '') as model_name,
          coalesce(to_jsonb(a)->>'typed_model_name', to_jsonb(vr)->>'typed_model_name', '') as typed_model_name,
          nullif(trim(coalesce(to_jsonb(a)->>'year_model', to_jsonb(a)->>'year', '')), '') as year_model,
          nullif(trim(coalesce(to_jsonb(a)->>'value', to_jsonb(a)->>'selected_value_ex_vat', to_jsonb(a)->>'selected_value', '')), '') as value,
          nullif(trim(coalesce(to_jsonb(a)->>'selected_value_ex_vat', to_jsonb(a)->>'selected_value', to_jsonb(a)->>'value', '')), '') as selected_value_ex_vat,
          nullif(trim(coalesce(to_jsonb(a)->>'replacement_price_used_ex_vat', to_jsonb(a)->>'replacement_price_ex_vat', '')), '') as replacement_price_used_ex_vat,
          nullif(trim(coalesce(to_jsonb(a)->>'user_replacement_price_ex_vat', '')), '') as user_replacement_price_ex_vat,
          to_jsonb(a)->>'public_asset_code' as public_asset_code,
          coalesce(to_jsonb(a)->>'plate_label', '') as plate_label,
          coalesce(nullif(trim(to_jsonb(a)->>'qr_status'), ''), 'active') as qr_status,
          coalesce(to_jsonb(a)->>'title', to_jsonb(a)->>'name', '') as title,
          coalesce(to_jsonb(a)->>'kind', to_jsonb(a)->>'equipment_type', to_jsonb(a)->>'asset_type', 'manual') as kind,
          coalesce(to_jsonb(ef)->>'family_key', '') as equipment_family_key,
          coalesce(to_jsonb(ef)->>'family_label', '') as equipment_family_label,
          coalesce(to_jsonb(a)->>'depreciation_method_used', '') as depreciation_method_used,
          nullif(trim(coalesce(to_jsonb(a)->>'life_worked_percent', '')), '') as life_worked_percent,
          nullif(trim(coalesce(to_jsonb(a)->>'estimated_hours', '')), '') as estimated_hours,
          nullif(trim(coalesce(to_jsonb(a)->>'max_lifetime_hours', '')), '') as max_lifetime_hours,
          coalesce(to_jsonb(a)->'specs_json', to_jsonb(vr)->'specs_json', '{}'::jsonb) as specs_json,
          to_jsonb(ef)->>'is_propelled' as family_is_propelled,
          to_jsonb(ef)->>'usage_metric_type' as family_usage_metric_type,
          coalesce(to_jsonb(a)->>'serial_number', to_jsonb(a)->>'serial', to_jsonb(a)->>'vin', '') as serial_number,
          to_jsonb(a)->>'is_financed' as is_financed,
          to_jsonb(a)->>'is_insured' as is_insured,
          to_jsonb(a)->>'is_licensed' as is_licensed,
          coalesce(
            to_jsonb(a)->>'license_registration_number',
            to_jsonb(a)->>'licence_registration_number',
            to_jsonb(a)->>'registration_number',
            to_jsonb(a)->>'number_plate',
            to_jsonb(a)->>'numberplate'
          ) as license_registration_number,
          nullif(trim(coalesce(to_jsonb(a)->>'hours', to_jsonb(a)->>'engine_hours', '')), '') as hours,
          nullif(trim(coalesce(to_jsonb(a)->>'fuel_percent', '')), '') as fuel_percent,
          coalesce(to_jsonb(a)->>'condition', '') as condition,
          coalesce(to_jsonb(a)->>'note', to_jsonb(a)->>'notes', to_jsonb(a)->>'description', '') as note,
          coalesce(to_jsonb(a)->'photo_urls', to_jsonb(a)->'photos', to_jsonb(a)->'image_urls', '[]'::jsonb) as photo_urls,
          nullif(trim(coalesce(to_jsonb(a)->>'last_scanned_at', '')), '') as last_scanned_at,
          nullif(trim(coalesce(to_jsonb(a)->>'last_known_lat', '')), '') as last_known_lat,
          nullif(trim(coalesce(to_jsonb(a)->>'last_known_lng', '')), '') as last_known_lng,
          coalesce(to_jsonb(a)->>'last_known_location_text', '') as last_known_location_text,
          nullif(trim(coalesce(to_jsonb(a)->>'created_at', '')), '') as created_at,
          nullif(trim(coalesce(to_jsonb(a)->>'updated_at', '')), '') as updated_at,
          nullif(trim(coalesce(to_jsonb(a)->>'valuation_run_id', to_jsonb(a)->>'run_id', '')), '') as valuation_run_id,
          coalesce(to_jsonb(a)->>'selected_method', to_jsonb(a)->>'method', to_jsonb(a)->>'valuation_method', 'manual') as selected_method,
          ''::text as scan_pin_hash,
          false as scan_pin_enabled,
          null::timestamptz as scan_pin_updated_at
        from asset_register_items a
        left join valuation_runs vr
          on vr.id::text = nullif(trim(coalesce(to_jsonb(a)->>'valuation_run_id', to_jsonb(a)->>'run_id', '')), '')
        left join equipment_families ef
          on ef.id::text = coalesce(
            nullif(trim(coalesce(to_jsonb(a)->>'equipment_family_id', '')), ''),
            nullif(trim(coalesce(to_jsonb(vr)->>'equipment_family_id', '')), '')
          )
        where a.id::text = $1
          and upper(regexp_replace(coalesce(to_jsonb(a)->>'public_asset_code', ''), '\\s+', '', 'g')) = $3
        limit 1
      `,
      [resolvedOwner.assetId, scopedOwnerUserId, normalizedCode],
    );

    const existingRow = assetLookup.rows[0];

    if (!existingRow) {
      throw new Error("Asset not found.");
    }

    const currentAsset = mapScanSafeAsset(existingRow);
    const currentUsageMode = currentAsset.usageMode;
    const currentLifeWorkedPercent = currentAsset.lifeWorkedPercent;
    const nextOperatorName = asText(input.operatorName) || null;
    const nextHours =
      typeof input.hours === "number" && Number.isFinite(input.hours)
        ? Math.max(0, Math.round(input.hours))
        : null;
    const nextLifeWorkedPercent =
      typeof input.lifeWorkedPercent === "number" &&
      Number.isFinite(input.lifeWorkedPercent)
        ? clampPercent(input.lifeWorkedPercent)
        : null;
    const nextFuelPercent =
      typeof input.fuelPercent === "number" &&
      Number.isFinite(input.fuelPercent)
        ? Math.max(0, Math.min(100, Math.round(input.fuelPercent)))
        : null;
    const nextCondition = normalizeCondition(input.condition) || null;
    const rawNote = asText(input.note);
    const usageNote =
      nextLifeWorkedPercent !== null
        ? `Lifetime worked updated to ${nextLifeWorkedPercent}%.`
        : "";
    const nextNote = [usageNote, rawNote].filter(Boolean).join("\n\n") || null;
    const nextPhotoUrls = normalizePhotos(input.photoUrls ?? []);
    const nextLatitude =
      typeof input.latitude === "number" &&
      Number.isFinite(input.latitude) &&
      Math.abs(input.latitude) <= 90
        ? input.latitude
        : null;
    const nextLongitude =
      typeof input.longitude === "number" &&
      Number.isFinite(input.longitude) &&
      Math.abs(input.longitude) <= 180
        ? input.longitude
        : null;
    const nextLocationText = asText(input.locationText) || null;
    const clientEventId = normalizeClientEventId(input.clientEventId);
    const clientCapturedAt = normalizeClientCapturedAt(input.clientCapturedAt);
    const gpsAccuracyMeters = normalizeGpsAccuracyMeters(
      input.gpsAccuracyMeters,
    );
    const fieldManagerId = asText(input.fieldManagerId) || null;
    const fieldManagerDisplayName =
      asText(input.fieldManagerDisplayName) || null;
    const fieldManagerSessionId = asText(input.fieldManagerSessionId) || null;
    const eventUsageReading = nextLifeWorkedPercent ?? nextHours;
    const eventUsageMetric = currentUsageMode === "percent"
      ? "percentage"
      : currentUsageMode;

    if (clientEventId) {
      const existingEvent = await client.query<ScanEventRow>(
        `
          select
            e.id,
            e.actor_type,
            e.operator_name,
            e.activity_text,
            e.work_area_text,
            e.hours,
            e.fuel_percent,
            e.fuel_litres,
            e.fuel_storage_id,
            e.fuel_storage_event_id,
            e.condition,
            e.note,
            e.photo_urls,
            e.latitude,
            e.longitude,
            e.location_text,
            e.maintenance_noted_at,
            e.created_at,
            null::uuid as fuel_ledger_storage_id,
            null::numeric as fuel_ledger_litres,
            null::text as fuel_storage_name,
            null::text as fuel_storage_public_code,
            null::text as fuel_ledger_event_type,
            null::numeric as fuel_storage_level_before_litres,
            null::numeric as fuel_storage_level_after_litres,
            null::integer as asset_fuel_percent_before,
            null::integer as asset_fuel_percent_after,
            nullif(to_jsonb(e)->>'asset_usage_reading', '')::numeric as asset_usage_reading,
            coalesce(to_jsonb(e)->>'asset_usage_metric', '') as asset_usage_metric,
            coalesce(to_jsonb(e)->>'source_type', '') as source_type,
            coalesce(to_jsonb(e)->>'source_label', '') as source_label,
            e.created_at as report_occurred_at
          from public.asset_scan_events e
          where e.asset_id::text = $1 and e.client_event_id = $2
          order by e.created_at desc, e.id desc
          limit 1
        `,
        [currentAsset.id, clientEventId],
      );

      const duplicateEvent = existingEvent.rows[0];
      if (duplicateEvent) {
        await client.query("COMMIT");
        return {
          asset: currentAsset,
          event: mapScanEventRow(duplicateEvent),
        };
      }
    }

    if (nextHours !== null && currentUsageMode === "percent") {
      throw new Error("USAGE_MODE_PERCENT_CANNOT_ACCEPT_HOURS");
    }

    if (nextLifeWorkedPercent !== null && currentUsageMode !== "percent") {
      throw new Error("USAGE_MODE_HOURS_CANNOT_ACCEPT_PERCENT");
    }

    if (nextFuelPercent !== null && !currentAsset.canUpdateFuel) {
      throw new Error("ASSET_DOES_NOT_ACCEPT_FUEL");
    }

    if (
      nextHours !== null &&
      currentAsset.hours !== null &&
      nextHours < currentAsset.hours
    ) {
      throw new Error("USAGE_READING_CANNOT_DECREASE");
    }

    if (
      nextLifeWorkedPercent !== null &&
      currentLifeWorkedPercent !== null &&
      nextLifeWorkedPercent < currentLifeWorkedPercent
    ) {
      throw new Error("LIFE_WORKED_PERCENT_CANNOT_DECREASE");
    }

    const valuationStaleReasons: string[] = [];
    if (hasSavedValuation(existingRow)) {
      if (nextHours !== null && nextHours !== currentAsset.hours) {
        valuationStaleReasons.push("usage changed");
      }

      if (
        nextLifeWorkedPercent !== null &&
        nextLifeWorkedPercent !== currentLifeWorkedPercent
      ) {
        valuationStaleReasons.push("life worked changed");
      }

      if (
        nextCondition &&
        currentAsset.condition &&
        nextCondition !== currentAsset.condition
      ) {
        valuationStaleReasons.push("condition changed");
      }
    }

    const shouldCaptureDepreciationLogEntry = valuationStaleReasons.length > 0;

    const baseSpecsJson =
      nextLifeWorkedPercent !== null
        ? applyLifeWorkedPercent(
            asRecord(existingRow.specs_json),
            nextLifeWorkedPercent,
          )
        : asRecord(existingRow.specs_json);
    const nextSpecsJson = markValuationNeedsUpdate(
      baseSpecsJson,
      valuationStaleReasons,
    );

    const insertedEvent = await client.query<ScanEventRow>(
      `
        insert into asset_scan_events (
          asset_id,
          actor_type,
          operator_name,
          hours,
          fuel_percent,
          condition,
          note,
          photo_urls,
          latitude,
          longitude,
          location_text,
          client_event_id,
          client_captured_at,
          synced_at,
          gps_accuracy_meters,
          field_manager_id,
          field_manager_display_name,
          field_manager_session_id,
          asset_usage_reading,
          asset_usage_metric,
          source_type,
          source_label,
          created_at
        )
        values (
          $1,
          $2::text,
          $3::text,
          $4::numeric,
          $5::integer,
          $6::text,
          $7::text,
          $8::jsonb,
          $9::double precision,
          $10::double precision,
          $11::text,
          $12::text,
          $13::timestamptz,
          now(),
          $14::double precision,
          $15::uuid,
          $16::text,
          $17::text,
          $18::numeric,
          $19::text,
          $20::text,
          $21::text,
          coalesce($13::timestamptz, now())
        )
        returning
          id,
          actor_type,
          operator_name,
          hours,
          fuel_percent,
          condition,
          note,
          photo_urls,
          latitude,
          longitude,
          location_text,
          asset_usage_reading,
          asset_usage_metric,
          source_type,
          source_label,
          created_at as report_occurred_at,
          created_at
      `,
      [
        currentAsset.id,
        normalizeActorType(input.actorType),
        nextOperatorName,
        nextHours,
        nextFuelPercent,
        nextCondition,
        nextNote,
        JSON.stringify(nextPhotoUrls),
        nextLatitude,
        nextLongitude,
        nextLocationText,
        clientEventId,
        clientCapturedAt,
        gpsAccuracyMeters,
        fieldManagerId,
        fieldManagerDisplayName,
        fieldManagerSessionId,
        eventUsageReading,
        eventUsageMetric,
        "asset_qr_scan",
        "QR Scan",
      ],
    );

    const existingScanPhotoRows = await client.query<{ photo_urls: unknown }>(
      `
        select e.photo_urls
        from public.asset_scan_events e
        where e.asset_id::text = $1
        order by e.created_at asc, e.id asc
      `,
      [currentAsset.id],
    );
    const existingScanManagedPhotos = collectScanManagedPhotoUrls(
      existingScanPhotoRows.rows,
    );
    const mergedPhotos = mergePhotos(
      currentAsset.photos,
      nextPhotoUrls,
      existingScanManagedPhotos,
    );
    const updatedAsset = await client.query<ScanAccessRow>(
      `
        with updated as (
          update asset_register_items
          set
            hours = case when $10::numeric is null then coalesce($2::numeric, hours) else hours end,
            life_worked_percent = coalesce($10::numeric, life_worked_percent),
            life_remaining_percent = case when $10::numeric is null then life_remaining_percent else greatest(0, 100 - $10::numeric) end,
            fuel_percent = coalesce($3::integer, fuel_percent),
            condition = coalesce($4::text, condition),
            photo_urls = $5::jsonb,
            last_scanned_at = coalesce($11::timestamptz, now()),
            last_known_lat = coalesce($6::double precision, last_known_lat),
            last_known_lng = coalesce($7::double precision, last_known_lng),
            last_known_location_text = coalesce($8::text, last_known_location_text),
            specs_json = $9::jsonb,
            updated_at = now()
          where id = $1
          returning *
        )
        select
          u.id,
          u.user_id,
          $12::text as owner_user_id,
          u.public_asset_code,
          u.plate_label,
          u.qr_status,
          u.title,
          u.kind,
          coalesce(ef.family_key, '') as equipment_family_key,
          coalesce(ef.family_label, '') as equipment_family_label,
          u.depreciation_method_used,
          u.life_worked_percent,
          u.estimated_hours,
          u.max_lifetime_hours,
          coalesce(u.specs_json, '{}'::jsonb) as specs_json,
          ef.is_propelled as family_is_propelled,
          ef.usage_metric_type as family_usage_metric_type,
          u.serial_number,
          to_jsonb(u)->>'is_financed' as is_financed,
          to_jsonb(u)->>'is_insured' as is_insured,
          to_jsonb(u)->>'is_licensed' as is_licensed,
          to_jsonb(u)->>'license_registration_number' as license_registration_number,
          u.hours,
          u.fuel_percent,
          u.condition,
          u.note,
          u.photo_urls,
          u.last_scanned_at,
          u.last_known_lat,
          u.last_known_lng,
          u.last_known_location_text,
          u.created_at,
          u.updated_at,
          u.valuation_run_id,
          u.selected_method,
          ''::text as scan_pin_hash,
          false as scan_pin_enabled,
          null::timestamptz as scan_pin_updated_at
        from updated u
        left join valuation_runs vr
          on vr.id::text = nullif(trim(coalesce(to_jsonb(u)->>'valuation_run_id', to_jsonb(u)->>'run_id', '')), '')
        left join equipment_families ef
          on ef.id::text = coalesce(
            nullif(trim(coalesce(to_jsonb(u)->>'equipment_family_id', '')), ''),
            nullif(trim(coalesce(to_jsonb(vr)->>'equipment_family_id', '')), '')
          )
      `,
      [
        currentAsset.id,
        nextHours,
        nextFuelPercent,
        nextCondition,
        JSON.stringify(mergedPhotos),
        nextLatitude,
        nextLongitude,
        nextLocationText,
        JSON.stringify(nextSpecsJson),
        nextLifeWorkedPercent,
        clientCapturedAt,
        scopedOwnerUserId,
      ],
    );

    await client.query("COMMIT");

    const assetRow = updatedAsset.rows[0];
    const eventRow = insertedEvent.rows[0];

    if (!assetRow || !eventRow) {
      throw new Error("Failed to save scan update.");
    }

    const asset = mapScanSafeAsset(assetRow);
    const event = mapScanEventRow(eventRow);

    if (shouldCaptureDepreciationLogEntry) {
      await captureAssetDepreciationLogEntryForAssetId({
        userId: currentAsset.userId,
        assetId: currentAsset.id,
        previousAsset: mapScanAccessRowToDepreciationAsset(existingRow),
        eventType: "qr_scan_update",
        eventSource: "asset-register-qr-scan",
        capturedAt: event.createdAtIso,
        metadata: {
          scanEventId: event.id,
          publicAssetCode: normalizedCode,
          valuationNeedsUpdate: valuationStaleReasons.length > 0,
          valuationStaleReasons,
          valuationRelevantReasons: valuationStaleReasons,
          logEventReasons: valuationStaleReasons,
          timelineEventReasons: valuationStaleReasons,
          usageMode: currentUsageMode,
        },
      });
    }

    return {
      asset,
      event,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
