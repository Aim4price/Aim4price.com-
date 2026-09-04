'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';
import dealerStyles from '../dealer/dealer.module.css';
import { conditionOptions, type BrandRow, type ConditionKey } from '../../lib/tractor-data';
import { SECTOR_LABELS, getUsageDisplayUnit, getUsageFieldLabel, getUsageShortUnit, type SectorKey, type UsageMetricType } from '../../lib/equipment-types';
import { conditionLabel, money, type Result } from '../../lib/tractor-logic';

type Step = 1 | 2 | 3 | 4 | 5;
type ModelMode = 'catalog' | 'manual' | 'unknown' | '';
type ReplacementPriceBasis = 'aim4price' | 'user';
type GpsType = 'full-autosteer' | 'guidance-only';

type FamilyRecord = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  sectorLabel: string;
  familyKey: string;
  familyLabel: string;
  isPropelled: boolean;
  usageMetricType: UsageMetricType;
  valuationMode: string;
  catalogMode: string;
  sortOrder: number;
  isActive: boolean;
};

type CatalogModel = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  familyId: number;
  familyKey: string;
  familyLabel: string;
  usageMetricType: UsageMetricType;
  valuationMode: string;
  catalogMode: string;
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
  aim4priceReplacementPriceExVat: number | null;
  replacementPriceYear: number | null;
  specsJson: Record<string, unknown>;
};

type GenericCalculation = {
  replacementPriceBasis: ReplacementPriceBasis;
  replacementPriceExVat: number | null;
  valuationLowExVat: number | null;
  valuationMidExVat: number | null;
  valuationHighExVat: number | null;
  lifeWorkedPercent: number | null;
};

type GenericResult = {
  sector: { id: number; key: SectorKey; label: string };
  family: { id: number; key: string; label: string; usageMetricType: UsageMetricType };
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
  replacementPriceBasis: ReplacementPriceBasis;
  aim4priceReplacementCalculation: GenericCalculation | null;
  userReplacementCalculation: GenericCalculation | null;
  selectedCalculation: GenericCalculation | null;
  aim4priceValueExVat: number | null;
  valuationLowExVat: number | null;
  valuationMidExVat: number | null;
  valuationHighExVat: number | null;
  lifeWorkedPercent: number | null;
  confidenceScore: number;
  confidenceLabel: 'High' | 'Medium' | 'Low';
  notes: string[];
};

type ResultState =
  | { kind: 'tractor'; result: Result }
  | { kind: 'generic'; result: GenericResult };

type ReplacementPreview = {
  suggested: number | null;
  min: number | null;
  max: number | null;
  confidenceLabel: string;
  sourceLabel: string;
  weak: boolean;
};

type AccountProfile = Partial<{
  accountType: string;
  accountStatus: string;
}>;

type DealerRegister = {
  id: string;
  businessName: string;
  assetCount: number;
  totalValue: number;
  isPrimary: boolean;
};

const CURRENT_YEAR = new Date().getFullYear();
const UNKNOWN_BRAND: BrandRow = { slug: 'unknown', name: 'Brand not listed' };
const STEPS: Array<{ step: Step; label: string }> = [
  { step: 1, label: 'Asset' },
  { step: 2, label: 'Brand & model' },
  { step: 3, label: 'Details' },
  { step: 4, label: 'Replacement price' },
  { step: 5, label: 'Value' },
];

