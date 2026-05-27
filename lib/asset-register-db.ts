import { getDb } from './db';
import type { CabType, ConditionKey, DriveType, TractorType } from './tractor-data';
import type { MethodKey } from './valuation-runs';
import type { Result } from './tractor-logic';
import type { GenericSelectedMethod, GenericValuationResult } from './generic-valuation';

export type AssetRegisterItemKind = 'tractor' | 'equipment' | 'manual' | 'property' | 'vehicle' | 'tools';
export type AssetRegisterItemMethod = MethodKey | 'manual';
export type AssetRegisterItemCondition = ConditionKey | '';
export type AssetRegisterQrStatus = 'active' | 'transferred' | 'retired' | 'deleted' | '';

export type AssetRegisterDocument = {
  id: string;
  url: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  uploadedAtIso: string;
};

export type AssetRegisterItem = {
  id: string;
  userId: string;
  valuationRunId: number | null;
  sectorId: number | null;
  equipmentFamilyId: number | null;
  equipmentFamilyKey: string;
  equipmentFamilyLabel: string;
  equipmentModelId: number | null;
  typedModelName: string;
  normalizedTypedModelName: string;
  specsJson: Record<string, unknown>;
  depreciationMethodUsed: string;
  lifeWorkedPercent: number | null;
  lifeRemainingPercent: number | null;
  estimatedHours: number | null;
  maxLifetimeHours: number | null;
  kind: AssetRegisterItemKind;
  title: string;
  value: number;
  selectedMethod: AssetRegisterItemMethod;
  selectedValueExVat: number;
  replacementPriceExVat: number | null;
  brandName: string;
  modelName: string;
  drive: DriveType | '';
  tractorType: TractorType | '';
  cab: CabType | '';
  powerKw: number | null;
  yearModel: number | null;
  hours: number | null;
  condition: AssetRegisterItemCondition;
  aim4priceValueExVat: number | null;
  marketMidExVat: number | null;
  note: string;
  serialNumber: string;
  isFinanced: boolean;
  isInsured: boolean;
  isLicensed: boolean;
  licenseRegistrationNumber: string;
  financeNote: string;
  sellerPhone: string;
  marketplaceNotes: string;
  marketplaceStatus: string;
  photos: string[];
  documents: AssetRegisterDocument[];
  publicAssetCode: string;
  plateLabel: string;
  qrStatus: AssetRegisterQrStatus;
  lastScannedAtIso: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastKnownLocationText: string;
  fuelPercent: number | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type CreateManualAssetInput = {
  kind: AssetRegisterItemKind;
  title: string;
  value: number;
  replacementPriceExVat?: number | null;
  note?: string | null;
  serialNumber?: string | null;
  isFinanced?: boolean;
  isInsured?: boolean;
  isLicensed?: boolean;
  licenseRegistrationNumber?: string | null;
  financeNote?: string | null;
  photos?: string[];
  documents?: AssetRegisterDocument[];
  yearModel?: number | null;
  hours?: number | null;
  usageMetric?: 'hours' | 'km' | null;
  lifeWorkedPercent?: number | null;
  specsJson?: Record<string, unknown>;
  condition?: ConditionKey | null;
};

export type UpdateAssetRegisterItemInput = {
  assetId: string;
  kind: AssetRegisterItemKind;
  title: string;
  value: number;
  replacementPriceExVat?: number | null;
  note?: string | null;
  serialNumber?: string | null;
  isFinanced?: boolean;
  isInsured?: boolean;
  isLicensed?: boolean;
  licenseRegistrationNumber?: string | null;
  financeNote?: string | null;
  photos?: string[];
  documents?: AssetRegisterDocument[];
  yearModel?: number | null;
  hours?: number | null;
  usageMetric?: 'hours' | 'km' | null;
  lifeWorkedPercent?: number | null;
  specsJson?: Record<string, unknown>;
  condition?: ConditionKey | null;
};

type AssetRegisterRow = {
  id: string | number;
  user_id: string | null;
  valuation_run_id: string | number | null;
  sector_id: string | number | null;
  equipment_family_id: string | number | null;
  equipment_family_key: string | null;
  equipment_family_label: string | null;
  equipment_model_id: string | number | null;
  typed_model_name: string | null;
  normalized_typed_model_name: string | null;
  specs_json: unknown;
  depreciation_method_used: string | null;
  life_worked_percent: string | number | null;
  life_remaining_percent: string | number | null;
  estimated_hours: string | number | null;
  max_lifetime_hours: string | number | null;
  kind: string | null;
  title: string | null;
  value: string | number | null;
  selected_method: string | null;
  selected_value_ex_vat: string | number | null;
  replacement_price_used_ex_vat: string | number | null;
  user_replacement_price_ex_vat: string | number | null;
  replacement_price_basis: string | null;
  brand_name: string | null;
  model_name: string | null;
  drive_type: string | null;
  tractor_type: string | null;
  cab_type: string | null;
  power_kw: string | number | null;
  year_model: string | number | null;
  hours: string | number | null;
  condition: string | null;
  aim4price_value_ex_vat: string | number | null;
  market_mid_ex_vat: string | number | null;
  note: string | null;
  serial_number: string | null;
  is_financed: boolean | null;
  is_insured: boolean | null;
  is_licensed: boolean | null;
  license_registration_number: string | null;
  finance_note: string | null;
  seller_phone: string | null;
  marketplace_notes: string | null;
  marketplace_status: string | null;
  photos: unknown;
  documents: unknown;
  public_asset_code: string | null;
  plate_label: string | null;
  qr_status: string | null;
  last_scanned_at: string | null;
  last_known_lat: string | number | null;
  last_known_lng: string | number | null;
  last_known_location_text: string | null;
  fuel_percent: string | number | null;
  created_at: string | null;
  updated_at: string | null;
};

type ColumnMetaRow = {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
};

type TableSchema = {
  columnNames: Set<string>;
  columns: Map<string, ColumnMetaRow>;
};

type SqlField = {
  column: string;
  value: unknown;
  cast?: string;
};

let assetRegisterSchemaPromises = new Map<string, Promise<TableSchema>>();

type GenericDbRow = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLicenseRegistrationNumber(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
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

function normalizeAssetNoteText(value: unknown): string {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function isQrOperationalAssetNote(value: unknown): boolean {
  const note = normalizeAssetNoteText(value);
  if (!note) return false;

  const compact = note.replace(/\s+/g, ' ').trim().toLowerCase();

  return (
    compact.includes('lifetime worked updated to') ||
    compact.includes('checked items:') ||
    compact.includes('serviced items:') ||
    compact.includes('service items:') ||
    compact.includes('work done:') ||
    /^checked(?:\b|$)/.test(compact) ||
    /^serviced(?:\b|$)/.test(compact) ||
    /^repaired(?:\b|$)/.test(compact)
  );
}

function cleanAssetRegisterNote(value: unknown): string {
  const note = normalizeAssetNoteText(value);
  return isQrOperationalAssetNote(note) ? '' : note;
}

function normalizeUsageMetric(value: unknown, kind?: AssetRegisterItemKind): 'hours' | 'km' {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'km' || normalized === 'kms' || normalized === 'kilometres' || normalized === 'kilometers') {
    return 'km';
  }

  if (normalized === 'hours' || normalized === 'hour' || normalized === 'hrs') {
    return 'hours';
  }

  return kind === 'vehicle' ? 'km' : 'hours';
}

function buildManualSpecsJson(
  input: CreateManualAssetInput | UpdateAssetRegisterItemInput,
  kind: AssetRegisterItemKind,
  existingSpecsJson: Record<string, unknown> = {},
): Record<string, unknown> {
  const specs = {
    ...existingSpecsJson,
    ...(isRecord(input.specsJson) ? input.specsJson : {}),
  };
  const usageMetric = input.usageMetric
    ? normalizeUsageMetric(input.usageMetric, kind)
    : normalizeUsageMetric(specs.usageMetric ?? specs.usage_metric ?? specs.usageUnit ?? specs.usage_unit, kind);
  const explicitLifeWorkedPercent = input.lifeWorkedPercent === null || typeof input.lifeWorkedPercent === 'undefined'
    ? null
    : Math.max(0, Math.min(100, Number(input.lifeWorkedPercent)));
  const hasIncomingLicenseStatus = Object.prototype.hasOwnProperty.call(input, 'isLicensed');
  const hasIncomingLicenseRegistration = Object.prototype.hasOwnProperty.call(input, 'licenseRegistrationNumber');
  const licenseRegistrationNumber = hasIncomingLicenseStatus && !Boolean(input.isLicensed)
    ? ''
    : hasIncomingLicenseRegistration
      ? normalizeLicenseRegistrationNumber(input.licenseRegistrationNumber)
      : readLicenseRegistrationFromSpecs(specs);
  const lifeWorkedPercent = Number.isFinite(explicitLifeWorkedPercent as number)
    ? explicitLifeWorkedPercent
    : percentFromSpecs(specs);
  const replacementPriceExVat = normalizeReplacementPriceExVat(input.replacementPriceExVat) ?? replacementPriceFromSpecs(specs);

  return {
    ...specs,
    ...(lifeWorkedPercent !== null
      ? {
          life_worked_percent: lifeWorkedPercent,
          worked_percent: lifeWorkedPercent,
          percent_worked: lifeWorkedPercent,
          lifetime_worked_percent: lifeWorkedPercent,
        }
      : {}),
    ...(replacementPriceExVat !== null
      ? {
          replacementPriceExVat,
          replacement_price_ex_vat: replacementPriceExVat,
          replacementPrice: replacementPriceExVat,
          replacement_price: replacementPriceExVat,
          replacementPriceUsedExVat: replacementPriceExVat,
          replacement_price_used_ex_vat: replacementPriceExVat,
          userReplacementPriceExVat: replacementPriceExVat,
          user_replacement_price_ex_vat: replacementPriceExVat,
          officialReplacementPriceExVat: replacementPriceExVat,
          official_replacement_price_ex_vat: replacementPriceExVat,
          replacementPriceBasis: 'user',
          replacement_price_basis: 'user',
        }
      : {}),
    usageMetric,
    usage_metric: usageMetric,
    usage_unit: usageMetric,
    licenseRegistrationNumber,
    license_registration_number: licenseRegistrationNumber,
    licenceRegistrationNumber: licenseRegistrationNumber,
    licence_registration_number: licenseRegistrationNumber,
    licenseRegistration: licenseRegistrationNumber,
    license_registration: licenseRegistrationNumber,
    registrationNumber: licenseRegistrationNumber,
    registration_number: licenseRegistrationNumber,
    numberPlate: licenseRegistrationNumber,
    number_plate: licenseRegistrationNumber,
  };
}

const VALUATION_STALE_SPEC_KEYS = [
  'valuationNeedsUpdate',
  'valuation_needs_update',
  'valuationStaleSince',
  'valuation_stale_since',
  'valuationStaleReason',
  'valuation_stale_reason',
  'valuationStaleReasons',
  'valuation_stale_reasons',
] as const;

const VALUATION_METADATA_SPEC_KEYS = [
  ...VALUATION_STALE_SPEC_KEYS,
  'valuationLastUpdatedAt',
  'valuation_last_updated_at',
  'valuationLastRunId',
  'valuation_last_run_id',
  'valuationLastValueExVat',
  'valuation_last_value_ex_vat',
  'valuationLastHours',
  'valuation_last_hours',
  'valuationLastLifeWorkedPercent',
  'valuation_last_life_worked_percent',
  'valuationLastCondition',
  'valuation_last_condition',
] as const;

function stripValuationMetadata(specs: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...specs };

  VALUATION_METADATA_SPEC_KEYS.forEach((key) => {
    delete cleaned[key];
  });

  return cleaned;
}

function markValuationNeedsUpdate(
  specs: Record<string, unknown>,
  reasons: string[],
  now: Date,
): Record<string, unknown> {
  const uniqueReasons = Array.from(new Set(reasons.map((reason) => reason.trim()).filter(Boolean)));

  if (!uniqueReasons.length) {
    return specs;
  }

  const existingSince = asText(specs.valuation_stale_since) || asText(specs.valuationStaleSince) || now.toISOString();

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

function buildCurrentValuationSpecs(
  existingSpecs: Record<string, unknown>,
  valuationSpecs: Record<string, unknown>,
  context: {
    valuationRunId: number;
    selectedValueExVat: number;
    hours?: number | null;
    lifeWorkedPercent?: number | null;
    condition?: string | null;
    now: Date;
  },
): Record<string, unknown> {
  const merged = stripValuationMetadata({
    ...existingSpecs,
    ...valuationSpecs,
  });

  return {
    ...merged,
    valuationNeedsUpdate: false,
    valuation_needs_update: false,
    valuationLastUpdatedAt: context.now.toISOString(),
    valuation_last_updated_at: context.now.toISOString(),
    valuationLastRunId: context.valuationRunId,
    valuation_last_run_id: context.valuationRunId,
    valuationLastValueExVat: Math.round(Number(context.selectedValueExVat) || 0),
    valuation_last_value_ex_vat: Math.round(Number(context.selectedValueExVat) || 0),
    valuationLastHours: context.hours ?? null,
    valuation_last_hours: context.hours ?? null,
    valuationLastLifeWorkedPercent: context.lifeWorkedPercent ?? null,
    valuation_last_life_worked_percent: context.lifeWorkedPercent ?? null,
    valuationLastCondition: context.condition ?? null,
    valuation_last_condition: context.condition ?? null,
  };
}

function hasValueChanged(left: unknown, right: unknown): boolean {
  if ((left === null || typeof left === 'undefined' || left === '') && (right === null || typeof right === 'undefined' || right === '')) {
    return false;
  }

  const leftNumber = asNumber(left);
  const rightNumber = asNumber(right);

  if (leftNumber !== null || rightNumber !== null) {
    return leftNumber !== rightNumber;
  }

  return String(left ?? '').trim() !== String(right ?? '').trim();
}

function buildValuationStaleReasons(input: {
  existing: AssetRegisterItem;
  nextYearModel: number | null;
  nextHours: number | null;
  nextLifeWorkedPercent: number | null;
  nextCondition: string | null;
}): string[] {
  const reasons: string[] = [];

  if (!input.existing.valuationRunId || input.existing.selectedMethod === 'manual') {
    return reasons;
  }

  if (hasValueChanged(input.existing.yearModel, input.nextYearModel)) {
    reasons.push('year changed');
  }

  if (hasValueChanged(input.existing.hours, input.nextHours)) {
    reasons.push('usage changed');
  }

  const existingLifeWorkedPercent = input.existing.lifeWorkedPercent ?? percentFromSpecs(input.existing.specsJson);
  if (hasValueChanged(existingLifeWorkedPercent, input.nextLifeWorkedPercent)) {
    reasons.push('life worked changed');
  }

  if (hasValueChanged(input.existing.condition, input.nextCondition)) {
    reasons.push('condition changed');
  }

  return reasons;
}

function asIdText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return value.toString();
  return '';
}

function asNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberFromRecord(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (value === null || typeof value === 'undefined' || value === '') {
      continue;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function percentFromSpecs(specs: Record<string, unknown>): number | null {
  const value = numberFromRecord(specs, [
    'life_worked_percent',
    'worked_percent',
    'lifetime_worked_percent',
    'percent_worked',
    'lifetime_used_percent',
  ]);

  if (value === null) {
    return null;
  }

  return Math.min(100, Math.max(0, value));
}

function hoursFromSpecs(specs: Record<string, unknown>): number | null {
  const value = numberFromRecord(specs, ['estimated_hours', 'hours', 'engine_hours', 'usage_amount']);
  return value === null ? null : Math.max(0, Math.round(value));
}

function lifetimeHoursFromSpecs(specs: Record<string, unknown>): number | null {
  const value = numberFromRecord(specs, ['max_lifetime_hours', 'expected_lifetime_hours', 'lifetime_hours', 'design_life_hours']);
  return value === null ? null : Math.max(0, Math.round(value));
}


const REPLACEMENT_PRICE_SPEC_KEYS = [
  'replacementPriceExVat',
  'replacement_price_ex_vat',
  'replacementPriceUsedExVat',
  'replacement_price_used_ex_vat',
  'userReplacementPriceExVat',
  'user_replacement_price_ex_vat',
  'officialReplacementPriceExVat',
  'official_replacement_price_ex_vat',
  'replacementPrice',
  'replacement_price',
] as const;

function normalizeReplacementPriceExVat(value: unknown): number | null {
  const numeric = asNumber(value);
  return numeric !== null && numeric > 0 ? Math.round(numeric) : null;
}

function replacementPriceFromSpecs(specs: Record<string, unknown>): number | null {
  return normalizeReplacementPriceExVat(numberFromRecord(specs, [...REPLACEMENT_PRICE_SPEC_KEYS]));
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

function normalizePhotoArray(value: unknown): string[] {
  const seen = new Set<string>();
  const entries = asStringArray(value).slice(0, 12);

  return entries.filter((entry) => {
    if (!entry) return false;
    if (seen.has(entry)) return false;
    seen.add(entry);
    return true;
  });
}


function normalizeDocumentArray(value: unknown): AssetRegisterDocument[] {
  const rawItems = Array.isArray(value) ? value : typeof value === 'string' && value.trim() ? (() => {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })() : [];

  const seen = new Set<string>();
  const documents: AssetRegisterDocument[] = [];

  rawItems.forEach((entry, index) => {
    let document: AssetRegisterDocument | null = null;

    if (typeof entry === 'string') {
      const url = entry.trim();
      if (url) {
        document = {
          id: url,
          url,
          fileName: `Document ${index + 1}`,
          contentType: 'application/octet-stream',
          byteSize: 0,
          uploadedAtIso: new Date().toISOString(),
        };
      }
    } else if (isRecord(entry)) {
      const url = asText(entry.url);
      const fileName = asText(entry.fileName) || asText(entry.name) || asText(entry.title) || `Document ${index + 1}`;
      if (url) {
        document = {
          id: asText(entry.id) || asText(entry.uploadId) || url,
          url,
          fileName,
          contentType: asText(entry.contentType) || asText(entry.mimeType) || 'application/octet-stream',
          byteSize: Math.max(0, Math.round(asNumber(entry.byteSize) ?? asNumber(entry.sizeBytes) ?? 0)),
          uploadedAtIso: asText(entry.uploadedAtIso) || asText(entry.uploadedAt) || new Date().toISOString(),
        };
      }
    }

    if (!document) return;
    const duplicateKey = document.url || document.id;
    if (seen.has(duplicateKey)) return;
    seen.add(duplicateKey);
    documents.push(document);
  });

  return documents.slice(0, 20);
}

function normalizeKind(value: unknown): AssetRegisterItemKind {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'tractor') return 'tractor';
  if (normalized === 'equipment' || normalized === 'valued equipment') return 'equipment';
  if (normalized === 'property') return 'property';
  if (normalized === 'vehicle') return 'vehicle';
  if (normalized === 'tool' || normalized === 'tools') return 'tools';
  return 'manual';
}

function normalizeMethod(value: unknown): AssetRegisterItemMethod {
  const normalized = String(value ?? '').trim().toLowerCase();

  return normalized === 'aim4price' || normalized === 'market' || normalized === 'manual'
    ? normalized
    : 'manual';
}

function normalizeCondition(value: unknown): AssetRegisterItemCondition {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'excellent') return 'excellent';
  if (normalized === 'fair') return 'fair';
  if (normalized === 'used') return 'used';
  if (normalized === 'serious' || normalized === 'requires attention' || normalized === 'requires serious attention') {
    return 'serious';
  }

  if (normalized === 'good') return 'good';
  return '';
}

function normalizeQrStatus(value: unknown): AssetRegisterQrStatus {
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

function normalizeFuelPercent(value: unknown): number | null {
  const parsed = asNumber(value);

  if (parsed === null) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function mapDrive(value: unknown): DriveType | '' {
  return value === '2wd' || value === '4wd' || value === 'tracks' ? value : '';
}

function mapTractorType(value: unknown): TractorType | '' {
  return value === 'field' || value === 'orchard' ? value : '';
}

function mapCab(value: unknown): CabType | '' {
  if (value === 'cab') return 'cab';
  if (value === 'open-station' || value === 'open station') return 'open-station';
  return '';
}

function normalizeIsoLikeValue(value: unknown): string | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? value.toISOString() : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  return null;
}

function buildIsoDate(value: unknown): string {
  return normalizeIsoLikeValue(value) || new Date().toISOString();
}

function buildNullableIsoDate(value: unknown): string | null {
  return normalizeIsoLikeValue(value);
}

function mapAssetRegisterRow(row: AssetRegisterRow): AssetRegisterItem {
  const selectedValueExVat = Math.round(
    asNumber(row.selected_value_ex_vat) ?? asNumber(row.value) ?? 0,
  );
  const specsJson = isRecord(row.specs_json) ? row.specs_json : {};
  const replacementPriceExVat =
    normalizeReplacementPriceExVat(row.replacement_price_used_ex_vat) ??
    normalizeReplacementPriceExVat(row.user_replacement_price_ex_vat) ??
    replacementPriceFromSpecs(specsJson);
  const lifeWorkedPercent = asNumber(row.life_worked_percent) ?? percentFromSpecs(specsJson);
  const estimatedHours = asNumber(row.estimated_hours) ?? hoursFromSpecs(specsJson);
  const maxLifetimeHours = asNumber(row.max_lifetime_hours) ?? lifetimeHoursFromSpecs(specsJson);

  return {
    id: asIdText(row.id),
    userId: asText(row.user_id),
    valuationRunId: asNumber(row.valuation_run_id),
    sectorId: asNumber(row.sector_id),
    equipmentFamilyId: asNumber(row.equipment_family_id),
    equipmentFamilyKey: asText(row.equipment_family_key),
    equipmentFamilyLabel: asText(row.equipment_family_label),
    equipmentModelId: asNumber(row.equipment_model_id),
    typedModelName: asText(row.typed_model_name),
    normalizedTypedModelName: asText(row.normalized_typed_model_name),
    specsJson,
    depreciationMethodUsed: asText(row.depreciation_method_used),
    lifeWorkedPercent,
    lifeRemainingPercent: asNumber(row.life_remaining_percent),
    estimatedHours,
    maxLifetimeHours,
    kind: normalizeKind(row.kind),
    title: asText(row.title),
    value: Math.round(asNumber(row.value) ?? selectedValueExVat),
    selectedMethod: normalizeMethod(row.selected_method),
    selectedValueExVat,
    replacementPriceExVat,
    brandName: asText(row.brand_name),
    modelName: asText(row.model_name),
    drive: mapDrive(row.drive_type),
    tractorType: mapTractorType(row.tractor_type),
    cab: mapCab(row.cab_type),
    powerKw: asNumber(row.power_kw),
    yearModel: asNumber(row.year_model),
    hours: asNumber(row.hours),
    condition: normalizeCondition(row.condition),
    aim4priceValueExVat: asNumber(row.aim4price_value_ex_vat),
    marketMidExVat: asNumber(row.market_mid_ex_vat),
    note: cleanAssetRegisterNote(row.note),
    serialNumber: asText(row.serial_number),
    isFinanced: Boolean(row.is_financed),
    isInsured: Boolean(row.is_insured),
    isLicensed: Boolean(row.is_licensed),
    licenseRegistrationNumber: normalizeLicenseRegistrationNumber(row.license_registration_number) || readLicenseRegistrationFromSpecs(specsJson),
    financeNote: asText(row.finance_note),
    sellerPhone: asText(row.seller_phone),
    marketplaceNotes: asText(row.marketplace_notes),
    marketplaceStatus: asText(row.marketplace_status) || 'draft',
    photos: normalizePhotoArray(row.photos),
    documents: normalizeDocumentArray(row.documents),
    publicAssetCode: asText(row.public_asset_code),
    plateLabel: asText(row.plate_label),
    qrStatus: normalizeQrStatus(row.qr_status),
    lastScannedAtIso: buildNullableIsoDate(row.last_scanned_at),
    lastKnownLat: asNumber(row.last_known_lat),
    lastKnownLng: asNumber(row.last_known_lng),
    lastKnownLocationText: asText(row.last_known_location_text),
    fuelPercent: normalizeFuelPercent(row.fuel_percent),
    createdAtIso: buildIsoDate(row.created_at),
    updatedAtIso: buildIsoDate(row.updated_at ?? row.created_at),
  };
}

async function getTableSchema(tableName: string): Promise<TableSchema> {
  let schemaPromise = assetRegisterSchemaPromises.get(tableName);

  if (!schemaPromise) {
    const db = getDb();

    schemaPromise = db
      .query<ColumnMetaRow>(
        `
          select
            column_name,
            data_type,
            udt_name,
            is_nullable,
            column_default
          from information_schema.columns
          where table_name = $1
            and table_schema = any(current_schemas(false))
        `,
        [tableName],
      )
      .then((result) => ({
        columnNames: new Set(result.rows.map((row) => row.column_name)),
        columns: new Map(result.rows.map((row) => [row.column_name, row])),
      }));

    assetRegisterSchemaPromises.set(tableName, schemaPromise);
  }

  const schema = await schemaPromise;

  if (!schema.columnNames.size) {
    throw new Error(`${tableName.toUpperCase()}_TABLE_NOT_FOUND`);
  }

  return schema;
}

async function getAssetRegisterSchema(): Promise<TableSchema> {
  return getTableSchema('asset_register_items');
}

async function getValuationRunsSchema(): Promise<TableSchema> {
  return getTableSchema('valuation_runs');
}

function resolveColumn(schema: TableSchema, ...candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (schema.columnNames.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getColumnMeta(schema: TableSchema, ...candidates: string[]): ColumnMetaRow | null {
  const column = resolveColumn(schema, ...candidates);
  return column ? schema.columns.get(column) ?? null : null;
}

function isArrayColumn(meta: ColumnMetaRow | null): boolean {
  return Boolean(meta && (meta.data_type === 'ARRAY' || meta.udt_name.startsWith('_')));
}

function isJsonColumn(meta: ColumnMetaRow | null): boolean {
  return Boolean(meta && (meta.data_type === 'json' || meta.data_type === 'jsonb'));
}

function buildSelectList(schema: TableSchema): string {
  const userIdColumn = resolveColumn(schema, 'user_id');
  const valuationRunIdColumn = resolveColumn(schema, 'valuation_run_id', 'run_id');
  const sectorIdColumn = resolveColumn(schema, 'sector_id');
  const equipmentFamilyIdColumn = resolveColumn(schema, 'equipment_family_id');
  const equipmentModelIdColumn = resolveColumn(schema, 'equipment_model_id');
  const typedModelNameColumn = resolveColumn(schema, 'typed_model_name');
  const normalizedTypedModelNameColumn = resolveColumn(schema, 'normalized_typed_model_name');
  const specsJsonColumn = resolveColumn(schema, 'specs_json');
  const depreciationMethodColumn = resolveColumn(schema, 'depreciation_method_used');
  const lifeWorkedPercentColumn = resolveColumn(schema, 'life_worked_percent');
  const lifeRemainingPercentColumn = resolveColumn(schema, 'life_remaining_percent');
  const estimatedHoursColumn = resolveColumn(schema, 'estimated_hours');
  const maxLifetimeHoursColumn = resolveColumn(schema, 'max_lifetime_hours');
  const kindColumn = resolveColumn(schema, 'kind', 'equipment_type', 'asset_type', 'item_type');
  const titleColumn = resolveColumn(schema, 'title', 'name', 'asset_name');
  const valueColumn = resolveColumn(
    schema,
    'value',
    'selected_value_ex_vat',
    'selected_value',
    'saved_value_ex_vat',
  );
  const selectedMethodColumn = resolveColumn(schema, 'selected_method', 'method', 'valuation_method');
  const selectedValueColumn = resolveColumn(
    schema,
    'selected_value_ex_vat',
    'selected_value',
    'value',
    'saved_value_ex_vat',
  );
  const replacementPriceUsedColumn = resolveColumn(schema, 'replacement_price_used_ex_vat', 'replacement_price_ex_vat', 'official_replacement_price_ex_vat');
  const userReplacementPriceColumn = resolveColumn(schema, 'user_replacement_price_ex_vat');
  const replacementPriceBasisColumn = resolveColumn(schema, 'replacement_price_basis');
  const brandColumn = resolveColumn(schema, 'brand_name', 'brand');
  const modelColumn = resolveColumn(schema, 'model_name', 'model');
  const driveColumn = resolveColumn(schema, 'drive_type', 'drive', 'drivetrain');
  const tractorTypeColumn = resolveColumn(schema, 'tractor_type', 'tractor_category');
  const cabColumn = resolveColumn(schema, 'cab_type', 'cab');
  const powerColumn = resolveColumn(schema, 'power_kw', 'kw', 'power');
  const yearColumn = resolveColumn(schema, 'year_model', 'year');
  const hoursColumn = resolveColumn(schema, 'hours', 'engine_hours');
  const conditionColumn = resolveColumn(schema, 'condition');
  const aim4priceColumn = resolveColumn(schema, 'aim4price_value_ex_vat', 'aim4price_value');
  const marketColumn = resolveColumn(schema, 'market_mid_ex_vat', 'market_value_ex_vat', 'market_value');
  const noteColumn = resolveColumn(schema, 'note', 'notes', 'description');
  const serialColumn = resolveColumn(schema, 'serial_number', 'serial', 'vin');
  const financedColumn = resolveColumn(schema, 'is_financed', 'financed');
  const insuredColumn = resolveColumn(schema, 'is_insured', 'insured');
  const licensedColumn = resolveColumn(schema, 'is_licensed', 'licensed', 'licenced');
  const licenseRegistrationNumberColumn = resolveColumn(
    schema,
    'license_registration_number',
    'licence_registration_number',
    'registration_number',
    'number_plate',
    'numberplate',
  );
  const financeNoteColumn = resolveColumn(schema, 'finance_note', 'finance_notes', 'finance_status');
  const sellerPhoneColumn = resolveColumn(schema, 'seller_phone', 'phone', 'contact_phone');
  const marketplaceNotesColumn = resolveColumn(schema, 'marketplace_notes', 'listing_notes');
  const marketplaceStatusColumn = resolveColumn(schema, 'marketplace_status', 'listing_status', 'status');
  const photosColumn = resolveColumn(schema, 'photos', 'photo_urls', 'image_urls', 'images');
  const documentsColumn = resolveColumn(schema, 'documents', 'document_urls', 'document_files', 'attachments', 'files');
  const publicAssetCodeColumn = resolveColumn(schema, 'public_asset_code');
  const plateLabelColumn = resolveColumn(schema, 'plate_label');
  const qrStatusColumn = resolveColumn(schema, 'qr_status');
  const lastScannedAtColumn = resolveColumn(schema, 'last_scanned_at');
  const lastKnownLatColumn = resolveColumn(schema, 'last_known_lat');
  const lastKnownLngColumn = resolveColumn(schema, 'last_known_lng');
  const lastKnownLocationTextColumn = resolveColumn(schema, 'last_known_location_text');
  const fuelPercentColumn = resolveColumn(schema, 'fuel_percent');
  const createdAtColumn = resolveColumn(schema, 'created_at', 'createdon', 'created');
  const updatedAtColumn = resolveColumn(schema, 'updated_at', 'modified_at', 'updatedon', 'created_at');
  const valuationRunIdExpression = valuationRunIdColumn ?? 'null::bigint';
  const equipmentFamilyIdExpression = equipmentFamilyIdColumn
    ? `coalesce(${equipmentFamilyIdColumn}, (select vr.equipment_family_id from valuation_runs vr where vr.id = ${valuationRunIdExpression} limit 1))`
    : `(select vr.equipment_family_id from valuation_runs vr where vr.id = ${valuationRunIdExpression} limit 1)`;
  const typedModelNameExpression = typedModelNameColumn
    ? `coalesce(${typedModelNameColumn}, (select vr.typed_model_name from valuation_runs vr where vr.id = ${valuationRunIdExpression} limit 1))`
    : `(select vr.typed_model_name from valuation_runs vr where vr.id = ${valuationRunIdExpression} limit 1)`;
  const normalizedTypedModelNameExpression = normalizedTypedModelNameColumn
    ? `coalesce(${normalizedTypedModelNameColumn}, (select vr.normalized_typed_model_name from valuation_runs vr where vr.id = ${valuationRunIdExpression} limit 1))`
    : `(select vr.normalized_typed_model_name from valuation_runs vr where vr.id = ${valuationRunIdExpression} limit 1)`;
  const specsJsonExpression = specsJsonColumn
    ? `coalesce(${specsJsonColumn}, (select vr.specs_json from valuation_runs vr where vr.id = ${valuationRunIdExpression} limit 1), '{}'::jsonb)`
    : `coalesce((select vr.specs_json from valuation_runs vr where vr.id = ${valuationRunIdExpression} limit 1), '{}'::jsonb)`;
  const valuationBrandExpression = `(select nullif(trim(vr.brand_name), '') from valuation_runs vr where vr.id = ${valuationRunIdExpression} limit 1)`;
  const valuationModelExpression = `(select nullif(trim(coalesce(vr.model_name, vr.typed_model_name, '')), '') from valuation_runs vr where vr.id = ${valuationRunIdExpression} limit 1)`;
  const brandExpression = brandColumn
    ? `coalesce(nullif(trim(${brandColumn}), ''), ${valuationBrandExpression})`
    : valuationBrandExpression;
  const modelExpression = modelColumn
    ? `coalesce(nullif(trim(${modelColumn}), ''), ${valuationModelExpression})`
    : valuationModelExpression;

  const selectParts = [
    'id',
    userIdColumn ? `${userIdColumn} as user_id` : `''::text as user_id`,
    valuationRunIdColumn ? `${valuationRunIdColumn} as valuation_run_id` : 'null::bigint as valuation_run_id',
    sectorIdColumn ? `${sectorIdColumn} as sector_id` : 'null::bigint as sector_id',
    `${equipmentFamilyIdExpression} as equipment_family_id`,
    `(select ef.family_key from public.equipment_families ef where ef.id = ${equipmentFamilyIdExpression} limit 1) as equipment_family_key`,
    `(select ef.family_label from public.equipment_families ef where ef.id = ${equipmentFamilyIdExpression} limit 1) as equipment_family_label`,
    equipmentModelIdColumn ? `${equipmentModelIdColumn} as equipment_model_id` : 'null::bigint as equipment_model_id',
    `${typedModelNameExpression} as typed_model_name`,
    `${normalizedTypedModelNameExpression} as normalized_typed_model_name`,
    `${specsJsonExpression} as specs_json`,
    depreciationMethodColumn ? `${depreciationMethodColumn} as depreciation_method_used` : `null::text as depreciation_method_used`,
    lifeWorkedPercentColumn ? `${lifeWorkedPercentColumn} as life_worked_percent` : `null::numeric as life_worked_percent`,
    lifeRemainingPercentColumn ? `${lifeRemainingPercentColumn} as life_remaining_percent` : `null::numeric as life_remaining_percent`,
    estimatedHoursColumn ? `${estimatedHoursColumn} as estimated_hours` : `null::numeric as estimated_hours`,
    maxLifetimeHoursColumn ? `${maxLifetimeHoursColumn} as max_lifetime_hours` : `null::numeric as max_lifetime_hours`,
    kindColumn ? `${kindColumn} as kind` : `'manual'::text as kind`,
    titleColumn ? `${titleColumn} as title` : `''::text as title`,
    valueColumn ? `${valueColumn} as value` : '0::numeric as value',
    selectedMethodColumn ? `${selectedMethodColumn} as selected_method` : `'manual'::text as selected_method`,
    selectedValueColumn ? `${selectedValueColumn} as selected_value_ex_vat` : '0::numeric as selected_value_ex_vat',
    replacementPriceUsedColumn ? `${replacementPriceUsedColumn} as replacement_price_used_ex_vat` : 'null::numeric as replacement_price_used_ex_vat',
    userReplacementPriceColumn ? `${userReplacementPriceColumn} as user_replacement_price_ex_vat` : 'null::numeric as user_replacement_price_ex_vat',
    replacementPriceBasisColumn ? `${replacementPriceBasisColumn} as replacement_price_basis` : 'null::text as replacement_price_basis',
    `${brandExpression} as brand_name`,
    `${modelExpression} as model_name`,
    driveColumn ? `${driveColumn} as drive_type` : 'null::text as drive_type',
    tractorTypeColumn ? `${tractorTypeColumn} as tractor_type` : 'null::text as tractor_type',
    cabColumn ? `${cabColumn} as cab_type` : 'null::text as cab_type',
    powerColumn ? `${powerColumn} as power_kw` : 'null::numeric as power_kw',
    yearColumn ? `${yearColumn} as year_model` : 'null::integer as year_model',
    hoursColumn ? `${hoursColumn} as hours` : 'null::integer as hours',
    conditionColumn ? `${conditionColumn} as condition` : 'null::text as condition',
    aim4priceColumn ? `${aim4priceColumn} as aim4price_value_ex_vat` : 'null::numeric as aim4price_value_ex_vat',
    marketColumn ? `${marketColumn} as market_mid_ex_vat` : 'null::numeric as market_mid_ex_vat',
    noteColumn ? `${noteColumn} as note` : 'null::text as note',
    serialColumn ? `${serialColumn} as serial_number` : 'null::text as serial_number',
    financedColumn ? `${financedColumn} as is_financed` : 'false as is_financed',
    insuredColumn ? `${insuredColumn} as is_insured` : 'false as is_insured',
    licensedColumn ? `${licensedColumn} as is_licensed` : 'false as is_licensed',
    licenseRegistrationNumberColumn ? `${licenseRegistrationNumberColumn} as license_registration_number` : 'null::text as license_registration_number',
    financeNoteColumn ? `${financeNoteColumn} as finance_note` : 'null::text as finance_note',
    sellerPhoneColumn ? `${sellerPhoneColumn} as seller_phone` : 'null::text as seller_phone',
    marketplaceNotesColumn ? `${marketplaceNotesColumn} as marketplace_notes` : 'null::text as marketplace_notes',
    marketplaceStatusColumn ? `${marketplaceStatusColumn} as marketplace_status` : `'draft'::text as marketplace_status`,
    photosColumn ? `${photosColumn} as photos` : `'[]'::jsonb as photos`,
    documentsColumn ? `${documentsColumn} as documents` : `'[]'::jsonb as documents`,
    publicAssetCodeColumn ? `${publicAssetCodeColumn} as public_asset_code` : `''::text as public_asset_code`,
    plateLabelColumn ? `${plateLabelColumn} as plate_label` : `''::text as plate_label`,
    qrStatusColumn ? `${qrStatusColumn} as qr_status` : `'active'::text as qr_status`,
    lastScannedAtColumn ? `${lastScannedAtColumn} as last_scanned_at` : 'null::timestamptz as last_scanned_at',
    lastKnownLatColumn ? `${lastKnownLatColumn} as last_known_lat` : 'null::numeric as last_known_lat',
    lastKnownLngColumn ? `${lastKnownLngColumn} as last_known_lng` : 'null::numeric as last_known_lng',
    lastKnownLocationTextColumn ? `${lastKnownLocationTextColumn} as last_known_location_text` : 'null::text as last_known_location_text',
    fuelPercentColumn ? `${fuelPercentColumn} as fuel_percent` : 'null::integer as fuel_percent',
    createdAtColumn ? `${createdAtColumn} as created_at` : 'now() as created_at',
    updatedAtColumn ? `${updatedAtColumn} as updated_at` : 'now() as updated_at',
  ];

  return selectParts.join(',\n        ');
}

function setField(fields: SqlField[], nextField: SqlField): void {
  const existingIndex = fields.findIndex((field) => field.column === nextField.column);

  if (existingIndex >= 0) {
    fields[existingIndex] = nextField;
    return;
  }

  fields.push(nextField);
}

function resolveArrayCast(meta: ColumnMetaRow): string {
  const map: Record<string, string> = {
    _text: '::text[]',
    _varchar: '::text[]',
    _bpchar: '::text[]',
    _int2: '::smallint[]',
    _int4: '::integer[]',
    _int8: '::bigint[]',
    _numeric: '::numeric[]',
    _float4: '::real[]',
    _float8: '::double precision[]',
    _bool: '::boolean[]',
  };

  return map[meta.udt_name] ?? '::text[]';
}

function buildFieldFromMeta(meta: ColumnMetaRow, value: unknown): SqlField {
  if (isArrayColumn(meta)) {
    return {
      column: meta.column_name,
      value: Array.isArray(value) ? value : [],
      cast: resolveArrayCast(meta),
    };
  }

  if (isJsonColumn(meta)) {
    return {
      column: meta.column_name,
      value: typeof value === 'string' ? value : JSON.stringify(value ?? null),
      cast: meta.data_type === 'jsonb' ? '::jsonb' : '::json',
    };
  }

  return { column: meta.column_name, value };
}

function pushField(
  fields: SqlField[],
  schema: TableSchema,
  candidates: string[],
  value: unknown,
  cast?: string,
): void {
  const column = resolveColumn(schema, ...candidates);

  if (!column) {
    return;
  }

  setField(fields, { column, value, cast });
}

function pushExactField(fields: SqlField[], schema: TableSchema, column: string, value: unknown): void {
  const meta = schema.columns.get(column);

  if (!meta) {
    return;
  }

  setField(fields, buildFieldFromMeta(meta, value));
}

function pushPhotoField(fields: SqlField[], schema: TableSchema, photos: string[]): void {
  const meta = getColumnMeta(schema, 'photos', 'photo_urls', 'image_urls', 'images');
  if (!meta) {
    return;
  }

  const normalized = normalizePhotoArray(photos);
  setField(fields, buildFieldFromMeta(meta, normalized));
}


function pushDocumentField(fields: SqlField[], schema: TableSchema, documents: AssetRegisterDocument[]): void {
  const meta = getColumnMeta(schema, 'documents', 'document_urls', 'document_files', 'attachments', 'files');
  if (!meta) {
    return;
  }

  const normalized = normalizeDocumentArray(documents);
  setField(fields, buildFieldFromMeta(meta, normalized));
}

type RequiredFieldContext = {
  userId: string;
  valuationRunId?: number | null;
  title: string;
  kind: AssetRegisterItemKind;
  selectedMethod: AssetRegisterItemMethod;
  selectedValueExVat: number;
  note?: string | null;
  brandName?: string | null;
  modelName?: string | null;
  drive?: string | null;
  tractorType?: string | null;
  cab?: string | null;
  powerKw?: number | null;
  year?: number | null;
  hours?: number | null;
  condition?: string | null;
  now: Date;
};

function buildRequiredFallbackField(meta: ColumnMetaRow, context: RequiredFieldContext): SqlField | null {
  const column = meta.column_name;

  if (meta.is_nullable === 'YES' || meta.column_default) {
    return null;
  }

  if (column === 'id') {
    return null;
  }

  if (column === 'user_id') {
    return buildFieldFromMeta(meta, context.userId);
  }

  if (column === 'valuation_run_id' || column === 'run_id') {
    return context.valuationRunId === null || context.valuationRunId === undefined
      ? null
      : buildFieldFromMeta(meta, context.valuationRunId);
  }

  if (column === 'kind' || column === 'equipment_type' || column === 'asset_type' || column === 'item_type') {
    return buildFieldFromMeta(meta, context.kind === 'tractor' ? 'tractor' : context.kind);
  }

  if (column === 'title' || column === 'name' || column === 'asset_name') {
    return buildFieldFromMeta(meta, context.title);
  }

  if (column === 'selected_method' || column === 'method' || column === 'valuation_method') {
    return buildFieldFromMeta(meta, context.selectedMethod);
  }

  if (
    column === 'value' ||
    column === 'selected_value_ex_vat' ||
    column === 'selected_value' ||
    column === 'saved_value_ex_vat'
  ) {
    return buildFieldFromMeta(meta, context.selectedValueExVat);
  }

  if (column === 'note' || column === 'notes' || column === 'description') {
    return buildFieldFromMeta(meta, cleanAssetRegisterNote(context.note) || '');
  }

  if (column === 'brand_name' || column === 'brand') {
    return buildFieldFromMeta(meta, asText(context.brandName) || '');
  }

  if (column === 'model_name' || column === 'model') {
    return buildFieldFromMeta(meta, asText(context.modelName) || '');
  }

  if (column === 'drive_type' || column === 'drive' || column === 'drivetrain') {
    return buildFieldFromMeta(meta, asText(context.drive) || '');
  }

  if (column === 'tractor_type' || column === 'tractor_category') {
    return buildFieldFromMeta(meta, asText(context.tractorType) || '');
  }

  if (column === 'cab_type' || column === 'cab') {
    return buildFieldFromMeta(meta, asText(context.cab) || '');
  }

  if (column === 'power_kw' || column === 'kw' || column === 'power') {
    return buildFieldFromMeta(meta, context.powerKw ?? 0);
  }

  if (column === 'year_model' || column === 'year') {
    return buildFieldFromMeta(meta, context.year ?? new Date().getFullYear());
  }

  if (column === 'hours' || column === 'engine_hours') {
    return buildFieldFromMeta(meta, context.hours ?? 0);
  }

  if (column === 'condition') {
    return buildFieldFromMeta(meta, asText(context.condition) || 'good');
  }

  if (column === 'seller_phone' || column === 'phone' || column === 'contact_phone') {
    return buildFieldFromMeta(meta, '');
  }

  if (column === 'marketplace_notes' || column === 'listing_notes') {
    return buildFieldFromMeta(meta, '');
  }

  if (column === 'marketplace_status' || column === 'listing_status' || column === 'status') {
    return buildFieldFromMeta(meta, 'draft');
  }

  if (column === 'created_at' || column === 'createdon' || column === 'created') {
    return buildFieldFromMeta(meta, context.now);
  }

  if (column === 'updated_at' || column === 'modified_at' || column === 'updatedon') {
    return buildFieldFromMeta(meta, context.now);
  }

  if (column === 'photos' || column === 'photo_urls' || column === 'image_urls' || column === 'images') {
    return buildFieldFromMeta(meta, []);
  }

  if (column === 'documents' || column === 'document_urls' || column === 'document_files' || column === 'attachments' || column === 'files') {
    return buildFieldFromMeta(meta, []);
  }

  if (isArrayColumn(meta)) {
    return buildFieldFromMeta(meta, []);
  }

  if (isJsonColumn(meta)) {
    const emptyValue = column.includes('photo') || column.includes('image') || column.includes('listing') || column.includes('document') || column.includes('attachment') || column === 'files' ? [] : {};
    return buildFieldFromMeta(meta, emptyValue);
  }

  if (
    meta.data_type === 'smallint' ||
    meta.data_type === 'integer' ||
    meta.data_type === 'bigint' ||
    meta.data_type === 'numeric' ||
    meta.data_type === 'real' ||
    meta.data_type === 'double precision' ||
    meta.data_type === 'decimal'
  ) {
    return buildFieldFromMeta(meta, 0);
  }

  if (meta.data_type === 'boolean') {
    return buildFieldFromMeta(meta, false);
  }

  if (
    meta.data_type === 'date' ||
    meta.data_type.includes('timestamp') ||
    meta.udt_name.includes('timestamp')
  ) {
    return buildFieldFromMeta(meta, context.now);
  }

  return buildFieldFromMeta(meta, '');
}

function ensureRequiredFields(fields: SqlField[], schema: TableSchema, context: RequiredFieldContext): void {
  for (const meta of schema.columns.values()) {
    if (fields.some((field) => field.column === meta.column_name)) {
      continue;
    }

    const fallback = buildRequiredFallbackField(meta, context);
    if (fallback) {
      setField(fields, fallback);
    }
  }
}

async function fetchValuationRunRowById(userId: string, runId: number): Promise<GenericDbRow | null> {
  const db = getDb();
  const result = await db.query<GenericDbRow>(
    `
      select *
      from valuation_runs
      where id = $1 and user_id = $2
      limit 1
    `,
    [runId, userId],
  );

  return result.rows[0] ?? null;
}

function copySharedFieldsFromValuationRun(
  fields: SqlField[],
  assetSchema: TableSchema,
  valuationSchema: TableSchema,
  valuationRow: GenericDbRow,
): void {
  const excludedColumns = new Set([
    'id',
    'created_at',
    'updated_at',
    'createdon',
    'updatedon',
    'modified_at',
    'photos',
    'photo_urls',
    'image_urls',
    'images',
    'documents',
    'document_urls',
    'document_files',
    'attachments',
    'files',
  ]);

  for (const [columnName, meta] of assetSchema.columns.entries()) {
    if (excludedColumns.has(columnName)) {
      continue;
    }

    if (!valuationSchema.columnNames.has(columnName)) {
      continue;
    }

    if (!(columnName in valuationRow)) {
      continue;
    }

    const value = valuationRow[columnName];
    if (typeof value === 'undefined') {
      continue;
    }

    setField(fields, buildFieldFromMeta(meta, value));
  }
}

function buildInsertQuery(schema: TableSchema, fields: SqlField[]): { sql: string; values: unknown[] } {
  if (!fields.length) {
    throw new Error('ASSET_CREATE_FAILED');
  }

  const values: unknown[] = [];
  const placeholders = fields.map((field, index) => {
    values.push(field.value);
    return `$${index + 1}${field.cast ?? ''}`;
  });

  return {
    sql: `
      insert into asset_register_items (
        ${fields.map((field) => field.column).join(',\n        ')}
      )
      values (
        ${placeholders.join(', ')}
      )
      returning
        ${buildSelectList(schema)}
    `,
    values,
  };
}

function buildUpdateSetClause(fields: SqlField[]): { clause: string; values: unknown[] } {
  const values: unknown[] = [];
  const clauses = fields.map((field, index) => {
    values.push(field.value);
    return `${field.column} = $${index + 3}${field.cast ?? ''}`;
  });

  return {
    clause: clauses.join(',\n        '),
    values,
  };
}

export async function getAssetRegisterItemById(userId: string, assetId: string): Promise<AssetRegisterItem | null> {
  const db = getDb();
  const schema = await getAssetRegisterSchema();
  const result = await db.query<AssetRegisterRow>(
    `
      select
        ${buildSelectList(schema)}
      from asset_register_items
      where user_id = $1 and id = $2
      limit 1
    `,
    [userId, assetId],
  );

  const row = result.rows[0];
  return row ? mapAssetRegisterRow(row) : null;
}

export async function listAssetRegisterItems(userId: string): Promise<AssetRegisterItem[]> {
  const db = getDb();
  const schema = await getAssetRegisterSchema();

  const updatedOrderColumn = resolveColumn(schema, 'updated_at', 'modified_at', 'updatedon');
  const createdOrderColumn = resolveColumn(schema, 'created_at');
  const primaryOrderExpression = updatedOrderColumn && createdOrderColumn
    ? `coalesce(${updatedOrderColumn}, ${createdOrderColumn})`
    : updatedOrderColumn ?? createdOrderColumn ?? 'id';
  const secondaryOrderClause = createdOrderColumn ? `, ${createdOrderColumn} desc nulls last` : '';

  const result = await db.query<AssetRegisterRow>(
    `
      select
        ${buildSelectList(schema)}
      from asset_register_items
      where user_id = $1
      order by ${primaryOrderExpression} desc nulls last${secondaryOrderClause}, id desc
    `,
    [userId],
  );

  return result.rows.map(mapAssetRegisterRow);
}

export async function createManualAssetRegisterItem(
  userId: string,
  input: CreateManualAssetInput,
): Promise<AssetRegisterItem> {
  const db = getDb();
  const schema = await getAssetRegisterSchema();
  const now = new Date();
  const nextValue = Math.round(Number(input.value) || 0);
  const nextReplacementPriceExVat = normalizeReplacementPriceExVat(input.replacementPriceExVat);

  if (nextReplacementPriceExVat === null) {
    throw new Error('REPLACEMENT_PRICE_REQUIRED');
  }

  const nextKind = normalizeKind(input.kind);
  const nextSpecsJson = buildManualSpecsJson(input, nextKind);
  const nextLicenseRegistrationNumber = Boolean(input.isLicensed) ? normalizeLicenseRegistrationNumber(input.licenseRegistrationNumber) : null;
  const nextLifeWorkedPercent = percentFromSpecs(nextSpecsJson);
  const fields: SqlField[] = [];

  pushField(fields, schema, ['user_id'], userId);
  pushField(fields, schema, ['valuation_run_id', 'run_id'], null);
  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], nextKind);
  pushField(fields, schema, ['title', 'name', 'asset_name'], asText(input.title));
  pushField(fields, schema, ['value', 'selected_value_ex_vat', 'selected_value', 'saved_value_ex_vat'], nextValue);
  pushField(fields, schema, ['selected_method', 'method', 'valuation_method'], 'manual');
  pushField(fields, schema, ['selected_value_ex_vat', 'selected_value', 'value', 'saved_value_ex_vat'], nextValue);
  pushField(fields, schema, ['replacement_price_used_ex_vat', 'replacement_price_ex_vat', 'official_replacement_price_ex_vat'], nextReplacementPriceExVat);
  pushField(fields, schema, ['user_replacement_price_ex_vat'], nextReplacementPriceExVat);
  pushField(fields, schema, ['replacement_price_basis'], nextReplacementPriceExVat !== null ? 'user' : null);
  pushField(fields, schema, ['source_type', 'source', 'origin', 'entry_source'], 'manual');
  pushField(fields, schema, ['note', 'notes', 'description'], cleanAssetRegisterNote(input.note) || null);
  pushField(fields, schema, ['serial_number', 'serial', 'vin'], asText(input.serialNumber) || null);
  pushField(fields, schema, ['is_financed', 'financed'], Boolean(input.isFinanced));
  pushField(fields, schema, ['is_insured', 'insured'], Boolean(input.isInsured));
  pushField(fields, schema, ['is_licensed', 'licensed', 'licenced'], Boolean(input.isLicensed));
  pushField(fields, schema, ['license_registration_number', 'licence_registration_number', 'registration_number', 'number_plate', 'numberplate'], nextLicenseRegistrationNumber);
  pushField(fields, schema, ['finance_note', 'finance_notes', 'finance_status'], asText(input.financeNote) || null);
  pushField(fields, schema, ['year_model', 'year'], input.yearModel === null || input.yearModel === undefined ? null : Math.max(0, Math.round(input.yearModel)));
  pushField(fields, schema, ['specs_json'], nextSpecsJson, '::jsonb');
  pushField(fields, schema, ['life_worked_percent'], nextLifeWorkedPercent);
  pushField(fields, schema, ['life_remaining_percent'], nextLifeWorkedPercent === null ? null : Math.max(0, 100 - nextLifeWorkedPercent));
  pushField(fields, schema, ['hours', 'engine_hours'], input.hours === null || input.hours === undefined ? null : Math.max(0, Math.round(input.hours)));
  pushField(fields, schema, ['condition'], input.condition ?? null);
  pushPhotoField(fields, schema, input.photos ?? []);
  pushDocumentField(fields, schema, input.documents ?? []);
  pushField(fields, schema, ['created_at', 'createdon', 'created'], now);
  pushField(fields, schema, ['updated_at', 'modified_at', 'updatedon'], now);
  ensureRequiredFields(fields, schema, {
    userId,
    valuationRunId: null,
    title: asText(input.title),
    kind: nextKind,
    selectedMethod: 'manual',
    selectedValueExVat: nextValue,
    note: cleanAssetRegisterNote(input.note) || null,
    year: input.yearModel ?? null,
    hours: input.hours ?? null,
    condition: input.condition ?? null,
    now,
  });

  const query = buildInsertQuery(schema, fields);
  const result = await db.query<AssetRegisterRow>(query.sql, query.values);
  const row = result.rows[0];

  if (!row) {
    throw new Error('ASSET_CREATE_FAILED');
  }

  return mapAssetRegisterRow(row);
}

export async function updateAssetRegisterItem(
  userId: string,
  input: UpdateAssetRegisterItemInput,
): Promise<AssetRegisterItem> {
  const db = getDb();
  const schema = await getAssetRegisterSchema();
  const existing = await getAssetRegisterItemById(userId, input.assetId);

  if (!existing) {
    throw new Error('ASSET_NOT_FOUND');
  }

  const now = new Date();
  const nextKind = existing.valuationRunId ? existing.kind : normalizeKind(input.kind);
  const nextValue = Math.round(Number(input.value) || 0);
  const nextReplacementPriceExVat = normalizeReplacementPriceExVat(input.replacementPriceExVat);

  if (nextReplacementPriceExVat === null) {
    throw new Error('REPLACEMENT_PRICE_REQUIRED');
  }

  const incomingYearModel = input.yearModel === null || input.yearModel === undefined ? null : Math.max(0, Math.round(input.yearModel));
  const incomingHours = input.hours === null || input.hours === undefined ? null : Math.max(0, Math.round(input.hours));
  const nextYearModel = existing.valuationRunId && incomingYearModel === null ? existing.yearModel : incomingYearModel;
  const nextHours = existing.valuationRunId && incomingHours === null ? existing.hours : incomingHours;
  const nextCondition = input.condition ?? existing.condition ?? null;
  const baseSpecsJson = buildManualSpecsJson(input, nextKind, existing.specsJson);
  const nextLicenseRegistrationNumber = Boolean(input.isLicensed) ? normalizeLicenseRegistrationNumber(input.licenseRegistrationNumber) : null;
  const nextLifeWorkedPercent = percentFromSpecs(baseSpecsJson);
  const existingLifeWorkedPercent = existing.lifeWorkedPercent ?? percentFromSpecs(existing.specsJson);
  const fields: SqlField[] = [];

  if (incomingHours !== null && existing.hours !== null && incomingHours < existing.hours) {
    throw new Error('USAGE_READING_CANNOT_DECREASE');
  }

  if (
    nextLifeWorkedPercent !== null &&
    existingLifeWorkedPercent !== null &&
    nextLifeWorkedPercent < existingLifeWorkedPercent
  ) {
    throw new Error('LIFE_WORKED_PERCENT_CANNOT_DECREASE');
  }

  const staleReasons = buildValuationStaleReasons({
    existing,
    nextYearModel,
    nextHours,
    nextLifeWorkedPercent,
    nextCondition,
  });
  const nextSpecsJson = markValuationNeedsUpdate(baseSpecsJson, staleReasons, now);

  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], nextKind);
  pushField(fields, schema, ['title', 'name', 'asset_name'], asText(input.title));
  pushField(fields, schema, ['value', 'selected_value_ex_vat', 'selected_value', 'saved_value_ex_vat'], nextValue);
  pushField(fields, schema, ['selected_value_ex_vat', 'selected_value', 'value', 'saved_value_ex_vat'], nextValue);
  pushField(fields, schema, ['replacement_price_used_ex_vat', 'replacement_price_ex_vat', 'official_replacement_price_ex_vat'], nextReplacementPriceExVat);
  pushField(fields, schema, ['user_replacement_price_ex_vat'], nextReplacementPriceExVat);
  pushField(fields, schema, ['replacement_price_basis'], nextReplacementPriceExVat !== null ? 'user' : null);
  pushField(fields, schema, ['note', 'notes', 'description'], cleanAssetRegisterNote(input.note) || null);
  pushField(fields, schema, ['serial_number', 'serial', 'vin'], asText(input.serialNumber) || null);
  pushField(fields, schema, ['is_financed', 'financed'], Boolean(input.isFinanced));
  pushField(fields, schema, ['is_insured', 'insured'], Boolean(input.isInsured));
  pushField(fields, schema, ['is_licensed', 'licensed', 'licenced'], Boolean(input.isLicensed));
  pushField(fields, schema, ['license_registration_number', 'licence_registration_number', 'registration_number', 'number_plate', 'numberplate'], nextLicenseRegistrationNumber);
  pushField(fields, schema, ['finance_note', 'finance_notes', 'finance_status'], asText(input.financeNote) || null);
  pushField(fields, schema, ['year_model', 'year'], nextYearModel);
  pushField(fields, schema, ['specs_json'], nextSpecsJson, '::jsonb');
  pushField(fields, schema, ['life_worked_percent'], nextLifeWorkedPercent);
  pushField(fields, schema, ['life_remaining_percent'], nextLifeWorkedPercent === null ? null : Math.max(0, 100 - nextLifeWorkedPercent));
  pushField(fields, schema, ['hours', 'engine_hours'], nextHours);
  pushField(fields, schema, ['condition'], nextCondition);
  pushPhotoField(fields, schema, input.photos ?? []);
  pushDocumentField(fields, schema, input.documents ?? []);
  pushField(fields, schema, ['updated_at', 'modified_at', 'updatedon'], now);

  if (!fields.length) {
    return existing;
  }

  const update = buildUpdateSetClause(fields);
  const result = await db.query<AssetRegisterRow>(
    `
      update asset_register_items
      set
        ${update.clause}
      where user_id = $1 and id = $2
      returning
        ${buildSelectList(schema)}
    `,
    [userId, input.assetId, ...update.values],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('ASSET_UPDATE_FAILED');
  }

  return mapAssetRegisterRow(row);
}


export async function updateAssetRegisterItemFromValuation(input: {
  userId: string;
  assetId: string;
  valuationRunId: number;
  result: Result;
  selectedMethod: MethodKey;
  selectedValueExVat: number;
  year: number;
  hours: number;
  condition: ConditionKey;
}): Promise<AssetRegisterItem> {
  const db = getDb();
  const schema = await getAssetRegisterSchema();
  const valuationSchema = await getValuationRunsSchema();
  const existing = await getAssetRegisterItemById(input.userId, input.assetId);

  if (!existing) {
    throw new Error('ASSET_NOT_FOUND');
  }

  const valuationRow = await fetchValuationRunRowById(input.userId, input.valuationRunId);

  if (!valuationRow) {
    throw new Error('VALUATION_RUN_NOT_FOUND');
  }

  const now = new Date();
  const model = input.result.model;
  const selectedValueExVat = Math.round(Number(input.selectedValueExVat) || 0);
  const replacementPriceUsedExVat = normalizeReplacementPriceExVat(input.result.replacementPriceUsedExVat);
  const userReplacementPriceExVat = normalizeReplacementPriceExVat(input.result.userReplacementPriceExVat);

  if (replacementPriceUsedExVat === null) {
    throw new Error('REPLACEMENT_PRICE_REQUIRED');
  }

  const fields: SqlField[] = [];
  const valuationSpecsJson = isRecord(valuationRow.specs_json) ? valuationRow.specs_json : {};

  copySharedFieldsFromValuationRun(fields, schema, valuationSchema, valuationRow);

  pushField(fields, schema, ['valuation_run_id', 'run_id'], input.valuationRunId);
  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], 'tractor');
  pushField(fields, schema, ['value', 'selected_value_ex_vat', 'selected_value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['selected_method', 'method', 'valuation_method'], input.selectedMethod);
  pushField(fields, schema, ['selected_value_ex_vat', 'selected_value', 'value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['source_type', 'source', 'origin', 'entry_source'], 'valuation');
  pushField(fields, schema, ['brand_name', 'brand'], model.brandName);
  pushField(fields, schema, ['model_name', 'model'], model.modelName);
  pushField(fields, schema, ['drive_type', 'drive', 'drivetrain'], model.drive);
  pushField(fields, schema, ['tractor_type', 'tractor_category'], model.tractorType);
  pushField(fields, schema, ['cab_type', 'cab'], model.cab);
  pushField(fields, schema, ['power_kw', 'kw', 'power'], model.powerKw);
  pushField(fields, schema, ['year_model', 'year'], Math.round(input.year));
  pushField(fields, schema, ['hours', 'engine_hours'], Math.max(0, Math.round(input.hours)));
  pushField(fields, schema, ['condition'], input.condition);
  pushField(fields, schema, ['aim4price_value_ex_vat', 'aim4price_value'], toRoundedNumber(input.result.aim4priceValueExVat));
  pushField(fields, schema, ['market_mid_ex_vat', 'market_value_ex_vat', 'market_value'], toRoundedNumber(input.result.marketMid));
  pushField(fields, schema, ['replacement_price_used_ex_vat', 'replacement_price_ex_vat', 'official_replacement_price_ex_vat'], replacementPriceUsedExVat);
  pushField(fields, schema, ['user_replacement_price_ex_vat'], userReplacementPriceExVat);
  pushField(fields, schema, ['replacement_price_basis'], input.result.replacementPriceBasis);
  pushField(
    fields,
    schema,
    ['specs_json'],
    buildCurrentValuationSpecs(existing.specsJson, valuationSpecsJson, {
      valuationRunId: input.valuationRunId,
      selectedValueExVat,
      hours: input.hours,
      lifeWorkedPercent: null,
      condition: input.condition,
      now,
    }),
    '::jsonb',
  );
  pushField(fields, schema, ['updated_at', 'modified_at', 'updatedon'], now);

  const update = buildUpdateSetClause(fields);
  const result = await db.query<AssetRegisterRow>(
    `
      update asset_register_items
      set
        ${update.clause}
      where user_id = $1 and id = $2
      returning
        ${buildSelectList(schema)}
    `,
    [input.userId, input.assetId, ...update.values],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('ASSET_UPDATE_FAILED');
  }

  return mapAssetRegisterRow(row);
}

export async function updateAssetRegisterItemFromGenericValuation(input: {
  userId: string;
  assetId: string;
  valuationRunId: number;
  result: GenericValuationResult;
  selectedMethod: GenericSelectedMethod;
  selectedValueExVat: number;
}): Promise<AssetRegisterItem> {
  const db = getDb();
  const schema = await getAssetRegisterSchema();
  const valuationSchema = await getValuationRunsSchema();
  const existing = await getAssetRegisterItemById(input.userId, input.assetId);

  if (!existing) {
    throw new Error('ASSET_NOT_FOUND');
  }

  const valuationRow = await fetchValuationRunRowById(input.userId, input.valuationRunId);

  if (!valuationRow) {
    throw new Error('VALUATION_RUN_NOT_FOUND');
  }

  const now = new Date();
  const valuationResult = input.result;
  const selectedValueExVat = Math.round(Number(input.selectedValueExVat) || 0);
  const replacementPriceUsedExVat = normalizeReplacementPriceExVat(valuationResult.replacementPriceUsedExVat);
  const userReplacementPriceExVat = normalizeReplacementPriceExVat(valuationResult.userReplacementPriceExVat);

  if (replacementPriceUsedExVat === null) {
    throw new Error('REPLACEMENT_PRICE_REQUIRED');
  }

  const fields: SqlField[] = [];

  copySharedFieldsFromValuationRun(fields, schema, valuationSchema, valuationRow);

  pushField(fields, schema, ['valuation_run_id', 'run_id'], input.valuationRunId);
  pushField(fields, schema, ['sector_id'], valuationResult.sector.id);
  pushField(fields, schema, ['equipment_family_id'], valuationResult.family.id);
  pushField(fields, schema, ['equipment_model_id'], null);
  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], 'equipment');
  pushField(fields, schema, ['value', 'selected_value_ex_vat', 'selected_value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['selected_method', 'method', 'valuation_method'], input.selectedMethod);
  pushField(fields, schema, ['selected_value_ex_vat', 'selected_value', 'value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['source_type', 'source', 'origin', 'entry_source'], 'valuation');
  pushField(fields, schema, ['brand_name', 'brand'], valuationResult.brand.name);
  pushField(fields, schema, ['model_name', 'model'], valuationResult.typedModelName || 'Specs-based valuation');
  pushField(fields, schema, ['typed_model_name'], valuationResult.typedModelName || null);
  pushField(fields, schema, ['normalized_typed_model_name'], valuationResult.normalizedTypedModelName || null);
  pushField(
    fields,
    schema,
    ['specs_json'],
    buildCurrentValuationSpecs(existing.specsJson, valuationResult.specsJson ?? {}, {
      valuationRunId: input.valuationRunId,
      selectedValueExVat,
      hours: valuationResult.usageAmount ?? null,
      lifeWorkedPercent: valuationResult.lifeWorkedPercent,
      condition: valuationResult.condition,
      now,
    }),
    '::jsonb',
  );
  pushField(fields, schema, ['depreciation_method_used'], valuationResult.depreciationMethodUsed);
  pushField(fields, schema, ['replacement_price_basis'], valuationResult.replacementPriceBasis);
  pushField(fields, schema, ['replacement_price_used_ex_vat', 'replacement_price_ex_vat', 'official_replacement_price_ex_vat'], replacementPriceUsedExVat);
  pushField(fields, schema, ['user_replacement_price_ex_vat'], userReplacementPriceExVat);
  pushField(fields, schema, ['life_worked_percent'], valuationResult.lifeWorkedPercent);
  pushField(fields, schema, ['life_remaining_percent'], valuationResult.lifeRemainingPercent);
  pushField(fields, schema, ['estimated_hours'], valuationResult.estimatedHours);
  pushField(fields, schema, ['max_lifetime_hours'], valuationResult.maxLifetimeHours);
  pushField(fields, schema, ['year_model', 'year'], valuationResult.year);
  pushField(fields, schema, ['hours', 'engine_hours'], valuationResult.usageAmount ?? null);
  pushField(fields, schema, ['condition'], valuationResult.condition);
  pushField(fields, schema, ['aim4price_value_ex_vat', 'aim4price_value'], toRoundedNumber(valuationResult.aim4priceValueExVat));
  pushField(fields, schema, ['market_mid_ex_vat', 'market_value_ex_vat', 'market_value'], toRoundedNumber(valuationResult.marketAverageExVat));
  pushField(fields, schema, ['updated_at', 'modified_at', 'updatedon'], now);

  const update = buildUpdateSetClause(fields);
  const result = await db.query<AssetRegisterRow>(
    `
      update asset_register_items
      set
        ${update.clause}
      where user_id = $1 and id = $2
      returning
        ${buildSelectList(schema)}
    `,
    [input.userId, input.assetId, ...update.values],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('ASSET_UPDATE_FAILED');
  }

  return mapAssetRegisterRow(row);
}

export async function deleteAssetRegisterItem(userId: string, assetId: string): Promise<void> {
  const db = getDb();

  await db.query(
    `
      delete from asset_register_items
      where user_id = $1 and id = $2
    `,
    [userId, assetId],
  );
}

export async function createAssetRegisterItemFromValuation(input: {
  userId: string;
  valuationRunId: number;
  result: Result;
  selectedMethod: MethodKey;
  selectedValueExVat: number;
  year: number;
  hours: number;
  note?: string | null;
  photos?: string[];
}): Promise<AssetRegisterItem> {
  const db = getDb();
  const schema = await getAssetRegisterSchema();
  const valuationSchema = await getValuationRunsSchema();
  const valuationRow = await fetchValuationRunRowById(input.userId, input.valuationRunId);

  if (!valuationRow) {
    throw new Error('VALUATION_RUN_NOT_FOUND');
  }

  const valuationResult = input.result;
  const model = valuationResult.model;
  const title = `${model.brandName} ${model.modelName}`.trim();
  const now = new Date();
  const selectedValueExVat = Math.round(Number(input.selectedValueExVat) || 0);
  const replacementPriceUsedExVat = normalizeReplacementPriceExVat(valuationResult.replacementPriceUsedExVat);
  const userReplacementPriceExVat = normalizeReplacementPriceExVat(valuationResult.userReplacementPriceExVat);

  if (replacementPriceUsedExVat === null) {
    throw new Error('REPLACEMENT_PRICE_REQUIRED');
  }

  const fields: SqlField[] = [];

  copySharedFieldsFromValuationRun(fields, schema, valuationSchema, valuationRow);

  pushField(fields, schema, ['user_id'], input.userId);
  pushField(fields, schema, ['valuation_run_id', 'run_id'], input.valuationRunId);
  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], 'tractor');
  pushField(fields, schema, ['title', 'name', 'asset_name'], title);
  pushField(fields, schema, ['value', 'selected_value_ex_vat', 'selected_value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['selected_method', 'method', 'valuation_method'], input.selectedMethod);
  pushField(fields, schema, ['selected_value_ex_vat', 'selected_value', 'value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['source_type', 'source', 'origin', 'entry_source'], 'valuation');
  pushField(fields, schema, ['brand_name', 'brand'], model.brandName);
  pushField(fields, schema, ['model_name', 'model'], model.modelName);
  pushField(fields, schema, ['drive_type', 'drive', 'drivetrain'], model.drive);
  pushField(fields, schema, ['tractor_type', 'tractor_category'], model.tractorType);
  pushField(fields, schema, ['cab_type', 'cab'], model.cab);
  pushField(fields, schema, ['power_kw', 'kw', 'power'], model.powerKw);
  pushField(fields, schema, ['year_model', 'year'], Math.round(input.year));
  pushField(fields, schema, ['hours', 'engine_hours'], Math.max(0, Math.round(input.hours)));
  pushField(fields, schema, ['condition'], typeof valuationRow.condition === 'string' ? valuationRow.condition : 'good');
  pushField(fields, schema, ['aim4price_value_ex_vat', 'aim4price_value'], toRoundedNumber(valuationResult.aim4priceValueExVat));
  pushField(fields, schema, ['market_mid_ex_vat', 'market_value_ex_vat', 'market_value'], toRoundedNumber(valuationResult.marketMid));
  pushField(fields, schema, ['replacement_price_used_ex_vat', 'replacement_price_ex_vat', 'official_replacement_price_ex_vat'], replacementPriceUsedExVat);
  pushField(fields, schema, ['user_replacement_price_ex_vat'], userReplacementPriceExVat);
  pushField(fields, schema, ['replacement_price_basis'], valuationResult.replacementPriceBasis);
  pushField(fields, schema, ['note', 'notes', 'description'], cleanAssetRegisterNote(input.note) || null);
  pushPhotoField(fields, schema, input.photos ?? []);
  pushField(fields, schema, ['created_at', 'createdon', 'created'], now);
  pushField(fields, schema, ['updated_at', 'modified_at', 'updatedon'], now);

  ensureRequiredFields(fields, schema, {
    userId: input.userId,
    valuationRunId: input.valuationRunId,
    title,
    kind: 'tractor',
    selectedMethod: input.selectedMethod,
    selectedValueExVat,
    note: cleanAssetRegisterNote(input.note) || null,
    brandName: model.brandName,
    modelName: model.modelName,
    drive: model.drive,
    tractorType: model.tractorType,
    cab: model.cab,
    powerKw: model.powerKw,
    year: Math.round(input.year),
    hours: Math.max(0, Math.round(input.hours)),
    condition: typeof valuationRow.condition === 'string' ? valuationRow.condition : 'good',
    now,
  });

  const query = buildInsertQuery(schema, fields);
  const inserted = await db.query<AssetRegisterRow>(query.sql, query.values);
  const row = inserted.rows[0];

  if (!row) {
    throw new Error('ASSET_CREATE_FAILED');
  }

  return mapAssetRegisterRow(row);
}

export async function createAssetRegisterItemFromGenericValuation(input: {
  userId: string;
  valuationRunId: number;
  result: GenericValuationResult;
  selectedMethod: GenericSelectedMethod;
  selectedValueExVat: number;
  note?: string | null;
  photos?: string[];
}): Promise<AssetRegisterItem> {
  const db = getDb();
  const schema = await getAssetRegisterSchema();
  const valuationSchema = await getValuationRunsSchema();
  const valuationRow = await fetchValuationRunRowById(input.userId, input.valuationRunId);

  if (!valuationRow) {
    throw new Error('VALUATION_RUN_NOT_FOUND');
  }

  const valuationResult = input.result;
  const title = [valuationResult.brand.name, valuationResult.typedModelName || valuationResult.family.label]
    .map((part) => asText(part))
    .filter(Boolean)
    .join(' ')
    .trim();
  const now = new Date();
  const selectedValueExVat = Math.round(Number(input.selectedValueExVat) || 0);
  const replacementPriceUsedExVat = normalizeReplacementPriceExVat(valuationResult.replacementPriceUsedExVat);
  const userReplacementPriceExVat = normalizeReplacementPriceExVat(valuationResult.userReplacementPriceExVat);

  if (replacementPriceUsedExVat === null) {
    throw new Error('REPLACEMENT_PRICE_REQUIRED');
  }

  const fields: SqlField[] = [];

  copySharedFieldsFromValuationRun(fields, schema, valuationSchema, valuationRow);

  pushField(fields, schema, ['user_id'], input.userId);
  pushField(fields, schema, ['valuation_run_id', 'run_id'], input.valuationRunId);
  pushField(fields, schema, ['sector_id'], valuationResult.sector.id);
  pushField(fields, schema, ['equipment_family_id'], valuationResult.family.id);
  pushField(fields, schema, ['equipment_model_id'], null);
  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], 'equipment');
  pushField(fields, schema, ['title', 'name', 'asset_name'], title);
  pushField(fields, schema, ['value', 'selected_value_ex_vat', 'selected_value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['selected_method', 'method', 'valuation_method'], input.selectedMethod);
  pushField(fields, schema, ['selected_value_ex_vat', 'selected_value', 'value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['source_type', 'source', 'origin', 'entry_source'], 'valuation');
  pushField(fields, schema, ['brand_name', 'brand'], valuationResult.brand.name);
  pushField(fields, schema, ['model_name', 'model'], valuationResult.typedModelName || 'Specs-based valuation');
  pushField(fields, schema, ['typed_model_name'], valuationResult.typedModelName || null);
  pushField(fields, schema, ['normalized_typed_model_name'], valuationResult.normalizedTypedModelName || null);
  pushField(fields, schema, ['specs_json'], valuationResult.specsJson ?? {}, '::jsonb');
  pushField(fields, schema, ['depreciation_method_used'], valuationResult.depreciationMethodUsed);
  pushField(fields, schema, ['replacement_price_basis'], valuationResult.replacementPriceBasis);
  pushField(fields, schema, ['replacement_price_used_ex_vat', 'replacement_price_ex_vat', 'official_replacement_price_ex_vat'], replacementPriceUsedExVat);
  pushField(fields, schema, ['user_replacement_price_ex_vat'], userReplacementPriceExVat);
  pushField(fields, schema, ['life_worked_percent'], valuationResult.lifeWorkedPercent);
  pushField(fields, schema, ['life_remaining_percent'], valuationResult.lifeRemainingPercent);
  pushField(fields, schema, ['estimated_hours'], valuationResult.estimatedHours);
  pushField(fields, schema, ['max_lifetime_hours'], valuationResult.maxLifetimeHours);
  pushField(fields, schema, ['year_model', 'year'], valuationResult.year);
  pushField(fields, schema, ['hours', 'engine_hours'], valuationResult.usageAmount ?? null);
  pushField(fields, schema, ['condition'], valuationResult.condition);
  pushField(fields, schema, ['aim4price_value_ex_vat', 'aim4price_value'], toRoundedNumber(valuationResult.aim4priceValueExVat));
  pushField(fields, schema, ['market_mid_ex_vat', 'market_value_ex_vat', 'market_value'], toRoundedNumber(valuationResult.marketAverageExVat));
  pushField(fields, schema, ['note', 'notes', 'description'], cleanAssetRegisterNote(input.note) || null);
  pushPhotoField(fields, schema, input.photos ?? []);
  pushField(fields, schema, ['created_at', 'createdon', 'created'], now);
  pushField(fields, schema, ['updated_at', 'modified_at', 'updatedon'], now);

  ensureRequiredFields(fields, schema, {
    userId: input.userId,
    valuationRunId: input.valuationRunId,
    title,
    kind: 'equipment',
    selectedMethod: input.selectedMethod,
    selectedValueExVat,
    note: cleanAssetRegisterNote(input.note) || null,
    brandName: valuationResult.brand.name,
    modelName: valuationResult.typedModelName || 'Specs-based valuation',
    year: valuationResult.year,
    hours: valuationResult.usageAmount ?? null,
    condition: valuationResult.condition,
    now,
  });

  const query = buildInsertQuery(schema, fields);
  const inserted = await db.query<AssetRegisterRow>(query.sql, query.values);
  const row = inserted.rows[0];

  if (!row) {
    throw new Error('ASSET_CREATE_FAILED');
  }

  return mapAssetRegisterRow(row);
}

function toRoundedNumber(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.round(value);
}
