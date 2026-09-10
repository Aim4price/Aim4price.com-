export type ListingWatchFilters = { sector: string; family: string; query: string; province: string; minPrice: number | null; maxPrice: number | null };
export type ListingWatch = { enabled: boolean; delivery: 'daily' | 'instant'; filters: ListingWatchFilters };
export const EMPTY_LISTING_FILTERS: ListingWatchFilters = { sector: '', family: '', query: '', province: '', minPrice: null, maxPrice: null };
export function listingMatchKey(value: string) { return value.trim().toLowerCase().replace(/[_\s-]+/g, '-'); }
export function parseListingWatch(value: unknown): ListingWatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Choose your listing interests.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['enabled','delivery','filters'].includes(key))) throw new Error('Unknown listing setting.');
  if (typeof input.enabled !== 'boolean' || !['daily','instant'].includes(String(input.delivery))) throw new Error('Choose daily or immediate alerts.');
  if (!input.filters || typeof input.filters !== 'object' || Array.isArray(input.filters)) throw new Error('Choose your listing interests.');
  const raw = input.filters as Record<string, unknown>;
  if (Object.keys(raw).some(key => !(key in EMPTY_LISTING_FILTERS))) throw new Error('Unknown listing filter.');
  const filters = { ...EMPTY_LISTING_FILTERS };
  for (const key of ['sector','family','query','province'] as const) {
    if (typeof raw[key] !== 'string' || raw[key].length > 120) throw new Error('Keep search details under 120 characters.');
    filters[key] = raw[key].trim();
  }
  if (filters.sector && !['agricultural','construction','industrial','motor'].includes(filters.sector)) throw new Error('Choose a sector.');
  if (filters.family && !filters.sector) throw new Error('Choose a sector for this asset type.');
  for (const key of ['minPrice','maxPrice'] as const) {
    const n = raw[key];
    if (n !== null && (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1e12)) throw new Error('Enter a valid price.');
    filters[key] = n as number | null;
  }
  if (filters.minPrice !== null && filters.maxPrice !== null && filters.minPrice > filters.maxPrice) throw new Error('Maximum price must be at least the minimum.');
  if (input.enabled && !filters.sector && !filters.query && !filters.family) throw new Error('Choose a sector or search before saving alerts.');
  return { enabled: input.enabled, delivery: input.delivery as ListingWatch['delivery'], filters };
}
export function matchesListingWatch(filters: ListingWatchFilters, listing: {
  sectorKey?: string; familyKey?: string; title: string; brandName: string; modelName: string; province: string; askingPriceExVat: number;
}) {
  if (filters.sector && listingMatchKey(filters.sector) !== listingMatchKey(listing.sectorKey || '')) return false;
  if (filters.family && listingMatchKey(filters.family) !== listingMatchKey(listing.familyKey || '')) return false;
  if (filters.province && listingMatchKey(filters.province) !== listingMatchKey(listing.province)) return false;
  const haystack = `${listing.title} ${listing.brandName} ${listing.modelName}`.toLowerCase();
  if (filters.query.toLowerCase().split(/\s+/).filter(Boolean).some(word => !haystack.includes(word))) return false;
  return (filters.minPrice === null || listing.askingPriceExVat >= filters.minPrice)
    && (filters.maxPrice === null || listing.askingPriceExVat <= filters.maxPrice);
}
