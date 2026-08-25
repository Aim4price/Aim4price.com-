'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ADMIN_VALUATION_PAGE_SIZES,
  formatAdminValuationDateTime,
  formatAdminValuationMoney,
  type AdminValuationFilters,
  type AdminValuationRecord,
  type AdminValuationReport,
} from '../../../lib/admin-valuations-shared';
import styles from './page.module.css';

type ValuationFilterState = AdminValuationFilters;

type DetailRow = {
  label: string;
  value: string;
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

function humanizePath(path: string[]): string {
  return path.map(titleCase).join(' / ');
}

function looksLikeMoney(path: string[]): boolean {
  const key = path[path.length - 1] ?? '';
  return /(price|value|valuation|amount|cost).*?(vat)?$/i.test(key) || /ExVat$/i.test(key);
}

function formatDetailValue(value: unknown, path: string[]): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (looksLikeMoney(path)) return formatAdminValuationMoney(value);
    if (/percent/i.test(path[path.length - 1] ?? '')) {
      return `${new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 }).format(value)}%`;
    }
    return new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 }).format(value);
  }
  if (Array.isArray(value)) {
    if (!value.length) return 'None';
    if (value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) {
      return value.slice(0, 12).map(String).join(', ') + (value.length > 12 ? ` +${value.length - 12} more` : '');
    }
    return `${value.length.toLocaleString('en-ZA')} records`;
  }
  return String(value ?? '').trim();
}

