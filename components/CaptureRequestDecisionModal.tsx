'use client';

import { useEffect, useMemo, useState } from 'react';
import baseStyles from './DealerCostDecisionModal.module.css';
import styles from './CaptureRequestDecisionModal.module.css';

type CaptureReviewFile = {
  id: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  previewUrl: string;
};

type CaptureReviewRequest = {
  id: string;
  publicReference: string;
  requestType: 'invoice' | 'fuel_slip';
  submissionChannel: 'dealer_upload' | 'public_drop';
  status: string;
  target: {
    assetId: string | null;
    fuelStorageId: string | null;
    label: string;
  };
  contributor: {
    type: string;
    name: string;
  };
  verifiedFields: Record<string, string>;
  submittedAtIso: string;
  verifiedAtIso: string;
  files: CaptureReviewFile[];
  output: {
    type: 'invoice' | 'fuel_slip';
    id: string | null;
    href: string;
  } | null;
};

type CaptureDecisionResponse = {
  ok?: boolean;
  status?: string;
  request?: CaptureReviewRequest | null;
  message?: string;
  error?: string;
};

type CaptureRequestDecisionModalProps = {
  requestId: string | null;
  onClose: () => void;
  onResolved: (message: string) => void;
};

const FIELD_LABELS: Record<string, string> = {
  supplierName: 'Supplier',
  invoiceNumber: 'Invoice number',
  slipNumber: 'Slip number',
  documentDate: 'Document date',
  subtotalExVat: 'Subtotal excl. VAT',
  vatAmount: 'VAT',
  totalIncVat: 'Total incl. VAT',
  totalAmount: 'Total amount',
  fuelType: 'Fuel type',
  litres: 'Litres',
  operatorName: 'Operator',
  activityText: 'Activity',
  workAreaText: 'Work area',
  notes: 'Notes',
};

const MONEY_FIELDS = new Set(['subtotalExVat', 'vatAmount', 'totalIncVat', 'totalAmount']);

