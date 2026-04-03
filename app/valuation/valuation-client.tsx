'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';
import {
  brands,
  conditionOptions,
  tractors,
  type CabType,
  type ConditionKey,
  type DriveType,
  type MarketplaceListing,
  type TractorCatalogRow,
  type TractorType,
} from '../../lib/tractor-data';
import { conditionLabel, money, range, runValuation, type Result } from '../../lib/tractor-logic';
import { saveItem } from '../../lib/register';

type Step = 1 | 2 | 3 | 4 | 5;
type MethodKey = 'aim4price' | 'market' | 'department';
type EquipmentType = 'tractor';
type GpsType = 'full-autosteer' | 'guidance-only';
type ModelFlowStage = 'tractorType' | 'drive' | 'cab' | 'model' | 'complete';
type DetailFlowStage = 'year' | 'hours' | 'condition' | 'extras' | 'complete';
type ExtrasDraft = {
  frontPto: boolean;
  frontLoader: boolean;
  gpsEnabled: boolean;
  gpsType: GpsType | null;
  gpsYear: string;
};
type FlowSummaryRowProps = {
  label: string;
  value: string;
  hint?: string;
  onEdit: () => void;
};
type FocusCardProps = {
  stepLabel: string;
  title: string;
  body: string;
  children: ReactNode;
  badgeText?: string;
};

type MethodCard = {
  key: MethodKey;
  label: string;
  note: string;
  value: number | null;
  available: boolean;
};

const CURRENT_YEAR = new Date().getFullYear() + 1;

