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
  type TractorCatalogRow,
  type TractorType,
} from '../../lib/tractor-data';
import { conditionLabel, money, range, runValuation, type Result } from '../../lib/tractor-logic';
import { saveItem } from '../../lib/register';

type Step = 1 | 2 | 3 | 4 | 5;
type MethodKey = 'aim4price' | 'market' | 'department';
type EquipmentType = 'tractor';

type MethodCard = {
  key: MethodKey;
  label: string;
  note: string;
  value: number | null;
  available: boolean;
};

const INITIAL_MODEL_ID = 'john-deere-6135b-field-4wd-cab';
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
        body: 'Filter by tractor type, drive and cab configuration, then choose the closest bundled test model.',
      };
    case 4:
      return {
        title: 'Enter Tractor Details',
        body: 'Confirm the year model, enter engine hours, and choose the overall condition before generating the valuation.',
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

function getConfidenceLabel(result: Result): string {
  if (result.marketCount >= 5) return 'Confidence: High';
  if (result.marketCount >= 2) return 'Confidence: Medium';
  return 'Confidence: Low';
}

function getTractorTypeLabel(type: TractorType): string {
  return type === 'orchard' ? 'Orchard' : 'Field';
}

function getCabDisplay(cabValue: CabType): string {
  return cabValue === 'cab' ? 'Cab' : 'Open station';
}

export default function ValuationClient() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [selectedType, setSelectedType] = useState<EquipmentType | null>(null);
  const [modelQuery, setModelQuery] = useState('');
  const [brandSlug, setBrandSlug] = useState('john-deere');
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [tractorType, setTractorType] = useState<TractorType>('field');
  const [drive, setDrive] = useState<DriveType>('4wd');
  const [cab, setCab] = useState<CabType>('cab');
  const [modelId, setModelId] = useState(INITIAL_MODEL_ID);
  const [yearMode, setYearMode] = useState<'guided' | 'manual'>('guided');
  const [year, setYear] = useState(2020);
  const [manualYear, setManualYear] = useState('');
  const [hours, setHours] = useState('3500');
  const [condition, setCondition] = useState<ConditionKey>('good');
  const [result, setResult] = useState<Result | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<MethodKey | null>(null);
  const [message, setMessage] = useState('');

  const stepMeta = getStepMeta(step);
  const brandDropdownRef = useRef<HTMLDivElement | null>(null);
  const brandSearchInputRef = useRef<HTMLInputElement | null>(null);

  const sortedBrands = useMemo(
    () => [...brands].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [],
  );

  const filteredModels = useMemo(
    () =>
      tractors.filter((tractor) => {
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
      }),
    [brandSlug, tractorType, drive, cab, modelQuery],
  );

  const selectedModel = useMemo<TractorCatalogRow | null>(() => {
    if (!filteredModels.length) return null;
    return filteredModels.find((model) => model.id === modelId) ?? filteredModels[0];
  }, [filteredModels, modelId]);

  useEffect(() => {
    if (!filteredModels.length) {
      if (modelId !== '') {
        setModelId('');
      }
      return;
    }

    if (!filteredModels.some((model) => model.id === modelId)) {
      setModelId(filteredModels[0].id);
    }
  }, [filteredModels, modelId]);

  useEffect(() => {
    if (!selectedModel || yearMode !== 'guided') return;

    if (year < selectedModel.yearStart || year > selectedModel.yearEnd) {
      setYear(selectedModel.yearEnd);
    }
  }, [selectedModel, yearMode, year]);

  useEffect(() => {
    if (step !== 2) {
      setBrandDropdownOpen(false);
      setBrandSearch('');
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
    if (!brandDropdownOpen) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!brandDropdownRef.current) return;

      const target = event.target;
      if (target instanceof Node && !brandDropdownRef.current.contains(target)) {
        setBrandDropdownOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setBrandDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [brandDropdownOpen]);

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

  const activeYear = yearMode === 'manual' ? Number(manualYear) : year;
  const isYearValid = yearMode === 'guided'
    ? Number.isInteger(year)
    : Number.isInteger(activeYear) && activeYear >= 1950 && activeYear <= CURRENT_YEAR;
  const selectedYearDisplay = isYearValid ? String(activeYear) : 'Enter year';
  const enteredHours = Number(hours);
  const enteredHoursDisplay =
    Number.isFinite(enteredHours) && enteredHours > 0 ? enteredHours.toLocaleString('en-ZA') : 'Enter hours';

  const methodCards = useMemo<MethodCard[]>(() => {
    if (!result) return [];

    return [
      {
        key: 'aim4price',
        label: 'Aim4price Value',
        note: 'Based on our pricing engine and market trends.',
        value: result.aim4priceValueExVat,
        available: result.aim4priceValueExVat !== null,
      },
      {
        key: 'market',
        label: 'Market Range',
        note: `${result.marketCount} similar listing${result.marketCount === 1 ? '' : 's'} in the prototype set.`,
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

  const canContinue = useMemo(() => {
    if (step === 1) return selectedType === 'tractor';
    if (step === 3) return Boolean(selectedModel);
    if (step === 4) return Boolean(selectedModel && isYearValid && Number(hours) > 0);
    return true;
  }, [step, selectedType, selectedModel, isYearValid, hours]);

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
    setTractorType('field');
    setDrive('4wd');
    setCab('cab');
    setModelId(INITIAL_MODEL_ID);
    setYearMode('guided');
    setYear(2020);
    setManualYear('');
    setHours('3500');
    setCondition('good');
    setResult(null);
    setSelectedMethod(null);
    setMessage('');
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
      id: `${result.model.id}-${activeYear}-${hours}-${selectedMethod}`,
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
                              setBrandSlug(brand.slug);
                              setModelQuery('');
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
      return (
        <>
          <div className={styles.filterToolbar}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Tractor Type</span>
              <div className={styles.pillRow}>
                {(['field', 'orchard'] as TractorType[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.pillButton} ${tractorType === value ? styles.pillButtonActive : ''}`}
                    onClick={() => {
                      setTractorType(value);
                      setMessage('');
                    }}
                    aria-pressed={tractorType === value}
                  >
                    {getTractorTypeLabel(value)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Drive</span>
              <div className={styles.pillRow}>
                {(['2wd', '4wd'] as DriveType[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.pillButton} ${drive === value ? styles.pillButtonActive : ''}`}
                    onClick={() => {
                      setDrive(value);
                      setMessage('');
                    }}
                    aria-pressed={drive === value}
                  >
                    {value.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Cab Setup</span>
              <div className={styles.pillRow}>
                {(['cab', 'open-station'] as CabType[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.pillButton} ${cab === value ? styles.pillButtonActive : ''}`}
                    onClick={() => {
                      setCab(value);
                      setMessage('');
                    }}
                    aria-pressed={cab === value}
                  >
                    {getCabDisplay(value)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className={styles.filterHint}>
            Start with the tractor type, then narrow by drive and cab before selecting the closest model.
          </p>

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
                  {filteredModels.length} model{filteredModels.length === 1 ? '' : 's'} found
                </span>
                <span className={styles.filterSummaryText}>
                  {selectedBrandName} • {getTractorTypeLabel(tractorType)} • {drive.toUpperCase()} •{' '}
                  {getCabDisplay(cab)}
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
                        setModelId(model.id);
                        if (yearMode === 'guided') {
                          setYear(model.yearEnd);
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
                          <span className={styles.modelChip}>{model.drive.toUpperCase()}</span>
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
              No tractor models matched {selectedBrandName}, {getTractorTypeLabel(tractorType)}, {drive.toUpperCase()}
              {' '}and {getCabDisplay(cab)}.
            </div>
          )}
        </>
      );
    }

    return (
      <>
        <div className={styles.inputGrid}>
          <div className={`${styles.fieldBlock} ${styles.inputPanel}`}>
            <div className={styles.panelHeader}>
              <span className={styles.panelLabel}>Year Model</span>

              <div className={styles.panelToggle}>
                <button
                  type="button"
                  className={`${styles.pillButton} ${yearMode === 'guided' ? styles.pillButtonActive : ''}`}
                  onClick={() => {
                    setYearMode('guided');
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
                    setManualYear(String(year));
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
                <select
                  value={year}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => setYear(Number(event.target.value))}
                  className={styles.controlInput}
                  aria-label="Choose guided year model"
                >
                  {years.map((availableYear) => (
                    <option key={availableYear} value={availableYear}>
                      {availableYear}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={manualYear}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setManualYear(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))
                  }
                  placeholder="e.g. 2017"
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

          <div className={`${styles.fieldBlock} ${styles.inputPanel}`}>
            <div className={styles.panelHeader}>
              <span className={styles.panelLabel}>Engine Hours</span>
              <span className={styles.panelBadge}>Hour meter</span>
            </div>

            <div className={styles.panelControl}>
              <input
                value={hours}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setHours(event.target.value.replace(/[^0-9]/g, ''))
                }
                placeholder="3,500"
                inputMode="numeric"
                aria-label="Enter engine hours"
                className={styles.controlInput}
              />
            </div>

            <p className={styles.fieldHint}>Use the reading shown on the engine hour meter.</p>
          </div>
        </div>

        <div className={styles.conditionSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Overall Condition</span>
            <span className={styles.sectionHint}>Choose the option that best matches the tractor today.</span>
          </div>

          <div className={styles.conditionGrid}>
            {conditionOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`${styles.conditionCard} ${condition === option.key ? styles.conditionCardActive : ''}`}
                onClick={() => {
                  setCondition(option.key);
                  setMessage('');
                }}
              >
                <strong>{option.label}</strong>
                <span>{getConditionHint(option.key)}</span>
              </button>
            ))}
          </div>
        </div>

        {selectedModel ? (
          <div className={styles.selectionCard}>
            <div className={styles.selectionCardGrid}>
              <div className={styles.selectionMeta}>
                <span className={styles.selectionEyebrow}>Selected model</span>
                <strong>
                  {selectedModel.brandName} {selectedModel.modelName}
                </strong>

                <div className={styles.selectionChipRow}>
                  <span className={styles.modelChip}>{getTractorTypeLabel(selectedModel.tractorType)}</span>
                  <span className={styles.modelChip}>{selectedModel.drive.toUpperCase()}</span>
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
                  <strong>{conditionLabel(condition)}</strong>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
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
                        {getTractorTypeLabel(result.model.tractorType)} tractor • {result.model.drive.toUpperCase()} •{' '}
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
                    <div>
                      <span className={styles.valueLabel}>{headlineLabel}</span>
                      <div className={styles.valueAmount}>{money(headlineValue)}</div>
                      <p className={styles.valueMeta}>ZAR • South Africa • Excl. VAT (indicative)</p>
                    </div>

                    <span className={styles.confidenceBadge}>{getConfidenceLabel(result)}</span>
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
                <div className={styles.assetHeader}>
                  <div>
                    <h2 className={styles.assetTitle}>Save to Asset Register</h2>
                    <p className={styles.assetText}>
                      Track this asset, update values over time, and export reports later.
                    </p>
                  </div>
                </div>

                <button type="button" className={styles.assetButton} onClick={handleSave}>
                  Save to My Assets
                </button>

                <div className={styles.assetFootnote}>
                  Prototype mode: this currently saves locally only.
                </div>
              </article>
            </div>

            <aside className={styles.resultsSide}>
              <article className={styles.sideCard}>
                <h2 className={styles.sideTitle}>Value Breakdown</h2>

                <div className={styles.breakdownList}>
                  <div className={styles.breakdownRow}>
                    <span className={styles.breakdownKey}>Specification</span>
                    <span className={styles.breakdownValue}>
                      {getTractorTypeLabel(result.model.tractorType)} • {result.model.drive.toUpperCase()} •{' '}
                      {getCabDisplay(result.model.cab)}
                    </span>
                  </div>

                  <div className={styles.breakdownRow}>
                    <span className={styles.breakdownKey}>Condition</span>
                    <span className={styles.breakdownValue}>{conditionLabel(condition)}</span>
                  </div>

                  <div className={styles.breakdownRow}>
                    <span className={styles.breakdownKey}>Engine hours</span>
                    <span className={styles.breakdownValue}>
                      {Number(hours).toLocaleString('en-ZA')} engine hours
                    </span>
                  </div>

                  <div className={styles.breakdownRow}>
                    <span className={styles.breakdownKey}>Selected source</span>
                    <span className={styles.breakdownValue}>{headlineLabel}</span>
                  </div>

                  <div className={styles.breakdownRow}>
                    <span className={styles.breakdownKey}>Coverage</span>
                    <span className={styles.breakdownValue}>{getConfidenceLabel(result)}</span>
                  </div>
                </div>
              </article>

              <article className={styles.sideCard}>
                <div className={styles.rangeCardHead}>
                  <h2 className={styles.sideTitle}>Market Range</h2>
                  <span className={styles.rangeBadge}>
                    {result.marketCount} comp{result.marketCount === 1 ? '' : 's'}
                  </span>
                </div>

                <div className={styles.rangeCurrent}>{money(result.marketMid ?? headlineValue)}</div>

                <div className={styles.rangeTrack}>
                  <div className={styles.rangeFill} style={{ width: `${rangePercent}%` }} />
                  <div className={styles.rangePin} style={{ left: `${rangePercent}%` }} />
                </div>

                <div className={styles.rangeLabels}>
                  <span>{money(result.marketLow)}</span>
                  <span>{money(result.marketHigh)}</span>
                </div>

                <p className={styles.rangeNote}>
                  Based on similar {activeYear} models in the current local prototype set.
                </p>
              </article>

              <article className={styles.sideCard}>
                <h2 className={styles.sideTitle}>Data Sources</h2>

                <div className={styles.sourceList}>
                  <div className={styles.sourceItem}>
                    <strong className={styles.sourceItemTitle}>Live Market Listings</strong>
                    <span className={styles.sourceItemText}>
                      {result.marketCount} local prototype comparable listing
                      {result.marketCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className={styles.sourceItem}>
                    <strong className={styles.sourceItemTitle}>Aim4price Pricing Logic</strong>
                    <span className={styles.sourceItemText}>Age, usage and condition weighting</span>
                  </div>

                  <div className={styles.sourceItem}>
                    <strong className={styles.sourceItemTitle}>DALRRD Guidelines</strong>
                    <span className={styles.sourceItemText}>Power band and drive type reference</span>
                  </div>
                </div>
              </article>

              <article className={styles.sideCard}>
                <h2 className={styles.sideTitle}>Next Steps</h2>

                <div className={styles.actionStack}>
                  <button type="button" className={styles.secondaryButton} onClick={() => setStep(4)}>
                    Refine Inputs
                  </button>

                  <button type="button" className={styles.secondaryButton} onClick={handlePrint}>
                    Download PDF Report
                  </button>

                  <button type="button" className={styles.primaryButton} onClick={resetWizard}>
                    Start New Valuation
                  </button>
                </div>
              </article>
            </aside>
          </section>
        ) : null}
      </div>
    </main>
  );
}
