'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';
import {
  conditionOptions,
  type BrandRow,
  type CabType,
  type ConditionKey,
  type DriveType,
  type MarketplaceListing,
  type TractorCatalogRow,
  type TractorType,
} from '../../lib/tractor-data';
import { conditionLabel, money, range, type Result } from '../../lib/tractor-logic';
import { getGuestValuationCount, incrementGuestValuationCount } from '../../lib/guest-valuation-limit';

type Step = 1 | 2 | 3 | 4 | 5;
type MethodKey = 'aim4price' | 'market' | 'department';
type EquipmentType = 'tractor';
type GpsType = 'full-autosteer' | 'guidance-only';
type ConfigStepKey = 'type' | 'drive' | 'cab' | 'model';
type DetailsStepKey = 'year' | 'hours' | 'condition' | 'extras';

type MethodCard = {
  key: MethodKey;
  label: string;
  note: string;
  value: number | null;
  available: boolean;
};

type BrandsApiResponse = {
  ok: boolean;
  count?: number;
  brands?: BrandRow[];
  error?: string;
};

type TractorModelsApiResponse = {
  ok: boolean;
  count?: number;
  models?: TractorCatalogRow[];
  error?: string;
};

type TractorValuationApiResponse = {
  ok: boolean;
  result?: Result;
  error?: string;
};

type SaveValuationRunApiResponse = {
  ok: boolean;
  runId?: number;
  assetId?: string;
  createdAtIso?: string;
  selectedValueExVat?: number;
  warning?: string;
  error?: string;
};

const CURRENT_YEAR = new Date().getFullYear() + 1;

const WIZARD_STEPS: Array<{ step: Step; label: string }> = [
  { step: 1, label: 'Type' },
  { step: 2, label: 'Brand' },
  { step: 3, label: 'Model' },
  { step: 4, label: 'Details' },
  { step: 5, label: 'Value' },
];

const CONFIG_STEPS: Array<{ key: ConfigStepKey; label: string }> = [
  { key: 'type', label: 'Type' },
  { key: 'drive', label: 'Drive' },
  { key: 'cab', label: 'Cab' },
  { key: 'model', label: 'Model' },
];

const DETAILS_STEPS: Array<{ key: DetailsStepKey; label: string }> = [
  { key: 'year', label: 'Year' },
  { key: 'hours', label: 'Hours' },
  { key: 'condition', label: 'Condition' },
  { key: 'extras', label: 'Extras' },
];

function nextStep(step: Step): Step {
  return step === 1 ? 2 : step === 2 ? 3 : step === 3 ? 4 : 5;
}

function previousStep(step: Step): Step {
  return step === 5 ? 4 : step === 4 ? 3 : step === 3 ? 2 : 1;
}

function getMethodValue(result: Result, method: MethodKey): number | null {
  if (method === 'aim4price') return result.aim4priceValueExVat;
  if (method === 'market') return result.marketMid;
  return result.departmentValueExVat;
}

function getMethodLabel(method: MethodKey): string {
  if (method === 'aim4price') return 'Aim4price Value';
  if (method === 'market') return 'Estimated Market Value';
  return 'DALRRD Reference';
}

function getMethodDisplay(result: Result, method: MethodKey): string {
  if (method === 'market') {
    return range(result.marketLow, result.marketHigh);
  }

  return money(getMethodValue(result, method));
}

function getRangePercent(low: number | null, high: number | null, value: number | null): number {
  if (low === null || high === null || value === null) return 50;
  if (high <= low) return 50;

  const percent = ((value - low) / (high - low)) * 100;
  return Math.min(100, Math.max(0, percent));
}

function getStepMeta(step: Step) {
  switch (step) {
    case 1:
      return {
        title: 'Choose Equipment Type',
        body: 'Select your equipment type to continue.',
      };
    case 2:
      return {
        title: 'Choose Brand',
        body: 'Select a tractor brand from the dropdown list.',
      };
    case 3:
      return {
        title: 'Choose Tractor Model',
        body: 'Four quick choices. One at a time.',
      };
    case 4:
      return {
        title: 'Enter Tractor Details',
        body: 'Four quick details. One at a time.',
      };
    default:
      return {
        title: 'Valuation Results',
        body: 'Review the calculated values and next actions.',
      };
  }
}

function getConditionHint(condition: ConditionKey): string {
  if (condition === 'excellent') return 'Best kept condition';
  if (condition === 'good') return 'Well maintained working tractor';
  if (condition === 'fair') return 'Average wear for age';
  if (condition === 'used') return 'Heavy general use visible';
  return 'Requires attention before sale';
}

function getConfidenceLevel(result: Result): 'high' | 'medium' | 'low' {
  if (result.marketCount >= 5) return 'high';
  if (result.marketCount >= 2) return 'medium';
  return 'low';
}

function getConfidenceLabel(result: Result): string {
  const level = getConfidenceLevel(result);

  if (level === 'high') return 'Confidence: High';
  if (level === 'medium') return 'Confidence: Medium';
  return 'Confidence: Low';
}

function getTractorTypeLabel(type: TractorType): string {
  return type === 'orchard' ? 'Orchard' : 'Field';
}

function getDriveDisplay(driveValue: DriveType): string {
  return driveValue === 'tracks' ? 'Tracks' : driveValue.toUpperCase();
}

function getCabDisplay(cabValue: CabType): string {
  return cabValue === 'cab' ? 'Cab' : 'Open station';
}

function getGpsTypeLabel(type: GpsType): string {
  return type === 'full-autosteer' ? 'Full Autosteer' : 'Guidance Only';
}

function buildExtrasSummaryChips(
  frontPto: boolean,
  frontLoader: boolean,
  gpsEnabled: boolean,
  gpsType: GpsType | null,
  gpsYear: string,
): string[] {
  const chips: string[] = [];

  if (frontPto) {
    chips.push('Front Hitch & Front PTO');
  }

  if (frontLoader) {
    chips.push('Front Loader');
  }

  if (gpsEnabled) {
    let gpsLabel = 'GPS';

    if (gpsType) {
      gpsLabel = `${gpsLabel} • ${getGpsTypeLabel(gpsType)}`;
    }

    if (gpsYear.trim()) {
      gpsLabel = `${gpsLabel} • ${gpsYear.trim()}`;
    }

    chips.push(gpsLabel);
  }

  if (!chips.length) {
    chips.push('No fitted extras selected');
  }

  return chips;
}

function buildExtrasSummaryText(
  frontPto: boolean,
  frontLoader: boolean,
  gpsEnabled: boolean,
  gpsType: GpsType | null,
  gpsYear: string,
): string {
  return buildExtrasSummaryChips(frontPto, frontLoader, gpsEnabled, gpsType, gpsYear).join(' · ');
}

function getListingBasePrice(listing: MarketplaceListing): number {
  const candidates = [
    Number(listing.advertisedPriceExVat),
    Number(listing.askingPriceExVat),
    Number(listing.priceExVat),
    Number(listing.price),
  ].filter((value) => Number.isFinite(value) && value > 0);

  return candidates[0] ?? 0;
}

function getListingComparablePrice(listing: MarketplaceListing, extrasValueExVat: number): number {
  return Math.round(getListingBasePrice(listing) + Math.max(0, Number(extrasValueExVat) || 0));
}

