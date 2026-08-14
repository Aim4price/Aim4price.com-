import {
  listings as prototypeMarketplaceListings,
  tractors,
  type CabType,
  type DriveType,
  type MarketplaceListing as TractorMarketplaceListing,
  type TractorCatalogRow,
  type TractorType,
} from './tractor-data';
import type { SavedItem } from './register';
import type { AdBrandSnapshot } from './ad-studio';

export const MARKETPLACE_STORAGE_KEY = 'aim4price-tractors-kit-marketplace';
export const FALLBACK_MARKETPLACE_IMAGE = '/brand/Tractor.png';

export type MarketplaceDealRating = 'low' | 'great' | 'fair' | 'high' | 'none';

export type MarketplaceDealRatingResult = {
  rating: MarketplaceDealRating;
  percentDiff: number | null;
};

export function calculateMarketplaceDealRating(input: {
  askingPriceExVat: unknown;
  aim4priceValueExVat?: unknown;
  isManualEquipment?: boolean;
}): MarketplaceDealRatingResult {
  const askingPrice = Number(input.askingPriceExVat);
  const aim4priceValue = Number(input.aim4priceValueExVat);

  if (
    input.isManualEquipment ||
    !Number.isFinite(askingPrice) ||
    askingPrice <= 0 ||
    !Number.isFinite(aim4priceValue) ||
    aim4priceValue <= 0
  ) {
    return { rating: 'none', percentDiff: null };
  }

  const percentDiff = ((askingPrice - aim4priceValue) / aim4priceValue) * 100;

  if (percentDiff <= -10) {
    return { rating: 'low', percentDiff };
  }

  if (percentDiff < -5) {
    return { rating: 'great', percentDiff };
  }

  if (percentDiff <= 5) {
    return { rating: 'fair', percentDiff };
  }

  return { rating: 'high', percentDiff };
}

export type MarketplaceListing = {
  id: string;
  sourceAssetId?: string;
  modelId?: string;
  title: string;
  brandName: string;
  brandSlug: string;
  modelName: string;
  tractorType: TractorType;
  drive: DriveType;
  cab: CabType;
  powerKw: number;
  powerHp: number;
  horsepowerHp: number;
  yearModel: number;
  year: number;
  hours: number;
  usageUnit: 'hours' | 'km' | 'percent';
  lifeWorkedPercent?: number | null;
  province: string;
  area: string;
  location: string;
  sourceName?: string;
  sourceUrl?: string;
  description: string;
  sellerName: string;
  sellerCompany?: string;
  sellerPhone: string;
  sellerEmail?: string;
  dateAdvertised: string;
  publishedAtIso: string;
  askingPriceExVat: number;
  advertisedPriceExVat: number;
  priceExVat: number;
  price: number;
  aim4priceValueExVat?: number;
  dealRating?: MarketplaceDealRating;
  dealRatingPercentDiff?: number | null;
  imageSrc: string;
  imageUrls: string[];
  publishedBy: 'seed' | 'asset-register';
  assetKind?: string;
  canManage?: boolean;
  adBrand?: AdBrandSnapshot;
  sectorKey?: string;
  sectorLabel?: string;
  familyKey?: string;
  familyLabel?: string;
  conditionKey?: string;
  conditionLabel?: string;
};

export type PublishMarketplaceInput = {
  province?: string;
  area?: string;
  askingPriceExVat?: number;
  description?: string;
  sellerName?: string;
  sellerCompany?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  imageSrc?: string;
  imageUrls?: string[];
};

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanText(value: string | undefined, fallback = ''): string {
  const next = String(value ?? '').trim();
  return next || fallback;
}

function cleanUnknownText(value: unknown, fallback = ''): string {
  return cleanText(typeof value === 'string' ? value : undefined, fallback);
}

