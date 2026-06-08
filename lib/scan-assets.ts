import { getDb } from './db';
import { MAX_ASSET_REGISTER_PHOTOS } from './asset-register-uploads';
import { ensureFuelLedgerTables } from './fuel-ledger';

export type ScanAssetQrStatus = 'active' | 'transferred' | 'retired' | 'deleted' | '';
export type ScanAssetUsageMode = 'hours' | 'percent' | 'km' | 'none';
export type ScanAssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';
export type ScanAccessMode = 'owner_session' | 'scan_pin';
export type ScanEventActorType = ScanAccessMode | 'admin_session';

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
  financeStatus: ScanAssetStatusChoice;
  insuranceStatus: ScanAssetStatusChoice;
  licenseStatus: ScanAssetStatusChoice;
  licenseRegistrationNumber: string;
  hours: number | null;
  usageMode: ScanAssetUsageMode;
  usageMetric: 'hours' | 'km';
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
  fuelStorageLevelBefore: number | null;
  fuelStorageLevelAfter: number | null;
  assetFuelPercentBefore: number | null;
  assetFuelPercentAfter: number | null;
  assetUsageReading: number | null;
  condition: string;
  note: string;
  photoUrls: string[];
  latitude: number | null;
  longitude: number | null;
  locationText: string;
  createdAtIso: string;
};

export type AssetMaintenanceStatusKind = 'checked' | 'serviced' | 'repaired';

export type AssetMaintenanceStatus = {
  id: string;
  assetRegisterItemId: string;
  kind: AssetMaintenanceStatusKind;
  summary: string;
  note: string;
  operatorName: string;
  createdAtIso: string;
  notedAtIso: string | null;
};

export type SaveScanAssetEventInput = {
  publicAssetCode: string;
  actorType: ScanEventActorType;
  operatorName?: string | null;
  hours?: number | null;
  lifeWorkedPercent?: number | null;
  fuelPercent?: number | null;
  condition?: string | null;
  note?: string | null;
  photoUrls?: string[];
  latitude?: number | null;
  longitude?: number | null;
  locationText?: string | null;
};

