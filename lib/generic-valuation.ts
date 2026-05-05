import { getDb } from './db';
import {
  DEFAULT_ENGINE_FLOOR_PERCENT,
  DEFAULT_FALLBACK_LIFETIME_USED_PERCENT,
  DEFAULT_NON_PROPELLED_FLOOR_PERCENT,
  calculateEngineHoursValue,
  calculatePercentUsedValue,
  clamp,
  currentBaseYear,
  tractorLifetimeHours,
} from './valuation/shared';
import type { CatalogMode, EquipmentFamilyKey, SectorKey, UsageMetricType, ValuationMode } from './equipment-types';

export type GenericCondition = 'excellent' | 'good' | 'fair' | 'used' | 'serious';
export type GenericSelectedMethod = 'aim4price' | 'market';
export type DepreciationMethodUsed = 'full_depreciation' | 'semi_depreciation' | 'percentage_depreciation';
export type ReplacementPriceBasis = 'aim4price' | 'user';

export type GenericValuationCalculation = {
  replacementPriceBasis: ReplacementPriceBasis;
  replacementPriceExVat: number | null;
  depreciationMethodUsed: DepreciationMethodUsed;
  depreciationBaseValueExVat: number | null;
  aim4priceValueExVat: number | null;
  valuationLowExVat: number | null;
  valuationMidExVat: number | null;
  valuationHighExVat: number | null;
  marketWeight: number;
  lifeWorkedPercent: number | null;
  lifeRemainingPercent: number | null;
  estimatedHours: number | null;
  maxLifetimeHours: number | null;
  ageDepPct: number | null;
  usageDepPct: number | null;
  averageDepPct: number | null;
};

export type SpecQuestion = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  familyId: number;
  familyKey: EquipmentFamilyKey;
  specKey: string;
  label: string;
  inputType: 'number' | 'select' | 'boolean' | 'text' | 'money';
  unit: string | null;
  isRequired: boolean;
  affectsValue: boolean;
  useForMarketMatching: boolean;
  sortOrder: number;
  helpText: string | null;
  options: SpecOption[];
};

export type SpecOption = {
  id: number;
  specQuestionId: number;
  optionValue: string;
  optionLabel: string;
  sortOrder: number;
};

export type ReplacementPriceBand = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  familyId: number;
  familyKey: EquipmentFamilyKey;
  brandId: number | null;
  brandSlug: string | null;
  brandName: string | null;
  bandKey: string;
  bandLabel: string;
  specMatchJson: Record<string, unknown>;
  replacementMinExVat: number;
  replacementMaxExVat: number;
  replacementPriceYear: number;
  confidence: number;
  sortOrder: number;
  notes: string | null;
};

export type MarketMatch = {
  id: number;
  title: string;
  brandName: string;
  modelName: string;
  normalizedModelName: string;
  advertisedPriceExVat: number;
  yearModel: number | null;
  usageAmount: number | null;
  condition: string | null;
  sourceName: string;
  sourceUrl: string;
  dateAdvertised: string | null;
  specsJson: Record<string, unknown>;
  matchScore: number;
  matchReason: string;
};

export type GenericValuationInput = {
  sectorKey: SectorKey;
  familyKey: EquipmentFamilyKey;
  brandSlug: string;
  typedModelName?: string | null;
  specsJson?: Record<string, unknown> | null;
  year: number;
  yearModelUnknown?: boolean | null;
  usageAmount?: number | null;
  lifeWorkedPercent?: number | null;
  condition: GenericCondition;
  userReplacementPriceExVat?: number | null;
  userReplacementPriceYear?: number | null;
};

export type GenericValuationResult = {
  catalogModeUsed: CatalogMode;
  sector: { id: number; key: SectorKey; label: string };
  family: {
    id: number;
    key: EquipmentFamilyKey;
    label: string;
    usageMetricType: UsageMetricType;
    valuationMode: ValuationMode;
    isPropelled: boolean;
    catalogMode: CatalogMode;
  };
  brand: { id: number; slug: string; name: string };
  typedModelName: string | null;
  normalizedTypedModelName: string | null;
  specsJson: Record<string, unknown>;
  year: number;
  usageAmount: number | null;
  condition: GenericCondition;
  replacementPriceBand: ReplacementPriceBand | null;
  replacementPriceMinExVat: number | null;
  replacementPriceMaxExVat: number | null;
  replacementPriceUsedExVat: number | null;
  userReplacementPriceExVat: number | null;
  userReplacementPriceYear: number | null;
  replacementPriceBasis: ReplacementPriceBasis;
  depreciationMethodUsed: DepreciationMethodUsed;
  lifeWorkedPercent: number | null;
  lifeRemainingPercent: number | null;
  estimatedHours: number | null;
  maxLifetimeHours: number | null;
  aim4priceReplacementCalculation: GenericValuationCalculation | null;
  userReplacementCalculation: GenericValuationCalculation | null;
  selectedCalculation: GenericValuationCalculation | null;
  genericEstimateExVat: number | null;
  aim4priceValueExVat: number | null;
  marketAverageExVat: number | null;
  marketAverageCount: number;
  marketMatchStrategy: 'exact_model' | 'typed_model' | 'brand_specs' | 'family_specs' | 'none';
  marketSources: MarketMatch[];
  valuationLowExVat: number | null;
  valuationMidExVat: number | null;
  valuationHighExVat: number | null;
  confidenceScore: number;
  confidenceLabel: 'High' | 'Medium' | 'Low';
  notes: string[];
};

type DbRecord = Record<string, unknown>;

type FamilyContext = GenericValuationResult['family'] & {
  sectorId: number;
  sectorKey: SectorKey;
  sectorLabel: string;
};

type BrandContext = GenericValuationResult['brand'];

export function normalizeModelKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

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

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 't', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', 'f', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
}

function asObject(value: unknown): Record<string, unknown> {
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

function roundMoney(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.round(value);
}

function normalizeCondition(value: unknown): GenericCondition {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === 'excellent' || normalized === 'good' || normalized === 'fair' || normalized === 'used' || normalized === 'serious') {
    return normalized;
  }
  return 'good';
}


function coerceSpecValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const numeric = Number(trimmed.replace(',', '.'));
    if (Number.isFinite(numeric) && /^-?\d+(?:[.,]\d+)?$/.test(trimmed)) return numeric;
    if (['true', 'yes', 'y'].includes(trimmed.toLowerCase())) return true;
    if (['false', 'no', 'n'].includes(trimmed.toLowerCase())) return false;
    return trimmed;
  }
  return value;
}

export function normalizeSpecsJson(value: unknown): Record<string, unknown> {
  const source = asObject(value);
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, rawValue]) => [key.trim(), coerceSpecValue(rawValue)] as const)
      .filter(([key, rawValue]) => key && rawValue !== '' && rawValue !== null && typeof rawValue !== 'undefined'),
  );
}

function compareSpecValue(expected: unknown, actual: unknown): boolean {
  if (expected === null || typeof expected === 'undefined') return true;

  if (typeof expected === 'boolean') {
    return toBoolean(actual) === expected;
  }

  const expectedNumber = toNumber(expected);
  const actualNumber = toNumber(actual);

  if (expectedNumber !== null && actualNumber !== null) {
    return Math.abs(expectedNumber - actualNumber) < 0.0001;
  }

  return cleanText(expected).toLowerCase() === cleanText(actual).toLowerCase();
}

function bandMatchesSpecs(band: ReplacementPriceBand, specs: Record<string, unknown>): boolean {
  const criteria = band.specMatchJson;

  for (const [rawKey, expected] of Object.entries(criteria)) {
    if (rawKey.endsWith('_min')) {
      const baseKey = rawKey.slice(0, -4);
      const actual = toNumber(specs[baseKey]);
      const minimum = toNumber(expected);
      if (minimum !== null && (actual === null || actual < minimum)) return false;
      continue;
    }

    if (rawKey.endsWith('_max')) {
      const baseKey = rawKey.slice(0, -4);
      const actual = toNumber(specs[baseKey]);
      const maximum = toNumber(expected);
      if (maximum !== null && (actual === null || actual > maximum)) return false;
      continue;
    }

    if (!compareSpecValue(expected, specs[rawKey])) {
      return false;
    }
  }

  return true;
}

function scoreBand(band: ReplacementPriceBand): number {
  return Object.keys(band.specMatchJson).length * 10 + (band.brandId ? 5 : 0) + band.confidence;
}

type DepreciationInput = {
  replacementPrice: number | null;
  year: number;
  yearModelUnknown?: boolean | null;
  usageAmount: number | null;
  lifeWorkedPercent: number | null;
  usageMetricType: UsageMetricType;
  condition: GenericCondition;
  isPropelled: boolean;
  familyKey: EquipmentFamilyKey;
  specsJson: Record<string, unknown>;
};

function positivePercent(value: unknown): number | null {
  const numeric = toNumber(value);
  if (numeric === null || numeric < 0) return null;
  return clamp(numeric, 0, 100);
}

function positiveHours(value: unknown): number | null {
  const numeric = toNumber(value);
  if (numeric === null || numeric <= 0) return null;
  return Math.round(numeric);
}

function resolveLifeWorkedPercent(input: DepreciationInput, fallbackPercent: number): number {
  const direct = positivePercent(input.lifeWorkedPercent);
  if (direct !== null) return direct;

  const specs = input.specsJson;
  const specPercent =
    positivePercent(specs.life_worked_percent) ??
    positivePercent(specs.worked_percent) ??
    positivePercent(specs.lifetime_worked_percent) ??
    positivePercent(specs.percent_worked) ??
    positivePercent(specs.lifetime_used_percent);

  if (specPercent !== null) return specPercent;
  return clamp(fallbackPercent, 0, 100);
}

function resolveMaxLifetimeHours(input: DepreciationInput): number {
  const specs = input.specsJson;
  const explicit =
    positiveHours(specs.max_lifetime_hours) ??
    positiveHours(specs.expected_lifetime_hours) ??
    positiveHours(specs.lifetime_hours) ??
    positiveHours(specs.design_life_hours);

  if (explicit !== null) return explicit;

  if (input.familyKey === 'tractors') {
    const powerKw = toNumber(specs.power_kw) ?? 75;
    const tractorType = cleanText(specs.tractor_type).toLowerCase() === 'orchard' ? 'orchard' : 'field';
    return tractorLifetimeHours(tractorType, powerKw);
  }

  if (cleanText(input.familyKey).includes('harvester')) return 8_000;
  if (cleanText(input.familyKey).includes('sprayer')) return 8_000;
  if (cleanText(input.familyKey).includes('loader')) return 10_000;
  if (cleanText(input.familyKey).includes('excavator')) return 12_000;
  if (cleanText(input.familyKey).includes('forklift')) return 12_000;

  return 12_000;
}

function spreadForMarketCount(marketAverageCount: number): number {
  if (marketAverageCount >= 3) return 0.12;
  if (marketAverageCount >= 1) return 0.17;
  return 0.22;
}

function marketWeightFor(strategy: GenericValuationResult['marketMatchStrategy'], marketAverageCount: number): number {
  if (marketAverageCount <= 0) return 0;
  if (strategy === 'exact_model') return 0.55;
  if (strategy === 'typed_model') return 0.50;
  if (strategy === 'brand_specs') return 0.42;
  if (strategy === 'family_specs') return 0.28;
  return 0;
}

