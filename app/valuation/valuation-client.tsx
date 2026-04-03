'use client';

import Image from 'next/image';
import { useMemo, useState, type ChangeEvent } from 'react';
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
type EquipmentType = 'tractor';
type MethodKey = 'aim4price' | 'market' | 'department';
type GpsType = 'full-autosteer' | 'guidance-only';

type MethodCard = {
  key: MethodKey;
  label: string;
  note: string;
  value: number | null;
  display: string;
  available: boolean;
};

const STEP_ITEMS: Array<{ step: Step; label: string }> = [
  { step: 1, label: 'Type' },
  { step: 2, label: 'Brand' },
  { step: 3, label: 'Model' },
  { step: 4, label: 'Details' },
  { step: 5, label: 'Value' },
];

const CURRENT_YEAR = new Date().getFullYear() + 1;

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

function getMethodDisplay(result: Result, method: MethodKey): string {
  if (method === 'market') {
    return range(result.marketLow, result.marketHigh);
  }

  return money(getMethodValue(result, method));
}

function getMethodLabel(method: MethodKey): string {
  if (method === 'aim4price') return 'Aim4price Value';
  if (method === 'market') return 'Estimated Market Value';
  return 'DALRRD Reference';
}

function getMethodNote(method: MethodKey): string {
  if (method === 'aim4price') return 'Depreciation, condition, age, hours and fitted extras.';
  if (method === 'market') return 'Comparable listings around your selected profile.';
  return 'Department-style reference based on power band and usage.';
}

function getStepTitle(step: Step): string {
  if (step === 1) return 'Choose equipment type';
  if (step === 2) return 'Choose brand';
  if (step === 3) return 'Choose tractor model';
  if (step === 4) return 'Enter tractor details';
  return 'Valuation results';
}

function getStepText(step: Step): string {
  if (step === 1) return 'Keep it simple. Start with the equipment class you want to value.';
  if (step === 2) return 'Search or scroll. Pick the brand to continue.';
  if (step === 3) return 'Finish the tractor setup, then choose the exact model.';
  if (step === 4) return 'Add the year, hours, condition and any fitted extras.';
  return 'Review the calculated values, comparables and next actions.';
}

function getTractorTypeLabel(value: TractorType): string {
  return value === 'orchard' ? 'Orchard' : 'Field';
}

function getDriveLabel(value: DriveType): string {
  return value === 'tracks' ? 'Tracks' : value.toUpperCase();
}

function getCabLabel(value: CabType): string {
  return value === 'cab' ? 'Cab' : 'Open station';
}

function getGpsTypeLabel(value: GpsType): string {
  return value === 'full-autosteer' ? 'Full autosteer' : 'Guidance only';
}

function getConfidenceTone(result: Result): 'high' | 'medium' | 'low' {
  if (result.marketCount >= 5) return 'high';
  if (result.marketCount >= 2) return 'medium';
  return 'low';
}

function getConfidenceLabel(result: Result): string {
  const tone = getConfidenceTone(result);
  if (tone === 'high') return 'High confidence';
  if (tone === 'medium') return 'Medium confidence';
  return 'Low confidence';
}

function getCoverageLabel(result: Result): string {
  if (result.coverageBand === 'green') return 'All three value signals available';
  if (result.coverageBand === 'amber') return 'Two value signals available';
  return 'Single value signal available';
}

