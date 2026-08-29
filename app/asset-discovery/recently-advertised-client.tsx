"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { workspaceStyles } from "../../components/WorkspacePrimitives";
import assetStyles from "../asset-register/page.module.css";
import leadStyles from "../leads/page.module.css";
import mobileStyles from "../field-manager/page.module.css";
import styles from "./page.module.css";

type RecentAdvertStatus = "available" | "sold" | "ended";

type RecentAdvert = {
  id: string;
  sourceAssetId: string | null;
  title: string;
  brand: string;
  model: string;
  year: string;
  usage: string;
  condition: string;
  type: string;
  province: string;
  area: string;
  description: string;
  advertiserName: string;
  advertiserType: "business" | "private";
  status: RecentAdvertStatus;
  statusLabel: "Available" | "Sold / traded" | "Advert ended";
  publishedAtIso: string;
  priceExVat: number | null;
  imageUrl: string;
  marketplaceHref: string | null;
};

type FilterOption = {
  value: string;
  label: string;
  count: number;
};

type RecentAdvertSummary = {
  totalAdverts: number;
  advertiserCount: number;
  provinceCount: number;
};

type RecentAdvertPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type RecentAdvertResponse = {
  ok: boolean;
  adverts?: RecentAdvert[];
  typeOptions?: FilterOption[];
  provinceOptions?: FilterOption[];
  summary?: RecentAdvertSummary;
  pagination?: RecentAdvertPagination;
  error?: string;
};

type SourcingRequest = {
  id: string;
  marketplaceListingId: string;
  title: string;
  advertiserName: string;
  status: "pending" | "viewed";
  alreadyRequested: boolean;
  createdAtIso: string;
};

type SourcingRequestResponse = {
  ok: boolean;
  request?: SourcingRequest;
  error?: string;
};

type IconProps = { className?: string };

const EMPTY_SUMMARY: RecentAdvertSummary = {
  totalAdverts: 0,
  advertiserCount: 0,
  provinceCount: 0,
};

const EMPTY_PAGINATION: RecentAdvertPagination = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
  rangeStart: 0,
  rangeEnd: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All advert statuses" },
  { value: "available", label: "Available" },
  { value: "sold", label: "Sold / traded" },
  { value: "ended", label: "Advert ended" },
];

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

function FilterIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5h16M7 12h10M10 19h4" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  );
}

function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.25a8.55 8.55 0 0 0-7.26 13.05l-1.06 3.9 4.04-1.02A8.55 8.55 0 1 0 12 3.25Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.55 7.65c.22-.48.45-.5.68-.5h.6c.2 0 .43.05.57.38l.78 1.82c.1.27.08.5-.08.72l-.42.53c-.1.12-.13.28-.05.43.48.9 1.35 1.78 2.34 2.34.15.08.3.05.43-.05l.53-.42c.22-.17.45-.2.72-.08l1.82.78c.33.13.38.37.38.57v.6c0 .23-.02.47-.5.68-.5.22-1.14.34-1.9.24-2.28-.32-5.83-3.86-6.15-6.15-.1-.76.02-1.4.25-1.9Z" fill="currentColor" />
    </svg>
  );
}

function PhotoUnavailableIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m5.5 17 4.2-4.2 3.1 3 2.2-2.1 3.5 3.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4 4 16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.5 6.5 11 11m0-11-11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return `Advertised ${new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  }).format(date)}`;
}

function fullDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  }).format(date);
}

function keepFocusInDialog(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;

  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getClientRects().length > 0);
  if (!focusable.length) return;

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

function formatPrice(value: number | null): string {
  if (!value || !Number.isFinite(value)) return "Price not saved";
  return `${new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value)} excl. VAT`;
}

function advertMeta(advert: RecentAdvert): string {
  return [clean(advert.year), clean(advert.usage), clean(advert.condition)]
    .filter(Boolean)
    .join(" · ") || "Equipment details available from the advertiser";
}

