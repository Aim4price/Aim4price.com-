'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateGeneralSaleability,
  calculateRefinedSaleability,
  type GeneralSaleabilityInput,
  type SaleabilityPlan,
  type SaleabilityRefinementAnswers,
} from '../lib/saleability';
import {
  SALEABILITY_PDF_PLAN_SESSION_KEY,
  createSaleabilityPdfPlanSnapshot,
} from '../lib/saleability-pdf';
import PricingVatToggle from './PricingVatToggle';
import { pricingVatAmount } from '../lib/pricing-vat';
import styles from './saleability-modal.module.css';
import modalStyles from './estimate-modal.module.css';
import accountStyles from '../app/account/page.module.css';

type SaleabilityModalProps = {
  estimateStyle?: boolean;
  open: boolean;
  onClose: () => void;
  assetTitle: string;
  valuationExVat: number;
  input: GeneralSaleabilityInput;
  storageKey?: string;
};

type Choice<T extends string> = { value: T; label: string; help?: string };

const SALE_AREA_OPTIONS: Choice<SaleabilityRefinementAnswers['saleArea']>[] = [
  { value: 'local', label: 'Near me' },
  { value: 'province', label: 'My province' },
  { value: 'south_africa', label: 'South Africa' },
];
const AVAILABLE_OPTIONS: Choice<SaleabilityRefinementAnswers['similarAssetsAvailable']>[] = [
  { value: 'none', label: 'Almost none' },
  { value: 'one_to_three', label: 'A few' },
  { value: 'four_to_ten', label: 'Several' },
  { value: 'more_than_ten', label: 'Many' },
  { value: 'unknown', label: 'I’m not sure' },
];
const BUYER_OPTIONS: Choice<SaleabilityRefinementAnswers['realisticBuyerPool']>[] = [
  { value: 'many', label: 'Many buyers' },
  { value: 'moderate', label: 'A fair number' },
  { value: 'few', label: 'Only a few' },
  { value: 'specialist', label: 'A specialist buyer' },
  { value: 'unknown', label: 'I’m not sure' },
];
const DEMAND_OPTIONS: Choice<SaleabilityRefinementAnswers['currentDemand']>[] = [
  { value: 'strong', label: 'Strong' },
  { value: 'normal', label: 'Normal' },
  { value: 'weak', label: 'Weak' },
  { value: 'unknown', label: 'I’m not sure' },
];
const FAMILIARITY_OPTIONS: Choice<SaleabilityRefinementAnswers['modelFamiliarity']>[] = [
  { value: 'common', label: 'Well known' },
  { value: 'less_common', label: 'Less common' },
  { value: 'rare', label: 'Rare or specialised' },
  { value: 'unknown', label: 'I’m not sure' },
];
const TIMELINE_OPTIONS: Choice<SaleabilityRefinementAnswers['desiredTimeline']>[] = [
  { value: '14', label: 'Within 14 days' },
  { value: '30', label: 'Within 30 days' },
  { value: '60', label: 'Within 60 days' },
  { value: '90', label: 'Within 90 days' },
  { value: 'flexible', label: 'No hurry' },
];
const PRIORITY_OPTIONS: Choice<SaleabilityRefinementAnswers['sellingPriority']>[] = [
  { value: 'best_price', label: 'Best price' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'fast_cashflow', label: 'Fast cashflow' },
];

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value);
}

function answersAreComplete(value: Partial<SaleabilityRefinementAnswers>): value is SaleabilityRefinementAnswers {
  return Boolean(
    value.saleArea
      && value.similarAssetsAvailable
      && value.realisticBuyerPool
      && value.currentDemand
      && value.modelFamiliarity
      && value.desiredTimeline
      && value.sellingPriority,
  );
}

type SaleIconKind = 'location' | 'assets' | 'buyers' | 'demand' | 'model' | 'time' | 'priority';
function SaleIcon({ kind, value }: { kind: SaleIconKind; value?: string }) {
  if (kind === 'assets' && value && value !== 'unknown') {
    const count = ({ none: 0, one_to_three: 1, four_to_ten: 3, more_than_ten: 4 } as Record<string, number>)[value] ?? 4;
    return <span className={styles.choiceIcon} data-kind={kind} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">{count === 0 ? <path d="M5 12h14" /> : Array.from({ length: count }, (_, i) => <rect key={i} x={3 + i % 2 * 11} y={3 + Math.floor(i / 2) * 11} width="7" height="7" rx="1" />)}</svg></span>;
  }
  if (kind === 'time' && value && value !== 'flexible') {
    return <span className={styles.choiceIcon} data-kind={kind} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M3 9h18M8 2v4M16 2v4" /><text x="12" y="18" textAnchor="middle" stroke="none" fill="currentColor" fontSize="8" fontWeight="700">{value}</text></svg></span>;
  }
  const path = value === 'unknown' ? 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01'
    : kind === 'demand' && value === 'normal' ? 'M3 4v16h18M6 12h14m-4-4 4 4-4 4'
    : kind === 'model' && value === 'rare' ? 'm12 3 9 9-9 9-9-9ZM3 12h18M12 3l-4 9 4 9 4-9Z'
    : kind === 'model' && value === 'less_common' ? 'M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'
    : kind === 'location' && value === 'province' ? 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16'
    : kind === 'location' ? (value === 'south_africa' ? 'M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18' : 'M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12ZM12 7v4M10 9h4')
    : kind === 'assets' ? 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z'
    : kind === 'buyers' ? 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 7M19 14a6 6 0 0 1 3 5v2'
    : kind === 'demand' ? (value === 'weak' ? 'M3 5v15h18M6 8l5 5 4-3 6 6M17 16h4v-4' : 'M3 3v17h18M6 15l5-5 4 3 6-8M17 5h4v4')
    : kind === 'model' ? 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z'
    : kind === 'time' ? 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2'
    : value === 'fast_cashflow' ? 'm13 2-9 12h7l-1 8 10-13h-7Z'
    : value === 'balanced' ? 'M12 3v18M7 21h10M3 7h18M5 7l-3 7h6ZM19 7l-3 7h6Z'
    : 'M3 4h7l11 11-6 6L3 9ZM7 7h.01';
  return <span className={styles.choiceIcon} data-kind={kind} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{value === 'unknown' || value === 'south_africa' ? <circle cx="12" cy="12" r="9" /> : null}<path d={path} /></svg></span>;
}

