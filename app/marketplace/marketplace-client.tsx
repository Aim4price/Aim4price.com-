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
import GroupedCurrencyInput from '../../components/GroupedCurrencyInput';
import styles from './page.module.css';
import dealerStyles from '../dealer/dealer.module.css';
import {
  FALLBACK_MARKETPLACE_IMAGE,
  calculateMarketplaceDealRating,
  seedMarketplaceListings,
  type MarketplaceDealRating,
  type MarketplaceListing,
} from '../../lib/marketplace';
import type { AdTemplateId } from '../../lib/ad-studio';
import {
  createMarketplaceAdJpeg as createSharedMarketplaceAdJpeg,
  downloadMarketplaceAd,
  marketplaceAdFilename,
} from '../../lib/marketplace-ad-renderer';
import { money } from '../../lib/tractor-logic';

type MarketplaceFilters = {
  brand: string;
  model: string;
  drive: string;
  type: string;
};

type MarketplaceAccountType = 'owner' | 'dealer' | 'public' | string;

type MarketplaceClientProps = {
  initialFilters: MarketplaceFilters;
  isSignedIn: boolean;
  accountType?: MarketplaceAccountType | null;
  initialListings?: MarketplaceListing[];
  embeddedMode?: boolean;
  showroomMode?: boolean;
  exposeSellerContact?: boolean;
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

type SectorKey = 'agricultural' | 'construction' | 'industrial' | 'motor';
type DistanceFilterValue = 'all' | '50' | '100' | '250' | '500';
type ConditionFilterValue = '' | 'excellent' | 'good' | 'fair' | 'used' | 'serious';
type DealRatingFilterValue = 'any' | MarketplaceDealRating;

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

type PaginationItem = number | 'ellipsis-before' | 'ellipsis-after';
type DealerListingView = 'browse' | 'mine';

type MarketplaceEditDraft = {
  askingPriceExVat: string;
  description: string;
  sellerName: string;
  sellerCompany: string;
  sellerPhone: string;
  sellerEmail: string;
  province: string;
  area: string;
};

const LISTINGS_PER_PAGE = 24;
const JPEG_AD_WIDTH = 1600;
const JPEG_AD_HEIGHT = 900;
const DEFAULT_MARKETPLACE_CONTACT_NAME = 'Kuyler';
const DEFAULT_MARKETPLACE_CONTACT_PHONE = '062 572 1650';
const DEFAULT_MARKETPLACE_CONTACT_TEL = '0625721650';
const DEFAULT_MARKETPLACE_CONTACT_DISPLAY = `${DEFAULT_MARKETPLACE_CONTACT_NAME} - ${DEFAULT_MARKETPLACE_CONTACT_PHONE}`;

const SECTOR_OPTIONS: SectorOption[] = [
  { key: 'agricultural', label: 'Agriculture', shortLabel: 'Agri' },
  { key: 'construction', label: 'Construction', shortLabel: 'Build' },
  { key: 'industrial', label: 'Industrial', shortLabel: 'Industry' },
  { key: 'motor', label: 'Motor', shortLabel: 'Motor' },
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
  { sectorKey: 'motor', familyKey: 'bakkies_ldvs', familyLabel: 'Bakkies / LDVs', sortOrder: 1 },
  { sectorKey: 'motor', familyKey: 'cars_suvs', familyLabel: 'Cars / SUVs', sortOrder: 2 },
  { sectorKey: 'motor', familyKey: 'light_commercial_vehicles', familyLabel: 'Light commercial vehicles', sortOrder: 3 },
  { sectorKey: 'motor', familyKey: 'trucks', familyLabel: 'Trucks', sortOrder: 4 },
  { sectorKey: 'motor', familyKey: 'trailers', familyLabel: 'Trailers', sortOrder: 5 },
  { sectorKey: 'motor', familyKey: 'buses', familyLabel: 'Buses', sortOrder: 6 },
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

const DEAL_RATING_OPTIONS: Array<{
  value: MarketplaceDealRating;
  label: string;
  shortLabel: string;
}> = [
  { value: 'low', label: 'Low Price', shortLabel: 'Low' },
  { value: 'great', label: 'Great Price', shortLabel: 'Great' },
  { value: 'fair', label: 'Fair Price', shortLabel: 'Fair' },
  { value: 'high', label: 'High Price', shortLabel: 'High' },
  { value: 'none', label: 'No Rating', shortLabel: 'No Rating' },
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

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3Z" />
      <path d="m14 7 3 3" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

function IconAssetRegister() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function IconEstimate() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v18" />
      <path d="M17 7.5c0-1.7-1.8-3-4.3-3S8.4 5.6 8.4 7.2c0 4.4 8.2 2.1 8.2 6.6 0 1.7-1.8 3-4.3 3s-4.5-1.2-4.5-3" />
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

function listingUsageLabel(_listing: MarketplaceListing): string {
  return 'Usage';
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

function getResolvedUsageUnit(listing: MarketplaceListing): MarketplaceListing['usageUnit'] {
  const unit = listing.usageUnit;

  if (unit === 'percent' || unit === 'km') {
    return unit;
  }

  const amount = Number(listing.hours || 0);
  const percent = getListingWorkedPercent(listing);

  if (percent !== null && (!Number.isFinite(amount) || amount <= 0)) {
    return 'percent';
  }

  return 'hours';
}

function formatUsage(listing: MarketplaceListing): string {
  const usageUnit = getResolvedUsageUnit(listing);

  if (usageUnit === 'percent') {
    const percent = getListingWorkedPercent(listing);
    return percent === null ? 'Percentage not set' : `${formatPercent(percent)}% worked`;
  }

  const amount = Number(listing.hours || 0);
  const suffix = usageUnit === 'km' ? 'km' : 'hours';

  if (!Number.isFinite(amount) || amount <= 0) {
    return usageUnit === 'km' ? 'km not set' : 'hours not set';
  }

  return `${Math.round(amount).toLocaleString('en-ZA')} ${suffix}`;
}

function normalizeSectorKey(value: unknown): SectorKey | '' {
  const normalized = normalize(value).replace(/\s+/g, '-');

  if (normalized === 'agriculture' || normalized === 'agricultural') return 'agricultural';
  if (normalized === 'construction') return 'construction';
  if (normalized === 'industrial' || normalized === 'industry') return 'industrial';
  if (normalized === 'motor' || normalized === 'vehicle' || normalized === 'vehicles') return 'motor';
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

  if (/vehicle|bakkie|hilux|ranger|ldv|pickup|ute|car|suv|truck|bus/.test(searchText)) {
    return 'motor';
  }

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

  if (assetKind === 'vehicle') return 'Bakkies / LDVs';
  if (assetKind === 'tools' || assetKind === 'tool') return 'Tools';
  if (assetKind === 'equipment') return 'Equipment';
  if (assetKind === 'stock' || assetKind === 'inventory') return 'Stock';
  if (assetKind === 'manual' || assetKind === 'other') return 'Other';
  if (assetKind === 'property') return 'Property/Buildings';

  const modelText = [listing.title, listing.modelName, listing.description].join(' ').toLowerCase();

  if (/truck/.test(modelText)) return 'Trucks';
  if (/bus/.test(modelText)) return 'Buses';
  if (/car|suv/.test(modelText)) return 'Cars / SUVs';
  if (/vehicle|bakkie|hilux|ranger|ldv|pickup|ute/.test(modelText)) return 'Bakkies / LDVs';
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

function isDealRatingKey(value: unknown): value is MarketplaceDealRating {
  return value === 'low' || value === 'great' || value === 'fair' || value === 'high' || value === 'none';
}

function isManualMarketplaceListing(listing: MarketplaceListing): boolean {
  const assetKind = normalize(listing.assetKind).replace(/[_\s-]+/g, '-');

  return assetKind === 'manual';
}

function getListingDealRating(listing: MarketplaceListing): MarketplaceDealRating {
  if (listing.showDealRating === false) {
    return 'none';
  }

  if (isDealRatingKey(listing.dealRating)) {
    return listing.dealRating;
  }

  return calculateMarketplaceDealRating({
    askingPriceExVat: listing.askingPriceExVat,
    aim4priceValueExVat: listing.aim4priceValueExVat,
    isManualEquipment: isManualMarketplaceListing(listing),
  }).rating;
}

function getDealRatingOption(value: MarketplaceDealRating) {
  return (
    DEAL_RATING_OPTIONS.find((option) => option.value === value) ??
    ({ value: 'none', label: 'No Rating', shortLabel: 'No Rating' } satisfies (typeof DEAL_RATING_OPTIONS)[number])
  );
}

function getDealRatingLabel(value: MarketplaceDealRating): string {
  return getDealRatingOption(value).label;
}

function getDealRatingShortLabel(value: MarketplaceDealRating): string {
  return getDealRatingOption(value).shortLabel;
}

function getDealRatingToneClass(value: MarketplaceDealRating): string {
  if (value === 'low') return styles.dealRatingBadgeLow;
  if (value === 'great') return styles.dealRatingBadgeGreat;
  if (value === 'fair') return styles.dealRatingBadgeFair;
  if (value === 'high') return styles.dealRatingBadgeHigh;
  return styles.dealRatingBadgeNone;
}

function DealRatingBadge({
  listing,
  variant = 'card',
}: {
  listing: MarketplaceListing;
  variant?: 'card' | 'modal';
}) {
  if (listing.showDealRating === false) return null;

  const rating = getListingDealRating(listing);
  const label = variant === 'card' ? getDealRatingShortLabel(rating) : getDealRatingLabel(rating);

  return (
    <span
      className={`${styles.dealRatingBadge} ${getDealRatingToneClass(rating)} ${
        variant === 'modal' ? styles.modalDealRatingBadge : styles.cardDealRatingBadge
      }`}
    >
      {label}
    </span>
  );
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
    getDealRatingLabel(getListingDealRating(listing)),
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
    const params = new URLSearchParams({ listing: listing.id, preview: 'photo' });
    return `/marketplace/browse?${params.toString()}`;
  }

  const url = new URL('/marketplace/browse', window.location.origin);
  url.searchParams.set('listing', listing.id);
  url.searchParams.set('preview', 'photo');
  return url.toString();
}

function buildListingShareText(listing: MarketplaceListing): string {
  return [
    listingDisplayTitle(listing),
    `${money(listing.askingPriceExVat)} ${getAdVatLabel(listing)}`,
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

function getAdProvince(listing: MarketplaceListing): string {
  return String(listing.province ?? '').trim() || 'South Africa';
}

function isPlaceholderContactName(value: unknown): boolean {
  const normalized = normalize(value).replace(/\s+/g, ' ');

  return (
    !normalized ||
    normalized === 'aim4price seller' ||
    normalized === 'marketplace seller' ||
    normalized === 'seller' ||
    normalized === 'contact person'
  );
}

function isPlaceholderContactPhone(value: unknown): boolean {
  const compact = String(value ?? '').replace(/[^\d+]/g, '');

  return !compact || compact === '+27000000000' || compact === '27000000000' || compact === '0000000000';
}

function getAdSellerName(listing: MarketplaceListing): string {
  const contactPerson = String(listing.adBrand?.contactName || listing.sellerName || '').trim();
  const company = String(listing.adBrand?.businessName || listing.sellerCompany || '').trim();

  if (!isPlaceholderContactName(contactPerson)) {
    return contactPerson;
  }

  if (!isPlaceholderContactName(company)) {
    return company;
  }

  return DEFAULT_MARKETPLACE_CONTACT_NAME;
}

function getAdSellerPhone(listing: MarketplaceListing): string {
  const phone = String(listing.adBrand?.phone || listing.sellerPhone || '').trim();
  return isPlaceholderContactPhone(phone) ? DEFAULT_MARKETPLACE_CONTACT_PHONE : phone;
}

function getAdVatLabel(listing: MarketplaceListing): string {
  const language = listing.adBrand?.language === 'af' ? 'af' : 'en';
  if (listing.adBrand?.vatLabel === 'vat-included') return language === 'af' ? 'BTW INGESLUIT' : 'VAT INCLUDED';
  if (listing.adBrand?.vatLabel === 'no-vat') return language === 'af' ? 'GEEN BTW' : 'NO VAT';
  return language === 'af' ? '+ BTW' : '+ VAT';
}

function getPublicMarketplaceListing(listing: MarketplaceListing): MarketplaceListing {
  return {
    ...listing,
    sellerName: DEFAULT_MARKETPLACE_CONTACT_NAME,
    sellerCompany: undefined,
    sellerPhone: DEFAULT_MARKETPLACE_CONTACT_PHONE,
    sellerEmail: undefined,
  };
}

function getListingForCurrentViewer(listing: MarketplaceListing, exposeSellerContact: boolean): MarketplaceListing {
  return exposeSellerContact ? listing : getPublicMarketplaceListing(listing);
}

function drawAdLogoBadge(
  context: CanvasRenderingContext2D,
  logoImage: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
  fallbackLabel = 'Marketplace seller',
) {
  context.save();
  context.shadowColor = 'rgba(5, 5, 5, 0.14)';
  context.shadowBlur = 18;
  context.shadowOffsetY = 8;
  fillRoundedRect(context, x, y, width, height, 20, 'rgba(255, 255, 255, 0.94)');
  context.restore();
  strokeRoundedRect(context, x, y, width, height, 20, 'rgba(215, 221, 225, 0.92)', 1.4);

  context.save();
  if (logoImage) {
    const ratio = (logoImage.naturalHeight || logoImage.height) / Math.max(1, logoImage.naturalWidth || logoImage.width);
    const logoWidth = width - 42;
    const logoHeight = Math.min(height - 18, logoWidth * ratio);
    context.drawImage(logoImage, x + 21, y + (height - logoHeight) / 2, logoWidth, logoHeight);
  } else {
    context.fillStyle = '#050505';
    context.font = '900 25px Montserrat, Inter, Arial, sans-serif';
    context.letterSpacing = '-1.3px';
    context.textBaseline = 'middle';
    context.fillText(fitCanvasText(context, fallbackLabel, width - 44), x + 22, y + height / 2 + 1);
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
  context.save();
  context.shadowColor = 'rgba(20, 61, 49, 0.07)';
  context.shadowBlur = 11;
  context.shadowOffsetY = 6;
  fillRoundedRect(context, x, y, width, height, height / 2, '#edf6f1');
  context.restore();
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

function drawAdThumbnailPlaceholder(
  context: CanvasRenderingContext2D,
  listing: MarketplaceListing,
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  fillRoundedRect(context, x, y, width, height, 20, '#f5f7f6');
  strokeRoundedRect(context, x, y, width, height, 20, '#e2e9e5', 1.5);

  context.save();
  context.fillStyle = '#165340';
  context.font = '850 20px Montserrat, Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`PHOTO ${index + 1}`, x + width / 2, y + height / 2 - 6);
  context.fillStyle = '#78817d';
  context.font = '700 14px Montserrat, Inter, Arial, sans-serif';
  context.fillText(fitCanvasText(context, getListingPrimaryFamilyLabel(listing), width - 34), x + width / 2, y + height / 2 + 20);
  context.restore();
}

function drawAdThumbnailCell(
  context: CanvasRenderingContext2D,
  listing: MarketplaceListing,
  image: HTMLImageElement | undefined,
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.save();
  context.shadowColor = 'rgba(8, 23, 18, 0.15)';
  context.shadowBlur = 16;
  context.shadowOffsetY = 9;
  fillRoundedRect(context, x, y, width, height, 22, '#ffffff');
  context.restore();

  if (image) {
    drawCoverImage(context, image, x, y, width, height, 18);
  } else {
    drawAdThumbnailPlaceholder(context, listing, index, x, y, width, height);
  }

  strokeRoundedRect(context, x, y, width, height, 18, index === 0 ? '#165340' : '#ffffff', index === 0 ? 4 : 3);

  context.save();
  const badgeSize = 36;
  fillRoundedRect(context, x + 12, y + 12, badgeSize, badgeSize, badgeSize / 2, index === 0 ? '#165340' : 'rgba(255, 255, 255, 0.92)');
  strokeRoundedRect(context, x + 12, y + 12, badgeSize, badgeSize, badgeSize / 2, index === 0 ? '#165340' : 'rgba(215, 221, 225, 0.96)', 1.2);
  context.fillStyle = index === 0 ? '#ffffff' : '#050505';
  context.font = '850 18px Montserrat, Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(index + 1), x + 12 + badgeSize / 2, y + 12 + badgeSize / 2 + 1);
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
  const thumbnailGap = 18;
  const thumbnailCount = 4;
  const thumbnailHeight = 158;
  const mainGap = 20;
  const mainHeight = height - thumbnailHeight - mainGap;
  const thumbnailWidth = (width - thumbnailGap * (thumbnailCount - 1)) / thumbnailCount;
  const thumbnailY = y + mainHeight + mainGap;

  context.save();
  context.shadowColor = 'rgba(7, 23, 18, 0.22)';
  context.shadowBlur = 28;
  context.shadowOffsetY = 16;
  fillRoundedRect(context, x, y, width, mainHeight, 34, '#eef4f1');
  context.restore();

  if (images[0]) {
    drawCoverImage(context, images[0], x, y, width, mainHeight, 34);
  } else {
    drawAdPlaceholder(context, listing, x, y, width, mainHeight);
  }

  context.save();
  createRoundedRectPath(context, x, y, width, mainHeight, 34);
  context.clip();
  const topGradient = context.createLinearGradient(0, y, 0, y + mainHeight * 0.28);
  topGradient.addColorStop(0, 'rgba(0, 0, 0, 0.16)');
  topGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = topGradient;
  context.fillRect(x, y, width, mainHeight * 0.28);

  const bottomGradient = context.createLinearGradient(0, y + mainHeight * 0.65, 0, y + mainHeight);
  bottomGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  bottomGradient.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
  context.fillStyle = bottomGradient;
  context.fillRect(x, y + mainHeight * 0.65, width, mainHeight * 0.35);
  context.restore();

  strokeRoundedRect(context, x, y, width, mainHeight, 34, 'rgba(255, 255, 255, 0.78)', 3);

  for (let index = 0; index < thumbnailCount; index += 1) {
    const thumbnailX = x + index * (thumbnailWidth + thumbnailGap);
    drawAdThumbnailCell(context, listing, images[index], index, thumbnailX, thumbnailY, thumbnailWidth, thumbnailHeight);
  }
}

function drawAdContactBox(
  context: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.save();
  context.shadowColor = 'rgba(9, 39, 31, 0.08)';
  context.shadowBlur = 14;
  context.shadowOffsetY = 8;
  fillRoundedRect(context, x, y, width, height, 18, '#ffffff');
  context.restore();
  strokeRoundedRect(context, x, y, width, height, 18, '#0d3329', 2.4);

  context.save();
  context.textAlign = 'center';
  context.fillStyle = '#6c7175';
  context.font = '800 14px Montserrat, Inter, Arial, sans-serif';
  context.letterSpacing = '1.6px';
  context.fillText(label.toUpperCase(), x + width / 2, y + 28);
  context.letterSpacing = '0px';
  context.fillStyle = '#050505';
  context.font = '850 29px Montserrat, Inter, Arial, sans-serif';
  context.fillText(fitCanvasText(context, value, width - 52), x + width / 2, y + 65);
  context.restore();
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
  const fieldGap = 30;
  const fieldHeight = (height - fieldGap) / 2;

  drawAdContactBox(context, 'Contact person', sellerName, x, y, width, fieldHeight);
  drawAdContactBox(context, 'Phone / WhatsApp', sellerPhone, x, y + fieldHeight + fieldGap, width, fieldHeight);
}

function canvasContrastColor(hexColor: string): string {
  const normalized = hexColor.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 148 ? '#10251f' : '#ffffff';
}

function drawAim4priceCredit(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  dark = false,
) {
  fillRoundedRect(context, x, y, width, height, height / 2, dark ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.94)');
  context.save();
  context.fillStyle = '#314c43';
  context.font = '800 15px Montserrat, Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('Powered by Aim4price.com', x + width / 2, y + height / 2 + 1);
  context.restore();
}

function drawBrandedAdvertDetails(
  context: CanvasRenderingContext2D,
  listing: MarketplaceListing,
  x: number,
  y: number,
  width: number,
  textColor: string,
  accentColor: string,
  options: { compact?: boolean; centered?: boolean } = {},
) {
  context.save();
  context.fillStyle = textColor;
  context.textAlign = options.centered ? 'center' : 'left';
  const textX = options.centered ? x + width / 2 : x;
  context.font = `950 ${options.compact ? 38 : 52}px Montserrat, Inter, Arial, sans-serif`;
  context.letterSpacing = '-1.8px';
  const titleBottom = drawWrappedCanvasText(
    context,
    listingDisplayTitle(listing),
    textX,
    y,
    width,
    options.compact ? 43 : 57,
    2,
  );
  context.letterSpacing = '0px';
  context.font = `750 ${options.compact ? 22 : 27}px Montserrat, Inter, Arial, sans-serif`;
  context.globalAlpha = 0.78;
  context.fillText(
    fitCanvasText(
      context,
      `${listing.yearModel || 'N/A'} · ${formatUsage(listing)} · ${formatConditionLabel(getListingConditionKey(listing))}`,
      width,
    ),
    textX,
    titleBottom + 10,
  );
  context.globalAlpha = 1;

  context.fillStyle = accentColor;
  const lineX = options.centered ? x + width * 0.26 : x;
  context.fillRect(lineX, titleBottom + 35, options.centered ? width * 0.48 : Math.min(170, width), 7);
  context.restore();
}

function drawAlternateBrandedAdCanvas(
  context: CanvasRenderingContext2D,
  listing: MarketplaceListing,
  templateId: AdTemplateId,
  listingImages: HTMLImageElement[],
  sellerLogo: HTMLImageElement | null,
) {
  const width = JPEG_AD_WIDTH;
  const height = JPEG_AD_HEIGHT;
  const primary = listing.adBrand?.primaryColor || '#165340';
  const secondary = listing.adBrand?.secondaryColor || '#0D3329';
  const accent = listing.adBrand?.accentColor || '#F2B84B';
  const primaryText = canvasContrastColor(primary);
  const secondaryText = canvasContrastColor(secondary);
  const sellerBrand = listing.adBrand?.businessName || listing.sellerCompany || listing.sellerName || 'Marketplace seller';
  const price = `${money(listing.askingPriceExVat)} ${getAdVatLabel(listing)}`;
  const contact = `${getAdSellerName(listing)}  ·  ${getAdSellerPhone(listing)}`;
  const listingImage = listingImages[0];

  context.clearRect(0, 0, width, height);
  context.fillStyle = templateId === 'minimal' ? '#f7f8f7' : primary;
  context.fillRect(0, 0, width, height);

  if (templateId === 'duo-split') {
    context.fillStyle = '#f5f8f6';
    context.fillRect(0, 0, width, height);
    context.fillStyle = primary;
    context.fillRect(1000, 0, 600, height);

    drawAdThumbnailCell(context, listing, listingImages[0], 0, 36, 36, 928, 404);
    drawAdThumbnailCell(context, listing, listingImages[1], 1, 36, 460, 928, 404);
    drawAdLogoBadge(context, sellerLogo, 1040, 46, 470, 92, sellerBrand);
    drawBrandedAdvertDetails(context, listing, 1042, 224, 500, primaryText, accent, { compact: true });
    fillRoundedRect(context, 1040, 494, 500, 108, 18, accent);
    context.save();
    context.fillStyle = canvasContrastColor(accent);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '950 43px Montserrat, Inter, Arial, sans-serif';
    context.fillText(fitCanvasText(context, price, 454), 1290, 550);
    context.fillStyle = primaryText;
    context.font = '800 24px Montserrat, Inter, Arial, sans-serif';
    context.fillText(fitCanvasText(context, contact, 480), 1290, 690);
    context.restore();
    drawAim4priceCredit(context, 1292, 798, 244, 54, true);
    return;
  }

  if (templateId === 'gallery-three') {
    context.fillStyle = '#f3f6f4';
    context.fillRect(0, 0, width, height);
    drawAdThumbnailCell(context, listing, listingImages[0], 0, 34, 34, 930, 592);
    drawAdThumbnailCell(context, listing, listingImages[1], 1, 986, 34, 580, 286);
    drawAdThumbnailCell(context, listing, listingImages[2], 2, 986, 340, 580, 286);

    context.fillStyle = secondary;
    context.fillRect(0, 654, width, 246);
    drawAdLogoBadge(context, sellerLogo, 48, 704, 330, 86, sellerBrand);
    drawBrandedAdvertDetails(context, listing, 430, 712, 570, secondaryText, accent, { compact: true });
    fillRoundedRect(context, 1050, 702, 482, 102, 18, accent);
    context.save();
    context.fillStyle = canvasContrastColor(accent);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '950 40px Montserrat, Inter, Arial, sans-serif';
    context.fillText(fitCanvasText(context, price, 440), 1291, 754);
    context.fillStyle = secondaryText;
    context.font = '800 20px Montserrat, Inter, Arial, sans-serif';
    context.fillText(fitCanvasText(context, contact, 458), 1291, 841);
    context.restore();
    drawAim4priceCredit(context, 54, 814, 236, 52, true);
    return;
  }

  if (templateId === 'catalogue-grid') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = secondary;
    context.fillRect(0, 0, width, 136);
    drawAdLogoBadge(context, sellerLogo, 48, 27, 350, 84, sellerBrand);
    context.save();
    context.fillStyle = secondaryText;
    context.textAlign = 'right';
    context.font = '850 26px Montserrat, Inter, Arial, sans-serif';
    context.fillText('FOUR-VIEW EQUIPMENT ADVERT', 1538, 82);
    context.restore();

    const gridX = 42;
    const gridY = 166;
    const cellWidth = 435;
    const cellHeight = 321;
    const gridGap = 18;
    for (let index = 0; index < 4; index += 1) {
      drawAdThumbnailCell(
        context,
        listing,
        listingImages[index],
        index,
        gridX + (index % 2) * (cellWidth + gridGap),
        gridY + Math.floor(index / 2) * (cellHeight + gridGap),
        cellWidth,
        cellHeight,
      );
    }

    context.fillStyle = '#f5f8f6';
    context.fillRect(972, 166, 586, 678);
    drawBrandedAdvertDetails(context, listing, 1010, 224, 510, secondary, accent, { compact: true });
    fillRoundedRect(context, 1010, 490, 510, 112, 18, accent);
    context.save();
    context.fillStyle = canvasContrastColor(accent);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '950 43px Montserrat, Inter, Arial, sans-serif';
    context.fillText(fitCanvasText(context, price, 468), 1265, 548);
    context.fillStyle = secondary;
    context.font = '800 24px Montserrat, Inter, Arial, sans-serif';
    context.fillText(fitCanvasText(context, contact, 500), 1265, 700);
    context.restore();
    drawAim4priceCredit(context, 1274, 772, 244, 54);
    return;
  }

  if (templateId === 'photo-first') {
    if (listingImage) drawCoverImage(context, listingImage, 34, 34, 1532, 832, 34);
    else drawAdPlaceholder(context, listing, 34, 34, 1532, 832);

    const overlay = context.createLinearGradient(0, 470, 0, 866);
    overlay.addColorStop(0, 'rgba(0,0,0,0)');
    overlay.addColorStop(1, 'rgba(0,0,0,0.84)');
    context.fillStyle = overlay;
    context.fillRect(34, 390, 1532, 476);
    drawAdLogoBadge(context, sellerLogo, 68, 67, 310, 82, sellerBrand);

    drawBrandedAdvertDetails(context, listing, 80, 610, 920, '#ffffff', accent);
    fillRoundedRect(context, 1035, 642, 470, 112, 22, accent);
    context.save();
    context.fillStyle = canvasContrastColor(accent);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '950 44px Montserrat, Inter, Arial, sans-serif';
    context.fillText(fitCanvasText(context, price, 430), 1270, 700);
    context.fillStyle = '#ffffff';
    context.font = '800 25px Montserrat, Inter, Arial, sans-serif';
    context.fillText(fitCanvasText(context, contact, 430), 1270, 797);
    context.restore();
    drawAim4priceCredit(context, 1318, 64, 214, 52, true);
    return;
  }

  if (templateId === 'minimal') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    if (listingImage) drawCoverImage(context, listingImage, 720, 42, 838, 816, 28);
    else drawAdPlaceholder(context, listing, 720, 42, 838, 816);
    context.fillStyle = primary;
    context.fillRect(680, 0, 12, height);
    drawAdLogoBadge(context, sellerLogo, 62, 58, 326, 86, sellerBrand);
    drawBrandedAdvertDetails(context, listing, 66, 245, 550, secondary, accent, { compact: true });
    context.save();
    context.fillStyle = secondary;
    context.font = '950 55px Montserrat, Inter, Arial, sans-serif';
    context.fillText(fitCanvasText(context, money(listing.askingPriceExVat), 545), 66, 520);
    context.fillStyle = primary;
    context.font = '850 24px Montserrat, Inter, Arial, sans-serif';
    context.fillText(getAdVatLabel(listing), 68, 563);
    context.fillStyle = '#455c54';
    context.font = '800 26px Montserrat, Inter, Arial, sans-serif';
    context.fillText(fitCanvasText(context, contact, 550), 68, 680);
    context.restore();
    drawAim4priceCredit(context, 62, 794, 230, 54);
    return;
  }

  if (templateId === 'classic') {
    context.fillStyle = '#ffffff';
    context.fillRect(28, 28, width - 56, height - 56);
    context.fillStyle = primary;
    context.fillRect(28, 28, width - 56, 132);
    context.fillStyle = accent;
    context.fillRect(28, 160, width - 56, 10);
    drawAdLogoBadge(context, sellerLogo, 58, 51, 340, 86, sellerBrand);
    context.save();
    context.fillStyle = primaryText;
    context.font = '900 32px Montserrat, Inter, Arial, sans-serif';
    context.textAlign = 'right';
    context.fillText(fitCanvasText(context, sellerBrand, 760), 1515, 107);
    context.restore();
    if (listingImage) drawCoverImage(context, listingImage, 62, 207, 880, 594, 12);
    else drawAdPlaceholder(context, listing, 62, 207, 880, 594);
    drawBrandedAdvertDetails(context, listing, 990, 260, 500, secondary, accent, { compact: true });
    fillRoundedRect(context, 986, 498, 510, 106, 4, accent);
    context.save();
    context.fillStyle = canvasContrastColor(accent);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '950 41px Montserrat, Inter, Arial, sans-serif';
    context.fillText(fitCanvasText(context, price, 470), 1241, 552);
    context.fillStyle = secondary;
    context.font = '850 27px Montserrat, Inter, Arial, sans-serif';
    context.fillText(fitCanvasText(context, contact, 490), 1241, 688);
    context.restore();
    drawAim4priceCredit(context, 1260, 772, 230, 54);
    return;
  }

  // Price Focus
  context.fillStyle = '#ffffff';
  context.fillRect(30, 30, width - 60, height - 60);
  context.fillStyle = secondary;
  context.fillRect(30, 30, width - 60, 130);
  drawAdLogoBadge(context, sellerLogo, 62, 53, 320, 84, sellerBrand);
  if (listingImage) drawCoverImage(context, listingImage, 62, 194, 835, 622, 22);
  else drawAdPlaceholder(context, listing, 62, 194, 835, 622);
  fillRoundedRect(context, 940, 192, 586, 176, 22, accent);
  context.save();
  context.fillStyle = canvasContrastColor(accent);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '950 57px Montserrat, Inter, Arial, sans-serif';
  context.fillText(fitCanvasText(context, money(listing.askingPriceExVat), 530), 1233, 260);
  context.font = '850 28px Montserrat, Inter, Arial, sans-serif';
  context.fillText(getAdVatLabel(listing), 1233, 326);
  context.restore();
  drawBrandedAdvertDetails(context, listing, 962, 442, 540, secondary, accent, { compact: true, centered: true });
  context.save();
  context.fillStyle = secondary;
  context.font = '850 28px Montserrat, Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.fillText(fitCanvasText(context, contact, 530), 1233, 701);
  context.fillStyle = secondary;
  context.font = '750 18px Montserrat, Inter, Arial, sans-serif';
  context.fillText(fitCanvasText(context, getAdProvince(listing), 530), 1233, 755);
  context.restore();
  drawAim4priceCredit(context, 1278, 792, 230, 54);
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

  const imageSources = options.includeListingImage ? getListingImages(listing).slice(0, 4) : [];
  const listingImages = (
    await Promise.all(imageSources.map((imageSrc) => loadCanvasImage(imageSrc).catch(() => null)))
  ).filter((image): image is HTMLImageElement => image !== null);
  const sellerLogoImage = listing.adBrand?.logoUrl
    ? await loadCanvasImage(listing.adBrand.logoUrl).catch(() => null)
    : null;
  const width = JPEG_AD_WIDTH;
  const height = JPEG_AD_HEIGHT;
  const margin = 64;
  const frameInset = 36;
  const frameRadius = 42;
  const province = getAdProvince(listing);
  const photoX = margin;
  const photoY = 72;
  const photoWidth = 904;
  const photoHeight = 764;
  const contentX = photoX + photoWidth + 42;
  const contentY = 178;
  const contentWidth = width - margin - contentX;
  const detailGap = 16;
  const detailCardWidth = (contentWidth - detailGap) / 2;
  const detailCardHeight = 78;
  const detailCardTop = 416;
  const contactTop = 642;
  const contactHeight = 218;
  const brandPrimary = listing.adBrand?.primaryColor || '#165340';
  const brandSecondary = listing.adBrand?.secondaryColor || '#0D3329';
  const brandAccent = listing.adBrand?.accentColor || '#F2B84B';
  const templateId = listing.adBrand?.templateId || 'showcase';
  const sellerBrand = listing.adBrand?.businessName || listing.sellerCompany || listing.sellerName || 'Marketplace seller';

  if (templateId !== 'showcase') {
    drawAlternateBrandedAdCanvas(
      context,
      listing,
      templateId,
      listingImages,
      sellerLogoImage,
    );
    return;
  }

  context.clearRect(0, 0, width, height);

  const backgroundGradient = context.createLinearGradient(0, 0, width, height);
  backgroundGradient.addColorStop(0, `${brandPrimary}18`);
  backgroundGradient.addColorStop(1, `${brandSecondary}24`);
  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, width, height);

  context.save();
  context.shadowColor = 'rgba(12, 28, 24, 0.11)';
  context.shadowBlur = 30;
  context.shadowOffsetY = 18;
  fillRoundedRect(context, frameInset, frameInset, width - frameInset * 2, height - frameInset * 2, frameRadius, '#ffffff');
  context.restore();
  strokeRoundedRect(context, frameInset, frameInset, width - frameInset * 2, height - frameInset * 2, frameRadius, '#d7dde1', 2);

  context.save();
  context.fillStyle = 'rgba(13, 51, 41, 0.08)';
  fillRoundedRect(context, contentX - 22, photoY, 2, photoHeight, 1, 'rgba(13, 51, 41, 0.08)');
  context.restore();

  drawAdProvincePill(context, province, width - margin - 286, 72, 286, 58);
  drawAdImageShowcase(context, listing, listingImages, photoX, photoY, photoWidth, photoHeight);
  drawAdLogoBadge(context, sellerLogoImage, photoX + 22, photoY + 22, 300, 72, sellerBrand);

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
  context.fillStyle = brandPrimary;
  context.fillText(getAdVatLabel(listing), contentX + Math.min(contentWidth - 118, adPriceWidth + 24), contentY + 58);

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

  drawAdContactCard(context, listing, contentX + 14, contactTop, contentWidth - 14, contactHeight);
  context.fillStyle = brandAccent;
  context.fillRect(contentX, 146, Math.min(contentWidth, 190), 7);
  drawAim4priceCredit(context, width - margin - 232, height - 58, 224, 48);
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

function buildPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages]);

  if (currentPage <= 4) {
    [2, 3, 4, 5].forEach((page) => pages.add(page));
  } else if (currentPage >= totalPages - 3) {
    [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1].forEach((page) => pages.add(page));
  } else {
    [currentPage - 1, currentPage, currentPage + 1].forEach((page) => pages.add(page));
  }

  const orderedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  const items: PaginationItem[] = [];

  orderedPages.forEach((page, index) => {
    const previousPage = orderedPages[index - 1];

    if (typeof previousPage === 'number' && page - previousPage > 1) {
      items.push(previousPage === 1 ? 'ellipsis-before' : 'ellipsis-after');
    }

    items.push(page);
  });

  return items;
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

export default function MarketplaceClient({
  initialFilters,
  isSignedIn,
  accountType = 'public',
  initialListings,
  embeddedMode = false,
  showroomMode = false,
  exposeSellerContact = false,
  dealerAppMode = false,
  ownerAppMode = false,
}: MarketplaceClientProps & { dealerAppMode?: boolean; ownerAppMode?: boolean }) {
  const initialSearch = [initialFilters.brand, initialFilters.model]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ');
  const normalizedAccountType = normalize(accountType || (isSignedIn ? 'owner' : 'public'));
  const isOwnerAccount = normalizedAccountType === 'owner';
  const isDealerAccount = normalizedAccountType === 'dealer';
  const compactAppMode = dealerAppMode || ownerAppMode;
  const canExposeSellerContact = isSignedIn || exposeSellerContact;
  const valuationPath = ownerAppMode ? '/owner-app/valuation' : dealerAppMode ? '/dealer/valuation' : '/valuation';

  const [query, setQuery] = useState(initialSearch);
  const [items, setItems] = useState<MarketplaceListing[]>(initialListings ?? seedMarketplaceListings);
  const [families, setFamilies] = useState<FamilyOption[]>(FALLBACK_FAMILIES);
  const [isLoadingListings, setIsLoadingListings] = useState(!initialListings);
  const [listingLoadError, setListingLoadError] = useState('');
  const [isLoadingFamilies, setIsLoadingFamilies] = useState(true);
  const [activeListing, setActiveListing] = useState<MarketplaceListing | null>(null);
  const [manageListingTarget, setManageListingTarget] = useState<MarketplaceListing | null>(null);
  const [editListingTarget, setEditListingTarget] = useState<MarketplaceListing | null>(null);
  const [editListingDraft, setEditListingDraft] = useState<MarketplaceEditDraft | null>(null);
  const [isSavingListingEdit, setIsSavingListingEdit] = useState(false);
  const [listingEditError, setListingEditError] = useState('');
  const [deleteListingTarget, setDeleteListingTarget] = useState<MarketplaceListing | null>(null);
  const [isDeletingListing, setIsDeletingListing] = useState(false);
  const [deleteListingError, setDeleteListingError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [shareListing, setShareListing] = useState<MarketplaceListing | null>(null);
  const [shareFeedback, setShareFeedback] = useState('');
  const [isCreatingJpegAd, setIsCreatingJpegAd] = useState(false);
  const [createListingModalOpen, setCreateListingModalOpen] = useState(false);
  const [listingQueryId, setListingQueryId] = useState('');
  const [openCreatedAdFromUrl, setOpenCreatedAdFromUrl] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<SectorKey | ''>('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [dealRatingFilter, setDealRatingFilter] = useState<DealRatingFilterValue>('any');
  const [conditionFilter, setConditionFilter] = useState<ConditionFilterValue>('');
  const [locationFilter, setLocationFilter] = useState('south-africa');
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilterValue>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [dealerListingView, setDealerListingView] = useState<DealerListingView>('browse');
  const [dealerFiltersOpen, setDealerFiltersOpen] = useState(false);
  const modalDetailsRef = useRef<HTMLElement | null>(null);
  const createdAdOpenedRef = useRef('');
  const resultsAreaRef = useRef<HTMLElement | null>(null);
  const [modalScrollState, setModalScrollState] = useState({ visible: false, top: 0, height: 100 });

  useEffect(() => {
    if (showroomMode) {
      setItems(initialListings ?? []);
      setIsLoadingListings(false);
      setListingLoadError('');
      return undefined;
    }

    let mounted = true;

    async function refresh(options: { silent?: boolean } = {}) {
      if (!options.silent) {
        setIsLoadingListings(true);
        setListingLoadError('');
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
        setListingLoadError('');
      } catch {
        if (mounted) {
          if (!options.silent) {
            setItems(seedMarketplaceListings);
          }
          setListingLoadError('Live listings could not be refreshed. Showing the available catalogue listings for now.');
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
  }, [initialListings, showroomMode]);

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
      setOpenCreatedAdFromUrl(searchParams.get('createAd') === '1');
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
        motor: [],
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
      { agricultural: 0, construction: 0, industrial: 0, motor: 0 },
    );
  }, [items]);

  const listingCountsByDealRating = useMemo(() => {
    return items.reduce<Record<MarketplaceDealRating, number>>(
      (accumulator, listing) => {
        accumulator[getListingDealRating(listing)] += 1;
        return accumulator;
      },
      { low: 0, great: 0, fair: 0, high: 0, none: 0 },
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
      if (compactAppMode && dealerListingView === 'mine' && !listing.canManage) {
        return false;
      }

      if (sectorFilter && inferSectorFromListing(listing) !== sectorFilter) {
        return false;
      }

      if (familyFilter && getListingFamilyKey(listing) !== familyFilter) {
        return false;
      }

      if (conditionFilter && getListingConditionKey(listing) !== conditionFilter) {
        return false;
      }

      if (dealRatingFilter !== 'any' && getListingDealRating(listing) !== dealRatingFilter) {
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
  }, [conditionFilter, dealRatingFilter, compactAppMode, dealerListingView, distanceFilter, familyFilter, items, locationFilter, query, sectorFilter]);

  const visible = useMemo(() => sortListings(filtered), [filtered]);
  const totalPages = Math.max(1, Math.ceil(visible.length / LISTINGS_PER_PAGE));
  const normalizedCurrentPage = Math.min(currentPage, totalPages);
  const firstVisibleListingIndex = visible.length ? (normalizedCurrentPage - 1) * LISTINGS_PER_PAGE : 0;
  const firstVisibleListingNumber = visible.length ? firstVisibleListingIndex + 1 : 0;
  const lastVisibleListingNumber = Math.min(firstVisibleListingIndex + LISTINGS_PER_PAGE, visible.length);
  const visibleListings = visible.slice(firstVisibleListingIndex, lastVisibleListingNumber);
  const paginationItems = useMemo(
    () => buildPaginationItems(normalizedCurrentPage, totalPages),
    [normalizedCurrentPage, totalPages],
  );

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
    dealRatingFilter !== 'any'
      ? {
          id: 'deal-rating',
          label: `Deal rating: ${getDealRatingLabel(dealRatingFilter)}`,
          onRemove: () => setDealRatingFilter('any'),
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

  const canManageActiveListing = Boolean(activeListing?.canManage && activeListing?.sourceAssetId);

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
  }, [activeImages.length, activeListing, canManageActiveListing, canExposeSellerContact, updateModalScrollRail]);

  useEffect(() => {
    setCurrentPage(1);
  }, [conditionFilter, dealRatingFilter, dealerListingView, distanceFilter, familyFilter, locationFilter, query, sectorFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!listingQueryId) {
      return;
    }

    const matchedListing = items.find((listing) => listingMatchesReference(listing, listingQueryId));

    if (!matchedListing) {
      return;
    }

    const nextListing = getListingForCurrentViewer(matchedListing, canExposeSellerContact);

    setActiveListing(nextListing);
    setActiveImageIndex(0);
    if (openCreatedAdFromUrl && createdAdOpenedRef.current !== listingQueryId) {
      createdAdOpenedRef.current = listingQueryId;
      setShareListing(nextListing);
      setShareFeedback('Your advert is live on Marketplace. Download the JPEG or share the listing below.');
    }
  }, [canExposeSellerContact, items, listingQueryId, openCreatedAdFromUrl]);

  useEffect(() => {
    if (!activeListing) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (shareListing || manageListingTarget || editListingTarget || deleteListingTarget) {
        return;
      }

      if (event.key === 'Escape') {
        if (photoViewerOpen) {
          setPhotoViewerOpen(false);
          return;
        }
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
  }, [activeImages.length, activeListing, deleteListingTarget, editListingTarget, manageListingTarget, photoViewerOpen, shareListing]);

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

  useEffect(() => {
    if (!compactAppMode || !editListingTarget) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSavingListingEdit) {
        closeListingEditModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [compactAppMode, editListingTarget, isSavingListingEdit]);

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
    setDealRatingFilter('any');
    setConditionFilter('');
    setLocationFilter('south-africa');
    setDistanceFilter('all');
    setCurrentPage(1);
  }

  function selectDealerListingView(nextView: DealerListingView) {
    if (nextView === 'mine') {
      clearFilters();
    }

    setDealerFiltersOpen(false);
    setDealerListingView(nextView);
  }

  function scrollResultsIntoView() {
    if (typeof window === 'undefined') {
      return;
    }

    const node = resultsAreaRef.current;

    if (!node) {
      return;
    }

    const nextTop = node.getBoundingClientRect().top + window.scrollY - 120;
    window.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  }

  function goToPage(nextPage: number) {
    const boundedPage = Math.min(totalPages, Math.max(1, nextPage));

    if (boundedPage === normalizedCurrentPage) {
      return;
    }

    setCurrentPage(boundedPage);
    window.setTimeout(scrollResultsIntoView, 0);
  }

  function goToMarketplaceEstimate() {
    window.location.assign(`${valuationPath}?marketplace=1`);
  }

  function handleCreateListingClick() {
    if (!isSignedIn) {
      setCreateListingModalOpen(true);
      return;
    }

    if (isDealerAccount) {
      goToMarketplaceEstimate();
      return;
    }

    if (isOwnerAccount) {
      setCreateListingModalOpen(true);
      return;
    }

    goToMarketplaceEstimate();
  }

  function openListing(listing: MarketplaceListing) {
    setActiveListing(getListingForCurrentViewer(listing, canExposeSellerContact));
    setActiveImageIndex(0);
    setPhotoViewerOpen(false);
    updateListingUrl(listing.id);
  }

  function closeListing() {
    setActiveListing(null);
    setManageListingTarget(null);
    setEditListingTarget(null);
    setEditListingDraft(null);
    setListingEditError('');
    setDeleteListingTarget(null);
    setDeleteListingError('');
    setActiveImageIndex(0);
    setPhotoViewerOpen(false);
    updateListingUrl(null);
  }

  function openShareSheet(listing: MarketplaceListing) {
    setShareListing(getListingForCurrentViewer(listing, canExposeSellerContact));
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
      const { blob } = await createSharedMarketplaceAdJpeg(shareListing);
      downloadMarketplaceAd(blob, marketplaceAdFilename(listingDisplayTitle(shareListing)));
      setShareFeedback('JPEG ad downloaded.');
    } catch {
      setShareFeedback('JPEG ad could not be created. Please try again.');
    } finally {
      setIsCreatingJpegAd(false);
    }
  }

  function openManageListingModal() {
    if (!activeListing?.sourceAssetId || !activeListing.canManage) {
      return;
    }

    setManageListingTarget(activeListing);
    setDeleteListingError('');
  }

  function closeManageListingModal() {
    if (isDeletingListing) {
      return;
    }

    setManageListingTarget(null);
  }

  function handleEditManagedListing() {
    const listing = manageListingTarget;
    const assetId = listing?.sourceAssetId;

    if (!listing || !assetId) {
      return;
    }

    if (compactAppMode) {
      setEditListingTarget(listing);
      setEditListingDraft({
        askingPriceExVat: String(Math.round(listing.askingPriceExVat || 0)),
        description: getListingNote(listing),
        sellerName: listing.sellerName || '',
        sellerCompany: listing.sellerCompany || '',
        sellerPhone: listing.sellerPhone || '',
        sellerEmail: listing.sellerEmail || '',
        province: listing.province || '',
        area: listing.area || '',
      });
      setListingEditError('');
      setManageListingTarget(null);
      return;
    }

    const url = new URL('/asset-register', window.location.origin);
    url.searchParams.set('assetId', assetId);
    url.searchParams.set('action', 'marketplace-edit');
    window.location.assign(url.toString());
  }

  function closeListingEditModal() {
    if (isSavingListingEdit) return;
    setEditListingTarget(null);
    setEditListingDraft(null);
    setListingEditError('');
  }

  function updateListingEditDraft(updates: Partial<MarketplaceEditDraft>) {
    setEditListingDraft((current) => (current ? { ...current, ...updates } : current));
  }

  async function saveListingEdit() {
    if (!editListingTarget?.sourceAssetId || !editListingDraft || isSavingListingEdit) return;

    const askingPriceExVat = Math.round(
      Number(editListingDraft.askingPriceExVat.replace(/[^0-9.-]/g, '')) || 0,
    );
    if (askingPriceExVat <= 0) {
      setListingEditError('Enter a valid asking price excluding VAT.');
      return;
    }
    if (!editListingDraft.sellerName.trim() || !editListingDraft.sellerPhone.trim()) {
      setListingEditError('Enter the seller name and contact number.');
      return;
    }

    setIsSavingListingEdit(true);
    setListingEditError('');

    try {
      const response = await fetch('/api/marketplace', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: editListingTarget.sourceAssetId,
          askingPriceExVat,
          marketplaceNotes: editListingDraft.description.trim(),
          sellerName: editListingDraft.sellerName.trim(),
          sellerCompany: editListingDraft.sellerCompany.trim(),
          sellerPhone: editListingDraft.sellerPhone.trim(),
          sellerEmail: editListingDraft.sellerEmail.trim(),
          province: editListingDraft.province.trim(),
          area: editListingDraft.area.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        listing?: MarketplaceListing;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok || !payload.listing) {
        throw new Error(payload?.error || 'Failed to update listing.');
      }

      const updatedListing = payload.listing;
      setItems((current) =>
        current.map((item) =>
          item.sourceAssetId === updatedListing.sourceAssetId ? updatedListing : item,
        ),
      );
      setActiveListing((current) =>
        current?.sourceAssetId === updatedListing.sourceAssetId ? updatedListing : current,
      );
      setEditListingTarget(null);
      setEditListingDraft(null);
    } catch (cause) {
      setListingEditError(cause instanceof Error ? cause.message : 'Failed to update listing.');
    } finally {
      setIsSavingListingEdit(false);
    }
  }

  function openDeleteListingModal() {
    const target = manageListingTarget ?? activeListing;

    if (!target?.sourceAssetId || !target.canManage) {
      return;
    }

    setDeleteListingTarget(target);
    setManageListingTarget(null);
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
    <main className={`${styles.page} ${compactAppMode ? dealerStyles.dealerMarketplaceSurface : ''}`}>
      {!compactAppMode && !embeddedMode ? (
        <div className={styles.topBand}>
          <AppHeader active="marketplace" />
        </div>
      ) : null}

      {compactAppMode ? (
        <section className={dealerStyles.marketplaceDealerToolbar} aria-label="Dealer Marketplace controls">
          <div className={dealerStyles.marketplaceModeTabs} role="group" aria-label="Marketplace view">
            <button
              type="button"
              className={dealerListingView === 'browse' ? dealerStyles.marketplaceModeActive : ''}
              onClick={() => selectDealerListingView('browse')}
              aria-pressed={dealerListingView === 'browse'}
            >
              Browse
            </button>
            <button
              type="button"
              className={dealerListingView === 'mine' ? dealerStyles.marketplaceModeActive : ''}
              onClick={() => selectDealerListingView('mine')}
              aria-pressed={dealerListingView === 'mine'}
            >
              My listings ({items.filter((item) => item.canManage).length})
            </button>
          </div>

          <div className={dealerStyles.marketplaceQuickActions}>
            <div className={dealerStyles.marketplaceQuickSearch}>
              <span className={styles.searchIcon} aria-hidden="true"><IconSearch /></span>
              <input
                value={query}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
                placeholder="Search Marketplace"
                aria-label="Search Marketplace"
              />
              {query ? (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><IconClose /></button>
              ) : null}
            </div>
            <button
              type="button"
              className={dealerStyles.marketplaceFilterButton}
              onClick={() => setDealerFiltersOpen((current) => !current)}
              aria-expanded={dealerFiltersOpen}
              aria-controls="mobile-marketplace-filters"
            >
              {dealerFiltersOpen ? 'Close filters' : 'Filters'}
            </button>
            <button type="button" className={dealerStyles.marketplaceCreateButton} onClick={handleCreateListingClick}>
              + New listing
            </button>
          </div>
        </section>
      ) : null}

      {compactAppMode && (isLoadingListings || listingLoadError) ? (
        <div
          className={`${dealerStyles.marketplaceLoadStatus} ${listingLoadError ? dealerStyles.marketplaceLoadStatusError : ''}`}
          role={listingLoadError ? 'alert' : 'status'}
          aria-live={listingLoadError ? 'assertive' : 'polite'}
        >
          {isLoadingListings ? 'Loading listings…' : listingLoadError}
        </div>
      ) : null}

      <div className={styles.marketplaceShell}>
        <aside
          id={compactAppMode ? 'mobile-marketplace-filters' : undefined}
          className={`${styles.sidebar} ${compactAppMode ? dealerStyles.dealerMarketplaceSidebar : ''} ${dealerFiltersOpen ? dealerStyles.dealerMarketplaceSidebarOpen : ''}`}
          aria-label="Marketplace filters"
        >
          {compactAppMode ? (
            <button type="button" className={dealerStyles.marketplaceCloseFilters} onClick={() => setDealerFiltersOpen(false)}>
              Close filters
            </button>
          ) : null}
          {!compactAppMode ? (
            <>
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

              {!showroomMode ? (
                <button type="button" className={styles.createButton} onClick={handleCreateListingClick}>
                  <span className={styles.createIcon} aria-hidden="true">
                    <IconPlus />
                  </span>
                  Create new listing
                </button>
              ) : null}
              <div className={styles.sidebarDivider} />
            </>
          ) : null}

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
              <h2>Deal rating</h2>
            </div>

            <div className={styles.ratingFilterList}>
              <button
                type="button"
                className={`${styles.ratingFilterButton} ${dealRatingFilter === 'any' ? styles.ratingFilterButtonActive : ''}`}
                onClick={() => setDealRatingFilter('any')}
                aria-pressed={dealRatingFilter === 'any'}
              >
                <span className={styles.ratingFilterCheck} aria-hidden="true" />
                <strong className={styles.ratingFilterAnyLabel}>Any</strong>
              </button>

              {DEAL_RATING_OPTIONS.map((option) => {
                const isActive = dealRatingFilter === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.ratingFilterButton} ${isActive ? styles.ratingFilterButtonActive : ''}`}
                    onClick={() => setDealRatingFilter(option.value)}
                    aria-pressed={isActive}
                  >
                    <span className={styles.ratingFilterCheck} aria-hidden="true" />
                    <span className={`${styles.ratingFilterPill} ${getDealRatingToneClass(option.value)}`}>
                      {option.label}
                    </span>
                    <small className={styles.ratingFilterCount}>{listingCountsByDealRating[option.value].toLocaleString('en-ZA')}</small>
                  </button>
                );
              })}
            </div>
          </section>

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

        <section ref={resultsAreaRef} className={styles.resultsArea}>
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
                      <DealRatingBadge listing={listing} />
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
              <h2>{compactAppMode && dealerListingView === 'mine' ? 'No live listings yet' : 'No listings found'}</h2>
              <p>
                {compactAppMode && dealerListingView === 'mine'
                  ? 'Create a listing from Valuation.'
                  : 'Try another search, category, condition or location.'}
              </p>
              <button type="button" onClick={clearFilters}>
                Reset marketplace
              </button>
            </article>
          )}

          {visible.length > 0 ? (
            <div className={styles.paginationWrap}>
              <p className={styles.paginationSummary}>
                Showing {firstVisibleListingNumber}-{lastVisibleListingNumber} of {visible.length} listings
                {totalPages > 1 ? ` · Page ${normalizedCurrentPage} of ${totalPages}` : ''}
              </p>

              {totalPages > 1 ? (
                <nav className={styles.paginationControls} aria-label="Marketplace listing pages">
                  <button
                    type="button"
                    className={styles.paginationButton}
                    onClick={() => goToPage(normalizedCurrentPage - 1)}
                    disabled={normalizedCurrentPage === 1}
                  >
                    <IconChevronLeft />
                    Previous
                  </button>

                  {paginationItems.map((item) =>
                    typeof item === 'number' ? (
                      <button
                        key={item}
                        type="button"
                        className={`${styles.paginationButton} ${item === normalizedCurrentPage ? styles.paginationButtonActive : ''}`}
                        onClick={() => goToPage(item)}
                        aria-current={item === normalizedCurrentPage ? 'page' : undefined}
                      >
                        {item}
                      </button>
                    ) : (
                      <span key={item} className={styles.paginationEllipsis} aria-hidden="true">
                        …
                      </span>
                    ),
                  )}

                  <button
                    type="button"
                    className={styles.paginationButton}
                    onClick={() => goToPage(normalizedCurrentPage + 1)}
                    disabled={normalizedCurrentPage === totalPages}
                  >
                    Next
                    <IconChevronRight />
                  </button>
                </nav>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      {createListingModalOpen ? (
        <div className={styles.createListingOverlay} onClick={() => setCreateListingModalOpen(false)}>
          <div
            className={styles.createListingDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-listing-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.createListingCloseButton}
              onClick={() => setCreateListingModalOpen(false)}
              aria-label="Close create listing options"
            >
              <IconClose />
            </button>

            {!isSignedIn ? (
              <>
                <div className={styles.createListingHeader}>
                  <h2 id="create-listing-title">Create marketplace listing</h2>
                  <p>
                    Marketplace listings must be tied to a seller profile. You can browse listings as a guest, but you need
                    an account before you can create or publish a listing.
                  </p>
                </div>

                <div className={styles.createListingGuestPanel}>
                  <strong>Seller information stays protected until account creation.</strong>
                  <span>
                    Create an account to publish from an Aim4price estimate, or contact{' '}
                    <span className={styles.marketplaceContactNoWrap}>{DEFAULT_MARKETPLACE_CONTACT_DISPLAY}</span>.
                  </span>
                </div>

                <div className={styles.createListingActionRow}>
                  <a href="/auth#signup" className={styles.createListingPrimaryAction}>
                    Create account
                  </a>
                  <a href={`tel:${DEFAULT_MARKETPLACE_CONTACT_TEL}`} className={styles.createListingSecondaryAction}>
                    Contact Kuyler
                  </a>
                </div>
              </>
            ) : (
              <>
                <div className={styles.createListingHeader}>
                  <h2 id="create-listing-title">Create marketplace listing</h2>
                </div>

                <div className={styles.createListingChoiceGrid}>
                  <a href={ownerAppMode ? '/owner-app/assets' : '/asset-register'} className={styles.createListingChoiceCard}>
                    <span className={styles.createListingChoiceIcon} aria-hidden="true">
                      <IconAssetRegister />
                    </span>
                    <strong>Asset Register</strong>
                  </a>
                  <button type="button" className={styles.createListingChoiceCard} onClick={goToMarketplaceEstimate}>
                    <span className={styles.createListingChoiceIcon} aria-hidden="true">
                      <IconEstimate />
                    </span>
                    <strong>Estimate</strong>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

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
                  <button
                    type="button"
                    className={styles.modalImageOpenButton}
                    onClick={() => setPhotoViewerOpen(true)}
                    aria-label={`Open ${listingDisplayTitle(activeListing)} photo full screen`}
                  >
                    <ListingImage
                      src={activeImages[activeImageIndex]}
                      listing={activeListing}
                      alt={listingDisplayTitle(activeListing)}
                      className={styles.modalImage}
                      variant="modal"
                    />
                  </button>
                ) : (
                  <ListingPlaceholder listing={activeListing} variant="modal" />
                )}

                <DealRatingBadge listing={activeListing} variant="modal" />

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

                {canExposeSellerContact ? (
                  <div className={styles.contactRows}>
                    <div className={styles.contactRow}>
                      <span>Seller</span>
                      <strong>{activeListing.sellerName || DEFAULT_MARKETPLACE_CONTACT_NAME}</strong>
                    </div>
                    {activeListing.sellerCompany ? (
                      <div className={styles.contactRow}>
                        <span>Company</span>
                        <strong>{activeListing.sellerCompany}</strong>
                      </div>
                    ) : null}
                    <div className={styles.contactRow}>
                      <span>Phone</span>
                      <strong>
                        <a
                          href={`tel:${activeListing.sellerPhone || DEFAULT_MARKETPLACE_CONTACT_PHONE}`}
                          className={styles.marketplaceContactNoWrap}
                        >
                          {activeListing.sellerPhone || DEFAULT_MARKETPLACE_CONTACT_PHONE}
                        </a>
                      </strong>
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
                        <strong>Seller information</strong>
                      </div>
                      <div className={styles.contactRow}>
                        <span>Company</span>
                        <strong>Marketplace seller</strong>
                      </div>
                      <div className={styles.contactRow}>
                        <span>Phone</span>
                        <strong>000 000 0000</strong>
                      </div>
                      <div className={styles.contactRow}>
                        <span>Email</span>
                        <strong>seller@example.com</strong>
                      </div>
                    </div>
                    <div className={styles.contactBlurOverlay}>
                      <strong>Seller information is blocked.</strong>
                      <p>
                        Create an account or contact{' '}
                        <span className={styles.marketplaceContactNoWrap}>{DEFAULT_MARKETPLACE_CONTACT_DISPLAY}</span>.
                      </p>
                      <div className={styles.lockedActions}>
                        <a href="/auth#signup">Create account</a>
                        <a href={`tel:${DEFAULT_MARKETPLACE_CONTACT_TEL}`}>Contact Kuyler</a>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {canManageActiveListing ? (
                <section className={styles.ownerActions}>
                  <div>
                    <h3>Your listing</h3>
                    <p>Manage this marketplace listing</p>
                  </div>
                  <button type="button" onClick={openManageListingModal}>
                    Manage
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

      {photoViewerOpen && activeListing && activeImages.length ? (
        <div className={styles.marketplacePhotoViewer} role="dialog" aria-modal="true" aria-label={`${listingDisplayTitle(activeListing)} photo viewer`}>
          <button type="button" className={styles.marketplacePhotoViewerBackdrop} onClick={() => setPhotoViewerOpen(false)} aria-label="Close photo viewer" />
          <div className={styles.marketplacePhotoViewerCard}>
            <button type="button" className={styles.marketplacePhotoViewerClose} onClick={() => setPhotoViewerOpen(false)} aria-label="Close photo viewer">
              <IconClose />
            </button>
            <ListingImage
              src={activeImages[activeImageIndex]}
              listing={activeListing}
              alt={`${listingDisplayTitle(activeListing)} enlarged photo ${activeImageIndex + 1}`}
              className={styles.marketplacePhotoViewerImage}
              variant="modal"
            />
            {activeImages.length > 1 ? (
              <>
                <button type="button" className={`${styles.marketplacePhotoViewerNav} ${styles.marketplacePhotoViewerPrevious}`} onClick={showPreviousImage} aria-label="Previous photo">
                  <IconChevronLeft />
                </button>
                <button type="button" className={`${styles.marketplacePhotoViewerNav} ${styles.marketplacePhotoViewerNext}`} onClick={showNextImage} aria-label="Next photo">
                  <IconChevronRight />
                </button>
              </>
            ) : null}
            <span className={styles.marketplacePhotoViewerCounter}>{activeImageIndex + 1} / {activeImages.length}</span>
          </div>
        </div>
      ) : null}

      {manageListingTarget ? (
        <div className={styles.marketplaceManageBackdrop} onClick={closeManageListingModal}>
          <div
            className={styles.marketplaceManageModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketplace-manage-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.marketplaceManageCloseButton}
              onClick={closeManageListingModal}
              aria-label="Close marketplace listing manager"
            >
              <IconClose />
            </button>

            <div className={styles.marketplaceManageHeader}>
              <h3 id="marketplace-manage-title">Manage marketplace listing</h3>
            </div>

            <div className={styles.marketplaceManageSummary}>
              <span>Selected listing</span>
              <strong>{listingDisplayTitle(manageListingTarget)}</strong>
              <small>{money(manageListingTarget.askingPriceExVat)} excl. VAT · {formatLocation(manageListingTarget)}</small>
            </div>

            <div className={styles.marketplaceManageChoiceGrid}>
              <button type="button" className={styles.marketplaceManageChoiceCard} onClick={handleEditManagedListing}>
                <span className={styles.marketplaceManageChoiceIcon} aria-hidden="true">
                  <IconPencil />
                </span>
                <strong>Edit</strong>
              </button>

              <button
                type="button"
                className={`${styles.marketplaceManageChoiceCard} ${styles.marketplaceManageDeleteChoice}`}
                onClick={openDeleteListingModal}
              >
                <span className={styles.marketplaceManageChoiceIcon} aria-hidden="true">
                  <IconTrash />
                </span>
                <strong>Delete</strong>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editListingTarget && editListingDraft ? (
        <div className={dealerStyles.editListingOverlay} onMouseDown={closeListingEditModal}>
          <section
            className={dealerStyles.editListingModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dealer-listing-edit-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={dealerStyles.editListingHeader}>
              <div>
                <span>Edit listing</span>
                <h2 id="dealer-listing-edit-title">{listingDisplayTitle(editListingTarget)}</h2>
              </div>
              <button type="button" onClick={closeListingEditModal} disabled={isSavingListingEdit} aria-label="Close listing editor">×</button>
            </header>

            <div className={dealerStyles.editListingBody}>
              <label className={dealerStyles.editListingField}>
                <span>Asking price excluding VAT</span>
                <GroupedCurrencyInput value={editListingDraft.askingPriceExVat} onValueChange={(value) => updateListingEditDraft({ askingPriceExVat: value })} />
              </label>
              <label className={dealerStyles.editListingField}>
                <span>Description</span>
                <textarea rows={4} value={editListingDraft.description} onChange={(event) => updateListingEditDraft({ description: event.target.value })} />
              </label>
              <div className={dealerStyles.editListingGrid}>
                <label className={dealerStyles.editListingField}>
                  <span>Contact name</span>
                  <input value={editListingDraft.sellerName} onChange={(event) => updateListingEditDraft({ sellerName: event.target.value })} />
                </label>
                <label className={dealerStyles.editListingField}>
                  <span>Contact number</span>
                  <input value={editListingDraft.sellerPhone} onChange={(event) => updateListingEditDraft({ sellerPhone: event.target.value })} />
                </label>
                <label className={dealerStyles.editListingField}>
                  <span>Business</span>
                  <input value={editListingDraft.sellerCompany} onChange={(event) => updateListingEditDraft({ sellerCompany: event.target.value })} />
                </label>
                <label className={dealerStyles.editListingField}>
                  <span>Email</span>
                  <input type="email" value={editListingDraft.sellerEmail} onChange={(event) => updateListingEditDraft({ sellerEmail: event.target.value })} />
                </label>
                <label className={dealerStyles.editListingField}>
                  <span>Province</span>
                  <input value={editListingDraft.province} onChange={(event) => updateListingEditDraft({ province: event.target.value })} />
                </label>
                <label className={dealerStyles.editListingField}>
                  <span>Area</span>
                  <input value={editListingDraft.area} onChange={(event) => updateListingEditDraft({ area: event.target.value })} />
                </label>
              </div>
              {listingEditError ? <p className={dealerStyles.editListingError} role="alert">{listingEditError}</p> : null}
            </div>

            <footer className={dealerStyles.editListingActions}>
              <button type="button" onClick={closeListingEditModal} disabled={isSavingListingEdit}>Cancel</button>
              <button type="button" className={dealerStyles.editListingSave} onClick={() => void saveListingEdit()} disabled={isSavingListingEdit}>
                {isSavingListingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </footer>
          </section>
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
                <p id="marketplace-delete-copy">
                  {compactAppMode
                    ? 'This removes the listing from the Marketplace.'
                    : 'This removes the listing from the marketplace. The asset stays saved in your Asset Register.'}
                </p>
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

            <div className={styles.shareDialogScroll}>
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
        </div>
      ) : null}
    </main>
  );
}
