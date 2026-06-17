export const AIM4PRICE_ADMIN_EMAIL = "aim4price@gmail.com";

export const ACCOUNT_STATUS_VALUES = [
  "pending_payment",
  "active",
  "suspended",
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUS_VALUES)[number];

export const INTRODUCED_BY_OPTIONS = [
  "kuyler",
  "andre",
  "direct",
  "other",
] as const;
export type IntroducedByOption = (typeof INTRODUCED_BY_OPTIONS)[number];

const ACCOUNT_STATUS_SET = new Set<string>(ACCOUNT_STATUS_VALUES);
const INTRODUCED_BY_OPTION_SET = new Set<string>(INTRODUCED_BY_OPTIONS);

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isAim4priceAdminEmail(value: unknown): boolean {
  return normalizeEmail(value) === AIM4PRICE_ADMIN_EMAIL;
}

export function normalizeAccountStatus(value: unknown): AccountStatus {
  const normalized =
    typeof value === "string"
      ? value
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_")
      : "";
  return ACCOUNT_STATUS_SET.has(normalized)
    ? (normalized as AccountStatus)
    : "pending_payment";
}

export function normalizeIntroducedByOption(
  value: unknown,
): IntroducedByOption {
  const normalized =
    typeof value === "string"
      ? value
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_")
      : "";

  if (
    normalized === "no_one" ||
    normalized === "none" ||
    normalized === "direct_signup"
  ) {
    return "direct";
  }

  return INTRODUCED_BY_OPTION_SET.has(normalized)
    ? (normalized as IntroducedByOption)
    : "direct";
}

export function cleanIntroducedByName(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, 120)
    : "";
}

export function resolveIntroducedByDisplay(
  option: unknown,
  name: unknown,
): string {
  const normalizedOption = normalizeIntroducedByOption(option);
  const cleanedName = cleanIntroducedByName(name);

  if (normalizedOption === "kuyler") return "Kuyler";
  if (normalizedOption === "andre") return "Andre";
  if (normalizedOption === "direct") return "No one / direct signup";

  return cleanedName || "Other";
}

export function accountStatusLabel(status: unknown): string {
  const normalized = normalizeAccountStatus(status);

  if (normalized === "active") return "Active";
  if (normalized === "suspended") return "Suspended";
  return "Pending payment";
}
