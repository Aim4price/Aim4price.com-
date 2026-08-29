'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { MarketplaceListing } from '../lib/marketplace';
import styles from './MarketplaceOutcomeModal.module.css';

export type MarketplaceOutcomeReason =
  | 'sold'
  | 'traded'
  | 'no_longer_available'
  | 'decided_not_to_sell'
  | 'created_by_mistake'
  | 'other';

export type MarketplaceRemovalSource = 'marketplace' | 'showroom';

type RemovalStage = 'confirm' | 'wizard';
type RemovalStep = 1 | 2 | 3 | 4;

export type MarketplaceOutcomeResult = {
  outcome?: { id?: string; [key: string]: unknown };
  assetId?: string;
  marketplaceStatus?: string;
};

type MarketplaceOutcomeModalProps = {
  listing: MarketplaceListing | null;
  source: MarketplaceRemovalSource;
  onClose: () => void;
  onRemoved: (listing: MarketplaceListing, result: MarketplaceOutcomeResult) => void;
};

const OUTCOME_OPTIONS: Array<{ value: MarketplaceOutcomeReason; label: string }> = [
  { value: 'sold', label: 'Sold' },
  { value: 'traded', label: 'Traded in' },
  { value: 'no_longer_available', label: 'No longer available' },
  { value: 'decided_not_to_sell', label: 'Decided not to sell' },
  { value: 'created_by_mistake', label: 'Added by mistake' },
  { value: 'other', label: 'Other' },
];

const REMOVAL_STEPS: Array<{ step: RemovalStep; label: string }> = [
  { step: 1, label: 'Outcome' },
  { step: 2, label: 'Details' },
  { step: 3, label: 'Aim4price impact' },
  { step: 4, label: 'Information' },
];

function outcomeLabel(reason: MarketplaceOutcomeReason | ''): string {
  return OUTCOME_OPTIONS.find((option) => option.value === reason)?.label ?? 'Not selected';
}

function detailsHeading(reason: MarketplaceOutcomeReason | ''): string {
  if (reason === 'sold') return 'Add the sale details';
  if (reason === 'traded') return 'Add the trade-in details';
  if (reason === 'other') return 'Tell us what happened';
  if (reason === 'created_by_mistake') return 'No additional details needed';
  return 'Add any useful details';
}

function money(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  })
    .format(Math.max(0, Number(value) || 0))
    .replace(/\u00a0/g, ' ')
    .replace('ZAR', 'R');
}

function listingLocation(listing: MarketplaceListing): string {
  return [listing.area, listing.province].map((value) => String(value ?? '').trim()).filter(Boolean).join(', ');
}

function parseOptionalMoney(value: string): number | null {
  const compact = value.replace(/\s+/g, '').replace(/[^0-9,.-]/g, '');
  const commaCount = (compact.match(/,/g) ?? []).length;
  const dotCount = (compact.match(/\./g) ?? []).length;
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  let normalized = compact;

  if (commaCount && dotCount) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const groupingSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = compact.split(groupingSeparator).join('').replace(decimalSeparator, '.');
  } else if (commaCount === 1 || dotCount === 1) {
    const separator = commaCount === 1 ? ',' : '.';
    const decimalPlaces = compact.length - compact.lastIndexOf(separator) - 1;
    normalized = decimalPlaces > 0 && decimalPlaces <= 2
      ? compact.replace(separator, '.')
      : compact.replace(separator, '');
  } else if (commaCount > 1 || dotCount > 1) {
    normalized = compact.replace(/[,.]/g, '');
  }

  const parsed = Number(normalized);
  return normalized && Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed * 100) / 100
    : null;
}

