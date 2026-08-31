'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ADMIN_VALUATION_PAGE_SIZES,
  buildAdminValuationInputSections,
  buildAdminValuationOutputSections,
  formatAdminValuationDateTime,
  formatAdminValuationMoney,
  type AdminValuationDeletionResult,
  type AdminValuationFilters,
  type AdminValuationRecord,
  type AdminValuationReport,
} from '../../../lib/admin-valuations-shared';
import styles from './page.module.css';

type ValuationFilterState = AdminValuationFilters;
type DeleteTargets = {
  mode: 'single' | 'bulk';
  valuations: AdminValuationRecord[];
};

const RECORD_LABELS = {
  estimate: 'Estimate result',
  saved: 'Saved valuation',
} as const;

const MODE_LABELS = {
  tractor: 'Tractor',
  generic: 'General asset',
  unknown: 'Historical',
} as const;

function titleCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      if (['ID', 'VAT', 'GPS', 'KM', 'URL', 'HP', 'KW'].includes(upper)) return upper;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

function assetTitle(valuation: AdminValuationRecord): string {
  return [
    valuation.asset.yearModel,
    valuation.asset.brandName,
    valuation.asset.modelName,
  ].filter((part) => part !== null && Boolean(String(part).trim())).join(' ');
}

function formatUsage(valuation: AdminValuationRecord): string {
  const amount = valuation.asset.usageAmount;
  if (amount === null) return 'Not recorded';
  const formatted = new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 1 }).format(amount);
  if (valuation.asset.usageUnit === 'percent') return `${formatted}% worked`;
  if (valuation.asset.usageUnit === 'km') return `${formatted} km`;
  if (valuation.asset.usageUnit === 'hours') return `${formatted} hours`;
  return formatted;
}

function formatRange(valuation: AdminValuationRecord): string {
  const low = valuation.estimate.lowValueExVat;
  const high = valuation.estimate.highValueExVat;
  if (low !== null && high !== null) {
    return `${formatAdminValuationMoney(low)} – ${formatAdminValuationMoney(high)}`;
  }
  if (valuation.estimate.midValueExVat !== null) {
    return formatAdminValuationMoney(valuation.estimate.midValueExVat);
  }
  return 'Not recorded';
}

function buildQuery(filters: ValuationFilterState): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.recordType !== 'all') params.set('type', filters.recordType);
  if (filters.valuationMode !== 'all') params.set('mode', filters.valuationMode);
  if (filters.account !== 'all') params.set('account', filters.account);
  if (filters.sector) params.set('sector', filters.sector);
  if (filters.period !== 'all') params.set('period', filters.period);
  if (filters.sort !== 'latest') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.pageSize !== 50) params.set('pageSize', String(filters.pageSize));
  return params.toString();
}

