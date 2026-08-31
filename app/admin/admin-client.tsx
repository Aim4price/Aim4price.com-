"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AdminNavigation from "../../components/AdminNavigation";
import { clearCachedHeaderSession } from "../../lib/header-session-cache";
import styles from "./page.module.css";

type AccountStatus = "pending_payment" | "active" | "suspended";

type AdminUserRow = {
  userId: string;
  name: string;
  email: string;
  phone: string;
  accountType: string;
  accountSubtype: string;
  province: string;
  introducedBy: string;
  introducedByOption: string;
  introducedByName: string;
  accountStatus: AccountStatus;
  accountStatusLabel: string;
  passwordStatus: "Set" | "Not set";
  lastActiveAtIso: string | null;
  createdAtIso: string | null;
  storageBytes: number;
  storageLabel: string;
  storageGigabytesLabel: string;
  storageFileCount: number;
  postgresStorageBytes: number;
  postgresStorageLabel: string;
  bucketStorageBytes: number;
  bucketStorageLabel: string;
};

type ApiResponse = {
  ok: boolean;
  users?: AdminUserRow[];
  sentCount?: number;
  message?: string;
  error?: string;
  redirectUrl?: string;
};

type QrLabelLayout = "full-labels-10-per-page" | "small-qr-25mm";

type QrLabelAsset = {
  id: string;
  title: string;
  plateLabel: string;
  publicAssetCode: string;
  kind: string;
  registerName: string;
  hasQr: boolean;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

type QrLabelsResponse = {
  ok: boolean;
  userEmail?: string;
  assets?: QrLabelAsset[];
  error?: string;
};

type QrModalState = {
  user: AdminUserRow;
  assets: QrLabelAsset[];
  selectedAssetIds: string[];
  layout: QrLabelLayout;
  assetSearchTerm: string;
  isLoading: boolean;
  isGenerating: boolean;
  error: string;
} | null;

type AssetNamePreviewStatus =
  "changed" | "unchanged" | "warning" | "error" | "committed";

type AssetNamePreviewRow = {
  rowNumber: number;
  assetId: string;
  registerId: string;
  registerName: string;
  publicAssetCode: string;
  equipment: string;
  yearModel: string;
  usage: string;
  currentAssetTitle: string;
  newAssetTitle: string;
  currentBrand: string;
  newBrand: string;
  currentModel: string;
  newModel: string;
  status: AssetNamePreviewStatus;
  message: string;
};

type AssetNamePreviewSummary = {
  uploadedRows: number;
  matchedRows: number;
  changedRows: number;
  unchangedRows: number;
  skippedRows: number;
  errorRows: number;
  committedRows: number;
};

type AssetNamePreview = {
  summary: AssetNamePreviewSummary;
  rows: AssetNamePreviewRow[];
};

type AssetNamePreviewResponse = {
  ok: boolean;
  preview?: AssetNamePreview;
  error?: string;
};

type AssetNameCommitResponse = {
  ok: boolean;
  result?: AssetNamePreview;
  error?: string;
};

type AssetNameModalState = {
  user: AdminUserRow;
  preview: AssetNamePreview | null;
  uploadedFileName: string;
  isDownloading: boolean;
  isUploading: boolean;
  isCommitting: boolean;
  didCommit: boolean;
  error: string;
  success: string;
} | null;

type AdminAction =
  | "activate"
  | "pending"
  | "suspend"
  | "send_reset"
  | "send_notification"
  | "open_account"
  | "delete_user";

type Notice = {
  tone: "success" | "error";
  message: string;
} | null;

type NotificationPriority = "normal" | "priority";
type NotificationAudience =
  | "all"
  | "owner"
  | "dealer"
  | "insurance"
  | "finance"
  | "licensing";

type NotificationComposerState = {
  userId: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  error: string;
} | null;

type GroupNotificationComposerState = {
  audience: NotificationAudience;
  title: string;
  body: string;
  priority: NotificationPriority;
  confirmed: boolean;
  error: string;
} | null;

const SOUTH_AFRICAN_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
] as const;

type SignupDateFilter = "all" | "week" | "month" | "year";
type AccountSort = "newest" | "storage" | "recent" | "name";
type ProvinceName = (typeof SOUTH_AFRICAN_PROVINCES)[number];
type ProvinceFilter = "all" | "__unknown__" | ProvinceName;

const ADMIN_PAGE_SIZE = 25;
const DEFAULT_NOTIFICATION_TITLE = "Message from Aim4price";
const MAX_NOTIFICATION_TITLE_LENGTH = 120;
const MAX_NOTIFICATION_BODY_LENGTH = 1_200;
const NOTIFICATION_AUDIENCE_OPTIONS: Array<{
  value: NotificationAudience;
  label: string;
}> = [
  { value: "all", label: "All accounts" },
  { value: "owner", label: "Owners" },
  { value: "dealer", label: "Dealers" },
  { value: "insurance", label: "Insurance" },
  { value: "finance", label: "Finance & accounting" },
  { value: "licensing", label: "Licensing" },
];

function normalizeNotificationAudience(
  value: string,
): Exclude<NotificationAudience, "all"> {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "dealer" ||
    normalized === "insurance" ||
    normalized === "finance" ||
    normalized === "licensing"
  ) {
    return normalized;
  }

  return "owner";
}

function NotificationPriorityPicker({
  value,
  onChange,
  disabled,
}: {
  value: NotificationPriority;
  onChange: (value: NotificationPriority) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className={styles.notificationPriorityPicker} disabled={disabled}>
      <legend>Priority</legend>
      <div>
        <button
          type="button"
          className={
            value === "normal" ? styles.notificationPrioritySelected : ""
          }
          onClick={() => onChange("normal")}
          aria-pressed={value === "normal"}
        >
          <strong>Normal</strong>
        </button>
        <button
          type="button"
          className={
            value === "priority"
              ? `${styles.notificationPrioritySelected} ${styles.notificationPriorityUrgent}`
              : ""
          }
          onClick={() => onChange("priority")}
          aria-pressed={value === "priority"}
        >
          <strong>Priority</strong>
        </button>
      </div>
    </fieldset>
  );
}

const QR_LAYOUT_OPTIONS: Array<{
  value: QrLabelLayout;
  title: string;
}> = [
  {
    value: "full-labels-10-per-page",
    title: "10 full labels per page",
  },
  {
    value: "small-qr-25mm",
    title: "Small 25mm QR labels",
  },
];

const SIGNUP_DATE_FILTER_LABELS: Record<SignupDateFilter, string> = {
  all: "All signups",
  week: "This week",
  month: "This month",
  year: "This year",
};

const ACCOUNT_SORT_LABELS: Record<AccountSort, string> = {
  newest: "Newest accounts",
  storage: "Most storage",
  recent: "Recently active",
  name: "Account name",
};

const PROVINCE_FILTER_OPTIONS: Array<{ value: ProvinceFilter; label: string }> =
  [
    { value: "all", label: "All provinces" },
    ...SOUTH_AFRICAN_PROVINCES.map((province) => ({
      value: province,
      label: province,
    })),
    { value: "__unknown__", label: "Unknown / not saved" },
  ];

function formatDate(value: string | null): string {
  if (!value) return "Unknown";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatLastActive(value: string | null): string {
  if (!value) return "Never";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Never";

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfParsedDay = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  );
  const dayDifference = Math.round(
    (startOfToday.getTime() - startOfParsedDay.getTime()) / 86_400_000,
  );

  if (dayDifference === 0) return "Today";
  if (dayDifference === 1) return "Yesterday";

  return formatDate(value);
}

