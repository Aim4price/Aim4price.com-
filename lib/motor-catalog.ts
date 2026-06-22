import { getDb } from './db';
import type { SectorKey } from './equipment-types';

export type MotorTypeOption = {
  value: string;
  label: string;
  specs: Record<string, string>;
};

export type MotorCanonicalModelResult = {
  id: string;
  modelKey: string;
  representativeModelId: number;
  sectorKey: SectorKey;
  familyKey: string;
  familyLabel: string;
  brandId: number;
  brandSlug: string;
  brandName: string;
  modelName: string;
  displayLabel: string;
  typeOptions: MotorTypeOption[];
  defaultTypeValue: string | null;
  specsJson: Record<string, unknown>;
};

type DbRecord = Record<string, unknown>;

type MotorModelRow = {
  id: number;
  modelKey: string;
  familyKey: string;
  familyLabel: string;
  brandId: number;
  brandSlug: string;
  brandName: string;
  modelName: string;
  displayName: string;
  variantName: string;
  specsJson: Record<string, unknown>;
  replacementPriceExVat: number | null;
  replacementPriceYear: number | null;
};

type MotorPricingMatrixRow = {
  id: number;
  equipmentModelId: number;
  modelKey: string;
  typeKey: string;
  typeLabel: string;
  driveType: string;
  transmission: string;
  specLevel: string;
  replacementPriceExVat: number | null;
  priceLowExVat: number | null;
  priceMidExVat: number | null;
  priceHighExVat: number | null;
  replacementPriceYear: number | null;
  confidenceScore: number | null;
  sourceUrls: string;
  sourceNotes: string;
  brandName: string;
};

export type MotorReplacementPriceMatch = {
  replacementPriceMinExVat: number;
  replacementPriceMaxExVat: number;
  replacementPriceUsedExVat: number;
  replacementPriceYear: number | null;
  matchedModelCount: number;
  sourceLabel: string;
  confidenceScore?: number | null;
};

export type MotorUsageProfileSpecs = {
  motor_usage_profile_type_key: string;
  max_lifetime_km?: number;
  useful_life_km?: number;
  expected_annual_km_low?: number;
  expected_annual_km_high?: number;
  high_usage_warning_km?: number;
  extreme_usage_warning_km?: number;
  hard_input_cap_km?: number;
  residual_floor_pct?: number;
};

const MOTOR_CANONICAL_SPEC_KEYS = [
  'canonical_model_name',
  'canonical_model',
  'user_facing_model',
  'clean_model',
  'model_family',
  'model_group',
  'model_range',
  'base_model',
  'series',
];

const MOTOR_TYPE_SPEC_KEYS: Record<string, string[]> = {
  bakkies_ldvs: ['type_key', 'motor_type', 'cab_type', 'body_type', 'vehicle_type', 'type'],
  cars_suvs: ['type_key', 'motor_type', 'body_type', 'vehicle_segment', 'vehicle_type', 'type'],
  light_commercial_vehicles: ['type_key', 'motor_type', 'body_type', 'vehicle_type', 'commercial_type', 'type'],
  trucks: ['type_key', 'motor_type', 'truck_type', 'body_type', 'application', 'vehicle_type', 'type'],
  trailers: ['type_key', 'motor_type', 'trailer_type', 'body_type', 'application', 'type'],
  buses: ['type_key', 'motor_type', 'bus_type', 'body_type', 'vehicle_type', 'type'],
  motorcycles: ['type_key', 'motor_type', 'motorcycle_type', 'body_type', 'vehicle_type', 'type'],
  quadbikes: ['type_key', 'motor_type', 'quadbike_type', 'body_type', 'vehicle_type', 'type'],
  side_by_sides: ['type_key', 'motor_type', 'side_by_side_type', 'body_type', 'vehicle_type', 'type'],
};

const MOTOR_PRIMARY_TYPE_SPEC_KEY: Record<string, string> = {
  bakkies_ldvs: 'cab_type',
  cars_suvs: 'body_type',
  light_commercial_vehicles: 'body_type',
  trucks: 'truck_type',
  trailers: 'trailer_type',
  buses: 'bus_type',
  motorcycles: 'motorcycle_type',
  quadbikes: 'quadbike_type',
  side_by_sides: 'side_by_side_type',
};

const MOTOR_TYPE_LABELS: Record<string, string> = {
  single_cab: 'Single Cab',
  extended_cab: 'Extended Cab',
  double_cab: 'Double Cab',
  cab_chassis: 'Cab Chassis',
  hatchback: 'Hatchback',
  hatch: 'Hatchback',
  sedan: 'Sedan',
  suv: 'SUV',
  crossover: 'SUV',
  coupe: 'Coupé',
  cabriolet: 'Cabriolet',
  convertible: 'Cabriolet',
  fastback: 'Fastback',
  sportback: 'Sportback',
  station_wagon: 'Station Wagon',
  estate: 'Station Wagon',
  mpv: 'MPV',
  panel_van: 'Panel Van',
  minibus: 'Minibus',
  crew_bus: 'Crew Bus',
  truck_tractor: 'Truck Tractor',
  rigid_truck: 'Rigid Truck',
  tipper: 'Tipper',
  dropside: 'Dropside',
  tanker: 'Tanker',
  refrigerated: 'Refrigerated',
  crane_truck: 'Crane Truck',
  concrete_mixer: 'Concrete Mixer',
  refuse_truck: 'Refuse Truck',
  rollback: 'Rollback',
  flatdeck: 'Flatdeck',
  tautliner: 'Tautliner',
  side_tipper: 'Side Tipper',
  lowbed: 'Lowbed',
  skeletal: 'Skeletal',
  livestock: 'Livestock',
  dolly: 'Dolly',
  minibus_taxi: 'Minibus Taxi',
  panel_van_bus: 'Van-Based Bus',
  midi_bus: 'Midi Bus',
  commuter_bus: 'Commuter Bus',
  coach: 'Coach',
  city_bus: 'City Bus',
  commuter: 'Commuter',
  adventure: 'Adventure',
  touring: 'Touring',
  sport: 'Sport',
  cruiser: 'Cruiser',
  off_road: 'Off-Road',
  scooter: 'Scooter',
  utility: 'Utility',
  youth: 'Youth',
  electric: 'Electric',
  recreation: 'Recreation',
  crew: 'Crew Cab',
};

