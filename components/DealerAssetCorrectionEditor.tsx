'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from './WebsitePortal';
import { useRouter } from 'next/navigation';
import type {
  DealerAssetCorrectionField,
  DealerAssetCorrectionRequest,
  DealerAssetCorrectionSource,
} from '../lib/dealer-asset-corrections';
import styles from './DealerAssetCorrectionEditor.module.css';

type CorrectionResponse = {
  ok?: boolean;
  correction?: DealerAssetCorrectionRequest;
  error?: string;
};

type DealerAssetCorrectionEditorProps = {
  assetTitle: string;
  sourceType: DealerAssetCorrectionSource;
  sourceId: string;
  serialNumber: string;
  replacementPriceExVat: number | null;
  licenseRenewalDate?: string;
  correction?: DealerAssetCorrectionRequest | null;
  canUpdateSerial?: boolean;
  canUpdateReplacementPrice?: boolean;
  canUpdateLicenseRenewalDate?: boolean;
  actionClassName?: string;
  iconClassName?: string;
  onSaved?: (correction: DealerAssetCorrectionRequest) => void;
};

function SerialIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`${styles.actionIcon} ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.75" y="5.25" width="16.5" height="13.5" rx="2.25" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M7.25 9.25h5.75M7.25 13h9.5M7.25 16h6.25" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function PriceIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`${styles.actionIcon} ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.75" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M12 6.75v10.5M15.25 8.6c-.72-.75-1.75-1.13-3.1-1.13-1.84 0-3.15.9-3.15 2.3 0 3.5 6.2 1.35 6.2 4.88 0 1.4-1.32 2.3-3.25 2.3-1.45 0-2.72-.47-3.58-1.4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LicenseIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`${styles.actionIcon} ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.75h7l3 3V20.25H7z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M14 3.75v3h3M9.5 11h5M9.5 14.5h5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Not saved';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not saved';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? 'Not saved'
    : new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium' }).format(parsed);
}

