'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';
import {
  FALLBACK_MARKETPLACE_IMAGE,
  seedMarketplaceListings,
  type MarketplaceListing,
} from '../../lib/marketplace';
import { money } from '../../lib/tractor-logic';

type MarketplaceFilters = {
  brand: string;
  model: string;
  drive: string;
  type: string;
};

type MarketplaceClientProps = {
  initialFilters: MarketplaceFilters;
  isSignedIn: boolean;
};

type MarketplaceApiResponse = {
  ok: boolean;
  listings?: MarketplaceListing[];
  error?: string;
};

type EquipmentFamilyRecord = {
  id?: number;
  sectorKey: string;
  sectorLabel: string;
  familyKey: string;
  familyLabel: string;
  sortOrder?: number;
  isActive?: boolean;
};

type EquipmentFamiliesApiResponse = {
  ok: boolean;
  families?: EquipmentFamilyRecord[];
};

type SectorKey = 'agricultural' | 'construction' | 'industrial';
type DistanceFilterValue = 'all' | '50' | '100' | '250' | '500';
type ConditionFilterValue = '' | 'excellent' | 'good' | 'fair' | 'used' | 'serious';

type SectorOption = {
  key: SectorKey;
  label: string;
  shortLabel: string;
};

type FamilyOption = {
  sectorKey: SectorKey;
  familyKey: string;
  familyLabel: string;
  sortOrder: number;
};

type ActiveFilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

const LISTINGS_PER_LOAD = 24;
const JPEG_AD_WIDTH = 1600;
const JPEG_AD_HEIGHT = 900;
const JPEG_AD_LOGO_SRC = '/brand/Aim4price_Home_Logo.png';
const JPEG_AD_WATERMARK_SRC = '/brand/aim4price-mark-black.png';

const SECTOR_OPTIONS: SectorOption[] = [
  { key: 'agricultural', label: 'Agriculture', shortLabel: 'Agri' },
  { key: 'construction', label: 'Construction', shortLabel: 'Build' },
  { key: 'industrial', label: 'Industrial', shortLabel: 'Industry' },
];

const FALLBACK_FAMILIES: FamilyOption[] = [
  { sectorKey: 'agricultural', familyKey: 'tractors', familyLabel: 'Tractors', sortOrder: 1 },
  { sectorKey: 'agricultural', familyKey: 'combines', familyLabel: 'Combines', sortOrder: 2 },
  { sectorKey: 'agricultural', familyKey: 'balers', familyLabel: 'Balers', sortOrder: 3 },
  { sectorKey: 'agricultural', familyKey: 'sprayers', familyLabel: 'Sprayers', sortOrder: 4 },
  { sectorKey: 'agricultural', familyKey: 'planters', familyLabel: 'Planters', sortOrder: 5 },
  { sectorKey: 'agricultural', familyKey: 'tillage', familyLabel: 'Tillage', sortOrder: 6 },
  { sectorKey: 'agricultural', familyKey: 'trailers', familyLabel: 'Trailers', sortOrder: 7 },
  { sectorKey: 'construction', familyKey: 'tlbs', familyLabel: 'TLBs / Backhoe loaders', sortOrder: 1 },
  { sectorKey: 'construction', familyKey: 'excavators', familyLabel: 'Excavators', sortOrder: 2 },
  { sectorKey: 'construction', familyKey: 'wheel_loaders', familyLabel: 'Wheel loaders', sortOrder: 3 },
  { sectorKey: 'construction', familyKey: 'skid_steers', familyLabel: 'Skid steers', sortOrder: 4 },
  { sectorKey: 'construction', familyKey: 'graders', familyLabel: 'Graders', sortOrder: 5 },
  { sectorKey: 'construction', familyKey: 'compactors', familyLabel: 'Compactors', sortOrder: 6 },
  { sectorKey: 'industrial', familyKey: 'forklifts', familyLabel: 'Forklifts', sortOrder: 1 },
  { sectorKey: 'industrial', familyKey: 'generators', familyLabel: 'Generators', sortOrder: 2 },
  { sectorKey: 'industrial', familyKey: 'compressors', familyLabel: 'Compressors', sortOrder: 3 },
  { sectorKey: 'industrial', familyKey: 'warehouse_equipment', familyLabel: 'Warehouse equipment', sortOrder: 4 },
  { sectorKey: 'industrial', familyKey: 'industrial_tools', familyLabel: 'Industrial tools', sortOrder: 5 },
];

const CONDITION_OPTIONS: Array<{ value: ConditionFilterValue; label: string }> = [
  { value: '', label: 'All conditions' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'used', label: 'Used' },
  { value: 'serious', label: 'Serious Wear' },
];

const DISTANCE_OPTIONS: Array<{ value: DistanceFilterValue; label: string }> = [
  { value: 'all', label: 'Across South Africa' },
  { value: '50', label: 'Within 50 km' },
  { value: '100', label: 'Within 100 km' },
  { value: '250', label: 'Within 250 km' },
  { value: '500', label: 'Within 500 km' },
];

const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];

