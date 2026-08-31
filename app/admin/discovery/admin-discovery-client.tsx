"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ADMIN_DISCOVERY_PAGE_SIZES,
  formatAdminAssetMoney,
  formatAdminAssetValue,
  hasAdminAssetCoordinates,
  type AdminAssetInterestFilter,
  type AdminAssetLocationFilter,
  type AdminAssetParticipationFilter,
  type AdminAssetSort,
  type AdminDiscoveryFilters,
  type AdminDiscoveryReport,
  type AdminDiscoveryViewDetails,
  type AdminGlobalAsset,
} from "../../../lib/admin-global-assets-shared";
import styles from "./page.module.css";

type DiscoveryFilterState = Pick<
  AdminDiscoveryFilters,
  | "search"
  | "ownerUserId"
  | "province"
  | "sector"
  | "participation"
  | "location"
  | "interest"
  | "lifecycleState"
  | "sort"
  | "page"
  | "pageSize"
  | "focusAssetId"
>;

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatAccountType(value: string): string {
  return titleCase(value || "Aim4price");
}

function interestButtonLabel(value: AdminAssetInterestFilter): string {
  if (value === "viewed") return "Viewed";
  if (value === "repeat") return "Repeat interest";
  if (value === "unviewed") return "Not viewed";
  return "All assets";
}

function assetIdentity(asset: AdminGlobalAsset): string {
  const model = [asset.brandName, asset.modelName || asset.typedModelName]
    .filter(Boolean)
    .join(" ");
  return model || asset.assetTypeLabel;
}

function formatUsage(asset: AdminGlobalAsset): string {
  if (asset.hours !== null) {
    const unit = asset.usageMetric === "km" || asset.kind === "vehicle" ? "km" : "hours";
    return `${new Intl.NumberFormat("en-ZA").format(asset.hours)} ${unit}`;
  }
  if (asset.lifeWorkedPercent !== null) {
    return `${Math.round(asset.lifeWorkedPercent * 10) / 10}% worked`;
  }
  return "Not saved";
}

function filtersFromReport(report: AdminDiscoveryReport): DiscoveryFilterState {
  return { ...report.filters };
}

function buildQuery(filters: DiscoveryFilterState): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.ownerUserId) params.set("owner", filters.ownerUserId);
  if (filters.province) params.set("province", filters.province);
  if (filters.sector) params.set("sector", filters.sector);
  if (filters.participation !== "all") params.set("participation", filters.participation);
  if (filters.location !== "all") params.set("location", filters.location);
  if (filters.interest !== "all") params.set("interest", filters.interest);
  if (filters.lifecycleState) params.set("lifecycle", filters.lifecycleState);
  if (filters.sort !== "updated") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.pageSize !== 50) params.set("pageSize", String(filters.pageSize));
  if (filters.focusAssetId) params.set("assetId", filters.focusAssetId);
  return params.toString();
}

