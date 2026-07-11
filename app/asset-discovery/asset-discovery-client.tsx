"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import dealerStyles from "../dealer/dealer.module.css";

type EnquiryStatus = "pending" | "approved" | "temporarily_denied";

type AssetDiscoveryAsset = {
  id: string;
  type: string;
  brand: string;
  model: string;
  year: string;
  usage: string;
  condition: string;
  province: string;
  enquiryId: string | null;
  enquiryStatus: EnquiryStatus | null;
  requestAgainAtIso: string | null;
  approvedAtIso: string | null;
};

type Option = {
  value: string;
  label: string;
  count: number;
};

type DiscoverySummary = {
  totalAssets: number;
  typeCount: number;
  provinceCount: number;
};

type DiscoveryPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type ListResponse = {
  ok: boolean;
  assets?: AssetDiscoveryAsset[];
  provinceOptions?: Option[];
  typeOptions?: Option[];
  summary?: DiscoverySummary;
  pagination?: DiscoveryPagination;
  error?: string;
};

type EnquiryResponse = {
  ok: boolean;
  enquiry?: {
    id: string;
    status: EnquiryStatus;
    requestAgainAtIso: string | null;
    approvedAtIso?: string | null;
  };
  error?: string;
};

type Notice = {
  tone: "success" | "error";
  message: string;
};

type DiscoveryContact = {
  name: string;
  businessName: string;
  phone: string;
  email: string;
  location: string;
};

type DiscoveryEnquiryDetail = {
  id: string;
  ownerContact: DiscoveryContact | null;
  asset: {
    brand: string;
    model: string;
    year: string;
    usage: string;
    province: string;
  };
};

type IconProps = {
  className?: string;
};

type DiscoveryFilterKey = "type" | "province";

const SEARCH_DEBOUNCE_MS = 250;
const DISCOVERY_PAGE_SIZE = 10;
const DISCOVERY_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
type DiscoveryPageSize = (typeof DISCOVERY_PAGE_SIZE_OPTIONS)[number];

const EMPTY_SUMMARY: DiscoverySummary = {
  totalAssets: 0,
  typeCount: 0,
  provinceCount: 0,
};

const EMPTY_PAGINATION: DiscoveryPagination = {
  page: 1,
  pageSize: DISCOVERY_PAGE_SIZE,
  totalItems: 0,
  totalPages: 1,
  rangeStart: 0,
  rangeEnd: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

function SearchIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

function cleanText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(time));
}

function normalizeDiscoveryPageSize(value: string): DiscoveryPageSize {
  const numeric = Number(value);
  return (
    DISCOVERY_PAGE_SIZE_OPTIONS.find((option) => option === numeric) ??
    DISCOVERY_PAGE_SIZE
  );
}

function paginationPages(page: number, totalPages: number): number[] {
  const maxButtons = 5;
  const safeTotal = Math.max(1, totalPages);

  if (safeTotal <= maxButtons) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(page - 2, safeTotal - maxButtons + 1));
  return Array.from({ length: maxButtons }, (_, index) => start + index);
}

function isUnknown(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return !normalized || normalized === "unknown" || normalized === "not saved";
}

function assetDisplayName(asset: AssetDiscoveryAsset): string {
  const brand = cleanText(asset.brand);
  const model = cleanText(asset.model);
  const brandUnknown = isUnknown(brand);
  const modelUnknown = isUnknown(model);

  if (!brandUnknown && !modelUnknown) {
    return brand.toLowerCase() === model.toLowerCase()
      ? brand
      : `${brand} ${model}`;
  }

  if (!brandUnknown) return brand;
  if (!modelUnknown) return `Unknown ${model}`;
  return "Unknown asset";
}

function dealerAssetDisplayName(asset: AssetDiscoveryAsset): string {
  const year = cleanText(asset.year);
  const name = assetDisplayName(asset);
  return !isUnknown(year) ? `${year} ${name}` : name;
}

function dealerAssetMeta(asset: AssetDiscoveryAsset): string {
  const details = [
    `Year Model: ${cleanText(asset.year) || "Unknown"}`,
    `Usage: ${cleanText(asset.usage) || "Unknown"}`,
    `Condition: ${cleanText(asset.condition) || "Unknown"}`,
    `Family: ${cleanText(asset.type) || "Unknown"}`,
  ];

  return details.join(" • ");
}

