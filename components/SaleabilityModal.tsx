'use client';

import { useEffect, useRef, useState } from 'react';
import type { GeneralSaleabilityInput, SaleabilityRefinementAnswers } from '../lib/saleability';
import { validSaleabilityEase, saleabilityEaseLabel, validCurrentSaleabilityAnswers, type SaleabilityContext, type SaleabilityQuote } from '../lib/asset-saleability';
import { SALEABILITY_PDF_PLAN_SESSION_KEY, createSaleabilityPdfPlanSnapshot } from '../lib/saleability-pdf';
import PricingVatToggle from './PricingVatToggle';
import { pricingVatAmount } from '../lib/pricing-vat';
import styles from './saleability-modal.module.css';
import modalStyles from './estimate-modal.module.css';
import accountStyles from '../app/account/page.module.css';

type SaleabilityModalProps = {
  estimateStyle?: boolean; open: boolean; onClose: () => void;
  assetTitle: string; valuationExVat: number; input: GeneralSaleabilityInput;
  context?: SaleabilityContext; assetId?: string; basis?: string;
  storageKey?: string; initialAnswers?: SaleabilityRefinementAnswers;
  onSave?: (answers: SaleabilityRefinementAnswers) => Promise<void>;
};
type Choice<T extends string> = { value: T; label: string; help?: string };
const ROUTE_OPTIONS: Choice<NonNullable<SaleabilityRefinementAnswers['sellingRoute']>>[] = [
  { value: 'direct', label: 'Sell directly', help: 'To an end buyer' },
  { value: 'dealer', label: 'Dealer / trade-in', help: 'A dealer buys it' },
  { value: 'consignment', label: 'Sell on my behalf', help: 'Through a dealer or broker' },
  { value: 'auction', label: 'Auction', help: 'Sell through bidding' },
];
const TIMELINE_OPTIONS: Choice<SaleabilityRefinementAnswers['desiredTimeline']>[] = [
  { value: '14', label: 'Within 14 days' }, { value: '30', label: 'Within 30 days' },
  { value: '60', label: 'Within 60 days' }, { value: '90', label: 'Within 90 days' },
  { value: 'flexible', label: 'No hurry' },
];
const SALE_AREA_OPTIONS: Choice<SaleabilityRefinementAnswers['saleArea']>[] = [
  { value: 'local', label: 'Near me' }, { value: 'province', label: 'My province' },
  { value: 'south_africa', label: 'South Africa' },
];
const DEMAND_OPTIONS: Choice<SaleabilityRefinementAnswers['currentDemand']>[] = [
  { value: 'strong', label: 'Strong', help: 'Buyers are actively looking' },
  { value: 'normal', label: 'Normal', help: 'Steady buyer interest' },
  { value: 'weak', label: 'Weak', help: 'Little buyer interest' },
  { value: 'unknown', label: 'I’m not sure' },
];
const AVAILABLE_OPTIONS: Choice<SaleabilityRefinementAnswers['similarAssetsAvailable']>[] = [
  { value: 'none', label: 'Almost none' }, { value: 'one_to_three', label: 'A few' },
  { value: 'four_to_ten', label: 'Several' }, { value: 'more_than_ten', label: 'Many' },
  { value: 'unknown', label: 'I’m not sure' },
];
function defaults(): Partial<SaleabilityRefinementAnswers> {
  return { modelVersion: 2, realisticBuyerPool: 'unknown', modelFamiliarity: 'unknown', sellingPriority: 'balanced' };
}
function formatMoney(value: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value);
}

