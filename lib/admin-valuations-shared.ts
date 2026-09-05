export type AdminValuationRecordType = 'estimate' | 'saved';
export type AdminValuationMode = 'tractor' | 'generic' | 'unknown';
export type AdminValuationRecordFilter = 'all' | AdminValuationRecordType;
export type AdminValuationModeFilter = 'all' | AdminValuationMode;
export type AdminValuationAccountFilter = 'all' | 'known' | 'unknown';
export type AdminValuationSort =
  | 'latest'
  | 'oldest'
  | 'value-high'
  | 'value-low'
  | 'account'
  | 'asset';

export type AdminValuationAccount = {
  userId: string | null;
  known: boolean;
  label: string;
  name: string;
  businessName: string;
  email: string;
  accountType: string;
  accountStatus: string;
};

export type AdminValuationAsset = {
  sectorKey: string;
  sectorLabel: string;
  familyKey: string;
  familyLabel: string;
  brandName: string;
  modelName: string;
  yearModel: number | null;
  condition: string;
  usageAmount: number | null;
  usageUnit: string;
};

export type AdminValuationEstimate = {
  selectedValueExVat: number | null;
  lowValueExVat: number | null;
  midValueExVat: number | null;
  highValueExVat: number | null;
  replacementPriceExVat: number | null;
  confidenceLabel: string;
};

