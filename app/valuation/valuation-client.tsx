'use client';

import Image from 'next/image';
import Link from 'next/link';
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
  type TractorType,
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
  if (method === 'aim4price') return 'Aim4price value';
  if (method === 'market') return 'Market midpoint';
  return 'Department guideline';
}

function coverageLabel(band: Result['coverageBand']): string {
  if (band === 'green') return 'High overlap';
  if (band === 'amber') return 'Partial overlap';
  return 'Low overlap';
}

function coverageText(band: Result['coverageBand']): string {
  if (band === 'green') return 'All three methods returned a usable number.';
  if (band === 'amber') return 'Two valuation methods returned a usable number.';
  return 'Only one valuation method returned a usable number.';
}

function coverageClassName(band: Result['coverageBand']): string {
  if (band === 'green') return styles.coverageGreen;
  if (band === 'amber') return styles.coverageAmber;
  return styles.coverageRed;
}

function getRangePercent(low: number | null, high: number | null, value: number | null): number {
  if (low === null || high === null || value === null) return 50;
  if (high <= low) return 50;

  const percent = ((value - low) / (high - low)) * 100;
  return Math.min(100, Math.max(0, percent));
}

function getStepCopy(step: Step) {
  switch (step) {
    case 1:
      return {
        eyebrow: 'Step 1 of 5',
        title: 'Start with tractors only',
        body: 'This build keeps the first release scoped to tractor valuations so the main flow is stable and easy to test.',
      };
    case 2:
      return {
        eyebrow: 'Step 2 of 5',
        title: 'Choose the tractor brand',
        body: 'Search the bundled brand list and pick the manufacturer before filtering down to the actual tractor model.',
      };
    case 3:
      return {
        eyebrow: 'Step 3 of 5',
        title: 'Filter to the right tractor model',
        body: 'Use tractor type, drive and cab filters to reduce the model list before selecting the exact unit profile.',
      };
    case 4:
      return {
        eyebrow: 'Step 4 of 5',
        title: 'Enter the valuation inputs',
        body: 'Set the year model, hours and condition, then calculate the three values and compare them on the result screen.',
      };
    default:
      return {
        eyebrow: 'Step 5 of 5',
        title: 'Review the value stack',
        body: 'Compare the three valuation methods, choose the number you want to foreground, and keep the next action obvious.',
      };
  }
}