export default function AdminValuationsClient({
  initialReport,
}: {
  initialReport: AdminValuationReport;
}) {
  const [report, setReport] = useState(initialReport);
  const [filters, setFilters] = useState<ValuationFilterState>(initialReport.filters);
  const [searchDraft, setSearchDraft] = useState(initialReport.filters.search);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedValuation, setSelectedValuation] = useState<AdminValuationRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteTargets, setDeleteTargets] = useState<DeleteTargets | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [openingAccount, setOpeningAccount] = useState(false);
  const requestSequenceRef = useRef(0);
  const detailsRef = useRef<HTMLElement | null>(null);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const deleteModalRef = useRef<HTMLElement | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deleteBusyRef = useRef(false);

  deleteBusyRef.current = deleteBusy;

  const activeFilterCount = useMemo(
    () => [
      filters.search,
      filters.recordType !== 'all' ? filters.recordType : '',
      filters.valuationMode !== 'all' ? filters.valuationMode : '',
      filters.account !== 'all' ? filters.account : '',
      filters.sector,
      filters.period !== 'all' ? filters.period : '',
    ].filter(Boolean).length,
    [filters],
  );

  const inputSections = useMemo(
    () => selectedValuation ? buildAdminValuationInputSections(selectedValuation) : [],
    [selectedValuation],
  );
  const outputSections = useMemo(
    () => selectedValuation ? buildAdminValuationOutputSections(selectedValuation) : [],
    [selectedValuation],
  );
  const selectedValuations = useMemo(
    () => report.valuations.filter((valuation) => selectedIds.has(valuation.id)),
    [report.valuations, selectedIds],
  );
  const selectedOnPageCount = selectedValuations.length;
  const allPageSelected = report.valuations.length > 0
    && selectedOnPageCount === report.valuations.length;

  useEffect(() => {
    if (!selectedValuation) return;
    const modal = detailsRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      modal?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
    });

    function keepFocusInsideDetails(event: KeyboardEvent) {
      if (event.key === 'Escape' && !openingAccount) {
        event.preventDefault();
        setSelectedValuation(null);
        return;
      }
      if (event.key !== 'Tab' || !modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) {
        event.preventDefault();
        modal.focus();
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

    window.addEventListener('keydown', keepFocusInsideDetails);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', keepFocusInsideDetails);
      document.body.style.overflow = previousOverflow;
      detailTriggerRef.current?.focus();
    };
  }, [openingAccount, selectedValuation]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedOnPageCount > 0 && !allPageSelected;
    }
  }, [allPageSelected, selectedOnPageCount]);

  useEffect(() => {
    if (!deleteTargets) return;
    const modal = deleteModalRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      modal?.querySelector<HTMLElement>('input, button:not([disabled])')?.focus();
    });

    function keepFocusInsideDeleteModal(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deleteBusyRef.current) {
        event.preventDefault();
        setDeleteTargets(null);
        setDeleteConfirmation('');
        setDeleteError('');
        return;
      }
      if (event.key !== 'Tab' || !modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) {
        event.preventDefault();
        modal.focus();
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

    window.addEventListener('keydown', keepFocusInsideDeleteModal);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', keepFocusInsideDeleteModal);
      document.body.style.overflow = previousOverflow;
      deleteTriggerRef.current?.focus();
    };
  }, [deleteTargets]);

  async function loadReport(nextFilters: ValuationFilterState) {
    const sequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = sequence;
    setFilters(nextFilters);
    setLoading(true);
    setError('');
    setSelectedValuation(null);
    setSelectedIds(new Set());
    try {
      const query = buildQuery(nextFilters);
      const response = await fetch(`/api/admin/valuations${query ? `?${query}` : ''}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        report?: AdminValuationReport;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok || !payload.report) {
        throw new Error(payload?.error || 'Admin valuations could not be loaded.');
      }
      if (sequence !== requestSequenceRef.current) return;
      setReport(payload.report);
      setFilters(payload.report.filters);
      setSearchDraft(payload.report.filters.search);
      const normalizedQuery = buildQuery(payload.report.filters);
      window.history.replaceState(
        null,
        '',
        `/admin/valuations${normalizedQuery ? `?${normalizedQuery}` : ''}`,
      );
    } catch (loadError) {
      if (sequence !== requestSequenceRef.current) return;
      setError(loadError instanceof Error ? loadError.message : 'Admin valuations could not be loaded.');
    } finally {
      if (sequence === requestSequenceRef.current) setLoading(false);
    }
  }

  function updateFilter<K extends keyof ValuationFilterState>(
    key: K,
    value: ValuationFilterState[K],
  ) {
    void loadReport({ ...filters, [key]: value, page: 1 });
  }

  function submitSearch() {
    void loadReport({ ...filters, search: searchDraft.trim(), page: 1 });
  }

  function clearFilters() {
    setSearchDraft('');
    void loadReport({
      search: '',
      recordType: 'all',
      valuationMode: 'all',
      account: 'all',
      sector: '',
      period: 'all',
      sort: 'latest',
      page: 1,
      pageSize: filters.pageSize,
    });
  }

  function openDetails(valuation: AdminValuationRecord, trigger: HTMLButtonElement) {
    detailTriggerRef.current = trigger;
    setError('');
    setSelectedValuation(valuation);
  }

  function toggleValuationSelection(valuationId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(valuationId);
      else next.delete(valuationId);
      return next;
    });
  }

  function toggleCurrentPage(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const valuation of report.valuations) {
        if (checked) next.add(valuation.id);
        else next.delete(valuation.id);
      }
      return next;
    });
  }

  function openDeleteModal(
    valuations: AdminValuationRecord[],
    mode: DeleteTargets['mode'],
    trigger: HTMLButtonElement,
  ) {
    if (!valuations.length) return;
    deleteTriggerRef.current = trigger;
    setSelectedValuation(null);
    setDeleteConfirmation('');
    setDeleteError('');
    setDeleteTargets({ mode, valuations });
  }

  function closeDeleteModal() {
    if (deleteBusyRef.current) return;
    setDeleteTargets(null);
    setDeleteConfirmation('');
    setDeleteError('');
  }

  async function confirmDelete() {
    if (!deleteTargets || deleteBusy) return;
    if (deleteTargets.mode === 'bulk' && deleteConfirmation.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Type DELETE to confirm the bulk permanent deletion.');
      return;
    }

    setDeleteBusy(true);
    setDeleteError('');
    try {
      const valuationIds = deleteTargets.valuations.map((valuation) => valuation.id);
      const response = await fetch('/api/admin/valuations', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ valuationIds }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        deletion?: AdminValuationDeletionResult;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok || !payload.deletion) {
        throw new Error(payload?.error || 'The selected valuation data could not be deleted.');
      }

      const deletedIds = new Set(valuationIds);
      const nextPage = report.valuations.every((valuation) => deletedIds.has(valuation.id))
        ? Math.max(1, filters.page - 1)
        : filters.page;
      setDeleteTargets(null);
      setDeleteConfirmation('');
      setSelectedIds(new Set());
      await loadReport({ ...filters, page: nextPage });
    } catch (deleteFailure) {
      setDeleteError(
        deleteFailure instanceof Error
          ? deleteFailure.message
          : 'The selected valuation data could not be deleted.',
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  async function openAccount(valuation: AdminValuationRecord) {
    if (!valuation.account.userId || openingAccount) return;
    setOpeningAccount(true);
    setError('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: valuation.account.userId, action: 'open_account' }),
      });
      const payload = (await response.json().catch(() => null)) as {
        redirectUrl?: string;
        error?: string;
      } | null;
      if (!response.ok || !payload?.redirectUrl) {
        throw new Error(payload?.error || 'The account could not be opened.');
      }
      window.location.assign(payload.redirectUrl);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'The account could not be opened.');
      setOpeningAccount(false);
    }
  }

  const summary = report.summary;
  const firstItem = report.pagination.totalItems
    ? (report.pagination.page - 1) * report.pagination.pageSize + 1
    : 0;
  const lastItem = Math.min(
    report.pagination.page * report.pagination.pageSize,
    report.pagination.totalItems,
  );

  return (
    <>
      <section className={styles.metrics} aria-label="Valuation summary">
        <article>
          <strong>{summary.totalValuations.toLocaleString('en-ZA')}</strong>
          <span>Records</span>
        </article>
        <article>
          <strong>{summary.estimateEvents.toLocaleString('en-ZA')}</strong>
          <span>Estimates</span>
        </article>
        <article>
          <strong>{summary.savedValuations.toLocaleString('en-ZA')}</strong>
          <span>Saved</span>
        </article>
        <article>
          <strong>{summary.knownAccountValuations.toLocaleString('en-ZA')}</strong>
          <span>Accounts</span>
        </article>
        <article>
          <strong>{summary.unknownAccountValuations.toLocaleString('en-ZA')}</strong>
          <span>Guests</span>
        </article>
      </section>

      <section className={styles.valuationCard}>
        <header className={styles.filterHeader}>
          <div className={styles.filters}>
            <div className={styles.searchField}>
              <label>
                <span>Search</span>
                <input
                  type="search"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submitSearch();
                  }}
                  placeholder="Asset, account, email or reference"
                />
              </label>
              <button type="button" onClick={submitSearch}>Search</button>
              {activeFilterCount || filters.sort !== 'latest' ? (
                <button type="button" className={styles.clearButton} onClick={clearFilters}>Clear</button>
              ) : null}
            </div>
            <label>
              <span>Record</span>
              <select value={filters.recordType} onChange={(event) => updateFilter('recordType', event.target.value as ValuationFilterState['recordType'])}>
                <option value="all">All records</option>
                <option value="estimate">Estimate results</option>
                <option value="saved">Saved valuations</option>
              </select>
            </label>
            <label>
              <span>Valuation</span>
              <select value={filters.valuationMode} onChange={(event) => updateFilter('valuationMode', event.target.value as ValuationFilterState['valuationMode'])}>
                <option value="all">All valuation types</option>
                <option value="generic">General assets</option>
                <option value="tractor">Tractors</option>
                <option value="unknown">Historical unknown</option>
              </select>
            </label>
            <label>
              <span>Account</span>
              <select value={filters.account} onChange={(event) => updateFilter('account', event.target.value as ValuationFilterState['account'])}>
                <option value="all">All accounts</option>
                <option value="known">Known accounts</option>
                <option value="unknown">Unknown / guest</option>
              </select>
            </label>
            <label>
              <span>Sector</span>
              <select value={filters.sector} onChange={(event) => updateFilter('sector', event.target.value)}>
                <option value="">All sectors</option>
                {report.options.sectors.map((option) => (
                  <option key={option.value} value={option.value}>{option.label} ({option.count})</option>
                ))}
              </select>
            </label>
            <label>
              <span>Completed</span>
              <select value={filters.period} onChange={(event) => updateFilter('period', event.target.value)}>
                <option value="all">All time</option>
                <option value="last-7-days">Last 7 days</option>
                <option value="last-30-days">Last 30 days</option>
                <option value="last-90-days">Last 90 days</option>
                {report.options.years.map((option) => (
                  <option key={option.value} value={`year:${option.value}`}>{option.label} ({option.count})</option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value as ValuationFilterState['sort'])}>
                <option value="latest">Latest first</option>
                <option value="oldest">Oldest first</option>
                <option value="value-high">Highest estimate</option>
                <option value="value-low">Lowest estimate</option>
                <option value="account">Account A-Z</option>
                <option value="asset">Asset A-Z</option>
              </select>
            </label>
          </div>
        </header>

        {error ? <p className={styles.errorNotice} role="alert">{error}</p> : null}
        {loading ? <div className={styles.loadingBar} aria-label="Loading valuations" /> : null}

        <div className={styles.recordsToolbar}>
          <strong>
            {selectedOnPageCount
              ? `${selectedOnPageCount.toLocaleString('en-ZA')} selected`
              : report.pagination.totalItems
                ? `${firstItem}-${lastItem} of ${report.pagination.totalItems.toLocaleString('en-ZA')}`
                : 'No results'}
          </strong>
          {selectedOnPageCount ? (
            <button
              type="button"
              className={styles.bulkDeleteButton}
              disabled={loading || deleteBusy}
              onClick={(event) => openDeleteModal(selectedValuations, 'bulk', event.currentTarget)}
            >
              Delete selected
            </button>
          ) : null}
        </div>

        <div className={styles.tableScroller} aria-busy={loading}>
          <table>
            <thead>
              <tr>
                <th className={styles.selectCell}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allPageSelected}
                    disabled={!report.valuations.length || loading || deleteBusy}
                    aria-label="Select all valuations on this page"
                    onChange={(event) => toggleCurrentPage(event.target.checked)}
                  />
                </th>
                <th>When</th>
                <th>Record</th>
                <th>Account</th>
                <th>Asset</th>
                <th>Estimate excl. VAT</th>
                <th>Range</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {report.valuations.map((valuation) => (
                <tr key={valuation.id}>
                  <td className={styles.selectCell}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(valuation.id)}
                      disabled={loading || deleteBusy}
                      aria-label={`Select ${assetTitle(valuation)} valuation`}
                      onChange={(event) => toggleValuationSelection(valuation.id, event.target.checked)}
                    />
                  </td>
                  <td>
                    <strong>{formatAdminValuationDateTime(valuation.createdAtIso)}</strong>
                  </td>
                  <td>
                    <strong className={`${styles.recordType} ${valuation.recordType === 'saved' ? styles.savedRecord : styles.estimateRecord}`}>
                      {RECORD_LABELS[valuation.recordType]}
                    </strong>
                  </td>
                  <td>
                    <strong>{valuation.account.label}</strong>
                  </td>
                  <td>
                    <strong>{assetTitle(valuation)}</strong>
                    <span>· {valuation.asset.sectorLabel}</span>
                  </td>
                  <td className={styles.moneyCell}>{formatAdminValuationMoney(valuation.estimate.selectedValueExVat)}</td>
                  <td>{formatRange(valuation)}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <button type="button" className={styles.viewButton} onClick={(event) => openDetails(valuation, event.currentTarget)}>
                        View
                      </button>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        disabled={loading || deleteBusy}
                        onClick={(event) => openDeleteModal([valuation], 'single', event.currentTarget)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!report.valuations.length ? (
            <div className={styles.emptyState}>
              <strong>No valuations found</strong>
            </div>
          ) : null}
        </div>

        <footer className={styles.pagination}>
          <label>
            <span>Rows per page</span>
            <select value={filters.pageSize} onChange={(event) => void loadReport({ ...filters, pageSize: Number(event.target.value), page: 1 })}>
              {ADMIN_VALUATION_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <span>Page {report.pagination.page} of {report.pagination.totalPages}</span>
          <div>
            <button type="button" disabled={!report.pagination.hasPreviousPage || loading} onClick={() => void loadReport({ ...filters, page: Math.max(1, report.pagination.page - 1) })}>Previous</button>
            <button type="button" disabled={!report.pagination.hasNextPage || loading} onClick={() => void loadReport({ ...filters, page: report.pagination.page + 1 })}>Next</button>
          </div>
        </footer>
      </section>

      {selectedValuation ? (
        <div className={styles.modalLayer}>
          <button type="button" className={styles.backdrop} tabIndex={-1} aria-label="Close valuation details" onClick={() => { if (!openingAccount) setSelectedValuation(null); }} />
          <section ref={detailsRef} className={styles.detailsModal} role="dialog" aria-modal="true" aria-labelledby="admin-valuation-detail-title" tabIndex={-1}>
            <header className={styles.modalHeader}>
              <h2 id="admin-valuation-detail-title">{assetTitle(selectedValuation)}</h2>
              <button type="button" aria-label="Close valuation details" onClick={() => { if (!openingAccount) setSelectedValuation(null); }}>×</button>
            </header>

            <div className={styles.estimateHero}>
              <div><span>Estimate excl. VAT</span><strong>{formatAdminValuationMoney(selectedValuation.estimate.selectedValueExVat)}</strong></div>
              <div><span>Range</span><strong>{formatRange(selectedValuation)}</strong></div>
            </div>

            <div className={styles.detailColumns}>
              <section>
                <h3>Record</h3>
                <dl>
                  <div><dt>Record</dt><dd>{RECORD_LABELS[selectedValuation.recordType]}</dd></div>
                  <div><dt>Valuation</dt><dd>{MODE_LABELS[selectedValuation.valuationMode]}</dd></div>
                  <div><dt>Reference</dt><dd>{selectedValuation.sourceId}</dd></div>
                  <div><dt>Account</dt><dd>{selectedValuation.account.label}</dd></div>
                  <div><dt>Email</dt><dd>{selectedValuation.account.email || 'Unknown'}</dd></div>
                  <div><dt>User ID</dt><dd>{selectedValuation.account.userId || 'Unknown / guest'}</dd></div>
                  <div><dt>Account type</dt><dd>{selectedValuation.account.accountType ? titleCase(selectedValuation.account.accountType) : 'Unknown'}</dd></div>
                  <div><dt>Account status</dt><dd>{selectedValuation.account.accountStatus ? titleCase(selectedValuation.account.accountStatus) : 'Unknown'}</dd></div>
                  <div><dt>Completed</dt><dd>{formatAdminValuationDateTime(selectedValuation.createdAtIso)}</dd></div>
                  <div><dt>Source</dt><dd>{titleCase(selectedValuation.source)}</dd></div>
                </dl>
              </section>
              <section>
                <h3>Asset</h3>
                <dl>
                  <div><dt>Asset</dt><dd>{assetTitle(selectedValuation)}</dd></div>
                  <div><dt>Sector</dt><dd>{selectedValuation.asset.sectorLabel}</dd></div>
                  <div><dt>Category</dt><dd>{selectedValuation.asset.familyLabel}</dd></div>
                  <div><dt>Condition</dt><dd>{selectedValuation.asset.condition ? titleCase(selectedValuation.asset.condition) : 'Not recorded'}</dd></div>
                  <div><dt>Usage</dt><dd>{formatUsage(selectedValuation)}</dd></div>
                  <div><dt>Replacement price</dt><dd>{formatAdminValuationMoney(selectedValuation.estimate.replacementPriceExVat)}</dd></div>
                  <div><dt>Estimated range</dt><dd>{formatRange(selectedValuation)}</dd></div>
                  <div><dt>Confidence</dt><dd>{selectedValuation.estimate.confidenceLabel ? titleCase(selectedValuation.estimate.confidenceLabel) : 'Not recorded'}</dd></div>
                </dl>
              </section>
            </div>

            <section className={styles.flowRecord} aria-labelledby="admin-valuation-flow-title">
              <header className={styles.flowRecordHeader}>
                <h3 id="admin-valuation-flow-title">Inputs</h3>
              </header>
              {inputSections.length ? (
                <div className={styles.flowSectionGrid}>
                  {inputSections.map((section) => (
                    <article key={section.id} className={styles.flowSection}>
                      <header>
                        <h4>{section.title}</h4>
                      </header>
                      <dl>
                        {section.rows.map((row, index) => (
                          <div key={`${section.id}-${row.label}-${index}`}>
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.noRecordedDetails}>No detailed input was retained for this historical event.</p>
              )}
            </section>

            <section className={styles.flowRecord} aria-labelledby="admin-valuation-output-title">
              <header className={styles.flowRecordHeader}>
                <h3 id="admin-valuation-output-title">Calculation</h3>
              </header>
              {outputSections.length ? (
                <div className={styles.flowSectionGrid}>
                  {outputSections.map((section) => (
                    <article key={section.id} className={styles.flowSection}>
                      <header>
                        <h4>{section.title}</h4>
                      </header>
                      <dl>
                        {section.rows.map((row, index) => (
                          <div key={`${section.id}-${row.label}-${index}`}>
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.noRecordedDetails}>No detailed calculation output was retained for this historical event.</p>
              )}
            </section>

            {error ? <p className={styles.modalError} role="alert">{error}</p> : null}
            <footer className={styles.modalActions}>
              {selectedValuation.account.userId ? <button type="button" className={styles.primaryAction} disabled={openingAccount} onClick={() => void openAccount(selectedValuation)}>{openingAccount ? 'Opening…' : 'Open account'}</button> : null}
              <button type="button" onClick={() => setSelectedValuation(null)} disabled={openingAccount}>Close</button>
            </footer>
          </section>
        </div>
      ) : null}

      {deleteTargets ? (
        <div className={styles.modalLayer}>
          <button
            type="button"
            className={styles.backdrop}
            tabIndex={-1}
            aria-label="Close valuation deletion confirmation"
            disabled={deleteBusy}
            onClick={closeDeleteModal}
          />
          <section
            ref={deleteModalRef}
            className={styles.deleteModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-valuation-delete-title"
            aria-describedby="admin-valuation-delete-description"
            tabIndex={-1}
          >
            <header className={styles.deleteModalHeader}>
              <h2 id="admin-valuation-delete-title">
                {deleteTargets.mode === 'single'
                  ? 'Delete this valuation?'
                  : `Delete ${deleteTargets.valuations.length.toLocaleString('en-ZA')} valuations?`}
              </h2>
              <button type="button" aria-label="Close deletion confirmation" disabled={deleteBusy} onClick={closeDeleteModal}>×</button>
            </header>

            <div className={styles.deleteSummary}>
              {deleteTargets.valuations.slice(0, 3).map((valuation) => (
                <div key={valuation.id}>
                  <strong>{assetTitle(valuation)}</strong>
                  <span>{RECORD_LABELS[valuation.recordType]} · {formatAdminValuationDateTime(valuation.createdAtIso)}</span>
                </div>
              ))}
              {deleteTargets.valuations.length > 3 ? (
                <small>And {(deleteTargets.valuations.length - 3).toLocaleString('en-ZA')} more selected valuations</small>
              ) : null}
            </div>

            <p id="admin-valuation-delete-description" className={styles.deleteDescription}>
              This permanently deletes the valuation record. The asset and account remain unchanged. This cannot be undone.
            </p>

            {deleteTargets.mode === 'bulk' ? (
              <label className={styles.deleteConfirmationField}>
                <span>Type DELETE to confirm</span>
                <input
                  type="text"
                  value={deleteConfirmation}
                  disabled={deleteBusy}
                  autoComplete="off"
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                />
              </label>
            ) : null}

            {deleteError ? <p className={styles.deleteError} role="alert">{deleteError}</p> : null}

            <footer className={styles.deleteActions}>
              <button type="button" disabled={deleteBusy} onClick={closeDeleteModal}>Cancel</button>
              <button
                type="button"
                className={styles.confirmDeleteButton}
                disabled={deleteBusy || (deleteTargets.mode === 'bulk' && deleteConfirmation.trim().toUpperCase() !== 'DELETE')}
                onClick={() => void confirmDelete()}
              >
                {deleteBusy ? 'Deleting permanently…' : 'Delete permanently'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
