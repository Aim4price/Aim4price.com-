'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
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
import { conditionLabel, money, range, type Result } from '../../lib/tractor-logic';
import { getGuestValuationCount, incrementGuestValuationCount } from '../../lib/guest-valuation-limit';

type Step = 1 | 2 | 3 | 4 | 5;
type MethodKey = 'aim4price' | 'market';
type FlowMode = 'exact_model' | 'generic_specs';
type GpsType = 'full-autosteer' | 'guidance-only';
type ReplacementPriceBasis = 'aim4price' | 'user';
type DepreciationMethodUsed = 'full_depreciation' | 'semi_depreciation' | 'percentage_depreciation';

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

const CURRENT_YEAR = new Date().getFullYear() + 1;

const WIZARD_STEPS: Array<{ step: Step; label: string }> = [
  { step: 1, label: 'Machine' },
  { step: 2, label: 'Brand' },
  { step: 3, label: 'Path' },
  { step: 4, label: 'Specs' },
  { step: 5, label: 'Value' },
];

const SECTOR_OPTIONS: Array<{ key: SectorKey; label: string; available: boolean }> = [
  { key: 'agricultural', label: SECTOR_LABELS.agricultural, available: true },
  { key: 'construction', label: SECTOR_LABELS.construction, available: false },
  { key: 'industrial', label: SECTOR_LABELS.industrial, available: false },
];

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

function getConfidenceLabel(state: ValuationResultState | null): string {
  if (!state) return 'Confidence: Low';
  if (state.kind === 'generic') return `Confidence: ${state.result.confidenceLabel}`;
  if (state.result.marketCount >= 5) return 'Confidence: High';
  if (state.result.marketCount >= 2) return 'Confidence: Medium';
  return 'Confidence: Low';
}

