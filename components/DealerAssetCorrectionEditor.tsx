'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  correction?: DealerAssetCorrectionRequest | null;
  actionClassName?: string;
  onSaved?: (correction: DealerAssetCorrectionRequest) => void;
};

function SerialIcon() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6.5h14v11H5zM8 10h8M8 14h5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v18M16.5 7.2c-.9-1-2.2-1.6-4-1.6-2.3 0-4 1.2-4 3.1 0 4.7 8 1.8 8 6.6 0 1.9-1.7 3.1-4.2 3.1-1.9 0-3.5-.7-4.6-2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
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

export default function DealerAssetCorrectionEditor({
  assetTitle,
  sourceType,
  sourceId,
  serialNumber,
  replacementPriceExVat,
  correction,
  actionClassName = '',
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
  const pendingLabels = useMemo(() => {
    if (!effectiveCorrection) return [];
    return [
      effectiveCorrection.serialNumberChanged ? 'serial number' : '',
      effectiveCorrection.replacementPriceChanged ? 'replacement price' : '',
    ].filter(Boolean);
  }, [effectiveCorrection]);

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
    setError('');
    setActiveField(field);
    setDraft(
      field === 'serialNumber'
        ? effectiveSerialNumber
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
      const response = await fetch('/api/dealer/asset-corrections', {
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
  const ownerValue = fieldIsSerial
    ? effectiveCorrection?.currentSerialNumber || serialNumber || 'Not saved'
    : formatCurrency(effectiveCorrection?.currentReplacementPriceExVat ?? replacementPriceExVat);

  return (
    <>
      <button type="button" className={`${actionClassName || styles.actionButton} ${styles.actionButtonBase}`} onClick={() => openEditor('serialNumber')}>
        <SerialIcon />
        <span>
          <strong>Update serial number</strong>
          <small>{effectiveSerialNumber || 'No serial number saved'}.</small>
        </span>
      </button>

      <button type="button" className={`${actionClassName || styles.actionButton} ${styles.actionButtonBase}`} onClick={() => openEditor('replacementPriceExVat')}>
        <PriceIcon />
        <span>
          <strong>Update replacement price</strong>
          <small>{formatCurrency(effectiveReplacementPrice)} excl. VAT.</small>
        </span>
      </button>

      {pendingLabels.length ? (
        <div className={styles.pendingNotice}>
          <strong>Waiting for owner approval</strong>
          <span>The proposed {pendingLabels.join(' and ')} already shows in your dealer view.</span>
        </div>
      ) : null}

      {mounted && activeField ? createPortal(
        <div className={styles.overlay} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEditor();
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header className={styles.modalHeader}>
              <div>
                <span>Dealer correction</span>
                <h2 id={titleId}>{fieldIsSerial ? 'Update serial number' : 'Update replacement price'}</h2>
                <p>{assetTitle}</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeEditor} disabled={saving} aria-label="Close correction form">×</button>
            </header>

            <div className={styles.modalBody}>
              <div className={styles.currentValue}>
                <span>Owner&apos;s current value</span>
                <strong>{ownerValue}</strong>
              </div>

              <label className={styles.field}>
                <span>{fieldIsSerial ? 'Correct serial number' : 'Correct replacement price (excl. VAT)'}</span>
                <input
                  autoFocus
                  type={fieldIsSerial ? 'text' : 'number'}
                  inputMode={fieldIsSerial ? 'text' : 'decimal'}
                  min={fieldIsSerial ? undefined : '1'}
                  step={fieldIsSerial ? undefined : '0.01'}
                  maxLength={fieldIsSerial ? 200 : undefined}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={fieldIsSerial ? 'Enter the serial number' : 'Enter the VAT-exclusive amount'}
                />
              </label>

              <div className={styles.explainer}>
                <strong>How this works</strong>
                <p>Your dealer view updates immediately. The owner receives an approval notification, and the owner&apos;s Asset Register changes only after acceptance.</p>
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
