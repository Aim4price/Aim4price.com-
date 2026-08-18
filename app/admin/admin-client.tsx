"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
};

type ApiResponse = {
  ok: boolean;
  users?: AdminUserRow[];
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
  | "open_account"
  | "delete_user";

type Notice = {
  tone: "success" | "error";
  message: string;
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
type ProvinceName = (typeof SOUTH_AFRICAN_PROVINCES)[number];
type ProvinceFilter = "all" | "__unknown__" | ProvinceName;

const ADMIN_PAGE_SIZE = 10;

const QR_LAYOUT_OPTIONS: Array<{
  value: QrLabelLayout;
  title: string;
  description: string;
}> = [
  {
    value: "full-labels-10-per-page",
    title: "10 full labels per page",
    description: "Larger Aim4price plate labels for normal asset stickers.",
  },
  {
    value: "small-qr-25mm",
    title: "Small 25mm QR labels",
    description: "Compact 25mm x 25mm QR stickers with the asset name above.",
  },
];

const SIGNUP_DATE_FILTER_LABELS: Record<SignupDateFilter, string> = {
  all: "All signups",
  week: "This week",
  month: "This month",
  year: "This year",
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
  if (status === "active") return `${styles.statusPill} ${styles.statusActive}`;
  if (status === "suspended")
    return `${styles.statusPill} ${styles.statusSuspended}`;
  return `${styles.statusPill} ${styles.statusPending}`;
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
  if (action === "open_account") return `Opening ${user.email}.`;
  return `${user.email} deleted.`;
}

function getBusyText(action: AdminAction): string {
  if (action === "activate") return "Activating...";
  if (action === "pending") return "Updating...";
  if (action === "suspend") return "Suspending...";
  if (action === "send_reset") return "Sending...";
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
    return `${styles.nameStatusPill} ${styles.nameStatusChanged}`;
  }

  if (status === "committed") {
    return `${styles.nameStatusPill} ${styles.nameStatusCommitted}`;
  }

  if (status === "warning") {
    return `${styles.nameStatusPill} ${styles.nameStatusWarning}`;
  }

  if (status === "error") {
    return `${styles.nameStatusPill} ${styles.nameStatusError}`;
  }

  return `${styles.nameStatusPill} ${styles.nameStatusUnchanged}`;
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
  const [notice, setNotice] = useState<Notice>(null);
  const [busyUserAction, setBusyUserAction] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [qrModal, setQrModal] = useState<QrModalState>(null);
  const [assetNameModal, setAssetNameModal] =
    useState<AssetNameModalState>(null);

  const visibleUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          matchesSearch(user, searchTerm) &&
          matchesSignupDateFilter(user, signupDateFilter) &&
          matchesProvinceFilter(user, provinceFilter),
      ),
    [users, searchTerm, signupDateFilter, provinceFilter],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, signupDateFilter, provinceFilter]);

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
  const visibleAccountLabel =
    visibleUsers.length === 1 ? "account" : "accounts";
  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    signupDateFilter !== "all" ||
    provinceFilter !== "all";
  const pageRangeLabel =
    visibleUsers.length === 0
      ? `No matching accounts${users.length ? ` out of ${users.length} total` : ""}`
      : `Showing ${pageStartIndex + 1}-${pageEndIndex} of ${visibleUsers.length} ${visibleAccountLabel}${
          hasActiveFilters ? ` (${users.length} total)` : ""
        }`;
  const accountSummary = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.accountStatus === "active").length,
      pending: users.filter((user) => user.accountStatus === "pending_payment").length,
      suspended: users.filter((user) => user.accountStatus === "suspended").length,
    }),
    [users],
  );

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
          <p className={styles.eyebrow}>Aim4price admin</p>
          <h1>User accounts</h1>
          <span>Manage access, account health and user tools.</span>
        </div>

        <div className={styles.headerActions}>
          <nav className={styles.adminNav} aria-label="Admin navigation">
            <Link href="/admin" className={`${styles.adminNavLink} ${styles.adminNavActive}`} aria-current="page">
              Users
            </Link>
            <Link href="/admin/dashboard" className={styles.adminNavLink}>
              Dashboard
            </Link>
            <Link href="/admin/lifecycle-calculator" className={styles.adminNavLink}>
              Lifecycle Model
            </Link>
            <Link href="/admin/assistance-network" className={styles.adminNavLink}>
              Assistance Network
            </Link>
          </nav>
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
        <article><span>All accounts</span><strong>{accountSummary.total}</strong><small>Registered users</small></article>
        <article className={styles.summaryActive}><span>Active</span><strong>{accountSummary.active}</strong><small>Can access Aim4price</small></article>
        <article className={styles.summaryPending}><span>Pending</span><strong>{accountSummary.pending}</strong><small>Awaiting activation or payment</small></article>
        <article className={styles.summarySuspended}><span>Suspended</span><strong>{accountSummary.suspended}</strong><small>Access currently paused</small></article>
      </section>

      <section className={styles.filterPanel} aria-label="Find and filter user accounts">
        <div className={styles.filterHeading}>
          <div>
            <strong>Find an account</strong>
            <span>{pageRangeLabel}</span>
          </div>
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
            <span>Search users</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Name, email, phone, province or status"
            />
          </label>

          <label className={styles.signupFilter}>
            <span>Filter signups</span>
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
                <th>Name</th>
                <th>Email</th>
                <th>Number</th>
                <th>Account type</th>
                <th>Subtype</th>
                <th>Province</th>
                <th>Introduced by</th>
                <th>Payment/account status</th>
                <th>Password</th>
                <th>Last active</th>
                <th>Signed up</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={12} className={styles.emptyCell}>
                    No matching users found.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  const isProtectedAdmin =
                    user.email.trim().toLowerCase() === "aim4price@gmail.com";

                  return (
                    <tr key={user.userId}>
                      <td>
                        <strong className={styles.nameCell}>{user.name}</strong>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        {user.phone ? (
                          <span className={styles.phoneCell}>{user.phone}</span>
                        ) : (
                          <span className={styles.mutedText}>Not saved</span>
                        )}
                      </td>
                      <td>{formatAccountValue(user.accountType)}</td>
                      <td>{formatAccountValue(user.accountSubtype)}</td>
                      <td>
                        {user.province.trim() ? (
                          formatProvince(user.province)
                        ) : (
                          <span className={styles.mutedText}>Not saved</span>
                        )}
                      </td>
                      <td>{user.introducedBy}</td>
                      <td>
                        <span className={statusClassName(user.accountStatus)}>
                          {user.accountStatusLabel}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            user.passwordStatus === "Set"
                              ? styles.passwordSet
                              : styles.passwordMissing
                          }
                        >
                          {user.passwordStatus}
                        </span>
                      </td>
                      <td>
                        <span className={styles.mutedText}>
                          {formatLastActive(user.lastActiveAtIso)}
                        </span>
                      </td>
                      <td>{formatDate(user.createdAtIso)}</td>
                      <td>
                        <div className={styles.actionGroup}>
                          <button
                            type="button"
                            className={styles.openButton}
                            onClick={() => runAction(user, "open_account")}
                            disabled={
                              busyUserAction !== null || isProtectedAdmin
                            }
                          >
                            {busyUserAction === `${user.userId}:open_account`
                              ? getBusyText("open_account")
                              : "Open"}
                          </button>

                          <button
                            type="button"
                            className={styles.activateButton}
                            onClick={() => runAction(user, "activate")}
                            disabled={
                              busyUserAction !== null ||
                              user.accountStatus === "active"
                            }
                          >
                            {busyUserAction === `${user.userId}:activate`
                              ? getBusyText("activate")
                              : "Activate"}
                          </button>

                          <button
                            type="button"
                            onClick={() => runAction(user, "pending")}
                            disabled={
                              busyUserAction !== null ||
                              isProtectedAdmin ||
                              user.accountStatus === "pending_payment"
                            }
                          >
                            {busyUserAction === `${user.userId}:pending`
                              ? getBusyText("pending")
                              : "Pending"}
                          </button>

                          <button
                            type="button"
                            onClick={() => runAction(user, "suspend")}
                            disabled={
                              busyUserAction !== null ||
                              isProtectedAdmin ||
                              user.accountStatus === "suspended"
                            }
                          >
                            {busyUserAction === `${user.userId}:suspend`
                              ? getBusyText("suspend")
                              : "Suspend"}
                          </button>

                          <button
                            type="button"
                            onClick={() => runAction(user, "send_reset")}
                            disabled={busyUserAction !== null}
                          >
                            {busyUserAction === `${user.userId}:send_reset`
                              ? getBusyText("send_reset")
                              : "Reset"}
                          </button>

                          <button
                            type="button"
                            className={styles.namesButton}
                            onClick={() => openAssetNameModal(user)}
                            disabled={busyUserAction !== null}
                          >
                            Names
                          </button>

                          <button
                            type="button"
                            className={styles.qrButton}
                            onClick={() => openQrModal(user)}
                            disabled={busyUserAction !== null}
                          >
                            QR
                          </button>

                          <button
                            type="button"
                            className={styles.deleteButton}
                            onClick={() => runAction(user, "delete_user")}
                            disabled={
                              busyUserAction !== null || isProtectedAdmin
                            }
                          >
                            {busyUserAction === `${user.userId}:delete_user`
                              ? getBusyText("delete_user")
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {qrModal ? (
        <div className={styles.modalBackdrop}>
          <section
            className={styles.qrModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-qr-modal-title"
          >
            <header className={styles.qrModalHeader}>
              <div>
                <p className={styles.qrModalEyebrow}>Admin QR print</p>
                <h2 id="admin-qr-modal-title">Print QR labels</h2>
                <span>
                  {qrModal.user.name} · {qrModal.user.email || "No email saved"}
                </span>
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
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </div>

            <div className={styles.qrAssetControls}>
              <label className={styles.qrAssetSearch}>
                <span>Choose assets</span>
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

            <div className={styles.qrAssetList}>
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
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) =>
                          toggleQrAsset(asset.id, event.target.checked)
                        }
                        disabled={!asset.hasQr || qrModal.isGenerating}
                      />

                      <span className={styles.qrAssetMain}>
                        <strong>{asset.title}</strong>
                        <small>
                          {asset.registerName}
                          {asset.plateLabel ? ` · ${asset.plateLabel}` : ""}
                        </small>
                      </span>

                      <span className={styles.qrAssetCode}>
                        {asset.hasQr ? asset.publicAssetCode : "No QR"}
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

            <footer className={styles.qrModalFooter}>
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
                <p className={styles.qrModalEyebrow}>Admin asset rename</p>
                <h2 id="admin-asset-name-modal-title">Asset Name Manager</h2>
                <span>
                  {assetNameModal.user.name} ·{" "}
                  {assetNameModal.user.email || "No email saved"}
                </span>
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

            <div className={styles.nameManagerIntro}>
              <strong>Bulk rename only</strong>
              <span>
                Download the simple CSV, paste or upload it into ChatGPT if
                needed, edit only new_asset_title, new_brand and new_model, then
                upload the edited CSV here. Equipment, year_model and usage are
                context only. Values, finance, insurance, license, valuation and
                QR data are not editable here.
              </span>
            </div>

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
                  No CSV preview loaded yet. Download the CSV template first,
                  edit only the new columns, then upload it here.
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
              className={`${styles.qrModalFooter} ${styles.nameModalFooter}`}
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