export default function DealerAssetCorrectionEditor({
  assetTitle,
  sourceType,
  sourceId,
  serialNumber,
  replacementPriceExVat,
  licenseRenewalDate = '',
  correction,
  canUpdateSerial = true,
  canUpdateReplacementPrice = true,
  canUpdateLicenseRenewalDate = false,
  actionClassName = '',
  iconClassName = '',
  onSaved,
}: DealerAssetCorrectionEditorProps) {
  const router = useRouter();
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [localCorrection, setLocalCorrection] = useState<DealerAssetCorrectionRequest | null>(correction ?? null);
  const [activeField, setActiveField] = useState<DealerAssetCorrectionField | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setMounted(true), []);
  useEffect(() => setLocalCorrection(correction ?? null), [correction]);

  const effectiveCorrection = localCorrection?.status === 'pending' ? localCorrection : null;
  const effectiveSerialNumber = effectiveCorrection?.serialNumberChanged && effectiveCorrection.proposedSerialNumber
    ? effectiveCorrection.proposedSerialNumber
    : serialNumber;
  const effectiveReplacementPrice = effectiveCorrection?.replacementPriceChanged
    ? effectiveCorrection.proposedReplacementPriceExVat
    : replacementPriceExVat;
  const effectiveLicenseRenewalDate = effectiveCorrection?.licenseRenewalDateChanged
    ? effectiveCorrection.proposedLicenseRenewalDate || licenseRenewalDate
    : licenseRenewalDate;
  const pendingFieldLabel = effectiveCorrection?.serialNumberChanged
    ? 'serial number'
    : effectiveCorrection?.replacementPriceChanged
      ? 'replacement price'
      : effectiveCorrection?.licenseRenewalDateChanged
        ? 'renewal date'
        : '';

  useEffect(() => {
    if (!activeField) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setActiveField(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeField, saving]);

  function openEditor(field: DealerAssetCorrectionField) {
    if (effectiveCorrection) return;
    setError('');
    setActiveField(field);
    setDraft(
      field === 'serialNumber'
        ? effectiveSerialNumber
        : field === 'licenseRenewalDate'
          ? effectiveLicenseRenewalDate
          : effectiveReplacementPrice === null
            ? ''
            : String(effectiveReplacementPrice),
    );
  }

  function closeEditor() {
    if (saving) return;
    setActiveField(null);
    setError('');
  }

  async function submitCorrection() {
    if (!activeField || saving) return;
    setSaving(true);
    setError('');

    try {
      const response = await fetch(
        activeField === 'licenseRenewalDate' ? '/api/licensing/renewal-updates' : '/api/dealer/asset-corrections',
        {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType,
          sourceId,
          field: activeField,
          value: activeField === 'replacementPriceExVat' ? Number(draft) : draft,
        }),
      });
      const payload = await response.json().catch(() => null) as CorrectionResponse | null;
      if (!response.ok || !payload?.ok || !payload.correction) {
        throw new Error(payload?.error || 'Failed to send the correction to the owner.');
      }

      setLocalCorrection(payload.correction);
      onSaved?.(payload.correction);
      setActiveField(null);
      if (!onSaved) router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to send the correction to the owner.');
    } finally {
      setSaving(false);
    }
  }

  const fieldIsSerial = activeField === 'serialNumber';
  const fieldIsLicenseRenewal = activeField === 'licenseRenewalDate';
  const ownerValue = fieldIsSerial
    ? effectiveCorrection?.currentSerialNumber || serialNumber || 'Not saved'
    : fieldIsLicenseRenewal
      ? formatDate(effectiveCorrection?.currentLicenseRenewalDate || licenseRenewalDate)
      : formatCurrency(effectiveCorrection?.currentReplacementPriceExVat ?? replacementPriceExVat);

  return (
    <>
      {canUpdateSerial ? (
        <button
          type="button"
          className={`${actionClassName || styles.actionButton} ${styles.actionButtonBase}`}
          onClick={() => openEditor('serialNumber')}
          disabled={Boolean(effectiveCorrection)}
          title={effectiveCorrection ? 'Resolve the pending dealer update before proposing another change.' : undefined}
        >
          <SerialIcon className={iconClassName} />
          <span>
            <strong>Update serial number</strong>
            <small>{effectiveSerialNumber || 'No serial number saved'}.</small>
          </span>
        </button>
      ) : null}

      {canUpdateReplacementPrice ? (
        <button
          type="button"
          className={`${actionClassName || styles.actionButton} ${styles.actionButtonBase}`}
          onClick={() => openEditor('replacementPriceExVat')}
          disabled={Boolean(effectiveCorrection)}
          title={effectiveCorrection ? 'Resolve the pending dealer update before proposing another change.' : undefined}
        >
          <PriceIcon className={iconClassName} />
          <span>
            <strong>Update replacement price</strong>
            <small>{formatCurrency(effectiveReplacementPrice)} excl. VAT.</small>
          </span>
        </button>
      ) : null}

      {canUpdateLicenseRenewalDate ? (
        <button
          type="button"
          className={`${actionClassName || styles.actionButton} ${styles.actionButtonBase}`}
          onClick={() => openEditor('licenseRenewalDate')}
          disabled={Boolean(effectiveCorrection)}
          title={effectiveCorrection ? 'The owner must decide the pending update first.' : undefined}
        >
          <LicenseIcon className={iconClassName} />
          <span>
            <strong>Update renewal date</strong>
            <small>{formatDate(effectiveLicenseRenewalDate)}.</small>
          </span>
        </button>
      ) : null}

      {pendingFieldLabel ? (
        <div className={styles.pendingNotice}>
          <strong>{pendingFieldLabel === 'serial number' ? 'Serial number' : pendingFieldLabel === 'replacement price' ? 'Replacement price' : 'Renewal date'} update waiting for owner approval</strong>
          <span>The owner must accept or decline this update before another asset detail can be changed.</span>
        </div>
      ) : null}

      {mounted && activeField ? createPortal(
        <div className={styles.overlay} data-website-overlay role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEditor();
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <div className={styles.modalHeaderCopy}>
                  <h2 id={titleId}>{fieldIsSerial ? 'Update serial number' : fieldIsLicenseRenewal ? 'Update renewal date' : 'Update replacement price'}</h2>
                  <p>{assetTitle}</p>
                </div>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeEditor} disabled={saving} aria-label="Close correction form">×</button>
            </header>

            <div className={styles.modalBody}>
              <div className={styles.currentValue}>
                <span>Owner&apos;s current value</span>
                <strong>{ownerValue}</strong>
              </div>

              <label className={styles.field}>
                <span>{fieldIsSerial ? 'Correct serial number' : fieldIsLicenseRenewal ? 'New renewal date' : 'Correct replacement price (excl. VAT)'}</span>
                <input
                  autoFocus
                  type={fieldIsSerial ? 'text' : fieldIsLicenseRenewal ? 'date' : 'number'}
                  inputMode={fieldIsSerial || fieldIsLicenseRenewal ? undefined : 'decimal'}
                  min={fieldIsSerial || fieldIsLicenseRenewal ? undefined : '1'}
                  step={fieldIsSerial || fieldIsLicenseRenewal ? undefined : '0.01'}
                  maxLength={fieldIsSerial ? 200 : undefined}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={fieldIsSerial ? 'Enter the serial number' : fieldIsLicenseRenewal ? undefined : 'Enter the VAT-exclusive amount'}
                />
              </label>

              <div className={styles.explainer}>
                <strong>How this works</strong>
                <p>Your view updates immediately. The owner receives an approval notification, and the owner&apos;s Asset Register changes only after acceptance.</p>
              </div>

              {error ? <p className={styles.error} role="alert">{error}</p> : null}
            </div>

            <footer className={styles.modalFooter}>
              <button type="button" className={styles.cancelButton} onClick={closeEditor} disabled={saving}>Cancel</button>
              <button type="button" className={styles.saveButton} onClick={() => void submitCorrection()} disabled={saving || !draft.trim()}>
                {saving ? 'Sending…' : 'Send to owner'}
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