const SECTORS: Array<{ key: SectorKey; label: string; videoSrc: string }> = [
  { key: 'agricultural', label: SECTOR_LABELS.agricultural, videoSrc: '/brand/valuation/Agriculture.mp4' },
  { key: 'construction', label: SECTOR_LABELS.construction, videoSrc: '/brand/valuation/Construction.mp4' },
  { key: 'industrial', label: SECTOR_LABELS.industrial, videoSrc: '/brand/valuation/Industrial.mp4' },
  { key: 'motor', label: SECTOR_LABELS.motor, videoSrc: '/brand/valuation/Motor.mp4' },
];

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function parseNumber(value: unknown): number | null {
  const number = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function parsePositive(value: unknown): number | null {
  const number = parseNumber(value);
  return number !== null && number > 0 ? number : null;
}

function modelLabel(model: CatalogModel): string {
  const display = clean(model.displayName) || clean(model.modelName);
  if (!display) return model.brandName;
  return display.toLowerCase().includes(model.brandName.toLowerCase()) ? display : `${model.brandName} ${display}`;
}

function searchMatch(value: string, query: string): boolean {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = value.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function tractorLifetimeHours(model: CatalogModel | null): number {
  if (!model) return 12_000;
  if (clean(model.tractorType).toLowerCase() === 'orchard') return 10_000;
  const power = Number(model.powerKw ?? 0);
  if (power <= 25) return 8_000;
  if (power <= 75) return 12_000;
  return 14_000;
}

function estimatedTractorHours(model: CatalogModel | null, workedPercent: number | null): number {
  if (workedPercent === null) return 0;
  return Math.round(tractorLifetimeHours(model) * (workedPercent / 100));
}

function formatRange(min: number | null, max: number | null): string {
  if (min === null || max === null) return '';
  return `${money(min)} – ${money(max)}`;
}

export default function QuickValuationClient({ dealerAppMode = false, ownerAppMode = false }: { dealerAppMode?: boolean; ownerAppMode?: boolean } = {}) {
  const router = useRouter();
  const compactAppMode = dealerAppMode || ownerAppMode;

  const [step, setStep] = useState<Step>(1);
  const [selectedSector, setSelectedSector] = useState<SectorKey | null>(null);
  const [families, setFamilies] = useState<FamilyRecord[]>([]);
  const [familyKey, setFamilyKey] = useState('');
  const [familySearch, setFamilySearch] = useState('');
  const [familyDropdownOpen, setFamilyDropdownOpen] = useState(false);
  const [familiesLoading, setFamiliesLoading] = useState(false);

  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandSlug, setBrandSlug] = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [manualBrandName, setManualBrandName] = useState('');

  const [models, setModels] = useState<CatalogModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelQuery, setModelQuery] = useState('');
  const [modelMode, setModelMode] = useState<ModelMode>('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [yearUnknown, setYearUnknown] = useState(false);
  const [usageMode, setUsageMode] = useState<'reading' | 'percent'>('reading');
  const [usageAmount, setUsageAmount] = useState('');
  const [lifeWorkedPercent, setLifeWorkedPercent] = useState('');
  const [condition, setCondition] = useState<ConditionKey>('good');
  const [popularityStars, setPopularityStars] = useState(0);

  const [extrasConfirmed, setExtrasConfirmed] = useState(false);
  const [noListedExtras, setNoListedExtras] = useState(false);
  const [frontPto, setFrontPto] = useState(false);
  const [frontLoader, setFrontLoader] = useState(false);
  const [frontLoaderYear, setFrontLoaderYear] = useState('');
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsType, setGpsType] = useState<GpsType>('guidance-only');
  const [gpsYear, setGpsYear] = useState('');
  const [otherExtraEnabled, setOtherExtraEnabled] = useState(false);
  const [otherExtraName, setOtherExtraName] = useState('');
  const [otherExtraReplacementPrice, setOtherExtraReplacementPrice] = useState('');

  const [replacementPreview, setReplacementPreview] = useState<ReplacementPreview | null>(null);
  const [replacementPreviewLoading, setReplacementPreviewLoading] = useState(false);
  const [replacementPreviewError, setReplacementPreviewError] = useState('');
  const [replacementPrice, setReplacementPrice] = useState('');
  const [replacementEdited, setReplacementEdited] = useState(false);

  const [resultState, setResultState] = useState<ResultState | null>(null);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [dealerRegisters, setDealerRegisters] = useState<DealerRegister[]>([]);
  const [dealerRegisterId, setDealerRegisterId] = useState('');

  const selectedFamily = useMemo(() => families.find((family) => family.familyKey === familyKey) ?? null, [families, familyKey]);
  const brandOptions = useMemo(() => {
    const seen = new Set<string>(['unknown']);
    return [UNKNOWN_BRAND, ...brands.filter((brand) => {
      const slug = clean(brand.slug).toLowerCase();
      if (!slug || seen.has(slug)) return false;
      seen.add(slug);
      return true;
    })];
  }, [brands]);
  const selectedBrand = useMemo(() => brandOptions.find((brand) => brand.slug === brandSlug) ?? null, [brandOptions, brandSlug]);
  const selectedModel = useMemo(() => models.find((model) => String(model.id) === selectedModelId) ?? null, [models, selectedModelId]);
  const filteredFamilies = useMemo(() => families.filter((family) => searchMatch(`${family.familyLabel} ${family.familyKey}`, familySearch)), [families, familySearch]);
  const filteredBrands = useMemo(() => brandOptions.filter((brand) => searchMatch(`${brand.name} ${brand.slug}`, brandSearch)), [brandOptions, brandSearch]);
  const filteredModels = useMemo(() => models.filter((model) => searchMatch(`${modelLabel(model)} ${model.modelName} ${model.variantName ?? ''}`, modelQuery)), [models, modelQuery]);

  const isTractor = selectedSector === 'agricultural' && selectedFamily?.familyKey === 'tractors';
  const usageUnit = getUsageDisplayUnit(selectedSector, selectedFamily?.usageMetricType);
  const usageFieldLabel = getUsageFieldLabel(selectedSector, selectedFamily?.usageMetricType);
  const usageShortUnit = getUsageShortUnit(selectedSector, selectedFamily?.usageMetricType);
  const yearNumber = yearUnknown ? CURRENT_YEAR : Number(year);
  const usageNumber = usageMode === 'reading' ? parsePositive(usageAmount) : null;
  const workedPercentNumber = usageMode === 'percent' ? parseNumber(lifeWorkedPercent) : null;
  const anyExtraSelected = frontPto || frontLoader || gpsEnabled || otherExtraEnabled;
  const exactTractorPath = Boolean(isTractor && selectedModel && !selectedModel.isGenericFallback);

  const resultValue = useMemo(() => {
    if (!resultState) return null;
    if (resultState.kind === 'tractor') return resultState.result.aim4priceValueExVat;
    return resultState.result.selectedCalculation?.valuationMidExVat ?? resultState.result.valuationMidExVat ?? resultState.result.aim4priceValueExVat;
  }, [resultState]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
        const data = await response.json() as { signedIn?: boolean };
        if (cancelled) return;
        setIsSignedIn(Boolean(data.signedIn));
        if (data.signedIn) {
          const profileResponse = await fetch('/api/account-profile', { credentials: 'include', cache: 'no-store' });
          const profileData = await profileResponse.json() as { ok?: boolean; profile?: AccountProfile };
          if (!cancelled && profileResponse.ok && profileData.ok) setAccountProfile(profileData.profile ?? null);
        }
      } catch {
        if (!cancelled) setIsSignedIn(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!dealerAppMode || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/asset-registers', { credentials: 'include', cache: 'no-store' });
        const data = await response.json() as { ok?: boolean; registers?: DealerRegister[] };
        if (!cancelled && response.ok && data.ok) {
          const registers = data.registers ?? [];
          setDealerRegisters(registers);
          const primary = registers.find((register) => register.isPrimary) ?? registers[0];
          if (primary) setDealerRegisterId(primary.id);
        }
      } catch {
        if (!cancelled) setDealerRegisters([]);
      }
    })();
    return () => { cancelled = true; };
  }, [dealerAppMode, isSignedIn]);

  useEffect(() => {
    setFamilies([]);
    setFamilyKey('');
    setFamilySearch('');
    setFamiliesLoading(Boolean(selectedSector));
    if (!selectedSector) return;
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams({ sectorKey: selectedSector, includeInactive: 'true' });
        const response = await fetch(`/api/equipment-families?${params.toString()}`, { cache: 'no-store' });
        const data = await response.json() as { ok?: boolean; families?: FamilyRecord[]; error?: string };
        if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to load asset families.');
        if (!cancelled) setFamilies(data.families ?? []);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Failed to load asset families.');
      } finally {
        if (!cancelled) setFamiliesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSector]);

  useEffect(() => {
    setBrands([]);
    setBrandSlug('');
    setBrandSearch('');
    setManualBrandName('');
    setModels([]);
    setSelectedModelId('');
    setModelQuery('');
    setModelMode('');
    if (!selectedSector || !selectedFamily) return;
    let cancelled = false;
    setBrandsLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams({ sectorKey: selectedSector, familyKey: selectedFamily.familyKey, includeInactive: 'true' });
        const response = await fetch(`/api/brands?${params.toString()}`, { cache: 'no-store' });
        const data = await response.json() as { ok?: boolean; brands?: BrandRow[]; error?: string };
        if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to load brands.');
        if (!cancelled) setBrands(data.brands ?? []);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Failed to load brands.');
      } finally {
        if (!cancelled) setBrandsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSector, selectedFamily]);

  useEffect(() => {
    setModels([]);
    setSelectedModelId('');
    setModelQuery('');
    setModelMode('');
    if (!selectedSector || !selectedFamily || !selectedBrand || selectedBrand.slug === 'unknown') return;
    let cancelled = false;
    setModelsLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams({
          sectorKey: selectedSector,
          familyKey: selectedFamily.familyKey,
          brandSlug: selectedBrand.slug,
          limit: '500',
        });
        const response = await fetch(`/api/equipment-models?${params.toString()}`, { cache: 'no-store' });
        const data = await response.json() as { ok?: boolean; models?: CatalogModel[]; error?: string };
        if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to load models.');
        if (!cancelled) setModels(data.models ?? []);
      } catch {
        if (!cancelled) setModels([]);
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSector, selectedFamily, selectedBrand]);

  function clearResult() {
    setResultState(null);
    setReplacementPreview(null);
    setReplacementPrice('');
    setReplacementEdited(false);
    setReplacementPreviewError('');
  }

  function resetDetails() {
    setYear(String(CURRENT_YEAR));
    setYearUnknown(false);
    setUsageMode('reading');
    setUsageAmount('');
    setLifeWorkedPercent('');
    setCondition('good');
    setPopularityStars(0);
    setExtrasConfirmed(false);
    setNoListedExtras(false);
    setFrontPto(false);
    setFrontLoader(false);
    setFrontLoaderYear('');
    setGpsEnabled(false);
    setGpsType('guidance-only');
    setGpsYear('');
    setOtherExtraEnabled(false);
    setOtherExtraName('');
    setOtherExtraReplacementPrice('');
    clearResult();
  }

  function chooseFamily(nextFamilyKey: string) {
    setFamilyKey(nextFamilyKey);
    setFamilyDropdownOpen(false);
    setFamilySearch('');
    resetDetails();
    setStep(2);
  }

  function chooseBrand(nextBrandSlug: string) {
    setBrandSlug(nextBrandSlug);
    setBrandDropdownOpen(false);
    setBrandSearch('');
    setManualBrandName('');
    setSelectedModelId('');
    setModelQuery('');
    setModelMode('');
    clearResult();
  }

  function chooseModel(model: CatalogModel) {
    setSelectedModelId(String(model.id));
    setModelQuery(modelLabel(model));
    setModelMode('catalog');
    setModelDropdownOpen(false);
    clearResult();
  }

  function markModelUnknown() {
    setSelectedModelId('');
    setModelQuery('');
    setModelMode('unknown');
    setModelDropdownOpen(false);
    clearResult();
  }

  function validateIdentity(): string | null {
    if (!selectedSector || !selectedFamily) return 'Choose the asset family first.';
    if (!selectedBrand) return 'Choose a brand first.';
    if (selectedBrand.slug === 'unknown' && !clean(manualBrandName)) return 'Enter the brand name or choose a listed brand.';
    if (!modelMode) return 'Type the model or choose “I don’t know”.';
    if (modelMode === 'manual' && !clean(modelQuery)) return 'Enter the model name or choose “I don’t know”.';
    return null;
  }

  function validateDetails(): string | null {
    const identityError = validateIdentity();
    if (identityError) return identityError;
    if (!yearUnknown && (!Number.isInteger(Number(year)) || Number(year) < 1950 || Number(year) > CURRENT_YEAR)) return `Choose a year between 1950 and ${CURRENT_YEAR}, or mark it unknown.`;
    if (usageMode === 'reading' && parsePositive(usageAmount) === null) return `Enter ${usageFieldLabel.toLowerCase()} or choose worked percentage.`;
    if (usageMode === 'percent') {
      const percent = parseNumber(lifeWorkedPercent);
      if (percent === null || percent < 0 || percent > 100) return 'Choose a worked percentage from 0% to 100%.';
    }
    if (!condition) return 'Choose the condition.';
    if (popularityStars < 1 || popularityStars > 5) return 'Choose a popularity rating from 1 to 5 stars.';
    if (isTractor && !extrasConfirmed) return 'Confirm the tractor extras before getting an estimate.';
    if (isTractor && anyExtraSelected && !exactTractorPath) return 'Aim4price needs a matched tractor model to value selected extras separately. Choose a suggested model, or select “No listed extras”.';
    if (otherExtraEnabled && !clean(otherExtraName)) return 'Enter a name for the other extra.';
    if (otherExtraEnabled && parsePositive(otherExtraReplacementPrice) === null) return 'Enter the other extra replacement price.';
    return null;
  }

  function genericSpecs(): Record<string, unknown> {
    return {
      ...(selectedModel ? { ...selectedModel.specsJson, catalog_model_id: selectedModel.id } : {}),
      ...(selectedBrand?.slug === 'unknown' ? { unlisted_brand_name: clean(manualBrandName), typed_brand_name: clean(manualBrandName) } : {}),
      ...(modelMode === 'manual' ? { manual_model_name: clean(modelQuery) } : {}),
      ...(yearUnknown ? { year_model_unknown: true } : { year_model_unknown: false, year_model: Number(year) }),
      ...(usageMode === 'percent' ? { usage_mode: 'percent', life_worked_percent: workedPercentNumber } : { usage_mode: usageUnit === 'km' ? 'km' : 'hours' }),
    };
  }

  function genericRequestBody(userReplacementPriceExVat: number | null) {
    return {
      sectorKey: selectedSector,
      familyKey: selectedFamily?.familyKey,
      brandSlug: selectedBrand?.slug,
      equipmentModelId: selectedModel?.id ?? null,
      typedModelName: modelMode === 'unknown' ? null : clean(selectedModel?.modelName ?? modelQuery) || null,
      saveModelCandidate: modelMode === 'manual' && selectedBrand?.slug !== 'unknown',
      specsJson: genericSpecs(),
      year: yearUnknown ? CURRENT_YEAR : Number(year),
      yearModelUnknown: yearUnknown,
      usageAmount: usageNumber,
      lifeWorkedPercent: usageMode === 'percent' ? workedPercentNumber : null,
      condition,
      userReplacementPriceExVat,
      userReplacementPriceYear: userReplacementPriceExVat ? CURRENT_YEAR : null,
      advancedAssumptions: { popularityStars },
    };
  }

  function tractorExtrasBody() {
    return {
      frontPto,
      frontLoader,
      frontLoaderYear: frontLoader ? clean(frontLoaderYear) || null : null,
      gpsEnabled,
      gpsType,
      gpsYear: gpsEnabled ? clean(gpsYear) || null : null,
      otherExtraName: otherExtraEnabled ? clean(otherExtraName) : null,
      otherExtraReplacementPriceExVat: otherExtraEnabled ? parsePositive(otherExtraReplacementPrice) : null,
    };
  }

  async function prepareReplacementPrice() {
    const validationError = validateDetails();
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setMessage('');
    setReplacementPreviewError('');
    setReplacementPreviewLoading(true);
    setReplacementEdited(false);

    try {
      const exactModelPrice = exactTractorPath ? Number(selectedModel?.aim4priceReplacementPriceExVat ?? 0) : 0;
      if (exactModelPrice > 0) {
        const suggested = Math.round(exactModelPrice);
        setReplacementPreview({
          suggested,
          min: null,
          max: null,
          confidenceLabel: 'Model-level',
          sourceLabel: `${selectedModel?.brandName ?? ''} ${selectedModel?.modelName ?? ''}`.trim(),
          weak: false,
        });
        setReplacementPrice(String(suggested));
        setStep(4);
        return;
      }

      const response = await fetch('/api/generic-valuations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(genericRequestBody(null)),
      });
      const data = await response.json() as { ok?: boolean; result?: GenericResult; error?: string };
      if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? 'Could not prepare replacement-price information.');

      const result = data.result;
      const suggested = result.aim4priceReplacementCalculation?.replacementPriceExVat ?? result.replacementPriceUsedExVat ?? null;
      const min = result.replacementPriceMinExVat ?? null;
      const max = result.replacementPriceMaxExVat ?? null;
      const weak = suggested === null || result.confidenceLabel === 'Low';
      setReplacementPreview({
        suggested,
        min,
        max,
        confidenceLabel: result.confidenceLabel,
        sourceLabel: result.replacementPriceBand?.bandLabel ?? (selectedModel ? 'Known model information' : 'Family / brand pricing'),
        weak,
      });
      setReplacementPrice(suggested ? String(Math.round(suggested)) : '');
      setStep(4);
    } catch (error) {
      setReplacementPreview({ suggested: null, min: null, max: null, confidenceLabel: 'Limited', sourceLabel: 'No reliable Aim4price price matched', weak: true });
      setReplacementPrice('');
      setReplacementPreviewError(error instanceof Error ? error.message : 'Aim4price could not prepare a replacement-price suggestion. Enter the replacement price if you know it.');
      setStep(4);
    } finally {
      setReplacementPreviewLoading(false);
    }
  }

  async function calculateEstimate() {
    const selectedReplacement = parsePositive(replacementPrice);
    if (selectedReplacement === null) {
      setMessage('Enter a replacement price before calculating the estimate.');
      return;
    }

    setValuationLoading(true);
    setMessage('');
    try {
      if (exactTractorPath && selectedModel) {
        const hours = usageNumber ?? estimatedTractorHours(selectedModel, workedPercentNumber);
        const response = await fetch('/api/tractor-valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: String(selectedModel.id),
            year: yearUnknown ? CURRENT_YEAR : Number(year),
            yearModelUnknown: yearUnknown,
            usageMode: usageMode === 'percent' ? 'percent' : 'hours',
            hours,
            lifeWorkedPercent: usageMode === 'percent' ? workedPercentNumber : null,
            condition,
            ...tractorExtrasBody(),
            userReplacementPriceExVat: replacementEdited ? Math.round(selectedReplacement) : null,
            advancedAssumptions: { popularityStars },
          }),
        });
        const data = await response.json() as { ok?: boolean; result?: Result; error?: string };
        if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? 'Failed to calculate tractor estimate.');
        setResultState({ kind: 'tractor', result: data.result });
      } else {
        const response = await fetch('/api/generic-valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(genericRequestBody(replacementEdited ? Math.round(selectedReplacement) : null)),
        });
        const data = await response.json() as { ok?: boolean; result?: GenericResult; error?: string };
        if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? 'Failed to calculate estimate.');
        if (!data.result.replacementPriceUsedExVat && !replacementEdited) {
          const retry = await fetch('/api/generic-valuations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(genericRequestBody(Math.round(selectedReplacement))),
          });
          const retryData = await retry.json() as { ok?: boolean; result?: GenericResult; error?: string };
          if (!retry.ok || !retryData.ok || !retryData.result) throw new Error(retryData.error ?? 'Failed to calculate estimate.');
          setReplacementEdited(true);
          setResultState({ kind: 'generic', result: retryData.result });
        } else {
          setResultState({ kind: 'generic', result: data.result });
        }
      }
      setStep(5);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to calculate estimate.');
    } finally {
      setValuationLoading(false);
    }
  }

  function currentReplacementBasis(): ReplacementPriceBasis {
    if (!resultState) return replacementEdited ? 'user' : 'aim4price';
    return resultState.result.replacementPriceBasis ?? (replacementEdited ? 'user' : 'aim4price');
  }

  async function saveEstimate() {
    if (!resultState || resultValue === null) return;
    if (!isSignedIn) {
      router.push('/auth#signup');
      return;
    }

    setSaveLoading(true);
    setMessage('');
    try {
      const replacementBasis = currentReplacementBasis();
      const replacementOverride = replacementBasis === 'user' ? parsePositive(replacementPrice) : null;
      let payload: Record<string, unknown>;

      if (resultState.kind === 'tractor' && selectedModel) {
        payload = {
          modelId: String(selectedModel.id),
          year: yearUnknown ? CURRENT_YEAR : Number(year),
          yearModelUnknown: yearUnknown,
          usageMode: usageMode === 'percent' ? 'percent' : 'hours',
          hours: usageNumber ?? estimatedTractorHours(selectedModel, workedPercentNumber),
          lifeWorkedPercent: usageMode === 'percent' ? workedPercentNumber : null,
          condition,
          ...tractorExtrasBody(),
          userReplacementPriceExVat: replacementOverride,
          advancedAssumptions: resultState.result.advancedAssumptions ?? { popularityStars },
          selectedMethod: 'aim4price',
          valuationVersion: 'v1',
        };
      } else if (resultState.kind === 'generic') {
        payload = {
          catalogModeUsed: 'generic_specs',
          sectorKey: resultState.result.sector.key,
          familyKey: resultState.result.family.key,
          brandSlug: resultState.result.brand.slug,
          equipmentModelId: selectedModel?.id ?? null,
          typedModelName: resultState.result.typedModelName,
          specsJson: resultState.result.specsJson,
          year: resultState.result.year,
          yearModelUnknown: yearUnknown,
          usageAmount: resultState.result.usageAmount,
          lifeWorkedPercent: resultState.result.lifeWorkedPercent,
          condition: resultState.result.condition,
          userReplacementPriceExVat: replacementOverride,
          userReplacementPriceYear: replacementOverride ? CURRENT_YEAR : null,
          advancedAssumptions: { popularityStars },
          selectedMethod: 'aim4price',
          valuationVersion: 'generic-v1',
        };
      } else {
        throw new Error('Estimate result is incomplete.');
      }

      if (dealerAppMode && dealerRegisterId) payload.registerId = dealerRegisterId;

      const response = await fetch('/api/valuation-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { ok?: boolean; assetId?: string; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to save estimate.');

      if (ownerAppMode) {
        router.push(data.assetId ? `/owner-app/assets/${encodeURIComponent(data.assetId)}` : '/owner-app/assets');
      } else if (dealerAppMode && dealerRegisterId) {
        const params = new URLSearchParams({ registerId: dealerRegisterId, dealerView: dealerRegisters.find((register) => register.id === dealerRegisterId)?.isPrimary ? 'dealer' : 'client' });
        if (data.assetId) params.set('convertedAssetId', data.assetId);
        router.push(`/asset-register?${params.toString()}`);
      } else {
        router.push(data.assetId ? `/asset-register?convertedAssetId=${encodeURIComponent(data.assetId)}` : '/asset-register');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save estimate.');
    } finally {
      setSaveLoading(false);
    }
  }

  function goBack() {
    setMessage('');
    if (step === 1) {
      if (selectedSector) {
        setSelectedSector(null);
        setFamilyKey('');
        return;
      }
      router.push(ownerAppMode ? '/owner-app' : dealerAppMode ? '/dealer' : '/');
      return;
    }
    setStep((step - 1) as Step);
  }

  function renderModeCards() {
    return (
      <div className={`${styles.choiceGrid} ${styles.pathChoiceGrid}`} style={{ marginBottom: '1.25rem' }}>
        <div className={`${styles.choiceCard} ${styles.choiceCardActive}`} aria-label="Quick Estimate selected">
          <strong>Quick Estimate</strong>
          <span className={styles.choiceCardNote}>Recommended · Family, brand, model if known, essential details and replacement price.</span>
        </div>
        <div className={styles.choiceCard} aria-disabled="true" style={{ opacity: 0.58 }}>
          <strong>Detailed Estimate</strong>
          <span className={styles.choiceCardNote}>Coming soon · Same valuation engine with more model and specification intelligence.</span>
        </div>
      </div>
    );
  }

  function renderAssetStep() {
    if (!selectedSector) {
      return (
        <div className={styles.sectorStart}>
          {renderModeCards()}
          <div className={styles.sectorIntro}>
            <h2 className={styles.stepTitle}>Choose sector</h2>
            <p className={styles.stepText}>Choose where the asset belongs.</p>
          </div>
          <div className={styles.sectorLargeGrid}>
            {SECTORS.map((sector) => (
              <button key={sector.key} type="button" className={`${styles.sectorBigCard} ${compactAppMode ? styles.sectorBigCardApp : ''} ${styles.sectorBigCardLive}`} onClick={() => setSelectedSector(sector.key)}>
                {!compactAppMode ? (
                  <>
                    <video className={styles.sectorVideo} muted loop playsInline preload="metadata"><source src={sector.videoSrc} type="video/mp4" /></video>
                    <span className={styles.sectorVideoOverlay} />
                  </>
                ) : null}
                <span className={styles.sectorBigCardContent}><span className={styles.sectorLabelWrap}><strong className={styles.sectorLabel}>{sector.label}</strong></span></span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className={styles.equipmentStage}>
        <div className={`${styles.equipmentStageTop} ${styles.equipmentStageTopSolo}`}><span className={styles.selectedSummaryPill}>{SECTOR_LABELS[selectedSector]}</span></div>
        <div className={styles.equipmentStageIntro}><h2 className={styles.stepTitle}>Choose asset family</h2><p className={styles.stepText}>Start broad. Aim4price can become more specific when better data is available.</p></div>
        <div className={`${styles.currentCard} ${styles.equipmentPickerCard}`}>
          <div className={styles.equipmentPickerHead}><span className={styles.fieldLabel}>Search asset family</span><span className={styles.equipmentCountPill}>{familiesLoading ? 'Loading' : `${filteredFamilies.length} found`}</span></div>
          <label className={`${styles.field} ${styles.searchPanel}`}><input className={styles.searchInput} value={familySearch} onChange={(event) => { setFamilySearch(event.target.value); setFamilyDropdownOpen(true); }} onFocus={() => setFamilyDropdownOpen(true)} placeholder="e.g. tractor, excavator, forklift, truck" /></label>
          <div className={styles.equipmentDropdownWrap}>
            <button type="button" className={`${styles.equipmentDropdownTrigger} ${familyDropdownOpen ? styles.equipmentDropdownTriggerOpen : ''}`} onClick={() => setFamilyDropdownOpen((open) => !open)} disabled={familiesLoading} aria-expanded={familyDropdownOpen} data-selected={Boolean(selectedFamily)}><span>{selectedFamily?.familyLabel ?? 'Select asset family...'}</span><span className={styles.equipmentDropdownChevron}>⌄</span></button>
            {familyDropdownOpen ? <div className={styles.equipmentDropdownMenu}>{filteredFamilies.map((family) => <button key={family.familyKey} type="button" className={styles.equipmentDropdownOption} onClick={() => chooseFamily(family.familyKey)}><span>{family.familyLabel}</span></button>)}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  function renderIdentityStep() {
    return (
      <div className={styles.equipmentStage}>
        <div className={`${styles.equipmentStageTop} ${styles.equipmentStageTopSolo}`}>{selectedFamily ? <span className={styles.selectedSummaryPill}>{selectedFamily.familyLabel}</span> : null}</div>
        <div className={styles.equipmentStageIntro}><h2 className={styles.stepTitle}>Brand and model</h2><p className={styles.stepText}>Choose the brand. Type the model if you know it — the model is not required.</p></div>

        <div className={`${styles.currentCard} ${styles.equipmentPickerCard}`}>
          <div className={styles.equipmentPickerHead}><span className={styles.fieldLabel}>Brand</span><span className={styles.equipmentCountPill}>{brandsLoading ? 'Loading' : `${filteredBrands.length} found`}</span></div>
          <label className={`${styles.field} ${styles.searchPanel}`}><input className={styles.searchInput} value={brandSearch} onChange={(event) => { setBrandSearch(event.target.value); setBrandDropdownOpen(true); }} onFocus={() => setBrandDropdownOpen(true)} placeholder="Search brand" /></label>
          <div className={styles.equipmentDropdownWrap}>
            <button type="button" className={`${styles.equipmentDropdownTrigger} ${brandDropdownOpen ? styles.equipmentDropdownTriggerOpen : ''}`} onClick={() => setBrandDropdownOpen((open) => !open)} aria-expanded={brandDropdownOpen} data-selected={Boolean(selectedBrand)}><span>{selectedBrand?.name ?? 'Select brand...'}</span><span className={styles.equipmentDropdownChevron}>⌄</span></button>
            {brandDropdownOpen ? <div className={styles.equipmentDropdownMenu}>{filteredBrands.map((brand) => <button key={brand.slug} type="button" className={`${styles.equipmentDropdownOption} ${brandSlug === brand.slug ? styles.equipmentDropdownOptionActive : ''}`} onClick={() => chooseBrand(brand.slug)}><span>{brand.name}</span></button>)}</div> : null}
          </div>
          {selectedBrand?.slug === 'unknown' ? <label className={styles.field}><span className={styles.fieldLabel}>Brand name</span><input value={manualBrandName} onChange={(event) => { setManualBrandName(event.target.value); clearResult(); }} placeholder="Type the brand name" /></label> : null}
        </div>

        {selectedBrand ? (
          <div className={`${styles.currentCard} ${styles.unknownModelCard}`} style={{ marginTop: '1rem' }}>
            <div className={styles.currentCardHead}><div><h3 className={styles.currentTitle}>Model <small style={{ fontWeight: 500 }}>(optional)</small></h3><p className={styles.currentHint}>Type what is written on the asset. Aim4price will suggest a known match when one exists.</p></div>{modelsLoading ? <span className={styles.equipmentCountPill}>Loading</span> : null}</div>
            <label className={`${styles.field} ${styles.searchPanel}`}><input className={styles.searchInput} value={modelQuery} onChange={(event) => { setModelQuery(event.target.value); setSelectedModelId(''); setModelMode(event.target.value.trim() ? 'manual' : ''); setModelDropdownOpen(true); clearResult(); }} onFocus={() => setModelDropdownOpen(true)} placeholder="e.g. 320 GC, 6155M, 8FG25" /></label>
            {modelDropdownOpen && modelQuery.trim() && filteredModels.length ? <div className={styles.equipmentDropdownMenu}>{filteredModels.slice(0, 12).map((model) => <button key={model.id} type="button" className={styles.equipmentDropdownOption} onClick={() => chooseModel(model)}><span className={styles.modelOptionText}>{modelLabel(model)}</span>{model.variantName ? <span className={styles.modelOptionMeta}>{model.variantName}</span> : null}</button>)}</div> : null}
            {selectedModel ? <p className={styles.fieldHint}>Matched to Aim4price catalogue data. Known model information will be used automatically.</p> : modelMode === 'manual' ? <p className={styles.fieldHint}>No catalogue selection required. Your typed model will be retained for this estimate and can feed future dataset review.</p> : null}
            <div className={styles.inlineOptionRow}><button type="button" className={`${styles.inlineOptionButton} ${modelMode === 'unknown' ? styles.inlineOptionButtonActive : ''}`} onClick={markModelUnknown}>I don’t know the model</button></div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderDetailsStep() {
    const sliderYear = yearUnknown ? CURRENT_YEAR : Math.min(CURRENT_YEAR, Math.max(1950, Number(year) || CURRENT_YEAR));
    const yearProgress = ((sliderYear - 1950) / Math.max(1, CURRENT_YEAR - 1950)) * 100;
    const percent = Math.min(100, Math.max(0, Number(lifeWorkedPercent) || 50));

    return (
      <div>
        <h2 className={styles.stepTitle}>Asset details</h2>
        <p className={styles.stepText}>Only the essentials. Popularity and fitted extras still form part of the estimate.</p>
        <div className={styles.specFlowStack}>
          <div className={`${styles.currentCard} ${styles.conditionStepCard}`}>
            <div className={styles.currentCardHead}><div><span className={styles.currentEyebrow}>Asset details 1</span><h3 className={styles.currentTitle}>Manufacturing year</h3></div><span className={styles.selectedSummaryPill}>{yearUnknown ? 'Unknown' : sliderYear}</span></div>
            {!yearUnknown ? <div className={styles.yearSliderPanel}><label className={styles.yearSliderControl}><input className={styles.yearRangeInput} style={{ '--year-progress': `${yearProgress}%` } as CSSProperties} type="range" min="1950" max={CURRENT_YEAR} value={sliderYear} onChange={(event) => { setYear(event.target.value); clearResult(); }} /><span className={styles.yearSliderMeta}><span>1950</span><span>{CURRENT_YEAR}</span></span></label></div> : null}
            <div className={styles.inlineOptionRow}><button type="button" className={`${styles.inlineOptionButton} ${yearUnknown ? styles.inlineOptionButtonActive : ''}`} onClick={() => { setYearUnknown((value) => !value); clearResult(); }}>{yearUnknown ? 'Choose a year instead' : 'I don’t know the year'}</button></div>
          </div>

          <div className={`${styles.currentCard} ${styles.conditionStepCard}`}>
            <div className={styles.currentCardHead}><div><span className={styles.currentEyebrow}>Asset details 2</span><h3 className={styles.currentTitle}>{usageMode === 'reading' ? usageFieldLabel : 'Life worked'}</h3><p className={styles.currentHint}>Use the real reading when known, otherwise estimate how much of its working life has been used.</p></div></div>
            <div className={styles.inlineOptionRow}><button type="button" className={`${styles.inlineOptionButton} ${usageMode === 'reading' ? styles.inlineOptionButtonActive : ''}`} onClick={() => { setUsageMode('reading'); clearResult(); }}>I know the {usageUnit === 'km' ? 'kilometres' : 'hours'}</button><button type="button" className={`${styles.inlineOptionButton} ${usageMode === 'percent' ? styles.inlineOptionButtonActive : ''}`} onClick={() => { setUsageMode('percent'); clearResult(); }}>I don’t know</button></div>
            {usageMode === 'reading' ? <label className={styles.field}><span className={styles.fieldLabel}>{usageFieldLabel}</span><input inputMode="numeric" value={usageAmount} onChange={(event) => { setUsageAmount(event.target.value); clearResult(); }} placeholder={usageUnit === 'km' ? 'e.g. 196000' : 'e.g. 3500'} /></label> : <><input className={styles.percentSlider} type="range" min="0" max="100" value={percent} onChange={(event) => { setLifeWorkedPercent(event.target.value); clearResult(); }} /><div className={styles.percentScale}><span>0% almost new</span><strong>{percent}%</strong><span>100% fully used</span></div></>}
          </div>

          <div className={`${styles.currentCard} ${styles.conditionStepCard}`}>
            <div className={styles.currentCardHead}><div><span className={styles.currentEyebrow}>Asset details 3</span><h3 className={styles.currentTitle}>Condition</h3><p className={styles.currentHint}>Choose the closest current condition.</p></div><span className={styles.selectedSummaryPill}>{conditionLabel(condition)}</span></div>
            <div className={styles.conditionButtonGrid}>{conditionOptions.map((option) => <button key={option.key} type="button" className={`${styles.conditionChoiceButton} ${condition === option.key ? styles.conditionChoiceButtonActive : ''}`} onClick={() => { setCondition(option.key); clearResult(); }}>{option.label}</button>)}</div>
          </div>

          <div className={`${styles.currentCard} ${styles.popularityStepCard}`}>
            <div className={styles.currentCardHead}><div><span className={styles.currentEyebrow}>Asset details 4</span><h3 className={styles.currentTitle}>Popularity</h3><p className={styles.currentHint}>Required. Rate current market demand for this asset.</p></div><span className={styles.selectedSummaryPill}>{popularityStars ? `${popularityStars} / 5 stars` : 'Choose rating'}</span></div>
            <div className={styles.popularityStars} role="group" aria-label="Popularity from 1 to 5 stars">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" className={star <= popularityStars ? styles.popularityStarActive : ''} onClick={() => { setPopularityStars(star); clearResult(); }}>★</button>)}</div>
            <small className={styles.advancedFieldHelp}>1 = difficult to sell, 3 = normal demand, 5 = highly sought after.</small>
          </div>

          {isTractor ? (
            <div className={styles.currentCard}>
              <div className={styles.currentCardHead}><div><span className={styles.currentEyebrow}>Asset details 5</span><h3 className={styles.currentTitle}>Tractor extras</h3><p className={styles.currentHint}>Required. Confirm fitted extras before the estimate.</p></div><span className={styles.selectedSummaryPill}>{extrasConfirmed ? 'Confirmed' : 'Confirm extras'}</span></div>
              <div className={`${styles.choiceGrid} ${styles.tractorExtrasGrid}`}>
                <button type="button" className={`${styles.choiceCard} ${noListedExtras ? styles.choiceCardActive : ''}`} onClick={() => { setNoListedExtras(true); setFrontPto(false); setFrontLoader(false); setGpsEnabled(false); setOtherExtraEnabled(false); setExtrasConfirmed(true); clearResult(); }}><strong>No listed extras</strong></button>
                <button type="button" className={`${styles.choiceCard} ${frontPto ? styles.choiceCardActive : ''}`} onClick={() => { setNoListedExtras(false); setFrontPto((value) => !value); setExtrasConfirmed(true); clearResult(); }}><strong>Front PTO</strong></button>
                <button type="button" className={`${styles.choiceCard} ${frontLoader ? styles.choiceCardActive : ''}`} onClick={() => { setNoListedExtras(false); setFrontLoader((value) => !value); setExtrasConfirmed(true); clearResult(); }}><strong>Front Loader</strong></button>
                <button type="button" className={`${styles.choiceCard} ${gpsEnabled ? styles.choiceCardActive : ''}`} onClick={() => { setNoListedExtras(false); setGpsEnabled((value) => !value); setExtrasConfirmed(true); clearResult(); }}><strong>GPS</strong></button>
                <button type="button" className={`${styles.choiceCard} ${otherExtraEnabled ? styles.choiceCardActive : ''}`} onClick={() => { setNoListedExtras(false); setOtherExtraEnabled((value) => !value); setExtrasConfirmed(true); clearResult(); }}><strong>Other extra</strong></button>
              </div>
              {frontLoader ? <label className={styles.field}><span className={styles.fieldLabel}>Front Loader year added</span><input inputMode="numeric" value={frontLoaderYear} onChange={(event) => setFrontLoaderYear(event.target.value)} placeholder="Same as tractor" /></label> : null}
              {gpsEnabled ? <div className={styles.inputGrid}><label className={styles.field}><span className={styles.fieldLabel}>GPS type</span><select value={gpsType} onChange={(event) => setGpsType(event.target.value as GpsType)}><option value="guidance-only">Guidance only</option><option value="full-autosteer">Full autosteer</option></select></label><label className={styles.field}><span className={styles.fieldLabel}>GPS year</span><input inputMode="numeric" value={gpsYear} onChange={(event) => setGpsYear(event.target.value)} placeholder="Optional" /></label></div> : null}
              {otherExtraEnabled ? <div className={styles.inputGrid}><label className={styles.field}><span className={styles.fieldLabel}>Extra name</span><input value={otherExtraName} onChange={(event) => setOtherExtraName(event.target.value)} placeholder="e.g. Weight set" /></label><label className={styles.field}><span className={styles.fieldLabel}>Replacement price excl. VAT</span><input inputMode="numeric" value={otherExtraReplacementPrice} onChange={(event) => setOtherExtraReplacementPrice(event.target.value)} placeholder="e.g. 25000" /></label></div> : null}
              {!exactTractorPath && anyExtraSelected ? <p className={styles.message}>Select a suggested tractor model so Aim4price can apply the existing model-specific extras valuation. Aim4price will not invent extra values for an unmatched model.</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderReplacementStep() {
    const preview = replacementPreview;
    const numeric = parsePositive(replacementPrice);
    const hasBand = Boolean(preview?.min && preview?.max && preview.max > preview.min);
    const sliderMin = hasBand ? Math.round(preview!.min!) : numeric ? Math.max(1, Math.round(numeric * 0.7)) : 0;
    const sliderMax = hasBand ? Math.round(preview!.max!) : numeric ? Math.round(numeric * 1.3) : 0;
    const sliderValue = numeric && sliderMax > sliderMin ? Math.min(sliderMax, Math.max(sliderMin, Math.round(numeric))) : sliderMin;
    const progress = sliderMax > sliderMin ? ((sliderValue - sliderMin) / (sliderMax - sliderMin)) * 100 : 50;

    return (
      <div>
        <h2 className={styles.stepTitle}>Replacement price</h2>
        <p className={styles.stepText}>Confirm what a similar new asset would cost today. Aim4price uses this as the starting point for the existing valuation logic.</p>
        <div className={`${styles.currentCard} ${styles.conditionStepCard}`}>
          <div className={styles.currentCardHead}><div><h3 className={styles.currentTitle}>Aim4price replacement-price position</h3><p className={styles.currentHint}>{preview?.weak ? 'Our information is broad or limited. Adjust the value if you know a better current replacement price.' : 'Use the Aim4price position or adjust it if you know the replacement price.'}</p></div><span className={styles.selectedSummaryPill}>{preview?.confidenceLabel ?? 'Limited'}</span></div>

          {hasBand ? <div className={styles.resultFactsGrid}><div className={styles.resultFactCard}><span>Current Aim4price range</span><strong>{formatRange(preview?.min ?? null, preview?.max ?? null)}</strong></div><div className={styles.resultFactCard}><span>Pricing basis</span><strong>{preview?.sourceLabel}</strong></div></div> : preview?.suggested ? <div className={styles.resultFactsGrid}><div className={styles.resultFactCard}><span>Aim4price position</span><strong>{money(preview.suggested)}</strong></div><div className={styles.resultFactCard}><span>Pricing basis</span><strong>{preview.sourceLabel}</strong></div></div> : <p className={styles.message}>Aim4price does not have a reliable replacement-price position for this selection yet. Enter the replacement price if you know it; no false range is being shown.</p>}

          {numeric && sliderMax > sliderMin ? <div className={styles.yearSliderPanel}><label className={styles.yearSliderControl}><span className={styles.fieldLabel}>{hasBand ? 'Position within Aim4price range' : 'Adjustment control'}</span><input className={styles.yearRangeInput} style={{ '--year-progress': `${progress}%` } as CSSProperties} type="range" min={sliderMin} max={sliderMax} step={Math.max(1000, Math.round((sliderMax - sliderMin) / 1000) * 100)} value={sliderValue} onChange={(event) => { setReplacementPrice(event.target.value); setReplacementEdited(true); }} /><span className={styles.yearSliderMeta}><span>{money(sliderMin)}</span><span>{money(sliderMax)}</span></span></label></div> : null}

          <label className={styles.field}><span className={styles.fieldLabel}>Replacement price excl. VAT</span><input inputMode="numeric" value={replacementPrice} onChange={(event) => { setReplacementPrice(event.target.value); setReplacementEdited(true); }} placeholder="Enter current replacement price" /><span className={styles.fieldHint}>{replacementEdited ? 'Your replacement price will be used.' : preview?.suggested ? 'Aim4price replacement price will remain the recorded basis unless you change it.' : 'Enter your best known replacement price.'}</span></label>
          {replacementPreviewError ? <p className={styles.message}>{replacementPreviewError}</p> : null}
        </div>
      </div>
    );
  }

  function renderResultStep() {
    if (!resultState || resultValue === null) return <div><h2 className={styles.stepTitle}>No estimate yet</h2><p className={styles.stepText}>Go back and calculate the estimate.</p></div>;
    const replacementBasis = currentReplacementBasis();
    const resultReplacement = resultState.kind === 'tractor' ? resultState.result.replacementPriceUsedExVat : resultState.result.replacementPriceUsedExVat;
    const resultYear = yearUnknown ? 'Unknown' : String(year);
    const resultUsage = usageMode === 'reading' ? `${Number(usageAmount || 0).toLocaleString('en-ZA')} ${usageShortUnit}` : `${workedPercentNumber ?? 0}% worked`;
    const titleBrand = selectedBrand?.slug === 'unknown' ? manualBrandName : selectedBrand?.name;
    const titleModel = modelMode === 'unknown' ? selectedFamily?.familyLabel : selectedModel?.modelName ?? modelQuery;

    return (
      <div className={styles.resultsLayout}>
        <div className={styles.resultsMain}>
          <section className={styles.resultHero}>
            <div className={styles.resultHeroTopline}><span className={styles.resultKicker}>Aim4price estimate</span><span className={`${styles.resultConfidenceBadge} ${styles.confidenceMedium}`}>{resultState.kind === 'generic' ? `Confidence: ${resultState.result.confidenceLabel}` : 'Existing tractor valuation'}</span></div>
            <div className={styles.resultValueLine}><strong className={styles.resultValue}>{money(resultValue)}</strong></div>
            <p className={styles.resultMachineTitle}>{[titleBrand, titleModel].filter(Boolean).join(' ')}</p>
            <div className={styles.resultFactsGrid}>
              <div className={styles.resultFactCard}><span>Year</span><strong>{resultYear}</strong></div>
              <div className={styles.resultFactCard}><span>Usage</span><strong>{resultUsage}</strong></div>
              <div className={styles.resultFactCard}><span>Condition</span><strong>{conditionLabel(condition)}</strong></div>
              <div className={styles.resultFactCard}><span>Popularity</span><strong>{popularityStars} / 5 stars</strong></div>
              <div className={styles.resultFactCard}><span>Replacement price</span><strong>{money(resultReplacement ?? parsePositive(replacementPrice))}</strong></div>
              <div className={styles.resultFactCard}><span>Replacement basis</span><strong>{replacementBasis === 'user' ? 'User adjusted' : 'Aim4price'}</strong></div>
            </div>
          </section>
        </div>
        <aside className={styles.resultsSide}>
          <section className={styles.resultFinalActions}>
            <div className={styles.resultFinalActionsCopy}><span>Estimate actions</span><h3>Save the asset</h3><p>The valuation still saves through the existing Aim4price valuation-run and Asset Register architecture.</p></div>
            {dealerAppMode && dealerRegisters.length > 1 ? <label className={styles.field}><span className={styles.fieldLabel}>Asset Register</span><select value={dealerRegisterId} onChange={(event) => setDealerRegisterId(event.target.value)}>{dealerRegisters.map((register) => <option key={register.id} value={register.id}>{register.businessName || (register.isPrimary ? 'Dealer Asset Register' : 'Client Asset Register')}</option>)}</select></label> : null}
            <div className={styles.resultFinalActionsButtons}><button type="button" className={styles.resultPrimaryActionButton} onClick={() => void saveEstimate()} disabled={saveLoading}>{saveLoading ? 'Saving...' : isSignedIn ? ownerAppMode ? 'Save to My Assets' : 'Save to Asset Register' : 'Sign in to save'}</button><button type="button" className={styles.resultPdfActionButton} onClick={() => { setStep(1); setSelectedSector(null); resetDetails(); }}>New estimate</button></div>
          </section>
        </aside>
      </div>
    );
  }

  function renderBody() {
    if (step === 1) return renderAssetStep();
    if (step === 2) return renderIdentityStep();
    if (step === 3) return renderDetailsStep();
    if (step === 4) return renderReplacementStep();
    return renderResultStep();
  }

  function next() {
    setMessage('');
    if (step === 1) {
      if (!selectedFamily) { setMessage('Choose an asset family first.'); return; }
      setStep(2);
      return;
    }
    if (step === 2) {
      const error = validateIdentity();
      if (error) { setMessage(error); return; }
      setStep(3);
      return;
    }
    if (step === 3) {
      void prepareReplacementPrice();
      return;
    }
    if (step === 4) {
      void calculateEstimate();
    }
  }

  return (
    <main className={`${styles.page} ${compactAppMode ? `${styles.appValuation} ${dealerStyles.dealerValuationSurface}` : ''}`}>
      {!compactAppMode ? <AppHeader active="valuation" /> : null}
      <div className={styles.container}>
        <section className={styles.wizardShell}>
          <div id="valuation-wizard-card" className={styles.wizardCard}>
            {selectedSector || step > 1 ? <div className={styles.wizardHeader}><div className={styles.stepper}>{STEPS.map((item) => { const active = item.step === step; const complete = item.step < step; return <button key={item.step} type="button" className={`${styles.stepperItem} ${active ? styles.stepperItemActive : ''} ${complete ? styles.stepperItemComplete : ''}`} disabled={!complete || item.step === 5} onClick={() => { setMessage(''); setStep(item.step); }}><span className={`${styles.stepperBullet} ${active ? styles.stepperBulletActive : ''} ${complete ? styles.stepperBulletComplete : ''}`}>{complete ? '✓' : item.step}</span>{!compactAppMode ? <span className={`${styles.stepperLabel} ${active ? styles.stepperLabelActive : ''}`}>{item.label}</span> : null}</button>; })}</div></div> : null}
            <div className={styles.stepContent}>{renderBody()}{message ? <div className={styles.message}>{message}</div> : null}</div>
            <div className={`${styles.wizardFooter} ${step === 5 ? styles.wizardFooterSingle : ''}`}>
              {step < 5 ? <button type="button" className={styles.secondaryButton} onClick={goBack} disabled={valuationLoading || replacementPreviewLoading}>Back</button> : null}
              {step < 5 ? <button type="button" className={styles.primaryButton} onClick={next} disabled={valuationLoading || replacementPreviewLoading || familiesLoading || brandsLoading}>{replacementPreviewLoading ? 'Checking replacement price...' : valuationLoading ? 'Calculating...' : step === 4 ? 'Get Estimate' : 'Continue'}</button> : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