function temporaryDenialExpired(asset: AssetDiscoveryAsset): boolean {
  if (asset.enquiryStatus !== "temporarily_denied" || !asset.requestAgainAtIso)
    return false;
  const retryTime = Date.parse(asset.requestAgainAtIso);
  return Number.isFinite(retryTime) && retryTime <= Date.now();
}

function statusPillLabel(asset: AssetDiscoveryAsset): string {
  if (asset.enquiryStatus === "approved") return "Unlocked";
  if (asset.enquiryStatus === "pending") return "Pending request";
  if (
    asset.enquiryStatus === "temporarily_denied" &&
    !temporaryDenialExpired(asset)
  )
    return "Temporarily denied";
  return "";
}

function statusDescription(asset: AssetDiscoveryAsset): string {
  if (asset.enquiryStatus === "approved") return "Approved by owner.";
  if (asset.enquiryStatus === "pending") return "Waiting for owner approval.";
  if (
    asset.enquiryStatus === "temporarily_denied" &&
    !temporaryDenialExpired(asset)
  ) {
    const retryDate = formatDate(asset.requestAgainAtIso);
    return retryDate
      ? `Temporarily denied. Available again after ${retryDate}.`
      : "Temporarily denied.";
  }

  return "";
}

function statusClassName(asset: AssetDiscoveryAsset): string {
  if (asset.enquiryStatus === "pending")
    return `${styles.statusPill} ${styles.statusPillWarning}`;
  if (
    asset.enquiryStatus === "temporarily_denied" &&
    !temporaryDenialExpired(asset)
  )
    return `${styles.statusPill} ${styles.statusPillDanger}`;
  return `${styles.statusPill} ${styles.unlockedPill}`;
}

function canEnquire(asset: AssetDiscoveryAsset): boolean {
  if (!asset.enquiryStatus) return true;
  return (
    asset.enquiryStatus === "temporarily_denied" &&
    temporaryDenialExpired(asset)
  );
}

