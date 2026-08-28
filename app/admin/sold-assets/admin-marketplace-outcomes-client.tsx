'use client';

import { useMemo, useState } from 'react';
import {
  formatAdminMarketplaceMoney,
  summarizeAdminMarketplaceOutcomes,
  type AdminMarketplaceOutcomeReason,
  type AdminMarketplaceOutcomeReport,
  type AdminMarketplaceOutcomeRow,
} from '../../../lib/admin-marketplace-shared';
import styles from './page.module.css';

const PAGE_SIZE = 25;

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
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
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
  return Number.isInteger(year) && new Date(closedAt).getFullYear() === year;
}

function safeMoney(value: number | null): number {
  return value !== null && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function formatPriceDifference(finalPrice: number | null, comparisonPrice: number): string {
  const finalValue = safeMoney(finalPrice);
  const comparison = safeMoney(comparisonPrice);
  if (!finalValue || !comparison) return '';
  const difference = ((finalValue - comparison) / comparison) * 100;
  const direction = difference > 0 ? 'above' : difference < 0 ? 'below' : 'in line with';
  return difference === 0
    ? 'In line with the Aim4price value'
    : `${formatPercent(Math.abs(difference))} ${direction} the Aim4price value`;
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

  const closedYears = useMemo(() => {
    const years = new Set<number>();
    for (const outcome of report.outcomes) {
      const year = parseDate(outcome.closedAtIso)?.getFullYear();
      if (Number.isInteger(year)) years.add(year as number);
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
        ]
          .join(' ')
          .toLocaleLowerCase('en-ZA')
          .includes(query);
      })
      .sort((left, right) => {
        if (sort === 'oldest') return dateTime(left.closedAtIso) - dateTime(right.closedAtIso);
        if (sort === 'final-value-high') {
          return safeMoney(right.finalSalePriceExVat) - safeMoney(left.finalSalePriceExVat);
        }
        if (sort === 'final-value-low') {
          return safeMoney(left.finalSalePriceExVat) - safeMoney(right.finalSalePriceExVat);
        }
        if (sort === 'asset-az') {
          return left.title.localeCompare(right.title, 'en-ZA', { sensitivity: 'base' });
        }
        return dateTime(right.closedAtIso) - dateTime(left.closedAtIso);
      });
  }, [closed, helped, reason, report.outcomes, search, sort, source]);

  const allMetrics = report.metrics;
  const filteredMetrics = useMemo(
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

  return (
    <>
      <section className={styles.metrics} aria-label="Marketplace outcome summary">
        <article className={styles.featuredMetric}>
          <span>Total outcomes</span>
          <strong>{allMetrics.totalOutcomes.toLocaleString('en-ZA')}</strong>
          <small>Every advert closed through Marketplace or My Showroom</small>
        </article>
        <article>
          <span>Sold or traded</span>
          <strong>{allMetrics.soldOrTraded.toLocaleString('en-ZA')}</strong>
          <small>Completed seller outcomes</small>
        </article>
        <article className={styles.helpedMetric}>
          <span>Aim4price helped</span>
          <strong>{allMetrics.aim4priceHelpedCount.toLocaleString('en-ZA')}</strong>
          <small>Seller answered Yes</small>
        </article>
        <article>
          <span>Aim4price did not help</span>
          <strong>{allMetrics.notHelpedCount.toLocaleString('en-ZA')}</strong>
          <small>Seller answered No</small>
        </article>
        <article>
          <span>Help rate</span>
          <strong>{formatPercent(allMetrics.helpRatePercent)}</strong>
          <small>Yes answers across all recorded outcomes</small>
        </article>
        <article>
          <span>Recorded final value</span>
          <strong>{formatAdminMarketplaceMoney(allMetrics.recordedSaleValueExVat)}</strong>
          <small>Optional sold and traded prices, excl. VAT</small>
        </article>
      </section>

      <aside className={styles.definitionNote}>
        <div>
          <strong>Both Yes and No answers are retained.</strong>
          <span>This keeps the Aim4price help rate meaningful instead of recording successful outcomes only.</span>
        </div>
        <div>
          <strong>Advert history remains available.</strong>
          <span>Closing an advert removes it from public pages without deleting its outcome evidence.</span>
        </div>
      </aside>

      <section className={styles.tableCard}>
        <header className={styles.tableHeader}>
          <div className={styles.tableTitle}>
            <div>
              <h2>Recorded outcomes</h2>
              <span>Seller feedback, final prices, advert interest and closing source.</span>
            </div>
            <strong>
              {filteredOutcomes.length
                ? `${pageStart + 1}-${pageEnd} of ${filteredOutcomes.length.toLocaleString('en-ZA')}`
                : 'No matches'}
            </strong>
          </div>

          <div className={styles.filters}>
            <label className={styles.searchField}>
              <span>Find an asset or seller</span>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Asset, seller, sector or reference"
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
              <span>Did Aim4price help?</span>
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
              <span>Closed from</span>
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
              <span>Date closed</span>
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
              <span>Order results</span>
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
            <button type="button" onClick={clearFilters} disabled={!filtersActive}>Clear filters</button>
          </div>
        </header>

        <div className={styles.resultSummary}>
          <span><strong>{filteredMetrics.totalOutcomes.toLocaleString('en-ZA')}</strong> matching outcomes</span>
          <span><strong>{filteredMetrics.aim4priceHelpedCount.toLocaleString('en-ZA')}</strong> Yes answers</span>
          <span><strong>{filteredMetrics.notHelpedCount.toLocaleString('en-ZA')}</strong> No answers</span>
          <span><strong>{formatPercent(filteredMetrics.helpRatePercent)}</strong> help rate</span>
          <span><strong>{Math.round(filteredMetrics.avgDaysToOutcome).toLocaleString('en-ZA')}</strong> average days advertised</span>
        </div>

        <div className={styles.tableScroller}>
          <table>
            <thead>
              <tr>
                <th>Asset and seller</th>
                <th>Outcome</th>
                <th>Aim4price contribution</th>
                <th>Price evidence</th>
                <th>Advert activity</th>
              </tr>
            </thead>
            <tbody>
              {pageOutcomes.map((outcome) => {
                const priceDifference = formatPriceDifference(
                  outcome.finalSalePriceExVat,
                  outcome.aim4priceValueExVat,
                );
                return (
                  <tr key={outcome.outcomeId}>
                    <td className={styles.assetCell}>
                      <strong>{outcome.title}</strong>
                      <span>{outcome.sellerLabel || 'Unknown seller'}</span>
                      {outcome.sellerEmail ? <small>{outcome.sellerEmail}</small> : null}
                      <small>{outcome.sectorLabel || 'Uncategorised asset'}</small>
                    </td>
                    <td className={styles.outcomeCell}>
                      <strong>{reasonLabel(outcome.reason)}</strong>
                      <span>Closed {formatDate(outcome.closedAtIso)}</span>
                      <small>{outcome.sourceSurface === 'showroom' ? 'From My Showroom' : 'From Marketplace'}</small>
                      {outcome.outcomeNote ? <small>{outcome.outcomeNote}</small> : null}
                    </td>
                    <td>
                      <span className={outcome.aim4priceHelped ? styles.yesAnswer : styles.noAnswer}>
                        {outcome.aim4priceHelped ? 'Yes' : 'No'}
                      </span>
                      <small>Seller response</small>
                    </td>
                    <td className={styles.priceCell}>
                      {safeMoney(outcome.finalSalePriceExVat) > 0 ? (
                        <>
                          <strong>{formatAdminMarketplaceMoney(safeMoney(outcome.finalSalePriceExVat))}</strong>
                          <span>Final price excl. VAT</span>
                        </>
                      ) : (
                        <><strong>Not provided</strong><span>Final price</span></>
                      )}
                      {outcome.askingPriceExVat > 0 ? (
                        <small>Asked {formatAdminMarketplaceMoney(outcome.askingPriceExVat)}</small>
                      ) : null}
                      {outcome.aim4priceValueExVat > 0 ? (
                        <small>Aim4price value {formatAdminMarketplaceMoney(outcome.aim4priceValueExVat)}</small>
                      ) : null}
                      {priceDifference ? <em>{priceDifference}</em> : null}
                    </td>
                    <td className={styles.activityCell}>
                      <strong>{outcome.totalViewsAtClose.toLocaleString('en-ZA')} {outcome.totalViewsAtClose === 1 ? 'view' : 'views'}</strong>
                      <span>{outcome.accountViewsAtClose.toLocaleString('en-ZA')} account · {outcome.unknownViewsAtClose.toLocaleString('en-ZA')} unknown</span>
                      <small>{outcome.uniqueViewersAtClose.toLocaleString('en-ZA')} different viewers</small>
                      <small>{formatDays(daysToOutcome(outcome))}</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!pageOutcomes.length ? (
            <div className={styles.empty}>
              <strong>No outcomes found</strong>
              <span>Clear the filters to return to every recorded Marketplace outcome.</span>
            </div>
          ) : null}
        </div>

        <footer className={styles.pagination}>
          <span>{filteredOutcomes.length.toLocaleString('en-ZA')} matching · {report.outcomes.length.toLocaleString('en-ZA')} all time</span>
          <div>
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>Previous</button>
            <strong>Page {currentPage} of {totalPages}</strong>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages}>Next</button>
          </div>
        </footer>
      </section>
    </>
  );
}