function cleanNumber(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function cleanUnknownNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeConditionKey(value: unknown): string {
  const normalized = cleanUnknownText(value).toLowerCase().replace(/[_-]+/g, ' ');

  if (normalized === 'excellent') return 'excellent';
  if (normalized === 'good') return 'good';
  if (normalized === 'fair') return 'fair';
  if (normalized === 'used') return 'used';
  if (normalized === 'serious' || normalized === 'serious wear') return 'serious';
  return '';
}

function normalizeUsageUnit(value: unknown): MarketplaceListing['usageUnit'] {
  const normalized = cleanUnknownText(value).toLowerCase().replace(/[\s-]+/g, '_');

  if (normalized === 'km' || normalized === 'kms' || normalized === 'kilometres' || normalized === 'kilometers') {
    return 'km';
  }

  if (
    normalized === 'percent' ||
    normalized === 'percentage' ||
    normalized === 'percent_used' ||
    normalized === 'percentage_depreciation' ||
    normalized === 'wear_class'
  ) {
    return 'percent';
  }

  return 'hours';
}

function cleanPercent(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(100, Math.max(0, parsed));
}

function conditionLabel(value: string): string {
  if (value === 'excellent') return 'Excellent';
  if (value === 'good') return 'Good';
  if (value === 'fair') return 'Fair';
  if (value === 'used') return 'Used';
  if (value === 'serious') return 'Serious Wear';
  return '';
}

function safeImage(src?: string): string {
  return String(src ?? '').trim();
}

function buildImageList(primaryImage: string, imageUrls?: string[]): string[] {
  const cleaned = [primaryImage, ...(imageUrls ?? [])]
    .map((item) => safeImage(item))
    .filter(Boolean);

  return Array.from(new Set(cleaned));
}

function createPrototypeSeller(area: string, index: number) {
  const padded = String(index + 1).padStart(2, '0');
  const emailSlug = slugify(area).replace(/-/g, '');

  return {
    sellerName: `${titleCase(area)} Machinery`,
    sellerCompany: `${titleCase(area)} Tractor Sales`,
    sellerPhone: `+27 82 555 01${padded}`,
    sellerEmail: `${emailSlug}@aim4price-demo.co.za`,
  };
}

function findMatchingTractor(item: SavedItem): TractorCatalogRow | undefined {
  const brandName = cleanText(item.brandName).toLowerCase();
  const modelName = cleanText(item.modelName).toLowerCase();

  if (!brandName || !modelName) {
    return undefined;
  }

  return tractors.find(
    (tractor) =>
      tractor.brandName.toLowerCase() === brandName && tractor.modelName.toLowerCase() === modelName,
  );
}

function normalizeDrive(value: unknown): DriveType {
  const normalized = cleanUnknownText(value).toLowerCase();
  if (normalized === '2wd') return '2wd';
  if (normalized === 'tracks') return 'tracks';
  return '4wd';
}

function normalizeCab(value: unknown): CabType {
  const normalized = cleanUnknownText(value).toLowerCase();
  if (normalized === 'open station' || normalized === 'open-station') return 'open-station';
  return 'cab';
}

function normalizeTractorType(value: unknown): TractorType {
  return cleanUnknownText(value).toLowerCase() === 'orchard' ? 'orchard' : 'field';
}

function normalizeImageUrls(value: unknown, imageSrc: string): string[] {
  if (!Array.isArray(value)) {
    return imageSrc ? [imageSrc] : [];
  }

  const urls = [imageSrc, ...value]
    .map((entry) => cleanUnknownText(entry))
    .filter(Boolean)
    .map((entry) => safeImage(entry))
    .filter(Boolean);

  return Array.from(new Set(urls));
}

function fromPrototypeMarketplaceListing(
  listing: TractorMarketplaceListing,
  index: number,
): MarketplaceListing {
  const seller = createPrototypeSeller(listing.area, index);
  const imageSrc = safeImage(listing.imageSrc);
  const aim4priceValueExVat = Math.round(cleanUnknownNumber(listing.priceExVat, 0));
  const dealRating = calculateMarketplaceDealRating({
    askingPriceExVat: listing.askingPriceExVat,
    aim4priceValueExVat,
  });

  return {
    id: `seed-${listing.id}`,
    modelId: listing.modelId,
    title: `${listing.brandName} ${listing.modelName}`,
    brandName: listing.brandName,
    brandSlug: listing.brandSlug,
    modelName: listing.modelName,
    tractorType: listing.tractorType,
    drive: listing.drive,
    cab: listing.cab,
    powerKw: listing.powerKw,
    powerHp: listing.powerHp,
    horsepowerHp: listing.horsepowerHp,
    yearModel: listing.yearModel,
    year: listing.year,
    hours: listing.hours,
    usageUnit: 'hours',
    province: listing.province,
    area: listing.area,
    location: listing.location,
    sourceName: listing.sourceName,
    sourceUrl: listing.sourceUrl,
    description: `${listing.brandName} ${listing.modelName} listed in ${listing.area}, ${listing.province}. Prototype Aim4price marketplace listing.`,
    sellerName: seller.sellerName,
    sellerCompany: seller.sellerCompany,
    sellerPhone: seller.sellerPhone,
    sellerEmail: seller.sellerEmail,
    dateAdvertised: listing.dateAdvertised,
    publishedAtIso: `${listing.dateAdvertised}T08:00:00.000Z`,
    askingPriceExVat: listing.askingPriceExVat,
    advertisedPriceExVat: listing.advertisedPriceExVat,
    priceExVat: listing.priceExVat,
    price: listing.price,
    aim4priceValueExVat: aim4priceValueExVat > 0 ? aim4priceValueExVat : undefined,
    dealRating: dealRating.rating,
    dealRatingPercentDiff: dealRating.percentDiff,
    imageSrc,
    imageUrls: imageSrc ? [imageSrc] : [],
    sectorKey: 'agricultural',
    sectorLabel: 'Agriculture',
    assetKind: 'tractor',
    familyKey: 'tractors',
    familyLabel: 'Tractors',
    conditionKey: 'good',
    conditionLabel: 'Good',
    publishedBy: 'seed',
  };
}

export const seedMarketplaceListings: MarketplaceListing[] = prototypeMarketplaceListings.map(
  fromPrototypeMarketplaceListing,
);

function normalizeStoredListing(value: unknown): MarketplaceListing | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = cleanUnknownText(value.id);
  const brandName = cleanUnknownText(value.brandName);
  const modelName = cleanUnknownText(value.modelName);
  const title = cleanUnknownText(value.title, `${brandName} ${modelName}`.trim());

  if (!id || !brandName || !modelName || !title) {
    return null;
  }

  const publishedAtIso = cleanUnknownText(value.publishedAtIso, new Date().toISOString());
  const imageSrc = safeImage(cleanUnknownText(value.imageSrc));
  const askingPriceExVat = Math.round(cleanUnknownNumber(value.askingPriceExVat ?? value.priceExVat ?? value.price, 0));
  const aim4priceValueExVat = Math.round(
    cleanUnknownNumber(
      value.aim4priceValueExVat ??
        value.aim4price_value_ex_vat ??
        value.selectedValueExVat ??
        value.selected_value_ex_vat ??
        value.savedValueExVat ??
        value.saved_value_ex_vat ??
        value.valuationValueExVat ??
        value.valuation_value_ex_vat,
      0,
    ),
  );
  const assetKind = cleanUnknownText(value.assetKind ?? value.asset_kind ?? value.kind) || undefined;
  const normalizedAssetKind = cleanUnknownText(assetKind).toLowerCase().replace(/[_\s-]+/g, '-');
  const valuationMethod = cleanUnknownText(value.selectedMethod ?? value.selected_method ?? value.valuationMethod ?? value.valuation_method)
    .toLowerCase()
    .replace(/[_\s-]+/g, '-');
  const dealRating = calculateMarketplaceDealRating({
    askingPriceExVat,
    aim4priceValueExVat,
    isManualEquipment: normalizedAssetKind === 'manual' || valuationMethod === 'manual',
  });

  return {
    id,
    sourceAssetId: cleanUnknownText(
      value.sourceAssetId ?? value.registerItemId ?? value.assetId ?? value.itemId ?? value.savedItemId ?? value.sourceId,
    ) || undefined,
    modelId: cleanUnknownText(value.modelId) || undefined,
    title,
    brandName,
    brandSlug: cleanUnknownText(value.brandSlug, slugify(brandName)),
    modelName,
    tractorType: normalizeTractorType(value.tractorType),
    drive: normalizeDrive(value.drive),
    cab: normalizeCab(value.cab),
    powerKw: Math.round(cleanUnknownNumber(value.powerKw, 0)),
    powerHp: Math.round(cleanUnknownNumber(value.powerHp ?? value.horsepowerHp, 0)),
    horsepowerHp: Math.round(cleanUnknownNumber(value.horsepowerHp ?? value.powerHp, 0)),
    yearModel: Math.round(cleanUnknownNumber(value.yearModel ?? value.year, new Date().getFullYear())),
    year: Math.round(cleanUnknownNumber(value.year ?? value.yearModel, new Date().getFullYear())),
    hours: Math.round(cleanUnknownNumber(value.hours, 0)),
    usageUnit: normalizeUsageUnit(value.usageUnit ?? value.usage_unit),
    lifeWorkedPercent: cleanPercent(
      value.lifeWorkedPercent ??
        value.life_worked_percent ??
        value.workedPercent ??
        value.worked_percent ??
        value.percentWorked ??
        value.percent_worked ??
        value.lifetimeWorkedPercent ??
        value.lifetime_worked_percent,
    ),
    province: cleanUnknownText(value.province, 'South Africa'),
    area: cleanUnknownText(value.area, 'Undisclosed'),
    location: cleanUnknownText(value.location, `${cleanUnknownText(value.area, 'Undisclosed')}, ${cleanUnknownText(value.province, 'South Africa')}`),
    sourceName: cleanUnknownText(value.sourceName) || undefined,
    sourceUrl: cleanUnknownText(value.sourceUrl) || undefined,
    description: cleanUnknownText(value.description, `${brandName} ${modelName} listed on the Aim4price marketplace.`),
    sellerName: cleanUnknownText(value.sellerName, 'Aim4price seller'),
    sellerCompany: cleanUnknownText(value.sellerCompany) || undefined,
    sellerPhone: cleanUnknownText(value.sellerPhone, '+27 00 000 0000'),
    sellerEmail: cleanUnknownText(value.sellerEmail) || undefined,
    dateAdvertised: cleanUnknownText(value.dateAdvertised, publishedAtIso.slice(0, 10)),
    publishedAtIso,
    askingPriceExVat,
    advertisedPriceExVat: Math.round(cleanUnknownNumber(value.advertisedPriceExVat ?? value.askingPriceExVat ?? value.priceExVat ?? value.price, 0)),
    priceExVat: Math.round(cleanUnknownNumber(value.priceExVat ?? value.askingPriceExVat ?? value.price, 0)),
    price: Math.round(cleanUnknownNumber(value.price ?? value.priceExVat ?? value.askingPriceExVat, 0)),
    aim4priceValueExVat: aim4priceValueExVat > 0 ? aim4priceValueExVat : undefined,
    dealRating: dealRating.rating,
    dealRatingPercentDiff: dealRating.percentDiff,
    imageSrc,
    imageUrls: normalizeImageUrls(value.imageUrls, imageSrc),
    assetKind,
    sectorKey: cleanUnknownText(value.sectorKey ?? value.sector_key) || undefined,
    sectorLabel: cleanUnknownText(value.sectorLabel ?? value.sector_label) || undefined,
    familyKey: cleanUnknownText(value.familyKey ?? value.family_key) || undefined,
    familyLabel: cleanUnknownText(value.familyLabel ?? value.family_label) || undefined,
    conditionKey: normalizeConditionKey(value.conditionKey ?? value.condition_key ?? value.condition) || undefined,
    conditionLabel: conditionLabel(normalizeConditionKey(value.conditionKey ?? value.condition_key ?? value.condition)) || undefined,
    publishedBy: cleanUnknownText(value.publishedBy) === 'seed' ? 'seed' : 'asset-register',
  };
}