const PROVINCE_CENTRES: Record<string, { lat: number; lon: number }> = {
  'eastern cape': { lat: -32.2968, lon: 26.4194 },
  'free state': { lat: -28.4541, lon: 26.7968 },
  gauteng: { lat: -26.2708, lon: 28.1123 },
  'kwazulu-natal': { lat: -28.5306, lon: 30.8958 },
  limpopo: { lat: -23.4013, lon: 29.4179 },
  mpumalanga: { lat: -25.5653, lon: 30.5279 },
  'northern cape': { lat: -29.0467, lon: 21.8569 },
  'north west': { lat: -26.6639, lon: 25.2838 },
  'western cape': { lat: -33.2278, lon: 21.8569 },
};

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 21l-4.3-4.3" />
      <circle cx="11" cy="11" r="6.5" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M5 15V7a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function IconPhoto() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="m21 15-4.4-4.4a2 2 0 0 0-2.8 0L7 17.4" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function BrandIcon({ src }: { src: string }) {
  return <img src={src} alt="" aria-hidden="true" className={styles.brandIcon} />;
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function isFallbackMarketplaceImage(src?: string): boolean {
  const value = String(src ?? '').trim();

  if (!value) {
    return true;
  }

  return value === FALLBACK_MARKETPLACE_IMAGE || value.endsWith('/brand/Tractor.png');
}

function getListingImages(listing: MarketplaceListing): string[] {
  const raw = [
    ...(Array.isArray(listing.imageUrls) ? listing.imageUrls : []),
    listing.imageSrc,
  ]
    .map((item) => String(item ?? '').trim())
    .filter((item) => !isFallbackMarketplaceImage(item));

  return Array.from(new Set(raw));
}

function formatPlaceholderLabel(listing: MarketplaceListing): string {
  return getListingFamilyLabel(listing).toUpperCase();
}

function ListingPlaceholder({
  listing,
  variant,
}: {
  listing: MarketplaceListing;
  variant: 'card' | 'modal' | 'share';
}) {
  const shouldShowLabel = variant !== 'share';

  return (
    <div
      className={`${styles.placeholder} ${styles[`${variant}Placeholder`]}`}
      aria-label={variant === 'share' ? 'No listing photo available' : undefined}
    >
      {shouldShowLabel ? (
        <span className={styles.placeholderPill}>{formatPlaceholderLabel(listing)}</span>
      ) : null}
    </div>
  );
}

function ListingImage({
  src,
  listing,
  className,
  variant,
  alt,
}: {
  src?: string;
  listing: MarketplaceListing;
  className: string;
  variant: 'card' | 'modal' | 'share';
  alt: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed || isFallbackMarketplaceImage(src)) {
    return <ListingPlaceholder listing={listing} variant={variant} />;
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

function PriceWithVat({
  value,
  className = '',
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className={`${styles.priceWithVat} ${className}`.trim()}>
      <span>{money(value)}</span>
      <em>+ VAT</em>
    </span>
  );
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

function listingDisplayTitle(listing: MarketplaceListing): string {
  const rawTitle =
    String(listing.title ?? '').trim() ||
    `${String(listing.brandName ?? '').trim()} ${String(listing.modelName ?? '').trim()}`.trim() ||
    'Marketplace listing';

  return cleanListingTitleMeta(rawTitle) || 'Marketplace listing';
}

function getListingNote(listing: MarketplaceListing): string {
  const note = String(listing.description ?? '').replace(/\s+/g, ' ').trim();

  if (!note) {
    return '';
  }

  const normalizedNote = note.toLowerCase();
  const normalizedTitle = listingDisplayTitle(listing).toLowerCase();

  if (normalizedNote === normalizedTitle) {
    return '';
  }

  if (
    normalizedNote.includes('available on the aim4price marketplace') ||
    normalizedNote.includes('listed on the aim4price marketplace') ||
    normalizedNote.includes('prototype aim4price marketplace listing')
  ) {
    return '';
  }

  return note;
}


function formatTypeLabel(value: string): string {
  return value === 'orchard' ? 'Orchard' : 'Field';
}

function formatCabLabel(value: string): string {
  return value === 'open-station' ? 'Open station' : 'Cab';
}

function formatConditionLabel(value: unknown): string {
  const normalized = normalize(value);
  const option = CONDITION_OPTIONS.find((item) => item.value === normalized);
  return option?.label ?? 'Not set';
}

function formatPublishedDate(value: string): string {
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

function formatLocation(listing: MarketplaceListing): string {
  const area = String(listing.area ?? '').trim();
  const province = String(listing.province ?? '').trim();

  if (area && province) {
    return `${area}, ${province}`;
  }

  return area || province || 'South Africa';
}

function listingUsageLabel(listing: MarketplaceListing): string {
  if (listing.usageUnit === 'km') {
    return 'Kilometres';
  }

  if (listing.usageUnit === 'percent') {
    return 'Usage';
  }

  return normalize(listing.assetKind) === 'vehicle' ? 'Vehicle hours' : 'Engine hours';
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function getListingWorkedPercent(listing: MarketplaceListing): number | null {
  const direct = Number(listing.lifeWorkedPercent);

  if (Number.isFinite(direct)) {
    return Math.min(100, Math.max(0, direct));
  }

  return null;
}

function formatUsage(listing: MarketplaceListing): string {
  if (listing.usageUnit === 'percent') {
    const percent = getListingWorkedPercent(listing);
    return percent === null ? 'Percentage not set' : `${formatPercent(percent)}% worked`;
  }

  const amount = Number(listing.hours || 0);
  const suffix = listing.usageUnit === 'km' ? 'km' : 'hrs';

  if (!Number.isFinite(amount) || amount <= 0) {
    return listing.usageUnit === 'km' ? 'km not set' : 'hours not set';
  }

  return `${amount.toLocaleString('en-ZA')} ${suffix}`;
}

function normalizeSectorKey(value: unknown): SectorKey | '' {
  const normalized = normalize(value).replace(/\s+/g, '-');

  if (normalized === 'agriculture' || normalized === 'agricultural') return 'agricultural';
  if (normalized === 'construction') return 'construction';
  if (normalized === 'industrial' || normalized === 'industry') return 'industrial';
  return '';
}

function inferSectorFromListing(listing: MarketplaceListing): SectorKey {
  const explicit = normalizeSectorKey(listing.sectorKey ?? listing.sectorLabel);

  if (explicit) {
    return explicit;
  }

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

function normalizeFamilyKey(value: unknown, fallbackLabel: string): string {
  const explicit = String(value ?? '').trim();
  return explicit ? slugify(explicit) : slugify(fallbackLabel || 'tractors');
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

function getListingFamilyLabel(listing: MarketplaceListing): string {
  return inferFamilyLabel(listing);
}

function getListingAssetKind(listing: MarketplaceListing): string {
  return normalize(listing.assetKind);
}

function isTractorListing(listing: MarketplaceListing): boolean {
  const familyKey = getListingFamilyKey(listing);
  const familyLabel = normalize(getListingFamilyLabel(listing));
  const assetKind = getListingAssetKind(listing);

  return assetKind === 'tractor' || familyKey === 'tractors' || familyLabel === 'tractors';
}

function getListingPrimaryFamilyLabel(listing: MarketplaceListing): string {
  const assetKind = getListingAssetKind(listing);

  if (assetKind === 'vehicle') return 'Vehicles';
  if (assetKind === 'tools' || assetKind === 'tool') return 'Tools';
  if (assetKind === 'equipment') return 'Equipment';
  if (assetKind === 'manual' || assetKind === 'other') return 'Other';
  if (assetKind === 'property') return 'Property/Buildings';

  return getListingFamilyLabel(listing);
}

function getListingConditionKey(listing: MarketplaceListing): ConditionFilterValue | 'not-set' {
  const normalized = normalize(listing.conditionKey ?? listing.conditionLabel);

  if (normalized === 'excellent') return 'excellent';
  if (normalized === 'good') return 'good';
  if (normalized === 'fair') return 'fair';
  if (normalized === 'used') return 'used';
  if (normalized === 'serious' || normalized === 'serious wear' || normalized === 'serious_wear') return 'serious';

  return 'not-set';
}

function buildListingSpecLine(listing: MarketplaceListing): string {
  const familyLabel = getListingPrimaryFamilyLabel(listing);
  const powerKw = Number(listing.powerKw || 0);
  const drive = String(listing.drive ?? '').trim();
  const cab = String(listing.cab ?? '').trim();
  const parts = [familyLabel];

  if (isTractorListing(listing)) {
    parts.push(`${formatTypeLabel(String(listing.tractorType ?? 'field'))} tractor`);

    if (drive) {
      parts.push(drive.toUpperCase());
    }

    if (cab) {
      parts.push(formatCabLabel(cab));
    }

    if (powerKw > 0) {
      parts.push(`${powerKw} kW`);
    }
  }

  return Array.from(new Set(parts.filter(Boolean))).join(' • ');
}


function buildSearchText(listing: MarketplaceListing): string {
  return [
    listing.title,
    listing.brandName,
    listing.modelName,
    listing.area,
    listing.province,
    listing.location,
    listing.description,
    listing.yearModel,
    listing.hours,
    listing.lifeWorkedPercent,
    listing.usageUnit,
    listing.drive,
    listing.tractorType,
    listing.cab,
    listing.powerKw,
    listing.powerHp,
    listing.horsepowerHp,
    listing.sellerName,
    listing.sellerCompany,
    listing.sourceName,
    listing.sourceUrl,
    listing.assetKind,
    listing.sectorKey,
    listing.sectorLabel,
    listing.familyKey,
    listing.familyLabel,
    listing.conditionKey,
    listing.conditionLabel,
  ]
    .join(' ')
    .toLowerCase();
}

function sortListings(items: MarketplaceListing[]): MarketplaceListing[] {
  return [...items].sort(
    (a, b) => new Date(b.publishedAtIso).getTime() - new Date(a.publishedAtIso).getTime(),
  );
}

function normaliseProvinceName(value: string): string {
  return normalize(value).replace(/\s+/g, ' ');
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceBetweenKm(
  first: { lat: number; lon: number },
  second: { lat: number; lon: number },
): number {
  const earthRadiusKm = 6371;
  const deltaLat = degreesToRadians(second.lat - first.lat);
  const deltaLon = degreesToRadians(second.lon - first.lon);
  const latOne = degreesToRadians(first.lat);
  const latTwo = degreesToRadians(second.lat);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(latOne) * Math.cos(latTwo) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isListingInsideDistance(
  listing: MarketplaceListing,
  locationFilter: string,
  distanceFilter: DistanceFilterValue,
): boolean {
  if (locationFilter === 'south-africa') {
    return true;
  }

  const listingProvince = normaliseProvinceName(String(listing.province ?? ''));
  const selectedProvince = normaliseProvinceName(locationFilter);

  if (!listingProvince) {
    return false;
  }

  if (distanceFilter === 'all') {
    return listingProvince === selectedProvince;
  }

  const origin = PROVINCE_CENTRES[selectedProvince];
  const destination = PROVINCE_CENTRES[listingProvince];
  const radius = Number(distanceFilter);

  if (!origin || !destination || !Number.isFinite(radius)) {
    return listingProvince === selectedProvince;
  }

  return distanceBetweenKm(origin, destination) <= radius;
}

function buildLocationSummary(locationFilter: string, distanceFilter: DistanceFilterValue): string {
  if (locationFilter === 'south-africa') {
    return 'South Africa · Across South Africa';
  }

  const distanceLabel = DISTANCE_OPTIONS.find((option) => option.value === distanceFilter)?.label;
  return `${locationFilter} · ${distanceLabel ?? 'Across South Africa'}`;
}

function listingMatchesReference(listing: MarketplaceListing, value: string): boolean {
  const normalizedValue = String(value).trim();

  return normalizedValue === listing.id || normalizedValue === String(listing.sourceAssetId ?? '').trim();
}

function buildListingShareUrl(listing: MarketplaceListing): string {
  if (typeof window === 'undefined') {
    return `/marketplace?listing=${encodeURIComponent(listing.id)}`;
  }

  const url = new URL('/marketplace', window.location.origin);
  url.searchParams.set('listing', listing.id);
  return url.toString();
}

function buildListingShareText(listing: MarketplaceListing): string {
  return [
    listingDisplayTitle(listing),
    `${money(listing.askingPriceExVat)} + VAT`,
    formatLocation(listing),
    'View this listing on Aim4price.',
  ].join(' • ');
}


async function copyTextToClipboard(value: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is not available.');
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function sanitizeDownloadFilename(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'aim4price-marketplace-ad'
  );
}

function resolveCanvasImageSource(src: string): string {
  const value = String(src ?? '').trim();

  if (!value || /^(?:https?:|data:|blob:)/i.test(value) || typeof window === 'undefined') {
    return value;
  }

  return new URL(value, window.location.origin).toString();
}

function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const value = resolveCanvasImageSource(src);

    if (!value) {
      reject(new Error('No image source provided.'));
      return;
    }

    const image = new Image();
    image.decoding = 'async';

    if (!value.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image failed to load.'));
    image.src = value;
  });
}

function createRoundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const nextRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + nextRadius, y);
  context.lineTo(x + width - nextRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
  context.lineTo(x + width, y + height - nextRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
  context.lineTo(x + nextRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
  context.lineTo(x, y + nextRadius);
  context.quadraticCurveTo(x, y, x + nextRadius, y);
  context.closePath();
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
) {
  context.save();
  createRoundedRectPath(context, x, y, width, height, radius);
  context.fillStyle = fillStyle;
  context.fill();
  context.restore();
}

function strokeRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  strokeStyle: string,
  lineWidth = 2,
) {
  context.save();
  createRoundedRectPath(context, x, y, width, height, radius);
  context.strokeStyle = strokeStyle;
  context.lineWidth = lineWidth;
  context.stroke();
  context.restore();
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;

  if (!imageWidth || !imageHeight) {
    return;
  }

  const scale = Math.max(width / imageWidth, height / imageHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = Math.max(0, (imageWidth - sourceWidth) / 2);
  const sourceY = Math.max(0, (imageHeight - sourceHeight) / 2);

  context.save();
  createRoundedRectPath(context, x, y, width, height, radius);
  context.clip();
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  context.restore();
}

function fitCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const value = String(text ?? '').trim();

  if (context.measureText(value).width <= maxWidth) {
    return value;
  }

  let next = value;

  while (next.length > 3 && context.measureText(`${next}…`).width > maxWidth) {
    next = next.slice(0, -1).trim();
  }

  return `${next}…`;
}

function drawWrappedCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (context.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;

    if (lines.length >= maxLines) {
      break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  const finalLines = lines.slice(0, maxLines);

  if (words.length && finalLines.length === maxLines) {
    const consumedText = finalLines.join(' ');
    const originalText = words.join(' ');

    if (consumedText.length < originalText.length) {
      finalLines[finalLines.length - 1] = fitCanvasText(context, finalLines[finalLines.length - 1], maxWidth);
    }
  }

  finalLines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });

  return y + Math.max(1, finalLines.length) * lineHeight;
}

function drawAdPlaceholder(
  context: CanvasRenderingContext2D,
  listing: MarketplaceListing,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  fillRoundedRect(context, x, y, width, height, 30, '#eef4f1');
  strokeRoundedRect(context, x, y, width, height, 30, '#d5e2dc', 2);
  context.save();
  context.fillStyle = '#165340';
  context.font = '800 38px Montserrat, Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(fitCanvasText(context, getListingPrimaryFamilyLabel(listing).toUpperCase(), width - 120), x + width / 2, y + height / 2);
  context.restore();
}

function drawAdLabelValue(
  context: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.save();
  context.shadowColor = 'rgba(16, 36, 30, 0.06)';
  context.shadowBlur = 12;
  context.shadowOffsetY = 8;
  fillRoundedRect(context, x, y, width, height, 20, '#f6f7f8');
  context.restore();

  strokeRoundedRect(context, x, y, width, height, 20, '#eceff1', 1.5);

  context.save();
  context.fillStyle = '#6c7175';
  context.font = '800 18px Montserrat, Inter, Arial, sans-serif';
  context.letterSpacing = '1.6px';
  context.fillText(label.toUpperCase(), x + 24, y + 32);
  context.letterSpacing = '0px';
  context.fillStyle = '#050505';
  context.font = '850 26px Montserrat, Inter, Arial, sans-serif';
  context.fillText(fitCanvasText(context, value, width - 48), x + 24, y + 67);
  context.restore();
}

function drawAim4priceWordmarkFallback(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  fontSize: number,
  alpha: number,
) {
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = '#165340';
  context.font = `900 ${fontSize}px Montserrat, Inter, Arial, sans-serif`;
  context.letterSpacing = '-3px';
  context.fillText('Aim4price', x, y);
  context.restore();
}

function getAdProvince(listing: MarketplaceListing): string {
  return String(listing.province ?? '').trim() || 'South Africa';
}

function getAdSellerName(listing: MarketplaceListing): string {
  return String(listing.sellerCompany ?? '').trim() || String(listing.sellerName ?? '').trim() || 'Aim4price seller';
}

function getAdSellerPhone(listing: MarketplaceListing): string {
  return String(listing.sellerPhone ?? '').trim();
}

function drawAdWatermark(
  context: CanvasRenderingContext2D,
  logoImage: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.save();
  context.globalAlpha = 0.045;

  if (logoImage) {
    const logoWidth = width * 0.82;
    const ratio = (logoImage.naturalHeight || logoImage.height) / Math.max(1, logoImage.naturalWidth || logoImage.width);
    const logoHeight = logoWidth * ratio;
    context.drawImage(
      logoImage,
      x + width - logoWidth - 18,
      y + (height - logoHeight) / 2,
      logoWidth,
      logoHeight,
    );
  } else {
    context.fillStyle = '#165340';
    context.font = '900 112px Montserrat, Inter, Arial, sans-serif';
    context.letterSpacing = '-5px';
    context.fillText('Aim4price', x + 170, y + height / 2 + 34);
  }

  context.restore();
}

function drawAdProvincePill(
  context: CanvasRenderingContext2D,
  province: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  fillRoundedRect(context, x, y, width, height, height / 2, '#edf6f1');
  strokeRoundedRect(context, x, y, width, height, height / 2, '#d7e9df', 1.5);
  context.save();
  context.fillStyle = '#165340';
  context.font = '850 21px Montserrat, Inter, Arial, sans-serif';
  context.letterSpacing = '0.2px';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(fitCanvasText(context, province, width - 36), x + width / 2, y + height / 2 + 1);
  context.restore();
}

function drawAdImageShowcase(
  context: CanvasRenderingContext2D,
  listing: MarketplaceListing,
  images: HTMLImageElement[],
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.save();
  context.shadowColor = 'rgba(7, 23, 18, 0.22)';
  context.shadowBlur = 30;
  context.shadowOffsetY = 18;
  fillRoundedRect(context, x, y, width, height, 36, '#eef4f1');
  context.restore();

  if (images[0]) {
    drawCoverImage(context, images[0], x, y, width, height, 36);
  } else {
    drawAdPlaceholder(context, listing, x, y, width, height);
  }

  context.save();
  createRoundedRectPath(context, x, y, width, height, 36);
  context.clip();
  const topGradient = context.createLinearGradient(0, y, 0, y + height * 0.38);
  topGradient.addColorStop(0, 'rgba(0, 0, 0, 0.18)');
  topGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = topGradient;
  context.fillRect(x, y, width, height * 0.38);

  const bottomGradient = context.createLinearGradient(0, y + height * 0.55, 0, y + height);
  bottomGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  bottomGradient.addColorStop(1, 'rgba(0, 0, 0, 0.26)');
  context.fillStyle = bottomGradient;
  context.fillRect(x, y + height * 0.55, width, height * 0.45);
  context.restore();

  strokeRoundedRect(context, x, y, width, height, 36, 'rgba(255, 255, 255, 0.74)', 3);

  const thumbnailImages = images.slice(1, 3);

  if (thumbnailImages.length) {
    const thumbnailSize = 118;
    const thumbnailGap = 14;
    const totalWidth = thumbnailImages.length * thumbnailSize + (thumbnailImages.length - 1) * thumbnailGap;
    const thumbnailY = y + height - thumbnailSize - 28;
    let thumbnailX = x + width - totalWidth - 28;

    thumbnailImages.forEach((image) => {
      context.save();
      context.shadowColor = 'rgba(0, 0, 0, 0.22)';
      context.shadowBlur = 16;
      context.shadowOffsetY = 9;
      fillRoundedRect(context, thumbnailX - 5, thumbnailY - 5, thumbnailSize + 10, thumbnailSize + 10, 22, '#ffffff');
      context.restore();
      drawCoverImage(context, image, thumbnailX, thumbnailY, thumbnailSize, thumbnailSize, 18);
      strokeRoundedRect(context, thumbnailX, thumbnailY, thumbnailSize, thumbnailSize, 18, 'rgba(255, 255, 255, 0.9)', 3);
      thumbnailX += thumbnailSize + thumbnailGap;
    });
  }
}

function drawAdContactCard(
  context: CanvasRenderingContext2D,
  listing: MarketplaceListing,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sellerName = getAdSellerName(listing);
  const sellerPhone = getAdSellerPhone(listing);
  const contactLabel = sellerPhone ? 'CALL / WHATSAPP' : 'CONTACT';
  const contactValue = sellerPhone || 'View full listing on Aim4price';
  const radius = Math.min(28, Math.max(18, height / 4));

  context.save();
  context.shadowColor = 'rgba(10, 35, 27, 0.18)';
  context.shadowBlur = 20;
  context.shadowOffsetY = 12;
  fillRoundedRect(context, x, y, width, height, radius, '#123f32');
  context.restore();

  context.save();
  const highlightGradient = context.createLinearGradient(x, y, x + width, y + height);
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.13)');
  highlightGradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.04)');
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0.00)');
  createRoundedRectPath(context, x, y, width, height, radius);
  context.clip();
  context.fillStyle = highlightGradient;
  context.fillRect(x, y, width, height);
  context.restore();

  context.save();
  context.fillStyle = 'rgba(255, 255, 255, 0.68)';
  context.font = '800 15px Montserrat, Inter, Arial, sans-serif';
  context.letterSpacing = '1.4px';
  context.fillText('SELLER CONTACT', x + 24, y + 31);
  context.letterSpacing = '0px';
  context.fillStyle = '#ffffff';
  context.font = '850 25px Montserrat, Inter, Arial, sans-serif';
  context.fillText(fitCanvasText(context, sellerName, width - 48), x + 24, y + 61);

  if (width < 720) {
    const pillX = x + 22;
    const pillY = y + height - 42;
    const pillWidth = width - 44;
    const pillHeight = 30;

    fillRoundedRect(context, pillX, pillY, pillWidth, pillHeight, 15, 'rgba(255, 255, 255, 0.15)');
    strokeRoundedRect(context, pillX, pillY, pillWidth, pillHeight, 15, 'rgba(255, 255, 255, 0.22)', 1.4);

    context.fillStyle = 'rgba(255, 255, 255, 0.70)';
    context.font = '800 12px Montserrat, Inter, Arial, sans-serif';
    context.letterSpacing = '1.1px';
    context.textAlign = 'left';
    context.fillText(contactLabel, pillX + 18, pillY + 20);
    context.letterSpacing = '0px';
    context.fillStyle = '#ffffff';
    context.font = sellerPhone ? '850 21px Montserrat, Inter, Arial, sans-serif' : '800 17px Montserrat, Inter, Arial, sans-serif';
    context.textAlign = 'right';
    context.fillText(fitCanvasText(context, contactValue, pillWidth - 178), pillX + pillWidth - 18, pillY + 21);
    context.restore();
    return;
  }

  const pillWidth = Math.min(460, Math.max(340, width * 0.42));
  const pillX = x + width - pillWidth - 22;
  fillRoundedRect(context, pillX, y + 16, pillWidth, height - 32, 20, 'rgba(255, 255, 255, 0.14)');
  strokeRoundedRect(context, pillX, y + 16, pillWidth, height - 32, 20, 'rgba(255, 255, 255, 0.22)', 1.5);

  context.textAlign = 'center';
  context.fillStyle = 'rgba(255, 255, 255, 0.68)';
  context.font = '800 14px Montserrat, Inter, Arial, sans-serif';
  context.letterSpacing = '1.2px';
  context.fillText(contactLabel, pillX + pillWidth / 2, y + 39);
  context.letterSpacing = '0px';
  context.fillStyle = '#ffffff';
  context.font = sellerPhone ? '850 25px Montserrat, Inter, Arial, sans-serif' : '800 21px Montserrat, Inter, Arial, sans-serif';
  context.fillText(fitCanvasText(context, contactValue, pillWidth - 32), pillX + pillWidth / 2, y + 69);
  context.restore();
}

async function drawListingAdCanvas(
  context: CanvasRenderingContext2D,
  listing: MarketplaceListing,
  options: { includeListingImage: boolean },
): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await document.fonts.ready.catch(() => undefined);
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  const imageSources = options.includeListingImage ? getListingImages(listing).slice(0, 3) : [];
  const listingImages = (
    await Promise.all(imageSources.map((imageSrc) => loadCanvasImage(imageSrc).catch(() => null)))
  ).filter((image): image is HTMLImageElement => image !== null);
  const logoImage = await loadCanvasImage(JPEG_AD_LOGO_SRC).catch(() => null);
  const watermarkImage = await loadCanvasImage(JPEG_AD_WATERMARK_SRC).catch(() => logoImage);
  const width = JPEG_AD_WIDTH;
  const height = JPEG_AD_HEIGHT;
  const margin = 64;
  const frameInset = 36;
  const frameRadius = 42;
  const province = getAdProvince(listing);
  const photoX = margin;
  const photoY = 150;
  const photoWidth = 904;
  const photoHeight = 610;
  const contentX = photoX + photoWidth + 42;
  const contentY = 178;
  const contentWidth = width - margin - contentX;
  const detailGap = 16;
  const detailCardWidth = (contentWidth - detailGap) / 2;
  const detailCardHeight = 78;
  const detailCardTop = 416;
  const specLineY = 646;
  const listedLineY = 682;
  const contactTop = 714;
  const contactHeight = 110;

  context.clearRect(0, 0, width, height);

  const backgroundGradient = context.createLinearGradient(0, 0, width, height);
  backgroundGradient.addColorStop(0, '#edf3f0');
  backgroundGradient.addColorStop(1, '#dfe9e4');
  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, width, height);

  context.save();
  context.shadowColor = 'rgba(12, 28, 24, 0.11)';
  context.shadowBlur = 30;
  context.shadowOffsetY = 18;
  fillRoundedRect(context, frameInset, frameInset, width - frameInset * 2, height - frameInset * 2, frameRadius, '#ffffff');
  context.restore();
  strokeRoundedRect(context, frameInset, frameInset, width - frameInset * 2, height - frameInset * 2, frameRadius, '#d7dde1', 2);

  drawAdWatermark(context, watermarkImage, contentX - 22, 286, contentWidth + 28, 410);

  context.save();
  if (logoImage) {
    const logoWidth = 360;
    const ratio = (logoImage.naturalHeight || logoImage.height) / Math.max(1, logoImage.naturalWidth || logoImage.width);
    context.drawImage(logoImage, margin - 30, 50, logoWidth, logoWidth * ratio);
  } else {
    drawAim4priceWordmarkFallback(context, margin, 112, 42, 1);
  }
  context.restore();

  drawAdProvincePill(context, province, width - margin - 286, 72, 286, 58);
  drawAdImageShowcase(context, listing, listingImages, photoX, photoY, photoWidth, photoHeight);

  context.save();
  context.fillStyle = '#050505';
  context.letterSpacing = '-3.4px';
  const rawPriceText = money(listing.askingPriceExVat);
  let priceFontSize = 72;

  while (priceFontSize > 50) {
    context.font = `950 ${priceFontSize}px Montserrat, Inter, Arial, sans-serif`;

    if (context.measureText(rawPriceText).width <= contentWidth - 122) {
      break;
    }

    priceFontSize -= 4;
  }

  const adPriceText = fitCanvasText(context, rawPriceText, contentWidth - 122);
  context.fillText(adPriceText, contentX, contentY + 67);
  const adPriceWidth = context.measureText(adPriceText).width;
  context.letterSpacing = '0px';
  context.font = `850 ${Math.max(28, Math.round(priceFontSize * 0.47))}px Montserrat, Inter, Arial, sans-serif`;
  context.fillText('+ VAT', contentX + Math.min(contentWidth - 118, adPriceWidth + 24), contentY + 58);

  context.fillStyle = '#0c0d0d';
  context.font = '850 38px Montserrat, Inter, Arial, sans-serif';
  const titleBottomY = drawWrappedCanvasText(context, listingDisplayTitle(listing), contentX, contentY + 126, contentWidth, 43, 2);

  context.fillStyle = '#60666a';
  context.font = '700 27px Montserrat, Inter, Arial, sans-serif';
  context.fillText(fitCanvasText(context, `Province: ${province}`, contentWidth), contentX, titleBottomY + 5);
  context.restore();

  drawAdLabelValue(context, 'Year', String(listing.yearModel || 'N/A'), contentX, detailCardTop, detailCardWidth, detailCardHeight);
  drawAdLabelValue(
    context,
    listingUsageLabel(listing),
    formatUsage(listing),
    contentX + detailCardWidth + detailGap,
    detailCardTop,
    detailCardWidth,
    detailCardHeight,
  );
  drawAdLabelValue(context, 'Condition', formatConditionLabel(getListingConditionKey(listing)), contentX, detailCardTop + detailCardHeight + 20, detailCardWidth, detailCardHeight);
  drawAdLabelValue(
    context,
    'Family',
    getListingPrimaryFamilyLabel(listing),
    contentX + detailCardWidth + detailGap,
    detailCardTop + detailCardHeight + 20,
    detailCardWidth,
    detailCardHeight,
  );

  context.save();
  context.fillStyle = '#111312';
  context.font = '850 25px Montserrat, Inter, Arial, sans-serif';
  context.fillText(fitCanvasText(context, buildListingSpecLine(listing) || 'Marketplace listing', contentWidth), contentX, specLineY);

  context.fillStyle = '#6a7074';
  context.font = '700 20px Montserrat, Inter, Arial, sans-serif';
  context.fillText(`Listed ${formatPublishedDate(listing.dateAdvertised || listing.publishedAtIso)} on Aim4price`, contentX, listedLineY);
  context.restore();

  drawAdContactCard(context, listing, contentX, contactTop, contentWidth, contactHeight);
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }

          reject(new Error('JPEG export failed.'));
        },
        'image/jpeg',
        0.92,
      );
    } catch (error) {
      reject(error);
    }
  });
}

