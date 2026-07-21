"use client";

import { useEffect, useMemo, useState } from "react";
import {
  WorkspaceTitlePanel,
  workspaceStyles,
} from "../../components/WorkspacePrimitives";
import assetStyles from "../asset-register/page.module.css";
import leadStyles from "../leads/page.module.css";
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
  status: EnquiryStatus;
  approvedAtIso: string | null;
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

type DiscoveryFilterKey = "type" | "province" | "pageSize";

type DiscoveryFilterOption = {
  value: string;
  label: string;
};

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

function FilterIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

function RefreshIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M20 11a8 8 0 0 0-14.7-4.3L4 8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4 13a8 8 0 0 0 14.7 4.3L20 16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 20v-4h-4" strokeLinecap="round" strokeLinejoin="round" />
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

function DiscoveryFilterDropdown({
  label,
  filterKey,
  value,
  options,
  openFilter,
  onOpenChange,
  onChange,
}: {
  label: string;
  filterKey: DiscoveryFilterKey;
  value: string;
  options: DiscoveryFilterOption[];
  openFilter: DiscoveryFilterKey | null;
  onOpenChange: (filter: DiscoveryFilterKey | null) => void;
  onChange: (value: string) => void;
}) {
  const isOpen = openFilter === filterKey;
  const selectedOption = options.find((option) => option.value === value);

  return (
    <label
      className={`${assetStyles.field} ${leadStyles.leadFilterField} ${isOpen ? leadStyles.leadFilterFieldOpen : ""}`}
      data-discovery-filter="true"
    >
      <span>{label}</span>
      <div className={leadStyles.leadFilterDropdown}>
        <button
          type="button"
          className={`${leadStyles.leadFilterSelectButton} ${isOpen ? leadStyles.leadFilterSelectButtonOpen : ""}`}
          onClick={() => onOpenChange(isOpen ? null : filterKey)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span>{selectedOption?.label ?? "Choose option"}</span>
          <ChevronDownIcon className={leadStyles.leadFilterSelectIcon} />
        </button>

        {isOpen ? (
          <div
            className={leadStyles.leadFilterSelectMenu}
            role="listbox"
            aria-label={label}
          >
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  type="button"
                  key={`${filterKey}-${option.value}`}
                  className={`${leadStyles.leadFilterSelectOption} ${isSelected ? leadStyles.leadFilterSelectOptionActive : ""}`}
                  onClick={() => {
                    onChange(option.value);
                    onOpenChange(null);
                  }}
                  role="option"
                  aria-selected={isSelected}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </label>
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

function contactAccessExpiry(value: string | null | undefined): string {
  if (!value) return "";
  const approvedAt = new Date(value);
  if (!Number.isFinite(approvedAt.getTime())) return "";
  approvedAt.setMonth(approvedAt.getMonth() + 3);
  return formatDate(approvedAt.toISOString());
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
  return assetDisplayName(asset);
}

function dealerAssetMeta(asset: AssetDiscoveryAsset): string {
  const details = [
    cleanText(asset.year) || "Year unknown",
    cleanText(asset.usage) || "Usage unknown",
    cleanText(asset.condition) || "Condition unknown",
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
  if (asset.enquiryStatus === "approved") return "Contact open";
  if (asset.enquiryStatus === "pending") return "Enquiry pending";
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

function enquiryPriority(asset: AssetDiscoveryAsset): number {
  if (asset.enquiryStatus === "approved") return 0;
  if (asset.enquiryStatus === "pending") return 1;
  return 2;
}

function sortAssetsByEnquiryPriority(
  assets: AssetDiscoveryAsset[],
): AssetDiscoveryAsset[] {
  return assets
    .map((asset, index) => ({ asset, index }))
    .sort(
      (left, right) =>
        enquiryPriority(left.asset) - enquiryPriority(right.asset) ||
        left.index - right.index,
    )
    .map(({ asset }) => asset);
}

function assetCardStatusClass(asset: AssetDiscoveryAsset): string {
  if (asset.enquiryStatus === "approved") return styles.dealerAssetCardOpen;
  if (asset.enquiryStatus === "pending") return styles.dealerAssetCardPending;
  return "";
}

function leadParityAssetCardStatusClass(asset: AssetDiscoveryAsset): string {
  if (asset.enquiryStatus === "approved") return leadStyles.leadThreadDone;
  if (asset.enquiryStatus === "pending") return leadStyles.leadThreadActive;
  return leadStyles.leadThreadNew;
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
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<DiscoveryPageSize>(DISCOVERY_PAGE_SIZE);
  const [refreshVersion, setRefreshVersion] = useState(0);
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
    if (!isFilterModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenFilter(null);
        setIsFilterModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFilterModalOpen]);

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
  }, [currentPage, pageSize, province, refreshVersion, search, type]);

  const visiblePaginationPages = useMemo(
    () => paginationPages(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages],
  );

  const typeFilterOptions = useMemo<DiscoveryFilterOption[]>(
    () => [
      { value: "all", label: "All types" },
      ...typeOptions.map((option) => ({
        value: option.value,
        label: `${option.label} (${option.count})`,
      })),
    ],
    [typeOptions],
  );

  const provinceFilterOptions = useMemo<DiscoveryFilterOption[]>(
    () => [
      { value: "all", label: "All provinces" },
      ...provinceOptions.map((option) => ({
        value: option.value,
        label: `${option.label} (${option.count})`,
      })),
    ],
    [provinceOptions],
  );

  const pageSizeFilterOptions = useMemo<DiscoveryFilterOption[]>(
    () =>
      DISCOVERY_PAGE_SIZE_OPTIONS.map((option) => ({
        value: String(option),
        label: `${option} assets per page`,
      })),
    [],
  );

  const hasActiveDiscoveryFilter =
    type !== "all" ||
    province !== "all" ||
    pageSize !== DISCOVERY_PAGE_SIZE;

  const activeDiscoveryFilterLabel = useMemo(() => {
    const labels: string[] = [];
    const selectedType = typeOptions.find((option) => option.value === type);
    const selectedProvince = provinceOptions.find(
      (option) => option.value === province,
    );

    if (selectedType) labels.push(selectedType.label);
    if (selectedProvince) labels.push(selectedProvince.label);
    if (pageSize !== DISCOVERY_PAGE_SIZE) labels.push(`${pageSize} per page`);

    if (!labels.length) return "Filter";
    if (labels.length === 1) return labels[0];
    return `${labels.length} filters`;
  }, [pageSize, province, provinceOptions, type, typeOptions]);

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

  function openDiscoveryFilterModal() {
    setOpenFilter(null);
    setIsFilterModalOpen(true);
  }

  function closeDiscoveryFilterModal() {
    setOpenFilter(null);
    setIsFilterModalOpen(false);
  }

  function resetDiscoveryFilters() {
    setType("all");
    setProvince("all");
    setPageSize(DISCOVERY_PAGE_SIZE);
    setCurrentPage(1);
    setOpenFilter(null);
  }

  function refreshAssets() {
    setRefreshVersion((current) => current + 1);
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
        sortAssetsByEnquiryPriority(
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

  async function handleRetractEnquiry(asset: AssetDiscoveryAsset) {
    if (
      asset.enquiryStatus !== "pending" ||
      !asset.enquiryId ||
      processingAssetIds.has(asset.id)
    ) {
      return;
    }

    setNotice(null);
    setProcessingAssetIds((current) => new Set(current).add(asset.id));

    try {
      const response = await fetch(
        `/api/asset-discovery/enquiries/${encodeURIComponent(asset.enquiryId)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to retract enquiry.");
      }

      setAssets((current) =>
        sortAssetsByEnquiryPriority(
          current.map((item) =>
            item.id === asset.id
              ? {
                  ...item,
                  enquiryId: null,
                  enquiryStatus: null,
                  requestAgainAtIso: null,
                  approvedAtIso: null,
                }
              : item,
          ),
        ),
      );
      setNotice({
        tone: "success",
        message: "Enquiry retracted.",
      });
    } catch (retractError) {
      setNotice({
        tone: "error",
        message:
          retractError instanceof Error
            ? retractError.message
            : "Failed to retract enquiry.",
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
          className={
            dealerAppMode
              ? `${styles.primaryButton} ${styles.enquireButton}`
              : `${assetStyles.primaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${leadStyles.openLeadButton} ${styles.discoveryPrimaryAction}`
          }
          onClick={() => void openApprovedContact(asset)}
          disabled={loadingEnquiryId === asset.enquiryId}
        >
          {loadingEnquiryId === asset.enquiryId ? "Opening..." : "Open contact"}
        </button>
      );
    }

    if (asset.enquiryStatus === "pending" && asset.enquiryId) {
      return (
        <button
          type="button"
          className={
            dealerAppMode
              ? `${statusClassName(asset)} ${styles.retractEnquiryButton}`
              : `${assetStyles.secondaryButton} ${workspaceStyles.actionButton} ${styles.pendingRequestButton}`
          }
          title="Retract this enquiry"
          aria-label="Retract pending enquiry"
          onClick={() => void handleRetractEnquiry(asset)}
          disabled={isProcessing}
        >
          {isProcessing ? "Retracting..." : "Pending request"}
        </button>
      );
    }

    if (pillLabel) {
      return (
        <span
          className={
            dealerAppMode
              ? statusClassName(asset)
              : `${workspaceStyles.actionButton} ${styles.discoveryStatusAction} ${styles.discoveryDeniedAction}`
          }
          title={statusDescription(asset)}
        >
          {pillLabel}
        </span>
      );
    }

    return (
      <button
        type="button"
        className={
          dealerAppMode
            ? `${styles.primaryButton} ${styles.enquireButton}`
            : `${assetStyles.primaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${leadStyles.openLeadButton} ${styles.discoveryPrimaryAction}`
        }
        onClick={() => handleEnquire(asset)}
        disabled={isProcessing}
      >
        {isProcessing ? "Sending..." : "Request contact"}
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
            <div
              className={styles.discoveryPageSizeField}
              data-discovery-filter="true"
            >
              <span>Show</span>
              <div className={styles.discoveryPageSizeSelect}>
                <button
                  type="button"
                  className={styles.discoveryPageSizeButton}
                  aria-label="Assets per page"
                  aria-haspopup="listbox"
                  aria-expanded={openFilter === "pageSize"}
                  onClick={() =>
                    setOpenFilter((current) =>
                      current === "pageSize" ? null : "pageSize",
                    )
                  }
                  disabled={loading}
                >
                  <strong>{pageSize}</strong>
                  <ChevronDownIcon className={styles.discoveryPageSizeChevron} />
                </button>

                {openFilter === "pageSize" ? (
                  <div
                    className={styles.discoveryPageSizeMenu}
                    role="listbox"
                    aria-label="Assets per page"
                  >
                    {DISCOVERY_PAGE_SIZE_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={`asset-discovery-page-size-${option}`}
                        className={`${styles.discoveryPageSizeOption} ${option === pageSize ? styles.discoveryPageSizeOptionSelected : ""}`}
                        role="option"
                        aria-selected={option === pageSize}
                        onClick={() => {
                          handlePageSizeChange(String(option));
                          setOpenFilter(null);
                        }}
                      >
                        <span>{option} assets</span>
                        {option === pageSize ? <strong>✓</strong> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <span>per page</span>
            </div>
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
    <section className={`${workspaceStyles.shell} ${styles.shell} ${dealerAppMode ? dealerStyles.dealerDiscoverySurface : ""}`}>
      <WorkspaceTitlePanel title={dealerAppMode ? "Discovery" : "Asset Discovery"} />

      <section
        className={styles.controlsPanel}
        aria-label="Asset Discovery controls"
      >
        {!dealerAppMode ? (
          <section
            className={`${assetStyles.summaryRow} ${assetStyles.heroSummaryRow} ${leadStyles.leadSummaryRow}`}
            aria-label="Asset Discovery summary"
          >
            <article
              className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${leadStyles.leadOwnerSummaryCard} ${leadStyles.leadOwnerSummaryCardNew}`}
            >
              <div className={assetStyles.heroSummaryHead}>
                <span className={`${assetStyles.heroSummaryTitle} ${leadStyles.leadOwnerSummaryText}`}>
                  Available assets
                </span>
              </div>
              <div className={assetStyles.heroSummaryValueRow}>
                <strong className={`${assetStyles.heroSummaryValue} ${leadStyles.leadOwnerSummaryText}`}>
                  {summary.totalAssets}
                </strong>
              </div>
              <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${leadStyles.leadOwnerSummaryFooter}`}>
                <small className={leadStyles.leadOwnerSummaryText}>
                  Matching the current search and filters.
                </small>
              </div>
            </article>

            <article
              className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${leadStyles.leadOwnerSummaryCard} ${leadStyles.leadOwnerSummaryCardOpen}`}
            >
              <div className={assetStyles.heroSummaryHead}>
                <span className={`${assetStyles.heroSummaryTitle} ${leadStyles.leadOwnerSummaryText}`}>
                  Asset types
                </span>
              </div>
              <div className={assetStyles.heroSummaryValueRow}>
                <strong className={`${assetStyles.heroSummaryValue} ${leadStyles.leadOwnerSummaryText}`}>
                  {summary.typeCount}
                </strong>
              </div>
              <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${leadStyles.leadOwnerSummaryFooter}`}>
                <small className={leadStyles.leadOwnerSummaryText}>
                  Asset families represented in these results.
                </small>
              </div>
            </article>

            <article
              className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${leadStyles.leadOwnerSummaryCard} ${leadStyles.leadOwnerSummaryCardDone}`}
            >
              <div className={assetStyles.heroSummaryHead}>
                <span className={`${assetStyles.heroSummaryTitle} ${leadStyles.leadOwnerSummaryText}`}>
                  Provinces
                </span>
              </div>
              <div className={assetStyles.heroSummaryValueRow}>
                <strong className={`${assetStyles.heroSummaryValue} ${leadStyles.leadOwnerSummaryText}`}>
                  {summary.provinceCount}
                </strong>
              </div>
              <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${leadStyles.leadOwnerSummaryFooter}`}>
                <small className={leadStyles.leadOwnerSummaryText}>
                  Saved owner provinces represented.
                </small>
              </div>
            </article>
          </section>
        ) : null}

        {dealerAppMode ? (
          <section
            className={`${workspaceStyles.controlsRow} ${styles.toolbar}`}
            aria-label="Search and filter Asset Discovery"
          >
            <label className={`${workspaceStyles.searchField} ${styles.searchBox}`}>
              <SearchIcon className={styles.searchIcon} />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search assets"
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
        ) : (
          <div
            className={`${assetStyles.toolbar} ${workspaceStyles.controlsRow} ${leadStyles.leadSearchToolbar} ${styles.parityToolbar}`}
            aria-label="Search and filter Asset Discovery"
          >
            <label className={`${assetStyles.searchWrap} ${workspaceStyles.searchField}`}>
              <SearchIcon className={assetStyles.searchIcon} />
              <input
                className={assetStyles.searchInput}
                type="search"
                value={searchInput}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search by type, brand, model, year, usage, condition or province"
                aria-label="Search Asset Discovery"
              />

              {searchInput ? (
                <button
                  type="button"
                  className={assetStyles.clearSearchButton}
                  onClick={() => handleSearchChange("")}
                  aria-label="Clear Discovery search"
                >
                  <CloseIcon className={assetStyles.buttonIcon} />
                </button>
              ) : null}
            </label>

            <div className={leadStyles.leadToolbarActions}>
              <button
                type="button"
                className={`${assetStyles.secondaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral} ${leadStyles.leadRefreshButton}`}
                onClick={refreshAssets}
                disabled={loading}
              >
                <RefreshIcon className={`${assetStyles.buttonIcon} ${loading ? leadStyles.leadRefreshIconActive : ""}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                className={`${assetStyles.secondaryButton} ${assetStyles.filterTriggerButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionMint} ${leadStyles.leadFilterButton} ${hasActiveDiscoveryFilter ? assetStyles.filterTriggerButtonActive : ""}`}
                onClick={openDiscoveryFilterModal}
                disabled={loading}
              >
                <FilterIcon className={assetStyles.buttonIcon} />
                <span>{activeDiscoveryFilterLabel}</span>
                <ChevronDownIcon className={assetStyles.filterChevron} />
              </button>
            </div>
          </div>
        )}
      </section>

      {notice ? (
        <div
          className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}
        >
          {notice.message}
        </div>
      ) : null}
      {error ? <div className={styles.errorPanel}>{error}</div> : null}

      {!loading && !error ? (
        <div className={leadStyles.leadResultSummary}>
          <span>Showing</span>
          <strong>{pagination.totalItems}</strong>
          <span>assets for the current search and filters</span>
        </div>
      ) : null}

      <section
        className={dealerAppMode ? styles.cardStack : leadStyles.leadStack}
        aria-label="Asset Discovery assets"
      >
        {loading ? (
          <div className={`${workspaceStyles.emptyState} ${styles.emptyState}`}>
            Loading Asset Discovery...
          </div>
        ) : !error && assets.length ? (
          assets.map((asset) => {
            return dealerAppMode ? (
              <article
                key={asset.id}
                className={`${workspaceStyles.card} ${styles.assetCard} ${styles.dealerAssetCard} ${assetCardStatusClass(asset)}`}
              >
                <div className={`${styles.assetCardHeader} ${styles.dealerAssetCardHeader}`}>
                  <div className={styles.assetIdentity}>
                    <h2>{dealerAssetDisplayName(asset)}</h2>
                    <p className={styles.dealerAssetMeta}>{dealerAssetMeta(asset)}</p>
                    <span className={styles.dealerAssetProvince}>
                      {[cleanText(asset.type) || "Asset", cleanText(asset.province) || "Location not saved"].join(" · ")}
                    </span>
                  </div>

                  <div className={styles.assetActionRow}>
                    {renderEnquiryControl(asset)}
                  </div>
                </div>
              </article>
            ) : (
              <article
                key={asset.id}
                className={`${workspaceStyles.card} ${leadStyles.leadThread} ${leadParityAssetCardStatusClass(asset)}`}
              >
                <div className={leadStyles.clientPanel}>
                  <div className={leadStyles.clientPanelHeader}>
                    <div className={leadStyles.clientIdentity}>
                      <h3>{dealerAssetDisplayName(asset)}</h3>
                      <strong className={leadStyles.leadAssetName}>
                        {dealerAssetMeta(asset)}
                      </strong>
                      <span className={leadStyles.clientKicker}>
                        {[cleanText(asset.type) || "Asset", cleanText(asset.province) || "Location not saved"].join(" · ")}
                      </span>
                    </div>

                    <div className={leadStyles.clientDecisionArea}>
                      <div className={leadStyles.clientActionRow}>
                        {renderEnquiryControl(asset)}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        ) : !error ? (
          <div className={`${workspaceStyles.emptyState} ${styles.emptyState}`}>
            No assets match this search or filter.
          </div>
        ) : null}
      </section>

      {renderPagination()}

      {!dealerAppMode && isFilterModalOpen ? (
        <div className={`${assetStyles.modalOverlay} ${workspaceStyles.modalOverlay}`}>
          <div className={assetStyles.modalBackdrop} onClick={closeDiscoveryFilterModal} />

          <div
            className={`${assetStyles.modalCard} ${workspaceStyles.modal} ${leadStyles.leadFilterModal} ${styles.discoveryFilterModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discovery-filter-title"
          >
            <div className={`${assetStyles.modalHeader} ${workspaceStyles.modalHeader}`}>
              <div className={assetStyles.modalHeaderText}>
                <h3 id="discovery-filter-title">Choose which assets to show.</h3>
                <p className={leadStyles.leadFilterIntro}>
                  Filter Asset Discovery by equipment type, owner province and page size.
                </p>
              </div>

              <button
                type="button"
                className={`${assetStyles.modalCloseButton} ${workspaceStyles.modalClose}`}
                onClick={closeDiscoveryFilterModal}
                aria-label="Close filter modal"
              >
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={`${workspaceStyles.modalBody} ${leadStyles.leadFilterForm} ${styles.discoveryFilterForm}`}>
              <DiscoveryFilterDropdown
                label="Asset type"
                filterKey="type"
                value={type}
                options={typeFilterOptions}
                openFilter={openFilter}
                onOpenChange={setOpenFilter}
                onChange={handleTypeChange}
              />

              <DiscoveryFilterDropdown
                label="Province"
                filterKey="province"
                value={province}
                options={provinceFilterOptions}
                openFilter={openFilter}
                onOpenChange={setOpenFilter}
                onChange={handleProvinceChange}
              />

              <DiscoveryFilterDropdown
                label="Assets per page"
                filterKey="pageSize"
                value={String(pageSize)}
                options={pageSizeFilterOptions}
                openFilter={openFilter}
                onOpenChange={setOpenFilter}
                onChange={handlePageSizeChange}
              />
            </div>

            <div className={`${assetStyles.formActions} ${workspaceStyles.modalFooter} ${leadStyles.leadFilterActions}`}>
              <button
                type="button"
                className={`${assetStyles.secondaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral}`}
                onClick={resetDiscoveryFilters}
                disabled={!hasActiveDiscoveryFilter}
              >
                Reset filters
              </button>
              <button
                type="button"
                className={`${assetStyles.primaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionGreen}`}
                onClick={closeDiscoveryFilterModal}
              >
                Apply filters
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeEnquiry ? (
        <div
          className={`${workspaceStyles.modalOverlay} ${styles.contactOverlay}`}
          onMouseDown={() => setActiveEnquiry(null)}
        >
          <section
            className={`${workspaceStyles.modal} ${styles.contactModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dealer-discovery-contact-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={`${workspaceStyles.modalHeader} ${styles.contactHeader}`}>
              <div className={styles.contactHeaderCopy}>
                <span className={styles.contactKicker}>Open contact</span>
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
                className={`${workspaceStyles.modalClose} ${styles.contactCloseButton}`}
                onClick={() => setActiveEnquiry(null)}
                aria-label="Close approved contact"
              >
                ×
              </button>
            </header>

            <div className={`${workspaceStyles.modalBody} ${styles.contactBody}`}>
              <div className={styles.contactAccessNote}>
                <span>Owner approved your enquiry</span>
                <p>
                  Contact access is open
                  {contactAccessExpiry(activeEnquiry.approvedAtIso)
                    ? ` until ${contactAccessExpiry(activeEnquiry.approvedAtIso)}`
                    : " for three months"}
                  .
                </p>
              </div>

              {activeEnquiry.ownerContact ? (
                <div className={styles.contactGrid}>
                  <div className={styles.contactPrimaryCard}>
                    <span>Owner or business</span>
                    <strong>
                      {activeEnquiry.ownerContact.businessName ||
                        activeEnquiry.ownerContact.name ||
                        "Not supplied"}
                    </strong>
                  </div>
                  <div>
                    <span>Phone</span>
                    {activeEnquiry.ownerContact.phone ? (
                      <a href={`tel:${activeEnquiry.ownerContact.phone}`}>
                        {activeEnquiry.ownerContact.phone}
                      </a>
                    ) : (
                      <strong>Not supplied</strong>
                    )}
                  </div>
                  <div>
                    <span>Email</span>
                    {activeEnquiry.ownerContact.email ? (
                      <a href={`mailto:${activeEnquiry.ownerContact.email}`}>
                        {activeEnquiry.ownerContact.email}
                      </a>
                    ) : (
                      <strong>Not supplied</strong>
                    )}
                  </div>
                  <div className={styles.contactLocationCard}>
                    <span>Location</span>
                    <strong>
                      {activeEnquiry.ownerContact.location || "Not supplied"}
                    </strong>
                  </div>
                </div>
              ) : (
                <p className={styles.contactEmpty}>
                  The owner approved the enquiry, but has not supplied contact
                  information yet.
                </p>
              )}
            </div>

            <div className={`${workspaceStyles.modalFooter} ${styles.contactActions}`}>
              {activeEnquiry.ownerContact?.phone ? (
                <a
                  className={`${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${styles.contactPrimaryAction}`}
                  href={`tel:${activeEnquiry.ownerContact.phone}`}
                >
                  Call owner
                </a>
              ) : null}
              {activeEnquiry.ownerContact?.email ? (
                <a
                  className={`${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${styles.contactPrimaryAction}`}
                  href={`mailto:${activeEnquiry.ownerContact.email}`}
                >
                  Email owner
                </a>
              ) : null}
              <button
                type="button"
                className={`${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral} ${styles.contactSecondaryAction}`}
                onClick={() => setActiveEnquiry(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
