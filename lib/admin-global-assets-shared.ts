export type AdminAssetLocationFilter = "all" | "mapped" | "missing";
export type AdminAssetParticipationFilter = "all" | "enabled" | "disabled";
export type AdminAssetInterestFilter = "all" | "viewed" | "repeat" | "unviewed";
export type AdminAssetSort =
  | "updated"
  | "popular"
  | "repeat-interest"
  | "recent-view"
  | "value-high"
  | "value-low"
  | "owner"
  | "asset";

export type AdminGlobalAssetOwner = {
  userId: string;
  label: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  accountType: string;
  accountSubtype: string;
  accountStatus: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  discoveryParticipationEnabled: boolean;
};

export type AdminGlobalAsset = {
  id: string;
  ownerUserId: string;
  registerId: string;
  registerLabel: string;
  title: string;
  kind: string;
  assetTypeLabel: string;
  sectorKey: string;
  sectorLabel: string;
  value: number;
  hasSavedValue: boolean;
  selectedMethod: string;
  brandName: string;
  modelName: string;
  typedModelName: string;
  yearModel: number | null;
  hours: number | null;
  lifeWorkedPercent: number | null;
  usageMetric: string;
  condition: string;
  serialNumber: string;
  registrationNumber: string;
  publicAssetCode: string;
  plateLabel: string;
  qrStatus: string;
  lifecycleState: string;
  lastScannedAtIso: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastKnownLocationText: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
  totalViews: number;
  accountViews: number;
  unknownViews: number;
  uniqueViewers: number;
  lastViewedAtIso: string | null;
  repeatViewerViews: number;
  repeatViewerLabel: string;
  repeatViewerAccountType: string;
  repeatViewerLastViewedAtIso: string | null;
  hasRepeatInterest: boolean;
  owner: AdminGlobalAssetOwner;
};

export type AdminGlobalAssetSummary = {
  totalAssets: number;
  mappedAssets: number;
  missingLocationAssets: number;
  ownerAccounts: number;
  totalValueExVat: number;
  valuedAssets: number;
  missingValueAssets: number;
  discoveryEnabledAssets: number;
  discoveryDisabledAssets: number;
  totalViews: number;
  accountViews: number;
  unknownViews: number;
  viewedAssets: number;
  repeatInterestAssets: number;
};

export type AdminDiscoveryViewerKind = "account" | "unknown";

export type AdminDiscoveryViewerGroup = {
  viewerKey: string;
  viewerKind: AdminDiscoveryViewerKind;
  viewerLabel: string;
  viewerEmail: string;
  viewerAccountType: string;
  viewCount: number;
  firstViewedAtIso: string;
  lastViewedAtIso: string;
  hasRepeatInterest: boolean;
};

export type AdminDiscoveryViewEvent = {
  id: string;
  viewerKey: string;
  viewerKind: AdminDiscoveryViewerKind;
  viewerLabel: string;
  viewerEmail: string;
  viewerAccountType: string;
  viewedAtIso: string;
};

export type AdminDiscoveryViewDetails = {
  assetId: string;
  totalViews: number;
  accountViews: number;
  unknownViews: number;
  uniqueViewers: number;
  repeatViewers: number;
  page: number;
  pageSize: number;
  totalPages: number;
  viewerGroups: AdminDiscoveryViewerGroup[];
  events: AdminDiscoveryViewEvent[];
};

export type AdminAssetFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type AdminGlobalAssetOptions = {
  owners: AdminAssetFilterOption[];
  provinces: AdminAssetFilterOption[];
  sectors: AdminAssetFilterOption[];
  lifecycleStates: AdminAssetFilterOption[];
};

export type AdminAssetMapReport = {
  generatedAtIso: string;
  assets: AdminGlobalAsset[];
  summary: AdminGlobalAssetSummary;
  options: AdminGlobalAssetOptions;
};

export type AdminDiscoveryFilters = {
  search: string;
  ownerUserId: string;
  province: string;
  sector: string;
  participation: AdminAssetParticipationFilter;
  location: AdminAssetLocationFilter;
  interest: AdminAssetInterestFilter;
  lifecycleState: string;
  sort: AdminAssetSort;
  page: number;
  pageSize: number;
  focusAssetId: string;
};

export type AdminDiscoveryReport = {
  generatedAtIso: string;
  assets: AdminGlobalAsset[];
  summary: AdminGlobalAssetSummary;
  options: AdminGlobalAssetOptions;
  filters: AdminDiscoveryFilters;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
};

export const ADMIN_DISCOVERY_PAGE_SIZES = [25, 50, 100] as const;

export function formatAdminAssetMoney(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatAdminAssetValue(
  asset: Pick<AdminGlobalAsset, "value" | "hasSavedValue">,
): string {
  return asset.hasSavedValue ? formatAdminAssetMoney(asset.value) : "Not saved";
}

export function hasAdminAssetCoordinates(asset: Pick<AdminGlobalAsset, "lastKnownLat" | "lastKnownLng">): boolean {
  const latitude = asset.lastKnownLat;
  const longitude = asset.lastKnownLng;
  return (
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}