function getRangePercent(low: number | null, high: number | null, value: number | null): number {
  if (low === null || high === null || value === null || high <= low) {
    return 50;
  }

  const percent = ((value - low) / (high - low)) * 100;
  return Math.max(0, Math.min(100, percent));
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
    let label = 'GPS';

    if (gpsType) {
      label += ` • ${getGpsTypeLabel(gpsType)}`;
    }

    if (gpsYear.trim()) {
      label += ` • ${gpsYear.trim()}`;
    }

    chips.push(label);
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

export default function ValuationClient() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [selectedType, setSelectedType] = useState<EquipmentType | null>(null);
  const [brandSlug, setBrandSlug] = useState('john-deere');
  const [brandSearch, setBrandSearch] = useState('');
  const [tractorType, setTractorType] = useState<TractorType | null>(null);
  const [drive, setDrive] = useState<DriveType | null>(null);
  const [cab, setCab] = useState<CabType | null>(null);
  const [modelQuery, setModelQuery] = useState('');
  const [modelId, setModelId] = useState('');
  const [yearMode, setYearMode] = useState<'guided' | 'manual'>('guided');
  const [year, setYear] = useState<number | null>(null);
  const [manualYear, setManualYear] = useState('');
  const [hours, setHours] = useState('');
  const [condition, setCondition] = useState<ConditionKey>('good');
  const [frontPto, setFrontPto] = useState(false);
  const [frontLoader, setFrontLoader] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsType, setGpsType] = useState<GpsType>('guidance-only');
  const [gpsYear, setGpsYear] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<MethodKey | null>(null);
  const [selectedComparableIndex, setSelectedComparableIndex] = useState(0);
  const [message, setMessage] = useState('');

  const sortedBrands = useMemo(
    () => [...brands].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
    [],
  );

  const filteredBrands = useMemo(() => {
    const query = brandSearch.trim().toLowerCase();

    if (!query) {
      return sortedBrands;
    }

    return sortedBrands.filter((brand) => brand.name.toLowerCase().includes(query));
  }, [brandSearch, sortedBrands]);

  const selectedBrand = useMemo(
    () => sortedBrands.find((brand) => brand.slug === brandSlug) ?? sortedBrands[0],
    [brandSlug, sortedBrands],
  );

  const matchingModels = useMemo(() => {
    if (!tractorType || !drive || !cab) {
      return [];
    }

    return tractors.filter(
      (tractor) =>
        tractor.brandSlug === brandSlug &&
        tractor.tractorType === tractorType &&
        tractor.drive === drive &&
        tractor.cab === cab,
    );
  }, [brandSlug, cab, drive, tractorType]);

  const filteredModels = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();

    if (!query) {
      return matchingModels;
    }

    return matchingModels.filter((tractor) => {
      return [
        tractor.brandName,
        tractor.modelName,
        tractor.tractorType,
        tractor.drive,
        tractor.cab,
        tractor.powerKw,
        tractor.powerHp,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [matchingModels, modelQuery]);

  const selectedModel = useMemo<TractorCatalogRow | null>(
    () => matchingModels.find((tractor) => tractor.id === modelId) ?? null,
    [matchingModels, modelId],
  );

  const guidedYears = useMemo(() => {
    if (!selectedModel) {
      return [] as number[];
    }

    const values: number[] = [];
    for (let current = selectedModel.yearEnd; current >= selectedModel.yearStart; current -= 1) {
      values.push(current);
    }

    return values;
  }, [selectedModel]);

  const activeYear = useMemo(() => {
    if (yearMode === 'guided') {
      return year;
    }

    const parsed = Number(manualYear);
    if (!Number.isInteger(parsed)) {
      return null;
    }

    return parsed;
  }, [manualYear, year, yearMode]);

  const extrasSummaryChips = useMemo(
    () => buildExtrasSummaryChips(frontPto, frontLoader, gpsEnabled, gpsType, gpsYear),
    [frontPto, frontLoader, gpsEnabled, gpsType, gpsYear],
  );

  const extrasSummaryText = useMemo(
    () => buildExtrasSummaryText(frontPto, frontLoader, gpsEnabled, gpsType, gpsYear),
    [frontPto, frontLoader, gpsEnabled, gpsType, gpsYear],
  );

  const methodCards = useMemo<MethodCard[]>(() => {
    if (!result) {
      return [
        {
          key: 'aim4price',
          label: 'Aim4price Value',
          note: getMethodNote('aim4price'),
          value: null,
          display: 'Unavailable',
          available: false,
        },
        {
          key: 'market',
          label: 'Estimated Market Value',
          note: getMethodNote('market'),
          value: null,
          display: 'Unavailable',
          available: false,
        },
        {
          key: 'department',
          label: 'DALRRD Reference',
          note: getMethodNote('department'),
          value: null,
          display: 'Unavailable',
          available: false,
        },
      ];
    }

    return (['aim4price', 'market', 'department'] as MethodKey[]).map((method) => ({
      key: method,
      label: getMethodLabel(method),
      note: getMethodNote(method),
      value: getMethodValue(result, method),
      display: getMethodDisplay(result, method),
      available: getMethodValue(result, method) !== null,
    }));
  }, [result]);

  const selectedMethodCard = useMemo(
    () => methodCards.find((card) => card.key === selectedMethod) ?? null,
    [methodCards, selectedMethod],
  );

  const selectedComparable = result?.marketSources[selectedComparableIndex] ?? null;

  function resetModelState() {
    setModelQuery('');
    setModelId('');
    setYearMode('guided');
    setYear(null);
    setManualYear('');
    setHours('');
    setCondition('good');
    setFrontPto(false);
    setFrontLoader(false);
    setGpsEnabled(false);
    setGpsType('guidance-only');
    setGpsYear('');
    setResult(null);
    setSelectedMethod(null);
    setSelectedComparableIndex(0);
  }

  function handleBrandSelect(nextSlug: string) {
    if (nextSlug === brandSlug) {
      setMessage('');
      return;
    }

    setBrandSlug(nextSlug);
    setTractorType(null);
    setDrive(null);
    setCab(null);
    resetModelState();
    setMessage('');
  }

  function handleSelectModel(model: TractorCatalogRow) {
    setModelId(model.id);
    setYear(model.yearEnd);
    setManualYear('');
    setResult(null);
    setSelectedMethod(null);
    setSelectedComparableIndex(0);
    setMessage('');
  }

  function handleNext() {
    setMessage('');

    if (step === 1) {
      if (!selectedType) {
        setMessage('Choose an equipment type first.');
        return;
      }

      setStep(2);
      return;
    }

    if (step === 2) {
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!tractorType || !drive || !cab || !selectedModel) {
        setMessage('Complete the tractor setup and choose a model.');
        return;
      }

      setStep(4);
      return;
    }

    if (step === 4) {
      if (!selectedModel) {
        setMessage('Choose a model first.');
        setStep(3);
        return;
      }

      if (!activeYear || activeYear < 1950 || activeYear > CURRENT_YEAR) {
        setMessage(`Enter a valid year between 1950 and ${CURRENT_YEAR}.`);
        return;
      }

      const parsedHours = Number(hours);
      if (!Number.isFinite(parsedHours) || parsedHours < 0) {
        setMessage('Enter engine hours to continue.');
        return;
      }

      if (gpsEnabled) {
        const parsedGpsYear = gpsYear.trim() ? Number(gpsYear) : activeYear;
        if (!Number.isInteger(parsedGpsYear) || parsedGpsYear < 1950 || parsedGpsYear > CURRENT_YEAR) {
          setMessage(`Enter a valid GPS year between 1950 and ${CURRENT_YEAR}.`);
          return;
        }
      }

      try {
        const nextResult = runValuation({
          modelId: selectedModel.id,
          year: activeYear,
          hours: parsedHours,
          condition,
          frontPto,
          frontLoader,
          gpsEnabled,
          gpsType,
          gpsYear: gpsEnabled ? gpsYear.trim() || String(activeYear) : null,
        });

        setResult(nextResult);
        setSelectedComparableIndex(0);

        const defaultMethod: MethodKey =
          nextResult.marketMid !== null
            ? 'market'
            : nextResult.aim4priceValueExVat !== null
              ? 'aim4price'
              : 'department';

        setSelectedMethod(defaultMethod);
        setStep(5);
      } catch {
        setMessage('Unable to calculate this valuation. Please review the tractor details.');
      }

      return;
    }
  }

  function handleBack() {
    setMessage('');
    setStep(previousStep(step));
  }

  function handleMethodSelect(method: MethodKey) {
    if (!result) return;

    const value = getMethodValue(result, method);
    if (value === null) return;

    setSelectedMethod(method);
    setMessage('');
  }

  function handleSave() {
    if (!result || !selectedMethod || !activeYear) {
      setMessage('Choose which number should be saved first.');
      return;
    }

    const value = getMethodValue(result, selectedMethod);

    if (value === null) {
      setMessage('That method is not available for this tractor profile.');
      return;
    }

    saveItem({
      id: `${result.model.id}-${activeYear}-${hours}-${condition}-${frontPto ? 'pto' : 'no-pto'}-${frontLoader ? 'loader' : 'no-loader'}-${gpsEnabled ? `gps-${gpsType}-${gpsYear || activeYear}` : 'no-gps'}-${selectedMethod}`,
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

    setMessage('Saved locally to Asset Register prototype storage.');
  }

  function handleStartAgain() {
    setStep(1);
    setSelectedType(null);
    setBrandSearch('');
    setBrandSlug('john-deere');
    setTractorType(null);
    setDrive(null);
    setCab(null);
    resetModelState();
    setMessage('');
  }

  function handleViewMarketplace() {
    const search = new URLSearchParams();

    if (selectedBrand?.slug) {
      search.set('brand', selectedBrand.slug);
    }

    if (selectedModel?.modelName) {
      search.set('model', selectedModel.modelName);
    }

    router.push(`/marketplace${search.toString() ? `?${search.toString()}` : ''}`);
  }

  function handlePrint() {
    if (typeof window === 'undefined') return;
    window.print();
  }

  function renderStepBody() {
    if (step === 1) {
      return (
        <div className={styles.typeGrid}>
          <button
            type="button"
            className={`${styles.typeCard} ${selectedType === 'tractor' ? styles.typeCardActive : ''}`}
            onClick={() => {
              setSelectedType('tractor');
              setMessage('');
            }}
            aria-pressed={selectedType === 'tractor'}
          >
            <div className={styles.typeMedia}>
              <Image src="/brand/Tractor.png" alt="Tractor" fill className={styles.typeImage} sizes="260px" />
            </div>
            <div className={styles.typeText}>
              <strong>Tractor</strong>
              <span>Start the valuation flow for a tractor profile.</span>
            </div>
          </button>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className={styles.brandPanel}>
          <div className={styles.inputGroup}>
            <label htmlFor="brand-search" className={styles.inputLabel}>
              Search brand
            </label>
            <input
              id="brand-search"
              value={brandSearch}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setBrandSearch(event.target.value)}
              placeholder="Start typing a brand..."
              className={styles.textInput}
            />
          </div>

          <div className={styles.brandList} role="listbox" aria-label="Brands">
            {filteredBrands.map((brand) => {
              const active = brand.slug === brandSlug;

              return (
                <button
                  key={brand.slug}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`${styles.brandButton} ${active ? styles.brandButtonActive : ''}`}
                  onClick={() => handleBrandSelect(brand.slug)}
                >
                  <span>{brand.name}</span>
                  {active ? <small>Selected</small> : null}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className={styles.modelStep}>
          <div className={styles.segmentBlock}>
            <div className={styles.segmentHeader}>
              <span className={styles.inputLabel}>Tractor type</span>
            </div>
            <div className={styles.segmentRow}>
              {(['field', 'orchard'] as TractorType[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.segmentButton} ${tractorType === value ? styles.segmentButtonActive : ''}`}
                  onClick={() => {
                    setTractorType(value);
                    setDrive(null);
                    setCab(null);
                    resetModelState();
                    setMessage('');
                  }}
                >
                  {getTractorTypeLabel(value)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.segmentBlock}>
            <div className={styles.segmentHeader}>
              <span className={styles.inputLabel}>Drive</span>
            </div>
            <div className={styles.segmentRow}>
              {(['2wd', '4wd', 'tracks'] as DriveType[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={!tractorType}
                  className={`${styles.segmentButton} ${drive === value ? styles.segmentButtonActive : ''}`}
                  onClick={() => {
                    setDrive(value);
                    setCab(null);
                    resetModelState();
                    setMessage('');
                  }}
                >
                  {getDriveLabel(value)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.segmentBlock}>
            <div className={styles.segmentHeader}>
              <span className={styles.inputLabel}>Cab</span>
            </div>
            <div className={styles.segmentRow}>
              {(['cab', 'open-station'] as CabType[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={!drive}
                  className={`${styles.segmentButton} ${cab === value ? styles.segmentButtonActive : ''}`}
                  onClick={() => {
                    setCab(value);
                    resetModelState();
                    setMessage('');
                  }}
                >
                  {getCabLabel(value)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="model-search" className={styles.inputLabel}>
              Search model
            </label>
            <input
              id="model-search"
              value={modelQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setModelQuery(event.target.value)}
              placeholder={selectedModel ? selectedModel.modelName : 'Search model name...'}
              className={styles.textInput}
              disabled={!tractorType || !drive || !cab}
            />
          </div>

          <div className={styles.modelList}>
            {filteredModels.length ? (
              filteredModels.map((model) => {
                const active = model.id === modelId;

                return (
                  <button
                    key={model.id}
                    type="button"
                    className={`${styles.modelCard} ${active ? styles.modelCardActive : ''}`}
                    onClick={() => handleSelectModel(model)}
                  >
                    <div className={styles.modelCardTop}>
                      <strong>{model.brandName} {model.modelName}</strong>
                      <span>{model.powerKw} kW · {model.powerHp} hp</span>
                    </div>
                    <div className={styles.modelCardMeta}>
                      <span>{getTractorTypeLabel(model.tractorType)}</span>
                      <span>{getDriveLabel(model.drive)}</span>
                      <span>{getCabLabel(model.cab)}</span>
                      <span>{model.yearStart}–{model.yearEnd}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className={styles.emptyState}>
                {!tractorType || !drive || !cab
                  ? 'Choose tractor type, drive and cab to load models.'
                  : 'No models match this setup yet.'}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (step === 4) {
      return (
        <div className={styles.detailsStep}>
          <div className={styles.detailGrid}>
            <div className={styles.inputGroup}>
              <span className={styles.inputLabel}>Year model</span>
              <div className={styles.segmentRow}>
                <button
                  type="button"
                  className={`${styles.segmentButton} ${yearMode === 'guided' ? styles.segmentButtonActive : ''}`}
                  onClick={() => {
                    setYearMode('guided');
                    if (!year && guidedYears.length) {
                      setYear(guidedYears[0]);
                    }
                  }}
                >
                  Guided
                </button>
                <button
                  type="button"
                  className={`${styles.segmentButton} ${yearMode === 'manual' ? styles.segmentButtonActive : ''}`}
                  onClick={() => setYearMode('manual')}
                >
                  Other
                </button>
              </div>

              {yearMode === 'guided' ? (
                <select
                  value={year ?? ''}
                  onChange={(event) => setYear(event.target.value ? Number(event.target.value) : null)}
                  className={styles.selectInput}
                >
                  <option value="">Select year</option>
                  {guidedYears.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={manualYear}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setManualYear(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  inputMode="numeric"
                  placeholder="Type year model"
                  className={styles.textInput}
                />
              )}
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="engine-hours" className={styles.inputLabel}>
                Engine hours
              </label>
              <input
                id="engine-hours"
                value={hours}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setHours(event.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                placeholder="Type engine hours here"
                className={styles.textInput}
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <span className={styles.inputLabel}>Condition</span>
            <div className={styles.conditionGrid}>
              {conditionOptions.map((option) => {
                const active = option.key === condition;

                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`${styles.conditionCard} ${active ? styles.conditionCardActive : ''}`}
                    onClick={() => setCondition(option.key)}
                  >
                    <strong>{option.label}</strong>
                    <span>{conditionLabel(option.key)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.extrasGrid}>
            <button
              type="button"
              className={`${styles.toggleCard} ${frontPto ? styles.toggleCardActive : ''}`}
              onClick={() => setFrontPto((value) => !value)}
              aria-pressed={frontPto}
            >
              <strong>Front Hitch & Front PTO</strong>
              <span>Add fitted PTO and hitch value where applicable.</span>
            </button>

            <button
              type="button"
              className={`${styles.toggleCard} ${frontLoader ? styles.toggleCardActive : ''}`}
              onClick={() => setFrontLoader((value) => !value)}
              aria-pressed={frontLoader}
            >
              <strong>Front Loader</strong>
              <span>Include a loader adjustment in the output value.</span>
            </button>

            <button
              type="button"
              className={`${styles.toggleCard} ${gpsEnabled ? styles.toggleCardActive : ''}`}
              onClick={() => setGpsEnabled((value) => !value)}
              aria-pressed={gpsEnabled}
            >
              <strong>GPS</strong>
              <span>Add guidance or autosteer equipment value.</span>
            </button>
          </div>

          {gpsEnabled ? (
            <div className={styles.gpsPanel}>
              <div className={styles.inputGroup}>
                <span className={styles.inputLabel}>GPS type</span>
                <div className={styles.segmentRow}>
                  {(['guidance-only', 'full-autosteer'] as GpsType[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`${styles.segmentButton} ${gpsType === value ? styles.segmentButtonActive : ''}`}
                      onClick={() => setGpsType(value)}
                    >
                      {getGpsTypeLabel(value)}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="gps-year" className={styles.inputLabel}>
                  GPS year
                </label>
                <input
                  id="gps-year"
                  value={gpsYear}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setGpsYear(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  inputMode="numeric"
                  placeholder="Type GPS year"
                  className={styles.textInput}
                />
              </div>
            </div>
          ) : null}

          <div className={styles.reviewCard}>
            <div className={styles.reviewHeader}>
              <strong>Ready to calculate</strong>
              <span>{selectedModel ? `${selectedModel.brandName} ${selectedModel.modelName}` : 'Select a model'}</span>
            </div>
            <div className={styles.reviewMeta}>
              <span>{activeYear || 'Year not set'}</span>
              <span>{hours ? `${Number(hours).toLocaleString('en-ZA')} hours` : 'Hours not set'}</span>
              <span>{conditionLabel(condition)}</span>
              <span>{extrasSummaryText}</span>
            </div>
          </div>
        </div>
      );
    }

    if (!result) {
      return null;
    }

    const confidenceTone = getConfidenceTone(result);
    const selectedValue = selectedMethod ? getMethodValue(result, selectedMethod) : result.previewValueExVat;
    const selectedRangePercent = getRangePercent(result.marketLow, result.marketHigh, selectedValue);

    return (
      <div className={styles.resultsLayout}>
        <section className={`${styles.resultHero} ${confidenceTone === 'high' ? styles.resultHeroHigh : confidenceTone === 'medium' ? styles.resultHeroMedium : styles.resultHeroLow}`}>
          <div className={styles.resultHeroTop}>
            <div>
              <span className={styles.kickerLight}>{getConfidenceLabel(result)}</span>
              <h2>{selectedMethodCard?.label ?? result.previewLabel}</h2>
              <p>{selectedMethodCard?.note ?? 'Choose the number you want to save and work from.'}</p>
            </div>
            <div className={styles.primaryValueCard}>
              <span>Selected value</span>
              <strong>{selectedMethodCard?.display ?? money(result.previewValueExVat)}</strong>
              <small>{getCoverageLabel(result)}</small>
            </div>
          </div>

          <div className={styles.rangeCard}>
            <div className={styles.rangeHeader}>
              <span>Market range</span>
              <strong>{range(result.marketLow, result.marketHigh)}</strong>
            </div>
            <div className={styles.rangeTrack} aria-hidden="true">
              <span className={styles.rangeFill} style={{ width: `${selectedRangePercent}%` }} />
              <span className={styles.rangeMarker} style={{ left: `${selectedRangePercent}%` }} />
            </div>
            <div className={styles.rangeLabels}>
              <small>{money(result.marketLow)}</small>
              <small>{money(result.marketHigh)}</small>
            </div>
          </div>
        </section>

        <section className={styles.methodSection}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.kicker}>Value methods</span>
              <h3>Choose the number to use</h3>
            </div>
          </div>

          <div className={styles.methodGrid}>
            {methodCards.map((card) => {
              const active = card.key === selectedMethod;

              return (
                <button
                  key={card.key}
                  type="button"
                  disabled={!card.available}
                  className={`${styles.methodCard} ${active ? styles.methodCardActive : ''} ${!card.available ? styles.methodCardDisabled : ''}`}
                  onClick={() => handleMethodSelect(card.key)}
                >
                  <div className={styles.methodCardTop}>
                    <strong>{card.label}</strong>
                    {active ? <span className={styles.methodBadge}>Selected</span> : null}
                  </div>
                  <div className={styles.methodValue}>{card.display}</div>
                  <p>{card.note}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.summarySection}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.kicker}>Summary</span>
              <h3>Tractor profile and value drivers</h3>
            </div>
          </div>

          <div className={styles.summaryGrid}>
            <article className={styles.infoCard}>
              <span className={styles.infoLabel}>Profile</span>
              <strong>{result.model.brandName} {result.model.modelName}</strong>
              <div className={styles.infoMeta}>
                <span>{getTractorTypeLabel(result.model.tractorType)}</span>
                <span>{getDriveLabel(result.model.drive)}</span>
                <span>{getCabLabel(result.model.cab)}</span>
                <span>{activeYear}</span>
                <span>{Number(hours).toLocaleString('en-ZA')} hours</span>
                <span>{conditionLabel(condition)}</span>
              </div>
            </article>

            <article className={styles.infoCard}>
              <span className={styles.infoLabel}>Replacement price</span>
              <strong>{money(result.model.replacementPriceExVat)}</strong>
              <p>Used as the styling-stage baseline for the current valuation model.</p>
            </article>

            <article className={styles.infoCard}>
              <span className={styles.infoLabel}>Extras added</span>
              <strong>{money(result.extrasValueExVat)}</strong>
              <div className={styles.infoMeta}>
                {extrasSummaryChips.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
          </div>

          <div className={styles.breakdownGrid}>
            <article className={styles.breakdownCard}>
              <span className={styles.breakdownLabel}>Front Hitch & Front PTO</span>
              <strong>{money(result.frontPtoValueExVat)}</strong>
            </article>
            <article className={styles.breakdownCard}>
              <span className={styles.breakdownLabel}>Front Loader</span>
              <strong>{money(result.frontLoaderValueExVat)}</strong>
            </article>
            <article className={styles.breakdownCard}>
              <span className={styles.breakdownLabel}>GPS</span>
              <strong>{money(result.gpsValueExVat)}</strong>
            </article>
          </div>
        </section>

        <section className={styles.comparablesSection}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.kicker}>Provable market listings</span>
              <h3>Comparable market sources</h3>
            </div>
            <div className={styles.sectionStat}>{result.marketCount} listing{result.marketCount === 1 ? '' : 's'}</div>
          </div>

          {result.marketSources.length ? (
            <>
              <div className={styles.comparablesList}>
                {result.marketSources.map((listing, index) => {
                  const active = index === selectedComparableIndex;
                  const comparablePrice = getListingComparablePrice(listing, result.extrasValueExVat);

                  return (
                    <button
                      key={listing.id}
                      type="button"
                      className={`${styles.comparableCard} ${active ? styles.comparableCardActive : ''}`}
                      onClick={() => setSelectedComparableIndex(index)}
                    >
                      <div className={styles.comparableTop}>
                        <strong>{listing.brandName} {listing.modelName}</strong>
                        <span>{money(comparablePrice)}</span>
                      </div>
                      <div className={styles.comparableMeta}>
                        <span>{listing.yearModel}</span>
                        <span>{listing.hours.toLocaleString('en-ZA')} hours</span>
                        <span>{listing.area}, {listing.province}</span>
                        <span>{formatListingDate(listing.dateAdvertised)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedComparable ? (
                <div className={styles.comparablePreview}>
                  <div className={styles.comparablePreviewTop}>
                    <div>
                      <span className={styles.infoLabel}>Selected comparable</span>
                      <strong>{selectedComparable.brandName} {selectedComparable.modelName}</strong>
                    </div>
                    <div className={styles.previewValue}>{money(getListingComparablePrice(selectedComparable, result.extrasValueExVat))}</div>
                  </div>

                  <div className={styles.previewMeta}>
                    <span>{selectedComparable.yearModel}</span>
                    <span>{selectedComparable.hours.toLocaleString('en-ZA')} hours</span>
                    <span>{selectedComparable.area}, {selectedComparable.province}</span>
                    <span>{selectedComparable.sourceName}</span>
                    <span>{formatListingDate(selectedComparable.dateAdvertised)}</span>
                  </div>

                  {selectedComparable.sourceUrl ? (
                    <a href={selectedComparable.sourceUrl} target="_blank" rel="noreferrer" className={styles.linkButton}>
                      Open source listing
                    </a>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className={styles.emptyState}>No market comparables matched this tractor profile yet.</div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <AppHeader active="valuation" ctaHref="/asset-register" ctaLabel="Asset Register" />

      <div className={styles.inner}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.kickerLight}>Valuation</span>
            <h1>Make valuation feel simple, clear and trustworthy.</h1>
            <p>
              Use the current styling prototype to move from tractor setup to value output with a cleaner,
              more confident flow.
            </p>
          </div>

          <div className={styles.heroStats}>
            <article className={styles.heroStat}>
              <span>Brand</span>
              <strong>{selectedBrand?.name ?? 'Choose'}</strong>
            </article>
            <article className={styles.heroStat}>
              <span>Model</span>
              <strong>{selectedModel ? selectedModel.modelName : 'Not selected'}</strong>
            </article>
            <article className={styles.heroStat}>
              <span>Current step</span>
              <strong>{STEP_ITEMS.find((item) => item.step === step)?.label}</strong>
            </article>
          </div>
        </section>

        <div className={styles.shell}>
          <main className={styles.mainColumn}>
            <section className={styles.wizardCard}>
              <div className={styles.stepper} aria-label="Valuation steps">
                {STEP_ITEMS.map((item) => {
                  const complete = step > item.step;
                  const active = step === item.step;

                  return (
                    <div
                      key={item.step}
                      className={`${styles.stepItem} ${active ? styles.stepItemActive : ''} ${complete ? styles.stepItemComplete : ''}`}
                    >
                      <span className={styles.stepNumber}>{complete ? '✓' : item.step}</span>
                      <span className={styles.stepLabel}>{item.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className={styles.cardBody}>
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.kicker}>{STEP_ITEMS.find((item) => item.step === step)?.label}</span>
                    <h2>{getStepTitle(step)}</h2>
                    <p>{getStepText(step)}</p>
                  </div>
                </div>

                {message ? <div className={styles.notice}>{message}</div> : null}

                {renderStepBody()}
              </div>

              <div className={styles.cardFooter}>
                <button type="button" className={styles.secondaryButton} onClick={handleBack} disabled={step === 1}>
                  Back
                </button>

                {step < 5 ? (
                  <button type="button" className={styles.primaryButton} onClick={handleNext}>
                    {step === 4 ? 'Calculate value' : 'Continue'}
                  </button>
                ) : (
                  <div className={styles.footerActions}>
                    <button type="button" className={styles.secondaryButton} onClick={() => setStep(4)}>
                      Edit details
                    </button>
                    <button type="button" className={styles.primaryButton} onClick={handleSave}>
                      Save to Asset Register
                    </button>
                  </div>
                )}
              </div>
            </section>
          </main>

          <aside className={styles.rail}>
            <section className={styles.sideCard}>
              <span className={styles.kicker}>Current setup</span>
              <h3>Live valuation summary</h3>
              <div className={styles.sideList}>
                <div className={styles.sideRow}>
                  <span>Type</span>
                  <strong>{selectedType === 'tractor' ? 'Tractor' : 'Not selected'}</strong>
                </div>
                <div className={styles.sideRow}>
                  <span>Brand</span>
                  <strong>{selectedBrand?.name ?? 'Not selected'}</strong>
                </div>
                <div className={styles.sideRow}>
                  <span>Model</span>
                  <strong>{selectedModel ? `${selectedModel.brandName} ${selectedModel.modelName}` : 'Not selected'}</strong>
                </div>
                <div className={styles.sideRow}>
                  <span>Details</span>
                  <strong>
                    {activeYear ? `${activeYear}` : 'Year pending'}
                    {hours ? ` · ${Number(hours).toLocaleString('en-ZA')} hrs` : ''}
                  </strong>
                </div>
                <div className={styles.sideRow}>
                  <span>Condition</span>
                  <strong>{conditionLabel(condition)}</strong>
                </div>
              </div>
            </section>

            <section className={styles.sideCardAlt}>
              <span className={styles.kicker}>Fitted extras</span>
              <h3>What is included</h3>
              <div className={styles.chipList}>
                {extrasSummaryChips.map((item) => (
                  <span key={item} className={styles.chip}>
                    {item}
                  </span>
                ))}
              </div>
            </section>

            {step === 5 && result ? (
              <section className={styles.sideCardAlt}>
                <span className={styles.kicker}>Next actions</span>
                <h3>Keep moving</h3>
                <div className={styles.actionStack}>
                  <button type="button" className={styles.primaryButtonWide} onClick={handleSave}>
                    Save to Asset Register
                  </button>
                  <button type="button" className={styles.secondaryButtonWide} onClick={handleViewMarketplace}>
                    View Marketplace
                  </button>
                  <button type="button" className={styles.secondaryButtonWide} onClick={handlePrint}>
                    Print result
                  </button>
                  <button type="button" className={styles.secondaryButtonWide} onClick={handleStartAgain}>
                    Start new valuation
                  </button>
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