function resolveDepreciation(input: DepreciationInput): {
  method: DepreciationMethodUsed;
  depreciationBaseValueExVat: number | null;
  lifeWorkedPercent: number | null;
  lifeRemainingPercent: number | null;
  estimatedHours: number | null;
  maxLifetimeHours: number | null;
  ageDepPct: number | null;
  usageDepPct: number | null;
  averageDepPct: number | null;
} {
  if (!input.replacementPrice || input.replacementPrice <= 0) {
    const fallbackMethod: DepreciationMethodUsed = input.isPropelled || input.usageMetricType === 'hours'
      ? 'semi_depreciation'
      : 'percentage_depreciation';

    return {
      method: fallbackMethod,
      depreciationBaseValueExVat: null,
      lifeWorkedPercent: null,
      lifeRemainingPercent: null,
      estimatedHours: null,
      maxLifetimeHours: input.isPropelled || input.usageMetricType === 'hours' ? resolveMaxLifetimeHours(input) : null,
      ageDepPct: null,
      usageDepPct: null,
      averageDepPct: null,
    };
  }

  const yearForDepreciation = input.yearModelUnknown ? currentBaseYear() : Math.round(input.year);

  if (input.isPropelled || input.usageMetricType === 'hours') {
    const maxLifetimeHours = resolveMaxLifetimeHours(input);
    const knownHours = positiveHours(input.usageAmount);

    if (knownHours !== null) {
      const calculated = calculateEngineHoursValue({
        replacementPriceExVat: input.replacementPrice,
        yearModel: yearForDepreciation,
        hours: knownHours,
        condition: input.condition,
        maxLifetimeHours,
        floorPercent: DEFAULT_ENGINE_FLOOR_PERCENT,
      });
      const lifeWorkedPercent = clamp(Math.round((knownHours / maxLifetimeHours) * 100), 0, 100);

      return {
        method: 'full_depreciation',
        depreciationBaseValueExVat: calculated.finalValueExVat,
        lifeWorkedPercent,
        lifeRemainingPercent: 100 - lifeWorkedPercent,
        estimatedHours: knownHours,
        maxLifetimeHours,
        ageDepPct: calculated.ageDepPct,
        usageDepPct: calculated.usageDepPct,
        averageDepPct: calculated.averageDepPct,
      };
    }

    const lifeWorkedPercent = resolveLifeWorkedPercent(input, DEFAULT_FALLBACK_LIFETIME_USED_PERCENT * 100);
    const estimatedHours = Math.round(maxLifetimeHours * (lifeWorkedPercent / 100));
    const calculated = calculateEngineHoursValue({
      replacementPriceExVat: input.replacementPrice,
      yearModel: yearForDepreciation,
      hours: estimatedHours,
      condition: input.condition,
      maxLifetimeHours,
      floorPercent: DEFAULT_ENGINE_FLOOR_PERCENT,
    });

    return {
      method: 'semi_depreciation',
      depreciationBaseValueExVat: calculated.finalValueExVat,
      lifeWorkedPercent,
      lifeRemainingPercent: 100 - lifeWorkedPercent,
      estimatedHours,
      maxLifetimeHours,
      ageDepPct: calculated.ageDepPct,
      usageDepPct: calculated.usageDepPct,
      averageDepPct: calculated.averageDepPct,
    };
  }

  const lifeWorkedPercent = resolveLifeWorkedPercent(input, 50);
  const calculated = calculatePercentUsedValue({
    replacementPriceExVat: input.replacementPrice,
    percentUsed: lifeWorkedPercent,
    condition: input.condition,
    floorPercent: DEFAULT_NON_PROPELLED_FLOOR_PERCENT,
  });

  return {
    method: 'percentage_depreciation',
    depreciationBaseValueExVat: calculated.finalValueExVat,
    lifeWorkedPercent: calculated.percentUsed,
    lifeRemainingPercent: calculated.remainingPercent,
    estimatedHours: null,
    maxLifetimeHours: null,
    ageDepPct: null,
    usageDepPct: calculated.percentUsed,
    averageDepPct: calculated.percentUsed,
  };
}

function buildCalculation(input: DepreciationInput & {
  replacementPriceBasis: ReplacementPriceBasis;
  marketAverageExVat: number | null;
  marketAverageCount: number;
  marketMatchStrategy: GenericValuationResult['marketMatchStrategy'];
}): GenericValuationCalculation {
  const depreciation = resolveDepreciation(input);
  const marketWeight = marketWeightFor(input.marketMatchStrategy, input.marketAverageCount);
  let aim4priceValueExVat = depreciation.depreciationBaseValueExVat;

  if (depreciation.depreciationBaseValueExVat !== null && input.marketAverageExVat !== null && marketWeight > 0) {
    aim4priceValueExVat = roundMoney(
      depreciation.depreciationBaseValueExVat * (1 - marketWeight) + input.marketAverageExVat * marketWeight,
    );
  } else if (depreciation.depreciationBaseValueExVat === null && input.marketAverageExVat !== null) {
    aim4priceValueExVat = input.marketAverageExVat;
  }

  const spread = spreadForMarketCount(input.marketAverageCount);
  const valuationLowExVat = aim4priceValueExVat === null ? null : roundMoney(aim4priceValueExVat * (1 - spread));
  const valuationHighExVat = aim4priceValueExVat === null ? null : roundMoney(aim4priceValueExVat * (1 + spread));

  return {
    replacementPriceBasis: input.replacementPriceBasis,
    replacementPriceExVat: input.replacementPrice,
    depreciationMethodUsed: depreciation.method,
    depreciationBaseValueExVat: depreciation.depreciationBaseValueExVat,
    aim4priceValueExVat,
    valuationLowExVat,
    valuationMidExVat: aim4priceValueExVat,
    valuationHighExVat,
    marketWeight,
    lifeWorkedPercent: depreciation.lifeWorkedPercent,
    lifeRemainingPercent: depreciation.lifeRemainingPercent,
    estimatedHours: depreciation.estimatedHours,
    maxLifetimeHours: depreciation.maxLifetimeHours,
    ageDepPct: depreciation.ageDepPct,
    usageDepPct: depreciation.usageDepPct,
    averageDepPct: depreciation.averageDepPct,
  };
}

function marketAverage(matches: MarketMatch[]): number | null {
  const prices = matches.map((match) => match.advertisedPriceExVat).filter((value) => Number.isFinite(value) && value > 0);
  if (!prices.length) return null;
  return roundMoney(prices.reduce((total, price) => total + price, 0) / prices.length);
}

function confidenceLabelFromMarketCount(count: number): 'High' | 'Medium' | 'Low' {
  if (count > 5) return 'High';
  if (count >= 3) return 'Medium';
  return 'Low';
}

function confidenceScoreFromMarketCount(count: number): number {
  if (count > 5) return 0.82;
  if (count >= 3) return 0.58;
  return 0.28;
}

function confidenceLabel(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 0.74) return 'High';
  if (score >= 0.50) return 'Medium';
  return 'Low';
}

function withinMarketTolerance(match: MarketMatch, targetYear: number | null, targetUsageAmount: number | null): boolean {
  if (targetYear !== null) {
    if (match.yearModel === null || Math.abs(match.yearModel - targetYear) > 2) return false;
  }

  if (targetUsageAmount !== null && targetUsageAmount > 0) {
    if (match.usageAmount === null || Math.abs(match.usageAmount - targetUsageAmount) > 1_000) return false;
  }

  return true;
}

