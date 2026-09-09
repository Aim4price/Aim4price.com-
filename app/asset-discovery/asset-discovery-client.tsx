"use client";
import { useWebsiteStyles } from '../../components/useWebsiteStyles';
import website_dealerStyles from '../../components/website-styles/DealerControls.module.css';
import website_mobileStyles from '../../components/website-styles/FieldManagerControls.module.css';

import DropdownOverlay from '../../components/DropdownOverlay';
import { useEffect, useMemo, useRef, useState } from "react";
import {
  WorkspaceTitlePanel,
  workspaceStyles,
} from "../../components/WorkspacePrimitives";
import LeadPhotoViewerModal from "../../components/LeadPhotoViewerModal";
import assetStyles from "../asset-register/page.module.css";
import leadStyles from "../leads/page.module.css";
import native_mobileStyles from "../field-manager/page.module.css";
import styles from "./page.module.css";
import native_dealerStyles from "../dealer/dealer.module.css";
import RecentlyAdvertisedClient from "./recently-advertised-client";

type EnquiryStatus = "pending" | "approved" | "temporarily_denied";
type RenewalTiming = "overdue" | "next_30_days" | "next_6_months" | "later";

type AssetDiscoveryAsset = {
  id: string;
  type: string;
  brand: string;
  model: string;
  year: string;
  usage: string;
  condition: string;
  province: string;
  renewalWindow: string;
  renewalTiming: RenewalTiming | null;
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
  dueSoonCount: number;
  overdueCount: number;
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
  access?: DiscoveryAccess;
  assets?: AssetDiscoveryAsset[];
  provinceOptions?: Option[];
  typeOptions?: Option[];
  summary?: DiscoverySummary;
  pagination?: DiscoveryPagination;
  error?: string;
};

type DiscoveryAccess = {
  accountType: "owner" | "dealer" | "licensing" | "public";
  canBrowse: boolean;
  canContact?: boolean;
  participationEnabled: boolean;
  eligibleAssetCount: number;
  reason:
    | "allowed"
    | "participation_disabled"
    | "no_eligible_assets"
    | "public_preview";
};

type DiscoveryAssetDetails = {
  asset: Pick<
    AssetDiscoveryAsset,
    "id" | "type" | "brand" | "model" | "year" | "usage" | "condition" | "province" | "renewalWindow"
  >;
  enquiryId: string | null;
  enquiryStatus: EnquiryStatus | null;
  photosUnlocked: boolean;
  contactUnlocked: boolean;
  accessSource: "approved_enquiry" | "dealer_share" | null;
  photoUrls: string[];
  ownerContact: DiscoveryContact | null;
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

type DiscoveryFilterKey = "type" | "province" | "renewalTiming" | "status" | "pageSize";

type DiscoveryFilterOption = {
  value: string;
  label: string;
};

type DiscoveryPhotoModal = {
  assetId: string;
  title: string;
  urls: string[];
  index: number;
};

const SEARCH_DEBOUNCE_MS = 250;
const DISCOVERY_PAGE_SIZE = 10;
const DISCOVERY_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const RENEWAL_TIMING_OPTIONS: DiscoveryFilterOption[] = [
  { value: "all", label: "All renewal dates" },
  { value: "overdue", label: "Overdue" },
  { value: "next_30_days", label: "Next 30 days" },
  { value: "next_6_months", label: "Next 6 months" },
  { value: "later", label: "More than 6 months away" },
];
const RENEWAL_STATUS_OPTIONS: DiscoveryFilterOption[] = [
  { value: "all", label: "All opportunities" },
  { value: "available", label: "Available" },
  { value: "pending", label: "Pending" },
  { value: "won", label: "Won" },
  { value: "denied", label: "Denied" },
];
type DiscoveryPageSize = (typeof DISCOVERY_PAGE_SIZE_OPTIONS)[number];

const EMPTY_SUMMARY: DiscoverySummary = {
  totalAssets: 0,
  typeCount: 0,
  provinceCount: 0,
  dueSoonCount: 0,
  overdueCount: 0,
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

function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.25a8.55 8.55 0 0 0-7.26 13.05l-1.06 3.9 4.04-1.02A8.55 8.55 0 1 0 12 3.25Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.55 7.65c.22-.48.45-.5.68-.5h.6c.2 0 .43.05.57.38l.78 1.82c.1.27.08.5-.08.72l-.42.53c-.1.12-.13.28-.05.43.48.9 1.35 1.78 2.34 2.34.15.08.3.05.43-.05l.53-.42c.22-.17.45-.2.72-.08l1.82.78c.33.13.38.37.38.57v.6c0 .23-.02.47-.5.68-.5.22-1.14.34-1.9.24-2.28-.32-5.83-3.86-6.15-6.15-.1-.76.02-1.4.25-1.9Z" fill="currentColor" />
    </svg>
  );
}

function SettingsIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DiscoveryParticipationIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="21" cy="21" r="12.5" fill="currentColor" opacity="0.08" />
      <circle cx="21" cy="21" r="12.5" />
      <path d="m30.3 30.3 8.2 8.2" strokeWidth="3.2" />
      <path d="m21 15.3 5.4 3.2v6.3L21 28l-5.4-3.2v-6.3l5.4-3.2Z" fill="currentColor" opacity="0.12" />
      <path d="m15.6 18.5 5.4 3.3 5.4-3.3M21 21.8V28" />
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

function StatusCheckIcon({ className }: IconProps) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.6 2.6L16.5 9" />
    </svg>
  );
}

function WarningIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.3 3.8 2.5 17.3A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.7L13.7 3.8a2 2 0 0 0-3.4 0Z" />
      <path d="M12 8v5" />
      <path d="M12 17h.01" />
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

function ChevronLeftIcon({ className }: IconProps) {
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
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: IconProps) {
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
      <path d="m9 18 6-6-6-6" />
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
          <DropdownOverlay
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
          </DropdownOverlay>
        ) : null}
      </div>
    </label>
  );
}

function cleanText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanPhoneForWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.startsWith("27")
    ? digits
    : digits.startsWith("0")
      ? `27${digits.slice(1)}`
      : digits;
  return /^[1-9]\d{7,14}$/.test(normalized) && !/^270+$/.test(normalized)
    ? normalized
    : "";
}

