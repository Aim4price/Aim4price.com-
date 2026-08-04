export type AccountProfile = {
  userId: string;
  name: string;
  displayName: string;
  email: string;
  logoUrl: string;
  websiteUrl: string;
  extraPhotoUrls: string[];
  businessName: string;
  phone: string;
  accountType: string;
  accountSubtype: string;
  accountStatus: string;
  accountStatusLabel: string;
  introducedByOption: string;
  introducedByName: string;
  introducedByDisplay: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
  marketplaceSellerName: string;
  marketplacePhone: string;
  marketplaceEmail: string;
  marketplaceLocation: string;
  discoveryParticipationEnabled: boolean;
  partnerDirectoryEnabled: boolean;
  partnerDirectoryStatus: string;
  partnerDescription: string;
  partnerLatitude: number | null;
  partnerLongitude: number | null;
  partnerServiceRadiusKm: number | null;
  partnerBrandFocus: string;
  partnerServices: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

export type AccountScanPinStatus = {
  enabled: boolean;
  hasPin: boolean;
  updatedAtIso: string | null;
};

export type AccountProfileResponse = {
  ok: boolean;
  profile?: AccountProfile;
  error?: string;
};

export const SOUTH_AFRICAN_PROVINCES = [
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

export function normalizedAccountType(profile: Pick<AccountProfile, "accountType">): string {
  return String(profile.accountType || "owner").trim().toLowerCase();
}

export function isOwnerProfile(profile: Pick<AccountProfile, "accountType">): boolean {
  return normalizedAccountType(profile) === "owner";
}

export function isDealerProfile(profile: Pick<AccountProfile, "accountType">): boolean {
  return normalizedAccountType(profile) === "dealer";
}

export function accountTypeLabel(profile: Pick<AccountProfile, "accountType" | "accountSubtype">): string {
  const accountType = normalizedAccountType(profile);
  const subtype = String(profile.accountSubtype || "").trim().toLowerCase();

  if (accountType === "dealer") {
    if (subtype === "auctioneer") return "Auctioneer";
    if (subtype === "motor-dealer") return "Motor dealer";
    return "Machinery dealer";
  }

  if (accountType === "finance") {
    if (subtype === "accountant") return "Accounting";
    if (subtype === "finance-house") return "Finance house";
    return "Finance";
  }

  if (accountType === "insurance") return "Insurance";
  return "Owner";
}

export function profileDisplayName(profile: AccountProfile): string {
  return profile.businessName.trim() || profile.displayName.trim() || profile.name.trim() || "Aim4price account";
}

export function profileLocation(profile: AccountProfile): string {
  return [profile.townCity.trim(), profile.province.trim()].filter(Boolean).join(", ") || "Location not added";
}

export function profileCompletion(profile: AccountProfile): {
  complete: boolean;
  completed: number;
  total: number;
  missing: string[];
} {
  const checks = [
    ["name", profile.displayName.trim() || profile.name.trim()],
    ["contact number", profile.phone.trim()],
    ["province", profile.province.trim()],
    ["town or city", profile.townCity.trim()],
    ["logo", profile.logoUrl.trim()],
  ] as const;
  const missing = checks.filter(([, value]) => !value).map(([label]) => label);

  return {
    complete: missing.length === 0,
    completed: checks.length - missing.length,
    total: checks.length,
    missing,
  };
}

export function buildProfileUpdatePayload(
  profile: AccountProfile,
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    displayName: profile.displayName,
    logoUrl: profile.logoUrl,
    websiteUrl: profile.websiteUrl,
    extraPhotoUrls: [],
    businessName: profile.businessName,
    phone: profile.phone,
    accountType: profile.accountType,
    accountSubtype: profile.accountSubtype,
    vatNumber: profile.vatNumber,
    province: profile.province,
    townCity: profile.townCity,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2,
    notes: profile.notes,
    marketplaceSellerName: profile.marketplaceSellerName,
    marketplacePhone: profile.marketplacePhone,
    marketplaceEmail: profile.marketplaceEmail,
    marketplaceLocation: profile.marketplaceLocation,
    partnerDirectoryEnabled: profile.partnerDirectoryEnabled,
    partnerDirectoryStatus: profile.partnerDirectoryStatus,
    partnerDescription: profile.partnerDescription,
    partnerLatitude: profile.partnerLatitude,
    partnerLongitude: profile.partnerLongitude,
    partnerServiceRadiusKm: profile.partnerServiceRadiusKm,
    partnerBrandFocus: profile.partnerBrandFocus,
    partnerServices: profile.partnerServices,
    ...overrides,
  };

  if (isOwnerProfile(profile)) {
    payload.discoveryParticipationEnabled =
      typeof overrides.discoveryParticipationEnabled === "boolean"
        ? overrides.discoveryParticipationEnabled
        : profile.discoveryParticipationEnabled;
  } else {
    delete payload.discoveryParticipationEnabled;
  }

  return payload;
}

export function readResponseError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fallback;
  const record = payload as Record<string, unknown>;
  return typeof record.error === "string" && record.error.trim()
    ? record.error
    : typeof record.message === "string" && record.message.trim()
      ? record.message
      : fallback;
}