const WIZARD_STEPS: Array<{ step: Step; label: string }> = [
  { step: 1, label: 'Type' },
  { step: 2, label: 'Brand' },
  { step: 3, label: 'Model' },
  { step: 4, label: 'Details' },
  { step: 5, label: 'Value' },
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
        title: 'Select Tractor Model',
        body: 'Answer one tractor setup question at a time, then choose the closest matching model from the Aim4price catalogue.',
      };
    case 4:
      return {
        title: 'Enter Tractor Details',
        body: 'Enter one tractor detail at a time. Completed answers collapse above the current question so the next action stays obvious.',
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
  const [brandSlug, setBrandSlug] = useState('john-deere');
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
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [frontPto, setFrontPto] = useState(false);
  const [frontLoader, setFrontLoader] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsType, setGpsType] = useState<GpsType | null>(null);
  const [gpsYear, setGpsYear] = useState('');
  const [extrasReviewed, setExtrasReviewed] = useState(false);
  const [extrasDraft, setExtrasDraft] = useState<ExtrasDraft | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<MethodKey | null>(null);
  const [selectedComparableIndex, setSelectedComparableIndex] = useState(0);
  const [message, setMessage] = useState('');

  const stepMeta = getStepMeta(step);
  const brandDropdownRef = useRef<HTMLDivElement | null>(null);
  const brandSearchInputRef = useRef<HTMLInputElement | null>(null);
  const yearDropdownRef = useRef<HTMLDivElement | null>(null);

  const sortedBrands = useMemo(
    () => [...brands].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [],
  );

  const filteredModels = useMemo(() => {
    if (!tractorType || !drive || !cab) return [];

    return tractors.filter((tractor) => {
      const normalizedQuery = modelQuery.trim().toLowerCase();
      const matchesBrand = tractor.brandSlug === brandSlug;
      const matchesType = tractor.tractorType === tractorType;
      const matchesDrive = tractor.drive === drive;
      const matchesCab = tractor.cab === cab;
      const matchesQuery = !normalizedQuery
        ? true
        : `${tractor.brandName} ${tractor.modelName} ${tractor.tractorType} ${tractor.drive} ${tractor.cab}`
            .toLowerCase()
            .includes(normalizedQuery);

      return matchesBrand && matchesType && matchesDrive && matchesCab && matchesQuery;
    });
  }, [brandSlug, tractorType, drive, cab, modelQuery]);

  const selectedModel = useMemo<TractorCatalogRow | null>(
    () => filteredModels.find((model) => model.id === modelId) ?? null,
    [filteredModels, modelId],
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
    setExtrasDraft(null);
    setExtrasOpen(false);
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
    resetExtrasState();
    invalidateResult();
  }

  useEffect(() => {
    if (!filteredModels.length) {
      if (modelId !== '') {
        setModelId('');
      }
      return;
    }

    if (modelId && !filteredModels.some((model) => model.id === modelId)) {
      setModelId('');
    }
  }, [filteredModels, modelId]);

  useEffect(() => {
    if (!selectedModel) {
      setYear(null);
      return;
    }

    if (yearMode === 'guided' && year !== null) {
      if (year < selectedModel.yearStart || year > selectedModel.yearEnd) {
        setYear(null);
      }
    }
  }, [selectedModel, yearMode, year]);

  useEffect(() => {
    if (step !== 2) {
      setBrandDropdownOpen(false);
      setBrandSearch('');
    }

    if (step !== 4) {
      setYearDropdownOpen(false);
      setExtrasOpen(false);
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
    if (!extrasOpen || typeof document === 'undefined') return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [extrasOpen]);

  useEffect(() => {
    if (!brandDropdownOpen && !yearDropdownOpen && !extrasOpen) return;

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
      setExtrasOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [brandDropdownOpen, yearDropdownOpen, extrasOpen]);

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
    () => brands.find((brand) => brand.slug === brandSlug)?.name ?? '—',
    [brandSlug],
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

  const modelFlowStage: ModelFlowStage = !tractorType
    ? 'tractorType'
    : !drive
      ? 'drive'
      : !cab
        ? 'cab'
        : !selectedModel
          ? 'model'
          : 'complete';
  const detailFlowStage: DetailFlowStage = !isYearValid
    ? 'year'
    : !isHoursValid
      ? 'hours'
      : !condition
        ? 'condition'
        : !extrasReviewed
          ? 'extras'
          : 'complete';
  const modelProgressCount = [tractorType, drive, cab, selectedModel].filter(Boolean).length;
  const detailProgressCount = [isYearValid, isHoursValid, condition !== null, extrasReviewed].filter(Boolean).length;

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
        note: `${result.marketCount} proveable market listing${result.marketCount === 1 ? '' : 's'} linked below.`,
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

  const yearUnlocked = Boolean(selectedModel);
  const hoursUnlocked = yearUnlocked && isYearValid;
  const conditionUnlocked = hoursUnlocked && isHoursValid;
  const extrasUnlocked = conditionUnlocked && condition !== null;

  const canContinue = useMemo(() => {
    if (step === 1) return selectedType === 'tractor';
    if (step === 3) return Boolean(selectedModel);
    if (step === 4) return Boolean(selectedModel && isYearValid && isHoursValid && condition && extrasReviewed);
    return true;
  }, [step, selectedType, selectedModel, isYearValid, isHoursValid, condition]);

  const nextLabel =
    step === 1
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
    setBrandSlug('john-deere');
    setBrandDropdownOpen(false);
    setBrandSearch('');
    setTractorType(null);
    setDrive(null);
    setCab(null);
    setModelId('');
    setResult(null);
    setSelectedMethod(null);
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

  function handleNext() {
    setMessage('');

    if (step === 3 && !selectedModel) {
      setMessage('No tractor models match the current filters. Adjust the filters and try again.');
      return;
    }

    if (step === 4) {
      const parsedHours = Number(hours);
      const parsedYear = activeYear;

      if (!selectedModel || !isYearValid) {
        setMessage('Enter a valid year model before running the valuation.');
        return;
      }

      if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
        setMessage('Enter engine hours greater than zero before running the valuation.');
        return;
      }

      if (!condition) {
        setMessage('Choose the overall condition before running the valuation.');
        return;
      }

      if (!extrasReviewed) {
        setMessage('Confirm the fitted extras before running the valuation.');
        return;
      }

      const nextResult = runValuation({
        modelId: selectedModel.id,
        year: parsedYear,
        hours: parsedHours,
        condition,
      });

      setResult(nextResult);

      const defaultMethod: MethodKey =
        nextResult.marketMid !== null
          ? 'market'
          : nextResult.aim4priceValueExVat !== null
            ? 'aim4price'
            : 'department';

      setSelectedMethod(defaultMethod);
      setStep(5);
      return;
    }

    setStep(nextStep(step));
  }

  function handleSave() {
    if (!result || !selectedMethod) {
      setMessage('Choose which number should be saved first.');
      return;
    }

    const value = getMethodValue(result, selectedMethod);

    if (value === null) {
      setMessage('That method is not available for this tractor profile.');
      return;
    }

    saveItem({
      id: `${result.model.id}-${activeYear}-${hours}-${condition ?? 'condition'}-${
        frontPto ? 'pto' : 'no-pto'
      }-${frontLoader ? 'loader' : 'no-loader'}-${gpsEnabled ? `gps-${gpsType ?? 'enabled'}-${gpsYear || 'year'}` : 'no-gps'}-${selectedMethod}`,
      kind: 'tractor',
      title: `${result.model.brandName} ${result.model.modelName}`,
      brandName: result.model.brandName,
      modelName: result.model.modelName,
      drive: result.model.drive,
      tractorType: result.model.tractorType,
      yearModel: activeYear,
      hours: Number(hours),
      selectedMethod,
      selectedValueExVat: value,
      aim4priceValueExVat: result.aim4priceValueExVat,
      marketMidExVat: result.marketMid,
      departmentValueExVat: result.departmentValueExVat,
      note: extrasSummaryText !== 'No fitted extras selected' ? `Extras: ${extrasSummaryText}` : undefined,
      createdAtIso: new Date().toISOString(),
    });

    setMessage('Saved locally to prototype storage.');
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

  function openExtrasEditor() {
    setExtrasDraft({
      frontPto,
      frontLoader,
      gpsEnabled,
      gpsType,
      gpsYear,
    });
    setExtrasOpen(true);
    setMessage('');
  }

  function handleEditTractorType() {
    setTractorType(null);
    setDrive(null);
    setCab(null);
    setModelId('');
    setModelQuery('');
    resetDetailState();
    setMessage('');
  }

  function handleEditDrive() {
    setDrive(null);
    setCab(null);
    setModelId('');
    setModelQuery('');
    resetDetailState();
    setMessage('');
  }

  function handleEditCab() {
    setCab(null);
    setModelId('');
    setModelQuery('');
    resetDetailState();
    setMessage('');
  }

  function handleEditModel() {
    setModelId('');
    resetDetailState();
    setMessage('');
  }

  function handleEditYear() {
    setYearDropdownOpen(false);
    setYear(null);
    setManualYear('');
    setHours('');
    setCondition(null);
    resetExtrasState();
    invalidateResult();
    setMessage('');
  }

  function handleEditHours() {
    setHours('');
    setCondition(null);
    resetExtrasState();
    invalidateResult();
    setMessage('');
  }

  function handleEditCondition() {
    setCondition(null);
    resetExtrasState();
    invalidateResult();
    setMessage('');
  }

  function handleConfirmNoExtras() {
    setFrontPto(false);
    setFrontLoader(false);
    setGpsEnabled(false);
    setGpsType(null);
    setGpsYear('');
    setExtrasReviewed(true);
    setExtrasDraft(null);
    setExtrasOpen(false);
    invalidateResult();
    setMessage('');
  }

  function FlowSummaryRow({ label, value, hint, onEdit }: FlowSummaryRowProps) {
    return (
      <div className={styles.flowSummaryRow}>
        <div className={styles.flowSummaryMeta}>
          <span className={styles.flowSummaryLabel}>{label}</span>
          <strong className={styles.flowSummaryValue}>{value}</strong>
          {hint ? <span className={styles.flowSummaryHint}>{hint}</span> : null}
        </div>

        <button type="button" className={styles.flowEditButton} onClick={onEdit}>
          Edit
        </button>
      </div>
    );
  }

  function FocusCard({ stepLabel, title, body, children, badgeText = 'Current' }: FocusCardProps) {
    return (
      <section className={styles.focusCard}>
        <div className={styles.focusCardHeader}>
          <div>
            <span className={styles.focusCardStep}>{stepLabel}</span>
            <h2 className={styles.focusCardTitle}>{title}</h2>
            <p className={styles.focusCardText}>{body}</p>
          </div>

          <span className={styles.focusCardBadge}>{badgeText}</span>
        </div>

        <div className={styles.focusCardBody}>{children}</div>
      </section>
    );
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
              >
                <span className={styles.dropdownTriggerText}>{selectedBrandName}</span>
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
                    {filteredBrandOptions.length ? (
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
                      <div className={styles.dropdownEmpty}>No brands matched “{brandSearch.trim()}”.</div>
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
      const currentModelPrompt =
        modelFlowStage === 'tractorType'
          ? 'Start by choosing whether this is a field or orchard tractor.'
          : modelFlowStage === 'drive'
            ? 'Now choose the drive layout that matches the tractor.'
            : modelFlowStage === 'cab'
              ? 'Now choose the cab setup.'
              : modelFlowStage === 'model'
                ? 'The matching model list is ready below.'
                : 'Model selected. Continue to tractor details when you are ready.';

      return (
        <div className={styles.flowLayout}>
          <div className={styles.flowIntroCard}>
            <div className={styles.flowIntroTop}>
              <div>
                <span className={styles.flowIntroEyebrow}>Configure tractor</span>
                <strong className={styles.flowIntroHeading}>One clear question at a time</strong>
                <p className={styles.flowIntroText}>
                  Only the open card needs attention. Completed answers collapse into short summaries so the next
                  action stays obvious.
                </p>
              </div>

              <span className={styles.flowProgressBadge}>{modelProgressCount}/4 complete</span>
            </div>

            <div className={styles.contextPillRow}>
              <span className={styles.contextPill}>Brand: {selectedBrandName}</span>
              {tractorType ? <span className={styles.contextPill}>Type: {getTractorTypeLabel(tractorType)}</span> : null}
              {drive ? <span className={styles.contextPill}>Drive: {getDriveDisplay(drive)}</span> : null}
              {cab ? <span className={styles.contextPill}>Cab: {getCabDisplay(cab)}</span> : null}
            </div>

            <p className={styles.flowInlineHint}>{currentModelPrompt}</p>
          </div>

          {tractorType ? (
            <FlowSummaryRow
              label="3.1 Tractor type"
              value={getTractorTypeLabel(tractorType)}
              hint="This controls which models appear next."
              onEdit={handleEditTractorType}
            />
          ) : (
            <FocusCard
              stepLabel="3.1 Tractor type"
              title="Choose tractor type"
              body="Select the tractor type first. The next setup question opens immediately afterwards."
            >
              <div className={styles.pillRow}>
                {(['field', 'orchard'] as TractorType[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.pillButton} ${tractorType === value ? styles.pillButtonActive : ''}`}
                    onClick={() => {
                      if (tractorType !== value) {
                        setTractorType(value);
                        setDrive(null);
                        setCab(null);
                        setModelId('');
                        setModelQuery('');
                        resetDetailState();
                      }
                      setMessage('');
                    }}
                    aria-pressed={tractorType === value}
                  >
                    {getTractorTypeLabel(value)}
                  </button>
                ))}
              </div>
            </FocusCard>
          )}

          {tractorType ? (
            drive ? (
              <FlowSummaryRow
                label="3.2 Drive"
                value={getDriveDisplay(drive)}
                hint="Used to narrow the matching model list."
                onEdit={handleEditDrive}
              />
            ) : (
              <FocusCard
                stepLabel="3.2 Drive"
                title="Choose drive layout"
                body="Pick the drive layout that matches the tractor."
              >
                <div className={styles.pillRow}>
                  {(['2wd', '4wd', 'tracks'] as DriveType[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`${styles.pillButton} ${drive === value ? styles.pillButtonActive : ''}`}
                      onClick={() => {
                        if (drive !== value) {
                          setDrive(value);
                          setCab(null);
                          setModelId('');
                          setModelQuery('');
                          resetDetailState();
                        }
                        setMessage('');
                      }}
                      aria-pressed={drive === value}
                    >
                      {getDriveDisplay(value)}
                    </button>
                  ))}
                </div>
              </FocusCard>
            )
          ) : null}

          {tractorType && drive ? (
            cab ? (
              <FlowSummaryRow
                label="3.3 Cab setup"
                value={getCabDisplay(cab)}
                hint="This finishes the tractor setup filter."
                onEdit={handleEditCab}
              />
            ) : (
              <FocusCard
                stepLabel="3.3 Cab setup"
                title="Choose cab setup"
                body="Select whether the tractor has a cab or an open station setup."
              >
                <div className={styles.pillRow}>
                  {(['cab', 'open-station'] as CabType[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`${styles.pillButton} ${cab === value ? styles.pillButtonActive : ''}`}
                      onClick={() => {
                        if (cab !== value) {
                          setCab(value);
                          setModelId('');
                          setModelQuery('');
                          resetDetailState();
                        }
                        setMessage('');
                      }}
                      aria-pressed={cab === value}
                    >
                      {getCabDisplay(value)}
                    </button>
                  ))}
                </div>
              </FocusCard>
            )
          ) : null}

          {tractorType && drive && cab ? (
            selectedModel ? (
              <>
                <FlowSummaryRow
                  label="3.4 Model"
                  value={`${selectedModel.brandName} ${selectedModel.modelName}`}
                  hint={`${selectedModel.yearStart}–${selectedModel.yearEnd} • ${selectedModel.powerKw} kW`}
                  onEdit={handleEditModel}
                />

                <div className={styles.readyCard}>
                  <div className={styles.readyCardHeader}>
                    <div>
                      <span className={styles.readyCardLabel}>Step 3 complete</span>
                      <strong>Tractor model selected</strong>
                      <p className={styles.readyCardText}>
                        Continue below to enter year model, engine hours, condition and fitted extras.
                      </p>
                    </div>

                    <span className={styles.flowProgressBadge}>Ready for Step 4</span>
                  </div>
                </div>
              </>
            ) : (
              <FocusCard
                stepLabel="3.4 Model"
                title="Choose model"
                body="Now choose the closest matching model. You can search if the list is long."
                badgeText="Final step"
              >
                <div className={styles.filterSummary}>
                  <span className={styles.filterSummaryTitle}>Matching setup</span>
                  <span className={styles.filterSummaryText}>
                    {selectedBrandName} • {getTractorTypeLabel(tractorType)} • {getDriveDisplay(drive)} •{' '}
                    {getCabDisplay(cab)}
                  </span>
                </div>

                <div className={styles.searchWrap}>
                  <input
                    value={modelQuery}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setModelQuery(event.target.value);
                      setMessage('');
                    }}
                    placeholder={`Search ${selectedBrandName} models...`}
                    aria-label="Search tractor models"
                    className={styles.searchInput}
                  />
                </div>

                {filteredModels.length ? (
                  <div className={styles.modelList}>
                    {filteredModels.map((model) => {
                      const active = modelId === model.id;

                      return (
                        <button
                          key={model.id}
                          type="button"
                          className={`${styles.modelRow} ${active ? styles.modelRowActive : ''}`}
                          onClick={() => {
                            if (model.id !== modelId) {
                              setModelId(model.id);
                              resetDetailState();
                            }
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
                ) : (
                  <div className={styles.emptyState}>
                    {drive === 'tracks'
                      ? `Tracks is enabled, but no bundled ${selectedBrandName} track models are loaded yet.`
                      : `No tractor models matched ${selectedBrandName}, ${getTractorTypeLabel(
                          tractorType,
                        )}, ${getDriveDisplay(drive)} and ${getCabDisplay(cab)}.`}
                  </div>
                )}
              </FocusCard>
            )
          ) : null}
        </div>
      );
    }

    if (!selectedModel) {
      return null;
    }

    const yearHint =
      yearMode === 'guided'
        ? `Guided years loaded: ${selectedModel.yearStart}–${selectedModel.yearEnd}.`
        : `Enter a four-digit year between 1950 and ${CURRENT_YEAR}.`;

    return (
      <div className={styles.flowLayout}>
        <div className={styles.flowIntroCard}>
          <div className={styles.flowIntroTop}>
            <div>
              <span className={styles.flowIntroEyebrow}>Enter tractor details</span>
              <strong className={styles.flowIntroHeading}>Keep moving one answer at a time</strong>
              <p className={styles.flowIntroText}>
                The current question stays open. Everything already answered closes into a short summary above it.
              </p>
            </div>

            <span className={styles.flowProgressBadge}>{detailProgressCount}/4 complete</span>
          </div>

          <div className={styles.contextPillRow}>
            <span className={styles.contextPill}>
              Model: {selectedModel.brandName} {selectedModel.modelName}
            </span>
            <span className={styles.contextPill}>
              Spec: {getTractorTypeLabel(selectedModel.tractorType)} • {getDriveDisplay(selectedModel.drive)} •{' '}
              {getCabDisplay(selectedModel.cab)}
            </span>
            <span className={styles.contextPill}>
              Guided years: {selectedModel.yearStart}–{selectedModel.yearEnd}
            </span>
          </div>
        </div>

        {isYearValid ? (
          <FlowSummaryRow
            label="4.1 Year model"
            value={selectedYearDisplay}
            hint={yearMode === 'guided' ? yearHint : 'Entered manually'}
            onEdit={handleEditYear}
          />
        ) : (
          <FocusCard
            stepLabel="4.1 Year model"
            title="Choose year model"
            body="Start with the tractor year model. Use Guided Years where possible, or switch to Other Year if it is not listed."
          >
            <div className={`${styles.fieldBlock} ${styles.inputPanel} ${styles.flowCompactPanel}`}>
              <div className={styles.panelHeader}>
                <span className={styles.panelLabel}>Year Model</span>

                <div className={styles.panelToggle}>
                  <button
                    type="button"
                    className={`${styles.pillButton} ${yearMode === 'guided' ? styles.pillButtonActive : ''}`}
                    onClick={() => {
                      setYearMode('guided');
                      const manualValue = Number(manualYear);
                      if (
                        selectedModel &&
                        Number.isInteger(manualValue) &&
                        manualValue >= selectedModel.yearStart &&
                        manualValue <= selectedModel.yearEnd
                      ) {
                        setYear(manualValue);
                      } else if (
                        year === null ||
                        year < selectedModel.yearStart ||
                        year > selectedModel.yearEnd
                      ) {
                        setYear(null);
                      }
                      setMessage('');
                    }}
                    aria-pressed={yearMode === 'guided'}
                  >
                    Guided Years
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
                      setMessage('');
                    }}
                    aria-pressed={yearMode === 'manual'}
                  >
                    Other Year
                  </button>
                </div>
              </div>

              <div className={styles.panelControl}>
                {yearMode === 'guided' ? (
                  <div className={styles.dropdownField} ref={yearDropdownRef}>
                    <button
                      type="button"
                      className={`${styles.dropdownTrigger} ${yearDropdownOpen ? styles.dropdownTriggerOpen : ''}`}
                      onClick={() => {
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
                ) : (
                  <input
                    value={manualYear}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setManualYear(event.target.value.replace(/[^0-9]/g, '').slice(0, 4));
                      setMessage('');
                      invalidateResult();
                    }}
                    placeholder="Type year model here"
                    inputMode="numeric"
                    aria-label="Enter year model manually"
                    className={styles.controlInput}
                  />
                )}
              </div>

              <p className={styles.fieldHint}>{yearHint}</p>
            </div>
          </FocusCard>
        )}

        {isYearValid ? (
          isHoursValid ? (
            <FlowSummaryRow
              label="4.2 Engine hours"
              value={enteredHoursDisplay}
              hint="Use the reading shown on the engine hour meter."
              onEdit={handleEditHours}
            />
          ) : (
            <FocusCard
              stepLabel="4.2 Engine hours"
              title="Enter engine hours"
              body="Use the number currently shown on the engine hour meter."
            >
              <div className={`${styles.fieldBlock} ${styles.inputPanel} ${styles.flowCompactPanel}`}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelLabel}>Engine Hours</span>
                  <span className={styles.filterStatusBadge}>{isHoursValid ? 'Entered' : 'Required'}</span>
                </div>

                <div className={styles.panelControl}>
                  <div className={styles.panelInputRow}>
                    <input
                      value={hours}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        setHours(event.target.value.replace(/[^0-9]/g, ''));
                        setMessage('');
                        invalidateResult();
                      }}
                      placeholder="Type engine hours here"
                      inputMode="numeric"
                      aria-label="Enter engine hours"
                      className={styles.controlInput}
                    />
                    <span className={styles.panelBadge}>hrs</span>
                  </div>
                </div>

                <p className={styles.fieldHint}>Example: 3500. Enter numbers only.</p>
              </div>
            </FocusCard>
          )
        ) : null}

        {isYearValid && isHoursValid ? (
          condition ? (
            <FlowSummaryRow
              label="4.3 Overall condition"
              value={conditionLabel(condition)}
              hint={getConditionHint(condition)}
              onEdit={handleEditCondition}
            />
          ) : (
            <FocusCard
              stepLabel="4.3 Overall condition"
              title="Choose overall condition"
              body="Pick the option that best describes the tractor today."
            >
              <div className={styles.conditionGrid}>
                {conditionOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`${styles.conditionCard} ${condition === option.key ? styles.conditionCardActive : ''}`}
                    onClick={() => {
                      setCondition(option.key);
                      setMessage('');
                      invalidateResult();
                    }}
                  >
                    <strong>{option.label}</strong>
                    <span>{getConditionHint(option.key)}</span>
                  </button>
                ))}
              </div>
            </FocusCard>
          )
        ) : null}

        {isYearValid && isHoursValid && condition ? (
          extrasReviewed ? (
            <>
              <FlowSummaryRow
                label="4.4 Fitted extras"
                value={extrasSummaryText}
                hint="Optional extras confirmed for this valuation."
                onEdit={openExtrasEditor}
              />

              <div className={styles.readyCard}>
                <div className={styles.readyCardHeader}>
                  <div>
                    <span className={styles.readyCardLabel}>Ready for valuation</span>
                    <strong>All tractor details are complete</strong>
                    <p className={styles.readyCardText}>
                      Click Get Valuation below to calculate the current values for this tractor profile.
                    </p>
                  </div>

                  <span className={styles.flowProgressBadge}>Step 4 complete</span>
                </div>

                <div className={styles.readyCardGrid}>
                  <div className={styles.readyCardFact}>
                    <span>Year model</span>
                    <strong>{selectedYearDisplay}</strong>
                  </div>
                  <div className={styles.readyCardFact}>
                    <span>Engine hours</span>
                    <strong>{enteredHoursDisplay}</strong>
                  </div>
                  <div className={styles.readyCardFact}>
                    <span>Condition</span>
                    <strong>{selectedConditionDisplay}</strong>
                  </div>
                  <div className={styles.readyCardFact}>
                    <span>Extras</span>
                    <strong>{extrasSummaryText}</strong>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <FocusCard
              stepLabel="4.4 Fitted extras"
              title="Confirm fitted extras"
              body="Extras are optional. Open the extras pop-up if anything is fitted, or confirm that there are no fitted extras."
              badgeText="Final step"
            >
              <div className={styles.focusActionRow}>
                <button type="button" className={styles.primaryButton} onClick={openExtrasEditor}>
                  Select Fitted Extras
                </button>
                <button type="button" className={styles.secondaryButton} onClick={handleConfirmNoExtras}>
                  No Fitted Extras
                </button>
              </div>

              <p className={styles.focusInlineHint}>
                Confirming no extras keeps the valuation quick and easy for first-time users.
              </p>

              <div className={styles.selectionChipRow}>
                {extrasSummaryChips.map((chip) => (
                  <span key={chip} className={styles.modelChip}>
                    {chip}
                  </span>
                ))}
              </div>
            </FocusCard>
          )
        ) : null}
      </div>
    );
  }

  return (
    <>
      <main className={styles.page}>
        <AppHeader active="valuation" ctaHref="/valuation" ctaLabel="Restart Valuation" />

        <div className={styles.container}>
          {step !== 5 ? (
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
                    disabled={!canContinue}
                  >
                    {nextLabel}
                  </button>
                </div>
              </article>
            </section>
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
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </article>

                <article className={styles.assetCard}>
                  <div className={styles.actionHeader}>
                    <div>
                      <h2 className={styles.assetTitle}>Save to Asset Register</h2>
                      <p className={styles.assetText}>
                        Save this valuation, return later, and keep the next actions together in one place.
                      </p>
                    </div>
                    <span className={styles.actionBadge}>Quick actions</span>
                  </div>

                  <div className={styles.actionGrid}>
                    <button type="button" className={`${styles.assetButton} ${styles.actionPrimary}`} onClick={handleSave}>
                      Save to My Assets
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
                </article>

                <article className={`${styles.sideCard} ${styles.marketCard}`}>
                  <div className={styles.rangeCardHead}>
                    <h2 className={styles.sideTitle}>Market Range</h2>
                    <span className={styles.rangeBadge}>
                      {result.marketCount} proveable listing{result.marketCount === 1 ? '' : 's'}
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
                        aria-label="Browse proveable market listings"
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
                        No proveable market listings matched this tractor yet. Add more market listings to improve
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

      {extrasOpen && extrasDraft ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select fitted extras"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(12, 29, 23, 0.58)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 120,
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setExtrasOpen(false);
              setExtrasDraft(null);
            }
          }}
        >
          <article
            className={styles.wizardCard}
            style={{
              width: 'min(880px, 100%)',
              maxHeight: 'min(88vh, 920px)',
              overflowY: 'auto',
              borderRadius: '1.35rem',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.35rem 1rem',
                borderBottom: '1px solid rgba(18, 45, 37, 0.08)',
                background: 'linear-gradient(180deg, rgba(248, 251, 249, 0.98) 0%, rgba(244, 248, 246, 0.94) 100%)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span className={styles.selectionEyebrow}>Extras</span>
                  <h2 style={{ margin: '0.45rem 0 0', fontSize: '1.55rem', lineHeight: 1.1, color: '#223b34' }}>
                    Fitted extras
                  </h2>
                  <p style={{ margin: '0.55rem 0 0', color: '#6f7974', lineHeight: 1.6 }}>
                    Choose the extras fitted to this tractor, then apply and return to the valuation flow.
                  </p>
                </div>

                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setExtrasOpen(false);
                    setExtrasDraft(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.35rem 1.35rem' }}>
              <div className={styles.filterToolbar}>
                <div className={`${styles.filterGroup} ${styles.filterGroupUnlocked}`}>
                  <div className={styles.filterGroupHead}>
                    <span className={styles.filterLabel}>Front Hitch & Front PTO</span>
                    <span className={styles.filterStatusBadge}>{extrasDraft.frontPto ? 'Included' : 'Optional'}</span>
                  </div>

                  <div className={styles.pillRow}>
                    <button
                      type="button"
                      className={`${styles.pillButton} ${extrasDraft.frontPto ? styles.pillButtonActive : ''}`}
                      onClick={() =>
                        setExtrasDraft((current) => (current ? { ...current, frontPto: true } : current))
                      }
                      aria-pressed={extrasDraft.frontPto}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={`${styles.pillButton} ${!extrasDraft.frontPto ? styles.pillButtonActive : ''}`}
                      onClick={() =>
                        setExtrasDraft((current) => (current ? { ...current, frontPto: false } : current))
                      }
                      aria-pressed={!extrasDraft.frontPto}
                    >
                      No
                    </button>
                  </div>
                </div>

                <div className={`${styles.filterGroup} ${styles.filterGroupUnlocked}`}>
                  <div className={styles.filterGroupHead}>
                    <span className={styles.filterLabel}>Front Loader</span>
                    <span className={styles.filterStatusBadge}>{extrasDraft.frontLoader ? 'Included' : 'Optional'}</span>
                  </div>

                  <div className={styles.pillRow}>
                    <button
                      type="button"
                      className={`${styles.pillButton} ${extrasDraft.frontLoader ? styles.pillButtonActive : ''}`}
                      onClick={() =>
                        setExtrasDraft((current) => (current ? { ...current, frontLoader: true } : current))
                      }
                      aria-pressed={extrasDraft.frontLoader}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={`${styles.pillButton} ${!extrasDraft.frontLoader ? styles.pillButtonActive : ''}`}
                      onClick={() =>
                        setExtrasDraft((current) => (current ? { ...current, frontLoader: false } : current))
                      }
                      aria-pressed={!extrasDraft.frontLoader}
                    >
                      No
                    </button>
                  </div>
                </div>

                <div className={`${styles.filterGroup} ${styles.filterGroupUnlocked}`}>
                  <div className={styles.filterGroupHead}>
                    <span className={styles.filterLabel}>GPS</span>
                    <span className={styles.filterStatusBadge}>{extrasDraft.gpsEnabled ? 'Included' : 'Optional'}</span>
                  </div>

                  <div className={styles.pillRow}>
                    <button
                      type="button"
                      className={`${styles.pillButton} ${extrasDraft.gpsEnabled ? styles.pillButtonActive : ''}`}
                      onClick={() =>
                        setExtrasDraft((current) =>
                          current
                            ? {
                                ...current,
                                gpsEnabled: true,
                              }
                            : current,
                        )
                      }
                      aria-pressed={extrasDraft.gpsEnabled}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={`${styles.pillButton} ${!extrasDraft.gpsEnabled ? styles.pillButtonActive : ''}`}
                      onClick={() =>
                        setExtrasDraft((current) =>
                          current
                            ? {
                                ...current,
                                gpsEnabled: false,
                                gpsType: null,
                                gpsYear: '',
                              }
                            : current,
                        )
                      }
                      aria-pressed={!extrasDraft.gpsEnabled}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>

              {extrasDraft.gpsEnabled ? (
                <div className={styles.inputGrid} style={{ marginTop: '1rem' }}>
                  <div className={`${styles.fieldBlock} ${styles.inputPanel} ${styles.filterGroupUnlocked}`}>
                    <div className={styles.panelHeader}>
                      <span className={styles.panelLabel}>GPS Type</span>
                      <span className={styles.filterStatusBadge}>{extrasDraft.gpsType ? 'Selected' : 'Optional'}</span>
                    </div>

                    <div className={styles.panelControl}>
                      <div className={styles.pillRow}>
                        {(['full-autosteer', 'guidance-only'] as GpsType[]).map((value) => (
                          <button
                            key={value}
                            type="button"
                            className={`${styles.pillButton} ${extrasDraft.gpsType === value ? styles.pillButtonActive : ''}`}
                            onClick={() =>
                              setExtrasDraft((current) => (current ? { ...current, gpsType: value } : current))
                            }
                            aria-pressed={extrasDraft.gpsType === value}
                          >
                            {getGpsTypeLabel(value)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className={styles.fieldHint}>Add the installed GPS system type if known.</p>
                  </div>

                  <div className={`${styles.fieldBlock} ${styles.inputPanel} ${styles.filterGroupUnlocked}`}>
                    <div className={styles.panelHeader}>
                      <span className={styles.panelLabel}>GPS Year</span>
                      <span className={styles.filterStatusBadge}>{extrasDraft.gpsYear.trim() ? 'Entered' : 'Optional'}</span>
                    </div>

                    <div className={styles.panelControl}>
                      <input
                        value={extrasDraft.gpsYear}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setExtrasDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  gpsYear: event.target.value.replace(/[^0-9]/g, '').slice(0, 4),
                                }
                              : current,
                          )
                        }
                        placeholder="Type GPS year here"
                        inputMode="numeric"
                        aria-label="Enter GPS year"
                        className={styles.controlInput}
                      />
                    </div>

                    <p className={styles.fieldHint}>Use the approximate GPS year model where available.</p>
                  </div>
                </div>
              ) : null}

              <div className={styles.selectionCard} style={{ marginTop: '1rem' }}>
                <div className={styles.sectionHeader}>
                  <span className={styles.selectionEyebrow}>Selected extras</span>
                  <span className={styles.filterStatusBadge}>
                    {(() => {
                      const chips = buildExtrasSummaryChips(
                        extrasDraft.frontPto,
                        extrasDraft.frontLoader,
                        extrasDraft.gpsEnabled,
                        extrasDraft.gpsType,
                        extrasDraft.gpsYear,
                      );
                      return chips[0] === 'No fitted extras selected' ? 'None' : `${chips.length} item${chips.length === 1 ? '' : 's'}`;
                    })()}
                  </span>
                </div>

                <div className={styles.selectionChipRow} style={{ marginTop: '0.8rem' }}>
                  {buildExtrasSummaryChips(
                    extrasDraft.frontPto,
                    extrasDraft.frontLoader,
                    extrasDraft.gpsEnabled,
                    extrasDraft.gpsType,
                    extrasDraft.gpsYear,
                  ).map((chip) => (
                    <span key={chip} className={styles.modelChip}>
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '1rem 1.35rem 1.25rem',
                borderTop: '1px solid rgba(18, 45, 37, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setExtrasOpen(false);
                  setExtrasDraft(null);
                }}
              >
                Cancel
              </button>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className={styles.secondaryButton} onClick={handleConfirmNoExtras}>
                  No Fitted Extras
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => {
                    setFrontPto(extrasDraft.frontPto);
                    setFrontLoader(extrasDraft.frontLoader);
                    setGpsEnabled(extrasDraft.gpsEnabled);
                    setGpsType(extrasDraft.gpsEnabled ? extrasDraft.gpsType : null);
                    setGpsYear(extrasDraft.gpsEnabled ? extrasDraft.gpsYear : '');
                    setExtrasReviewed(true);
                    setExtrasOpen(false);
                    setExtrasDraft(null);
                    setMessage('');
                    invalidateResult();
                  }}
                >
                  Apply Extras
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}