function ownerWhatsAppHref(
  contact: DiscoveryContact,
  asset: Pick<AssetDiscoveryAsset, "brand" | "model">,
): string {
  const phone = cleanPhoneForWhatsApp(contact.phone);
  if (!phone) return "";
  const ownerName = cleanText(contact.businessName || contact.name) || "there";
  const assetName = [cleanText(asset.brand), cleanText(asset.model)].filter(Boolean).join(" ") || "equipment";
  const message = `Hi ${ownerName}, I am contacting you through Aim4price about your ${assetName}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
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

function licenceRenewalAssetMeta(asset: AssetDiscoveryAsset): string {
  return [
    cleanText(asset.year) || "Year unknown",
    cleanText(asset.type) || "Asset",
    cleanText(asset.renewalWindow) || "Renewal date not available",
  ].join(" • ");
}

function temporaryDenialExpired(asset: AssetDiscoveryAsset): boolean {
  if (asset.enquiryStatus !== "temporarily_denied" || !asset.requestAgainAtIso)
    return false;
  const retryTime = Date.parse(asset.requestAgainAtIso);
  return Number.isFinite(retryTime) && retryTime <= Date.now();
}

function statusPillLabel(asset: AssetDiscoveryAsset, licensing = false): string {
  if (asset.enquiryStatus === "approved") return licensing ? "Won" : "Contact open";
  if (asset.enquiryStatus === "pending") return licensing ? "Pending" : "Enquiry pending";
  if (
    asset.enquiryStatus === "temporarily_denied" &&
    !temporaryDenialExpired(asset)
  )
    return licensing ? "Denied" : "Temporarily denied";
  return "";
}

function statusDescription(asset: AssetDiscoveryAsset, licensing = false): string {
  if (asset.enquiryStatus === "approved") return licensing ? "Renewal work accepted by the owner." : "Approved by owner.";
  if (asset.enquiryStatus === "pending") return "Waiting for owner approval.";
  if (
    asset.enquiryStatus === "temporarily_denied" &&
    !temporaryDenialExpired(asset)
  ) {
    const retryDate = formatDate(asset.requestAgainAtIso);
    if (licensing && !retryDate) return "Denied by the owner. You cannot offer again for this asset.";
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
  if (
    asset.enquiryStatus === "temporarily_denied" &&
    !temporaryDenialExpired(asset)
  ) {
    return styles.discoveryAssetCardDenied;
  }
  return "";
}

function leadParityAssetCardStatusClass(asset: AssetDiscoveryAsset): string {
  if (asset.enquiryStatus === "approved") return leadStyles.leadThreadDone;
  if (asset.enquiryStatus === "pending") return leadStyles.leadThreadActive;
  return leadStyles.leadThreadNew;
}

export default function AssetDiscoveryClient({
  dealerAppMode = false,
  ownerAppMode = false,
  initialOpenAssetId = "",
  initialView = "discovery",
  allowRecentAdverts = true,
}: {
  dealerAppMode?: boolean;
  ownerAppMode?: boolean;
  initialOpenAssetId?: string;
  initialView?: "discovery" | "recently-advertised";
  allowRecentAdverts?: boolean;
} = {}) {
  const mobileStyles = useWebsiteStyles(native_mobileStyles, website_mobileStyles);
  const dealerStyles = useWebsiteStyles(native_dealerStyles, website_dealerStyles);

  const compactAppMode = dealerAppMode || ownerAppMode;
  const requestedOpenAssetId = cleanText(initialOpenAssetId);
  const [activeDiscoveryView, setActiveDiscoveryView] = useState<
    "discovery" | "recently-advertised"
  >(
    allowRecentAdverts &&
      !requestedOpenAssetId &&
      initialView === "recently-advertised"
      ? "recently-advertised"
      : "discovery",
  );
  const preparedOpenAssetIdRef = useRef("");
  const autoOpenedAssetIdRef = useRef("");
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
  const [renewalTiming, setRenewalTiming] = useState("all");
  const [enquiryStatus, setEnquiryStatus] = useState("all");
  const [openFilter, setOpenFilter] = useState<DiscoveryFilterKey | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [showParticipationExclusions, setShowParticipationExclusions] =
    useState(false);
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
  const [access, setAccess] = useState<DiscoveryAccess | null>(null);
  const [isUpdatingParticipation, setIsUpdatingParticipation] = useState(false);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [detailsByAssetId, setDetailsByAssetId] = useState<
    Record<string, DiscoveryAssetDetails>
  >({});
  const [photoIndexByAssetId, setPhotoIndexByAssetId] = useState<
    Record<string, number>
  >({});
  const [photoModal, setPhotoModal] = useState<DiscoveryPhotoModal | null>(
    null,
  );
  const [detailsErrorByAssetId, setDetailsErrorByAssetId] = useState<
    Record<string, string>
  >({});
  const [loadingDetailsAssetId, setLoadingDetailsAssetId] = useState<
    string | null
  >(null);
  const [activeEnquiry, setActiveEnquiry] =
    useState<DiscoveryEnquiryDetail | null>(null);
  const [loadingEnquiryId, setLoadingEnquiryId] = useState<string | null>(null);
  const licensingDiscovery = access?.accountType === "licensing";
  const privateDiscoveryAccess =
    access?.accountType !== "public" && Boolean(access?.canContact);

  useEffect(() => {
    if ((!allowRecentAdverts || licensingDiscovery) && activeDiscoveryView !== "discovery") {
      setActiveDiscoveryView("discovery");
    }
  }, [activeDiscoveryView, allowRecentAdverts, licensingDiscovery]);

  useEffect(() => {
    if (
      !requestedOpenAssetId ||
      preparedOpenAssetIdRef.current === requestedOpenAssetId
    ) {
      return;
    }

    preparedOpenAssetIdRef.current = requestedOpenAssetId;
    autoOpenedAssetIdRef.current = "";
    setSearchInput("");
    setSearch("");
    setProvince("all");
    setType("all");
    setRenewalTiming("all");
    setEnquiryStatus("all");
    setCurrentPage(1);
  }, [requestedOpenAssetId]);

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
    if (!isFilterModalOpen && !isSettingsModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenFilter(null);
        setIsFilterModalOpen(false);
        setIsSettingsModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFilterModalOpen, isSettingsModalOpen]);

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
    if (activeDiscoveryView !== "discovery") return undefined;

    let mounted = true;
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (province !== "all") params.set("province", province);
    if (type !== "all") params.set("type", type);
    if (renewalTiming !== "all") params.set("renewalTiming", renewalTiming);
    if (enquiryStatus !== "all") params.set("status", enquiryStatus);
    if (requestedOpenAssetId) {
      params.set("focusAssetId", requestedOpenAssetId);
    }
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
        const nextAssets = Array.isArray(data.assets) ? data.assets : [];
        const nextAccess = data.access ?? null;

        // A session can expire while this client remains mounted. Clear every
        // privileged cache in the same update that changes the viewer to a
        // public or otherwise non-contactable account so stale contact details
        // and photos cannot remain in the DOM.
        if (
          !nextAccess?.canContact ||
          nextAccess.accountType === "public"
        ) {
          setExpandedAssetId(null);
          setDetailsByAssetId({});
          setPhotoIndexByAssetId({});
          setPhotoModal(null);
          setDetailsErrorByAssetId({});
          setLoadingDetailsAssetId(null);
          setActiveEnquiry(null);
          setLoadingEnquiryId(null);
        }

        setAccess(nextAccess);
        setAssets(nextAssets);
        setProvinceOptions(
          Array.isArray(data.provinceOptions) ? data.provinceOptions : [],
        );
        setTypeOptions(Array.isArray(data.typeOptions) ? data.typeOptions : []);
        setSummary(data.summary ?? EMPTY_SUMMARY);
        setPagination(data.pagination ?? EMPTY_PAGINATION);
        if (data.pagination && data.pagination.page !== currentPage) {
          setCurrentPage(data.pagination.page);
        }

        const requestedAsset = requestedOpenAssetId
          ? nextAssets.find((asset) => asset.id === requestedOpenAssetId)
          : undefined;
        if (
          requestedAsset &&
          autoOpenedAssetIdRef.current !== requestedOpenAssetId
        ) {
          autoOpenedAssetIdRef.current = requestedOpenAssetId;
          void toggleAssetDetails(requestedAsset, data.access);
        }
      } catch (loadError) {
        if (!mounted) return;
        setAccess(null);
        setAssets([]);
        setSummary(EMPTY_SUMMARY);
        setPagination(EMPTY_PAGINATION);
        setExpandedAssetId(null);
        setDetailsByAssetId({});
        setPhotoIndexByAssetId({});
        setPhotoModal(null);
        setDetailsErrorByAssetId({});
        setLoadingDetailsAssetId(null);
        setActiveEnquiry(null);
        setLoadingEnquiryId(null);
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
  }, [
    currentPage,
    pageSize,
    province,
    renewalTiming,
    enquiryStatus,
    refreshVersion,
    requestedOpenAssetId,
    search,
    type,
    activeDiscoveryView,
  ]);

  useEffect(() => {
    if (
      !requestedOpenAssetId ||
      expandedAssetId !== requestedOpenAssetId
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`discovery-details-${requestedOpenAssetId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [expandedAssetId, requestedOpenAssetId]);

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
    renewalTiming !== "all" ||
    enquiryStatus !== "all" ||
    pageSize !== DISCOVERY_PAGE_SIZE;

  const activeDiscoveryFilterLabel = useMemo(() => {
    const labels: string[] = [];
    const selectedType = typeOptions.find((option) => option.value === type);
    const selectedProvince = provinceOptions.find(
      (option) => option.value === province,
    );

    if (selectedType) labels.push(selectedType.label);
    if (selectedProvince) labels.push(selectedProvince.label);
    if (renewalTiming !== "all") {
      labels.push(RENEWAL_TIMING_OPTIONS.find((option) => option.value === renewalTiming)?.label ?? "Renewal date");
    }
    if (enquiryStatus !== "all") {
      labels.push(RENEWAL_STATUS_OPTIONS.find((option) => option.value === enquiryStatus)?.label ?? "Status");
    }
    if (pageSize !== DISCOVERY_PAGE_SIZE) labels.push(`${pageSize} per page`);

    if (!labels.length) return "Filter";
    if (labels.length === 1) return labels[0];
    return `${labels.length} filters`;
  }, [enquiryStatus, pageSize, province, provinceOptions, renewalTiming, type, typeOptions]);

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

  function handleRenewalTimingChange(value: string) {
    setRenewalTiming(value);
    setCurrentPage(1);
  }

  function handleEnquiryStatusChange(value: string) {
    setEnquiryStatus(value);
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
    setRenewalTiming("all");
    setEnquiryStatus("all");
    setPageSize(DISCOVERY_PAGE_SIZE);
    setCurrentPage(1);
    setOpenFilter(null);
  }

  function refreshAssets() {
    setRefreshVersion((current) => current + 1);
  }

  async function updateOwnerDiscoveryParticipation(enabled: boolean) {
    if (isUpdatingParticipation) return;
    setIsUpdatingParticipation(true);
    setNotice(null);

    try {
      const response = await fetch("/api/asset-discovery/participation", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        access?: DiscoveryAccess;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok || !payload.access) {
        throw new Error(
          payload?.error || "Failed to update Discovery participation.",
        );
      }

      setAccess(payload.access);
      setExpandedAssetId(null);
      setDetailsByAssetId({});
      setDetailsErrorByAssetId({});
      setIsSettingsModalOpen(false);
      setNotice({
        tone: "success",
        message: enabled
          ? "Discovery participation enabled."
          : "Discovery disabled. Your assets were removed from Discovery, but remain safely saved in your Asset Register.",
      });
      setRefreshVersion((current) => current + 1);
    } catch (cause) {
      setNotice({
        tone: "error",
        message:
          cause instanceof Error
            ? cause.message
            : "Failed to update Discovery participation.",
      });
    } finally {
      setIsUpdatingParticipation(false);
    }
  }

  async function toggleAssetDetails(
    asset: AssetDiscoveryAsset,
    accessOverride?: DiscoveryAccess,
  ) {
    if (expandedAssetId === asset.id) {
      setExpandedAssetId(null);
      return;
    }

    setExpandedAssetId(asset.id);

    const effectiveAccess = accessOverride ?? access;
    if (effectiveAccess?.accountType === "public") {
      setDetailsByAssetId((current) => ({
        ...current,
        [asset.id]: {
          asset: {
            id: asset.id,
            type: asset.type,
            brand: asset.brand,
            model: asset.model,
            year: asset.year,
            usage: asset.usage,
            condition: asset.condition,
            province: asset.province,
            renewalWindow: "",
          },
          enquiryId: null,
          enquiryStatus: null,
          photosUnlocked: false,
          contactUnlocked: false,
          accessSource: null,
          photoUrls: [],
          ownerContact: null,
        },
      }));
      setLoadingDetailsAssetId(null);
      setDetailsErrorByAssetId((current) => {
        const next = { ...current };
        delete next[asset.id];
        return next;
      });
      return;
    }

    setLoadingDetailsAssetId(asset.id);
    setDetailsErrorByAssetId((current) => {
      const next = { ...current };
      delete next[asset.id];
      return next;
    });

    try {
      const response = await fetch(
        `/api/asset-discovery/assets/${encodeURIComponent(asset.id)}/details`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        details?: DiscoveryAssetDetails;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok || !payload.details) {
        throw new Error(payload?.error || "Asset details are not available.");
      }

      setDetailsByAssetId((current) => ({
        ...current,
        [asset.id]: payload.details as DiscoveryAssetDetails,
      }));
    } catch (cause) {
      setDetailsByAssetId((current) => {
        const next = { ...current };
        delete next[asset.id];
        return next;
      });
      setDetailsErrorByAssetId((current) => ({
        ...current,
        [asset.id]:
          cause instanceof Error
            ? cause.message
            : "Asset details are not available.",
      }));
    } finally {
      setLoadingDetailsAssetId((current) =>
        current === asset.id ? null : current,
      );
    }
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
          <DropdownOverlay className={styles.customFilterMenu} role="listbox" aria-label={ariaLabel}>
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
          </DropdownOverlay>
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
          message: licensingDiscovery
            ? "I can help renew this asset's licence."
            : "",
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
        message:
          licensingDiscovery
            ? "Renewal offer sent. The owner can approve access when they are ready."
            : "Access request sent. The owner will be asked if they are interested in selling.",
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
    if (!privateDiscoveryAccess || !asset.enquiryId || loadingEnquiryId) return;
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
    const pillLabel = statusPillLabel(asset, licensingDiscovery);
    const isProcessing = processingAssetIds.has(asset.id);

    if (access?.accountType === "public") {
      return (
        <button
          type="button"
          className={`${assetStyles.secondaryButton} ${workspaceStyles.actionButton} ${styles.discoveryPublicAction}`}
          title="Sign in to request access from the owner"
          aria-label="Sign in to contact the owner"
          disabled
        >
          Sign in to contact
        </button>
      );
    }

    if (asset.enquiryStatus === "approved" && asset.enquiryId) {
      return (
        <button
          type="button"
          className={
            compactAppMode
              ? `${styles.primaryButton} ${styles.enquireButton}`
              : `${assetStyles.primaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${leadStyles.openLeadButton} ${styles.discoveryPrimaryAction} ${licensingDiscovery ? styles.discoveryRenewalAction : ""}`
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
            compactAppMode
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
            compactAppMode
              ? statusClassName(asset)
              : `${workspaceStyles.actionButton} ${styles.discoveryStatusAction} ${styles.discoveryDeniedAction}`
          }
          title={statusDescription(asset, licensingDiscovery)}
        >
          {pillLabel}
        </span>
      );
    }

    return (
      <button
        type="button"
        className={
          compactAppMode
            ? `${styles.primaryButton} ${styles.enquireButton}`
            : `${assetStyles.primaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${leadStyles.openLeadButton} ${styles.discoveryPrimaryAction} ${licensingDiscovery ? styles.discoveryRenewalAction : ""}`
        }
        onClick={() => handleEnquire(asset)}
        disabled={isProcessing}
      >
        {isProcessing
          ? "Sending..."
          : licensingDiscovery
            ? "Offer renewal help"
            : "Request access"}
      </button>
    );
  }

  function renderDiscoveryOutcome(asset: AssetDiscoveryAsset) {
    if (!licensingDiscovery) return null;
    const label = statusPillLabel(asset, true);
    if (!label) return null;

    return (
      <span className={`${statusClassName(asset)} ${styles.discoveryPipelineStatus}`} title={statusDescription(asset, true)}>
        {label}
      </span>
    );
  }

  function renderOpenControl(asset: AssetDiscoveryAsset) {
    const isExpanded = expandedAssetId === asset.id;
    const isLoading = loadingDetailsAssetId === asset.id;
    const compactClassName = `${styles.discoveryOpenButton} ${
      isExpanded
        ? styles.discoveryCloseButton
        : `${mobileStyles.mobilePrimaryButton} ${mobileStyles.overviewOpenButton} ${styles.discoveryOverviewOpenButton}`
    }`;
    const desktopClassName = `${assetStyles.primaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${leadStyles.openLeadButton} ${styles.discoveryOpenButton} ${isExpanded ? styles.discoveryCloseButton : ""}`;

    return (
      <button
        type="button"
        className={compactAppMode ? compactClassName : desktopClassName}
        onClick={() => void toggleAssetDetails(asset)}
        aria-expanded={isExpanded}
        aria-controls={`discovery-details-${asset.id}`}
        aria-label={
          isExpanded
            ? `Close ${dealerAssetDisplayName(asset)} details`
            : `Open ${dealerAssetDisplayName(asset)} details`
        }
      >
        {isExpanded ? "Close" : isLoading ? "Opening..." : "Open"}
      </button>
    );
  }

  function getDiscoveryPhotoIndex(assetId: string, photoCount: number): number {
    if (!photoCount) return 0;
    return Math.min(
      Math.max(photoIndexByAssetId[assetId] ?? 0, 0),
      photoCount - 1,
    );
  }

  function selectDiscoveryPhoto(
    assetId: string,
    index: number,
    photoCount: number,
  ) {
    if (!photoCount) return;
    setPhotoIndexByAssetId((current) => ({
      ...current,
      [assetId]: Math.min(Math.max(index, 0), photoCount - 1),
    }));
  }

  function cycleDiscoveryPhoto(
    assetId: string,
    direction: -1 | 1,
    photoCount: number,
  ) {
    if (photoCount <= 1) return;
    const currentIndex = getDiscoveryPhotoIndex(assetId, photoCount);
    selectDiscoveryPhoto(
      assetId,
      (currentIndex + direction + photoCount) % photoCount,
      photoCount,
    );
  }

  function openDiscoveryPhotoModal(
    asset: AssetDiscoveryAsset,
    photoUrls: string[],
    index: number,
  ) {
    if (!privateDiscoveryAccess || !photoUrls.length) return;
    setPhotoModal({
      assetId: asset.id,
      title: dealerAssetDisplayName(asset),
      urls: [...photoUrls],
      index: Math.min(Math.max(index, 0), photoUrls.length - 1),
    });
  }

  function renderExpandedAsset(asset: AssetDiscoveryAsset) {
    if (expandedAssetId !== asset.id) return null;
    const details = detailsByAssetId[asset.id];
    const detailsError = detailsErrorByAssetId[asset.id];
    const isLoading = loadingDetailsAssetId === asset.id;
    const photoUrls =
      privateDiscoveryAccess && details?.photosUnlocked
        ? details.photoUrls
        : [];
    const photoIndex = getDiscoveryPhotoIndex(asset.id, photoUrls.length);
    const activePhotoUrl = photoUrls[photoIndex] ?? "";
    const hasMultiplePhotos = photoUrls.length > 1;

    return (
      <div
        id={`discovery-details-${asset.id}`}
        className={`${assetStyles.assetCard} ${leadStyles.leadAssetCard} ${assetStyles.assetCardExpanded} ${styles.discoveryLeadAssetCard} ${compactAppMode ? styles.discoveryExpandedCompact : ""}`}
        aria-label={`${assetDisplayName(asset)} Discovery details`}
      >
        {compactAppMode ? (
          <div className={styles.compactExpandedTop}>
            <div>
              <span>Asset details</span>
              <p>Review the available information before requesting access.</p>
            </div>
            {renderEnquiryControl(asset)}
          </div>
        ) : (
          <div className={`${assetStyles.assetHeader} ${leadStyles.leadAssetHeader}`}>
            <div className={assetStyles.assetTitleBlock}>
              <h2>{dealerAssetDisplayName(asset)}</h2>
              <p>{licensingDiscovery ? licenceRenewalAssetMeta(asset) : dealerAssetMeta(asset)}</p>
              <div className={assetStyles.assetMetaRow}>
                <span className={assetStyles.assetValueMethodLabel}>
                  {cleanText(asset.type) || "Asset"}
                </span>
                <span className={assetStyles.assetSavedDateLabel}>
                  {cleanText(asset.province) || "Location not saved"}
                </span>
              </div>
            </div>

            <div className={`${assetStyles.assetHeaderAside} ${leadStyles.leadAssetHeaderAside}`}>
              <div className={`${assetStyles.assetHeaderActions} ${leadStyles.leadAssetHeaderActions}`}>
                {renderEnquiryControl(asset)}
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className={`${workspaceStyles.emptyState} ${styles.discoveryDetailsLoading}`}>
            Loading protected asset details…
          </div>
        ) : detailsError ? (
          <div className={styles.discoveryDetailsError}>{detailsError}</div>
        ) : details ? (
          <div className={`${assetStyles.assetBody} ${leadStyles.leadAssetBody} ${styles.discoveryLeadAssetBody}`}>
            <div className={`${assetStyles.previewWrap} ${leadStyles.leadPreviewWrap}`}>
              {hasMultiplePhotos ? (
                <div className={`${assetStyles.previewThumbRow} ${leadStyles.leadPreviewThumbRow} ${styles.discoveryPreviewThumbRow}`}>
                  {photoUrls.map((photoUrl, index) => (
                    <button
                      type="button"
                      key={`${asset.id}-discovery-photo-${index}`}
                      className={`${assetStyles.previewThumbButton} ${leadStyles.leadPreviewThumbButton} ${index === photoIndex ? assetStyles.previewThumbButtonActive : ""}`}
                      onClick={() => {
                        selectDiscoveryPhoto(asset.id, index, photoUrls.length);
                        openDiscoveryPhotoModal(asset, photoUrls, index);
                      }}
                      aria-label={`Open photo ${index + 1}`}
                    >
                      <img
                        src={photoUrl}
                        alt={`${assetDisplayName(asset)} thumbnail ${index + 1}`}
                        className={`${assetStyles.previewThumbImage} ${leadStyles.leadPreviewThumbImage}`}
                      />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className={`${assetStyles.previewStage} ${leadStyles.leadPreviewStage} ${styles.discoveryPreviewStage}`}>
                {activePhotoUrl ? (
                  <>
                    <button
                      type="button"
                      className={leadStyles.leadPreviewOpenButton}
                      onClick={() =>
                        openDiscoveryPhotoModal(asset, photoUrls, photoIndex)
                      }
                      aria-label={`Open ${assetDisplayName(asset)} photo ${photoIndex + 1}`}
                    >
                      <img
                        src={activePhotoUrl}
                        alt={`${assetDisplayName(asset)} photo ${photoIndex + 1}`}
                        className={`${assetStyles.previewImage} ${leadStyles.leadPreviewImage}`}
                      />
                      <span className={leadStyles.leadPreviewOpenLabel}>Open photo</span>
                    </button>

                    {hasMultiplePhotos ? (
                      <>
                        <button
                          type="button"
                          className={`${assetStyles.previewNavButton} ${assetStyles.previewNavPrev}`}
                          onClick={() =>
                            cycleDiscoveryPhoto(asset.id, -1, photoUrls.length)
                          }
                          aria-label="Show previous photo"
                        >
                          <ChevronLeftIcon className={assetStyles.buttonIcon} />
                        </button>
                        <button
                          type="button"
                          className={`${assetStyles.previewNavButton} ${assetStyles.previewNavNext}`}
                          onClick={() =>
                            cycleDiscoveryPhoto(asset.id, 1, photoUrls.length)
                          }
                          aria-label="Show next photo"
                        >
                          <ChevronRightIcon className={assetStyles.buttonIcon} />
                        </button>
                        <div className={assetStyles.previewCounter}>
                          {photoIndex + 1} / {photoUrls.length}
                        </div>
                      </>
                    ) : null}
                  </>
                ) : details.photosUnlocked ? (
                  <div className={`${assetStyles.previewPlaceholder} ${styles.discoveryPreviewPlaceholder}`}>
                    <div className={assetStyles.previewPlaceholderBadges}>
                      <span className={`${assetStyles.badge} ${assetStyles.badgeNeutral} ${assetStyles.previewPlaceholderBadge}`}>
                        No photos saved
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={`${assetStyles.previewPlaceholder} ${styles.discoveryPreviewPlaceholder} ${styles.discoveryPreviewLocked}`}>
                    <div className={styles.discoveryLockedArtwork} aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className={styles.discoveryLockedMedia}>
                      <strong>Photos are locked</strong>
                      <span>No private image was sent to your browser.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={assetStyles.assetDetailDivider} aria-hidden="true" />

            <div className={`${assetStyles.assetDetailsPanel} ${styles.discoveryDetailsPanel}`}>
              <div className={`${assetStyles.assetDetailsGrid} ${styles.discoveryDetailsGrid}`}>
                <div className={`${assetStyles.assetPrimaryDetails} ${styles.discoveryDetailGroup}`}>
                  {[
                    ["Asset type", details.asset.type],
                    ["Brand", details.asset.brand],
                    ["Model", details.asset.model],
                    ["Year", details.asset.year],
                  ].map(([label, value]) => (
                    <div className={`${assetStyles.assetDetailRow} ${styles.discoveryDetailRow}`} key={`${asset.id}-${label}`}>
                      <span>{label}</span>
                      <strong>{value || "Not saved"}</strong>
                    </div>
                  ))}
                </div>

                <div className={`${assetStyles.assetPrimaryDetails} ${styles.discoveryDetailGroup}`}>
                  {[
                    ["Usage", details.asset.usage],
                    ["Condition", details.asset.condition],
                    ["Province", details.asset.province],
                    ...(licensingDiscovery
                      ? [["Renewal", details.asset.renewalWindow]]
                      : []),
                    [
                      "Enquiry",
                      statusPillLabel(asset) || "Contact not requested",
                    ],
                  ].map(([label, value]) => (
                    <div className={`${assetStyles.assetDetailRow} ${styles.discoveryDetailRow}`} key={`${asset.id}-${label}`}>
                      <span>{label}</span>
                      <strong>{value || "Not saved"}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.discoveryAccessNote}>
                <strong>
                  {access?.accountType === "public"
                    ? "Sign in to request access."
                    : details.accessSource === "dealer_share"
                    ? "Photos open through an existing direct share."
                    : details.accessSource === "approved_enquiry"
                      ? "Owner-approved Discovery access."
                      : licensingDiscovery
                        ? "Offer renewal help. Exact details remain private until the owner approves."
                        : "Request access to ask whether the owner is interested in selling."}
                </strong>
                <span>
                  {access?.accountType === "public"
                    ? "Photos and contact details stay private until the owner approves your request."
                    : statusDescription(asset) ||
                    "No contact details are shared unless the owner approves your request."}
                </span>
              </div>

              {privateDiscoveryAccess && details.ownerContact ? (
                <div className={styles.discoveryInlineContact}>
                  <div>
                    <span>Owner or business</span>
                    <strong>
                      {details.ownerContact.businessName ||
                        details.ownerContact.name ||
                        "Not supplied"}
                    </strong>
                  </div>
                  <div>
                    <span>Phone</span>
                    <strong>{details.ownerContact.phone || "Not supplied"}</strong>
                  </div>
                  <div>
                    <span>Email</span>
                    <strong>{details.ownerContact.email || "Not supplied"}</strong>
                  </div>
                  <div>
                    <span>Location</span>
                    <strong>
                      {details.ownerContact.location || "Not supplied"}
                    </strong>
                  </div>
                </div>
              ) : access?.accountType === "public" ? (
                <div
                  className={`${styles.discoveryInlineContact} ${styles.discoveryPublicContactPreview}`}
                  aria-label="Private contact details are hidden"
                >
                  {[
                    ["Owner or business", "Private owner"],
                    ["Phone", "000 000 0000"],
                    ["Email", "private@example.com"],
                    ["Location", "Private location"],
                  ].map(([label, placeholder]) => (
                    <div key={`${asset.id}-${label}`}>
                      <span>{label}</span>
                      <strong aria-hidden="true">{placeholder}</strong>
                    </div>
                  ))}
                  <p>Sign in and request access to reveal approved contact details.</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {compactAppMode ? (
          <div className={styles.discoveryExpandedFooter}>
            <button
              type="button"
              className={styles.discoveryCloseDetailsButton}
              onClick={() => void toggleAssetDetails(asset)}
            >
              <CloseIcon className={styles.buttonIcon} />
              Close details
            </button>
          </div>
        ) : null}
      </div>
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
                  <DropdownOverlay
                    className={styles.discoveryPageSizeMenu}
                    matchAnchorWidth={false}
                    minimumWidth={160}
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
                  </DropdownOverlay>
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

  function changeDiscoveryView(
    nextView: "discovery" | "recently-advertised",
  ) {
    if (nextView === "recently-advertised" && !allowRecentAdverts) return;
    setActiveDiscoveryView(nextView);
    setExpandedAssetId(null);
    setActiveEnquiry(null);
    setPhotoModal(null);
    setNotice(null);

    if (!compactAppMode && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (nextView === "recently-advertised") {
        url.searchParams.set("view", "recently-advertised");
        url.searchParams.delete("openAsset");
      } else {
        url.searchParams.delete("view");
      }
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }

  function renderDiscoveryViewSwitch() {
    if (!allowRecentAdverts || licensingDiscovery) return null;

    return (
      <section className={styles.discoveryViewSwitch} aria-label="Choose a Discovery view">
        <div className={styles.discoveryViewSwitchCopy}>
          <strong>Explore more equipment</strong>
          <span>
            Browse available assets or recent Marketplace adverts.
          </span>
        </div>
        <div className={styles.discoveryViewSwitchButtons} role="group" aria-label="Discovery views">
          <button
            type="button"
            aria-pressed={activeDiscoveryView === "discovery"}
            className={activeDiscoveryView === "discovery" ? styles.discoveryViewSwitchActive : ""}
            onClick={() => changeDiscoveryView("discovery")}
          >
            Available assets
          </button>
          <button
            type="button"
            aria-pressed={activeDiscoveryView === "recently-advertised"}
            className={activeDiscoveryView === "recently-advertised" ? styles.discoveryViewSwitchActive : ""}
            onClick={() => changeDiscoveryView("recently-advertised")}
          >
            Recently advertised
          </button>
        </div>
      </section>
    );
  }

  if (activeDiscoveryView === "recently-advertised" && allowRecentAdverts) {
    return (
      <section className={`${workspaceStyles.shell} ${styles.shell} ${compactAppMode ? `${dealerStyles.dealerDiscoverySurface} ${styles.compactAppSurface}` : ""}`}>
        {compactAppMode ? (
          <div className={`${mobileStyles.overviewIntro} ${styles.discoveryOverviewIntro}`}>
            <h1>Discovery</h1>
            <p>Find equipment through owner assets and recent Marketplace advertisers.</p>
          </div>
        ) : (
          <WorkspaceTitlePanel title="Discover Assets" />
        )}
        {renderDiscoveryViewSwitch()}
        <RecentlyAdvertisedClient compactAppMode={compactAppMode} />
      </section>
    );
  }

  if (
    access?.accountType === "owner" &&
    !access.canBrowse &&
    !loading
  ) {
    const participationDisabled =
      access.reason === "participation_disabled";

    return (
      <section
        className={`${workspaceStyles.shell} ${styles.shell}`}
        aria-label="Discovery participation required"
      >
        <WorkspaceTitlePanel title="Discover Assets" />

        {renderDiscoveryViewSwitch()}

        {notice ? (
          <div
            className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}
          >
            {notice.message}
          </div>
        ) : null}

        <section className={styles.discoveryAccessPanel}>
          <div className={styles.discoveryAccessIcon} aria-hidden="true">
            <DiscoveryParticipationIcon
              className={styles.discoveryAccessIconGraphic}
            />
          </div>
          <div className={styles.discoveryAccessIntro}>
            <h2>
              {participationDisabled
                ? "Participate to browse Discovery"
                : "Add an eligible asset first"}
            </h2>
            <p>
              {participationDisabled
                ? "Join the owner-to-owner Discovery exchange. Your eligible machinery becomes discoverable while you browse assets shared by other participating owners."
                : "Participation is enabled, but Discovery needs at least one eligible Aim4price asset in your Asset Register before you can browse."}
            </p>
          </div>

          {participationDisabled ? (
            <div className={styles.discoveryAccessPrivacy}>
              <strong>Your details stay private.</strong>
              <span>
                No contact details are shared immediately. Every interested
                user must send a request, and you decide whether to approve it.
              </span>
            </div>
          ) : null}

          <div className={styles.discoveryAccessActions}>
            {participationDisabled ? (
              <>
                <button
                  type="button"
                  className={`${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${styles.discoveryParticipationButton}`}
                  onClick={() =>
                    void updateOwnerDiscoveryParticipation(true)
                  }
                  disabled={isUpdatingParticipation}
                >
                  {isUpdatingParticipation
                    ? "Enabling…"
                    : "Enable Discovery participation"}
                  <ChevronRightIcon
                    className={styles.discoveryParticipationButtonIcon}
                  />
                </button>
                <button
                  type="button"
                  className={`${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral} ${styles.discoveryExclusionsButton}`}
                  onClick={() =>
                    setShowParticipationExclusions((current) => !current)
                  }
                  aria-expanded={showParticipationExclusions}
                  aria-controls="discovery-participation-exclusions"
                >
                  {showParticipationExclusions
                    ? "Hide exclusions"
                    : "View exclusions"}
                  <ChevronDownIcon
                    className={`${styles.buttonIcon} ${showParticipationExclusions ? styles.discoveryExclusionsChevronOpen : ""}`}
                  />
                </button>
              </>
            ) : (
              <>
                <a
                  href={ownerAppMode ? "/owner-app/assets" : "/asset-register"}
                  className={`${workspaceStyles.actionButton} ${workspaceStyles.actionGreen}`}
                >
                  Open Asset Register
                </a>
                <a
                  href={ownerAppMode ? "/owner-app/valuation" : "/valuation"}
                  className={`${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral}`}
                >
                  Get an estimate
                </a>
              </>
            )}
          </div>

          {participationDisabled && showParticipationExclusions ? (
            <div
              id="discovery-participation-exclusions"
              className={styles.discoveryExclusions}
            >
              <strong>Assets not included in Discovery</strong>
              <ul>
                <li>Property, land and buildings</li>
                <li>Fixed improvements and property-related structures</li>
                <li>Manual or unclassified entries</li>
                <li>Tools and small loose equipment</li>
              </ul>
            </div>
          ) : null}

          <small>
            Discovery includes eligible machinery and equipment only. Recently
            advertised Marketplace equipment is available through the separate
            view above; maintenance sharing remains separate.
          </small>
        </section>
      </section>
    );
  }

  return (
    <section className={`${workspaceStyles.shell} ${styles.shell} ${compactAppMode ? `${dealerStyles.dealerDiscoverySurface} ${styles.compactAppSurface}` : ""}`}>
      {compactAppMode ? (
        <div className={`${mobileStyles.overviewIntro} ${styles.discoveryOverviewIntro}`}>
          <h1>{licensingDiscovery ? "Renewal Discovery" : "Discovery"}</h1>
          <p>
            {licensingDiscovery
              ? "Find upcoming licence renewals and offer owners help."
              : "Browse available machinery and request access from owners."}
          </p>
        </div>
      ) : (
        <WorkspaceTitlePanel
          title={licensingDiscovery ? "Renewal Discovery" : "Discover Assets"}
        />
      )}

      {renderDiscoveryViewSwitch()}

      <section
        className={styles.controlsPanel}
        aria-label="Asset Discovery controls"
      >
        {!compactAppMode ? (
          <section
            className={`${assetStyles.summaryRow} ${assetStyles.heroSummaryRow} ${leadStyles.leadSummaryRow}`}
            aria-label="Asset Discovery summary"
          >
            <article
              className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${leadStyles.leadOwnerSummaryCard} ${leadStyles.leadOwnerSummaryCardNew}`}
            >
              <div className={assetStyles.heroSummaryHead}>
                <span className={`${assetStyles.heroSummaryTitle} ${leadStyles.leadOwnerSummaryText}`}>
                  {licensingDiscovery ? "Upcoming renewals" : "Available assets"}
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
                  {licensingDiscovery ? "Due within 30 days" : "Asset types"}
                </span>
              </div>
              <div className={assetStyles.heroSummaryValueRow}>
                <strong className={`${assetStyles.heroSummaryValue} ${leadStyles.leadOwnerSummaryText}`}>
                  {licensingDiscovery ? summary.dueSoonCount : summary.typeCount}
                </strong>
              </div>
              <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${leadStyles.leadOwnerSummaryFooter}`}>
                <small className={leadStyles.leadOwnerSummaryText}>
                  {licensingDiscovery
                    ? "Renewals approaching in the next 30 days."
                    : "Asset families represented in these results."}
                </small>
              </div>
            </article>

            <article
              className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${leadStyles.leadOwnerSummaryCard} ${leadStyles.leadOwnerSummaryCardDone}`}
            >
              <div className={assetStyles.heroSummaryHead}>
                <span className={`${assetStyles.heroSummaryTitle} ${leadStyles.leadOwnerSummaryText}`}>
                  {licensingDiscovery ? "Overdue" : "Provinces"}
                </span>
              </div>
              <div className={assetStyles.heroSummaryValueRow}>
                <strong className={`${assetStyles.heroSummaryValue} ${leadStyles.leadOwnerSummaryText}`}>
                  {licensingDiscovery ? summary.overdueCount : summary.provinceCount}
                </strong>
              </div>
              <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${leadStyles.leadOwnerSummaryFooter}`}>
                <small className={leadStyles.leadOwnerSummaryText}>
                  {licensingDiscovery
                    ? "Renewal dates that have already passed."
                    : "Saved owner provinces represented."}
                </small>
              </div>
            </article>
          </section>
        ) : null}

        {compactAppMode ? (
          <section
            className={`${workspaceStyles.controlsRow} ${styles.toolbar}`}
            aria-label="Search and filter Asset Discovery"
          >
            <label className={`${mobileStyles.overviewSearch} ${workspaceStyles.searchField} ${styles.searchBox} ${styles.discoveryOverviewSearch}`}>
              <SearchIcon className={styles.searchIcon} />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search brand, model or type"
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

            <div className={styles.discoveryFilterRow}>
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
            </div>
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
                className={`${assetStyles.secondaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral} ${leadStyles.leadRefreshButton} ${styles.discoveryRefreshButton} ${access?.accountType === "owner" ? styles.ownerDiscoveryRefreshButton : ""}`}
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
              </button>

              {access?.accountType === "owner" ? (
                <button
                  type="button"
                  className={`${assetStyles.primaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${styles.discoverySettingsButton}`}
                  onClick={() => setIsSettingsModalOpen(true)}
                  disabled={loading || isUpdatingParticipation}
                >
                  <span className={styles.discoverySettingsIcon}>
                    <SettingsIcon />
                  </span>
                  <span>Settings</span>
                </button>
              ) : null}
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
        compactAppMode ? (
          <div
            className={`${mobileStyles.overviewSectionHeading} ${styles.discoverySectionHeading}`}
          >
            <h2>{licensingDiscovery ? "Upcoming renewals" : "Available assets"}</h2>
            <span aria-label={`${pagination.totalItems} ${licensingDiscovery ? "renewals" : "available assets"}`}>
              {pagination.totalItems}
            </span>
          </div>
        ) : (
          <div className={leadStyles.leadResultSummary}>
            <span>Showing</span>
            <strong>{pagination.totalItems}</strong>
            <span>{licensingDiscovery ? "renewals" : "assets"} for the current search and filters</span>
          </div>
        )
      ) : null}

      <section
        className={
          compactAppMode
            ? `${mobileStyles.overviewList} ${styles.cardStack}`
            : leadStyles.leadStack
        }
        aria-label="Asset Discovery assets"
      >
        {loading ? (
          <div className={`${workspaceStyles.emptyState} ${styles.emptyState}`}>
            Loading Asset Discovery...
          </div>
        ) : !error && assets.length ? (
          assets.map((asset) => {
            return compactAppMode ? (
              <article
                key={asset.id}
                className={`${workspaceStyles.card} ${mobileStyles.overviewCard} ${styles.assetCard} ${styles.dealerAssetCard} ${assetCardStatusClass(asset)} ${licensingDiscovery && asset.renewalTiming === "later" ? styles.discoveryFutureCard : ""} ${expandedAssetId && expandedAssetId !== asset.id ? styles.discoveryCardMuted : ""}`}
              >
                <div className={`${styles.assetCardHeader} ${styles.dealerAssetCardHeader}`}>
                  <div className={styles.assetIdentity}>
                    <div className={`${mobileStyles.overviewCardLabels} ${styles.discoveryCardLabels}`}>
                      <span className={styles.discoveryTypeLabel}>
                        {cleanText(asset.type) || "Asset"}
                      </span>
                      <span className={styles.discoveryLocationLabel}>
                        {cleanText(asset.province) || "Location not saved"}
                      </span>
                    </div>
                    <h2>{dealerAssetDisplayName(asset)}</h2>
                    <p className={styles.dealerAssetMeta}>
                      {(licensingDiscovery ? licenceRenewalAssetMeta(asset) : dealerAssetMeta(asset)).split(" • ").map((detail, index) => <span key={index}>{detail}</span>)}
                    </p>
                  </div>

                  <div className={styles.assetActionRow}>
                    {renderDiscoveryOutcome(asset)}
                    {renderOpenControl(asset)}
                  </div>
                </div>
                {renderExpandedAsset(asset)}
              </article>
            ) : (
              <article
                key={asset.id}
                className={`${workspaceStyles.card} ${leadStyles.leadThread} ${leadParityAssetCardStatusClass(asset)} ${licensingDiscovery && asset.renewalTiming === "later" ? styles.discoveryFutureCard : ""} ${expandedAssetId === asset.id ? leadStyles.leadThreadOpen : ""} ${expandedAssetId && expandedAssetId !== asset.id ? styles.discoveryCardMuted : ""} ${
                  asset.enquiryStatus === "temporarily_denied" &&
                  !temporaryDenialExpired(asset)
                    ? styles.discoveryAssetCardDenied
                    : ""
                }`}
              >
                <div className={leadStyles.clientPanel}>
                  <div className={leadStyles.clientPanelHeader}>
                    <div className={leadStyles.clientIdentity}>
                      <h3>{dealerAssetDisplayName(asset)}</h3>
                      <strong className={leadStyles.leadAssetName}>
                        {licensingDiscovery ? licenceRenewalAssetMeta(asset) : dealerAssetMeta(asset)}
                      </strong>
                      <span className={leadStyles.clientKicker}>
                        {[cleanText(asset.type) || "Asset", cleanText(asset.province) || "Location not saved"].join(" · ")}
                      </span>
                      {licensingDiscovery && asset.renewalTiming === "later" ? (
                        <span className={styles.discoveryFutureNote}>More than 6 months away</span>
                      ) : null}
                    </div>

                    <div className={leadStyles.clientDecisionArea}>
                      <div className={leadStyles.clientActionRow}>
                        {renderDiscoveryOutcome(asset)}
                        {renderOpenControl(asset)}
                      </div>
                    </div>
                  </div>
                </div>
                {renderExpandedAsset(asset)}
              </article>
            );
          })
        ) : !error ? (
          <div className={`${workspaceStyles.emptyState} ${styles.emptyState}`}>
            No {licensingDiscovery ? "renewals" : "assets"} match this search or filter.
          </div>
        ) : null}
      </section>

      {renderPagination()}

      {privateDiscoveryAccess && photoModal ? (
        <LeadPhotoViewerModal
          assetKey={`discovery-${photoModal.assetId}`}
          title={photoModal.title}
          urls={photoModal.urls}
          initialIndex={photoModal.index}
          onClose={() => setPhotoModal(null)}
          closeButtonClassName={styles.discoveryPhotoCloseButton}
        />
      ) : null}

      {!compactAppMode && isFilterModalOpen ? (
        <div className={`${assetStyles.modalOverlay} ${workspaceStyles.modalOverlay}`} data-website-overlay>
          <div className={assetStyles.modalBackdrop} data-website-overlay onClick={closeDiscoveryFilterModal} />

          <div
            className={`${assetStyles.modalCard} ${workspaceStyles.modal} ${leadStyles.leadFilterModal} ${styles.discoveryFilterModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discovery-filter-title"
            aria-describedby="discovery-filter-description"
          >
            <div
              className={`${assetStyles.modalHeader} ${workspaceStyles.modalHeader} ${leadStyles.leadFilterHeader} ${styles.discoveryFilterHeader}`}
            >
              <div
                className={`${assetStyles.modalHeaderText} ${styles.discoveryFilterHeaderCopy}`}
              >
                <h3 id="discovery-filter-title">Choose which assets to show</h3>
                <p
                  id="discovery-filter-description"
                  className={leadStyles.leadFilterIntro}
                >
                  {licensingDiscovery
                    ? "Filter renewals by asset, location, timing or opportunity status."
                    : "Filter Discovery by equipment type, owner province or page size."}
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

              {licensingDiscovery ? (
                <>
                  <DiscoveryFilterDropdown
                    label="Renewal timing"
                    filterKey="renewalTiming"
                    value={renewalTiming}
                    options={RENEWAL_TIMING_OPTIONS}
                    openFilter={openFilter}
                    onOpenChange={setOpenFilter}
                    onChange={handleRenewalTimingChange}
                  />

                  <DiscoveryFilterDropdown
                    label="Opportunity status"
                    filterKey="status"
                    value={enquiryStatus}
                    options={RENEWAL_STATUS_OPTIONS}
                    openFilter={openFilter}
                    onOpenChange={setOpenFilter}
                    onChange={handleEnquiryStatusChange}
                  />
                </>
              ) : null}

              <div className={styles.discoveryFilterWideField}>
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

      {!compactAppMode &&
      access?.accountType === "owner" &&
      isSettingsModalOpen ? (
        <div
          className={`${assetStyles.modalOverlay} ${workspaceStyles.modalOverlay}`} data-website-overlay
        >
          <div
            className={assetStyles.modalBackdrop} data-website-overlay
            onClick={() => setIsSettingsModalOpen(false)}
          />

          <div
            className={`${assetStyles.modalCard} ${workspaceStyles.modal} ${styles.discoverySettingsModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discovery-settings-title"
            aria-describedby="discovery-settings-description"
          >
            <div
              className={`${assetStyles.modalHeader} ${workspaceStyles.modalHeader} ${styles.discoverySettingsHeader}`}
            >
              <div
                className={`${assetStyles.modalHeaderText} ${styles.discoverySettingsHeaderCopy}`}
              >
                <h3 id="discovery-settings-title">Discovery settings</h3>
                <p id="discovery-settings-description">
                  Manage how your eligible assets appear in owner Discovery.
                </p>
              </div>

              <button
                type="button"
                className={`${assetStyles.modalCloseButton} ${workspaceStyles.modalClose}`}
                onClick={() => setIsSettingsModalOpen(false)}
                aria-label="Close Discovery settings"
              >
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div
              className={`${workspaceStyles.modalBody} ${styles.discoverySettingsBody}`}
            >
              <div className={styles.discoverySettingsStatus}>
                <span
                  className={styles.discoverySettingsStatusIcon}
                  aria-hidden="true"
                >
                  <StatusCheckIcon
                    className={styles.discoverySettingsDialogIcon}
                  />
                </span>
                <div className={styles.discoverySettingsStatusCopy}>
                  <span className={styles.discoverySettingsEyebrow}>
                    Current status
                  </span>
                  <strong>Discovery participation is enabled</strong>
                  <p>
                    {access.eligibleAssetCount} eligible{" "}
                    {access.eligibleAssetCount === 1
                      ? "asset is"
                      : "assets are"}{" "}
                    currently participating.
                  </p>
                </div>
              </div>

              <div className={styles.discoverySettingsWarning}>
                <div className={styles.discoverySettingsWarningHeader}>
                  <span
                    className={styles.discoverySettingsWarningIcon}
                    aria-hidden="true"
                  >
                    <WarningIcon
                      className={styles.discoverySettingsDialogIcon}
                    />
                  </span>
                  <div className={styles.discoverySettingsWarningCopy}>
                    <span className={styles.discoverySettingsEyebrow}>
                      Before you continue
                    </span>
                    <strong>Disable Discovery and remove my assets</strong>
                    <p
                      id="discovery-disable-impact"
                      className={styles.discoverySettingsWarningIntro}
                    >
                      These changes take effect immediately:
                    </p>
                  </div>
                </div>
                <ul className={styles.discoverySettingsConsequences}>
                  <li>Your eligible assets will be removed from Discovery.</li>
                  <li>Active requests and approved access will be revoked.</li>
                  <li>
                    Browsing other owners&apos; assets will be paused until you
                    enable participation again.
                  </li>
                </ul>

                <div className={styles.discoverySettingsAssurance}>
                  <StatusCheckIcon
                    className={styles.discoverySettingsAssuranceIcon}
                  />
                  <div>
                    <strong>Your Asset Register stays intact</strong>
                    <p>Nothing is deleted from your Asset Register.</p>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`${assetStyles.formActions} ${workspaceStyles.modalFooter} ${styles.discoverySettingsActions}`}
            >
              <button
                type="button"
                className={`${assetStyles.secondaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral}`}
                onClick={() => setIsSettingsModalOpen(false)}
                disabled={isUpdatingParticipation}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${workspaceStyles.actionButton} ${workspaceStyles.actionDanger} ${styles.discoveryDisableButton}`}
                onClick={() =>
                  void updateOwnerDiscoveryParticipation(false)
                }
                disabled={isUpdatingParticipation}
              >
                {isUpdatingParticipation
                  ? "Disabling…"
                  : "Disable & remove assets"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {privateDiscoveryAccess && activeEnquiry ? (
        <div
          className={`${workspaceStyles.modalOverlay} ${styles.contactOverlay} ${compactAppMode ? styles.discoveryAppOverlay : ""}`}
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
              {activeEnquiry.ownerContact?.phone && cleanPhoneForWhatsApp(activeEnquiry.ownerContact.phone) ? (
                <a
                  className={`${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${styles.contactPrimaryAction}`}
                  href={ownerWhatsAppHref(activeEnquiry.ownerContact, activeEnquiry.asset)}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  aria-label="WhatsApp owner (opens in a new tab)"
                >
                  <WhatsAppIcon className={styles.contactActionIcon} />
                  WhatsApp owner
                </a>
              ) : null}
              {activeEnquiry.ownerContact?.phone ? (
                <a
                  className={`${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral} ${styles.contactSecondaryAction}`}
                  href={`tel:${activeEnquiry.ownerContact.phone}`}
                >
                  Call owner
                </a>
              ) : null}
              {activeEnquiry.ownerContact?.email ? (
                <a
                  className={`${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral} ${styles.contactSecondaryAction}`}
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