function scoreSpecs(candidateSpecs: Record<string, unknown>, inputSpecs: Record<string, unknown>, questions: SpecQuestion[]): number {
  const keys = questions.filter((question) => question.useForMarketMatching).map((question) => question.specKey);
  const effectiveKeys = keys.length ? keys : Object.keys(inputSpecs);
  if (!effectiveKeys.length) return 0.25;

  let score = 0;
  let considered = 0;

  for (const key of effectiveKeys) {
    const inputValue = inputSpecs[key];
    if (inputValue === null || typeof inputValue === 'undefined' || inputValue === '') continue;
    considered += 1;

    const candidateValue = candidateSpecs[key];
    if (candidateValue === null || typeof candidateValue === 'undefined' || candidateValue === '') continue;

    const inputNumber = toNumber(inputValue);
    const candidateNumber = toNumber(candidateValue);
    if (inputNumber !== null && candidateNumber !== null) {
      const tolerance = Math.max(0.01, Math.abs(inputNumber) * 0.2);
      const delta = Math.abs(inputNumber - candidateNumber);
      score += Math.max(0, 1 - delta / tolerance);
      continue;
    }

    if (compareSpecValue(inputValue, candidateValue)) {
      score += 1;
    }
  }

  if (!considered) return 0.25;
  return Math.max(0, Math.min(1, score / considered));
}

export async function listFamilySpecQuestions(input: {
  sectorKey?: SectorKey | null;
  familyKey: EquipmentFamilyKey;
  includeInactive?: boolean;
}): Promise<SpecQuestion[]> {
  const db = getDb();
  const values: Array<string | boolean> = [input.familyKey];
  const conditions = ['ef.family_key = $1'];

  if (input.sectorKey) {
    values.push(input.sectorKey);
    conditions.push(`s.sector_key = $${values.length}`);
  }

  if (!input.includeInactive) {
    conditions.push('q.is_active = true');
    conditions.push('ef.is_active = true');
    conditions.push('s.is_active = true');
  }

  const result = await db.query<DbRecord>(
    `
      select
        q.id,
        s.id as sector_id,
        s.sector_key,
        ef.id as equipment_family_id,
        ef.family_key,
        q.spec_key,
        q.label,
        q.input_type,
        q.unit,
        q.is_required,
        q.affects_value,
        q.use_for_market_matching,
        q.sort_order,
        q.help_text,
        coalesce(
          json_agg(
            json_build_object(
              'id', o.id,
              'specQuestionId', o.spec_question_id,
              'optionValue', o.option_value,
              'optionLabel', o.option_label,
              'sortOrder', o.sort_order
            )
            order by o.sort_order asc, o.option_label asc
          ) filter (where o.id is not null),
          '[]'::json
        ) as options
      from public.equipment_family_spec_questions q
      join public.equipment_families ef on ef.id = q.equipment_family_id
      join public.sectors s on s.id = ef.sector_id
      left join public.equipment_family_spec_options o
        on o.spec_question_id = q.id
       and ($${values.length + 1}::boolean = true or o.is_active = true)
      where ${conditions.join(' and ')}
      group by q.id, s.id, s.sector_key, ef.id, ef.family_key
      order by q.sort_order asc, q.label asc
    `,
    [...values, Boolean(input.includeInactive)],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    sectorId: Number(row.sector_id),
    sectorKey: cleanText(row.sector_key) as SectorKey,
    familyId: Number(row.equipment_family_id),
    familyKey: cleanText(row.family_key),
    specKey: cleanText(row.spec_key),
    label: cleanText(row.label),
    inputType: (cleanText(row.input_type) || 'text') as SpecQuestion['inputType'],
    unit: cleanText(row.unit) || null,
    isRequired: toBoolean(row.is_required),
    affectsValue: toBoolean(row.affects_value, true),
    useForMarketMatching: toBoolean(row.use_for_market_matching, true),
    sortOrder: toInteger(row.sort_order) ?? 100,
    helpText: cleanText(row.help_text) || null,
    options: Array.isArray(row.options)
      ? row.options.map((option) => ({
          id: Number((option as DbRecord).id),
          specQuestionId: Number((option as DbRecord).specQuestionId),
          optionValue: cleanText((option as DbRecord).optionValue),
          optionLabel: cleanText((option as DbRecord).optionLabel),
          sortOrder: toInteger((option as DbRecord).sortOrder) ?? 100,
        }))
      : [],
  }));
}

async function fetchFamilyContext(sectorKey: SectorKey, familyKey: EquipmentFamilyKey): Promise<FamilyContext | null> {
  const db = getDb();
  const result = await db.query<DbRecord>(
    `
      select
        s.id as sector_id,
        s.sector_key,
        s.sector_label,
        ef.id as family_id,
        ef.family_key,
        ef.family_label,
        ef.usage_metric_type,
        ef.valuation_mode,
        ef.is_propelled,
        coalesce(ef.catalog_mode, 'generic_specs') as catalog_mode
      from public.equipment_families ef
      join public.sectors s on s.id = ef.sector_id
      where s.sector_key = $1
        and ef.family_key = $2
      limit 1
    `,
    [sectorKey, familyKey],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    sectorId: Number(row.sector_id),
    sectorKey: cleanText(row.sector_key) as SectorKey,
    sectorLabel: cleanText(row.sector_label),
    id: Number(row.family_id),
    key: cleanText(row.family_key),
    label: cleanText(row.family_label),
    usageMetricType: (cleanText(row.usage_metric_type) || 'wear_class') as UsageMetricType,
    valuationMode: (cleanText(row.valuation_mode) || 'year_condition') as ValuationMode,
    isPropelled: toBoolean(row.is_propelled),
    catalogMode: (cleanText(row.catalog_mode) || 'generic_specs') as CatalogMode,
  };
}

async function fetchBrandContext(familyId: number, brandSlug: string): Promise<BrandContext | null> {
  const db = getDb();
  const result = await db.query<DbRecord>(
    `
      select b.id, b.slug, b.name
      from public.equipment_family_brands efb
      join public.brands b on b.id = efb.brand_id
      where efb.equipment_family_id = $1
        and b.slug = $2
        and coalesce(efb.is_active, true) = true
        and coalesce(b.is_active, true) = true
      limit 1
    `,
    [familyId, brandSlug],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    slug: cleanText(row.slug),
    name: cleanText(row.name),
  };
}