function sortListings(items: MarketplaceListing[]): MarketplaceListing[] {
  return items
    .slice()
    .sort((a, b) => new Date(b.publishedAtIso).getTime() - new Date(a.publishedAtIso).getTime());
}

function savePublishedMarketplaceListings(items: MarketplaceListing[]): MarketplaceListing[] {
  const sorted = sortListings(items);

  if (!hasStorage()) {
    return sorted;
  }

  window.localStorage.setItem(MARKETPLACE_STORAGE_KEY, JSON.stringify(sorted));
  return sorted;
}

export function loadPublishedMarketplaceListings(): MarketplaceListing[] {
  if (!hasStorage()) {
    return [];
  }

  const raw = window.localStorage.getItem(MARKETPLACE_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortListings(
      parsed
        .map((entry) => normalizeStoredListing(entry))
        .filter((entry): entry is MarketplaceListing => entry !== null),
    );
  } catch {
    return [];
  }
}

export function loadMarketplaceListings(): MarketplaceListing[] {
  return sortListings([...loadPublishedMarketplaceListings(), ...seedMarketplaceListings]);
}

export function hasMarketplaceListingForAsset(assetId: string): boolean {
  return loadPublishedMarketplaceListings().some((listing) => listing.sourceAssetId === assetId);
}

