'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  filterAndSortAdminMarketplaceAssets,
  formatAdminMarketplaceMoney,
  summarizeAdminMarketplaceAssets,
  type AdminMarketplaceAssetRow,
  type AdminMarketplaceFilters,
  type AdminMarketplaceInterestFilter,
  type AdminMarketplaceListingStatus,
  type AdminMarketplaceReport,
  type AdminMarketplaceSort,
  type AdminMarketplaceViewDetails,
} from '../../../lib/admin-marketplace-shared';
import styles from './page.module.css';

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<AdminMarketplaceListingStatus, string> = {
  live: 'Live',
  withdrawn: 'Withdrawn',
  draft: 'Draft',
  other: 'Other',
};

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

function formatDateTime(value: string | null): string {
  const parsed = parseDate(value);
  if (!parsed) return 'Not recorded';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function formatLocation(area: string, province: string): string {
  return [area, province].filter(Boolean).join(', ') || 'Location not recorded';
}

function formatAccountType(value: string): string {
  const normalized = value.replace(/[_-]+/g, ' ').trim();
  if (!normalized) return 'Aim4price account';
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortReference(value: string | null): string {
  if (!value) return 'Historical listing';
  return `Asset ${value.slice(0, 8)}`;
}

function interestButtonLabel(filter: AdminMarketplaceInterestFilter): string {
  if (filter === 'viewed') return 'Popular';
  if (filter === 'repeat') return 'Repeat interest';
  if (filter === 'unviewed') return 'Not viewed';
  return 'All assets';
}

export default function AdminMarketplaceClient({ report }: { report: AdminMarketplaceReport }) {
  const [assets, setAssets] = useState(() => report.assets);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminMarketplaceFilters['status']>('all');
  const [sector, setSector] = useState('all');
  const [advertised, setAdvertised] = useState('all');
  const [interest, setInterest] = useState<AdminMarketplaceInterestFilter>('all');
  const [sort, setSort] = useState<AdminMarketplaceSort>('latest');
  const [page, setPage] = useState(1);

  const [activityTarget, setActivityTarget] = useState<AdminMarketplaceAssetRow | null>(null);
  const [activityDetails, setActivityDetails] = useState<AdminMarketplaceViewDetails | null>(null);
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityError, setActivityError] = useState('');
  const activityModalRef = useRef<HTMLElement | null>(null);
  const activityTriggerRef = useRef<HTMLButtonElement | null>(null);
  const activityRequestRef = useRef(0);

  const [deleteTarget, setDeleteTarget] = useState<AdminMarketplaceAssetRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteModalRef = useRef<HTMLElement | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deleteBusyRef = useRef(false);
  deleteBusyRef.current = deleteBusy;

  const sectorOptions = useMemo(() => {
    const labels = new Map<string, string>();
    for (const asset of assets) labels.set(asset.sectorKey, asset.sectorLabel);
    return Array.from(labels, ([key, label]) => ({ key, label })).sort((left, right) =>
      left.label.localeCompare(right.label, 'en-ZA', { sensitivity: 'base' }),
    );
  }, [assets]);

  const advertisedYears = useMemo(() => {
    const years = new Set<number>();
    for (const asset of assets) {
      const year = new Date(asset.lastAdvertisedAtIso).getFullYear();
      if (Number.isInteger(year)) years.add(year);
    }
    return Array.from(years).sort((left, right) => right - left);
  }, [assets]);

  const filters = useMemo<AdminMarketplaceFilters>(
    () => ({ search, status, sector, advertised, interest, sort }),
    [advertised, interest, search, sector, sort, status],
  );
  const allMetrics = useMemo(() => summarizeAdminMarketplaceAssets(assets), [assets]);
  const filteredAssets = useMemo(
    () => filterAndSortAdminMarketplaceAssets(assets, filters),
    [assets, filters],
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
    Boolean(search.trim()) ||
    status !== 'all' ||
    sector !== 'all' ||
    advertised !== 'all' ||
    interest !== 'all' ||
    sort !== 'latest';

  useEffect(() => {
    if (!activityTarget || typeof window === 'undefined') return;
    const modal = activityModalRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      modal?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
    });

    function keepFocusInsideActivityModal(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeActivityModal();
        return;
      }
      if (event.key !== 'Tab' || !modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

    window.addEventListener('keydown', keepFocusInsideActivityModal);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', keepFocusInsideActivityModal);
      document.body.style.overflow = previousBodyOverflow;
      activityTriggerRef.current?.focus();
    };
  }, [activityTarget]);

  useEffect(() => {
    if (!deleteTarget || typeof window === 'undefined') return;
    const modal = deleteModalRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      modal?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
    });

    function keepFocusInsideDeleteModal(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deleteBusyRef.current) {
        event.preventDefault();
        setDeleteTarget(null);
        setDeleteError('');
        return;
      }
      if (event.key !== 'Tab' || !modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', keepFocusInsideDeleteModal);
      document.body.style.overflow = previousBodyOverflow;
      deleteTriggerRef.current?.focus();
    };
  }, [deleteTarget]);

  function selectInterest(next: AdminMarketplaceInterestFilter) {
    setInterest(next);
    setPage(1);
    if (next === 'viewed') setSort('popular');
    if (next === 'repeat') setSort('repeat-interest');
    if (next === 'unviewed') setSort('latest');
  }

  function clearFilters() {
    setSearch('');
    setStatus('all');
    setSector('all');
    setAdvertised('all');
    setInterest('all');
    setSort('latest');
    setPage(1);
  }

  async function loadActivity(
    asset: AdminMarketplaceAssetRow,
    requestedPage: number,
    append = false,
  ) {
    if (!asset.sourceAssetId) return;
    const requestId = activityRequestRef.current + 1;
    activityRequestRef.current = requestId;
    setActivityBusy(true);
    setActivityError('');

    try {
      const params = new URLSearchParams({
        assetId: asset.sourceAssetId,
        page: String(requestedPage),
        pageSize: '100',
      });
      const response = await fetch(`/api/admin/marketplace?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as {
        details?: AdminMarketplaceViewDetails;
        error?: string;
      } | null;
      if (!response.ok || !payload?.details) {
        throw new Error(payload?.error || 'Marketplace view activity could not be loaded.');
      }
      if (requestId !== activityRequestRef.current) return;
      const nextDetails = payload.details;
      setActivityDetails((current) => {
        if (!append || !current) return nextDetails;
        return {
          ...nextDetails,
          events: [...current.events, ...nextDetails.events],
        };
      });
    } catch (error) {
      if (requestId === activityRequestRef.current) {
        setActivityError(
          error instanceof Error ? error.message : 'Marketplace view activity could not be loaded.',
        );
      }
    } finally {
      if (requestId === activityRequestRef.current) setActivityBusy(false);
    }
  }

  function openActivityModal(asset: AdminMarketplaceAssetRow, trigger: HTMLButtonElement) {
    if (!asset.sourceAssetId) return;
    activityTriggerRef.current = trigger;
    setActivityTarget(asset);
    setActivityDetails(null);
    setActivityError('');
    void loadActivity(asset, 1);
  }

  function closeActivityModal() {
    activityRequestRef.current += 1;
    setActivityTarget(null);
    setActivityDetails(null);
    setActivityError('');
    setActivityBusy(false);
  }

  function openDeleteModal(asset: AdminMarketplaceAssetRow, trigger: HTMLButtonElement) {
    deleteTriggerRef.current = trigger;
    setDeleteError('');
    setDeleteTarget(asset);
  }

  function closeDeleteModal() {
    if (deleteBusyRef.current) return;
    setDeleteError('');
    setDeleteTarget(null);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      const response = await fetch('/api/admin/marketplace', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountUserId: deleteTarget.accountUserId,
          sourceAssetId: deleteTarget.sourceAssetId,
          latestListingId: deleteTarget.latestListingId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'The marketplace record could not be deleted.');
      }
      const deletedAssetKey = deleteTarget.assetKey;
      setAssets((current) =>
        current.filter((asset) => asset.assetKey !== deletedAssetKey),
      );
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'The marketplace record could not be deleted.',
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <section className={styles.metrics} aria-label="Marketplace summary">
        <article className={styles.featuredMetric}>
          <span>All-time advertised value</span>
          <strong>{formatAdminMarketplaceMoney(allMetrics.allTimeAdvertisedValueExVat)}</strong>
          <small>{allMetrics.totalUniqueAssets.toLocaleString('en-ZA')} unique assets · Excl. VAT</small>
        </article>
        <article>
          <span>Live advertised value</span>
          <strong>{formatAdminMarketplaceMoney(allMetrics.liveAdvertisedValueExVat)}</strong>
          <small>{allMetrics.liveAssets.toLocaleString('en-ZA')} assets currently live</small>
        </article>
        <article>
          <span>Marketplace views</span>
          <strong>{allMetrics.totalViews.toLocaleString('en-ZA')}</strong>
          <small>{allMetrics.viewedAssets.toLocaleString('en-ZA')} assets have been opened</small>
        </article>
        <article>
          <span>Aim4price account views</span>
          <strong>{allMetrics.accountViews.toLocaleString('en-ZA')}</strong>
          <small>Signed-in accounts identified by name</small>
        </article>
        <article>
          <span>Unknown viewer views</span>
          <strong>{allMetrics.unknownViews.toLocaleString('en-ZA')}</strong>
          <small>Guest detail opens, grouped privately</small>
        </article>
        <article className={allMetrics.repeatInterestAssets ? styles.signalMetric : undefined}>
          <span>Repeat interest</span>
          <strong>{allMetrics.repeatInterestAssets.toLocaleString('en-ZA')}</strong>
          <small>Assets flagged after 3 views by one viewer</small>
        </article>
      </section>

      <aside className={styles.definitionNote}>
        <div>
          <strong>Views show real listing interest.</strong>
          <span>
            A view is recorded when someone opens an asset&apos;s Marketplace details. Seller self-views and rapid duplicate opens are excluded.
          </span>
        </div>
        <div>
          <strong>One asset, one advertised value.</strong>
          <span>Re-listing stays in history without inflating the all-time value total.</span>
        </div>
      </aside>

      <section className={styles.tableCard}>
        <header className={styles.tableHeader}>
          <div className={styles.tableTitle}>
            <div>
              <h2>Marketplace discovery</h2>
              <span>Every asset ever advertised, who opened it, and when.</span>
            </div>
            <strong>
              {filteredAssets.length
                ? `${pageStart + 1}-${pageEnd} of ${filteredAssets.length.toLocaleString('en-ZA')}`
                : 'No matches'}
            </strong>
          </div>

          <div className={styles.interestTabs} role="group" aria-label="Marketplace popularity filter">
            {(['all', 'viewed', 'repeat', 'unviewed'] as AdminMarketplaceInterestFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                className={interest === option ? styles.interestTabActive : undefined}
                aria-pressed={interest === option}
                onClick={() => selectInterest(option)}
              >
                {interestButtonLabel(option)}
                {option === 'viewed' ? <span>{allMetrics.viewedAssets}</span> : null}
                {option === 'repeat' ? <span>{allMetrics.repeatInterestAssets}</span> : null}
              </button>
            ))}
          </div>

          <div className={styles.filters}>
            <label className={styles.searchField}>
              <span>Find an asset or account</span>
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
              <span>Listing status</span>
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
              <span>Asset sector</span>
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
              <span>Order results</span>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as AdminMarketplaceSort);
                  setPage(1);
                }}
              >
                <option value="popular">Most viewed</option>
                <option value="repeat-interest">Strongest repeat interest</option>
                <option value="recent-view">Recently viewed</option>
                <option value="latest">Latest advertised</option>
                <option value="oldest">Oldest first</option>
                <option value="value-high">Highest value</option>
                <option value="value-low">Lowest value</option>
                <option value="asset-az">Asset A-Z</option>
              </select>
            </label>
            <button type="button" onClick={clearFilters} disabled={!filtersActive}>Clear filters</button>
          </div>
        </header>

        <div className={styles.resultSummary}>
          <span><strong>{filteredMetrics.totalViews.toLocaleString('en-ZA')}</strong> views across this result</span>
          <span><strong>{filteredMetrics.accountViews.toLocaleString('en-ZA')}</strong> known account views</span>
          <span><strong>{filteredMetrics.repeatInterestAssets.toLocaleString('en-ZA')}</strong> repeat-interest flags</span>
        </div>

        <div className={styles.tableScroller}>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Seller</th>
                <th>Listing</th>
                <th>Viewer interest</th>
                <th>Asking excl. VAT</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageAssets.map((asset) => {
                const assetDetails = [
                  [asset.brandName, asset.modelName].filter(Boolean).join(' '),
                  asset.familyLabel || asset.sectorLabel,
                  shortReference(asset.sourceAssetId),
                ].filter(Boolean);
                return (
                  <tr key={asset.assetKey} className={asset.hasRepeatInterest ? styles.flaggedRow : undefined}>
                    <td className={styles.assetCell}>
                      <strong>{asset.title}</strong>
                      <span>{assetDetails.join(' · ')}</span>
                      <small>{formatLocation(asset.area, asset.province)}</small>
                    </td>
                    <td className={styles.sellerCell}>
                      <strong>{asset.sellerLabel}</strong>
                      {asset.sellerEmail ? <span>{asset.sellerEmail}</span> : null}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[`status_${asset.status}`]}`}>
                        {STATUS_LABELS[asset.status]}
                      </span>
                      <span>Latest {formatDate(asset.lastAdvertisedAtIso)}</span>
                      <small>{asset.listingEvents} {asset.listingEvents === 1 ? 'listing' : 'listings'} in history</small>
                    </td>
                    <td className={styles.interestCell}>
                      {asset.totalViews > 0 ? (
                        <>
                          <strong>{asset.totalViews.toLocaleString('en-ZA')} {asset.totalViews === 1 ? 'view' : 'views'}</strong>
                          <span>{asset.accountViews.toLocaleString('en-ZA')} account · {asset.unknownViews.toLocaleString('en-ZA')} unknown</span>
                          <small>Last opened {formatDateTime(asset.lastViewedAtIso)}</small>
                          {asset.hasRepeatInterest ? (
                            <em className={styles.repeatFlag}>
                              <span aria-hidden="true">⚑</span>
                              {asset.repeatViewerLabel || 'One viewer'} · {asset.repeatViewerViews} views
                            </em>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <strong>No views yet</strong>
                          <span>Waiting for the first detail open</span>
                        </>
                      )}
                    </td>
                    <td className={styles.moneyCell}>
                      {asset.askingPriceExVat > 0
                        ? formatAdminMarketplaceMoney(asset.askingPriceExVat)
                        : 'Not recorded'}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.activityButton}
                          disabled={!asset.sourceAssetId}
                          onClick={(event) => openActivityModal(asset, event.currentTarget)}
                        >
                          View activity
                        </button>
                        <button
                          type="button"
                          className={styles.deleteButton}
                          aria-label={`Delete ${asset.title} marketplace record`}
                          onClick={(event) => openDeleteModal(asset, event.currentTarget)}
                        >
                          Delete listing
                        </button>
                      </div>
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
          <span>{filteredAssets.length.toLocaleString('en-ZA')} matching · {allMetrics.totalUniqueAssets.toLocaleString('en-ZA')} all time</span>
          <div>
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>Previous</button>
            <strong>Page {currentPage} of {totalPages}</strong>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages}>Next</button>
          </div>
        </footer>
      </section>

      {activityTarget ? (
        <div className={styles.modalLayer}>
          <button type="button" className={styles.backdrop} tabIndex={-1} aria-label="Close Marketplace view activity" onClick={closeActivityModal} />
          <section
            ref={activityModalRef}
            className={styles.activityModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketplace-view-activity-title"
            tabIndex={-1}
          >
            <header className={styles.modalHeader}>
              <div>
                <h2 id="marketplace-view-activity-title">Who viewed this asset?</h2>
                <p>{activityTarget.title}</p>
              </div>
              <button type="button" className={styles.modalCloseButton} aria-label="Close Marketplace view activity" onClick={closeActivityModal}>
                <span aria-hidden="true">×</span>
              </button>
            </header>

            {activityBusy && !activityDetails ? (
              <div className={styles.activityLoading} aria-busy="true">
                <i /><i /><i /><strong>Loading viewer activity…</strong>
              </div>
            ) : null}
            {activityError ? (
              <div className={styles.activityError} role="alert">
                <strong>Viewer activity could not be loaded</strong>
                <span>{activityError}</span>
                <button type="button" onClick={() => void loadActivity(activityTarget, 1)}>Try again</button>
              </div>
            ) : null}

            {activityDetails ? (
              <div className={styles.activityBody}>
                <section className={styles.activitySummary} aria-label="Viewer activity summary">
                  <article><strong>{activityDetails.totalViews}</strong><span>Total views</span></article>
                  <article><strong>{activityDetails.accountViews}</strong><span>Account views</span></article>
                  <article><strong>{activityDetails.unknownViews}</strong><span>Unknown views</span></article>
                  <article><strong>{activityDetails.uniqueViewers}</strong><span>Different viewers</span></article>
                </section>

                {activityDetails.repeatViewers > 0 ? (
                  <aside className={styles.repeatBanner}>
                    <span aria-hidden="true">⚑</span>
                    <div>
                      <strong>Repeat interest detected</strong>
                      <p>{activityDetails.repeatViewers} {activityDetails.repeatViewers === 1 ? 'viewer has' : 'viewers have'} opened this asset at least 3 times.</p>
                    </div>
                  </aside>
                ) : null}

                <section className={styles.viewerSection}>
                  <div className={styles.activityHeading}>
                    <h3>Viewer summary</h3>
                    <span>Grouped by Aim4price account or unknown browser</span>
                  </div>
                  {activityDetails.viewerGroups.length ? (
                    <div className={styles.viewerList}>
                      {activityDetails.viewerGroups.map((viewer) => (
                        <article key={viewer.viewerKey} className={viewer.hasRepeatInterest ? styles.viewerFlagged : undefined}>
                          <span className={styles.viewerAvatar} aria-hidden="true">{viewer.viewerKind === 'account' ? 'A' : '?'}</span>
                          <div>
                            <strong>{viewer.viewerLabel}</strong>
                            <span>
                              {viewer.viewerKind === 'account'
                                ? `${formatAccountType(viewer.viewerAccountType)}${viewer.viewerEmail ? ` · ${viewer.viewerEmail}` : ''}`
                                : 'Unknown viewer · privacy-safe browser ID'}
                            </span>
                            <small>Last viewed {formatDateTime(viewer.lastViewedAtIso)}</small>
                          </div>
                          <div className={styles.viewerCount}>
                            {viewer.hasRepeatInterest ? <em><span aria-hidden="true">⚑</span> Flagged</em> : null}
                            <strong>{viewer.viewCount}</strong>
                            <span>{viewer.viewCount === 1 ? 'view' : 'views'}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.activityEmpty}>
                      <strong>No recorded views yet</strong>
                      <span>This asset has not been opened since view tracking started.</span>
                    </div>
                  )}
                </section>

                <section className={styles.timelineSection}>
                  <div className={styles.activityHeading}>
                    <h3>View timeline</h3>
                    <span>Each recorded detail open, newest first</span>
                  </div>
                  {activityDetails.events.length ? (
                    <div className={styles.timeline}>
                      {activityDetails.events.map((event) => (
                        <article key={event.id}>
                          <span className={styles.timelineDot} aria-hidden="true" />
                          <div>
                            <strong>{event.viewerLabel}</strong>
                            <span>
                              {event.viewerKind === 'account'
                                ? `${formatAccountType(event.viewerAccountType)} account viewed this asset`
                                : 'Unknown viewer viewed this asset'}
                            </span>
                          </div>
                          <time dateTime={event.viewedAtIso}>{formatDateTime(event.viewedAtIso)}</time>
                        </article>
                      ))}
                    </div>
                  ) : null}
                  {activityDetails.page < activityDetails.totalPages ? (
                    <button
                      type="button"
                      className={styles.loadMoreButton}
                      disabled={activityBusy}
                      onClick={() => void loadActivity(activityTarget, activityDetails.page + 1, true)}
                    >
                      {activityBusy ? 'Loading older views…' : 'Load older views'}
                    </button>
                  ) : null}
                </section>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className={styles.deleteModalLayer}>
          <button
            type="button"
            className={styles.deleteBackdrop}
            tabIndex={-1}
            aria-label="Close delete confirmation"
            disabled={deleteBusy}
            onClick={closeDeleteModal}
          />
          <section
            ref={deleteModalRef}
            className={styles.deleteModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-marketplace-listing-title"
            aria-describedby="delete-marketplace-listing-description"
            tabIndex={-1}
          >
            <header className={styles.deleteModalHeader}>
              <div>
                <h2 id="delete-marketplace-listing-title">Delete this listing?</h2>
                <p>Marketplace record</p>
              </div>
              <button type="button" className={styles.deleteCloseButton} aria-label="Close delete confirmation" disabled={deleteBusy} onClick={closeDeleteModal}>
                <span aria-hidden="true">×</span>
              </button>
            </header>
            <div className={styles.deleteSummary}>
              <strong>{deleteTarget.title}</strong>
              <span>{deleteTarget.sellerLabel} · {formatAdminMarketplaceMoney(deleteTarget.askingPriceExVat)}</span>
            </div>
            <p id="delete-marketplace-listing-description" className={styles.deleteDescription}>
              This permanently removes{' '}
              {deleteTarget.listingEvents === 1
                ? 'this listing event'
                : `all ${deleteTarget.listingEvents.toLocaleString('en-ZA')} listing events for this asset`}{' '}
              and its Marketplace view history from Admin.
            </p>
            <p className={styles.assetSafetyNote}>
              If it is live, it will also be removed from the public Marketplace. The owner&apos;s underlying asset and Asset Register record will remain intact.
            </p>
            {deleteError ? <p className={styles.deleteError} role="alert">{deleteError}</p> : null}
            <footer className={styles.deleteActions}>
              <button type="button" disabled={deleteBusy} onClick={closeDeleteModal}>Keep listing</button>
              <button type="button" className={styles.confirmDeleteButton} disabled={deleteBusy} onClick={confirmDelete}>
                {deleteBusy ? 'Deleting…' : 'Delete permanently'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
