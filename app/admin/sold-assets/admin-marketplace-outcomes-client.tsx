'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatAdminMarketplaceMoney,
  summarizeAdminMarketplaceOutcomes,
  type AdminMarketplaceOutcomeReason,
  type AdminMarketplaceOutcomeReport,
  type AdminMarketplaceOutcomeRow,
} from '../../../lib/admin-marketplace-shared';
import styles from './page.module.css';

const PAGE_SIZE = 25;
const JOHANNESBURG_TIME_ZONE = 'Africa/Johannesburg';

type HelpFilter = 'all' | 'yes' | 'no';
type SourceFilter = 'all' | 'marketplace' | 'showroom';
type ClosedFilter = 'all' | 'last-30-days' | 'last-90-days' | `year:${number}`;
type OutcomeSort = 'latest' | 'oldest' | 'final-value-high' | 'final-value-low' | 'asset-az';

const REASON_LABELS: Record<AdminMarketplaceOutcomeReason, string> = {
  sold: 'Equipment sold',
  traded: 'Equipment traded',
  no_longer_available: 'No longer available',
  decided_not_to_sell: 'Decided not to sell',
  created_by_mistake: 'Advert created by mistake',
  other: 'Other reason',
};

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateTime(value: string | null): number {
  return parseDate(value)?.getTime() ?? 0;
}

function formatDate(value: string | null): string {
  const parsed = parseDate(value);
  if (!parsed) return 'Not recorded';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: JOHANNESBURG_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function yearInJohannesburg(value: string | null): number | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const year = Number(new Intl.DateTimeFormat('en', {
    timeZone: JOHANNESBURG_TIME_ZONE,
    year: 'numeric',
  }).format(parsed));
  return Number.isInteger(year) ? year : null;
}

function daysToOutcome(outcome: AdminMarketplaceOutcomeRow): number | null {
  const publishedAt = dateTime(outcome.publishedAtIso);
  const closedAt = dateTime(outcome.closedAtIso);
  if (!publishedAt || !closedAt || closedAt < publishedAt) return null;
  return Math.max(0, Math.ceil((closedAt - publishedAt) / (24 * 60 * 60 * 1000)));
}

function formatDays(value: number | null): string {
  if (value === null) return 'Advert duration not recorded';
  if (value === 0) return 'Closed on the same day';
  return `${value.toLocaleString('en-ZA')} ${value === 1 ? 'day' : 'days'} advertised`;
}

function reasonLabel(reason: AdminMarketplaceOutcomeReason): string {
  return REASON_LABELS[reason] ?? 'Other reason';
}

function matchesClosedFilter(
  outcome: AdminMarketplaceOutcomeRow,
  filter: ClosedFilter,
  now = new Date(),
): boolean {
  if (filter === 'all') return true;
  const closedAt = dateTime(outcome.closedAtIso);
  if (!closedAt) return false;

  if (filter === 'last-30-days' || filter === 'last-90-days') {
    const days = filter === 'last-30-days' ? 30 : 90;
    return closedAt >= now.getTime() - days * 24 * 60 * 60 * 1000;
  }

  const year = Number(filter.slice('year:'.length));
  return Number.isInteger(year) && yearInJohannesburg(outcome.closedAtIso) === year;
}