function ChoiceQuestion<T extends string>({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: SaleIconKind;
  value?: T;
  options: Choice<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.question}>
      <legend><SaleIcon kind={icon} />{label}</legend>
      <div className={styles.choiceGrid}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? styles.choiceActive : styles.choice}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <SaleIcon kind={icon} value={option.value} /><strong>{option.label}</strong>
            {option.help ? <small>{option.help}</small> : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function SaleabilityModal({
  estimateStyle = false,
  open,
  onClose,
  assetTitle,
  valuationExVat,
  input,
  storageKey,
}: SaleabilityModalProps) {
  const [vatIncluded, setVatIncluded] = useState(false);
  const vatLabel = vatIncluded ? 'Incl. VAT' : 'Excl. VAT';
  const displayMoney = (value: number) => formatMoney(pricingVatAmount(value, vatIncluded));
  const bodyRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<number | 'result'>(1);
  const [answers, setAnswers] = useState<Partial<SaleabilityRefinementAnswers>>({});
  const general = useMemo(() => calculateGeneralSaleability(input), [input]);
  const plan: SaleabilityPlan | null = useMemo(
    () => answersAreComplete(answers) ? calculateRefinedSaleability(general, answers, valuationExVat) : null,
    [answers, general, valuationExVat],
  );

  useEffect(() => {
    if (!open) return undefined;

    let restored = false;
    if (storageKey) {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<SaleabilityRefinementAnswers>;
          if (parsed && typeof parsed === 'object') {
            setAnswers(parsed);
            if (answersAreComplete(parsed)) {
              setStep('result');
              restored = true;
            }
          }
        }
      } catch {
        // Storage is a convenience only; the calculator still works without it.
      }
    }
    if (!restored) setStep(1);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open, storageKey]);

  useEffect(() => {
    if (!open || step !== 'result' || !plan) return;

    const snapshot = createSaleabilityPdfPlanSnapshot({
      assetTitle,
      valuationExVat,
      saleabilityPriceExVat: plan.recommendedAskingPriceExVat,
    });
    if (!snapshot) return;

    try {
      window.sessionStorage.setItem(SALEABILITY_PDF_PLAN_SESSION_KEY, JSON.stringify(snapshot));
    } catch {
      // PDF enrichment is optional; Saleability itself remains fully usable.
    }
  }, [assetTitle, open, plan, step, valuationExVat]);

  useEffect(() => {
    if (!open) return;
    bodyRef.current?.scrollTo({ top: 0 });
    bodyRef.current?.focus({ preventScroll: true });
  }, [open, step]);

  if (!open) return null;

  function update<K extends keyof SaleabilityRefinementAnswers>(key: K, value: SaleabilityRefinementAnswers[K]) {
    const nextAnswers = { ...answers, [key]: value };
    setAnswers(nextAnswers);
    if (step === 7) {
      calculate(nextAnswers);
    } else if (typeof step === 'number') {
      setStep(step + 1);
    }
  }

  function calculate(completedAnswers: Partial<SaleabilityRefinementAnswers>) {
    if (!answersAreComplete(completedAnswers)) return;
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(completedAnswers));
      } catch {
        // Storage is optional.
      }
    }
    setStep('result');
  }

  return (
    <div className={styles.backdrop} data-website-overlay role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`${styles.modal} ${accountStyles.modalTheme} ${estimateStyle ? modalStyles.surface : ''}`} role="dialog" aria-modal="true" aria-labelledby="saleability-title">
        <header className={styles.header}>
          <div>
            <h2 data-estimate-modal-title={estimateStyle || undefined} id="saleability-title"><SaleIcon kind="demand" />Saleability</h2>
            <p>{assetTitle}</p>
          </div>
          <button type="button" className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton} ${estimateStyle ? modalStyles.close : ''}`} onClick={onClose} aria-label="Close Saleability"><span aria-hidden="true">×</span></button>
        </header>

        <div className={styles.questionProgress} role="status" aria-live="polite" hidden={step === 'result'}>
          {step === 'result' ? 'Your selling plan' : `Question ${step} of 7`}
          <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${step === 'result' ? 100 : step / 7 * 100}%` }} /></div>
        </div>
        <div ref={bodyRef} className={styles.body} tabIndex={-1} aria-label={step === 'result' ? 'Your selling plan' : `Question ${step} of 7`}>
          {step !== 'result' ? (
            <section key={step} className={`${styles.settingsCard} ${styles.singleQuestion}`}>
              {step === 1 ? (
              <ChoiceQuestion
                icon="location"
                label="Where will you sell?"
                value={answers.saleArea}
                options={SALE_AREA_OPTIONS}
                onChange={(value) => update('saleArea', value)}
              />
              ) : null}
              {step === 2 ? (
              <ChoiceQuestion
                icon="assets"
                label="How many similar assets are for sale?"
                value={answers.similarAssetsAvailable}
                options={AVAILABLE_OPTIONS}
                onChange={(value) => update('similarAssetsAvailable', value)}
              />
              ) : null}
              {step === 3 ? (
              <ChoiceQuestion
                icon="buyers"
                label="How many likely buyers?"
                value={answers.realisticBuyerPool}
                options={BUYER_OPTIONS}
                onChange={(value) => update('realisticBuyerPool', value)}
              />
              ) : null}
              {step === 4 ? (
              <ChoiceQuestion
                icon="demand"
                label="Current demand?"
                value={answers.currentDemand}
                options={DEMAND_OPTIONS}
                onChange={(value) => update('currentDemand', value)}
              />
              ) : null}
              {step === 5 ? (
              <ChoiceQuestion
                icon="model"
                label="How well known is the model?"
                value={answers.modelFamiliarity}
                options={FAMILIARITY_OPTIONS}
                onChange={(value) => update('modelFamiliarity', value)}
              />
              ) : null}
              {step === 6 ? (
              <ChoiceQuestion
                icon="time"
                label="When would you like to sell?"
                value={answers.desiredTimeline}
                options={TIMELINE_OPTIONS}
                onChange={(value) => update('desiredTimeline', value)}
              />
              ) : null}
              {step === 7 ? (
              <ChoiceQuestion
                icon="priority"
                label="What matters most?"
                value={answers.sellingPriority}
                options={PRIORITY_OPTIONS}
                onChange={(value) => update('sellingPriority', value)}
              />
              ) : null}
            </section>
          ) : null}

          {step === 'result' && plan ? (
            <div className={styles.result}>
              <section className={styles.resultHero} aria-live="polite">
                <span className={styles.resultLabel}><SaleIcon kind="demand" />Refined Saleability</span>
                <strong>{plan.refinedScore} / 100</strong>
                <p>Grade {plan.grade} · {plan.gradeLabel}</p>

              </section>

              <section className={styles.pricePlan}>
                <div className={styles.planHeader}>
                  <h3 className={styles.resultLabel}><SaleIcon kind="priority" />Your selling plan</h3>
                </div>
                <div className={styles.askingPriceRow}>
                <div className={styles.askingPrice}>
                  <small>Recommended asking price</small>
                  <strong>{displayMoney(plan.recommendedAskingPriceExVat)}</strong>
                  <em>{vatLabel}</em>
                </div>
                  <PricingVatToggle included={vatIncluded} onChange={setVatIncluded} />
                </div>
                <div className={styles.resultRows}>
                  <div><span>Likely selling range</span><strong>{displayMoney(plan.likelySellingRangeLowExVat)} – {displayMoney(plan.likelySellingRangeHighExVat)}</strong></div>
                  <div><span>Expected timing</span><strong>{plan.expectedTimelineWithPlan}</strong></div>
                </div>
              </section>

              <details className={styles.ratingDetails}>
                <summary>Rating details</summary>
                <div className={styles.resultMeta}>
                  <div>
                    <span>General rating</span>
                    <strong>{general.score} / 100</strong>
                  </div>
                  <div>
                    <span>Market score</span>
                    <strong>{plan.marketScore} / 100</strong>
                  </div>
                  <div>
                    <span>Grade</span>
                    <strong>{plan.grade} · {plan.gradeLabel}</strong>
                  </div>
                  <div>
                    <span>Selling window</span>
                    <strong>{plan.naturalSellingWindow}</strong>
                  </div>
                </div>
              </details>

              <p className={styles.valuationReminder}>
                Valuation: <strong>{displayMoney(valuationExVat)} {vatLabel}</strong> · selling-price guidance only.
              </p>
            </div>
          ) : null}
        </div>
        <footer className={`${styles.actions} ${estimateStyle ? modalStyles.actions : ''}`}>
          {step !== 'result' ? (
            <button type="button" className={styles.secondary} onClick={step === 1 ? onClose : () => setStep(step - 1)}>
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
          ) : (
            <>
              <button type="button" className={styles.secondary} onClick={() => setStep(1)}>Change answers</button>
              <button type="button" className={styles.primary} onClick={onClose}>Done</button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}


