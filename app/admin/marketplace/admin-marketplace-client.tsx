'use client';

import { useMemo, useState } from 'react';
import {
  filterAndSortAdminMarketplaceAssets,
  formatAdminMarketplaceMoney,
  summarizeAdminMarketplaceAssets,
  type AdminMarketplaceFilters,
  type AdminMarketplaceListingStatus,
  type AdminMarketplaceReport,
  type AdminMarketplaceSort,
} from '../../../lib/admin-marketplace-shared';
import styles from './page.module.css';

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<AdminMarketplaceListingStatus, string> = {
  live: 'Live',
  withdrawn: 'Withdrawn',
  draft: 'Draft',
  other: 'Other',
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';

  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatLocation(area: string, province: string): string {
  return [area, province].filter(Boolean).join(', ') || 'Not recorded';
}

function shortReference(value: string | null): string {
  if (!value) return 'Historical listing';
  return `Asset ${value.slice(0, 8)}`;
}

export default function AdminMarketplaceClient({
  report,
}: {
  report: AdminMarketplaceReport;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminMarketplaceFilters['status']>('all');
  const [sector, setSector] = useState('all');
  const [advertised, setAdvertised] = useState('all');
  const [sort, setSort] = useState<AdminMarketplaceSort>('latest');
  const [page, setPage] = useState(1);

  const sectorOptions = useMemo(() => {
    const labels = new Map<string, string>();
    for (const asset of report.assets) labels.set(asset.sectorKey, asset.sectorLabel);
    return Array.from(labels, ([key, label]) => ({ key, label })).sort((left, right) =>
      left.label.localeCompare(right.label, 'en-ZA', { sensitivity: 'base' }),
    );
  }, [report.assets]);

  const advertisedYears = useMemo(() => {
    const years = new Set<number>();
    for (const asset of report.assets) {
      const year = new Date(asset.lastAdvertisedAtIso).getFullYear();
      if (Number.isInteger(year)) years.add(year);
    }
    return Array.from(years).sort((left, right) => right - left);
  }, [report.assets]);

  const filters = useMemo<AdminMarketplaceFilters>(
    () => ({ search, status, sector, advertised, sort }),
    [advertised, search, sector, sort, status],
  );
  const filteredAssets = useMemo(
    () => filterAndSortAdminMarketplaceAssets(report.assets, filters),
    [filters, report.assets],
  );
  const filteredMetrics = useMemo(
    () => summarizeAdminMarketplaceAssets(filteredAssets),
    [filteredAssets],
  );
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filteredAssets.length ? (currentPage - 1) * PAGE_SIZE : 0;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filteredAssets.length);
  const pageAssets = filteredAssets.slice(pageStart, pageEnd);
  const filtersActive =
    Boolean(search.trim()) || status !== 'all' || sector !== 'all' || advertised !== 'all';

  function clearFilters() {
    setSearch('');
    setStatus('all');
    setSector('all');
    setAdvertised('all');
    setSort('latest');
    setPage(1);
  }

  return (
    <>
      <section className={styles.metrics} aria-label="Marketplace summary">
        <article className={styles.featuredMetric}>
          <span>All-time advertised value</span>
          <strong>{formatAdminMarketplaceMoney(report.metrics.allTimeAdvertisedValueExVat)}</strong>
          <small>
            Excl. VAT · {report.metrics.totalUniqueAssets.toLocaleString('en-ZA')} unique marketplace assets
          </small>
        </article>
        <article>
          <span>Live advertised value</span>
          <strong>{formatAdminMarketplaceMoney(report.metrics.liveAdvertisedValueExVat)}</strong>
          <small>{report.metrics.liveAssets.toLocaleString('en-ZA')} assets currently live</small>
        </article>
        <article>
          <span>Filtered advertised value</span>
          <strong>{formatAdminMarketplaceMoney(filteredMetrics.allTimeAdvertisedValueExVat)}</strong>
          <small>
            {filteredAssets.length.toLocaleString('en-ZA')} of {report.metrics.totalUniqueAssets.toLocaleString('en-ZA')} assets shown
          </small>
        </article>
        <article>
          <span>Advertisement history</span>
          <strong>{report.metrics.totalListingEvents.toLocaleString('en-ZA')}</strong>
          <small>
            Listing events · {report.metrics.relistedAssets.toLocaleString('en-ZA')} assets advertised more than once
          </small>
        </article>
      </section>

      <aside className={styles.definitionNote}>
        <strong>One asset, one value in the total.</strong>
        <span>
          The all-time amount uses each asset&apos;s latest recorded asking price, including assets that were later withdrawn.
          Re-listing the same asset remains visible in its history but never inflates the value total.
        </span>
      </aside>

      <section className={styles.tableCard}>
        <header className={styles.tableHeader}>
          <div className={styles.tableTitle}>
            <p>Marketplace history</p>
            <h2>Every asset ever advertised</h2>
            <span>
              {filteredAssets.length
                ? `Showing ${pageStart + 1}-${pageEnd} of ${filteredAssets.length.toLocaleString('en-ZA')} matching assets`
                : 'No assets match the current filters'}
            </span>
          </div>

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
                placeholder="Asset, seller, location or reference"
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as AdminMarketplaceFilters['status']);
                  setPage(1);
                }}
              >
                <option value="all">All statuses</option>
                <option value="live">Live</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="draft">Draft</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              <span>Sector</span>
              <select
                value={sector}
                onChange={(event) => {
                  setSector(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All sectors</option>
                {sectorOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Last advertised</span>
              <select
                value={advertised}
                onChange={(event) => {
                  setAdvertised(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All time</option>
                <option value="last-30-days">Last 30 days</option>
                <option value="last-90-days">Last 90 days</option>
                {advertisedYears.map((year) => (
                  <option key={year} value={`year:${year}`}>{year}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as AdminMarketplaceSort);
                  setPage(1);
                }}
              >
                <option value="latest">Latest advertised</option>
                <option value="oldest">Oldest first</option>
                <option value="value-high">Highest value</option>
                <option value="value-low">Lowest value</option>
                <option value="asset-az">Asset A-Z</option>
              </select>
            </label>
            <button type="button" onClick={clearFilters} disabled={!filtersActive && sort === 'latest'}>
              Clear filters
            </button>
          </div>
        </header>

        <div className={styles.tableScroller}>
          <table>
            <thead>
              <tr>
                <th>Advertised</th>
                <th>Status</th>
                <th>Asset</th>
                <th>Sector / category</th>
                <th>Seller account</th>
                <th>Location</th>
                <th>Latest asking excl. VAT</th>
                <th>History</th>
              </tr>
            </thead>
            <tbody>
              {pageAssets.map((asset) => {
                const assetDetails = [
                  [asset.brandName, asset.modelName].filter(Boolean).join(' '),
                  shortReference(asset.sourceAssetId),
                ].filter(Boolean);

                return (
                  <tr key={asset.assetKey}>
                    <td>
                      <strong>{formatDate(asset.firstAdvertisedAtIso)}</strong>
                      <span>Latest {formatDate(asset.lastAdvertisedAtIso)}</span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[`status_${asset.status}`]}`}>
                        {STATUS_LABELS[asset.status]}
                      </span>
                    </td>
                    <td>
                      <strong>{asset.title}</strong>
                      {assetDetails.length ? <span>{assetDetails.join(' · ')}</span> : null}
                      {asset.description ? <small>{asset.description}</small> : null}
                    </td>
                    <td>
                      <strong>{asset.sectorLabel}</strong>
                      {asset.familyLabel ? <span>{asset.familyLabel}</span> : null}
                    </td>
                    <td>
                      <strong>{asset.sellerLabel}</strong>
                      {asset.sellerEmail ? <span>{asset.sellerEmail}</span> : null}
                    </td>
                    <td>{formatLocation(asset.area, asset.province)}</td>
                    <td className={styles.moneyCell}>
                      {asset.askingPriceExVat > 0
                        ? formatAdminMarketplaceMoney(asset.askingPriceExVat)
                        : 'Not recorded'}
                    </td>
                    <td>
                      <strong>{asset.listingEvents.toLocaleString('en-ZA')}</strong>
                      <span>{asset.listingEvents === 1 ? 'listing event' : 'listing events'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!pageAssets.length ? (
            <div className={styles.empty}>
              <strong>No marketplace assets found</strong>
              <span>Clear the filters to return to the complete all-time history.</span>
            </div>
          ) : null}
        </div>

        <footer className={styles.pagination}>
          <span>
            {filteredAssets.length.toLocaleString('en-ZA')} matching · {report.metrics.totalUniqueAssets.toLocaleString('en-ZA')} all time
          </span>
          <div>
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
      </section>
    </>
  );
}
