'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';
import {
  conditionOptions,
  type BrandRow,
  type CabType,
  type ConditionKey,
  type DriveType,
  type TractorCatalogRow,
  type TractorType,
} from '../../lib/tractor-data';
import { SECTOR_LABELS, type CatalogMode, type SectorKey, type UsageMetricType } from '../../lib/equipment-types';
import { conditionLabel, money, type Result } from '../../lib/tractor-logic';
import { getGuestValuationCount, incrementGuestValuationCount } from '../../lib/guest-valuation-limit';

type Step = 1 | 2 | 3 | 4 | 5;
type MethodKey = 'aim4price' | 'market';
type FlowMode = 'exact_model' | 'generic_specs' | '';
type GpsType = 'full-autosteer' | 'guidance-only';
type ReplacementPriceBasis = 'aim4price' | 'user';
type DepreciationMethodUsed = 'full_depreciation' | 'semi_depreciation' | 'percentage_depreciation';
type DetailsModal = 'year' | 'usage' | null;
type UsageModalMode = 'hours' | 'percent';

type EquipmentFamilyRecord = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  sectorLabel: string;
  familyKey: string;
  familyLabel: string;
  isPropelled: boolean;
  usageMetricType: UsageMetricType;
  valuationMode: string;
  catalogMode: CatalogMode;
  sortOrder: number;
  isActive: boolean;
};

type SpecOption = {
  id: number;
  specQuestionId: number;
  optionValue: string;
  optionLabel: string;
  sortOrder: number;
};

type SpecQuestion = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  familyId: number;
  familyKey: string;
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


