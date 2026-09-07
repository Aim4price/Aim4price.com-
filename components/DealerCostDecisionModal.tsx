'use client';

import { useEffect, useState } from 'react';
import styles from './DealerCostDecisionModal.module.css';

type DealerCostAction = 'store' | 'delete';
type DealerCostDecision = 'approve' | 'decline' | 'keep' | 'delete';

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
  action?: DealerCostAction;
  invoice?: DealerCostInvoice;
  message?: string;
  error?: string;
};

type DealerCostDecisionModalProps = {
  invoiceId: string | null;
  loginHref?: string;
  onClose: () => void;
  onResolved: (
    action: DealerCostAction,
    decision: DealerCostDecision,
    message: string,
  ) => void;
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
  const [action, setAction] = useState<DealerCostAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingDecision, setSavingDecision] = useState<DealerCostDecision | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!invoiceId) {
      setInvoice(null);
      setAction(null);
      setError('');
      return;
    }

    const activeInvoiceId = invoiceId;
    const controller = new AbortController();
    setLoading(true);
    setInvoice(null);
    setAction(null);
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
        if (!response.ok || !payload?.ok || !payload.invoice || !payload.action) {
          throw new Error(payload?.error || 'Failed to load this dealer cost.');
        }
        setInvoice(payload.invoice);
        setAction(payload.action);
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
    if (!invoiceId || !action) return;
    const activeInvoiceId = invoiceId;
    const activeAction = action;
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
        activeAction,
        decision,
        payload.message || (
          activeAction === 'delete'
            ? decision === 'keep'
              ? 'The cost was kept in your Cost Ledger.'
              : 'The cost was permanently deleted from your Cost Ledger.'
            : decision === 'approve'
              ? 'This dealer cost is now in your Cost Ledger.'
              : 'The cost will remain visible to the dealer only.'
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save your cost decision.');
    } finally {
      setSavingDecision(null);
    }
  }

  const isDeletion = action === 'delete';
  const workItems = invoice
    ? [
        ['Maintenance', invoice.maintenanceWorkDone],
        ['Parts', invoice.partsSupplied],
        ['Repairs', invoice.repairWorkDone],
        ['Notes', invoice.notes],
      ].filter((entry) => entry[1])
    : [];

  return (
    <div className={styles.overlay} data-website-overlay role="presentation">
      <button
        type="button"
        className={styles.backdrop}
        onClick={onClose}
        aria-label="Close dealer cost decision"
        disabled={Boolean(savingDecision)}
      />
      <section
        className={`${styles.modal} ${isDeletion ? styles.deletionModal : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dealer-cost-decision-title"
      >
        <header className={styles.header}>
          <div className={styles.headerIntro}>
            <div>
              <h2 id="dealer-cost-decision-title">
                {isDeletion ? 'Keep or delete this cost?' : 'Add this cost to your ledger?'}
              </h2>
              <p>
                {isDeletion
                  ? 'The dealer removed this record. Your copy stays protected until you decide what should happen.'
                  : 'Check the details before adding this dealer cost to your Cost Ledger.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close dealer cost decision"
            disabled={Boolean(savingDecision)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.state}>
              <span className={styles.spinner} aria-hidden="true" />
              Loading cost details…
            </div>
          ) : null}
          {error ? <div className={styles.error} role="alert">{error}</div> : null}

          {!loading && invoice ? (
            <>
              <section className={styles.summary}>
                <div className={styles.summaryContext}>
                  <strong>{invoice.createdByDisplayName || 'Dealer'}</strong>
                  <p>{invoice.assetTitle}</p>
                </div>
                <div className={styles.total}>
                  <span>Total incl. VAT</span>
                  <strong>{formatMoney(invoice.totalIncVat)}</strong>
                </div>
                <div className={styles.amountBreakdown}>
                  <span>
                    <small>Excl. VAT</small>
                    <strong>{formatMoney(invoice.subtotalExVat)}</strong>
                  </span>
                  <span>
                    <small>VAT</small>
                    <strong>{formatMoney(invoice.vatAmount)}</strong>
                  </span>
                </div>
              </section>

              <section className={styles.detailSection}>
                <div className={styles.sectionHeading}>
                  <h3>Invoice overview</h3>
                  <span>Verify before deciding</span>
                </div>
                <dl className={styles.details}>
                  <div><dt>Asset</dt><dd>{invoice.assetTitle}</dd></div>
                  <div><dt>Category</dt><dd>{invoice.assetCategoryLabel || 'Asset'}</dd></div>
                  <div><dt>Supplier</dt><dd>{invoice.supplierName || 'Not supplied'}</dd></div>
                  <div><dt>Invoice number</dt><dd>{invoice.invoiceNumber || 'Not supplied'}</dd></div>
                  <div><dt>Invoice date</dt><dd>{formatDate(invoice.invoiceDate)}</dd></div>
                  <div><dt>Usage reading</dt><dd>{formatUsage(invoice)}</dd></div>
                </dl>
              </section>

              {workItems.length ? (
                <section className={styles.work}>
                  <div className={styles.sectionHeading}>
                    <h3>Cost details</h3>
                    <span>{workItems.length} supplied</span>
                  </div>
                  <div className={styles.workGrid}>
                    {workItems.map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <p>{value}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {invoice.document?.uploadUrl ? (
                <a
                  className={styles.fileLink}
                  href={invoice.document.uploadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className={styles.fileIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M7 3h7l4 4v14H7zM14 3v5h5M10 13h5M10 17h5" />
                    </svg>
                  </span>
                  <span>
                    <strong>Open invoice or photo</strong>
                    <small>{invoice.document.fileName || 'Uploaded cost document'}</small>
                  </span>
                  <svg className={styles.fileArrow} viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M7 4h9v9M16 4 5 15" />
                  </svg>
                </a>
              ) : null}

              <aside className={`${styles.note} ${isDeletion ? styles.deletionNote : ''}`}>
                <span className={styles.noteIcon} aria-hidden="true">
                  {isDeletion ? '!' : 'i'}
                </span>
                <div>
                  <strong>{isDeletion ? 'Your copy, your decision' : 'What happens next?'}</strong>
                  <p>
                    {isDeletion
                      ? 'Keep retains the cost in your ledger and reports. Delete permanently removes your copy. The dealer can no longer edit either outcome.'
                      : 'Keep dealer-only saves this cost on the dealer side only. Add to Cost Ledger also saves it in your Cost Ledger and owner reports.'}
                  </p>
                </div>
              </aside>
            </>
          ) : null}
        </div>

        <footer className={styles.footer}>
          {isDeletion ? (
            <>
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => void saveDecision('delete')}
                disabled={!invoice || Boolean(savingDecision)}
              >
                {savingDecision === 'delete' ? 'Deleting…' : 'Delete permanently'}
              </button>
              <button
                type="button"
                className={styles.approveButton}
                onClick={() => void saveDecision('keep')}
                disabled={!invoice || Boolean(savingDecision)}
              >
                {savingDecision === 'keep' ? 'Keeping…' : 'Keep in Cost Ledger'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.declineButton}
                onClick={() => void saveDecision('decline')}
                disabled={!invoice || Boolean(savingDecision)}
              >
                {savingDecision === 'decline' ? 'Saving…' : 'Keep dealer-only'}
              </button>
              <button
                type="button"
                className={styles.approveButton}
                onClick={() => void saveDecision('approve')}
                disabled={!invoice || Boolean(savingDecision)}
              >
                {savingDecision === 'approve' ? 'Adding…' : 'Add to Cost Ledger'}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}

