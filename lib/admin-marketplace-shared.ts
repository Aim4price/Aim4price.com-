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
  totalViews: number;
  accountViews: number;
  unknownViews: number;
  viewedAssets: number;
  repeatInterestAssets: number;
};

export type AdminMarketplaceReport = {
  generatedAtIso: string;
  metrics: AdminMarketplaceMetrics;
  assets: AdminMarketplaceAssetRow[];
};

export type AdminMarketplaceOutcomeReason =
  | 'sold'
  | 'traded'
  | 'no_longer_available'
  | 'decided_not_to_sell'
  | 'created_by_mistake'
  | 'other';

export type AdminMarketplaceOutcomeRow = {
  outcomeId: string;
  listingId: string | null;
  sourceAssetId: string | null;
  accountUserId: string;
  sellerLabel: string;
  sellerEmail: string;
  title: string;
  sectorKey: string;
  sectorLabel: string;
  reason: AdminMarketplaceOutcomeReason;
  outcomeNote: string;
  aim4priceHelped: boolean;
  finalSalePriceExVat: number | null;
  askingPriceExVat: number;
  aim4priceValueExVat: number;
  totalViewsAtClose: number;
  accountViewsAtClose: number;
  unknownViewsAtClose: number;
  uniqueViewersAtClose: number;
  sourceSurface: 'marketplace' | 'showroom';
  publishedAtIso: string | null;
  closedAtIso: string;
  actorType: string;
};

export type AdminMarketplaceOutcomeMetrics = {
  totalOutcomes: number;
  soldOrTraded: number;
  aim4priceHelpedCount: number;
  notHelpedCount: number;
  helpRatePercent: number;
  recordedSaleValueExVat: number;
  avgDaysToOutcome: number;
};

export type AdminMarketplaceOutcomeReport = {
  generatedAtIso: string;
  metrics: AdminMarketplaceOutcomeMetrics;
  outcomes: AdminMarketplaceOutcomeRow[];
};

export type AdminMarketplaceViewerKind = 'account' | 'unknown';

export type AdminMarketplaceViewerGroup = {
  viewerKey: string;
  viewerKind: AdminMarketplaceViewerKind;
  viewerLabel: string;
  viewerEmail: string;
  viewerAccountType: string;
  viewCount: number;
  firstViewedAtIso: string;
  lastViewedAtIso: string;
  hasRepeatInterest: boolean;
};

export type AdminMarketplaceViewEvent = {
  id: string;
  viewerKey: string;
  viewerKind: AdminMarketplaceViewerKind;
  viewerLabel: string;
  viewerEmail: string;
  viewerAccountType: string;
  viewedAtIso: string;
};

export type AdminMarketplaceViewDetails = {
  assetId: string;
  totalViews: number;
  accountViews: number;
  unknownViews: number;
  uniqueViewers: number;
  repeatViewers: number;
  page: number;
  pageSize: number;
  totalPages: number;
  viewerGroups: AdminMarketplaceViewerGroup[];
  events: AdminMarketplaceViewEvent[];
};

export type AdminMarketplaceSort =
  | 'latest'
  | 'oldest'
  | 'popular'
  | 'repeat-interest'
  | 'recent-view'
  | 'value-high'
  | 'value-low'
  | 'asset-az';

export type AdminMarketplaceInterestFilter =
  | 'all'
  | 'viewed'
  | 'repeat'
  | 'unviewed';

