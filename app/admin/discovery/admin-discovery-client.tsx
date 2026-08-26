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
        <article className={styles.featuredMetric}>
          <span>Matching assets</span>
          <strong>{report.summary.totalAssets.toLocaleString("en-ZA")}</strong>
          <small>{activeFilterCount ? `${activeFilterCount} active filters` : "All asset records"}</small>
        </article>
        <article>
          <span>Total Discovery views</span>
          <strong>{report.summary.totalViews.toLocaleString("en-ZA")}</strong>
          <small>
            {report.summary.accountViews.toLocaleString("en-ZA")} account · {report.summary.unknownViews.toLocaleString("en-ZA")} unknown
          </small>
        </article>
        <article>
          <span>Assets viewed</span>
          <strong>{report.summary.viewedAssets.toLocaleString("en-ZA")}</strong>
          <small>Assets opened in protected Discovery</small>
        </article>
        <article className={report.summary.repeatInterestAssets ? styles.signalMetric : undefined}>
          <span>Repeat interest</span>
          <strong>{report.summary.repeatInterestAssets.toLocaleString("en-ZA")}</strong>
          <small>Flagged after 3 views by one viewer</small>
        </article>
        <article>
          <span>Matching value</span>
          <strong>{formatAdminAssetMoney(report.summary.totalValueExVat)}</strong>
          <small>
            Excl. VAT · {report.summary.missingValueAssets.toLocaleString("en-ZA")} missing
          </small>
        </article>
        <article>
          <span>Owner accounts</span>
          <strong>{report.summary.ownerAccounts.toLocaleString("en-ZA")}</strong>
          <small>{report.summary.discoveryEnabledAssets.toLocaleString("en-ZA")} enabled · {report.summary.discoveryDisabledAssets.toLocaleString("en-ZA")} admin only</small>
        </article>
      </section>

      <aside className={styles.privacyNote}>
        <strong>Admin-unlocked directory.</strong>
        <span>
          Owner contact details are available here without an enquiry. This does not change what customers can see
          in regular Discovery or override their public participation setting. Viewer identities and timestamps
          remain visible only to Admin; Discovery itself still requires an Aim4price account.
        </span>
      </aside>

      <section className={styles.discoveryCard}>
        <div className={styles.interestBar}>
          <div>
            <strong>Viewer interest</strong>
            <span>Find popular assets or isolate repeat attention from one account.</span>
          </div>
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
                {option === "repeat" ? <span>{report.summary.repeatInterestAssets}</span> : null}
              </button>
            ))}
          </div>
        </div>
        <header className={styles.filterHeader}>
          <div className={styles.filterTitle}>
            <p>Complete directory</p>
            <h2>All assets and owners</h2>
            <span>
              {report.pagination.totalItems
                ? `Showing ${(report.pagination.page - 1) * report.pagination.pageSize + 1}-${Math.min(
                    report.pagination.page * report.pagination.pageSize,
                    report.pagination.totalItems,
                  )} of ${report.pagination.totalItems.toLocaleString("en-ZA")}`
                : "No assets match the current filters"}
            </span>
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
                <span>Search assets + owners</span>
                <input
                  type="search"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Name, email, phone, asset, serial or registration"
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
                <option value="all">Enabled + disabled</option>
                <option value="enabled">Discovery enabled</option>
                <option value="disabled">Admin-only / disabled</option>
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
                <option value="all">Mapped + missing</option>
                <option value="mapped">Mapped only</option>
                <option value="missing">Missing GPS only</option>
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
            <button
              type="button"
              className={styles.clearButton}
              onClick={clearFilters}
              disabled={!activeFilterCount || loading}
            >
              Clear filters
            </button>
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
                <th>Email</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Value</th>
                <th>Identifiers</th>
                <th>Viewer interest</th>
                <th>Discovery</th>
                <th>GPS</th>
                <th>Updated</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {report.assets.map((asset) => {
                const mapped = hasAdminAssetCoordinates(asset);
                return (
                  <tr key={asset.id}>
                    <td>
                      <strong>{asset.title}</strong>
                      <span>{assetIdentity(asset)}</span>
                      <small>{asset.sectorLabel} · {titleCase(asset.lifecycleState)}</small>
                    </td>
                    <td>
                      <strong>{asset.owner.label}</strong>
                      <span>{asset.owner.name || "Name not saved"}</span>
                      <small>{titleCase(asset.owner.accountType)} · {titleCase(asset.owner.accountStatus)}</small>
                    </td>
                    <td>
                      {asset.owner.email ? (
                        <a href={`mailto:${asset.owner.email}`}>{asset.owner.email}</a>
                      ) : (
                        <span>Not saved</span>
                      )}
                    </td>
                    <td>
                      {asset.owner.phone ? (
                        <a href={`tel:${asset.owner.phone}`}>{asset.owner.phone}</a>
                      ) : (
                        <span>Not saved</span>
                      )}
                    </td>
                    <td>
                      <strong>{asset.owner.townCity || "Town not saved"}</strong>
                      <span>{asset.owner.province || "Province not saved"}</span>
                    </td>
                    <td className={styles.moneyCell}>{formatAdminAssetValue(asset)}</td>
                    <td>
                      <strong>{asset.serialNumber || "No serial"}</strong>
                      <span>{asset.registrationNumber || asset.publicAssetCode || "No registration"}</span>
                    </td>
                    <td className={styles.interestCell}>
                      {asset.totalViews > 0 ? (
                        <>
                          <strong>{asset.totalViews.toLocaleString("en-ZA")} {asset.totalViews === 1 ? "view" : "views"}</strong>
                          <span>{asset.accountViews.toLocaleString("en-ZA")} account · {asset.unknownViews.toLocaleString("en-ZA")} unknown</span>
                          <small>Last opened {formatDateTime(asset.lastViewedAtIso)}</small>
                          {asset.hasRepeatInterest ? (
                            <em className={styles.repeatFlag}>
                              <span aria-hidden="true">⚑</span>
                              {asset.repeatViewerLabel || "One viewer"} · {asset.repeatViewerViews} views
                            </em>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <strong>No views yet</strong>
                          <span>Tracking starts with protected detail opens</span>
                        </>
                      )}
                      <button
                        type="button"
                        className={styles.activityButton}
                        onClick={(event) => openActivityModal(asset, event.currentTarget)}
                      >
                        Viewer summary
                      </button>
                    </td>
                    <td>
                      <span
                        className={
                          asset.owner.discoveryParticipationEnabled
                            ? styles.enabledBadge
                            : styles.disabledBadge
                        }
                      >
                        {asset.owner.discoveryParticipationEnabled ? "Enabled" : "Admin only"}
                      </span>
                    </td>
                    <td>
                      <span className={mapped ? styles.mappedBadge : styles.missingBadge}>
                        {mapped ? "Mapped" : "Missing"}
                      </span>
                    </td>
                    <td>{formatDate(asset.updatedAtIso)}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.viewButton}
                        onClick={(event) => openDetails(asset, event.currentTarget)}
                      >
                        View details
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
              <span>Change or clear the filters to widen this Admin Discovery result.</span>
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
                <h2 id="admin-discovery-viewer-summary-title">Viewer summary</h2>
                <p>Who viewed {activityTarget.title}, and when?</p>
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
                    <span aria-hidden="true">⚑</span>
                    <div>
                      <strong>Repeat interest detected</strong>
                      <p>
                        {activityDetails.repeatViewers} {activityDetails.repeatViewers === 1 ? "viewer has" : "viewers have"} opened this asset at least 3 times.
                      </p>
                    </div>
                  </aside>
                ) : null}

                <section className={styles.viewerSection}>
                  <div className={styles.activityHeading}>
                    <h3>Viewer summary</h3>
                    <span>Grouped by Aim4price account or unknown viewer</span>
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
                            {viewer.hasRepeatInterest ? <em><span aria-hidden="true">⚑</span> Flagged</em> : null}
                            <strong>{viewer.viewCount}</strong>
                            <span>{viewer.viewCount === 1 ? "view" : "views"}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.activityEmpty}>
                      <strong>No recorded views yet</strong>
                      <span>This asset has not been opened since Discovery view tracking started.</span>
                    </div>
                  )}
                </section>

                <section className={styles.timelineSection}>
                  <div className={styles.activityHeading}>
                    <h3>View timeline</h3>
                    <span>Successful protected detail opens, newest first</span>
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
                <p>{selectedAsset.assetTypeLabel} · {selectedAsset.sectorLabel}</p>
                <h2 id="admin-discovery-asset-title">{selectedAsset.title}</h2>
                <span>{assetIdentity(selectedAsset)}</span>
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
                <p>Owner details · Admin unlocked</p>
                <h3>{selectedAsset.owner.label}</h3>
                <span>{selectedAsset.owner.name || "Owner name not saved"}</span>
              </div>
              <span
                className={
                  selectedAsset.owner.discoveryParticipationEnabled
                    ? styles.enabledBadge
                    : styles.disabledBadge
                }
              >
                {selectedAsset.owner.discoveryParticipationEnabled
                  ? "Discovery enabled"
                  : "Discovery disabled · Admin only"}
              </span>
            </section>

            <div className={styles.detailColumns}>
              <section>
                <h3>Owner and account</h3>
                <dl>
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