type GenericValuationCalculation = {
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

type MarketMatch = {
  id: number;
  title: string;
  brandName: string;
  modelName: string;
  advertisedPriceExVat: number;
  yearModel: number | null;
  usageAmount: number | null;
  condition: string | null;
  sourceName: string;
  sourceUrl: string;
  dateAdvertised: string | null;
  matchReason: string;
};

type GenericValuationResult = {
  catalogModeUsed: CatalogMode;
  sector: { id: number; key: SectorKey; label: string };
  family: {
    id: number;
    key: string;
    label: string;
    usageMetricType: UsageMetricType;
    valuationMode: string;
    isPropelled: boolean;
    catalogMode: CatalogMode;
  };
  brand: { id: number; slug: string; name: string };
  typedModelName: string | null;
  normalizedTypedModelName: string | null;
  specsJson: Record<string, unknown>;
  year: number;
  usageAmount: number | null;
  condition: ConditionKey;
  replacementPriceBand: { id: number; bandLabel: string } | null;
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

type ValuationResultState =
  | { kind: 'tractor'; result: Result }
  | { kind: 'generic'; result: GenericValuationResult };

type FamiliesApiResponse = {
  ok: boolean;
  families?: EquipmentFamilyRecord[];
  error?: string;
};

type BrandsApiResponse = {
  ok: boolean;
  brands?: BrandRow[];
  error?: string;
};

type SpecQuestionsApiResponse = {
  ok: boolean;
  questions?: SpecQuestion[];
  error?: string;
};

type TractorModelsApiResponse = {
  ok: boolean;
  models?: TractorCatalogRow[];
  error?: string;
};

type TractorValuationApiResponse = {
  ok: boolean;
  result?: Result;
  error?: string;
};

type GenericValuationApiResponse = {
  ok: boolean;
  result?: GenericValuationResult;
  error?: string;
};

type SaveValuationRunApiResponse = {
  ok: boolean;
  runId?: number;
  assetId?: string;
  selectedValueExVat?: number;
  error?: string;
};

const CURRENT_YEAR = new Date().getFullYear();

const WIZARD_STEPS: Array<{ step: Step; label: string }> = [
  { step: 1, label: 'Machine' },
  { step: 2, label: 'Brand' },
  { step: 3, label: 'Path' },
  { step: 4, label: 'Specs' },
  { step: 5, label: 'Value' },
];

const SECTOR_OPTIONS: Array<{ key: SectorKey; label: string; available: boolean; videoSrc: string }> = [
  { key: 'agricultural', label: SECTOR_LABELS.agricultural, available: true, videoSrc: '/brand/valuation/Agriculture.mp4' },
  { key: 'construction', label: SECTOR_LABELS.construction, available: false, videoSrc: '/brand/valuation/Construction.mp4' },
  { key: 'industrial', label: SECTOR_LABELS.industrial, available: false, videoSrc: '/brand/valuation/Industrial.mp4' },
];

const TRACTOR_TYPE_OPTIONS: Array<{ value: TractorType; label: string }> = [
  { value: 'field', label: 'Field' },
  { value: 'orchard', label: 'Orchard' },
];

const DRIVE_OPTIONS: Array<{ value: DriveType; label: string }> = [
  { value: '2wd', label: '2WD' },
  { value: '4wd', label: '4WD' },
  { value: 'tracks', label: 'Tracks' },
];

const CAB_OPTIONS: Array<{ value: CabType; label: string }> = [
  { value: 'cab', label: 'Cab' },
  { value: 'open-station', label: 'Open station' },
];

function playSectorPreview(card: HTMLButtonElement) {
  const video = card.querySelector('video');
  if (!video) return;
  video.currentTime = 0;
  void video.play().catch(() => undefined);
}

function resetSectorPreview(card: HTMLButtonElement) {
  const video = card.querySelector('video');
  if (!video) return;
  video.pause();
  video.currentTime = 0;
}

function nextStep(step: Step): Step {
  return step === 1 ? 2 : step === 2 ? 3 : step === 3 ? 4 : 5;
}

function previousStep(step: Step): Step {
  return step === 5 ? 4 : step === 4 ? 3 : step === 3 ? 2 : 1;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function parseFlexibleNumber(value: unknown): number | null {
  const text = normalizeText(value).replace(/\s/g, '').replace(',', '.');
  if (!text) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function toNumberOrNull(value: unknown): number | null {
  const numeric = parseFlexibleNumber(value);
  return numeric !== null && numeric > 0 ? numeric : null;
}

function toPercentOrNull(value: unknown): number | null {
  const numeric = parseFlexibleNumber(value);
  if (numeric === null) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function searchIncludes(value: string, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = value.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function formatCatalogModeLabel(mode: CatalogMode): string {
  if (mode === 'hybrid') return 'Exact model + specs';
  if (mode === 'exact_model') return 'Exact model data';
  return 'Specs pathway';
}

function formatUsageMetricLabel(metric: UsageMetricType): string {
  return metric === 'hours' ? 'Hours' : 'Worked percentage';
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return `${Math.round(value)}%`;
}

function formatWholeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/A';
  return Math.round(value).toLocaleString('en-ZA');
}

function formatListingYear(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 1950) return null;
  return String(Math.round(value));
}

function formatListingHours(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return null;
  return `${formatWholeNumber(value)} hours`;
}

function normalizeExternalUrl(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function joinMeta(parts: Array<string | null | undefined>): string {
  const cleanParts = parts.map((part) => String(part ?? '').trim()).filter(Boolean);
  return cleanParts.length ? cleanParts.join(' • ') : 'Details not captured';
}

function formatMarketSourceLabel(value: string | null | undefined): string {
  const label = normalizeText(value);
  return label || 'Marketplace listing';
}

function formatTractorMarketMeta(listing: Result['marketSources'][number]): string {
  return joinMeta([
    formatListingYear(listing.yearModel),
    formatListingHours(listing.hours),
    listing.location && !listing.location.toLowerCase().includes('unknown') ? listing.location : null,
  ]);
}

function formatGenericMarketMeta(listing: MarketMatch): string {
  return joinMeta([
    formatListingYear(listing.yearModel),
    formatListingHours(listing.usageAmount),
    listing.condition ? conditionLabel(listing.condition as ConditionKey) : null,
    listing.matchReason,
  ]);
}

function tractorLifetimeHoursFromModel(model: TractorCatalogRow | null): number {
  if (!model) return 12_000;
  if (model.tractorType === 'orchard') return 10_000;
  if (model.powerKw <= 25) return 8_000;
  if (model.powerKw <= 75) return 12_000;
  return 14_000;
}

function estimateHoursFromWorkedPercent(model: TractorCatalogRow | null, workedPercent: number | null): number | null {
  if (workedPercent === null) return null;
  return Math.round(tractorLifetimeHoursFromModel(model) * (workedPercent / 100));
}

function depreciationMethodLabel(method: DepreciationMethodUsed | null | undefined): string {
  if (method === 'full_depreciation') return 'Full depreciation';
  if (method === 'semi_depreciation') return 'Semi depreciation';
  if (method === 'percentage_depreciation') return 'Percentage depreciation';
  return 'Depreciation';
}

function displayMarketStrategy(strategy: GenericValuationResult['marketMatchStrategy']): string {
  if (strategy === 'exact_model') return 'Exact model match';
  if (strategy === 'typed_model') return 'Typed model match';
  if (strategy === 'brand_specs') return 'Brand + spec match';
  if (strategy === 'family_specs') return 'Family + spec match';
  return 'No marketplace average';
}

function getTractorTypeLabel(value: TractorType | ''): string {
  return TRACTOR_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? 'Choose type';
}

function getDriveLabel(value: DriveType | ''): string {
  return DRIVE_OPTIONS.find((option) => option.value === value)?.label ?? 'Choose drive';
}

function getCabLabel(value: CabType | ''): string {
  return CAB_OPTIONS.find((option) => option.value === value)?.label ?? 'Choose cab';
}

function formatTractorModelLabel(model: TractorCatalogRow | null): string {
  if (!model) return 'Select model...';
  return `${model.brandName} ${model.modelName}`;
}

function formatTractorModelDetail(model: TractorCatalogRow): string {
  return `${model.powerKw} kW • ${model.yearStart}-${model.yearEnd}`;
}

function getTractorValue(result: Result, method: MethodKey): number | null {
  if (method === 'market') return result.marketMid;
  return result.aim4priceValueExVat;
}

function getGenericCalculation(result: GenericValuationResult, basis: ReplacementPriceBasis): GenericValuationCalculation | null {
  if (basis === 'user') return result.userReplacementCalculation ?? result.selectedCalculation ?? result.aim4priceReplacementCalculation;
  return result.aim4priceReplacementCalculation ?? result.selectedCalculation;
}

function getGenericValue(result: GenericValuationResult, method: MethodKey, basis: ReplacementPriceBasis): number | null {
  if (method === 'market') return result.marketAverageExVat;
  const calculation = getGenericCalculation(result, basis);
  return calculation?.valuationMidExVat ?? result.valuationMidExVat ?? result.aim4priceValueExVat;
}

function getHeadlineValue(state: ValuationResultState | null, selectedMethod: MethodKey, replacementBasis: ReplacementPriceBasis): number | null {
  if (!state) return null;
  return state.kind === 'tractor' ? getTractorValue(state.result, selectedMethod) : getGenericValue(state.result, selectedMethod, replacementBasis);
}

type ConfidenceContext = {
  selectedMethod: MethodKey;
  yearKnown: boolean;
  hoursKnown: boolean;
  workedPercentKnown: boolean;
};

function confidenceFromCoverageBand(band: Result['coverageBand']): 'High' | 'Medium' | 'Low' {
  if (band === 'green') return 'High';
  if (band === 'amber') return 'Medium';
  return 'Low';
}

function confidenceFromMarketCount(count: number, exactModelMatch = false): 'High' | 'Medium' | 'Low' {
  if (exactModelMatch && count >= 4) return 'High';
  if (count >= 5) return 'High';
  if (count >= 2) return 'Medium';
  return 'Low';
}

function getConfidenceLabel(state: ValuationResultState | null, context: ConfidenceContext): string {
  if (!state) return 'Confidence: Low';

  if (state.kind === 'generic') {
    if (context.selectedMethod === 'market') {
      return `Confidence: ${confidenceFromMarketCount(state.result.marketAverageCount, state.result.marketMatchStrategy === 'exact_model')}`;
    }

    return `Confidence: ${state.result.confidenceLabel}`;
  }

  if (context.selectedMethod === 'market') {
    return `Confidence: ${confidenceFromCoverageBand(state.result.coverageBand)}`;
  }

  const hasReplacementPrice = Number.isFinite(state.result.model.aim4priceReplacementExVat) && state.result.model.aim4priceReplacementExVat > 0;

  if (hasReplacementPrice && context.yearKnown && context.hoursKnown) {
    return 'Confidence: High';
  }

  if (hasReplacementPrice && context.yearKnown && context.workedPercentKnown) {
    return 'Confidence: Medium';
  }

  if (hasReplacementPrice) {
    return 'Confidence: Medium';
  }

  return 'Confidence: Low';
}

function getConfidenceClass(state: ValuationResultState | null, context: ConfidenceContext): string {
  if (!state) return styles.confidenceLow;
  const label = getConfidenceLabel(state, context).toLowerCase();
  if (label.includes('high')) return styles.confidenceHigh;
  if (label.includes('medium')) return styles.confidenceMedium;
  return styles.confidenceLow;
}

function getConfidenceNote(state: ValuationResultState | null, context: ConfidenceContext): string {
  if (!state) return 'Run a valuation to calculate confidence.';

  if (state.kind === 'generic') {
    if (context.selectedMethod === 'market') {
      const count = state.result.marketAverageCount;
      return count > 0
        ? `${count} marketplace listing${count === 1 ? '' : 's'} matched using ${displayMarketStrategy(state.result.marketMatchStrategy).toLowerCase()}.`
        : 'No usable marketplace listing was found for this machine yet.';
    }

    return 'Aim4price confidence uses the replacement-price band, captured specs, age, usage and condition.';
  }

  if (context.selectedMethod === 'market') {
    const count = state.result.marketCount;
    return count > 0
      ? `${count} usable market listing${count === 1 ? '' : 's'} after model, year, hours and outlier checks.`
      : 'No usable market listing was found for this exact tractor yet.';
  }

  if (context.hoursKnown) {
    return 'Exact model, manufacturing year, engine hours and condition were captured.';
  }

  if (context.workedPercentKnown) {
    return 'Exact model was captured, but usage was estimated from worked percentage.';
  }

  return 'Exact model was captured, but confidence improves when real hours are supplied.';
}

function buildSpecPayload(specQuestions: SpecQuestion[], specAnswers: Record<string, string>): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const question of specQuestions) {
    const raw = specAnswers[question.specKey];
    if (raw === undefined || raw === '') continue;

    if (question.inputType === 'number' || question.inputType === 'money') {
      const numberValue = parseFlexibleNumber(raw);
      if (numberValue !== null) output[question.specKey] = numberValue;
      continue;
    }

    if (question.inputType === 'boolean') {
      output[question.specKey] = raw === 'true';
      continue;
    }

    output[question.specKey] = raw;
  }

  return output;
}

function isSpecQuestionAnswered(question: SpecQuestion, value: string | undefined): boolean {
  const cleaned = normalizeText(value);
  if (!cleaned) return false;
  if (question.inputType === 'number' || question.inputType === 'money') return parseFlexibleNumber(cleaned) !== null;
  return true;
}

function getSpecQuestionAnswerLabel(question: SpecQuestion, value: string | undefined): string {
  const cleaned = normalizeText(value);
  if (!cleaned) return 'Not answered';

  if (question.inputType === 'select') {
    return question.options.find((option) => option.optionValue === cleaned)?.optionLabel ?? cleaned;
  }

  if (question.inputType === 'boolean') {
    return cleaned === 'true' ? 'Yes' : cleaned === 'false' ? 'No' : cleaned;
  }

  if ((question.inputType === 'number' || question.inputType === 'money') && question.unit) {
    return cleaned + ' ' + question.unit;
  }

  return cleaned;
}

export default function ValuationClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [selectedSector, setSelectedSector] = useState<SectorKey | null>(null);
  const [families, setFamilies] = useState<EquipmentFamilyRecord[]>([]);
  const [familiesLoading, setFamiliesLoading] = useState(false);
  const [familySearch, setFamilySearch] = useState('');
  const [equipmentDropdownOpen, setEquipmentDropdownOpen] = useState(false);
  const [familyKey, setFamilyKey] = useState('');
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [brandSlug, setBrandSlug] = useState('');
  const [flowMode, setFlowMode] = useState<FlowMode>('');
  const [tractorType, setTractorType] = useState<TractorType | ''>('');
  const [drive, setDrive] = useState<DriveType | ''>('');
  const [cab, setCab] = useState<CabType | ''>('');
  const [tractorModels, setTractorModels] = useState<TractorCatalogRow[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelQuery, setModelQuery] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [modelId, setModelId] = useState('');
  const [specQuestions, setSpecQuestions] = useState<SpecQuestion[]>([]);
  const [specAnswers, setSpecAnswers] = useState<Record<string, string>>({});
  const [typedModelName, setTypedModelName] = useState('');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [usageAmount, setUsageAmount] = useState('');
  const [condition, setCondition] = useState<ConditionKey>('good');
  const [frontPto, setFrontPto] = useState(false);
  const [frontLoader, setFrontLoader] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsType, setGpsType] = useState<GpsType>('guidance-only');
  const [gpsYear, setGpsYear] = useState('');
  const [userReplacementPrice, setUserReplacementPrice] = useState('');
  const [replacementPriceBasis, setReplacementPriceBasis] = useState<ReplacementPriceBasis>('aim4price');
  const [yearModelUnknown, setYearModelUnknown] = useState(false);
  const [lifeWorkedPercent, setLifeWorkedPercent] = useState('');
  const [yearStepComplete, setYearStepComplete] = useState(false);
  const [usageStepComplete, setUsageStepComplete] = useState(false);
  const [conditionStepComplete, setConditionStepComplete] = useState(false);
  const [activeDetailsModal, setActiveDetailsModal] = useState<DetailsModal>(null);
  const [usageModalMode, setUsageModalMode] = useState<UsageModalMode>('hours');
  const [resultState, setResultState] = useState<ValuationResultState | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<MethodKey>('aim4price');
  const [message, setMessage] = useState('');
  const [valuationLoading, setValuationLoading] = useState(false);
  const [replacementRecalculateLoading, setReplacementRecalculateLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [guestValuationCount, setGuestValuationCount] = useState(0);
  const [replacementPanelOpen, setReplacementPanelOpen] = useState(false);

  const selectedFamily = useMemo(
    () => families.find((family) => family.familyKey === familyKey) ?? null,
    [families, familyKey],
  );
  const selectedBrand = useMemo(() => brands.find((brand) => brand.slug === brandSlug) ?? null, [brands, brandSlug]);
  const selectedModel = useMemo(
    () => tractorModels.find((model) => model.id === modelId) ?? null,
    [tractorModels, modelId],
  );
  const filteredFamilies = useMemo(() => {
    const query = familySearch.trim().toLowerCase();
    const matches = families.filter((family) =>
      searchIncludes(`${family.familyLabel} ${family.familyKey} ${family.sectorLabel}`, familySearch),
    );

    if (!query) return matches;

    function scoreFamily(family: EquipmentFamilyRecord): number {
      const label = family.familyLabel.toLowerCase();
      const key = family.familyKey.replace(/_/g, ' ').toLowerCase();

      if (label === query || key === query) return 0;
      if (label.startsWith(query)) return 1;
      if (key.startsWith(query)) return 2;
      if (label.includes(query)) return 3;
      if (key.includes(query)) return 4;
      return 5;
    }

    return [...matches].sort((a, b) => scoreFamily(a) - scoreFamily(b) || a.sortOrder - b.sortOrder || a.familyLabel.localeCompare(b.familyLabel));
  }, [families, familySearch]);
  const filteredBrands = useMemo(() => {
    const query = brandSearch.trim().toLowerCase();
    const matches = brands.filter((brand) => searchIncludes(`${brand.name} ${brand.slug}`, brandSearch));

    if (!query) return matches;

    function scoreBrand(brand: BrandRow): number {
      const name = brand.name.toLowerCase();
      const slug = brand.slug.replace(/-/g, ' ').toLowerCase();

      if (name === query || slug === query) return 0;
      if (name.startsWith(query)) return 1;
      if (slug.startsWith(query)) return 2;
      if (name.includes(query)) return 3;
      if (slug.includes(query)) return 4;
      return 5;
    }

    return [...matches].sort((a, b) => scoreBrand(a) - scoreBrand(b) || a.name.localeCompare(b.name));
  }, [brands, brandSearch]);

  const exactTractorAvailable = selectedFamily?.familyKey === 'tractors' && selectedFamily.catalogMode === 'hybrid';
  const tractorSetupComplete = Boolean(tractorType && drive && cab);
  const filteredModels = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();
    const matches = tractorModels.filter((model) =>
      searchIncludes(`${model.brandName} ${model.modelName} ${model.powerKw} ${model.yearStart} ${model.yearEnd}`, modelQuery),
    );

    if (!query) return matches;

    function scoreModel(model: TractorCatalogRow): number {
      const modelName = model.modelName.toLowerCase();
      const fullName = `${model.brandName} ${model.modelName}`.toLowerCase();

      if (modelName === query || fullName === query) return 0;
      if (modelName.startsWith(query)) return 1;
      if (fullName.startsWith(query)) return 2;
      if (modelName.includes(query)) return 3;
      if (fullName.includes(query)) return 4;
      return 5;
    }

    return [...matches].sort((a, b) => scoreModel(a) - scoreModel(b) || a.modelName.localeCompare(b.modelName));
  }, [modelQuery, tractorModels]);

  const yearNumber = Number(year);
  const usageNumber = toNumberOrNull(usageAmount);
  const lifeWorkedPercentNumber = toPercentOrNull(lifeWorkedPercent);
  const specsJson = useMemo(() => buildSpecPayload(specQuestions, specAnswers), [specQuestions, specAnswers]);
  const enrichedSpecsJson = useMemo(
    () => ({
      ...specsJson,
      ...(lifeWorkedPercentNumber !== null ? { life_worked_percent: lifeWorkedPercentNumber } : {}),
      ...(yearModelUnknown ? { year_model_unknown: true } : {}),
    }),
    [specsJson, lifeWorkedPercentNumber, yearModelUnknown],
  );
  const headlineValue = getHeadlineValue(resultState, selectedMethod, replacementPriceBasis);
  useEffect(() => {
    const target = document.getElementById('valuation-wizard-card');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  useEffect(() => {
    let mounted = true;

    async function loadAccessState() {
      try {
        const response = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
        const data = (await response.json()) as { ok: boolean; signedIn: boolean };
        if (!mounted) return;
        setIsSignedIn(Boolean(data?.signedIn));
      } catch {
        if (!mounted) return;
        setIsSignedIn(false);
      } finally {
        if (mounted) setGuestValuationCount(getGuestValuationCount());
      }
    }

    void loadAccessState();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    setFamilies([]);
    setFamilyKey('');
    setFamilySearch('');
    setEquipmentDropdownOpen(false);
    setBrandSearch('');
    setBrandDropdownOpen(false);
    setBrands([]);
    setBrandSlug('');
    setTypedModelName('');
    setModelQuery('');
    setModelDropdownOpen(false);
    setModelId('');
    setTractorType('');
    setDrive('');
    setCab('');
    setTractorModels([]);
    setSpecQuestions([]);
    setSpecAnswers({});
    setYear(String(CURRENT_YEAR));
    setYearModelUnknown(false);
    setUsageAmount('');
    setLifeWorkedPercent('');
    setCondition('good');
    setYearStepComplete(false);
    setUsageStepComplete(false);
    setConditionStepComplete(false);
    setActiveDetailsModal(null);
    setUsageModalMode('hours');
    setResultState(null);
    setSelectedMethod('aim4price');
    setReplacementPriceBasis('aim4price');

    if (!selectedSector) {
      setFamiliesLoading(false);
      return () => {
        ignore = true;
      };
    }

    const sectorForRequest = selectedSector;
    setFamiliesLoading(true);

    async function loadFamilies() {
      try {
        const params = new URLSearchParams({ sectorKey: sectorForRequest, includeInactive: 'true' });
        const response = await fetch(`/api/equipment-families?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as FamiliesApiResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.families)) throw new Error(data.error ?? 'Failed to load families.');
        if (ignore) return;
        setFamilies(data.families);
      } catch (error) {
        console.error(error);
        if (!ignore) setMessage(error instanceof Error ? error.message : 'Failed to load families.');
      } finally {
        if (!ignore) setFamiliesLoading(false);
      }
    }

    void loadFamilies();
    return () => {
      ignore = true;
    };
  }, [selectedSector]);

  useEffect(() => {
    if (!selectedFamily || !selectedSector) return;

    const sectorForRequest = selectedSector;
    const familyForRequest = selectedFamily;
    const familyKeyForRequest = familyForRequest.familyKey;
    const nextFlowMode: FlowMode = familyKeyForRequest === 'tractors' && familyForRequest.catalogMode === 'hybrid' ? '' : 'generic_specs';

    setResultState(null);
    setSelectedMethod('aim4price');
    setReplacementPriceBasis('aim4price');
    setBrandSearch('');
    setBrandDropdownOpen(false);
    setBrandSlug('');
    setBrands([]);
    setModelQuery('');
    setModelDropdownOpen(false);
    setModelId('');
    setTractorType('');
    setDrive('');
    setCab('');
    setTractorModels([]);
    setTypedModelName('');
    setYear(String(CURRENT_YEAR));
    setUsageAmount('');
    setLifeWorkedPercent('');
    setUserReplacementPrice('');
    setYearModelUnknown(false);
    setYearStepComplete(false);
    setUsageStepComplete(false);
    setConditionStepComplete(false);
    setCondition('good');
    setActiveDetailsModal(null);
    setUsageModalMode('hours');
    setFlowMode(nextFlowMode);

    let ignore = false;
    setBrandsLoading(true);

    async function loadBrands() {
      try {
        const params = new URLSearchParams({
          sectorKey: sectorForRequest,
          familyKey: familyKeyForRequest,
          includeInactive: 'true',
        });
        const response = await fetch(`/api/brands?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as BrandsApiResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.brands)) throw new Error(data.error ?? 'Failed to load brands.');
        if (ignore) return;
        setBrands(data.brands);
      } catch (error) {
        console.error(error);
        if (!ignore) setMessage(error instanceof Error ? error.message : 'Failed to load brands.');
      } finally {
        if (!ignore) setBrandsLoading(false);
      }
    }

    void loadBrands();
    return () => {
      ignore = true;
    };
  }, [selectedFamily, selectedSector]);

  useEffect(() => {
    let ignore = false;

    setSpecQuestions([]);
    setSpecAnswers({});

    if (!selectedFamily || !selectedSector || flowMode !== 'generic_specs') {
      return () => {
        ignore = true;
      };
    }

    const sectorForRequest = selectedSector;
    const familyKeyForRequest = selectedFamily.familyKey;

    async function loadSpecQuestions() {
      try {
        const params = new URLSearchParams({
          sectorKey: sectorForRequest,
          familyKey: familyKeyForRequest,
          includeInactive: 'true',
        });
        const response = await fetch(`/api/equipment-family-spec-questions?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as SpecQuestionsApiResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.questions)) throw new Error(data.error ?? 'Failed to load questions.');
        if (!ignore) setSpecQuestions(data.questions);
      } catch (error) {
        console.error(error);
        if (!ignore) setSpecQuestions([]);
      }
    }

    void loadSpecQuestions();
    return () => {
      ignore = true;
    };
  }, [selectedFamily, selectedSector, flowMode]);

  useEffect(() => {
    if (!brandSlug || flowMode !== 'exact_model' || !tractorType || !drive || !cab) {
      setTractorModels([]);
      setModelId('');
      setModelDropdownOpen(false);
      setModelsLoading(false);
      return;
    }

    const tractorTypeForRequest = tractorType;
    const driveForRequest = drive;
    const cabForRequest = cab;

    let ignore = false;
    setModelsLoading(true);
    setTractorModels([]);
    setModelId('');
    setModelDropdownOpen(false);

    async function loadModels() {
      try {
        const params = new URLSearchParams({
          brandSlug,
          tractorType: tractorTypeForRequest,
          drive: driveForRequest,
          cab: cabForRequest,
        });
        const response = await fetch(`/api/tractor-models?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as TractorModelsApiResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.models)) throw new Error(data.error ?? 'Failed to load models.');
        if (ignore) return;
        setTractorModels(data.models);
      } catch (error) {
        console.error(error);
        if (!ignore) setTractorModels([]);
      } finally {
        if (!ignore) setModelsLoading(false);
      }
    }

    void loadModels();
    return () => {
      ignore = true;
    };
  }, [brandSlug, flowMode, tractorType, drive, cab]);

  function resetResult() {
    setResultState(null);
    setSelectedMethod('aim4price');
    setReplacementPriceBasis('aim4price');
    setReplacementPanelOpen(false);
  }

  function resetDetailsFlow() {
    setYear(String(CURRENT_YEAR));
    setYearModelUnknown(false);
    setUsageAmount('');
    setLifeWorkedPercent('');
    setCondition('good');
    setSpecAnswers({});
    setYearStepComplete(false);
    setUsageStepComplete(false);
    setConditionStepComplete(false);
    setActiveDetailsModal(null);
    setUsageModalMode('hours');
    resetResult();
  }

  function setSpecAnswer(key: string, value: string) {
    setSpecAnswers((current) => ({ ...current, [key]: value }));
    resetResult();
  }

  function validateDetails(): string | null {
    if (!selectedFamily) return 'Choose an equipment family first.';
    if (!selectedBrand) return 'Choose a brand first.';

    const genericPath = flowMode === 'generic_specs';
    const selfPropelled = selectedFamily?.isPropelled || selectedFamily?.usageMetricType === 'hours';
    const showHoursInput = !genericPath || selfPropelled;

    if (!yearStepComplete) return 'Choose the machine manufacturing year or mark it as unknown.';

    if (!yearModelUnknown) {
      if (!Number.isInteger(yearNumber) || yearNumber < 1950 || yearNumber > CURRENT_YEAR) {
        return 'Enter a valid machine manufacturing year or mark the year as unknown.';
      }
    }

    if (!usageStepComplete) {
      return showHoursInput ? 'Enter the machine hours or estimate how much it has worked.' : 'Estimate how much the machine has worked.';
    }

    if (showHoursInput && !usageNumber && lifeWorkedPercentNumber === null) {
      return 'Enter machine hours or estimate how much the machine has worked.';
    }

    if (!showHoursInput && lifeWorkedPercentNumber === null) {
      return 'Estimate how much the machine has worked as a percentage.';
    }

    if (!conditionStepComplete || !condition) return 'Choose the condition.';
    if (flowMode === 'exact_model' && !tractorSetupComplete) return 'Complete the type, drive and cab setup first.';
    if (flowMode === 'exact_model' && !selectedModel) return 'Choose the exact model or use machine specs.';

    if (flowMode === 'generic_specs') {
      for (const question of specQuestions) {
        if (question.isRequired && !isSpecQuestionAnswered(question, specAnswers[question.specKey])) {
          return `Answer: ${question.label}.`;
        }
      }
    }

    return null;
  }


  async function calculateGenericWithReplacementPrice(priceExVat: number) {
    if (!selectedSector || !selectedFamily || !selectedBrand) {
      setMessage('Choose a sector, family and brand first.');
      return;
    }

    const validationMessage = validateDetails();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setReplacementRecalculateLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/generic-valuations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectorKey: selectedSector,
          familyKey: selectedFamily.familyKey,
          brandSlug: selectedBrand.slug,
          typedModelName,
          specsJson: enrichedSpecsJson,
          year: yearModelUnknown ? CURRENT_YEAR : yearNumber,
          yearModelUnknown,
          usageAmount: usageNumber,
          lifeWorkedPercent: lifeWorkedPercentNumber,
          condition,
          userReplacementPriceExVat: priceExVat,
          userReplacementPriceYear: CURRENT_YEAR,
        }),
      });
      const data = (await response.json()) as GenericValuationApiResponse;
      if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? 'Failed to recalculate with user replacement price.');
      setResultState({ kind: 'generic', result: data.result });
      setReplacementPriceBasis('user');
      setSelectedMethod('aim4price');
      setReplacementPanelOpen(true);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : 'Failed to recalculate with user replacement price.');
    } finally {
      setReplacementRecalculateLoading(false);
    }
  }

  async function calculateValuation() {
    if (!selectedSector) {
      setMessage('Choose a sector first.');
      return;
    }

    const validationMessage = validateDetails();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    if (!isSignedIn && guestValuationCount >= 3) {
      setMessage('You have used your 3 free valuations. Please create an account or log in to continue.');
      router.push('/auth#signup');
      return;
    }

    setMessage('');
    setValuationLoading(true);

    try {
      if (flowMode === 'exact_model' && selectedModel) {
        const response = await fetch('/api/tractor-valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: selectedModel.id,
            year: yearModelUnknown ? CURRENT_YEAR : yearNumber,
            hours: usageNumber ?? estimateHoursFromWorkedPercent(selectedModel, lifeWorkedPercentNumber) ?? 0,
            condition,
            frontPto,
            frontLoader,
            gpsEnabled,
            gpsType,
            gpsYear,
          }),
        });
        const data = (await response.json()) as TractorValuationApiResponse;
        if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? 'Failed to calculate tractor valuation.');
        setResultState({ kind: 'tractor', result: data.result });
        setSelectedMethod(data.result.marketMid !== null ? 'market' : 'aim4price');
        setReplacementPanelOpen(false);
      } else if (selectedFamily && selectedBrand) {
        const response = await fetch('/api/generic-valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectorKey: selectedSector,
            familyKey: selectedFamily.familyKey,
            brandSlug: selectedBrand.slug,
            typedModelName,
            specsJson: enrichedSpecsJson,
            year: yearModelUnknown ? CURRENT_YEAR : yearNumber,
            yearModelUnknown,
            usageAmount: usageNumber,
            lifeWorkedPercent: lifeWorkedPercentNumber,
            condition,
            userReplacementPriceExVat: toNumberOrNull(userReplacementPrice),
            userReplacementPriceYear: toNumberOrNull(userReplacementPrice) ? CURRENT_YEAR : null,
          }),
        });
        const data = (await response.json()) as GenericValuationApiResponse;
        if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? 'Failed to calculate generic valuation.');
        setResultState({ kind: 'generic', result: data.result });
        setReplacementPriceBasis(data.result.userReplacementCalculation ? 'user' : 'aim4price');
        setSelectedMethod(data.result.marketAverageExVat !== null ? 'market' : 'aim4price');
        setReplacementPanelOpen(false);
      }

      if (!isSignedIn) {
        setGuestValuationCount(incrementGuestValuationCount());
      }
      setStep(5);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : 'Failed to calculate valuation.');
    } finally {
      setValuationLoading(false);
    }
  }

  async function saveToAssetRegister() {
    if (!resultState) {
      setMessage('Run a valuation before saving.');
      return;
    }

    if (!isSignedIn) {
      setMessage('Please create an account or log in to save to your asset register.');
      router.push('/auth#signup');
      return;
    }

    const selectedValue = getHeadlineValue(resultState, selectedMethod, replacementPriceBasis);
    if (selectedValue === null) {
      setMessage('Choose an available valuation method first.');
      return;
    }

    setSaveLoading(true);
    setMessage('');

    try {
      const payload =
        resultState.kind === 'tractor'
          ? {
              modelId: resultState.result.model.id,
              year: yearModelUnknown ? CURRENT_YEAR : yearNumber,
              hours: usageNumber ?? estimateHoursFromWorkedPercent(selectedModel, lifeWorkedPercentNumber) ?? 0,
              condition,
              frontPto,
              frontLoader,
              gpsEnabled,
              gpsType,
              gpsYear,
              selectedMethod,
              valuationVersion: 'v1',
            }
          : {
              catalogModeUsed: 'generic_specs',
              sectorKey: resultState.result.sector.key,
              familyKey: resultState.result.family.key,
              brandSlug: resultState.result.brand.slug,
              typedModelName: resultState.result.typedModelName,
              specsJson: resultState.result.specsJson,
              year: resultState.result.year,
              yearModelUnknown,
              usageAmount: resultState.result.usageAmount,
              lifeWorkedPercent: resultState.result.lifeWorkedPercent,
              condition: resultState.result.condition,
              userReplacementPriceExVat:
                replacementPriceBasis === 'user' && selectedMethod === 'aim4price' ? resultState.result.userReplacementPriceExVat : null,
              userReplacementPriceYear:
                replacementPriceBasis === 'user' && selectedMethod === 'aim4price' ? resultState.result.userReplacementPriceYear : null,
              selectedMethod,
              valuationVersion: 'generic-v1',
            };

      const response = await fetch('/api/valuation-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as SaveValuationRunApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to save valuation.');
      router.push('/asset-register');
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : 'Failed to save valuation.');
    } finally {
      setSaveLoading(false);
    }
  }

  function handleNext() {
    setMessage('');
    if (step === 1 && !selectedFamily) {
      setMessage('Choose an equipment family first.');
      return;
    }
    if (step === 2 && !selectedBrand) {
      setMessage('Choose a brand first.');
      return;
    }
    if (step === 3) {
      if (exactTractorAvailable && !flowMode) {
        setMessage('Choose a valuation path first.');
        return;
      }
      if (flowMode === 'exact_model' && !tractorSetupComplete) {
        setMessage('Complete the type, drive and cab setup first.');
        return;
      }
      if (flowMode === 'exact_model' && !selectedModel) {
        setMessage('Choose an exact model or continue using machine specs.');
        return;
      }
    }
    if (step === 4) {
      void calculateValuation();
      return;
    }
    setStep(nextStep(step));
  }

  function resetToSectorSelection() {
    setStep(1);
    setSelectedSector(null);
    setFamilies([]);
    setFamilyKey('');
    setFamilySearch('');
    setEquipmentDropdownOpen(false);
    setBrands([]);
    setBrandSlug('');
    setBrandSearch('');
    setBrandDropdownOpen(false);
    setTypedModelName('');
    setModelQuery('');
    setModelDropdownOpen(false);
    setModelId('');
    setTractorType('');
    setDrive('');
    setCab('');
    setTractorModels([]);
    setSpecQuestions([]);
    setSpecAnswers({});
    setUsageAmount('');
    setLifeWorkedPercent('');
    setUserReplacementPrice('');
    setYearModelUnknown(false);
    setMessage('');
    resetResult();
  }

  function handleSectorSelect(sectorKey: SectorKey) {
    const sector = SECTOR_OPTIONS.find((option) => option.key === sectorKey);
    if (!sector?.available) {
      setMessage(`${SECTOR_LABELS[sectorKey]} is coming soon.`);
      return;
    }

    setMessage('');
    setSelectedSector(sectorKey);
    resetResult();
  }

  function handleFamilySelection(nextFamilyKey: string) {
    if (!nextFamilyKey) return;

    setFamilyKey(nextFamilyKey);
    setFamilySearch('');
    setEquipmentDropdownOpen(false);
    setTypedModelName('');
    setModelQuery('');
    setModelDropdownOpen(false);
    setModelId('');
    setTractorType('');
    setDrive('');
    setCab('');
    setTractorModels([]);
    setBrandSearch('');
    setBrandDropdownOpen(false);
    setBrandSlug('');
    resetResult();
    setStep(2);
  }

  function handleBrandSelection(nextBrandSlug: string) {
    if (!nextBrandSlug) return;

    setBrandSlug(nextBrandSlug);
    setBrandSearch('');
    setBrandDropdownOpen(false);
    setTypedModelName('');
    setModelQuery('');
    setModelDropdownOpen(false);
    setModelId('');
    setTractorType('');
    setDrive('');
    setCab('');
    setTractorModels([]);
    resetResult();
    setStep(3);
  }

  function resetExactModelSelection() {
    setModelQuery('');
    setModelDropdownOpen(false);
    setModelId('');
    setTractorModels([]);
    resetResult();
  }

  function handleTractorTypeSelection(value: TractorType) {
    setTractorType(value);
    setDrive('');
    setCab('');
    resetExactModelSelection();
  }

  function handleDriveSelection(value: DriveType) {
    setDrive(value);
    setCab('');
    resetExactModelSelection();
  }

  function handleCabSelection(value: CabType) {
    setCab(value);
    resetExactModelSelection();
  }

  function handleModelSelection(nextModelId: string) {
    if (!nextModelId) return;
    setModelId(nextModelId);
    setModelQuery('');
    setModelDropdownOpen(false);
    setMessage('');
    resetResult();
    setStep(4);
  }

  function handleBack() {
    setMessage('');
    if (step === 1) {
      if (selectedSector) {
        resetToSectorSelection();
        return;
      }

      router.push('/');
      return;
    }
    setStep(previousStep(step));
  }

  function renderMachineStep() {
    if (!selectedSector) {
      return (
        <div className={styles.sectorStart}>
          <h2 className={styles.stepTitle}>Choose sector</h2>
          <p className={styles.stepText}>Pick the sector first. Hover over a card to preview that sector.</p>

          <div className={styles.sectorLargeGrid}>
            {SECTOR_OPTIONS.map((sector) => {
              const isAvailable = sector.available;
              return (
                <button
                  key={sector.key}
                  type="button"
                  className={`${styles.sectorBigCard} ${isAvailable ? styles.sectorBigCardLive : styles.sectorBigCardSoon}`}
                  onClick={() => handleSectorSelect(sector.key)}
                  onMouseEnter={(event) => playSectorPreview(event.currentTarget)}
                  onMouseLeave={(event) => resetSectorPreview(event.currentTarget)}
                  onFocus={(event) => playSectorPreview(event.currentTarget)}
                  onBlur={(event) => resetSectorPreview(event.currentTarget)}
                  aria-label={isAvailable ? `Choose ${sector.label}` : `${sector.label} coming soon`}
                >
                  <video
                    className={styles.sectorVideo}
                    muted
                    loop
                    playsInline
                    preload="auto"
                    poster=""
                  >
                    <source src={sector.videoSrc} type="video/mp4" />
                  </video>

                  <span className={styles.sectorVideoOverlay} />

                  <span className={styles.sectorBigCardContent}>
                    <span className={styles.sectorCardTopRow}>
                      <span className={isAvailable ? styles.liveBadge : styles.soonBadge}>
                        {isAvailable ? 'Live now' : 'Coming soon'}
                      </span>
                    </span>

                    <span className={styles.sectorLabelWrap}>
                      <strong className={styles.sectorLabel}>{sector.label}</strong>
                      {isAvailable ? <span className={styles.sectorCardHint}>Open valuation flow</span> : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className={styles.equipmentStage}>
        <div className={styles.equipmentStageTop}>
          <button type="button" className={styles.stageBackButton} onClick={resetToSectorSelection}>
            Change sector
          </button>
          <span className={styles.selectedSummaryPill}>{SECTOR_LABELS[selectedSector]}</span>
        </div>

        <h2 className={styles.stepTitle}>Choose equipment type</h2>
        <p className={styles.stepText}>Search or choose the machine type. Selecting one moves to the brand step automatically.</p>

        <div className={`${styles.currentCard} ${styles.equipmentPickerCard}`} style={{ marginTop: '1rem' }}>
          <div className={styles.equipmentPickerHead}>
            <div>
              <span className={styles.fieldLabel}>Search equipment type</span>
              <p className={styles.equipmentPickerHint}>Type a normal word, then pick the matching machine from the dropdown.</p>
            </div>
            <span className={styles.equipmentCountPill}>{familiesLoading ? 'Loading' : `${filteredFamilies.length} found`}</span>
          </div>

          <label className={`${styles.field} ${styles.searchPanel}`}>
            <input
              className={styles.searchInput}
              value={familySearch}
              onChange={(event) => {
                setFamilySearch(event.target.value);
                setEquipmentDropdownOpen(true);
              }}
              onFocus={() => setEquipmentDropdownOpen(true)}
              placeholder="e.g. baler, tractor, spreader"
              autoComplete="off"
            />
          </label>

          <div className={styles.equipmentDropdownWrap}>
            <button
              type="button"
              className={`${styles.equipmentDropdownTrigger} ${equipmentDropdownOpen ? styles.equipmentDropdownTriggerOpen : ''}`}
              onClick={() => setEquipmentDropdownOpen((value) => !value)}
              disabled={familiesLoading || !filteredFamilies.length}
              aria-expanded={equipmentDropdownOpen}
            >
              <span>{selectedFamily ? selectedFamily.familyLabel : familiesLoading ? 'Loading equipment types...' : 'Select equipment type...'}</span>
              <span className={styles.equipmentDropdownChevron}>⌄</span>
            </button>

            {equipmentDropdownOpen ? (
              <div className={styles.equipmentDropdownMenu}>
                {filteredFamilies.length ? (
                  filteredFamilies.map((family) => (
                    <button
                      key={family.familyKey}
                      type="button"
                      className={`${styles.equipmentDropdownOption} ${familyKey === family.familyKey ? styles.equipmentDropdownOptionActive : ''}`}
                      onClick={() => handleFamilySelection(family.familyKey)}
                    >
                      <span>{family.familyLabel}</span>
                    </button>
                  ))
                ) : (
                  <div className={styles.equipmentDropdownEmpty}>No matching equipment type found.</div>
                )}
              </div>
            ) : null}
          </div>

          {familiesLoading ? <p className={styles.fieldHint}>Loading equipment types...</p> : null}

          {!filteredFamilies.length && !familiesLoading ? (
            <p className={styles.message}>No matching equipment type found. Clear the search or import the family into the equipment catalogue.</p>
          ) : null}
        </div>
      </div>
    );
  }

  function renderBrandStep() {
    return (
      <div className={styles.equipmentStage}>
        <div className={styles.equipmentStageTop}>
          <button type="button" className={styles.stageBackButton} onClick={() => setStep(1)}>
            Change equipment type
          </button>
          {selectedFamily ? <span className={styles.selectedSummaryPill}>{selectedFamily.familyLabel}</span> : null}
        </div>

        <h2 className={styles.stepTitle}>Choose brand</h2>
        <p className={styles.stepText}>Search or choose the brand. Selecting one moves to the next step automatically.</p>

        <div className={`${styles.currentCard} ${styles.equipmentPickerCard}`} style={{ marginTop: '1rem' }}>
          <div className={styles.equipmentPickerHead}>
            <div>
              <span className={styles.fieldLabel}>Search brand</span>
              <p className={styles.equipmentPickerHint}>Type the brand name, then pick the matching brand from the dropdown.</p>
            </div>
            <span className={styles.equipmentCountPill}>{brandsLoading ? 'Loading' : `${filteredBrands.length} found`}</span>
          </div>

          <label className={`${styles.field} ${styles.searchPanel}`}>
            <input
              className={styles.searchInput}
              value={brandSearch}
              onChange={(event) => {
                setBrandSearch(event.target.value);
                setBrandDropdownOpen(true);
              }}
              onFocus={() => setBrandDropdownOpen(true)}
              placeholder="e.g. Claas, John Deere, New Holland"
              autoComplete="off"
            />
          </label>

          <div className={styles.equipmentDropdownWrap}>
            <button
              type="button"
              className={`${styles.equipmentDropdownTrigger} ${brandDropdownOpen ? styles.equipmentDropdownTriggerOpen : ''}`}
              onClick={() => setBrandDropdownOpen((value) => !value)}
              disabled={brandsLoading || !filteredBrands.length}
              aria-expanded={brandDropdownOpen}
            >
              <span>{selectedBrand ? selectedBrand.name : brandsLoading ? 'Loading brands...' : 'Select brand...'}</span>
              <span className={styles.equipmentDropdownChevron}>⌄</span>
            </button>

            {brandDropdownOpen ? (
              <div className={styles.equipmentDropdownMenu}>
                {filteredBrands.length ? (
                  filteredBrands.map((brand) => (
                    <button
                      key={brand.slug}
                      type="button"
                      className={`${styles.equipmentDropdownOption} ${brandSlug === brand.slug ? styles.equipmentDropdownOptionActive : ''}`}
                      onClick={() => handleBrandSelection(brand.slug)}
                    >
                      <span>{brand.name}</span>
                    </button>
                  ))
                ) : (
                  <div className={styles.equipmentDropdownEmpty}>No matching brand found.</div>
                )}
              </div>
            ) : null}
          </div>

          {brandsLoading ? <p className={styles.fieldHint}>Loading brands...</p> : null}

          {!brands.length && !brandsLoading ? (
            <p className={styles.message}>No brands are linked to this equipment type yet. Add brands for this family before running valuations.</p>
          ) : null}
          {brands.length > 0 && !filteredBrands.length && !brandsLoading ? (
            <p className={styles.message}>No matching brand. Clear the search or choose another machine type.</p>
          ) : null}
        </div>
      </div>
    );
  }

  function renderPathStep() {
    if (!exactTractorAvailable) {
      return (
        <div>
          <h2 className={styles.stepTitle}>Machine specs path</h2>
          <p className={styles.stepText}>
            Aim4price is building exact model data across all equipment types. For now, this valuation uses brand, condition, worked percentage and family specs.
          </p>
          {renderTypedModelBox()}
        </div>
      );
    }

    return (
      <div>
        <h2 className={styles.stepTitle}>Choose valuation path</h2>
        <p className={styles.stepText}>Choose one path first. Aim4price only shows the matching setup after you select it.</p>

        <div className={`${styles.choiceGrid} ${styles.pathChoiceGrid} ${styles.pathChoiceDeck}`}>
          <button
            type="button"
            className={`${styles.choiceCard} ${styles.pathChoiceCard} ${flowMode === 'exact_model' ? styles.choiceCardActive : ''}`}
            onClick={() => {
              setFlowMode('exact_model');
              setTypedModelName('');
              setTractorType('');
              setDrive('');
              setCab('');
              resetExactModelSelection();
              resetDetailsFlow();
            }}
          >
            <span className={styles.pathChoiceCardEyebrow}>Recommended</span>
            <strong>Use exact model</strong>
            <span className={styles.choiceCardNote}>Best when you know the model and want the clearest valuation path.</span>
          </button>

          <button
            type="button"
            className={`${styles.choiceCard} ${styles.pathChoiceCard} ${flowMode === 'generic_specs' ? styles.choiceCardActive : ''}`}
            onClick={() => {
              setFlowMode('generic_specs');
              setTractorType('');
              setDrive('');
              setCab('');
              resetExactModelSelection();
              resetDetailsFlow();
            }}
          >
            <span className={styles.pathChoiceCardEyebrow}>Flexible</span>
            <strong>Use machine specs</strong>
            <span className={styles.choiceCardNote}>Use this when exact model data is not available or you are unsure of the exact model.</span>
          </button>
        </div>

        {!flowMode ? <div className={styles.pathSelectionPlaceholder}>Select one of the two paths above to continue.</div> : null}
        {flowMode === 'exact_model' ? renderTractorModelPicker() : null}
        {flowMode === 'generic_specs' ? renderTypedModelBox() : null}
      </div>
    );
  }

  function renderTractorModelPicker() {
    return (
      <div className={`${styles.currentCard} ${styles.tractorSetupCard}`} style={{ marginTop: '1rem' }}>
        <div className={styles.currentCardHead}>
          <div>
            <span className={styles.currentEyebrow}>Exact model setup</span>
            <h3 className={styles.currentTitle}>Find the tractor model</h3>
            <p className={styles.currentHint}>Choose the basic setup first. The model list appears after type, drive and cab are selected.</p>
          </div>
        </div>

        <div className={styles.tractorSetupProgress}>
          <div className={styles.inlineSetupGroup}>
            <div className={styles.inlineSetupHeader}>
              <span className={styles.fieldLabel}>Type</span>
              <strong>{tractorType ? getTractorTypeLabel(tractorType) : 'Choose first'}</strong>
            </div>
            <div className={styles.inlineOptionRow}>
              {TRACTOR_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.inlineOptionButton} ${tractorType === option.value ? styles.inlineOptionButtonActive : ''}`}
                  onClick={() => handleTractorTypeSelection(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {tractorType ? (
            <div className={styles.inlineSetupGroup}>
              <div className={styles.inlineSetupHeader}>
                <span className={styles.fieldLabel}>Drive</span>
                <strong>{drive ? getDriveLabel(drive) : 'Choose drive'}</strong>
              </div>
              <div className={styles.inlineOptionRow}>
                {DRIVE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.inlineOptionButton} ${drive === option.value ? styles.inlineOptionButtonActive : ''}`}
                    onClick={() => handleDriveSelection(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {tractorType && drive ? (
            <div className={styles.inlineSetupGroup}>
              <div className={styles.inlineSetupHeader}>
                <span className={styles.fieldLabel}>Cab</span>
                <strong>{cab ? getCabLabel(cab) : 'Choose cab'}</strong>
              </div>
              <div className={styles.inlineOptionRow}>
                {CAB_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.inlineOptionButton} ${cab === option.value ? styles.inlineOptionButtonActive : ''}`}
                    onClick={() => handleCabSelection(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {tractorSetupComplete ? (
            <div className={`${styles.inlineSetupGroup} ${styles.modelSetupGroup}`}>
              <div className={styles.inlineSetupHeader}>
                <span className={styles.fieldLabel}>Model</span>
                <strong>{selectedModel ? formatTractorModelLabel(selectedModel) : 'Choose model'}</strong>
              </div>

              <label className={`${styles.field} ${styles.searchPanel}`}>
                <span className={styles.fieldLabel}>Search model</span>
                <input
                  className={styles.searchInput}
                  value={modelQuery}
                  onChange={(event) => {
                    setModelQuery(event.target.value);
                    setModelDropdownOpen(true);
                  }}
                  onFocus={() => setModelDropdownOpen(true)}
                  placeholder="e.g. 6155M, 7610, 7810"
                  autoComplete="off"
                />
              </label>

              <div className={styles.equipmentDropdownWrap}>
                <button
                  type="button"
                  className={`${styles.equipmentDropdownTrigger} ${modelDropdownOpen || modelQuery ? styles.equipmentDropdownTriggerOpen : ''}`}
                  onClick={() => setModelDropdownOpen((value) => !value)}
                  disabled={modelsLoading || !tractorModels.length}
                >
                  <span>{formatTractorModelLabel(selectedModel)}</span>
                  <span className={styles.equipmentDropdownChevron}>⌄</span>
                </button>

                {modelDropdownOpen || modelQuery ? (
                  <div className={styles.equipmentDropdownMenu}>
                    {filteredModels.length ? (
                      filteredModels.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          className={`${styles.equipmentDropdownOption} ${modelId === model.id ? styles.equipmentDropdownOptionActive : ''}`}
                          onClick={() => handleModelSelection(model.id)}
                        >
                          <span className={styles.modelOptionText}>{model.brandName} {model.modelName}</span>
                          <span className={styles.modelOptionMeta}>{formatTractorModelDetail(model)}</span>
                        </button>
                      ))
                    ) : (
                      <div className={styles.equipmentDropdownEmpty}>No matching model found.</div>
                    )}
                  </div>
                ) : null}
              </div>

              {modelsLoading ? <p className={styles.fieldHint}>Loading exact models...</p> : null}
              {!tractorModels.length && !modelsLoading ? <p className={styles.message}>No exact models found for this setup. Use machine specs instead.</p> : null}
              {tractorModels.length > 0 && !filteredModels.length && !modelsLoading ? <p className={styles.message}>No matching model. Clear the search or choose another setup.</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderTypedModelBox() {
    return (
      <div className={styles.currentCard} style={{ marginTop: '1rem' }}>
        <h3 className={styles.currentTitle}>Provide an optional model name</h3>
        <p className={styles.currentHint}>This improves market matching, but leaving it blank will not block the valuation process.</p>
        <div className={styles.inputGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Model name, optional</span>
            <input
              value={typedModelName}
              onChange={(event) => {
                setTypedModelName(event.target.value);
                resetResult();
              }}
              placeholder="Model XYZ"
            />
          </label>
        </div>
      </div>
    );
  }

  function renderSpecInput(question: SpecQuestion) {
    const value = specAnswers[question.specKey] ?? '';
    const label = `${question.label}${question.unit ? ` (${question.unit})` : ''}${question.isRequired ? ' *' : ''}`;

    if (question.inputType === 'select') {
      return (
        <label key={question.specKey} className={styles.field}>
          <span className={styles.fieldLabel}>{label}</span>
          <select value={value} onChange={(event) => setSpecAnswer(question.specKey, event.target.value)}>
            <option value="">Choose...</option>
            {question.options.map((option) => (
              <option key={option.optionValue} value={option.optionValue}>
                {option.optionLabel}
              </option>
            ))}
          </select>
          {question.helpText ? <span className={styles.fieldHint}>{question.helpText}</span> : null}
        </label>
      );
    }

    if (question.inputType === 'boolean') {
      return (
        <label key={question.specKey} className={styles.field}>
          <span className={styles.fieldLabel}>{label}</span>
          <select value={value} onChange={(event) => setSpecAnswer(question.specKey, event.target.value)}>
            <option value="">Choose...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
          {question.helpText ? <span className={styles.fieldHint}>{question.helpText}</span> : null}
        </label>
      );
    }

    return (
      <label key={question.specKey} className={styles.field}>
        <span className={styles.fieldLabel}>{label}</span>
        <input
          type="text"
          inputMode={question.inputType === 'number' || question.inputType === 'money' ? 'decimal' : undefined}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSpecAnswer(question.specKey, event.target.value)}
          placeholder={question.helpText ?? question.label}
        />
        {question.helpText ? <span className={styles.fieldHint}>{question.helpText}</span> : null}
      </label>
    );
  }

  function getYearAnswerLabel(): string {
    if (!yearStepComplete) return 'Not answered';
    if (yearModelUnknown) return 'I do not know the year';
    return year;
  }

  function getUsageAnswerLabel(showHoursInput: boolean): string {
    if (!usageStepComplete) return 'Not answered';
    const hours = toNumberOrNull(usageAmount);
    if (showHoursInput && hours !== null) return `${hours.toLocaleString('en-ZA')} hours`;
    const workedPercent = toPercentOrNull(lifeWorkedPercent);
    if (workedPercent !== null) return `${workedPercent}% worked`;
    return 'Not answered';
  }

  function openUsageModal(showHoursInput: boolean) {
    setUsageModalMode(showHoursInput ? 'hours' : 'percent');
    setActiveDetailsModal('usage');
    setMessage('');
  }

  function saveYearFromInput() {
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < 1950 || parsedYear > CURRENT_YEAR) {
      setMessage(`Choose a year between 1950 and ${CURRENT_YEAR}.`);
      return;
    }

    setYear(String(parsedYear));
    setYearModelUnknown(false);
    setYearStepComplete(true);
    setActiveDetailsModal(null);
    setMessage('');
    resetResult();
  }

  function saveUnknownYear() {
    setYear(String(CURRENT_YEAR));
    setYearModelUnknown(true);
    setYearStepComplete(true);
    setActiveDetailsModal(null);
    setMessage('');
    resetResult();
  }

  function saveUsageAnswer(showHoursInput: boolean) {
    if (usageModalMode === 'hours' && showHoursInput) {
      const hours = toNumberOrNull(usageAmount);
      if (hours === null) {
        setMessage('Enter the machine hours, or choose that you do not know the hours.');
        return;
      }

      setUsageAmount(String(Math.round(hours)));
      setLifeWorkedPercent('');
      setUsageStepComplete(true);
      setActiveDetailsModal(null);
      setMessage('');
      resetResult();
      return;
    }

    const workedPercent = toPercentOrNull(lifeWorkedPercent) ?? 50;

    setLifeWorkedPercent(String(workedPercent));
    setUsageAmount('');
    setUsageStepComplete(true);
    setActiveDetailsModal(null);
    setMessage('');
    resetResult();
  }

  function renderYearModal() {
    const parsedYear = Number(year);
    const sliderYear = !yearModelUnknown && Number.isInteger(parsedYear) && parsedYear >= 1950 && parsedYear <= CURRENT_YEAR
      ? parsedYear
      : CURRENT_YEAR;
    const machineAge = Math.max(0, CURRENT_YEAR - sliderYear);
    const yearSliderProgress = ((sliderYear - 1950) / Math.max(1, CURRENT_YEAR - 1950)) * 100;
    const yearSliderStyle = { '--year-progress': `${yearSliderProgress}%` } as CSSProperties;

    return (
      <div className={styles.detailsModalOverlay} role="dialog" aria-modal="true" aria-label="Choose machine manufacturing year">
        <button type="button" className={styles.detailsModalBackdrop} aria-label="Close" onClick={() => setActiveDetailsModal(null)} />
        <div className={`${styles.detailsModal} ${styles.yearDetailsModal}`}>
          <div className={styles.detailsModalHeader}>
            <div>
              <span className={styles.currentEyebrow}>Step 1</span>
              <h3 className={styles.detailsModalTitle}>Machine manufacturing year</h3>
              <p className={styles.detailsModalText}>Slide to the year, fine-tune it if needed, then continue.</p>
            </div>
            <button type="button" className={styles.saveModalClose} onClick={() => setActiveDetailsModal(null)} aria-label="Close">
              ×
            </button>
          </div>

          <div className={styles.yearSliderPanel}>
            <div className={styles.yearSliderReadout}>
              <span>Selected year</span>
              <strong>{sliderYear}</strong>
              <small>{machineAge === 0 ? 'Current model year' : `${machineAge} year${machineAge === 1 ? '' : 's'} old`}</small>
            </div>

            <label className={styles.yearSliderControl}>
              <span className={styles.fieldLabel}>Slide to year</span>
              <input
                className={styles.yearRangeInput}
                style={yearSliderStyle}
                type="range"
                min="1950"
                max={CURRENT_YEAR}
                step="1"
                value={sliderYear}
                onChange={(event) => {
                  setYear(event.target.value);
                  setYearModelUnknown(false);
                  setMessage('');
                }}
              />
              <span className={styles.yearSliderMeta}>
                <span>1950</span>
                <span>{CURRENT_YEAR}</span>
              </span>
            </label>

            <div className={styles.yearFineTuneRow}>
              <button
                type="button"
                className={styles.yearFineTuneButton}
                onClick={() => {
                  setYear(String(Math.max(1950, sliderYear - 1)));
                  setYearModelUnknown(false);
                  setMessage('');
                }}
              >
                − 1 year
              </button>
              <button
                type="button"
                className={styles.yearFineTuneButton}
                onClick={() => {
                  setYear(String(Math.min(CURRENT_YEAR, sliderYear + 1)));
                  setYearModelUnknown(false);
                  setMessage('');
                }}
              >
                + 1 year
              </button>
            </div>
          </div>

          <div className={styles.yearSecondaryControls}>
            <label className={`${styles.field} ${styles.modalInputField} ${styles.manualYearField}`}>
              <span className={styles.fieldLabel}>Or type the year</span>
              <input
                type="text"
                inputMode="numeric"
                value={yearModelUnknown ? '' : year}
                onChange={(event) => {
                  setYear(event.target.value);
                  setYearModelUnknown(false);
                  setMessage('');
                }}
                placeholder={`e.g. ${CURRENT_YEAR}`}
              />
            </label>

            <button type="button" className={`${styles.unknownAnswerButton} ${styles.unknownDangerButton}`} onClick={saveUnknownYear}>
              I do not know the year
            </button>
          </div>

          {message ? <p className={styles.modalMessage}>{message}</p> : null}

          <div className={styles.detailsModalActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setActiveDetailsModal(null)}>
              Cancel
            </button>
            <button type="button" className={styles.primaryButton} onClick={saveYearFromInput}>
              Use this year
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderUsageModal(showHoursInput: boolean) {
    const percentageValue = toPercentOrNull(lifeWorkedPercent) ?? 50;

    return (
      <div className={styles.detailsModalOverlay} role="dialog" aria-modal="true" aria-label="Enter machine usage">
        <button type="button" className={styles.detailsModalBackdrop} aria-label="Close" onClick={() => setActiveDetailsModal(null)} />
        <div className={styles.detailsModal}>
          <div className={styles.detailsModalHeader}>
            <div>
              <span className={styles.currentEyebrow}>Step 2</span>
              <h3 className={styles.detailsModalTitle}>{usageModalMode === 'hours' && showHoursInput ? 'Machine hours' : 'Worked percentage'}</h3>
              <p className={styles.detailsModalText}>
                {usageModalMode === 'hours' && showHoursInput
                  ? 'Enter the engine or machine hours if they are available.'
                  : 'Estimate how much of the machine\'s working life has already been used.'}
              </p>
            </div>
            <button type="button" className={styles.saveModalClose} onClick={() => setActiveDetailsModal(null)} aria-label="Close">
              ×
            </button>
          </div>

          {usageModalMode === 'hours' && showHoursInput ? (
            <>
              <label className={`${styles.field} ${styles.modalInputField}`}>
                <span className={styles.fieldLabel}>Enter hours</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={usageAmount}
                  onChange={(event) => setUsageAmount(event.target.value)}
                  placeholder="e.g. 3500"
                />
              </label>

              <button
                type="button"
                className={`${styles.unknownAnswerButton} ${styles.unknownDangerButton}`}
                onClick={() => {
                  setUsageAmount('');
                  setUsageModalMode('percent');
                }}
              >
                I do not know the engine hours
              </button>
            </>
          ) : (
            <>
              <label className={`${styles.field} ${styles.modalInputField}`}>
                <span className={styles.fieldLabel}>Worked percentage</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={lifeWorkedPercent}
                  onChange={(event) => setLifeWorkedPercent(event.target.value)}
                  placeholder="e.g. 50"
                />
              </label>

              <input
                className={styles.percentSlider}
                type="range"
                min="0"
                max="100"
                value={percentageValue}
                onChange={(event) => setLifeWorkedPercent(event.target.value)}
              />
              <div className={styles.percentScale}>
                <span>0% almost new</span>
                <strong>{percentageValue}%</strong>
                <span>100% fully used</span>
              </div>

              {showHoursInput ? (
                <button type="button" className={styles.unknownAnswerButton} onClick={() => setUsageModalMode('hours')}>
                  I know the engine hours
                </button>
              ) : null}
            </>
          )}

          {message ? <p className={styles.modalMessage}>{message}</p> : null}

          <div className={styles.detailsModalActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setActiveDetailsModal(null)}>
              Cancel
            </button>
            <button type="button" className={styles.primaryButton} onClick={() => saveUsageAnswer(showHoursInput)}>
              Save answer
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderSpecQuestionsProgress() {
    if (!conditionStepComplete) return null;

    if (!specQuestions.length) {
      return (
        <div className={`${styles.currentCard} ${styles.specProgressCard}`}>
          <h3 className={styles.currentTitle}>Answer a few simple questions</h3>
          <p className={styles.message}>No family-specific questions imported yet. Aim4price will use year, condition, worked percentage, brand and replacement bands if available.</p>
        </div>
      );
    }

    const visibleQuestions: SpecQuestion[] = [];
    for (const question of specQuestions) {
      visibleQuestions.push(question);
      if (question.isRequired && !isSpecQuestionAnswered(question, specAnswers[question.specKey])) break;
    }

    const requiredAnswered = specQuestions.every((question) => !question.isRequired || isSpecQuestionAnswered(question, specAnswers[question.specKey]));

    return (
      <div className={`${styles.currentCard} ${styles.specProgressCard}`}>
        <div className={styles.currentCardHead}>
          <div>
            <span className={styles.currentEyebrow}>Step 4</span>
            <h3 className={styles.currentTitle}>Answer a few simple questions</h3>
            <p className={styles.currentHint}>Answer each question in order. The next question appears underneath once the required answer is captured.</p>
          </div>
          <span className={styles.selectedSummaryPill}>{visibleQuestions.length} of {specQuestions.length}</span>
        </div>

        <div className={styles.progressiveQuestionStack}>
          {visibleQuestions.map((question, index) => {
            const answered = isSpecQuestionAnswered(question, specAnswers[question.specKey]);
            return (
              <div key={question.specKey} className={`${styles.progressiveQuestionCard} ${answered ? styles.progressiveQuestionCardDone : ''}`}>
                <div className={styles.progressiveQuestionHeader}>
                  <span className={`${styles.specStepNumber} ${answered ? styles.specStepNumberDone : ''}`}>{answered ? '✓' : index + 1}</span>
                  <div className={styles.progressiveQuestionTitleWrap}>
                    <strong>{question.label}{question.isRequired ? ' *' : ''}</strong>
                    <span>{answered ? getSpecQuestionAnswerLabel(question, specAnswers[question.specKey]) : question.helpText ?? 'Choose the closest available answer.'}</span>
                  </div>
                </div>
                {renderSpecInput(question)}
              </div>
            );
          })}
        </div>

        {requiredAnswered ? <p className={styles.completionHint}>Required questions completed. You can now get the valuation.</p> : null}
      </div>
    );
  }

  function renderDetailsStep() {
    const genericPath = flowMode === 'generic_specs';
    const selfPropelled = selectedFamily?.isPropelled || selectedFamily?.usageMetricType === 'hours';
    const showHoursInput = !genericPath || selfPropelled;
    const usageTitle = showHoursInput ? 'Machine hours' : 'Worked percentage';

    return (
      <div>
        <h2 className={styles.stepTitle}>{genericPath ? 'Machine specs' : 'Tractor details'}</h2>
        <p className={styles.stepText}>Answer one step at a time. Aim4price only reveals the next question after the current one is saved.</p>

        <div className={styles.specFlowStack}>
          <button
            type="button"
            className={`${styles.specStepCard} ${styles.specStepCardHero} ${yearStepComplete ? styles.specStepCardComplete : styles.specStepCardActive}`}
            onClick={() => {
              setActiveDetailsModal('year');
              setMessage('');
            }}
          >
            <span className={`${styles.specStepNumber} ${yearStepComplete ? styles.specStepNumberDone : ''}`}>{yearStepComplete ? '✓' : 1}</span>
            <span className={styles.specStepContent}>
              <strong>Machine manufacturing year</strong>
              <small>{yearStepComplete ? getYearAnswerLabel() : 'Choose the manufacturing year to start.'}</small>
            </span>
            <span className={styles.specStepAction}>{yearStepComplete ? 'Edit' : 'Choose year'}</span>
          </button>

          {yearStepComplete ? (
            <button
              type="button"
              className={`${styles.specStepCard} ${usageStepComplete ? styles.specStepCardComplete : styles.specStepCardActive}`}
              onClick={() => openUsageModal(showHoursInput)}
            >
              <span className={`${styles.specStepNumber} ${usageStepComplete ? styles.specStepNumberDone : ''}`}>{usageStepComplete ? '✓' : 2}</span>
              <span className={styles.specStepContent}>
                <strong>{usageTitle}</strong>
                <small>{usageStepComplete ? getUsageAnswerLabel(showHoursInput) : `Add ${usageTitle.toLowerCase()} to continue.`}</small>
              </span>
              <span className={styles.specStepAction}>{usageStepComplete ? 'Edit' : 'Add details'}</span>
            </button>
          ) : null}

          {usageStepComplete ? (
            <div className={`${styles.currentCard} ${styles.conditionStepCard}`}>
              <div className={styles.currentCardHead}>
                <div>
                  <span className={styles.currentEyebrow}>Step 3</span>
                  <h3 className={styles.currentTitle}>Condition</h3>
                  <p className={styles.currentHint}>Choose the closest current condition.</p>
                </div>
                {conditionStepComplete ? <span className={styles.selectedSummaryPill}>{conditionLabel(condition)}</span> : <span className={styles.selectedSummaryPill}>Choose one</span>}
              </div>

              <div className={styles.conditionButtonGrid}>
                {conditionOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`${styles.conditionChoiceButton} ${conditionStepComplete && condition === option.key ? styles.conditionChoiceButtonActive : ''}`}
                    onClick={() => {
                      setCondition(option.key);
                      setConditionStepComplete(true);
                      resetResult();
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {conditionStepComplete && genericPath ? renderSpecQuestionsProgress() : null}
        </div>

        {!genericPath && conditionStepComplete ? (
          <div className={styles.currentCard} style={{ marginTop: '1rem' }}>
            <h3 className={styles.currentTitle}>Tractor extras</h3>
            <div className={styles.choiceGrid}>
              <button type="button" className={`${styles.choiceCard} ${frontPto ? styles.choiceCardActive : ''}`} onClick={() => setFrontPto((value) => !value)}>
                <strong>Front PTO</strong>
                <span className={styles.choiceCardNote}>Front hitch / PTO fitted</span>
              </button>
              <button type="button" className={`${styles.choiceCard} ${frontLoader ? styles.choiceCardActive : ''}`} onClick={() => setFrontLoader((value) => !value)}>
                <strong>Front Loader</strong>
                <span className={styles.choiceCardNote}>Loader fitted</span>
              </button>
              <button type="button" className={`${styles.choiceCard} ${gpsEnabled ? styles.choiceCardActive : ''}`} onClick={() => setGpsEnabled((value) => !value)}>
                <strong>GPS</strong>
                <span className={styles.choiceCardNote}>Guidance or autosteer</span>
              </button>
            </div>
            {gpsEnabled ? (
              <div className={styles.inputGrid} style={{ marginTop: '1rem' }}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>GPS type</span>
                  <select value={gpsType} onChange={(event) => setGpsType(event.target.value as GpsType)}>
                    <option value="guidance-only">Guidance only</option>
                    <option value="full-autosteer">Full autosteer</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>GPS year</span>
                  <input value={gpsYear} onChange={(event) => setGpsYear(event.target.value)} placeholder="Optional" />
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeDetailsModal === 'year' ? renderYearModal() : null}
        {activeDetailsModal === 'usage' ? renderUsageModal(showHoursInput) : null}
      </div>
    );
  }

  function renderResultStep() {
    if (!resultState) {
      return (
        <div>
          <h2 className={styles.stepTitle}>No valuation yet</h2>
          <p className={styles.stepText}>Go back and calculate a valuation first.</p>
        </div>
      );
    }

    const isGeneric = resultState.kind === 'generic';
    const genericResult = isGeneric ? resultState.result : null;
    const tractorResult = resultState.kind === 'tractor' ? resultState.result : null;
    const marketValue = isGeneric ? genericResult?.marketAverageExVat ?? null : tractorResult?.marketMid ?? null;
    const genericSelectedCalculation = genericResult ? getGenericCalculation(genericResult, replacementPriceBasis) : null;
    const aimValue = isGeneric
      ? genericSelectedCalculation?.valuationMidExVat ?? null
      : tractorResult?.aim4priceValueExVat ?? null;
    const marketCount = isGeneric ? genericResult?.marketAverageCount ?? 0 : tractorResult?.marketCount ?? 0;
    const userPriceInput = toNumberOrNull(userReplacementPrice);
    const confidenceContext: ConfidenceContext = {
      selectedMethod,
      yearKnown: !yearModelUnknown,
      hoursKnown: usageNumber !== null,
      workedPercentKnown: lifeWorkedPercentNumber !== null && usageNumber === null,
    };
    const confidenceText = getConfidenceLabel(resultState, confidenceContext);
    const confidenceNote = getConfidenceNote(resultState, confidenceContext);
    const resultHeroTone = confidenceText.toLowerCase().includes('high')
      ? styles.resultHeroHigh
      : confidenceText.toLowerCase().includes('medium')
        ? styles.resultHeroMedium
        : styles.resultHeroLow;
    const machineTitle = isGeneric
      ? `${genericResult?.family.label ?? 'Machine'} • ${genericResult?.brand.name ?? 'Brand'}${genericResult?.typedModelName ? ` • ${genericResult.typedModelName}` : ''}`
      : `${tractorResult?.model.brandName ?? ''} ${tractorResult?.model.modelName ?? ''}`.trim();
    const resultCondition = isGeneric ? genericResult?.condition ?? condition : condition;
    const usageSummary = isGeneric && genericSelectedCalculation
      ? `${formatPercent(genericSelectedCalculation.lifeWorkedPercent)} worked${genericSelectedCalculation.estimatedHours ? ` • ${genericSelectedCalculation.estimatedHours.toLocaleString('en-ZA')} estimated hours` : ''}`
      : usageNumber
        ? `${usageNumber.toLocaleString('en-ZA')} hours`
        : lifeWorkedPercentNumber !== null
          ? `${formatPercent(lifeWorkedPercentNumber)} worked`
          : 'Usage captured';
    const resultBasisText = selectedMethod === 'market'
      ? 'Based on matched marketplace evidence'
      : isGeneric && replacementPriceBasis === 'user'
        ? 'Calculated from your replacement price'
        : 'Calculated from Aim4price data';
    const replacementBasisText = genericResult?.userReplacementCalculation && replacementPriceBasis === 'user'
      ? `Current basis: your replacement price of ${money(genericResult.userReplacementCalculation.replacementPriceExVat)}`
      : `Current basis: Aim4price replacement estimate of ${money(genericResult?.aim4priceReplacementCalculation?.replacementPriceExVat ?? null)}`;

    return (
      <div className={styles.resultsLayout}>
        <div className={styles.resultsMain}>
          <section className={`${styles.resultHero} ${resultHeroTone}`}>
            <div className={styles.resultHeroTopline}>
              <span className={styles.resultKicker}>{selectedMethod === 'market' ? 'Marketplace estimate' : 'Aim4price estimate'}</span>
              <span className={`${styles.resultConfidenceBadge} ${getConfidenceClass(resultState, confidenceContext)}`}>{confidenceText}</span>
            </div>
            <strong className={styles.resultValue}>{money(headlineValue)}</strong>
            <p className={styles.resultMachineTitle}>{machineTitle}</p>
            <p className={styles.resultConfidenceNote}>{confidenceNote}</p>
            <div className={styles.resultFactsGrid}>
              <div className={styles.resultFactCard}>
                <span>Condition</span>
                <strong>{conditionLabel(resultCondition)}</strong>
              </div>
              <div className={styles.resultFactCard}>
                <span>Usage</span>
                <strong>{usageSummary}</strong>
              </div>
              <div className={styles.resultFactCard}>
                <span>Basis</span>
                <strong>{resultBasisText}</strong>
              </div>
            </div>
          </section>

          <section className={styles.resultMethodGrid}>
            <button
              type="button"
              className={`${styles.resultMethodCard} ${selectedMethod === 'aim4price' ? styles.resultMethodCardActive : ''}`}
              onClick={() => setSelectedMethod('aim4price')}
            >
              <span className={styles.resultMethodLabel}>Aim4price value</span>
              <strong>{money(aimValue)}</strong>
              <small>{isGeneric && replacementPriceBasis === 'user' ? 'Using your replacement price' : 'Using Aim4price valuation logic'}</small>
            </button>
            <button
              type="button"
              className={`${styles.resultMethodCard} ${selectedMethod === 'market' ? styles.resultMethodCardActive : ''}`}
              onClick={() => marketValue !== null && setSelectedMethod('market')}
              disabled={marketValue === null}
            >
              <span className={styles.resultMethodLabel}>Marketplace value</span>
              <strong>{money(marketValue)}</strong>
              <small>{marketCount > 0 ? `${marketCount} usable market listing${marketCount === 1 ? '' : 's'}` : 'No matching listings yet'}</small>
            </button>
          </section>

          {isGeneric && genericResult ? (
            <section className={styles.resultAccordion}>
              <button
                type="button"
                className={styles.resultAccordionToggle}
                onClick={() => setReplacementPanelOpen((open) => !open)}
                aria-expanded={replacementPanelOpen}
              >
                <span className={styles.resultAccordionTitleGroup}>
                  <strong>Replacement price</strong>
                  <small>{replacementBasisText}</small>
                </span>
                <span className={styles.resultAccordionAction}>{replacementPanelOpen ? 'Hide' : 'Adjust'}</span>
              </button>

              {replacementPanelOpen ? (
                <div className={styles.resultAccordionBody}>
                  <p className={styles.resultAccordionCopy}>
                    Replacement price means what a similar machine would cost new today. Adjust it when you know the real current new price and want Aim4price to calculate from that number.
                  </p>

                  <div className={styles.replacementOptionGrid}>
                    <button
                      type="button"
                      className={`${styles.replacementOptionCard} ${replacementPriceBasis === 'aim4price' ? styles.replacementOptionCardActive : ''}`}
                      onClick={() => {
                        setReplacementPriceBasis('aim4price');
                        setSelectedMethod('aim4price');
                      }}
                    >
                      <span>Aim4price basis</span>
                      <strong>{money(genericResult.aim4priceReplacementCalculation?.valuationMidExVat ?? null)}</strong>
                      <small>New price used: {money(genericResult.aim4priceReplacementCalculation?.replacementPriceExVat ?? null)}</small>
                    </button>

                    <button
                      type="button"
                      className={`${styles.replacementOptionCard} ${replacementPriceBasis === 'user' ? styles.replacementOptionCardActive : ''}`}
                      onClick={() => {
                        if (genericResult.userReplacementCalculation) {
                          setReplacementPriceBasis('user');
                          setSelectedMethod('aim4price');
                        }
                      }}
                      disabled={!genericResult.userReplacementCalculation}
                    >
                      <span>Your basis</span>
                      <strong>{money(genericResult.userReplacementCalculation?.valuationMidExVat ?? null)}</strong>
                      <small>New price used: {money(genericResult.userReplacementCalculation?.replacementPriceExVat ?? null)}</small>
                    </button>
                  </div>

                  <div className={styles.replacementInputPanel}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>What does this cost new today?</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={userReplacementPrice}
                        onChange={(event) => setUserReplacementPrice(event.target.value)}
                        placeholder="Optional, ex VAT"
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.assetButton}
                      disabled={!userPriceInput || replacementRecalculateLoading}
                      onClick={() => userPriceInput && calculateGenericWithReplacementPrice(userPriceInput)}
                    >
                      {replacementRecalculateLoading ? 'Recalculating...' : 'Recalculate value'}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <aside className={styles.resultsSide}>
          <div className={`${styles.sideCard} ${styles.marketEvidenceCard}`}>
            <div className={styles.marketEvidenceHeader}>
              <div>
                <h3>Market evidence</h3>
                <p>Listings used after model, year, usage and price checks.</p>
              </div>
              <span className={styles.marketEvidenceCount}>
                {marketCount > 0 ? `${marketCount} used` : 'No matches'}
              </span>
            </div>

            {marketValue !== null ? (
              <div className={styles.marketEvidenceSummary}>
                <span>Marketplace value</span>
                <strong>{money(marketValue)}</strong>
              </div>
            ) : null}

            {isGeneric && genericResult?.marketSources.length ? (
              genericResult.marketSources.slice(0, 6).map((listing) => {
                const sourceHref = normalizeExternalUrl(listing.sourceUrl);

                return (
                  <article key={listing.id} className={styles.marketEvidenceItem}>
                    <div className={styles.marketEvidenceItemHeader}>
                      <span>{formatMarketSourceLabel(listing.sourceName)}</span>
                      <small className={styles.marketEvidencePrice}>{money(listing.advertisedPriceExVat)}</small>
                    </div>
                    <strong>{listing.title}</strong>
                    <p className={styles.marketEvidenceMeta}>{formatGenericMarketMeta(listing)}</p>
                    {sourceHref ? (
                      <a className={styles.marketEvidenceLink} href={sourceHref} target="_blank" rel="noreferrer">
                        Open listing →
                      </a>
                    ) : (
                      <span className={styles.marketEvidenceNoLink}>No source link saved</span>
                    )}
                  </article>
                );
              })
            ) : tractorResult?.marketSources.length ? (
              tractorResult.marketSources.slice(0, 6).map((listing) => {
                const sourceHref = normalizeExternalUrl(listing.sourceUrl);

                return (
                  <article key={listing.id} className={styles.marketEvidenceItem}>
                    <div className={styles.marketEvidenceItemHeader}>
                      <span>{formatMarketSourceLabel(listing.sourceName)}</span>
                      <small className={styles.marketEvidencePrice}>{money(listing.advertisedPriceExVat)}</small>
                    </div>
                    <strong>{listing.title}</strong>
                    <p className={styles.marketEvidenceMeta}>{formatTractorMarketMeta(listing)}</p>
                    {sourceHref ? (
                      <a className={styles.marketEvidenceLink} href={sourceHref} target="_blank" rel="noreferrer">
                        Open listing →
                      </a>
                    ) : (
                      <span className={styles.marketEvidenceNoLink}>No source link saved</span>
                    )}
                  </article>
                );
              })
            ) : (
              <div className={styles.marketEvidenceEmpty}>
                <strong>No matching marketplace average yet</strong>
                <p>When Aim4price finds similar listings, they will appear here as supporting evidence.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    );
  }

  function renderStepBody() {
    if (step === 1) return renderMachineStep();
    if (step === 2) return renderBrandStep();
    if (step === 3) return renderPathStep();
    if (step === 4) return renderDetailsStep();
    return renderResultStep();
  }

  return (
    <main className={styles.page}>
      <AppHeader active="valuation" />
      <div className={styles.container}>
        <section className={styles.wizardShell}>
          <div id="valuation-wizard-card" className={styles.wizardCard}>
            {step > 1 ? (
              <div className={styles.wizardHeader}>
                <div className={styles.stepper}>
                  {WIZARD_STEPS.map((item) => {
                    const active = item.step === step;
                    const complete = item.step < step;
                    return (
                      <div key={item.step} className={`${styles.stepperItem} ${active ? styles.stepperItemActive : ''} ${complete ? styles.stepperItemComplete : ''}`}>
                        <span className={`${styles.stepperBullet} ${active ? styles.stepperBulletActive : ''} ${complete ? styles.stepperBulletComplete : ''}`}>
                          {complete ? '✓' : item.step}
                        </span>
                        <span className={`${styles.stepperLabel} ${active ? styles.stepperLabelActive : ''} ${complete ? styles.stepperLabelComplete : ''}`}>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className={styles.stepContent}>
              {renderStepBody()}
              {message ? <div className={styles.message}>{message}</div> : null}
            </div>

            <div className={`${styles.wizardFooter} ${step === 1 ? styles.wizardFooterSingle : ''}`}>
              <button type="button" className={styles.secondaryButton} onClick={handleBack} disabled={valuationLoading || saveLoading}>
                Back
              </button>
              {step === 1 ? null : step === 5 ? (
                <div className={styles.resultActionGroup}>
                  <button type="button" className={styles.secondaryButton} onClick={resetToSectorSelection} disabled={saveLoading}>
                    New valuation
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={saveToAssetRegister} disabled={saveLoading || !resultState}>
                    {saveLoading ? 'Saving...' : 'Save to Asset Register'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleNext}
                  disabled={valuationLoading || (step === 2 && (brandsLoading || !selectedBrand))}
                >
                  {valuationLoading ? 'Calculating...' : step === 4 ? 'Get Valuation' : 'Continue'}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
