'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  calculateGeneralSaleability,
  calculateRefinedSaleability,
  type GeneralSaleabilityInput,
  type SaleabilityPlan,
  type SaleabilityRefinementAnswers,
} from '../lib/saleability';
import styles from './saleability-modal.module.css';

type SaleabilityModalProps = {
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
  { value: 'south_africa', label: 'Anywhere in South Africa' },
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
  { value: 'common', label: 'Common and well known' },
  { value: 'less_common', label: 'Less common, but recognised' },
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
  { value: 'best_price', label: 'Best price', help: 'I can wait longer.' },
  { value: 'balanced', label: 'Balanced', help: 'A fair price in a fair time.' },
  { value: 'fast_cashflow', label: 'Fast cashflow', help: 'Selling sooner matters most.' },
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

function ChoiceQuestion<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: T;
  options: Choice<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.question}>
      <legend>{label}</legend>
      <div className={styles.choiceGrid}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? styles.choiceActive : styles.choice}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <strong>{option.label}</strong>
            {option.help ? <small>{option.help}</small> : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function SaleabilityModal({
  open,
  onClose,
  assetTitle,
  valuationExVat,
  input,
  storageKey,
}: SaleabilityModalProps) {
  const [step, setStep] = useState<1 | 2 | 'result'>(1);
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

  if (!open) return null;

  function update<K extends keyof SaleabilityRefinementAnswers>(key: K, value: SaleabilityRefinementAnswers[K]) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function calculate() {
    if (!answersAreComplete(answers)) return;
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(answers));
      } catch {
        // Storage is optional.
      }
    }
    setStep('result');
  }

  const firstStepComplete = Boolean(answers.saleArea && answers.similarAssetsAvailable && answers.realisticBuyerPool);
  const secondStepComplete = Boolean(answers.currentDemand && answers.modelFamiliarity && answers.desiredTimeline && answers.sellingPriority);

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="saleability-title">
        <header className={styles.header}>
          <div>
            <h2 id="saleability-title">{assetTitle}</h2>
            <p>Refine Saleability using simple buyer, demand and timing choices. Your Aim4price valuation stays unchanged.</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close Saleability">×</button>
        </header>

        <div className={styles.body}>
          <div className={styles.baselineStrip}>
            <div>
              <span>Current saved value</span>
              <strong>{formatMoney(valuationExVat)}</strong>
              <small>Excl. VAT · this value does not change here</small>
            </div>
            <div>
              <span>General Saleability</span>
              <strong>{general.score} / 100 · Grade {general.grade}</strong>
              <small>{general.gradeLabel}</small>
            </div>
            <div>
              <span>Natural selling window</span>
              <strong>{general.naturalSellingWindow}</strong>
              <small>{general.confidence} confidence</small>
            </div>
          </div>

          {step === 1 ? (
            <section className={styles.settingsCard}>
              <div className={styles.stepIntro}>
                <h3>Buyer settings</h3>
                <p>Step 1 of 2 · Choose the closest answer. “I’m not sure” is completely fine.</p>
              </div>
              <ChoiceQuestion
                label="Where are you willing to sell it?"
                value={answers.saleArea}
                options={SALE_AREA_OPTIONS}
                onChange={(value) => update('saleArea', value)}
              />
              <ChoiceQuestion
                label="How many similar assets can buyers choose from?"
                value={answers.similarAssetsAvailable}
                options={AVAILABLE_OPTIONS}
                onChange={(value) => update('similarAssetsAvailable', value)}
              />
              <ChoiceQuestion
                label="How many people would realistically buy it?"
                value={answers.realisticBuyerPool}
                options={BUYER_OPTIONS}
                onChange={(value) => update('realisticBuyerPool', value)}
              />
              <div className={styles.actions}>
                <button type="button" className={styles.primary} disabled={!firstStepComplete} onClick={() => setStep(2)}>Continue</button>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className={styles.settingsCard}>
              <div className={styles.stepIntro}>
                <h3>Market and selling settings</h3>
                <p>Step 2 of 2 · These choices create a selling plan. They never change the Aim4price valuation.</p>
              </div>
              <ChoiceQuestion
                label="What is demand like right now?"
                value={answers.currentDemand}
                options={DEMAND_OPTIONS}
                onChange={(value) => update('currentDemand', value)}
              />
              <ChoiceQuestion
                label="How easy is this make or model for buyers to recognise?"
                value={answers.modelFamiliarity}
                options={FAMILIARITY_OPTIONS}
                onChange={(value) => update('modelFamiliarity', value)}
              />
              <ChoiceQuestion
                label="How quickly would you like to sell?"
                value={answers.desiredTimeline}
                options={TIMELINE_OPTIONS}
                onChange={(value) => update('desiredTimeline', value)}
              />
              <ChoiceQuestion
                label="What matters most?"
                value={answers.sellingPriority}
                options={PRIORITY_OPTIONS}
                onChange={(value) => update('sellingPriority', value)}
              />
              <div className={styles.actions}>
                <button type="button" className={styles.secondary} onClick={() => setStep(1)}>Back</button>
                <button type="button" className={styles.primary} disabled={!secondStepComplete} onClick={calculate}>Calculate Saleability</button>
              </div>
            </section>
          ) : null}

          {step === 'result' && plan ? (
            <div className={styles.result}>
              <section className={styles.resultHero} aria-live="polite">
                <span>Refined Saleability</span>
                <strong>{plan.refinedScore} / 100</strong>
                <p>Grade {plan.grade} · {plan.gradeLabel}. Asset quality and current market information are combined below.</p>

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
                    <span>Natural selling window</span>
                    <strong>{plan.naturalSellingWindow}</strong>
                  </div>
                </div>
              </section>

              <section className={styles.pricePlan}>
                <div className={styles.planHeader}>
                  <h3>Selling plan for your goal</h3>
                  <p>Pricing guidance based on the answers above.</p>
                </div>
                <div className={styles.askingPrice}>
                  <small>Recommended asking price</small>
                  <strong>{formatMoney(plan.recommendedAskingPriceExVat)}</strong>
                  <em>Excl. VAT</em>
                </div>
                <div className={styles.resultRows}>
                  <div><span>Likely selling range</span><strong>{formatMoney(plan.likelySellingRangeLowExVat)} – {formatMoney(plan.likelySellingRangeHighExVat)}</strong></div>
                  <div><span>Likely timing with this plan</span><strong>{plan.expectedTimelineWithPlan}</strong></div>
                </div>
              </section>

              <p className={styles.valuationReminder}>
                The Aim4price valuation remains <strong>{formatMoney(valuationExVat)} excl. VAT</strong>. The figures above are selling-price guidance only.
              </p>
              <div className={styles.actions}>
                <button type="button" className={styles.secondary} onClick={() => setStep(1)}>Change answers</button>
                <button type="button" className={styles.primary} onClick={onClose}>Done</button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
