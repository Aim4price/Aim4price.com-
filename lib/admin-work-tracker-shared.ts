export const ADMIN_WORK_HEARTBEAT_CAP_SECONDS = 90;
export const ADMIN_WORK_HEARTBEAT_INTERVAL_MS = 30_000;
export const ADMIN_WORK_IDLE_TIMEOUT_MS = 10 * 60_000;
export const ADMIN_WORK_NOTE_MAX_LENGTH = 1_500;

export type AdminWorkPeriod = "week" | "month";

export type AdminWorkPage = {
  key: string;
  label: string;
  isAdminArea: boolean;
};

export type AdminWorkPageTotal = {
  pageKey: string;
  pageLabel: string;
  durationSeconds: number;
};

export type AdminWorkSessionView = {
  id: string;
  clientUserId: string;
  clientName: string;
  clientEmail: string;
  clientAccountType: string;
  startedAtIso: string;
  stoppedAtIso: string | null;
  lastHeartbeatAtIso: string;
  durationSeconds: number;
  currentPageKey: string;
  currentPageLabel: string;
  trackingActive: boolean;
  note: string;
  includeInReport: boolean;
  showTimesInReport: boolean;
  showNoteInReport: boolean;
  pages: AdminWorkPageTotal[];
};

export type AdminWorkHistory = {
  period: AdminWorkPeriod;
  anchorDate: string;
  startDate: string;
  endDate: string;
  startIso: string;
  endIso: string;
  sessions: AdminWorkSessionView[];
  summary: {
    trackedSeconds: number;
    reportableSeconds: number;
    sessionCount: number;
    includedSessionCount: number;
    pageCount: number;
  };
};

const JOHANNESBURG_OFFSET_MS = 2 * 60 * 60 * 1_000;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ROUTE_LABELS: Array<{
  prefix: string;
  key: string;
  label: string;
  isAdminArea?: boolean;
}> = [
  { prefix: "/admin/work-tracker", key: "admin-work-tracker", label: "Admin - Work tracker", isAdminArea: true },
  { prefix: "/admin/dashboard", key: "admin-dashboard", label: "Admin - Dashboard", isAdminArea: true },
  { prefix: "/admin/marketplace", key: "admin-marketplace", label: "Admin - Marketplace", isAdminArea: true },
  { prefix: "/admin/capture-queue", key: "admin-capture-queue", label: "Admin - Capture Queue", isAdminArea: true },
  { prefix: "/admin/lifecycle-calculator", key: "admin-lifecycle", label: "Admin - Lifecycle Model", isAdminArea: true },
  { prefix: "/admin", key: "admin-users", label: "Admin - User Accounts", isAdminArea: true },
  { prefix: "/asset-registers", key: "asset-register", label: "Asset Register" },
  { prefix: "/asset-register", key: "asset-register", label: "Asset Register" },
  { prefix: "/valuations", key: "valuation", label: "Get Estimate" },
  { prefix: "/shared-registers", key: "shared-registers", label: "Shared Registers" },
  { prefix: "/asset-map", key: "asset-map", label: "Asset Map" },
  { prefix: "/documents", key: "documents", label: "Documents" },
  { prefix: "/my-invoices", key: "cost-ledger", label: "Cost Ledger" },
  { prefix: "/dealer-costs", key: "client-costs", label: "Client Costs" },
  { prefix: "/maintenance", key: "maintenance", label: "Maintenance" },
  { prefix: "/tracking", key: "maintenance", label: "Maintenance" },
  { prefix: "/fuel", key: "fuel-ledger", label: "Fuel Ledger" },
  { prefix: "/fuel-scan", key: "fuel-ledger", label: "Fuel Ledger" },
  { prefix: "/scan", key: "asset-scan", label: "Asset Scan" },
  { prefix: "/marketplace", key: "marketplace", label: "Marketplace" },
  { prefix: "/ad-studio", key: "ad-studio", label: "Ad Studio" },
  { prefix: "/my-showroom", key: "showroom", label: "My Showroom" },
  { prefix: "/showroom", key: "showroom", label: "Showroom" },
  { prefix: "/leads", key: "leads", label: "Leads / Clients" },
  { prefix: "/asset-discovery", key: "asset-discovery", label: "Discovery" },
  { prefix: "/valuation", key: "valuation", label: "Get Estimate" },
  { prefix: "/account", key: "account", label: "Account" },
  { prefix: "/accountant", key: "accountant-workspace", label: "Accountant Workspace" },
  { prefix: "/dealer", key: "dealer-workspace", label: "Dealer Workspace" },
  { prefix: "/field-manager", key: "field-manager", label: "Field Manager" },
  { prefix: "/owner-app", key: "owner-app", label: "Owner App" },
  { prefix: "/", key: "home", label: "Home" },
];