type ScanAccessRow = {
  id: string | number;
  user_id: string | null;
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
  fuel_storage_level_before_litres: string | number | null;
  fuel_storage_level_after_litres: string | number | null;
  asset_fuel_percent_before: string | number | null;
  asset_fuel_percent_after: string | number | null;
  asset_usage_reading: string | number | null;
  condition: string | null;
  note: string | null;
  photo_urls: unknown;
  latitude: string | number | null;
  longitude: string | number | null;
  location_text: string | null;
  maintenance_noted_at?: string | null;
  created_at: string | null;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLicenseRegistrationNumber(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function asId(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return value.toString();
  return '';
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'n') return false;
  }

  return null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function asPercent(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed === null || parsed < 0 || parsed > 100 ? null : clampPercent(parsed);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => asText(entry)).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map((entry) => asText(entry)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizePhotos(value: unknown): string[] {
  const seen = new Set<string>();

  return asStringArray(value)
    .slice(0, MAX_ASSET_REGISTER_PHOTOS)
    .filter((entry) => {
      if (!entry || seen.has(entry)) {
        return false;
      }

      seen.add(entry);
      return true;
    });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function normalizeAssetStatusChoice(value: unknown, fallback: ScanAssetStatusChoice = 'unknown'): ScanAssetStatusChoice {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (['yes', 'y', 'true', 'financed', 'insured', 'licensed', 'licenced'].includes(normalized)) {
    return 'yes';
  }

  if (['no', 'n', 'false', 'not_financed', 'not_insured', 'not_licensed', 'not_licenced', 'unfinanced', 'uninsured', 'unlicensed', 'unlicenced'].includes(normalized)) {
    return 'no';
  }

  if (['na', 'n_a', 'not_applicable', 'not_aplicable', 'not_relevant', 'does_not_apply'].includes(normalized)) {
    return 'not_applicable';
  }

  if (['unknown', 'not_sure', 'unsure', 'maybe', ''].includes(normalized)) {
    return normalized ? 'unknown' : fallback;
  }

  return fallback;
}

function statusFallbackFromBoolean(value: unknown): ScanAssetStatusChoice {
  const parsed = asBoolean(value);
  if (parsed === null) return 'unknown';
  return parsed ? 'yes' : 'no';
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

function readLicenseRegistrationFromSpecs(specs: Record<string, unknown>): string {
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

function applyLifeWorkedPercent(specs: Record<string, unknown>, lifeWorkedPercent: number): Record<string, unknown> {
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

function normalizeUsageMetric(value: unknown, kind = ''): 'hours' | 'km' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'km' || normalized === 'kms' || normalized === 'kilometres' || normalized === 'kilometers') return 'km';
  return kind === 'vehicle' ? 'km' : 'hours';
}

function readSpecUsageMode(specs: Record<string, unknown>): ScanAssetUsageMode | null {
  const raw = String(
    specs.usageMode ?? specs.usage_mode ?? specs.usageMetricType ?? specs.usage_metric_type ?? specs.valuation_mode ?? '',
  )
    .trim()
    .toLowerCase();

  if (raw === 'percent' || raw === 'percentage' || raw === 'percentage_depreciation' || raw === 'percent_used' || raw === 'wear_class') return 'percent';
  if (raw === 'km' || raw === 'kms' || raw === 'kilometres' || raw === 'kilometers') return 'km';
  if (raw === 'hours' || raw === 'engine_hours' || raw === 'hour_meter') return 'hours';
  return null;
}

function scanLifeWorkedPercent(row: Pick<ScanAccessRow, 'life_worked_percent' | 'specs_json'>): number | null {
  return asPercent(row.life_worked_percent) ?? percentFromSpecs(asRecord(row.specs_json));
}

function inferScanUsageMode(row: ScanAccessRow): ScanAssetUsageMode {
  const specs = asRecord(row.specs_json);
  const specUsageMode = readSpecUsageMode(specs);
  const kind = asText(row.kind).toLowerCase();
  const familyUsageMetricType = asText(row.family_usage_metric_type).toLowerCase();
  const depreciationMethod = asText(row.depreciation_method_used).toLowerCase();
  const usageMetric = normalizeUsageMetric(specs.usageMetric ?? specs.usage_metric ?? specs.usageUnit ?? specs.usage_unit, kind);
  const lifeWorkedPercent = scanLifeWorkedPercent(row);
  const hours = asNumber(row.hours);

  if (kind === 'property') return 'none';
  if (kind === 'vehicle') return usageMetric === 'km' ? 'km' : 'hours';
  if (specUsageMode) return specUsageMode;
  if (familyUsageMetricType === 'wear_class' || familyUsageMetricType === 'percent_used' || familyUsageMetricType === 'percentage') return 'percent';
  if (depreciationMethod === 'percentage_depreciation') return 'percent';
  if (lifeWorkedPercent !== null && (!hours || hours <= 0 || depreciationMethod === 'semi_depreciation')) return 'percent';
  if (hours !== null && hours > 0) return 'hours';
  if (kind === 'tractor' || familyUsageMetricType === 'hours') return 'hours';
  if (lifeWorkedPercent !== null) return 'percent';
  return 'none';
}

function inferIsPropelled(row: ScanAccessRow): boolean {
  const specs = asRecord(row.specs_json);
  const kind = asText(row.kind).toLowerCase();
  const specValue = asBoolean(specs.is_propelled ?? specs.isPropelled ?? specs.self_propelled ?? specs.selfPropelled);
  const familyValue = asBoolean(row.family_is_propelled);

  if (kind === 'tractor' || kind === 'vehicle') return true;
  if (specValue !== null) return specValue;
  if (familyValue !== null) return familyValue;
  return false;
}

function hasSavedValuation(row: ScanAccessRow): boolean {
  const selectedMethod = asText(row.selected_method).toLowerCase();
  return Boolean(row.valuation_run_id && selectedMethod !== 'manual');
}

function markValuationNeedsUpdate(specs: Record<string, unknown>, reasons: string[]): Record<string, unknown> {
  const uniqueReasons = Array.from(new Set(reasons.map((reason) => reason.trim()).filter(Boolean)));

  if (!uniqueReasons.length) {
    return specs;
  }

  const nowIso = new Date().toISOString();
  const existingSince = asText(specs.valuation_stale_since) || asText(specs.valuationStaleSince) || nowIso;

  return {
    ...specs,
    valuationNeedsUpdate: true,
    valuation_needs_update: true,
    valuationStaleSince: existingSince,
    valuation_stale_since: existingSince,
    valuationStaleReason: uniqueReasons.join(', '),
    valuation_stale_reason: uniqueReasons.join(', '),
    valuationStaleReasons: uniqueReasons,
    valuation_stale_reasons: uniqueReasons,
  };
}

function normalizeQrStatus(value: unknown): ScanAssetQrStatus {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (
    normalized === 'active' ||
    normalized === 'transferred' ||
    normalized === 'retired' ||
    normalized === 'deleted'
  ) {
    return normalized;
  }

  return '';
}

function normalizeCondition(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'excellent') return 'excellent';
  if (normalized === 'good') return 'good';
  if (normalized === 'fair') return 'fair';
  if (normalized === 'used') return 'used';
  if (normalized === 'serious' || normalized === 'requires attention' || normalized === 'requires serious attention') {
    return 'serious';
  }

  return '';
}

function normalizeActorType(value: unknown): ScanEventActorType {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'owner_session') return 'owner_session';
  if (normalized === 'admin_session') return 'admin_session';
  return 'scan_pin';
}

function mergePhotos(existing: string[], next: string[]): string[] {
  const seen = new Set<string>();
  const merged = [...existing, ...next].filter((entry) => {
    const normalized = asText(entry);

    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });

  return merged.slice(0, MAX_ASSET_REGISTER_PHOTOS);
}

function mapScanSafeAsset(row: ScanAccessRow): ScanSafeAsset {
  const kind = asText(row.kind).toLowerCase();
  const specs = asRecord(row.specs_json);
  const usageMetric = normalizeUsageMetric(specs.usageMetric ?? specs.usage_metric ?? specs.usageUnit ?? specs.usage_unit, kind);
  const isPropelled = inferIsPropelled(row);

  return {
    id: asId(row.id),
    userId: asText(row.user_id),
    publicAssetCode: asText(row.public_asset_code),
    plateLabel: asText(row.plate_label),
    qrStatus: normalizeQrStatus(row.qr_status),
    title: asText(row.title),
    kind,
    equipmentFamilyKey: asText(row.equipment_family_key),
    equipmentFamilyLabel: asText(row.equipment_family_label),
    serialNumber: asText(row.serial_number),
    financeStatus: readStatusFromSpecs(specs, ['financeStatus', 'finance_status', 'financedStatus', 'financed_status'], statusFallbackFromBoolean(row.is_financed)),
    insuranceStatus: readStatusFromSpecs(specs, ['insuranceStatus', 'insurance_status', 'insuredStatus', 'insured_status'], statusFallbackFromBoolean(row.is_insured)),
    licenseStatus: readStatusFromSpecs(specs, ['licenseStatus', 'license_status', 'licensedStatus', 'licensed_status', 'licenceStatus', 'licence_status', 'licencedStatus', 'licenced_status'], statusFallbackFromBoolean(row.is_licensed)),
    licenseRegistrationNumber: normalizeLicenseRegistrationNumber(row.license_registration_number) || readLicenseRegistrationFromSpecs(specs),
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

function mapScanEventRow(row: ScanEventRow): ScanEventRecord {
  const fuelLedgerLitres = asNumber(row.fuel_ledger_litres);
  const assetFuelPercentAfter = asNumber(row.asset_fuel_percent_after) ?? asNumber(row.fuel_percent);
  const assetUsageReading = asNumber(row.asset_usage_reading) ?? asNumber(row.hours);

  return {
    id: asId(row.id),
    actorType: normalizeActorType(row.actor_type),
    operatorName: asText(row.operator_name),
    activityText: asText(row.activity_text),
    workAreaText: asText(row.work_area_text),
    hours: asNumber(row.hours),
    fuelPercent: assetFuelPercentAfter,
    fuelLitres: asNumber(row.fuel_litres) ?? fuelLedgerLitres,
    fuelStorageId: asId(row.fuel_storage_id) || asId(row.fuel_ledger_storage_id),
    fuelStorageEventId: asId(row.fuel_storage_event_id),
    fuelStorageName: asText(row.fuel_storage_name),
    fuelStoragePublicCode: asText(row.fuel_storage_public_code),
    fuelLedgerEventType: asText(row.fuel_ledger_event_type),
    fuelStorageLevelBefore: asNumber(row.fuel_storage_level_before_litres),
    fuelStorageLevelAfter: asNumber(row.fuel_storage_level_after_litres),
    assetFuelPercentBefore: asNumber(row.asset_fuel_percent_before),
    assetFuelPercentAfter,
    assetUsageReading,
    condition: normalizeCondition(row.condition),
    note: asText(row.note),
    photoUrls: normalizePhotos(row.photo_urls),
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    locationText: asText(row.location_text),
    createdAtIso: row.created_at ?? new Date().toISOString(),
  };
}


function splitMaintenanceNoteLines(note: string): string[] {
  return String(note ?? '')
    .split(/\r?\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function extractMaintenanceNoteValue(note: string, label: string): string {
  const prefix = `${label.toLowerCase()}:`;
  const line = splitMaintenanceNoteLines(note).find((entry) => entry.toLowerCase().startsWith(prefix));

  if (!line) {
    return '';
  }

  return line.slice(prefix.length).replace(/\s+/g, ' ').trim();
}

function resolveMaintenanceStatusKind(note: string): AssetMaintenanceStatusKind | null {
  const lines = splitMaintenanceNoteLines(note);
  const firstLine = (lines[0] ?? '').toLowerCase();
  const compactNote = lines.join(' ').toLowerCase();

  if (/^repaired(?:\b|$)/.test(firstLine) || compactNote.includes('repair details:')) {
    return 'repaired';
  }

  if (
    /^serviced(?:\b|$)/.test(firstLine) ||
    compactNote.includes('work done:') ||
    compactNote.includes('service items:') ||
    compactNote.includes('serviced items:')
  ) {
    return 'serviced';
  }

  if (/^checked(?:\b|$)/.test(firstLine) || compactNote.includes('checked items:')) {
    return 'checked';
  }

  return null;
}

function summarizeMaintenanceStatus(note: string, kind: AssetMaintenanceStatusKind): { summary: string; note: string } {
  const actionLabel = kind === 'checked' ? 'Checked' : kind === 'repaired' ? 'Repaired' : 'Serviced';
  const detail =
    kind === 'checked'
      ? extractMaintenanceNoteValue(note, 'Checked items')
      : kind === 'repaired'
        ? extractMaintenanceNoteValue(note, 'Repair details')
        : extractMaintenanceNoteValue(note, 'Work done') ||
          extractMaintenanceNoteValue(note, 'Service items') ||
          extractMaintenanceNoteValue(note, 'Serviced items');
  const company = extractMaintenanceNoteValue(note, 'Company');
  const mechanic = extractMaintenanceNoteValue(note, 'Mechanic');
  const noteText = extractMaintenanceNoteValue(note, 'Notes');
  const providerText = [company, mechanic].filter(Boolean).join(' · ');
  const summaryParts = [
    detail ? `${actionLabel}: ${detail}` : `${actionLabel} maintenance has been recorded.`,
    providerText ? `By ${providerText}` : '',
  ].filter(Boolean);

  return {
    summary: summaryParts.join(' • '),
    note: noteText,
  };
}

function mapMaintenanceStatusFromScanEvent(row: ScanEventRow & { asset_id?: string | number | null }): AssetMaintenanceStatus | null {
  const note = asText(row.note);
  const kind = resolveMaintenanceStatusKind(note);

  if (!kind) {
    return null;
  }

  const summary = summarizeMaintenanceStatus(note, kind);

  return {
    id: asId(row.id),
    assetRegisterItemId: asId(row.asset_id),
    kind,
    summary: summary.summary,
    note: summary.note,
    operatorName: asText(row.operator_name),
    createdAtIso: row.created_at ?? new Date().toISOString(),
    notedAtIso: row.maintenance_noted_at ?? null,
  };
}

export function normalizePublicAssetCode(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

export async function getScanAssetAccessContext(publicAssetCode: string): Promise<ScanAssetAccessContext | null> {
  const db = getDb();
  const normalizedCode = normalizePublicAssetCode(publicAssetCode);

  if (!normalizedCode) {
    return null;
  }

  const result = await db.query<ScanAccessRow>(
    `
      select
        a.id,
        a.user_id,
        a.public_asset_code,
        a.plate_label,
        a.qr_status,
        a.title,
        a.kind,
        coalesce(ef.family_key, '') as equipment_family_key,
        coalesce(ef.family_label, '') as equipment_family_label,
        a.depreciation_method_used,
        a.life_worked_percent,
        a.estimated_hours,
        a.max_lifetime_hours,
        coalesce(a.specs_json, '{}'::jsonb) as specs_json,
        ef.is_propelled as family_is_propelled,
        ef.usage_metric_type as family_usage_metric_type,
        a.serial_number,
        to_jsonb(a)->>'is_financed' as is_financed,
        to_jsonb(a)->>'is_insured' as is_insured,
        to_jsonb(a)->>'is_licensed' as is_licensed,
        to_jsonb(a)->>'license_registration_number' as license_registration_number,
        a.hours,
        a.fuel_percent,
        a.condition,
        a.note,
        a.photo_urls,
        a.last_scanned_at,
        a.last_known_lat,
        a.last_known_lng,
        a.last_known_location_text,
        a.created_at,
        a.updated_at,
        a.valuation_run_id,
        a.selected_method,
        coalesce(p.scan_pin_hash, '') as scan_pin_hash,
        coalesce(p.scan_pin_enabled, false) as scan_pin_enabled,
        p.scan_pin_updated_at
      from asset_register_items a
      left join valuation_runs vr
        on vr.id = a.valuation_run_id
      left join equipment_families ef
        on ef.id = coalesce(a.equipment_family_id, vr.equipment_family_id)
      left join account_profiles p
        on p.user_id = a.user_id
      where upper(a.public_asset_code) = $1
      limit 1
    `,
    [normalizedCode],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    asset: mapScanSafeAsset(row),
    scanPinHash: asText(row.scan_pin_hash),
    scanPinEnabled: Boolean(row.scan_pin_enabled) && Boolean(asText(row.scan_pin_hash)),
    scanPinUpdatedAtIso: row.scan_pin_updated_at ?? null,
  };
}

export type ScanEventListFilters = {
  fromIso?: string;
  toIso?: string;
  onlyFuel?: boolean;
};

export async function listScanEventsForAsset(assetId: string, limit = 250, filters?: ScanEventListFilters): Promise<ScanEventRecord[]> {
  await ensureFuelLedgerTables();

  const db = getDb();
  const safeLimit = Math.max(1, Math.min(500, Math.round(limit || 250)));
  const queryParams: unknown[] = [assetId];
  const whereClauses = ['e.asset_id = $1'];

  if (filters?.fromIso) {
    queryParams.push(filters.fromIso);
    whereClauses.push(`e.created_at >= $${queryParams.length}`);
  }

  if (filters?.toIso) {
    queryParams.push(filters.toIso);
    whereClauses.push(`e.created_at < $${queryParams.length}`);
  }

  if (filters?.onlyFuel) {
    whereClauses.push(`(
          e.fuel_percent is not null
          or nullif(to_jsonb(e)->>'fuel_storage_event_id', '') is not null
          or fse.id is not null
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
        coalesce(fsu.name, '') as fuel_storage_name,
        coalesce(fsu.public_fuel_storage_code, '') as fuel_storage_public_code,
        coalesce(fse.event_type, '') as fuel_ledger_event_type,
        fse.storage_level_before_litres as fuel_storage_level_before_litres,
        fse.storage_level_after_litres as fuel_storage_level_after_litres,
        fse.asset_fuel_percent_before as asset_fuel_percent_before,
        fse.asset_fuel_percent_after as asset_fuel_percent_after,
        fse.asset_usage_reading as asset_usage_reading,
        e.condition,
        e.note,
        e.photo_urls,
        e.latitude,
        e.longitude,
        e.location_text,
        e.maintenance_noted_at::text as maintenance_noted_at,
        e.created_at
      from public.asset_scan_events e
      left join public.fuel_storage_events fse
        on fse.id::text = nullif(to_jsonb(e)->>'fuel_storage_event_id', '')
      left join public.fuel_storage_units fsu
        on fsu.id = fse.storage_id
      where ${whereClauses.join('\n        and ')}
      order by e.created_at desc, e.id desc
      limit ${safeLimit}
    `,
    queryParams,
  );

  return result.rows.map(mapScanEventRow);
}

export async function listRecentScanEvents(assetId: string, limit = 10): Promise<ScanEventRecord[]> {
  return listScanEventsForAsset(assetId, Math.max(1, Math.min(25, Math.round(limit || 10))));
}


export async function attachLatestMaintenanceStatusToAssets<T extends { id: string }>(
  assets: T[],
): Promise<Array<T & { latestMaintenanceStatus: AssetMaintenanceStatus | null }>> {
  if (!assets.length) {
    return [];
  }

  await ensureFuelLedgerTables();

  const db = getDb();
  const assetIds = assets.map((asset) => asset.id).filter(Boolean);

  if (!assetIds.length) {
    return assets.map((asset) => ({ ...asset, latestMaintenanceStatus: null }));
  }

  const result = await db.query<ScanEventRow & { asset_id: string | number | null }>(
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
        null::numeric as asset_usage_reading,
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

  result.rows.forEach((row: ScanEventRow & { asset_id: string | number | null }) => {
    const maintenanceStatus = mapMaintenanceStatusFromScanEvent(row);
    const assetId = maintenanceStatus?.assetRegisterItemId ?? '';

    if (!maintenanceStatus || !assetId || latestMaintenanceSeenAssetIds.has(assetId)) {
      return;
    }

    latestMaintenanceSeenAssetIds.add(assetId);

    if (!maintenanceStatus.notedAtIso) {
      latestByAssetId.set(assetId, maintenanceStatus);
    }
  });

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
      null::numeric as asset_usage_reading,
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

export async function markAssetMaintenanceStatusNoted(input: {
  currentUserId: string;
  maintenanceStatusId: string;
}): Promise<AssetMaintenanceStatus> {
  await ensureFuelLedgerTables();

  const db = getDb();
  const current = await db.query<ScanEventRow & { asset_id: string | number | null; asset_owner_user_id: string | null }>(
    `${assetMaintenanceStatusSelectSql('where e.id = $1::uuid')} limit 1`,
    [input.maintenanceStatusId],
  );
  const currentRow = current.rows[0] ?? null;
  const currentStatus = currentRow ? mapMaintenanceStatusFromScanEvent(currentRow) : null;

  if (!currentRow || !currentStatus || !currentStatus.assetRegisterItemId) {
    throw new Error('MAINTENANCE_STATUS_NOT_FOUND');
  }

  if (asText(currentRow.asset_owner_user_id) !== input.currentUserId) {
    throw new Error('MAINTENANCE_STATUS_FORBIDDEN');
  }

  await db.query(
    `
      update public.asset_scan_events
      set maintenance_noted_at = coalesce(maintenance_noted_at, now())
      where id = $1::uuid
    `,
    [input.maintenanceStatusId],
  );

  const updated = await db.query<ScanEventRow & { asset_id: string | number | null; asset_owner_user_id: string | null }>(
    `${assetMaintenanceStatusSelectSql('where e.id = $1::uuid')} limit 1`,
    [input.maintenanceStatusId],
  );
  const updatedStatus = updated.rows[0] ? mapMaintenanceStatusFromScanEvent(updated.rows[0]) : null;

  if (!updatedStatus) {
    throw new Error('MAINTENANCE_STATUS_NOT_FOUND');
  }

  return updatedStatus;
}

export async function saveScanAssetEvent(input: SaveScanAssetEventInput): Promise<{
  asset: ScanSafeAsset;
  event: ScanEventRecord;
}> {
  const db = getDb();
  const normalizedCode = normalizePublicAssetCode(input.publicAssetCode);

  if (!normalizedCode) {
    throw new Error('Asset code is required.');
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const assetLookup = await client.query<ScanAccessRow>(
      `
        select
          a.id,
          a.user_id,
          a.public_asset_code,
          a.plate_label,
          a.qr_status,
          a.title,
          a.kind,
          coalesce(ef.family_key, '') as equipment_family_key,
          coalesce(ef.family_label, '') as equipment_family_label,
          a.depreciation_method_used,
          a.life_worked_percent,
          a.estimated_hours,
          a.max_lifetime_hours,
          coalesce(a.specs_json, '{}'::jsonb) as specs_json,
          ef.is_propelled as family_is_propelled,
          ef.usage_metric_type as family_usage_metric_type,
          a.serial_number,
          to_jsonb(a)->>'is_financed' as is_financed,
          to_jsonb(a)->>'is_insured' as is_insured,
          to_jsonb(a)->>'is_licensed' as is_licensed,
          to_jsonb(a)->>'license_registration_number' as license_registration_number,
          a.hours,
          a.fuel_percent,
          a.condition,
          a.note,
          a.photo_urls,
          a.last_scanned_at,
          a.last_known_lat,
          a.last_known_lng,
          a.last_known_location_text,
          a.created_at,
          a.updated_at,
          a.valuation_run_id,
          a.selected_method,
          ''::text as scan_pin_hash,
          false as scan_pin_enabled,
          null::timestamptz as scan_pin_updated_at
        from asset_register_items a
        left join valuation_runs vr
          on vr.id = a.valuation_run_id
        left join equipment_families ef
          on ef.id = coalesce(a.equipment_family_id, vr.equipment_family_id)
        where upper(a.public_asset_code) = $1
        limit 1
      `,
      [normalizedCode],
    );

    const existingRow = assetLookup.rows[0];

    if (!existingRow) {
      throw new Error('Asset not found.');
    }

    const currentAsset = mapScanSafeAsset(existingRow);
    const currentUsageMode = currentAsset.usageMode;
    const currentLifeWorkedPercent = currentAsset.lifeWorkedPercent;
    const nextOperatorName = asText(input.operatorName) || null;
    const nextHours = typeof input.hours === 'number' && Number.isFinite(input.hours) ? Math.max(0, Math.round(input.hours)) : null;
    const nextLifeWorkedPercent = typeof input.lifeWorkedPercent === 'number' && Number.isFinite(input.lifeWorkedPercent)
      ? clampPercent(input.lifeWorkedPercent)
      : null;
    const nextFuelPercent =
      typeof input.fuelPercent === 'number' && Number.isFinite(input.fuelPercent)
        ? Math.max(0, Math.min(100, Math.round(input.fuelPercent)))
        : null;
    const nextCondition = normalizeCondition(input.condition) || null;
    const rawNote = asText(input.note);
    const usageNote = nextLifeWorkedPercent !== null ? `Lifetime worked updated to ${nextLifeWorkedPercent}%.` : '';
    const nextNote = [usageNote, rawNote].filter(Boolean).join('\n\n') || null;
    const nextPhotoUrls = normalizePhotos(input.photoUrls ?? []);
    const nextLatitude =
      typeof input.latitude === 'number' && Number.isFinite(input.latitude) && Math.abs(input.latitude) <= 90
        ? input.latitude
        : null;
    const nextLongitude =
      typeof input.longitude === 'number' && Number.isFinite(input.longitude) && Math.abs(input.longitude) <= 180
        ? input.longitude
        : null;
    const nextLocationText = asText(input.locationText) || null;

    if (nextHours !== null && currentUsageMode === 'percent') {
      throw new Error('USAGE_MODE_PERCENT_CANNOT_ACCEPT_HOURS');
    }

    if (nextLifeWorkedPercent !== null && currentUsageMode !== 'percent') {
      throw new Error('USAGE_MODE_HOURS_CANNOT_ACCEPT_PERCENT');
    }

    if (nextFuelPercent !== null && !currentAsset.canUpdateFuel) {
      throw new Error('ASSET_DOES_NOT_ACCEPT_FUEL');
    }

    if (nextHours !== null && currentAsset.hours !== null && nextHours < currentAsset.hours) {
      throw new Error('USAGE_READING_CANNOT_DECREASE');
    }

    if (
      nextLifeWorkedPercent !== null &&
      currentLifeWorkedPercent !== null &&
      nextLifeWorkedPercent < currentLifeWorkedPercent
    ) {
      throw new Error('LIFE_WORKED_PERCENT_CANNOT_DECREASE');
    }

    const valuationStaleReasons: string[] = [];
    if (hasSavedValuation(existingRow)) {
      if (nextHours !== null && nextHours !== currentAsset.hours) {
        valuationStaleReasons.push('usage changed');
      }

      if (nextLifeWorkedPercent !== null && nextLifeWorkedPercent !== currentLifeWorkedPercent) {
        valuationStaleReasons.push('life worked changed');
      }

      if (nextCondition && currentAsset.condition && nextCondition !== currentAsset.condition) {
        valuationStaleReasons.push('condition changed');
      }
    }

    const baseSpecsJson = nextLifeWorkedPercent !== null
      ? applyLifeWorkedPercent(asRecord(existingRow.specs_json), nextLifeWorkedPercent)
      : asRecord(existingRow.specs_json);
    const nextSpecsJson = markValuationNeedsUpdate(baseSpecsJson, valuationStaleReasons);

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
          now()
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
      ],
    );

    const mergedPhotos = mergePhotos(currentAsset.photos, nextPhotoUrls);
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
            last_scanned_at = now(),
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
          on vr.id = u.valuation_run_id
        left join equipment_families ef
          on ef.id = coalesce(u.equipment_family_id, vr.equipment_family_id)
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
      ],
    );

    await client.query('COMMIT');

    const assetRow = updatedAsset.rows[0];
    const eventRow = insertedEvent.rows[0];

    if (!assetRow || !eventRow) {
      throw new Error('Failed to save scan update.');
    }

    return {
      asset: mapScanSafeAsset(assetRow),
      event: mapScanEventRow(eventRow),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