function flattenDetails(source: Record<string, unknown>): DetailRow[] {
  const rows: DetailRow[] = [];

  function visit(value: unknown, path: string[], depth: number) {
    if (rows.length >= 120 || value === null || typeof value === 'undefined' || value === '') return;
    if (Array.isArray(value) || typeof value !== 'object' || depth >= 5) {
      const formatted = formatDetailValue(value, path);
      if (formatted) rows.push({ label: humanizePath(path), value: formatted });
      return;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return;
    for (const [key, nested] of entries) visit(nested, [...path, key], depth + 1);
  }

  for (const [key, value] of Object.entries(source)) visit(value, [key], 0);
  return rows;
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
  const [openingAccount, setOpeningAccount] = useState(false);
  const requestSequenceRef = useRef(0);
  const detailsRef = useRef<HTMLElement | null>(null);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);

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

  const inputRows = useMemo(
    () => selectedValuation ? flattenDetails(selectedValuation.input) : [],
    [selectedValuation],
  );
  const outputRows = useMemo(
    () => selectedValuation ? flattenDetails(selectedValuation.output) : [],
    [selectedValuation],
  );

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

  async function loadReport(nextFilters: ValuationFilterState) {
    const sequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = sequence;
    setFilters(nextFilters);
    setLoading(true);
    setError('');
    setSelectedValuation(null);
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
        <article className={styles.featuredMetric}>
          <span>Matching valuations</span>
          <strong>{summary.totalValuations.toLocaleString('en-ZA')}</strong>
          <small>{summary.valuedValuations.toLocaleString('en-ZA')} include a recorded estimate</small>
        </article>
        <article>
          <span>Estimate results</span>
          <strong>{summary.estimateEvents.toLocaleString('en-ZA')}</strong>
          <small>Completed free estimate requests</small>
        </article>
        <article>
          <span>Saved valuations</span>
          <strong>{summary.savedValuations.toLocaleString('en-ZA')}</strong>
          <small>Full valuation runs saved to an asset</small>
        </article>
        <article>
          <span>Known accounts</span>
          <strong>{summary.knownAccountValuations.toLocaleString('en-ZA')}</strong>
          <small>{summary.uniqueAccounts.toLocaleString('en-ZA')} different linked accounts</small>
        </article>
        <article>
          <span>Unknown / guest</span>
          <strong>{summary.unknownAccountValuations.toLocaleString('en-ZA')}</strong>
          <small>Estimate events without a signed-in account</small>
        </article>
      </section>

      <aside className={styles.historyNote}>
        <strong>Complete available history.</strong>
        <span>
          Saved valuations retain their detailed payload. New estimate results now retain the normalized input and output too;
          older free-estimate events show only the fields that were recorded at the time.
        </span>
      </aside>

      <section className={styles.valuationCard}>
        <header className={styles.filterHeader}>
          <div className={styles.filterTitle}>
            <p>Valuation log</p>
            <h2>What was entered and estimated</h2>
            <span>
              {report.pagination.totalItems
                ? `Showing ${firstItem}-${lastItem} of ${report.pagination.totalItems.toLocaleString('en-ZA')}`
                : 'No valuations match the current filters'}
            </span>
          </div>

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
                  placeholder="Asset, account, email, input or reference"
                />
              </label>
              <button type="button" onClick={submitSearch}>Search</button>
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
            <button type="button" className={styles.clearButton} onClick={clearFilters} disabled={!activeFilterCount && filters.sort === 'latest'}>
              Clear {activeFilterCount ? `(${activeFilterCount})` : ''}
            </button>
          </div>
        </header>

        {error ? <p className={styles.errorNotice} role="alert">{error}</p> : null}
        {loading ? <div className={styles.loadingBar} aria-label="Loading valuations" /> : null}

        <div className={styles.tableScroller} aria-busy={loading}>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Record</th>
                <th>Account</th>
                <th>Asset entered</th>
                <th>Inputs</th>
                <th>Estimate excl. VAT</th>
                <th>Estimated range</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {report.valuations.map((valuation) => (
                <tr key={valuation.id}>
                  <td>
                    <strong>{formatAdminValuationDateTime(valuation.createdAtIso)}</strong>
                    <span>Reference {valuation.sourceId}</span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${valuation.recordType === 'saved' ? styles.savedBadge : styles.estimateBadge}`}>
                      {RECORD_LABELS[valuation.recordType]}
                    </span>
                    <small>{MODE_LABELS[valuation.valuationMode]}</small>
                  </td>
                  <td>
                    <strong>{valuation.account.label}</strong>
                    {valuation.account.email ? <span>{valuation.account.email}</span> : null}
                    {!valuation.account.known ? <small className={styles.unknownCopy}>No account attached</small> : null}
                  </td>
                  <td>
                    <strong>{assetTitle(valuation)}</strong>
                    <span>{valuation.asset.sectorLabel} · {valuation.asset.familyLabel}</span>
                  </td>
                  <td>
                    <strong>{valuation.asset.condition ? titleCase(valuation.asset.condition) : 'Condition not recorded'}</strong>
                    <span>{formatUsage(valuation)}</span>
                  </td>
                  <td className={styles.moneyCell}>{formatAdminValuationMoney(valuation.estimate.selectedValueExVat)}</td>
                  <td>{formatRange(valuation)}</td>
                  <td>
                    <button type="button" className={styles.viewButton} onClick={(event) => openDetails(valuation, event.currentTarget)}>
                      View input &amp; result
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!report.valuations.length ? (
            <div className={styles.emptyState}>
              <strong>No valuations found</strong>
              <span>Clear the filters to return to the complete available history.</span>
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
              <div>
                <p>{RECORD_LABELS[selectedValuation.recordType]} · {MODE_LABELS[selectedValuation.valuationMode]}</p>
                <h2 id="admin-valuation-detail-title">{assetTitle(selectedValuation)}</h2>
                <span>{formatAdminValuationDateTime(selectedValuation.createdAtIso)} · Reference {selectedValuation.sourceId}</span>
              </div>
              <button type="button" aria-label="Close valuation details" onClick={() => { if (!openingAccount) setSelectedValuation(null); }}>×</button>
            </header>

            <section className={styles.estimateHero}>
              <div><p>Estimated value · Excl. VAT</p><strong>{formatAdminValuationMoney(selectedValuation.estimate.selectedValueExVat)}</strong></div>
              <span>{formatRange(selectedValuation)}</span>
            </section>

            <div className={styles.detailColumns}>
              <section>
                <h3>Who and when</h3>
                <dl>
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
                <h3>What was estimated</h3>
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

            <div className={styles.payloadColumns}>
              <section>
                <h3>Inputs recorded</h3>
                {inputRows.length ? <dl>{inputRows.map((row, index) => <div key={`${row.label}-${index}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl> : <p>No detailed input was recorded for this historical event.</p>}
              </section>
              <section>
                <h3>Estimate output</h3>
                {outputRows.length ? <dl>{outputRows.map((row, index) => <div key={`${row.label}-${index}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl> : <p>No detailed output was recorded for this historical event.</p>}
              </section>
            </div>

            {error ? <p className={styles.modalError} role="alert">{error}</p> : null}
            <footer className={styles.modalActions}>
              {selectedValuation.account.userId ? <button type="button" className={styles.primaryAction} disabled={openingAccount} onClick={() => void openAccount(selectedValuation)}>{openingAccount ? 'Opening…' : 'Open account'}</button> : null}
              <button type="button" onClick={() => setSelectedValuation(null)} disabled={openingAccount}>Close</button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