export default function AssetDiscoveryClient({ dealerAppMode = false }: { dealerAppMode?: boolean } = {}) {
  const [assets, setAssets] = useState<AssetDiscoveryAsset[]>([]);
  const [provinceOptions, setProvinceOptions] = useState<Option[]>([]);
  const [typeOptions, setTypeOptions] = useState<Option[]>([]);
  const [summary, setSummary] = useState<DiscoverySummary>(EMPTY_SUMMARY);
  const [pagination, setPagination] =
    useState<DiscoveryPagination>(EMPTY_PAGINATION);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("all");
  const [type, setType] = useState("all");
  const [openFilter, setOpenFilter] = useState<DiscoveryFilterKey | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<DiscoveryPageSize>(DISCOVERY_PAGE_SIZE);
  const [processingAssetIds, setProcessingAssetIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activeEnquiry, setActiveEnquiry] =
    useState<DiscoveryEnquiryDetail | null>(null);
  const [loadingEnquiryId, setLoadingEnquiryId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!activeEnquiry) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveEnquiry(null);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeEnquiry]);

  useEffect(() => {
    if (!openFilter) return undefined;

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-discovery-filter="true"]')) {
        setOpenFilter(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFilter(null);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openFilter]);

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (province !== "all") params.set("province", province);
    if (type !== "all") params.set("type", type);
    params.set("page", String(currentPage));
    params.set("pageSize", String(pageSize));

    async function loadAssets() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/asset-discovery?${params.toString()}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );
        const data = (await response.json()) as ListResponse;

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Failed to load Asset Discovery.");
        }

        if (!mounted) return;
        setAssets(Array.isArray(data.assets) ? data.assets : []);
        setProvinceOptions(
          Array.isArray(data.provinceOptions) ? data.provinceOptions : [],
        );
        setTypeOptions(Array.isArray(data.typeOptions) ? data.typeOptions : []);
        setSummary(data.summary ?? EMPTY_SUMMARY);
        setPagination(data.pagination ?? EMPTY_PAGINATION);
        if (data.pagination && data.pagination.page !== currentPage) {
          setCurrentPage(data.pagination.page);
        }
      } catch (loadError) {
        if (!mounted) return;
        setAssets([]);
        setSummary(EMPTY_SUMMARY);
        setPagination(EMPTY_PAGINATION);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load Asset Discovery.",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadAssets();

    return () => {
      mounted = false;
    };
  }, [currentPage, pageSize, province, search, type]);

  const visiblePaginationPages = useMemo(
    () => paginationPages(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages],
  );

  function handleSearchChange(value: string) {
    setSearchInput(value);
  }

  function handleTypeChange(value: string) {
    setType(value);
    setCurrentPage(1);
  }

  function handleProvinceChange(value: string) {
    setProvince(value);
    setCurrentPage(1);
  }

  function renderDealerFilter(
    filterKey: DiscoveryFilterKey,
    value: string,
    options: Option[],
    allLabel: string,
    ariaLabel: string,
    onChange: (nextValue: string) => void,
  ) {
    const isOpen = openFilter === filterKey;
    const selectedOption = options.find((option) => option.value === value);
    const selectedLabel = selectedOption
      ? `${selectedOption.label} (${selectedOption.count})`
      : allLabel;

    return (
      <div
        className={`${styles.customFilter} ${isOpen ? styles.customFilterOpen : ""}`}
        data-discovery-filter="true"
      >
        <button
          type="button"
          className={styles.customFilterButton}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() =>
            setOpenFilter((current) => (current === filterKey ? null : filterKey))
          }
        >
          <span>{selectedLabel}</span>
          <ChevronDownIcon className={styles.customFilterChevron} />
        </button>

        {isOpen ? (
          <div className={styles.customFilterMenu} role="listbox" aria-label={ariaLabel}>
            <button
              type="button"
              className={`${styles.customFilterOption} ${value === "all" ? styles.customFilterOptionSelected : ""}`}
              role="option"
              aria-selected={value === "all"}
              onClick={() => {
                onChange("all");
                setOpenFilter(null);
              }}
            >
              <span>{allLabel}</span>
              {value === "all" ? <strong>✓</strong> : null}
            </button>
            {options.map((option) => {
              const isSelected = value === option.value;
              return (
                <button
                  type="button"
                  key={`${filterKey}-${option.value}`}
                  className={`${styles.customFilterOption} ${isSelected ? styles.customFilterOptionSelected : ""}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setOpenFilter(null);
                  }}
                >
                  <span>{option.label}</span>
                  <small>{option.count}</small>
                  {isSelected ? <strong>✓</strong> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  function handlePageSizeChange(value: string) {
    setPageSize(normalizeDiscoveryPageSize(value));
    setCurrentPage(1);
  }

  function goToPage(nextPage: number) {
    const safePage = Math.min(Math.max(1, nextPage), pagination.totalPages);
    setCurrentPage(safePage);
  }

  async function handleEnquire(asset: AssetDiscoveryAsset) {
    if (!canEnquire(asset) || processingAssetIds.has(asset.id)) return;

    setNotice(null);
    setProcessingAssetIds((current) => new Set(current).add(asset.id));

    try {
      const response = await fetch("/api/asset-discovery", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId: asset.id,
          message: "",
        }),
      });
      const data = (await response.json()) as EnquiryResponse;

      if (!response.ok || !data.ok || !data.enquiry) {
        throw new Error(data.error || "Failed to send enquiry.");
      }

      setAssets((current) =>
        current.map((item) =>
          item.id === asset.id
            ? {
                ...item,
                enquiryId: data.enquiry?.id ?? item.enquiryId,
                enquiryStatus: data.enquiry?.status ?? item.enquiryStatus,
                requestAgainAtIso:
                  data.enquiry?.requestAgainAtIso ?? item.requestAgainAtIso,
                approvedAtIso:
                  data.enquiry?.approvedAtIso ?? item.approvedAtIso,
              }
            : item,
        ),
      );
      setNotice({
        tone: "success",
        message: "Enquiry sent. Waiting for owner approval.",
      });
    } catch (submitError) {
      setNotice({
        tone: "error",
        message:
          submitError instanceof Error
            ? submitError.message
            : "Failed to send enquiry.",
      });
    } finally {
      setProcessingAssetIds((current) => {
        const next = new Set(current);
        next.delete(asset.id);
        return next;
      });
    }
  }

  async function openApprovedContact(asset: AssetDiscoveryAsset) {
    if (!asset.enquiryId || loadingEnquiryId) return;
    setLoadingEnquiryId(asset.enquiryId);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/asset-discovery/enquiries/${encodeURIComponent(asset.enquiryId)}`,
        { credentials: "include", cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        enquiry?: DiscoveryEnquiryDetail;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok || !payload.enquiry) {
        throw new Error(payload?.error || "Failed to open the approved contact.");
      }

      setActiveEnquiry(payload.enquiry);
    } catch (cause) {
      setNotice({
        tone: "error",
        message:
          cause instanceof Error
            ? cause.message
            : "Failed to open the approved contact.",
      });
    } finally {
      setLoadingEnquiryId(null);
    }
  }

  function renderEnquiryControl(asset: AssetDiscoveryAsset) {
    const pillLabel = statusPillLabel(asset);
    const isProcessing = processingAssetIds.has(asset.id);

    if (asset.enquiryStatus === "approved" && asset.enquiryId) {
      return (
        <button
          type="button"
          className={`${styles.primaryButton} ${styles.enquireButton}`}
          onClick={() => void openApprovedContact(asset)}
          disabled={loadingEnquiryId === asset.enquiryId}
        >
          {loadingEnquiryId === asset.enquiryId ? "Opening..." : "Open contact"}
        </button>
      );
    }

    if (pillLabel) {
      return (
        <span
          className={statusClassName(asset)}
          title={statusDescription(asset)}
        >
          {pillLabel}
        </span>
      );
    }

    return (
      <button
        type="button"
        className={`${styles.primaryButton} ${styles.enquireButton}`}
        onClick={() => handleEnquire(asset)}
        disabled={isProcessing}
      >
        {isProcessing ? "Sending..." : "Enquire"}
      </button>
    );
  }

  function renderPagination() {
    if (!pagination.totalItems) return null;

    const hasMultiplePages = pagination.totalPages > 1;
    const shouldShowPageSizeSelector =
      pagination.totalItems > DISCOVERY_PAGE_SIZE_OPTIONS[0];

    if (!hasMultiplePages && !shouldShowPageSizeSelector) return null;

    return (
      <nav
        className={styles.discoveryPagination}
        aria-label="Asset Discovery pagination"
      >
        <div className={styles.discoveryPaginationInfo}>
          <div className={styles.discoveryPaginationSummary}>
            Showing <strong>{pagination.rangeStart}</strong>-
            <strong>{pagination.rangeEnd}</strong> of{" "}
            <strong>{pagination.totalItems}</strong> assets
            {hasMultiplePages ? (
              <>
                <span className={styles.discoveryPaginationDivider}>·</span>
                Page <strong>{pagination.page}</strong> of{" "}
                <strong>{pagination.totalPages}</strong>
              </>
            ) : null}
          </div>

          {shouldShowPageSizeSelector ? (
            <label className={styles.discoveryPageSizeField}>
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(event) => handlePageSizeChange(event.target.value)}
                disabled={loading}
                aria-label="Assets per page"
              >
                {DISCOVERY_PAGE_SIZE_OPTIONS.map((option) => (
                  <option
                    key={`asset-discovery-page-size-${option}`}
                    value={option}
                  >
                    {option}
                  </option>
                ))}
              </select>
              <span>per page</span>
            </label>
          ) : null}
        </div>

        {hasMultiplePages ? (
          <div className={styles.discoveryPaginationControls}>
            <button
              type="button"
              className={styles.discoveryPaginationButton}
              onClick={() => goToPage(pagination.page - 1)}
              disabled={!pagination.hasPreviousPage || loading}
            >
              Previous
            </button>
            <div className={styles.discoveryPaginationPages}>
              {visiblePaginationPages.map((page) => (
                <button
                  type="button"
                  key={`asset-discovery-page-${page}`}
                  className={`${styles.discoveryPaginationPageButton} ${page === pagination.page ? styles.discoveryPaginationPageButtonActive : ""}`}
                  onClick={() => goToPage(page)}
                  disabled={loading}
                  aria-current={page === pagination.page ? "page" : undefined}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.discoveryPaginationButton}
              onClick={() => goToPage(pagination.page + 1)}
              disabled={!pagination.hasNextPage || loading}
            >
              Next
            </button>
          </div>
        ) : null}
      </nav>
    );
  }

  return (
    <section className={`${styles.shell} ${dealerAppMode ? dealerStyles.dealerDiscoverySurface : ""}`}>
      <div className={styles.heroPanel}>
        <h1>ASSET DISCOVERY</h1>
      </div>

      <section
        className={styles.controlsPanel}
        aria-label="Asset Discovery controls"
      >
        {!dealerAppMode ? (
          <div
            className={styles.summaryGrid}
            aria-label="Asset Discovery summary"
          >
          <article className={styles.summaryCard}>
            <span>Available Assets</span>
            <strong>{summary.totalAssets}</strong>
            <small>Assets matching current filters.</small>
          </article>
          <article className={styles.summaryCard}>
            <span>Types</span>
            <strong>{summary.typeCount}</strong>
            <small>Asset types matching current filters.</small>
          </article>
          <article className={styles.summaryCard}>
            <span>Provinces</span>
            <strong>{summary.provinceCount}</strong>
            <small>Saved provinces represented.</small>
          </article>
          </div>
        ) : null}

        <section
          className={styles.toolbar}
          aria-label="Search and filter Asset Discovery"
        >
          <label className={styles.searchBox}>
            <SearchIcon className={styles.searchIcon} />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search by type, brand, model, year, usage, condition or province"
              aria-label="Search Asset Discovery"
            />
            {searchInput ? (
              <button
                type="button"
                className={styles.clearSearchButton}
                onClick={() => handleSearchChange("")}
                aria-label="Clear Discovery search"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            ) : null}
          </label>

          {renderDealerFilter(
            "type",
            type,
            typeOptions,
            "All types",
            "Filter by asset type",
            handleTypeChange,
          )}

          {renderDealerFilter(
            "province",
            province,
            provinceOptions,
            "All provinces",
            "Filter by province",
            handleProvinceChange,
          )}
        </section>
      </section>

      {notice ? (
        <div
          className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}
        >
          {notice.message}
        </div>
      ) : null}
      {error ? <div className={styles.errorPanel}>{error}</div> : null}

      <section className={styles.cardStack} aria-label="Asset Discovery assets">
        {loading ? (
          <div className={styles.emptyState}>Loading Asset Discovery...</div>
        ) : !error && assets.length ? (
          assets.map((asset) => {
            return (
              <article
                key={asset.id}
                className={`${styles.assetCard} ${styles.dealerAssetCard}`}
              >
                <div className={`${styles.assetCardHeader} ${styles.dealerAssetCardHeader}`}>
                  <div className={styles.assetIdentity}>
                    <h2>{dealerAssetDisplayName(asset)}</h2>
                    <p className={styles.dealerAssetMeta}>{dealerAssetMeta(asset)}</p>
                    <span className={styles.dealerAssetProvince}>
                      Province: {cleanText(asset.province) || "Not saved"}
                    </span>
                  </div>

                  <div className={styles.assetActionRow}>
                    {renderEnquiryControl(asset)}
                  </div>
                </div>
              </article>
            );
          })
        ) : !error ? (
          <div className={styles.emptyState}>
            No assets match this search or filter.
          </div>
        ) : null}
      </section>

      {renderPagination()}

      {activeEnquiry ? (
        <div
          className={dealerStyles.contactOverlay}
          onMouseDown={() => setActiveEnquiry(null)}
        >
          <section
            className={dealerStyles.contactModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dealer-discovery-contact-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={dealerStyles.contactHeader}>
              <div>
                <span>Approved contact</span>
                <h2 id="dealer-discovery-contact-title">
                  {[activeEnquiry.asset.brand, activeEnquiry.asset.model]
                    .filter(Boolean)
                    .join(" ") || "Asset owner"}
                </h2>
                <p>
                  {[activeEnquiry.asset.year, activeEnquiry.asset.usage, activeEnquiry.asset.province]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveEnquiry(null)}
                aria-label="Close approved contact"
              >
                ×
              </button>
            </header>

            {activeEnquiry.ownerContact ? (
              <div className={dealerStyles.contactGrid}>
                <div>
                  <span>Owner or business</span>
                  <strong>
                    {activeEnquiry.ownerContact.businessName ||
                      activeEnquiry.ownerContact.name ||
                      "Not supplied"}
                  </strong>
                </div>
                <div>
                  <span>Phone</span>
                  <strong>{activeEnquiry.ownerContact.phone || "Not supplied"}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{activeEnquiry.ownerContact.email || "Not supplied"}</strong>
                </div>
                <div>
                  <span>Location</span>
                  <strong>{activeEnquiry.ownerContact.location || "Not supplied"}</strong>
                </div>
              </div>
            ) : (
              <p className={dealerStyles.contactEmpty}>
                The owner has approved the enquiry, but contact information has not been supplied.
              </p>
            )}

            <div className={dealerStyles.contactActions}>
              {activeEnquiry.ownerContact?.phone ? (
                <a href={`tel:${activeEnquiry.ownerContact.phone}`}>Call owner</a>
              ) : null}
              {activeEnquiry.ownerContact?.email ? (
                <a href={`mailto:${activeEnquiry.ownerContact.email}`}>Email owner</a>
              ) : null}
              <button type="button" onClick={() => setActiveEnquiry(null)}>Close</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
