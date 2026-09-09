import { assetDisplayTitle } from './asset-display-title';
import { getDb } from './db';
import {
  ensureAssetRegisterTables,
  getAssetRegisterForUser,
  getSelectedAssetRegister,
} from './asset-registers';
import type { CabType, ConditionKey, DriveType, TractorType } from './tractor-data';
import type { MethodKey } from './valuation-runs';
import type { Result } from './tractor-logic';
import type { GenericSelectedMethod, GenericValuationResult } from './generic-valuation';
import { captureAssetDepreciationLogEntry } from './asset-depreciation-timeline';
import { ensureFuelLedgerTables } from './fuel-ledger';
import {
  normalizeAssetDocumentCategory,
  normalizeAssetDocumentType,
  type AssetDocumentCategory,
} from './asset-document-permissions';

export type AssetRegisterItemKind = 'tractor' | 'equipment' | 'manual' | 'property' | 'vehicle' | 'tools' | 'stock';
export type AssetRegisterItemMethod = MethodKey | 'manual';
export type AssetRegisterItemCondition = ConditionKey | '';
type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';
export type AssetRegisterQrStatus = 'active' | 'transferred' | 'retired' | 'deleted' | '';

export type AssetRegisterDocument = {
  id: string;
  url: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  uploadedAtIso: string;
  category: AssetDocumentCategory;
  documentType: string;
};

export type AssetRegisterItem = {
  id: string;
  userId: string;
  registerId: string | null;
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
  insuredValueExVat: number | null;
  isLicensed: boolean;
  licenseRegistrationNumber: string;
  financeNote: string;
  sellerPhone: string;
  marketplaceNotes: string;
  marketplaceStatus: string;
  marketplacePriceExVat: number | null;
  marketplaceSellerName: string;
  marketplaceSellerCompany: string;
  marketplaceSellerEmail: string;
  marketplaceProvince: string;
  marketplaceArea: string;
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
  registerId?: string | null;
  kind: AssetRegisterItemKind;
  title: string;
  value: number;
  replacementPriceExVat?: number | null;
  note?: string | null;
  serialNumber?: string | null;
  brandName?: string | null;
  modelName?: string | null;
  isFinanced?: boolean;
  isInsured?: boolean;
  insuredValueExVat?: number | null;
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
  brandName?: string | null;
  modelName?: string | null;
  isFinanced?: boolean;
  isInsured?: boolean;
  insuredValueExVat?: number | null;
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
  allowUsageDecrease?: boolean;
};

export type UpdateAssetRegisterItemNamesInput = {
  assetId: string;
  registerId: string;
  title?: string | null;
  brandName?: string | null;
  modelName?: string | null;
};

export type UpdateAssetRegisterItemYearModelInput = {
  assetId: string;
  yearModel: number | null;
};

export type UpdateAssetRegisterItemLocationInput = {
  assetId: string;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters?: number | null;
  clientCapturedAt?: string | Date | null;
  locationText?: string | null;
  source?: 'manual' | 'device' | string | null;
};

export type UpdateAssetRegisterItemStatusDetailsInput = {
  assetId: string;
  isFinanced?: boolean;
  financeNote?: string | null;
  isInsured?: boolean;
  insuredValueExVat?: number | null;
  isLicensed?: boolean;
  licenseRegistrationNumber?: string | null;
  specsJson?: Record<string, unknown>;
};

type AssetRegisterRow = {
  id: string | number;
  user_id: string | null;
  register_id: string | null;
  valuation_run_id: string | number | null;
  sector_id: string | number | null;
  equipment_family_id: string | number | null;
  equipment_family_key: string | null;
  equipment_family_label: string | null;
  family_usage_metric_type?: string | null;
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
  insured_value_ex_vat: string | number | null;
  is_licensed: boolean | null;
  license_registration_number: string | null;
  finance_note: string | null;
  seller_phone: string | null;
  marketplace_notes: string | null;
  marketplace_status: string | null;
  marketplace_price_ex_vat: string | number | null;
  marketplace_seller_name: string | null;
  marketplace_seller_company: string | null;
  marketplace_seller_email: string | null;
  marketplace_province: string | null;
  marketplace_area: string | null;
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


const UNKNOWN_ASSET_PART = 'Unknown';
const UNKNOWN_ASSET_PART_KEYS = new Set([
  'unknown',
  'unknownbrand',
  'brandunknown',
  'brandnotlisted',
  'notlistedbrand',
  'unknownmodel',
  'modelunknown',
  'modelnotlisted',
  'notlistedmodel',
  'notlisted',
  'n/a',
  'na',
  'none',
  'notapplicable',
  'specsbasedvaluation',
  'specificationbasedvaluation',
]);

const GENERIC_ENTERED_BRAND_SPEC_KEYS = [
  'unlisted_brand_name',
  'typed_brand_name',
  'manual_brand_name',
  'manualBrandName',
  'entered_brand_name',
  'enteredBrandName',
  'user_brand_name',
  'userBrandName',
];

const GENERIC_MANUAL_BRAND_SPEC_KEYS = [
  ...GENERIC_ENTERED_BRAND_SPEC_KEYS,
  'brandName',
  'brand_name',
  'brand',
];

const GENERIC_MODEL_SPEC_KEYS = [
  'manual_model_name',
  'manualModelName',
  'typedModelName',
  'typed_model_name',
  'entered_model_name',
  'enteredModelName',
  'user_model_name',
  'userModelName',
  'canonical_model_label',
  'modelName',
  'model_name',
  'model',
];

const GENERIC_TYPE_LABEL_SPEC_KEYS = [
  'type_label',
  'typeLabel',
  'selected_type_label',
  'selectedTypeLabel',
  'body_type_label',
  'bodyTypeLabel',
  'cab_type_label',
  'cabTypeLabel',
  'truck_type_label',
  'truckTypeLabel',
  'trailer_type_label',
  'trailerTypeLabel',
  'bus_type_label',
  'busTypeLabel',
  'motorcycle_type_label',
  'motorcycleTypeLabel',
  'quadbike_type_label',
  'quadbikeTypeLabel',
  'side_by_side_type_label',
  'sideBySideTypeLabel',
];

const GENERIC_TYPE_VALUE_SPEC_KEYS = [
  'type_key',
  'typeKey',
  'motor_type',
  'motorType',
  'body_type',
  'bodyType',
  'cab_type',
  'cabType',
  'vehicle_type',
  'vehicleType',
  'vehicle_segment',
  'vehicleSegment',
  'truck_type',
  'truckType',
  'trailer_type',
  'trailerType',
  'bus_type',
  'busType',
  'motorcycle_type',
  'motorcycleType',
  'quadbike_type',
  'quadbikeType',
  'side_by_side_type',
  'sideBySideType',
  'equipment_type',
  'equipmentType',
  'asset_type',
  'assetType',
];

type PersistedAssetIdentity = {
  brandName: string;
  modelName: string;
  typeLabel: string;
  title: string;
};

function cleanAssetIdentityText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAssetIdentityKey(value: unknown): string {
  return cleanAssetIdentityText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9/]+/g, '')
    .trim();
}

function isUnknownAssetIdentityText(value: unknown): boolean {
  const clean = cleanAssetIdentityText(value);
  if (!clean) return true;

  return UNKNOWN_ASSET_PART_KEYS.has(normalizeAssetIdentityKey(clean));
}

function normalizeUnknownAssetPart(value: unknown): string {
  const clean = cleanAssetIdentityText(value);
  if (!clean) return '';

  return isUnknownAssetIdentityText(clean) ? UNKNOWN_ASSET_PART : clean;
}

function readFirstCleanText(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const clean = cleanAssetIdentityText(record[key]);
    if (clean) return clean;
  }

  return '';
}

function readFirstKnownText(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const clean = cleanAssetIdentityText(record[key]);
    if (clean && !isUnknownAssetIdentityText(clean)) return clean;
  }

  return '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripLeadingBrandFromModel(modelName: unknown, brandName: unknown): string {
  let model = cleanAssetIdentityText(modelName);
  const brand = cleanAssetIdentityText(brandName);

  if (!model || !brand || isUnknownAssetIdentityText(brand)) {
    return model;
  }

  const escapedBrand = escapeRegExp(brand).replace(/\s+/g, '\\s+');
  const leadingBrandPattern = new RegExp(`^${escapedBrand}(?:\\s+|[-_/]+)+`, 'i');

  while (leadingBrandPattern.test(model)) {
    model = model.replace(leadingBrandPattern, '').trim();
  }

  return model;
}

function normalizeKnownModelName(modelName: unknown, brandName: unknown): string {
  const stripped = stripLeadingBrandFromModel(modelName, brandName);
  if (!stripped || isUnknownAssetIdentityText(stripped)) return UNKNOWN_ASSET_PART;
  return stripped;
}