export default function MarketplaceOutcomeModal({
  listing,
  source,
  onClose,
  onRemoved,
}: MarketplaceOutcomeModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const otherHelpId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const stepHeadingRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  const submittingRef = useRef(false);
  const [stage, setStage] = useState<RemovalStage>('confirm');
  const [step, setStep] = useState<RemovalStep>(1);
  const [reason, setReason] = useState<MarketplaceOutcomeReason | ''>('');
  const [aim4priceHelped, setAim4priceHelped] = useState<boolean | null>(null);
  const [finalPrice, setFinalPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  closeRef.current = onClose;
  submittingRef.current = submitting;

  useEffect(() => {
    setStage('confirm');
    setStep(1);
    setReason('');
    setAim4priceHelped(null);
    setFinalPrice('');
    setNotes('');
    setSubmitting(false);
    setError('');
  }, [listing?.id]);

  useEffect(() => {
    if (!listing || stage !== 'wizard' || typeof window === 'undefined') return undefined;
    const focusFrame = window.requestAnimationFrame(() => stepHeadingRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [listing?.id, stage, step]);

  useEffect(() => {
    if (!listing || typeof window === 'undefined') return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    function handleDialogKeyDown(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (event.key === 'Escape' && !submittingRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('hidden'));

      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleDialogKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleDialogKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [listing]);

  if (!listing) return null;

  const assetId = String(listing.sourceAssetId ?? '').trim();
  const isCompletedDeal = reason === 'sold' || reason === 'traded';
  const finalPriceLabel = reason === 'traded'
    ? 'Final trade-in value (optional)'
    : 'Final selling price (optional)';
  const location = listingLocation(listing);

  function closeModal() {
    if (!submitting) onClose();
  }

  function startRemoval() {
    setError('');
    setStage('wizard');
    setStep(1);
  }

  function previousStep() {
    setError('');
    setStep((current) => Math.max(1, current - 1) as RemovalStep);
  }

  function nextStep() {
    setError('');

    if (step === 1 && !reason) {
      setError('Choose what happened to this advert.');
      return;
    }

    if (step === 2) {
      if (reason === 'other' && notes.trim().length < 3) {
        setError('Please briefly explain what happened.');
        return;
      }

      if (isCompletedDeal && finalPrice.trim() && parseOptionalMoney(finalPrice) === null) {
        setError('Enter a valid final amount or leave the field empty.');
        return;
      }
    }

    if (step === 3 && aim4priceHelped === null) {
      setError('Please tell us whether Aim4price helped with this outcome.');
      return;
    }

    setStep((current) => Math.min(4, current + 1) as RemovalStep);
  }

  async function submitOutcome() {
    if (submitting) return;
    const targetListing = listing;

    if (!targetListing) return;

    if (!assetId) {
      setError('This advert is not linked to a saved asset and cannot be removed here.');
      return;
    }

    if (!reason) {
      setError('Choose what happened to this advert.');
      return;
    }

    if (aim4priceHelped === null) {
      setError('Please tell us whether Aim4price helped with this outcome.');
      return;
    }

    if (reason === 'other' && notes.trim().length < 3) {
      setError('Please briefly explain what happened.');
      return;
    }

    const finalSalePriceExVat = isCompletedDeal ? parseOptionalMoney(finalPrice) : null;
    if (isCompletedDeal && finalPrice.trim() && finalSalePriceExVat === null) {
      setError('Enter a valid final amount or leave the field empty.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/marketplace/outcomes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          outcomeReason: reason,
          aim4priceHelped,
          finalSalePriceExVat: finalSalePriceExVat,
          outcomeNote: notes.trim() || null,
          sourceSurface: source,
        }),
      });
      const result = (await response.json().catch(() => null)) as (
        MarketplaceOutcomeResult & { ok?: boolean; error?: string }
      ) | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'The advert could not be removed. Please try again.');
      }

      onRemoved(targetListing, result);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The advert could not be removed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <section
        ref={dialogRef}
        className={`${styles.dialog} ${stage === 'confirm' ? styles.confirmDialog : ''}`}
        role={stage === 'confirm' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <h2 id={titleId}>{stage === 'confirm' ? 'Are you sure you want to remove this?' : 'Remove this advert'}</h2>
            <p id={descriptionId}>
              {stage === 'confirm' ? (
                <>Continue to tell Aim4price what happened to <strong>{listing.title}</strong>. The advert is withdrawn from Marketplace and your showroom; the saved asset and valuation remain available.</>
              ) : listing.title}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={closeModal}
            disabled={submitting}
            aria-label="Close remove advert dialog"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        {stage === 'confirm' ? (
          <>
            <div className={`${styles.body} ${styles.confirmBody}`}>
              <div className={styles.selectedAdvert}>
                <span>Selected advert</span>
                <strong>{listing.title}</strong>
                <small>{money(listing.askingPriceExVat)} excl. VAT{location ? ` · ${location}` : ''}</small>
              </div>
            </div>
            <footer className={`${styles.actions} ${styles.confirmActions}`}>
              <button type="button" className={styles.cancelButton} onClick={closeModal} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className={styles.removeButton} onClick={startRemoval} disabled={submitting}>
                Yes, remove advert
              </button>
            </footer>
          </>
        ) : (
          <>
            <div className={styles.body}>
              <ol className={styles.progress} aria-label={`Step ${step} of 4`}>
                {REMOVAL_STEPS.map((item) => (
                  <li
                    key={item.step}
                    className={item.step === step ? styles.progressCurrent : item.step < step ? styles.progressComplete : ''}
                    aria-current={item.step === step ? 'step' : undefined}
                  >
                    <span>{item.step}</span>
                    <small>{item.label}</small>
                  </li>
                ))}
              </ol>

              {step === 1 ? (
                <section className={styles.step} aria-labelledby="advert-removal-outcome-title">
                  <div className={styles.stepHeader}>
                    <strong id="advert-removal-outcome-title" ref={stepHeadingRef} tabIndex={-1}>What happened to this advert?</strong>
                    <small>Choose the closest outcome.</small>
                  </div>
                  <div className={styles.reasonGrid} role="group" aria-label="Reason for removing advert">
                    {OUTCOME_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.option} ${reason === option.value ? styles.optionSelected : ''}`}
                        aria-pressed={reason === option.value}
                        onClick={() => {
                          setReason(option.value);
                          if (option.value !== 'sold' && option.value !== 'traded') setFinalPrice('');
                          if (option.value === 'created_by_mistake') setNotes('');
                          setError('');
                        }}
                        disabled={submitting}
                      >
                        <span aria-hidden="true" />
                        <strong>{option.label}</strong>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {step === 2 ? (
                <section className={styles.step} aria-labelledby="advert-removal-details-title">
                  <div className={styles.stepHeader}>
                    <strong id="advert-removal-details-title" ref={stepHeadingRef} tabIndex={-1}>{detailsHeading(reason)}</strong>
                    <small>{isCompletedDeal ? 'Save the final amount and any useful reference.' : reason === 'other' ? 'Briefly explain why the advert is being removed.' : 'Add a short note if it will help with future records.'}</small>
                  </div>
                  {reason === 'created_by_mistake' ? (
                    <div className={styles.informationCard}>
                      <strong>No advert details are needed</strong>
                      <p>The final step will confirm that only the advert is withdrawn.</p>
                    </div>
                  ) : (
                    <div className={styles.detailsGrid}>
                      {isCompletedDeal ? (
                        <label className={styles.textField}>
                          <span>{finalPriceLabel}</span>
                          <div className={styles.moneyField}>
                            <span aria-hidden="true">R</span>
                            <input
                              value={finalPrice}
                              onChange={(event) => {
                                setFinalPrice(event.target.value);
                                setError('');
                              }}
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="0"
                              disabled={submitting}
                              aria-label={finalPriceLabel}
                            />
                          </div>
                          <small>Optional, excluding VAT.</small>
                        </label>
                      ) : null}
                      <label className={`${styles.textField} ${styles.noteField}`}>
                        <span>{reason === 'other' ? 'What happened?' : 'Reference or note'}</span>
                        <textarea
                          value={notes}
                          onChange={(event) => {
                            setNotes(event.target.value);
                            setError('');
                          }}
                          rows={3}
                          maxLength={500}
                          placeholder={reason === 'other' ? 'Briefly explain why the advert is being removed.' : 'Buyer, dealer or another useful reference'}
                          disabled={submitting}
                          required={reason === 'other'}
                          aria-describedby={reason === 'other' ? otherHelpId : undefined}
                          aria-invalid={reason === 'other' && error === 'Please briefly explain what happened.'}
                        />
                        <small id={reason === 'other' ? otherHelpId : undefined}>{reason === 'other' ? 'A short explanation is required.' : 'Optional.'}</small>
                      </label>
                    </div>
                  )}
                </section>
              ) : null}

              {step === 3 ? (
                <section className={styles.step} aria-labelledby="advert-removal-impact-title">
                  <div className={styles.impactCard}>
                    <div className={styles.stepHeader}>
                      <strong id="advert-removal-impact-title" ref={stepHeadingRef} tabIndex={-1}>Did Aim4price help with this outcome in any way?</strong>
                      <small>Pricing, the valuation, Marketplace or another Aim4price feature may have helped you decide, negotiate or complete the outcome.</small>
                    </div>
                    <div className={styles.helpGrid} role="group" aria-label="Did Aim4price help with this outcome in any way?">
                      {[
                        { value: true, label: 'Yes' },
                        { value: false, label: 'No' },
                      ].map((option) => (
                        <button
                          key={String(option.value)}
                          type="button"
                          className={`${styles.helpButton} ${aim4priceHelped === option.value ? styles.helpButtonSelected : ''}`}
                          aria-pressed={aim4priceHelped === option.value}
                          onClick={() => {
                            setAim4priceHelped(option.value);
                            setError('');
                          }}
                          disabled={submitting}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}

              {step === 4 ? (
                <section className={styles.step} aria-labelledby="advert-removal-information-title">
                  <div className={styles.stepHeader}>
                    <strong id="advert-removal-information-title" ref={stepHeadingRef} tabIndex={-1}>Review what will happen</strong>
                    <small>Confirm the outcome before withdrawing the advert.</small>
                  </div>
                  <dl className={styles.summary}>
                    <div><dt>Outcome</dt><dd>{outcomeLabel(reason)}</dd></div>
                    {isCompletedDeal ? <div><dt>Final amount</dt><dd>{parseOptionalMoney(finalPrice) ? money(parseOptionalMoney(finalPrice) ?? 0) : 'Not recorded'}</dd></div> : null}
                    <div><dt>Aim4price helped</dt><dd>{aim4priceHelped ? 'Yes' : 'No'}</dd></div>
                  </dl>
                  <div className={styles.informationCard}>
                    <strong>Withdraw advert and keep asset</strong>
                    <p>The advert is removed from Marketplace and this showroom. Your saved asset, valuation and history stay available.</p>
                  </div>
                </section>
              ) : null}

              {error ? <p className={styles.error} role="alert">{error}</p> : null}
            </div>

            <footer className={styles.actions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={step === 1 ? closeModal : previousStep}
                disabled={submitting}
              >
                {step === 1 ? 'Cancel' : 'Back'}
              </button>
              {step < 4 ? (
                <button type="button" className={styles.primaryButton} onClick={nextStep} disabled={submitting || (step === 1 && !reason) || (step === 3 && aim4priceHelped === null)}>
                  Next
                </button>
              ) : (
                <button type="button" className={styles.removeButton} onClick={() => void submitOutcome()} disabled={submitting}>
                  {submitting ? 'Removing advert…' : 'Remove advert'}
                </button>
              )}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