function getConfidenceClass(state: ValuationResultState | null): string {
  if (!state) return styles.confidenceLow;
  const label = getConfidenceLabel(state).toLowerCase();
  if (label.includes('high')) return styles.confidenceHigh;
  if (label.includes('medium')) return styles.confidenceMedium;
  return styles.confidenceLow;
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

export default function ValuationClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [selectedSector, setSelectedSector] = useState<SectorKey | null>(null);
  const [families, setFamilies] = useState<EquipmentFamilyRecord[]>([]);
  const [familiesLoading, setFamiliesLoading] = useState(false);
  const [familySearch, setFamilySearch] = useState('');
  const [familyKey, setFamilyKey] = useState('');
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [brandSlug, setBrandSlug] = useState('');
  const [flowMode, setFlowMode] = useState<FlowMode>('generic_specs');
  const [tractorType, setTractorType] = useState<TractorType>('field');
  const [drive, setDrive] = useState<DriveType>('4wd');
  const [cab, setCab] = useState<CabType>('cab');
  const [tractorModels, setTractorModels] = useState<TractorCatalogRow[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelQuery, setModelQuery] = useState('');
  const [modelId, setModelId] = useState('');
  const [specQuestions, setSpecQuestions] = useState<SpecQuestion[]>([]);
  const [specAnswers, setSpecAnswers] = useState<Record<string, string>>({});
  const [typedModelName, setTypedModelName] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
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
  const [resultState, setResultState] = useState<ValuationResultState | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<MethodKey>('aim4price');
  const [message, setMessage] = useState('');
  const [valuationLoading, setValuationLoading] = useState(false);
  const [replacementRecalculateLoading, setReplacementRecalculateLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [guestValuationCount, setGuestValuationCount] = useState(0);

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
    return families.filter((family) =>
      searchIncludes(`${family.familyLabel} ${family.familyKey} ${family.sectorLabel}`, familySearch),
    );
  }, [families, familySearch]);
  const filteredBrands = useMemo(() => brands.filter((brand) => searchIncludes(`${brand.name} ${brand.slug}`, brandSearch)), [brands, brandSearch]);

  const exactTractorAvailable = selectedFamily?.familyKey === 'tractors' && selectedFamily.catalogMode === 'hybrid';
  const filteredModels = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();
    if (!query) return tractorModels;
    return tractorModels.filter((model) => `${model.brandName} ${model.modelName} ${model.powerKw}`.toLowerCase().includes(query));
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
    setBrandSearch('');
    setBrands([]);
    setBrandSlug('');
    setTypedModelName('');
    setModelQuery('');
    setModelId('');
    setTractorModels([]);
    setSpecQuestions([]);
    setSpecAnswers({});
    setResultState(null);
    setSelectedMethod('aim4price');
    setReplacementPriceBasis('aim4price');

    if (!selectedSector) {
      setFamiliesLoading(false);
      return () => {
        ignore = true;
      };
    }

    setFamiliesLoading(true);

    async function loadFamilies() {
      try {
        const params = new URLSearchParams({ sectorKey: selectedSector, includeInactive: 'true' });
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

    const familyForRequest = selectedFamily;
    const familyKeyForRequest = familyForRequest.familyKey;
    const nextFlowMode = familyKeyForRequest === 'tractors' && familyForRequest.catalogMode === 'hybrid' ? 'exact_model' : 'generic_specs';

    setResultState(null);
    setSelectedMethod('aim4price');
    setReplacementPriceBasis('aim4price');
    setBrandSearch('');
    setBrandSlug('');
    setBrands([]);
    setModelQuery('');
    setModelId('');
    setTractorModels([]);
    setTypedModelName('');
    setUsageAmount('');
    setLifeWorkedPercent('');
    setUserReplacementPrice('');
    setYearModelUnknown(false);
    setFlowMode(nextFlowMode);

    let ignore = false;
    setBrandsLoading(true);

    async function loadBrands() {
      try {
        const params = new URLSearchParams({
          sectorKey: selectedSector,
          familyKey: familyKeyForRequest,
          includeInactive: 'true',
        });
        const response = await fetch(`/api/brands?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as BrandsApiResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.brands)) throw new Error(data.error ?? 'Failed to load brands.');
        if (ignore) return;
        setBrands(data.brands);
        setBrandSlug(data.brands[0]?.slug ?? '');
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
    if (!selectedFamily || !selectedSector) return;

    const familyKeyForRequest = selectedFamily.familyKey;

    let ignore = false;
    setSpecQuestions([]);
    setSpecAnswers({});

    async function loadSpecQuestions() {
      try {
        const params = new URLSearchParams({
          sectorKey: selectedSector,
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
  }, [selectedFamily, selectedSector]);

  useEffect(() => {
    if (!brandSlug || flowMode !== 'exact_model') {
      setTractorModels([]);
      setModelId('');
      return;
    }

    let ignore = false;
    setModelsLoading(true);

    async function loadModels() {
      try {
        const params = new URLSearchParams({ brandSlug, tractorType, drive, cab });
        const response = await fetch(`/api/tractor-models?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as TractorModelsApiResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.models)) throw new Error(data.error ?? 'Failed to load models.');
        if (ignore) return;
        setTractorModels(data.models);
        setModelId(data.models[0]?.id ?? '');
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
  }

  function setSpecAnswer(key: string, value: string) {
    setSpecAnswers((current) => ({ ...current, [key]: value }));
    resetResult();
  }

  function validateDetails(): string | null {
    if (!selectedFamily) return 'Choose an equipment family first.';
    if (!selectedBrand) return 'Choose a brand first.';

    const genericPath = flowMode === 'generic_specs';
    if (!genericPath || !yearModelUnknown) {
      if (!Number.isInteger(yearNumber) || yearNumber < 1950 || yearNumber > CURRENT_YEAR) return 'Enter a valid year model or mark the year as unknown.';
    }

    if (!condition) return 'Choose the condition.';
    if (flowMode === 'exact_model' && !selectedModel) return 'Choose the exact tractor model or use machine specs.';

    if (flowMode === 'exact_model' && !usageNumber && lifeWorkedPercentNumber === null) {
      return 'Enter engine hours or estimate how much the tractor has worked.';
    }

    if (genericPath) {
      if (lifeWorkedPercentNumber === null) {
        return 'Estimate how much the machine has worked as a percentage.';
      }
    }

    for (const question of specQuestions) {
      if (question.isRequired && !normalizeText(specAnswers[question.specKey])) {
        return `Answer: ${question.label}.`;
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
            year: yearNumber,
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
              year: yearNumber,
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
      if (flowMode === 'exact_model' && !selectedModel) {
        setMessage('Choose a model or continue using machine specs.');
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
    setBrands([]);
    setBrandSlug('');
    setBrandSearch('');
    setTypedModelName('');
    setModelQuery('');
    setModelId('');
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
      setMessage(`${SECTOR_LABELS[sectorKey]} is coming soon. Agriculture is live first.`);
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
    setTypedModelName('');
    setModelQuery('');
    setModelId('');
    resetResult();
    setStep(2);
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

          <div className={styles.sectorLargeGrid}>
            {SECTOR_OPTIONS.map((sector) => {
              const isAvailable = sector.available;
              return (
                <button
                  key={sector.key}
                  type="button"
                  className={`${styles.sectorBigCard} ${isAvailable ? styles.sectorBigCardLive : styles.sectorBigCardSoon}`}
                  onClick={() => handleSectorSelect(sector.key)}
                  aria-label={isAvailable ? `Choose ${sector.label}` : `${sector.label} coming soon`}
                >
                  <span className={styles.sectorBigCardContent}>
                    <strong>{sector.label}</strong>
                  </span>
                  {!isAvailable ? <span className={styles.comingSoonBanner}>Coming soon</span> : null}
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

        <div className={styles.currentCard} style={{ marginTop: '1rem' }}>
          <label className={`${styles.field} ${styles.searchPanel}`}>
            <span className={styles.fieldLabel}>Search equipment type</span>
            <input
              className={styles.searchInput}
              value={familySearch}
              onChange={(event) => setFamilySearch(event.target.value)}
              placeholder="e.g. baler, tractor, spreader"
              autoComplete="off"
            />
          </label>

          <label className={`${styles.field} ${styles.equipmentSelectField}`}>
            <span className={styles.fieldLabel}>Equipment type</span>
            <select
              value={familyKey}
              onChange={(event) => handleFamilySelection(event.target.value)}
              disabled={familiesLoading || !filteredFamilies.length}
            >
              <option value="">{familiesLoading ? 'Loading equipment types...' : 'Select equipment type...'}</option>
              {filteredFamilies.map((family) => (
                <option key={family.familyKey} value={family.familyKey}>
                  {family.familyLabel}
                </option>
              ))}
            </select>
          </label>

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
      <div>
        <h2 className={styles.stepTitle}>Choose brand</h2>
        <p className={styles.stepText}>Search by brand name or pick from the brands linked to {selectedFamily?.familyLabel ?? 'this machine type'}.</p>

        <div className={styles.currentCard}>
          <div className={styles.currentCardHead}>
            <div>
              <span className={styles.currentEyebrow}>Step 2</span>
              <h3 className={styles.currentTitle}>{selectedFamily?.familyLabel ?? 'Machine'} brand</h3>
              <p className={styles.currentHint}>The selected brand is used for model lookup, market evidence and the saved asset title.</p>
            </div>
            {selectedBrand ? <span className={styles.selectedSummaryPill}>{selectedBrand.name}</span> : null}
          </div>

          <label className={`${styles.field} ${styles.searchPanel}`}>
            <span className={styles.fieldLabel}>Search brand</span>
            <input
              className={styles.searchInput}
              value={brandSearch}
              onChange={(event) => setBrandSearch(event.target.value)}
              placeholder="e.g. Claas, John Deere, New Holland"
              autoComplete="off"
            />
          </label>

          {brandsLoading ? <p className={styles.fieldHint}>Loading brands...</p> : null}

          <div className={`${styles.choiceGrid} ${styles.brandChoiceGrid}`}>
            {filteredBrands.map((brand) => (
              <button
                key={brand.slug}
                type="button"
                className={`${styles.choiceCard} ${brandSlug === brand.slug ? styles.choiceCardActive : ''}`}
                onClick={() => {
                  setBrandSlug(brand.slug);
                  setBrandSearch('');
                  setTypedModelName('');
                  setModelQuery('');
                  setModelId('');
                  resetResult();
                }}
              >
                <span className={styles.choiceCardMeta}>Brand</span>
                <strong>{brand.name}</strong>
                <span className={styles.choiceCardNote}>Use for valuation and saved asset record</span>
              </button>
            ))}
          </div>

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
    return (
      <div>
        <h2 className={styles.stepTitle}>Choose valuation path</h2>
        <p className={styles.stepText}>Use an exact model when the catalogue supports it. Otherwise, the machine specs path gives a valuation from brand, year, condition, worked percentage and family questions.</p>

        <div className={styles.choiceGrid}>
          {exactTractorAvailable ? (
            <button
              type="button"
              className={`${styles.choiceCard} ${flowMode === 'exact_model' ? styles.choiceCardActive : ''}`}
              onClick={() => {
                setFlowMode('exact_model');
                resetResult();
              }}
            >
              <strong>Use exact tractor model</strong>
              <span className={styles.choiceCardNote}>Best confidence for tractors with approved model data.</span>
            </button>
          ) : null}

          <button
            type="button"
            className={`${styles.choiceCard} ${flowMode === 'generic_specs' ? styles.choiceCardActive : ''}`}
            onClick={() => {
              setFlowMode('generic_specs');
              resetResult();
            }}
          >
            <strong>Use machine specs</strong>
            <span className={styles.choiceCardNote}>Recommended for non-tractor equipment and for models not yet in the catalogue.</span>
          </button>
        </div>

        {flowMode === 'exact_model' ? renderTractorModelPicker() : renderTypedModelBox()}
      </div>
    );
  }

  function renderTractorModelPicker() {
    return (
      <div className={styles.currentCard} style={{ marginTop: '1rem' }}>
        <h3 className={styles.currentTitle}>Tractor setup</h3>
        <div className={styles.inputGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Type</span>
            <select value={tractorType} onChange={(event) => setTractorType(event.target.value as TractorType)}>
              <option value="field">Field</option>
              <option value="orchard">Orchard</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Drive</span>
            <select value={drive} onChange={(event) => setDrive(event.target.value as DriveType)}>
              <option value="2wd">2WD</option>
              <option value="4wd">4WD</option>
              <option value="tracks">Tracks</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Cab</span>
            <select value={cab} onChange={(event) => setCab(event.target.value as CabType)}>
              <option value="cab">Cab</option>
              <option value="open-station">Open station</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Search model</span>
            <input value={modelQuery} onChange={(event) => setModelQuery(event.target.value)} placeholder="6155M, 7610, etc." />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Model</span>
            <select value={modelId} onChange={(event) => setModelId(event.target.value)}>
              {filteredModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.brandName} {model.modelName} • {model.powerKw} kW • {model.yearStart}-{model.yearEnd}
                </option>
              ))}
            </select>
          </label>
        </div>
        {modelsLoading ? <p className={styles.fieldHint}>Loading tractor models...</p> : null}
        {!filteredModels.length && !modelsLoading ? <p className={styles.message}>No exact models found for this setup. Use machine specs instead.</p> : null}
      </div>
    );
  }

  function renderTypedModelBox() {
    return (
      <div className={styles.currentCard} style={{ marginTop: '1rem' }}>
        <h3 className={styles.currentTitle}>Optional model name</h3>
        <p className={styles.currentHint}>Add the model only when it is known. It improves market matching, but leaving it blank will not block the valuation.</p>
        <div className={styles.inputGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Model name, optional</span>
            <input
              value={typedModelName}
              onChange={(event) => {
                setTypedModelName(event.target.value);
                resetResult();
              }}
              placeholder="e.g. Verti-Mix 1251"
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
      </label>
    );
  }

  function renderDetailsStep() {
    const genericPath = flowMode === 'generic_specs';
    const selfPropelled = selectedFamily?.isPropelled || selectedFamily?.usageMetricType === 'hours';
    const showHoursInput = !genericPath || selfPropelled;
    const workedPercentLabel = showHoursInput
      ? 'If hours are unknown, how much has it worked? (%)'
      : 'How much has it worked? (%) *';

    return (
      <div>
        <h2 className={styles.stepTitle}>{genericPath ? 'Machine specs' : 'Tractor details'}</h2>
        <p className={styles.stepText}>
          Enter what is known. The valuation still works when a model or exact hours are missing, provided the required family questions are answered.
        </p>

        <div className={styles.currentCard}>
          <div className={styles.inputGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{genericPath ? 'Year model' : 'Year model *'}</span>
              <input
                type="number"
                value={yearModelUnknown ? '' : year}
                min={1950}
                max={CURRENT_YEAR}
                disabled={genericPath && yearModelUnknown}
                onChange={(event) => {
                  setYear(event.target.value);
                  resetResult();
                }}
                placeholder={genericPath && yearModelUnknown ? 'Unknown' : 'e.g. 2018'}
              />
              {genericPath ? <span className={styles.fieldHint}>Used for records and market matching. For implements, the worked percentage carries the valuation.</span> : null}
            </label>

            {genericPath ? (
              <button
                type="button"
                className={`${styles.choiceCard} ${yearModelUnknown ? styles.choiceCardActive : ''}`}
                onClick={() => {
                  setYearModelUnknown((value) => !value);
                  resetResult();
                }}
              >
                <strong>I do not know the year</strong>
                <span className={styles.choiceCardNote}>Continue without blocking the valuation.</span>
              </button>
            ) : null}

            {showHoursInput ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Engine hours, if known</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={usageAmount}
                  onChange={(event) => {
                    setUsageAmount(event.target.value);
                    resetResult();
                  }}
                  placeholder="Leave blank if unknown"
                />
                <span className={styles.fieldHint}>If this is filled in, Aim4price uses full depreciation.</span>
              </label>
            ) : null}

            <label className={styles.field}>
              <span className={styles.fieldLabel}>{workedPercentLabel}</span>
              <input
                type="text"
                inputMode="decimal"
                value={lifeWorkedPercent}
                min={0}
                max={100}
                onChange={(event) => {
                  setLifeWorkedPercent(event.target.value);
                  resetResult();
                }}
                placeholder="e.g. 50"
              />
              <span className={styles.fieldHint}>0% = almost new. 50% = worked about half its life. 100% = fully worked out.</span>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Condition *</span>
              <select value={condition} onChange={(event) => setCondition(event.target.value as ConditionKey)}>
                {conditionOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {genericPath ? (
          <div className={styles.currentCard} style={{ marginTop: '1rem' }}>
            <h3 className={styles.currentTitle}>Family questions</h3>
            {specQuestions.length ? (
              <div className={styles.inputGrid}>{specQuestions.map(renderSpecInput)}</div>
            ) : (
              <p className={styles.message}>No family-specific questions imported yet. Aim4price will use year, condition, worked percentage, brand and replacement bands if available.</p>
            )}
          </div>
        ) : (
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
        )}
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

    return (
      <div className={styles.resultsLayout}>
        <div className={styles.resultsMain}>
          <div className={`${styles.valuePanel} ${getConfidenceClass(resultState)}`}>
            <div className={styles.valuePanelTop}>
              <span className={styles.valueLabel}>
                {selectedMethod === 'market'
                  ? 'Market value'
                  : isGeneric && replacementPriceBasis === 'user'
                    ? 'Aim4price value using your replacement price'
                    : 'Aim4price value'}
              </span>
              <span className={styles.valueMeta}>{getConfidenceLabel(resultState)}</span>
            </div>
            <strong className={styles.valueAmount}>{money(headlineValue)}</strong>
            <p className={styles.valueMeta}>
              {isGeneric
                ? `${genericResult?.family.label ?? ''} • ${genericResult?.brand.name ?? ''} • ${displayMarketStrategy(genericResult?.marketMatchStrategy ?? 'none')}`
                : `${tractorResult?.model.brandName ?? ''} ${tractorResult?.model.modelName ?? ''}`}
            </p>
            {isGeneric && genericSelectedCalculation ? (
              <p className={styles.valueMeta}>
                {depreciationMethodLabel(genericSelectedCalculation.depreciationMethodUsed)} • worked {formatPercent(genericSelectedCalculation.lifeWorkedPercent)}
                {genericSelectedCalculation.estimatedHours ? ` • estimated ${genericSelectedCalculation.estimatedHours.toLocaleString('en-ZA')} hours` : ''}
              </p>
            ) : null}
          </div>

          <div className={styles.choiceGrid} style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className={`${styles.choiceCard} ${selectedMethod === 'aim4price' ? styles.choiceCardActive : ''}`}
              onClick={() => setSelectedMethod('aim4price')}
            >
              <strong>{money(aimValue)}</strong>
              <span className={styles.choiceCardNote}>
                {isGeneric && replacementPriceBasis === 'user' ? 'Using user replacement price' : 'Aim4price calculated value'}
              </span>
            </button>
            <button
              type="button"
              className={`${styles.choiceCard} ${selectedMethod === 'market' ? styles.choiceCardActive : ''}`}
              onClick={() => marketValue !== null && setSelectedMethod('market')}
              disabled={marketValue === null}
            >
              <strong>{money(marketValue)}</strong>
              <span className={styles.choiceCardNote}>{marketCount} market listing{marketCount === 1 ? '' : 's'} matched</span>
            </button>
          </div>

          {isGeneric && genericResult ? (
            <div className={styles.currentCard} style={{ marginTop: '1rem' }}>
              <h3 className={styles.currentTitle}>Replacement price comparison</h3>
              <p className={styles.currentHint}>First compare Aim4price's replacement estimate with what the user believes this machine costs new today.</p>

              <div className={styles.choiceGrid} style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className={`${styles.choiceCard} ${replacementPriceBasis === 'aim4price' ? styles.choiceCardActive : ''}`}
                  onClick={() => {
                    setReplacementPriceBasis('aim4price');
                    setSelectedMethod('aim4price');
                  }}
                >
                  <strong>{money(genericResult.aim4priceReplacementCalculation?.valuationMidExVat ?? null)}</strong>
                  <span className={styles.choiceCardNote}>
                    Aim4price replacement: {money(genericResult.aim4priceReplacementCalculation?.replacementPriceExVat ?? null)}
                  </span>
                </button>

                <button
                  type="button"
                  className={`${styles.choiceCard} ${replacementPriceBasis === 'user' ? styles.choiceCardActive : ''}`}
                  onClick={() => {
                    if (genericResult.userReplacementCalculation) {
                      setReplacementPriceBasis('user');
                      setSelectedMethod('aim4price');
                    }
                  }}
                  disabled={!genericResult.userReplacementCalculation}
                >
                  <strong>{money(genericResult.userReplacementCalculation?.valuationMidExVat ?? null)}</strong>
                  <span className={styles.choiceCardNote}>
                    User replacement: {money(genericResult.userReplacementCalculation?.replacementPriceExVat ?? null)}
                  </span>
                </button>
              </div>

              <div className={styles.inputGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>What does this cost new today?</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={userReplacementPrice}
                    onChange={(event) => setUserReplacementPrice(event.target.value)}
                    placeholder="Optional, ex VAT"
                  />
                  <span className={styles.fieldHint}>This recalculates the valuation and can be saved into the Asset Register.</span>
                </label>
                <button
                  type="button"
                  className={styles.assetButton}
                  style={{ alignSelf: 'end' }}
                  disabled={!userPriceInput || replacementRecalculateLoading}
                  onClick={() => userPriceInput && calculateGenericWithReplacementPrice(userPriceInput)}
                >
                  {replacementRecalculateLoading ? 'Recalculating...' : 'Recalculate using my replacement price'}
                </button>
              </div>

              {genericResult.replacementPriceBand ? (
                <p className={styles.fieldHint}>Matched band: {genericResult.replacementPriceBand.bandLabel} • {range(genericResult.replacementPriceMinExVat, genericResult.replacementPriceMaxExVat)}</p>
              ) : null}
              {genericResult.notes.length ? (
                <div className={styles.message}>{genericResult.notes.join(' ')}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className={styles.resultsSide}>
          <div className={styles.sideCard}>
            <h3>Market evidence</h3>
            {isGeneric && genericResult?.marketSources.length ? (
              genericResult.marketSources.slice(0, 6).map((listing) => (
                <div key={listing.id} className={styles.answerRow}>
                  <div className={styles.answerRowText}>
                    <span className={styles.answerRowLabel}>{listing.matchReason}</span>
                    <strong className={styles.answerRowValue}>{listing.title}</strong>
                    <span className={styles.fieldHint}>{money(listing.advertisedPriceExVat)}</span>
                  </div>
                </div>
              ))
            ) : tractorResult?.marketSources.length ? (
              tractorResult.marketSources.slice(0, 6).map((listing) => (
                <div key={listing.id} className={styles.answerRow}>
                  <div className={styles.answerRowText}>
                    <span className={styles.answerRowLabel}>{listing.sourceName}</span>
                    <strong className={styles.answerRowValue}>{listing.title}</strong>
                    <span className={styles.fieldHint}>{money(listing.advertisedPriceExVat)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className={styles.fieldHint}>No exact marketplace average yet. Aim4price used replacement price and depreciation.</p>
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
                <>
                  <button type="button" className={styles.secondaryButton} onClick={resetToSectorSelection} disabled={saveLoading}>
                    New valuation
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={saveToAssetRegister} disabled={saveLoading || !resultState}>
                    {saveLoading ? 'Saving...' : 'Save to Asset Register'}
                  </button>
                </>
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