function formatAccountValue(value: string): string {
  return value
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatStorageBytes(value: number): string {
  const bytes = Math.max(0, Math.round(value));

  if (bytes >= 1000 ** 4) return `${(bytes / 1000 ** 4).toFixed(2)} TB`;
  if (bytes >= 1000 ** 3) return `${(bytes / 1000 ** 3).toFixed(2)} GB`;
  if (bytes >= 1000 ** 2) return `${(bytes / 1000 ** 2).toFixed(2)} MB`;
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(2)} KB`;
  return `${bytes} B`;
}

function compareIsoDescending(left: string | null, right: string | null): number {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
  const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
  return safeRight - safeLeft;
}

function sortAdminUsers(users: AdminUserRow[], sort: AccountSort): AdminUserRow[] {
  return [...users].sort((left, right) => {
    if (sort === "storage") {
      return (
        right.storageBytes - left.storageBytes ||
        left.name.localeCompare(right.name)
      );
    }

    if (sort === "recent") {
      return compareIsoDescending(left.lastActiveAtIso, right.lastActiveAtIso);
    }

    if (sort === "name") {
      return left.name.localeCompare(right.name, "en-ZA", {
        sensitivity: "base",
      });
    }

    return compareIsoDescending(left.createdAtIso, right.createdAtIso);
  });
}

function normalizeProvinceSearchValue(value: string): string {
  return value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}

function getCanonicalProvince(value: string): ProvinceName | "" {
  const normalized = normalizeProvinceSearchValue(value);

  if (!normalized) {
    return "";
  }

  if (normalized === "kzn") {
    return "KwaZulu-Natal";
  }

  return (
    SOUTH_AFRICAN_PROVINCES.find(
      (province) => normalizeProvinceSearchValue(province) === normalized,
    ) ?? ""
  );
}

function formatProvince(value: string): string {
  const province = value.trim();
  return getCanonicalProvince(province) || province || "Not saved";
}

function statusClassName(status: AccountStatus): string {
  if (status === "active") return `${styles.statusText} ${styles.statusActive}`;
  if (status === "suspended")
    return `${styles.statusText} ${styles.statusSuspended}`;
  return `${styles.statusText} ${styles.statusPending}`;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function matchesSearch(user: AdminUserRow, searchTerm: string): boolean {
  const query = normalizeSearchValue(searchTerm);

  if (!query) {
    return true;
  }

  const haystack = [
    user.name,
    user.email,
    user.phone,
    user.accountType,
    user.accountSubtype,
    user.province,
    formatProvince(user.province),
    user.introducedBy,
    user.accountStatusLabel,
    user.passwordStatus,
    user.storageLabel,
    user.storageGigabytesLabel,
    formatLastActive(user.lastActiveAtIso),
    formatDate(user.createdAtIso),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function matchesProvinceFilter(
  user: AdminUserRow,
  filter: ProvinceFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  const province = user.province.trim();

  if (filter === "__unknown__") {
    return !province;
  }

  const canonicalUserProvince = getCanonicalProvince(province);

  return canonicalUserProvince
    ? canonicalUserProvince === filter
    : normalizeProvinceSearchValue(province) ===
        normalizeProvinceSearchValue(filter);
}

function getSignupDateRange(filter: SignupDateFilter): {
  start: Date;
  end: Date;
} | null {
  if (filter === "all") {
    return null;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === "week") {
    const daysSinceMonday = (today.getDay() + 6) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - daysSinceMonday);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    return { start, end };
  }

  if (filter === "month") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: new Date(today.getFullYear(), today.getMonth() + 1, 1),
    };
  }

  return {
    start: new Date(today.getFullYear(), 0, 1),
    end: new Date(today.getFullYear() + 1, 0, 1),
  };
}

function matchesSignupDateFilter(
  user: AdminUserRow,
  filter: SignupDateFilter,
): boolean {
  const range = getSignupDateRange(filter);

  if (!range) {
    return true;
  }

  if (!user.createdAtIso) {
    return false;
  }

  const createdAt = new Date(user.createdAtIso);

  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  return createdAt >= range.start && createdAt < range.end;
}

function getActionText(action: AdminAction, user: AdminUserRow): string {
  if (action === "activate") return `${user.email} activated.`;
  if (action === "pending") return `${user.email} set back to pending.`;
  if (action === "suspend") return `${user.email} suspended.`;
  if (action === "send_reset") return `Reset email sent to ${user.email}.`;
  if (action === "send_notification") return `Notification sent to ${user.email}.`;
  if (action === "open_account") return `Opening ${user.email}.`;
  return `${user.email} deleted.`;
}

function getBusyText(action: AdminAction): string {
  if (action === "activate") return "Activating...";
  if (action === "pending") return "Updating...";
  if (action === "suspend") return "Suspending...";
  if (action === "send_reset") return "Sending...";
  if (action === "send_notification") return "Sending...";
  if (action === "open_account") return "Opening...";
  return "Deleting...";
}

function matchesQrAssetSearch(
  asset: QrLabelAsset,
  searchTerm: string,
): boolean {
  const query = normalizeSearchValue(searchTerm);

  if (!query) {
    return true;
  }

  return [
    asset.title,
    asset.plateLabel,
    asset.publicAssetCode,
    asset.kind,
    asset.registerName,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function safeDownloadFileName(value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return safe || "aim4price-qr-labels.pdf";
}

function readContentDispositionFileName(
  contentDisposition: string | null,
  fallback: string,
): string {
  if (!contentDisposition) {
    return fallback;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/["']/g, ""));
    } catch {
      return utf8Match[1].replace(/["']/g, "");
    }
  }

  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1] || fallback;
}

function getAssetNameStatusLabel(status: AssetNamePreviewStatus): string {
  if (status === "changed") return "Changed";
  if (status === "committed") return "Committed";
  if (status === "warning") return "Skipped";
  if (status === "error") return "Error";
  return "Unchanged";
}

function getAssetNameStatusClassName(status: AssetNamePreviewStatus): string {
  if (status === "changed") {
    return `${styles.nameStatusText} ${styles.nameStatusChanged}`;
  }

  if (status === "committed") {
    return `${styles.nameStatusText} ${styles.nameStatusCommitted}`;
  }

  if (status === "warning") {
    return `${styles.nameStatusText} ${styles.nameStatusWarning}`;
  }

  if (status === "error") {
    return `${styles.nameStatusText} ${styles.nameStatusError}`;
  }

  return `${styles.nameStatusText} ${styles.nameStatusUnchanged}`;
}

export default function AdminClient({
  initialUsers,
}: {
  initialUsers: AdminUserRow[];
}) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [signupDateFilter, setSignupDateFilter] =
    useState<SignupDateFilter>("all");
  const [provinceFilter, setProvinceFilter] = useState<ProvinceFilter>("all");
  const [accountSort, setAccountSort] = useState<AccountSort>("newest");
  const [notice, setNotice] = useState<Notice>(null);
  const [busyUserAction, setBusyUserAction] = useState<string | null>(null);
  const busyUserActionRef = useRef<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [accountActionModal, setAccountActionModal] =
    useState<AdminUserRow | null>(null);
  const [notificationComposer, setNotificationComposer] =
    useState<NotificationComposerState>(null);
  const [groupNotificationComposer, setGroupNotificationComposer] =
    useState<GroupNotificationComposerState>(null);
  const [isSendingGroupNotification, setIsSendingGroupNotification] =
    useState(false);
  const isSendingGroupNotificationRef = useRef(false);
  const accountModalRef = useRef<HTMLElement | null>(null);
  const accountModalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const groupNotificationModalRef = useRef<HTMLElement | null>(null);
  const groupNotificationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [qrModal, setQrModal] = useState<QrModalState>(null);
  const [assetNameModal, setAssetNameModal] =
    useState<AssetNameModalState>(null);

  busyUserActionRef.current = busyUserAction;
  isSendingGroupNotificationRef.current = isSendingGroupNotification;
  const isAccountActionModalOpen = accountActionModal !== null;
  const isGroupNotificationModalOpen = groupNotificationComposer !== null;

  const visibleUsers = useMemo(
    () =>
      sortAdminUsers(
        users.filter(
          (user) =>
            matchesSearch(user, searchTerm) &&
            matchesSignupDateFilter(user, signupDateFilter) &&
            matchesProvinceFilter(user, provinceFilter),
        ),
        accountSort,
      ),
    [users, searchTerm, signupDateFilter, provinceFilter, accountSort],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, signupDateFilter, provinceFilter, accountSort]);

  useEffect(() => {
    if (!isAccountActionModalOpen || typeof window === "undefined") {
      return;
    }

    const modal = accountModalRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function keepFocusInsideModal(event: KeyboardEvent) {
      if (event.key === "Escape" && busyUserActionRef.current === null) {
        event.preventDefault();
        setAccountActionModal(null);
        setNotificationComposer(null);
        return;
      }

      if (event.key !== "Tab" || !modal) {
        return;
      }

      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));

      if (focusable.length === 0) {
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

    window.addEventListener("keydown", keepFocusInsideModal);
    return () => {
      window.removeEventListener("keydown", keepFocusInsideModal);
      document.body.style.overflow = previousBodyOverflow;
      accountModalTriggerRef.current?.focus();
    };
  }, [isAccountActionModalOpen]);

  useEffect(() => {
    if (!isGroupNotificationModalOpen || typeof window === "undefined") {
      return;
    }

    const modal = groupNotificationModalRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function keepFocusInsideGroupModal(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !isSendingGroupNotificationRef.current
      ) {
        event.preventDefault();
        setGroupNotificationComposer(null);
        return;
      }

      if (event.key !== "Tab" || !modal) {
        return;
      }

      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));

      if (focusable.length === 0) {
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

    window.addEventListener("keydown", keepFocusInsideGroupModal);
    return () => {
      window.removeEventListener("keydown", keepFocusInsideGroupModal);
      document.body.style.overflow = previousBodyOverflow;
      groupNotificationTriggerRef.current?.focus();
    };
  }, [isGroupNotificationModalOpen]);

  const pageCount = Math.max(
    1,
    Math.ceil(visibleUsers.length / ADMIN_PAGE_SIZE),
  );
  const currentPageNumber = Math.min(currentPage, pageCount);
  const pageStartIndex =
    visibleUsers.length === 0 ? 0 : (currentPageNumber - 1) * ADMIN_PAGE_SIZE;
  const pageEndIndex =
    visibleUsers.length === 0
      ? 0
      : Math.min(pageStartIndex + ADMIN_PAGE_SIZE, visibleUsers.length);
  const paginatedUsers = visibleUsers.slice(pageStartIndex, pageEndIndex);
  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    signupDateFilter !== "all" ||
    provinceFilter !== "all";
  const pageRangeLabel = hasActiveFilters
    ? `${visibleUsers.length} of ${users.length} accounts`
    : `${users.length} ${users.length === 1 ? "account" : "accounts"}`;
  const accountSummary = useMemo(() => {
    const storageBytes = users.reduce(
      (total, user) => total + user.storageBytes,
      0,
    );
    const storageFileCount = users.reduce(
      (total, user) => total + user.storageFileCount,
      0,
    );

    return {
      total: users.length,
      active: users.filter((user) => user.accountStatus === "active").length,
      pending: users.filter(
        (user) => user.accountStatus === "pending_payment",
      ).length,
      suspended: users.filter((user) => user.accountStatus === "suspended")
        .length,
      storageLabel: formatStorageBytes(storageBytes),
      storageFileCount,
    };
  }, [users]);

  const notificationAudienceCounts = useMemo(() => {
    const counts: Record<NotificationAudience, number> = {
      all: 0,
      owner: 0,
      dealer: 0,
      insurance: 0,
      finance: 0,
      licensing: 0,
    };

    for (const user of users) {
      if (user.email.trim().toLowerCase() === "aim4price@gmail.com") {
        continue;
      }

      const audience = normalizeNotificationAudience(user.accountType);
      counts.all += 1;
      counts[audience] += 1;
    }

    return counts;
  }, [users]);
  const selectedGroupRecipientCount = groupNotificationComposer
    ? notificationAudienceCounts[groupNotificationComposer.audience]
    : 0;

  function openAccountActionModal(
    user: AdminUserRow,
    trigger: HTMLButtonElement | null,
  ) {
    accountModalTriggerRef.current = trigger;
    setNotificationComposer(null);
    setAccountActionModal(user);
  }

  function openGroupNotificationComposer(trigger: HTMLButtonElement) {
    groupNotificationTriggerRef.current = trigger;
    setNotice(null);
    setGroupNotificationComposer({
      audience: "all",
      title: DEFAULT_NOTIFICATION_TITLE,
      body: "",
      priority: "normal",
      confirmed: false,
      error: "",
    });
  }

  const filteredQrAssets = useMemo(() => {
    if (!qrModal) {
      return [] as QrLabelAsset[];
    }

    return qrModal.assets.filter((asset) =>
      matchesQrAssetSearch(asset, qrModal.assetSearchTerm),
    );
  }, [qrModal]);

  const selectedQrAssetCount = qrModal
    ? qrModal.selectedAssetIds.filter((assetId) =>
        qrModal.assets.some((asset) => asset.id === assetId && asset.hasQr),
      ).length
    : 0;
  const availableQrAssetCount = qrModal
    ? qrModal.assets.filter((asset) => asset.hasQr).length
    : 0;
  const validAssetNameChangeCount = assetNameModal?.preview
    ? assetNameModal.preview.rows.filter((row) => row.status === "changed")
        .length
    : 0;
  const selectedAccountIsProtected =
    accountActionModal?.email.trim().toLowerCase() === "aim4price@gmail.com";

  async function handleSignOut() {
    try {
      setIsSigningOut(true);

      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "close_account" }),
      }).catch(() => null);

      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
    } finally {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("aim4price-tractors-kit-register");
        window.localStorage.removeItem("aim4price-tractors-kit-marketplace");
        clearCachedHeaderSession();
        window.location.replace("/auth#login");
      }
    }
  }

  async function runAction(user: AdminUserRow, action: AdminAction) {
    if (action === "delete_user") {
      const confirmation =
        typeof window !== "undefined"
          ? window.prompt(
              `Type DELETE to permanently delete ${user.email} and that account's saved Aim4price workspace data.`,
            )
          : null;

      if (confirmation !== "DELETE") {
        return;
      }
    }

    setNotice(null);
    setBusyUserAction(`${user.userId}:${action}`);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: user.userId, action }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Admin action failed.");
      }

      if (data.users) {
        setUsers(data.users);
        setAccountActionModal((current) => {
          if (!current || current.userId !== user.userId) {
            return current;
          }

          return data.users?.find((candidate) => candidate.userId === user.userId) ?? null;
        });
      }

      setNotice({
        tone: "success",
        message: data.message || getActionText(action, user),
      });

      if (
        action === "open_account" &&
        data.redirectUrl &&
        typeof window !== "undefined"
      ) {
        window.location.assign(data.redirectUrl);
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Admin action failed.",
      });
    } finally {
      setBusyUserAction(null);
    }
  }

  async function startWork(user: AdminUserRow) {
    setNotice(null);
    setBusyUserAction(`${user.userId}:start_work`);

    try {
      const response = await fetch("/api/admin/work-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "start",
          clientUserId: user.userId,
          pathname: "/admin",
        }),
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to start work.");
      }

      setNotice({
        tone: "success",
        message: data.message || `Work started for ${user.name || user.email}.`,
      });
      window.dispatchEvent(new Event("aim4price:admin-work-session-changed"));
      window.location.assign(data.redirectUrl || "/account");
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to start work.",
      });
    } finally {
      setBusyUserAction(null);
    }
  }

  async function sendAccountNotification(user: AdminUserRow) {
    const draft = notificationComposer;
    if (!draft || draft.userId !== user.userId) return;

    const title = draft.title.trim() || DEFAULT_NOTIFICATION_TITLE;
    const body = draft.body.trim();
    if (!body) {
      setNotificationComposer({ ...draft, error: "Enter a message to send." });
      return;
    }

    const action: AdminAction = "send_notification";
    setNotice(null);
    setNotificationComposer({ ...draft, title, body, error: "" });
    setBusyUserAction(`${user.userId}:${action}`);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: user.userId,
          action,
          notificationTitle: title,
          notificationBody: body,
          notificationPriority: draft.priority === "priority",
        }),
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Notification could not be sent.");
      }

      setNotice({
        tone: "success",
        message: data.message || getActionText(action, user),
      });
      setNotificationComposer(null);
      setAccountActionModal(null);
    } catch (error) {
      setNotificationComposer((current) =>
        current?.userId === user.userId
          ? {
              ...current,
              error:
                error instanceof Error
                  ? error.message
                  : "Notification could not be sent.",
            }
          : current,
      );
    } finally {
      setBusyUserAction(null);
    }
  }

  async function sendGroupNotification() {
    const draft = groupNotificationComposer;
    if (!draft || isSendingGroupNotification) return;

    const title = draft.title.trim() || DEFAULT_NOTIFICATION_TITLE;
    const body = draft.body.trim();
    const recipientCount = notificationAudienceCounts[draft.audience];

    if (!body) {
      setGroupNotificationComposer({
        ...draft,
        error: "Enter a message to send.",
      });
      return;
    }
    if (!recipientCount) {
      setGroupNotificationComposer({
        ...draft,
        error: "There are no recipient accounts in this group.",
      });
      return;
    }
    if (!draft.confirmed) {
      setGroupNotificationComposer({
        ...draft,
        error: "Confirm the recipient group before sending.",
      });
      return;
    }

    setNotice(null);
    setGroupNotificationComposer({ ...draft, title, body, error: "" });
    setIsSendingGroupNotification(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "send_group_notification",
          notificationAudience: draft.audience,
          notificationTitle: title,
          notificationBody: body,
          notificationPriority: draft.priority === "priority",
        }),
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Group notification could not be sent.");
      }

      setNotice({
        tone: "success",
        message:
          data.message ||
          `Notification sent to ${data.sentCount ?? recipientCount} accounts.`,
      });
      setGroupNotificationComposer(null);
    } catch (error) {
      setGroupNotificationComposer((current) =>
        current
          ? {
              ...current,
              error:
                error instanceof Error
                  ? error.message
                  : "Group notification could not be sent.",
            }
          : current,
      );
    } finally {
      setIsSendingGroupNotification(false);
    }
  }

  function updateQrModal(update: Partial<NonNullable<QrModalState>>) {
    setQrModal((current) => (current ? { ...current, ...update } : current));
  }

  async function openQrModal(user: AdminUserRow) {
    setNotice(null);
    setQrModal({
      user,
      assets: [],
      selectedAssetIds: [],
      layout: "full-labels-10-per-page",
      assetSearchTerm: "",
      isLoading: true,
      isGenerating: false,
      error: "",
    });

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(user.userId)}/qr-labels`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );
      const data = (await response.json()) as QrLabelsResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load QR labels.");
      }

      const assets = data.assets ?? [];

      setQrModal((current) =>
        current?.user.userId === user.userId
          ? {
              ...current,
              assets,
              selectedAssetIds: assets
                .filter((asset) => asset.hasQr)
                .map((asset) => asset.id),
              isLoading: false,
              error: "",
            }
          : current,
      );
    } catch (error) {
      setQrModal((current) =>
        current?.user.userId === user.userId
          ? {
              ...current,
              isLoading: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to load QR labels.",
            }
          : current,
      );
    }
  }

  function toggleQrAsset(assetId: string, isSelected: boolean) {
    setQrModal((current) => {
      if (!current) {
        return current;
      }

      const selected = new Set(current.selectedAssetIds);

      if (isSelected) {
        selected.add(assetId);
      } else {
        selected.delete(assetId);
      }

      return { ...current, selectedAssetIds: Array.from(selected) };
    });
  }

  function selectAllQrAssets() {
    setQrModal((current) =>
      current
        ? {
            ...current,
            selectedAssetIds: current.assets
              .filter((asset) => asset.hasQr)
              .map((asset) => asset.id),
          }
        : current,
    );
  }

  function clearQrAssets() {
    updateQrModal({ selectedAssetIds: [] });
  }

  async function generateQrPdf() {
    if (!qrModal || qrModal.isGenerating) {
      return;
    }

    const selectedIds = qrModal.selectedAssetIds.filter((assetId) =>
      qrModal.assets.some((asset) => asset.id === assetId && asset.hasQr),
    );

    if (selectedIds.length === 0) {
      updateQrModal({ error: "Select at least one asset with a QR code." });
      return;
    }

    updateQrModal({ isGenerating: true, error: "" });

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(qrModal.user.userId)}/qr-labels`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            layout: qrModal.layout,
            assetIds: selectedIds,
          }),
        },
      );

      if (!response.ok) {
        let message = "Failed to generate QR label PDF.";

        try {
          const data = (await response.json()) as QrLabelsResponse;
          message = data.error || message;
        } catch {
          // Keep the fallback message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const fallbackFileName = safeDownloadFileName(
        `aim4price-${qrModal.user.email || qrModal.user.name}-qr-labels.pdf`,
      );
      const fileName = readContentDispositionFileName(
        response.headers.get("content-disposition"),
        fallbackFileName,
      );
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setNotice({
        tone: "success",
        message: `QR label PDF generated for ${selectedIds.length} asset${
          selectedIds.length === 1 ? "" : "s"
        }.`,
      });
      updateQrModal({ isGenerating: false });
    } catch (error) {
      updateQrModal({
        isGenerating: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate QR label PDF.",
      });
    }
  }

  function updateAssetNameModal(
    update: Partial<NonNullable<AssetNameModalState>>,
  ) {
    setAssetNameModal((current) =>
      current ? { ...current, ...update } : current,
    );
  }

  function openAssetNameModal(user: AdminUserRow) {
    setNotice(null);
    setAssetNameModal({
      user,
      preview: null,
      uploadedFileName: "",
      isDownloading: false,
      isUploading: false,
      isCommitting: false,
      didCommit: false,
      error: "",
      success: "",
    });
  }

  async function downloadAssetNameTemplate() {
    if (!assetNameModal || assetNameModal.isDownloading) {
      return;
    }

    const modalUser = assetNameModal.user;
    updateAssetNameModal({ isDownloading: true, error: "", success: "" });

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(modalUser.userId)}/asset-name-manager/export`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        let message = "Failed to download rename CSV.";

        try {
          const data = (await response.json()) as AssetNamePreviewResponse;
          message = data.error || message;
        } catch {
          // Keep the fallback message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const fallbackFileName = safeDownloadFileName(
        `aim4price-${modalUser.email || modalUser.name}-asset-name-template.csv`,
      );
      const fileName = readContentDispositionFileName(
        response.headers.get("content-disposition"),
        fallbackFileName,
      );
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setAssetNameModal((current) =>
        current?.user.userId === modalUser.userId
          ? {
              ...current,
              isDownloading: false,
              success:
                "Rename CSV template downloaded. Edit only the new columns, then upload it here for preview.",
            }
          : current,
      );
    } catch (error) {
      setAssetNameModal((current) =>
        current?.user.userId === modalUser.userId
          ? {
              ...current,
              isDownloading: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to download rename CSV.",
            }
          : current,
      );
    }
  }

  async function previewAssetNameCsv(file: File) {
    if (!assetNameModal || assetNameModal.isUploading) {
      return;
    }

    const modalUser = assetNameModal.user;
    const formData = new FormData();
    formData.append("file", file);

    updateAssetNameModal({
      uploadedFileName: file.name,
      isUploading: true,
      didCommit: false,
      error: "",
      success: "",
    });

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(modalUser.userId)}/asset-name-manager/preview`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );
      const data = (await response.json()) as AssetNamePreviewResponse;

      if (!response.ok || !data.ok || !data.preview) {
        throw new Error(data.error || "Failed to preview CSV.");
      }

      setAssetNameModal((current) =>
        current?.user.userId === modalUser.userId
          ? {
              ...current,
              preview: data.preview ?? null,
              isUploading: false,
              success: "CSV preview loaded. Review the rows before committing.",
              error: "",
            }
          : current,
      );
    } catch (error) {
      setAssetNameModal((current) =>
        current?.user.userId === modalUser.userId
          ? {
              ...current,
              isUploading: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to preview CSV.",
            }
          : current,
      );
    }
  }

  async function commitAssetNameChanges() {
    if (
      !assetNameModal ||
      assetNameModal.isCommitting ||
      !assetNameModal.preview
    ) {
      return;
    }

    const modalUser = assetNameModal.user;
    const changes = assetNameModal.preview.rows
      .filter((row) => row.status === "changed")
      .map((row) => ({
        assetId: row.assetId,
        registerId: row.registerId,
        newAssetTitle: row.newAssetTitle,
        newBrand: row.newBrand,
        newModel: row.newModel,
      }));

    if (!changes.length) {
      updateAssetNameModal({
        error: "There are no valid changed rows to commit.",
      });
      return;
    }

    updateAssetNameModal({ isCommitting: true, error: "", success: "" });

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(modalUser.userId)}/asset-name-manager/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ changes }),
        },
      );
      const data = (await response.json()) as AssetNameCommitResponse;

      if (!response.ok || !data.ok || !data.result) {
        throw new Error(data.error || "Failed to commit name changes.");
      }

      const committedCount = data.result.summary.committedRows;

      setAssetNameModal((current) =>
        current?.user.userId === modalUser.userId
          ? {
              ...current,
              preview: data.result ?? current.preview,
              isCommitting: false,
              didCommit: true,
              success: `${committedCount} asset name change${committedCount === 1 ? "" : "s"} committed.`,
              error: "",
            }
          : current,
      );
      setNotice({
        tone: "success",
        message: `${committedCount} asset name change${committedCount === 1 ? "" : "s"} committed for ${modalUser.email}.`,
      });
    } catch (error) {
      setAssetNameModal((current) =>
        current?.user.userId === modalUser.userId
          ? {
              ...current,
              isCommitting: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to commit name changes.",
            }
          : current,
      );
    }
  }

  return (
    <section className={styles.shell}>
      <section className={styles.topBar}>
        <div className={styles.titleBlock}>
          <h1>Accounts</h1>
        </div>

        <div className={styles.headerActions}>
          <AdminNavigation active="accounts" />
          <button
            type="button"
            className={styles.groupNotificationButton}
            ref={groupNotificationTriggerRef}
            onClick={(event) =>
              openGroupNotificationComposer(event.currentTarget)
            }
          >
            Message
          </button>
          <button
            type="button"
            className={styles.signOutButton}
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </section>

      <section className={styles.userSummary} aria-label="Account summary">
        <article>
          <span>All accounts</span>
          <strong>{accountSummary.total}</strong>
        </article>
        <article className={styles.summaryActive}>
          <span>Active</span>
          <strong>{accountSummary.active}</strong>
        </article>
        <article className={styles.summaryPending}>
          <span>Pending</span>
          <strong>{accountSummary.pending}</strong>
        </article>
        <article className={styles.summarySuspended}>
          <span>Suspended</span>
          <strong>{accountSummary.suspended}</strong>
        </article>
        <article className={styles.summaryStorage}>
          <span>Client storage</span>
          <strong>{accountSummary.storageLabel} · {accountSummary.storageFileCount.toLocaleString("en-ZA")} files</strong>
        </article>
      </section>

      <section
        className={styles.filterPanel}
        aria-label="Find and filter user accounts"
      >
        <div className={styles.filterHeading}>
          <strong>{pageRangeLabel}</strong>
          {hasActiveFilters ? (
            <button
              type="button"
              className={styles.clearFiltersButton}
              onClick={() => {
                setSearchTerm("");
                setSignupDateFilter("all");
                setProvinceFilter("all");
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
        <div className={styles.filterBar}>
          <label className={styles.searchField}>
            <span>Search</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Name, email, phone, province or status"
            />
          </label>

          <label className={styles.signupFilter}>
            <span>Signups</span>
            <select
              value={signupDateFilter}
              onChange={(event) =>
                setSignupDateFilter(event.target.value as SignupDateFilter)
              }
              aria-label="Filter signups by signup date"
            >
              {Object.entries(SIGNUP_DATE_FILTER_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className={`${styles.signupFilter} ${styles.provinceFilter}`}>
            <span>Province</span>
            <select
              value={provinceFilter}
              onChange={(event) =>
                setProvinceFilter(event.target.value as ProvinceFilter)
              }
              aria-label="Filter users by province"
            >
              {PROVINCE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.signupFilter}>
            <span>Sort</span>
            <select
              value={accountSort}
              onChange={(event) =>
                setAccountSort(event.target.value as AccountSort)
              }
              aria-label="Sort user accounts"
            >
              {Object.entries(ACCOUNT_SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {notice ? (
        <div
          className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}
          role="status"
        >
          {notice.message}
        </div>
      ) : null}

      <section className={styles.tableCard} aria-label="User accounts">
        <div className={styles.tableWrap}>
          <table className={styles.userTable}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th>Province</th>
                <th>Storage</th>
                <th>Status</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    No accounts found.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr
                    key={user.userId}
                    className={styles.accountRow}
                    onClick={(event) => {
                      const trigger =
                        event.currentTarget.querySelector<HTMLButtonElement>(
                          `.${styles.rowAccountButton}`,
                        );
                      openAccountActionModal(user, trigger);
                    }}
                  >
                    <td>
                      <button
                          type="button"
                          className={styles.rowAccountButton}
                          aria-label={`Manage ${user.name || user.email}`}
                          onClick={(event) => {
                          event.stopPropagation();
                          openAccountActionModal(user, event.currentTarget);
                        }}
                      >
                        <strong className={styles.nameCell}>{user.name || user.email}</strong>
                        {user.name && user.email ? <span>· {user.email}</span> : null}
                      </button>
                    </td>
                    <td>
                      <div className={styles.accountTypeCell}>
                        <strong>{formatAccountValue(user.accountType)}</strong>
                        <span>· {formatAccountValue(user.accountSubtype)}</span>
                      </div>
                    </td>
                    <td>
                      {user.province.trim() ? (
                        formatProvince(user.province)
                      ) : (
                        <span className={styles.mutedText}>—</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.storageCell}>
                        <strong>{user.storageLabel}</strong>
                        <span>
                          · {user.storageFileCount.toLocaleString("en-ZA")} {" "}
                          {user.storageFileCount === 1 ? "file" : "files"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={statusClassName(user.accountStatus)}>
                        {user.accountStatusLabel}
                      </span>
                    </td>
                    <td>
                      <span className={styles.mutedText}>
                        {formatLastActive(user.lastActiveAtIso)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div
          className={styles.paginationBar}
          aria-label="Admin users pagination"
        >
          <span>
            Page {currentPageNumber} of {pageCount}
          </span>
          <div className={styles.paginationControls}>
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPageNumber === 1}
            >
              First
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPageNumber === 1}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) => Math.min(pageCount, page + 1))
              }
              disabled={currentPageNumber === pageCount}
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(pageCount)}
              disabled={currentPageNumber === pageCount}
            >
              Last
            </button>
          </div>
        </div>
      </section>

      {groupNotificationComposer ? (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !isSendingGroupNotification
            ) {
              setGroupNotificationComposer(null);
            }
          }}
        >
          <section
            className={`${styles.qrModal} ${styles.groupNotificationModal}`}
            ref={groupNotificationModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-group-notification-title"
            aria-busy={isSendingGroupNotification}
            tabIndex={-1}
          >
            <header className={styles.qrModalHeader}>
              <div>
                <h2 id="admin-group-notification-title">
                  Message
                </h2>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => setGroupNotificationComposer(null)}
                disabled={isSendingGroupNotification}
                aria-label="Close group notification"
              >
                ×
              </button>
            </header>

            <form
              className={styles.groupNotificationForm}
              onSubmit={(event) => {
                event.preventDefault();
                void sendGroupNotification();
              }}
            >
              <fieldset className={styles.notificationAudienceFieldset}>
                <legend>Recipient group</legend>
                <div className={styles.notificationAudienceGrid}>
                  {NOTIFICATION_AUDIENCE_OPTIONS.map((option, index) => {
                    const count = notificationAudienceCounts[option.value];
                    const isSelected =
                      groupNotificationComposer.audience === option.value;

                    return (
                      <label
                        key={option.value}
                        className={`${styles.notificationAudienceOption} ${
                          isSelected
                            ? styles.notificationAudienceOptionSelected
                            : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="notification-audience"
                          value={option.value}
                          checked={isSelected}
                          onChange={() =>
                            setGroupNotificationComposer((current) =>
                              current
                                ? {
                                    ...current,
                                    audience: option.value,
                                    confirmed: false,
                                    error: "",
                                  }
                                : current,
                            )
                          }
                          disabled={isSendingGroupNotification || count === 0}
                          autoFocus={index === 0}
                        />
                        <span>
                          <strong>{option.label}</strong>
                        </span>
                        <b>{count}</b>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className={styles.notificationField}>
                <span>Title</span>
                <input
                  type="text"
                  value={groupNotificationComposer.title}
                  onChange={(event) =>
                    setGroupNotificationComposer((current) =>
                      current
                        ? { ...current, title: event.target.value, error: "" }
                        : current,
                    )
                  }
                  maxLength={MAX_NOTIFICATION_TITLE_LENGTH}
                  disabled={isSendingGroupNotification}
                />
                <small>
                  {groupNotificationComposer.title.length}/
                  {MAX_NOTIFICATION_TITLE_LENGTH}
                </small>
              </label>

              <label className={styles.notificationField}>
                <span>Message</span>
                <textarea
                  value={groupNotificationComposer.body}
                  onChange={(event) =>
                    setGroupNotificationComposer((current) =>
                      current
                        ? { ...current, body: event.target.value, error: "" }
                        : current,
                    )
                  }
                  maxLength={MAX_NOTIFICATION_BODY_LENGTH}
                  rows={5}
                  placeholder="Write the message these accounts should receive"
                  required
                  disabled={isSendingGroupNotification}
                />
                <small>
                  {groupNotificationComposer.body.length}/
                  {MAX_NOTIFICATION_BODY_LENGTH}
                </small>
              </label>

              <NotificationPriorityPicker
                value={groupNotificationComposer.priority}
                onChange={(priority) =>
                  setGroupNotificationComposer((current) =>
                    current ? { ...current, priority, error: "" } : current,
                  )
                }
                disabled={isSendingGroupNotification}
              />

              <div
                className={`${styles.groupNotificationSummary} ${
                  groupNotificationComposer.priority === "priority"
                    ? styles.groupNotificationSummaryPriority
                    : ""
                }`}
              >
                <strong>
                  {selectedGroupRecipientCount.toLocaleString("en-ZA")} {" "}
                  {selectedGroupRecipientCount === 1 ? "account" : "accounts"}
                  {" will receive this notification"}
                </strong>
              </div>

              <label className={styles.groupNotificationConfirmation}>
                <input
                  type="checkbox"
                  checked={groupNotificationComposer.confirmed}
                  onChange={(event) =>
                    setGroupNotificationComposer((current) =>
                      current
                        ? {
                            ...current,
                            confirmed: event.target.checked,
                            error: "",
                          }
                        : current,
                    )
                  }
                  disabled={
                    isSendingGroupNotification ||
                    selectedGroupRecipientCount === 0
                  }
                />
                <span>
                  Confirm this account group.
                </span>
              </label>

              {groupNotificationComposer.error ? (
                <p className={styles.notificationComposerError} role="alert">
                  {groupNotificationComposer.error}
                </p>
              ) : null}

              <div className={styles.notificationComposerActions}>
                <button
                  type="button"
                  onClick={() => setGroupNotificationComposer(null)}
                  disabled={isSendingGroupNotification}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.notificationSendButton}
                  disabled={
                    isSendingGroupNotification ||
                    !groupNotificationComposer.body.trim() ||
                    !groupNotificationComposer.confirmed ||
                    selectedGroupRecipientCount === 0
                  }
                >
                  {isSendingGroupNotification
                    ? "Sending..."
                    : `Send to ${selectedGroupRecipientCount.toLocaleString("en-ZA")} ${
                        selectedGroupRecipientCount === 1
                          ? "account"
                          : "accounts"
                      }`}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {accountActionModal ? (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && busyUserAction === null) {
              setAccountActionModal(null);
              setNotificationComposer(null);
            }
          }}
        >
          <section
            className={`${styles.qrModal} ${styles.accountActionModal}`}
            ref={accountModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-account-action-modal-title"
            aria-busy={busyUserAction !== null}
            tabIndex={-1}
          >
            <header className={styles.qrModalHeader}>
              <div>
                <h2 id="admin-account-action-modal-title">
                  {accountActionModal.name || "Unnamed account"}
                </h2>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  setAccountActionModal(null);
                  setNotificationComposer(null);
                }}
                disabled={busyUserAction !== null}
                aria-label="Close account options"
                autoFocus
              >
                ×
              </button>
            </header>

            <div className={styles.accountPrimaryActions} role="group" aria-label="Primary account actions">
              <button
                type="button"
                className={`${styles.accountActionButton} ${styles.workStartButton}`}
                onClick={() => void startWork(accountActionModal)}
                disabled={busyUserAction !== null || selectedAccountIsProtected}
              >
                {busyUserAction === `${accountActionModal.userId}:start_work`
                  ? "Starting work..."
                  : "Start work & open account"}
              </button>

              <button
                type="button"
                className={`${styles.accountActionButton} ${styles.openButton}`}
                onClick={() => runAction(accountActionModal, "open_account")}
                disabled={busyUserAction !== null || selectedAccountIsProtected}
              >
                {busyUserAction === `${accountActionModal.userId}:open_account`
                  ? getBusyText("open_account")
                  : "Open without tracking"}
              </button>

              <button
                type="button"
                className={`${styles.accountActionButton} ${styles.notificationButton}`}
                onClick={() =>
                  setNotificationComposer({
                    userId: accountActionModal.userId,
                    title: DEFAULT_NOTIFICATION_TITLE,
                    body: "",
                    priority: "normal",
                    error: "",
                  })
                }
                disabled={busyUserAction !== null}
                aria-expanded={notificationComposer?.userId === accountActionModal.userId}
                aria-controls="admin-notification-composer"
              >
                Send message
              </button>
            </div>

            <div className={styles.accountActionSummary}>
              <div>
                <span>Account</span>
                <strong>
                  {formatAccountValue(accountActionModal.accountType)} ·{" "}
                  {formatAccountValue(accountActionModal.accountSubtype)}
                </strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{accountActionModal.accountStatusLabel}</strong>
              </div>
              <div>
                <span>Province</span>
                <strong>{formatProvince(accountActionModal.province)}</strong>
              </div>
              <div>
                <span>Phone</span>
                <strong>{accountActionModal.phone || "Not saved"}</strong>
              </div>
              <div>
                <span>Introduced by</span>
                <strong>{accountActionModal.introducedBy}</strong>
              </div>
              <div>
                <span>Password</span>
                <strong>{accountActionModal.passwordStatus}</strong>
              </div>
              <div>
                <span>Last active</span>
                <strong>{formatLastActive(accountActionModal.lastActiveAtIso)}</strong>
              </div>
              <div>
                <span>Signed up</span>
                <strong>{formatDate(accountActionModal.createdAtIso)}</strong>
              </div>
            </div>

            <details className={styles.accountStorageDetails}>
              <summary>
                <span>Storage</span>
                <strong>
                  {accountActionModal.storageLabel} · {accountActionModal.storageFileCount.toLocaleString("en-ZA")} {" "}
                  {accountActionModal.storageFileCount === 1 ? "file" : "files"}
                </strong>
              </summary>
              <section className={styles.accountStorageOverview} aria-label="Account storage usage">
                <div className={styles.accountStoragePrimary}>
                  <span>Tracked client storage</span>
                  <strong>{accountActionModal.storageLabel}</strong>
                </div>
                <div>
                  <span>Bucket-only uploads</span>
                  <strong>{accountActionModal.bucketStorageLabel}</strong>
                </div>
                <div>
                  <span>PostgreSQL files</span>
                  <strong>{accountActionModal.postgresStorageLabel}</strong>
                </div>
              </section>
            </details>

            <div className={styles.accountActionSectionHeading}>
              <strong>Access &amp; account tools</strong>
            </div>

            <div
              className={styles.accountActionGrid}
              role="group"
              aria-label="Account actions"
            >
              {accountActionModal.accountStatus !== "active" ? <button
                type="button"
                className={`${styles.accountActionButton} ${styles.activateButton}`}
                onClick={() => runAction(accountActionModal, "activate")}
                disabled={busyUserAction !== null}
              >
                {busyUserAction === `${accountActionModal.userId}:activate`
                  ? getBusyText("activate")
                  : "Activate account"}
              </button> : null}

              {accountActionModal.accountStatus !== "pending_payment" ? <button
                type="button"
                className={styles.accountActionButton}
                onClick={() => runAction(accountActionModal, "pending")}
                disabled={
                  busyUserAction !== null ||
                  selectedAccountIsProtected
                }
              >
                {busyUserAction === `${accountActionModal.userId}:pending`
                  ? getBusyText("pending")
                  : "Set as pending"}
              </button> : null}

              {accountActionModal.accountStatus !== "suspended" ? <button
                type="button"
                className={`${styles.accountActionButton} ${styles.suspendButton}`}
                onClick={() => runAction(accountActionModal, "suspend")}
                disabled={
                  busyUserAction !== null ||
                  selectedAccountIsProtected
                }
              >
                {busyUserAction === `${accountActionModal.userId}:suspend`
                  ? getBusyText("suspend")
                  : "Suspend account"}
              </button> : null}

              <button
                type="button"
                className={styles.accountActionButton}
                onClick={() => runAction(accountActionModal, "send_reset")}
                disabled={busyUserAction !== null}
              >
                {busyUserAction === `${accountActionModal.userId}:send_reset`
                  ? getBusyText("send_reset")
                  : "Send password reset"}
              </button>

              <button
                type="button"
                className={`${styles.accountActionButton} ${styles.namesButton}`}
                onClick={() => {
                  const user = accountActionModal;
                  accountModalTriggerRef.current = null;
                  setNotificationComposer(null);
                  setAccountActionModal(null);
                  openAssetNameModal(user);
                }}
                disabled={busyUserAction !== null}
              >
                Manage asset names
              </button>

              <button
                type="button"
                className={`${styles.accountActionButton} ${styles.qrButton}`}
                onClick={() => {
                  const user = accountActionModal;
                  accountModalTriggerRef.current = null;
                  setNotificationComposer(null);
                  setAccountActionModal(null);
                  void openQrModal(user);
                }}
                disabled={busyUserAction !== null}
              >
                Print QR labels
              </button>
            </div>

            {notificationComposer?.userId === accountActionModal.userId ? (
              <form
                id="admin-notification-composer"
                className={styles.notificationComposer}
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendAccountNotification(accountActionModal);
                }}
              >
                <div className={styles.notificationComposerHeading}>
                  <div>
                    <strong>Send notification</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotificationComposer(null)}
                    disabled={busyUserAction !== null}
                    aria-label="Close notification composer"
                  >
                    ×
                  </button>
                </div>

                <label className={styles.notificationField}>
                  <span>Title</span>
                  <input
                    type="text"
                    value={notificationComposer.title}
                    onChange={(event) =>
                      setNotificationComposer((current) =>
                        current
                          ? { ...current, title: event.target.value, error: "" }
                          : current,
                      )
                    }
                    maxLength={MAX_NOTIFICATION_TITLE_LENGTH}
                    disabled={busyUserAction !== null}
                    autoFocus
                  />
                  <small>
                    {notificationComposer.title.length}/
                    {MAX_NOTIFICATION_TITLE_LENGTH}
                  </small>
                </label>

                <label className={styles.notificationField}>
                  <span>Message</span>
                  <textarea
                    value={notificationComposer.body}
                    onChange={(event) =>
                      setNotificationComposer((current) =>
                        current
                          ? { ...current, body: event.target.value, error: "" }
                          : current,
                      )
                    }
                    maxLength={MAX_NOTIFICATION_BODY_LENGTH}
                    rows={5}
                    placeholder="Write the message this account should receive"
                    required
                    disabled={busyUserAction !== null}
                  />
                  <small>
                    {notificationComposer.body.length}/
                    {MAX_NOTIFICATION_BODY_LENGTH}
                  </small>
                </label>

                <NotificationPriorityPicker
                  value={notificationComposer.priority}
                  onChange={(priority) =>
                    setNotificationComposer((current) =>
                      current ? { ...current, priority, error: "" } : current,
                    )
                  }
                  disabled={busyUserAction !== null}
                />

                {notificationComposer.error ? (
                  <p className={styles.notificationComposerError} role="alert">
                    {notificationComposer.error}
                  </p>
                ) : null}

                <div className={styles.notificationComposerActions}>
                  <button
                    type="button"
                    onClick={() => setNotificationComposer(null)}
                    disabled={busyUserAction !== null}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.notificationSendButton}
                    disabled={
                      busyUserAction !== null ||
                      !notificationComposer.body.trim()
                    }
                  >
                    {busyUserAction ===
                    `${accountActionModal.userId}:send_notification`
                      ? getBusyText("send_notification")
                      : "Send notification"}
                  </button>
                </div>
              </form>
            ) : null}

            <div className={styles.accountActionDanger}>
              <strong>Delete account</strong>
              <button
                type="button"
                className={`${styles.accountActionButton} ${styles.deleteButton}`}
                onClick={() => runAction(accountActionModal, "delete_user")}
                disabled={busyUserAction !== null || selectedAccountIsProtected}
              >
                {busyUserAction === `${accountActionModal.userId}:delete_user`
                  ? getBusyText("delete_user")
                  : "Delete account"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {qrModal ? (
        <div className={styles.modalBackdrop}>
          <section
            className={styles.qrModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-qr-modal-title"
            data-asset-choice-surface="true"
            data-asset-choice-modal="true"
          >
            <header className={styles.qrModalHeader} data-asset-choice-header="true">
              <div>
                <h2 id="admin-qr-modal-title">
                  Print QR labels — {qrModal.user.name || "Unnamed account"}
                </h2>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => setQrModal(null)}
                disabled={qrModal.isGenerating}
                aria-label="Close QR label modal"
              >
                ×
              </button>
            </header>

            <div className={styles.qrLayoutGrid} aria-label="QR label layout">
              {QR_LAYOUT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`${styles.qrLayoutOption} ${
                    qrModal.layout === option.value
                      ? styles.qrLayoutOptionActive
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="qr-label-layout"
                    checked={qrModal.layout === option.value}
                    onChange={() => updateQrModal({ layout: option.value })}
                    disabled={qrModal.isGenerating}
                  />
                  <span>
                    <strong>{option.title}</strong>
                  </span>
                </label>
              ))}
            </div>

            <div className={styles.qrAssetControls} data-asset-choice-toolbar="true">
              <label className={styles.qrAssetSearch}>
                <span>Assets</span>
                <input
                  type="search"
                  value={qrModal.assetSearchTerm}
                  onChange={(event) =>
                    updateQrModal({ assetSearchTerm: event.target.value })
                  }
                  placeholder="Search asset, plate label, QR code or register"
                  disabled={qrModal.isLoading || qrModal.isGenerating}
                />
              </label>

              <div className={styles.qrAssetControlButtons}>
                <button
                  type="button"
                  onClick={selectAllQrAssets}
                  disabled={
                    qrModal.isLoading ||
                    qrModal.isGenerating ||
                    availableQrAssetCount === 0
                  }
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearQrAssets}
                  disabled={
                    qrModal.isLoading ||
                    qrModal.isGenerating ||
                    selectedQrAssetCount === 0
                  }
                >
                  Clear
                </button>
              </div>
            </div>

            <div className={styles.qrAssetList} data-asset-choice-list="true">
              {qrModal.isLoading ? (
                <div className={styles.qrAssetEmpty}>
                  Loading asset QR labels...
                </div>
              ) : qrModal.assets.length === 0 ? (
                <div className={styles.qrAssetEmpty}>
                  No assets found for this account.
                </div>
              ) : filteredQrAssets.length === 0 ? (
                <div className={styles.qrAssetEmpty}>
                  No matching assets found.
                </div>
              ) : (
                filteredQrAssets.map((asset) => {
                  const isSelected = qrModal.selectedAssetIds.includes(
                    asset.id,
                  );

                  return (
                    <label
                      key={asset.id}
                      className={`${styles.qrAssetRow} ${
                        !asset.hasQr ? styles.qrAssetRowDisabled : ""
                      }`}
                      data-asset-choice-row="true"
                      data-asset-choice-selected={isSelected ? "true" : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) =>
                          toggleQrAsset(asset.id, event.target.checked)
                        }
                        disabled={!asset.hasQr || qrModal.isGenerating}
                      />

                      <span className={styles.qrAssetMain} data-asset-choice-copy="true">
                        <strong>
                          {asset.title}
                          <span data-asset-choice-meta="true">
                            {` · ${asset.registerName}`}
                            {asset.plateLabel ? ` · ${asset.plateLabel}` : ""}
                          </span>
                          <span data-asset-choice-value="true">
                            {` · ${asset.hasQr ? asset.publicAssetCode : "No QR"}`}
                          </span>
                        </strong>
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {qrModal.error ? (
              <div className={styles.qrModalError} role="alert">
                {qrModal.error}
              </div>
            ) : null}

            <footer className={styles.qrModalFooter} data-asset-choice-footer="true">
              <span>
                {selectedQrAssetCount} selected · {availableQrAssetCount}{" "}
                QR-ready
              </span>
              <button
                type="button"
                className={styles.generateQrButton}
                onClick={generateQrPdf}
                disabled={
                  qrModal.isLoading ||
                  qrModal.isGenerating ||
                  selectedQrAssetCount === 0
                }
              >
                {qrModal.isGenerating ? "Generating PDF..." : "Generate PDF"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {assetNameModal ? (
        <div className={styles.modalBackdrop}>
          <section
            className={`${styles.qrModal} ${styles.nameModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-asset-name-modal-title"
          >
            <header className={styles.qrModalHeader}>
              <div>
                <h2 id="admin-asset-name-modal-title">
                  Asset names — {assetNameModal.user.name || "Unnamed account"}
                </h2>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => setAssetNameModal(null)}
                disabled={
                  assetNameModal.isDownloading ||
                  assetNameModal.isUploading ||
                  assetNameModal.isCommitting
                }
                aria-label="Close Asset Name Manager modal"
              >
                ×
              </button>
            </header>

            <div className={styles.nameManagerActions}>
              <button
                type="button"
                className={styles.generateQrButton}
                onClick={downloadAssetNameTemplate}
                disabled={
                  assetNameModal.isDownloading ||
                  assetNameModal.isUploading ||
                  assetNameModal.isCommitting
                }
              >
                {assetNameModal.isDownloading
                  ? "Downloading CSV..."
                  : "Download Rename CSV"}
              </button>

              <label
                className={`${styles.uploadCsvButton} ${
                  assetNameModal.isUploading
                    ? styles.uploadCsvButtonDisabled
                    : ""
                }`}
              >
                <span>
                  {assetNameModal.isUploading
                    ? "Uploading CSV..."
                    : "Upload Edited CSV"}
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  disabled={
                    assetNameModal.isDownloading ||
                    assetNameModal.isUploading ||
                    assetNameModal.isCommitting
                  }
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    event.currentTarget.value = "";

                    if (file) {
                      void previewAssetNameCsv(file);
                    }
                  }}
                />
              </label>

              {assetNameModal.uploadedFileName ? (
                <span className={styles.nameManagerFileName}>
                  {assetNameModal.uploadedFileName}
                </span>
              ) : null}
            </div>

            {assetNameModal.preview ? (
              <div className={styles.namePreviewSummary}>
                <span>
                  Uploaded{" "}
                  <strong>{assetNameModal.preview.summary.uploadedRows}</strong>
                </span>
                <span>
                  Matched{" "}
                  <strong>{assetNameModal.preview.summary.matchedRows}</strong>
                </span>
                <span>
                  Changed{" "}
                  <strong>{assetNameModal.preview.summary.changedRows}</strong>
                </span>
                <span>
                  Unchanged{" "}
                  <strong>
                    {assetNameModal.preview.summary.unchangedRows}
                  </strong>
                </span>
                <span>
                  Skipped{" "}
                  <strong>{assetNameModal.preview.summary.skippedRows}</strong>
                </span>
                <span>
                  Errors{" "}
                  <strong>{assetNameModal.preview.summary.errorRows}</strong>
                </span>
                <span>
                  Committed{" "}
                  <strong>
                    {assetNameModal.preview.summary.committedRows}
                  </strong>
                </span>
              </div>
            ) : null}

            <div className={styles.namePreviewTableWrap}>
              {!assetNameModal.preview ? (
                <div className={styles.nameManagerEmpty}>
                  Upload a rename CSV to preview changes.
                </div>
              ) : assetNameModal.preview.rows.length === 0 ? (
                <div className={styles.nameManagerEmpty}>
                  The uploaded CSV did not contain any data rows.
                </div>
              ) : (
                <table className={styles.namePreviewTable}>
                  <thead>
                    <tr>
                      <th>Register</th>
                      <th>QR/public code</th>
                      <th>Equipment</th>
                      <th>Year</th>
                      <th>Usage</th>
                      <th>Current title</th>
                      <th>New title</th>
                      <th>Current brand</th>
                      <th>New brand</th>
                      <th>Current model</th>
                      <th>New model</th>
                      <th>Status</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetNameModal.preview.rows.map((row) => (
                      <tr key={`${row.rowNumber}:${row.assetId || "missing"}`}>
                        <td>{row.registerName || "Not matched"}</td>
                        <td>
                          <span className={styles.namePreviewCode}>
                            {row.publicAssetCode || "Not saved"}
                          </span>
                        </td>
                        <td>{row.equipment || "Not saved"}</td>
                        <td>{row.yearModel || "Unknown"}</td>
                        <td>{row.usage || "Unknown"}</td>
                        <td>{row.currentAssetTitle || "Not saved"}</td>
                        <td>{row.newAssetTitle || "No change"}</td>
                        <td>{row.currentBrand || "Not saved"}</td>
                        <td>{row.newBrand || "No change"}</td>
                        <td>{row.currentModel || "Not saved"}</td>
                        <td>{row.newModel || "No change"}</td>
                        <td>
                          <span
                            className={getAssetNameStatusClassName(row.status)}
                          >
                            {getAssetNameStatusLabel(row.status)}
                          </span>
                        </td>
                        <td>{row.message || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {assetNameModal.error ? (
              <div className={styles.qrModalError} role="alert">
                {assetNameModal.error}
              </div>
            ) : null}

            {assetNameModal.success ? (
              <div className={styles.nameModalSuccess} role="status">
                {assetNameModal.success}
              </div>
            ) : null}

            <footer
              className={styles.qrModalFooter}
            >
              <span>
                {validAssetNameChangeCount} valid changed row
                {validAssetNameChangeCount === 1 ? "" : "s"} ready to commit
              </span>

              <div className={styles.nameModalFooterButtons}>
                <button
                  type="button"
                  className={styles.nameSecondaryButton}
                  onClick={() => setAssetNameModal(null)}
                  disabled={
                    assetNameModal.isDownloading ||
                    assetNameModal.isUploading ||
                    assetNameModal.isCommitting
                  }
                >
                  Close
                </button>

                <button
                  type="button"
                  className={styles.generateQrButton}
                  onClick={commitAssetNameChanges}
                  disabled={
                    assetNameModal.isDownloading ||
                    assetNameModal.isUploading ||
                    assetNameModal.isCommitting ||
                    validAssetNameChangeCount === 0
                  }
                >
                  {assetNameModal.isCommitting
                    ? "Committing..."
                    : "Commit Name Changes"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