export type AdminValuationRecord = {
  id: string;
  sourceId: string;
  recordType: AdminValuationRecordType;
  valuationMode: AdminValuationMode;
  source: string;
  createdAtIso: string;
  account: AdminValuationAccount;
  asset: AdminValuationAsset;
  estimate: AdminValuationEstimate;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

export type AdminValuationSummary = {
  totalValuations: number;
  estimateEvents: number;
  savedValuations: number;
  knownAccountValuations: number;
  unknownAccountValuations: number;
  uniqueAccounts: number;
  valuedValuations: number;
};

export type AdminValuationFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type AdminValuationOptions = {
  sectors: AdminValuationFilterOption[];
  years: AdminValuationFilterOption[];
};

export type AdminValuationFilters = {
  search: string;
  recordType: AdminValuationRecordFilter;
  valuationMode: AdminValuationModeFilter;
  account: AdminValuationAccountFilter;
  sector: string;
  period: string;
  sort: AdminValuationSort;
  page: number;
  pageSize: number;
};

export type AdminValuationReport = {
  generatedAtIso: string;
  valuations: AdminValuationRecord[];
  summary: AdminValuationSummary;
  options: AdminValuationOptions;
  filters: AdminValuationFilters;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
};

export const ADMIN_VALUATION_PAGE_SIZES = [25, 50, 100] as const;

// The Admin valuation ledger was deliberately restarted at 02:00 SAST on
// 26 August 2026. Earlier rows are permanently removed by migration 92 and
// excluded here as a deployment-safe guard until that migration is applied.
export const ADMIN_VALUATION_HISTORY_START_ISO = '2026-08-26T00:00:00.000Z';
export const ADMIN_VALUATION_DELETE_LIMIT = 500;

export type AdminValuationDeletionResult = {
  requestedCount: number;
  deletedCount: number;
  deletedEstimateEvents: number;
  deletedSavedValuations: number;
  notFoundCount: number;
};

export function normalizeAdminValuationDeleteIds(input: unknown): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('ADMIN_VALUATION_DELETE_IDS_REQUIRED');
  }
  if (input.length > ADMIN_VALUATION_DELETE_LIMIT) {
    throw new Error('ADMIN_VALUATION_DELETE_LIMIT_EXCEEDED');
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const rawId of input) {
    const id = String(rawId ?? '').trim();
    if (!/^(estimate|saved):[1-9][0-9]*$/.test(id)) {
      throw new Error('ADMIN_VALUATION_DELETE_ID_INVALID');
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export type AdminValuationDetailRow = {
  label: string;
  value: string;
};

export type AdminValuationDetailSection = {
  id: string;
  title: string;
  description: string;
  rows: AdminValuationDetailRow[];
};

const DETAIL_FIELD_LABELS: Record<string, string> = {
  sectorKey: 'Sector',
  familyKey: 'Asset type',
  brandSlug: 'Brand reference',
  brandName: 'Brand',
  equipmentModelId: 'Catalog model ID',
  modelId: 'Catalog model ID',
  typedModelName: 'Model entered',
  normalizedTypedModelName: 'Normalized model',
  catalogModeUsed: 'Estimate path',
  equipmentType: 'Equipment type',
  tractorType: 'Tractor type',
  driveType: 'Drive',
  cabType: 'Cab',
  powerKw: 'Power',
  saveModelCandidate: 'New model submitted',
  displayYearModel: 'Year model entered',
  display_year_model: 'Year model entered',
  yearModel: 'Year model',
  year_model: 'Year model',
  yearModelUnknown: 'Year model unknown',
  year_model_unknown: 'Year model unknown',
  usageMode: 'Usage method',
  usage_mode: 'Usage method',
  usageAmount: 'Usage entered',
  usage_amount: 'Usage entered',
  lifeWorkedPercent: 'Life worked',
  life_worked_percent: 'Life worked',
  condition: 'Overall condition',
  mechanicalCondition: 'Mechanical condition',
  bodyCondition: 'Body / frame / structure',
  tyreCondition: 'Tyres / wear components',
  serviceHistory: 'Service history',
  requiredWork: 'Required work',
  conditionFactorPercent: 'Condition retained value',
  popularityStars: 'Popularity',
  maxLifetimeUsage: 'Expected lifetime usage',
  maxLifetimeHours: 'Expected lifetime hours',
  frontPto: 'Front PTO selected',
  frontLoader: 'Front Loader selected',
  frontLoaderYear: 'Front Loader year',
  gpsEnabled: 'GPS selected',
  gpsType: 'GPS type',
  gpsYear: 'GPS year',
  frontPtoReplacementPriceExVat: 'Front PTO replacement price excl. VAT',
  frontLoaderReplacementPriceExVat: 'Front Loader replacement price excl. VAT',
  gpsReplacementPriceExVat: 'GPS replacement price excl. VAT',
  otherExtraName: 'Other extra',
  otherExtraReplacementPriceExVat: 'Other extra replacement price excl. VAT',
  otherExtraValueExVat: 'Other extra value excl. VAT',
  userReplacementPriceExVat: 'Replacement price entered excl. VAT',
  userReplacementPriceYear: 'Replacement price year',
  selectedValueExVat: 'Selected estimate excl. VAT',
  selectedMethod: 'Selected estimate method',
  aim4priceValueExVat: 'Aim4price estimate excl. VAT',
  genericEstimateExVat: 'General estimate excl. VAT',
  previewValueExVat: 'Preview estimate excl. VAT',
  valuationLowExVat: 'Estimated low excl. VAT',
  valuationMidExVat: 'Estimated midpoint excl. VAT',
  valuationHighExVat: 'Estimated high excl. VAT',
  marketLowExVat: 'Market low excl. VAT',
  marketMidExVat: 'Market midpoint excl. VAT',
  marketHighExVat: 'Market high excl. VAT',
  marketLow: 'Market low excl. VAT',
  marketMid: 'Market midpoint excl. VAT',
  marketHigh: 'Market high excl. VAT',
  replacementPriceUsedExVat: 'Asset replacement price used excl. VAT',
  totalReplacementPriceUsedExVat: 'Total replacement price used excl. VAT',
  replacementPriceMinExVat: 'Replacement-price low excl. VAT',
  replacementPriceMaxExVat: 'Replacement-price high excl. VAT',
  extrasValueExVat: 'Total extras value excl. VAT',
  frontPtoValueExVat: 'Front PTO value added excl. VAT',
  frontLoaderValueExVat: 'Front Loader value added excl. VAT',
  gpsValueExVat: 'GPS value added excl. VAT',
  replacementPriceBasis: 'Replacement-price basis',
  depreciationMethodUsed: 'Depreciation method',
  lifeRemainingPercent: 'Life remaining',
  estimatedHours: 'Estimated hours',
  ageDepPct: 'Age depreciation',
  usageDepPct: 'Usage depreciation',
  averageDepPct: 'Average depreciation',
  marketabilityFactor: 'Marketability factor',
  marketabilityReductionPercent: 'Marketability reduction',
  salvagePercent: 'Salvage percentage',
  salvageValueExVat: 'Salvage value excl. VAT',
  isSalvageEstimate: 'Salvage estimate',
  confidenceScore: 'Confidence score',
  confidenceLabel: 'Confidence',
  coverageBand: 'Coverage band',
  marketAverageExVat: 'Market average excl. VAT',
  marketAverageCount: 'Market matches',
  marketCount: 'Market matches',
};

const DETAIL_VALUE_LABELS: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  used: 'Used',
  serious: 'Requires Attention',
  average: 'Average',
  below_average: 'Below average',
  poor: 'Poor',
  damaged: 'Damaged',
  '75_100': '75-100%',
  '50_75': '50-75%',
  '25_50': '25-50%',
  below_25: 'Below 25%',
  replacement_required: 'Replace',
  complete_verified: 'Complete',
  partial: 'Partial',
  owner_recorded: 'Owner-recorded',
  none: 'None',
  unknown: 'Unknown',
  ready: 'Ready to use',
  minor: 'Minor',
  moderate: 'Moderate',
  significant: 'Significant',
  major: 'Major repairs',
  'full-autosteer': 'Full autosteer',
  'guidance-only': 'Guidance only',
  cab: 'Cab',
  'open-station': 'Open station',
  '2wd': '2WD',
  '4wd': '4WD',
  tracks: 'Tracks',
  field: 'Field',
  orchard: 'Orchard',
  exact_model: 'Exact model',
  generic_specs: 'General asset specifications',
  hybrid_generic: 'General asset specifications',
  percentage_depreciation: 'Percentage worked',
  full_depreciation: 'Age and usage depreciation',
  semi_depreciation: 'Age and condition depreciation',
  aim4price: 'Aim4price saved price',
  user: 'User-entered price',
  percent: 'Percentage worked',
  hours: 'Hours',
  km: 'Kilometres',
  reading: 'Usage reading',
  red: 'Limited data',
  amber: 'Moderate data',
  green: 'Strong data',
};

const INPUT_ASSET_KEYS = [
  'sectorKey', 'familyKey', 'brandSlug', 'brandName', 'equipmentModelId', 'modelId',
  'typedModelName', 'modelName', 'normalizedTypedModelName', 'catalogModeUsed',
  'equipmentType', 'tractorType', 'driveType', 'cabType', 'powerKw',
  'saveModelCandidate', 'year', 'yearModel', 'year_model', 'displayYearModel',
  'display_year_model', 'yearModelUnknown', 'year_model_unknown',
] as const;
const INPUT_USAGE_KEYS = [
  'usageMode', 'usage_mode', 'usageAmount', 'usage_amount', 'hours',
  'lifeWorkedPercent', 'life_worked_percent', 'condition',
] as const;
const INPUT_REPLACEMENT_KEYS = [
  'frontPto', 'frontLoader', 'frontLoaderYear', 'gpsEnabled', 'gpsType', 'gpsYear',
  'frontPtoReplacementPriceExVat', 'frontLoaderReplacementPriceExVat',
  'gpsReplacementPriceExVat', 'otherExtraName', 'otherExtraReplacementPriceExVat',
  'otherExtraValueExVat', 'userReplacementPriceExVat', 'userReplacementPriceYear',
] as const;

function isDetailObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasDetailValue(value: unknown): boolean {
  return value !== null && typeof value !== 'undefined' && !(typeof value === 'string' && !value.trim());
}

function detailBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['true', '1', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}

function firstRecordedValue(source: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && hasDetailValue(source[key])) {
      return source[key];
    }
  }
  return undefined;
}

function splitDetailKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(id|vat|gps|pto|km|hp|kw|url)\b/gi, (part) => part.toUpperCase())
    .replace(/\b\w/g, (part) => part.toUpperCase());
}

function detailFieldLabel(path: string[]): string {
  return path
    .map((key) => DETAIL_FIELD_LABELS[key] ?? splitDetailKey(key))
    .join(' / ');
}

function detailKey(path: string[]): string {
  return path[path.length - 1] ?? '';
}

function isPercentDetail(path: string[]): boolean {
  return /(percent|pct)$/i.test(detailKey(path));
}

function isMoneyDetail(path: string[]): boolean {
  const key = detailKey(path);
  if (/(percent|pct|year|count|hours?|usage|life|score|rating|stars?|id|power|capacity|width|rows?)$/i.test(key)) {
    return false;
  }
  return /(exvat|incvat|price|value|cost|salvage)/i.test(key);
}

function formatDetailNumber(value: number, path: string[]): string {
  const key = detailKey(path);
  const normalizedKey = key.replace(/[_\s-]+/g, '');
  if (isMoneyDetail(path)) return formatAdminValuationMoney(value);
  if (isPercentDetail(path)) {
    return `${new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 }).format(value)}%`;
  }
  if (/year/i.test(key)) return String(Math.round(value));
  const formatted = new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 }).format(value);
  if (/hours?$/i.test(key)) return `${formatted} hours`;
  if (/powerkw$/i.test(normalizedKey)) return `${formatted} kW`;
  if (/(powerhp|horsepowerhp)$/i.test(normalizedKey)) return `${formatted} hp`;
  if (/(workingwidthm|widthm)$/i.test(normalizedKey)) return `${formatted} m`;
  if (/(tankcapacityl|capacityl)$/i.test(normalizedKey)) return `${formatted} L`;
  return formatted;
}

