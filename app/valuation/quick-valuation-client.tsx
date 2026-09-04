'use client';

import { useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';
import quickStyles from './quick-valuation.module.css';
import dealerStyles from '../dealer/dealer.module.css';
import {
  conditionOptions,
  type BrandRow,
  type ConditionKey,
} from '../../lib/tractor-data';
import {
  SECTOR_LABELS,
  getUsageFieldLabel,
  getUsageShortUnit,
  type CatalogMode,
  type SectorKey,
  type UsageMetricType,
} from '../../lib/equipment-types';
import { conditionLabel, money, type Result } from '../../lib/tractor-logic';
import {
  getGuestValuationCount,
  incrementGuestValuationCount,
} from '../../lib/guest-valuation-limit';

type Step = 1 | 2 | 3 | 4;
type GpsType = 'full-autosteer' | 'guidance-only';

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

type EquipmentModelRecord = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  familyId: number;
  familyKey: string;
  familyLabel: string;
  usageMetricType: UsageMetricType;
  valuationMode: string;
  catalogMode: CatalogMode;
  isPropelled: boolean;
  brandId: number | null;
  brandSlug: string;
  brandName: string;
  aim4ModelKey: string | null;
  modelName: string;
  variantName: string | null;
  normalizedModelName: string;
  displayName: string;
  yearStart: number | null;
  yearEnd: number | null;
  powerKw: number | null;
  tractorType: string | null;
  driveType: string | null;
  cabType: string | null;
  workingWidthM: number | null;
  rowsCount: number | null;
  tankCapacityL: number | null;
  aim4priceReplacementPriceExVat: number | null;
  replacementPriceYear: number | null;
  isGenericFallback: boolean;
  specsJson: Record<string, unknown>;
  isActive: boolean;
};

type ReplacementPriceBand = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  familyId: number;
  familyKey: string;
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

type GenericValuationCalculation = {
  replacementPriceBasis: 'aim4price' | 'user';
  replacementPriceExVat: number | null;
  aim4priceValueExVat: number | null;
  valuationLowExVat: number | null;
  valuationMidExVat: number | null;
  valuationHighExVat: number | null;
};

type GenericValuationResult = {
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
  specsJson: Record<string, unknown>;
  year: number;
  yearModelUnknown?: boolean | null;
  usageAmount: number | null;
  condition: ConditionKey;
  replacementPriceBand: { id: number; bandLabel: string } | null;
  replacementPriceMinExVat: number | null;
  replacementPriceMaxExVat: number | null;
  replacementPriceUsedExVat: number | null;
  userReplacementPriceExVat: number | null;
  userReplacementPriceYear: number | null;
  replacementPriceBasis: 'aim4price' | 'user';
  lifeWorkedPercent: number | null;
  advancedAssumptions: { popularityStars?: number | null } | null;
  selectedCalculation: GenericValuationCalculation | null;
  aim4priceValueExVat: number | null;
  valuationLowExVat: number | null;
  valuationMidExVat: number | null;
  valuationHighExVat: number | null;
  confidenceScore: number;
  confidenceLabel: 'High' | 'Medium' | 'Low';
  notes: string[];
};

type ResultState =
  | { kind: 'tractor'; result: Result }
  | { kind: 'generic'; result: GenericValuationResult };

type ApiResponse<T> = { ok: boolean; error?: string } & T;

type QuickValuationClientProps = {
  dealerAppMode?: boolean;
  ownerAppMode?: boolean;
};

const CURRENT_YEAR = new Date().getFullYear();
const UNKNOWN_BRAND_SLUG = 'unknown';
const UNKNOWN_BRAND: BrandRow = { slug: UNKNOWN_BRAND_SLUG, name: 'Brand not listed' };
const WIZARD_STEPS: Array<{ step: Step; label: string }> = [
  { step: 1, label: 'Asset' },
  { step: 2, label: 'Details' },
  { step: 3, label: 'Replacement' },
  { step: 4, label: 'Estimate' },
];
const SECTORS: SectorKey[] = ['agricultural', 'construction', 'industrial', 'motor'];

function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function parseNumber(value: string): number | null {
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function parsePositiveMoney(value: string): number | null {
  const numeric = parseNumber(value);
  return numeric !== null && numeric > 0 ? Math.round(numeric) : null;
}

function coerceComparable(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
    return trimmed.toLowerCase();
  }
  return value;
}

function bandMatchesSpecs(band: ReplacementPriceBand, specs: Record<string, unknown>): boolean {
  for (const [rawKey, expected] of Object.entries(band.specMatchJson ?? {})) {
    if (rawKey.endsWith('_min')) {
      const actual = Number(specs[rawKey.slice(0, -4)]);
      const minimum = Number(expected);
      if (!Number.isFinite(actual) || !Number.isFinite(minimum) || actual < minimum) return false;
      continue;
    }
    if (rawKey.endsWith('_max')) {
      const actual = Number(specs[rawKey.slice(0, -4)]);
      const maximum = Number(expected);
      if (!Number.isFinite(actual) || !Number.isFinite(maximum) || actual > maximum) return false;
      continue;
    }
    const actual = coerceComparable(specs[rawKey]);
    const comparableExpected = coerceComparable(expected);
    if (typeof actual === 'number' && typeof comparableExpected === 'number') {
      if (Math.abs(actual - comparableExpected) > 0.0001) return false;
    } else if (String(actual ?? '').toLowerCase() !== String(comparableExpected ?? '').toLowerCase()) {
      return false;
    }
  }
  return true;
}

function scoreBand(band: ReplacementPriceBand): number {
  return Object.keys(band.specMatchJson ?? {}).length * 10 + (band.brandId ? 5 : 0) + Number(band.confidence || 0);
}

function nearestStep(value: number, magnitude: number): number {
  const step = magnitude >= 5_000_000 ? 100_000 : magnitude >= 1_000_000 ? 50_000 : magnitude >= 250_000 ? 10_000 : 5_000;
  return Math.max(step, Math.round(value / step) * step);
}

