'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AdminAssetAllocationAccount,
  AdminAssetOutcome,
  AdminAssetOutcomesReport,
  AdminAssetOutcomeRow,
} from '../../../lib/admin-asset-sales';
import styles from './page.module.css';

const PAGE_SIZE = 25;
const JOHANNESBURG_TIME_ZONE = 'Africa/Johannesburg';

type OutcomeFilter = 'all' | AdminAssetOutcome;
type InfluenceFilter = 'all' | AdminAssetOutcomeRow['aim4priceInfluence'];
type TransferFilter = 'all' | AdminAssetOutcomeRow['transferStatus'];
type OutcomeSort = 'latest' | 'oldest' | 'amount-high' | 'amount-low' | 'asset-az';
type ActionDialog = {
  mode: 'details' | 'allocate' | 'delete';
  record: AdminAssetOutcomeRow;
} | null;

const OUTCOME_LABELS: Record<AdminAssetOutcome, string> = {
  sold: 'Sold',
  traded_in: 'Traded',
  scrapped: 'Scrapped',
};

const INFLUENCE_LABELS: Record<AdminAssetOutcomeRow['aim4priceInfluence'], string> = {
  yes: 'Yes',
  no: 'No',
  unsure: 'Not sure',
  unknown: 'Not recorded',
};

const TRANSFER_LABELS: Record<AdminAssetOutcomeRow['transferStatus'], string> = {
  not_requested: 'Not allocated',
  pending: 'Waiting',
  claimed: 'Allocated',
  cancelled: 'Closed',
  expired: 'Expired',
};

function dateTime(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: JOHANNESBURG_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: JOHANNESBURG_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
}

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return '—';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/\u00a0/g, ' ');
}

function recordedAmount(record: AdminAssetOutcomeRow): number | null {
  return record.amountExVat !== null
    && Number.isFinite(record.amountExVat)
    && record.amountExVat >= 0
    ? record.amountExVat
    : null;
}

function compareRecordedAmount(
  left: AdminAssetOutcomeRow,
  right: AdminAssetOutcomeRow,
  direction: 'high' | 'low',
): number {
  const leftAmount = recordedAmount(left);
  const rightAmount = recordedAmount(right);
  if (leftAmount === null) return rightAmount === null ? 0 : 1;
  if (rightAmount === null) return -1;
  return direction === 'high' ? rightAmount - leftAmount : leftAmount - rightAmount;
}

function visibleMetrics(rows: AdminAssetOutcomeRow[]) {
  const helped = rows.filter((row) => row.aim4priceInfluence === 'yes').length;
  const notHelped = rows.filter((row) => row.aim4priceInfluence === 'no').length;
  const answered = helped + notHelped;
  return {
    total: rows.length,
    sold: rows.filter((row) => row.outcome === 'sold').length,
    traded: rows.filter((row) => row.outcome === 'traded_in').length,
    scrapped: rows.filter((row) => row.outcome === 'scrapped').length,
    helpRate: answered ? Math.round((helped / answered) * 1_000) / 10 : 0,
    allocated: rows.filter((row) => row.transferStatus === 'claimed').length,
  };
}