type SaleIconKind = 'location' | 'assets' | 'buyers' | 'demand' | 'model' | 'time' | 'priority' | 'route';
function SaleIcon({ kind, value }: { kind: SaleIconKind; value?: string }) {
  if (kind === 'assets' && value && value !== 'unknown') {
    const count = ({ none: 0, one_to_three: 1, four_to_ten: 3, more_than_ten: 4 } as Record<string, number>)[value] ?? 4;
    return <span className={styles.choiceIcon} data-kind={kind} data-value={value} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{count === 0 ? <path d="M5 12h14" /> : Array.from({ length: count }, (_, i) => <rect key={i} x={3 + i % 2 * 11} y={3 + Math.floor(i / 2) * 11} width="7" height="7" rx="1" />)}</svg></span>;
  }
  if (kind === 'time' && value && value !== 'flexible') {
    return <span className={styles.choiceIcon} data-kind={kind} data-value={value} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M3 9h18M8 2v4M16 2v4" /><text x="12" y="18" textAnchor="middle" stroke="none" fill="currentColor" fontSize="8" fontWeight="700">{value}</text></svg></span>;
  }
  const path = kind === 'route' ? (value === 'dealer' ? 'M3 10h18v11H3ZM2 10l3-7h14l3 7M9 21v-7h6v7' : value === 'auction' ? 'm8 3 6 6-4 4-6-6ZM6 5l6 6M12 11l8 8M3 21h10M4 18h8v3' : value === 'consignment' ? 'm2 8 4-4 4 2 4-2 8 4-3 8-5 4-8-5ZM6 4l5 5 3-2 4 4M2 8l4 7M22 8l-4 3M9 16l3-3M12 18l3-3' : 'M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20v-3a6 6 0 0 1 10-4M15 16h7m-3-3 3 3-3 3M14 5h7M18 2l3 3-3 3')
    : value === 'unknown' ? 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01'
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
  return <span className={styles.choiceIcon} data-kind={kind} data-value={value} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{value === 'unknown' || value === 'south_africa' ? <circle cx="12" cy="12" r="9" /> : null}<path d={path} /></svg></span>;
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
      <div className={styles.choiceGrid} data-options={options.length}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? styles.choiceActive : styles.choice}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <SaleIcon kind={icon} value={option.value} />
            <span className={styles.choiceText}><strong>{option.label}</strong>{option.help ? <small>{option.help}</small> : null}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function SaleabilityModal({
  estimateStyle = false, open, onClose, assetTitle, valuationExVat,
  context, assetId, basis, storageKey, initialAnswers, onSave,
}: SaleabilityModalProps) {
  const [answers, setAnswers] = useState<Partial<SaleabilityRefinementAnswers>>(defaults);
  const [step, setStep] = useState<number | 'result'>(1);
  const [plan, setPlan] = useState<SaleabilityQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [answersChanged, setAnswersChanged] = useState(false);
  const [vatIncluded, setVatIncluded] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const contextJson = JSON.stringify(context ?? {});
  const recalculating = Boolean(onSave && validCurrentSaleabilityAnswers(initialAnswers) && !answersChanged);
  const vatLabel = vatIncluded ? 'Incl. VAT' : 'Excl. VAT';
  const displayMoney = (value: number) => formatMoney(pricingVatAmount(value, vatIncluded));

  useEffect(() => {
    if (!open) return;
    let restored: unknown = initialAnswers;
    if (!restored && storageKey) {
      try { restored = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null'); } catch { /* Optional storage. */ }
    }
    setAnswers(validCurrentSaleabilityAnswers(restored) ? restored : defaults());
    setStep(validCurrentSaleabilityAnswers(restored) ? 'result' : 1);
    setPlan(null); setError(''); setAnswersChanged(false);
  }, [open, storageKey, initialAnswers]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
      if (!nodes.length) { event.preventDefault(); return; }
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement as HTMLElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; window.removeEventListener('keydown', keydown); previous?.focus({ preventScroll: true }); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    bodyRef.current?.scrollTo({ top: 0 });
    bodyRef.current?.focus({ preventScroll: true });
  }, [open, step]);

  useEffect(() => {
    if (!open || step !== 'result' || !validCurrentSaleabilityAnswers(answers)) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setPlan(null);
    try { window.sessionStorage.removeItem(SALEABILITY_PDF_PLAN_SESSION_KEY); } catch { /* Optional storage. */ }
    const url = assetId ? '/api/asset-register/saleability' : '/api/saleability/quote';
    const payload = assetId ? { assetId, basis, answers, preview: true }
      : { valuationExVat, answers, context: JSON.parse(contextJson) };
    void (async () => {
      try {
        const response = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'Could not calculate. Please try again.');
        if (!data.quote || !Number.isFinite(data.quote.priceExVat) || data.quote.priceExVat <= 0) throw Error('Could not calculate. Please try again.');
        if (!controller.signal.aborted) setPlan(data.quote);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not calculate. Please try again.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [open, step, answers, valuationExVat, assetId, basis, contextJson, retry]);

  useEffect(() => {
    if (!open || step !== 'result' || !plan) return;
    const snapshot = createSaleabilityPdfPlanSnapshot({ assetTitle, valuationExVat, saleabilityPriceExVat: plan.priceExVat });
    try {
      if (snapshot) window.sessionStorage.setItem(SALEABILITY_PDF_PLAN_SESSION_KEY, JSON.stringify(snapshot));
      if (storageKey) window.localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch { /* Optional storage. */ }
  }, [assetTitle, open, plan, step, valuationExVat, storageKey, answers]);

  function update<K extends keyof SaleabilityRefinementAnswers>(key: K, value: SaleabilityRefinementAnswers[K]) {
    setAnswersChanged(true); setError(''); setPlan(null);
    const next = { ...answers, [key]: value };
    setAnswers(next);
    setStep(step === 5 ? 'result' : typeof step === 'number' ? step + 1 : 1);
  }
  if (!open) return null;
  return (
    <div className={styles.backdrop} data-website-overlay role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} className={`${styles.modal} ${step === 'result' ? styles.resultModal : ''} ${accountStyles.modalTheme} ${estimateStyle ? modalStyles.surface : ''}`} role="dialog" aria-modal="true" aria-labelledby="saleability-title">
        <header className={styles.header}>
          <div><h2 data-estimate-modal-title={estimateStyle || undefined} id="saleability-title"><SaleIcon kind="demand" />Saleability</h2><p>{assetTitle}</p></div>
          <button type="button" disabled={saving} className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton} ${estimateStyle ? modalStyles.close : ''}`} onClick={onClose} aria-label="Close Saleability"><span aria-hidden="true">×</span></button>
        </header>
        <div ref={bodyRef} className={styles.body} tabIndex={-1} aria-label={step === 'result' ? 'Your selling estimate' : `Question ${step} of 5`}>
          {step !== 'result' ? <section key={step} className={`${styles.settingsCard} ${styles.singleQuestion}`}>
            {step === 1 ? <ChoiceQuestion icon="route" label="How would you like to sell?" value={answers.sellingRoute} options={ROUTE_OPTIONS} onChange={value => update('sellingRoute', value)} /> : null}
            {step === 2 ? <ChoiceQuestion icon="time" label="When would you like to sell?" value={answers.desiredTimeline} options={TIMELINE_OPTIONS} onChange={value => update('desiredTimeline', value)} /> : null}
            {step === 3 ? <ChoiceQuestion icon="location" label={answers.sellingRoute === 'dealer' ? 'Where will you seek dealer offers?' : 'Where will you sell?'} value={answers.saleArea} options={SALE_AREA_OPTIONS} onChange={value => update('saleArea', value)} /> : null}
            {step === 4 ? <ChoiceQuestion icon="demand" label="Current demand?" value={answers.currentDemand} options={DEMAND_OPTIONS} onChange={value => update('currentDemand', value)} /> : null}
            {step === 5 ? <ChoiceQuestion icon="assets" label="How many similar assets are for sale in that area?" value={answers.similarAssetsAvailable} options={AVAILABLE_OPTIONS} onChange={value => update('similarAssetsAvailable', value)} /> : null}
          </section> : null}
          {step === 'result' && loading ? <p className={styles.loading} role="status"><span className={styles.spinner} aria-hidden="true" />Calculating your estimate…</p> : null}
          {step === 'result' && plan ? <div className={styles.result}>
            <section className={styles.resultHero} aria-live="polite">
              <div className={styles.resultHeading}>
                <span className={styles.resultLabel}><SaleIcon kind="route" value={answers.sellingRoute} />{plan.resultLabel}</span>
                <PricingVatToggle included={vatIncluded} onChange={setVatIncluded} />
              </div>
              <strong>{displayMoney(plan.priceExVat)}</strong>
              <p>{vatLabel} · Before selling fees</p>
            </section>
            {validSaleabilityEase(plan.ease) ? <section className={styles.easeCard} aria-label="Ease of selling">
              <div className={styles.easeHeading}><div><h3>Ease of selling</h3><p>{saleabilityEaseLabel(plan.ease.score)}{plan.ease.provisional ? ' · Provisional' : ''}</p></div><strong>{plan.ease.score}<span> / 100</span></strong></div>
              <div className={styles.easeMeter} role="meter" aria-label="Ease of selling score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={plan.ease.score} aria-valuetext={`${plan.ease.score} out of 100 — ${saleabilityEaseLabel(plan.ease.score)}`} data-level={plan.ease.score >= 65 ? 'strong' : plan.ease.score >= 45 ? 'moderate' : 'limited'}><span style={{width: `${plan.ease.score}%`}} /></div>
              <p className={styles.easeNote}>{plan.ease.provisional ? 'Some market answers are unknown. ' : ''}Based on your answers and selling plan. Not a probability or guarantee of sale.</p>
            </section> : <p className={styles.easeNote}>Ease of selling score unavailable.</p>}
            <dl className={styles.sellingSummary} aria-label="Your selling plan">
              <div><SaleIcon kind="route" value={answers.sellingRoute} /><dt>Method</dt><dd>{ROUTE_OPTIONS.find(option => option.value === answers.sellingRoute)?.label}</dd></div>
              <div><SaleIcon kind="time" value={answers.desiredTimeline} /><dt>Timeframe</dt><dd>{TIMELINE_OPTIONS.find(option => option.value === answers.desiredTimeline)?.label}</dd></div>
              <div><SaleIcon kind="location" value={answers.saleArea} /><dt>Area</dt><dd>{SALE_AREA_OPTIONS.find(option => option.value === answers.saleArea)?.label}</dd></div>
            </dl>
          </div> : null}
        </div>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        <footer className={`${styles.actions} ${estimateStyle ? modalStyles.actions : ''}`}>
          {step !== 'result' ? <button type="button" className={styles.secondary} onClick={step === 1 ? onClose : () => setStep(step - 1)}>{step === 1 ? 'Cancel' : 'Back'}</button> : <>
            <button type="button" className={styles.secondary} disabled={saving} onClick={() => { setError(''); setPlan(null); setStep(1); }}>Change answers</button>
            {!plan && !loading ? <button type="button" className={styles.primary} onClick={() => setRetry(value => value + 1)}>Try again</button> : onSave ?
              <button type="button" className={styles.primary} disabled={saving || loading || !plan} onClick={async () => {
                if (!plan || !validCurrentSaleabilityAnswers(answers)) return;
                setSaving(true); setError('');
                try { await onSave(answers); onClose(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save. Please try again.'); } finally { setSaving(false); }
              }}>{saving ? 'Saving…' : recalculating ? 'Recalculate' : 'Save estimate'}</button>
              : <button type="button" className={styles.primary} disabled={loading || !plan} onClick={onClose}>Done</button>}
          </>}
        </footer>
      </section>
    </div>
  );
}
