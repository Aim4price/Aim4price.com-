import {
  listings as marketVaultListings,
  tractors,
  type CabType,
  type DriveType,
  type MarketplaceListing as TractorMarketplaceListing,
  type TractorCatalogRow,
  type TractorType,
} from './tractor-data';
import type { SavedItem } from './register';

export const MARKETPLACE_STORAGE_KEY = 'aim4price-tractors-kit-marketplace';
export const FALLBACK_MARKETPLACE_IMAGE = '/brand/Tractor.png';

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
  province: string;
  area: string;
  location: string;
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
  imageSrc: string;
  imageUrls: string[];
  publishedBy: 'seed' | 'asset-register';
};

export type PublishMarketplaceInput = {
  province: string;
  area: string;
  askingPriceExVat: number;
  description?: string;
  sellerName: string;
  sellerCompany?: string;
  sellerPhone: string;
  sellerEmail?: string;
  imageSrc?: string;
  imageUrls?: string[];
};

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
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

function cleanNumber(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function safeImage(src?: string): string {
  const next = String(src ?? '').trim();
  return next || FALLBACK_MARKETPLACE_IMAGE;
}

function buildImageList(primaryImage: string, imageUrls?: string[]): string[] {
  const cleaned = (imageUrls ?? []).map((item) => safeImage(item)).filter(Boolean);
  return cleaned.length ? cleaned : [safeImage(primaryImage)];
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

function fromMarketVaultListing(
  listing: TractorMarketplaceListing,
  index: number,
): MarketplaceListing {
  const seller = createPrototypeSeller(listing.area, index);
  const imageSrc = safeImage(listing.imageSrc);

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
    province: listing.province,
    area: listing.area,
    location: listing.location,
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
    imageSrc,
    imageUrls: [imageSrc],
    publishedBy: 'seed',
  };
}

export const seedMarketplaceListings: MarketplaceListing[] = marketVaultListings.map(
  fromMarketVaultListing,
);

function savePublishedMarketplaceListings(items: MarketplaceListing[]): MarketplaceListing[] {
  if (!hasStorage()) {
    return items;
  }

  window.localStorage.setItem(MARKETPLACE_STORAGE_KEY, JSON.stringify(items));
  return items;
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
    return Array.isArray(parsed) ? (parsed as MarketplaceListing[]) : [];
  } catch {
    return [];
  }
}

export function loadMarketplaceListings(): MarketplaceListing[] {
  return [...loadPublishedMarketplaceListings(), ...seedMarketplaceListings].sort(
    (a, b) => new Date(b.publishedAtIso).getTime() - new Date(a.publishedAtIso).getTime(),
  );
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
  input: PublishMarketplaceInput,
): MarketplaceListing[] {
  if (item.kind !== 'tractor') {
    throw new Error('Only tractor assets can be published to marketplace.');
  }

  const brandName = cleanText(item.brandName);
  const modelName = cleanText(item.modelName);

  if (!brandName || !modelName) {
    throw new Error('Tractor assets need a brand and model before publishing.');
  }

  const sellerName = cleanText(input.sellerName);
  const sellerPhone = cleanText(input.sellerPhone);

  if (!sellerName) {
    throw new Error('Seller name is required before publishing.');
  }

  if (!sellerPhone) {
    throw new Error('Seller phone is required before publishing.');
  }

  const matchedTractor = findMatchingTractor(item);
  const primaryImage = safeImage(input.imageSrc);
  const area = titleCase(cleanText(input.area, 'Unknown Area'));
  const province = titleCase(cleanText(input.province, 'Unknown Province'));
  const askingPrice = Math.round(cleanNumber(input.askingPriceExVat, item.selectedValueExVat));

  if (askingPrice <= 0) {
    throw new Error('Asking price must be greater than zero.');
  }

  const yearModel = Math.round(cleanNumber(item.yearModel, new Date().getFullYear()));
  const hours = Math.round(cleanNumber(item.hours, 0));
  const powerKw = Math.round(cleanNumber(matchedTractor?.powerKw, 0));
  const powerHp = Math.round(cleanNumber(matchedTractor?.powerHp, powerKw * 1.341));
  const imageUrls = buildImageList(primaryImage, input.imageUrls);

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
    drive: matchedTractor?.drive ?? ((item.drive === '2wd' ? '2wd' : '4wd') as DriveType),
    cab: matchedTractor?.cab ?? 'cab',
    powerKw,
    powerHp,
    horsepowerHp: powerHp,
    yearModel,
    year: yearModel,
    hours,
    province,
    area,
    location: `${area}, ${province}`,
    description: cleanText(
      input.description,
      `${brandName} ${modelName} available on the Aim4price marketplace.`,
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
    imageSrc: imageUrls[0] ?? FALLBACK_MARKETPLACE_IMAGE,
    imageUrls,
    publishedBy: 'asset-register',
  };

  const existing = loadPublishedMarketplaceListings().filter(
    (entry) => entry.sourceAssetId !== item.id,
  );

  return savePublishedMarketplaceListings([listing, ...existing]);
}