export function formatAdminValuationDetailValue(value: unknown, path: string[] = []): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return formatDetailNumber(value, path);
  if (Array.isArray(value)) {
    if (!value.length) return 'None';
    if (value.every((item) => !isDetailObject(item) && !Array.isArray(item))) {
      return value.map((item) => formatAdminValuationDetailValue(item, path)).join(', ');
    }
    return `${value.length.toLocaleString('en-ZA')} recorded item${value.length === 1 ? '' : 's'}`;
  }
  const raw = String(value ?? '').trim();
  return DETAIL_VALUE_LABELS[raw.toLowerCase()] ?? raw;
}

export function flattenAdminValuationDetails(
  source: unknown,
  prefix: string[] = [],
  limit = 800,
): AdminValuationDetailRow[] {
  const rows: AdminValuationDetailRow[] = [];

  function visit(value: unknown, path: string[], depth: number) {
    if (rows.length >= limit || !hasDetailValue(value)) return;
    if (Array.isArray(value)) {
      if (!value.length) {
        rows.push({ label: detailFieldLabel(path), value: 'None' });
        return;
      }
      value.forEach((item, index) => visit(item, [...path, `Item ${index + 1}`], depth + 1));
      return;
    }
    if (isDetailObject(value) && depth < 8) {
      const entries = Object.entries(value);
      if (!entries.length) return;
      entries.forEach(([key, nested]) => visit(nested, [...path, key], depth + 1));
      return;
    }
    const formatted = formatAdminValuationDetailValue(value, path);
    if (formatted) rows.push({ label: detailFieldLabel(path), value: formatted });
  }

  if (isDetailObject(source)) {
    Object.entries(source).forEach(([key, value]) => visit(value, [...prefix, key], 0));
  } else if (Array.isArray(source)) {
    source.forEach((value, index) => visit(value, [...prefix, `Item ${index + 1}`], 0));
  }
  return rows;
}

function detailRow(label: string, value: unknown, path: string[]): AdminValuationDetailRow | null {
  if (!hasDetailValue(value)) return null;
  return { label, value: formatAdminValuationDetailValue(value, path) };
}

function compactDetailRows(
  rows: Array<AdminValuationDetailRow | null>,
): AdminValuationDetailRow[] {
  return rows.filter((row): row is AdminValuationDetailRow => Boolean(row));
}

function withoutKeys(source: Record<string, unknown>, keys: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.has(key)));
}