function safeMoney(value: number | null): number {
  return value !== null && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function recordedFinalValue(outcome: AdminMarketplaceOutcomeRow): number | null {
  const value = outcome.finalSalePriceExVat;
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

function compareRecordedFinalValue(
  left: AdminMarketplaceOutcomeRow,
  right: AdminMarketplaceOutcomeRow,
  direction: 'high' | 'low',
): number {
  const leftValue = recordedFinalValue(left);
  const rightValue = recordedFinalValue(right);
  if (leftValue === null) return rightValue === null ? 0 : 1;
  if (rightValue === null) return -1;
  return direction === 'high' ? rightValue - leftValue : leftValue - rightValue;
}

function actorLabel(actorType: string): string {
  if (actorType === 'admin_support') return 'Admin support';
  if (actorType === 'dealer_staff') return 'Dealer staff';
  if (actorType === 'owner_app') return 'Owner App';
  return 'Account';
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export default function AdminMarketplaceOutcomesClient({
  report,
}: {
  report: AdminMarketplaceOutcomeReport;
}) {
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState<'all' | AdminMarketplaceOutcomeReason>('all');
  const [helped, setHelped] = useState<HelpFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [closed, setClosed] = useState<ClosedFilter>('all');
  const [sort, setSort] = useState<OutcomeSort>('latest');
  const [page, setPage] = useState(1);
  const [detailOutcome, setDetailOutcome] = useState<AdminMarketplaceOutcomeRow | null>(null);
  const detailDialogRef = useRef<HTMLElement>(null);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);

  const closedYears = useMemo(() => {
    const years = new Set<number>();
    for (const outcome of report.outcomes) {
      const year = yearInJohannesburg(outcome.closedAtIso);
      if (year !== null) years.add(year);
    }
    return Array.from(years).sort((left, right) => right - left);
  }, [report.outcomes]);

  const filteredOutcomes = useMemo(() => {
    const query = search.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-ZA');
    return report.outcomes
      .filter((outcome) => {
        if (reason !== 'all' && outcome.reason !== reason) return false;
        if (helped === 'yes' && !outcome.aim4priceHelped) return false;
        if (helped === 'no' && outcome.aim4priceHelped) return false;
        if (source !== 'all' && outcome.sourceSurface !== source) return false;
        if (!matchesClosedFilter(outcome, closed)) return false;
        if (!query) return true;

        return [
          outcome.title,
          outcome.sellerLabel,
          outcome.sellerEmail,
          outcome.sectorLabel,
          reasonLabel(outcome.reason),
          outcome.outcomeNote,
          outcome.sourceAssetId ?? '',
          outcome.listingId ?? '',
          outcome.outcomeId,
          outcome.accountUserId,
          outcome.actorType,
        ]
          .join(' ')
          .toLocaleLowerCase('en-ZA')
          .includes(query);
      })
      .sort((left, right) => {
        if (sort === 'oldest') return dateTime(left.closedAtIso) - dateTime(right.closedAtIso);
        if (sort === 'final-value-high') {
          return compareRecordedFinalValue(left, right, 'high')
            || dateTime(right.closedAtIso) - dateTime(left.closedAtIso);
        }
        if (sort === 'final-value-low') {
          return compareRecordedFinalValue(left, right, 'low')
            || dateTime(right.closedAtIso) - dateTime(left.closedAtIso);
        }
        if (sort === 'asset-az') {
          return left.title.localeCompare(right.title, 'en-ZA', { sensitivity: 'base' });
        }
        return dateTime(right.closedAtIso) - dateTime(left.closedAtIso);
      });
  }, [closed, helped, reason, report.outcomes, search, sort, source]);

  const visibleMetrics = useMemo(
    () => summarizeAdminMarketplaceOutcomes(filteredOutcomes),
    [filteredOutcomes],
  );
  const totalPages = Math.max(1, Math.ceil(filteredOutcomes.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filteredOutcomes.length ? (currentPage - 1) * PAGE_SIZE : 0;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filteredOutcomes.length);
  const pageOutcomes = filteredOutcomes.slice(pageStart, pageEnd);
  const filtersActive =
    Boolean(search.trim()) ||
    reason !== 'all' ||
    helped !== 'all' ||
    source !== 'all' ||
    closed !== 'all' ||
    sort !== 'latest';

  function clearFilters() {
    setSearch('');
    setReason('all');
    setHelped('all');
    setSource('all');
    setClosed('all');
    setSort('latest');
    setPage(1);
  }

  function openDetails(
    outcome: AdminMarketplaceOutcomeRow,
    trigger: HTMLButtonElement,
  ) {
    detailTriggerRef.current = trigger;
    setDetailOutcome(outcome);
  }

  useEffect(() => {
    if (!detailOutcome) return;

    const dialog = detailDialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const firstFocusable = focusable?.[0];
    const lastFocusable = focusable?.[focusable.length - 1];
    firstFocusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDetailOutcome(null);
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
      detailTriggerRef.current?.focus();
    };
  }, [detailOutcome]);

  return (
    <>
      <section className={styles.metrics} aria-label="Marketplace outcome summary">
        <article className={styles.featuredMetric}>
          <span>Outcomes</span>
          <strong>{visibleMetrics.totalOutcomes.toLocaleString('en-ZA')}</strong>
        </article>
        <article>
          <span>Sold or traded</span>
          <strong>{visibleMetrics.soldOrTraded.toLocaleString('en-ZA')}</strong>
        </article>
        <article className={styles.helpedMetric}>
          <span>Helped</span>
          <strong>{visibleMetrics.aim4priceHelpedCount.toLocaleString('en-ZA')}</strong>
        </article>
        <article>
          <span>Not helped</span>
          <strong>{visibleMetrics.notHelpedCount.toLocaleString('en-ZA')}</strong>
        </article>
        <article>
          <span>Help rate</span>
          <strong>{formatPercent(visibleMetrics.helpRatePercent)}</strong>
        </article>
        <article>
          <span>Final value</span>
          <strong title={formatAdminMarketplaceMoney(visibleMetrics.recordedSaleValueExVat)}>
            {formatAdminMarketplaceMoney(visibleMetrics.recordedSaleValueExVat)}
          </strong>
        </article>
      </section>

      <section className={styles.tableCard}>
        <header className={styles.tableHeader}>
          <div className={styles.tableTitle}>
            <strong>
              {filteredOutcomes.length
                ? `${pageStart + 1}-${pageEnd} of ${filteredOutcomes.length.toLocaleString('en-ZA')}`
                : 'No matches'}
            </strong>
          </div>

          {report.outcomes.length ? <div className={styles.filters}>
            <label className={styles.searchField}>
              <span>Search</span>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Asset, seller or reference"
              />
            </label>
            <label>
              <span>Outcome</span>
              <select
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value as 'all' | AdminMarketplaceOutcomeReason);
                  setPage(1);
                }}
              >
                <option value="all">All outcomes</option>
                {Object.entries(REASON_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Helped</span>
              <select
                value={helped}
                onChange={(event) => {
                  setHelped(event.target.value as HelpFilter);
                  setPage(1);
                }}
              >
                <option value="all">Yes and No</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <label>
              <span>Source</span>
              <select
                value={source}
                onChange={(event) => {
                  setSource(event.target.value as SourceFilter);
                  setPage(1);
                }}
              >
                <option value="all">Marketplace and Showroom</option>
                <option value="marketplace">Marketplace</option>
                <option value="showroom">My Showroom</option>
              </select>
            </label>
            <label>
              <span>Closed</span>
              <select
                value={closed}
                onChange={(event) => {
                  setClosed(event.target.value as ClosedFilter);
                  setPage(1);
                }}
              >
                <option value="all">All time</option>
                <option value="last-30-days">Last 30 days</option>
                <option value="last-90-days">Last 90 days</option>
                {closedYears.map((year) => (
                  <option key={year} value={`year:${year}`}>{year}</option>
                ))}
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
                <option value="latest">Latest closed</option>
                <option value="oldest">Oldest closed</option>
                <option value="final-value-high">Highest final value</option>
                <option value="final-value-low">Lowest final value</option>
                <option value="asset-az">Asset A-Z</option>
              </select>
            </label>
            {filtersActive ? <button type="button" onClick={clearFilters}>Clear filters</button> : null}
          </div> : null}
        </header>

        {report.outcomes.length ? <div className={styles.tableScroller}>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Outcome</th>
                <th>Helped?</th>
                <th>Price evidence</th>
                <th>Activity</th>
              </tr>
            </thead>
            <tbody>
              {pageOutcomes.map((outcome) => {
                return (
                  <tr key={outcome.outcomeId}>
                    <td className={styles.assetCell}>
                      <button
                        type="button"
                        className={styles.assetButton}
                        aria-haspopup="dialog"
                        onClick={(event) => openDetails(outcome, event.currentTarget)}
                      >
                        <strong title={outcome.title}>{outcome.title}</strong>
                        <span title={`${outcome.sellerLabel || 'Unknown seller'} · ${outcome.sectorLabel || 'Uncategorised'}`}>
                          · {outcome.sellerLabel || 'Unknown seller'} · {outcome.sectorLabel || 'Uncategorised'}
                        </span>
                      </button>
                    </td>
                    <td className={styles.outcomeCell}>
                      <strong>{reasonLabel(outcome.reason)}</strong>
                      <span>· {formatDate(outcome.closedAtIso)} · {outcome.sourceSurface === 'showroom' ? 'Showroom' : 'Marketplace'}</span>
                    </td>
                    <td>
                      <span className={outcome.aim4priceHelped ? styles.yesAnswer : styles.noAnswer}>
                        {outcome.aim4priceHelped ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className={styles.priceCell}>
                      {safeMoney(outcome.finalSalePriceExVat) > 0 ? (
                        <>
                          <strong>{formatAdminMarketplaceMoney(safeMoney(outcome.finalSalePriceExVat))}</strong>
                        </>
                      ) : (
                        <strong>—</strong>
                      )}
                      {outcome.askingPriceExVat > 0 ? (
                        <small>· Asked {formatAdminMarketplaceMoney(outcome.askingPriceExVat)}</small>
                      ) : null}
                      {outcome.aim4priceValueExVat > 0 ? (
                        <small>· Aim4price {formatAdminMarketplaceMoney(outcome.aim4priceValueExVat)}</small>
                      ) : null}
                    </td>
                    <td className={styles.activityCell}>
                      <strong>{outcome.totalViewsAtClose.toLocaleString('en-ZA')} {outcome.totalViewsAtClose === 1 ? 'view' : 'views'}</strong>
                      <span>· {formatDays(daysToOutcome(outcome))}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!pageOutcomes.length ? (
            <div className={styles.empty}>
              <strong>No outcomes found</strong>
            </div>
          ) : null}
        </div> : <div className={styles.empty}><strong>No outcomes recorded.</strong></div>}

        {report.outcomes.length ? <footer className={styles.pagination}>
          <span>{filteredOutcomes.length.toLocaleString('en-ZA')} matching · {report.outcomes.length.toLocaleString('en-ZA')} all time</span>
          <div>
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>Previous</button>
            <strong>Page {currentPage} of {totalPages}</strong>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages}>Next</button>
          </div>
        </footer> : null}
      </section>

      {detailOutcome ? (
        <div className={styles.detailOverlay}>
          <button
            type="button"
            className={styles.detailBackdrop}
            aria-label="Close outcome details"
            onClick={() => setDetailOutcome(null)}
          />
          <section
            ref={detailDialogRef}
            className={styles.detailModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketplace-outcome-detail-title"
          >
            <header>
              <h2 id="marketplace-outcome-detail-title" title={detailOutcome.title}>
                {detailOutcome.title}
              </h2>
              <button
                type="button"
                onClick={() => setDetailOutcome(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className={styles.detailBody}>
              <dl className={styles.detailGrid}>
                <div><dt>Outcome</dt><dd>{reasonLabel(detailOutcome.reason)}</dd></div>
                <div><dt>Helped</dt><dd>{detailOutcome.aim4priceHelped ? 'Yes' : 'No'}</dd></div>
                <div><dt>Seller</dt><dd title={detailOutcome.sellerEmail || detailOutcome.sellerLabel}>{detailOutcome.sellerLabel || 'Unknown seller'}{detailOutcome.sellerEmail ? ` · ${detailOutcome.sellerEmail}` : ''}</dd></div>
                <div><dt>Sector</dt><dd>{detailOutcome.sectorLabel || 'Uncategorised'}</dd></div>
                <div><dt>Source</dt><dd>{detailOutcome.sourceSurface === 'showroom' ? 'Showroom' : 'Marketplace'} · {actorLabel(detailOutcome.actorType)}</dd></div>
                <div><dt>Closed</dt><dd>{formatDate(detailOutcome.closedAtIso)} · {formatDays(daysToOutcome(detailOutcome))}</dd></div>
                <div><dt>Final value</dt><dd>{recordedFinalValue(detailOutcome) === null ? '—' : formatAdminMarketplaceMoney(recordedFinalValue(detailOutcome) as number)}</dd></div>
                <div><dt>Asking value</dt><dd>{detailOutcome.askingPriceExVat > 0 ? formatAdminMarketplaceMoney(detailOutcome.askingPriceExVat) : '—'}</dd></div>
                <div><dt>Aim4price value</dt><dd>{detailOutcome.aim4priceValueExVat > 0 ? formatAdminMarketplaceMoney(detailOutcome.aim4priceValueExVat) : '—'}</dd></div>
                <div><dt>Views</dt><dd>{detailOutcome.totalViewsAtClose.toLocaleString('en-ZA')} total · {detailOutcome.uniqueViewersAtClose.toLocaleString('en-ZA')} unique</dd></div>
                <div><dt>View source</dt><dd>{detailOutcome.accountViewsAtClose.toLocaleString('en-ZA')} accounts · {detailOutcome.unknownViewsAtClose.toLocaleString('en-ZA')} unknown</dd></div>
                <div className={styles.detailWide}><dt>Note</dt><dd title={detailOutcome.outcomeNote || 'No note'}>{detailOutcome.outcomeNote || '—'}</dd></div>
                <div className={styles.detailWide}><dt>References</dt><dd title={`${detailOutcome.outcomeId} · ${detailOutcome.listingId ?? 'No listing'} · ${detailOutcome.sourceAssetId ?? 'No asset'} · ${detailOutcome.accountUserId}`}>{detailOutcome.outcomeId} · {detailOutcome.listingId ?? 'No listing'} · {detailOutcome.sourceAssetId ?? 'No asset'} · {detailOutcome.accountUserId}</dd></div>
              </dl>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