export async function listReplacementPriceBands(input: {
  sectorKey?: SectorKey | null;
  familyKey: EquipmentFamilyKey;
  brandSlug?: string | null;
  includeInactive?: boolean;
}): Promise<ReplacementPriceBand[]> {
  const db = getDb();
  const values: string[] = [input.familyKey];
  const conditions = ['ef.family_key = $1'];

  if (input.sectorKey) {
    values.push(input.sectorKey);
    conditions.push(`s.sector_key = $${values.length}`);
  }

  if (input.brandSlug) {
    values.push(input.brandSlug);
    conditions.push(`(b.slug = $${values.length} or rpb.brand_id is null)`);
  }

  if (!input.includeInactive) {
    conditions.push('rpb.is_active = true');
    conditions.push('ef.is_active = true');
    conditions.push('s.is_active = true');
  }

  const result = await db.query<DbRecord>(
    `
      select
        rpb.id,
        s.id as sector_id,
        s.sector_key,
        ef.id as family_id,
        ef.family_key,
        b.id as brand_id,
        b.slug as brand_slug,
        b.name as brand_name,
        rpb.band_key,
        rpb.band_label,
        rpb.spec_match_json,
        rpb.replacement_min_ex_vat,
        rpb.replacement_max_ex_vat,
        rpb.replacement_price_year,
        rpb.confidence,
        rpb.sort_order,
        rpb.notes
      from public.replacement_price_bands rpb
      join public.equipment_families ef on ef.id = rpb.equipment_family_id
      join public.sectors s on s.id = ef.sector_id
      left join public.brands b on b.id = rpb.brand_id
      where ${conditions.join(' and ')}
      order by
        case when rpb.brand_id is null then 1 else 0 end,
        rpb.sort_order asc,
        rpb.confidence desc,
        rpb.band_label asc
    `,
    values,
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    sectorId: Number(row.sector_id),
    sectorKey: cleanText(row.sector_key) as SectorKey,
    familyId: Number(row.family_id),
    familyKey: cleanText(row.family_key),
    brandId: toInteger(row.brand_id),
    brandSlug: cleanText(row.brand_slug) || null,
    brandName: cleanText(row.brand_name) || null,
    bandKey: cleanText(row.band_key),
    bandLabel: cleanText(row.band_label),
    specMatchJson: asObject(row.spec_match_json),
    replacementMinExVat: Number(row.replacement_min_ex_vat),
    replacementMaxExVat: Number(row.replacement_max_ex_vat),
    replacementPriceYear: toInteger(row.replacement_price_year) ?? new Date().getFullYear(),
    confidence: toNumber(row.confidence) ?? 0.5,
    sortOrder: toInteger(row.sort_order) ?? 100,
    notes: cleanText(row.notes) || null,
  }));
}

async function findReplacementBand(input: {
  sectorKey: SectorKey;
  familyKey: EquipmentFamilyKey;
  brandSlug: string;
  specsJson: Record<string, unknown>;
}): Promise<ReplacementPriceBand | null> {
  const bands = await listReplacementPriceBands({
    sectorKey: input.sectorKey,
    familyKey: input.familyKey,
    brandSlug: input.brandSlug,
  });

  const matched = bands
    .filter((band) => bandMatchesSpecs(band, input.specsJson))
    .sort((left, right) => scoreBand(right) - scoreBand(left));

  return matched[0] ?? bands.find((band) => Object.keys(band.specMatchJson).length === 0) ?? null;
}

export async function saveModelCandidate(input: {
  sectorKey: SectorKey;
  familyKey: EquipmentFamilyKey;
  brandSlug?: string | null;
  brandNameSnapshot?: string | null;
  rawModelName: string;
  sourceType: 'user_input' | 'market_listing' | 'scraper' | 'admin_import';
  sourceUrl?: string | null;
  specsJson?: Record<string, unknown> | null;
  confidence?: number | null;
  notes?: string | null;
}): Promise<void> {
  const rawModelName = cleanText(input.rawModelName);
  if (!rawModelName) return;

  const normalized = normalizeModelKey(rawModelName);
  if (!normalized) return;

  const db = getDb();
  const params = [
    input.sectorKey,
    input.familyKey,
    input.brandSlug ?? '',
    input.brandNameSnapshot ?? '',
    rawModelName,
    normalized,
    input.sourceType,
    input.sourceUrl ?? '',
    JSON.stringify(normalizeSpecsJson(input.specsJson)),
    Math.max(0.1, Math.min(0.99, Number(input.confidence ?? 0.55))),
    input.notes ?? '',
  ];

  try {
    const updated = await db.query(
      `
        with target as (
          select
            s.id as sector_id,
            ef.id as equipment_family_id,
            b.id as brand_id
          from public.sectors s
          join public.equipment_families ef on ef.sector_id = s.id and ef.family_key = $2
          left join public.brands b on b.slug = nullif($3, '')
          where s.sector_key = $1
          limit 1
        )
        update public.model_candidates mc
        set
          occurrence_count = coalesce(mc.occurrence_count, 0) + 1,
          raw_model_name = $5,
          brand_name_snapshot = coalesce(nullif($4, ''), mc.brand_name_snapshot),
          specs_json = case
            when $9::jsonb = '{}'::jsonb then coalesce(mc.specs_json, '{}'::jsonb)
            else coalesce(mc.specs_json, '{}'::jsonb) || $9::jsonb
          end,
          confidence = greatest(coalesce(mc.confidence, 0), $10),
          source_url = coalesce(nullif($8, ''), mc.source_url),
          notes = coalesce(nullif($11, ''), mc.notes),
          last_seen_at = now(),
          updated_at = now()
        from target
        where mc.equipment_family_id = target.equipment_family_id
          and mc.brand_id is not distinct from target.brand_id
          and mc.normalized_model_name = $6
        returning mc.id
      `,
      params,
    );

    if ((updated.rowCount ?? 0) > 0) return;

    await db.query(
      `
        insert into public.model_candidates (
          sector_id,
          equipment_family_id,
          brand_id,
          brand_name_snapshot,
          raw_model_name,
          normalized_model_name,
          source_type,
          source_url,
          specs_json,
          occurrence_count,
          confidence,
          candidate_status,
          notes,
          first_seen_at,
          last_seen_at,
          created_at,
          updated_at
        )
        select
          target.sector_id,
          target.equipment_family_id,
          target.brand_id,
          nullif($4, ''),
          $5,
          $6,
          $7,
          nullif($8, ''),
          $9::jsonb,
          1,
          $10,
          'pending',
          nullif($11, ''),
          now(),
          now(),
          now(),
          now()
        from (
          select
            s.id as sector_id,
            ef.id as equipment_family_id,
            b.id as brand_id
          from public.sectors s
          join public.equipment_families ef on ef.sector_id = s.id and ef.family_key = $2
          left join public.brands b on b.slug = nullif($3, '')
          where s.sector_key = $1
          limit 1
        ) target
        where not exists (
          select 1
          from public.model_candidates mc
          where mc.equipment_family_id = target.equipment_family_id
            and mc.brand_id is not distinct from target.brand_id
            and mc.normalized_model_name = $6
        )
        on conflict do nothing
      `,
      params,
    );
  } catch (error) {
    console.warn('[Aim4price] Model candidate save skipped so valuation can continue.', error);
  }
}