function formatMoney(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value || 'Not supplied';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || 'Not supplied';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1_000_000) return `${Math.max(1, Math.round(value / 1_000))} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

function displayField(key: string, value: string): string {
  if (!value) return 'Not supplied';
  if (MONEY_FIELDS.has(key)) return formatMoney(value);
  if (key === 'documentDate') return formatDate(value);
  if (key === 'litres') return `${value} L`;
  return value;
}

function contributorLabel(request: CaptureReviewRequest): string {
  if (request.contributor.name) return request.contributor.name;
  return request.submissionChannel === 'dealer_upload' ? 'Contributing dealer' : 'Public contributor';
}

export default function CaptureRequestDecisionModal({
  requestId,
  onClose,
  onResolved,
}: CaptureRequestDecisionModalProps) {
  const [capture, setCapture] = useState<CaptureReviewRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingDecision, setSavingDecision] = useState<'approve' | 'decline' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!requestId) {
      setCapture(null);
      setError('');
      return;
    }

    const activeRequestId = requestId;
    const controller = new AbortController();
    setLoading(true);
    setCapture(null);
    setError('');

    async function loadCapture() {
      try {
        const response = await fetch(
          `/api/capture-requests/${encodeURIComponent(activeRequestId)}/decision`,
          { credentials: 'include', cache: 'no-store', signal: controller.signal },
        );
        const payload = await response.json().catch(() => null) as CaptureDecisionResponse | null;
        if (!response.ok || !payload?.ok || !payload.request) {
          throw new Error(payload?.error || 'This verified document could not be loaded.');
        }
        setCapture(payload.request);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'This verified document could not be loaded.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadCapture();
    return () => controller.abort();
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingDecision) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose, requestId, savingDecision]);

  const detailEntries = useMemo(() => {
    if (!capture) return [];
    return Object.entries(capture.verifiedFields)
      .filter(([key, value]) => Boolean(value) && key !== 'totalIncVat' && key !== 'totalAmount')
      .map(([key, value]) => ({
        key,
        label: FIELD_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2'),
        value: displayField(key, value),
      }));
  }, [capture]);

  if (!requestId) return null;

  async function saveDecision(decision: 'approve' | 'decline') {
    if (!capture || capture.status !== 'awaiting_owner') return;
    setSavingDecision(decision);
    setError('');
    try {
      const response = await fetch(
        `/api/capture-requests/${encodeURIComponent(capture.id)}/decision`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision }),
        },
      );
      const payload = await response.json().catch(() => null) as CaptureDecisionResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Your decision could not be saved.');
      }
      onResolved(payload.message || (
        decision === 'approve'
          ? 'The verified document was added to your ledger.'
          : 'The verified document was declined.'
      ));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your decision could not be saved.');
    } finally {
      setSavingDecision(null);
    }
  }

  const canDecide = capture?.status === 'awaiting_owner';
  const total = capture?.verifiedFields.totalIncVat || capture?.verifiedFields.totalAmount || '';
  const isInvoice = capture?.requestType !== 'fuel_slip';

  return (
    <div className={baseStyles.overlay} role="presentation">
      <button
        type="button"
        className={baseStyles.backdrop}
        onClick={onClose}
        aria-label="Close verified document review"
        disabled={Boolean(savingDecision)}
      />
      <section
        className={baseStyles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-decision-title"
      >
        <header className={baseStyles.header}>
          <div className={baseStyles.headerIntro}>
            <div>
              <h2 id="capture-decision-title">
                {canDecide
                  ? `Add this verified ${isInvoice ? 'invoice' : 'fuel slip'}?`
                  : `Verified ${isInvoice ? 'invoice' : 'fuel slip'}`}
              </h2>
              <p>Aim4price checked and captured the document. You stay in control of your ledger.</p>
            </div>
          </div>
          <button
            type="button"
            className={baseStyles.closeButton}
            onClick={onClose}
            aria-label="Close verified document review"
            disabled={Boolean(savingDecision)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </header>

        <div className={baseStyles.body}>
          {loading ? (
            <div className={baseStyles.state}>
              <span className={baseStyles.spinner} aria-hidden="true" />
              Loading verified document…
            </div>
          ) : null}
          {error ? <div className={baseStyles.error} role="alert">{error}</div> : null}

          {!loading && capture ? (
            <>
              <section className={baseStyles.summary}>
                <div className={baseStyles.summaryContext}>
                  <strong>{contributorLabel(capture)}</strong>
                  <p>{capture.target.label || 'Your asset'} · {capture.publicReference}</p>
                </div>
                <div className={baseStyles.total}>
                  <span>{total ? 'Verified total' : 'Capture status'}</span>
                  <strong>{total ? formatMoney(total) : canDecide ? 'Ready' : capture.status}</strong>
                </div>
              </section>

              <section className={baseStyles.detailSection}>
                <div className={baseStyles.sectionHeading}>
                  <h3>Verified details</h3>
                  <span>Check against the document</span>
                </div>
                <dl className={baseStyles.details}>
                  {detailEntries.map((entry) => (
                    <div key={entry.key}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>
                  ))}
                </dl>
              </section>

              {capture.files.map((file) => (
                <a
                  className={baseStyles.fileLink}
                  href={file.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  key={file.id}
                >
                  <span className={baseStyles.fileIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7zM14 3v5h5M10 13h5M10 17h5" /></svg>
                  </span>
                  <span>
                    <strong>Open original document</strong>
                    <small>{file.fileName}{formatBytes(file.byteSize) ? ` · ${formatBytes(file.byteSize)}` : ''}</small>
                  </span>
                  <svg className={baseStyles.fileArrow} viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4h9v9M16 4 5 15" /></svg>
                </a>
              ))}

              <aside className={baseStyles.note}>
                <span className={baseStyles.noteIcon} aria-hidden="true">i</span>
                <div>
                  <strong>{canDecide ? 'Nothing is saved until you approve' : 'This request is already resolved'}</strong>
                  <p>
                    {canDecide
                      ? `Approve to add the verified ${isInvoice ? 'invoice to your Cost Ledger' : 'slip to your Fuel Ledger'}, or decline to keep it out.`
                      : capture.status === 'completed'
                        ? 'This verified document has already been added to your ledger.'
                        : 'This verified document was declined and was not added to your ledger.'}
                  </p>
                </div>
              </aside>
            </>
          ) : null}
        </div>

        <footer className={baseStyles.footer}>
          {canDecide ? (
            <>
              <button
                type="button"
                className={baseStyles.declineButton}
                onClick={() => void saveDecision('decline')}
                disabled={Boolean(savingDecision)}
              >
                {savingDecision === 'decline' ? 'Declining…' : 'Decline'}
              </button>
              <button
                type="button"
                className={baseStyles.approveButton}
                onClick={() => void saveDecision('approve')}
                disabled={Boolean(savingDecision)}
              >
                {savingDecision === 'approve' ? 'Adding…' : `Approve & add to ${isInvoice ? 'Cost Ledger' : 'Fuel Ledger'}`}
              </button>
            </>
          ) : (
            <button type="button" className={`${baseStyles.approveButton} ${styles.singleAction}`} onClick={onClose}>
              Close
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
