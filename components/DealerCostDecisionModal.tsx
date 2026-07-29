'use client';

import { useEffect, useState } from 'react';
import styles from './DealerCostDecisionModal.module.css';

type DealerCostDecision = 'approve' | 'decline';

type DealerCostInvoice = {
  id: string;
  assetTitle: string;
  assetCategoryLabel: string;
  createdByDisplayName: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  subtotalExVat: number | null;
  vatAmount: number | null;
  totalIncVat: number;
  usageReading: number | null;
  usageMetric: 'none' | 'hours' | 'km' | 'percentage';
  notes: string;
  maintenanceWorkDone: string;
  partsSupplied: string;
  repairWorkDone: string;
  document: {
    uploadUrl: string;
    fileName: string;
  } | null;
};

type DealerCostResponse = {
  ok?: boolean;
  invoice?: DealerCostInvoice;
  message?: string;
  error?: string;
};

type DealerCostDecisionModalProps = {
  invoiceId: string | null;
  loginHref?: string;
  onClose: () => void;
  onResolved: (decision: DealerCostDecision, message: string) => void;
};

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return 'Not supplied';
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function formatUsage(invoice: DealerCostInvoice): string {
  if (invoice.usageReading === null || invoice.usageMetric === 'none') return 'Not supplied';
  const value = new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 }).format(invoice.usageReading);
  if (invoice.usageMetric === 'percentage') return `${value}%`;
  return `${value} ${invoice.usageMetric}`;
}

export default function DealerCostDecisionModal({
  invoiceId,
  loginHref = '/auth#login',
  onClose,
  onResolved,
}: DealerCostDecisionModalProps) {
  const [invoice, setInvoice] = useState<DealerCostInvoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingDecision, setSavingDecision] = useState<DealerCostDecision | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!invoiceId) {
      setInvoice(null);
      setError('');
      return;
    }

    const activeInvoiceId = invoiceId;
    const controller = new AbortController();
    setLoading(true);
    setInvoice(null);
    setError('');

    async function loadInvoice() {
      try {
        const response = await fetch(`/api/dealer-cost-proposals/${encodeURIComponent(activeInvoiceId)}`, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as DealerCostResponse | null;
        if (response.status === 401) {
          window.location.replace(loginHref);
          return;
        }
        if (!response.ok || !payload?.ok || !payload.invoice) {
          throw new Error(payload?.error || 'Failed to load this dealer cost.');
        }
        setInvoice(payload.invoice);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Failed to load this dealer cost.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadInvoice();
    return () => controller.abort();
  }, [invoiceId, loginHref]);

  useEffect(() => {
    if (!invoiceId) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingDecision) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [invoiceId, onClose, savingDecision]);

  if (!invoiceId) return null;

  async function saveDecision(decision: DealerCostDecision) {
    if (!invoiceId) return;
    const activeInvoiceId = invoiceId;
    setSavingDecision(decision);
    setError('');

    try {
      const response = await fetch(`/api/dealer-cost-proposals/${encodeURIComponent(activeInvoiceId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const payload = await response.json().catch(() => null) as DealerCostResponse | null;
      if (response.status === 401) {
        window.location.replace(loginHref);
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to save your cost decision.');
      }
      onResolved(
        decision,
        payload.message || (
          decision === 'approve'
            ? 'The dealer cost was stored in your Cost Ledger.'
            : 'The cost will remain visible to the dealer only.'
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save your cost decision.');
    } finally {
      setSavingDecision(null);
    }
  }

  const workItems = invoice
    ? [
        ['Maintenance', invoice.maintenanceWorkDone],
        ['Parts', invoice.partsSupplied],
        ['Repairs', invoice.repairWorkDone],
        ['Notes', invoice.notes],
      ].filter((entry) => entry[1])
    : [];

  return (
    <div className={styles.overlay} role="presentation">
      <button
        type="button"
        className={styles.backdrop}
        onClick={onClose}
        aria-label="Close dealer cost"
        disabled={Boolean(savingDecision)}
      />
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dealer-cost-decision-title"
      >
        <header className={styles.header}>
          <div>
            <span>Owner decision</span>
            <h2 id="dealer-cost-decision-title">Store this dealer cost?</h2>
            <p>Review the record before choosing whether it must appear in your Cost Ledger.</p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close dealer cost"
            disabled={Boolean(savingDecision)}
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          {loading ? <div className={styles.state}>Loading dealer cost…</div> : null}
          {error ? <div className={styles.error} role="alert">{error}</div> : null}

          {!loading && invoice ? (
            <>
              <section className={styles.summary}>
                <div>
                  <span>Total incl. VAT</span>
                  <strong>{formatMoney(invoice.totalIncVat)}</strong>
                </div>
                <p>
                  Added by {invoice.createdByDisplayName || 'the dealer'} for{' '}
                  <strong>{invoice.assetTitle}</strong>.
                </p>
              </section>

              <dl className={styles.details}>
                <div><dt>Asset</dt><dd>{invoice.assetTitle}</dd></div>
                <div><dt>Category</dt><dd>{invoice.assetCategoryLabel || 'Asset'}</dd></div>
                <div><dt>Supplier</dt><dd>{invoice.supplierName || 'Not supplied'}</dd></div>
                <div><dt>Invoice number</dt><dd>{invoice.invoiceNumber || 'Not supplied'}</dd></div>
                <div><dt>Invoice date</dt><dd>{formatDate(invoice.invoiceDate)}</dd></div>
                <div><dt>Usage reading</dt><dd>{formatUsage(invoice)}</dd></div>
                <div><dt>Subtotal excl. VAT</dt><dd>{formatMoney(invoice.subtotalExVat)}</dd></div>
                <div><dt>VAT</dt><dd>{formatMoney(invoice.vatAmount)}</dd></div>
              </dl>

              {workItems.length ? (
                <section className={styles.work}>
                  <h3>Cost details</h3>
                  {workItems.map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <p>{value}</p>
                    </div>
                  ))}
                </section>
              ) : null}

              {invoice.document?.uploadUrl ? (
                <a
                  className={styles.fileLink}
                  href={invoice.document.uploadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>View invoice or photo</span>
                  <small>{invoice.document.fileName || 'Uploaded cost document'}</small>
                </a>
              ) : null}

              <aside className={styles.note}>
                <strong>Your choice controls owner-side storage</strong>
                <p>
                  Yes adds the cost to your Cost Ledger. No keeps the record on the dealer side only.
                  The dealer can still manage its own record.
                </p>
              </aside>
            </>
          ) : null}
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.declineButton}
            onClick={() => void saveDecision('decline')}
            disabled={!invoice || Boolean(savingDecision)}
          >
            {savingDecision === 'decline' ? 'Saving…' : 'No, keep dealer only'}
          </button>
          <button
            type="button"
            className={styles.approveButton}
            onClick={() => void saveDecision('approve')}
            disabled={!invoice || Boolean(savingDecision)}
          >
            {savingDecision === 'approve' ? 'Saving…' : 'Yes, store cost'}
          </button>
        </footer>
      </section>
    </div>
  );
}
