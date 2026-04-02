'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
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
        body: 'Select the tractor type, drive layout and cab setup in sequence, then choose the closest matching model from the Aim4price catalogue.',
      };
    case 4:
      return {
        title: 'Enter Tractor Details',
        body: 'Complete the tractor details in order below. Start with the year model, then enter engine hours, then confirm overall condition and fitted extras.',
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
  const rangePercent = getRangePercent(
    result?.marketLow ?? null,
    result?.marketHigh ?? null,
    selectedMethod === 'market' ? selectedMethodValue : result?.marketMid ?? headlineValue,
  );
  const confidenceLevel = result ? getConfidenceLevel(result) : 'low';
  const confidenceClassName =
    confidenceLevel === 'high'
      ? styles.confidenceHigh
      : confidenceLevel === 'medium'
        ? styles.confidenceMedium
        : styles.confidenceLow;

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
    if (step === 4) return Boolean(selectedModel && isYearValid && isHoursValid && condition);
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
      const driveUnlocked = tractorType !== null;
      const cabUnlocked = driveUnlocked && drive !== null;
      const modelsUnlocked = cabUnlocked && cab !== null;
      const stageText = !tractorType
        ? 'Start by choosing the tractor type.'
        : !drive
          ? 'Now choose the drive layout.'
          : !cab
            ? 'Now choose the cab setup.'
            : !selectedModel
              ? 'Matching models are now ready below. Select the closest one to continue.'
              : 'Model selected. Review the result below or continue to tractor details.';

      return (
        <>
          <div className={styles.filterToolbar}>
            <div className={`${styles.filterGroup} ${styles.filterGroupUnlocked}`}>
              <div className={styles.filterGroupHead}>
                <span className={styles.filterLabel}>Tractor Type</span>
                <span className={styles.filterStatusBadge}>{tractorType ? 'Selected' : 'Required'}</span>
              </div>

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
            </div>

            <div
              className={`${styles.filterGroup} ${
                driveUnlocked ? styles.filterGroupUnlocked : styles.filterGroupLocked
              }`}
            >
              <div className={styles.filterGroupHead}>
                <span className={styles.filterLabel}>Drive</span>
                <span className={styles.filterStatusBadge}>
                  {!driveUnlocked ? 'Locked' : drive ? 'Selected' : 'Required'}
                </span>
              </div>

              {driveUnlocked ? (
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
              ) : (
                <p className={styles.filterLockedText}>
                  Select tractor type first. Drive options unlock immediately afterwards.
                </p>
              )}
            </div>

            <div
              className={`${styles.filterGroup} ${
                cabUnlocked ? styles.filterGroupUnlocked : styles.filterGroupLocked
              }`}
            >
              <div className={styles.filterGroupHead}>
                <span className={styles.filterLabel}>Cab Setup</span>
                <span className={styles.filterStatusBadge}>
                  {!cabUnlocked ? 'Locked' : cab ? 'Selected' : 'Required'}
                </span>
              </div>

              {cabUnlocked ? (
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
              ) : (
                <p className={styles.filterLockedText}>
                  Select the drive layout first. Cab options unlock after that choice.
                </p>
              )}
            </div>
          </div>

          <p className={styles.filterHint}>{stageText}</p>

          {modelsUnlocked ? (
            <>
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
                <>
                  <div className={styles.filterSummary}>
                    <span className={styles.filterSummaryTitle}>
                      {filteredModels.length} model{filteredModels.length === 1 ? '' : 's'} available
                    </span>
                    <span className={styles.filterSummaryText}>
                      {selectedBrandName} • {getTractorTypeLabel(tractorType!)} • {getDriveDisplay(drive!)} •{' '}
                      {getCabDisplay(cab!)}
                    </span>
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
                </>
              ) : (
                <div className={styles.emptyState}>
                  {drive === 'tracks'
                    ? `Tracks is enabled, but no bundled ${selectedBrandName} track models are loaded yet.`
                    : `No tractor models matched ${selectedBrandName}, ${getTractorTypeLabel(
                        tractorType!,
                      )}, ${getDriveDisplay(drive!)} and ${getCabDisplay(cab!)}.`}
                </div>
              )}
            </>
          ) : (
            <div className={styles.selectionPrompt}>
              <span className={styles.selectionPromptLabel}>Model selection</span>
              <strong>
                {!tractorType ? 'Choose tractor type first' : !drive ? 'Choose drive next' : 'Choose cab setup next'}
              </strong>
              <p>Models only appear after the full tractor configuration has been selected.</p>
            </div>
          )}
        </>
      );
    }

    return (
      <>
        <div className={styles.inputGrid}>
          <div
            className={`${styles.fieldBlock} ${styles.inputPanel} ${
              yearUnlocked ? styles.filterGroupUnlocked : styles.filterGroupLocked
            }`}
          >
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
                      !selectedModel ||
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

            <p className={styles.fieldHint}>
              Guided years are based on bundled model data. Use Other Year when your tractor year model is not shown.
            </p>
          </div>

          <div
            className={`${styles.fieldBlock} ${styles.inputPanel} ${
              hoursUnlocked ? styles.filterGroupUnlocked : styles.filterGroupLocked
            }`}
          >
            <div className={styles.panelHeader}>
              <span className={styles.panelLabel}>Engine Hours</span>
              <span className={styles.filterStatusBadge}>
                {!hoursUnlocked ? 'Locked' : isHoursValid ? 'Entered' : 'Required'}
              </span>
            </div>

            <div className={styles.panelControl}>
              {hoursUnlocked ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: '0.75rem',
                    alignItems: 'center',
                  }}
                >
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
              ) : (
                <p className={styles.filterLockedText}>
                  Select the year model first. Engine hours unlock immediately afterwards.
                </p>
              )}
            </div>

            <p className={styles.fieldHint}>Use the reading shown on the engine hour meter.</p>
          </div>
        </div>

        <div
          className={`${styles.conditionSection} ${
            conditionUnlocked ? styles.filterGroupUnlocked : styles.filterGroupLocked
          }`}
        >
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Overall Condition</span>
            <span className={styles.filterStatusBadge}>
              {!conditionUnlocked ? 'Locked' : condition ? 'Selected' : 'Required'}
            </span>
          </div>

          {conditionUnlocked ? (
            <>
              <p className={styles.sectionHint} style={{ marginTop: '0.65rem' }}>
                Choose the option that best matches the tractor today.
              </p>

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
            </>
          ) : (
            <p className={styles.filterLockedText} style={{ marginTop: '0.85rem' }}>
              Enter engine hours first. Overall condition unlocks after that.
            </p>
          )}
        </div>

        <div
          className={`${styles.selectionCard} ${extrasUnlocked ? styles.filterGroupUnlocked : styles.filterGroupLocked}`}
        >
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.selectionEyebrow}>Extras</span>
              <strong style={{ display: 'block', marginTop: '0.4rem', color: '#223b34', fontSize: '1.03rem' }}>
                Add fitted extras
              </strong>
            </div>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setExtrasOpen(true)}
              disabled={!extrasUnlocked}
            >
              Extras
            </button>
          </div>

          <p className={styles.fieldHint} style={{ minHeight: 0, marginTop: '0.7rem' }}>
            Add fitted extras such as Front Hitch & Front PTO, Front Loader and GPS.
          </p>

          <div className={styles.selectionChipRow} style={{ marginTop: '0.8rem' }}>
            {extrasSummaryChips.map((chip) => (
              <span key={chip} className={styles.modelChip}>
                {chip}
              </span>
            ))}
          </div>
        </div>

        {selectedModel ? (
          <div className={styles.selectionCard}>
            <div className={styles.selectionCardGrid}>
              <div className={styles.selectionMeta}>
                <span className={styles.selectionEyebrow}>Summary</span>
                <strong>
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

                <span>Guided years: {selectedModel.yearStart}–{selectedModel.yearEnd}</span>
              </div>

              <div className={styles.selectionFacts}>
                <div className={styles.selectionFact}>
                  <span>Chosen year</span>
                  <strong>{selectedYearDisplay}</strong>
                </div>

                <div className={styles.selectionFact}>
                  <span>Engine hours</span>
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
          </div>
        ) : null}
      </>
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

                  <div className={styles.valuePanel}>
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
                      <span className={styles.breakdownValue}>{getConfidenceLabel(result)}</span>
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
                                  {listing.yearModel} • {listing.hours.toLocaleString('en-ZA')} engine hours • {listing.area},{' '}
                                  {listing.province}
                                </div>

                                {result.extrasValueExVat > 0 ? (
                                  <div className={styles.listingAdjustmentNote}>
                                    Raw listing {money(getListingBasePrice(listing))} • adjusted for selected extras
                                  </div>
                                ) : null}
                              </button>

                              <div className={styles.listingCardFooter}>
                                <span className={styles.listingCardDate}>{formatListingDate(listing.dateAdvertised)}</span>

                                {listing.sourceUrl ? (
                                  <a
                                    href={listing.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.listingLink}
                                  >
                                    Open source ↗
                                  </a>
                                ) : (
                                  <span className={styles.listingLinkMuted}>Source link not yet attached</span>
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

      {extrasOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select fitted extras"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(16, 32, 26, 0.52)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 120,
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setExtrasOpen(false);
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
                    Select the extras installed on this tractor before generating the valuation.
                  </p>
                </div>

                <button type="button" className={styles.secondaryButton} onClick={() => setExtrasOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.35rem 1.35rem' }}>
              <div className={styles.filterToolbar}>
                <div className={`${styles.filterGroup} ${styles.filterGroupUnlocked}`}>
                  <div className={styles.filterGroupHead}>
                    <span className={styles.filterLabel}>Front Hitch & Front PTO</span>
                    <span className={styles.filterStatusBadge}>{frontPto ? 'Included' : 'Optional'}</span>
                  </div>

                  <div className={styles.pillRow}>
                    <button
                      type="button"
                      className={`${styles.pillButton} ${frontPto ? styles.pillButtonActive : ''}`}
                      onClick={() => setFrontPto(true)}
                      aria-pressed={frontPto}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={`${styles.pillButton} ${!frontPto ? styles.pillButtonActive : ''}`}
                      onClick={() => setFrontPto(false)}
                      aria-pressed={!frontPto}
                    >
                      No
                    </button>
                  </div>
                </div>

                <div className={`${styles.filterGroup} ${styles.filterGroupUnlocked}`}>
                  <div className={styles.filterGroupHead}>
                    <span className={styles.filterLabel}>Front Loader</span>
                    <span className={styles.filterStatusBadge}>{frontLoader ? 'Included' : 'Optional'}</span>
                  </div>

                  <div className={styles.pillRow}>
                    <button
                      type="button"
                      className={`${styles.pillButton} ${frontLoader ? styles.pillButtonActive : ''}`}
                      onClick={() => setFrontLoader(true)}
                      aria-pressed={frontLoader}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={`${styles.pillButton} ${!frontLoader ? styles.pillButtonActive : ''}`}
                      onClick={() => setFrontLoader(false)}
                      aria-pressed={!frontLoader}
                    >
                      No
                    </button>
                  </div>
                </div>

                <div className={`${styles.filterGroup} ${styles.filterGroupUnlocked}`}>
                  <div className={styles.filterGroupHead}>
                    <span className={styles.filterLabel}>GPS</span>
                    <span className={styles.filterStatusBadge}>{gpsEnabled ? 'Included' : 'Optional'}</span>
                  </div>

                  <div className={styles.pillRow}>
                    <button
                      type="button"
                      className={`${styles.pillButton} ${gpsEnabled ? styles.pillButtonActive : ''}`}
                      onClick={() => setGpsEnabled(true)}
                      aria-pressed={gpsEnabled}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={`${styles.pillButton} ${!gpsEnabled ? styles.pillButtonActive : ''}`}
                      onClick={() => setGpsEnabled(false)}
                      aria-pressed={!gpsEnabled}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>

              {gpsEnabled ? (
                <div className={styles.inputGrid} style={{ marginTop: '1rem' }}>
                  <div className={`${styles.fieldBlock} ${styles.inputPanel} ${styles.filterGroupUnlocked}`}>
                    <div className={styles.panelHeader}>
                      <span className={styles.panelLabel}>GPS Type</span>
                      <span className={styles.filterStatusBadge}>{gpsType ? 'Selected' : 'Optional'}</span>
                    </div>

                    <div className={styles.panelControl}>
                      <div className={styles.pillRow}>
                        {(['full-autosteer', 'guidance-only'] as GpsType[]).map((value) => (
                          <button
                            key={value}
                            type="button"
                            className={`${styles.pillButton} ${gpsType === value ? styles.pillButtonActive : ''}`}
                            onClick={() => setGpsType(value)}
                            aria-pressed={gpsType === value}
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
                      <span className={styles.filterStatusBadge}>{gpsYear.trim() ? 'Entered' : 'Optional'}</span>
                    </div>

                    <div className={styles.panelControl}>
                      <input
                        value={gpsYear}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setGpsYear(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))
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
                    {extrasSummaryChips[0] === 'No fitted extras selected' ? 'None' : `${extrasSummaryChips.length} item${extrasSummaryChips.length === 1 ? '' : 's'}`}
                  </span>
                </div>

                <div className={styles.selectionChipRow} style={{ marginTop: '0.8rem' }}>
                  {extrasSummaryChips.map((chip) => (
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
              <button type="button" className={styles.secondaryButton} onClick={() => setExtrasOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => {
                  setExtrasOpen(false);
                  setMessage('');
                  invalidateResult();
                }}
              >
                Apply Extras
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}