export function removeMarketplaceListing(id: string): MarketplaceListing[] {
  const next = loadPublishedMarketplaceListings().filter((listing) => listing.id !== id);
  return savePublishedMarketplaceListings(next);
}

export function clearPublishedMarketplaceListings(): void {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.removeItem(MARKETPLACE_STORAGE_KEY);
}

export function publishRegisterItemToMarketplace(
  item: SavedItem,
  input: PublishMarketplaceInput = {},
): MarketplaceListing[] {
  if (item.kind !== 'tractor') {
    throw new Error('Only tractor assets can be published to marketplace.');
  }

  const brandName = cleanText(item.brandName);
  const modelName = cleanText(item.modelName);

  if (!brandName || !modelName) {
    throw new Error('Tractor assets need a brand and model before publishing.');
  }

  const sellerName = cleanText(input.sellerName, 'Aim4price seller');
  const sellerPhone = cleanText(input.sellerPhone ?? item.sellerPhone, '+27 00 000 0000');

  const matchedTractor = findMatchingTractor(item);
  const primaryImage = safeImage(input.imageSrc ?? item.photos?.[0]);
  const area = titleCase(cleanText(input.area, 'Undisclosed'));
  const province = titleCase(cleanText(input.province, 'South Africa'));
  const askingPrice = Math.round(cleanNumber(input.askingPriceExVat, item.selectedValueExVat ?? item.value));
  const aim4priceValueExVat = Math.round(cleanNumber(item.aim4priceValueExVat ?? item.selectedValueExVat ?? item.value, 0));
  const dealRating = calculateMarketplaceDealRating({
    askingPriceExVat: askingPrice,
    aim4priceValueExVat,
  });

  if (askingPrice <= 0) {
    throw new Error('Asking price must be greater than zero.');
  }

  const yearModel = Math.round(cleanNumber(item.yearModel, new Date().getFullYear()));
  const hours = Math.round(cleanNumber(item.hours, 0));
  const powerKw = Math.round(cleanNumber(matchedTractor?.powerKw, item.powerKw));
  const powerHp = Math.round(cleanNumber(matchedTractor?.powerHp, powerKw * 1.341));
  const imageUrls = buildImageList(primaryImage, input.imageUrls ?? item.photos);

  const listing: MarketplaceListing = {
    id: `market-${item.id}`,
    sourceAssetId: item.id,
    modelId: matchedTractor?.id,
    title: `${brandName} ${modelName}`,
    brandName,
    brandSlug: cleanText(matchedTractor?.brandSlug, slugify(brandName)),
    modelName,
    tractorType:
      matchedTractor?.tractorType ??
      ((item.tractorType === 'orchard' ? 'orchard' : 'field') as TractorType),
    drive:
      matchedTractor?.drive ??
      ((item.drive === '2wd' ? '2wd' : item.drive === 'tracks' ? 'tracks' : '4wd') as DriveType),
    cab: matchedTractor?.cab ?? ((item.cab === 'open-station' ? 'open-station' : 'cab') as CabType),
    powerKw,
    powerHp,
    horsepowerHp: powerHp,
    yearModel,
    year: yearModel,
    hours,
    usageUnit: 'hours',
    province,
    area,
    location: `${area}, ${province}`,
    description: cleanText(
      input.description,
      item.marketplaceNotes || item.note || `${brandName} ${modelName} available on the Aim4price marketplace.`,
    ),
    sellerName,
    sellerCompany: cleanText(input.sellerCompany),
    sellerPhone,
    sellerEmail: cleanText(input.sellerEmail),
    dateAdvertised: new Date().toISOString().slice(0, 10),
    publishedAtIso: new Date().toISOString(),
    askingPriceExVat: askingPrice,
    advertisedPriceExVat: askingPrice,
    priceExVat: askingPrice,
    price: askingPrice,
    aim4priceValueExVat: aim4priceValueExVat > 0 ? aim4priceValueExVat : undefined,
    dealRating: dealRating.rating,
    dealRatingPercentDiff: dealRating.percentDiff,
    imageSrc: imageUrls[0] ?? '',
    imageUrls,
    sectorKey: 'agricultural',
    sectorLabel: 'Agriculture',
    assetKind: 'tractor',
    familyKey: 'tractors',
    familyLabel: 'Tractors',
    conditionKey: 'good',
    conditionLabel: 'Good',
    publishedBy: 'asset-register',
  };

  const existing = loadPublishedMarketplaceListings().filter(
    (entry) => entry.sourceAssetId !== item.id,
  );

  return savePublishedMarketplaceListings([listing, ...existing]);
}