async function createListingJpegAd(listing: MarketplaceListing): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('JPEG export is only available in the browser.');
  }

  const attempts = [true, false];

  for (const includeListingImage of attempts) {
    const canvas = document.createElement('canvas');
    canvas.width = JPEG_AD_WIDTH;
    canvas.height = JPEG_AD_HEIGHT;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas is not available.');
    }

    try {
      await drawListingAdCanvas(context, listing, { includeListingImage });
      return await canvasToJpegBlob(canvas);
    } catch (error) {
      if (!includeListingImage) {
        throw error;
      }
    }
  }

  throw new Error('JPEG export failed.');
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 500);
}

function normaliseFamilyOption(family: EquipmentFamilyRecord): FamilyOption | null {
  const sectorKey = normalizeSectorKey(family.sectorKey ?? family.sectorLabel);
  const familyLabel = String(family.familyLabel ?? '').trim();

  if (!sectorKey || !familyLabel) {
    return null;
  }

  return {
    sectorKey,
    familyKey: normalizeFamilyKey(family.familyKey, familyLabel),
    familyLabel,
    sortOrder: Number.isFinite(Number(family.sortOrder)) ? Number(family.sortOrder) : 1000,
  };
}

function mergeFamilies(records: EquipmentFamilyRecord[]): FamilyOption[] {
  const fromApi = records.map(normaliseFamilyOption).filter((item): item is FamilyOption => item !== null);
  const result: FamilyOption[] = [];
  const seen = new Set<string>();

  for (const family of [...fromApi, ...FALLBACK_FAMILIES]) {
    const key = `${family.sectorKey}:${family.familyKey}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(family);
  }

  return result.sort((a, b) => {
    if (a.sectorKey !== b.sectorKey) {
      return a.sectorKey.localeCompare(b.sectorKey);
    }

    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }

    return a.familyLabel.localeCompare(b.familyLabel);
  });
}

export default function MarketplaceClient({ initialFilters, isSignedIn }: MarketplaceClientProps) {
  const initialSearch = [initialFilters.brand, initialFilters.model]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ');

  const [query, setQuery] = useState(initialSearch);
  const [items, setItems] = useState<MarketplaceListing[]>(seedMarketplaceListings);
  const [families, setFamilies] = useState<FamilyOption[]>(FALLBACK_FAMILIES);
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [isLoadingFamilies, setIsLoadingFamilies] = useState(true);
  const [activeListing, setActiveListing] = useState<MarketplaceListing | null>(null);
  const [deleteListingTarget, setDeleteListingTarget] = useState<MarketplaceListing | null>(null);
  const [isDeletingListing, setIsDeletingListing] = useState(false);
  const [deleteListingError, setDeleteListingError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [shareListing, setShareListing] = useState<MarketplaceListing | null>(null);
  const [shareFeedback, setShareFeedback] = useState('');
  const [isCreatingJpegAd, setIsCreatingJpegAd] = useState(false);
  const [listingQueryId, setListingQueryId] = useState('');
  const [sectorFilter, setSectorFilter] = useState<SectorKey | ''>('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState<ConditionFilterValue>('');
  const [locationFilter, setLocationFilter] = useState('south-africa');
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilterValue>('all');
  const [visibleCount, setVisibleCount] = useState(LISTINGS_PER_LOAD);
  const modalDetailsRef = useRef<HTMLElement | null>(null);
  const [modalScrollState, setModalScrollState] = useState({ visible: false, top: 0, height: 100 });

  useEffect(() => {
    let mounted = true;

    async function refresh(options: { silent?: boolean } = {}) {
      if (!options.silent) {
        setIsLoadingListings(true);
      }

      try {
        const response = await fetch('/api/marketplace', {
          cache: 'no-store',
          credentials: 'include',
        });

        const data = (await response.json()) as MarketplaceApiResponse;

        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to load marketplace.');
        }

        if (!mounted) {
          return;
        }

        const publishedListings = Array.isArray(data.listings) ? data.listings : [];
        setItems([...publishedListings, ...seedMarketplaceListings]);
      } catch {
        if (mounted) {
          setItems(seedMarketplaceListings);
        }
      } finally {
        if (mounted && !options.silent) {
          setIsLoadingListings(false);
        }
      }
    }

    function refreshSilently() {
      void refresh({ silent: true });
    }

    void refresh();
    window.addEventListener('focus', refreshSilently);

    return () => {
      mounted = false;
      window.removeEventListener('focus', refreshSilently);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadFamilies() {
      setIsLoadingFamilies(true);

      try {
        const response = await fetch('/api/equipment-families', {
          cache: 'no-store',
          credentials: 'include',
        });
        const data = (await response.json()) as EquipmentFamiliesApiResponse;

        if (!response.ok || !data.ok) {
          throw new Error('Failed to load families.');
        }

        if (mounted) {
          setFamilies(mergeFamilies(Array.isArray(data.families) ? data.families : []));
        }
      } catch {
        if (mounted) {
          setFamilies(FALLBACK_FAMILIES);
        }
      } finally {
        if (mounted) {
          setIsLoadingFamilies(false);
        }
      }
    }

    void loadFamilies();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncListingFromUrl = () => {
      const searchParams = new URLSearchParams(window.location.search);
      setListingQueryId(String(searchParams.get('listing') ?? '').trim());
    };

    syncListingFromUrl();
    window.addEventListener('popstate', syncListingFromUrl);

    return () => {
      window.removeEventListener('popstate', syncListingFromUrl);
    };
  }, []);

  const familiesBySector = useMemo(() => {
    return SECTOR_OPTIONS.reduce<Record<SectorKey, FamilyOption[]>>(
      (accumulator, sector) => {
        accumulator[sector.key] = families.filter((family) => family.sectorKey === sector.key);
        return accumulator;
      },
      {
        agricultural: [],
        construction: [],
        industrial: [],
      },
    );
  }, [families]);

  const listingCountsBySector = useMemo(() => {
    return items.reduce<Record<SectorKey, number>>(
      (accumulator, listing) => {
        const sectorKey = inferSectorFromListing(listing);
        accumulator[sectorKey] += 1;
        return accumulator;
      },
      { agricultural: 0, construction: 0, industrial: 0 },
    );
  }, [items]);

  const availableProvinces = useMemo(() => {
    const provinces = Array.from(new Set(items.map((item) => String(item.province ?? '').trim()).filter(Boolean)));
    const merged = Array.from(new Set([...PROVINCES, ...provinces]));
    return merged.sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const search = normalize(query);

    return items.filter((listing) => {
      if (sectorFilter && inferSectorFromListing(listing) !== sectorFilter) {
        return false;
      }

      if (familyFilter && getListingFamilyKey(listing) !== familyFilter) {
        return false;
      }

      if (conditionFilter && getListingConditionKey(listing) !== conditionFilter) {
        return false;
      }

      if (!isListingInsideDistance(listing, locationFilter, distanceFilter)) {
        return false;
      }

      if (!search) {
        return true;
      }

      return buildSearchText(listing).includes(search);
    });
  }, [conditionFilter, distanceFilter, familyFilter, items, locationFilter, query, sectorFilter]);

  const visible = useMemo(() => sortListings(filtered), [filtered]);
  const visibleListings = visible.slice(0, visibleCount);
  const canShowMore = visibleCount < visible.length;

  const activeImages = useMemo(
    () => (activeListing ? getListingImages(activeListing) : []),
    [activeListing],
  );

  const shareUrl = useMemo(
    () => (shareListing ? buildListingShareUrl(shareListing) : ''),
    [shareListing],
  );

  const selectedSector = sectorFilter
    ? SECTOR_OPTIONS.find((sector) => sector.key === sectorFilter) ?? null
    : null;

  const activeFilterChips: ActiveFilterChip[] = [
    query.trim()
      ? {
          id: 'query',
          label: `Search: ${query.trim()}`,
          onRemove: () => setQuery(''),
        }
      : null,
    selectedSector
      ? {
          id: 'sector',
          label: selectedSector.label,
          onRemove: () => {
            setSectorFilter('');
            setFamilyFilter('');
          },
        }
      : null,
    familyFilter
      ? {
          id: 'family',
          label:
            families.find((family) => family.familyKey === familyFilter)?.familyLabel ??
            titleCase(familyFilter.replace(/_/g, ' ')),
          onRemove: () => setFamilyFilter(''),
        }
      : null,
    conditionFilter
      ? {
          id: 'condition',
          label: `Condition: ${formatConditionLabel(conditionFilter)}`,
          onRemove: () => setConditionFilter(''),
        }
      : null,
    locationFilter !== 'south-africa' || distanceFilter !== 'all'
      ? {
          id: 'location',
          label: buildLocationSummary(locationFilter, distanceFilter),
          onRemove: () => {
            setLocationFilter('south-africa');
            setDistanceFilter('all');
          },
        }
      : null,
  ].filter(Boolean) as ActiveFilterChip[];

  const canDeleteActiveListing = Boolean(activeListing?.canManage && activeListing?.sourceAssetId);

  const updateModalScrollRail = useCallback(() => {
    const node = modalDetailsRef.current;

    if (!node) {
      setModalScrollState({ visible: false, top: 0, height: 100 });
      return;
    }

    const scrollableDistance = node.scrollHeight - node.clientHeight;

    if (scrollableDistance <= 2) {
      setModalScrollState({ visible: false, top: 0, height: 100 });
      return;
    }

    const nextHeight = Math.max(16, Math.min(72, (node.clientHeight / node.scrollHeight) * 100));
    const maxTop = 100 - nextHeight;
    const nextTop = Math.min(maxTop, Math.max(0, (node.scrollTop / scrollableDistance) * maxTop));

    setModalScrollState((current) => {
      if (
        current.visible &&
        Math.abs(current.top - nextTop) < 0.2 &&
        Math.abs(current.height - nextHeight) < 0.2
      ) {
        return current;
      }

      return { visible: true, top: nextTop, height: nextHeight };
    });
  }, []);

  useEffect(() => {
    if (!activeListing) {
      setModalScrollState({ visible: false, top: 0, height: 100 });
      return undefined;
    }

    const syncScrollRail = () => updateModalScrollRail();
    const animationFrame = window.requestAnimationFrame(syncScrollRail);
    const timeout = window.setTimeout(syncScrollRail, 120);

    window.addEventListener('resize', syncScrollRail);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
      window.removeEventListener('resize', syncScrollRail);
    };
  }, [activeImages.length, activeListing, canDeleteActiveListing, isSignedIn, updateModalScrollRail]);

  useEffect(() => {
    setVisibleCount(LISTINGS_PER_LOAD);
  }, [conditionFilter, distanceFilter, familyFilter, locationFilter, query, sectorFilter]);

  useEffect(() => {
    if (!listingQueryId) {
      return;
    }

    const matchedListing = items.find((listing) => listingMatchesReference(listing, listingQueryId));

    if (!matchedListing) {
      return;
    }

    setActiveListing((current) => (current?.id === matchedListing.id ? current : matchedListing));
    setActiveImageIndex(0);
  }, [items, listingQueryId]);

  useEffect(() => {
    if (!activeListing) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeListing();
        return;
      }

      if (activeImages.length <= 1) {
        return;
      }

      if (event.key === 'ArrowRight') {
        setActiveImageIndex((current) => (current + 1) % activeImages.length);
      }

      if (event.key === 'ArrowLeft') {
        setActiveImageIndex((current) => (current - 1 + activeImages.length) % activeImages.length);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeImages.length, activeListing]);

  useEffect(() => {
    if (!shareListing) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeShareSheet();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [shareListing]);

  function updateListingUrl(nextListingId: string | null) {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);

    if (nextListingId) {
      url.searchParams.set('listing', nextListingId);
    } else {
      url.searchParams.delete('listing');
    }

    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    setListingQueryId(nextListingId ?? '');
  }

  function selectSector(nextSector: SectorKey | '') {
    setSectorFilter(nextSector);
    setFamilyFilter('');
  }

  function clearFilters() {
    setQuery('');
    setSectorFilter('');
    setFamilyFilter('');
    setConditionFilter('');
    setLocationFilter('south-africa');
    setDistanceFilter('all');
    setVisibleCount(LISTINGS_PER_LOAD);
  }

  function openListing(listing: MarketplaceListing) {
    setActiveListing(listing);
    setActiveImageIndex(0);
    updateListingUrl(listing.id);
  }

  function closeListing() {
    setActiveListing(null);
    setDeleteListingTarget(null);
    setDeleteListingError('');
    setActiveImageIndex(0);
    updateListingUrl(null);
  }

  function openShareSheet(listing: MarketplaceListing) {
    setShareListing(listing);
    setShareFeedback('');
  }

  function closeShareSheet() {
    setShareListing(null);
    setShareFeedback('');
    setIsCreatingJpegAd(false);
  }

  function showPreviousImage() {
    if (!activeImages.length) {
      return;
    }

    setActiveImageIndex((current) => (current - 1 + activeImages.length) % activeImages.length);
  }

  function showNextImage() {
    if (!activeImages.length) {
      return;
    }

    setActiveImageIndex((current) => (current + 1) % activeImages.length);
  }

  function handleCardKeyDown(event: ReactKeyboardEvent<HTMLElement>, listing: MarketplaceListing) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openListing(listing);
    }
  }

  function openShareWindow(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleShareAction(channel: 'whatsapp' | 'facebook' | 'copy') {
    if (!shareListing) {
      return;
    }

    const nextShareUrl = buildListingShareUrl(shareListing);

    try {
      if (channel === 'copy') {
        await copyTextToClipboard(nextShareUrl);
        setShareFeedback('Direct listing link copied.');
        return;
      }

      if (channel === 'whatsapp') {
        openShareWindow(`https://wa.me/?text=${encodeURIComponent(nextShareUrl)}`);
        closeShareSheet();
        return;
      }

      openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(nextShareUrl)}`);
      closeShareSheet();
    } catch {
      setShareFeedback('Sharing did not complete. Please try again.');
    }
  }

  async function handleCreateJpegAd() {
    if (!shareListing || isCreatingJpegAd) {
      return;
    }

    setIsCreatingJpegAd(true);
    setShareFeedback('Creating JPEG ad...');

    try {
      const blob = await createListingJpegAd(shareListing);
      downloadBlob(blob, `${sanitizeDownloadFilename(listingDisplayTitle(shareListing))}-aim4price-ad.jpg`);
      setShareFeedback('JPEG ad downloaded.');
    } catch {
      setShareFeedback('JPEG ad could not be created. Please try again.');
    } finally {
      setIsCreatingJpegAd(false);
    }
  }

  function openDeleteListingModal() {
    if (!activeListing?.sourceAssetId || !activeListing.canManage) {
      return;
    }

    setDeleteListingTarget(activeListing);
    setDeleteListingError('');
  }

  function closeDeleteListingModal() {
    if (isDeletingListing) {
      return;
    }

    setDeleteListingTarget(null);
    setDeleteListingError('');
  }

  async function handleDeleteActiveListing() {
    if (!deleteListingTarget?.sourceAssetId || !deleteListingTarget.canManage) {
      return;
    }

    const assetId = deleteListingTarget.sourceAssetId;

    try {
      setIsDeletingListing(true);
      setDeleteListingError('');

      const response = await fetch(
        `/api/marketplace?assetId=${encodeURIComponent(assetId)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to delete listing.');
      }

      setItems((current) => current.filter((listing) => listing.sourceAssetId !== assetId));
      setDeleteListingTarget(null);
      setDeleteListingError('');

      if (activeListing?.sourceAssetId === assetId) {
        closeListing();
      }
    } catch (error) {
      setDeleteListingError(error instanceof Error ? error.message : 'Failed to delete listing.');
    } finally {
      setIsDeletingListing(false);
    }
  }


  return (
    <main className={styles.page}>
      <div className={styles.topBand}>
        <AppHeader active="marketplace" />
      </div>

      <div className={styles.marketplaceShell}>
        <aside className={styles.sidebar} aria-label="Marketplace filters">
          <label className={styles.searchBox}>
            <span className={styles.searchIcon} aria-hidden="true">
              <IconSearch />
            </span>
            <input
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
              placeholder="Search Marketplace"
              aria-label="Search Marketplace"
            />
            {query ? (
              <button
                type="button"
                className={styles.searchClearButton}
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                <IconClose />
              </button>
            ) : null}
          </label>

          <a href={isSignedIn ? '/asset-register' : '/auth#signup'} className={styles.createButton}>
            <span className={styles.createIcon} aria-hidden="true">
              <IconPlus />
            </span>
            Create new listing
          </a>

          <div className={styles.sidebarDivider} />

          <section className={styles.sidebarSection}>
            <div className={styles.sidebarSectionHead}>
              <h2>Categories</h2>
            </div>

            <div className={styles.categoryList}>
              <button
                type="button"
                className={`${styles.categoryButton} ${!sectorFilter ? styles.categoryButtonActive : ''}`}
                onClick={() => selectSector('')}
              >
                <span className={styles.categoryIcon}>A</span>
                <span className={styles.categoryText}>
                  <strong>All categories</strong>
                  <small>{items.length} listings</small>
                </span>
              </button>

              {SECTOR_OPTIONS.map((sector) => (
                <button
                  key={sector.key}
                  type="button"
                  className={`${styles.categoryButton} ${sectorFilter === sector.key ? styles.categoryButtonActive : ''}`}
                  onClick={() => selectSector(sector.key)}
                >
                  <span className={styles.categoryIcon}>{sector.shortLabel.charAt(0)}</span>
                  <span className={styles.categoryText}>
                    <strong>{sector.label}</strong>
                    <small>{listingCountsBySector[sector.key]} listings</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {selectedSector ? (
            <section className={styles.sidebarSection}>
              <div className={styles.sidebarSectionHead}>
                <h2>{selectedSector.label} families</h2>
              </div>

              <div className={styles.familyList}>
                <button
                  type="button"
                  className={`${styles.familyButton} ${!familyFilter ? styles.familyButtonActive : ''}`}
                  onClick={() => setFamilyFilter('')}
                >
                  All {selectedSector.label.toLowerCase()}
                </button>

                {familiesBySector[selectedSector.key].map((family) => (
                  <button
                    key={`${family.sectorKey}-${family.familyKey}`}
                    type="button"
                    className={`${styles.familyButton} ${familyFilter === family.familyKey ? styles.familyButtonActive : ''}`}
                    onClick={() => setFamilyFilter(family.familyKey)}
                  >
                    {family.familyLabel}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.sidebarSection}>
            <div className={styles.sidebarSectionHead}>
              <h2>Sort by</h2>
            </div>

            <label className={styles.selectField}>
              <select
                value={conditionFilter}
                onChange={(event) => setConditionFilter(event.target.value as ConditionFilterValue)}
                aria-label="Sort by Aim4price condition"
              >
                {CONDITION_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className={styles.sidebarSection}>
            <div className={styles.sidebarSectionHead}>
              <h2>Distance</h2>
            </div>

            <label className={styles.selectField}>
              <select
                value={locationFilter}
                onChange={(event) => {
                  const nextLocation = event.target.value;
                  setLocationFilter(nextLocation);

                  if (nextLocation === 'south-africa') {
                    setDistanceFilter('all');
                  }
                }}
                aria-label="Marketplace location"
              >
                <option value="south-africa">South Africa</option>
                {availableProvinces.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.selectField}>
              <select
                value={distanceFilter}
                onChange={(event) => setDistanceFilter(event.target.value as DistanceFilterValue)}
                disabled={locationFilter === 'south-africa'}
                aria-label="Marketplace distance radius"
              >
                {DISTANCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {activeFilterChips.length ? (
            <button type="button" className={styles.resetButton} onClick={clearFilters}>
              Clear all filters
            </button>
          ) : null}
        </aside>

        <section className={styles.resultsArea}>
          {activeFilterChips.length ? (
            <div className={styles.activeFilters}>
              {activeFilterChips.map((chip) => (
                <button key={chip.id} type="button" className={styles.filterChip} onClick={chip.onRemove}>
                  <span>{chip.label}</span>
                  <strong aria-hidden="true">×</strong>
                </button>
              ))}
            </div>
          ) : null}

          {visibleListings.length > 0 ? (
            <div className={styles.listingGrid}>
              {visibleListings.map((listing) => {
                const images = getListingImages(listing);
                const conditionKey = getListingConditionKey(listing);

                return (
                  <article
                    key={listing.id}
                    className={styles.listingCard}
                    role="button"
                    tabIndex={0}
                    onClick={() => openListing(listing)}
                    onKeyDown={(event) => handleCardKeyDown(event, listing)}
                  >
                    <div className={styles.cardImageFrame}>
                      <ListingImage
                        src={images[0]}
                        listing={listing}
                        alt={listingDisplayTitle(listing)}
                        className={styles.cardImage}
                        variant="card"
                      />
                      {images.length > 1 ? <span className={styles.photoPill}>{images.length} photos</span> : null}
                      <button
                        type="button"
                        className={styles.cardShareButton}
                        onClick={(event) => {
                          event.stopPropagation();
                          openShareSheet(listing);
                        }}
                        aria-label="Share listing"
                      >
                        <IconShare />
                      </button>
                    </div>

                    <div className={styles.cardBody}>
                      <PriceWithVat value={listing.askingPriceExVat} className={styles.cardPrice} />
                      <h3>{listingDisplayTitle(listing)}</h3>
                      <p className={styles.cardLocation}>{formatLocation(listing)}</p>
                      <p className={styles.cardMeta}>
                        {listing.yearModel || 'Year N/A'} · {formatUsage(listing)} ·{' '}
                        {formatConditionLabel(conditionKey)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <article className={styles.emptyState}>
              <h2>No listings found</h2>
              <p>Try another search, category, condition or location.</p>
              <button type="button" onClick={clearFilters}>
                Reset marketplace
              </button>
            </article>
          )}

          {canShowMore ? (
            <div className={styles.showMoreWrap}>
              <button
                type="button"
                className={styles.showMoreButton}
                onClick={() => setVisibleCount((current) => current + LISTINGS_PER_LOAD)}
              >
                Show more listings
              </button>
            </div>
          ) : null}
        </section>
      </div>

      {activeListing ? (
        <div className={styles.modalOverlay} onClick={closeListing}>
          <div
            className={`${styles.listingModal} ${activeImages.length ? '' : styles.listingModalNoMedia}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketplace-listing-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className={styles.modalCloseButton} onClick={closeListing} aria-label="Close listing">
              <IconClose />
            </button>

            <div className={styles.modalGallery}>
              <div className={styles.modalImageFrame}>
                {activeImages.length ? (
                  <ListingImage
                    src={activeImages[activeImageIndex]}
                    listing={activeListing}
                    alt={listingDisplayTitle(activeListing)}
                    className={styles.modalImage}
                    variant="modal"
                  />
                ) : (
                  <ListingPlaceholder listing={activeListing} variant="modal" />
                )}

                {activeImages.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className={`${styles.galleryArrow} ${styles.galleryArrowLeft}`}
                      onClick={showPreviousImage}
                      aria-label="Previous photo"
                    >
                      <IconChevronLeft />
                    </button>
                    <button
                      type="button"
                      className={`${styles.galleryArrow} ${styles.galleryArrowRight}`}
                      onClick={showNextImage}
                      aria-label="Next photo"
                    >
                      <IconChevronRight />
                    </button>
                  </>
                ) : null}

                {activeImages.length ? (
                  <span className={styles.modalPhotoCount}>
                    {activeImageIndex + 1} / {activeImages.length}
                  </span>
                ) : null}
              </div>

              {activeImages.length > 1 ? (
                <div className={styles.thumbnailRail}>
                  {activeImages.map((imageSrc, index) => (
                    <button
                      key={`${imageSrc}-${index}`}
                      type="button"
                      className={`${styles.thumbnailButton} ${index === activeImageIndex ? styles.thumbnailButtonActive : ''}`}
                      onClick={() => setActiveImageIndex(index)}
                      aria-label={`Show photo ${index + 1}`}
                    >
                      <img src={imageSrc} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <aside ref={modalDetailsRef} className={styles.modalDetails} onScroll={updateModalScrollRail}>
              <div className={styles.modalTitleArea}>
                <PriceWithVat value={activeListing.askingPriceExVat} className={styles.modalPrice} />
                <h2 id="marketplace-listing-title">{listingDisplayTitle(activeListing)}</h2>
                <p>{formatLocation(activeListing)}</p>
              </div>

              <div className={styles.modalActionRow}>
                <button type="button" className={styles.modalShareButton} onClick={() => openShareSheet(activeListing)}>
                  <IconShare />
                  Share
                </button>
                {activeListing.sourceUrl ? (
                  <a
                    href={activeListing.sourceUrl}
                    className={styles.modalSourceButton}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open source
                  </a>
                ) : null}
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <span>Year</span>
                  <strong>{activeListing.yearModel || 'N/A'}</strong>
                </div>
                <div className={styles.detailItem}>
                  <span>{listingUsageLabel(activeListing)}</span>
                  <strong>{formatUsage(activeListing)}</strong>
                </div>
                <div className={styles.detailItem}>
                  <span>Condition</span>
                  <strong>{formatConditionLabel(getListingConditionKey(activeListing))}</strong>
                </div>
                <div className={styles.detailItem}>
                  <span>Family</span>
                  <strong>{getListingPrimaryFamilyLabel(activeListing)}</strong>
                </div>
              </div>

              <section className={styles.modalSection}>
                <h3>Details</h3>
                <p>{buildListingSpecLine(activeListing)}</p>
                {getListingNote(activeListing) ? <p>{getListingNote(activeListing)}</p> : null}
                <small>Listed {formatPublishedDate(activeListing.dateAdvertised || activeListing.publishedAtIso)}</small>
              </section>

              <section className={styles.modalSection}>
                <h3>Seller information</h3>

                {isSignedIn ? (
                  <div className={styles.contactRows}>
                    <div className={styles.contactRow}>
                      <span>Seller</span>
                      <strong>{activeListing.sellerName || 'Aim4price seller'}</strong>
                    </div>
                    {activeListing.sellerCompany ? (
                      <div className={styles.contactRow}>
                        <span>Company</span>
                        <strong>{activeListing.sellerCompany}</strong>
                      </div>
                    ) : null}
                    <div className={styles.contactRow}>
                      <span>Phone</span>
                      {activeListing.sellerPhone ? (
                        <strong>
                          <a href={`tel:${activeListing.sellerPhone}`}>{activeListing.sellerPhone}</a>
                        </strong>
                      ) : (
                        <strong>N/A</strong>
                      )}
                    </div>
                    {activeListing.sellerEmail ? (
                      <div className={styles.contactRow}>
                        <span>Email</span>
                        <strong>
                          <a href={`mailto:${activeListing.sellerEmail}`}>{activeListing.sellerEmail}</a>
                        </strong>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className={styles.blurredContactCard}>
                    <div className={`${styles.contactRows} ${styles.contactRowsBlurred}`} aria-hidden="true">
                      <div className={styles.contactRow}>
                        <span>Seller</span>
                        <strong>{activeListing.sellerName || 'Aim4price seller'}</strong>
                      </div>
                      {activeListing.sellerCompany ? (
                        <div className={styles.contactRow}>
                          <span>Company</span>
                          <strong>{activeListing.sellerCompany}</strong>
                        </div>
                      ) : null}
                      <div className={styles.contactRow}>
                        <span>Phone</span>
                        <strong>{activeListing.sellerPhone || '+27 00 000 0000'}</strong>
                      </div>
                      <div className={styles.contactRow}>
                        <span>Email</span>
                        <strong>{activeListing.sellerEmail || 'seller@aim4price.co.za'}</strong>
                      </div>
                    </div>

                    <div className={styles.contactBlurOverlay}>
                      <strong>Sign in to view seller details.</strong>
                      <p>Seller contact information is hidden until you are signed in.</p>
                      <div className={styles.lockedActions}>
                        <a href="/auth#login">Login</a>
                        <a href="/auth#signup">Create account</a>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {canDeleteActiveListing ? (
                <section className={styles.ownerActions}>
                  <div>
                    <h3>Your listing</h3>
                    <p>Remove this asset from the marketplace.</p>
                  </div>
                  <button type="button" onClick={openDeleteListingModal}>
                    Delete listing
                  </button>
                </section>
              ) : null}
            </aside>

            {modalScrollState.visible ? (
              <div className={styles.modalScrollRail} aria-hidden="true">
                <span
                  className={styles.modalScrollThumb}
                  style={{ top: `${modalScrollState.top}%`, height: `${modalScrollState.height}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {deleteListingTarget ? (
        <div className={styles.marketplaceDeleteBackdrop}>
          <div
            className={styles.marketplaceDeleteModal}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="marketplace-delete-title"
            aria-describedby="marketplace-delete-copy"
          >
            <div className={styles.marketplaceDeleteHeader}>
              <div>
                <h3 id="marketplace-delete-title">Delete marketplace listing?</h3>
                <p id="marketplace-delete-copy">This removes the listing from the marketplace. The asset stays saved in your Asset Register.</p>
              </div>
              <button
                type="button"
                className={styles.marketplaceDeleteCloseButton}
                onClick={closeDeleteListingModal}
                aria-label="Close delete confirmation"
                disabled={isDeletingListing}
              >
                ×
              </button>
            </div>

            <div className={styles.marketplaceDeleteSelected}>
              <span>Selected listing</span>
              <strong>{listingDisplayTitle(deleteListingTarget)}</strong>
              <p>{money(deleteListingTarget.askingPriceExVat)} excl. VAT · {formatLocation(deleteListingTarget)}</p>
            </div>

            {deleteListingError ? <p className={styles.marketplaceDeleteError}>{deleteListingError}</p> : null}

            <div className={styles.marketplaceDeleteActions}>
              <button type="button" className={styles.marketplaceDeleteSecondaryButton} onClick={closeDeleteListingModal} disabled={isDeletingListing}>
                Close
              </button>
              <button type="button" className={styles.marketplaceDeleteDangerButton} onClick={() => void handleDeleteActiveListing()} disabled={isDeletingListing}>
                {isDeletingListing ? 'Deleting...' : 'Yes, delete listing'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shareListing ? (
        <div className={styles.shareOverlay} onClick={closeShareSheet}>
          <div
            className={styles.shareDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-listing-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className={styles.shareCloseButton} onClick={closeShareSheet} aria-label="Close share dialog">
              <IconClose />
            </button>

            <div className={styles.shareHeader}>
              <span>Share listing</span>
              <h2 id="share-listing-title">Send this listing outside Aim4price.</h2>
              <p>Share the direct listing link or create a ready-to-post JPEG ad.</p>
            </div>

            <div
              className={`${styles.sharePreviewCard} ${getListingImages(shareListing).length ? '' : styles.sharePreviewCardNoMedia}`}
            >
              <ListingImage
                src={getListingImages(shareListing)[0]}
                listing={shareListing}
                alt={listingDisplayTitle(shareListing)}
                className={styles.sharePreviewImage}
                variant="share"
              />
              <div className={styles.sharePreviewMeta}>
                <strong>{listingDisplayTitle(shareListing)}</strong>
                <PriceWithVat value={shareListing.askingPriceExVat} className={styles.sharePrice} />
                <small>{formatLocation(shareListing)}</small>
              </div>
            </div>

            <div className={styles.shareGrid}>
              <button type="button" onClick={() => void handleShareAction('whatsapp')}>
                <BrandIcon src="/brand/whatsapp.png" />
                <span>WhatsApp</span>
              </button>
              <button type="button" onClick={() => void handleShareAction('facebook')}>
                <BrandIcon src="/brand/facebook.png" />
                <span>Facebook</span>
              </button>
              <button type="button" onClick={() => void handleShareAction('copy')}>
                <IconCopy />
                <span>Copy link</span>
              </button>
              <button type="button" onClick={() => void handleCreateJpegAd()} disabled={isCreatingJpegAd}>
                <IconPhoto />
                <span>{isCreatingJpegAd ? 'Creating...' : 'Create JPEG'}</span>
              </button>
            </div>

            <label className={styles.shareLinkField}>
              <span>Direct link</span>
              <input value={shareUrl} readOnly aria-label="Direct listing link" />
            </label>

            {shareFeedback ? <p className={styles.shareFeedback}>{shareFeedback}</p> : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