export default function SoldAssetsClient({
  report,
  allocationAccounts,
}: {
  report: AdminAssetOutcomesReport;
  allocationAccounts: AdminAssetAllocationAccount[];
}) {
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [influenceFilter, setInfluenceFilter] = useState<InfluenceFilter>('all');
  const [transferFilter, setTransferFilter] = useState<TransferFilter>('all');
  const [sort, setSort] = useState<OutcomeSort>('latest');
  const [page, setPage] = useState(1);
  const [actionDialog, setActionDialog] = useState<ActionDialog>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [selectedBuyerUserId, setSelectedBuyerUserId] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actionModalRef = useRef<HTMLElement>(null);
  const actionBusyRef = useRef(false);

  const rows = useMemo(() => {
    const term = search.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-ZA');
    return report.outcomes
      .filter((record) => {
        if (outcomeFilter !== 'all' && record.outcome !== outcomeFilter) return false;
        if (influenceFilter !== 'all' && record.aim4priceInfluence !== influenceFilter) return false;
        if (transferFilter !== 'all' && record.transferStatus !== transferFilter) return false;
        if (!term) return true;
        return [
          record.id,
          record.assetId,
          record.assetTitle,
          record.assetDescription,
          record.sourceUserId,
          record.sourceName,
          record.buyerUserId ?? '',
          record.note,
          OUTCOME_LABELS[record.outcome],
          INFLUENCE_LABELS[record.aim4priceInfluence],
          TRANSFER_LABELS[record.transferStatus],
        ]
          .join(' ')
          .toLocaleLowerCase('en-ZA')
          .includes(term);
      })
      .sort((left, right) => {
        if (sort === 'oldest') return dateTime(left.outcomeDate) - dateTime(right.outcomeDate);
        if (sort === 'amount-high') {
          return compareRecordedAmount(left, right, 'high')
            || dateTime(right.outcomeDate) - dateTime(left.outcomeDate);
        }
        if (sort === 'amount-low') {
          return compareRecordedAmount(left, right, 'low')
            || dateTime(right.outcomeDate) - dateTime(left.outcomeDate);
        }
        if (sort === 'asset-az') {
          return left.assetTitle.localeCompare(right.assetTitle, 'en-ZA', { sensitivity: 'base' });
        }
        return dateTime(right.outcomeDate) - dateTime(left.outcomeDate);
      });
  }, [
    influenceFilter,
    outcomeFilter,
    report.outcomes,
    search,
    sort,
    transferFilter,
  ]);

  const metrics = useMemo(() => visibleMetrics(rows), [rows]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = rows.length ? (currentPage - 1) * PAGE_SIZE : 0;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, rows.length);
  const pageRows = rows.slice(pageStart, pageEnd);
  const filtersActive = Boolean(search.trim())
    || outcomeFilter !== 'all'
    || influenceFilter !== 'all'
    || transferFilter !== 'all'
    || sort !== 'latest';

  const availableAccounts = useMemo(() => {
    if (actionDialog?.mode !== 'allocate') return [];
    const term = accountSearch.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-ZA');
    return allocationAccounts.filter((account) => (
      account.userId !== actionDialog.record.sourceUserId
      && (
        !term
        || [
          account.name,
          account.email,
          account.accountSubtype,
          account.accountType,
        ]
          .join(' ')
          .toLocaleLowerCase('en-ZA')
          .includes(term)
      )
    ));
  }, [accountSearch, actionDialog, allocationAccounts]);

  function openAction(
    mode: NonNullable<ActionDialog>['mode'],
    record: AdminAssetOutcomeRow,
    trigger: HTMLButtonElement,
  ) {
    actionTriggerRef.current = trigger;
    setActionDialog({ mode, record });
    setAccountSearch('');
    setSelectedBuyerUserId('');
    setActionError('');
  }

  function closeAction() {
    if (!actionBusy) setActionDialog(null);
  }

  function clearFilters() {
    setSearch('');
    setOutcomeFilter('all');
    setInfluenceFilter('all');
    setTransferFilter('all');
    setSort('latest');
    setPage(1);
  }

  async function submitAction() {
    if (!actionDialog || actionDialog.mode === 'details' || actionBusy) return;
    if (actionDialog.mode === 'allocate' && !selectedBuyerUserId) {
      setActionError('Choose an account.');
      return;
    }

    actionBusyRef.current = true;
    setActionBusy(true);
    setActionError('');
    try {
      const response = await fetch('/api/admin/sold-assets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionDialog.mode,
          lifecycleEventId: actionDialog.record.id,
          assetId: actionDialog.record.assetId,
          sellerUserId: actionDialog.record.sourceUserId,
          buyerUserId: actionDialog.mode === 'allocate' ? selectedBuyerUserId : undefined,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'The action could not be completed.');
      }
      window.location.reload();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'The action could not be completed.',
      );
      actionBusyRef.current = false;
      setActionBusy(false);
    }
  }

  useEffect(() => {
    if (!actionDialog) return;

    const modal = actionModalRef.current;
    const focusable = modal?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const preferredFocus = modal?.querySelector<HTMLElement>('[data-autofocus="true"]');
    const firstFocusable = focusable?.[0];
    const lastFocusable = focusable?.[focusable.length - 1];
    (preferredFocus ?? firstFocusable)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!actionBusyRef.current) setActionDialog(null);
        return;
      }
      if (event.key !== 'Tab' || !firstFocusable || !lastFocusable) return;
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      actionTriggerRef.current?.focus();
    };
  }, [actionDialog]);

  return (
    <>
      <section className={styles.metrics} aria-label="Asset register outcome summary">
        <article className={styles.featuredMetric}>
          <span>Outcomes</span>
          <strong>{metrics.total.toLocaleString('en-ZA')}</strong>
        </article>
        <article>
          <span>Sold</span>
          <strong>{metrics.sold.toLocaleString('en-ZA')}</strong>
        </article>
        <article>
          <span>Traded</span>
          <strong>{metrics.traded.toLocaleString('en-ZA')}</strong>
        </article>
        <article>
          <span>Scrapped</span>
          <strong>{metrics.scrapped.toLocaleString('en-ZA')}</strong>
        </article>
        <article className={styles.helpedMetric}>
          <span>Help rate</span>
          <strong>{metrics.helpRate.toLocaleString('en-ZA')}%</strong>
        </article>
        <article>
          <span>Allocated</span>
          <strong>{metrics.allocated.toLocaleString('en-ZA')}</strong>
        </article>
      </section>

      <section className={styles.tableCard}>
        <header className={styles.tableHeader}>
          <div className={styles.tableTitle}>
            <strong>
              {rows.length
                ? `${pageStart + 1}-${pageEnd} of ${rows.length.toLocaleString('en-ZA')}`
                : 'No matches'}
            </strong>
          </div>
          {report.outcomes.length ? (
            <div className={styles.filters}>
              <label className={styles.searchField}>
                <span>Search</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Asset, account or reference"
                />
              </label>
              <label>
                <span>Outcome</span>
                <select
                  value={outcomeFilter}
                  onChange={(event) => {
                    setOutcomeFilter(event.target.value as OutcomeFilter);
                    setPage(1);
                  }}
                >
                  <option value="all">All outcomes</option>
                  <option value="sold">Sold</option>
                  <option value="traded_in">Traded</option>
                  <option value="scrapped">Scrapped</option>
                </select>
              </label>
              <label>
                <span>Helped</span>
                <select
                  value={influenceFilter}
                  onChange={(event) => {
                    setInfluenceFilter(event.target.value as InfluenceFilter);
                    setPage(1);
                  }}
                >
                  <option value="all">All answers</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="unsure">Not sure</option>
                  <option value="unknown">Not recorded</option>
                </select>
              </label>
              <label>
                <span>Allocation</span>
                <select
                  value={transferFilter}
                  onChange={(event) => {
                    setTransferFilter(event.target.value as TransferFilter);
                    setPage(1);
                  }}
                >
                  <option value="all">All statuses</option>
                  <option value="not_requested">Not allocated</option>
                  <option value="pending">Waiting</option>
                  <option value="claimed">Allocated</option>
                  <option value="cancelled">Closed</option>
                  <option value="expired">Expired</option>
                </select>
              </label>
              <label>
                <span>Sort</span>
                <select
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value as OutcomeSort);
                    setPage(1);
                  }}
                >
                  <option value="latest">Latest</option>
                  <option value="oldest">Oldest</option>
                  <option value="amount-high">Highest value</option>
                  <option value="amount-low">Lowest value</option>
                  <option value="asset-az">Asset A-Z</option>
                </select>
              </label>
              {filtersActive ? (
                <button type="button" onClick={clearFilters}>Clear filters</button>
              ) : null}
            </div>
          ) : null}
        </header>

        {report.outcomes.length ? (
          <div className={styles.tableScroller}>
            <table aria-label="Asset register outcomes">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Outcome</th>
                  <th>Value</th>
                  <th>Helped?</th>
                  <th>Allocation</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((record) => {
                  const alreadyMoved = record.transferStatus === 'claimed';
                  return (
                    <tr key={record.id}>
                      <td className={styles.assetCell}>
                        <button
                          type="button"
                          className={styles.assetButton}
                          aria-haspopup="dialog"
                          onClick={(event) => openAction('details', record, event.currentTarget)}
                        >
                          <strong title={record.assetTitle}>{record.assetTitle}</strong>
                          <span title={record.sourceName}>· {record.sourceName}</span>
                        </button>
                      </td>
                      <td className={styles.outcomeCell}>
                        <strong>{OUTCOME_LABELS[record.outcome]}</strong>
                        <span>· {formatDate(record.outcomeDate)}</span>
                      </td>
                      <td className={styles.priceCell}>
                        <strong>{formatMoney(record.amountExVat)}</strong>
                      </td>
                      <td>
                        <span className={record.aim4priceInfluence === 'yes' ? styles.yesAnswer : styles.noAnswer}>
                          {INFLUENCE_LABELS[record.aim4priceInfluence]}
                        </span>
                      </td>
                      <td>
                        <span className={styles.statusText}>
                          {TRANSFER_LABELS[record.transferStatus]}
                        </span>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            onClick={(event) => openAction('allocate', record, event.currentTarget)}
                            disabled={alreadyMoved}
                            title={alreadyMoved ? 'This asset is already allocated.' : 'Allocate or restore'}
                          >
                            Allocate or restore
                          </button>
                          <button
                            type="button"
                            className={styles.rowDelete}
                            onClick={(event) => openAction('delete', record, event.currentTarget)}
                            disabled={alreadyMoved}
                            title={alreadyMoved ? 'Allocated outcomes cannot be deleted.' : 'Delete outcome'}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!pageRows.length ? (
              <div className={styles.empty}><strong>No outcomes found.</strong></div>
            ) : null}
          </div>
        ) : (
          <div className={styles.empty}><strong>No outcomes recorded.</strong></div>
        )}

        {report.outcomes.length ? (
          <footer className={styles.pagination}>
            <span>{rows.length.toLocaleString('en-ZA')} matching · {report.outcomes.length.toLocaleString('en-ZA')} all time</span>
            <div aria-label="Outcome pages">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </button>
              <strong>Page {currentPage} of {totalPages}</strong>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </footer>
        ) : null}
      </section>

      {actionDialog ? (
        <div className={styles.detailOverlay}>
          <button
            type="button"
            className={styles.detailBackdrop}
            onClick={closeAction}
            aria-label="Close outcome action"
          />
          <section
            ref={actionModalRef}
            className={styles.detailModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-outcome-action-title"
          >
            <header>
              <h2 id="asset-outcome-action-title" title={actionDialog.record.assetTitle}>
                {actionDialog.mode === 'details'
                  ? actionDialog.record.assetTitle
                  : `${actionDialog.mode === 'allocate' ? 'Allocate' : 'Delete'} — ${actionDialog.record.assetTitle}`}
              </h2>
              <button
                type="button"
                onClick={closeAction}
                disabled={actionBusy}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            {actionDialog.mode === 'details' ? (
              <div className={styles.detailBody}>
                <dl className={styles.detailGrid}>
                  <div><dt>Outcome</dt><dd>{OUTCOME_LABELS[actionDialog.record.outcome]} · {formatDate(actionDialog.record.outcomeDate)}</dd></div>
                  <div><dt>Value</dt><dd>{formatMoney(actionDialog.record.amountExVat)}</dd></div>
                  <div><dt>Helped</dt><dd>{INFLUENCE_LABELS[actionDialog.record.aim4priceInfluence]}</dd></div>
                  <div><dt>Allocation</dt><dd>{TRANSFER_LABELS[actionDialog.record.transferStatus]}</dd></div>
                  <div><dt>Source</dt><dd title={actionDialog.record.sourceName}>{actionDialog.record.sourceName}</dd></div>
                  <div><dt>Recorded</dt><dd>{formatDateTime(actionDialog.record.createdAtIso)}</dd></div>
                  <div className={styles.detailWide}><dt>Description</dt><dd title={actionDialog.record.assetDescription || 'No description'}>{actionDialog.record.assetDescription || '—'}</dd></div>
                  <div className={styles.detailWide}><dt>Note</dt><dd title={actionDialog.record.note || 'No note'}>{actionDialog.record.note || '—'}</dd></div>
                  <div className={styles.detailWide}><dt>References</dt><dd title={`${actionDialog.record.id} · ${actionDialog.record.assetId} · ${actionDialog.record.sourceUserId}`}>{actionDialog.record.id} · {actionDialog.record.assetId} · {actionDialog.record.sourceUserId}</dd></div>
                </dl>
              </div>
            ) : actionDialog.mode === 'allocate' ? (
              <div className={styles.actionBody}>
                <label className={styles.accountSearch}>
                  <span>Account</span>
                  <input
                    type="search"
                    value={accountSearch}
                    onChange={(event) => setAccountSearch(event.target.value)}
                    placeholder="Business, person or email"
                    data-autofocus="true"
                  />
                </label>
                <div className={styles.accountList} role="radiogroup" aria-label="Destination account">
                  <button
                    type="button"
                    className={selectedBuyerUserId === actionDialog.record.sourceUserId ? styles.accountSelected : ''}
                    role="radio"
                    aria-checked={selectedBuyerUserId === actionDialog.record.sourceUserId}
                    onClick={() => setSelectedBuyerUserId(actionDialog.record.sourceUserId)}
                  >
                    <strong>{actionDialog.record.sourceName}</strong>
                    <span>· Original account</span>
                  </button>
                  {availableAccounts.map((account) => (
                    <button
                      key={account.userId}
                      type="button"
                      className={selectedBuyerUserId === account.userId ? styles.accountSelected : ''}
                      role="radio"
                      aria-checked={selectedBuyerUserId === account.userId}
                      onClick={() => setSelectedBuyerUserId(account.userId)}
                    >
                      <strong title={account.name}>{account.name}</strong>
                      <span title={account.email || account.accountSubtype}>· {account.email || account.accountSubtype} · {account.accountType === 'dealer' ? 'Dealer' : 'Owner'}</span>
                    </button>
                  ))}
                  {!availableAccounts.length && accountSearch.trim() ? (
                    <p>No other accounts found.</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className={styles.deleteBody}>
                <strong>The outcome is removed. The asset remains archived.</strong>
              </div>
            )}

            {actionError ? (
              <p className={styles.actionError} role="alert">{actionError}</p>
            ) : null}

            <footer>
              {actionDialog.mode === 'details' ? (
                <button type="button" onClick={closeAction} data-autofocus="true">Close</button>
              ) : (
                <>
                  <button type="button" onClick={closeAction} disabled={actionBusy}>Cancel</button>
                  <button
                    type="button"
                    className={actionDialog.mode === 'delete' ? styles.confirmDelete : styles.confirmAllocate}
                    onClick={() => void submitAction()}
                    disabled={
                      actionBusy
                      || (actionDialog.mode === 'allocate' && !selectedBuyerUserId)
                    }
                  >
                    {actionBusy
                      ? 'Saving…'
                      : actionDialog.mode === 'delete'
                        ? 'Delete'
                        : selectedBuyerUserId === actionDialog.record.sourceUserId
                          ? 'Restore'
                          : 'Allocate'}
                  </button>
                </>
              )}
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
