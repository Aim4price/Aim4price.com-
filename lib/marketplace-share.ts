import {
  FALLBACK_MARKETPLACE_IMAGE,
  seedMarketplaceListings,
  type MarketplaceListing,
} from './marketplace';
import { listPublishedMarketplaceAssetListings } from './marketplace-db';
import { money } from './tractor-logic';

export const DEFAULT_MARKETPLACE_ORIGIN = 'https://aim4pricecom-production.up.railway.app';

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function isFallbackMarketplaceImage(src?: string): boolean {
  const value = String(src ?? '').trim();

  if (!value) {
    return true;
  }

  return value === FALLBACK_MARKETPLACE_IMAGE || value.endsWith('/brand/Tractor.png');
}

function isListingTitleMetaPart(value: string): boolean {
  const part = value.trim().toLowerCase();

  if (!part) {
    return true;
  }

  if (/^(19|20)\d{2}$/.test(part)) {
    return true;
  }

  if (/^\d[\d\s,.]*(?:km|hrs?|hours)$/.test(part)) {
    return true;
  }

  if (/^\d+(?:\.\d+)?%\s*worked$/.test(part)) {
    return true;
  }

  return ['excellent', 'good', 'fair', 'used', 'serious wear', 'requires attention'].includes(part);
}

function cleanListingTitleMeta(value: string): string {
  const parts = value
    .split(/\s*[·•]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return value.trim();
  }

  const [baseTitle, ...details] = parts;

  if (details.every(isListingTitleMetaPart)) {
    return baseTitle;
  }

  const usefulDetails = details.filter((detail) => !isListingTitleMetaPart(detail));
  return [baseTitle, ...usefulDetails].join(' · ').trim();
}