async function collectTypedModelKeys(input: {
  sectorKey: SectorKey;
  familyKey: EquipmentFamilyKey;
  brandSlug?: string | null;
  typedModelKey: string;
}): Promise<{ keys: string[]; hasApprovedAlias: boolean }> {
  if (!input.typedModelKey) return { keys: [], hasApprovedAlias: false };

  const db = getDb();
  const result = await db.query<DbRecord>(
    `
      select distinct public.aim4price_normalize_key(value) as normalized_key
      from (
        select em.normalized_model_name as value
        from public.equipment_models em
        join public.equipment_families ef on ef.id = em.equipment_family_id
        join public.sectors s on s.id = ef.sector_id
        left join public.brands b on b.id = em.brand_id
        where s.sector_key = $1
          and ef.family_key = $2
          and ($3::text is null or b.slug = $3)
          and public.aim4price_normalize_key(em.normalized_model_name) = $4

        union all

        select em.normalized_model_name as value
        from public.equipment_model_aliases ema
        join public.equipment_models em on em.id = ema.equipment_model_id
        join public.equipment_families ef on ef.id = em.equipment_family_id
        join public.sectors s on s.id = ef.sector_id
        left join public.brands b on b.id = em.brand_id
        where s.sector_key = $1
          and ef.family_key = $2
          and ($3::text is null or b.slug = $3)
          and public.aim4price_normalize_key(ema.normalized_alias) = $4

        union all

        select ema.normalized_alias as value
        from public.equipment_model_aliases ema
        join public.equipment_models em on em.id = ema.equipment_model_id
        join public.equipment_families ef on ef.id = em.equipment_family_id
        join public.sectors s on s.id = ef.sector_id
        left join public.brands b on b.id = em.brand_id
        where s.sector_key = $1
          and ef.family_key = $2
          and ($3::text is null or b.slug = $3)
          and em.id in (
            select em2.id
            from public.equipment_model_aliases ema2
            join public.equipment_models em2 on em2.id = ema2.equipment_model_id
            where public.aim4price_normalize_key(ema2.normalized_alias) = $4
               or public.aim4price_normalize_key(em2.normalized_model_name) = $4
          )
      ) aliases
      where value is not null and btrim(value) <> ''
    `,
    [input.sectorKey, input.familyKey, input.brandSlug || null, input.typedModelKey],
  );

  const keys = new Set<string>([input.typedModelKey]);
  for (const row of result.rows) {
    const key = normalizeModelKey(row.normalized_key);
    if (key) keys.add(key);
  }

  return { keys: [...keys], hasApprovedAlias: result.rows.length > 0 };
}

