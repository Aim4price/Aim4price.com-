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
  { value: 'sold', label: 'Equipment was sold' },
  { value: 'traded', label: 'Equipment was traded in' },
  { value: 'no_longer_available', label: 'Equipment is no longer available' },
  { value: 'decided_not_to_sell', label: 'Decided not to sell' },
  { value: 'created_by_mistake', label: 'Advert was created by mistake' },
  { value: 'other', label: 'Other' },
];

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
  const closeRef = useRef(onClose);
  const submittingRef = useRef(false);
  const [reason, setReason] = useState<MarketplaceOutcomeReason | ''>('');
  const [aim4priceHelped, setAim4priceHelped] = useState<boolean | null>(null);
  const [finalPrice, setFinalPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  closeRef.current = onClose;
  submittingRef.current = submitting;

  useEffect(() => {
    setReason('');
    setAim4priceHelped(null);
    setFinalPrice('');
    setNotes('');
    setSubmitting(false);
    setError('');
  }, [listing?.id]);

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
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <h2 id={titleId}>Remove advert</h2>
            <p id={descriptionId}>
              This removes it from Marketplace and your showroom. Your saved asset and valuation stay available.
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

        <div className={styles.body}>
          <div className={styles.listingSummary}>
            {listing.imageSrc ? <img src={listing.imageSrc} alt="" /> : null}
            <div>
              <strong>{listing.title}</strong>
              <span>
                {money(listing.askingPriceExVat)} excl. VAT{location ? ` · ${location}` : ''}
              </span>
            </div>
          </div>

          <fieldset className={styles.fieldset} aria-required="true">
            <legend>What happened to this advert?</legend>
            <div className={styles.reasonGrid}>
              {OUTCOME_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`${styles.option} ${reason === option.value ? styles.optionSelected : ''}`}
                >
                  <input
                    type="radio"
                    name={`marketplace-outcome-${titleId}`}
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => {
                      setReason(option.value);
                      setError('');
                    }}
                    disabled={submitting}
                    required
                  />
                  <span aria-hidden="true" />
                  <strong>{option.label}</strong>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset} aria-required="true">
            <legend>Did Aim4price help with this outcome?</legend>
            <p>Your answer helps us understand where Aim4price adds value.</p>
            <div className={styles.helpGrid}>
              {[
                { value: true, label: 'Yes' },
                { value: false, label: 'No' },
              ].map((option) => (
                <label
                  key={String(option.value)}
                  className={`${styles.option} ${aim4priceHelped === option.value ? styles.optionSelected : ''}`}
                >
                  <input
                    type="radio"
                    name={`marketplace-helped-${titleId}`}
                    checked={aim4priceHelped === option.value}
                    onChange={() => {
                      setAim4priceHelped(option.value);
                      setError('');
                    }}
                    disabled={submitting}
                    required
                  />
                  <span aria-hidden="true" />
                  <strong>{option.label}</strong>
                </label>
              ))}
            </div>
          </fieldset>

          {isCompletedDeal ? (
            <label className={styles.textField}>
              <span>{finalPriceLabel}</span>
              <div className={styles.moneyField}>
                <span aria-hidden="true">R</span>
                <input
                  value={finalPrice}
                  onChange={(event) => setFinalPrice(event.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  disabled={submitting}
                  aria-label={finalPriceLabel}
                />
              </div>
              <small>This is optional, but helps Aim4price improve future valuations.</small>
            </label>
          ) : null}

          <label className={styles.textField}>
            <span>{reason === 'other' ? 'What happened?' : 'Additional note (optional)'}</span>
            <textarea
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setError('');
              }}
              rows={3}
              maxLength={500}
              placeholder={reason === 'other' ? 'Briefly explain why the advert is being removed.' : 'Add anything else Aim4price should know.'}
              disabled={submitting}
              required={reason === 'other'}
              aria-describedby={reason === 'other' ? otherHelpId : undefined}
              aria-invalid={reason === 'other' && error === 'Please briefly explain what happened.'}
            />
            {reason === 'other' ? <small id={otherHelpId}>A short explanation is required for Other.</small> : null}
          </label>

          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>

        <footer className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={closeModal} disabled={submitting}>
            Keep advert
          </button>
          <button
            type="button"
            className={styles.removeButton}
            onClick={() => void submitOutcome()}
            disabled={submitting}
          >
            {submitting ? 'Removing advert…' : 'Remove advert'}
          </button>
        </footer>
      </section>
    </div>
  );
}