function normalizeFamilyKey(value: unknown, fallbackLabel: string): string {
  const explicit = String(value ?? '').trim();
  const source = explicit || fallbackLabel || 'tractors';

  return source
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function inferSectorFromListing(listing: MarketplaceListing): 'agricultural' | 'construction' | 'industrial' {
  const explicit = normalize(listing.sectorKey ?? listing.sectorLabel).replace(/\s+/g, '-');

  if (explicit === 'construction') return 'construction';
  if (explicit === 'industrial' || explicit === 'industry') return 'industrial';

  const searchText = [listing.title, listing.description, listing.modelName, listing.brandName, listing.assetKind]
    .join(' ')
    .toLowerCase();

  if (/excavator|tlb|backhoe|loader|grader|dumper|compactor|roller|skid/.test(searchText)) {
    return 'construction';
  }

  if (/forklift|generator|compressor|warehouse|industrial/.test(searchText)) {
    return 'industrial';
  }

  return 'agricultural';
}

function inferFamilyLabel(listing: MarketplaceListing): string {
  const explicit = String(listing.familyLabel ?? '').trim();

  if (explicit) {
    return explicit;
  }

  const assetKind = normalize(listing.assetKind);

  if (assetKind === 'vehicle') return 'Vehicles';
  if (assetKind === 'tools' || assetKind === 'tool') return 'Tools';
  if (assetKind === 'equipment') return 'Equipment';
  if (assetKind === 'stock' || assetKind === 'inventory') return 'Stock';
  if (assetKind === 'manual' || assetKind === 'other') return 'Other';
  if (assetKind === 'property') return 'Property/Buildings';

  const modelText = [listing.title, listing.modelName, listing.description].join(' ').toLowerCase();

  if (/vehicle|bakkie|hilux|truck|ldv|pickup|ute|car/.test(modelText)) return 'Vehicles';
  if (/combine/.test(modelText)) return 'Combines';
  if (/baler/.test(modelText)) return 'Balers';
  if (/sprayer/.test(modelText)) return 'Sprayers';
  if (/planter/.test(modelText)) return 'Planters';
  if (/trailer/.test(modelText)) return 'Trailers';
  if (/excavator/.test(modelText)) return 'Excavators';
  if (/loader/.test(modelText)) return 'Wheel loaders';
  if (/forklift/.test(modelText)) return 'Forklifts';
  if (/generator/.test(modelText)) return 'Generators';

  return inferSectorFromListing(listing) === 'agricultural' ? 'Tractors' : 'Other machinery';
}

function getListingFamilyKey(listing: MarketplaceListing): string {
  return normalizeFamilyKey(listing.familyKey, inferFamilyLabel(listing));
}

function getListingAssetKind(listing: MarketplaceListing): string {
  return normalize(listing.assetKind);
}

function getListingFamilyLabel(listing: MarketplaceListing): string {
  return inferFamilyLabel(listing);
}

function isTractorListing(listing: MarketplaceListing): boolean {
  const familyKey = getListingFamilyKey(listing);
  const familyLabel = normalize(getListingFamilyLabel(listing));
  const assetKind = getListingAssetKind(listing);

  return assetKind === 'tractor' || familyKey === 'tractors' || familyLabel === 'tractors';
}

export function listingDisplayTitle(listing: MarketplaceListing): string {
  const rawTitle =
    String(listing.title ?? '').trim() ||
    `${String(listing.brandName ?? '').trim()} ${String(listing.modelName ?? '').trim()}`.trim() ||
    'Marketplace listing';

  return cleanListingTitleMeta(rawTitle) || 'Marketplace listing';
}

export function formatMarketplaceSharePrice(listing: MarketplaceListing): string {
  return `${money(listing.askingPriceExVat)} + VAT`;
}

export function formatListingLocation(listing: MarketplaceListing): string {
  const area = String(listing.area ?? '').trim();
  const province = String(listing.province ?? '').trim();

  if (area && province) {
    return `${area}, ${province}`;
  }

  return area || province || 'South Africa';
}

export function formatListingPublishedDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Recently listed';
  }

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function listingUsageLabel(_listing: MarketplaceListing): string {
  return 'Usage';
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function getListingWorkedPercent(listing: MarketplaceListing): number | null {
  const direct = Number(listing.lifeWorkedPercent);

  if (Number.isFinite(direct)) {
    return Math.min(100, Math.max(0, direct));
  }

  return null;
}

export function formatListingUsage(listing: MarketplaceListing): string {
  if (listing.usageUnit === 'percent') {
    const percent = getListingWorkedPercent(listing);
    return percent === null ? 'Percentage not set' : `${formatPercent(percent)}% worked`;
  }

  const amount = Number(listing.hours || 0);
  const suffix = listing.usageUnit === 'km' ? 'km' : 'hours';

  if (!Number.isFinite(amount) || amount <= 0) {
    return listing.usageUnit === 'km' ? 'km not set' : 'hours not set';
  }

  return `${Math.round(amount).toLocaleString('en-ZA')} ${suffix}`;
}

export function getListingConditionLabel(listing: MarketplaceListing): string {
  const explicit = String(listing.conditionLabel ?? '').trim();

  if (explicit) {
    return explicit;
  }

  const normalized = normalize(listing.conditionKey);

  if (normalized === 'excellent') return 'Excellent';
  if (normalized === 'good') return 'Good';
  if (normalized === 'fair') return 'Fair';
  if (normalized === 'used') return 'Used';
  if (normalized === 'serious') return 'Serious Wear';
  return 'Not set';
}

export function getListingPrimaryFamilyLabel(listing: MarketplaceListing): string {
  return getListingFamilyLabel(listing);
}

export function buildListingSpecLine(listing: MarketplaceListing): string {
  const parts: string[] = [];
  const family = getListingPrimaryFamilyLabel(listing);

  if (family) {
    parts.push(family);
  }

  if (isTractorListing(listing)) {
    const tractorType = normalize(listing.tractorType);
    const drive = normalize(listing.drive);
    const cab = normalize(listing.cab);
    const powerKw = Math.round(Number(listing.powerKw || 0));

    if (tractorType) {
      parts.push(tractorType === 'orchard' ? 'Orchard tractor' : 'Field tractor');
    }

    if (drive) {
      parts.push(drive === '2wd' ? '2WD' : drive === 'tracks' ? 'Tracks' : '4WD');
    }

    if (cab) {
      parts.push(cab === 'open-station' ? 'Open station' : 'Cab');
    }

    if (powerKw > 0) {
      parts.push(`${powerKw} kW`);
    }
  }

  return Array.from(new Set(parts.filter(Boolean))).join(' • ');
}

export function getListingImages(listing: MarketplaceListing): string[] {
  const raw = [
    ...(Array.isArray(listing.imageUrls) ? listing.imageUrls : []),
    listing.imageSrc,
  ]
    .map((item) => String(item ?? '').trim())
    .filter((item) => !isFallbackMarketplaceImage(item));

  return Array.from(new Set(raw));
}

export function getListingPrimaryImage(listing: MarketplaceListing): string {
  return getListingImages(listing)[0] ?? FALLBACK_MARKETPLACE_IMAGE;
}

export function listingMatchesShareReference(listing: MarketplaceListing, value: string): boolean {
  const normalizedValue = String(value ?? '').trim();

  return normalizedValue === listing.id || normalizedValue === String(listing.sourceAssetId ?? '').trim();
}

export async function findMarketplaceShareListing(reference: string): Promise<MarketplaceListing | null> {
  const normalizedReference = String(reference ?? '').trim();

  if (!normalizedReference) {
    return null;
  }

  try {
    const publishedListings = await listPublishedMarketplaceAssetListings({
      viewerUserId: null,
      exposeContact: false,
    });
    const matchedListing = publishedListings.find((listing) => listingMatchesShareReference(listing, normalizedReference));

    if (matchedListing) {
      return matchedListing;
    }
  } catch (error) {
    console.error('marketplace share listing lookup failed', error);
  }

  return seedMarketplaceListings.find((listing) => listingMatchesShareReference(listing, normalizedReference)) ?? null;
}

export function normalizeMarketplaceOrigin(value: string | null | undefined): string {
  const trimmed = String(value ?? '').trim().replace(/\/$/, '');

  if (!trimmed) {
    return DEFAULT_MARKETPLACE_ORIGIN;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function toAbsoluteMarketplaceUrl(value: string, origin: string): string {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) {
    return '';
  }

  if (/^(?:https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  try {
    return new URL(trimmed, origin).toString();
  } catch {
    return trimmed;
  }
}

export function buildMarketplaceListingUrl(origin: string, listing: MarketplaceListing): string {
  const url = new URL('/marketplace/browse', normalizeMarketplaceOrigin(origin));
  url.searchParams.set('listing', listing.id);
  return url.toString();
}

function marketplaceImageVersion(listing: MarketplaceListing): string {
  const source = [
    listing.publishedAtIso,
    listing.dateAdvertised,
    listing.imageSrc,
    Array.isArray(listing.imageUrls) ? listing.imageUrls.join('|') : '',
  ]
    .join('|')
    .trim();

  const normalized = source.replace(/[^a-z0-9]+/gi, '').slice(0, 32);
  return normalized || '1';
}

export function buildMarketplaceListingImageUrl(origin: string, listing: MarketplaceListing): string {
  const url = new URL(
    `/api/marketplace/images/${encodeURIComponent(listing.id)}.jpg`,
    normalizeMarketplaceOrigin(origin),
  );

  url.searchParams.set('v', marketplaceImageVersion(listing));
  return url.toString();
}

export function buildMarketplaceOgImageUrl(origin: string, listing: MarketplaceListing): string {
  const url = new URL('/api/marketplace/og', normalizeMarketplaceOrigin(origin));
  url.searchParams.set('listing', listing.id);
  url.searchParams.set('v', marketplaceImageVersion(listing));
  return url.toString();
}

export function buildMarketplaceShareDescription(listing: MarketplaceListing): string {
  const specLine = buildListingSpecLine(listing);
  const details = [
    formatMarketplaceSharePrice(listing),
    formatListingLocation(listing),
    specLine,
  ].filter(Boolean);

  return `${details.join(' · ')}. View this listing on Aim4price.`;
}