function cleanPathname(value: unknown): string {
  if (typeof value !== "string") return "/";
  const withoutQuery = value.trim().split(/[?#]/, 1)[0] || "/";
  const withLeadingSlash = withoutQuery.startsWith("/")
    ? withoutQuery
    : `/${withoutQuery}`;
  return withLeadingSlash.replace(/\/{2,}/g, "/").slice(0, 300);
}

function routeMatches(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function resolveAdminWorkPage(pathname: unknown): AdminWorkPage {
  const cleanPath = cleanPathname(pathname);
  const match = ROUTE_LABELS.find((route) => routeMatches(cleanPath, route.prefix));

  if (match) {
    return {
      key: match.key,
      label: match.label,
      isAdminArea: Boolean(match.isAdminArea),
    };
  }

  return cleanPath.startsWith("/admin")
    ? { key: "admin-other", label: "Admin - Other", isAdminArea: true }
    : { key: "account-other", label: "Other account page", isAdminArea: false };
}

function validDateParts(value: string): { year: number; monthIndex: number; day: number } | null {
  if (!DATE_KEY_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, monthIndex: month - 1, day };
}

function dateKeyFromLocalMidnight(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function getJohannesburgDateKey(value: Date = new Date()): string {
  return new Date(value.getTime() + JOHANNESBURG_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export function normalizeAdminWorkPeriod(value: unknown): AdminWorkPeriod {
  return value === "month" ? "month" : "week";
}

export function normalizeAdminWorkAnchor(value: unknown, now: Date = new Date()): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  return validDateParts(candidate) ? candidate : getJohannesburgDateKey(now);
}

export function getAdminWorkPeriodRange(
  periodInput: unknown,
  anchorInput: unknown,
  now: Date = new Date(),
): {
  period: AdminWorkPeriod;
  anchorDate: string;
  startDate: string;
  endDate: string;
  startIso: string;
  endIso: string;
} {
  const period = normalizeAdminWorkPeriod(periodInput);
  const anchorDate = normalizeAdminWorkAnchor(anchorInput, now);
  const parts = validDateParts(anchorDate)!;
  const anchorLocal = new Date(Date.UTC(parts.year, parts.monthIndex, parts.day));
  let startLocal: Date;
  let endLocal: Date;

  if (period === "month") {
    startLocal = new Date(Date.UTC(parts.year, parts.monthIndex, 1));
    endLocal = new Date(Date.UTC(parts.year, parts.monthIndex + 1, 1));
  } else {
    const dayOfWeek = anchorLocal.getUTCDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    startLocal = new Date(anchorLocal.getTime() - daysSinceMonday * 86_400_000);
    endLocal = new Date(startLocal.getTime() + 7 * 86_400_000);
  }

  const endInclusiveLocal = new Date(endLocal.getTime() - 86_400_000);

  return {
    period,
    anchorDate,
    startDate: dateKeyFromLocalMidnight(startLocal),
    endDate: dateKeyFromLocalMidnight(endInclusiveLocal),
    startIso: new Date(startLocal.getTime() - JOHANNESBURG_OFFSET_MS).toISOString(),
    endIso: new Date(endLocal.getTime() - JOHANNESBURG_OFFSET_MS).toISOString(),
  };
}

export function shiftAdminWorkAnchor(
  periodInput: unknown,
  anchorInput: unknown,
  amount: number,
): string {
  const period = normalizeAdminWorkPeriod(periodInput);
  const anchor = normalizeAdminWorkAnchor(anchorInput);
  const parts = validDateParts(anchor)!;
  const shifted = period === "month"
    ? new Date(Date.UTC(parts.year, parts.monthIndex + amount, 1))
    : new Date(Date.UTC(parts.year, parts.monthIndex, parts.day + amount * 7));
  return dateKeyFromLocalMidnight(shifted);
}

export function calculateAdminWorkHeartbeatSeconds(
  lastHeartbeat: Date | string,
  now: Date | string,
  wasTrackingActive: boolean,
): number {
  if (!wasTrackingActive) return 0;
  const startMs = new Date(lastHeartbeat).getTime();
  const endMs = new Date(now).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }

  const elapsedSeconds = Math.max(0, Math.floor((endMs - startMs) / 1_000));

  // A closed or sleeping browser must not silently add time when it returns.
  if (elapsedSeconds > ADMIN_WORK_HEARTBEAT_CAP_SECONDS * 2) return 0;

  return Math.min(ADMIN_WORK_HEARTBEAT_CAP_SECONDS, elapsedSeconds);
}

export function formatAdminWorkDuration(secondsInput: unknown): string {
  const seconds = Number(secondsInput);
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 min";

  const roundedMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr${hours === 1 ? "" : "s"} ${minutes} min`;
}
