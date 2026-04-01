'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
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
} from '../../lib/tractor-data';
import { conditionLabel, money, range, runValuation, type Result } from '../../lib/tractor-logic';
import { saveItem } from '../../lib/register';

type Step = 1 | 2 | 3 | 4 | 5;
type MethodKey = 'aim4price' | 'market' | 'department';

type MethodCard = {
  key: MethodKey;
  label: string;
  note: string;
  value: number | null;
  available: boolean;
};

const INITIAL_MODEL_ID = 'john-deere-6135b-field-4wd-cab';

const WIZARD_STEPS: Array<{ step: Step; label: string }> = [
  { step: 1, label: 'Type' },
  { step: 2, label: 'Brand' },
  { step: 3, label: 'Model' },
  { step: 4, label: 'Inputs' },
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
        body: 'Select your equipment type. Tractor is the active category in this prototype.',
      };
    case 2:
      return {
        title: 'Choose Brand',
        body: 'Search or select a tractor brand. This step is text-based only, with no logo dependency.',
      };
    case 3:
      return {
        title: 'Select Tractor Model',
        body: 'Filter by drive and cab configuration, then choose the closest bundled test model.',
      };
    case 4:
      return {
        title: 'Enter Valuation Inputs',
        body: 'Choose the year model, input hours, and set the condition before generating the valuation.',
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

export default function ValuationClient() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [brandQuery, setBrandQuery] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [brandSlug, setBrandSlug] = useState('john-deere');
  const [drive, setDrive] = useState<DriveType>('4wd');
  const [cab, setCab] = useState<CabType>('cab');
  const [modelId, setModelId] = useState(INITIAL_MODEL_ID);
  const [year, setYear] = useState(2020);
  const [hours, setHours] = useState('3500');
  const [condition, setCondition] = useState<ConditionKey>('good');
  const [result, setResult] = useState<Result | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<MethodKey | null>(null);
  const [message, setMessage] = useState('');

  const stepMeta = getStepMeta(step);

  const matchingBrands = useMemo(
    () =>
      brands.filter((brand) =>
        !brandQuery.trim() ? true : brand.name.toLowerCase().includes(brandQuery.trim().toLowerCase()),
      ),
    [brandQuery],
  );

  const filteredModels = useMemo(
    () =>
      tractors.filter((tractor) => {
        const matchesBrand = tractor.brandSlug === brandSlug;
        const matchesDrive = tractor.drive === drive;
        const matchesCab = tractor.cab === cab;
        const matchesQuery = !modelQuery.trim()
          ? true
          : `${tractor.brandName} ${tractor.modelName}`.toLowerCase().includes(modelQuery.trim().toLowerCase());

        return matchesBrand && matchesDrive && matchesCab && matchesQuery;
      }),
    [brandSlug, drive, cab, modelQuery],
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
    if (!selectedModel) return;

    if (year < selectedModel.yearStart || year > selectedModel.yearEnd) {
      setYear(selectedModel.yearEnd);
    }
  }, [selectedModel, year]);

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
    if (step === 3) return Boolean(selectedModel);
    if (step === 4) return Boolean(selectedModel && Number(hours) > 0);
    return true;
  }, [step, selectedModel, hours]);

  const nextLabel =
    step === 1
      ? 'Choose Brand'
      : step === 2
        ? 'Choose Model'
        : step === 3
          ? 'Enter Inputs'
          : 'Get Valuation';

  function resetWizard() {
    setStep(1);
    setBrandQuery('');
    setModelQuery('');
    setBrandSlug('john-deere');
    setDrive('4wd');
    setCab('cab');
    setModelId(INITIAL_MODEL_ID);
    setYear(2020);
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

      if (!selectedModel || !Number.isFinite(parsedHours) || parsedHours <= 0) {
        setMessage('Enter operating hours greater than zero before running the valuation.');
        return;
      }

      const nextResult = runValuation({
        modelId: selectedModel.id,
        year,
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
      id: `${result.model.id}-${year}-${hours}-${selectedMethod}`,
      kind: 'tractor',
      title: `${result.model.brandName} ${result.model.modelName}`,
      brandName: result.model.brandName,
      modelName: result.model.modelName,
      drive: result.model.drive,
      tractorType: result.model.tractorType,
      yearModel: year,
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
      return (
        <div className={styles.typeGrid}>
          <button type="button" className={`${styles.typeCard} ${styles.typeCardActive}`}>
            <div className={styles.typeImageBox}>
              <Image
                src="/brand/Tractor.png"
                alt="Tractor equipment type"
                fill
                className={styles.typeImage}
                sizes="180px"
              />
            </div>
            <strong>Tractor</strong>
            <span>Active for prototype testing</span>
          </button>

          <div className={`${styles.typeCard} ${styles.typeCardDisabled}`}>
            <div className={styles.typeImageBox} />
            <strong>Combine</strong>
            <span>Coming soon</span>
          </div>

          <div className={`${styles.typeCard} ${styles.typeCardDisabled}`}>
            <div className={styles.typeImageBox} />
            <strong>Baler</strong>
            <span>Coming soon</span>
          </div>

          <div className={`${styles.typeCard} ${styles.typeCardDisabled}`}>
            <div className={styles.typeImageBox} />
            <strong>Sprayer</strong>
            <span>Coming soon</span>
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <>
          <div className={styles.searchWrap}>
            <input
              value={brandQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setBrandQuery(event.target.value)}
              placeholder="Search brands..."
              aria-label="Search brands"
              className={styles.searchInput}
            />
          </div>

          {matchingBrands.length ? (
            <div className={styles.brandGrid}>
              {matchingBrands.map((brand) => {
                const active = brandSlug === brand.slug;

                return (
                  <button
                    key={brand.slug}
                    type="button"
                    className={`${styles.brandCard} ${active ? styles.brandCardActive : ''}`}
                    onClick={() => {
                      setBrandSlug(brand.slug);
                      setModelQuery('');
                      setMessage('');
                    }}
                  >
                    {brand.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>No brands matched that search.</div>
          )}
        </>
      );
    }

    if (step === 3) {
      return (
        <>
          <div className={styles.filterToolbar}>
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
                  >
                    {value.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Cab</span>
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
                  >
                    {value === 'cab' ? 'Cab: Yes' : 'Cab: No'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.searchWrap}>
            <input
              value={modelQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setModelQuery(event.target.value)}
              placeholder="Search tractor models..."
              aria-label="Search tractor models"
              className={styles.searchInput}
            />
          </div>

          {filteredModels.length ? (
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
                      setYear(model.yearEnd);
                      setMessage('');
                    }}
                  >
                    <div>
                      <strong>
                        {model.brandName} {model.modelName}
                      </strong>
                      <span className={styles.modelRowMeta}>
                        {model.powerKw} kW • {model.drive.toUpperCase()} •{' '}
                        {model.cab === 'cab' ? 'Cab' : 'No cab'}
                      </span>
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
              No tractor models matched the current combination of brand, drive and cab.
            </div>
          )}

          {selectedModel ? (
            <div className={styles.selectionCard}>
              <div className={styles.selectionImageBox}>
                <Image
                  src="/brand/Tractor.png"
                  alt="Selected tractor"
                  fill
                  className={styles.typeImage}
                  sizes="120px"
                />
              </div>
              <div className={styles.selectionMeta}>
                <strong>
                  {selectedModel.brandName} {selectedModel.modelName}
                </strong>
                <span>
                  {selectedModel.powerKw} kW • {selectedModel.drive.toUpperCase()} •{' '}
                  {selectedModel.cab === 'cab' ? 'Cab' : 'No cab'}
                </span>
                <span>{selectedBrandName}</span>
              </div>
            </div>
          ) : null}
        </>
      );
    }

    return (
      <>
        <div className={styles.inputGrid}>
          <label className={styles.field}>
            <span>Choose Year Model</span>
            <select
              value={year}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setYear(Number(event.target.value))}
            >
              {years.map((availableYear) => (
                <option key={availableYear} value={availableYear}>
                  {availableYear}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Input Hours</span>
            <input
              value={hours}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setHours(event.target.value.replace(/[^0-9]/g, ''))
              }
              placeholder="3,500"
              inputMode="numeric"
            />
          </label>
        </div>

        <p className={styles.fieldHint}>Estimated by what is shown on the engine hour meter.</p>

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

        {selectedModel ? (
          <div className={styles.selectionCard}>
            <div className={styles.selectionImageBox}>
              <Image
                src="/brand/Tractor.png"
                alt="Selected tractor"
                fill
                className={styles.typeImage}
                sizes="120px"
              />
            </div>
            <div className={styles.selectionMeta}>
              <strong>
                {selectedModel.brandName} {selectedModel.modelName}
              </strong>
              <span>
                {selectedModel.powerKw} kW • {selectedModel.drive.toUpperCase()} •{' '}
                {selectedModel.cab === 'cab' ? 'Cab' : 'No cab'}
              </span>
              <span>Condition: {conditionLabel(condition)}</span>
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
                      <div key={item.step} className={styles.stepperItem}>
                        <span
                          className={`${styles.stepperBullet} ${
                            isActive ? styles.stepperBulletActive : ''
                          } ${isComplete ? styles.stepperBulletComplete : ''}`}
                        >
                          {isComplete ? '✓' : item.step}
                        </span>
                        <span className={styles.stepperLabel}>{item.label}</span>
                        {index < WIZARD_STEPS.length - 1 ? <span className={styles.stepperLine} /> : null}
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
                        Tractor • {year} • {result.model.powerKw} kW • {Number(hours).toLocaleString('en-ZA')} hours
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
                    <span className={styles.breakdownKey}>Condition</span>
                    <span className={styles.breakdownValue}>{conditionLabel(condition)}</span>
                  </div>

                  <div className={styles.breakdownRow}>
                    <span className={styles.breakdownKey}>Hours</span>
                    <span className={styles.breakdownValue}>
                      {Number(hours).toLocaleString('en-ZA')} hours
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
                  Based on similar {year} models in the current local prototype set.
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