export default function AdminDiscoveryClient({
  initialReport,
}: {
  initialReport: AdminDiscoveryReport;
}) {
  const [report, setReport] = useState(initialReport);
  const [filters, setFilters] = useState<DiscoveryFilterState>(() =>
    filtersFromReport(initialReport),
  );
  const [searchDraft, setSearchDraft] = useState(initialReport.filters.search);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AdminGlobalAsset | null>(null);
  const [openingOwnerId, setOpeningOwnerId] = useState<string | null>(null);
  const [activityTarget, setActivityTarget] = useState<AdminGlobalAsset | null>(null);
  const [activityDetails, setActivityDetails] = useState<AdminDiscoveryViewDetails | null>(null);
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityError, setActivityError] = useState("");
  const requestSequenceRef = useRef(0);
  const detailsRef = useRef<HTMLElement | null>(null);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const activityModalRef = useRef<HTMLElement | null>(null);
  const activityTriggerRef = useRef<HTMLButtonElement | null>(null);
  const activityRequestRef = useRef(0);
  const initialFocusHandledRef = useRef(false);

  const activeFilterCount = useMemo(
    () =>
      [
        filters.search,
        filters.ownerUserId,
        filters.province,
        filters.sector,
        filters.participation !== "all" ? filters.participation : "",
        filters.location !== "all" ? filters.location : "",
        filters.interest !== "all" ? filters.interest : "",
        filters.lifecycleState,
      ].filter(Boolean).length,
    [filters],
  );

  useEffect(() => {
    if (initialFocusHandledRef.current) return;
    initialFocusHandledRef.current = true;
    const focusAsset = initialReport.filters.focusAssetId
      ? initialReport.assets.find((asset) => asset.id === initialReport.filters.focusAssetId)
      : null;
    if (focusAsset) setSelectedAsset(focusAsset);
  }, [initialReport]);

  useEffect(() => {
    if (!selectedAsset) return;
    const modal = detailsRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      modal?.querySelector<HTMLElement>("button:not([disabled]), a[href]")?.focus();
    });

    function keepFocusInsideDetails(event: KeyboardEvent) {
      if (event.key === "Escape" && !openingOwnerId) {
        event.preventDefault();
        setSelectedAsset(null);
        return;
      }
      if (event.key !== "Tab" || !modal) return;
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

    window.addEventListener("keydown", keepFocusInsideDetails);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", keepFocusInsideDetails);
      document.body.style.overflow = previousOverflow;
      detailTriggerRef.current?.focus();
    };
  }, [openingOwnerId, selectedAsset]);

  useEffect(() => {
    if (!activityTarget) return;
    const modal = activityModalRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      modal?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
    });

    function keepFocusInsideActivity(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeActivityModal();
        return;
      }
      if (event.key !== "Tab" || !modal) return;
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

    window.addEventListener("keydown", keepFocusInsideActivity);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", keepFocusInsideActivity);
      document.body.style.overflow = previousOverflow;
      activityTriggerRef.current?.focus();
    };
  }, [activityTarget]);

  async function loadReport(nextFilters: DiscoveryFilterState) {
    const sequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = sequence;
    setFilters(nextFilters);
    setLoading(true);
    setError("");
    try {
      const query = buildQuery(nextFilters);
      const response = await fetch(`/api/admin/discovery${query ? `?${query}` : ""}`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        report?: AdminDiscoveryReport;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok || !payload.report) {
        throw new Error(payload?.error || "Admin Discovery could not be loaded.");
      }
      if (sequence !== requestSequenceRef.current) return;
      setReport(payload.report);
      const normalizedFilters = filtersFromReport(payload.report);
      setFilters(normalizedFilters);
      setSearchDraft(normalizedFilters.search);
      const normalizedQuery = buildQuery(normalizedFilters);
      window.history.replaceState(
        null,
        "",
        `/admin/discovery${normalizedQuery ? `?${normalizedQuery}` : ""}`,
      );
    } catch (loadError) {
      if (sequence !== requestSequenceRef.current) return;
      setError(
        loadError instanceof Error ? loadError.message : "Admin Discovery could not be loaded.",
      );
    } finally {
      if (sequence === requestSequenceRef.current) setLoading(false);
    }
  }

  function updateFilter<K extends keyof DiscoveryFilterState>(
    key: K,
    value: DiscoveryFilterState[K],
  ) {
    const next = {
      ...filters,
      [key]: value,
      page: 1,
      focusAssetId: "",
    };
    void loadReport(next);
  }

  function submitSearch() {
    const next = {
      ...filters,
      search: searchDraft.trim(),
      page: 1,
      focusAssetId: "",
    };
    void loadReport(next);
  }

  function clearFilters() {
    const next: DiscoveryFilterState = {
      search: "",
      ownerUserId: "",
      province: "",
      sector: "",
      participation: "all",
      location: "all",
      interest: "all",
      lifecycleState: "",
      sort: "updated",
      page: 1,
      pageSize: filters.pageSize,
      focusAssetId: "",
    };
    setSearchDraft("");
    void loadReport(next);
  }

  function openDetails(asset: AdminGlobalAsset, trigger: HTMLButtonElement) {
    detailTriggerRef.current = trigger;
    setError("");
    setSelectedAsset(asset);
  }

  function selectInterest(interest: AdminAssetInterestFilter) {
    const sort: AdminAssetSort =
      interest === "viewed"
        ? "popular"
        : interest === "repeat"
          ? "repeat-interest"
          : "updated";
    const next: DiscoveryFilterState = {
      ...filters,
      interest,
      sort,
      page: 1,
      focusAssetId: "",
    };
    void loadReport(next);
  }

  async function loadActivity(
    asset: AdminGlobalAsset,
    requestedPage: number,
    append = false,
  ) {
    const requestId = activityRequestRef.current + 1;
    activityRequestRef.current = requestId;
    setActivityBusy(true);
    setActivityError("");

    try {
      const params = new URLSearchParams({
        viewAssetId: asset.id,
        viewPage: String(requestedPage),
        viewPageSize: "100",
      });
      const response = await fetch(`/api/admin/discovery?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        details?: AdminDiscoveryViewDetails;
        error?: string;
      } | null;
      if (!response.ok || !payload?.details) {
        throw new Error(payload?.error || "Discovery viewer activity could not be loaded.");
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
    } catch (loadError) {
      if (requestId === activityRequestRef.current) {
        setActivityError(
          loadError instanceof Error
            ? loadError.message
            : "Discovery viewer activity could not be loaded.",
        );
      }
    } finally {
      if (requestId === activityRequestRef.current) setActivityBusy(false);
    }
  }

  function openActivityModal(asset: AdminGlobalAsset, trigger: HTMLButtonElement) {
    activityTriggerRef.current = trigger;
    setActivityTarget(asset);
    setActivityDetails(null);
    setActivityError("");
    void loadActivity(asset, 1);
  }

  function closeActivityModal() {
    activityRequestRef.current += 1;
    setActivityTarget(null);
    setActivityDetails(null);
    setActivityError("");
    setActivityBusy(false);
  }

  async function openOwnerAccount(asset: AdminGlobalAsset) {
    if (openingOwnerId) return;
    setOpeningOwnerId(asset.ownerUserId);
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: asset.ownerUserId, action: "open_account" }),
      });
      const payload = (await response.json().catch(() => null)) as {
        redirectUrl?: string;
        error?: string;
      } | null;
      if (!response.ok || !payload?.redirectUrl) {
        throw new Error(payload?.error || "The owner account could not be opened.");
      }
      window.location.assign(payload.redirectUrl);
    } catch (openError) {
      setError(
        openError instanceof Error ? openError.message : "The owner account could not be opened.",
      );
      setOpeningOwnerId(null);
    }
  }

  return (
    <>
      <section className={styles.metrics} aria-label="Admin Discovery summary">
        <article>
          <strong>{report.summary.totalAssets.toLocaleString("en-ZA")}</strong>
          <span>Assets</span>
        </article>
        <article>
          <strong>{report.summary.totalViews.toLocaleString("en-ZA")}</strong>
          <span>Views</span>
        </article>
        <article>
          <strong>{report.summary.viewedAssets.toLocaleString("en-ZA")}</strong>
          <span>Viewed assets</span>
        </article>
        <article>
          <strong>{report.summary.repeatInterestAssets.toLocaleString("en-ZA")}</strong>
          <span>Repeat interest</span>
        </article>
        <article>
          <strong>{formatAdminAssetMoney(report.summary.totalValueExVat)}</strong>
          <span>Value</span>
        </article>
        <article>
          <strong>{report.summary.ownerAccounts.toLocaleString("en-ZA")}</strong>
          <span>Owners</span>
        </article>
      </section>

      <section className={styles.discoveryCard}>
        <div className={styles.interestBar}>
          <div className={styles.interestTabs} role="group" aria-label="Discovery popularity filter">
            {(["all", "viewed", "repeat", "unviewed"] as AdminAssetInterestFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                className={filters.interest === option ? styles.interestTabActive : undefined}
                aria-pressed={filters.interest === option}
                disabled={loading}
                onClick={() => selectInterest(option)}
              >
                {interestButtonLabel(option)}
                {option === "repeat" ? ` (${report.summary.repeatInterestAssets})` : null}
              </button>
            ))}
          </div>
        </div>
        <header className={styles.filterHeader}>
          <div className={styles.filterTitle}>
            <h2>
              {report.pagination.totalItems
                ? `${(report.pagination.page - 1) * report.pagination.pageSize + 1}-${Math.min(
                    report.pagination.page * report.pagination.pageSize,
                    report.pagination.totalItems,
                  )} of ${report.pagination.totalItems.toLocaleString("en-ZA")} assets`
                : "No matching assets"}
            </h2>
          </div>

          <div className={styles.filters}>
            <form
              className={styles.searchField}
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
            >
              <label>
                <span>Search</span>
                <input
                  type="search"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Asset or owner"
                />
              </label>
              <button type="submit" disabled={loading}>Search</button>
            </form>
            <label>
              <span>Owner</span>
              <select
                value={filters.ownerUserId}
                onChange={(event) => updateFilter("ownerUserId", event.target.value)}
                disabled={loading}
              >
                <option value="">All owners</option>
                {report.options.owners.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Province</span>
              <select
                value={filters.province}
                onChange={(event) => updateFilter("province", event.target.value)}
                disabled={loading}
              >
                <option value="">All provinces</option>
                {report.options.provinces.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sector</span>
              <select
                value={filters.sector}
                onChange={(event) => updateFilter("sector", event.target.value)}
                disabled={loading}
              >
                <option value="">All sectors</option>
                {report.options.sectors.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Participation</span>
              <select
                value={filters.participation}
                onChange={(event) =>
                  updateFilter(
                    "participation",
                    event.target.value as AdminAssetParticipationFilter,
                  )
                }
                disabled={loading}
              >
                <option value="all">All participation</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Admin only</option>
              </select>
            </label>
            <label>
              <span>GPS status</span>
              <select
                value={filters.location}
                onChange={(event) =>
                  updateFilter("location", event.target.value as AdminAssetLocationFilter)
                }
                disabled={loading}
              >
                <option value="all">All GPS</option>
                <option value="mapped">Mapped</option>
                <option value="missing">Missing</option>
              </select>
            </label>
            <label>
              <span>Lifecycle</span>
              <select
                value={filters.lifecycleState}
                onChange={(event) => updateFilter("lifecycleState", event.target.value)}
                disabled={loading}
              >
                <option value="">All states</option>
                {report.options.lifecycleStates.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select
                value={filters.sort}
                onChange={(event) => updateFilter("sort", event.target.value as AdminAssetSort)}
                disabled={loading}
              >
                <option value="updated">Recently updated</option>
                <option value="popular">Most viewed</option>
                <option value="repeat-interest">Strongest repeat interest</option>
                <option value="recent-view">Most recently viewed</option>
                <option value="value-high">Highest value</option>
                <option value="value-low">Lowest value</option>
                <option value="owner">Owner A-Z</option>
                <option value="asset">Asset A-Z</option>
              </select>
            </label>
            {activeFilterCount ? (
              <button
                type="button"
                className={styles.clearButton}
                onClick={clearFilters}
                disabled={loading}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </header>

        {error ? <p className={styles.errorNotice}>{error}</p> : null}
        {loading ? <div className={styles.loadingBar} aria-label="Loading filtered assets" /> : null}

        <div className={styles.tableScroller} aria-busy={loading}>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Owner</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Value</th>
                <th>Views</th>
                <th>Access</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {report.assets.map((asset) => {
                const mapped = hasAdminAssetCoordinates(asset);
                return (
                  <tr key={asset.id}>
                    <td>
                      <strong>{asset.title}</strong>
                      <span>· {assetIdentity(asset)} · {asset.sectorLabel}</span>
                    </td>
                    <td>
                      <strong>{asset.owner.label}</strong>
                    </td>
                    <td>
                      {asset.owner.email ? (
                        <a href={`mailto:${asset.owner.email}`}>{asset.owner.email}</a>
                      ) : null}
                      {asset.owner.phone ? <a href={`tel:${asset.owner.phone}`}> · {asset.owner.phone}</a> : null}
                      {!asset.owner.email && !asset.owner.phone ? <span>—</span> : null}
                    </td>
                    <td>
                      {[asset.owner.townCity, asset.owner.province].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className={styles.moneyCell}>{formatAdminAssetValue(asset)}</td>
                    <td className={styles.interestCell}>
                      {asset.totalViews > 0 ? (
                        <>
                          <strong>{asset.totalViews.toLocaleString("en-ZA")} {asset.totalViews === 1 ? "view" : "views"}</strong>
                        </>
                      ) : (
                        <strong>0</strong>
                      )}
                      <button
                        type="button"
                        className={styles.activityButton}
                        onClick={(event) => openActivityModal(asset, event.currentTarget)}
                      >
                        Activity
                      </button>
                    </td>
                    <td>
                      <span className={asset.owner.discoveryParticipationEnabled && mapped ? styles.enabledBadge : styles.disabledBadge}>
                        {asset.owner.discoveryParticipationEnabled ? "Enabled" : "Admin only"} · {mapped ? "Mapped" : "No GPS"}
                      </span>
                    </td>
                    <td>{formatDate(asset.updatedAtIso)}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.viewButton}
                        onClick={(event) => openDetails(asset, event.currentTarget)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!report.assets.length ? (
            <div className={styles.emptyState}>
              <strong>No matching assets</strong>
            </div>
          ) : null}
        </div>

        <footer className={styles.pagination}>
          <label>
            <span>Rows per page</span>
            <select
              value={filters.pageSize}
              onChange={(event) =>
                updateFilter("pageSize", Number(event.target.value))
              }
              disabled={loading}
            >
              {ADMIN_DISCOVERY_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
          <span>
            Page {report.pagination.page.toLocaleString("en-ZA")} of{" "}
            {report.pagination.totalPages.toLocaleString("en-ZA")}
          </span>
          <div>
            <button
              type="button"
              disabled={!report.pagination.hasPreviousPage || loading}
              onClick={() =>
                void loadReport({
                  ...filters,
                  page: Math.max(1, report.pagination.page - 1),
                  focusAssetId: "",
                })
              }
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!report.pagination.hasNextPage || loading}
              onClick={() =>
                void loadReport({
                  ...filters,
                  page: report.pagination.page + 1,
                  focusAssetId: "",
                })
              }
            >
              Next
            </button>
          </div>
        </footer>
      </section>

      {activityTarget ? (
        <div className={styles.modalLayer}>
          <button
            type="button"
            className={styles.backdrop}
            tabIndex={-1}
            aria-label="Close Discovery viewer summary"
            onClick={closeActivityModal}
          />
          <section
            ref={activityModalRef}
            className={styles.activityModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-discovery-viewer-summary-title"
            tabIndex={-1}
          >
            <header className={styles.activityModalHeader}>
              <div>
                <h2 id="admin-discovery-viewer-summary-title">
                  Viewer summary — {activityTarget.title}
                </h2>
              </div>
              <button
                type="button"
                className={styles.modalCloseButton}
                aria-label="Close Discovery viewer summary"
                onClick={closeActivityModal}
              >
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
                <button type="button" onClick={() => void loadActivity(activityTarget, 1)}>
                  Try again
                </button>
              </div>
            ) : null}

            {activityDetails ? (
              <div className={styles.activityBody}>
                <section className={styles.activitySummary} aria-label="Discovery viewer activity summary">
                  <article><strong>{activityDetails.totalViews}</strong><span>Total views</span></article>
                  <article><strong>{activityDetails.accountViews}</strong><span>Account views</span></article>
                  <article><strong>{activityDetails.unknownViews}</strong><span>Unknown views</span></article>
                  <article><strong>{activityDetails.uniqueViewers}</strong><span>Different viewers</span></article>
                </section>

                {activityDetails.repeatViewers > 0 ? (
                  <aside className={styles.repeatBanner}>
                    <strong>
                      Repeat interest: {activityDetails.repeatViewers} {activityDetails.repeatViewers === 1 ? "viewer" : "viewers"} with 3+ views
                    </strong>
                  </aside>
                ) : null}

                <section className={styles.viewerSection}>
                  <div className={styles.activityHeading}>
                    <h3>Viewer summary</h3>
                  </div>
                  {activityDetails.viewerGroups.length ? (
                    <div className={styles.viewerList}>
                      {activityDetails.viewerGroups.map((viewer) => (
                        <article key={viewer.viewerKey} className={viewer.hasRepeatInterest ? styles.viewerFlagged : undefined}>
                          <span className={styles.viewerAvatar} aria-hidden="true">
                            {viewer.viewerKind === "account" ? "A" : "?"}
                          </span>
                          <div>
                            <strong>{viewer.viewerLabel}</strong>
                            <span>
                              {viewer.viewerKind === "account"
                                ? `${formatAccountType(viewer.viewerAccountType)}${viewer.viewerEmail ? ` · ${viewer.viewerEmail}` : ""}`
                                : "Unknown viewer"}
                            </span>
                            <small>Last viewed {formatDateTime(viewer.lastViewedAtIso)}</small>
                          </div>
                          <div className={styles.viewerCount}>
                            {viewer.hasRepeatInterest ? <em>Repeat interest</em> : null}
                            <strong>{viewer.viewCount}</strong>
                            <span>{viewer.viewCount === 1 ? "view" : "views"}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.activityEmpty}>
                      <strong>No recorded views yet</strong>
                    </div>
                  )}
                </section>

                <section className={styles.timelineSection}>
                  <div className={styles.activityHeading}>
                    <h3>View timeline</h3>
                  </div>
                  {activityDetails.events.length ? (
                    <div className={styles.timeline}>
                      {activityDetails.events.map((viewEvent) => (
                        <article key={viewEvent.id}>
                          <span className={styles.timelineDot} aria-hidden="true" />
                          <div>
                            <strong>{viewEvent.viewerLabel}</strong>
                            <span>
                              {viewEvent.viewerKind === "account"
                                ? `Aim4price ${formatAccountType(viewEvent.viewerAccountType)} account viewed this asset`
                                : "Unknown viewer viewed this asset"}
                            </span>
                          </div>
                          <time dateTime={viewEvent.viewedAtIso}>{formatDateTime(viewEvent.viewedAtIso)}</time>
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
                      {activityBusy ? "Loading older views…" : "Load older views"}
                    </button>
                  ) : null}
                </section>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {selectedAsset ? (
        <div className={styles.modalLayer}>
          <button
            type="button"
            className={styles.backdrop}
            tabIndex={-1}
            aria-label="Close asset details"
            onClick={() => {
              if (!openingOwnerId) setSelectedAsset(null);
            }}
          />
          <section
            ref={detailsRef}
            className={styles.detailsModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-discovery-asset-title"
            tabIndex={-1}
          >
            <header className={styles.modalHeader}>
              <div>
                <h2 id="admin-discovery-asset-title">{selectedAsset.title}</h2>
              </div>
              <button
                type="button"
                aria-label="Close asset details"
                onClick={() => {
                  if (!openingOwnerId) setSelectedAsset(null);
                }}
              >
                ×
              </button>
            </header>

            <section className={styles.ownerHero}>
              <div>
                <h3>
                  {selectedAsset.owner.label} · {selectedAsset.owner.discoveryParticipationEnabled ? "Enabled" : "Admin only"}
                </h3>
              </div>
            </section>

            <div className={styles.detailColumns}>
              <section>
                <h3>Owner and account</h3>
                <dl>
                  <div><dt>Name</dt><dd>{selectedAsset.owner.name || "Not saved"}</dd></div>
                  <div><dt>Email</dt><dd>{selectedAsset.owner.email || "Not saved"}</dd></div>
                  <div><dt>Phone</dt><dd>{selectedAsset.owner.phone || "Not saved"}</dd></div>
                  <div><dt>Business</dt><dd>{selectedAsset.owner.businessName || "Not saved"}</dd></div>
                  <div><dt>Account</dt><dd>{titleCase(selectedAsset.owner.accountType)} · {titleCase(selectedAsset.owner.accountSubtype || "Not specified")}</dd></div>
                  <div><dt>Status</dt><dd>{titleCase(selectedAsset.owner.accountStatus)}</dd></div>
                  <div><dt>Town / city</dt><dd>{selectedAsset.owner.townCity || "Not saved"}</dd></div>
                  <div><dt>Province</dt><dd>{selectedAsset.owner.province || "Not saved"}</dd></div>
                  <div>
                    <dt>Address</dt>
                    <dd>{[selectedAsset.owner.addressLine1, selectedAsset.owner.addressLine2].filter(Boolean).join(", ") || "Not saved"}</dd>
                  </div>
                </dl>
              </section>
              <section>
                <h3>Asset record</h3>
                <dl>
                  <div><dt>Type</dt><dd>{assetIdentity(selectedAsset)}</dd></div>
                  <div><dt>Sector</dt><dd>{selectedAsset.sectorLabel}</dd></div>
                  <div>
                    <dt>Value</dt>
                    <dd>
                      {formatAdminAssetValue(selectedAsset)}
                      {selectedAsset.hasSavedValue ? " excl. VAT" : ""}
                    </dd>
                  </div>
                  <div><dt>Register</dt><dd>{selectedAsset.registerLabel}</dd></div>
                  <div><dt>Serial</dt><dd>{selectedAsset.serialNumber || "Not saved"}</dd></div>
                  <div><dt>Registration</dt><dd>{selectedAsset.registrationNumber || "Not saved"}</dd></div>
                  <div><dt>Public code</dt><dd>{selectedAsset.publicAssetCode || "Not saved"}</dd></div>
                  <div><dt>Condition</dt><dd>{titleCase(selectedAsset.condition || "Not saved")}</dd></div>
                  <div><dt>Usage</dt><dd>{formatUsage(selectedAsset)}</dd></div>
                  <div><dt>Lifecycle</dt><dd>{titleCase(selectedAsset.lifecycleState)}</dd></div>
                  <div><dt>GPS text</dt><dd>{selectedAsset.lastKnownLocationText || "Not saved"}</dd></div>
                  <div><dt>Last scanned</dt><dd>{formatDate(selectedAsset.lastScannedAtIso)}</dd></div>
                </dl>
              </section>
            </div>

            {error ? <p className={styles.modalError}>{error}</p> : null}

            <footer className={styles.modalActions}>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => void openOwnerAccount(selectedAsset)}
                disabled={openingOwnerId === selectedAsset.ownerUserId}
              >
                {openingOwnerId === selectedAsset.ownerUserId ? "Opening…" : "Open owner account"}
              </button>
              <Link href={`/admin/asset-map?assetId=${encodeURIComponent(selectedAsset.id)}`}>
                View on global map
              </Link>
              {selectedAsset.owner.email ? (
                <a href={`mailto:${selectedAsset.owner.email}`}>Email owner</a>
              ) : null}
              {selectedAsset.owner.phone ? (
                <a href={`tel:${selectedAsset.owner.phone}`}>Call owner</a>
              ) : null}
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