function formatListingDate(value: string): string {
  if (!value.trim()) return 'Date not supplied';

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function getSourceLinkLabel(value: string): string {
  return value.trim();
}

export default function ValuationClient() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [selectedType, setSelectedType] = useState<EquipmentType | null>(null);
  const [modelQuery, setModelQuery] = useState('');
  const [brandSlug, setBrandSlug] = useState('');
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [tractorType, setTractorType] = useState<TractorType | null>(null);
  const [drive, setDrive] = useState<DriveType | null>(null);
  const [cab, setCab] = useState<CabType | null>(null);
  const [modelId, setModelId] = useState('');
  const [yearMode, setYearMode] = useState<'guided' | 'manual'>('guided');
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [manualYear, setManualYear] = useState('');
  const [hours, setHours] = useState('');
  const [condition, setCondition] = useState<ConditionKey | null>(null);
  const [configFocus, setConfigFocus] = useState<ConfigStepKey | null>(null);
  const [detailsFocus, setDetailsFocus] = useState<DetailsStepKey | null>(null);
  const [yearConfirmed, setYearConfirmed] = useState(false);
  const [hoursConfirmed, setHoursConfirmed] = useState(false);
  const [extrasReviewed, setExtrasReviewed] = useState(false);
  const [frontPto, setFrontPto] = useState(false);
  const [frontLoader, setFrontLoader] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsType, setGpsType] = useState<GpsType | null>(null);
  const [gpsYear, setGpsYear] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<MethodKey | null>(null);
  const [selectedComparableIndex, setSelectedComparableIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [availableBrands, setAvailableBrands] = useState<BrandRow[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [availableModels, setAvailableModels] = useState<TractorCatalogRow[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveChoiceOpen, setSaveChoiceOpen] = useState(false);
  const [saveChoiceMethod, setSaveChoiceMethod] = useState<MethodKey | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [guestValuationCount, setGuestValuationCount] = useState(0);

  const freeGuestValuationsRemaining = Math.max(0, 3 - guestValuationCount);
  const stepMeta = getStepMeta(step);
  const brandDropdownRef = useRef<HTMLDivElement | null>(null);
  const brandSearchInputRef = useRef<HTMLInputElement | null>(null);
  const yearDropdownRef = useRef<HTMLDivElement | null>(null);

  const sortedBrands = useMemo(
    () => [...availableBrands].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [availableBrands],
  );

  const matchingModels = useMemo(() => availableModels, [availableModels]);

  const filteredModels = useMemo(() => {
    const normalizedQuery = modelQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return matchingModels;
    }

    return matchingModels.filter((tractor) =>
      `${tractor.brandName} ${tractor.modelName} ${tractor.tractorType} ${tractor.drive} ${tractor.cab} ${tractor.powerKw}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [matchingModels, modelQuery]);

  const selectedModel = useMemo<TractorCatalogRow | null>(
    () => matchingModels.find((model) => model.id === modelId) ?? null,
    [matchingModels, modelId],
  );

  function invalidateResult() {
    setResult(null);
    setSelectedMethod(null);
  }

  function resetExtrasState() {
    setFrontPto(false);
    setFrontLoader(false);
    setGpsEnabled(false);
    setGpsType(null);
    setGpsYear('');
    setExtrasReviewed(false);
  }

  function resetDetailState(options?: { keepYearMode?: boolean }) {
    if (!options?.keepYearMode) {
      setYearMode('guided');
    }
    setYearDropdownOpen(false);
    setYear(null);
    setManualYear('');
    setHours('');
    setCondition(null);
    setYearConfirmed(false);
    setHoursConfirmed(false);
    setDetailsFocus(null);
    resetExtrasState();
    invalidateResult();
  }

  function markExtrasDirty() {
    setExtrasReviewed(false);
    invalidateResult();
  }

  function confirmYearSelection() {
    if (!selectedModel || !isYearValid) {
      setMessage('Enter a valid year first.');
      return;
    }

    setYearConfirmed(true);
    setDetailsFocus(null);
    setMessage('');
  }

  function confirmHoursSelection() {
    if (!isHoursValid) {
      setMessage('Enter engine hours first.');
      return;
    }

    setHoursConfirmed(true);
    setDetailsFocus(null);
    setMessage('');
  }

  function applyExtrasSelection() {
    setExtrasReviewed(true);
    setDetailsFocus(null);
    setMessage('');
  }

  function clearExtrasSelection() {
    setFrontPto(false);
    setFrontLoader(false);
    setGpsEnabled(false);
    setGpsType(null);
    setGpsYear('');
    setExtrasReviewed(true);
    setDetailsFocus(null);
    setMessage('');
    invalidateResult();
  }

  useEffect(() => {
    let mounted = true;

    async function loadAccessState() {
      try {
        const response = await fetch('/api/me', {
          credentials: 'include',
          cache: 'no-store',
        });

        const data = (await response.json()) as {
          ok: boolean;
          signedIn: boolean;
          user: { id: string; name: string; email: string } | null;
        };

        if (!mounted) return;

        setIsSignedIn(Boolean(data?.signedIn));
        setGuestValuationCount(getGuestValuationCount());
      } catch {
        if (!mounted) return;

        setIsSignedIn(false);
        setGuestValuationCount(getGuestValuationCount());
      }
    }

    void loadAccessState();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadBrands() {
      try {
        const response = await fetch('/api/brands', {
          cache: 'no-store',
        });

        const data = (await response.json()) as BrandsApiResponse;

        if (!response.ok || !data.ok || !Array.isArray(data.brands)) {
          throw new Error(data.error ?? 'Failed to load brands from the database.');
        }

        if (!ignore) {
          setAvailableBrands(data.brands);
        }
      } catch (error) {
        console.error('Failed to load brands from /api/brands', error);

        if (!ignore) {
          setAvailableBrands([]);
        }
      } finally {
        if (!ignore) {
          setBrandsLoading(false);
        }
      }
    }

    loadBrands();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    if (!brandSlug || !tractorType || !drive || !cab) {
      setAvailableModels([]);
      setModelsLoading(false);
      return () => {
        ignore = true;
      };
    }

    const currentBrandSlug = brandSlug;
    const currentTractorType = tractorType;
    const currentDrive = drive;
    const currentCab = cab;

    async function loadModels() {
      setModelsLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('brandSlug', currentBrandSlug);
        params.set('tractorType', currentTractorType);
        params.set('drive', currentDrive);
        params.set('cab', currentCab);

        const response = await fetch(`/api/tractor-models?${params.toString()}`, {
          cache: 'no-store',
        });

        const data = (await response.json()) as TractorModelsApiResponse;

        if (!response.ok || !data.ok || !Array.isArray(data.models)) {
          throw new Error(data.error ?? 'Failed to load models from the database.');
        }

        if (!ignore) {
          setAvailableModels(data.models);
        }
      } catch (error) {
        console.error('Failed to load models from /api/tractor-models', error);

        if (!ignore) {
          setAvailableModels([]);
        }
      } finally {
        if (!ignore) {
          setModelsLoading(false);
        }
      }
    }

    loadModels();

    return () => {
      ignore = true;
    };
  }, [brandSlug, tractorType, drive, cab]);

  useEffect(() => {
    if (!availableBrands.length) return;

    if (!availableBrands.some((brand) => brand.slug === brandSlug)) {
      setBrandSlug(availableBrands[0].slug);
    }
  }, [availableBrands, brandSlug]);

  useEffect(() => {
    if (!matchingModels.length) {
      if (modelId !== '') {
        setModelId('');
      }
      return;
    }

    if (modelId && !matchingModels.some((model) => model.id === modelId)) {
      setModelId('');
    }
  }, [matchingModels, modelId]);

  useEffect(() => {
    if (!selectedModel) {
      setYear(null);
      setYearConfirmed(false);
      setHoursConfirmed(false);
      setCondition(null);
      setExtrasReviewed(false);
      return;
    }

    if (yearMode === 'guided' && year !== null) {
      if (year < selectedModel.yearStart || year > selectedModel.yearEnd) {
        setYear(null);
        setYearConfirmed(false);
      }
    }
  }, [selectedModel, yearMode, year]);

  useEffect(() => {
    if (step !== 2) {
      setBrandDropdownOpen(false);
      setBrandSearch('');
    }

    if (step !== 3) {
      setConfigFocus(null);
    }

    if (step !== 4) {
      setDetailsFocus(null);
      setYearDropdownOpen(false);
    }
  }, [step]);

  useEffect(() => {
    if (!brandDropdownOpen) {
      setBrandSearch('');
      return;
    }

    const timeoutId = window.setTimeout(() => {
      brandSearchInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [brandDropdownOpen]);

  useEffect(() => {
    if (!gpsEnabled) {
      setGpsType(null);
      setGpsYear('');
    }
  }, [gpsEnabled]);

  useEffect(() => {
    if (!brandDropdownOpen && !yearDropdownOpen) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (brandDropdownOpen && brandDropdownRef.current && !brandDropdownRef.current.contains(target)) {
        setBrandDropdownOpen(false);
      }

      if (yearDropdownOpen && yearDropdownRef.current && !yearDropdownRef.current.contains(target)) {
        setYearDropdownOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setBrandDropdownOpen(false);
      setYearDropdownOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [brandDropdownOpen, yearDropdownOpen]);

  const years = useMemo(
    () =>
      selectedModel
        ? Array.from(
            { length: selectedModel.yearEnd - selectedModel.yearStart + 1 },
            (_, index) => selectedModel.yearEnd - index,
          )
        : [],
    [selectedModel],
  );

  const selectedBrandName = useMemo(
    () => availableBrands.find((brand) => brand.slug === brandSlug)?.name ?? '—',
    [availableBrands, brandSlug],
  );

  const filteredBrandOptions = useMemo(() => {
    const normalizedQuery = brandSearch.trim().toLowerCase();

    if (!normalizedQuery) return sortedBrands;

    return sortedBrands.filter((brand) => brand.name.toLowerCase().includes(normalizedQuery));
  }, [brandSearch, sortedBrands]);

  const activeYear = yearMode === 'manual' ? Number(manualYear) : year ?? Number.NaN;
  const isYearValid =
    yearMode === 'guided'
      ? Number.isInteger(year)
      : Number.isInteger(activeYear) && activeYear >= 1950 && activeYear <= CURRENT_YEAR;
  const selectedYearDisplay = isYearValid ? String(activeYear) : 'Choose year';
  const enteredHours = Number(hours);
  const isHoursValid = Number.isFinite(enteredHours) && enteredHours > 0;
  const enteredHoursDisplay = isHoursValid ? `${enteredHours.toLocaleString('en-ZA')} hrs` : 'Type hours';
  const selectedConditionDisplay = condition ? conditionLabel(condition) : 'Choose condition';
  const extrasSummaryChips = useMemo(
    () => buildExtrasSummaryChips(frontPto, frontLoader, gpsEnabled, gpsType, gpsYear),
    [frontPto, frontLoader, gpsEnabled, gpsType, gpsYear],
  );
  const extrasSummaryText = useMemo(
    () => buildExtrasSummaryText(frontPto, frontLoader, gpsEnabled, gpsType, gpsYear),
    [frontPto, frontLoader, gpsEnabled, gpsType, gpsYear],
  );

  const methodCards = useMemo<MethodCard[]>(() => {
    if (!result) return [];

    return [
      {
        key: 'aim4price',
        label: 'Aim4price Value',
        note: 'Based on our pricing engine and comparable market trends.',
        value: result.aim4priceValueExVat,
        available: result.aim4priceValueExVat !== null,
      },
      {
        key: 'market',
        label: 'Market Range',
        note: `${result.marketCount} provable market listing${result.marketCount === 1 ? '' : 's'} linked below.`,
        value: result.marketMid,
        available: result.marketMid !== null,
      },
      {
        key: 'department',
        label: 'DALRRD Reference',
        note: 'Guide reference based on kW band and drive type.',
        value: result.departmentValueExVat,
        available: result.departmentValueExVat !== null,
      },
    ];
  }, [result]);

  const selectedMethodValue = result && selectedMethod ? getMethodValue(result, selectedMethod) : null;
  const headlineValue = selectedMethodValue ?? result?.previewValueExVat ?? null;
  const headlineLabel = selectedMethod ? getMethodLabel(selectedMethod) : 'Estimated Market Value';
  const confidenceLevel = result ? getConfidenceLevel(result) : 'low';
  const confidenceClassName =
    confidenceLevel === 'high'
      ? styles.confidenceHigh
      : confidenceLevel === 'medium'
        ? styles.confidenceMedium
        : styles.confidenceLow;
  const confidencePanelClassName =
    confidenceLevel === 'high'
      ? styles.valuePanelHigh
      : confidenceLevel === 'medium'
        ? styles.valuePanelMedium
        : styles.valuePanelLow;

  const comparableListings = useMemo<MarketplaceListing[]>(() => {
    if (!result) return [];

    return [...result.marketSources].sort((left, right) => {
      const priceDelta =
        getListingComparablePrice(left, result.extrasValueExVat) -
        getListingComparablePrice(right, result.extrasValueExVat);

      if (priceDelta !== 0) return priceDelta;
      if (left.yearModel !== right.yearModel) return left.yearModel - right.yearModel;

      return left.hours - right.hours;
    });
  }, [result]);

  useEffect(() => {
    if (!result || !comparableListings.length) {
      setSelectedComparableIndex(0);
      return;
    }

    const fallbackIndex = Math.floor(comparableListings.length / 2);
    const targetValue =
      result.marketMid ??
      getListingComparablePrice(comparableListings[fallbackIndex], result.extrasValueExVat);

    let bestIndex = fallbackIndex;
    let bestDelta = Number.POSITIVE_INFINITY;

    comparableListings.forEach((listing, index) => {
      const delta = Math.abs(getListingComparablePrice(listing, result.extrasValueExVat) - targetValue);

      if (delta < bestDelta) {
        bestDelta = delta;
        bestIndex = index;
      }
    });

    setSelectedComparableIndex(bestIndex);
  }, [comparableListings, result]);

  const safeComparableIndex = comparableListings.length
    ? Math.min(selectedComparableIndex, comparableListings.length - 1)
    : 0;
  const selectedComparable = comparableListings[safeComparableIndex] ?? null;
  const selectedComparableSourceUrl = selectedComparable?.sourceUrl?.trim() ?? '';
  const selectedComparableValue =
    selectedComparable && result
      ? getListingComparablePrice(selectedComparable, result.extrasValueExVat)
      : result?.marketMid ?? null;
  const selectedComparablePercent = getRangePercent(
    result?.marketLow ?? null,
    result?.marketHigh ?? null,
    selectedComparableValue,
  );

  const configComplete = Boolean(tractorType && drive && cab && selectedModel);
  const configAutoStep: ConfigStepKey = !tractorType ? 'type' : !drive ? 'drive' : !cab ? 'cab' : 'model';
  const activeConfigStep = configFocus ?? configAutoStep;
  const configStepNumber = CONFIG_STEPS.findIndex((item) => item.key === activeConfigStep) + 1;

  const detailsComplete = Boolean(yearConfirmed && hoursConfirmed && condition !== null && extrasReviewed);
  const detailsAutoStep: DetailsStepKey = !yearConfirmed
    ? 'year'
    : !hoursConfirmed
      ? 'hours'
      : !condition
        ? 'condition'
        : 'extras';
  const activeDetailsStep = detailsFocus ?? detailsAutoStep;
  const activeDetailsStepNumber = DETAILS_STEPS.findIndex((item) => item.key === activeDetailsStep) + 1;

  const canContinue = useMemo(() => {
    if (step === 1) return selectedType === 'tractor';
    if (step === 3) return configComplete;
    if (step === 4) {
      return Boolean(
        selectedModel &&
          isYearValid &&
          isHoursValid &&
          yearConfirmed &&
          hoursConfirmed &&
          condition &&
          extrasReviewed,
      );
    }
    return true;
  }, [
    step,
    selectedType,
    configComplete,
    selectedModel,
    isYearValid,
    isHoursValid,
    yearConfirmed,
    hoursConfirmed,
    condition,
    extrasReviewed,
  ]);

  const nextLabel = valuationLoading
    ? 'Calculating...'
    : step === 1
      ? 'Choose Brand'
      : step === 2
        ? 'Choose Model'
        : step === 3
          ? 'Enter Details'
          : 'Get Valuation';

  function resetWizard() {
    setStep(1);
    setSelectedType(null);
    setModelQuery('');
    setBrandSlug('');
    setBrandDropdownOpen(false);
    setBrandSearch('');
    setTractorType(null);
    setDrive(null);
    setCab(null);
    setModelId('');
    setConfigFocus(null);
    setDetailsFocus(null);
    setYearConfirmed(false);
    setHoursConfirmed(false);
    setExtrasReviewed(false);
    setResult(null);
    setSelectedMethod(null);
    setValuationLoading(false);
    setSaveLoading(false);
    setMessage('');
    resetDetailState();
  }

  function handleBack() {
    setMessage('');

    if (step === 1) {
      router.push('/');
      return;
    }

    setStep(previousStep(step));
  }

  async function handleNext() {
    setMessage('');

    if (step === 3 && !selectedModel) {
      setMessage('Choose a model first.');
      return;
    }

    if (step === 4) {
      const parsedHours = Number(hours);
      const parsedYear = activeYear;

      if (!selectedModel || !isYearValid || !yearConfirmed) {
        setMessage('Confirm the year first.');
        return;
      }

      if (!Number.isFinite(parsedHours) || parsedHours <= 0 || !hoursConfirmed) {
        setMessage('Confirm the engine hours first.');
        return;
      }

      if (!condition) {
        setMessage('Choose the condition first.');
        return;
      }

      if (!extrasReviewed) {
        setMessage('Review the extras first.');
        return;
      }

      if (!isSignedIn && guestValuationCount >= 3) {
        setMessage('You have used your 3 free valuations. Please create an account or log in to continue.');
        router.push('/auth#signup');
        return;
      }

      setValuationLoading(true);

      try {
        const response = await fetch('/api/tractor-valuations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            modelId: selectedModel.id,
            year: parsedYear,
            hours: parsedHours,
            condition,
            frontPto,
            frontLoader,
            gpsEnabled,
            gpsType,
            gpsYear,
          }),
        });

        const data = (await response.json()) as TractorValuationApiResponse;

        if (!response.ok || !data.ok || !data.result) {
          throw new Error(data.error ?? 'Failed to calculate valuation.');
        }

        const nextResult = data.result;

        setResult(nextResult);

        if (!isSignedIn) {
          const nextCount = incrementGuestValuationCount();
          setGuestValuationCount(nextCount);
        }

        const defaultMethod: MethodKey =
          nextResult.marketMid !== null
            ? 'market'
            : nextResult.aim4priceValueExVat !== null
              ? 'aim4price'
              : 'department';

        setSelectedMethod(defaultMethod);
        setStep(5);
      } catch (error) {
        console.error('Failed to calculate valuation from /api/tractor-valuations', error);
        setMessage(error instanceof Error ? error.message : 'Failed to calculate valuation.');
      } finally {
        setValuationLoading(false);
      }

      return;
    }

    setStep(nextStep(step));
  }

  function handleSave() {
    if (!result || !condition) {
      setMessage('Run a valuation before saving to the asset register.');
      return;
    }

    if (!isSignedIn) {
      setMessage('Please create an account or log in to save to your asset register.');
      router.push('/auth#signup');
      return;
    }

    setSaveChoiceMethod(null);
    setSaveChoiceOpen(true);
    setMessage('');
  }

  async function handleConfirmSave() {
    if (!result || !saveChoiceMethod || !condition) {
      setMessage('Choose which number should be saved first.');
      return;
    }

    const value = getMethodValue(result, saveChoiceMethod);

    if (value === null) {
      setMessage('That method is not available for this tractor profile.');
      return;
    }

    setSaveLoading(true);

    try {
      const response = await fetch('/api/valuation-runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: result.model.id,
          year: activeYear,
          hours: Number(hours),
          condition,
          frontPto,
          frontLoader,
          gpsEnabled,
          gpsType,
          gpsYear,
          selectedMethod: saveChoiceMethod,
          valuationVersion: 'v1',
        }),
      });

      const data = (await response.json()) as SaveValuationRunApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to save to asset register.');
      }

      setSelectedMethod(saveChoiceMethod);
      setSaveChoiceOpen(false);
      setMessage(
        data.warning ? `Saved to asset register. ${data.warning}` : 'Saved to asset register.',
      );

      router.push('/asset-register');
    } catch (error) {
      console.error('Failed to save valuation run to /api/valuation-runs', error);
      setMessage(error instanceof Error ? error.message : 'Failed to save to asset register.');
    } finally {
      setSaveLoading(false);
    }
  }

  function handlePrint() {
    if (!result || typeof window === 'undefined') return;
    window.print();
  }

  function handleMethodSelect(method: MethodKey) {
    if (!result) return;

    const value = getMethodValue(result, method);
    if (value === null) return;

    setSelectedMethod(method);
    setMessage('');
  }

  function renderWizardBody() {
    if (step === 1) {
      const isTractorSelected = selectedType === 'tractor';

      return (
        <div className={styles.typePicker}>
          <button type="button" className={styles.typeArrow} aria-label="Previous equipment type" disabled>
            ‹
          </button>

          <button
            type="button"
            className={`${styles.typeCard} ${styles.typePickerCard} ${
              isTractorSelected ? styles.typeCardActive : ''
            }`}
            onClick={() => {
              setSelectedType('tractor');
              setMessage('');
            }}
            aria-pressed={isTractorSelected}
          >
            <div className={styles.typeImageBox}>
              <Image
                src="/brand/Tractor.png"
                alt="Tractor equipment type"
                fill
                className={styles.typeImage}
                sizes="220px"
              />
            </div>
            <strong>Tractor</strong>
          </button>

          <button type="button" className={styles.typeArrow} aria-label="Next equipment type" disabled>
            ›
          </button>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className={styles.searchWrap}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Choose Brand</span>

            <div className={styles.dropdownField} ref={brandDropdownRef}>
              <button
                type="button"
                className={`${styles.dropdownTrigger} ${brandDropdownOpen ? styles.dropdownTriggerOpen : ''}`}
                onClick={() => {
                  setBrandDropdownOpen((open) => !open);
                  setMessage('');
                }}
                aria-haspopup="listbox"
                aria-expanded={brandDropdownOpen}
                aria-label="Choose tractor brand"
                disabled={brandsLoading || !sortedBrands.length}
              >
                <span className={styles.dropdownTriggerText}>
                  {brandsLoading ? 'Loading brands...' : selectedBrandName}
                </span>
                <span className={styles.dropdownTriggerIcon} aria-hidden="true">
                  {brandDropdownOpen ? '▴' : '▾'}
                </span>
              </button>

              {brandDropdownOpen ? (
                <div className={styles.dropdownMenu}>
                  <div className={styles.dropdownSearchWrap}>
                    <input
                      ref={brandSearchInputRef}
                      value={brandSearch}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setBrandSearch(event.target.value)}
                      placeholder="Search brand..."
                      aria-label="Search brands"
                      className={styles.dropdownSearchInput}
                    />
                  </div>

                  <div className={styles.dropdownList} role="listbox" aria-label="Available tractor brands">
                    {brandsLoading ? (
                      <div className={styles.dropdownEmpty}>Loading brands...</div>
                    ) : filteredBrandOptions.length ? (
                      filteredBrandOptions.map((brand) => {
                        const active = brand.slug === brandSlug;

                        return (
                          <button
                            key={brand.slug}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={`${styles.dropdownOption} ${active ? styles.dropdownOptionActive : ''}`}
                            onClick={() => {
                              const brandChanged = brand.slug !== brandSlug;

                              setBrandSlug(brand.slug);

                              if (brandChanged) {
                                setTractorType(null);
                                setDrive(null);
                                setCab(null);
                                setModelId('');
                                setModelQuery('');
                                resetDetailState();
                              }

                              setBrandDropdownOpen(false);
                              setBrandSearch('');
                              setMessage('');
                            }}
                          >
                            <span className={styles.dropdownOptionText}>{brand.name}</span>
                            {active ? <span className={styles.dropdownOptionBadge}>Selected</span> : null}
                          </button>
                        );
                      })
                    ) : (
                      <div className={styles.dropdownEmpty}>
                        {sortedBrands.length ? `No brands matched “${brandSearch.trim()}”.` : 'No brands loaded yet.'}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    if (step === 3) {
      const configRows = [
        tractorType
          ? { key: 'type' as ConfigStepKey, label: 'Type', value: getTractorTypeLabel(tractorType) }
          : null,
        drive ? { key: 'drive' as ConfigStepKey, label: 'Drive', value: getDriveDisplay(drive) } : null,
        cab ? { key: 'cab' as ConfigStepKey, label: 'Cab', value: getCabDisplay(cab) } : null,
        selectedModel
          ? {
              key: 'model' as ConfigStepKey,
              label: 'Model',
              value: `${selectedModel.brandName} ${selectedModel.modelName}`,
            }
          : null,
      ].filter(
        (
          row,
        ): row is {
          key: ConfigStepKey;
          label: string;
          value: string;
        } => Boolean(row),
      );

      const configReviewMode = configComplete && configFocus === null;
      const emptySearchMessage = matchingModels.length
        ? `No models match “${modelQuery.trim()}”.`
        : drive === 'tracks'
          ? `No ${selectedBrandName} track models are loaded yet.`
          : 'No models are loaded for this setup yet.';

      return (
        <div className={styles.flowShell}>
          <div className={styles.flowTopline}>
            <span className={styles.flowToplineLabel}>Brand</span>
            <strong className={styles.flowToplineValue}>{selectedBrandName}</strong>
          </div>

          <div className={styles.miniStepper} aria-label="Model setup progress">
            {CONFIG_STEPS.map((item) => {
              const complete =
                item.key === 'type'
                  ? Boolean(tractorType)
                  : item.key === 'drive'
                    ? Boolean(drive)
                    : item.key === 'cab'
                      ? Boolean(cab)
                      : Boolean(selectedModel);
              const active = !configReviewMode && activeConfigStep === item.key;

              return (
                <div
                  key={item.key}
                  className={`${styles.miniStep} ${active ? styles.miniStepActive : ''} ${
                    complete ? styles.miniStepComplete : ''
                  }`}
                >
                  <span className={styles.miniStepNumber}>
                    {complete ? '✓' : CONFIG_STEPS.findIndex((stepItem) => stepItem.key === item.key) + 1}
                  </span>
                  <span className={styles.miniStepLabel}>{item.label}</span>
                </div>
              );
            })}
          </div>

          {configRows.length ? (
            <div className={styles.answerStack}>
              {configRows.map((row) => (
                <div key={row.key} className={styles.answerRow}>
                  <div className={styles.answerRowText}>
                    <span className={styles.answerRowLabel}>{row.label}</span>
                    <strong className={styles.answerRowValue}>{row.value}</strong>
                  </div>

                  <button
                    type="button"
                    className={styles.answerEdit}
                    onClick={() => {
                      setConfigFocus(row.key);
                      setMessage('');
                    }}
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {configReviewMode ? (
            <div className={`${styles.currentCard} ${styles.readyCard}`}>
              <div className={styles.currentCardHead}>
                <div>
                  <span className={styles.currentEyebrow}>Ready</span>
                  <h2 className={styles.currentTitle}>Model selected</h2>
                </div>
                <span className={styles.currentIndex}>4 / 4</span>
              </div>

              {selectedModel ? (
                <div className={styles.readyModelBlock}>
                  <strong className={styles.readyModelTitle}>
                    {selectedModel.brandName} {selectedModel.modelName}
                  </strong>

                  <div className={styles.selectionChipRow}>
                    <span className={styles.modelChip}>{getTractorTypeLabel(selectedModel.tractorType)}</span>
                    <span className={styles.modelChip}>{getDriveDisplay(selectedModel.drive)}</span>
                    <span className={styles.modelChip}>{getCabDisplay(selectedModel.cab)}</span>
                    <span className={styles.modelChip}>{selectedModel.powerKw} kW</span>
                    <span className={styles.modelChip}>
                      {selectedModel.yearStart}–{selectedModel.yearEnd}
                    </span>
                  </div>
                </div>
              ) : null}

              <p className={styles.currentHint}>Continue to enter year, hours, condition and extras.</p>
            </div>
          ) : activeConfigStep === 'type' ? (
            <div className={styles.currentCard}>
              <div className={styles.currentCardHead}>
                <div>
                  <span className={styles.currentEyebrow}>Now</span>
                  <h2 className={styles.currentTitle}>Field or orchard?</h2>
                </div>
                <span className={styles.currentIndex}>{configStepNumber} / 4</span>
              </div>

              <div className={styles.choiceGrid}>
                {([
                  { key: 'field' as TractorType, title: 'Field', note: 'Broad-acre / row crop' },
                  { key: 'orchard' as TractorType, title: 'Orchard', note: 'Orchard / vineyard' },
                ]).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`${styles.choiceCard} ${tractorType === item.key ? styles.choiceCardActive : ''}`}
                    onClick={() => {
                      const changed = tractorType !== item.key;

                      setTractorType(item.key);
                      setMessage('');

                      if (changed) {
                        setDrive(null);
                        setCab(null);
                        setModelId('');
                        setModelQuery('');
                        resetDetailState();
                      }

                      setConfigFocus('drive');
                    }}
                    aria-pressed={tractorType === item.key}
                  >
                    <strong>{item.title}</strong>
                    <span className={styles.choiceCardNote}>{item.note}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : activeConfigStep === 'drive' ? (
            <div className={styles.currentCard}>
              <div className={styles.currentCardHead}>
                <div>
                  <span className={styles.currentEyebrow}>Now</span>
                  <h2 className={styles.currentTitle}>Choose drive</h2>
                </div>
                <span className={styles.currentIndex}>{configStepNumber} / 4</span>
              </div>

              <div className={styles.choiceGrid}>
                {([
                  { key: '2wd' as DriveType, title: '2WD', note: 'Two-wheel drive' },
                  { key: '4wd' as DriveType, title: '4WD', note: 'Four-wheel drive' },
                  { key: 'tracks' as DriveType, title: 'Tracks', note: 'Tracked tractor' },
                ]).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`${styles.choiceCard} ${drive === item.key ? styles.choiceCardActive : ''}`}
                    onClick={() => {
                      const changed = drive !== item.key;

                      setDrive(item.key);
                      setMessage('');

                      if (changed) {
                        setCab(null);
                        setModelId('');
                        setModelQuery('');
                        resetDetailState();
                      }

                      setConfigFocus('cab');
                    }}
                    aria-pressed={drive === item.key}
                  >
                    <strong>{item.title}</strong>
                    <span className={styles.choiceCardNote}>{item.note}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : activeConfigStep === 'cab' ? (
            <div className={styles.currentCard}>
              <div className={styles.currentCardHead}>
                <div>
                  <span className={styles.currentEyebrow}>Now</span>
                  <h2 className={styles.currentTitle}>Choose cab</h2>
                </div>
                <span className={styles.currentIndex}>{configStepNumber} / 4</span>
              </div>

              <div className={styles.choiceGrid}>
                {([
                  { key: 'cab' as CabType, title: 'Cab', note: 'Enclosed operator cab' },
                  { key: 'open-station' as CabType, title: 'Open station', note: 'No enclosed cab' },
                ]).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`${styles.choiceCard} ${cab === item.key ? styles.choiceCardActive : ''}`}
                    onClick={() => {
                      const changed = cab !== item.key;

                      setCab(item.key);
                      setMessage('');

                      if (changed) {
                        setModelId('');
                        setModelQuery('');
                        resetDetailState();
                      }

                      setConfigFocus('model');
                    }}
                    aria-pressed={cab === item.key}
                  >
                    <strong>{item.title}</strong>
                    <span className={styles.choiceCardNote}>{item.note}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.currentCard}>
              <div className={styles.currentCardHead}>
                <div>
                  <span className={styles.currentEyebrow}>Now</span>
                  <h2 className={styles.currentTitle}>Choose model</h2>
                </div>
                <span className={styles.currentIndex}>{configStepNumber} / 4</span>
              </div>

              <div className={styles.selectionChipRow} style={{ marginBottom: '0.95rem' }}>
                {tractorType ? <span className={styles.modelChip}>{getTractorTypeLabel(tractorType)}</span> : null}
                {drive ? <span className={styles.modelChip}>{getDriveDisplay(drive)}</span> : null}
                {cab ? <span className={styles.modelChip}>{getCabDisplay(cab)}</span> : null}
              </div>

              <div className={styles.searchWrap}>
                <input
                  value={modelQuery}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setModelQuery(event.target.value);
                    setMessage('');
                  }}
                  placeholder={`Search ${selectedBrandName} models`}
                  aria-label="Search tractor models"
                  className={styles.searchInput}
                  disabled={modelsLoading}
                />
              </div>

              {selectedModel ? (
                <div className={styles.selectedCallout}>
                  <span className={styles.currentEyebrow}>Selected</span>
                  <strong className={styles.selectedCalloutTitle}>
                    {selectedModel.brandName} {selectedModel.modelName}
                  </strong>
                  <span className={styles.selectedCalloutBody}>Choose a different model below if needed.</span>
                </div>
              ) : null}

              {modelsLoading ? (
                <div className={styles.emptyState}>
                  <p>Loading models...</p>
                </div>
              ) : filteredModels.length ? (
                <>
                  <div className={styles.currentCount}>
                    {filteredModels.length} model{filteredModels.length === 1 ? '' : 's'} found
                  </div>

                  <div className={styles.modelList}>
                    {filteredModels.map((model) => {
                      const active = selectedModel?.id === model.id;

                      return (
                        <button
                          key={model.id}
                          type="button"
                          className={`${styles.modelRow} ${active ? styles.modelRowActive : ''}`}
                          onClick={() => {
                            const changed = model.id !== modelId;

                            if (changed) {
                              setModelId(model.id);
                              resetDetailState();
                            }

                            setConfigFocus(null);
                            setMessage('');
                          }}
                          aria-pressed={active}
                        >
                          <div className={styles.modelRowBody}>
                            <div className={styles.modelRowHeader}>
                              <strong>
                                {model.brandName} {model.modelName}
                              </strong>
                              {active ? <span className={styles.modelRowSelectedBadge}>Selected</span> : null}
                            </div>

                            <div className={styles.modelChipRow}>
                              <span className={styles.modelChip}>{getTractorTypeLabel(model.tractorType)}</span>
                              <span className={styles.modelChip}>{getDriveDisplay(model.drive)}</span>
                              <span className={styles.modelChip}>{getCabDisplay(model.cab)}</span>
                              <span className={styles.modelChip}>{model.powerKw} kW</span>
                            </div>
                          </div>

                          <span className={styles.modelRowYear}>
                            {model.yearStart}–{model.yearEnd}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className={styles.emptyState}>
                  <p>{emptySearchMessage}</p>
                  {modelQuery.trim() ? (
                    <div className={styles.emptyStateActions}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => setModelQuery('')}
                      >
                        Clear search
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    const detailRows = [
      yearConfirmed ? { key: 'year' as DetailsStepKey, label: 'Year', value: selectedYearDisplay } : null,
      hoursConfirmed ? { key: 'hours' as DetailsStepKey, label: 'Hours', value: enteredHoursDisplay } : null,
      condition ? { key: 'condition' as DetailsStepKey, label: 'Condition', value: conditionLabel(condition) } : null,
      extrasReviewed ? { key: 'extras' as DetailsStepKey, label: 'Extras', value: extrasSummaryText } : null,
    ].filter(
      (
        row,
      ): row is {
        key: DetailsStepKey;
        label: string;
        value: string;
      } => Boolean(row),
    );

    const detailsReviewMode = detailsComplete && detailsFocus === null;

    return (
      <div className={styles.flowShell}>
        {selectedModel ? (
          <div className={styles.focusContext}>
            <span className={styles.flowToplineLabel}>Model</span>
            <strong className={styles.flowToplineValue}>
              {selectedModel.brandName} {selectedModel.modelName}
            </strong>
            <div className={styles.selectionChipRow}>
              <span className={styles.modelChip}>{getTractorTypeLabel(selectedModel.tractorType)}</span>
              <span className={styles.modelChip}>{getDriveDisplay(selectedModel.drive)}</span>
              <span className={styles.modelChip}>{getCabDisplay(selectedModel.cab)}</span>
              <span className={styles.modelChip}>{selectedModel.powerKw} kW</span>
              <span className={styles.modelChip}>
                {selectedModel.yearStart}–{selectedModel.yearEnd}
              </span>
            </div>
          </div>
        ) : null}

        <div className={styles.miniStepper} aria-label="Details progress">
          {DETAILS_STEPS.map((item) => {
            const complete =
              item.key === 'year'
                ? yearConfirmed
                : item.key === 'hours'
                  ? hoursConfirmed
                  : item.key === 'condition'
                    ? Boolean(condition)
                    : extrasReviewed;
            const active = !detailsReviewMode && activeDetailsStep === item.key;

            return (
              <div
                key={item.key}
                className={`${styles.miniStep} ${active ? styles.miniStepActive : ''} ${
                  complete ? styles.miniStepComplete : ''
                }`}
              >
                <span className={styles.miniStepNumber}>
                  {complete ? '✓' : DETAILS_STEPS.findIndex((stepItem) => stepItem.key === item.key) + 1}
                </span>
                <span className={styles.miniStepLabel}>{item.label}</span>
              </div>
            );
          })}
        </div>

        {detailRows.length ? (
          <div className={styles.answerStack}>
            {detailRows.map((row) => (
              <div key={row.key} className={styles.answerRow}>
                <div className={styles.answerRowText}>
                  <span className={styles.answerRowLabel}>{row.label}</span>
                  <strong className={styles.answerRowValue}>{row.value}</strong>
                </div>

                <button
                  type="button"
                  className={styles.answerEdit}
                  onClick={() => {
                    setDetailsFocus(row.key);
                    setMessage('');
                  }}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {detailsReviewMode ? (
          <div className={`${styles.currentCard} ${styles.readyCard}`}>
            <div className={styles.currentCardHead}>
              <div>
                <span className={styles.currentEyebrow}>Ready</span>
                <h2 className={styles.currentTitle}>Get valuation</h2>
              </div>
              <span className={styles.currentIndex}>4 / 4</span>
            </div>

            <div className={styles.selectionFacts}>
              <div className={styles.selectionFact}>
                <span>Year</span>
                <strong>{selectedYearDisplay}</strong>
              </div>

              <div className={styles.selectionFact}>
                <span>Hours</span>
                <strong>{enteredHoursDisplay}</strong>
              </div>

              <div className={styles.selectionFact}>
                <span>Condition</span>
                <strong>{selectedConditionDisplay}</strong>
              </div>

              <div className={styles.selectionFact}>
                <span>Extras</span>
                <strong>{extrasSummaryText}</strong>
              </div>
            </div>
          </div>
        ) : activeDetailsStep === 'year' ? (
          <div className={styles.currentCard}>
            <div className={styles.currentCardHead}>
              <div>
                <span className={styles.currentEyebrow}>Now</span>
                <h2 className={styles.currentTitle}>Choose year</h2>
              </div>
              <span className={styles.currentIndex}>{activeDetailsStepNumber} / 4</span>
            </div>

            <div className={styles.segmentRail}>
              <button
                type="button"
                className={`${styles.pillButton} ${yearMode === 'guided' ? styles.pillButtonActive : ''}`}
                onClick={() => {
                  setYearMode('guided');
                  setYearDropdownOpen(false);
                  setYearConfirmed(false);
                  setMessage('');
                  invalidateResult();
                }}
                aria-pressed={yearMode === 'guided'}
              >
                Guided years
              </button>
              <button
                type="button"
                className={`${styles.pillButton} ${yearMode === 'manual' ? styles.pillButtonActive : ''}`}
                onClick={() => {
                  setYearMode('manual');
                  if (year !== null) {
                    setManualYear(String(year));
                  }
                  setYearDropdownOpen(false);
                  setYearConfirmed(false);
                  setMessage('');
                  invalidateResult();
                }}
                aria-pressed={yearMode === 'manual'}
              >
                Other year
              </button>
            </div>

            {yearMode === 'guided' ? (
              <div className={styles.inlineFieldRow}>
                <div className={styles.dropdownField} ref={yearDropdownRef}>
                  <button
                    type="button"
                    className={`${styles.dropdownTrigger} ${yearDropdownOpen ? styles.dropdownTriggerOpen : ''}`}
                    onClick={() => {
                      if (!selectedModel) return;
                      setYearDropdownOpen((open) => !open);
                      setMessage('');
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={yearDropdownOpen}
                    aria-label="Choose guided year model"
                  >
                    <span className={styles.dropdownTriggerText}>{selectedYearDisplay}</span>
                    <span className={styles.dropdownTriggerIcon} aria-hidden="true">
                      {yearDropdownOpen ? '▴' : '▾'}
                    </span>
                  </button>

                  {yearDropdownOpen ? (
                    <div className={styles.dropdownMenu}>
                      <div className={styles.dropdownList} role="listbox" aria-label="Available guided years">
                        {years.length ? (
                          years.map((availableYear) => {
                            const active = year === availableYear;

                            return (
                              <button
                                key={availableYear}
                                type="button"
                                role="option"
                                aria-selected={active}
                                className={`${styles.dropdownOption} ${active ? styles.dropdownOptionActive : ''}`}
                                onClick={() => {
                                  setYear(availableYear);
                                  setYearDropdownOpen(false);
                                  setYearConfirmed(false);
                                  setMessage('');
                                  invalidateResult();
                                }}
                              >
                                <span className={styles.dropdownOptionText}>{availableYear}</span>
                                {active ? <span className={styles.dropdownOptionBadge}>Selected</span> : null}
                              </button>
                            );
                          })
                        ) : (
                          <div className={styles.dropdownEmpty}>No guided years loaded for this model yet.</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={confirmYearSelection}
                  disabled={!isYearValid}
                >
                  Next: Hours
                </button>
              </div>
            ) : (
              <div className={styles.inlineFieldRow}>
                <input
                  value={manualYear}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setManualYear(event.target.value.replace(/[^0-9]/g, '').slice(0, 4));
                    setYearConfirmed(false);
                    setMessage('');
                    invalidateResult();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      confirmYearSelection();
                    }
                  }}
                  placeholder="Type year"
                  inputMode="numeric"
                  aria-label="Enter year model manually"
                  className={styles.controlInput}
                />

                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={confirmYearSelection}
                  disabled={!isYearValid}
                >
                  Next: Hours
                </button>
              </div>
            )}

            {selectedModel ? (
              <p className={styles.currentHint}>Guided range: {selectedModel.yearStart}–{selectedModel.yearEnd}</p>
            ) : null}
          </div>
        ) : activeDetailsStep === 'hours' ? (
          <div className={styles.currentCard}>
            <div className={styles.currentCardHead}>
              <div>
                <span className={styles.currentEyebrow}>Now</span>
                <h2 className={styles.currentTitle}>Enter engine hours</h2>
              </div>
              <span className={styles.currentIndex}>{activeDetailsStepNumber} / 4</span>
            </div>

            <div className={styles.inlineFieldRow}>
              <div className={styles.inlineFieldInputWrap}>
                <input
                  value={hours}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setHours(event.target.value.replace(/[^0-9]/g, ''));
                    setHoursConfirmed(false);
                    setMessage('');
                    invalidateResult();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      confirmHoursSelection();
                    }
                  }}
                  placeholder="Type hours"
                  inputMode="numeric"
                  aria-label="Enter engine hours"
                  className={styles.controlInput}
                />
                <span className={styles.inlineFieldSuffix}>hrs</span>
              </div>

              <button
                type="button"
                className={styles.primaryButton}
                onClick={confirmHoursSelection}
                disabled={!isHoursValid}
              >
                Next: Condition
              </button>
            </div>

            <p className={styles.currentHint}>Use the meter reading.</p>
          </div>
        ) : activeDetailsStep === 'condition' ? (
          <div className={styles.currentCard}>
            <div className={styles.currentCardHead}>
              <div>
                <span className={styles.currentEyebrow}>Now</span>
                <h2 className={styles.currentTitle}>Choose condition</h2>
              </div>
              <span className={styles.currentIndex}>{activeDetailsStepNumber} / 4</span>
            </div>

            <div className={styles.conditionGrid}>
              {conditionOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`${styles.conditionCard} ${condition === option.key ? styles.conditionCardActive : ''}`}
                  onClick={() => {
                    setCondition(option.key);
                    setDetailsFocus(null);
                    setMessage('');
                    invalidateResult();
                  }}
                >
                  <strong>{option.label}</strong>
                  <span>{getConditionHint(option.key)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.currentCard}>
            <div className={styles.currentCardHead}>
              <div>
                <span className={styles.currentEyebrow}>Now</span>
                <h2 className={styles.currentTitle}>Review extras</h2>
              </div>
              <span className={styles.currentIndex}>{activeDetailsStepNumber} / 4</span>
            </div>

            <div className={styles.togglePanelGrid}>
              <div className={styles.togglePanel}>
                <div className={styles.togglePanelCopy}>
                  <strong className={styles.togglePanelTitle}>Front Hitch & Front PTO</strong>
                  <span className={styles.togglePanelNote}>Installed?</span>
                </div>
                <div className={styles.pillRow}>
                  <button
                    type="button"
                    className={`${styles.pillButton} ${frontPto ? styles.pillButtonActive : ''}`}
                    onClick={() => {
                      setFrontPto(true);
                      setMessage('');
                      markExtrasDirty();
                    }}
                    aria-pressed={frontPto}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`${styles.pillButton} ${!frontPto ? styles.pillButtonActive : ''}`}
                    onClick={() => {
                      setFrontPto(false);
                      setMessage('');
                      markExtrasDirty();
                    }}
                    aria-pressed={!frontPto}
                  >
                    No
                  </button>
                </div>
              </div>

              <div className={styles.togglePanel}>
                <div className={styles.togglePanelCopy}>
                  <strong className={styles.togglePanelTitle}>Front Loader</strong>
                  <span className={styles.togglePanelNote}>Installed?</span>
                </div>
                <div className={styles.pillRow}>
                  <button
                    type="button"
                    className={`${styles.pillButton} ${frontLoader ? styles.pillButtonActive : ''}`}
                    onClick={() => {
                      setFrontLoader(true);
                      setMessage('');
                      markExtrasDirty();
                    }}
                    aria-pressed={frontLoader}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`${styles.pillButton} ${!frontLoader ? styles.pillButtonActive : ''}`}
                    onClick={() => {
                      setFrontLoader(false);
                      setMessage('');
                      markExtrasDirty();
                    }}
                    aria-pressed={!frontLoader}
                  >
                    No
                  </button>
                </div>
              </div>

              <div className={styles.togglePanel}>
                <div className={styles.togglePanelCopy}>
                  <strong className={styles.togglePanelTitle}>GPS</strong>
                  <span className={styles.togglePanelNote}>Installed?</span>
                </div>
                <div className={styles.pillRow}>
                  <button
                    type="button"
                    className={`${styles.pillButton} ${gpsEnabled ? styles.pillButtonActive : ''}`}
                    onClick={() => {
                      setGpsEnabled(true);
                      setMessage('');
                      markExtrasDirty();
                    }}
                    aria-pressed={gpsEnabled}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`${styles.pillButton} ${!gpsEnabled ? styles.pillButtonActive : ''}`}
                    onClick={() => {
                      setGpsEnabled(false);
                      setMessage('');
                      markExtrasDirty();
                    }}
                    aria-pressed={!gpsEnabled}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            {gpsEnabled ? (
              <div className={styles.gpsDetailGrid}>
                <div className={styles.togglePanel}>
                  <div className={styles.togglePanelCopy}>
                    <strong className={styles.togglePanelTitle}>GPS type</strong>
                    <span className={styles.togglePanelNote}>Optional</span>
                  </div>
                  <div className={styles.pillRow}>
                    {(['full-autosteer', 'guidance-only'] as GpsType[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`${styles.pillButton} ${gpsType === value ? styles.pillButtonActive : ''}`}
                        onClick={() => {
                          setGpsType(value);
                          setMessage('');
                          markExtrasDirty();
                        }}
                        aria-pressed={gpsType === value}
                      >
                        {getGpsTypeLabel(value)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.togglePanel}>
                  <div className={styles.togglePanelCopy}>
                    <strong className={styles.togglePanelTitle}>GPS year</strong>
                    <span className={styles.togglePanelNote}>Optional</span>
                  </div>
                  <input
                    value={gpsYear}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setGpsYear(event.target.value.replace(/[^0-9]/g, '').slice(0, 4));
                      setMessage('');
                      markExtrasDirty();
                    }}
                    placeholder="Type year"
                    inputMode="numeric"
                    aria-label="Enter GPS year"
                    className={styles.controlInput}
                  />
                </div>
              </div>
            ) : null}

            <div className={styles.selectionChipRow} style={{ marginTop: '1rem' }}>
              {extrasSummaryChips.map((chip) => (
                <span key={chip} className={styles.modelChip}>
                  {chip}
                </span>
              ))}
            </div>

            <div className={styles.currentCardActions}>
              <button type="button" className={styles.secondaryButton} onClick={clearExtrasSelection}>
                No fitted extras
              </button>
              <button type="button" className={styles.primaryButton} onClick={applyExtrasSelection}>
                Save extras
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <main className={styles.page}>
        <AppHeader active="valuation" ctaHref="/asset-register" ctaLabel="Asset Register" />

        <div className={styles.container}>
          {step !== 5 ? (
            <>
              <section className={styles.heroIntro}>
                <div className={styles.heroIntroContent}>
                  <span className={styles.heroBadge}>Valuation</span>
                  <h1 className={styles.heroIntroTitle}>Know what your machinery is worth.</h1>
                  <p className={styles.heroIntroText}>
                    Move from equipment setup to a clean, data-backed value output with a simple guided flow.
                  </p>
                  {!isSignedIn ? (
                    <p className={styles.heroIntroText}>
                      Free guest valuations remaining: {freeGuestValuationsRemaining} / 3
                    </p>
                  ) : null}
                </div>
              </section>

              <section className={styles.wizardShell}>
                <article className={styles.wizardCard}>
                  <div className={styles.wizardHeader}>
                    <div className={styles.stepper}>
                      {WIZARD_STEPS.map((item, index) => {
                        const isActive = step === item.step;
                        const isComplete = step > item.step;

                        return (
                          <div
                            key={item.step}
                            className={`${styles.stepperItem} ${isActive ? styles.stepperItemActive : ''} ${
                              isComplete ? styles.stepperItemComplete : ''
                            }`}
                          >
                            <span
                              className={`${styles.stepperBullet} ${
                                isActive ? styles.stepperBulletActive : ''
                              } ${isComplete ? styles.stepperBulletComplete : ''}`}
                            >
                              {isComplete ? '✓' : item.step}
                            </span>
                            <span
                              className={`${styles.stepperLabel} ${isActive ? styles.stepperLabelActive : ''} ${
                                isComplete ? styles.stepperLabelComplete : ''
                              }`}
                            >
                              {item.label}
                            </span>
                            {index < WIZARD_STEPS.length - 1 ? (
                              <span
                                className={`${styles.stepperLine} ${step > item.step ? styles.stepperLineComplete : ''}`}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.stepContent}>
                    <h1 className={styles.stepTitle}>{stepMeta.title}</h1>
                    <p className={styles.stepText}>{stepMeta.body}</p>

                    {message ? <div className={styles.message}>{message}</div> : null}

                    {renderWizardBody()}
                  </div>

                  <div className={styles.wizardFooter}>
                    <button type="button" className={styles.secondaryButton} onClick={handleBack}>
                      {step === 1 ? 'Back Home' : 'Back'}
                    </button>

                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={handleNext}
                      disabled={!canContinue || valuationLoading}
                    >
                      {nextLabel}
                    </button>
                  </div>
                </article>
              </section>
            </>
          ) : result ? (
            <section className={styles.resultsLayout}>
              <div className={styles.resultsMain}>
                <div className={styles.resultsTopbar}>
                  <button type="button" className={styles.backLink} onClick={() => setStep(4)}>
                    ← Back to search
                  </button>
                  <span className={styles.statusBadge}>Valuation complete</span>
                </div>

                {message ? <div className={styles.message}>{message}</div> : null}

                <article className={styles.heroCard}>
                  <div className={styles.heroTop}>
                    <div className={styles.heroIdentity}>
                      <div className={styles.heroImageBox}>
                        <Image
                          src="/brand/Tractor.png"
                          alt="Valuation result tractor"
                          fill
                          className={styles.typeImage}
                          sizes="132px"
                        />
                      </div>

                      <div className={styles.heroInfo}>
                        <h1 className={styles.resultTitle}>
                          {result.model.brandName} {result.model.modelName}
                        </h1>
                        <p className={styles.heroMeta}>
                          {getTractorTypeLabel(result.model.tractorType)} tractor • {getDriveDisplay(result.model.drive)} •{' '}
                          {getCabDisplay(result.model.cab)} • {activeYear} • {result.model.powerKw} kW •{' '}
                          {Number(hours).toLocaleString('en-ZA')} engine hours
                        </p>
                        <button type="button" className={styles.inlineButton} onClick={() => setStep(4)}>
                          Edit Details
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={`${styles.valuePanel} ${confidencePanelClassName}`}>
                    <div className={styles.valuePanelTop}>
                      <div className={styles.valuePanelIntro}>
                        <span className={styles.valueLabel}>{headlineLabel}</span>
                        <div className={styles.valueAmount}>{money(headlineValue)}</div>
                        <p className={styles.valueMeta}>ZAR • South Africa • Excl. VAT (indicative)</p>
                      </div>

                      <span className={`${styles.confidenceBadge} ${confidenceClassName}`}>
                        {getConfidenceLabel(result)}
                      </span>
                    </div>

                    <div className={styles.methodGrid}>
                      {methodCards.map((card) => {
                        const active = selectedMethod === card.key;
                        const unavailable = !card.available;

                        return (
                          <button
                            key={card.key}
                            type="button"
                            className={`${styles.methodButton} ${
                              active ? styles.methodButtonActive : ''
                            } ${unavailable ? styles.methodButtonDisabled : ''}`}
                            onClick={() => handleMethodSelect(card.key)}
                            disabled={unavailable}
                          >
                            <span className={styles.methodTitle}>{card.label}</span>
                            <strong className={styles.methodValue}>
                              {card.key === 'market' ? getMethodDisplay(result, 'market') : money(card.value)}
                            </strong>
                            <span className={styles.methodNote}>{card.note}</span>
                            {active ? <span className={styles.methodState}>Currently displayed</span> : null}
                          </button>
                        );
                      })}
                    </div>

                    <div className={styles.valueHighlightGrid}>
                      <div className={styles.valueHighlightCard}>
                        <span className={styles.valueHighlightLabel}>Selected method</span>
                        <strong className={styles.valueHighlightValue}>{headlineLabel}</strong>
                        <span className={styles.valueHighlightNote}>This is the value currently shown above.</span>
                      </div>

                      <div className={styles.valueHighlightCard}>
                        <span className={styles.valueHighlightLabel}>Market range</span>
                        <strong className={styles.valueHighlightValue}>{range(result.marketLow, result.marketHigh)}</strong>
                        <span className={styles.valueHighlightNote}>
                          {result.marketCount
                            ? `${result.marketCount} provable comparable${result.marketCount === 1 ? '' : 's'} matched.`
                            : 'No provable comparable listings matched yet.'}
                        </span>
                      </div>

                      <div className={styles.valueHighlightCard}>
                        <span className={styles.valueHighlightLabel}>Input summary</span>
                        <strong className={styles.valueHighlightValue}>{selectedConditionDisplay}</strong>
                        <span className={styles.valueHighlightNote}>
                          {activeYear} model • {Number(hours).toLocaleString('en-ZA')} engine hours
                        </span>
                      </div>
                    </div>

                    <p className={styles.valueSupportText}>
                      Compare the methods, then save the price that best fits your sale, internal register, or reporting
                      need.
                    </p>
                  </div>
                </article>

                <article className={styles.assetCard}>
                  <div className={styles.actionHeader}>
                    <div>
                      <h2 className={styles.assetTitle}>Save to Asset Register</h2>
                      <p className={styles.assetText}>
                        Save this valuation to the asset register and create a linked equipment item for the signed-in user.
                      </p>
                    </div>
                    <span className={styles.actionBadge}>Quick actions</span>
                  </div>

                  <div className={styles.actionGrid}>
                    <button
                      type="button"
                      className={`${styles.assetButton} ${styles.actionPrimary}`}
                      onClick={handleSave}
                      disabled={saveLoading}
                    >
                      {saveLoading ? 'Saving...' : 'Save to Asset Register'}
                    </button>

                    <button type="button" className={styles.secondaryButton} onClick={handlePrint}>
                      Download PDF Report
                    </button>

                    <button type="button" className={styles.secondaryButton} onClick={() => setStep(4)}>
                      Refine Inputs
                    </button>

                    <button type="button" className={styles.secondaryButton} onClick={resetWizard}>
                      Start New Valuation
                    </button>
                  </div>
                </article>
              </div>

              <aside className={styles.resultsSide}>
                <article className={`${styles.sideCard} ${styles.summaryCard}`}>
                  <h2 className={styles.sideTitle}>Summary</h2>

                  <div className={styles.breakdownList}>
                    <div className={styles.breakdownRow}>
                      <span className={styles.breakdownKey}>Specification</span>
                      <span className={styles.breakdownValue}>
                        {getTractorTypeLabel(result.model.tractorType)} • {getDriveDisplay(result.model.drive)} •{' '}
                        {getCabDisplay(result.model.cab)}
                      </span>
                    </div>

                    <div className={styles.breakdownRow}>
                      <span className={styles.breakdownKey}>Condition</span>
                      <span className={styles.breakdownValue}>{selectedConditionDisplay}</span>
                    </div>

                    <div className={styles.breakdownRow}>
                      <span className={styles.breakdownKey}>Engine hours</span>
                      <span className={styles.breakdownValue}>
                        {Number(hours).toLocaleString('en-ZA')} engine hours
                      </span>
                    </div>

                    <div className={styles.breakdownRow}>
                      <span className={styles.breakdownKey}>Extras</span>
                      <span className={styles.breakdownValue}>{extrasSummaryText}</span>
                    </div>

                    <div className={styles.breakdownRow}>
                      <span className={styles.breakdownKey}>Displayed value</span>
                      <span className={styles.breakdownValue}>{headlineLabel}</span>
                    </div>

                    <div className={styles.breakdownRow}>
                      <span className={styles.breakdownKey}>Confidence</span>
                      <span className={styles.breakdownValue}>
                        <span className={`${styles.summaryConfidenceBadge} ${confidenceClassName}`}>
                          {getConfidenceLabel(result)}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className={styles.summaryTip}>
                    Adjust the year, hours, condition, or fitted extras at any time to fine-tune this result.
                  </div>
                </article>

                <article className={`${styles.sideCard} ${styles.marketCard}`}>
                  <div className={styles.rangeCardHead}>
                    <h2 className={styles.sideTitle}>Market Range</h2>
                    <span className={styles.rangeBadge}>
                      {result.marketCount} provable listing{result.marketCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className={styles.rangeCurrentWrap}>
                    <div className={styles.rangeCurrentLabel}>Selected comparable</div>
                    <div className={styles.rangeCurrent}>{money(selectedComparableValue)}</div>
                    <p className={styles.rangeCurrentMeta}>
                      {selectedComparable
                        ? `${selectedComparable.yearModel} • ${selectedComparable.hours.toLocaleString('en-ZA')} engine hours • ${selectedComparable.sourceName}`
                        : `Based on comparable ${activeYear} market listings.`}
                    </p>

                    {selectedComparable ? (
                      selectedComparableSourceUrl ? (
                        <div className={styles.rangeCurrentLinkBlock}>
                          <span className={styles.rangeCurrentLinkLabel}>Selected source URL</span>
                          <a
                            href={selectedComparableSourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.rangeCurrentLink}
                            title={selectedComparableSourceUrl}
                          >
                            {getSourceLinkLabel(selectedComparableSourceUrl)}
                          </a>
                        </div>
                      ) : (
                        <p className={styles.rangeCurrentLinkEmpty}>
                          Attach a source URL to this comparable in the market listing library to show the live
                          listing here.
                        </p>
                      )
                    ) : null}
                  </div>

                  <div className={styles.rangeInteractive}>
                    <div className={styles.rangeTrack}>
                      <div className={styles.rangeFill} style={{ width: `${selectedComparablePercent}%` }} />
                      <div className={styles.rangePin} style={{ left: `${selectedComparablePercent}%` }} />
                    </div>

                    {comparableListings.length > 1 ? (
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, comparableListings.length - 1)}
                        step={1}
                        value={safeComparableIndex}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setSelectedComparableIndex(Number(event.target.value))
                        }
                        className={styles.rangeSliderInput}
                        aria-label="Browse provable market listings"
                      />
                    ) : null}
                  </div>

                  <div className={styles.rangeLabels}>
                    <span>{money(result.marketLow)}</span>
                    <span>{money(result.marketHigh)}</span>
                  </div>

                  <div className={styles.marketListingsBlock}>
                    <div className={styles.marketListingsHead}>
                      <h3 className={styles.marketListingsTitle}>Proveable Market Listings</h3>
                      {comparableListings.length ? (
                        <span className={styles.marketListingsCount}>
                          {safeComparableIndex + 1} / {comparableListings.length}
                        </span>
                      ) : null}
                    </div>

                    {comparableListings.length ? (
                      <div className={styles.listingList}>
                        {comparableListings.map((listing, index) => {
                          const isActive = index === safeComparableIndex;
                          const comparableValue = getListingComparablePrice(listing, result.extrasValueExVat);

                          return (
                            <article
                              key={listing.id}
                              className={`${styles.listingCard} ${isActive ? styles.listingCardActive : ''}`}
                            >
                              <button
                                type="button"
                                className={styles.listingSelectButton}
                                onClick={() => setSelectedComparableIndex(index)}
                              >
                                <div className={styles.listingCardTop}>
                                  <strong className={styles.listingCardValue}>{money(comparableValue)}</strong>
                                  <span className={styles.listingCardSource}>{listing.sourceName}</span>
                                </div>

                                <div className={styles.listingCardMeta}>
                                  <span className={styles.listingMetaChip}>{listing.yearModel} model</span>
                                  <span className={styles.listingMetaChip}>
                                    {listing.hours.toLocaleString('en-ZA')} engine hours
                                  </span>
                                  <span className={styles.listingMetaChip}>
                                    {listing.area}, {listing.province}
                                  </span>
                                </div>

                                {result.extrasValueExVat > 0 ? (
                                  <div className={styles.listingAdjustmentNote}>
                                    Raw listing {money(getListingBasePrice(listing))} • adjusted for selected extras
                                  </div>
                                ) : null}
                              </button>

                              <div className={styles.listingCardFooter}>
                                <div className={styles.listingCardFooterMeta}>
                                  <span className={styles.listingCardDateLabel}>Advertised</span>
                                  <span className={styles.listingCardDate}>{formatListingDate(listing.dateAdvertised)}</span>
                                </div>

                                {listing.sourceUrl ? (
                                  <a
                                    href={listing.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.listingLink}
                                    title={listing.sourceUrl}
                                  >
                                    {getSourceLinkLabel(listing.sourceUrl)}
                                  </a>
                                ) : (
                                  <span className={styles.listingLinkMuted}>Source URL not yet attached</span>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <p className={styles.rangeNote}>
                        No provable market listings matched this tractor yet. Add more market listings to improve
                        confidence and range quality.
                      </p>
                    )}
                  </div>
                </article>
              </aside>
            </section>
          ) : null}
        </div>
      </main>

      {saveChoiceOpen && result ? (
        <div className={styles.saveModalOverlay} role="presentation">
          <div className={styles.saveModalBackdrop} onClick={() => (!saveLoading ? setSaveChoiceOpen(false) : undefined)} />
          <div
            className={styles.saveModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-valuation-title"
          >
            <div className={styles.saveModalHeader}>
              <div>
                <h2 id="save-valuation-title" className={styles.saveModalTitle}>
                  Choose which price to save
                </h2>
                <p className={styles.saveModalText}>
                  Select one valuation method below. The asset will only be saved after you confirm a single price.
                </p>
              </div>
              <button
                type="button"
                className={styles.saveModalClose}
                onClick={() => setSaveChoiceOpen(false)}
                disabled={saveLoading}
                aria-label="Close save dialog"
              >
                ×
              </button>
            </div>

            <div className={styles.saveMethodGrid}>
              {methodCards.filter((card) => card.available).map((card) => {
                const active = saveChoiceMethod === card.key;

                return (
                  <button
                    key={card.key}
                    type="button"
                    className={`${styles.saveMethodButton} ${active ? styles.saveMethodButtonActive : ''}`}
                    onClick={() => setSaveChoiceMethod(card.key)}
                  >
                    <span className={styles.saveMethodLabel}>{card.label}</span>
                    <strong className={styles.saveMethodValue}>
                      {card.key === 'market' ? getMethodDisplay(result, 'market') : money(card.value)}
                    </strong>
                    <span className={styles.saveMethodNote}>{card.note}</span>
                  </button>
                );
              })}
            </div>

            <div className={styles.saveModalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setSaveChoiceOpen(false)}
                disabled={saveLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleConfirmSave}
                disabled={!saveChoiceMethod || saveLoading}
              >
                {saveLoading ? 'Saving...' : 'Confirm and Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