function usageDisplayValue(valuation: AdminValuationRecord, input: Record<string, unknown>): string | null {
  const mode = String(firstRecordedValue(input, ['usageMode', 'usage_mode']) ?? valuation.asset.usageUnit).toLowerCase();
  const lifeWorked = firstRecordedValue(input, ['lifeWorkedPercent', 'life_worked_percent']);
  if (mode === 'percent' && hasDetailValue(lifeWorked)) {
    const numeric = Number(lifeWorked);
    const formatted = Number.isFinite(numeric)
      ? new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 }).format(numeric)
      : String(lifeWorked);
    return `${formatted}% worked`;
  }
  const amount = firstRecordedValue(input, ['usageAmount', 'usage_amount', 'hours']) ?? valuation.asset.usageAmount;
  if (!hasDetailValue(amount)) return null;
  const numeric = Number(amount);
  const formatted = Number.isFinite(numeric)
    ? new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 }).format(numeric)
    : String(amount);
  if (mode === 'km' || valuation.asset.usageUnit === 'km') return `${formatted} km`;
  if (mode === 'hours' || valuation.asset.usageUnit === 'hours') return `${formatted} hours`;
  return formatted;
}

export function buildAdminValuationInputSections(
  valuation: AdminValuationRecord,
): AdminValuationDetailSection[] {
  const input = isDetailObject(valuation.input) ? valuation.input : {};
  const output = isDetailObject(valuation.output) ? valuation.output : {};
  const advanced = isDetailObject(input.advancedAssumptions) ? input.advancedAssumptions : {};
  const assessment = isDetailObject(advanced.dealerAssessment) ? advanced.dealerAssessment : {};
  const yearUnknown = detailBoolean(firstRecordedValue(input, ['yearModelUnknown', 'year_model_unknown']));
  const enteredYear = firstRecordedValue(input, [
    'displayYearModel', 'display_year_model', 'yearModel', 'year_model', 'year',
  ]);
  const modelId = firstRecordedValue(input, ['equipmentModelId', 'modelId']);
  const assetRows = compactDetailRows([
    detailRow('Valuation path', valuation.valuationMode === 'tractor' ? 'Exact tractor model' : valuation.valuationMode === 'generic' ? 'General asset specifications' : 'Historical record', ['valuationMode']),
    detailRow('Sector', valuation.asset.sectorLabel, ['sectorKey']),
    detailRow('Asset type', valuation.asset.familyLabel, ['familyKey']),
    detailRow('Brand', valuation.asset.brandName || firstRecordedValue(input, ['brandName', 'brandSlug']), ['brandName']),
    detailRow('Model entered', valuation.asset.modelName || firstRecordedValue(input, ['typedModelName', 'modelName']), ['typedModelName']),
    detailRow('Catalog model ID', modelId, ['equipmentModelId']),
    detailRow('Tractor type', firstRecordedValue(input, ['tractorType']), ['tractorType']),
    detailRow('Drive', firstRecordedValue(input, ['driveType']), ['driveType']),
    detailRow('Cab', firstRecordedValue(input, ['cabType']), ['cabType']),
    detailRow('Power', firstRecordedValue(input, ['powerKw']), ['powerKw']),
    detailRow('Year model entered', yearUnknown ? 'Unknown' : enteredYear, ['displayYearModel']),
    yearUnknown ? detailRow('Calculation year used', firstRecordedValue(input, ['year']), ['year']) : null,
    Object.prototype.hasOwnProperty.call(input, 'saveModelCandidate')
      ? detailRow('New model submitted', input.saveModelCandidate, ['saveModelCandidate'])
      : null,
    detailRow('Catalog mode', firstRecordedValue(input, ['catalogModeUsed']) ?? output.catalogModeUsed, ['catalogModeUsed']),
  ]);

  const specifications = flattenAdminValuationDetails(input.specsJson);
  const usageRows = compactDetailRows([
    detailRow('Usage method', firstRecordedValue(input, ['usageMode', 'usage_mode']) ?? valuation.asset.usageUnit, ['usageMode']),
    detailRow('Usage entered', usageDisplayValue(valuation, input), ['usageDisplay']),
    detailRow('Life worked', firstRecordedValue(input, ['lifeWorkedPercent', 'life_worked_percent']), ['lifeWorkedPercent']),
    detailRow('Overall condition', firstRecordedValue(input, ['condition']) ?? valuation.asset.condition, ['condition']),
    detailRow(
      'Popularity',
      hasDetailValue(advanced.popularityStars) ? `${String(advanced.popularityStars)} / 5 stars` : null,
      ['popularityStars'],
    ),
    detailRow('Mechanical condition', assessment.mechanicalCondition, ['mechanicalCondition']),
    detailRow('Body / frame / structure', assessment.bodyCondition, ['bodyCondition']),
    detailRow('Tyres / wear components', assessment.tyreCondition, ['tyreCondition']),
    detailRow('Service history', assessment.serviceHistory, ['serviceHistory']),
    detailRow('Required work', assessment.requiredWork, ['requiredWork']),
    detailRow('Detailed condition retained value', assessment.conditionFactorPercent, ['conditionFactorPercent']),
  ]);

  const replacementRows = compactDetailRows([
    detailRow('Replacement price entered excl. VAT', input.userReplacementPriceExVat, ['userReplacementPriceExVat']),
    detailRow('Replacement price year', input.userReplacementPriceYear, ['userReplacementPriceYear']),
    Object.prototype.hasOwnProperty.call(input, 'frontPto') ? detailRow('Front PTO selected', input.frontPto, ['frontPto']) : null,
    detailRow('Front PTO replacement price excl. VAT', input.frontPtoReplacementPriceExVat, ['frontPtoReplacementPriceExVat']),
    Object.prototype.hasOwnProperty.call(input, 'frontLoader') ? detailRow('Front Loader selected', input.frontLoader, ['frontLoader']) : null,
    detailRow('Front Loader year', input.frontLoaderYear, ['frontLoaderYear']),
    detailRow('Front Loader replacement price excl. VAT', input.frontLoaderReplacementPriceExVat, ['frontLoaderReplacementPriceExVat']),
    Object.prototype.hasOwnProperty.call(input, 'gpsEnabled') ? detailRow('GPS selected', input.gpsEnabled, ['gpsEnabled']) : null,
    detailRow('GPS type', input.gpsType, ['gpsType']),
    detailRow('GPS year', input.gpsYear, ['gpsYear']),
    detailRow('GPS replacement price excl. VAT', input.gpsReplacementPriceExVat, ['gpsReplacementPriceExVat']),
    detailRow('Other extra', input.otherExtraName, ['otherExtraName']),
    detailRow('Other extra replacement price excl. VAT', firstRecordedValue(input, ['otherExtraReplacementPriceExVat', 'otherExtraValueExVat']), ['otherExtraReplacementPriceExVat']),
  ]);

  const lifetimeUsage = firstRecordedValue(advanced, ['maxLifetimeUsage', 'maxLifetimeHours']);
  const lifetimeUsageText = hasDetailValue(lifetimeUsage)
    ? `${new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 }).format(Number(lifetimeUsage))} ${valuation.asset.usageUnit === 'km' ? 'km' : 'hours'}`
    : null;
  const advancedRows = compactDetailRows([
    detailRow('Expected lifetime usage', lifetimeUsageText, ['maxLifetimeUsage']),
    detailRow('Condition retained value', advanced.conditionFactorPercent, ['conditionFactorPercent']),
  ]);
  const advancedAdditional = withoutKeys(advanced, new Set([
    'maxLifetimeUsage', 'maxLifetimeHours', 'conditionFactorPercent', 'dealerAssessment', 'popularityStars',
  ]));
  advancedRows.push(...flattenAdminValuationDetails(advancedAdditional));

  const consumedInputKeys = new Set<string>([
    ...INPUT_ASSET_KEYS,
    ...INPUT_USAGE_KEYS,
    ...INPUT_REPLACEMENT_KEYS,
    'specsJson',
    'advancedAssumptions',
  ]);
  const additionalRows = flattenAdminValuationDetails(withoutKeys(input, consumedInputKeys));
  const sections: AdminValuationDetailSection[] = [
    {
      id: 'asset-selection',
      title: '1. Asset selection',
      description: 'The sector, category, brand, model and year used in the estimate path.',
      rows: assetRows,
    },
    {
      id: 'asset-specifications',
      title: '2. Asset specifications',
      description: 'Every specification value retained from the estimate questions and selected model.',
      rows: specifications,
    },
    {
      id: 'usage-condition',
      title: '3. Usage and condition',
      description: 'The entered usage path, overall condition, popularity and detailed assessment answers.',
      rows: usageRows,
    },
    {
      id: 'replacement-extras',
      title: '4. Replacement pricing and extras',
      description: 'Any replacement-price override and every selected tractor extra.',
      rows: replacementRows,
    },
    {
      id: 'advanced-assumptions',
      title: '5. Advanced assumptions',
      description: 'Custom lifetime and condition assumptions applied before recalculation.',
      rows: advancedRows,
    },
    {
      id: 'additional-inputs',
      title: '6. Additional recorded inputs',
      description: 'Any remaining input retained by the valuation engine.',
      rows: additionalRows,
    },
  ];
  return sections.filter((section) => section.rows.length > 0);
}