const MULTI_WORD_MODEL_PREFIXES = [
  '3 series',
  '4 series',
  '5 series',
  '7 series',
  '8 series',
  '1 series',
  '2 series',
  'c class',
  'e class',
  's class',
  'a class',
  'b class',
  'v class',
  'x class',
  'r series',
  'p series',
  'g series',
  's series',
  'land cruiser',
  'corolla cross',
  'range rover',
  'discovery sport',
  'grand vitara',
  'jimny sierra',
  'd max',
  'd-max',
  'cx 3',
  'cx 5',
  'cx 30',
  'cx 60',
  'mt 07',
  'mt-07',
  'mt 09',
  'mt-09',
  'r 1250',
  'r 1300',
];

const ANY_UNKNOWN_VALUES = new Set(['', 'any', 'unknown', 'any_unknown', 'anyunknown', 'unspecified', 'not_applicable', 'n_a', 'na']);

const schemaExistenceCache = new Map<string, Promise<boolean>>();

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function toNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toInteger(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value.split(/\s*;\s*/).filter(Boolean);
    }
  }
  return [];
}

export function normalizeMotorKey(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/×/g, 'x')
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeLooseWords(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/×/g, 'x')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitleLabel(value: string): string {
  const trimmed = value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  return trimmed
    .split(' ')
    .map((part) => {
      if (/^(awd|fwd|rwd|suv|mpv|lcv|ev|mt|crf|xr|gs|rs|ud|man)$/i.test(part)) return part.toUpperCase();
      if (/^\d+x\d+$/i.test(part)) return part.toLowerCase();
      if (/^[a-z]\d/i.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ')
    .replace(/\bD Max\b/g, 'D-Max')
    .replace(/\bMt /g, 'MT-')
    .replace(/\bC Class\b/g, 'C-Class')
    .replace(/\bE Class\b/g, 'E-Class')
    .replace(/\bS Class\b/g, 'S-Class')
    .replace(/\bA Class\b/g, 'A-Class')
    .replace(/\bB Class\b/g, 'B-Class')
    .replace(/\bV Class\b/g, 'V-Class')
    .replace(/\bX Class\b/g, 'X-Class')
    .replace(/\bR Series\b/g, 'R-Series')
    .replace(/\bP Series\b/g, 'P-Series')
    .replace(/\bG Series\b/g, 'G-Series');
}

function stripBrandPrefix(value: string, brandName: string): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  const brand = brandName.replace(/\s+/g, ' ').trim();
  if (!cleaned || !brand) return cleaned;

  const cleanedLower = cleaned.toLowerCase();
  const brandLower = brand.toLowerCase();
  if (cleanedLower === brandLower) return '';
  if (cleanedLower.startsWith(`${brandLower} `)) return cleaned.slice(brand.length).trim();

  const brandParts = brandLower.split(/\s+/).filter(Boolean);
  if (brandParts.length > 1) {
    const lastPart = brandParts[brandParts.length - 1];
    if (lastPart && cleanedLower.startsWith(`${lastPart} `)) return cleaned.slice(lastPart.length).trim();
  }

  return cleaned;
}

function firstSpecString(specsJson: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = cleanText(specsJson[key]);
    if (value) return value;
  }
  return '';
}

async function publicTableExists(tableName: string): Promise<boolean> {
  const cacheKey = `table:${tableName}`;
  if (!schemaExistenceCache.has(cacheKey)) {
    schemaExistenceCache.set(cacheKey, (async () => {
      const db = getDb();
      const result = await db.query<DbRecord>('select to_regclass($1) is not null as exists', [`public.${tableName}`]);
      return Boolean(result.rows[0]?.exists);
    })());
  }
  return schemaExistenceCache.get(cacheKey) ?? Promise.resolve(false);
}

async function publicColumnExists(tableName: string, columnName: string): Promise<boolean> {
  const cacheKey = `column:${tableName}.${columnName}`;
  if (!schemaExistenceCache.has(cacheKey)) {
    schemaExistenceCache.set(cacheKey, (async () => {
      const db = getDb();
      const result = await db.query<DbRecord>(
        `
          select exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = $1
              and column_name = $2
          ) as exists
        `,
        [tableName, columnName],
      );
      return Boolean(result.rows[0]?.exists);
    })());
  }
  return schemaExistenceCache.get(cacheKey) ?? Promise.resolve(false);
}

export function deriveMotorCanonicalModelName(args: {
  brandName?: string | null;
  modelName?: string | null;
  displayName?: string | null;
  specsJson?: Record<string, unknown> | null;
}): string {
  const specsJson = asObject(args.specsJson);
  const explicit = firstSpecString(specsJson, MOTOR_CANONICAL_SPEC_KEYS);
  if (explicit) return normalizeTitleLabel(stripBrandPrefix(explicit, cleanText(args.brandName)));

  const brandName = cleanText(args.brandName);
  const rawSource = cleanText(args.modelName) || cleanText(args.displayName);
  let raw = stripBrandPrefix(rawSource, brandName);
  raw = raw.replace(/\([^)]*\)/g, ' ').replace(/[–—|/]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return normalizeTitleLabel(rawSource);

  const loose = normalizeLooseWords(raw);
  for (const prefix of MULTI_WORD_MODEL_PREFIXES) {
    const normalizedPrefix = normalizeLooseWords(prefix);
    if (loose === normalizedPrefix || loose.startsWith(`${normalizedPrefix} `)) return normalizeTitleLabel(prefix);
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  if (!tokens.length) return normalizeTitleLabel(raw);

  const first = tokens[0];
  const second = tokens[1] ?? '';
  const firstLoose = normalizeLooseWords(first);
  const secondLoose = normalizeLooseWords(second);

  if (/^\d+$/.test(firstLoose) && ['series', 'class'].includes(secondLoose)) {
    return normalizeTitleLabel(`${first} ${second}`);
  }

  if (/^[a-z]$/i.test(firstLoose) && ['series', 'class'].includes(secondLoose)) {
    return normalizeTitleLabel(`${first} ${second}`);
  }

  if (/^[a-z]-?(series|class)$/i.test(first) || /^\d-?series$/i.test(first)) {
    return normalizeTitleLabel(first);
  }

  if (/^[a-z]{1,4}-?\d{1,4}$/i.test(first) || /^[a-z]+\d+$/i.test(first)) {
    return normalizeTitleLabel(first);
  }

  return normalizeTitleLabel(first);
}

export function normalizeMotorTypeValue(value: unknown, familyKey?: string | null): string {
  const normalized = normalizeLooseWords(value).replace(/\s+/g, '_');
  if (!normalized || ANY_UNKNOWN_VALUES.has(normalized)) return '';

  if (familyKey === 'bakkies_ldvs') {
    if (['extra_cab', 'extended_cab', 'xtra_cab', 'king_cab', 'kingcab', 'super_cab', 'supercab', 'club_cab'].includes(normalized)) return 'extended_cab';
    if (['singlecab', 'single_cab', 's_cab'].includes(normalized)) return 'single_cab';
    if (['doublecab', 'double_cab', 'crew_cab', 'dcab', 'd_cab'].includes(normalized)) return 'double_cab';
  }

  if (familyKey === 'cars_suvs') {
    if (['hatch', 'entry_hatch', 'compact_hatch'].includes(normalized)) return 'hatchback';
    if (['crossover', 'compact_suv', 'midsize_suv', 'large_suv', 'luxury_suv'].includes(normalized)) return 'suv';
    if (['estate', 'wagon', 'station_wagon'].includes(normalized)) return 'station_wagon';
    if (['convertible'].includes(normalized)) return 'cabriolet';
  }

  if (familyKey === 'light_commercial_vehicles') {
    if (['van', 'panelvan', 'panel_van'].includes(normalized)) return 'panel_van';
    if (['crewbus', 'crew_bus'].includes(normalized)) return 'crew_bus';
    if (['minibus_taxi'].includes(normalized)) return 'minibus';
  }

  if (familyKey === 'trucks') {
    if (['tractor', 'horse', 'truck_tractor'].includes(normalized)) return 'truck_tractor';
    if (['rigid', 'rigid_truck'].includes(normalized)) return 'rigid_truck';
    if (['tipper_body'].includes(normalized)) return 'tipper';
  }

  return normalized;
}

function normalizeMatrixOption(value: unknown): string {
  const normalized = normalizeLooseWords(value).replace(/\s+/g, '_');
  if (ANY_UNKNOWN_VALUES.has(normalized)) return '';
  return normalized;
}

function isAnyMatrixValue(value: unknown): boolean {
  return ANY_UNKNOWN_VALUES.has(normalizeLooseWords(value).replace(/\s+/g, '_'));
}

export function getMotorTypeLabel(value: unknown): string {
  const normalized = normalizeMotorTypeValue(value);
  return MOTOR_TYPE_LABELS[normalized] ?? normalizeTitleLabel(cleanText(value));
}

function getMotorTypeLabelFromKey(value: unknown, label?: unknown): string {
  const cleanLabel = cleanText(label);
  if (cleanLabel && !isAnyMatrixValue(cleanLabel)) return cleanLabel;
  return getMotorTypeLabel(value);
}

export function extractMotorTypeValue(specsJson: Record<string, unknown>, familyKey: string): string {
  const keys = MOTOR_TYPE_SPEC_KEYS[familyKey] ?? ['type_key', 'motor_type', 'type', 'body_type', 'vehicle_type'];
  for (const key of keys) {
    const normalized = normalizeMotorTypeValue(specsJson[key], familyKey);
    if (normalized) return normalized;
  }
  return '';
}

export function buildMotorTypeSpecs(familyKey: string, typeValue: string, typeLabel?: string): Record<string, string> {
  const normalizedType = normalizeMotorTypeValue(typeValue, familyKey);
  if (!normalizedType) return {};

  const primaryKey = MOTOR_PRIMARY_TYPE_SPEC_KEY[familyKey] ?? 'vehicle_type';
  const specs: Record<string, string> = {
    [primaryKey]: normalizedType,
    motor_type: normalizedType,
    type_key: normalizedType,
    type_label: typeLabel || getMotorTypeLabel(normalizedType),
  };

  if (familyKey === 'bakkies_ldvs') {
    specs.body_type = normalizedType;
    specs.cab_type = normalizedType;
  } else if (familyKey === 'cars_suvs' || familyKey === 'light_commercial_vehicles') {
    specs.body_type = normalizedType;
  } else if (familyKey === 'trucks') {
    specs.truck_type = normalizedType;
  } else if (familyKey === 'trailers') {
    specs.trailer_type = normalizedType;
  } else if (familyKey === 'buses') {
    specs.bus_type = normalizedType;
  }

  return specs;
}

export function normalizeMotorSpecOption(value: unknown): string {
  const normalized = normalizeLooseWords(value).replace(/\s+/g, '_');
  if (['entry_level', 'base', 'standard'].includes(normalized)) return 'entry';
  if (['middle', 'medium'].includes(normalized)) return 'mid';
  if (['high', 'premium', 'top', 'flagship'].includes(normalized)) return 'luxury';
  if (ANY_UNKNOWN_VALUES.has(normalized)) return '';
  return normalized;
}

function mapLegacyRow(row: DbRecord): MotorModelRow {
  return {
    id: toInteger(row.id) ?? 0,
    modelKey: cleanText(row.aim4_model_key) || cleanText(asObject(row.specs_json).aim4_model_key),
    familyKey: cleanText(row.family_key),
    familyLabel: cleanText(row.family_label),
    brandId: toInteger(row.brand_id) ?? 0,
    brandSlug: cleanText(row.brand_slug),
    brandName: cleanText(row.brand_name),
    modelName: cleanText(row.model_name),
    displayName: cleanText(row.display_name),
    variantName: cleanText(row.variant_name),
    specsJson: asObject(row.specs_json),
    replacementPriceExVat: toNumber(row.aim4price_replacement_price_ex_vat),
    replacementPriceYear: toInteger(row.replacement_price_year),
  };
}

function mapPricingMatrixRow(row: DbRecord): MotorPricingMatrixRow {
  return {
    id: toInteger(row.id) ?? 0,
    equipmentModelId: toInteger(row.equipment_model_id) ?? 0,
    modelKey: cleanText(row.model_key),
    typeKey: cleanText(row.type_key),
    typeLabel: cleanText(row.type_label),
    driveType: cleanText(row.drive_type),
    transmission: cleanText(row.transmission),
    specLevel: cleanText(row.spec_level),
    replacementPriceExVat: toNumber(row.replacement_price_ex_vat),
    priceLowExVat: toNumber(row.price_low_ex_vat),
    priceMidExVat: toNumber(row.price_mid_ex_vat),
    priceHighExVat: toNumber(row.price_high_ex_vat),
    replacementPriceYear: toInteger(row.replacement_price_year),
    confidenceScore: toNumber(row.confidence_score),
    sourceUrls: cleanText(row.source_urls),
    sourceNotes: cleanText(row.source_notes),
    brandName: cleanText(row.brand_name),
  };
}

function dedupeTypeOptions(options: MotorTypeOption[]): MotorTypeOption[] {
  const seen = new Set<string>();
  const output: MotorTypeOption[] = [];

  for (const option of options) {
    const value = normalizeMotorTypeValue(option.value);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    output.push({
      value,
      label: option.label || getMotorTypeLabel(value),
      specs: { ...buildMotorTypeSpecs('', value, option.label), ...(option.specs ?? {}) },
    });
  }

  return output.sort((left, right) => left.label.localeCompare(right.label));
}

function typeOptionsFromSpecs(specsJson: Record<string, unknown>, familyKey: string): MotorTypeOption[] {
  const keys = asArray(specsJson.available_type_keys).map(cleanText).filter(Boolean);
  const labels = asArray(specsJson.available_type_labels).map(cleanText);
  const options: MotorTypeOption[] = [];

  keys.forEach((rawValue, index) => {
    const value = normalizeMotorTypeValue(rawValue, familyKey);
    if (!value) return;
    const label = labels[index] || getMotorTypeLabel(value);
    options.push({ value, label, specs: buildMotorTypeSpecs(familyKey, value, label) });
  });

  const fallbackType = extractMotorTypeValue(specsJson, familyKey);
  if (fallbackType) {
    options.push({ value: fallbackType, label: getMotorTypeLabel(fallbackType), specs: buildMotorTypeSpecs(familyKey, fallbackType) });
  }

  return dedupeTypeOptions(options.map((option) => ({ ...option, specs: buildMotorTypeSpecs(familyKey, option.value, option.label) })));
}

function typeOptionsFromPricingRows(value: unknown, fallbackSpecs: Record<string, unknown>, familyKey: string): MotorTypeOption[] {
  const rows = asArray(value);
  const options: MotorTypeOption[] = [];

  for (const raw of rows) {
    const item = asObject(raw);
    const typeKey = cleanText(item.value ?? item.typeKey ?? item.type_key);
    const value = normalizeMotorTypeValue(typeKey, familyKey);
    if (!value) continue;
    const label = getMotorTypeLabelFromKey(value, item.label ?? item.typeLabel ?? item.type_label);
    options.push({ value, label, specs: buildMotorTypeSpecs(familyKey, value, label) });
  }

  return dedupeTypeOptions(options.length ? options : typeOptionsFromSpecs(fallbackSpecs, familyKey));
}

function defaultTypeValueFromSpecs(specsJson: Record<string, unknown>, familyKey: string, typeOptions: MotorTypeOption[]): string | null {
  const explicit = normalizeMotorTypeValue(specsJson.default_type_key ?? specsJson.default_type ?? specsJson.motor_type, familyKey);
  if (explicit && typeOptions.some((option) => option.value === explicit)) return explicit;
  return typeOptions.length === 1 ? typeOptions[0].value : null;
}

function buildCanonicalSearchResult(row: MotorModelRow, rawTypeOptions: unknown): MotorCanonicalModelResult | null {
  const modelName = deriveMotorCanonicalModelName({
    brandName: row.brandName,
    modelName: row.modelName,
    displayName: row.displayName,
    specsJson: row.specsJson,
  });
  if (!modelName) return null;

  const typeOptions = typeOptionsFromPricingRows(rawTypeOptions, row.specsJson, row.familyKey);
  const defaultTypeValue = defaultTypeValueFromSpecs(row.specsJson, row.familyKey, typeOptions);
  const modelKey = row.modelKey || cleanText(row.specsJson.aim4_model_key) || `${row.familyKey}_${row.brandSlug}_${normalizeMotorKey(modelName)}`;
  const baseSpecs = {
    ...row.specsJson,
    aim4_model_key: modelKey,
    motor_model_key: modelKey,
    model_key: modelKey,
    motor_canonical_model: modelName,
    canonical_model: modelName,
    user_facing_model: modelName,
    motor_representative_model_id: row.id,
    ...(defaultTypeValue ? buildMotorTypeSpecs(row.familyKey, defaultTypeValue, typeOptions.find((option) => option.value === defaultTypeValue)?.label) : {}),
  };

  return {
    id: modelKey,
    modelKey,
    representativeModelId: row.id,
    sectorKey: 'motor',
    familyKey: row.familyKey,
    familyLabel: row.familyLabel,
    brandId: row.brandId,
    brandSlug: row.brandSlug,
    brandName: row.brandName,
    modelName,
    displayLabel: `${row.brandName} ${modelName}`.trim(),
    typeOptions,
    defaultTypeValue,
    specsJson: baseSpecs,
  };
}

function buildSearchResultFromLegacyRows(rows: MotorModelRow[]): MotorCanonicalModelResult | null {
  const first = rows[0];
  if (!first) return null;

  const modelName = deriveMotorCanonicalModelName({
    brandName: first.brandName,
    modelName: first.modelName,
    displayName: first.displayName,
    specsJson: first.specsJson,
  });
  if (!modelName) return null;

  const typeMap = new Map<string, MotorTypeOption>();
  for (const row of rows) {
    const rawType = extractMotorTypeValue(row.specsJson, row.familyKey);
    if (!rawType) continue;
    const value = normalizeMotorTypeValue(rawType, row.familyKey);
    if (!value || typeMap.has(value)) continue;
    typeMap.set(value, {
      value,
      label: getMotorTypeLabel(value),
      specs: buildMotorTypeSpecs(row.familyKey, value),
    });
  }

  const typeOptions = [...typeMap.values()].sort((left, right) => left.label.localeCompare(right.label));
  const bestRow = [...rows].sort((left, right) => {
    const leftPrice = left.replacementPriceExVat ?? 0;
    const rightPrice = right.replacementPriceExVat ?? 0;
    if (rightPrice !== leftPrice) return rightPrice - leftPrice;
    return left.id - right.id;
  })[0];

  const defaultTypeValue = typeOptions.length === 1 ? typeOptions[0].value : null;
  const modelKey = first.modelKey || `${first.familyKey}_${first.brandSlug}_${normalizeMotorKey(modelName)}`;
  const baseSpecs = {
    motor_canonical_model: modelName,
    canonical_model: modelName,
    user_facing_model: modelName,
    aim4_model_key: modelKey,
    motor_model_key: modelKey,
    model_key: modelKey,
    motor_representative_model_id: bestRow.id,
    ...(defaultTypeValue ? typeOptions[0].specs : {}),
  };

  return {
    id: `${first.familyKey}:${first.brandSlug}:${normalizeMotorKey(modelName)}`,
    modelKey,
    representativeModelId: bestRow.id,
    sectorKey: 'motor',
    familyKey: first.familyKey,
    familyLabel: first.familyLabel,
    brandId: first.brandId,
    brandSlug: first.brandSlug,
    brandName: first.brandName,
    modelName,
    displayLabel: `${first.brandName} ${modelName}`.trim(),
    typeOptions,
    defaultTypeValue,
    specsJson: baseSpecs,
  };
}

function scoreSearchResult(result: MotorCanonicalModelResult, query: string): number {
  const normalizedQuery = normalizeLooseWords(query);
  const brandModel = normalizeLooseWords(`${result.brandName} ${result.modelName}`);
  const model = normalizeLooseWords(result.modelName);
  const family = normalizeLooseWords(result.familyLabel);

  if (!normalizedQuery) return 100;
  if (brandModel === normalizedQuery) return 0;
  if (model === normalizedQuery) return 1;
  if (brandModel.startsWith(normalizedQuery)) return 2;
  if (model.startsWith(normalizedQuery)) return 3;
  if (brandModel.includes(normalizedQuery)) return 4;
  if (model.includes(normalizedQuery)) return 5;
  if (family.includes(normalizedQuery)) return 8;
  return 10;
}

async function searchMotorCanonicalModelsFromNewTables(input: {
  search: string;
  limit: number;
  pricingMatrixAvailable: boolean;
  aliasActiveColumnAvailable: boolean;
}): Promise<MotorCanonicalModelResult[]> {
  const db = getDb();
  const like = `%${input.search.toLowerCase()}%`;

  const typeSelect = input.pricingMatrixAvailable
    ? `
        pt.type_options
      `
    : `
        '[]'::jsonb as type_options
      `;
  const aliasActiveCondition = input.aliasActiveColumnAvailable ? 'and coalesce(ema.is_active, true) = true' : '';
  const typeJoin = input.pricingMatrixAvailable
    ? `
        left join lateral (
          select jsonb_agg(jsonb_build_object('value', type_rows.type_key, 'label', type_rows.type_label) order by type_rows.type_label asc) as type_options
          from (
            select distinct p.type_key, p.type_label
            from public.motor_model_pricing_matrix p
            where p.equipment_model_id = em.id
              and coalesce(p.is_active, true) = true
              and coalesce(p.type_key, '') <> ''
          ) type_rows
        ) pt on true
      `
    : '';

  const result = await db.query<DbRecord>(
    `
      select
        em.id,
        em.aim4_model_key,
        ef.family_key,
        ef.family_label,
        b.id as brand_id,
        b.slug as brand_slug,
        b.name as brand_name,
        em.model_name,
        coalesce(em.display_name, em.model_name) as display_name,
        coalesce(em.variant_name, '') as variant_name,
        coalesce(em.specs_json, '{}'::jsonb) as specs_json,
        em.aim4price_replacement_price_ex_vat,
        em.replacement_price_year,
        ${typeSelect}
      from public.equipment_models em
      join public.equipment_families ef on ef.id = em.equipment_family_id
      join public.sectors s on s.id = ef.sector_id
      join public.brands b on b.id = em.brand_id
      ${typeJoin}
      where s.sector_key = 'motor'
        and coalesce(em.is_active, true) = true
        and coalesce(ef.is_active, true) = true
        and coalesce(s.is_active, true) = true
        and coalesce(b.is_active, true) = true
        and coalesce(em.is_generic_fallback, false) = false
        and em.aim4_model_key is not null
        and (
          lower(concat_ws(' ', b.name, em.display_name, em.model_name, em.aim4_model_key, em.specs_json::text)) like $1
          or exists (
            select 1
            from public.equipment_model_aliases ema
            where ema.equipment_model_id = em.id
              ${aliasActiveCondition}
              and lower(concat_ws(' ', ema.alias_text, ema.normalized_alias)) like $1
          )
        )
      order by
        b.name asc,
        em.model_name asc,
        em.id asc
      limit $2
    `,
    [like, input.limit],
  );

  const rows = result.rows as DbRecord[];

  return rows
    .map((row: DbRecord) => buildCanonicalSearchResult(mapLegacyRow(row), row.type_options))
    .filter((value): value is MotorCanonicalModelResult => Boolean(value))
    .sort((left, right) => scoreSearchResult(left, input.search) - scoreSearchResult(right, input.search) || left.displayLabel.localeCompare(right.displayLabel));
}

async function searchMotorCanonicalModelsFromLegacyRows(input: {
  search: string;
  limit: number;
  aliasActiveColumnAvailable: boolean;
}): Promise<MotorCanonicalModelResult[]> {
  const db = getDb();
  const rowLimit = Math.max(250, Math.min(1000, input.limit * 40));
  const like = `%${input.search.toLowerCase()}%`;
  const aliasActiveCondition = input.aliasActiveColumnAvailable ? 'and coalesce(ema.is_active, true) = true' : '';
  const result = await db.query<DbRecord>(
    `
      select
        em.id,
        coalesce(em.specs_json ->> 'aim4_model_key', '') as aim4_model_key,
        ef.family_key,
        ef.family_label,
        b.id as brand_id,
        b.slug as brand_slug,
        b.name as brand_name,
        em.model_name,
        em.display_name,
        coalesce(em.variant_name, '') as variant_name,
        coalesce(em.specs_json, '{}'::jsonb) as specs_json,
        em.aim4price_replacement_price_ex_vat,
        em.replacement_price_year
      from public.equipment_models em
      join public.equipment_families ef on ef.id = em.equipment_family_id
      join public.sectors s on s.id = ef.sector_id
      join public.brands b on b.id = em.brand_id
      where s.sector_key = 'motor'
        and coalesce(em.is_active, true) = true
        and coalesce(ef.is_active, true) = true
        and coalesce(s.is_active, true) = true
        and coalesce(b.is_active, true) = true
        and coalesce(em.is_generic_fallback, false) = false
        and (
          lower(concat_ws(' ', b.name, em.display_name, em.model_name, coalesce(em.variant_name, ''), em.specs_json::text)) like $1
          or exists (
            select 1
            from public.equipment_model_aliases ema
            where ema.equipment_model_id = em.id
              ${aliasActiveCondition}
              and lower(concat_ws(' ', ema.alias_text, ema.normalized_alias)) like $1
          )
        )
      order by
        b.name asc,
        em.model_name asc,
        em.id asc
      limit $2
    `,
    [like, rowLimit],
  );

  const grouped = new Map<string, MotorModelRow[]>();
  for (const row of result.rows.map(mapLegacyRow)) {
    const canonicalModelName = deriveMotorCanonicalModelName({
      brandName: row.brandName,
      modelName: row.modelName,
      displayName: row.displayName,
      specsJson: row.specsJson,
    });
    if (!canonicalModelName || !row.brandSlug || !row.familyKey) continue;
    const key = `${row.familyKey}|${row.brandSlug}|${normalizeMotorKey(canonicalModelName)}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  return [...grouped.values()]
    .map(buildSearchResultFromLegacyRows)
    .filter((value): value is MotorCanonicalModelResult => Boolean(value))
    .sort((left, right) => scoreSearchResult(left, input.search) - scoreSearchResult(right, input.search) || left.displayLabel.localeCompare(right.displayLabel))
    .slice(0, input.limit);
}

export async function searchMotorCanonicalModels(input: {
  search?: string | null;
  limit?: number | null;
}): Promise<MotorCanonicalModelResult[]> {
  const search = cleanText(input.search);
  if (search.length < 2) return [];

  const limit = Math.max(1, Math.min(50, Math.round(Number(input.limit ?? 20) || 20)));
  const hasAim4ModelKeyColumn = await publicColumnExists('equipment_models', 'aim4_model_key');
  const hasPricingMatrix = await publicTableExists('motor_model_pricing_matrix');
  const hasAliasActiveColumn = await publicColumnExists('equipment_model_aliases', 'is_active');

  if (hasAim4ModelKeyColumn) {
    return searchMotorCanonicalModelsFromNewTables({
      search,
      limit,
      pricingMatrixAvailable: hasPricingMatrix,
      aliasActiveColumnAvailable: hasAliasActiveColumn,
    });
  }

  return searchMotorCanonicalModelsFromLegacyRows({ search, limit, aliasActiveColumnAvailable: hasAliasActiveColumn });
}

function getSelectedMotorTypeFromSpecs(specsJson: Record<string, unknown>, familyKey: string): string {
  return normalizeMotorTypeValue(
    specsJson.type_key ?? specsJson.motor_type ?? extractMotorTypeValue(specsJson, familyKey),
    familyKey,
  );
}

function rowMatchesCanonicalModel(row: MotorModelRow, canonicalModelKey: string): boolean {
  const rowCanonical = deriveMotorCanonicalModelName({
    brandName: row.brandName,
    modelName: row.modelName,
    displayName: row.displayName,
    specsJson: row.specsJson,
  });
  return normalizeMotorKey(rowCanonical) === canonicalModelKey || normalizeMotorKey(row.modelKey) === canonicalModelKey;
}

function filterByExactSpecIfAvailable<T>(
  rows: T[],
  selectedValue: string,
  extractValue: (row: T) => string,
  allowAnyFallback = false,
): T[] {
  if (!selectedValue) return rows;
  const exact = rows.filter((row) => extractValue(row) === selectedValue);
  if (exact.length) return exact;
  if (allowAnyFallback) {
    const anyRows = rows.filter((row) => !extractValue(row));
    if (anyRows.length) return anyRows;
  }
  return rows;
}

function pickReplacementPriceBySpecLevel(prices: number[], specLevel: string): number {
  const sorted = prices.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  if (specLevel === 'entry') return sorted[0];
  if (specLevel === 'luxury') return sorted[sorted.length - 1];
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

export function pickMotorReplacementPriceFromRange(args: {
  min: number | null;
  max: number | null;
  specLevel?: unknown;
}): number | null {
  const min = toNumber(args.min);
  const max = toNumber(args.max);
  if (min === null || max === null) return null;
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const specLevel = normalizeMotorSpecOption(args.specLevel);
  if (specLevel === 'entry') return Math.round(low);
  if (specLevel === 'luxury') return Math.round(high);
  return Math.round((low + high) / 2);
}

function selectedModelKeyFromSpecs(specsJson: Record<string, unknown>): string {
  return cleanText(specsJson.aim4_model_key ?? specsJson.motor_model_key ?? specsJson.model_key);
}

async function resolveModelKeyFromCanonicalModel(input: {
  familyKey: string;
  brandSlug: string;
  typedModelName?: string | null;
  specsJson: Record<string, unknown>;
}): Promise<string> {
  const direct = selectedModelKeyFromSpecs(input.specsJson);
  if (direct) return direct;
  if (!(await publicColumnExists('equipment_models', 'aim4_model_key'))) return '';

  const selectedCanonical =
    cleanText(input.specsJson.motor_canonical_model) ||
    cleanText(input.specsJson.canonical_model) ||
    cleanText(input.specsJson.user_facing_model) ||
    cleanText(input.typedModelName);
  if (!selectedCanonical) return '';

  const db = getDb();
  const result = await db.query<DbRecord>(
    `
      select em.aim4_model_key
      from public.equipment_models em
      join public.equipment_families ef on ef.id = em.equipment_family_id
      join public.sectors s on s.id = ef.sector_id
      join public.brands b on b.id = em.brand_id
      where s.sector_key = 'motor'
        and ef.family_key = $1
        and b.slug = $2
        and coalesce(em.is_active, true) = true
        and coalesce(em.is_generic_fallback, false) = false
        and em.aim4_model_key is not null
        and public.aim4price_normalize_key(coalesce(em.model_name, em.display_name, '')) = public.aim4price_normalize_key($3)
      order by em.id asc
      limit 1
    `,
    [input.familyKey, input.brandSlug, selectedCanonical],
  );

  return cleanText(result.rows[0]?.aim4_model_key);
}

function priceForMatrixRow(row: MotorPricingMatrixRow, specLevel: string): number | null {
  const fallback = row.replacementPriceExVat ?? row.priceMidExVat ?? row.priceLowExVat ?? row.priceHighExVat;
  if (specLevel === 'entry') return row.priceLowExVat ?? fallback;
  if (specLevel === 'luxury') return row.priceHighExVat ?? fallback;
  return row.priceMidExVat ?? fallback;
}

function rangeLowForMatrixRow(row: MotorPricingMatrixRow): number | null {
  return row.priceLowExVat ?? row.replacementPriceExVat ?? row.priceMidExVat ?? row.priceHighExVat;
}

function rangeHighForMatrixRow(row: MotorPricingMatrixRow): number | null {
  return row.priceHighExVat ?? row.replacementPriceExVat ?? row.priceMidExVat ?? row.priceLowExVat;
}

async function findMotorReplacementPriceFromMatrix(input: {
  familyKey: string;
  brandSlug: string;
  typedModelName?: string | null;
  specsJson: Record<string, unknown>;
}): Promise<MotorReplacementPriceMatch | null> {
  const modelKey = await resolveModelKeyFromCanonicalModel(input);
  if (!modelKey) return null;

  const db = getDb();
  const result = await db.query<DbRecord>(
    `
      select
        p.id,
        p.equipment_model_id,
        p.model_key,
        p.type_key,
        p.type_label,
        p.drive_type,
        p.transmission,
        p.spec_level,
        p.replacement_price_ex_vat,
        p.price_low_ex_vat,
        p.price_mid_ex_vat,
        p.price_high_ex_vat,
        em.replacement_price_year,
        p.confidence_score,
        p.source_urls,
        p.source_notes,
        b.name as brand_name
      from public.motor_model_pricing_matrix p
      join public.equipment_models em on em.id = p.equipment_model_id
      join public.equipment_families ef on ef.id = p.equipment_family_id
      join public.sectors s on s.id = p.sector_id
      left join public.brands b on b.id = p.brand_id
      where s.sector_key = 'motor'
        and ef.family_key = $1
        and p.model_key = $2
        and ($3::text = '' or b.slug = $3)
        and coalesce(p.is_active, true) = true
        and coalesce(em.is_active, true) = true
      order by p.confidence_score desc nulls last, p.id asc
    `,
    [input.familyKey, modelKey, input.brandSlug],
  );

  let candidates: MotorPricingMatrixRow[] = (result.rows as DbRecord[]).map((row: DbRecord) => mapPricingMatrixRow(row));
  if (!candidates.length) return null;

  const selectedType = getSelectedMotorTypeFromSpecs(input.specsJson, input.familyKey);
  candidates = filterByExactSpecIfAvailable(
    candidates,
    selectedType,
    (row) => normalizeMotorTypeValue(row.typeKey, input.familyKey),
    true,
  );

  const selectedDrivetrain = normalizeMotorSpecOption(input.specsJson.drivetrain ?? input.specsJson.drive_type);
  candidates = filterByExactSpecIfAvailable(
    candidates,
    selectedDrivetrain,
    (row) => normalizeMotorSpecOption(row.driveType),
    true,
  );

  const selectedTransmission = normalizeMotorSpecOption(input.specsJson.transmission);
  candidates = filterByExactSpecIfAvailable(
    candidates,
    selectedTransmission,
    (row) => normalizeMotorSpecOption(row.transmission),
    true,
  );

  const selectedSpecLevel = normalizeMotorSpecOption(input.specsJson.spec_level ?? input.specsJson.specification_level) || 'mid';
  const specMatched = filterByExactSpecIfAvailable(
    candidates,
    selectedSpecLevel,
    (row) => normalizeMotorSpecOption(row.specLevel),
    false,
  );
  candidates = specMatched.length ? specMatched : candidates;

  const usedPrices = candidates
    .map((row) => priceForMatrixRow(row, selectedSpecLevel))
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  const lowPrices = candidates
    .map(rangeLowForMatrixRow)
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  const highPrices = candidates
    .map(rangeHighForMatrixRow)
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);

  if (!usedPrices.length) return null;

  const replacementPriceMinExVat = Math.round(Math.min(...(lowPrices.length ? lowPrices : usedPrices)));
  const replacementPriceMaxExVat = Math.round(Math.max(...(highPrices.length ? highPrices : usedPrices)));
  const replacementPriceUsedExVat = Math.round(
    pickReplacementPriceBySpecLevel(usedPrices, selectedSpecLevel) ||
      pickMotorReplacementPriceFromRange({ min: replacementPriceMinExVat, max: replacementPriceMaxExVat, specLevel: selectedSpecLevel }) ||
      replacementPriceMinExVat,
  );
  const replacementPriceYear = candidates
    .map((row: MotorPricingMatrixRow) => row.replacementPriceYear)
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((a: number, b: number) => b - a)[0] ?? null;
  const confidenceScore = candidates
    .map((row: MotorPricingMatrixRow) => row.confidenceScore)
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((a: number, b: number) => b - a)[0] ?? null;

  const typeLabel = candidates.find((row: MotorPricingMatrixRow) => normalizeMotorTypeValue(row.typeKey, input.familyKey) === selectedType)?.typeLabel;
  const selectedCanonical =
    cleanText(input.specsJson.motor_canonical_model) ||
    cleanText(input.specsJson.canonical_model) ||
    cleanText(input.typedModelName) ||
    modelKey;

  return {
    replacementPriceMinExVat,
    replacementPriceMaxExVat,
    replacementPriceUsedExVat,
    replacementPriceYear,
    matchedModelCount: candidates.length,
    sourceLabel: [candidates[0]?.brandName, selectedCanonical, typeLabel, selectedSpecLevel].filter(Boolean).join(' • '),
    confidenceScore,
  };
}

async function findMotorReplacementPriceFromLegacyRows(input: {
  familyKey: string;
  brandSlug: string;
  typedModelName?: string | null;
  specsJson: Record<string, unknown>;
}): Promise<MotorReplacementPriceMatch | null> {
  const selectedCanonical =
    cleanText(input.specsJson.motor_canonical_model) ||
    cleanText(input.specsJson.canonical_model) ||
    cleanText(input.typedModelName);
  const canonicalModelKey = normalizeMotorKey(selectedCanonical);
  if (!canonicalModelKey) return null;

  const db = getDb();
  const result = await db.query<DbRecord>(
    `
      select
        em.id,
        coalesce(em.specs_json ->> 'aim4_model_key', '') as aim4_model_key,
        ef.family_key,
        ef.family_label,
        b.id as brand_id,
        b.slug as brand_slug,
        b.name as brand_name,
        em.model_name,
        em.display_name,
        coalesce(em.variant_name, '') as variant_name,
        coalesce(em.specs_json, '{}'::jsonb) as specs_json,
        em.aim4price_replacement_price_ex_vat,
        em.replacement_price_year
      from public.equipment_models em
      join public.equipment_families ef on ef.id = em.equipment_family_id
      join public.sectors s on s.id = ef.sector_id
      join public.brands b on b.id = em.brand_id
      where s.sector_key = 'motor'
        and ef.family_key = $1
        and b.slug = $2
        and coalesce(em.is_active, true) = true
        and coalesce(ef.is_active, true) = true
        and coalesce(s.is_active, true) = true
        and coalesce(b.is_active, true) = true
        and coalesce(em.is_generic_fallback, false) = false
        and em.aim4price_replacement_price_ex_vat is not null
      order by em.model_name asc, em.id asc
      limit 1000
    `,
    [input.familyKey, input.brandSlug],
  );

  let candidates: MotorModelRow[] = result.rows
    .map(mapLegacyRow)
    .filter((row: MotorModelRow) => Boolean(row.replacementPriceExVat && rowMatchesCanonicalModel(row, canonicalModelKey)));
  if (!candidates.length) return null;

  const selectedType = getSelectedMotorTypeFromSpecs(input.specsJson, input.familyKey);
  candidates = filterByExactSpecIfAvailable(candidates, selectedType, (row) => extractMotorTypeValue(row.specsJson, row.familyKey));

  const selectedSpecLevel = normalizeMotorSpecOption(input.specsJson.spec_level ?? input.specsJson.specification_level);
  candidates = filterByExactSpecIfAvailable(candidates, selectedSpecLevel, (row) => normalizeMotorSpecOption(row.specsJson.spec_level ?? row.specsJson.specification_level));

  const selectedDrivetrain = normalizeMotorSpecOption(input.specsJson.drivetrain ?? input.specsJson.drive_type);
  candidates = filterByExactSpecIfAvailable(candidates, selectedDrivetrain, (row) => normalizeMotorSpecOption(row.specsJson.drivetrain ?? row.specsJson.drive_type));

  const selectedTransmission = normalizeMotorSpecOption(input.specsJson.transmission);
  candidates = filterByExactSpecIfAvailable(candidates, selectedTransmission, (row) => normalizeMotorSpecOption(row.specsJson.transmission));

  const prices = candidates
    .map((row) => row.replacementPriceExVat)
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);

  if (!prices.length) return null;

  const replacementPriceMinExVat = Math.round(Math.min(...prices));
  const replacementPriceMaxExVat = Math.round(Math.max(...prices));
  const replacementPriceUsedExVat = Math.round(
    pickReplacementPriceBySpecLevel(prices, selectedSpecLevel || 'mid') ||
      pickMotorReplacementPriceFromRange({ min: replacementPriceMinExVat, max: replacementPriceMaxExVat, specLevel: selectedSpecLevel }) ||
      replacementPriceMinExVat,
  );
  const replacementPriceYear = candidates
    .map((row) => row.replacementPriceYear)
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((a, b) => b - a)[0] ?? null;

  return {
    replacementPriceMinExVat,
    replacementPriceMaxExVat,
    replacementPriceUsedExVat,
    replacementPriceYear,
    matchedModelCount: candidates.length,
    sourceLabel: `${candidates[0]?.brandName ?? ''} ${selectedCanonical}`.trim(),
  };
}

export async function findMotorReplacementPrice(input: {
  familyKey: string;
  brandSlug: string;
  typedModelName?: string | null;
  specsJson: Record<string, unknown>;
}): Promise<MotorReplacementPriceMatch | null> {
  const familyKey = cleanText(input.familyKey);
  const brandSlug = cleanText(input.brandSlug);
  if (!familyKey || !brandSlug) return null;

  if (await publicTableExists('motor_model_pricing_matrix')) {
    const matrixMatch = await findMotorReplacementPriceFromMatrix({ ...input, familyKey, brandSlug });
    if (matrixMatch) return matrixMatch;
  }

  return findMotorReplacementPriceFromLegacyRows({ ...input, familyKey, brandSlug });
}

export async function findMotorUsageProfileSpecs(input: {
  familyKey: string;
  specsJson: Record<string, unknown>;
}): Promise<MotorUsageProfileSpecs | null> {
  const familyKey = cleanText(input.familyKey);
  if (!familyKey || !(await publicTableExists('motor_usage_profiles'))) return null;

  const selectedType = getSelectedMotorTypeFromSpecs(input.specsJson, familyKey);
  const db = getDb();
  const result = await db.query<DbRecord>(
    `
      select
        up.type_key,
        up.expected_annual_km_low,
        up.expected_annual_km_high,
        up.useful_life_km,
        up.high_usage_warning_km,
        up.extreme_usage_warning_km,
        up.hard_input_cap_km,
        up.residual_floor_pct
      from public.motor_usage_profiles up
      join public.equipment_families ef on ef.id = up.equipment_family_id
      join public.sectors s on s.id = up.sector_id
      where s.sector_key = 'motor'
        and ef.family_key = $1
        and coalesce(up.is_active, true) = true
        and (
          $2::text = ''
          or public.aim4price_normalize_key(up.type_key) = public.aim4price_normalize_key($2)
          or public.aim4price_normalize_key(up.type_key) in ('anyunknown', 'any', 'unknown', 'default')
        )
      order by
        case
          when $2::text <> '' and public.aim4price_normalize_key(up.type_key) = public.aim4price_normalize_key($2) then 0
          when public.aim4price_normalize_key(up.type_key) in ('anyunknown', 'any', 'unknown', 'default') then 1
          else 2
        end,
        up.type_key asc
      limit 1
    `,
    [familyKey, selectedType],
  );

  const row = result.rows[0];
  if (!row) return null;

  const usefulLifeKm = toInteger(row.useful_life_km) ?? undefined;
  return {
    motor_usage_profile_type_key: cleanText(row.type_key),
    ...(usefulLifeKm ? { useful_life_km: usefulLifeKm, max_lifetime_km: usefulLifeKm } : {}),
    ...(toInteger(row.expected_annual_km_low) ? { expected_annual_km_low: toInteger(row.expected_annual_km_low) as number } : {}),
    ...(toInteger(row.expected_annual_km_high) ? { expected_annual_km_high: toInteger(row.expected_annual_km_high) as number } : {}),
    ...(toInteger(row.high_usage_warning_km) ? { high_usage_warning_km: toInteger(row.high_usage_warning_km) as number } : {}),
    ...(toInteger(row.extreme_usage_warning_km) ? { extreme_usage_warning_km: toInteger(row.extreme_usage_warning_km) as number } : {}),
    ...(toInteger(row.hard_input_cap_km) ? { hard_input_cap_km: toInteger(row.hard_input_cap_km) as number } : {}),
    ...(toNumber(row.residual_floor_pct) !== null ? { residual_floor_pct: toNumber(row.residual_floor_pct) as number } : {}),
  };
}
