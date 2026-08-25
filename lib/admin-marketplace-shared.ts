export type AdminMarketplaceListingStatus = 'live' | 'withdrawn' | 'draft' | 'other';

export type AdminMarketplaceAssetRow = {
  assetKey: string;
  sourceAssetId: string | null;
  latestListingId: string;
  accountUserId: string;
  title: string;
  description: string;
  status: AdminMarketplaceListingStatus;
  askingPriceExVat: number;
  sellerLabel: string;
  sellerName: string;
  sellerCompany: string;
  sellerEmail: string;
  province: string;
  area: string;
  sectorKey: string;
  sectorLabel: string;
  familyLabel: string;
  brandName: string;
  modelName: string;
  firstAdvertisedAtIso: string;
  lastAdvertisedAtIso: string;
  listingEvents: number;
};

export type AdminMarketplaceMetrics = {
  totalUniqueAssets: number;
  totalListingEvents: number;
  relistedAssets: number;
  allTimeAdvertisedValueExVat: number;
  liveAssets: number;
  liveAdvertisedValueExVat: number;
  withdrawnAssets: number;
  accountsAdvertising: number;
  firstAdvertisedAtIso: string | null;
};

export type AdminMarketplaceReport = {
  generatedAtIso: string;
  metrics: AdminMarketplaceMetrics;
  assets: AdminMarketplaceAssetRow[];
};

export type AdminMarketplaceSort =
  | 'latest'
  | 'oldest'
  | 'value-high'
  | 'value-low'
  | 'asset-az';

export type AdminMarketplaceFilters = {
  search: string;
  status: 'all' | AdminMarketplaceListingStatus;
  sector: string;
  advertised: string;
  sort: AdminMarketplaceSort;
};

function finiteMoney(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value * 100) / 100) : 0;
}

function dateTime(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function searchable(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-ZA');
}

function matchesAdvertisedFilter(
  row: AdminMarketplaceAssetRow,
  filter: string,
  now: Date,
): boolean {
  if (!filter || filter === 'all') return true;

  const advertisedAt = dateTime(row.lastAdvertisedAtIso);
  if (!advertisedAt) return false;

  if (filter === 'last-30-days' || filter === 'last-90-days') {
    const days = filter === 'last-30-days' ? 30 : 90;
    return advertisedAt >= now.getTime() - days * 24 * 60 * 60 * 1000;
  }

  if (filter.startsWith('year:')) {
    const year = Number(filter.slice('year:'.length));
    return Number.isInteger(year) && new Date(advertisedAt).getFullYear() === year;
  }

  return true;
}

export function formatAdminMarketplaceMoney(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
    .format(finiteMoney(value))
    .replace(/\u00a0/g, ' ');
}

export function summarizeAdminMarketplaceAssets(
  assets: AdminMarketplaceAssetRow[],
): AdminMarketplaceMetrics {
  let allTimeAdvertisedValueExVat = 0;
  let liveAdvertisedValueExVat = 0;
  let liveAssets = 0;
  let withdrawnAssets = 0;
  let totalListingEvents = 0;
  let relistedAssets = 0;
  let firstAdvertisedAtIso: string | null = null;
  let firstAdvertisedAt = Number.POSITIVE_INFINITY;
  const accountUserIds = new Set<string>();

  for (const asset of assets) {
    const askingPrice = finiteMoney(asset.askingPriceExVat);
    allTimeAdvertisedValueExVat += askingPrice;
    totalListingEvents += Math.max(1, Math.round(asset.listingEvents || 0));

    if (asset.listingEvents > 1) relistedAssets += 1;
    if (asset.status === 'live') {
      liveAssets += 1;
      liveAdvertisedValueExVat += askingPrice;
    }
    if (asset.status === 'withdrawn') withdrawnAssets += 1;
    if (asset.accountUserId) accountUserIds.add(asset.accountUserId);

    const advertisedAt = dateTime(asset.firstAdvertisedAtIso);
    if (advertisedAt && advertisedAt < firstAdvertisedAt) {
      firstAdvertisedAt = advertisedAt;
      firstAdvertisedAtIso = asset.firstAdvertisedAtIso;
    }
  }

  return {
    totalUniqueAssets: assets.length,
    totalListingEvents,
    relistedAssets,
    allTimeAdvertisedValueExVat: finiteMoney(allTimeAdvertisedValueExVat),
    liveAssets,
    liveAdvertisedValueExVat: finiteMoney(liveAdvertisedValueExVat),
    withdrawnAssets,
    accountsAdvertising: accountUserIds.size,
    firstAdvertisedAtIso,
  };
}

export function filterAndSortAdminMarketplaceAssets(
  assets: AdminMarketplaceAssetRow[],
  filters: AdminMarketplaceFilters,
  now = new Date(),
): AdminMarketplaceAssetRow[] {
  const search = searchable(filters.search);

  const filtered = assets.filter((asset) => {
    if (filters.status !== 'all' && asset.status !== filters.status) return false;
    if (filters.sector !== 'all' && asset.sectorKey !== filters.sector) return false;
    if (!matchesAdvertisedFilter(asset, filters.advertised, now)) return false;

    if (!search) return true;

    return searchable([
      asset.title,
      asset.description,
      asset.brandName,
      asset.modelName,
      asset.familyLabel,
      asset.sectorLabel,
      asset.sellerLabel,
      asset.sellerName,
      asset.sellerCompany,
      asset.sellerEmail,
      asset.province,
      asset.area,
      asset.sourceAssetId ?? '',
      asset.latestListingId,
    ].join(' ')).includes(search);
  });

  return filtered.sort((left, right) => {
    if (filters.sort === 'oldest') {
      return dateTime(left.firstAdvertisedAtIso) - dateTime(right.firstAdvertisedAtIso);
    }
    if (filters.sort === 'value-high') {
      return right.askingPriceExVat - left.askingPriceExVat;
    }
    if (filters.sort === 'value-low') {
      return left.askingPriceExVat - right.askingPriceExVat;
    }
    if (filters.sort === 'asset-az') {
      return left.title.localeCompare(right.title, 'en-ZA', { sensitivity: 'base' });
    }

    return dateTime(right.lastAdvertisedAtIso) - dateTime(left.lastAdvertisedAtIso);
  });
}