export default function QuickValuationClient({ dealerAppMode = false, ownerAppMode = false }: QuickValuationClientProps) {
  const compactAppMode = dealerAppMode || ownerAppMode;
  const [step, setStep] = useState<Step>(1);
  const [selectedSector, setSelectedSector] = useState<SectorKey | null>(null);
  const [families, setFamilies] = useState<EquipmentFamilyRecord[]>([]);
  const [familyKey, setFamilyKey] = useState('');
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandSlug, setBrandSlug] = useState('');
  const [unlistedBrandName, setUnlistedBrandName] = useState('');
  const [models, setModels] = useState<EquipmentModelRecord[]>([]);
  const [modelInput, setModelInput] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [modelUnknown, setModelUnknown] = useState(false);
  const [familiesLoading, setFamiliesLoading] = useState(false);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [yearUnknown, setYearUnknown] = useState(false);
  const [usageMode, setUsageMode] = useState<'known' | 'percent'>('known');
  const [usageAmount, setUsageAmount] = useState('');
  const [lifeWorkedPercent, setLifeWorkedPercent] = useState('50');
  const [condition, setCondition] = useState<ConditionKey | ''>('');
  const [popularityStars, setPopularityStars] = useState(0);

  const [frontPto, setFrontPto] = useState(false);
  const [frontLoader, setFrontLoader] = useState(false);
  const [frontLoaderYear, setFrontLoaderYear] = useState('');
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsType, setGpsType] = useState<GpsType>('full-autosteer');
  const [gpsYear, setGpsYear] = useState('');
  const [otherExtraEnabled, setOtherExtraEnabled] = useState(false);
  const [otherExtraName, setOtherExtraName] = useState('');
  const [otherExtraReplacementPrice, setOtherExtraReplacementPrice] = useState('');

  const [replacementBands, setReplacementBands] = useState<ReplacementPriceBand[]>([]);
  const [replacementLoading, setReplacementLoading] = useState(false);
  const [replacementInput, setReplacementInput] = useState('');
  const [replacementTouched, setReplacementTouched] = useState(false);

  const [isSignedIn, setIsSignedIn] = useState(false);
  const [guestValuationCount, setGuestValuationCount] = useState(0);
  const [resultState, setResultState] = useState<ResultState | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAssetId, setSavedAssetId] = useState('');
  const [message, setMessage] = useState('');

  const selectedFamily = useMemo(
    () => families.find((family) => family.familyKey === familyKey) ?? null,
    [families, familyKey],
  );
  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.slug === brandSlug) ?? (brandSlug === UNKNOWN_BRAND_SLUG ? UNKNOWN_BRAND : null),
    [brands, brandSlug],
  );
  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? null,
    [models, selectedModelId],
  );
  const isTractor = familyKey === 'tractors';
  const isExactTractor = isTractor && Boolean(selectedModel);

  const visibleModelSuggestions = useMemo(() => {
    const query = normalizeKey(modelInput);
    if (!query || modelUnknown) return [];
    return models
      .filter((model) => {
        const haystack = normalizeKey(`${model.displayName} ${model.modelName} ${model.variantName ?? ''}`);
        return haystack.includes(query) || query.includes(normalizeKey(model.modelName));
      })
      .slice(0, 8);
  }, [modelInput, modelUnknown, models]);

  const matchedBand = useMemo(() => {
    if (!replacementBands.length) return null;
    const specs = selectedModel?.specsJson ?? {};
    const matched = replacementBands
      .filter((band) => bandMatchesSpecs(band, specs))
      .sort((left, right) => scoreBand(right) - scoreBand(left));
    return matched[0] ?? replacementBands.find((band) => Object.keys(band.specMatchJson ?? {}).length === 0) ?? null;
  }, [replacementBands, selectedModel]);

  const baseAim4priceReplacement = useMemo(() => {
    if (isExactTractor && selectedModel?.aim4priceReplacementPriceExVat) {
      return Math.round(selectedModel.aim4priceReplacementPriceExVat);
    }
    if (matchedBand) {
      return Math.round((matchedBand.replacementMinExVat + matchedBand.replacementMaxExVat) / 2);
    }
    return null;
  }, [isExactTractor, matchedBand, selectedModel]);

  const genericTractorExtrasReplacement = useMemo(() => {
    if (!isTractor || isExactTractor) return 0;
    let total = 0;
    if (frontPto) total += 250_000;
    if (frontLoader) total += 225_000;
    if (gpsEnabled) total += gpsType === 'full-autosteer' ? 250_000 : 100_000;
    if (otherExtraEnabled) total += parsePositiveMoney(otherExtraReplacementPrice) ?? 0;
    return total;
  }, [frontLoader, frontPto, gpsEnabled, gpsType, isExactTractor, isTractor, otherExtraEnabled, otherExtraReplacementPrice]);

  const suggestedReplacement = baseAim4priceReplacement === null
    ? null
    : baseAim4priceReplacement + genericTractorExtrasReplacement;
  const bandMin = matchedBand?.replacementMinExVat ?? null;
  const bandMax = matchedBand?.replacementMaxExVat ?? null;
  const replacementMin = suggestedReplacement === null
    ? 0
    : Math.max(5_000, Math.round((bandMin ?? suggestedReplacement * 0.65) + genericTractorExtrasReplacement));
  const replacementMax = suggestedReplacement === null
    ? 0
    : Math.max(replacementMin + 10_000, Math.round((bandMax ?? suggestedReplacement * 1.35) + genericTractorExtrasReplacement));
  const replacementValue = parsePositiveMoney(replacementInput);
  const replacementConfidence = isExactTractor
    ? 'Strong model information'
    : matchedBand && matchedBand.confidence >= 0.72
      ? 'Good family / brand information'
      : matchedBand
        ? 'Broad pricing information'
        : 'Limited pricing information';

  useEffect(() => {
    let mounted = true;
    async function loadMe() {
      try {
        const response = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
        const data = (await response.json()) as { signedIn?: boolean };
        if (mounted) setIsSignedIn(Boolean(data.signedIn));
      } catch {
        if (mounted) setIsSignedIn(false);
      } finally {
        if (mounted) setGuestValuationCount(getGuestValuationCount());
      }
    }
    void loadMe();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedSector) {
      setFamilies([]);
      return;
    }
    let ignore = false;
    setFamiliesLoading(true);
    setMessage('');
    void (async () => {
      try {
        const params = new URLSearchParams({ sectorKey: selectedSector, includeInactive: 'true' });
        const response = await fetch(`/api/equipment-families?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as ApiResponse<{ families?: EquipmentFamilyRecord[] }>;
        if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to load asset families.');
        if (!ignore) setFamilies((data.families ?? []).filter((family) => family.isActive));
      } catch (error) {
        if (!ignore) setMessage(error instanceof Error ? error.message : 'Failed to load asset families.');
      } finally {
        if (!ignore) setFamiliesLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [selectedSector]);

  useEffect(() => {
    if (!selectedSector || !familyKey) {
      setBrands([]);
      return;
    }
    let ignore = false;
    setBrandsLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams({ sectorKey: selectedSector, familyKey, includeInactive: 'true' });
        const response = await fetch(`/api/brands?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as ApiResponse<{ brands?: BrandRow[] }>;
        if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to load brands.');
        if (!ignore) {
          const loaded = data.brands ?? [];
          setBrands(loaded.some((brand) => brand.slug === UNKNOWN_BRAND_SLUG) ? loaded : [...loaded, UNKNOWN_BRAND]);
        }
      } catch (error) {
        if (!ignore) setMessage(error instanceof Error ? error.message : 'Failed to load brands.');
      } finally {
        if (!ignore) setBrandsLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [familyKey, selectedSector]);

  useEffect(() => {
    if (!selectedSector || !familyKey || !brandSlug || brandSlug === UNKNOWN_BRAND_SLUG) {
      setModels([]);
      setSelectedModelId(null);
      return;
    }
    let ignore = false;
    setModelsLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams({ sectorKey: selectedSector, familyKey, brandSlug, limit: '200' });
        const response = await fetch(`/api/equipment-models?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as ApiResponse<{ models?: EquipmentModelRecord[] }>;
        if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to load known models.');
        if (!ignore) setModels(data.models ?? []);
      } catch (error) {
        if (!ignore) setMessage(error instanceof Error ? error.message : 'Failed to load known models.');
      } finally {
        if (!ignore) setModelsLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [brandSlug, familyKey, selectedSector]);

  useEffect(() => {
    if (step !== 3 || !selectedSector || !familyKey || !brandSlug) return;
    let ignore = false;
    setReplacementLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams({ sectorKey: selectedSector, familyKey, brandSlug });
        const response = await fetch(`/api/replacement-price-bands?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as ApiResponse<{ bands?: ReplacementPriceBand[] }>;
        if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to load replacement price information.');
        if (!ignore) setReplacementBands(data.bands ?? []);
      } catch (error) {
        if (!ignore) {
          setReplacementBands([]);
          setMessage(error instanceof Error ? error.message : 'Failed to load replacement price information.');
        }
      } finally {
        if (!ignore) setReplacementLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [brandSlug, familyKey, selectedSector, step]);

  useEffect(() => {
    if (step !== 3 || replacementTouched || suggestedReplacement === null) return;
    setReplacementInput(String(suggestedReplacement));
  }, [replacementTouched, step, suggestedReplacement]);

  function resetAfterAssetChange() {
    setYear(String(CURRENT_YEAR));
    setYearUnknown(false);
    setUsageMode('known');
    setUsageAmount('');
    setLifeWorkedPercent('50');
    setCondition('');
    setPopularityStars(0);
    setFrontPto(false);
    setFrontLoader(false);
    setFrontLoaderYear('');
    setGpsEnabled(false);
    setGpsType('full-autosteer');
    setGpsYear('');
    setOtherExtraEnabled(false);
    setOtherExtraName('');
    setOtherExtraReplacementPrice('');
    setReplacementBands([]);
    setReplacementInput('');
    setReplacementTouched(false);
    setResultState(null);
    setSavedAssetId('');
  }

  function chooseSector(sector: SectorKey) {
    setSelectedSector(sector);
    setFamilyKey('');
    setBrandSlug('');
    setUnlistedBrandName('');
    setModelInput('');
    setSelectedModelId(null);
    setModelUnknown(false);
    resetAfterAssetChange();
    setMessage('');
  }

  function chooseFamily(family: EquipmentFamilyRecord) {
    setFamilyKey(family.familyKey);
    setBrandSlug('');
    setUnlistedBrandName('');
    setModelInput('');
    setSelectedModelId(null);
    setModelUnknown(false);
    resetAfterAssetChange();
    setMessage('');
  }

  function chooseBrand(brand: BrandRow) {
    setBrandSlug(brand.slug);
    setUnlistedBrandName('');
    setModelInput('');
    setSelectedModelId(null);
    setModelUnknown(false);
    setReplacementTouched(false);
    setReplacementInput('');
    setMessage('');
  }

  function chooseModel(model: EquipmentModelRecord) {
    setSelectedModelId(model.id);
    setModelInput(model.displayName || model.modelName);
    setModelUnknown(false);
    setReplacementTouched(false);
    setReplacementInput('');
    setMessage('');
  }

  function onModelInputChange(value: string) {
    setModelInput(value);
    setModelUnknown(false);
    const key = normalizeKey(value);
    const exact = models.find((model) => {
      return normalizeKey(model.displayName) === key || normalizeKey(model.modelName) === key || normalizeKey(model.normalizedModelName) === key;
    });
    setSelectedModelId(exact?.id ?? null);
    setReplacementTouched(false);
    setReplacementInput('');
  }

  function validateAsset(): string | null {
    if (!selectedSector || !selectedFamily) return 'Choose an asset family.';
    if (!selectedBrand) return 'Choose a brand.';
    if (brandSlug === UNKNOWN_BRAND_SLUG && !unlistedBrandName.trim()) return 'Enter the brand name, or choose a listed brand.';
    return null;
  }

  function validateDetails(): string | null {
    if (!yearUnknown) {
      const yearNumber = Number(year);
      if (!Number.isInteger(yearNumber) || yearNumber < 1950 || yearNumber > CURRENT_YEAR) return 'Enter a valid year or mark it as unknown.';
    }
    if (usageMode === 'known') {
      const usage = parseNumber(usageAmount);
      if (usage === null || usage < 0) return `Enter valid ${getUsageFieldLabel(selectedSector, selectedFamily?.usageMetricType).toLowerCase()}, or choose “I do not know”.`;
    } else {
      const percent = Number(lifeWorkedPercent);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) return 'Choose how much of its working life the asset has completed.';
    }
    if (!condition) return 'Choose the current condition.';
    if (popularityStars < 1 || popularityStars > 5) return 'Choose a popularity rating from 1 to 5.';
    if (otherExtraEnabled) {
      if (!otherExtraName.trim()) return 'Enter a name for the other extra.';
      if (!parsePositiveMoney(otherExtraReplacementPrice)) return 'Enter the replacement price for the other extra.';
    }
    return null;
  }

  function goToDetails() {
    const error = validateAsset();
    if (error) return setMessage(error);
    setMessage('');
    setStep(2);
  }

  function goToReplacement() {
    const error = validateDetails();
    if (error) return setMessage(error);
    setMessage('');
    setReplacementTouched(false);
    setReplacementInput('');
    setStep(3);
  }

  function buildSpecsJson(): Record<string, unknown> {
    const usage = usageMode === 'known' ? parseNumber(usageAmount) : null;
    const percent = usageMode === 'percent' ? Number(lifeWorkedPercent) : null;
    return {
      ...(selectedModel?.specsJson ?? {}),
      ...(selectedModel ? { catalog_model_id: selectedModel.id } : {}),
      ...(brandSlug === UNKNOWN_BRAND_SLUG
        ? { unlisted_brand_name: unlistedBrandName.trim(), typed_brand_name: unlistedBrandName.trim() }
        : {}),
      yearModelUnknown: yearUnknown,
      year_model_unknown: yearUnknown,
      usageMode: usageMode === 'known' ? (selectedFamily?.usageMetricType === 'km' ? 'km' : 'hours') : 'percent',
      usage_mode: usageMode === 'known' ? (selectedFamily?.usageMetricType === 'km' ? 'km' : 'hours') : 'percent',
      ...(usage !== null ? { usage_amount: usage } : {}),
      ...(percent !== null ? { life_worked_percent: percent, worked_percent: percent } : {}),
      ...(isTractor
        ? {
            front_pto: frontPto,
            front_loader: frontLoader,
            ...(frontLoaderYear ? { front_loader_year: frontLoaderYear } : {}),
            gps_enabled: gpsEnabled,
            ...(gpsEnabled ? { gps_type: gpsType, ...(gpsYear ? { gps_year: gpsYear } : {}) } : {}),
            ...(otherExtraEnabled
              ? {
                  other_extra_name: otherExtraName.trim(),
                  other_extra_replacement_price_ex_vat: parsePositiveMoney(otherExtraReplacementPrice),
                }
              : {}),
          }
        : {}),
    };
  }

  function getTractorExtrasRequest() {
    return {
      frontPto,
      frontLoader,
      frontLoaderYear: frontLoader && frontLoaderYear ? frontLoaderYear : null,
      gpsEnabled,
      gpsType: gpsEnabled ? gpsType : null,
      gpsYear: gpsEnabled && gpsYear ? gpsYear : null,
      otherExtraName: otherExtraEnabled ? otherExtraName.trim() : null,
      otherExtraReplacementPriceExVat: otherExtraEnabled ? parsePositiveMoney(otherExtraReplacementPrice) : null,
    };
  }

  function userReplacementForCalculation(): number | null {
    if (!replacementValue) return null;
    if (replacementTouched) return replacementValue;
    if (isExactTractor) return null;
    if (isTractor && genericTractorExtrasReplacement > 0) return replacementValue;
    return null;
  }

  async function calculateEstimate() {
    if (!replacementValue) {
      setMessage('Confirm or enter a replacement price before calculating the estimate.');
      return;
    }
    if (!isSignedIn && guestValuationCount >= 3) {
      setMessage('You have used your 3 free estimates. Please create an account or log in to continue.');
      return;
    }

    setCalculating(true);
    setMessage('');
    setSavedAssetId('');
    try {
      const calculationYear = yearUnknown ? CURRENT_YEAR : Number(year);
      const usage = usageMode === 'known' ? Math.max(0, Math.round(parseNumber(usageAmount) ?? 0)) : null;
      const workedPercent = usageMode === 'percent' ? Number(lifeWorkedPercent) : null;
      const userReplacementPriceExVat = userReplacementForCalculation();
      const advancedAssumptions = { popularityStars };

      if (isExactTractor && selectedModel) {
        const response = await fetch('/api/tractor-valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            modelId: String(selectedModel.id),
            year: calculationYear,
            yearModelUnknown: yearUnknown,
            usageMode: usageMode === 'known' ? 'hours' : 'percent',
            hours: usage ?? 0,
            lifeWorkedPercent: workedPercent,
            condition,
            ...getTractorExtrasRequest(),
            userReplacementPriceExVat,
            advancedAssumptions,
          }),
        });
        const data = (await response.json()) as ApiResponse<{ result?: Result }>;
        if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? 'Failed to calculate the tractor estimate.');
        setResultState({ kind: 'tractor', result: data.result });
      } else {
        const response = await fetch('/api/generic-valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sectorKey: selectedSector,
            familyKey,
            brandSlug,
            equipmentModelId: selectedModel?.id ?? null,
            typedModelName: modelUnknown ? null : modelInput.trim() || null,
            saveModelCandidate: !selectedModel && !modelUnknown && Boolean(modelInput.trim()),
            specsJson: buildSpecsJson(),
            year: calculationYear,
            yearModelUnknown: yearUnknown,
            usageAmount: usage,
            lifeWorkedPercent: workedPercent,
            condition,
            userReplacementPriceExVat,
            userReplacementPriceYear: userReplacementPriceExVat ? CURRENT_YEAR : null,
            advancedAssumptions,
          }),
        });
        const data = (await response.json()) as ApiResponse<{ result?: GenericValuationResult }>;
        if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? 'Failed to calculate the estimate.');
        setResultState({ kind: 'generic', result: data.result });
      }

      if (!isSignedIn) setGuestValuationCount(incrementGuestValuationCount());
      setStep(4);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to calculate the estimate.');
    } finally {
      setCalculating(false);
    }
  }

  async function saveToAssetRegister() {
    if (!resultState || !isSignedIn) return;
    setSaving(true);
    setMessage('');
    try {
      let payload: Record<string, unknown>;
      if (resultState.kind === 'tractor') {
        const result = resultState.result;
        payload = {
          modelId: String(result.model.id),
          year: yearUnknown ? CURRENT_YEAR : Number(year),
          yearModelUnknown: yearUnknown,
          usageMode: usageMode === 'known' ? 'hours' : 'percent',
          hours: usageMode === 'known' ? Math.max(0, Math.round(parseNumber(usageAmount) ?? 0)) : 0,
          lifeWorkedPercent: usageMode === 'percent' ? Number(lifeWorkedPercent) : null,
          condition,
          ...getTractorExtrasRequest(),
          userReplacementPriceExVat: result.userReplacementPriceExVat ?? null,
          advancedAssumptions: result.advancedAssumptions ?? { popularityStars },
          selectedMethod: 'aim4price',
          valuationVersion: 'v1',
        };
      } else {
        const result = resultState.result;
        payload = {
          catalogModeUsed: 'generic_specs',
          sectorKey: result.sector.key,
          familyKey: result.family.key,
          brandSlug: result.brand.slug,
          equipmentModelId: selectedModel?.id ?? null,
          typedModelName: result.typedModelName,
          specsJson: result.specsJson,
          year: result.year,
          yearModelUnknown: Boolean(result.yearModelUnknown ?? yearUnknown),
          usageAmount: result.usageAmount,
          lifeWorkedPercent: result.lifeWorkedPercent,
          condition: result.condition,
          userReplacementPriceExVat: result.userReplacementPriceExVat ?? null,
          userReplacementPriceYear: result.userReplacementPriceExVat ? result.userReplacementPriceYear ?? CURRENT_YEAR : null,
          advancedAssumptions: result.advancedAssumptions ?? { popularityStars },
          selectedMethod: 'aim4price',
          valuationVersion: 'generic-v1',
        };
      }

      const response = await fetch('/api/valuation-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as ApiResponse<{ assetId?: string }>;
      if (!response.ok || !data.ok || !data.assetId) throw new Error(data.error ?? 'Failed to save the asset.');
      setSavedAssetId(data.assetId);
      setMessage('Saved to your Asset Register.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save the asset.');
    } finally {
      setSaving(false);
    }
  }

  const resultValue = resultState?.kind === 'tractor'
    ? resultState.result.aim4priceValueExVat
    : resultState?.result.selectedCalculation?.valuationMidExVat ?? resultState?.result.valuationMidExVat ?? resultState?.result.aim4priceValueExVat ?? null;
  const resultReplacementPrice = resultState?.kind === 'tractor'
    ? resultState.result.totalReplacementPriceUsedExVat ?? resultState.result.replacementPriceUsedExVat
    : resultState?.result.replacementPriceUsedExVat ?? null;
  const resultConfidence = resultState?.kind === 'generic' ? resultState.result.confidenceLabel : (isExactTractor ? 'Strong' : 'Broad');
  const selectedBrandDisplay = brandSlug === UNKNOWN_BRAND_SLUG ? unlistedBrandName.trim() || 'Unknown brand' : selectedBrand?.name ?? '';
  const selectedModelDisplay = modelUnknown ? 'Model unknown' : modelInput.trim() || selectedModel?.modelName || 'Model not provided';
  const usageDisplay = usageMode === 'known'
    ? `${Math.round(parseNumber(usageAmount) ?? 0).toLocaleString('en-ZA')} ${getUsageShortUnit(selectedSector, selectedFamily?.usageMetricType)}`
    : `${Number(lifeWorkedPercent).toFixed(0)}% of working life`;

  function renderStepper() {
    return (
      <div className={styles.wizardHeader}>
        {compactAppMode ? <div className={styles.mobileStepSummary}><span>Estimate {step} of {WIZARD_STEPS.length}</span></div> : null}
        <div className={styles.stepper} aria-label="Estimate progress">
          {WIZARD_STEPS.map((item) => {
            const complete = item.step < step;
            const active = item.step === step;
            return (
              <div key={item.step} className={`${styles.stepperItem} ${active ? styles.stepperItemActive : ''} ${complete ? styles.stepperItemComplete : ''}`}>
                <span className={styles.stepperNumber}>{complete ? '✓' : item.step}</span>
                {!compactAppMode ? <span className={styles.stepperLabel}>{item.label}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderAssetStep() {
    return (
      <div className={quickStyles.stack}>
        <div className={styles.currentCard}>
          <div className={styles.currentCardHead}>
            <div>
              <h2 className={styles.currentTitle}>Get Estimate</h2>
              <p className={styles.currentHint}>Start with the basics. Aim4price will use what it knows without forcing you through technical specifications.</p>
            </div>
          </div>
          <div className={styles.choiceGrid}>
            <button type="button" className={`${styles.choiceCard} ${styles.choiceCardActive}`} aria-pressed="true">
              <strong>Quick Estimate</strong>
              <span className={quickStyles.modeNote}>Recommended · Family, brand, model if known, simple asset details and replacement price.</span>
            </button>
            <button type="button" className={styles.choiceCard} disabled aria-disabled="true">
              <strong>Detailed Estimate</strong>
              <span className={quickStyles.modeNote}>Coming soon · Same valuation engine with more model and specification intelligence.</span>
            </button>
          </div>
        </div>

        <div className={styles.currentCard}>
          <div className={styles.currentCardHead}><div><h3 className={styles.currentTitle}>Asset family</h3><p className={styles.currentHint}>Choose the broad area first, then the asset family.</p></div></div>
          <div className={styles.choiceGrid}>
            {SECTORS.map((sector) => (
              <button key={sector} type="button" className={`${styles.choiceCard} ${selectedSector === sector ? styles.choiceCardActive : ''}`} onClick={() => chooseSector(sector)}>
                <strong>{SECTOR_LABELS[sector]}</strong>
              </button>
            ))}
          </div>
          {selectedSector ? (
            <div className={styles.choiceGrid} style={{ marginTop: '0.85rem' }}>
              {familiesLoading ? <p className={styles.currentHint}>Loading asset families…</p> : families.map((family) => (
                <button key={family.id} type="button" className={`${styles.choiceCard} ${familyKey === family.familyKey ? styles.choiceCardActive : ''}`} onClick={() => chooseFamily(family)}>
                  <strong>{family.familyLabel}</strong>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {selectedFamily ? (
          <div className={styles.currentCard}>
            <div className={styles.currentCardHead}><div><h3 className={styles.currentTitle}>Brand</h3><p className={styles.currentHint}>Choose the brand. If it is missing, keep going with “Brand not listed”.</p></div></div>
            <div className={styles.choiceGrid}>
              {brandsLoading ? <p className={styles.currentHint}>Loading brands…</p> : brands.map((brand) => (
                <button key={brand.slug} type="button" className={`${styles.choiceCard} ${brandSlug === brand.slug ? styles.choiceCardActive : ''}`} onClick={() => chooseBrand(brand)}>
                  <strong>{brand.name}</strong>
                </button>
              ))}
            </div>
            {brandSlug === UNKNOWN_BRAND_SLUG ? (
              <label className={styles.field} style={{ marginTop: '0.85rem' }}>
                <span className={styles.fieldLabel}>Brand name</span>
                <input value={unlistedBrandName} onChange={(event) => setUnlistedBrandName(event.target.value)} placeholder="Type the brand" />
              </label>
            ) : null}
          </div>
        ) : null}

        {selectedBrand ? (
          <div className={styles.currentCard}>
            <div className={styles.currentCardHead}><div><h3 className={styles.currentTitle}>Model <span style={{ opacity: 0.55, fontWeight: 600 }}>(optional)</span></h3><p className={styles.currentHint}>Type the model if you know it. Aim4price will quietly connect it to known model data when there is a match.</p></div></div>
            {!modelUnknown ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Model</span>
                <input value={modelInput} onChange={(event) => onModelInputChange(event.target.value)} placeholder="e.g. 320 GC" autoComplete="off" />
              </label>
            ) : (
              <p className={styles.currentHint}><strong>Model marked as unknown.</strong> You can still continue.</p>
            )}
            {!modelUnknown && visibleModelSuggestions.length ? (
              <div className={quickStyles.modelSuggestions}>
                {visibleModelSuggestions.map((model) => (
                  <button key={model.id} type="button" className={`${styles.choiceCard} ${quickStyles.modelSuggestion}`} onClick={() => chooseModel(model)}>
                    <strong>{model.displayName || model.modelName}</strong>
                    <small>Known Aim4price model</small>
                  </button>
                ))}
              </div>
            ) : null}
            <div className={quickStyles.inlineActions} style={{ marginTop: '0.8rem' }}>
              <button type="button" className={styles.secondaryButton} onClick={() => { setModelUnknown(!modelUnknown); setSelectedModelId(null); if (!modelUnknown) setModelInput(''); }}>
                {modelUnknown ? 'Enter a model' : "I don't know the model"}
              </button>
              {modelsLoading ? <span className={styles.currentHint}>Checking known models…</span> : selectedModel ? <span className={styles.currentHint}>Matched to {selectedModel.displayName || selectedModel.modelName}.</span> : null}
            </div>
          </div>
        ) : null}

        {message ? <p className={quickStyles.error}>{message}</p> : null}
        <div className={quickStyles.footerActions}><span /><button type="button" className={styles.primaryButton} onClick={goToDetails}>Continue</button></div>
      </div>
    );
  }

  function renderDetailsStep() {
    return (
      <div className={quickStyles.stack}>
        <div className={styles.currentCard}>
          <div className={styles.currentCardHead}><div><h3 className={styles.currentTitle}>Asset details</h3><p className={styles.currentHint}>Only the information most owners are likely to know.</p></div></div>
          <div className={quickStyles.twoColumn}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Year</span>
              <input type="number" min="1950" max={CURRENT_YEAR} value={yearUnknown ? '' : year} disabled={yearUnknown} onChange={(event) => setYear(event.target.value)} />
            </label>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Year not known?</span>
              <button type="button" className={`${styles.choiceCard} ${yearUnknown ? styles.choiceCardActive : ''}`} onClick={() => setYearUnknown((value) => !value)}>
                <strong>{yearUnknown ? 'Year unknown' : "I don't know the year"}</strong>
              </button>
            </div>
          </div>
        </div>

        <div className={styles.currentCard}>
          <div className={styles.currentCardHead}><div><h3 className={styles.currentTitle}>Usage / life worked</h3><p className={styles.currentHint}>Use the reading when you know it. Otherwise estimate how much of its working life it has completed.</p></div></div>
          <div className={quickStyles.inlineActions}>
            <button type="button" className={`${styles.choiceCard} ${usageMode === 'known' ? styles.choiceCardActive : ''}`} onClick={() => setUsageMode('known')}><strong>I know the reading</strong></button>
            <button type="button" className={`${styles.choiceCard} ${usageMode === 'percent' ? styles.choiceCardActive : ''}`} onClick={() => setUsageMode('percent')}><strong>I don't know</strong></button>
          </div>
          {usageMode === 'known' ? (
            <label className={styles.field} style={{ marginTop: '0.85rem' }}>
              <span className={styles.fieldLabel}>{getUsageFieldLabel(selectedSector, selectedFamily?.usageMetricType)}</span>
              <input type="number" min="0" value={usageAmount} onChange={(event) => setUsageAmount(event.target.value)} placeholder="Enter current reading" />
            </label>
          ) : (
            <div className={quickStyles.sliderWrap} style={{ marginTop: '0.85rem' }}>
              <span className={styles.fieldLabel}>Approximate working life completed: {lifeWorkedPercent}%</span>
              <input type="range" min="0" max="100" step="5" value={lifeWorkedPercent} onChange={(event) => setLifeWorkedPercent(event.target.value)} />
              <div className={quickStyles.sliderLabels}><span>Very little</span><span>Fully worked</span></div>
            </div>
          )}
        </div>

        <div className={styles.currentCard}>
          <div className={styles.currentCardHead}><div><h3 className={styles.currentTitle}>Condition</h3><p className={styles.currentHint}>Choose the closest broad condition.</p></div></div>
          <div className={styles.choiceGrid}>
            {conditionOptions.map((option) => (
              <button key={option.key} type="button" className={`${styles.choiceCard} ${condition === option.key ? styles.choiceCardActive : ''}`} onClick={() => setCondition(option.key)}><strong>{option.label}</strong></button>
            ))}
          </div>
        </div>

        <div className={styles.currentCard}>
          <div className={styles.currentCardHead}><div><h3 className={styles.currentTitle}>Popularity</h3><p className={styles.currentHint}>Rate current market demand for this asset. This remains part of every estimate.</p></div></div>
          <div className={quickStyles.starGrid}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" className={`${styles.choiceCard} ${popularityStars === star ? styles.choiceCardActive : ''}`} onClick={() => setPopularityStars(star)} aria-label={`${star} star popularity`}><strong>{star} ★</strong></button>
            ))}
          </div>
          <p className={styles.currentHint} style={{ marginTop: '0.65rem' }}>1 = difficult to sell · 3 = normal demand · 5 = highly sought after.</p>
        </div>

        {isTractor ? (
          <div className={styles.currentCard}>
            <div className={styles.currentCardHead}><div><h3 className={styles.currentTitle}>Tractor extras</h3><p className={styles.currentHint}>Select the fitted extras before the estimate. Known tractor models continue through the existing extras valuation logic.</p></div></div>
            <div className={styles.choiceGrid}>
              <button type="button" className={`${styles.choiceCard} ${frontPto ? styles.choiceCardActive : ''}`} onClick={() => setFrontPto((value) => !value)}><strong>Front PTO</strong></button>
              <button type="button" className={`${styles.choiceCard} ${frontLoader ? styles.choiceCardActive : ''}`} onClick={() => setFrontLoader((value) => !value)}><strong>Front loader</strong></button>
              <button type="button" className={`${styles.choiceCard} ${gpsEnabled ? styles.choiceCardActive : ''}`} onClick={() => setGpsEnabled((value) => !value)}><strong>GPS</strong></button>
              <button type="button" className={`${styles.choiceCard} ${otherExtraEnabled ? styles.choiceCardActive : ''}`} onClick={() => setOtherExtraEnabled((value) => !value)}><strong>Other extra</strong></button>
            </div>
            <div className={quickStyles.extraFields}>
              {frontLoader ? <label className={styles.field}><span className={styles.fieldLabel}>Front loader year <small>(optional)</small></span><input type="number" min="1950" max={CURRENT_YEAR} value={frontLoaderYear} onChange={(event) => setFrontLoaderYear(event.target.value)} placeholder="Year fitted" /></label> : null}
              {gpsEnabled ? (
                <div className={quickStyles.twoColumn}>
                  <label className={styles.field}><span className={styles.fieldLabel}>GPS type</span><select value={gpsType} onChange={(event) => setGpsType(event.target.value as GpsType)}><option value="full-autosteer">Full autosteer</option><option value="guidance-only">Guidance only</option></select></label>
                  <label className={styles.field}><span className={styles.fieldLabel}>GPS year <small>(optional)</small></span><input type="number" min="1950" max={CURRENT_YEAR} value={gpsYear} onChange={(event) => setGpsYear(event.target.value)} placeholder="Year fitted" /></label>
                </div>
              ) : null}
              {otherExtraEnabled ? (
                <div className={quickStyles.twoColumn}>
                  <label className={styles.field}><span className={styles.fieldLabel}>Extra name</span><input value={otherExtraName} onChange={(event) => setOtherExtraName(event.target.value)} placeholder="e.g. Weight set" /></label>
                  <label className={styles.field}><span className={styles.fieldLabel}>Replacement price excl. VAT</span><input inputMode="decimal" value={otherExtraReplacementPrice} onChange={(event) => setOtherExtraReplacementPrice(event.target.value)} placeholder="e.g. 75 000" /></label>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {message ? <p className={quickStyles.error}>{message}</p> : null}
        <div className={quickStyles.footerActions}><button type="button" className={styles.secondaryButton} onClick={() => { setMessage(''); setStep(1); }}>Back</button><button type="button" className={styles.primaryButton} onClick={goToReplacement}>Check replacement price</button></div>
      </div>
    );
  }

  function renderReplacementStep() {
    const rangeStep = suggestedReplacement ? nearestStep(suggestedReplacement / 30, suggestedReplacement) : 5_000;
    return (
      <div className={quickStyles.stack}>
        <div className={styles.currentCard}>
          <div className={styles.currentCardHead}><div><h3 className={styles.currentTitle}>Replacement price</h3><p className={styles.currentHint}>Confirm what a similar new asset would cost today before Aim4price calculates the current value.</p></div></div>
          {replacementLoading ? <p className={styles.currentHint}>Checking Aim4price replacement-price information…</p> : suggestedReplacement !== null ? (
            <>
              <div className={quickStyles.replacementSummary}>
                <span>Aim4price starting point</span>
                <strong>{money(suggestedReplacement)}</strong>
                <div className={quickStyles.confidenceLine}><span>{replacementConfidence}</span>{matchedBand ? <span>{matchedBand.bandLabel}</span> : null}{matchedBand?.replacementPriceYear ? <span>Price basis {matchedBand.replacementPriceYear}</span> : selectedModel?.replacementPriceYear ? <span>Price basis {selectedModel.replacementPriceYear}</span> : null}</div>
              </div>
              <div className={quickStyles.sliderWrap}>
                <input type="range" min={replacementMin} max={replacementMax} step={rangeStep} value={replacementValue ?? suggestedReplacement} onChange={(event) => { setReplacementTouched(true); setReplacementInput(event.target.value); }} />
                <div className={quickStyles.sliderLabels}><span>{money(replacementMin)}</span><span>{money(replacementMax)}</span></div>
              </div>
            </>
          ) : (
            <p className={quickStyles.weakPriceNotice}><strong>Aim4price does not have a reliable replacement-price range for this selection yet.</strong> Enter the replacement price if you know it. The estimate will not pretend to have precision that is not in the data.</p>
          )}

          <label className={styles.field} style={{ marginTop: '1rem' }}>
            <span className={styles.fieldLabel}>Replacement price excl. VAT</span>
            <input inputMode="decimal" value={replacementInput} onChange={(event) => { setReplacementTouched(true); setReplacementInput(event.target.value); }} placeholder="Enter replacement price" />
            <small>{replacementTouched ? 'Your adjusted replacement price will be used.' : suggestedReplacement !== null ? 'Leave this unchanged to use Aim4price’s current replacement-price basis.' : 'A replacement price is required to calculate an Aim4price estimate.'}</small>
          </label>
          {isTractor && !isExactTractor && genericTractorExtrasReplacement > 0 ? <p className={styles.currentHint} style={{ marginTop: '0.7rem' }}>The model is not linked to a known tractor record, so the broad replacement-price suggestion includes the selected fitted extras before the generic tractor calculation.</p> : null}
        </div>

        <div className={styles.currentCard}>
          <div className={styles.currentCardHead}><div><h3 className={styles.currentTitle}>Quick check</h3><p className={styles.currentHint}>The estimate will use these inputs through the existing Aim4price valuation engine.</p></div></div>
          <div className={quickStyles.summaryGrid}>
            <div className={quickStyles.summaryItem}><span>Asset</span><strong>{selectedFamily?.familyLabel}</strong></div>
            <div className={quickStyles.summaryItem}><span>Brand / model</span><strong>{selectedBrandDisplay} · {selectedModelDisplay}</strong></div>
            <div className={quickStyles.summaryItem}><span>Usage</span><strong>{usageDisplay}</strong></div>
            <div className={quickStyles.summaryItem}><span>Condition / popularity</span><strong>{condition ? conditionLabel(condition) : '—'} · {popularityStars}/5</strong></div>
          </div>
        </div>

        {message ? <p className={quickStyles.error}>{message}</p> : null}
        <div className={quickStyles.footerActions}><button type="button" className={styles.secondaryButton} onClick={() => { setMessage(''); setStep(2); }}>Back</button><button type="button" className={styles.primaryButton} disabled={calculating || !replacementValue} onClick={() => void calculateEstimate()}>{calculating ? 'Calculating…' : 'Get estimate'}</button></div>
      </div>
    );
  }

  function renderResultStep() {
    return (
      <div className={quickStyles.stack}>
        <div className={styles.currentCard}>
          <div className={styles.currentCardHead}><div><h3 className={styles.currentTitle}>Aim4price estimate</h3><p className={styles.currentHint}>{selectedBrandDisplay} {selectedModelDisplay !== 'Model not provided' ? selectedModelDisplay : ''}</p></div></div>
          <span className={quickStyles.resultValue}>{money(resultValue)}</span>
          <p className={styles.currentHint} style={{ marginTop: '0.75rem' }}>Indicative current value excl. VAT. Confidence: {resultConfidence}.</p>
          <div className={quickStyles.summaryGrid} style={{ marginTop: '1rem' }}>
            <div className={quickStyles.summaryItem}><span>Replacement price used</span><strong>{money(resultReplacementPrice)}</strong></div>
            <div className={quickStyles.summaryItem}><span>Year</span><strong>{yearUnknown ? 'Unknown' : year}</strong></div>
            <div className={quickStyles.summaryItem}><span>Usage</span><strong>{usageDisplay}</strong></div>
            <div className={quickStyles.summaryItem}><span>Condition / popularity</span><strong>{condition ? conditionLabel(condition) : '—'} · {popularityStars}/5</strong></div>
          </div>
        </div>

        <div className={styles.currentCard}>
          <div className={styles.currentCardHead}><div><h3 className={styles.currentTitle}>Asset Register</h3><p className={styles.currentHint}>Valuation should help you register the asset, not become a barrier to doing so.</p></div></div>
          {savedAssetId ? <p className={quickStyles.success}>Saved successfully. This estimate is now linked to the asset in your Asset Register.</p> : isSignedIn ? <button type="button" className={styles.primaryButton} disabled={saving} onClick={() => void saveToAssetRegister()}>{saving ? 'Saving…' : 'Save to Asset Register'}</button> : <a className={styles.primaryButton} href="/auth#login">Sign in to save this asset</a>}
          {savedAssetId ? <div className={quickStyles.inlineActions} style={{ marginTop: '0.8rem' }}><a className={styles.secondaryButton} href={ownerAppMode ? '/owner-app/assets' : '/asset-register'}>Open Asset Register</a></div> : null}
        </div>

        {message ? <p className={message.startsWith('Saved') ? quickStyles.success : quickStyles.error}>{message}</p> : null}
        <div className={quickStyles.footerActions}><button type="button" className={styles.secondaryButton} onClick={() => { setMessage(''); setReplacementTouched(true); setStep(3); }}>Adjust replacement price</button><button type="button" className={styles.secondaryButton} onClick={() => { setStep(1); setSelectedSector(null); setFamilyKey(''); setBrandSlug(''); setModelInput(''); setSelectedModelId(null); setModelUnknown(false); resetAfterAssetChange(); }}>New estimate</button></div>
      </div>
    );
  }

  return (
    <main className={`${styles.page} ${compactAppMode ? `${styles.appValuation} ${dealerStyles.dealerValuationSurface}` : ''}`}>
      {!compactAppMode ? <AppHeader active="valuation" /> : null}
      <div className={styles.container}>
        <section className={`${styles.wizardShell} ${step === 1 && !selectedSector ? styles.sectorWizardShell : ''}`}>
          <div className={`${styles.wizardCard} ${step === 1 && !selectedSector ? styles.sectorWizardCard : ''}`}>
            {renderStepper()}
            {step === 1 ? renderAssetStep() : step === 2 ? renderDetailsStep() : step === 3 ? renderReplacementStep() : renderResultStep()}
          </div>
        </section>
      </div>
    </main>
  );
}