export default function ValuationClient() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [brandQuery, setBrandQuery] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [brandSlug, setBrandSlug] = useState('john-deere');
  const [tractorType, setTractorType] = useState<TractorType>('field');
  const [drive, setDrive] = useState<DriveType>('4wd');
  const [cab, setCab] = useState<CabType>('cab');
  const [modelId, setModelId] = useState(INITIAL_MODEL_ID);
  const [year, setYear] = useState(2020);
  const [hours, setHours] = useState('3500');
  const [condition, setCondition] = useState<ConditionKey>('good');
  const [result, setResult] = useState<Result | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<MethodKey | null>(null);
  const [message, setMessage] = useState('');

  const stepCopy = getStepCopy(step);

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
        const matchesType = tractor.tractorType === tractorType;
        const matchesDrive = tractor.drive === drive;
        const matchesCab = tractor.cab === cab;
        const matchesQuery = !modelQuery.trim()
          ? true
          : `${tractor.brandName} ${tractor.modelName}`.toLowerCase().includes(modelQuery.trim().toLowerCase());

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

  const methodCards = useMemo<MethodCard[]>(() => {
    if (!result) return [];

    return [
      {
        key: 'aim4price',
        label: 'Aim4price value',
        note: 'Age, usage and condition are all reflected here.',
        value: result.aim4priceValueExVat,
        available: result.aim4priceValueExVat !== null,
      },
      {
        key: 'market',
        label: 'Market midpoint',
        note: result.marketCount
          ? `${result.marketCount} matching comparable${result.marketCount === 1 ? '' : 's'} in the current filter.`
          : 'No market midpoint was available for this profile.',
        value: result.marketMid,
        available: result.marketMid !== null,
      },
      {
        key: 'department',
        label: 'Department guideline',
        note: 'Replacement less hourly depreciation, subject to the salvage floor.',
        value: result.departmentValueExVat,
        available: result.departmentValueExVat !== null,
      },
    ];
  }, [result]);

  const selectedMethodValue = result && selectedMethod ? getMethodValue(result, selectedMethod) : null;
  const headlineValue = selectedMethodValue ?? result?.previewValueExVat ?? null;
  const headlineLabel = selectedMethod ? getMethodLabel(selectedMethod) : result?.previewLabel ?? 'Preview value';
  const rangePercent = getRangePercent(
    result?.marketLow ?? null,
    result?.marketHigh ?? null,
    selectedMethod === 'market' ? selectedMethodValue : result?.previewValueExVat ?? result?.marketMid ?? null,
  );

  const canContinue = useMemo(() => {
    if (step === 3) return Boolean(selectedModel);
    if (step === 4) return Boolean(selectedModel && Number(hours) > 0);
    return true;
  }, [step, selectedModel, hours]);

  const nextLabel =
    step === 1 ? 'Choose brand' : step === 2 ? 'Choose model' : step === 3 ? 'Enter inputs' : 'Get valuation';

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
      const defaultMethod: MethodKey = nextResult.marketMid !== null ? 'market' : nextResult.aim4priceValueExVat !== null ? 'aim4price' : 'department';
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

  function renderBuilderContent() {
    if (step === 1) {
      return (
        <div className={styles.typePanel}>
          <div className={styles.typeImageWrap}>
            <Image
              src="/images/tractor-generic.png"
              alt="Tractor preview"
              fill
              className={styles.coverImage}
              sizes="(max-width: 960px) 100vw, 40vw"
            />
          </div>
          <div>
            <h2 className={styles.blockTitle}>Tractor valuations are the active scope.</h2>
            <p className={styles.blockBody}>
              Asset register and marketplace remain in the project, but the main journey in this build is the
              tractor valuation workflow.
            </p>
            <ul className={styles.bulletList}>
              <li>Aim4price value</li>
              <li>Market midpoint and range</li>
              <li>Department guideline value</li>
            </ul>
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <>
          <div className={styles.searchBar}>
            <input
              value={brandQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setBrandQuery(event.target.value)}
              placeholder="Search brands"
              aria-label="Search brands"
            />
          </div>

          <div className={styles.choiceGrid}>
            {matchingBrands.map((brand) => {
              const active = brandSlug === brand.slug;
              const tractorCount = tractors.filter((tractor) => tractor.brandSlug === brand.slug).length;

              return (
                <button
                  key={brand.slug}
                  type="button"
                  className={`${styles.choiceButton} ${active ? styles.choiceButtonActive : ''}`}
                  onClick={() => {
                    setBrandSlug(brand.slug);
                    setMessage('');
                  }}
                >
                  <strong>{brand.name}</strong>
                  <span>{tractorCount} bundled model{tractorCount === 1 ? '' : 's'}</span>
                </button>
              );
            })}
          </div>

          {!matchingBrands.length ? <div className={styles.emptyState}>No brands matched that search.</div> : null}
        </>
      );
    }

    if (step === 3) {
      return (
        <>
          <div className={styles.filterGrid}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Tractor type</span>
              <div className={styles.chipRow}>
                {(['field', 'orchard'] as TractorType[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.chip} ${tractorType === value ? styles.chipActive : ''}`}
                    onClick={() => {
                      setTractorType(value);
                      setMessage('');
                    }}
                  >
                    {value === 'field' ? 'Field' : 'Orchard'}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Drive</span>
              <div className={styles.chipRow}>
                {(['2wd', '4wd'] as DriveType[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.chip} ${drive === value ? styles.chipActive : ''}`}
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
              <span className={styles.filterLabel}>Operator station</span>
              <div className={styles.chipRow}>
                {(['cab', 'open-station'] as CabType[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.chip} ${cab === value ? styles.chipActive : ''}`}
                    onClick={() => {
                      setCab(value);
                      setMessage('');
                    }}
                  >
                    {value === 'cab' ? 'Cab' : 'Open station'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.searchBar}>
            <input
              value={modelQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setModelQuery(event.target.value)}
              placeholder="Search tractor models"
              aria-label="Search tractor models"
            />
          </div>

          {filteredModels.length ? (
            <div className={styles.modelGrid}>
              {filteredModels.map((model) => {
                const active = selectedModel?.id === model.id;

                return (
                  <button
                    key={model.id}
                    type="button"
                    className={`${styles.modelCard} ${active ? styles.modelCardActive : ''}`}
                    onClick={() => {
                      setModelId(model.id);
                      setYear(model.yearEnd);
                      setMessage('');
                    }}
                  >
                    <div>
                      <strong>{model.brandName} {model.modelName}</strong>
                      <span className={styles.modelMeta}>
                        {model.powerKw} kW • {model.drive.toUpperCase()} • {model.cab === 'cab' ? 'Cab' : 'Open station'}
                      </span>
                    </div>
                    <span className={styles.modelYears}>{model.yearStart}–{model.yearEnd}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              No tractor models matched the current combination of brand, type, drive and cab.
            </div>
          )}
        </>
      );
    }

    return (
      <>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Year model</span>
            <select value={year} onChange={(event: ChangeEvent<HTMLSelectElement>) => setYear(Number(event.target.value))}>
              {years.map((availableYear) => (
                <option key={availableYear} value={availableYear}>
                  {availableYear}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Hours</span>
            <input
              value={hours}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setHours(event.target.value.replace(/[^0-9]/g, ''))}
              placeholder="3500"
              inputMode="numeric"
            />
          </label>
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
              <span>
                {option.key === 'excellent' && 'Best kept condition'}
                {option.key === 'good' && 'Well maintained working tractor'}
                {option.key === 'fair' && 'Average wear for age'}
                {option.key === 'used' && 'Heavy general use visible'}
                {option.key === 'serious' && 'Requires attention before sale'}
              </span>
            </button>
          ))}
        </div>

        {selectedModel ? (
          <div className={styles.snapshotCard}>
            <div className={styles.snapshotImageWrap}>
              <Image
                src="/images/tractor-generic.png"
                alt="Selected tractor"
                fill
                className={styles.coverImage}
                sizes="120px"
              />
            </div>
            <div className={styles.snapshotMeta}>
              <strong>{selectedModel.brandName} {selectedModel.modelName}</strong>
              <span>
                {selectedModel.powerKw} kW • {selectedModel.tractorType === 'field' ? 'Field' : 'Orchard'} • {selectedModel.drive.toUpperCase()} • {selectedModel.cab === 'cab' ? 'Cab' : 'Open station'}
              </span>
              <span>Condition: {conditionLabel(condition)}</span>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  function renderSummaryCard() {
    return (
      <aside className={styles.summaryCard}>
        <div className={styles.summaryImageWrap}>
          <Image
            src="/images/tractor-generic.png"
            alt="Tractor valuation summary"
            fill
            className={styles.coverImage}
            sizes="(max-width: 960px) 100vw, 32vw"
          />
        </div>

        <span className={styles.summaryBadge}>Current selection</span>
        <h2 className={styles.summaryTitle}>
          {selectedModel ? `${selectedModel.brandName} ${selectedModel.modelName}` : 'Choose a matching tractor'}
        </h2>
        <p className={styles.summaryBody}>
          Keep the scope on valuation first. This side panel keeps the current tractor visible so the flow stays easy to understand.
        </p>

        <dl className={styles.summaryList}>
          <div>
            <dt>Brand</dt>
            <dd>{brands.find((brand) => brand.slug === brandSlug)?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{tractorType === 'field' ? 'Field' : 'Orchard'}</dd>
          </div>
          <div>
            <dt>Drive</dt>
            <dd>{drive.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Station</dt>
            <dd>{cab === 'cab' ? 'Cab' : 'Open station'}</dd>
          </div>
          <div>
            <dt>Hours</dt>
            <dd>{hours ? Number(hours).toLocaleString('en-ZA') : '—'}</dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd>{conditionLabel(condition)}</dd>
          </div>
        </dl>

        {selectedModel ? (
          <div className={styles.summaryValueCard}>
            <span>Replacement value</span>
            <strong>{money(selectedModel.aim4priceReplacementExVat)}</strong>
          </div>
        ) : null}
      </aside>
    );
  }

  return (
    <main className={styles.page}>
      <AppHeader active="valuation" ctaHref="/valuation" ctaLabel="Restart Valuation" />

      <div className={styles.container}>
        {step !== 5 ? (
          <section className={styles.builderLayout}>
            <article className={styles.builderCard}>
              <div className={styles.progressRow}>
                {[1, 2, 3, 4, 5].map((item) => {
                  const itemStep = item as Step;
                  const isActive = step === itemStep;
                  const isComplete = step > itemStep;

                  return (
                    <div key={item} className={styles.progressItem}>
                      <span
                        className={`${styles.progressDot} ${isActive ? styles.progressDotActive : ''} ${
                          isComplete ? styles.progressDotComplete : ''
                        }`}
                      >
                        {item}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className={styles.stepHeader}>
                <span className={styles.eyebrow}>{stepCopy.eyebrow}</span>
                <h1 className={styles.stepTitle}>{stepCopy.title}</h1>
                <p className={styles.stepBody}>{stepCopy.body}</p>
              </div>

              {message ? <div className={styles.message}>{message}</div> : null}

              {renderBuilderContent()}

              <div className={styles.actionsRow}>
                <button type="button" className={styles.secondaryButton} onClick={handleBack}>
                  {step === 1 ? 'Back home' : 'Back'}
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

            {renderSummaryCard()}
          </section>
        ) : result ? (
          <section className={styles.resultsLayout}>
            <div className={styles.resultsMain}>
              <div className={styles.resultTopBar}>
                <button type="button" className={styles.linkButton} onClick={() => setStep(4)}>
                  ← Back to inputs
                </button>
              </div>

              {message ? <div className={styles.message}>{message}</div> : null}

              <article className={styles.resultHeroCard}>
                <div className={styles.resultHeroTop}>
                  <div>
                    <span className={styles.badge}>{headlineLabel}</span>
                    <h1 className={styles.resultTitle}>
                      {result.model.brandName} {result.model.modelName}
                    </h1>
                    <p className={styles.resultMeta}>
                      {year} model • {result.model.powerKw} kW • {Number(hours).toLocaleString('en-ZA')} hours •{' '}
                      {conditionLabel(condition)}
                    </p>
                  </div>

                  <div className={styles.resultHeroImageWrap}>
                    <Image
                      src="/images/tractor-generic.png"
                      alt="Valuation result tractor"
                      fill
                      className={styles.coverImage}
                      sizes="180px"
                    />
                  </div>
                </div>

                <div className={styles.resultHeadline}>{money(headlineValue)}</div>
                <p className={styles.resultSubline}>
                  VAT excluded. Default preview uses the market midpoint first, then falls back to the other methods if needed.
                </p>

                <div className={styles.methodGrid}>
                  {methodCards.map((card) => (
                    <div key={card.key} className={styles.methodCard}>
                      <span className={styles.methodCardLabel}>{card.label}</span>
                      <strong className={styles.methodCardValue}>{money(card.value)}</strong>
                      <span className={styles.methodCardNote}>{card.note}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className={styles.compareCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Market comparables</h2>
                    <p className={styles.cardText}>
                      {result.marketCount
                        ? `Structured prototype listings used for the market range and midpoint.`
                        : 'No structured comparables were available for this profile.'}
                    </p>
                  </div>

                  <span className={`${styles.coveragePill} ${coverageClassName(result.coverageBand)}`}>
                    {coverageLabel(result.coverageBand)}
                  </span>
                </div>

                {result.marketSources.length ? (
                  <div className={styles.compsList}>
                    {result.marketSources.map((listing) => (
                      <article key={listing.id} className={styles.compCard}>
                        <div>
                          <h3>
                            {listing.brandName} {listing.modelName}
                          </h3>
                          <p className={styles.compMeta}>
                            {listing.yearModel} • {listing.hours.toLocaleString('en-ZA')} hours • {listing.province} • {listing.area}
                          </p>
                          <p className={styles.compSource}>
                            {listing.sourceName} • Advertised {listing.dateAdvertised}
                          </p>
                        </div>
                        <strong className={styles.compPrice}>{money(listing.advertisedPriceExVat)}</strong>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>No comparable listing cards are available for this tractor selection.</div>
                )}
              </article>
            </div>

            <aside className={styles.resultsSide}>
              <article className={styles.sideCard}>
                <h2 className={styles.cardTitle}>Select the saved number</h2>
                <p className={styles.cardText}>
                  Review the three methods and choose which number the result screen should carry forward.
                </p>

                <div className={styles.selectGrid}>
                  {methodCards.map((card) => {
                    const active = selectedMethod === card.key;
                    const unavailable = !card.available;

                    return (
                      <button
                        key={card.key}
                        type="button"
                        className={`${styles.selectCard} ${active ? styles.selectCardActive : ''} ${
                          unavailable ? styles.selectCardUnavailable : ''
                        }`}
                        onClick={() => handleMethodSelect(card.key)}
                        disabled={unavailable}
                      >
                        <span>{card.label}</span>
                        <strong>{money(card.value)}</strong>
                        <small>{unavailable ? 'Unavailable for this profile' : 'Available to save'}</small>
                      </button>
                    );
                  })}
                </div>

                <div className={styles.actionsStack}>
                  <button type="button" className={styles.primaryButton} onClick={handleSave}>
                    Save locally
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={handlePrint}>
                    Print / Save PDF
                  </button>
                </div>
              </article>

              <article className={styles.sideCard}>
                <h2 className={styles.cardTitle}>Value context</h2>
                <div className={styles.factGrid}>
                  <div className={styles.factCard}>
                    <span>Coverage</span>
                    <strong>{coverageLabel(result.coverageBand)}</strong>
                    <small>{coverageText(result.coverageBand)}</small>
                  </div>
                  <div className={styles.factCard}>
                    <span>Market range</span>
                    <strong>{range(result.marketLow, result.marketHigh)}</strong>
                    <small>{result.marketCount} comp{result.marketCount === 1 ? '' : 's'} in range</small>
                  </div>
                  <div className={styles.factCard}>
                    <span>Department band</span>
                    <strong>
                      {result.departmentBand ? `${result.departmentBand.powerKw} kW ${result.departmentBand.drive.toUpperCase()}` : 'N/A'}
                    </strong>
                    <small>
                      {result.departmentBand
                        ? `${money(result.departmentBand.replacementPriceExVat)} replacement reference`
                        : 'No department band matched'}
                    </small>
                  </div>
                </div>

                <div className={styles.rangeTrack}>
                  <div className={styles.rangeFill} style={{ width: `${rangePercent}%` }} />
                  <div className={styles.rangePin} style={{ left: `${rangePercent}%` }} />
                </div>
                <div className={styles.rangeLabels}>
                  <strong>{money(result.marketLow)}</strong>
                  <span>{money(result.marketHigh)}</span>
                </div>
              </article>

  <article className={styles.sideCard}>
    <h2 className={styles.cardTitle}>Next steps</h2>
    <p className={styles.cardText}>
      Refine the valuation, start another tractor valuation, or return to the homepage.
    </p>
    <div className={styles.actionsStack}>
      <button type="button" className={styles.secondaryButton} onClick={() => setStep(4)}>
        Refine inputs
      </button>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => {
          setResult(null);
          setSelectedMethod(null);
          setStep(1);
          setMessage('');
        }}
      >
        Start new valuation
      </button>
      <Link href="/" className={styles.secondaryButton}>
        Return home
      </Link>
    </div>
  </article>
</aside>
          </section>
        ) : null}
      </div>
    </main>
  );
}