function humanizeAssetTypeLabel(value: unknown): string {
  const clean = cleanAssetIdentityText(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean || isUnknownAssetIdentityText(clean)) return '';

  const acronymMap: Record<string, string> = {
    lcv: 'LCV',
    ldv: 'LDV',
    suv: 'SUV',
    mpv: 'MPV',
    tlb: 'TLB',
    gps: 'GPS',
    pto: 'PTO',
    kw: 'kW',
    '2wd': '2WD',
    '4wd': '4WD',
  };

  return clean
    .split(' ')
    .map((word) => {
      if (word === '/') return word;
      const key = word.toLowerCase();
      if (acronymMap[key]) return acronymMap[key];
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ')
    .replace(/\s+\/\s+/g, ' / ')
    .trim();
}

function appendUniqueTitlePart(parts: string[], value: unknown): void {
  const clean = cleanAssetIdentityText(value);
  if (!clean) return;

  const key = normalizeAssetIdentityKey(clean);
  if (!key) return;

  if (parts.some((part) => normalizeAssetIdentityKey(part) === key)) return;

  const existingKey = normalizeAssetIdentityKey(parts.join(' '));
  if (
    key !== normalizeAssetIdentityKey(UNKNOWN_ASSET_PART) &&
    key.length >= 4 &&
    existingKey.includes(key)
  ) {
    return;
  }

  parts.push(clean);
}

function buildAssetIdentityTitle(input: {
  yearModel: number | null;
  yearModelUnknown?: boolean | null;
  brandName: string;
  modelName: string;
  typeLabel?: string | null;
}): string {
  const parts: string[] = [];
  const savedYear = input.yearModelUnknown ? null : input.yearModel;
  const brandUnknown = isUnknownAssetIdentityText(input.brandName);
  const modelUnknown = isUnknownAssetIdentityText(input.modelName);
  const brandName = brandUnknown ? UNKNOWN_ASSET_PART : cleanAssetIdentityText(input.brandName);
  const modelName = modelUnknown ? UNKNOWN_ASSET_PART : cleanAssetIdentityText(input.modelName);

  if (savedYear !== null && Number.isInteger(savedYear) && savedYear >= 1800) {
    parts.push(String(savedYear));
  }

  if (brandUnknown && modelUnknown) {
    parts.push(UNKNOWN_ASSET_PART);
  } else {
    parts.push(brandName || UNKNOWN_ASSET_PART);
    appendUniqueTitlePart(parts, modelName || UNKNOWN_ASSET_PART);
  }

  // Classifications remain in metadata, never appended to the asset name.

  return parts.join(' ').replace(/\s+/g, ' ').trim() || UNKNOWN_ASSET_PART;
}

function withPersistedAssetIdentitySpecs(
  specs: Record<string, unknown>,
  identity: PersistedAssetIdentity,
): Record<string, unknown> {
  return {
    ...specs,
    brandName: identity.brandName,
    brand_name: identity.brandName,
    brand: identity.brandName,
    modelName: identity.modelName,
    model_name: identity.modelName,
    model: identity.modelName,
    typedModelName: identity.modelName,
    typed_model_name: identity.modelName,
    assetTitle: identity.title,
    asset_title: identity.title,
    title: identity.title,
    ...(identity.typeLabel
      ? {
          typeLabel: identity.typeLabel,
          type_label: identity.typeLabel,
          assetTypeLabel: identity.typeLabel,
          asset_type_label: identity.typeLabel,
        }
      : {}),
  };
}

function buildTractorAssetIdentity(input: {
  result: Result;
  yearModel: number | null;
  yearModelUnknown?: boolean | null;
}): PersistedAssetIdentity {
  const model = input.result.model;
  const brandName = normalizeUnknownAssetPart(model.brandName) || UNKNOWN_ASSET_PART;
  const modelName = normalizeKnownModelName(model.modelName, brandName);
  const typeLabel = humanizeAssetTypeLabel(model.tractorType) || 'Tractor';
  const title = buildAssetIdentityTitle({
    yearModel: input.yearModel,
    yearModelUnknown: input.yearModelUnknown,
    brandName,
    modelName,
    typeLabel,
  });

  return { brandName, modelName, typeLabel, title };
}

function readGenericAssetTypeLabel(result: GenericValuationResult): string {
  const specs = isRecord(result.specsJson) ? result.specsJson : {};
  const explicitLabel = readFirstKnownText(specs, GENERIC_TYPE_LABEL_SPEC_KEYS);
  if (explicitLabel) return humanizeAssetTypeLabel(explicitLabel);

  const explicitValue = readFirstKnownText(specs, GENERIC_TYPE_VALUE_SPEC_KEYS);
  if (explicitValue) return humanizeAssetTypeLabel(explicitValue);

  return humanizeAssetTypeLabel(result.family.label);
}

function buildGenericAssetIdentity(input: {
  result: GenericValuationResult;
  yearModel: number | null;
  yearModelUnknown?: boolean | null;
}): PersistedAssetIdentity {
  const result = input.result;
  const specs = isRecord(result.specsJson) ? result.specsJson : {};
  const enteredBrandName = readFirstKnownText(specs, GENERIC_ENTERED_BRAND_SPEC_KEYS);
  const rawBrandName = enteredBrandName || result.brand.name;
  const brandName = normalizeUnknownAssetPart(rawBrandName) || UNKNOWN_ASSET_PART;
  const rawModelName =
    cleanAssetIdentityText(result.typedModelName) ||
    readFirstCleanText(specs, GENERIC_MODEL_SPEC_KEYS);
  const modelName = normalizeKnownModelName(rawModelName, brandName);
  const typeLabel = readGenericAssetTypeLabel(result);
  const title = buildAssetIdentityTitle({
    yearModel: input.yearModel,
    yearModelUnknown: input.yearModelUnknown,
    brandName,
    modelName,
    typeLabel,
  });

  return { brandName, modelName, typeLabel, title };
}

function normalizeAssetLocationText(value: unknown): string {
  return asText(value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 180)
    .trim();
}

function normalizeAssetLocationSource(value: unknown): 'manual' | 'device' {
  const normalized = asText(value).toLowerCase();

  return normalized === 'manual' ? 'manual' : 'device';
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

function readLicenseRenewalDateFromSpecs(specs: Record<string, unknown>): string {
  const candidates = [
    specs.licenseRenewalDate,
    specs.license_renewal_date,
    specs.licenceRenewalDate,
    specs.licence_renewal_date,
  ];

  for (const candidate of candidates) {
    const value = asText(candidate);
    if (value) return value;
  }

  return '';
}

function normalizeAssetStatusChoice(value: unknown, fallback: AssetStatusChoice = 'unknown'): AssetStatusChoice {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (['yes', 'y', 'true', 'financed', 'insured', 'licensed', 'licenced', 'is_financed', 'is_insured', 'is_licensed'].includes(normalized)) {
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

function readInsuranceStatusFromSpecs(specs: Record<string, unknown>, fallback: AssetStatusChoice): AssetStatusChoice {
  return normalizeAssetStatusChoice(
    specs.insuranceStatus ?? specs.insurance_status ?? specs.insuredStatus ?? specs.insured_status,
    fallback,
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

const LIFE_WORKED_PERCENT_DECREASE_TOLERANCE = 0.05;

const YEAR_MODEL_SPEC_KEYS = [
  'yearModel',
  'year_model',
  'displayYearModel',
  'display_year_model',
  'assetYearModel',
  'asset_year_model',
  'currentYearModel',
  'current_year_model',
] as const;

function normalizePersistedYearModel(value: unknown): number | null {
  const numeric = asNumber(value);
  if (numeric === null) return null;

  const year = Math.round(numeric);
  if (year < 1800 || year > new Date().getFullYear() + 1) return null;

  return year;
}

function buildYearModelSpecsJson(
  specs: Record<string, unknown>,
  yearModel: unknown,
  yearModelUnknown: boolean,
): Record<string, unknown> {
  const nextSpecs = { ...specs };
  const normalizedYearModel = normalizePersistedYearModel(yearModel);

  for (const key of YEAR_MODEL_SPEC_KEYS) {
    delete nextSpecs[key];
  }

  if (normalizedYearModel !== null && !yearModelUnknown) {
    nextSpecs.yearModel = normalizedYearModel;
    nextSpecs.year_model = normalizedYearModel;
    nextSpecs.displayYearModel = normalizedYearModel;
    nextSpecs.display_year_model = normalizedYearModel;
    nextSpecs.assetYearModel = normalizedYearModel;
    nextSpecs.asset_year_model = normalizedYearModel;
    nextSpecs.currentYearModel = normalizedYearModel;
    nextSpecs.current_year_model = normalizedYearModel;
    nextSpecs.yearModelUnknown = false;
    nextSpecs.year_model_unknown = false;
    return nextSpecs;
  }

  nextSpecs.yearModelUnknown = Boolean(yearModelUnknown);
  nextSpecs.year_model_unknown = Boolean(yearModelUnknown);
  return nextSpecs;
}

function buildPercentUsageSpecsJson(specs: Record<string, unknown>, lifeWorkedPercent: number): Record<string, unknown> {
  return {
    ...specs,
    usageMode: 'percent',
    usage_mode: 'percent',
    usageBasis: 'percent',
    usage_basis: 'percent',
    lifeWorkedPercent,
    life_worked_percent: lifeWorkedPercent,
    workedPercent: lifeWorkedPercent,
    worked_percent: lifeWorkedPercent,
    percentWorked: lifeWorkedPercent,
    percent_worked: lifeWorkedPercent,
    lifetimeWorkedPercent: lifeWorkedPercent,
    lifetime_worked_percent: lifeWorkedPercent,
    lifetimeUsedPercent: lifeWorkedPercent,
    lifetime_used_percent: lifeWorkedPercent,
  };
}

function buildReadingUsageSpecsJson(specs: Record<string, unknown>, usageMetric: 'hours' | 'km'): Record<string, unknown> {
  return {
    ...specs,
    usageMode: usageMetric,
    usage_mode: usageMetric,
    usageBasis: 'reading',
    usage_basis: 'reading',
  };
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
  const replacementPriceNotApplicable = assetReplacementPriceNotApplicable(kind, specs);
  const replacementPriceExVat = replacementPriceNotApplicable
    ? null
    : normalizeReplacementPriceExVat(input.replacementPriceExVat) ?? replacementPriceFromSpecs(specs);
  const hasIncomingInsuredValue = Object.prototype.hasOwnProperty.call(input, 'insuredValueExVat');
  const incomingInsuredValueExVat = normalizeInsuredValueExVat(input.insuredValueExVat);
  const insuredValueExVat = hasIncomingInsuredValue ? incomingInsuredValueExVat : insuredValueFromSpecs(specs);
  const insuranceStatus = readInsuranceStatusFromSpecs(
    specs,
    Boolean(input.isInsured) || insuredValueExVat !== null ? 'yes' : 'no',
  );
  const insuredValueForSave = insuranceStatus === 'yes' ? insuredValueExVat : null;
  const hasIncomingBrandName = Object.prototype.hasOwnProperty.call(input, 'brandName');
  const hasIncomingModelName = Object.prototype.hasOwnProperty.call(input, 'modelName');
  const brandName = hasIncomingBrandName
    ? asText(input.brandName)
    : asText(specs.brandName) || asText(specs.brand_name) || asText(specs.brand) || '';
  const modelName = hasIncomingModelName
    ? asText(input.modelName)
    : asText(specs.modelName) || asText(specs.model_name) || asText(specs.model) || asText(specs.typedModelName) || asText(specs.typed_model_name) || '';
  const hasIncomingYearModel = Object.prototype.hasOwnProperty.call(input, 'yearModel');
  const incomingYearModelUnknown = hasIncomingYearModel && (input.yearModel === null || typeof input.yearModel === 'undefined');
  const incomingYearModelSpecs = hasIncomingYearModel
    ? buildYearModelSpecsJson({}, input.yearModel ?? null, incomingYearModelUnknown)
    : {};
  const hasUsageReading = Object.prototype.hasOwnProperty.call(input, 'hours')
    ? asNumber(input.hours) !== null
    : asNumber(specs.usageAmount ?? specs.usage_amount ?? specs.hours ?? specs.engine_hours) !== null;
  const usageBasisSpecs = lifeWorkedPercent !== null && !hasUsageReading
    ? buildPercentUsageSpecsJson({}, lifeWorkedPercent)
    : buildReadingUsageSpecsJson({}, usageMetric);

  if (insuredValueForSave === null) {
    for (const key of INSURED_VALUE_SPEC_KEYS) {
      delete specs[key];
    }
  }

  if (replacementPriceNotApplicable) {
    for (const key of REPLACEMENT_PRICE_SPEC_KEYS) {
      delete specs[key];
    }
  }

  if (hasIncomingBrandName && !brandName) {
    delete specs.brandName;
    delete specs.brand_name;
    delete specs.brand;
  }

  if (hasIncomingModelName && !modelName) {
    delete specs.modelName;
    delete specs.model_name;
    delete specs.model;
    delete specs.typedModelName;
    delete specs.typed_model_name;
  }
  return {
    ...specs,
    insuranceStatus,
    insurance_status: insuranceStatus,
    insuredStatus: insuranceStatus,
    insured_status: insuranceStatus,
    ...(lifeWorkedPercent !== null
      ? {
          life_worked_percent: lifeWorkedPercent,
          worked_percent: lifeWorkedPercent,
          percent_worked: lifeWorkedPercent,
          lifetime_worked_percent: lifeWorkedPercent,
        }
      : {}),
    ...(brandName
      ? {
          brandName,
          brand_name: brandName,
          brand: brandName,
        }
      : {}),
    ...(modelName
      ? {
          modelName,
          model_name: modelName,
          model: modelName,
          typedModelName: modelName,
          typed_model_name: modelName,
        }
      : {}),
    ...(insuredValueForSave !== null
      ? {
          insuredValueExVat: insuredValueForSave,
          insured_value_ex_vat: insuredValueForSave,
          insuranceValueExVat: insuredValueForSave,
          insurance_value_ex_vat: insuredValueForSave,
          insuredValue: insuredValueForSave,
          insured_value: insuredValueForSave,
          insuranceValue: insuredValueForSave,
          insurance_value: insuredValueForSave,
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
      : replacementPriceNotApplicable
        ? {
            replacementPriceNotApplicable: true,
            replacement_price_not_applicable: true,
            replacementPriceBasis: 'not_applicable',
            replacement_price_basis: 'not_applicable',
          }
        : {}),
    usageMetric,
    usage_metric: usageMetric,
    usage_unit: usageMetric,
    ...usageBasisSpecs,
    ...(specs.basic_catalogue_release ? { basic_usage_basis: usageBasisSpecs.usage_basis } : {}),
    ...incomingYearModelSpecs,
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

function buildAssetNameSpecs(
  specs: Record<string, unknown>,
  brandName: string,
  modelName: string,
): Record<string, unknown> {
  const nextSpecs = { ...specs };
  const cleanBrandName = asText(brandName);
  const cleanModelName = asText(modelName);

  for (const key of ['brandName', 'brand_name', 'brand']) {
    if (cleanBrandName) {
      nextSpecs[key] = cleanBrandName;
    } else {
      delete nextSpecs[key];
    }
  }

  for (const key of [
    'modelName',
    'model_name',
    'model',
    'typedModelName',
    'typed_model_name',
  ]) {
    if (cleanModelName) {
      nextSpecs[key] = cleanModelName;
    } else {
      delete nextSpecs[key];
    }
  }

  return nextSpecs;
}

function buildAssetFlagSpecs(
  specs: Record<string, unknown>,
  isFlagged: boolean,
  timestampIso = new Date().toISOString(),
): Record<string, unknown> {
  const nextSpecs = { ...specs };

  nextSpecs.assetFlagged = isFlagged;
  nextSpecs.asset_flagged = isFlagged;
  nextSpecs.flagged = isFlagged;

  if (isFlagged) {
    nextSpecs.assetFlaggedAt = timestampIso;
    nextSpecs.asset_flagged_at = timestampIso;
    nextSpecs.assetFlagUpdatedAt = timestampIso;
    nextSpecs.asset_flag_updated_at = timestampIso;
  } else {
    delete nextSpecs.assetFlaggedAt;
    delete nextSpecs.asset_flagged_at;
    delete nextSpecs.assetFlagUpdatedAt;
    delete nextSpecs.asset_flag_updated_at;
  }

  return nextSpecs;
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
    yearModelUnknown?: boolean | null;
    yearModel?: number | null;
    now: Date;
  },
): Record<string, unknown> {
  const merged = buildYearModelSpecsJson(
    stripValuationMetadata({
      ...valuationSpecs,
      ...existingSpecs,
    }),
    context.yearModel ?? null,
    Boolean(context.yearModelUnknown),
  );
  const latestSaleabilityInputs = isRecord(valuationSpecs.aim4priceSaleabilityInputs)
    ? valuationSpecs.aim4priceSaleabilityInputs
    : null;

  return {
    ...merged,
    ...(latestSaleabilityInputs ? { aim4priceSaleabilityInputs: latestSaleabilityInputs } : {}),
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
    yearModelUnknown: Boolean(context.yearModelUnknown),
    year_model_unknown: Boolean(context.yearModelUnknown),
  };
}

function withSaleabilityValuationInputs(
  specs: Record<string, unknown>,
  advancedAssumptions: Result['advancedAssumptions'] | GenericValuationResult['advancedAssumptions'],
): Record<string, unknown> {
  if (!advancedAssumptions) return specs;

  const conditionFactorPercent = advancedAssumptions.dealerAssessment?.conditionFactorPercent
    ?? advancedAssumptions.conditionFactorPercent
    ?? null;

  return {
    ...specs,
    aim4priceSaleabilityInputs: {
      version: 1,
      conditionFactorPercent,
      popularityStars: advancedAssumptions.popularityStars ?? null,
      detailedCondition: Boolean(advancedAssumptions.dealerAssessment),
    },
  };
}

function getGenericAssetRegisterKind(result: GenericValuationResult): AssetRegisterItemKind {
  return result.sector.key === 'motor' || result.family.usageMetricType === 'km' ? 'vehicle' : 'equipment';
}

function genericValuationResultUsesUsageReading(result: GenericValuationResult): boolean {
  return asNumber(result.usageAmount) !== null || result.depreciationMethodUsed === 'full_depreciation';
}

function isGenericYearModelUnknown(result: GenericValuationResult): boolean {
  return Boolean(result.yearModelUnknown ?? result.specsJson?.year_model_unknown ?? result.specsJson?.yearModelUnknown);
}

function genericValuationResultUsesPercentBasis(result: GenericValuationResult): boolean {
  return (
    result.family.usageMetricType === 'wear_class' ||
    result.depreciationMethodUsed === 'percentage_depreciation' ||
    (asNumber(result.usageAmount) === null && asNumber(result.lifeWorkedPercent) !== null)
  );
}

function withGenericUsageMetadata(
  specs: Record<string, unknown>,
  result: GenericValuationResult,
): Record<string, unknown> {
  const usageMetric = result.family.usageMetricType === 'km' || (!result.specsJson.basic_catalogue_release && result.sector.key === 'motor') ? 'km' : 'hours';
  const lifeWorkedPercent = asNumber(result.lifeWorkedPercent);
  const usageSpecs = genericValuationResultUsesPercentBasis(result) && lifeWorkedPercent !== null
    ? buildPercentUsageSpecsJson({}, lifeWorkedPercent)
    : buildReadingUsageSpecsJson({}, usageMetric);

  return {
    ...specs,
    ...usageSpecs,
    usageMetric,
    usage_metric: usageMetric,
    usageUnit: usageMetric,
    usage_unit: usageMetric,
    usageMetricType: result.family.usageMetricType,
    usage_metric_type: result.family.usageMetricType,
    depreciationMethodUsed: result.depreciationMethodUsed,
    depreciation_method_used: result.depreciationMethodUsed,
    sectorKey: result.sector.key,
    sector_key: result.sector.key,
    familyKey: result.family.key,
    family_key: result.family.key,
  };
}


const RETIRED_MARKET_VALUATION_SPEC_KEYS = [
  'marketValueMode',
  'market_value_mode',
  'marketValueIsAim4priceDelta',
  'market_value_is_aim4price_delta',
  'marketAim4priceDeltaExVat',
  'market_aim4price_delta_ex_vat',
  'marketAdjustmentExVat',
  'market_adjustment_ex_vat',
  'marketAdjustmentBaseAim4priceExVat',
  'market_adjustment_base_aim4price_ex_vat',
  'marketAdjustmentBaseMarketExVat',
  'market_adjustment_base_market_ex_vat',
  'marketAdjustmentRawMarketExVat',
  'market_adjustment_raw_market_ex_vat',
];

function stripMarketValuationSpecs(specs: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...specs };
  for (const key of RETIRED_MARKET_VALUATION_SPEC_KEYS) {
    delete cleaned[key];
  }
  return cleaned;
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
    reasons.push('year model changed');
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

function buildSavedRevaluationLogMetadata(input: {
  existing: AssetRegisterItem;
  selectedValueExVat: number;
  staleReasons: string[];
  valuationRunId: number;
  selectedMethod: string;
  saveReplacementPrice?: boolean;
}): Record<string, unknown> {
  const valueChanged =
    hasValueChanged(input.existing.value, input.selectedValueExVat) ||
    hasValueChanged(input.existing.selectedValueExVat, input.selectedValueExVat);
  const reasons = input.staleReasons.length > 0
    ? [...input.staleReasons]
    : valueChanged
      ? ['year lapse']
      : ['valuation checked'];

  if (!valueChanged && !reasons.some((reason) => reason.toLowerCase().includes('staged depreciation'))) {
    reasons.push('staged depreciation / value unchanged');
  }

  return {
    valuationRunId: input.valuationRunId,
    selectedMethod: input.selectedMethod,
    saveReplacementPrice: input.saveReplacementPrice === true,
    valuationRelevantReasons: reasons,
    logEventReasons: reasons,
    timelineEventReasons: reasons,
    valueChanged,
    stagedDepreciation: !valueChanged,
    oldValueExVat: Math.round(Number(input.existing.value) || 0),
    newValueExVat: Math.round(Number(input.selectedValueExVat) || 0),
  };
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

function asPositiveIntegerId(value: unknown): number | null {
  const numeric = asNumber(value);
  return numeric !== null && Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function getGenericEquipmentModelId(result: GenericValuationResult): number | null {
  return (
    asPositiveIntegerId(result.specsJson.catalog_model_id) ??
    asPositiveIntegerId(result.specsJson.equipment_model_id) ??
    asPositiveIntegerId(result.specsJson.equipmentModelId) ??
    null
  );
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
  const value = numberFromRecord(specs, [
    'max_lifetime_hours',
    'expected_lifetime_hours',
    'lifetime_hours',
    'design_life_hours',
    'useful_life_hours',
    'max_lifetime_km',
    'expected_lifetime_km',
    'lifetime_km',
    'design_life_km',
    'useful_life_km',
  ]);
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

function assetReplacementPriceNotApplicable(
  kind: AssetRegisterItemKind,
  specs: Record<string, unknown>,
): boolean {
  const explicitFlag = String(
    specs.replacementPriceNotApplicable ?? specs.replacement_price_not_applicable ?? '',
  ).trim().toLowerCase();
  const propertySubtype = asText(
    specs.propertyAssetSubtype ?? specs.property_asset_subtype,
  ).toLowerCase();

  return explicitFlag === 'true' || kind === 'stock' || (kind === 'property' && propertySubtype === 'land');
}

function normalizeReplacementPriceExVat(value: unknown): number | null {
  const numeric = asNumber(value);
  return numeric !== null && numeric > 0 ? Math.round(numeric) : null;
}

function replacementPriceFromSpecs(specs: Record<string, unknown>): number | null {
  return normalizeReplacementPriceExVat(numberFromRecord(specs, [...REPLACEMENT_PRICE_SPEC_KEYS]));
}

const INSURED_VALUE_SPEC_KEYS = [
  'insuredValueExVat',
  'insured_value_ex_vat',
  'insuranceValueExVat',
  'insurance_value_ex_vat',
  'insuredValue',
  'insured_value',
  'insuranceValue',
  'insurance_value',
] as const;

function normalizeInsuredValueExVat(value: unknown): number | null {
  const numeric = asNumber(value);
  return numeric !== null && numeric > 0 ? Math.round(numeric) : null;
}

function insuredValueFromSpecs(specs: Record<string, unknown>): number | null {
  return normalizeInsuredValueExVat(numberFromRecord(specs, [...INSURED_VALUE_SPEC_KEYS]));
}

function roundFiniteNumber(value: unknown): number | null {
  const numeric = asNumber(value);
  return numeric === null ? null : Math.round(numeric);
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
          category: 'other',
          documentType: 'other',
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
          category: normalizeAssetDocumentCategory(entry.category ?? entry.documentCategory),
          documentType: normalizeAssetDocumentType(entry.documentType ?? entry.type),
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
  if (normalized === 'stock' || normalized === 'inventory') return 'stock';
  return 'manual';
}

function normalizeMethod(value: unknown): AssetRegisterItemMethod {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'market') return 'aim4price';
  return normalized === 'aim4price' || normalized === 'manual' ? normalized : 'manual';
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

function normalizeConditionForDb(value: unknown): ConditionKey | null {
  const normalized = normalizeCondition(value);
  return normalized || null;
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
  const savedSpecs = isRecord(row.specs_json) ? row.specs_json : {};
  const specsJson: Record<string, unknown> = { ...savedSpecs, usageMetricType: savedSpecs.usageMetricType ?? savedSpecs.usage_metric_type ?? row.family_usage_metric_type };
  const replacementPriceExVat =
    normalizeReplacementPriceExVat(row.replacement_price_used_ex_vat) ??
    normalizeReplacementPriceExVat(row.user_replacement_price_ex_vat) ??
    replacementPriceFromSpecs(specsJson);
  const lifeWorkedPercent = asNumber(row.life_worked_percent) ?? percentFromSpecs(specsJson);
  const insuredValueExVat = normalizeInsuredValueExVat(row.insured_value_ex_vat) ?? insuredValueFromSpecs(specsJson);
  const rawBrandName =
    readFirstKnownText(specsJson, GENERIC_MANUAL_BRAND_SPEC_KEYS) ||
    readFirstCleanText(specsJson, ['brandName', 'brand_name', 'brand']) ||
    asText(row.brand_name);
  const brandName = rawBrandName ? normalizeUnknownAssetPart(rawBrandName) : '';
  const rawModelName =
    readFirstCleanText(specsJson, GENERIC_MODEL_SPEC_KEYS) ||
    asText(row.model_name);
  const modelName = rawModelName ? normalizeUnknownAssetPart(stripLeadingBrandFromModel(rawModelName, brandName)) : '';
  const estimatedHours = asNumber(row.estimated_hours) ?? hoursFromSpecs(specsJson);
  const maxLifetimeHours = asNumber(row.max_lifetime_hours) ?? lifetimeHoursFromSpecs(specsJson);

  return {
    id: asIdText(row.id),
    userId: asText(row.user_id),
    registerId: asText(row.register_id) || null,
    valuationRunId: asNumber(row.valuation_run_id),
    sectorId: asNumber(row.sector_id),
    equipmentFamilyId: asNumber(row.equipment_family_id),
    equipmentFamilyKey: asText(row.equipment_family_key),
    equipmentFamilyLabel: asText(row.equipment_family_label) || asText(specsJson.basic_family_label),
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
    title: assetDisplayTitle({ title: row.title, modelName, familyLabel: row.equipment_family_label, specsJson }),
    value: Math.round(asNumber(row.value) ?? selectedValueExVat),
    selectedMethod: normalizeMethod(row.selected_method),
    selectedValueExVat,
    replacementPriceExVat,
    brandName,
    modelName,
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
    isInsured: Boolean(row.is_insured) || insuredValueExVat !== null,
    insuredValueExVat,
    isLicensed: Boolean(row.is_licensed),
    licenseRegistrationNumber: normalizeLicenseRegistrationNumber(row.license_registration_number) || readLicenseRegistrationFromSpecs(specsJson),
    financeNote: asText(row.finance_note),
    sellerPhone: asText(row.seller_phone),
    marketplaceNotes: asText(row.marketplace_notes),
    marketplaceStatus: asText(row.marketplace_status) || 'draft',
    marketplacePriceExVat: asNumber(row.marketplace_price_ex_vat),
    marketplaceSellerName: asText(row.marketplace_seller_name),
    marketplaceSellerCompany: asText(row.marketplace_seller_company),
    marketplaceSellerEmail: asText(row.marketplace_seller_email),
    marketplaceProvince: asText(row.marketplace_province),
    marketplaceArea: asText(row.marketplace_area),
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
  await ensureAssetRegisterTables();
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
  const registerIdColumn = resolveColumn(schema, 'register_id');
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
  const insuredValueColumn = resolveColumn(schema, 'insured_value_ex_vat', 'insurance_value_ex_vat', 'insured_value', 'insurance_value');
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
  const marketplacePriceColumn = resolveColumn(schema, 'marketplace_price_ex_vat', 'listing_price_ex_vat', 'asking_price_ex_vat');
  const marketplaceSellerNameColumn = resolveColumn(schema, 'marketplace_seller_name', 'listing_seller_name');
  const marketplaceSellerCompanyColumn = resolveColumn(schema, 'marketplace_seller_company', 'listing_seller_company');
  const marketplaceSellerEmailColumn = resolveColumn(schema, 'marketplace_seller_email', 'listing_seller_email');
  const marketplaceProvinceColumn = resolveColumn(schema, 'marketplace_province', 'listing_province');
  const marketplaceAreaColumn = resolveColumn(schema, 'marketplace_area', 'listing_area', 'marketplace_location', 'listing_location');
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
    registerIdColumn ? `${registerIdColumn} as register_id` : 'null::uuid as register_id',
    valuationRunIdColumn ? `${valuationRunIdColumn} as valuation_run_id` : 'null::bigint as valuation_run_id',
    sectorIdColumn ? `${sectorIdColumn} as sector_id` : 'null::bigint as sector_id',
    `${equipmentFamilyIdExpression} as equipment_family_id`,
    `(select ef.family_key from public.equipment_families ef where ef.id = ${equipmentFamilyIdExpression} limit 1) as equipment_family_key`,
    `(select ef.family_label from public.equipment_families ef where ef.id = ${equipmentFamilyIdExpression} limit 1) as equipment_family_label`,
    `(select ef.usage_metric_type from public.equipment_families ef where ef.id = ${equipmentFamilyIdExpression} limit 1) as family_usage_metric_type`,
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
    insuredValueColumn ? `${insuredValueColumn} as insured_value_ex_vat` : 'null::numeric as insured_value_ex_vat',
    licensedColumn ? `${licensedColumn} as is_licensed` : 'false as is_licensed',
    licenseRegistrationNumberColumn ? `${licenseRegistrationNumberColumn} as license_registration_number` : 'null::text as license_registration_number',
    financeNoteColumn ? `${financeNoteColumn} as finance_note` : 'null::text as finance_note',
    sellerPhoneColumn ? `${sellerPhoneColumn} as seller_phone` : 'null::text as seller_phone',
    marketplaceNotesColumn ? `${marketplaceNotesColumn} as marketplace_notes` : 'null::text as marketplace_notes',
    marketplaceStatusColumn ? `${marketplaceStatusColumn} as marketplace_status` : `'draft'::text as marketplace_status`,
    marketplacePriceColumn ? `${marketplacePriceColumn} as marketplace_price_ex_vat` : 'null::numeric as marketplace_price_ex_vat',
    marketplaceSellerNameColumn ? `${marketplaceSellerNameColumn} as marketplace_seller_name` : 'null::text as marketplace_seller_name',
    marketplaceSellerCompanyColumn ? `${marketplaceSellerCompanyColumn} as marketplace_seller_company` : 'null::text as marketplace_seller_company',
    marketplaceSellerEmailColumn ? `${marketplaceSellerEmailColumn} as marketplace_seller_email` : 'null::text as marketplace_seller_email',
    marketplaceProvinceColumn ? `${marketplaceProvinceColumn} as marketplace_province` : 'null::text as marketplace_province',
    marketplaceAreaColumn ? `${marketplaceAreaColumn} as marketplace_area` : 'null::text as marketplace_area',
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
  registerId?: string | null;
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

  if (column === 'register_id') {
    return context.registerId ? buildFieldFromMeta(meta, context.registerId) : null;
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

  if (column === 'marketplace_price_ex_vat' || column === 'listing_price_ex_vat' || column === 'asking_price_ex_vat') {
    return buildFieldFromMeta(meta, 0);
  }

  if (
    column === 'marketplace_seller_name' ||
    column === 'listing_seller_name' ||
    column === 'marketplace_seller_company' ||
    column === 'listing_seller_company' ||
    column === 'marketplace_seller_email' ||
    column === 'listing_seller_email' ||
    column === 'marketplace_province' ||
    column === 'listing_province' ||
    column === 'marketplace_area' ||
    column === 'listing_area' ||
    column === 'marketplace_location' ||
    column === 'listing_location'
  ) {
    return buildFieldFromMeta(meta, '');
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
    'replacement_price_used_ex_vat',
    'replacement_price_ex_vat',
    'official_replacement_price_ex_vat',
    'user_replacement_price_ex_vat',
    'user_replacement_price_year',
    'replacement_price_basis',
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

export async function getAssetRegisterItemsByRefs(
  refs: Array<{ userId: string; assetId: string }>,
): Promise<AssetRegisterItem[]> {
  if (!refs.length) return [];

  const uniqueRefs = Array.from(
    new Map(
      refs
        .map((ref) => ({
          userId: asText(ref.userId),
          assetId: asText(ref.assetId),
        }))
        .filter((ref) => ref.userId && ref.assetId)
        .map((ref) => [`${ref.userId}:${ref.assetId}`, ref]),
    ).values(),
  );
  if (!uniqueRefs.length) return [];

  const db = getDb();
  const schema = await getAssetRegisterSchema();
  const result = await db.query<AssetRegisterRow>(
    `
      select
        ${buildSelectList(schema)}
      from asset_register_items
      where (user_id::text, id) in (
        select requested.user_id, requested.asset_id
        from unnest($1::text[], $2::uuid[]) as requested(user_id, asset_id)
      )
    `,
    [
      uniqueRefs.map((ref) => ref.userId),
      uniqueRefs.map((ref) => ref.assetId),
    ],
  );

  return result.rows.map(mapAssetRegisterRow);
}

export async function listAssetRegisterItems(userId: string, registerId?: string | null): Promise<AssetRegisterItem[]> {
  const db = getDb();
  const activeRegister = registerId
    ? await getAssetRegisterForUser(userId, registerId)
    : await getSelectedAssetRegister(userId);

  if (!activeRegister) {
    throw new Error('ASSET_REGISTER_NOT_FOUND');
  }

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
      where user_id = $1 and register_id = $2::uuid
        ${schema.columnNames.has('lifecycle_state') ? "and coalesce(lifecycle_state, 'active') = 'active'" : ''}
      order by ${primaryOrderExpression} desc nulls last${secondaryOrderClause}, id desc
    `,
    [userId, activeRegister.id],
  );

  return result.rows.map(mapAssetRegisterRow);
}

export async function createManualAssetRegisterItem(
  userId: string,
  input: CreateManualAssetInput,
): Promise<AssetRegisterItem> {
  const db = getDb();
  const activeRegister = input.registerId
    ? await getAssetRegisterForUser(userId, input.registerId)
    : await getSelectedAssetRegister(userId);

  if (!activeRegister) {
    throw new Error('ASSET_REGISTER_NOT_FOUND');
  }

  const schema = await getAssetRegisterSchema();
  const now = new Date();
  const nextKind = normalizeKind(input.kind);
  const nextValue = Math.round(Number(input.value) || 0);
  const nextReplacementPriceExVat = normalizeReplacementPriceExVat(input.replacementPriceExVat);
  const incomingSpecsJson = isRecord(input.specsJson) ? input.specsJson : {};
  const replacementPriceNotApplicable = assetReplacementPriceNotApplicable(nextKind, incomingSpecsJson);
  const nextIsInsured = Boolean(input.isInsured);
  const nextInsuredValueExVat = nextIsInsured ? normalizeInsuredValueExVat(input.insuredValueExVat) : null;

  if (nextReplacementPriceExVat === null && !replacementPriceNotApplicable) {
    throw new Error('REPLACEMENT_PRICE_REQUIRED');
  }

  const nextSpecsJson = buildManualSpecsJson(input, nextKind);
  const nextLicenseRegistrationNumber = Boolean(input.isLicensed) ? normalizeLicenseRegistrationNumber(input.licenseRegistrationNumber) : null;
  const nextLifeWorkedPercent = percentFromSpecs(nextSpecsJson);
  const fields: SqlField[] = [];

  pushField(fields, schema, ['user_id'], userId);
  pushField(fields, schema, ['register_id'], activeRegister.id);
  pushField(fields, schema, ['valuation_run_id', 'run_id'], null);
  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], nextKind);
  pushField(fields, schema, ['title', 'name', 'asset_name'], asText(input.title));
  pushField(fields, schema, ['brand_name', 'brand'], asText(input.brandName) || null);
  pushField(fields, schema, ['model_name', 'model'], asText(input.modelName) || null);
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
  pushField(fields, schema, ['is_insured', 'insured'], nextIsInsured);
  pushField(fields, schema, ['insured_value_ex_vat', 'insurance_value_ex_vat', 'insured_value', 'insurance_value'], nextInsuredValueExVat);
  pushField(fields, schema, ['is_licensed', 'licensed', 'licenced'], Boolean(input.isLicensed));
  pushField(fields, schema, ['license_registration_number', 'licence_registration_number', 'registration_number', 'number_plate', 'numberplate'], nextLicenseRegistrationNumber);
  pushField(fields, schema, ['finance_note', 'finance_notes', 'finance_status'], asText(input.financeNote) || null);
  pushField(fields, schema, ['year_model', 'year'], input.yearModel === null || input.yearModel === undefined ? null : Math.max(0, Math.round(input.yearModel)));
  pushField(fields, schema, ['specs_json'], nextSpecsJson, '::jsonb');
  pushField(fields, schema, ['life_worked_percent'], nextLifeWorkedPercent);
  pushField(fields, schema, ['life_remaining_percent'], nextLifeWorkedPercent === null ? null : Math.max(0, 100 - nextLifeWorkedPercent));
  pushField(fields, schema, ['hours', 'engine_hours'], input.hours === null || input.hours === undefined ? null : Math.max(0, Math.round(input.hours)));
  pushField(fields, schema, ['condition'], normalizeConditionForDb(input.condition));
  pushPhotoField(fields, schema, input.photos ?? []);
  pushDocumentField(fields, schema, input.documents ?? []);
  pushField(fields, schema, ['created_at', 'createdon', 'created'], now);
  pushField(fields, schema, ['updated_at', 'modified_at', 'updatedon'], now);
  ensureRequiredFields(fields, schema, {
    userId,
    registerId: activeRegister.id,
    valuationRunId: null,
    title: asText(input.title),
    brandName: asText(input.brandName) || null,
    modelName: asText(input.modelName) || null,
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

  const item = mapAssetRegisterRow(row);
  await captureAssetDepreciationLogEntry({
    asset: item,
    eventType: 'manual_asset_created',
    eventSource: 'asset-register-manual-create',
    metadata: {
      registerId: activeRegister.id,
      reason: 'Opening value',
    },
  });

  return item;
}


export async function updateAssetRegisterItemNames(
  userId: string,
  input: UpdateAssetRegisterItemNamesInput,
): Promise<AssetRegisterItem> {
  const db = getDb();
  const schema = await getAssetRegisterSchema();
  const existing = await getAssetRegisterItemById(userId, input.assetId);

  if (!existing) {
    throw new Error('ASSET_NOT_FOUND');
  }

  if (asText(existing.registerId) !== asText(input.registerId)) {
    throw new Error('ASSET_REGISTER_MISMATCH');
  }

  const nextTitle = asText(input.title) || existing.title;
  const nextBrandName = asText(input.brandName) || existing.brandName;
  const nextModelName = asText(input.modelName) || existing.modelName;
  const nextSpecsJson = buildAssetNameSpecs(
    existing.specsJson ?? {},
    nextBrandName,
    nextModelName,
  );
  const fields: SqlField[] = [];
  const now = new Date();

  pushField(fields, schema, ['title', 'name', 'asset_name'], nextTitle);
  pushField(fields, schema, ['brand_name', 'brand'], nextBrandName || null);
  pushField(fields, schema, ['model_name', 'model'], nextModelName || null);
  pushField(fields, schema, ['specs_json'], nextSpecsJson, '::jsonb');
  pushField(fields, schema, ['updated_at', 'modified_at', 'updatedon'], now);

  if (!fields.length) {
    return {
      ...existing,
      title: nextTitle,
      brandName: nextBrandName,
      modelName: nextModelName,
      specsJson: nextSpecsJson,
      updatedAtIso: now.toISOString(),
    };
  }

  const update = buildUpdateSetClause(fields);
  const registerPlaceholder = `$${update.values.length + 3}`;
  const result = await db.query<AssetRegisterRow>(
    `
      update asset_register_items
      set
        ${update.clause}
      where user_id = $1
        and id = $2
        and register_id::text = ${registerPlaceholder}
      returning
        ${buildSelectList(schema)}
    `,
    [userId, input.assetId, ...update.values, asText(input.registerId)],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('ASSET_UPDATE_FAILED');
  }

  return mapAssetRegisterRow(row);
}


export async function updateAssetRegisterItemMedia(
  userId: string,
  input: {
    assetId: string;
    photos?: string[];
    documents?: AssetRegisterDocument[];
  },
): Promise<AssetRegisterItem> {
  const db = getDb();
  const schema = await getAssetRegisterSchema();
  const existing = await getAssetRegisterItemById(userId, input.assetId);

  if (!existing) {
    throw new Error('ASSET_NOT_FOUND');
  }

  const fields: SqlField[] = [];
  const now = new Date();

  pushPhotoField(fields, schema, input.photos ?? existing.photos);
  pushDocumentField(fields, schema, input.documents ?? existing.documents);
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

export async function updateAssetRegisterItemFlag(
  userId: string,
  input: {
    assetId: string;
    isFlagged: boolean;
  },
): Promise<AssetRegisterItem> {
  const db = getDb();
  const schema = await getAssetRegisterSchema();
  const existing = await getAssetRegisterItemById(userId, input.assetId);

  if (!existing) {
    throw new Error('ASSET_NOT_FOUND');
  }

  const fields: SqlField[] = [];
  const nextSpecsJson = buildAssetFlagSpecs(existing.specsJson ?? {}, input.isFlagged);

  pushField(fields, schema, ['specs_json'], nextSpecsJson, '::jsonb');

  if (!fields.length) {
    return {
      ...existing,
      specsJson: nextSpecsJson,
    };
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


export async function updateAssetRegisterItemYearModel(
  userId: string,
  input: UpdateAssetRegisterItemYearModelInput,
): Promise<AssetRegisterItem> {
  const db = getDb();
  const schema = await getAssetRegisterSchema();
  const existing = await getAssetRegisterItemById(userId, input.assetId);

  if (!existing) {
    throw new Error('ASSET_NOT_FOUND');
  }

  const now = new Date();
  const nextYearModel = normalizePersistedYearModel(input.yearModel);
  const nextSpecsBeforeStaleCheck = buildYearModelSpecsJson(
    existing.specsJson ?? {},
    nextYearModel,
    nextYearModel === null,
  );
  const staleReasons = buildValuationStaleReasons({
    existing,
    nextYearModel,
    nextHours: existing.hours,
    nextLifeWorkedPercent: existing.lifeWorkedPercent ?? percentFromSpecs(existing.specsJson),
    nextCondition: normalizeConditionForDb(existing.condition),
  });
  const nextSpecsJson = markValuationNeedsUpdate(nextSpecsBeforeStaleCheck, staleReasons, now);
  const fields: SqlField[] = [];

  pushField(fields, schema, ['year_model', 'year'], nextYearModel);
  pushField(fields, schema, ['specs_json'], nextSpecsJson, '::jsonb');
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
    [userId, input.assetId, ...update.values],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('ASSET_UPDATE_FAILED');
  }

  const item = mapAssetRegisterRow(row);
  await captureAssetDepreciationLogEntry({
    previousAsset: existing,
    asset: item,
    eventType: 'manual_asset_updated',
    eventSource: 'asset-register-year-model-update',
    metadata: {
      valuationNeedsUpdate: staleReasons.length > 0,
      valuationStaleReasons: staleReasons,
      valuationRelevantReasons: staleReasons,
      logEventReasons: staleReasons,
      timelineEventReasons: staleReasons,
      yearModel: nextYearModel,
      yearModelUnknown: nextYearModel === null,
    },
  });

  return item;
}



export async function updateAssetRegisterItemLocation(
  userId: string,
  input: UpdateAssetRegisterItemLocationInput,
): Promise<AssetRegisterItem> {
  const assetId = asText(input.assetId);
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);

  if (!assetId) {
    throw new Error('ASSET_ID_REQUIRED');
  }

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('INVALID_GPS_COORDINATES');
  }

  const gpsAccuracyMeters = input.gpsAccuracyMeters === null || typeof input.gpsAccuracyMeters === 'undefined'
    ? null
    : Number(input.gpsAccuracyMeters);

  if (gpsAccuracyMeters !== null && (!Number.isFinite(gpsAccuracyMeters) || gpsAccuracyMeters < 0)) {
    throw new Error('INVALID_GPS_ACCURACY');
  }

  const parsedClientCapturedAt = input.clientCapturedAt instanceof Date
    ? input.clientCapturedAt
    : input.clientCapturedAt
      ? new Date(input.clientCapturedAt)
      : null;
  const capturedAt = parsedClientCapturedAt && Number.isFinite(parsedClientCapturedAt.getTime())
    ? parsedClientCapturedAt
    : new Date();
  const locationText = normalizeAssetLocationText(input.locationText) || `GPS ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  const source = normalizeAssetLocationSource(input.source);
  const activityText = source === 'manual' ? 'GPS position manually updated' : 'GPS position updated';
  const eventNote = source === 'manual'
    ? 'GPS position updated manually from Asset Register Settings.'
    : 'GPS position updated from Asset Register Settings device GPS.';

  await ensureFuelLedgerTables();
  assetRegisterSchemaPromises.delete('asset_register_items');

  const db = getDb();
  const schema = await getAssetRegisterSchema();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query<AssetRegisterRow>(
      `
        update public.asset_register_items
        set
          last_scanned_at = $3::timestamptz,
          last_known_lat = $4::double precision,
          last_known_lng = $5::double precision,
          last_known_location_text = $6::text,
          updated_at = now()
        where user_id = $1 and id = $2
        returning
          ${buildSelectList(schema)}
      `,
      [userId, assetId, capturedAt, latitude, longitude, locationText],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error('ASSET_NOT_FOUND');
    }

    await client.query(
      `
        insert into public.asset_scan_events (
          asset_id,
          actor_type,
          operator_name,
          activity_text,
          work_area_text,
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
          created_at
        )
        values (
          $1::uuid,
          'owner_session',
          null,
          $7::text,
          null,
          null,
          null,
          null,
          $8::text,
          '[]'::jsonb,
          $2::double precision,
          $3::double precision,
          $4::text,
          null,
          $5::timestamptz,
          now(),
          $6::double precision,
          $5::timestamptz
        )
      `,
      [assetId, latitude, longitude, locationText, capturedAt, gpsAccuracyMeters, activityText, eventNote],
    );

    await client.query('COMMIT');

    return mapAssetRegisterRow(row);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}


export async function updateAssetRegisterItemStatusDetails(
  userId: string,
  input: UpdateAssetRegisterItemStatusDetailsInput,
): Promise<AssetRegisterItem> {
  const assetId = asText(input.assetId);

  if (!assetId) {
    throw new Error('ASSET_ID_REQUIRED');
  }

  const db = getDb();
  const schema = await getAssetRegisterSchema();
  const existing = await getAssetRegisterItemById(userId, assetId);

  if (!existing) {
    throw new Error('ASSET_NOT_FOUND');
  }

  const now = new Date();
  const nextSpecsJson = {
    ...(isRecord(existing.specsJson) ? existing.specsJson : {}),
    ...(isRecord(input.specsJson) ? input.specsJson : {}),
  };
  const licenseRenewalDateChanged =
    readLicenseRenewalDateFromSpecs(existing.specsJson) !== readLicenseRenewalDateFromSpecs(nextSpecsJson);
  const fields: SqlField[] = [];

  if (Object.prototype.hasOwnProperty.call(input, 'isFinanced')) {
    pushField(fields, schema, ['is_financed', 'financed'], Boolean(input.isFinanced));
  }

  if (Object.prototype.hasOwnProperty.call(input, 'financeNote')) {
    pushField(fields, schema, ['finance_note', 'finance_notes', 'finance_status'], asText(input.financeNote) || null);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'isInsured')) {
    pushField(fields, schema, ['is_insured', 'insured'], Boolean(input.isInsured));
  }

  if (Object.prototype.hasOwnProperty.call(input, 'insuredValueExVat')) {
    pushField(
      fields,
      schema,
      ['insured_value_ex_vat', 'insurance_value_ex_vat', 'insured_value', 'insurance_value'],
      normalizeInsuredValueExVat(input.insuredValueExVat),
    );
  }

  if (Object.prototype.hasOwnProperty.call(input, 'isLicensed')) {
    pushField(fields, schema, ['is_licensed', 'licensed', 'licenced'], Boolean(input.isLicensed));
  }

  if (Object.prototype.hasOwnProperty.call(input, 'licenseRegistrationNumber')) {
    pushField(
      fields,
      schema,
      ['license_registration_number', 'licence_registration_number', 'registration_number', 'number_plate', 'numberplate'],
      normalizeLicenseRegistrationNumber(input.licenseRegistrationNumber) || null,
    );
  }

  pushField(fields, schema, ['specs_json'], nextSpecsJson, '::jsonb');
  if (licenseRenewalDateChanged) {
    pushField(fields, schema, ['license_renewal_alert_noted_for_date'], null);
    pushField(fields, schema, ['license_renewal_alert_noted_at'], null);
  }
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
    [userId, assetId, ...update.values],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('ASSET_UPDATE_FAILED');
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
  const mergedReplacementSpecs = {
    ...(isRecord(existing.specsJson) ? existing.specsJson : {}),
    ...(isRecord(input.specsJson) ? input.specsJson : {}),
  };
  const replacementPriceNotApplicable = assetReplacementPriceNotApplicable(nextKind, mergedReplacementSpecs);
  const nextIsInsured = Boolean(input.isInsured);
  const nextInsuredValueExVat = nextIsInsured ? normalizeInsuredValueExVat(input.insuredValueExVat) : null;

  if (nextReplacementPriceExVat === null && !replacementPriceNotApplicable) {
    throw new Error('REPLACEMENT_PRICE_REQUIRED');
  }

  const incomingYearModel = input.yearModel === null || input.yearModel === undefined ? null : Math.max(0, Math.round(input.yearModel));
  const incomingHours = input.hours === null || input.hours === undefined ? null : Math.max(0, Math.round(input.hours));
  const nextYearModel = incomingYearModel;
  const nextHours = existing.valuationRunId && incomingHours === null ? existing.hours : incomingHours;
  const incomingCondition = normalizeConditionForDb(input.condition);
  const existingCondition = normalizeConditionForDb(existing.condition);
  const nextCondition = typeof input.condition === 'undefined' ? existingCondition : incomingCondition;
  const baseSpecsJson = buildManualSpecsJson(input, nextKind, existing.specsJson);
  const nextLicenseRegistrationNumber = Boolean(input.isLicensed) ? normalizeLicenseRegistrationNumber(input.licenseRegistrationNumber) : null;
  const existingLifeWorkedPercent = existing.lifeWorkedPercent ?? percentFromSpecs(existing.specsJson);
  const baseLifeWorkedPercent = percentFromSpecs(baseSpecsJson);
  const nextLifeWorkedPercent =
    baseLifeWorkedPercent !== null &&
    existingLifeWorkedPercent !== null &&
    baseLifeWorkedPercent < existingLifeWorkedPercent &&
    baseLifeWorkedPercent >= existingLifeWorkedPercent - LIFE_WORKED_PERCENT_DECREASE_TOLERANCE
      ? existingLifeWorkedPercent
      : baseLifeWorkedPercent ?? existingLifeWorkedPercent;
  const usagePreservedSpecsJson = nextLifeWorkedPercent === null
    ? baseSpecsJson
    : {
        ...baseSpecsJson,
        life_worked_percent: nextLifeWorkedPercent,
        worked_percent: nextLifeWorkedPercent,
        percent_worked: nextLifeWorkedPercent,
        lifetime_worked_percent: nextLifeWorkedPercent,
      };
  const fields: SqlField[] = [];

  if (!input.allowUsageDecrease && incomingHours !== null && existing.hours !== null && incomingHours < existing.hours) {
    throw new Error('USAGE_READING_CANNOT_DECREASE');
  }

  if (
    !input.allowUsageDecrease &&
    nextLifeWorkedPercent !== null &&
    existingLifeWorkedPercent !== null &&
    nextLifeWorkedPercent < existingLifeWorkedPercent - LIFE_WORKED_PERCENT_DECREASE_TOLERANCE
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
  const nextSpecsJson = markValuationNeedsUpdate(usagePreservedSpecsJson, staleReasons, now);
  const licenseRenewalDateChanged =
    readLicenseRenewalDateFromSpecs(existing.specsJson) !== readLicenseRenewalDateFromSpecs(nextSpecsJson);
  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], nextKind);
  pushField(fields, schema, ['title', 'name', 'asset_name'], asText(input.title));
  pushField(fields, schema, ['brand_name', 'brand'], asText(input.brandName) || null);
  pushField(fields, schema, ['model_name', 'model'], asText(input.modelName) || null);
  pushField(fields, schema, ['value', 'selected_value_ex_vat', 'selected_value', 'saved_value_ex_vat'], nextValue);
  pushField(fields, schema, ['selected_value_ex_vat', 'selected_value', 'value', 'saved_value_ex_vat'], nextValue);
  pushField(fields, schema, ['replacement_price_used_ex_vat', 'replacement_price_ex_vat', 'official_replacement_price_ex_vat'], nextReplacementPriceExVat);
  pushField(fields, schema, ['user_replacement_price_ex_vat'], nextReplacementPriceExVat);
  pushField(fields, schema, ['replacement_price_basis'], nextReplacementPriceExVat !== null ? 'user' : null);
  pushField(fields, schema, ['note', 'notes', 'description'], cleanAssetRegisterNote(input.note) || null);
  pushField(fields, schema, ['serial_number', 'serial', 'vin'], asText(input.serialNumber) || null);
  pushField(fields, schema, ['is_financed', 'financed'], Boolean(input.isFinanced));
  pushField(fields, schema, ['is_insured', 'insured'], nextIsInsured);
  pushField(fields, schema, ['insured_value_ex_vat', 'insurance_value_ex_vat', 'insured_value', 'insurance_value'], nextInsuredValueExVat);
  pushField(fields, schema, ['is_licensed', 'licensed', 'licenced'], Boolean(input.isLicensed));
  pushField(fields, schema, ['license_registration_number', 'licence_registration_number', 'registration_number', 'number_plate', 'numberplate'], nextLicenseRegistrationNumber);
  pushField(fields, schema, ['finance_note', 'finance_notes', 'finance_status'], asText(input.financeNote) || null);
  pushField(fields, schema, ['year_model', 'year'], nextYearModel);
  pushField(fields, schema, ['specs_json'], nextSpecsJson, '::jsonb');
  if (licenseRenewalDateChanged) {
    pushField(fields, schema, ['license_renewal_alert_noted_for_date'], null);
    pushField(fields, schema, ['license_renewal_alert_noted_at'], null);
  }
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

  const item = mapAssetRegisterRow(row);
  await captureAssetDepreciationLogEntry({
    previousAsset: existing,
    asset: item,
    eventType: 'manual_asset_updated',
    eventSource: 'asset-register-manual-update',
    metadata: {
      valuationNeedsUpdate: staleReasons.length > 0,
      valuationStaleReasons: staleReasons,
      valuationRelevantReasons: staleReasons,
      logEventReasons: staleReasons,
      timelineEventReasons: staleReasons,
    },
  });

  return item;
}


export async function updateAssetRegisterItemFromValuation(input: {
  userId: string;
  assetId: string;
  valuationRunId: number;
  result: Result;
  selectedMethod: MethodKey;
  selectedValueExVat: number;
  marketValueExVat?: number | null;
  marketAdjustmentDeltaExVat?: number | null;
  marketRawAverageExVat?: number | null;
  year: number;
  yearModelUnknown?: boolean | null;
  hours: number;
  condition: ConditionKey;
  saveReplacementPrice?: boolean;
  allowUsageDecrease?: boolean;
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
  const savedYearModel = input.yearModelUnknown ? null : Math.round(input.year);
  const assetIdentity = buildTractorAssetIdentity({
    result: input.result,
    yearModel: savedYearModel,
    yearModelUnknown: input.yearModelUnknown,
  });
  const marketValueExVat: number | null = null;
  const replacementPriceUsedExVat = normalizeReplacementPriceExVat(input.result.replacementPriceUsedExVat);
  const userReplacementPriceExVat = normalizeReplacementPriceExVat(input.result.userReplacementPriceExVat);

  if (replacementPriceUsedExVat === null) {
    throw new Error('REPLACEMENT_PRICE_REQUIRED');
  }

  if (
    input.allowUsageDecrease !== true &&
    existing.hours !== null &&
    Math.max(0, Math.round(input.hours)) < existing.hours
  ) {
    throw new Error('USAGE_READING_CANNOT_DECREASE');
  }

  const fields: SqlField[] = [];
  const valuationSpecsJson = isRecord(valuationRow.specs_json) ? valuationRow.specs_json : {};

  copySharedFieldsFromValuationRun(fields, schema, valuationSchema, valuationRow);

  pushField(fields, schema, ['valuation_run_id', 'run_id'], input.valuationRunId);
  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], 'tractor');
  pushField(fields, schema, ['title', 'name', 'asset_name'], assetIdentity.title);
  pushField(fields, schema, ['value', 'selected_value_ex_vat', 'selected_value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['selected_method', 'method', 'valuation_method'], input.selectedMethod);
  pushField(fields, schema, ['selected_value_ex_vat', 'selected_value', 'value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['source_type', 'source', 'origin', 'entry_source'], 'valuation');
  pushField(fields, schema, ['brand_name', 'brand'], assetIdentity.brandName);
  pushField(fields, schema, ['model_name', 'model'], assetIdentity.modelName);
  pushField(fields, schema, ['drive_type', 'drive', 'drivetrain'], model.drive);
  pushField(fields, schema, ['tractor_type', 'tractor_category'], model.tractorType);
  pushField(fields, schema, ['cab_type', 'cab'], model.cab);
  pushField(fields, schema, ['power_kw', 'kw', 'power'], model.powerKw);
  pushField(fields, schema, ['year_model', 'year'], savedYearModel);
  pushField(fields, schema, ['hours', 'engine_hours'], Math.max(0, Math.round(input.hours)));
  pushField(fields, schema, ['condition'], normalizeConditionForDb(input.condition));
  pushField(fields, schema, ['estimated_hours'], Math.max(0, Math.round(input.hours)));
  pushField(fields, schema, ['max_lifetime_hours'], input.result.maxLifetimeHours);
  pushField(fields, schema, ['aim4price_value_ex_vat', 'aim4price_value'], toRoundedNumber(input.result.aim4priceValueExVat));
  pushField(fields, schema, ['market_mid_ex_vat', 'market_value_ex_vat', 'market_value'], marketValueExVat);
  if (input.saveReplacementPrice === true) {
    pushField(fields, schema, ['replacement_price_used_ex_vat', 'replacement_price_ex_vat', 'official_replacement_price_ex_vat'], replacementPriceUsedExVat);
    pushField(fields, schema, ['user_replacement_price_ex_vat'], userReplacementPriceExVat);
    pushField(fields, schema, ['replacement_price_basis'], input.result.replacementPriceBasis);
  }
  pushField(
    fields,
    schema,
    ['specs_json'],
    stripMarketValuationSpecs(
      withPersistedAssetIdentitySpecs(
        buildCurrentValuationSpecs(existing.specsJson, withSaleabilityValuationInputs(valuationSpecsJson, input.result.advancedAssumptions), {
          valuationRunId: input.valuationRunId,
          selectedValueExVat,
          hours: input.hours,
          lifeWorkedPercent: null,
          condition: input.condition,
          yearModelUnknown: input.yearModelUnknown,
          yearModel: savedYearModel,
          now,
        }),
        assetIdentity,
      ),
    ),
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

  const item = mapAssetRegisterRow(row);
  await captureAssetDepreciationLogEntry({
    previousAsset: existing,
    asset: item,
    eventType: 'automatic_revaluation_saved',
    eventSource: 'asset-register-revalue-tractor',
    metadata: buildSavedRevaluationLogMetadata({
      existing,
      selectedValueExVat,
      staleReasons: buildValuationStaleReasons({
        existing,
        nextYearModel: savedYearModel,
        nextHours: input.hours,
        nextLifeWorkedPercent: existing.lifeWorkedPercent ?? percentFromSpecs(existing.specsJson),
        nextCondition: input.condition,
      }),
      valuationRunId: input.valuationRunId,
      selectedMethod: input.selectedMethod,
      saveReplacementPrice: input.saveReplacementPrice,
    }),
  });

  return item;
}

export async function updateAssetRegisterItemFromGenericValuation(input: {
  userId: string;
  assetId: string;
  valuationRunId: number;
  result: GenericValuationResult;
  selectedMethod: GenericSelectedMethod;
  selectedValueExVat: number;
  marketValueExVat?: number | null;
  marketAdjustmentDeltaExVat?: number | null;
  marketRawAverageExVat?: number | null;
  saveReplacementPrice?: boolean;
  allowUsageDecrease?: boolean;
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
  const nextKind = getGenericAssetRegisterKind(valuationResult);
  const equipmentModelId = getGenericEquipmentModelId(valuationResult);
  const selectedValueExVat = Math.round(Number(input.selectedValueExVat) || 0);
  const yearModelUnknown = isGenericYearModelUnknown(valuationResult);
  const savedYearModel = yearModelUnknown ? null : valuationResult.year;
  const assetIdentity = buildGenericAssetIdentity({
    result: valuationResult,
    yearModel: savedYearModel,
    yearModelUnknown,
  });
  const marketValueExVat: number | null = null;
  const replacementPriceUsedExVat = normalizeReplacementPriceExVat(valuationResult.replacementPriceUsedExVat);
  const userReplacementPriceExVat = normalizeReplacementPriceExVat(valuationResult.userReplacementPriceExVat);

  if (replacementPriceUsedExVat === null) {
    throw new Error('REPLACEMENT_PRICE_REQUIRED');
  }

  const existingUsageAmount = existing.hours;
  const nextUsageAmount = valuationResult.usageAmount ?? null;
  const existingLifeWorkedPercent = existing.lifeWorkedPercent ?? percentFromSpecs(existing.specsJson);
  const shouldProtectLifeWorkedPercent = !genericValuationResultUsesUsageReading(valuationResult);

  if (
    input.allowUsageDecrease !== true &&
    nextUsageAmount !== null &&
    existingUsageAmount !== null &&
    nextUsageAmount < existingUsageAmount
  ) {
    throw new Error('USAGE_READING_CANNOT_DECREASE');
  }

  if (
    input.allowUsageDecrease !== true &&
    shouldProtectLifeWorkedPercent &&
    valuationResult.lifeWorkedPercent !== null &&
    existingLifeWorkedPercent !== null &&
    valuationResult.lifeWorkedPercent < existingLifeWorkedPercent
  ) {
    throw new Error('LIFE_WORKED_PERCENT_CANNOT_DECREASE');
  }

  const fields: SqlField[] = [];

  copySharedFieldsFromValuationRun(fields, schema, valuationSchema, valuationRow);

  pushField(fields, schema, ['valuation_run_id', 'run_id'], input.valuationRunId);
  pushField(fields, schema, ['sector_id'], valuationResult.sector.id);
  pushField(fields, schema, ['equipment_family_id'], valuationResult.family.id);
  pushField(fields, schema, ['equipment_model_id'], equipmentModelId);
  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], nextKind);
  pushField(fields, schema, ['title', 'name', 'asset_name'], assetIdentity.title);
  pushField(fields, schema, ['value', 'selected_value_ex_vat', 'selected_value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['selected_method', 'method', 'valuation_method'], input.selectedMethod);
  pushField(fields, schema, ['selected_value_ex_vat', 'selected_value', 'value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['source_type', 'source', 'origin', 'entry_source'], 'valuation');
  pushField(fields, schema, ['brand_name', 'brand'], assetIdentity.brandName);
  pushField(fields, schema, ['model_name', 'model'], assetIdentity.modelName);
  pushField(fields, schema, ['typed_model_name'], valuationResult.typedModelName || null);
  pushField(fields, schema, ['normalized_typed_model_name'], valuationResult.normalizedTypedModelName || null);
  pushField(
    fields,
    schema,
    ['specs_json'],
    stripMarketValuationSpecs(
      withPersistedAssetIdentitySpecs(
        withGenericUsageMetadata(
          buildCurrentValuationSpecs(existing.specsJson, withSaleabilityValuationInputs(valuationResult.specsJson ?? {}, valuationResult.advancedAssumptions), {
            valuationRunId: input.valuationRunId,
            selectedValueExVat,
            hours: valuationResult.usageAmount ?? null,
            lifeWorkedPercent: valuationResult.lifeWorkedPercent,
            condition: valuationResult.condition,
            yearModelUnknown,
            yearModel: savedYearModel,
            now,
          }),
          valuationResult,
        ),
        assetIdentity,
      ),
    ),
    '::jsonb',
  );
  pushField(fields, schema, ['depreciation_method_used'], valuationResult.depreciationMethodUsed);
  if (input.saveReplacementPrice === true) {
    pushField(fields, schema, ['replacement_price_basis'], valuationResult.replacementPriceBasis);
    pushField(fields, schema, ['replacement_price_used_ex_vat', 'replacement_price_ex_vat', 'official_replacement_price_ex_vat'], replacementPriceUsedExVat);
    pushField(fields, schema, ['user_replacement_price_ex_vat'], userReplacementPriceExVat);
  }
  pushField(fields, schema, ['life_worked_percent'], valuationResult.lifeWorkedPercent);
  pushField(fields, schema, ['life_remaining_percent'], valuationResult.lifeRemainingPercent);
  pushField(fields, schema, ['estimated_hours'], valuationResult.estimatedHours);
  pushField(fields, schema, ['max_lifetime_hours'], valuationResult.maxLifetimeHours);
  pushField(fields, schema, ['year_model', 'year'], savedYearModel);
  pushField(fields, schema, ['hours', 'engine_hours'], valuationResult.usageAmount ?? null);
  pushField(fields, schema, ['condition'], normalizeConditionForDb(valuationResult.condition));
  pushField(fields, schema, ['aim4price_value_ex_vat', 'aim4price_value'], toRoundedNumber(valuationResult.aim4priceValueExVat));
  pushField(fields, schema, ['market_mid_ex_vat', 'market_value_ex_vat', 'market_value'], marketValueExVat);
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

  const item = mapAssetRegisterRow(row);
  await captureAssetDepreciationLogEntry({
    previousAsset: existing,
    asset: item,
    eventType: 'automatic_revaluation_saved',
    eventSource: 'asset-register-revalue-generic',
    metadata: buildSavedRevaluationLogMetadata({
      existing,
      selectedValueExVat,
      staleReasons: buildValuationStaleReasons({
        existing,
        nextYearModel: savedYearModel,
        nextHours: valuationResult.usageAmount ?? null,
        nextLifeWorkedPercent: valuationResult.lifeWorkedPercent,
        nextCondition: valuationResult.condition,
      }),
      valuationRunId: input.valuationRunId,
      selectedMethod: input.selectedMethod,
      saveReplacementPrice: input.saveReplacementPrice,
    }),
  });

  return item;
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
  registerId?: string | null;
  valuationRunId: number;
  result: Result;
  selectedMethod: MethodKey;
  selectedValueExVat: number;
  marketValueExVat?: number | null;
  marketAdjustmentDeltaExVat?: number | null;
  marketRawAverageExVat?: number | null;
  year: number;
  yearModelUnknown?: boolean | null;
  hours: number;
  note?: string | null;
  photos?: string[];
}): Promise<AssetRegisterItem> {
  const db = getDb();
  const activeRegister = input.registerId
    ? await getAssetRegisterForUser(input.userId, input.registerId)
    : await getSelectedAssetRegister(input.userId);

  if (!activeRegister) {
    throw new Error('ASSET_REGISTER_NOT_FOUND');
  }

  const schema = await getAssetRegisterSchema();
  const valuationSchema = await getValuationRunsSchema();
  const valuationRow = await fetchValuationRunRowById(input.userId, input.valuationRunId);

  if (!valuationRow) {
    throw new Error('VALUATION_RUN_NOT_FOUND');
  }

  const valuationResult = input.result;
  const model = valuationResult.model;
  const now = new Date();
  const selectedValueExVat = Math.round(Number(input.selectedValueExVat) || 0);
  const savedYearModel = input.yearModelUnknown ? null : Math.round(input.year);
  const assetIdentity = buildTractorAssetIdentity({
    result: valuationResult,
    yearModel: savedYearModel,
    yearModelUnknown: input.yearModelUnknown,
  });
  const title = assetIdentity.title;
  const marketValueExVat: number | null = null;
  const replacementPriceUsedExVat = normalizeReplacementPriceExVat(valuationResult.replacementPriceUsedExVat);
  const userReplacementPriceExVat = normalizeReplacementPriceExVat(valuationResult.userReplacementPriceExVat);

  if (replacementPriceUsedExVat === null) {
    throw new Error('REPLACEMENT_PRICE_REQUIRED');
  }

  const fields: SqlField[] = [];

  copySharedFieldsFromValuationRun(fields, schema, valuationSchema, valuationRow);

  pushField(fields, schema, ['user_id'], input.userId);
  pushField(fields, schema, ['register_id'], activeRegister.id);
  pushField(fields, schema, ['valuation_run_id', 'run_id'], input.valuationRunId);
  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], 'tractor');
  pushField(fields, schema, ['title', 'name', 'asset_name'], title);
  pushField(fields, schema, ['value', 'selected_value_ex_vat', 'selected_value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['selected_method', 'method', 'valuation_method'], input.selectedMethod);
  pushField(fields, schema, ['selected_value_ex_vat', 'selected_value', 'value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['source_type', 'source', 'origin', 'entry_source'], 'valuation');
  pushField(fields, schema, ['brand_name', 'brand'], assetIdentity.brandName);
  pushField(fields, schema, ['model_name', 'model'], assetIdentity.modelName);
  pushField(fields, schema, ['drive_type', 'drive', 'drivetrain'], model.drive);
  pushField(fields, schema, ['tractor_type', 'tractor_category'], model.tractorType);
  pushField(fields, schema, ['cab_type', 'cab'], model.cab);
  pushField(fields, schema, ['power_kw', 'kw', 'power'], model.powerKw);
  pushField(fields, schema, ['year_model', 'year'], savedYearModel);
  pushField(fields, schema, ['hours', 'engine_hours'], Math.max(0, Math.round(input.hours)));
  pushField(fields, schema, ['max_lifetime_hours'], valuationResult.maxLifetimeHours);
  pushField(fields, schema, ['condition'], normalizeConditionForDb(valuationRow.condition) ?? 'good');
  pushField(fields, schema, ['aim4price_value_ex_vat', 'aim4price_value'], toRoundedNumber(valuationResult.aim4priceValueExVat));
  pushField(fields, schema, ['market_mid_ex_vat', 'market_value_ex_vat', 'market_value'], marketValueExVat);
  pushField(fields, schema, ['replacement_price_used_ex_vat', 'replacement_price_ex_vat', 'official_replacement_price_ex_vat'], replacementPriceUsedExVat);
  pushField(fields, schema, ['user_replacement_price_ex_vat'], userReplacementPriceExVat);
  pushField(fields, schema, ['replacement_price_basis'], valuationResult.replacementPriceBasis);
  pushField(
    fields,
    schema,
    ['specs_json'],
    stripMarketValuationSpecs(
      withPersistedAssetIdentitySpecs(
        buildCurrentValuationSpecs({}, withSaleabilityValuationInputs(isRecord(valuationRow.specs_json) ? valuationRow.specs_json : {}, valuationResult.advancedAssumptions), {
          valuationRunId: input.valuationRunId,
          selectedValueExVat,
          hours: input.hours,
          lifeWorkedPercent: null,
          condition: typeof valuationRow.condition === 'string' ? valuationRow.condition : 'good',
          yearModelUnknown: input.yearModelUnknown,
          yearModel: savedYearModel,
          now,
        }),
        assetIdentity,
      ),
    ),
    '::jsonb',
  );
  pushField(fields, schema, ['note', 'notes', 'description'], cleanAssetRegisterNote(input.note) || null);
  pushPhotoField(fields, schema, input.photos ?? []);
  pushField(fields, schema, ['created_at', 'createdon', 'created'], now);
  pushField(fields, schema, ['updated_at', 'modified_at', 'updatedon'], now);

  ensureRequiredFields(fields, schema, {
    userId: input.userId,
    registerId: activeRegister.id,
    valuationRunId: input.valuationRunId,
    title,
    kind: 'tractor',
    selectedMethod: input.selectedMethod,
    selectedValueExVat,
    note: cleanAssetRegisterNote(input.note) || null,
    brandName: assetIdentity.brandName,
    modelName: assetIdentity.modelName,
    drive: model.drive,
    tractorType: model.tractorType,
    cab: model.cab,
    powerKw: model.powerKw,
    year: savedYearModel,
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

  const item = mapAssetRegisterRow(row);
  await captureAssetDepreciationLogEntry({
    asset: item,
    eventType: 'valuation_asset_saved',
    eventSource: 'tractor-valuation-save',
    metadata: {
      valuationRunId: input.valuationRunId,
      selectedMethod: input.selectedMethod,
    },
  });

  return item;
}

export async function createAssetRegisterItemFromGenericValuation(input: {
  userId: string;
  registerId?: string | null;
  valuationRunId: number;
  result: GenericValuationResult;
  selectedMethod: GenericSelectedMethod;
  selectedValueExVat: number;
  marketValueExVat?: number | null;
  marketAdjustmentDeltaExVat?: number | null;
  marketRawAverageExVat?: number | null;
  note?: string | null;
  photos?: string[];
}): Promise<AssetRegisterItem> {
  const db = getDb();
  const activeRegister = input.registerId
    ? await getAssetRegisterForUser(input.userId, input.registerId)
    : await getSelectedAssetRegister(input.userId);

  if (!activeRegister) {
    throw new Error('ASSET_REGISTER_NOT_FOUND');
  }

  const schema = await getAssetRegisterSchema();
  const valuationSchema = await getValuationRunsSchema();
  const valuationRow = await fetchValuationRunRowById(input.userId, input.valuationRunId);

  if (!valuationRow) {
    throw new Error('VALUATION_RUN_NOT_FOUND');
  }

  const valuationResult = input.result;
  const nextKind = getGenericAssetRegisterKind(valuationResult);
  const equipmentModelId = getGenericEquipmentModelId(valuationResult);
  const now = new Date();
  const selectedValueExVat = Math.round(Number(input.selectedValueExVat) || 0);
  const yearModelUnknown = isGenericYearModelUnknown(valuationResult);
  const savedYearModel = yearModelUnknown ? null : valuationResult.year;
  const assetIdentity = buildGenericAssetIdentity({
    result: valuationResult,
    yearModel: savedYearModel,
    yearModelUnknown,
  });
  const title = assetIdentity.title;
  const marketValueExVat: number | null = null;
  const replacementPriceUsedExVat = normalizeReplacementPriceExVat(valuationResult.replacementPriceUsedExVat);
  const userReplacementPriceExVat = normalizeReplacementPriceExVat(valuationResult.userReplacementPriceExVat);

  if (replacementPriceUsedExVat === null) {
    throw new Error('REPLACEMENT_PRICE_REQUIRED');
  }

  const fields: SqlField[] = [];

  copySharedFieldsFromValuationRun(fields, schema, valuationSchema, valuationRow);

  pushField(fields, schema, ['user_id'], input.userId);
  pushField(fields, schema, ['register_id'], activeRegister.id);
  pushField(fields, schema, ['valuation_run_id', 'run_id'], input.valuationRunId);
  pushField(fields, schema, ['sector_id'], valuationResult.sector.id);
  pushField(fields, schema, ['equipment_family_id'], valuationResult.family.id);
  pushField(fields, schema, ['equipment_model_id'], equipmentModelId);
  pushField(fields, schema, ['kind', 'equipment_type', 'asset_type', 'item_type'], nextKind);
  pushField(fields, schema, ['title', 'name', 'asset_name'], title);
  pushField(fields, schema, ['value', 'selected_value_ex_vat', 'selected_value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['selected_method', 'method', 'valuation_method'], input.selectedMethod);
  pushField(fields, schema, ['selected_value_ex_vat', 'selected_value', 'value', 'saved_value_ex_vat'], selectedValueExVat);
  pushField(fields, schema, ['source_type', 'source', 'origin', 'entry_source'], 'valuation');
  pushField(fields, schema, ['brand_name', 'brand'], assetIdentity.brandName);
  pushField(fields, schema, ['model_name', 'model'], assetIdentity.modelName);
  pushField(fields, schema, ['typed_model_name'], valuationResult.typedModelName || null);
  pushField(fields, schema, ['normalized_typed_model_name'], valuationResult.normalizedTypedModelName || null);
  pushField(
    fields,
    schema,
    ['specs_json'],
    stripMarketValuationSpecs(
      withPersistedAssetIdentitySpecs(
        withGenericUsageMetadata(
          buildCurrentValuationSpecs({}, withSaleabilityValuationInputs(valuationResult.specsJson ?? {}, valuationResult.advancedAssumptions), {
            valuationRunId: input.valuationRunId,
            selectedValueExVat,
            hours: valuationResult.usageAmount ?? null,
            lifeWorkedPercent: valuationResult.lifeWorkedPercent,
            condition: valuationResult.condition,
            yearModelUnknown,
            yearModel: savedYearModel,
            now,
          }),
          valuationResult,
        ),
        assetIdentity,
      ),
    ),
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
  pushField(fields, schema, ['year_model', 'year'], savedYearModel);
  pushField(fields, schema, ['hours', 'engine_hours'], valuationResult.usageAmount ?? null);
  pushField(fields, schema, ['condition'], normalizeConditionForDb(valuationResult.condition));
  pushField(fields, schema, ['aim4price_value_ex_vat', 'aim4price_value'], toRoundedNumber(valuationResult.aim4priceValueExVat));
  pushField(fields, schema, ['market_mid_ex_vat', 'market_value_ex_vat', 'market_value'], marketValueExVat);
  pushField(fields, schema, ['note', 'notes', 'description'], cleanAssetRegisterNote(input.note) || null);
  pushPhotoField(fields, schema, input.photos ?? []);
  pushField(fields, schema, ['created_at', 'createdon', 'created'], now);
  pushField(fields, schema, ['updated_at', 'modified_at', 'updatedon'], now);

  ensureRequiredFields(fields, schema, {
    userId: input.userId,
    registerId: activeRegister.id,
    valuationRunId: input.valuationRunId,
    title,
    kind: nextKind,
    selectedMethod: input.selectedMethod,
    selectedValueExVat,
    note: cleanAssetRegisterNote(input.note) || null,
    brandName: assetIdentity.brandName,
    modelName: assetIdentity.modelName,
    year: savedYearModel,
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

  const item = mapAssetRegisterRow(row);
  await captureAssetDepreciationLogEntry({
    asset: item,
    eventType: 'valuation_asset_saved',
    eventSource: 'generic-valuation-save',
    metadata: {
      valuationRunId: input.valuationRunId,
      selectedMethod: input.selectedMethod,
    },
  });

  return item;
}

function toRoundedNumber(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.round(value);
}