export async function findMarketVaultMatches(input: {
  sectorKey: SectorKey;
  familyKey: EquipmentFamilyKey;
  brandSlug?: string | null;
  typedModelName?: string | null;
  specsJson?: Record<string, unknown> | null;
  questions?: SpecQuestion[];
  targetYear?: number | null;
  targetUsageAmount?: number | null;
  limit?: number;
}): Promise<{ strategy: GenericValuationResult['marketMatchStrategy']; matches: MarketMatch[] }> {
  const db = getDb();
  const specsJson = normalizeSpecsJson(input.specsJson);
  const typedModelKey = normalizeModelKey(input.typedModelName);
  const limit = Math.min(50, Math.max(5, Math.round(Number(input.limit) || 12)));
  const targetYear = toInteger(input.targetYear);
  const targetUsageAmount = toNumber(input.targetUsageAmount);

  if (typedModelKey) {
    const typedModelKeys = await collectTypedModelKeys({
      sectorKey: input.sectorKey,
      familyKey: input.familyKey,
      brandSlug: input.brandSlug,
      typedModelKey,
    });
    const exact = await db.query<DbRecord>(
      `
        select
          mvl.id,
          coalesce(mvl.title, concat_ws(' ', mvl.brand_name, mvl.model_name, mvl.model_name_raw)) as title,
          coalesce(b.name, mvl.brand_name_snapshot, mvl.brand_name, '') as brand_name,
          coalesce(mvl.model_name_raw, mvl.model_name, '') as model_name,
          coalesce(mvl.normalized_model_name, public.aim4price_normalize_key(coalesce(mvl.model_name_raw, mvl.model_name, ''))) as normalized_model_name,
          mvl.advertised_price_ex_vat,
          mvl.year_model,
          coalesce(mvl.usage_amount, mvl.hours) as usage_amount,
          mvl.condition,
          mvl.source_name,
          mvl.source_url,
          mvl.date_advertised,
          mvl.specs_json
        from public.market_vault_listings mvl
        join public.equipment_families ef on ef.id = mvl.equipment_family_id
        join public.sectors s on s.id = ef.sector_id
        left join public.brands b on b.id = mvl.brand_id
        where s.sector_key = $1
          and ef.family_key = $2
          and coalesce(mvl.is_sold, false) = false
          and mvl.advertised_price_ex_vat is not null
          and mvl.advertised_price_ex_vat > 0
          and coalesce(mvl.normalized_model_name, public.aim4price_normalize_key(coalesce(mvl.model_name_raw, mvl.model_name, ''))) = any($3::text[])
        order by mvl.date_advertised desc nulls last, mvl.id desc
        limit $4
      `,
      [input.sectorKey, input.familyKey, typedModelKeys.keys, limit],
    );

    if (exact.rows.length) {
      const exactMatches = exact.rows
        .map((row) => mapMarketRow(row, 1, typedModelKeys.hasApprovedAlias ? 'Typed model or approved alias match' : 'Exact typed model match'))
        .filter((match) => withinMarketTolerance(match, targetYear, targetUsageAmount));

      if (exactMatches.length) {
        return {
          strategy: typedModelKeys.hasApprovedAlias ? 'typed_model' : 'exact_model',
          matches: exactMatches,
        };
      }
    }
  }

  const values: unknown[] = [input.sectorKey, input.familyKey, limit * 4];
  const brandCondition = input.brandSlug ? 'and b.slug = $4' : '';
  if (input.brandSlug) values.push(input.brandSlug);

  const candidates = await db.query<DbRecord>(
    `
      select
        mvl.id,
        coalesce(mvl.title, concat_ws(' ', mvl.brand_name, mvl.model_name, mvl.model_name_raw)) as title,
        coalesce(b.name, mvl.brand_name_snapshot, mvl.brand_name, '') as brand_name,
        coalesce(mvl.model_name_raw, mvl.model_name, '') as model_name,
        coalesce(mvl.normalized_model_name, public.aim4price_normalize_key(coalesce(mvl.model_name_raw, mvl.model_name, ''))) as normalized_model_name,
        mvl.advertised_price_ex_vat,
        mvl.year_model,
        coalesce(mvl.usage_amount, mvl.hours) as usage_amount,
        mvl.condition,
        mvl.source_name,
        mvl.source_url,
        mvl.date_advertised,
        mvl.specs_json
      from public.market_vault_listings mvl
      join public.equipment_families ef on ef.id = mvl.equipment_family_id
      join public.sectors s on s.id = ef.sector_id
      left join public.brands b on b.id = coalesce(mvl.brand_id, (select id from public.brands where lower(name) = lower(mvl.brand_name) limit 1))
      where s.sector_key = $1
        and ef.family_key = $2
        and coalesce(mvl.is_sold, false) = false
        and mvl.advertised_price_ex_vat is not null
        and mvl.advertised_price_ex_vat > 0
        ${brandCondition}
      order by mvl.date_advertised desc nulls last, mvl.id desc
      limit $3
    `,
    values,
  );

  const questions = input.questions ?? (await listFamilySpecQuestions({ sectorKey: input.sectorKey, familyKey: input.familyKey, includeInactive: true }));
  const scored = candidates.rows
    .map((row) => {
      const candidateSpecs = normalizeSpecsJson(row.specs_json);
      const score = scoreSpecs(candidateSpecs, specsJson, questions);
      return mapMarketRow(row, score, input.brandSlug ? 'Brand + similar specs' : 'Family + similar specs');
    })
    .filter((match) => match.matchScore >= 0.45 || Object.keys(specsJson).length === 0)
    .filter((match) => withinMarketTolerance(match, targetYear, targetUsageAmount))
    .sort((left, right) => right.matchScore - left.matchScore || right.id - left.id)
    .slice(0, limit);

  if (scored.length) {
    return {
      strategy: input.brandSlug ? 'brand_specs' : 'family_specs',
      matches: scored,
    };
  }

  if (input.brandSlug) {
    return findMarketVaultMatches({ ...input, brandSlug: null, limit });
  }

  return { strategy: 'none', matches: [] };
}

function mapMarketRow(row: DbRecord, matchScore: number, matchReason: string): MarketMatch {
  return {
    id: Number(row.id),
    title: cleanText(row.title),
    brandName: cleanText(row.brand_name),
    modelName: cleanText(row.model_name),
    normalizedModelName: cleanText(row.normalized_model_name),
    advertisedPriceExVat: Number(row.advertised_price_ex_vat) || 0,
    yearModel: toInteger(row.year_model),
    usageAmount: toNumber(row.usage_amount),
    condition: cleanText(row.condition) || null,
    sourceName: cleanText(row.source_name),
    sourceUrl: cleanText(row.source_url),
    dateAdvertised: cleanText(row.date_advertised) || null,
    specsJson: normalizeSpecsJson(row.specs_json),
    matchScore,
    matchReason,
  };
}