export function buildAdminValuationOutputSections(
  valuation: AdminValuationRecord,
): AdminValuationDetailSection[] {
  const output = isDetailObject(valuation.output) ? valuation.output : {};
  if (!Object.keys(output).length) return [];

  const outcomeKeys = [
    'selectedMethod', 'selectedValueExVat', 'aim4priceValueExVat', 'genericEstimateExVat', 'previewValueExVat',
    'valuationLowExVat', 'valuationMidExVat', 'valuationHighExVat', 'marketLowExVat',
    'marketMidExVat', 'marketHighExVat', 'marketLow', 'marketMid', 'marketHigh',
    'replacementPriceUsedExVat', 'totalReplacementPriceUsedExVat', 'replacementPriceMinExVat',
    'replacementPriceMaxExVat', 'replacementPriceBasis', 'depreciationMethodUsed',
    'lifeWorkedPercent', 'lifeRemainingPercent', 'estimatedHours', 'maxLifetimeHours',
    'extrasValueExVat', 'frontPtoValueExVat', 'frontLoaderValueExVat', 'gpsValueExVat',
    'otherExtraValueExVat', 'marketAverageExVat', 'marketAverageCount', 'marketCount',
    'confidenceScore', 'confidenceLabel', 'coverageBand', 'salvagePercent',
    'salvageValueExVat', 'isSalvageEstimate',
  ];
  const outcomeRows = compactDetailRows(outcomeKeys.map((key) =>
    detailRow(DETAIL_FIELD_LABELS[key] ?? splitDetailKey(key), output[key], [key]),
  ));

  const namedGroups: Array<{ key: string; id: string; title: string; description: string }> = [
    { key: 'selectedCalculation', id: 'selected-calculation', title: 'Selected calculation', description: 'The complete calculation used for the displayed estimate.' },
    { key: 'aim4priceReplacementCalculation', id: 'aim4price-calculation', title: 'Aim4price price-basis calculation', description: 'The calculation using Aim4price’s saved replacement price.' },
    { key: 'userReplacementCalculation', id: 'user-calculation', title: 'User price-basis calculation', description: 'The alternative calculation using the replacement price entered in the flow.' },
    { key: 'model', id: 'model-snapshot', title: 'Catalog model snapshot', description: 'The complete model information used at calculation time.' },
    { key: 'marketSources', id: 'market-evidence', title: 'Market evidence', description: 'Every market comparison retained by the calculation.' },
    { key: 'notes', id: 'calculation-notes', title: 'Calculation notes', description: 'All notes returned by the valuation engine.' },
  ];
  const sections: AdminValuationDetailSection[] = [
    {
      id: 'estimate-outcome',
      title: 'Estimate outcome',
      description: 'The recorded value, range, price basis, confidence and lifecycle outputs.',
      rows: outcomeRows,
    },
  ];
  for (const group of namedGroups) {
    const rows = flattenAdminValuationDetails(output[group.key]);
    if (rows.length) sections.push({ ...group, rows });
  }

  const consumed = new Set([...outcomeKeys, ...namedGroups.map((group) => group.key)]);
  const additionalRows = flattenAdminValuationDetails(withoutKeys(output, consumed));
  if (additionalRows.length) {
    sections.push({
      id: 'additional-output',
      title: 'Additional calculation output',
      description: 'Every remaining field retained in the completed estimate response.',
      rows: additionalRows,
    });
  }
  return sections.filter((section) => section.rows.length > 0);
}

export function formatAdminValuationMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Not recorded';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatAdminValuationDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}