export type AdminMarketplaceFilters = {
  search: string;
  status: 'all' | AdminMarketplaceListingStatus;
  sector: string;
  advertised: string;
  interest?: AdminMarketplaceInterestFilter;
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
  let totalViews = 0;
  let accountViews = 0;
  let unknownViews = 0;
  let viewedAssets = 0;
  let repeatInterestAssets = 0;
  let firstAdvertisedAtIso: string | null = null;
  let firstAdvertisedAt = Number.POSITIVE_INFINITY;
  const accountUserIds = new Set<string>();

  for (const asset of assets) {
    const askingPrice = finiteMoney(asset.askingPriceExVat);
    allTimeAdvertisedValueExVat += askingPrice;
    totalListingEvents += Math.max(1, Math.round(asset.listingEvents || 0));

    if (asset.listingEvents > 1) relistedAssets += 1;
    totalViews += Math.max(0, Math.round(asset.totalViews || 0));
    accountViews += Math.max(0, Math.round(asset.accountViews || 0));
    unknownViews += Math.max(0, Math.round(asset.unknownViews || 0));
    if (asset.totalViews > 0) viewedAssets += 1;
    if (asset.hasRepeatInterest || asset.repeatViewerViews >= 3) repeatInterestAssets += 1;
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
    totalViews,
    accountViews,
    unknownViews,
    viewedAssets,
    repeatInterestAssets,
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
    if (filters.interest === 'viewed' && asset.totalViews <= 0) return false;
    if (filters.interest === 'repeat' && !asset.hasRepeatInterest) return false;
    if (filters.interest === 'unviewed' && asset.totalViews > 0) return false;

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
      asset.repeatViewerLabel,
      asset.repeatViewerAccountType,
    ].join(' ')).includes(search);
  });

  return filtered.sort((left, right) => {
    if (filters.sort === 'popular') {
      return right.totalViews - left.totalViews || dateTime(right.lastViewedAtIso || '') - dateTime(left.lastViewedAtIso || '');
    }
    if (filters.sort === 'repeat-interest') {
      return right.repeatViewerViews - left.repeatViewerViews || right.totalViews - left.totalViews;
    }
    if (filters.sort === 'recent-view') {
      return dateTime(right.lastViewedAtIso || '') - dateTime(left.lastViewedAtIso || '');
    }
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

export function formatAdminMarketplaceOutcomeReason(
  reason: AdminMarketplaceOutcomeReason,
): string {
  if (reason === 'sold') return 'Sold';
  if (reason === 'traded') return 'Traded in';
  if (reason === 'no_longer_available') return 'No longer available';
  if (reason === 'decided_not_to_sell') return 'Decided not to sell';
  if (reason === 'created_by_mistake') return 'Advert created by mistake';
  return 'Other';
}

export function summarizeAdminMarketplaceOutcomes(
  outcomes: AdminMarketplaceOutcomeRow[],
): AdminMarketplaceOutcomeMetrics {
  let soldOrTraded = 0;
  let aim4priceHelpedCount = 0;
  let recordedSaleValueExVat = 0;
  let totalDaysToOutcome = 0;
  let timedOutcomeCount = 0;

  for (const outcome of outcomes) {
    const isSaleOutcome = outcome.reason === 'sold' || outcome.reason === 'traded';
    if (isSaleOutcome) {
      soldOrTraded += 1;
      recordedSaleValueExVat += finiteMoney(outcome.finalSalePriceExVat ?? 0);
    }
    if (outcome.aim4priceHelped) aim4priceHelpedCount += 1;

    const publishedAt = dateTime(outcome.publishedAtIso ?? '');
    const closedAt = dateTime(outcome.closedAtIso);
    if (publishedAt && closedAt >= publishedAt) {
      totalDaysToOutcome += (closedAt - publishedAt) / 86_400_000;
      timedOutcomeCount += 1;
    }
  }

  const totalOutcomes = outcomes.length;
  return {
    totalOutcomes,
    soldOrTraded,
    aim4priceHelpedCount,
    notHelpedCount: Math.max(0, totalOutcomes - aim4priceHelpedCount),
    helpRatePercent: totalOutcomes
      ? Math.round((aim4priceHelpedCount / totalOutcomes) * 1_000) / 10
      : 0,
    recordedSaleValueExVat: finiteMoney(recordedSaleValueExVat),
    avgDaysToOutcome: timedOutcomeCount
      ? Math.round((totalDaysToOutcome / timedOutcomeCount) * 10) / 10
      : 0,
  };
}