export async function runGenericValuation(input: GenericValuationInput): Promise<GenericValuationResult> {
  const rawSpecsJson = normalizeSpecsJson(input.specsJson);
  const lifeWorkedPercent = positivePercent(input.lifeWorkedPercent);
  const specsJson = {
    ...rawSpecsJson,
    ...(lifeWorkedPercent !== null ? { life_worked_percent: lifeWorkedPercent } : {}),
    ...(input.yearModelUnknown ? { year_model_unknown: true } : {}),
  };

  const family = await fetchFamilyContext(input.sectorKey, input.familyKey);
  if (!family) throw new Error('FAMILY_NOT_FOUND');

  const brand = await fetchBrandContext(family.id, input.brandSlug);
  if (!brand) throw new Error('BRAND_NOT_FOUND_FOR_FAMILY');

  const typedModelName = cleanText(input.typedModelName) || null;
  const normalizedTypedModelName = typedModelName ? normalizeModelKey(typedModelName) : null;
  const userReplacementPriceExVatRaw = toNumber(input.userReplacementPriceExVat);
  const userReplacementPriceExVat = userReplacementPriceExVatRaw && userReplacementPriceExVatRaw > 0 ? userReplacementPriceExVatRaw : null;
  const userReplacementPriceYear = toInteger(input.userReplacementPriceYear) ?? null;
  const replacementBand = await findReplacementBand({
    sectorKey: input.sectorKey,
    familyKey: input.familyKey,
    brandSlug: input.brandSlug,
    specsJson,
  });

  const replacementPriceMinExVat = replacementBand?.replacementMinExVat ?? null;
  const replacementPriceMaxExVat = replacementBand?.replacementMaxExVat ?? null;
  const bandMid =
    replacementPriceMinExVat !== null && replacementPriceMaxExVat !== null
      ? Math.round((replacementPriceMinExVat + replacementPriceMaxExVat) / 2)
      : null;

  const questions = await listFamilySpecQuestions({ sectorKey: input.sectorKey, familyKey: input.familyKey, includeInactive: true });
  const market = await findMarketVaultMatches({
    sectorKey: input.sectorKey,
    familyKey: input.familyKey,
    brandSlug: input.brandSlug,
    typedModelName,
    specsJson,
    questions,
    targetYear: input.yearModelUnknown ? null : input.year,
    targetUsageAmount: input.usageAmount ?? null,
    limit: 12,
  });
  const marketAverageExVat = marketAverage(market.matches);
  const marketAverageCount = market.matches.length;

  const commonCalculationInput = {
    year: input.year,
    yearModelUnknown: input.yearModelUnknown,
    usageAmount: toNumber(input.usageAmount),
    lifeWorkedPercent,
    usageMetricType: family.usageMetricType,
    condition: normalizeCondition(input.condition),
    isPropelled: family.isPropelled,
    familyKey: family.key,
    specsJson,
    marketAverageExVat,
    marketAverageCount,
    marketMatchStrategy: market.strategy,
  };

  const aim4priceReplacementCalculation = buildCalculation({
    ...commonCalculationInput,
    replacementPriceBasis: 'aim4price',
    replacementPrice: bandMid,
  });
  const userReplacementCalculation = userReplacementPriceExVat
    ? buildCalculation({
        ...commonCalculationInput,
        replacementPriceBasis: 'user',
        replacementPrice: userReplacementPriceExVat,
      })
    : null;

  const selectedCalculation = userReplacementCalculation ?? aim4priceReplacementCalculation;
  const replacementPriceBasis = selectedCalculation.replacementPriceBasis;
  const replacementPriceUsedExVat = selectedCalculation.replacementPriceExVat;
  const genericEstimateExVat = selectedCalculation.depreciationBaseValueExVat;
  const aim4priceValueExVat = selectedCalculation.aim4priceValueExVat;
  const valuationLowExVat = selectedCalculation.valuationLowExVat;
  const valuationMidExVat = selectedCalculation.valuationMidExVat;
  const valuationHighExVat = selectedCalculation.valuationHighExVat;

  const confidenceScore = confidenceScoreFromMarketCount(marketAverageCount);
  const calculatedConfidenceLabel = confidenceLabelFromMarketCount(marketAverageCount);

  const notes: string[] = [];
  if (!replacementBand && !userReplacementPriceExVat) notes.push('No replacement price band matched yet. Add a band or enter a user replacement price.');
  if (typedModelName && market.strategy !== 'exact_model') notes.push('No exact model market match found. Using broader brand/family spec evidence.');
  if (!marketAverageCount) notes.push('No marketplace average found yet. Aim4price used replacement price and depreciation only.');

  if (selectedCalculation.depreciationMethodUsed === 'full_depreciation') {
    notes.push('Full depreciation used: year, engine hours and condition.');
  } else if (selectedCalculation.depreciationMethodUsed === 'semi_depreciation') {
    notes.push(
      `Semi depreciation used: hours were estimated from ${selectedCalculation.lifeWorkedPercent ?? 0}% worked of ${selectedCalculation.maxLifetimeHours ?? 0} lifetime hours.`,
    );
  } else {
    notes.push('Percentage depreciation used: valuation is based on how much the equipment has worked, then adjusted for condition.');
  }

  if (input.yearModelUnknown) {
    notes.push('Year model was marked unknown, so year was not used as the main depreciation driver.');
  }

  if (userReplacementCalculation && userReplacementPriceExVat) {
    if (bandMid && bandMid > 0) {
      const differencePct = Math.round(((userReplacementPriceExVat - bandMid) / bandMid) * 100);
      notes.push(
        `User replacement price was used. It is ${Math.abs(differencePct)}% ${differencePct >= 0 ? 'higher' : 'lower'} than the Aim4price replacement estimate.`,
      );
    } else {
      notes.push('User replacement price was used because no Aim4price replacement band was available.');
    }
  }

  if (typedModelName) {
    await saveModelCandidate({
      sectorKey: input.sectorKey,
      familyKey: input.familyKey,
      brandSlug: input.brandSlug,
      brandNameSnapshot: brand.name,
      rawModelName: typedModelName,
      sourceType: 'user_input',
      specsJson,
      confidence: market.strategy === 'exact_model' ? 0.8 : 0.55,
    });
  }

  return {
    catalogModeUsed: family.catalogMode === 'hybrid' ? 'generic_specs' : family.catalogMode,
    sector: { id: family.sectorId, key: family.sectorKey, label: family.sectorLabel },
    family,
    brand,
    typedModelName,
    normalizedTypedModelName,
    specsJson,
    year: Math.round(input.year),
    usageAmount: toNumber(input.usageAmount),
    condition: normalizeCondition(input.condition),
    replacementPriceBand: replacementBand,
    replacementPriceMinExVat,
    replacementPriceMaxExVat,
    replacementPriceUsedExVat,
    userReplacementPriceExVat,
    userReplacementPriceYear,
    replacementPriceBasis,
    depreciationMethodUsed: selectedCalculation.depreciationMethodUsed,
    lifeWorkedPercent: selectedCalculation.lifeWorkedPercent,
    lifeRemainingPercent: selectedCalculation.lifeRemainingPercent,
    estimatedHours: selectedCalculation.estimatedHours,
    maxLifetimeHours: selectedCalculation.maxLifetimeHours,
    aim4priceReplacementCalculation,
    userReplacementCalculation,
    selectedCalculation,
    genericEstimateExVat,
    aim4priceValueExVat,
    marketAverageExVat,
    marketAverageCount,
    marketMatchStrategy: market.strategy,
    marketSources: market.matches,
    valuationLowExVat,
    valuationMidExVat,
    valuationHighExVat,
    confidenceScore,
    confidenceLabel: calculatedConfidenceLabel,
    notes,
  };
}
export function getGenericSelectedMethodValue(result: GenericValuationResult, method: GenericSelectedMethod): number | null {
  if (method === 'market') return result.marketAverageExVat;
  return result.valuationMidExVat ?? result.aim4priceValueExVat;
}