export default function RecentlyAdvertisedClient({
  compactAppMode = false,
}: {
  compactAppMode?: boolean;
}) {
  const [adverts, setAdverts] = useState<RecentAdvert[]>([]);
  const [typeOptions, setTypeOptions] = useState<FilterOption[]>([]);
  const [provinceOptions, setProvinceOptions] = useState<FilterOption[]>([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [province, setProvince] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAdvertId, setExpandedAdvertId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sourcingLoadingId, setSourcingLoadingId] = useState<string | null>(null);
  const [sourcingRequest, setSourcingRequest] = useState<SourcingRequest | null>(null);
  const [sourcingError, setSourcingError] = useState<string | null>(null);
  const [requestedAdvertIds, setRequestedAdvertIds] = useState<Set<string>>(() => new Set());
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(() => new Set());
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const filterDialogRef = useRef<HTMLDivElement | null>(null);
  const filterWasOpenRef = useRef(false);
  const sourcingTriggerRef = useRef<HTMLButtonElement | null>(null);
  const sourcingDialogRef = useRef<HTMLDivElement | null>(null);
  const sourcingWasOpenRef = useRef(false);
  const sourcingRequestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!filterOpen && !sourcingRequest) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFilterOpen(false);
      setSourcingRequest(null);
      setSourcingError(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [filterOpen, sourcingRequest]);

  useEffect(() => {
    if (filterOpen) {
      filterWasOpenRef.current = true;
      const frame = window.requestAnimationFrame(() => {
        filterDialogRef.current?.querySelector<HTMLElement>("select, button")?.focus();
      });
      return () => window.cancelAnimationFrame(frame);
    }
    if (filterWasOpenRef.current) {
      filterWasOpenRef.current = false;
      filterTriggerRef.current?.focus();
    }
    return undefined;
  }, [filterOpen]);

  useEffect(() => {
    if (sourcingRequest) {
      sourcingWasOpenRef.current = true;
      const frame = window.requestAnimationFrame(() => {
        sourcingDialogRef.current?.querySelector<HTMLElement>("button")?.focus();
      });
      return () => window.cancelAnimationFrame(frame);
    }
    if (sourcingWasOpenRef.current) {
      sourcingWasOpenRef.current = false;
      sourcingTriggerRef.current?.focus();
    }
    return undefined;
  }, [sourcingRequest]);

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams({
      page: String(currentPage),
      pageSize: "10",
    });
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (type !== "all") params.set("type", type);
    if (province !== "all") params.set("province", province);

    async function loadAdverts() {
      try {
        setLoading(true);
        setError(null);
        setExpandedAdvertId(null);
        const response = await fetch(
          `/api/asset-discovery/recently-advertised?${params.toString()}`,
          { credentials: "include", cache: "no-store" },
        );
        const payload = (await response.json()) as RecentAdvertResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Failed to load recently advertised equipment.");
        }
        if (!mounted) return;
        setAdverts(Array.isArray(payload.adverts) ? payload.adverts : []);
        setTypeOptions(Array.isArray(payload.typeOptions) ? payload.typeOptions : []);
        setProvinceOptions(Array.isArray(payload.provinceOptions) ? payload.provinceOptions : []);
        setSummary(payload.summary ?? EMPTY_SUMMARY);
        setPagination(payload.pagination ?? EMPTY_PAGINATION);
        if (payload.pagination && payload.pagination.page !== currentPage) {
          setCurrentPage(payload.pagination.page);
        }
      } catch (cause) {
        if (!mounted) return;
        setAdverts([]);
        setSummary(EMPTY_SUMMARY);
        setPagination(EMPTY_PAGINATION);
        setError(cause instanceof Error ? cause.message : "Failed to load recently advertised equipment.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadAdverts();
    return () => {
      mounted = false;
    };
  }, [currentPage, province, refreshVersion, search, status, type]);

  const activeFilterCount = useMemo(
    () => [status, type, province].filter((value) => value !== "all").length,
    [province, status, type],
  );

  async function sendSourcingRequest(advert: RecentAdvert) {
    const requestId = sourcingRequestRef.current + 1;
    sourcingRequestRef.current = requestId;
    try {
      setSourcingLoadingId(advert.id);
      setSourcingError(null);
      const response = await fetch("/api/asset-discovery/recently-advertised", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: advert.id }),
      });
      const payload = (await response.json()) as SourcingRequestResponse;
      if (!response.ok || !payload.ok || !payload.request) {
        throw new Error(payload.error || "Failed to send the sourcing request.");
      }
      if (sourcingRequestRef.current !== requestId) return;
      setSourcingRequest(payload.request);
      setRequestedAdvertIds((current) => new Set(current).add(advert.id));
    } catch (cause) {
      if (sourcingRequestRef.current !== requestId) return;
      setSourcingError(cause instanceof Error ? cause.message : "Failed to send the sourcing request.");
    } finally {
      if (sourcingRequestRef.current === requestId) setSourcingLoadingId(null);
    }
  }

  function resetFilters() {
    setStatus("all");
    setType("all");
    setProvince("all");
    setCurrentPage(1);
  }

  function renderStatus(advert: RecentAdvert) {
    return (
      <span className={`${styles.recentAdvertStatus} ${styles[`recentAdvertStatus_${advert.status}`]}`}>
        {advert.status === "available" ? "Advert active" : advert.statusLabel}
      </span>
    );
  }

  function renderExpanded(advert: RecentAdvert) {
    if (expandedAdvertId !== advert.id) return null;
    const hasContactAction = advert.status !== "available" || !advert.marketplaceHref;
    const hasSavedImage = Boolean(advert.imageUrl) && !failedImageIds.has(advert.id);
    const requestSent = requestedAdvertIds.has(advert.id);
    const contactNoteId = `recent-advert-contact-note-${advert.id}`;

    return (
      <div className={styles.recentAdvertExpanded} id={`recent-advert-${advert.id}`}>
        <div className={`${styles.recentAdvertExpandedGrid} ${!hasSavedImage ? styles.recentAdvertExpandedGridNoImage : ""}`}>
          {hasSavedImage ? (
            <div className={styles.recentAdvertMedia}>
              <img
                src={advert.imageUrl}
                alt={`${advert.title} marketplace advert`}
                loading="lazy"
                onError={() => setFailedImageIds((current) => new Set(current).add(advert.id))}
              />
            </div>
          ) : null}

          <div className={styles.recentAdvertDetails}>
            {!hasSavedImage ? (
              <div className={styles.recentAdvertPhotoNote}>
                <span className={styles.recentAdvertPhotoNoteIcon} aria-hidden="true">
                  <PhotoUnavailableIcon />
                </span>
                <span>
                  <strong>Photo unavailable</strong>
                  <small>No photo was saved with this Marketplace advert.</small>
                </span>
              </div>
            ) : null}

            <dl className={styles.recentAdvertDetailGrid}>
              <div className={styles.recentAdvertPriceDetail}>
                <dt>Advertised price</dt>
                <dd>{formatPrice(advert.priceExVat)}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{[advert.area, advert.province].filter(Boolean).join(", ")}</dd>
              </div>
              <div>
                <dt>Advertised by</dt>
                <dd>{advert.advertiserName}</dd>
              </div>
              <div>
                <dt>Advertised</dt>
                <dd>{fullDateLabel(advert.publishedAtIso)}</dd>
              </div>
              <div className={styles.recentAdvertDetailWide}>
                <dt>Equipment type</dt>
                <dd>{advert.type}</dd>
              </div>
            </dl>

            {advert.description ? (
              <div className={styles.recentAdvertDescription}>
                <strong>About this advert</strong>
                <p>{advert.description}</p>
              </div>
            ) : null}

            {advert.status === "available" && advert.marketplaceHref ? (
              <p className={styles.recentAdvertAvailabilityNote} id={contactNoteId}>
                This advert is live. Open it to view the full listing and contact the seller by WhatsApp, phone or email.
              </p>
            ) : (
              <p className={styles.recentAdvertSourcingNote} id={contactNoteId}>
                {advert.status === "available"
                  ? "This advert has no public Marketplace page. "
                  : "This advert is no longer active, but the advertiser may know where to find similar equipment. "}
                We will share your saved Marketplace phone or email only with {advert.advertiserName}, so they can contact you if they can help.
              </p>
            )}

            <div className={styles.recentAdvertExpandedActions}>
              {advert.marketplaceHref ? (
                <a
                  href={advert.marketplaceHref}
                  className={`${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${styles.recentAdvertPrimaryAction}`}
                  aria-describedby={contactNoteId}
                >
                  <WhatsAppIcon className={styles.recentAdvertActionIcon} />
                  <span>View advert &amp; contact seller</span>
                </a>
              ) : hasContactAction ? (
                <button
                  type="button"
                  className={`${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${styles.recentAdvertPrimaryAction}`}
                  onClick={(event) => {
                    sourcingTriggerRef.current = event.currentTarget;
                    void sendSourcingRequest(advert);
                  }}
                  disabled={sourcingLoadingId !== null || requestSent}
                  aria-describedby={contactNoteId}
                >
                  <WhatsAppIcon className={styles.recentAdvertActionIcon} />
                  <span>
                    {requestSent
                      ? "Request sent"
                      : sourcingLoadingId === advert.id
                        ? "Sending request…"
                        : advert.status === "available"
                          ? "Ask advertiser about this advert"
                          : "Ask advertiser to source one"}
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderAdvertCard(advert: RecentAdvert) {
    const isExpanded = expandedAdvertId === advert.id;
    const statusClass = styles[`recentAdvertCard_${advert.status}`];

    if (compactAppMode) {
      return (
        <article
          key={advert.id}
          className={`${workspaceStyles.card} ${mobileStyles.overviewCard} ${styles.recentAdvertCardCompact} ${statusClass}`}
        >
          <div className={styles.recentAdvertCompactLabels}>
            <span>{advert.type}</span>
            {renderStatus(advert)}
          </div>
          <h2>{advert.title}</h2>
          <p className={styles.recentAdvertMeta}>{advertMeta(advert)}</p>
          <p className={styles.recentAdvertByline}>
            <span>{dateLabel(advert.publishedAtIso)}</span>
            <strong>by {advert.advertiserName}</strong>
          </p>
          <button
            type="button"
            className={`${workspaceStyles.actionButton} ${isExpanded ? styles.recentAdvertCloseAction : styles.recentAdvertOpenAction}`}
            onClick={() => setExpandedAdvertId(isExpanded ? null : advert.id)}
            aria-expanded={isExpanded}
            aria-controls={`recent-advert-${advert.id}`}
            aria-label={`${isExpanded ? "Close" : "Open"} ${advert.title} advert details`}
          >
            {isExpanded ? "Hide details" : "View details"}
          </button>
          {renderExpanded(advert)}
        </article>
      );
    }

    return (
      <article
        key={advert.id}
        className={`${workspaceStyles.card} ${leadStyles.leadThread} ${statusClass} ${isExpanded ? leadStyles.leadThreadOpen : ""}`}
      >
        <div className={leadStyles.clientPanel}>
          <div className={leadStyles.clientPanelHeader}>
            <div className={leadStyles.clientIdentity}>
              <h2 className={styles.recentAdvertCardTitle}>{advert.title}</h2>
              <strong className={leadStyles.leadAssetName}>{advertMeta(advert)}</strong>
              <span className={leadStyles.clientKicker}>
                {[advert.type, advert.province].filter(Boolean).join(" · ")}
              </span>
              <span className={styles.recentAdvertByline}>
                {dateLabel(advert.publishedAtIso)} <strong>by {advert.advertiserName}</strong>
              </span>
            </div>

            <div className={leadStyles.clientDecisionArea}>
              <div className={`${leadStyles.clientActionRow} ${styles.recentAdvertCardActions}`}>
                {renderStatus(advert)}
                <button
                  type="button"
                  className={`${workspaceStyles.actionButton} ${isExpanded ? styles.recentAdvertCloseAction : styles.recentAdvertOpenAction}`}
                  onClick={() => setExpandedAdvertId(isExpanded ? null : advert.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`recent-advert-${advert.id}`}
                  aria-label={`${isExpanded ? "Close" : "Open"} ${advert.title} advert details`}
                >
                  {isExpanded ? "Hide details" : "View details"}
                </button>
              </div>
            </div>
          </div>
        </div>
        {renderExpanded(advert)}
      </article>
    );
  }

  return (
    <div className={styles.recentAdvertSurface}>
      {!compactAppMode ? (
        <section
          className={`${assetStyles.summaryRow} ${assetStyles.heroSummaryRow} ${leadStyles.leadSummaryRow}`}
          aria-label="Recently advertised summary"
        >
          <article className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${leadStyles.leadOwnerSummaryCard} ${leadStyles.leadOwnerSummaryCardNew}`}>
            <div className={assetStyles.heroSummaryHead}>
              <span className={`${assetStyles.heroSummaryTitle} ${leadStyles.leadOwnerSummaryText}`}>Recently advertised</span>
            </div>
            <div className={assetStyles.heroSummaryValueRow}>
              <strong className={`${assetStyles.heroSummaryValue} ${leadStyles.leadOwnerSummaryText}`}>{loading ? "—" : summary.totalAdverts}</strong>
            </div>
            <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${leadStyles.leadOwnerSummaryFooter}`}>
              <small className={leadStyles.leadOwnerSummaryText}>Matching the current search and filters.</small>
            </div>
          </article>

          <article className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${leadStyles.leadOwnerSummaryCard} ${leadStyles.leadOwnerSummaryCardOpen}`}>
            <div className={assetStyles.heroSummaryHead}>
              <span className={`${assetStyles.heroSummaryTitle} ${leadStyles.leadOwnerSummaryText}`}>Advertisers</span>
            </div>
            <div className={assetStyles.heroSummaryValueRow}>
              <strong className={`${assetStyles.heroSummaryValue} ${leadStyles.leadOwnerSummaryText}`}>{loading ? "—" : summary.advertiserCount}</strong>
            </div>
            <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${leadStyles.leadOwnerSummaryFooter}`}>
              <small className={leadStyles.leadOwnerSummaryText}>People and businesses who advertised these assets.</small>
            </div>
          </article>

          <article className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${leadStyles.leadOwnerSummaryCard} ${leadStyles.leadOwnerSummaryCardDone}`}>
            <div className={assetStyles.heroSummaryHead}>
              <span className={`${assetStyles.heroSummaryTitle} ${leadStyles.leadOwnerSummaryText}`}>Provinces</span>
            </div>
            <div className={assetStyles.heroSummaryValueRow}>
              <strong className={`${assetStyles.heroSummaryValue} ${leadStyles.leadOwnerSummaryText}`}>{loading ? "—" : summary.provinceCount}</strong>
            </div>
            <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${leadStyles.leadOwnerSummaryFooter}`}>
              <small className={leadStyles.leadOwnerSummaryText}>Marketplace locations represented in these results.</small>
            </div>
          </article>
        </section>
      ) : null}

      <section
        className={`${assetStyles.toolbar} ${workspaceStyles.controlsRow} ${leadStyles.leadSearchToolbar} ${styles.parityToolbar}`}
        aria-label="Search and filter recently advertised equipment"
      >
        <label className={`${assetStyles.searchWrap} ${workspaceStyles.searchField}`}>
          <SearchIcon className={assetStyles.searchIcon} />
          <input
            className={assetStyles.searchInput}
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search equipment, advertiser, location or condition"
            aria-label="Search recently advertised equipment"
          />
          {searchInput ? (
            <button type="button" className={assetStyles.clearSearchButton} onClick={() => setSearchInput("")} aria-label="Clear recently advertised search">
              <CloseIcon className={assetStyles.buttonIcon} />
            </button>
          ) : null}
        </label>

        <div className={leadStyles.leadToolbarActions}>
          <button
            type="button"
            className={`${assetStyles.secondaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral} ${leadStyles.leadRefreshButton} ${styles.discoveryRefreshButton}`}
            onClick={() => setRefreshVersion((value) => value + 1)}
            disabled={loading}
          >
            <RefreshIcon className={`${assetStyles.buttonIcon} ${loading ? leadStyles.leadRefreshIconActive : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            ref={filterTriggerRef}
            type="button"
            className={`${assetStyles.secondaryButton} ${assetStyles.filterTriggerButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionMint} ${leadStyles.leadFilterButton} ${activeFilterCount ? assetStyles.filterTriggerButtonActive : ""}`}
            onClick={() => setFilterOpen(true)}
            disabled={loading}
            aria-haspopup="dialog"
            aria-expanded={filterOpen}
            aria-controls="recent-advert-filter-dialog"
          >
            <FilterIcon className={assetStyles.buttonIcon} />
            <span>{activeFilterCount ? `Filter (${activeFilterCount})` : "Filter"}</span>
          </button>
        </div>
      </section>

      {sourcingError ? (
        <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
          {sourcingError}
        </div>
      ) : null}
      {error ? <div className={styles.errorPanel} role="alert">{error}</div> : null}

      {!loading && !error ? (
        compactAppMode ? (
          <div
            className={`${mobileStyles.overviewSectionHeading} ${styles.discoverySectionHeading}`}
            role="status"
            aria-live="polite"
            aria-label={`Showing ${pagination.rangeStart} to ${pagination.rangeEnd} of ${pagination.totalItems} recently advertised assets. Page ${pagination.page} of ${pagination.totalPages}.`}
          >
            <h2>Recently advertised</h2>
            <span aria-label={`${pagination.totalItems} recently advertised assets`}>{pagination.totalItems}</span>
          </div>
        ) : (
          <div
            className={leadStyles.leadResultSummary}
            role="status"
            aria-live="polite"
            aria-label={`Showing ${pagination.rangeStart} to ${pagination.rangeEnd} of ${pagination.totalItems} recently advertised assets. Page ${pagination.page} of ${pagination.totalPages}.`}
          >
            <span>Showing</span>
            <strong>{pagination.totalItems}</strong>
            <span>adverts for the current search and filters</span>
          </div>
        )
      ) : null}

      <section
        className={compactAppMode ? `${mobileStyles.overviewList} ${styles.cardStack}` : leadStyles.leadStack}
        aria-label="Recently advertised equipment"
        aria-busy={loading}
      >
        {loading ? (
          <div className={`${workspaceStyles.emptyState} ${styles.emptyState}`} role="status" aria-live="polite">Loading recently advertised equipment...</div>
        ) : !error && adverts.length ? (
          adverts.map(renderAdvertCard)
        ) : !error ? (
          <div className={`${workspaceStyles.emptyState} ${styles.emptyState}`}>
            No Marketplace adverts match this search or filter.
          </div>
        ) : null}
      </section>

      {!loading && !error && pagination.totalItems > 0 ? (
        <nav className={`${styles.discoveryPagination} ${styles.recentAdvertPagination}`} aria-label="Recently advertised pagination">
          <div className={styles.discoveryPaginationInfo}>
            <span className={styles.discoveryPaginationSummary}>
              Showing <strong>{pagination.rangeStart}-{pagination.rangeEnd}</strong> of <strong>{pagination.totalItems}</strong>
            </span>
          </div>
          {pagination.totalPages > 1 ? (
            <div className={styles.discoveryPaginationControls}>
              <button type="button" className={styles.discoveryPaginationButton} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={!pagination.hasPreviousPage || loading}>Previous</button>
              <span className={styles.recentAdvertPageLabel}>Page {pagination.page} of {pagination.totalPages}</span>
              <button type="button" className={styles.discoveryPaginationButton} onClick={() => setCurrentPage((page) => Math.min(pagination.totalPages, page + 1))} disabled={!pagination.hasNextPage || loading}>Next</button>
            </div>
          ) : null}
        </nav>
      ) : null}

      {filterOpen ? (
        <div className={`${assetStyles.modalOverlay} ${workspaceStyles.modalOverlay}`}>
          <div className={assetStyles.modalBackdrop} onClick={() => setFilterOpen(false)} />
          <div
            ref={filterDialogRef}
            id="recent-advert-filter-dialog"
            className={`${assetStyles.modalCard} ${workspaceStyles.modal} ${styles.recentAdvertFilterModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recent-advert-filter-title"
            onKeyDown={keepFocusInDialog}
          >
            <div className={`${assetStyles.modalHeader} ${workspaceStyles.modalHeader}`}>
              <div className={assetStyles.modalHeaderText}>
                <h3 id="recent-advert-filter-title">Choose which adverts to show</h3>
                <p>Filter by availability, equipment type or Marketplace location.</p>
              </div>
              <button type="button" className={`${assetStyles.modalCloseButton} ${workspaceStyles.modalClose}`} onClick={() => setFilterOpen(false)} aria-label="Close recently advertised filters">
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>
            <div className={`${workspaceStyles.modalBody} ${styles.recentAdvertFilterFields}`}>
              <label>
                <span>Advert status</span>
                <select value={status} onChange={(event) => { setStatus(event.target.value); setCurrentPage(1); }}>
                  {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label>
                <span>Equipment type</span>
                <select value={type} onChange={(event) => { setType(event.target.value); setCurrentPage(1); }}>
                  <option value="all">All equipment types</option>
                  {typeOptions.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.count})</option>)}
                </select>
              </label>
              <label>
                <span>Province</span>
                <select value={province} onChange={(event) => { setProvince(event.target.value); setCurrentPage(1); }}>
                  <option value="all">All provinces</option>
                  {provinceOptions.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.count})</option>)}
                </select>
              </label>
            </div>
            <div className={`${workspaceStyles.modalFooter} ${styles.recentAdvertFilterActions}`}>
              <button type="button" className={`${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral}`} onClick={resetFilters}>Reset filters</button>
              <button type="button" className={`${workspaceStyles.actionButton} ${workspaceStyles.actionGreen}`} onClick={() => setFilterOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      ) : null}

      {sourcingRequest ? (
        <div className={`${assetStyles.modalOverlay} ${workspaceStyles.modalOverlay}`}>
          <div className={assetStyles.modalBackdrop} onClick={() => setSourcingRequest(null)} />
          <div
            ref={sourcingDialogRef}
            className={`${assetStyles.modalCard} ${workspaceStyles.modal} ${styles.recentAdvertContactModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recent-advert-contact-title"
            onKeyDown={keepFocusInDialog}
          >
            <div className={`${assetStyles.modalHeader} ${workspaceStyles.modalHeader}`}>
              <div className={assetStyles.modalHeaderText}>
                <span className={styles.recentAdvertContactKicker}>Marketplace contact request</span>
                <h3 id="recent-advert-contact-title">
                  {sourcingRequest.alreadyRequested
                    ? "Request already sent"
                    : `Request sent to ${sourcingRequest.advertiserName}`}
                </h3>
                <p>They can contact you directly if they can help with this equipment.</p>
              </div>
              <button type="button" className={`${assetStyles.modalCloseButton} ${workspaceStyles.modalClose}`} onClick={() => setSourcingRequest(null)} aria-label="Close sourcing request confirmation">
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>
            <div className={`${workspaceStyles.modalBody} ${styles.recentAdvertContactBody}`}>
              <div className={styles.recentAdvertContactAsset}>
                <span>Marketplace advert</span>
                <strong>{sourcingRequest.title}</strong>
              </div>
              <div className={styles.recentAdvertRequestConfirmation} role="status">
                <span className={styles.recentAdvertRequestConfirmationIcon} aria-hidden="true">
                  <WhatsAppIcon />
                </span>
                <span>
                  <strong>{sourcingRequest.alreadyRequested ? "Your request is still open" : "The advertiser has been notified"}</strong>
                  <p>
                    {sourcingRequest.advertiserName} can reply using the Marketplace phone or email you chose to share.
                    If you saved a mobile number, they can reply on WhatsApp. Their private contact details remain hidden.
                  </p>
                  {sourcingRequest.alreadyRequested ? (
                    <small>Originally sent {fullDateLabel(sourcingRequest.createdAtIso)}.</small>
                  ) : null}
                </span>
              </div>
            </div>
            <div className={`${workspaceStyles.modalFooter} ${styles.recentAdvertContactActions}`}>
              <a href="/account" className={`${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral}`}>
                Review contact details
              </a>
              <button type="button" className={`${workspaceStyles.actionButton} ${workspaceStyles.actionGreen}`} onClick={() => setSourcingRequest(null)}>Done</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
