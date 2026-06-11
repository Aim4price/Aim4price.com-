'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import {
  openAssetRegisterSummaryPrint,
  openAssetSheetPrint,
  type ReportKeyValue,
  type ReportMethodCard,
} from '../../lib/report-print';
import styles from './page.module.css';

type NoticeTone = 'success' | 'error';
type PartnerType = 'dealer' | 'finance' | 'insurance';
type AssetLeadType = 'finance' | 'insurance' | 'replacement_quote';
type QuoteLeadStep = 'message' | 'consent' | null;
type QuoteScope = 'asset' | 'register';

type PartnerDirectoryEntry = {
  userId: string;
  partnerType: PartnerType;
  displayName: string;
  businessName: string;
  phone: string;
  email: string;
  province: string;
  townCity: string;
  addressLine1: string;
  logoUrl: string;
  websiteUrl: string;
  extraPhotoUrls: string[];
  description: string;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusKm: number | null;
  brandFocus: string;
  services: string;
};

type PartnerDirectoryApiResponse = {
  ok: boolean;
  partners?: PartnerDirectoryEntry[];
  error?: string;
};

type AssetLeadApiResponse = {
  ok: boolean;
  lead?: unknown;
  error?: string;
};

type AssetQuoteOption = {
  leadType: AssetLeadType;
  partnerType: PartnerType;
  title: string;
  shortTitle: string;
  descriptionLines: readonly [string, string];
  mapTitle: string;
  sendLabel: string;
  emptyPartnerText: string;
};

declare global {
  interface Window {
    L?: any;
  }
}

const REGISTER_SUMMARY_VISIBLE_CARD_COUNT = 3;
const REGISTER_SUMMARY_TOTAL_CARD_COUNT = 8;

function getRegisterSummaryCardsPerView(): number {
  if (typeof window === 'undefined') return REGISTER_SUMMARY_VISIBLE_CARD_COUNT;
  if (window.innerWidth <= 760) return 1;
  if (window.innerWidth <= 1180) return 2;
  return REGISTER_SUMMARY_VISIBLE_CARD_COUNT;
}

type AssetKind = 'tractor' | 'equipment' | 'manual' | 'property' | 'vehicle' | 'tools';
type AssetMethod = 'aim4price' | 'market' | 'manual';
type RevalueMethod = Exclude<AssetMethod, 'manual'>;
type ConditionKey = 'excellent' | 'good' | 'fair' | 'used' | 'serious';
type AssetConditionValue = ConditionKey | '';
type UsageMetric = 'hours' | 'km';
type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';
type ManualAssetStep = 1 | 2 | 3 | 4;
type ExportFormat = 'pdf' | 'xlsx';
type ExportStep = 'format' | 'pdf-report';
type PdfReportKind = 'full' | 'financed' | 'insured' | 'licensed' | 'not-financed' | 'not-insured' | 'not-licensed';
type AssetPdfReportKind = 'fuel' | 'maintenance';
type AssetReportFormat = 'pdf' | 'xlsx';
type AssetReportSelectKey = 'type' | 'year' | 'month';
type AssetReportStep = 'options' | 'fuel-filter' | 'maintenance-filter';

type AssetPdfReportFilters = {
  year?: string;
  month?: string;
  maintenanceType?: string;
};

type ReportSelectOption = {
  value: string;
  label: string;
};

type ReportSelectProps = {
  label: string;
  value: string;
  options: ReportSelectOption[];
  isOpen: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
};

type PdfReportOption = {
  value: PdfReportKind;
  label: string;
  description: string;
  intro: string;
  sectionTitle: string;
  emptyLabel: string;
};

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const PDF_REPORT_OPTIONS: PdfReportOption[] = [
  {
    value: 'full',
    label: 'Full Asset Register',
    description: 'All saved register assets with full register totals.',
    intro: 'Complete saved asset register snapshot.',
    sectionTitle: 'Asset Register',
    emptyLabel: 'No saved assets are currently available for this report.',
  },
  {
    value: 'financed',
    label: 'Financed',
    description: 'Only assets marked as financed.',
    intro: 'Filtered asset register snapshot showing only financed assets.',
    sectionTitle: 'Financed Assets',
    emptyLabel: 'No financed assets are currently saved in this register.',
  },
  {
    value: 'insured',
    label: 'Insured',
    description: 'Only assets marked as insured.',
    intro: 'Filtered asset register snapshot showing only insured assets.',
    sectionTitle: 'Insured Assets',
    emptyLabel: 'No insured assets are currently saved in this register.',
  },
  {
    value: 'licensed',
    label: 'Licensed',
    description: 'Only assets marked as licensed.',
    intro: 'Filtered asset register snapshot showing only licensed assets.',
    sectionTitle: 'Licensed Assets',
    emptyLabel: 'No licensed assets are currently saved in this register.',
  },
  {
    value: 'not-financed',
    label: 'Not Financed',
    description: 'Only assets not marked as financed.',
    intro: 'Filtered asset register snapshot showing only assets not marked as financed.',
    sectionTitle: 'Not Financed Assets',
    emptyLabel: 'No assets without finance are currently saved in this register.',
  },
  {
    value: 'not-insured',
    label: 'Not Insured',
    description: 'Only assets not marked as insured.',
    intro: 'Filtered asset register snapshot showing only assets not marked as insured.',
    sectionTitle: 'Not Insured Assets',
    emptyLabel: 'No assets without insurance are currently saved in this register.',
  },
  {
    value: 'not-licensed',
    label: 'Not Licensed',
    description: 'Only assets not marked as licensed.',
    intro: 'Filtered asset register snapshot showing only assets not marked as licensed.',
    sectionTitle: 'Not Licensed Assets',
    emptyLabel: 'No assets without licensing are currently saved in this register.',
  },
];
type AssetFilterKey =
  | 'all'
  | 'insured'
  | 'not-insured'
  | 'financed'
  | 'not-financed'
  | 'licensed'
  | 'not-licensed'
  | 'highest-value'
  | 'lowest-value'
  | 'highest-replacement-price'
  | 'lowest-replacement-price'
  | 'aim4price-value'
  | 'manual-value'
  | 'marketplace';

type AssetDocument = {
  id: string;
  url: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  uploadedAtIso: string;
};

type OpenPartnerNoteAttachment = {
  fileName: string;
  contentType: string;
  byteSize: number;
  url: string;
};

type LatestMaintenanceStatus = {
  id: string;
  assetRegisterItemId: string;
  kind: 'checked' | 'serviced' | 'repaired';
  summary: string;
  note: string;
  operatorName: string;
  createdAtIso: string;
  notedAtIso: string | null;
};

type OpenPartnerNote = {
  id: string;
  ownerUserId: string;
  partnerUserId: string;
  assetRegisterItemId: string;
  noteText: string;
  status: 'open' | 'noted';
  partnerType?: PartnerType | null;
  partnerName: string;
  partnerBusinessName: string;
  attachment?: OpenPartnerNoteAttachment | null;
  createdAtIso: string;
  notedAtIso: string | null;
  updatedAtIso: string;
};

type RegisterAsset = {
  id: string;
  userId: string;
  registerId: string | null;
  valuationRunId: number | null;
  sectorId: number | null;
  equipmentFamilyId: number | null;
  equipmentFamilyKey: string;
  equipmentFamilyLabel: string;
  equipmentModelId: number | null;
  typedModelName: string;
  normalizedTypedModelName: string;
  specsJson: Record<string, unknown>;
  depreciationMethodUsed: string;
  lifeWorkedPercent: number | null;
  lifeRemainingPercent: number | null;
  estimatedHours: number | null;
  maxLifetimeHours: number | null;
  kind: AssetKind;
  title: string;
  value: number;
  selectedMethod: AssetMethod;
  selectedValueExVat: number;
  replacementPriceExVat: number | null;
  brandName: string;
  modelName: string;
  drive: string;
  tractorType: string;
  cab: string;
  powerKw: number | null;
  yearModel: number | null;
  hours: number | null;
  condition: AssetConditionValue;
  aim4priceValueExVat: number | null;
  marketMidExVat: number | null;
  note: string;
  serialNumber: string;
  isFinanced: boolean;
  isInsured: boolean;
  isLicensed: boolean;
  licenseRegistrationNumber: string;
  financeNote: string;
  sellerPhone: string;
  marketplaceNotes: string;
  marketplaceStatus: string;
  photos: string[];
  documents: AssetDocument[];
  publicAssetCode: string;
  plateLabel: string;
  qrStatus: string;
  lastScannedAtIso: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastKnownLocationText: string;
  fuelPercent: number | null;
  createdAtIso: string;
  updatedAtIso: string;
  openPartnerNote?: OpenPartnerNote | null;
  partnerNotes?: OpenPartnerNote[];
  latestMaintenanceStatus?: LatestMaintenanceStatus | null;
};

type AssetRegisterSummary = {
  id: string;
  userId: string;
  businessName: string;
  email: string;
  phone: string;
  addressLine1: string;
  logoUrls?: string[];
  showLogosOnRegister?: boolean;
  isPrimary: boolean;
  isSelected: boolean;
  assetCount: number;
  totalValue: number;
  totalReplacementPrice: number;
  createdAtIso: string;
  updatedAtIso: string;
};

type AssetRegisterApiResponse = {
  ok: boolean;
  items?: RegisterAsset[];
  assets?: RegisterAsset[];
  register?: AssetRegisterSummary;
  registers?: AssetRegisterSummary[];
  profile?: AccountProfile;
  summary?: {
    count: number;
    totalValue: number;
  };
  item?: RegisterAsset;
  note?: OpenPartnerNote;
  error?: string;
};

type UploadedAssetFile = {
  uploadId: string;
  url: string;
  fileName: string;
  contentType: string;
  byteSize: number;
};

type AssetUploadApiResponse = {
  ok: boolean;
  uploads?: UploadedAssetFile[];
  error?: string;
};

type DetailMediaUploadType = 'photo' | 'document';

type DetailMediaUploadState = {
  assetId: string;
  type: DetailMediaUploadType;
} | null;

type MarketplaceApiResponse = {
  ok: boolean;
  assetId?: string;
  marketplaceStatus?: string;
  listing?: {
    id?: string | number | null;
    sourceAssetId?: string | number | null;
  } | null;
  note?: OpenPartnerNote | null;
  error?: string;
};

type AccountProfile = {
  userId: string;
  name: string;
  displayName?: string;
  email: string;
  logoUrl?: string;
  businessName: string;
  phone: string;
  accountType: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
  marketplaceSellerName?: string;
  marketplacePhone?: string;
  marketplaceEmail?: string;
  marketplaceLocation?: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

type AccountProfileApiResponse = {
  ok: boolean;
  profile?: AccountProfile;
  error?: string;
};

type ProjectionSnapshot = {
  retailExVat: number;
  hours: number;
  tractorExVat: number;
  loaderExVat: number;
  gpsExVat: number;
};

type AssetFutureProjection = {
  assetId: string;
  assetTitle: string;
  selectedMethod: AssetMethod;
  currentRegisterValueExVat: number;
  baseYear: number;
  targetYear: number;
  inflationRatePct: number;
  yearsForward: number;
  extraHours: number;
  condition: ConditionKey;
  current: ProjectionSnapshot;
  projected: ProjectionSnapshot;
};

type ProjectionApiResponse = {
  ok: boolean;
  projection?: AssetFutureProjection;
  error?: string;
};

type PricingMarketSource = {
  id: string | number;
  title: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  advertisedPriceExVat?: number | null;
  priceExVat?: number | null;
  askingPriceExVat?: number | null;
  price?: number | null;
  yearModel?: number | null;
  year?: number | null;
  hours?: number | null;
  usageAmount?: number | null;
  location?: string | null;
  province?: string | null;
  area?: string | null;
  condition?: string | null;
  matchReason?: string | null;
  dateAdvertised?: string | null;
};

type RevalueAssetApiResponse = {
  ok: boolean;
  item?: RegisterAsset;
  valuationRunId?: number;
  selectedMethod?: AssetMethod;
  oldValueExVat?: number;
  newValueExVat?: number;
  warning?: string;
  previewOnly?: boolean;
  marketAverageExVat?: number | null;
  marketLowExVat?: number | null;
  marketHighExVat?: number | null;
  marketCount?: number;
  marketSources?: PricingMarketSource[];
  marketMatchStrategy?: string;
  error?: string;
};

type PricingRevaluePreview = {
  asset: RegisterAsset;
  method: RevalueMethod;
  result: RevalueAssetApiResponse | null;
  error: string | null;
};

type MarketplacePublishDraft = {
  sellerName: string;
  sellerCompany: string;
  sellerPhone: string;
  sellerEmail: string;
  province: string;
  area: string;
  askingPriceExVat: string;
  description: string;
};

type AssetDraft = {
  kind: AssetKind;
  title: string;
  value: string;
  replacementPrice: string;
  note: string;
  serialNumber: string;
  isFinanced: boolean;
  isInsured: boolean;
  isLicensed: boolean;
  financeStatus: AssetStatusChoice;
  insuranceStatus: AssetStatusChoice;
  licenseStatus: AssetStatusChoice;
  licenseRegistrationNumber: string;
  financeNote: string;
  insuranceNote: string;
  photos: string[];
  documents: AssetDocument[];
  yearModel: string;
  hours: string;
  usageMetric: UsageMetric;
  lifeWorkedPercent: string;
  condition: AssetConditionValue;
};

type PendingPhotoFile = {
  id: string;
  file: File;
  previewUrl: string;
};

type MainPhotoSelection =
  | { source: 'saved'; url: string }
  | { source: 'pending'; id: string };

type DraftPhotoItem = {
  key: string;
  source: 'saved' | 'pending';
  label: string;
  previewUrl: string;
  url?: string;
  pendingId?: string;
  isMain: boolean;
};

type ProjectionFormState = {
  targetYear: string;
  inflationRatePct: string;
  extraHours: string;
};

type PageItem = number | 'ellipsis';

type IconProps = {
  className?: string;
};

const MAX_PHOTOS = 12;
const MAX_DOCUMENTS = 20;
const PAGE_SIZE = 6;
const FALLBACK_ASSET_IMAGE = '/brand/Tractor.png';
const MANUAL_ASSET_TYPE_OPTIONS: Array<{
  value: Extract<AssetKind, 'vehicle' | 'tools' | 'property' | 'equipment' | 'manual'>;
  label: string;
  description: string;
  titlePlaceholder: string;
}> = [
  {
    value: 'equipment',
    label: 'Equipment',
    description: 'General machines and larger equipment not added through valuation.',
    titlePlaceholder: 'Example: Water pump trailer',
  },
  {
    value: 'vehicle',
    label: 'Vehicle',
    description: 'Bakkies, trucks, trailers and other road or farm vehicles.',
    titlePlaceholder: 'Example: Toyota Hilux farm bakkie',
  },
  {
    value: 'property',
    label: 'Property/Buildings',
    description: 'Buildings, sheds, houses, stores and fixed improvements.',
    titlePlaceholder: 'Example: Main workshop building',
  },
  {
    value: 'tools',
    label: 'Tools',
    description: 'Smaller tools, workshop items and handheld equipment.',
    titlePlaceholder: 'Example: Workshop tool set',
  },
  {
    value: 'manual',
    label: 'Other',
    description: 'Any asset that does not fit the standard equipment, vehicle, property or tools groups.',
    titlePlaceholder: 'Example: Irrigation rights, livestock equipment or custom asset',
  },
];

const FINANCE_STATUS_OPTIONS: Array<{ value: AssetStatusChoice; label: string; description: string }> = [
  { value: 'yes', label: 'Is financed', description: 'This asset has active finance or a lender linked to it.' },
  { value: 'no', label: 'Is not financed', description: 'This asset is fully owned and has no finance balance.' },
  { value: 'not_applicable', label: 'Not applicable', description: 'Finance status does not apply to this asset.' },
  { value: 'unknown', label: 'Not sure', description: 'You can confirm the finance status later.' },
];

const INSURANCE_STATUS_OPTIONS: Array<{ value: AssetStatusChoice; label: string; description: string }> = [
  { value: 'yes', label: 'Is insured', description: 'This asset is covered on an insurance policy.' },
  { value: 'no', label: 'Is not insured', description: 'This asset is not currently insured.' },
  { value: 'not_applicable', label: 'Not applicable', description: 'Insurance status does not apply to this asset.' },
  { value: 'unknown', label: 'Not sure', description: 'You can confirm the insurance status later.' },
];

const LICENSE_STATUS_OPTIONS: Array<{ value: AssetStatusChoice; label: string; description: string }> = [
  { value: 'yes', label: 'Is licensed', description: 'This asset has an active licence or road-use registration.' },
  { value: 'no', label: 'Is not licensed', description: 'This asset is not currently licensed.' },
  { value: 'not_applicable', label: 'Not applicable', description: 'Licensing does not apply to this asset.' },
  { value: 'unknown', label: 'Not sure', description: 'You can confirm the licence status later.' },
];

const MANUAL_FORM_STEPS: Array<{ step: ManualAssetStep; label: string }> = [
  { step: 1, label: 'Equipment type' },
  { step: 2, label: 'Details' },
  { step: 3, label: 'Status' },
  { step: 4, label: 'Documents' },
];

const CONDITION_OPTIONS: Array<{ value: AssetConditionValue; label: string }> = [
  { value: '', label: 'Select condition' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'used', label: 'Used' },
  { value: 'serious', label: 'Requires attention' },
];

const ASSET_FILTER_OPTIONS: Array<{ value: AssetFilterKey; label: string }> = [
  { value: 'all', label: 'All assets' },
  { value: 'insured', label: 'Insured' },
  { value: 'not-insured', label: 'Not insured' },
  { value: 'financed', label: 'Financed' },
  { value: 'not-financed', label: 'Not financed' },
  { value: 'licensed', label: 'Licensed' },
  { value: 'not-licensed', label: 'Not licensed' },
  { value: 'highest-value', label: 'Highest current value' },
  { value: 'lowest-value', label: 'Lowest current value' },
  { value: 'highest-replacement-price', label: 'Highest replacement price' },
  { value: 'lowest-replacement-price', label: 'Lowest replacement price' },
  { value: 'aim4price-value', label: 'Aim4price value' },
  { value: 'manual-value', label: 'Manual value' },
  { value: 'marketplace', label: 'Marketplace' },
];

const LEAFLET_SCRIPT_ID = 'aim4price-leaflet-script';
const LEAFLET_CSS_ID = 'aim4price-leaflet-css';
const DEFAULT_PARTNER_MAP_CENTER: [number, number] = [-29, 24];
const DEFAULT_PARTNER_MAP_ZOOM = 5;

let leafletLoaderPromise: Promise<any> | null = null;

const ASSET_QUOTE_OPTIONS: AssetQuoteOption[] = [
  {
    leadType: 'finance',
    partnerType: 'finance',
    title: 'Get finance offer',
    shortTitle: 'Finance offer',
    descriptionLines: ['Send this asset to a finance provider.', 'Request finance or refinance.'],
    mapTitle: 'Choose a finance provider.',
    sendLabel: 'Send finance request',
    emptyPartnerText: 'No listed finance providers found yet. Finance accounts must enable their directory listing under Account details.',
  },
  {
    leadType: 'insurance',
    partnerType: 'insurance',
    title: 'Get insurance quote',
    shortTitle: 'Insurance quote',
    descriptionLines: ['Send this asset to an insurer or broker.', 'Request cover or value review.'],
    mapTitle: 'Choose an insurer or broker.',
    sendLabel: 'Send insurance request',
    emptyPartnerText: 'No listed insurers or brokers found yet. Insurance accounts must enable their directory listing under Account details.',
  },
  {
    leadType: 'replacement_quote',
    partnerType: 'dealer',
    title: 'Get replacement quote',
    shortTitle: 'Replacement quote',
    descriptionLines: ['Send this asset to a dealer.', 'Request a quote.'],
    mapTitle: 'Choose a dealer.',
    sendLabel: 'Send replacement quote request',
    emptyPartnerText: 'No listed dealers found yet. Dealer accounts must enable their directory listing under Account details.',
  },
];

type QuoteToneStyle = {
  primary: string;
  dark: string;
  text: string;
  soft: string;
  border: string;
  shadow: string;
};

const QUOTE_TONE_STYLES: Record<PartnerType, QuoteToneStyle> = {
  finance: {
    primary: '#c48220',
    dark: '#8b5a12',
    text: '#74460b',
    soft: '#fff7e8',
    border: '#f0cf97',
    shadow: 'rgba(196, 130, 32, 0.34)',
  },
  insurance: {
    primary: '#2563eb',
    dark: '#1d4ed8',
    text: '#1e3a8a',
    soft: '#eff6ff',
    border: '#bfdbfe',
    shadow: 'rgba(37, 99, 235, 0.32)',
  },
  dealer: {
    primary: '#159063',
    dark: '#0f6f4d',
    text: '#065f46',
    soft: '#ecfdf5',
    border: '#bbf7d0',
    shadow: 'rgba(22, 130, 88, 0.34)',
  },
};


const initialAssetDraft: AssetDraft = {
  kind: 'equipment',
  title: '',
  value: '',
  replacementPrice: '',
  note: '',
  serialNumber: '',
  isFinanced: false,
  isInsured: false,
  isLicensed: false,
  financeStatus: 'unknown',
  insuranceStatus: 'unknown',
  licenseStatus: 'unknown',
  licenseRegistrationNumber: '',
  financeNote: '',
  insuranceNote: '',
  photos: [],
  documents: [],
  yearModel: '',
  hours: '',
  usageMetric: 'hours',
  lifeWorkedPercent: '',
  condition: '',
};

function createDefaultProjectionForm(): ProjectionFormState {
  const nextYear = new Date().getFullYear() + 1;

  return {
    targetYear: String(nextYear),
    inflationRatePct: '5',
    extraHours: '',
  };
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function FilterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

function OptionsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
      <circle cx="8" cy="7" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ManageIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function UpdateAssetIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L8 20l-5 1 1-5z" />
    </svg>
  );
}

function CartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M3 4h2l2.2 10.4a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.95-1.56L20 8H6.2" />
      <path d="M8 8h12" />
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
    </svg>
  );
}

function BankIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 10h18" />
      <path d="M5 10v8" />
      <path d="M9 10v8" />
      <path d="M15 10v8" />
      <path d="M19 10v8" />
      <path d="M4 18h16" />
      <path d="M12 3 4 8h16z" />
    </svg>
  );
}

function MoneyBagIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8.2 4.2c.55 1.35 1.7 2.1 3.8 2.1s3.25-.75 3.8-2.1" />
      <path d="M9.15 3.2h5.7l1.55 2.25-1.85 1.85h-5.1L7.6 5.45z" />
      <path d="M7.35 8.05c-2.65 2.2-4.1 5.15-4.1 8.25 0 3.15 2.5 4.5 8.75 4.5s8.75-1.35 8.75-4.5c0-3.1-1.45-6.05-4.1-8.25" />
      <path d="M12 10.1v7.1" />
      <path d="M14.4 11.65h-3.2c-.9 0-1.55.52-1.55 1.25s.58 1.12 1.55 1.32l1.6.34c.97.2 1.55.6 1.55 1.32s-.65 1.25-1.55 1.25H9.45" />
    </svg>
  );
}

function ReplacementQuoteIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function ShieldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3 20 6v5c0 5.2-3.3 8.7-8 10-4.7-1.3-8-4.8-8-10V6z" />
      <path d="m9 12 2 2 4-5" />
    </svg>
  );
}

function QuoteMachineIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 15h3l2-5h5l2 5h4" />
      <path d="M7 15h10" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
      <path d="M10 10V7h4v3" />
      <path d="M19 6v4" />
      <path d="M17 8h4" />
    </svg>
  );
}

function DownloadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 3v10" />
      <path d="m8 9 4 4 4-4" />
      <path d="M4 20h16" />
    </svg>
  );
}

function ShareIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.6 6.8-4.2" />
      <path d="m8.6 13.4 6.8 4.2" />
    </svg>
  );
}


function CopyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function QrIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="15" width="6" height="6" rx="1" />
      <path d="M15 15h3v3" />
      <path d="M21 15v6h-3" />
      <path d="M15 21v-3" />
      <path d="M12 7h1" />
      <path d="M12 12h1" />
      <path d="M7 12h1" />
      <path d="M12 17h1" />
    </svg>
  );
}

function SpreadsheetIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h8" />
      <path d="M12 7v8" />
    </svg>
  );
}

function PdfIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M9 15h6" />
      <path d="M9 18h5" />
    </svg>
  );
}


function DocumentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function TrendIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  );
}

function EditIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L8 20l-5 1 1-5z" />
    </svg>
  );
}

function PrintIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M7 8V3h10v5" />
      <path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v7H7z" />
    </svg>
  );
}

function StoreIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M3 9 5 4h14l2 5" />
      <path d="M4 9h16v3a3 3 0 0 1-3 3h-1a3 3 0 0 1-2-1 3 3 0 0 1-4 0 3 3 0 0 1-2 1H7a3 3 0 0 1-3-3z" />
      <path d="M5 15v5h14v-5" />
    </svg>
  );
}

function TrashIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m6 6 1 14h10l1-14" />
      <path d="M10 10v6" />
      <path d="M14 10v6" />
    </svg>
  );
}

function PlusIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronUpIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

type ExportGraphicProps = {
  src: string;
  alt: string;
  icon: JSX.Element;
};

function ExportGraphic({ src, alt, icon }: ExportGraphicProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <span className={styles.exportGraphicFallback}>{icon}</span>;
  }

  return <img src={src} alt={alt} className={styles.exportGraphicImage} onError={() => setHasError(true)} />;
}

function ReportSelect({ label, value, options, isOpen, disabled = false, onToggle, onChange }: ReportSelectProps) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className={`${styles.reportSelectField} ${isOpen ? styles.reportSelectFieldOpen : ''} ${disabled ? styles.reportSelectFieldDisabled : ''}`}
      data-asset-report-select-root="true"
    >
      <span className={styles.reportSelectLabel}>{label}</span>
      <button type="button" className={styles.reportSelectButton} onClick={onToggle} disabled={disabled} aria-haspopup="listbox" aria-expanded={isOpen}>
        <span>{selectedOption?.label ?? 'Select option'}</span>
        <ChevronDownIcon className={styles.reportSelectChevron} />
      </button>

      {isOpen && !disabled ? (
        <div className={styles.reportSelectMenu} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.reportSelectOption} ${option.value === value ? styles.reportSelectOptionActive : ''}`}
              onClick={() => onChange(option.value)}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type ModalSelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type ModalSelectProps<T extends string> = {
  label: string;
  value: T | '';
  options: Array<ModalSelectOption<T>>;
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
};

function ModalSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select option',
  className = '',
  autoFocus = false,
}: ModalSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (wrapRef.current && target instanceof Node && !wrapRef.current.contains(target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={`${styles.field} ${styles.customSelectField} ${className}`} ref={wrapRef}>
      <span>{label}</span>
      <button
        type="button"
        className={`${styles.customSelectButton} ${isOpen ? styles.customSelectButtonOpen : ''} ${!selectedOption ? styles.customSelectButtonPlaceholder : ''}`}
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        autoFocus={autoFocus}
      >
        <span>{selectedOption?.label ?? placeholder}</span>
        <ChevronDownIcon className={styles.customSelectChevron} />
      </button>

      {isOpen ? (
        <div className={styles.customSelectMenu} role="listbox" aria-label={label}>
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                key={option.value || option.label}
                className={`${styles.customSelectOption} ${isSelected ? styles.customSelectOptionActive : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description ? <small>{option.description}</small> : null}
                </span>
                {isSelected ? <b aria-hidden="true">✓</b> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function money(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatWholeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/A';
  return Math.round(value).toLocaleString('en-ZA');
}

function formatListingYear(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 1950) return null;
  return String(Math.round(value));
}

function formatListingHours(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return null;
  return `${formatWholeNumber(value)} hours`;
}

function normalizeExternalUrl(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function joinMeta(parts: Array<string | null | undefined>): string {
  const cleanParts = parts.map((part) => String(part ?? '').trim()).filter(Boolean);
  return cleanParts.length ? cleanParts.join(' • ') : 'Details not captured';
}

function formatMarketSourceLabel(value: string | null | undefined): string {
  const label = String(value ?? '').trim();
  return label || 'Marketplace listing';
}

function formatMarketCondition(value: string | null | undefined): string | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === 'excellent' || normalized === 'good' || normalized === 'fair' || normalized === 'used' || normalized === 'serious') {
    return conditionLabel(normalized as AssetConditionValue);
  }

  return value ?? null;
}

function marketSourcePrice(source: PricingMarketSource): number | null {
  const value = source.advertisedPriceExVat ?? source.priceExVat ?? source.askingPriceExVat ?? source.price;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function marketSourceLocation(source: PricingMarketSource): string | null {
  const explicitLocation = String(source.location ?? '').trim();
  if (explicitLocation && !explicitLocation.toLowerCase().includes('unknown')) return explicitLocation;

  const area = String(source.area ?? '').trim();
  const province = String(source.province ?? '').trim();
  const joined = [area, province].filter((part) => part && part.toLowerCase() !== 'unknown').join(', ');
  return joined || null;
}

function formatPricingMarketMeta(source: PricingMarketSource): string {
  return joinMeta([
    formatListingYear(source.yearModel ?? source.year),
    formatListingHours(source.hours ?? source.usageAmount),
    marketSourceLocation(source),
    formatMarketCondition(source.condition),
    source.matchReason,
  ]);
}

function parseMoneyInput(value: unknown): number | null {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;

  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMarketplacePriceInput(value: unknown): string {
  const digits = String(value ?? '').replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatRegisterValueInput(value: unknown): string {
  return formatMarketplacePriceInput(value);
}

function parseRegisterValueInput(value: unknown): number {
  return Math.round(parseMoneyInput(value) ?? 0);
}

function formatUsageAmountInput(value: unknown): string {
  return formatMarketplacePriceInput(value);
}

function parseUsageAmountInput(value: unknown): number {
  return Math.round(parseMoneyInput(value) ?? 0);
}

function formatPercent(value: number): string {
  const normalized = Number(value || 0);
  return `${normalized.toFixed(normalized % 1 === 0 ? 0 : 1)}%`;
}

function formatRatioPercent(value: number): string {
  const normalized = Number(value || 0) * 100;
  return `${normalized.toFixed(normalized % 1 === 0 ? 0 : 1)}%`;
}

function getPdfReportOption(reportKind: PdfReportKind): PdfReportOption {
  return PDF_REPORT_OPTIONS.find((option) => option.value === reportKind) ?? PDF_REPORT_OPTIONS[0];
}

function filterAssetsByPdfReportKind(assetList: RegisterAsset[], reportKind: PdfReportKind): RegisterAsset[] {
  switch (reportKind) {
    case 'financed':
      return assetList.filter((asset) => readFinanceStatusChoice(asset) === 'yes');
    case 'insured':
      return assetList.filter((asset) => readInsuranceStatusChoice(asset) === 'yes');
    case 'licensed':
      return assetList.filter((asset) => readLicenseStatusChoice(asset) === 'yes');
    case 'not-financed':
      return assetList.filter((asset) => readFinanceStatusChoice(asset) === 'no');
    case 'not-insured':
      return assetList.filter((asset) => readInsuranceStatusChoice(asset) === 'no');
    case 'not-licensed':
      return assetList.filter((asset) => readLicenseStatusChoice(asset) === 'no');
    case 'full':
    default:
      return assetList;
  }
}

function sumAssetValues(assetList: RegisterAsset[]): number {
  return assetList.reduce((sum, asset) => sum + Math.round(Number(asset.value || 0)), 0);
}

function calculateAssetStats(
  assetList: RegisterAsset[],
  predicate?: (asset: RegisterAsset) => boolean,
): { count: number; value: number } {
  const matchingAssets = predicate ? assetList.filter(predicate) : assetList;

  return {
    count: matchingAssets.length,
    value: sumAssetValues(matchingAssets),
  };
}

function formatDate(value?: string | null): string {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function wasUpdatedAfterCreate(asset: RegisterAsset): boolean {
  const createdAt = new Date(asset.createdAtIso).getTime();
  const updatedAt = new Date(asset.updatedAtIso).getTime();

  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) {
    return false;
  }

  return updatedAt - createdAt > 1000;
}

function assetStatusDateLabel(asset: RegisterAsset): string {
  return wasUpdatedAfterCreate(asset)
    ? `Updated ${formatDate(asset.updatedAtIso)}`
    : `Saved ${formatDate(asset.createdAtIso)}`;
}

function methodLabel(value: AssetMethod): string {
  return (
    {
      aim4price: 'Aim4price',
      market: 'Market',
      manual: 'Manual',
    }[value] ?? 'Manual'
  );
}

function kindLabel(value: AssetKind): string {
  return (
    {
      tractor: 'Tractor',
      equipment: 'Equipment',
      manual: 'Other',
      property: 'Property/Buildings',
      vehicle: 'Vehicle',
      tools: 'Tools',
    }[value] ?? 'Manual asset'
  );
}

function normalizeDraftKind(value: AssetKind): AssetKind {
  return value;
}

function normalizeUsageMetric(value: unknown, kind?: AssetKind): UsageMetric {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'km' || normalized === 'kms' || normalized === 'kilometres' || normalized === 'kilometers') {
    return 'km';
  }

  if (normalized === 'hours' || normalized === 'hour' || normalized === 'hrs') {
    return 'hours';
  }

  return kind === 'vehicle' ? 'km' : 'hours';
}

function getAssetUsageMetric(asset: Pick<RegisterAsset, 'kind' | 'specsJson'>): UsageMetric {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeUsageMetric(
    specs.usageMetric ?? specs.usage_metric ?? specs.usageUnit ?? specs.usage_unit ?? specs.usage_measure,
    asset.kind,
  );
}

function assetUsesPercentUsage(asset: RegisterAsset): boolean {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const percent = getAssetLifeWorkedPercent(asset);
  const hours = Number(asset.hours);
  const hasPositiveHours = Number.isFinite(hours) && hours > 0;
  const depreciationMethod = String(asset.depreciationMethodUsed ?? '').trim().toLowerCase();
  const rawUsageMode = String(
    specs.usageMode ??
      specs.usage_mode ??
      specs.usageMetricType ??
      specs.usage_metric_type ??
      specs.valuationMode ??
      specs.valuation_mode ??
      '',
  )
    .trim()
    .toLowerCase();

  if (
    rawUsageMode === 'percent' ||
    rawUsageMode === 'percentage' ||
    rawUsageMode === 'percent_used' ||
    rawUsageMode === 'percentage_depreciation' ||
    rawUsageMode === 'wear_class'
  ) {
    return true;
  }

  if (asset.kind === 'vehicle') {
    return false;
  }

  if (depreciationMethod === 'percentage_depreciation') {
    return true;
  }

  return percent !== null && (!hasPositiveHours || depreciationMethod === 'semi_depreciation');
}

function usageMetricLabel(value: UsageMetric): string {
  return value === 'km' ? 'km' : 'hours';
}

function assetYearLabel(asset: Pick<RegisterAsset, 'kind'>): string {
  return asset.kind === 'property' ? 'Year Built' : 'Year Model';
}

function draftYearLabel(kind: AssetKind): string {
  return kind === 'property' ? 'Year built' : 'Year model';
}

function getManualAssetOption(kind: AssetKind) {
  const normalizedKind = normalizeDraftKind(kind);
  return MANUAL_ASSET_TYPE_OPTIONS.find((option) => option.value === normalizedKind) ?? MANUAL_ASSET_TYPE_OPTIONS[0];
}

function normalizeAssetStatusChoice(value: unknown, fallback: AssetStatusChoice = 'unknown'): AssetStatusChoice {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (['yes', 'y', 'true', 'financed', 'insured', 'licensed', 'licenced', 'is_financed', 'is_insured', 'is_licensed'].includes(normalized)) {
    return 'yes';
  }

  if (['no', 'n', 'false', 'not_financed', 'not_insured', 'not_licensed', 'not_licenced', 'unfinanced', 'uninsured', 'unlicensed', 'unlicenced'].includes(normalized)) {
    return 'no';
  }

  if (['na', 'n_a', 'not_applicable', 'not_aplicable', 'not_relevant', 'does_not_apply'].includes(normalized)) {
    return 'not_applicable';
  }

  if (['unknown', 'not_sure', 'unsure', 'maybe', ''].includes(normalized)) {
    return normalized ? 'unknown' : fallback;
  }

  return fallback;
}

function readFinanceStatusChoice(asset: RegisterAsset): AssetStatusChoice {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.financeStatus ?? specs.finance_status ?? specs.financedStatus ?? specs.financed_status,
    asset.isFinanced ? 'yes' : 'no',
  );
}

function readInsuranceStatusChoice(asset: RegisterAsset): AssetStatusChoice {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.insuranceStatus ?? specs.insurance_status ?? specs.insuredStatus ?? specs.insured_status,
    asset.isInsured ? 'yes' : 'no',
  );
}

function readLicenseStatusChoice(asset: RegisterAsset): AssetStatusChoice {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.licenseStatus ??
      specs.license_status ??
      specs.licensedStatus ??
      specs.licensed_status ??
      specs.licenceStatus ??
      specs.licence_status ??
      specs.licencedStatus ??
      specs.licenced_status,
    asset.isLicensed ? 'yes' : 'no',
  );
}

function normalizeLicenseRegistrationText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function readLicenseRegistrationNumber(asset: Pick<RegisterAsset, 'licenseRegistrationNumber' | 'specsJson'>): string {
  const direct = normalizeLicenseRegistrationText(asset.licenseRegistrationNumber);
  if (direct) return direct;

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeLicenseRegistrationText(
    specs.licenseRegistrationNumber ??
      specs.license_registration_number ??
      specs.licenceRegistrationNumber ??
      specs.licence_registration_number ??
      specs.licenseRegistration ??
      specs.license_registration ??
      specs.licenceRegistration ??
      specs.licence_registration ??
      specs.registrationNumber ??
      specs.registration_number ??
      specs.numberPlate ??
      specs.number_plate ??
      specs.numberplate,
  );
}

function readInsuranceNote(asset: Pick<RegisterAsset, 'specsJson'>): string {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return String(
    specs.insuranceNote ??
      specs.insurance_note ??
      specs.insuredNote ??
      specs.insured_note ??
      '',
  ).trim();
}

function statusChoiceLabel(value: AssetStatusChoice): string {
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  if (value === 'not_applicable') return 'N/A';
  return 'Not sure';
}

function statusChoiceReportLabel(value: AssetStatusChoice): string {
  if (value === 'not_applicable') return 'Not applicable';
  return statusChoiceLabel(value);
}

function renderAssetStatusMark(value: AssetStatusChoice) {
  const status = normalizeAssetStatusChoice(value);
  const config = {
    yes: { label: '✓', className: styles.statusMarkYes, title: 'Yes' },
    no: { label: '×', className: styles.statusMarkNo, title: 'No' },
    unknown: { label: '?', className: styles.statusMarkUnknown, title: 'Not sure' },
    not_applicable: { label: 'N/A', className: styles.statusMarkNotApplicable, title: 'Not applicable' },
  }[status];

  return (
    <strong className={`${styles.assetStatusMark} ${config.className}`} aria-label={config.title} title={config.title}>
      {config.label}
    </strong>
  );
}

function conditionLabel(value: AssetConditionValue): string {
  return (
    {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      used: 'Used',
      serious: 'Requires attention',
      '': '—',
    }[value] ?? '—'
  );
}

function formatDrive(value: string): string {
  if (value === '4wd') return '4WD';
  if (value === '2wd') return '2WD';
  if (value === 'tracks') return 'Tracks';
  return value || '—';
}

function formatCab(value: string): string {
  if (value === 'cab') return 'Cab';
  if (value === 'open-station') return 'Open station';
  return value || '—';
}

function formatTractorType(value: string): string {
  if (value === 'field') return 'Field';
  if (value === 'orchard') return 'Orchard';
  return value || '—';
}

function uniquePhotoUrls(value: string[]): string[] {
  const seen = new Set<string>();

  return value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }

      seen.add(entry);
      return true;
    });
}

function normalizePhotos(value: string[]): string[] {
  return uniquePhotoUrls(value).slice(0, MAX_PHOTOS);
}

function limitPhotosToNewest(value: string[]): string[] {
  return uniquePhotoUrls(value).slice(-MAX_PHOTOS);
}

function limitDraftPhotosWithMainPreference(value: string[], shouldPreserveFirstPhoto: boolean): string[] {
  const photos = uniquePhotoUrls(value);

  if (photos.length <= MAX_PHOTOS) {
    return photos;
  }

  if (!shouldPreserveFirstPhoto) {
    return photos.slice(-MAX_PHOTOS);
  }

  const mainPhoto = photos[0];
  const remainingPhotos = photos.slice(1).filter((photo) => photo !== mainPhoto);
  return [mainPhoto, ...remainingPhotos.slice(-(MAX_PHOTOS - 1))];
}

function mediaInputId(assetId: string, type: DetailMediaUploadType): string {
  return `asset-${type}-upload-${assetId}`;
}

function savedDraftPhotoKey(url: string): string {
  return `saved:${url}`;
}

function pendingDraftPhotoKey(id: string): string {
  return `pending:${id}`;
}

function mainPhotoSelectionKey(selection: MainPhotoSelection | null): string | null {
  if (!selection) return null;
  return selection.source === 'saved' ? savedDraftPhotoKey(selection.url) : pendingDraftPhotoKey(selection.id);
}

function createPendingPhotoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createPhotoPreviewUrl(file: File): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return '';
  }

  return URL.createObjectURL(file);
}

function revokePhotoPreviewUrl(previewUrl: string): void {
  if (!previewUrl || !previewUrl.startsWith('blob:')) return;
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;

  URL.revokeObjectURL(previewUrl);
}

function buildDraftPhotoItems(
  savedPhotos: string[],
  pendingPhotos: PendingPhotoFile[],
  selection: MainPhotoSelection | null,
): DraftPhotoItem[] {
  const savedItems: DraftPhotoItem[] = normalizePhotos(savedPhotos).map((photo, index) => ({
    key: savedDraftPhotoKey(photo),
    source: 'saved',
    label: `Saved photo ${index + 1}`,
    previewUrl: photo,
    url: photo,
    isMain: false,
  }));

  const pendingItems: DraftPhotoItem[] = pendingPhotos.map((entry, index) => ({
    key: pendingDraftPhotoKey(entry.id),
    source: 'pending',
    label: entry.file.name || `Queued photo ${index + 1}`,
    previewUrl: entry.previewUrl,
    pendingId: entry.id,
    isMain: false,
  }));

  const items = [...savedItems, ...pendingItems];
  if (!items.length) return [];

  const preferredKey = mainPhotoSelectionKey(selection);
  const mainKey = preferredKey && items.some((item) => item.key === preferredKey) ? preferredKey : items[0].key;
  const mainItem = items.find((item) => item.key === mainKey);
  const orderedItems = mainItem ? [mainItem, ...items.filter((item) => item.key !== mainKey)] : items;

  return orderedItems.map((item, index) => ({
    ...item,
    isMain: index === 0,
  }));
}


function normalizeDocuments(value: unknown): AssetDocument[] {
  const rawItems = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const documents: AssetDocument[] = [];

  rawItems.forEach((entry, index) => {
    let document: AssetDocument | null = null;

    if (typeof entry === 'string') {
      const url = entry.trim();
      if (url) {
        document = {
          id: url,
          url,
          fileName: `Document ${index + 1}`,
          contentType: 'application/octet-stream',
          byteSize: 0,
          uploadedAtIso: new Date().toISOString(),
        };
      }
    } else if (isPlainRecord(entry)) {
      const url = String(entry.url ?? '').trim();
      const fileName = String(entry.fileName ?? entry.name ?? entry.title ?? '').trim();

      if (url) {
        document = {
          id: String(entry.id ?? entry.uploadId ?? url).trim() || url,
          url,
          fileName: fileName || `Document ${index + 1}`,
          contentType: String(entry.contentType ?? entry.mimeType ?? 'application/octet-stream').trim() || 'application/octet-stream',
          byteSize: Math.max(0, Math.round(Number(entry.byteSize ?? entry.sizeBytes ?? 0) || 0)),
          uploadedAtIso: String(entry.uploadedAtIso ?? entry.uploadedAt ?? '').trim() || new Date().toISOString(),
        };
      }
    }

    if (!document) return;

    const duplicateKey = document.url || document.id;
    if (seen.has(duplicateKey)) return;

    seen.add(duplicateKey);
    documents.push(document);
  });

  return documents.slice(0, MAX_DOCUMENTS);
}

function assetDocuments(asset: RegisterAsset): AssetDocument[] {
  return normalizeDocuments(asset.documents);
}

function formatByteSize(value: number): string {
  const bytes = Math.max(0, Math.round(Number(value) || 0));

  if (!bytes) return 'Saved document';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function shortDocumentName(value: string): string {
  const text = String(value ?? '').trim();
  if (!text) return 'Document';
  return text.length > 34 ? `${text.slice(0, 18)}…${text.slice(-10)}` : text;
}

const DOCUMENT_OBJECT_URL_TTL_MS = 5 * 60 * 1000;

type CachedDocumentObjectUrl = {
  objectUrl: string;
  timeoutId: number | null;
};

function isDataDocumentUrl(value: string): boolean {
  return /^data:/i.test(String(value ?? '').trim());
}

function parseDataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/i.exec(dataUrl);

  if (!match) {
    throw new Error('Invalid document data.');
  }

  const mimeType = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';

  if (!isBase64) {
    return new Blob([decodeURIComponent(payload)], { type: mimeType });
  }

  const binaryString = window.atob(payload.replace(/\s/g, ''));
  const slices: Uint8Array[] = [];
  const sliceSize = 8192;

  for (let offset = 0; offset < binaryString.length; offset += sliceSize) {
    const slice = binaryString.slice(offset, offset + sliceSize);
    const bytes = new Uint8Array(slice.length);

    for (let index = 0; index < slice.length; index += 1) {
      bytes[index] = slice.charCodeAt(index);
    }

    slices.push(bytes);
  }

  return new Blob(slices, { type: mimeType });
}

async function createDataDocumentObjectUrl(dataUrl: string): Promise<string> {
  try {
    const response = await fetch(dataUrl);

    if (response.ok) {
      const blob = await response.blob();

      if (blob.size > 0) {
        return URL.createObjectURL(blob);
      }
    }
  } catch {
    // Fall back to manual decoding below. Some browsers are unreliable with large data URLs.
  }

  return URL.createObjectURL(parseDataUrlToBlob(dataUrl));
}

function writeDocumentOpeningPage(targetWindow: Window, fileName: string): void {
  try {
    targetWindow.document.title = fileName ? `Opening ${fileName}` : 'Opening document';
    targetWindow.document.body.replaceChildren();
    targetWindow.document.body.style.margin = '0';
    targetWindow.document.body.style.fontFamily = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    targetWindow.document.body.style.background = '#f5f7f8';
    targetWindow.document.body.style.color = '#0b332a';

    const wrapper = targetWindow.document.createElement('div');
    wrapper.style.minHeight = '100vh';
    wrapper.style.display = 'grid';
    wrapper.style.placeItems = 'center';
    wrapper.style.padding = '2rem';

    const card = targetWindow.document.createElement('div');
    card.style.maxWidth = '28rem';
    card.style.width = '100%';
    card.style.padding = '1.4rem';
    card.style.borderRadius = '1.2rem';
    card.style.background = '#ffffff';
    card.style.boxShadow = '0 18px 44px rgba(15, 45, 37, 0.14)';
    card.style.border = '1px solid rgba(184, 204, 196, 0.72)';

    const title = targetWindow.document.createElement('strong');
    title.textContent = 'Opening document';
    title.style.display = 'block';
    title.style.fontSize = '1rem';

    const description = targetWindow.document.createElement('p');
    description.textContent = fileName || 'Preparing saved file...';
    description.style.margin = '0.45rem 0 0';
    description.style.color = '#60736e';
    description.style.fontSize = '0.92rem';

    card.append(title, description);
    wrapper.append(card);
    targetWindow.document.body.append(wrapper);
  } catch {
    // The browser may block writing to the tab. The document still opens once the blob URL is ready.
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toDisplayText(value: unknown): string {
  if (value === null || typeof value === 'undefined') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('en-ZA') : '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(toDisplayText).filter(Boolean).join(', ');

  if (isPlainRecord(value)) {
    return toDisplayText(value.label ?? value.name ?? value.value ?? value.title ?? '');
  }

  return '';
}

function formatSpecKey(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

const HIDDEN_BASIC_SPEC_KEYS = new Set([
  'year',
  'year model',
  'year model unknown',
  'condition',
  'brand',
  'brand slug',
  'family key',
  'sector key',
  'typed model name',
  'normalized typed model name',
  'usage amount',
  'life worked percent',
  'hours',
  'engine hours',
  'valuation needs update',
  'valuation stale since',
  'valuation stale reason',
  'valuation stale reasons',
  'valuation last updated at',
  'valuation last run id',
  'valuation last value ex vat',
  'valuation last hours',
  'valuation last life worked percent',
  'valuation last condition',
]);

function buildBasicSpecParts(asset: RegisterAsset): string[] {
  const directParts = [
    asset.tractorType ? formatTractorType(asset.tractorType) : '',
    asset.drive ? formatDrive(asset.drive) : '',
    asset.cab ? formatCab(asset.cab) : '',
    asset.powerKw !== null && typeof asset.powerKw !== 'undefined' && asset.powerKw > 0 ? `${asset.powerKw} kW` : '',
  ].filter(Boolean);

  const specsJson = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const specParts = Object.entries(specsJson)
    .map(([key, value]) => {
      const label = formatSpecKey(key);
      const normalizedLabel = label.toLowerCase();
      const displayValue = toDisplayText(value);

      if (!label || !displayValue || HIDDEN_BASIC_SPEC_KEYS.has(normalizedLabel)) {
        return '';
      }

      return `${label}: ${displayValue}`;
    })
    .filter(Boolean)
    .slice(0, 4);

  return [...directParts, ...specParts];
}

function isTractorAsset(asset: RegisterAsset): boolean {
  return asset.kind === 'tractor' || Boolean(asset.tractorType || asset.drive || asset.cab);
}

function isValuedEquipmentAsset(asset: RegisterAsset): boolean {
  return asset.kind !== 'property' && Boolean(asset.valuationRunId !== null || asset.brandName || asset.modelName || asset.selectedMethod !== 'manual');
}

function isAim4priceValuedAsset(asset: RegisterAsset): boolean {
  return Boolean(asset.valuationRunId !== null || asset.selectedMethod === 'aim4price' || asset.aim4priceValueExVat !== null);
}

function isMarketplaceEligible(asset: RegisterAsset): boolean {
  return asset.kind !== 'property' && asset.value > 0;
}

function isLiveOnMarketplace(asset: RegisterAsset): boolean {
  return String(asset.marketplaceStatus ?? 'draft').toLowerCase() === 'live';
}

function readBooleanFromSpecs(specs: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = specs[key];

    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
      if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    }
  }

  return false;
}

function isValuationUpdateAvailable(asset: RegisterAsset): boolean {
  return Boolean(asset.valuationRunId !== null && asset.selectedMethod !== 'manual');
}

function doesEstimateNeedUpdate(asset: RegisterAsset): boolean {
  return readBooleanFromSpecs(asset.specsJson ?? {}, ['valuationNeedsUpdate', 'valuation_needs_update']);
}

function valuationStaleReason(asset: RegisterAsset): string {
  const specs = asset.specsJson ?? {};
  const rawReasons = specs.valuation_stale_reasons ?? specs.valuationStaleReasons;

  if (Array.isArray(rawReasons)) {
    const text = rawReasons.map((entry) => String(entry ?? '').trim()).filter(Boolean).join(', ');
    if (text) return text;
  }

  return String(specs.valuation_stale_reason ?? specs.valuationStaleReason ?? 'latest asset details changed').trim() || 'latest asset details changed';
}

function timestampFromIso(value?: string | null): number {
  if (!value) return 0;

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestampFromSpecs(specs: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = specs[key];

    if (typeof value === 'string') {
      const timestamp = timestampFromIso(value);
      if (timestamp) return timestamp;
    }
  }

  return 0;
}

function assetNeedsEstimateAttention(asset: RegisterAsset): boolean {
  return doesEstimateNeedUpdate(asset) && isValuationUpdateAvailable(asset);
}

function assetAttentionRank(asset: RegisterAsset): number {
  if (asset.openPartnerNote) return 3;
  if (asset.latestMaintenanceStatus) return 2;
  if (assetNeedsEstimateAttention(asset)) return 1;

  return 0;
}

function assetAttentionTimestamp(asset: RegisterAsset): number {
  const openPartnerNote = asset.openPartnerNote ?? null;
  const latestMaintenanceStatus = asset.latestMaintenanceStatus ?? null;

  if (openPartnerNote) {
    return (
      timestampFromIso(openPartnerNote.updatedAtIso) ||
      timestampFromIso(openPartnerNote.createdAtIso) ||
      timestampFromIso(asset.updatedAtIso) ||
      timestampFromIso(asset.createdAtIso)
    );
  }

  if (latestMaintenanceStatus) {
    return (
      timestampFromIso(latestMaintenanceStatus.createdAtIso) ||
      timestampFromIso(asset.updatedAtIso) ||
      timestampFromIso(asset.createdAtIso)
    );
  }

  if (assetNeedsEstimateAttention(asset)) {
    return (
      timestampFromSpecs(asset.specsJson ?? {}, ['valuationStaleSince', 'valuation_stale_since']) ||
      timestampFromIso(asset.updatedAtIso) ||
      timestampFromIso(asset.createdAtIso)
    );
  }

  return timestampFromIso(asset.updatedAtIso) || timestampFromIso(asset.createdAtIso);
}

function compareAssetsByRegisterPriority(left: RegisterAsset, right: RegisterAsset, assetFilter: AssetFilterKey): number {
  const rankDifference = assetAttentionRank(right) - assetAttentionRank(left);
  if (rankDifference) return rankDifference;

  if (assetFilter === 'highest-value' || assetFilter === 'lowest-value') {
    const leftValue = Number(left.value || 0);
    const rightValue = Number(right.value || 0);
    const valueDifference = assetFilter === 'highest-value' ? rightValue - leftValue : leftValue - rightValue;

    if (valueDifference) return valueDifference;
  }

  if (assetFilter === 'highest-replacement-price' || assetFilter === 'lowest-replacement-price') {
    const leftValue = readAssetReplacementPriceExVat(left) ?? 0;
    const rightValue = readAssetReplacementPriceExVat(right) ?? 0;
    const valueDifference = assetFilter === 'highest-replacement-price' ? rightValue - leftValue : leftValue - rightValue;

    if (valueDifference) return valueDifference;
  }

  const attentionTimestampDifference = assetAttentionTimestamp(right) - assetAttentionTimestamp(left);
  if (attentionTimestampDifference) return attentionTimestampDifference;

  const createdTimestampDifference = timestampFromIso(right.createdAtIso) - timestampFromIso(left.createdAtIso);
  if (createdTimestampDifference) return createdTimestampDifference;

  return left.title.localeCompare(right.title, 'en-ZA') || left.id.localeCompare(right.id);
}

function sortAssetsByRegisterPriority(assetList: RegisterAsset[], assetFilter: AssetFilterKey): RegisterAsset[] {
  return [...assetList].sort((left, right) => compareAssetsByRegisterPriority(left, right, assetFilter));
}

function assetKindLabel(asset: RegisterAsset): string {
  return assetFamilyLabel(asset);
}

function normalizeAssetNoteText(value: string | null | undefined): string {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function isQrOperationalAssetNote(value: string | null | undefined): boolean {
  const note = normalizeAssetNoteText(value);
  if (!note) return false;

  const compact = note.replace(/\s+/g, ' ').trim().toLowerCase();

  return (
    compact.includes('lifetime worked updated to') ||
    (/^checked\b/.test(compact) && compact.includes('checked items:')) ||
    (/^serviced\b/.test(compact) && (compact.includes('serviced items:') || compact.includes('service items:') || compact.includes('work done:'))) ||
    (/^repaired\b/.test(compact) && (compact.includes('work done:') || compact.includes('mechanic:') || compact.includes('company:')))
  );
}

function getManualAssetNote(value: string | null | undefined): string {
  const note = normalizeAssetNoteText(value);
  return isQrOperationalAssetNote(note) ? '' : note;
}

function canProjectFuturePrice(asset: RegisterAsset): boolean {
  return Boolean(
    isTractorAsset(asset) &&
      asset.valuationRunId !== null &&
      asset.yearModel !== null &&
      asset.powerKw !== null &&
      asset.tractorType,
  );
}

function canRefreshAssetEstimate(asset: RegisterAsset): boolean {
  return asset.valuationRunId !== null && asset.selectedMethod !== 'manual';
}

function canManageAssetPricing(asset: RegisterAsset): boolean {
  return canRefreshAssetEstimate(asset) || canProjectFuturePrice(asset);
}

const REPLACEMENT_PRICE_SPEC_KEYS = [
  'replacementPriceExVat',
  'replacement_price_ex_vat',
  'replacementPriceUsedExVat',
  'replacement_price_used_ex_vat',
  'userReplacementPriceExVat',
  'user_replacement_price_ex_vat',
  'officialReplacementPriceExVat',
  'official_replacement_price_ex_vat',
  'replacementPrice',
  'replacement_price',
] as const;

function readAssetReplacementPriceExVat(asset: Pick<RegisterAsset, 'replacementPriceExVat' | 'specsJson'>): number | null {
  const direct = Number(asset.replacementPriceExVat);
  if (Number.isFinite(direct) && direct > 0) {
    return Math.round(direct);
  }

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const fromSpecs = readNumberFromSpecs(specs, [...REPLACEMENT_PRICE_SPEC_KEYS]);

  return fromSpecs !== null && fromSpecs > 0 ? Math.round(fromSpecs) : null;
}

function sumAssetReplacementValues(assetList: Array<Pick<RegisterAsset, 'replacementPriceExVat' | 'specsJson'>>): number {
  return assetList.reduce((sum, asset) => sum + (readAssetReplacementPriceExVat(asset) ?? 0), 0);
}

function countAssetsWithReplacementPrice(assetList: Array<Pick<RegisterAsset, 'replacementPriceExVat' | 'specsJson'>>): number {
  return assetList.filter((asset) => readAssetReplacementPriceExVat(asset) !== null).length;
}

function buildDraftFromAsset(asset: RegisterAsset): AssetDraft {
  const financeStatus = readFinanceStatusChoice(asset);
  const insuranceStatus = readInsuranceStatusChoice(asset);
  const licenseStatus = readLicenseStatusChoice(asset);
  const insuranceNote = readInsuranceNote(asset);

  return {
    kind: normalizeDraftKind(asset.kind),
    title: asset.title,
    value: formatRegisterValueInput(asset.value || ''),
    replacementPrice: formatRegisterValueInput(readAssetReplacementPriceExVat(asset) ?? ''),
    note: '',
    serialNumber: asset.serialNumber,
    isFinanced: financeStatus === 'yes',
    isInsured: insuranceStatus === 'yes',
    isLicensed: licenseStatus === 'yes',
    financeStatus,
    insuranceStatus,
    licenseStatus,
    licenseRegistrationNumber: licenseStatus === 'yes' ? readLicenseRegistrationNumber(asset) : '',
    financeNote: financeStatus === 'yes' ? asset.financeNote : '',
    insuranceNote: insuranceStatus === 'yes' ? insuranceNote : '',
    photos: normalizePhotos(asset.photos),
    documents: assetDocuments(asset),
    yearModel: asset.yearModel === null || typeof asset.yearModel === 'undefined' ? '' : String(asset.yearModel),
    hours: asset.hours === null || typeof asset.hours === 'undefined' ? '' : formatUsageAmountInput(asset.hours),
    usageMetric: getAssetUsageMetric(asset),
    lifeWorkedPercent: getAssetLifeWorkedPercent(asset) === null ? '' : String(getAssetLifeWorkedPercent(asset)),
    condition: asset.condition,
  };
}

function buildSavedItemFromAsset(asset: RegisterAsset) {
  return {
    id: asset.id,
    valuationRunId: asset.valuationRunId ?? undefined,
    kind: normalizeDraftKind(asset.kind),
    title: asset.title,
    value: asset.value,
    selectedMethod: asset.selectedMethod,
    method: asset.selectedMethod,
    selectedValueExVat: asset.selectedValueExVat,
    replacementPriceExVat: readAssetReplacementPriceExVat(asset),
    brandName: asset.brandName || undefined,
    modelName: asset.modelName || undefined,
    drive: asset.drive || undefined,
    tractorType: asset.tractorType || undefined,
    cab: asset.cab || undefined,
    powerKw: asset.powerKw ?? undefined,
    yearModel: asset.yearModel ?? undefined,
    hours: asset.hours ?? undefined,
    aim4priceValueExVat: asset.aim4priceValueExVat,
    marketMidExVat: asset.marketMidExVat,
    note: getManualAssetNote(asset.note) || undefined,
    createdAtIso: asset.createdAtIso,
    updatedAtIso: asset.updatedAtIso,
    serialNumber: asset.serialNumber || undefined,
    isFinanced: asset.isFinanced,
    isInsured: asset.isInsured,
    isLicensed: asset.isLicensed,
    licenseRegistrationNumber: readLicenseRegistrationNumber(asset) || undefined,
    financeNote: asset.financeNote || undefined,
    photos: asset.photos,
    documents: assetDocuments(asset),
  };
}

function createMarketplaceDraft(asset: RegisterAsset, profile: AccountProfile | null): MarketplacePublishDraft {
  return {
    sellerName:
      profile?.marketplaceSellerName?.trim() ||
      profile?.name?.trim() ||
      profile?.businessName?.trim() ||
      'Aim4price seller',
    sellerCompany: profile?.businessName?.trim() || '',
    sellerPhone: asset.sellerPhone?.trim() || profile?.marketplacePhone?.trim() || profile?.phone?.trim() || '',
    sellerEmail: profile?.marketplaceEmail?.trim() || '',
    province: profile?.province?.trim() || '',
    area: profile?.marketplaceLocation?.trim() || profile?.townCity?.trim() || '',
    askingPriceExVat: '',
    description: '',
  };
}

function assetPhotos(asset: RegisterAsset): string[] {
  const photos = normalizePhotos(asset.photos);
  return photos.length ? photos : [FALLBACK_ASSET_IMAGE];
}

function assetImage(asset: RegisterAsset): string {
  return assetPhotos(asset)[0] || FALLBACK_ASSET_IMAGE;
}

function assetPreviewImage(asset: RegisterAsset): string | null {
  const photos = normalizePhotos(asset.photos);
  return photos.length ? photos[0] : null;
}

function assetSectorLabel(asset: RegisterAsset): string {
  if (isTractorAsset(asset) || isValuedEquipmentAsset(asset)) return 'Agricultural';
  if (asset.kind === 'property') return 'Property/Buildings';
  if (asset.kind === 'vehicle') return 'Vehicle';
  if (asset.kind === 'tools') return 'Tools';
  return 'Other';
}

function assetFamilyLabel(asset: RegisterAsset): string {
  if (asset.equipmentFamilyLabel) return asset.equipmentFamilyLabel;
  if (isTractorAsset(asset)) return 'Tractor';
  if (asset.kind === 'equipment') return 'Equipment';
  if (asset.kind === 'property') return 'Property/Buildings';
  if (asset.kind === 'vehicle') return 'Vehicle';
  if (asset.kind === 'tools') return 'Tools';
  if (isValuedEquipmentAsset(asset)) return 'Valued equipment';
  return 'Other';
}


function cleanReportText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isMeaningfulReportValue(value: string): boolean {
  const normalized = cleanReportText(value).toLowerCase();
  return Boolean(normalized && normalized !== '-' && normalized !== '—' && normalized !== 'unknown' && normalized !== 'n/a');
}

function readTextFromSpecs(specs: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const direct = cleanReportText(specs[key]);
    if (isMeaningfulReportValue(direct)) return direct;
  }

  return '';
}

function removeFirstCaseInsensitive(source: string, part: string): string {
  const text = cleanReportText(source);
  const needle = cleanReportText(part);
  if (!text || !needle) return text;

  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return text;

  return cleanReportText(`${text.slice(0, index)} ${text.slice(index + needle.length)}`);
}

function removeTrailingFamilyWords(value: string, familyLabel: string): string {
  let cleaned = cleanReportText(value);
  const familyWords = cleanReportText(familyLabel)
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 3);

  for (const word of familyWords) {
    const variants = [word, word.endsWith('s') ? word.slice(0, -1) : `${word}s`].filter(Boolean);
    for (const variant of variants) {
      const pattern = new RegExp(`\\s+${variant.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, 'i');
      cleaned = cleanReportText(cleaned.replace(pattern, ''));
    }
  }

  return cleaned;
}

function deriveAssetReportModelName(asset: RegisterAsset, reportBrandName = ''): string {
  const directModel = cleanReportText(asset.modelName) || cleanReportText(asset.typedModelName);
  if (isMeaningfulReportValue(directModel)) return directModel;

  const fromSpecs = readTextFromSpecs(asset.specsJson ?? {}, [
    'modelName',
    'model_name',
    'typedModelName',
    'typed_model_name',
    'model',
  ]);
  if (fromSpecs) return fromSpecs;

  const titleWithoutBrand = removeFirstCaseInsensitive(asset.title, reportBrandName);
  const fallback = removeTrailingFamilyWords(titleWithoutBrand, assetFamilyLabel(asset));
  return isMeaningfulReportValue(fallback) ? fallback : '—';
}

function deriveAssetReportBrandName(asset: RegisterAsset, reportModelName = ''): string {
  const directBrand = cleanReportText(asset.brandName);
  if (isMeaningfulReportValue(directBrand)) return directBrand;

  const fromSpecs = readTextFromSpecs(asset.specsJson ?? {}, [
    'brandName',
    'brand_name',
    'brand',
    'make',
    'makeName',
    'make_name',
    'manufacturer',
    'manufacturerName',
    'manufacturer_name',
  ]);
  if (fromSpecs) return fromSpecs;

  const modelCandidates = [reportModelName, asset.modelName, asset.typedModelName]
    .map(cleanReportText)
    .filter(isMeaningfulReportValue)
    .sort((a, b) => b.length - a.length);

  let inferred = cleanReportText(asset.title);
  for (const model of modelCandidates) {
    inferred = removeFirstCaseInsensitive(inferred, model);
  }
  inferred = removeTrailingFamilyWords(inferred, assetFamilyLabel(asset));

  return isMeaningfulReportValue(inferred) ? inferred : '—';
}

function readNumberFromSpecs(specs: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = specs[key];
    if (value === null || typeof value === 'undefined' || value === '') {
      continue;
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
}

function getAssetLifeWorkedPercent(asset: RegisterAsset): number | null {
  if (asset.lifeWorkedPercent !== null && typeof asset.lifeWorkedPercent !== 'undefined') {
    const direct = Number(asset.lifeWorkedPercent);
    if (Number.isFinite(direct)) {
      return Math.min(100, Math.max(0, direct));
    }
  }

  const fromSpecs = readNumberFromSpecs(asset.specsJson, [
    'life_worked_percent',
    'worked_percent',
    'lifetime_worked_percent',
    'percent_worked',
    'lifetime_used_percent',
  ]);

  return fromSpecs === null ? null : Math.min(100, Math.max(0, fromSpecs));
}

function formatUsagePercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const formatted = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${formatted}% worked`;
}

function buildAssetUsageValue(asset: RegisterAsset): string {
  const percent = getAssetLifeWorkedPercent(asset);
  const hours = Number(asset.hours);
  const hasHours = Number.isFinite(hours) && hours > 0;
  const usageMetric = getAssetUsageMetric(asset);
  const depreciationMethod = String(asset.depreciationMethodUsed ?? '').trim().toLowerCase();
  const usesPercentDepreciation =
    depreciationMethod === 'semi_depreciation' ||
    depreciationMethod === 'percentage_depreciation' ||
    assetUsesPercentUsage(asset);

  if (percent !== null && (usesPercentDepreciation || !hasHours)) {
    return formatUsagePercent(percent);
  }

  if (hasHours) {
    return `${Math.round(hours).toLocaleString('en-ZA')} ${usageMetricLabel(usageMetric)}`;
  }

  if (percent !== null) {
    return formatUsagePercent(percent);
  }

  return '—';
}

function buildAssetUsageMeta(asset: RegisterAsset): string {
  const usageValue = buildAssetUsageValue(asset);
  return usageValue === '—' ? '' : `Usage: ${usageValue}`;
}

function buildAssetMeta(asset: RegisterAsset): string {
  const parts = [
    asset.yearModel ? `${assetYearLabel(asset)}: ${asset.yearModel}` : '',
    buildAssetUsageMeta(asset),
    asset.condition ? `Condition: ${conditionLabel(asset.condition)}` : '',
  ].filter(Boolean);

  return parts.join(' • ') || 'No key details saved yet';
}

function buildMarketplaceListingTitle(asset: RegisterAsset, includeMissingDetails = false): string {
  const baseTitle =
    String(asset.title ?? '').trim() ||
    [asset.brandName, asset.modelName].map((part) => part.trim()).filter(Boolean).join(' ') ||
    'Marketplace listing';
  const usageValue = buildAssetUsageValue(asset);
  const titleDetails = [
    asset.yearModel ? String(asset.yearModel) : includeMissingDetails ? 'Year not set' : '',
    usageValue !== '—' ? usageValue : includeMissingDetails ? 'Usage not set' : '',
    asset.condition ? conditionLabel(asset.condition) : includeMissingDetails ? 'Condition not set' : '',
  ].filter(Boolean);

  return titleDetails.length ? `${baseTitle} · ${titleDetails.join(' · ')}` : baseTitle;
}

function buildSearchableText(asset: RegisterAsset): string {
  return [
    asset.title,
    asset.brandName,
    asset.modelName,
    asset.typedModelName,
    asset.equipmentFamilyLabel,
    asset.equipmentFamilyKey,
    asset.serialNumber,
    asset.financeNote,
    readInsuranceNote(asset),
    readLicenseRegistrationNumber(asset),
    statusChoiceReportLabel(readFinanceStatusChoice(asset)),
    statusChoiceReportLabel(readInsuranceStatusChoice(asset)),
    statusChoiceReportLabel(readLicenseStatusChoice(asset)),
    ...assetDocuments(asset).map((document) => document.fileName),
    assetDocuments(asset).length ? 'documents paperwork invoice natis papers' : '',
    readInsuranceStatusChoice(asset) === 'yes' ? 'insured insurance' : readInsuranceStatusChoice(asset) === 'no' ? 'not insured no insurance' : '',
    readFinanceStatusChoice(asset) === 'yes' ? 'financed finance' : readFinanceStatusChoice(asset) === 'no' ? 'not financed no finance' : '',
    readLicenseStatusChoice(asset) === 'yes' ? 'licensed licence license registered' : readLicenseStatusChoice(asset) === 'no' ? 'not licensed no licence no license' : readLicenseStatusChoice(asset) === 'not_applicable' ? 'not applicable n/a licence license' : '',
    asset.tractorType,
    asset.drive,
    asset.cab,
    asset.yearModel ? String(asset.yearModel) : '',
    asset.hours !== null && typeof asset.hours !== 'undefined' ? String(asset.hours) : '',
    readAssetReplacementPriceExVat(asset) !== null ? String(readAssetReplacementPriceExVat(asset)) : '',
    readAssetReplacementPriceExVat(asset) !== null ? `replacement price replacement value ${money(readAssetReplacementPriceExVat(asset) ?? 0)}` : 'replacement price not set',
    getAssetUsageMetric(asset),
    asset.lifeWorkedPercent !== null && typeof asset.lifeWorkedPercent !== 'undefined' ? String(asset.lifeWorkedPercent) : '',
    buildAssetUsageMeta(asset),
    conditionLabel(asset.condition),
    kindLabel(asset.kind),
    methodLabel(asset.selectedMethod),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function buildExportDetail(asset: RegisterAsset): string {
  const parts = [
    buildAssetMeta(asset),
    asset.serialNumber ? `Serial: ${asset.serialNumber}` : '',
    `Insurance: ${statusChoiceReportLabel(readInsuranceStatusChoice(asset))}`,
    `Finance: ${statusChoiceReportLabel(readFinanceStatusChoice(asset))}`,
    `License: ${statusChoiceReportLabel(readLicenseStatusChoice(asset))}`,
    readLicenseRegistrationNumber(asset) ? `Registration: ${readLicenseRegistrationNumber(asset)}` : '',
    readAssetReplacementPriceExVat(asset) !== null ? `Replacement: ${money(readAssetReplacementPriceExVat(asset) ?? 0)}` : 'Replacement: Not set',
    assetDocuments(asset).length ? `Documents: ${assetDocuments(asset).length}` : '',
  ].filter(Boolean);

  return parts.join(' • ');
}

function buildOwnerName(profile: AccountProfile | null): string {
  if (!profile) return 'Aim4price account';
  return profile.businessName || profile.name || 'Aim4price account';
}

function buildOwnerMeta(profile: AccountProfile | null): string {
  if (!profile) return 'Aim4price asset register summary';

  const location = [profile.townCity, profile.province].filter(Boolean).join(', ');
  const address = [profile.addressLine1, profile.addressLine2].filter(Boolean).join(', ');
  const parts = [profile.marketplaceEmail, profile.phone, location, address].filter(Boolean);

  return parts.join(' • ') || 'Aim4price asset register summary';
}

function toAbsoluteUrl(value?: string | null): string | null {
  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(text)) {
    return text;
  }

  if (typeof window === 'undefined') {
    return text;
  }

  try {
    return new URL(text, window.location.origin).toString();
  } catch {
    return text;
  }
}

function buildAssetScanUrl(asset: RegisterAsset): string | null {
  const publicAssetCode = String(asset.publicAssetCode ?? '').trim();

  if (!publicAssetCode) {
    return null;
  }

  return toAbsoluteUrl(`/scan/${encodeURIComponent(publicAssetCode)}`);
}

function buildAssetQrSvgUrl(asset: RegisterAsset): string {
  return `/api/asset-register/qr?assetId=${encodeURIComponent(asset.id)}&format=svg`;
}

function buildAssetPdfReportUrl(
  asset: RegisterAsset,
  reportKind: AssetPdfReportKind,
  filters?: AssetPdfReportFilters,
  format: AssetReportFormat = 'pdf',
): string {
  const searchParams = new URLSearchParams({
    assetId: asset.id,
    report: reportKind,
  });

  if (format === 'xlsx') {
    searchParams.set('format', 'xlsx');
  }

  if (filters?.year && filters.year !== 'all') {
    searchParams.set('year', filters.year);

    if (filters.month && filters.month !== 'all') {
      searchParams.set('month', filters.month);
    }
  }

  if (reportKind === 'maintenance' && filters?.maintenanceType && filters.maintenanceType !== 'all') {
    searchParams.set('maintenanceType', filters.maintenanceType);
  }

  return `/api/asset-register/scan-report?${searchParams.toString()}`;
}

function extractAssetReportYear(value?: string | null): number | null {
  if (!value) return null;

  const date = new Date(value);
  const year = date.getFullYear();

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return null;
  }

  return year;
}

function getAssetFuelReportYearValues(asset: RegisterAsset | null): string[] {
  const currentYear = new Date().getFullYear();
  const candidateYears = [
    currentYear,
    extractAssetReportYear(asset?.lastScannedAtIso),
    extractAssetReportYear(asset?.updatedAtIso),
    extractAssetReportYear(asset?.createdAtIso),
  ].filter((year): year is number => typeof year === 'number' && Number.isFinite(year));
  const minYear = Math.min(...candidateYears, currentYear);
  const maxYear = Math.max(...candidateYears, currentYear);

  const years: string[] = [];
  for (let year = maxYear; year >= minYear; year -= 1) {
    years.push(String(year));
  }

  return years;
}

function buildAssetQrPrintUrl(asset: RegisterAsset): string {
  return `/api/asset-register/qr?assetId=${encodeURIComponent(asset.id)}&format=print`;
}

function formatQrStatus(value?: string | null): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'transferred') return 'Transferred';
  if (normalized === 'retired') return 'Retired';
  if (normalized === 'deleted') return 'Inactive';
  if (normalized === 'active') return 'Active';
  return 'Pending';
}

function buildAssetSheetMethodCards(asset: RegisterAsset): ReportMethodCard[] {
  const cards: ReportMethodCard[] = [];

  if (asset.aim4priceValueExVat !== null) {
    cards.push({
      label: 'Aim4price',
      value: money(asset.aim4priceValueExVat),
      note: 'Pricing engine output.',
      selected: asset.selectedMethod === 'aim4price',
    });
  }

  if (asset.marketMidExVat !== null) {
    cards.push({
      label: 'Market',
      value: money(asset.marketMidExVat),
      note: 'Saved market midpoint.',
      selected: asset.selectedMethod === 'market',
    });
  }

  if (!cards.length || asset.selectedMethod === 'manual') {
    cards.unshift({
      label: 'Register',
      value: money(asset.value),
      note: 'Saved register value.',
      selected: asset.selectedMethod === 'manual' || !cards.length,
    });
  }

  return cards;
}

function buildPaginationItems(currentPage: number, pageCount: number): PageItem[] {
  if (pageCount <= 1) return [1];

  const pages = new Set<number>([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((left, right) => left - right);

  const result: PageItem[] = [];

  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) {
      result.push('ellipsis');
    }

    result.push(page);
  });

  return result;
}

function parseDownloadFileName(response: Response, fallback: string): string {
  const disposition = response.headers.get('content-disposition') || '';
  const quotedMatch = /filename="([^"]+)"/i.exec(disposition);
  const plainMatch = /filename=([^;]+)/i.exec(disposition);

  return (quotedMatch?.[1] || plainMatch?.[1] || fallback).trim();
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

function readRegisterIdFromLocation(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return new URLSearchParams(window.location.search).get('registerId')?.trim() ?? '';
}

function buildAssetRegisterApiUrl(registerId?: string | null): string {
  const cleanedRegisterId = String(registerId ?? '').trim();

  if (!cleanedRegisterId) {
    return '/api/asset-register';
  }

  const params = new URLSearchParams({ registerId: cleanedRegisterId });
  return `/api/asset-register?${params.toString()}`;
}

function buildAssetRegisterExportUrl(registerId?: string | null): string {
  const params = new URLSearchParams({ format: 'xlsx' });
  const cleanedRegisterId = String(registerId ?? '').trim();

  if (cleanedRegisterId) {
    params.set('registerId', cleanedRegisterId);
  }

  return `/api/asset-register/export?${params.toString()}`;
}

function mergeProfileWithRegister(profile: AccountProfile | null, register: AssetRegisterSummary | null): AccountProfile | null {
  if (!profile || !register) {
    return profile;
  }

  const registerLogoUrl = register.showLogosOnRegister !== false
    ? (Array.isArray(register.logoUrls) ? String(register.logoUrls[0] ?? '').trim() : '')
    : '';

  return {
    ...profile,
    businessName: register.businessName || profile.businessName,
    email: register.email || profile.marketplaceEmail || '',
    marketplaceEmail: register.email || profile.marketplaceEmail || '',
    phone: register.phone || profile.phone,
    logoUrl: registerLogoUrl,
    addressLine1: register.addressLine1 || profile.addressLine1,
    addressLine2: '',
  };
}


function getRegisterReportLogoUrl(register: AssetRegisterSummary | null): string {
  const registerLogoUrl = register?.showLogosOnRegister !== false && Array.isArray(register?.logoUrls)
    ? String(register.logoUrls[0] ?? '').trim()
    : '';

  return toAbsoluteUrl(registerLogoUrl) ?? '';
}

function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Leaflet can only load in the browser.'));
  }

  if (window.L) {
    return Promise.resolve(window.L);
  }

  if (leafletLoaderPromise) {
    return leafletLoaderPromise;
  }

  leafletLoaderPromise = new Promise((resolve, reject) => {
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement('link');
      link.id = LEAFLET_CSS_ID;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;

    const handleLoaded = () => {
      if (window.L) {
        resolve(window.L);
        return;
      }

      reject(new Error('The partner map did not initialise correctly.'));
    };

    if (existingScript) {
      existingScript.addEventListener('load', handleLoaded, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load the partner map.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = LEAFLET_SCRIPT_ID;
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.crossOrigin = '';
    script.addEventListener('load', handleLoaded, { once: true });
    script.addEventListener('error', () => reject(new Error('Failed to load the partner map.')), { once: true });
    document.body.appendChild(script);
  });

  return leafletLoaderPromise;
}

function quoteOptionForLeadType(leadType: AssetLeadType | null): AssetQuoteOption | null {
  if (!leadType) return null;
  return ASSET_QUOTE_OPTIONS.find((option) => option.leadType === leadType) ?? null;
}

function formatQuotePartnerType(value: PartnerType): string {
  if (value === 'dealer') return 'Dealer';
  if (value === 'finance') return 'Finance';
  return 'Insurance';
}

function quoteStyleForPartnerType(partnerType: PartnerType | null | undefined): QuoteToneStyle {
  if (partnerType === 'finance') return QUOTE_TONE_STYLES.finance;
  if (partnerType === 'insurance') return QUOTE_TONE_STYLES.insurance;
  return QUOTE_TONE_STYLES.dealer;
}

function quoteToneClassForLeadType(leadType: AssetLeadType): string {
  if (leadType === 'finance') return styles.assetQuoteToneFinance;
  if (leadType === 'insurance') return styles.assetQuoteToneInsurance;
  return styles.assetQuoteToneDealer;
}

function quoteToneClassForPartnerType(partnerType: PartnerType | null | undefined): string {
  if (partnerType === 'finance') return styles.assetQuoteToneFinance;
  if (partnerType === 'insurance') return styles.assetQuoteToneInsurance;
  if (partnerType === 'dealer') return styles.assetQuoteToneDealer;
  return '';
}

function assetPartnerNotes(asset: RegisterAsset): OpenPartnerNote[] {
  const savedNotes = Array.isArray(asset.partnerNotes)
    ? asset.partnerNotes.filter((note) => String(note.noteText ?? '').trim() || note.attachment)
    : [];

  if (savedNotes.length) {
    return savedNotes;
  }

  return asset.openPartnerNote ? [asset.openPartnerNote] : [];
}

function partnerNoteAuthor(note: OpenPartnerNote): string {
  return note.partnerBusinessName || note.partnerName || 'Aim4price partner';
}

function partnerNoteReportLabel(note: OpenPartnerNote, index: number, assetTitle?: string): string {
  const partnerType = note.partnerType ? formatQuotePartnerType(note.partnerType) : 'Partner';
  const assetSuffix = assetTitle ? ` · ${assetTitle}` : '';

  return `${partnerType} note ${index + 1} · ${partnerNoteAuthor(note)}${assetSuffix}`;
}

function partnerNoteReportValue(note: OpenPartnerNote): string {
  const attachmentLabel = note.attachment
    ? `Attached PDF: ${note.attachment.fileName}${note.attachment.byteSize ? ` (${formatByteSize(note.attachment.byteSize)})` : ''}`
    : '';
  const statusLabel = note.status === 'noted' ? 'Status: Noted' : 'Status: Open';
  const sentLabel = note.createdAtIso ? `Sent: ${formatDate(note.createdAtIso)}` : '';

  return [note.noteText, attachmentLabel, statusLabel, sentLabel].filter(Boolean).join('\n');
}

function buildAssetPartnerNoteRows(asset: RegisterAsset, includeAssetTitle = false): ReportKeyValue[] {
  return assetPartnerNotes(asset).map((note, index) => ({
    label: partnerNoteReportLabel(note, index, includeAssetTitle ? asset.title : undefined),
    value: partnerNoteReportValue(note),
  }));
}

function quoteMarkerClassForPartnerType(partnerType: PartnerType | null | undefined): string {
  if (partnerType === 'finance') return 'assetQuoteMapMarker--finance';
  if (partnerType === 'insurance') return 'assetQuoteMapMarker--insurance';
  return 'assetQuoteMapMarker--dealer';
}

function quotePartnerName(partner: PartnerDirectoryEntry): string {
  return partner.businessName || partner.displayName || 'Aim4price business';
}

function quotePartnerLocation(partner: PartnerDirectoryEntry): string {
  return [partner.townCity, partner.province].filter(Boolean).join(', ') || 'Location not saved';
}

function quotePartnerInitial(partner: PartnerDirectoryEntry): string {
  return (quotePartnerName(partner).trim().charAt(0) || 'A').toUpperCase();
}

function normalizeWebsiteHref(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function formatWebsiteDisplay(value: string): string {
  const href = normalizeWebsiteHref(value);

  if (!href) {
    return '';
  }

  try {
    const parsed = new URL(href);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  }
}

function normalizePhoneHref(value: string): string {
  const cleaned = value.replace(/[^+\d]/g, '');
  return cleaned ? `tel:${cleaned}` : '';
}

function normalizeEmailHref(value: string): string {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? `mailto:${trimmed}` : '';
}

function quotePartnerAddress(partner: PartnerDirectoryEntry): string {
  return [partner.addressLine1, partner.townCity, partner.province].filter(Boolean).join(', ') || 'Address not saved';
}

function quotePartnerServicesDisplay(partner: PartnerDirectoryEntry): string {
  return partner.services || formatQuotePartnerType(partner.partnerType);
}

function quotePartnerRadiusDisplay(partner: PartnerDirectoryEntry): string {
  return partner.serviceRadiusKm ? `${partner.serviceRadiusKm} km service radius` : 'Radius not saved';
}

function hasQuotePartnerCoordinates(partner: PartnerDirectoryEntry): boolean {
  return (
    partner.latitude !== null &&
    partner.longitude !== null &&
    Number.isFinite(partner.latitude) &&
    Number.isFinite(partner.longitude) &&
    Math.abs(partner.latitude) <= 90 &&
    Math.abs(partner.longitude) <= 180
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function buildQuotePartnerPopupHtml(partner: PartnerDirectoryEntry): string {
  const name = escapeHtml(quotePartnerName(partner));
  const location = escapeHtml(quotePartnerLocation(partner));
  const radius = escapeHtml(quotePartnerRadiusDisplay(partner));
  const brands = partner.brandFocus ? escapeHtml(partner.brandFocus) : '';
  const services = escapeHtml(quotePartnerServicesDisplay(partner));
  const details = [
    `<div><span>Location</span><strong>${location}</strong></div>`,
    services ? `<div><span>Service</span><strong>${services}</strong></div>` : '',
    brands ? `<div><span>Brands</span><strong>${brands}</strong></div>` : '',
    `<div><span>Radius</span><strong>${radius}</strong></div>`,
  ].filter(Boolean).join('');

  return `
    <div class="assetQuotePopupCard assetQuotePopupCardSimple">
      <div class="assetQuotePopupSimpleHeader">
        <strong>${name}</strong>
      </div>
      <div class="assetQuotePopupDetails assetQuotePopupSimpleDetails">${details}</div>
      <button type="button" data-quote-partner-id="${escapeHtml(partner.userId)}" class="assetQuotePopupChooseButton">Choose this business</button>
    </div>
  `;
}

function extractApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === 'string' && record.error.trim()) return record.error;
    if (typeof record.message === 'string' && record.message.trim()) return record.message;
  }

  return fallback;
}

function renderQuoteOptionIcon(leadType: AssetLeadType, className?: string) {
  if (leadType === 'finance') return <MoneyBagIcon className={className} />;
  if (leadType === 'insurance') return <ShieldIcon className={className} />;
  return <ReplacementQuoteIcon className={className} />;
}

export default function AssetRegisterClient() {
  const [assets, setAssets] = useState<RegisterAsset[]>([]);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [assetRegisters, setAssetRegisters] = useState<AssetRegisterSummary[]>([]);
  const [activeRegister, setActiveRegister] = useState<AssetRegisterSummary | null>(null);
  const [activeRegisterId, setActiveRegisterId] = useState('');
  const [assetDraft, setAssetDraft] = useState<AssetDraft>(initialAssetDraft);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isAddChoiceModalOpen, setIsAddChoiceModalOpen] = useState(false);
  const [manualAssetStep, setManualAssetStep] = useState<ManualAssetStep>(1);
  const [hasManualAssetKindSelection, setHasManualAssetKindSelection] = useState(false);
  const [activeAsset, setActiveAsset] = useState<RegisterAsset | null>(null);
  const [quoteAsset, setQuoteAsset] = useState<RegisterAsset | null>(null);
  const [quoteScope, setQuoteScope] = useState<QuoteScope>('asset');
  const [selectedQuoteLeadType, setSelectedQuoteLeadType] = useState<AssetLeadType | null>(null);
  const [quotePartners, setQuotePartners] = useState<PartnerDirectoryEntry[]>([]);
  const [selectedQuotePartnerId, setSelectedQuotePartnerId] = useState('');
  const [quotePartnerSearch, setQuotePartnerSearch] = useState('');
  const [quoteOwnerMessage, setQuoteOwnerMessage] = useState('');
  const [quoteLeadStep, setQuoteLeadStep] = useState<QuoteLeadStep>(null);
  const [quoteConsentAccepted, setQuoteConsentAccepted] = useState(false);
  const [quoteIncludePhotos, setQuoteIncludePhotos] = useState(true);
  const [quoteIncludeDocuments, setQuoteIncludeDocuments] = useState(true);
  const [quoteIncludeScanHistory, setQuoteIncludeScanHistory] = useState(false);
  const [isLoadingQuotePartners, setIsLoadingQuotePartners] = useState(false);
  const [isSendingQuoteLead, setIsSendingQuoteLead] = useState(false);
  const quoteMapElementRef = useRef<HTMLDivElement | null>(null);
  const quoteLeafletMapRef = useRef<any>(null);
  const quoteMarkerLayerRef = useRef<any>(null);
  const quoteMarkersByPartnerRef = useRef<Map<string, any>>(new Map());
  const [isAssetReportModalOpen, setIsAssetReportModalOpen] = useState(false);
  const [assetReportStep, setAssetReportStep] = useState<AssetReportStep>('options');
  const [assetFuelReportYear, setAssetFuelReportYear] = useState('all');
  const [assetFuelReportMonth, setAssetFuelReportMonth] = useState('all');
  const [assetMaintenanceReportType, setAssetMaintenanceReportType] = useState('all');
  const [assetMaintenanceReportYear, setAssetMaintenanceReportYear] = useState('all');
  const [assetMaintenanceReportMonth, setAssetMaintenanceReportMonth] = useState('all');
  const [openAssetReportSelect, setOpenAssetReportSelect] = useState<AssetReportSelectKey | null>(null);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copiedScanLinkAssetId, setCopiedScanLinkAssetId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [detailMediaUpload, setDetailMediaUpload] = useState<DetailMediaUploadState>(null);
  const [pendingPhotoFiles, setPendingPhotoFiles] = useState<PendingPhotoFile[]>([]);
  const [mainPhotoSelection, setMainPhotoSelection] = useState<MainPhotoSelection | null>(null);
  const pendingPhotoFilesRef = useRef<PendingPhotoFile[]>([]);
  const [pendingDocumentFiles, setPendingDocumentFiles] = useState<File[]>([]);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [detailPhotoIndexByAsset, setDetailPhotoIndexByAsset] = useState<Record<string, number>>({});
  const detailTouchStartXRef = useRef<number | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [deleteCandidateAsset, setDeleteCandidateAsset] = useState<RegisterAsset | null>(null);
  const [marketplaceAsset, setMarketplaceAsset] = useState<RegisterAsset | null>(null);
  const [marketplaceDraft, setMarketplaceDraft] = useState<MarketplacePublishDraft | null>(null);
  const [isPublishingMarketplace, setIsPublishingMarketplace] = useState(false);
  const [busyMarketplaceRemoveId, setBusyMarketplaceRemoveId] = useState<string | null>(null);
  const [busyRevalueAssetId, setBusyRevalueAssetId] = useState<string | null>(null);
  const [busyMaintenanceStatusId, setBusyMaintenanceStatusId] = useState<string | null>(null);
  const [busyRevalueAction, setBusyRevalueAction] = useState<RevalueMethod | null>(null);
  const [pricingPreview, setPricingPreview] = useState<PricingRevaluePreview | null>(null);
  const [isLoadingPricingPreview, setIsLoadingPricingPreview] = useState(false);
  const [isSavingPricingPreview, setIsSavingPricingPreview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assetFilter, setAssetFilter] = useState<AssetFilterKey>('all');
  const [isAssetFilterOpen, setIsAssetFilterOpen] = useState(false);
  const assetFilterWrapRef = useRef<HTMLDivElement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [registerValueVatMode, setRegisterValueVatMode] = useState<'excluded' | 'included'>('excluded');
  const [replacementValueVatMode, setReplacementValueVatMode] = useState<'excluded' | 'included'>('excluded');
  const [registerSummaryStartIndex, setRegisterSummaryStartIndex] = useState(0);
  const [registerSummaryCardsPerView, setRegisterSummaryCardsPerView] = useState(REGISTER_SUMMARY_VISIBLE_CARD_COUNT);
  const registerSummaryViewportRef = useRef<HTMLDivElement | null>(null);
  const registerSummaryScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registerSummaryMaxIndex = Math.max(0, REGISTER_SUMMARY_TOTAL_CARD_COUNT - registerSummaryCardsPerView);
  const isRegisterSummaryAtStart = registerSummaryStartIndex <= 0;
  const isRegisterSummaryAtEnd = registerSummaryStartIndex >= registerSummaryMaxIndex;
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isRegisterShareModalOpen, setIsRegisterShareModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [exportStep, setExportStep] = useState<ExportStep>('format');
  const [pdfReportKind, setPdfReportKind] = useState<PdfReportKind>('full');
  const [pdfReportSelection, setPdfReportSelection] = useState<PdfReportKind | ''>('');
  const [isExporting, setIsExporting] = useState(false);
  const [projectionAsset, setProjectionAsset] = useState<RegisterAsset | null>(null);
  const [projectionForm, setProjectionForm] = useState<ProjectionFormState>(createDefaultProjectionForm());
  const [projectionResult, setProjectionResult] = useState<AssetFutureProjection | null>(null);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const [isLoadingProjection, setIsLoadingProjection] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const documentObjectUrlsRef = useRef<Map<string, CachedDocumentObjectUrl>>(new Map());
  const assetMapActionHandledRef = useRef(false);

  useEffect(() => {
    return () => {
      documentObjectUrlsRef.current.forEach((entry) => {
        URL.revokeObjectURL(entry.objectUrl);

        if (entry.timeoutId !== null) {
          window.clearTimeout(entry.timeoutId);
        }
      });
      documentObjectUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    function handleRegisterSummaryViewportChange() {
      setRegisterSummaryCardsPerView(getRegisterSummaryCardsPerView());
    }

    handleRegisterSummaryViewportChange();
    window.addEventListener('resize', handleRegisterSummaryViewportChange);

    return () => {
      window.removeEventListener('resize', handleRegisterSummaryViewportChange);
    };
  }, []);

  useEffect(() => () => {
    if (registerSummaryScrollTimeoutRef.current) {
      clearTimeout(registerSummaryScrollTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    setRegisterSummaryStartIndex((currentIndex) => Math.min(currentIndex, registerSummaryMaxIndex));
  }, [registerSummaryMaxIndex]);

  useEffect(() => {
    scrollRegisterSummaryToIndex(Math.min(registerSummaryStartIndex, registerSummaryMaxIndex));
  }, [registerSummaryCardsPerView, registerSummaryMaxIndex, registerSummaryStartIndex]);

  function scrollRegisterSummaryToIndex(nextIndex: number) {
    const viewport = registerSummaryViewportRef.current;
    if (!viewport) return;

    const safeIndex = Math.min(registerSummaryMaxIndex, Math.max(0, nextIndex));
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const nextScrollLeft = registerSummaryMaxIndex > 0 ? (maxScrollLeft * safeIndex) / registerSummaryMaxIndex : 0;

    window.requestAnimationFrame(() => {
      viewport.scrollTo({ left: nextScrollLeft, behavior: 'smooth' });
    });
  }

  function handleRegisterSummarySlide(direction: -1 | 1) {
    if (registerSummaryMaxIndex <= 0) return;

    setRegisterSummaryStartIndex((currentIndex) => {
      const nextIndex = Math.min(registerSummaryMaxIndex, Math.max(0, currentIndex + direction));
      scrollRegisterSummaryToIndex(nextIndex);
      return nextIndex;
    });
  }

  function handleRegisterSummaryScroll() {
    const viewport = registerSummaryViewportRef.current;
    if (!viewport || registerSummaryMaxIndex <= 0) return;

    if (registerSummaryScrollTimeoutRef.current) {
      clearTimeout(registerSummaryScrollTimeoutRef.current);
    }

    registerSummaryScrollTimeoutRef.current = setTimeout(() => {
      const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      if (maxScrollLeft <= 0) return;

      const nextIndex = Math.round((viewport.scrollLeft / maxScrollLeft) * registerSummaryMaxIndex);
      setRegisterSummaryStartIndex((currentIndex) => (currentIndex === nextIndex ? currentIndex : nextIndex));
    }, 120);
  }

  function rememberDocumentObjectUrl(cacheKey: string, objectUrl: string): string {
    const existingEntry = documentObjectUrlsRef.current.get(cacheKey);

    if (existingEntry) {
      URL.revokeObjectURL(existingEntry.objectUrl);

      if (existingEntry.timeoutId !== null) {
        window.clearTimeout(existingEntry.timeoutId);
      }
    }

    const timeoutId = window.setTimeout(() => {
      const currentEntry = documentObjectUrlsRef.current.get(cacheKey);

      if (currentEntry?.objectUrl === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        documentObjectUrlsRef.current.delete(cacheKey);
      }
    }, DOCUMENT_OBJECT_URL_TTL_MS);

    documentObjectUrlsRef.current.set(cacheKey, { objectUrl, timeoutId });
    return objectUrl;
  }

  async function openAssetDocument(document: AssetDocument): Promise<void> {
    const documentUrl = String(document.url ?? '').trim();

    if (!documentUrl) {
      setNotice({ tone: 'error', message: 'This document does not have a saved file link.' });
      return;
    }

    if (!isDataDocumentUrl(documentUrl)) {
      window.open(documentUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const cacheKey = document.id || `${document.fileName}-${document.byteSize}-${documentUrl.length}`;
    const cachedEntry = documentObjectUrlsRef.current.get(cacheKey);

    if (cachedEntry?.objectUrl) {
      window.open(cachedEntry.objectUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const targetWindow = window.open('about:blank', '_blank');

    if (!targetWindow) {
      setNotice({ tone: 'error', message: 'Your browser blocked the document tab. Allow pop-ups and try opening it again.' });
      return;
    }

    try {
      targetWindow.opener = null;
    } catch {
      // Ignore browsers that prevent changing opener.
    }

    writeDocumentOpeningPage(targetWindow, document.fileName);

    try {
      const objectUrl = rememberDocumentObjectUrl(cacheKey, await createDataDocumentObjectUrl(documentUrl));
      targetWindow.location.href = objectUrl;
    } catch (error) {
      try {
        targetWindow.close();
      } catch {
        // Ignore close failures.
      }

      console.error('asset document open failed', error);
      setNotice({ tone: 'error', message: 'The saved document could not be opened. Please remove and upload it again.' });
    }
  }
  const projectionRequestRef = useRef(0);
  const projectionResultRef = useRef<HTMLElement | null>(null);
  const [shouldScrollToProjectionResult, setShouldScrollToProjectionResult] = useState(false);
  const projectionYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 16 }, (_, index) => currentYear + index);
  }, []);
  const assetReportYearOptions = useMemo<ReportSelectOption[]>(() => {
    return [
      { value: 'all', label: 'All years' },
      ...getAssetFuelReportYearValues(activeAsset).map((year) => ({ value: year, label: year })),
    ];
  }, [activeAsset]);
  const assetReportMonthOptions = useMemo<ReportSelectOption[]>(() => {
    return [
      { value: 'all', label: 'All months' },
      ...MONTH_LABELS.map((label, index) => ({ value: String(index + 1).padStart(2, '0'), label })),
    ];
  }, []);
  const assetMaintenanceReportTypeOptions = useMemo<ReportSelectOption[]>(() => {
    return [
      { value: 'all', label: 'All' },
      { value: 'checked', label: 'Checked' },
      { value: 'serviced', label: 'Service' },
      { value: 'repaired', label: 'Repair' },
    ];
  }, []);
  const reportProfile = useMemo(
    () => mergeProfileWithRegister(accountProfile, activeRegister),
    [accountProfile, activeRegister],
  );
  const canUseOwnerOnlyAssetActions = true;
  const canUseMarketplaceActions = true;
  const isQuoteModalOpen = Boolean(quoteAsset);
  const isFullRegisterQuoteLead = quoteScope === 'register';

  const selectedQuoteOption = useMemo(() => quoteOptionForLeadType(selectedQuoteLeadType), [selectedQuoteLeadType]);
  const selectedQuotePartner = useMemo(
    () => quotePartners.find((partner) => partner.userId === selectedQuotePartnerId) ?? null,
    [quotePartners, selectedQuotePartnerId],
  );
  const selectedQuotePartnerWebsiteHref = selectedQuotePartner ? normalizeWebsiteHref(selectedQuotePartner.websiteUrl) : '';
  const selectedQuotePartnerEmailHref = selectedQuotePartner ? normalizeEmailHref(selectedQuotePartner.email) : '';
  const selectedQuotePartnerPhoneHref = selectedQuotePartner ? normalizePhoneHref(selectedQuotePartner.phone) : '';
  const quotePartnersWithCoordinates = useMemo(() => quotePartners.filter(hasQuotePartnerCoordinates), [quotePartners]);

  useEffect(() => {
    pendingPhotoFilesRef.current = pendingPhotoFiles;
  }, [pendingPhotoFiles]);

  useEffect(() => {
    return () => {
      pendingPhotoFilesRef.current.forEach((entry) => revokePhotoPreviewUrl(entry.previewUrl));
      pendingPhotoFilesRef.current = [];
    };
  }, []);

  function getDetailPhotos(asset: RegisterAsset): string[] {
    return normalizePhotos(asset.photos);
  }

  function getDetailPhotoIndex(asset: RegisterAsset): number {
    const photos = getDetailPhotos(asset);
    const currentIndex = detailPhotoIndexByAsset[asset.id] ?? 0;
    return Math.max(0, Math.min(currentIndex, photos.length - 1));
  }

  function setDetailPhotoIndex(assetId: string, nextIndex: number) {
    setDetailPhotoIndexByAsset((current) => ({
      ...current,
      [assetId]: Math.max(0, nextIndex),
    }));
  }

  function cycleDetailPhoto(asset: RegisterAsset, direction: 1 | -1) {
    const photos = getDetailPhotos(asset);
    const currentIndex = getDetailPhotoIndex(asset);
    const nextIndex = (currentIndex + direction + photos.length) % photos.length;
    setDetailPhotoIndex(asset.id, nextIndex);
  }

  function handleDetailPhotoTouchStart(clientX: number) {
    detailTouchStartXRef.current = clientX;
  }

  function handleDetailPhotoTouchEnd(asset: RegisterAsset, clientX: number) {
    if (detailTouchStartXRef.current === null) return;
    const delta = clientX - detailTouchStartXRef.current;
    detailTouchStartXRef.current = null;

    if (Math.abs(delta) < 42) {
      return;
    }

    cycleDetailPhoto(asset, delta < 0 ? 1 : -1);
  }

  useEffect(() => {
    let mounted = true;

    async function loadAccountProfile() {
      try {
        const profileResponse = await fetch('/api/account-profile', {
          cache: 'no-store',
          credentials: 'include',
        });

        const profileData = (await profileResponse.json()) as AccountProfileApiResponse;

        if (mounted && profileResponse.ok && profileData.ok && profileData.profile) {
          setAccountProfile(profileData.profile);
        }
      } catch {
        // The register data is the important path here. Profile data can fail without blocking the page.
      }
    }

    async function loadAssetRegister() {
      setIsLoading(true);
      setActiveRegister(null);
      setAssets([]);

      try {
        const requestedRegisterId = readRegisterIdFromLocation();
        setActiveRegisterId(requestedRegisterId);
        void loadAccountProfile();

        const assetsResponse = await fetch(buildAssetRegisterApiUrl(requestedRegisterId), {
          cache: 'no-store',
          credentials: 'include',
        });

        const assetsData = (await assetsResponse.json()) as AssetRegisterApiResponse;

        if (!assetsResponse.ok || !assetsData.ok) {
          throw new Error(assetsData.error ?? 'Failed to load asset register.');
        }

        if (!mounted) return;

        const loadedAssets = Array.isArray(assetsData.items)
          ? assetsData.items
          : Array.isArray(assetsData.assets)
            ? assetsData.assets
            : [];

        setAssets(loadedAssets);

        if (assetsData.register) {
          setActiveRegister(assetsData.register);
          setActiveRegisterId(assetsData.register.id);
        } else {
          setActiveRegister(null);
        }

        if (Array.isArray(assetsData.registers)) {
          setAssetRegisters(assetsData.registers);
        }
      } catch (error) {
        if (!mounted) return;

        setNotice({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Failed to load your asset register.',
        });
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAssetRegister();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (assetMapActionHandledRef.current || isLoading || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const action = params.get('mapAction');
    const assetId = params.get('assetId');

    if (!assetId || (action !== 'options' && action !== 'manage')) return;

    const targetAsset = assets.find((asset) => asset.id === assetId);
    if (!targetAsset) return;

    assetMapActionHandledRef.current = true;
    setExpandedAssetId(targetAsset.id);
    scrollToAssetCard(targetAsset.id);

    if (action === 'options') {
      openAssetQuoteOptions(targetAsset);
    } else {
      openActionDialog(targetAsset);
    }

    window.history.replaceState(null, '', `${window.location.pathname}#asset-card-${encodeURIComponent(targetAsset.id)}`);
  }, [assets, isLoading]);

  useEffect(() => {
    if (!projectionResult || !shouldScrollToProjectionResult) return undefined;

    const timeout = window.setTimeout(() => {
      projectionResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setShouldScrollToProjectionResult(false);
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [projectionResult, shouldScrollToProjectionResult]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, assetFilter]);

  useEffect(() => {
    if (!isAssetFilterOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && assetFilterWrapRef.current?.contains(target)) {
        return;
      }

      setIsAssetFilterOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isAssetFilterOpen]);

  useEffect(() => {
    if (!openAssetReportSelect) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (target instanceof HTMLElement && target.closest('[data-asset-report-select-root="true"]')) {
        return;
      }

      setOpenAssetReportSelect(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [openAssetReportSelect]);

  const anyModalOpen =
    isAddChoiceModalOpen ||
    isAssetModalOpen ||
    Boolean(activeAsset) ||
    isQuoteModalOpen ||
    Boolean(deleteCandidateAsset) ||
    isAssetReportModalOpen ||
    isPricingModalOpen ||
    Boolean(pricingPreview) ||
    isQrModalOpen ||
    isSummaryModalOpen ||
    isRegisterShareModalOpen ||
    isExportModalOpen ||
    Boolean(projectionAsset) ||
    Boolean(marketplaceAsset);

  useEffect(() => {
    if (!anyModalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      setIsAssetFilterOpen(false);

      if (deleteCandidateAsset) {
        closeDeleteConfirmDialog();
        return;
      }

      if (pricingPreview) {
        closePricingPreviewDialog();
        return;
      }

      if (isPricingModalOpen) {
        closePricingDialog();
        return;
      }

      if (isAssetReportModalOpen) {
        closeAssetReportDialog();
        return;
      }

      if (isQrModalOpen) {
        closeQrDialog();
        return;
      }

      if (projectionAsset) {
        closeProjectionModal();
        return;
      }

      if (marketplaceAsset) {
        closeMarketplaceModal();
        return;
      }

      if (isQuoteModalOpen) {
        if (quoteLeadStep) {
          closeQuoteLeadStep();
          return;
        }

        closeAssetQuoteModal();
        return;
      }

      if (activeAsset) {
        closeActionDialog();
        return;
      }

      if (isAddChoiceModalOpen) {
        closeAddAssetChoiceModal();
        return;
      }

      if (isSummaryModalOpen) {
        closeSummaryModal();
        return;
      }

      if (isRegisterShareModalOpen) {
        closeRegisterShareModal();
        return;
      }

      if (isExportModalOpen) {
        closeExportModal();
        return;
      }

      if (isAssetModalOpen) {
        closeAssetModal();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeAsset, anyModalOpen, deleteCandidateAsset, isAddChoiceModalOpen, isAssetModalOpen, isAssetReportModalOpen, isExportModalOpen, isPricingModalOpen, pricingPreview, isQrModalOpen, isRegisterShareModalOpen, isSummaryModalOpen, marketplaceAsset, projectionAsset, isQuoteModalOpen, quoteLeadStep]);

  useEffect(() => {
    if (!isQuoteModalOpen || !selectedQuoteLeadType) return;
    void loadQuotePartners(selectedQuoteLeadType, '');
  }, [isQuoteModalOpen, selectedQuoteLeadType]);

  useEffect(() => {
    if (!isQuoteModalOpen || !selectedQuoteOption || !quoteMapElementRef.current || !quotePartnersWithCoordinates.length) {
      return undefined;
    }

    let cancelled = false;

    async function setupQuoteMap() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !quoteMapElementRef.current) return;

        if (!quoteLeafletMapRef.current) {
          quoteLeafletMapRef.current = L.map(quoteMapElementRef.current, { zoomControl: true }).setView(
            DEFAULT_PARTNER_MAP_CENTER,
            DEFAULT_PARTNER_MAP_ZOOM,
          );

          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          }).addTo(quoteLeafletMapRef.current);
        }

        if (quoteMarkerLayerRef.current) {
          quoteMarkerLayerRef.current.clearLayers();
        } else {
          quoteMarkerLayerRef.current = L.layerGroup().addTo(quoteLeafletMapRef.current);
        }

        quoteMarkersByPartnerRef.current.clear();
        const bounds = L.latLngBounds([]);

        quotePartnersWithCoordinates.forEach((partner) => {
          const lat = Number(partner.latitude);
          const lng = Number(partner.longitude);
          const isActive = selectedQuotePartnerId === partner.userId;
          const icon = L.divIcon({
            className: `assetQuoteMapMarker ${quoteMarkerClassForPartnerType(partner.partnerType)}${isActive ? ' assetQuoteMapMarker--active' : ''}`,
            html: '<span class="assetQuoteMapMarkerPin"></span>',
            iconSize: [38, 44],
            iconAnchor: [19, 40],
            popupAnchor: [0, -36],
          });
          const marker = L.marker([lat, lng], { icon, title: quotePartnerName(partner) }).addTo(quoteMarkerLayerRef.current);
          marker.bindPopup(buildQuotePartnerPopupHtml(partner), {
            className: 'assetQuotePartnerPopup',
            minWidth: 320,
            maxWidth: 430,
            autoPan: true,
            autoPanPadding: [34, 34],
          });
          marker.on('click', () => focusQuotePartnerOnMap(partner));
          quoteMarkersByPartnerRef.current.set(partner.userId, marker);
          bounds.extend([lat, lng]);
        });

        if (bounds.isValid()) {
          quoteLeafletMapRef.current.fitBounds(bounds.pad(0.18), { maxZoom: 12 });
        }

        const selectedMarker = selectedQuotePartnerId ? quoteMarkersByPartnerRef.current.get(selectedQuotePartnerId) : null;
        if (selectedMarker) {
          window.setTimeout(() => {
            if (!cancelled) {
              const selectedLatLng = selectedMarker.getLatLng();
              const currentZoom = typeof quoteLeafletMapRef.current?.getZoom === 'function' ? quoteLeafletMapRef.current.getZoom() : DEFAULT_PARTNER_MAP_ZOOM;
              const nextZoom = Math.max(currentZoom, 11);
              selectedMarker.openPopup();
              if (typeof quoteLeafletMapRef.current?.flyTo === 'function') {
                quoteLeafletMapRef.current.flyTo(selectedLatLng, nextZoom, { animate: true, duration: 0.35 });
              } else {
                quoteLeafletMapRef.current?.setView(selectedLatLng, nextZoom, { animate: true });
              }
            }
          }, 120);
        }

        window.setTimeout(() => quoteLeafletMapRef.current?.invalidateSize(), 80);
      } catch (error) {
        setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load the partner map.' });
      }
    }

    void setupQuoteMap();

    return () => {
      cancelled = true;
    };
  }, [isQuoteModalOpen, selectedQuoteOption, quotePartnersWithCoordinates, selectedQuotePartnerId]);

  useEffect(() => {
    if (!isQuoteModalOpen || !selectedQuoteOption) return undefined;

    const handleQuotePopupSelect = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const button = target.closest<HTMLButtonElement>('[data-quote-partner-id]');
      if (!button) return;

      const partnerId = button.getAttribute('data-quote-partner-id');
      const partner = quotePartners.find((entry) => entry.userId === partnerId);
      if (!partner) return;

      event.preventDefault();
      event.stopPropagation();
      openQuoteLeadMessage(partner);
    };

    document.addEventListener('click', handleQuotePopupSelect, true);
    return () => document.removeEventListener('click', handleQuotePopupSelect, true);
  }, [isQuoteModalOpen, selectedQuoteOption, quotePartners]);

  useEffect(() => {
    if (isQuoteModalOpen && selectedQuoteOption && quotePartnersWithCoordinates.length) {
      return undefined;
    }

    if (quoteLeafletMapRef.current) {
      quoteLeafletMapRef.current.remove();
      quoteLeafletMapRef.current = null;
      quoteMarkerLayerRef.current = null;
      quoteMarkersByPartnerRef.current.clear();
    }

    return undefined;
  }, [isQuoteModalOpen, selectedQuoteOption, quotePartnersWithCoordinates.length]);

  const totalValue = useMemo(() => {
    return assets.reduce((sum, asset) => sum + Math.round(Number(asset.value || 0)), 0);
  }, [assets]);

  const totalValueInclVat = useMemo(() => Math.round(totalValue * 1.15), [totalValue]);
  const displayedRegisterValue = registerValueVatMode === 'included' ? totalValueInclVat : totalValue;
  const totalReplacementValue = useMemo(() => sumAssetReplacementValues(assets), [assets]);
  const totalReplacementValueInclVat = useMemo(() => Math.round(totalReplacementValue * 1.15), [totalReplacementValue]);
  const displayedReplacementValue = replacementValueVatMode === 'included' ? totalReplacementValueInclVat : totalReplacementValue;
  const replacementPricedAssetCount = useMemo(() => countAssetsWithReplacementPrice(assets), [assets]);

  const aim4priceValuedEquipmentCount = useMemo(() => {
    return assets.filter((asset) => isAim4priceValuedAsset(asset)).length;
  }, [assets]);

  const aim4priceValuedEquipmentValue = useMemo(() => {
    return assets
      .filter((asset) => isAim4priceValuedAsset(asset))
      .reduce((sum, asset) => sum + Math.round(Number(asset.value || 0)), 0);
  }, [assets]);

  const manualAssetStats = useMemo(() => {
    return assets
      .filter((asset) => asset.selectedMethod === 'manual')
      .reduce(
        (stats, asset) => ({
          count: stats.count + 1,
          value: stats.value + Math.round(Number(asset.value || 0)),
        }),
        { count: 0, value: 0 },
      );
  }, [assets]);

  const financedAssetStats = useMemo(() => {
    return assets.reduce(
      (stats, asset) => {
        if (readFinanceStatusChoice(asset) !== 'yes') {
          return stats;
        }

        return {
          count: stats.count + 1,
          value: stats.value + Math.round(Number(asset.value || 0)),
        };
      },
      { count: 0, value: 0 },
    );
  }, [assets]);

  const insuredAssetStats = useMemo(() => {
    return assets.reduce(
      (stats, asset) => {
        if (readInsuranceStatusChoice(asset) !== 'yes') {
          return stats;
        }

        return {
          count: stats.count + 1,
          value: stats.value + Math.round(Number(asset.value || 0)),
        };
      },
      { count: 0, value: 0 },
    );
  }, [assets]);

  const licensedAssetStats = useMemo(() => {
    return assets.reduce(
      (stats, asset) => {
        if (readLicenseStatusChoice(asset) !== 'yes') {
          return stats;
        }

        return {
          count: stats.count + 1,
          value: stats.value + Math.round(Number(asset.value || 0)),
        };
      },
      { count: 0, value: 0 },
    );
  }, [assets]);


  const editingAsset = useMemo(() => {
    return editingAssetId === null ? null : assets.find((asset) => asset.id === editingAssetId) ?? null;
  }, [assets, editingAssetId]);

  const assetFormKind = useMemo<AssetKind>(() => {
    return editingAsset?.valuationRunId ? editingAsset.kind : normalizeDraftKind(assetDraft.kind);
  }, [assetDraft.kind, editingAsset]);

  const assetFormUsesPercentUsage = useMemo(() => {
    return editingAsset ? assetUsesPercentUsage(editingAsset) : false;
  }, [editingAsset]);

  const showUsageHoursField = useMemo(() => {
    if (assetFormUsesPercentUsage) return false;
    return assetFormKind === 'tractor' || assetFormKind === 'equipment' || assetFormKind === 'vehicle';
  }, [assetFormKind, assetFormUsesPercentUsage]);

  const showConditionField = useMemo(() => {
    return assetFormKind !== 'property';
  }, [assetFormKind]);

  const showLifeWorkedPercentField = useMemo(() => {
    if (editingAsset) return assetFormUsesPercentUsage;
    return assetFormKind === 'tractor' || assetFormKind === 'equipment' || assetFormKind === 'tools';
  }, [assetFormKind, assetFormUsesPercentUsage, editingAsset]);

  const yearFieldLabel = draftYearLabel(assetFormKind);
  const usageFieldLabel =
    assetFormKind === 'vehicle'
      ? assetDraft.usageMetric === 'km'
        ? 'Odometer reading'
        : 'Vehicle hours'
      : 'Machine hours';
  const usageFieldPlaceholder =
    assetFormKind === 'vehicle'
      ? assetDraft.usageMetric === 'km'
        ? 'Enter kilometres'
        : 'Enter vehicle hours'
      : 'Enter machine hours';
  const usageFieldHint =
    assetFormKind === 'vehicle'
      ? assetDraft.usageMetric === 'km'
        ? 'Vehicle usage will show as kilometres across the register and marketplace.'
        : 'Vehicle usage will show as hours across the register and marketplace.'
      : 'This can be updated later whenever the machine hours change.';

  const activeAssetFilterLabel = useMemo(() => {
    return ASSET_FILTER_OPTIONS.find((option) => option.value === assetFilter)?.label ?? 'All assets';
  }, [assetFilter]);

  const filteredAssets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    let nextAssets = normalizedSearch
      ? assets.filter((asset) => buildSearchableText(asset).includes(normalizedSearch))
      : [...assets];

    switch (assetFilter) {
      case 'insured':
        nextAssets = nextAssets.filter((asset) => readInsuranceStatusChoice(asset) === 'yes');
        break;
      case 'not-insured':
        nextAssets = nextAssets.filter((asset) => readInsuranceStatusChoice(asset) === 'no');
        break;
      case 'financed':
        nextAssets = nextAssets.filter((asset) => readFinanceStatusChoice(asset) === 'yes');
        break;
      case 'not-financed':
        nextAssets = nextAssets.filter((asset) => readFinanceStatusChoice(asset) === 'no');
        break;
      case 'licensed':
        nextAssets = nextAssets.filter((asset) => readLicenseStatusChoice(asset) === 'yes');
        break;
      case 'not-licensed':
        nextAssets = nextAssets.filter((asset) => readLicenseStatusChoice(asset) === 'no');
        break;
      case 'highest-value':
      case 'lowest-value':
      case 'highest-replacement-price':
      case 'lowest-replacement-price':
        break;
      case 'aim4price-value':
        nextAssets = nextAssets.filter((asset) => isAim4priceValuedAsset(asset));
        break;
      case 'manual-value':
        nextAssets = nextAssets.filter((asset) => asset.selectedMethod === 'manual');
        break;
      case 'marketplace':
        nextAssets = nextAssets.filter((asset) => isLiveOnMarketplace(asset));
        break;
      case 'all':
      default:
        break;
    }

    return sortAssetsByRegisterPriority(nextAssets, assetFilter);
  }, [assets, assetFilter, searchTerm]);

  const pageCount = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(filteredAssets.length, pageStart + PAGE_SIZE);
  const visibleAssets = filteredAssets.slice(pageStart, pageStart + PAGE_SIZE);
  const paginationItems = useMemo(() => buildPaginationItems(currentPage, pageCount), [currentPage, pageCount]);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  useEffect(() => {
    if (!expandedAssetId) return;

    const currentPageAssets = filteredAssets.slice(pageStart, pageStart + PAGE_SIZE);

    if (!currentPageAssets.some((asset) => asset.id === expandedAssetId)) {
      setExpandedAssetId(null);
    }
  }, [expandedAssetId, filteredAssets, pageStart]);

  function resetEditor() {
    pendingPhotoFilesRef.current.forEach((entry) => revokePhotoPreviewUrl(entry.previewUrl));
    pendingPhotoFilesRef.current = [];

    setEditingAssetId(null);
    setAssetDraft(initialAssetDraft);
    setManualAssetStep(1);
    setHasManualAssetKindSelection(false);
    setMainPhotoSelection(null);
    setPendingPhotoFiles([]);
    setPendingDocumentFiles([]);

    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }

    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  }

  function openAddAssetChoiceModal() {
    setNotice(null);
    setIsAssetFilterOpen(false);
    setIsAddChoiceModalOpen(true);
  }

  function closeAddAssetChoiceModal() {
    setIsAddChoiceModalOpen(false);
  }

  function openCreateModal() {
    resetEditor();
    setManualAssetStep(1);
    setIsAssetModalOpen(true);
  }

  function openManualEntryFromChoice() {
    closeAddAssetChoiceModal();
    openCreateModal();
  }

  function closeAssetModal() {
    setIsAssetModalOpen(false);
    resetEditor();
  }

  function openUpdater(asset: RegisterAsset) {
    pendingPhotoFilesRef.current.forEach((entry) => revokePhotoPreviewUrl(entry.previewUrl));
    pendingPhotoFilesRef.current = [];

    setPendingPhotoFiles([]);
    setPendingDocumentFiles([]);
    setMainPhotoSelection(null);
    setEditingAssetId(asset.id);
    setAssetDraft(buildDraftFromAsset(asset));
    setManualAssetStep(2);
    setHasManualAssetKindSelection(true);
    setIsAssetModalOpen(true);
  }

  function selectManualAssetKind(nextKind: AssetKind, shouldAdvance = false) {
    setHasManualAssetKindSelection(true);

    setAssetDraft((current) => ({
      ...current,
      kind: nextKind,
      hours: nextKind === 'property' || nextKind === 'tools' || nextKind === 'manual' ? '' : current.hours,
      usageMetric: nextKind === 'vehicle' ? normalizeUsageMetric(current.usageMetric, 'vehicle') : 'hours',
      lifeWorkedPercent: nextKind === 'property' || nextKind === 'vehicle' || nextKind === 'manual' ? '' : current.lifeWorkedPercent,
      condition: nextKind === 'property' ? '' : current.condition,
    }));

    if (shouldAdvance) {
      setManualAssetStep(2);
    }
  }

  function setAssetFinanceStatus(nextStatus: AssetStatusChoice) {
    setAssetDraft((current) => ({
      ...current,
      financeStatus: nextStatus,
      isFinanced: nextStatus === 'yes',
      financeNote: nextStatus === 'yes' ? current.financeNote : '',
    }));
  }

  function setAssetInsuranceStatus(nextStatus: AssetStatusChoice) {
    setAssetDraft((current) => ({
      ...current,
      insuranceStatus: nextStatus,
      isInsured: nextStatus === 'yes',
      insuranceNote: nextStatus === 'yes' ? current.insuranceNote : '',
    }));
  }

  function setAssetLicenseStatus(nextStatus: AssetStatusChoice) {
    setAssetDraft((current) => ({
      ...current,
      licenseStatus: nextStatus,
      isLicensed: nextStatus === 'yes',
      licenseRegistrationNumber: nextStatus === 'yes' ? current.licenseRegistrationNumber : '',
    }));
  }

  function validateAssetDetailsDraft(): boolean {
    const value = parseRegisterValueInput(assetDraft.value);
    const replacementPrice = parseRegisterValueInput(assetDraft.replacementPrice);
    const hasYearModel = assetDraft.yearModel.trim() !== '';
    const yearModel = hasYearModel ? Number(assetDraft.yearModel) : null;
    const hasHours = assetDraft.hours.trim() !== '';
    const hours = hasHours ? parseUsageAmountInput(assetDraft.hours) : null;
    const hasLifeWorkedPercent = assetDraft.lifeWorkedPercent.trim() !== '';
    const lifeWorkedPercent = hasLifeWorkedPercent ? Number(assetDraft.lifeWorkedPercent) : null;
    const usageErrorLabel = assetDraft.usageMetric === 'km' ? 'Kilometres' : 'Machine hours';

    if (!assetDraft.title.trim() || value <= 0) {
      setNotice({ tone: 'error', message: 'Asset title and current value are required before moving to the next step.' });
      return false;
    }

    if (!replacementPrice || replacementPrice <= 0) {
      setNotice({ tone: 'error', message: 'Replacement price is required and must be greater than zero.' });
      return false;
    }

    if (hasYearModel && (!Number.isFinite(yearModel) || Number(yearModel) < 1800 || Number(yearModel) > new Date().getFullYear() + 1)) {
      setNotice({ tone: 'error', message: `${yearFieldLabel} must be a valid year.` });
      return false;
    }

    if (hasHours && (!Number.isFinite(hours) || Number(hours) < 0)) {
      setNotice({ tone: 'error', message: `${usageErrorLabel} must be zero or greater.` });
      return false;
    }

    if (hasLifeWorkedPercent && (!Number.isFinite(lifeWorkedPercent) || Number(lifeWorkedPercent) < 0 || Number(lifeWorkedPercent) > 100)) {
      setNotice({ tone: 'error', message: 'Lifetime worked must be between 0% and 100%.' });
      return false;
    }

    if (
      editingAsset &&
      hasHours &&
      editingAsset.hours !== null &&
      typeof editingAsset.hours !== 'undefined' &&
      Number(hours) < Number(editingAsset.hours)
    ) {
      setNotice({
        tone: 'error',
        message: `${usageErrorLabel} cannot be lower than the reading already saved on this asset.`,
      });
      return false;
    }

    const currentLifeWorkedPercent = editingAsset ? getAssetLifeWorkedPercent(editingAsset) : null;
    if (
      editingAsset &&
      hasLifeWorkedPercent &&
      currentLifeWorkedPercent !== null &&
      Number(lifeWorkedPercent) < currentLifeWorkedPercent
    ) {
      setNotice({
        tone: 'error',
        message: 'Lifetime worked cannot be lower than the percentage already saved on this asset.',
      });
      return false;
    }

    return true;
  }

  function goToPreviousManualAssetStep() {
    setManualAssetStep((current) => {
      if (current <= 1) return 1;
      return (current - 1) as ManualAssetStep;
    });
  }

  function goToNextManualAssetStep() {
    if (manualAssetStep === 2 && !validateAssetDetailsDraft()) {
      return;
    }

    setManualAssetStep((current) => {
      if (current >= 4) return 4;
      return (current + 1) as ManualAssetStep;
    });
  }

  function scrollToAssetCard(assetId: string) {
    window.setTimeout(() => {
      document.getElementById(`asset-card-${assetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);
  }

  function openActionDialog(asset: RegisterAsset) {
    setActiveAsset(asset);
  }

  function closeActionDialog() {
    setIsAssetReportModalOpen(false);
    setIsPricingModalOpen(false);
    setPricingPreview(null);
    setIsLoadingPricingPreview(false);
    setIsSavingPricingPreview(false);
    setIsQrModalOpen(false);
    setCopiedScanLinkAssetId(null);
    setDeleteCandidateAsset(null);
    setActiveAsset(null);
  }

  function syncUpdatedAsset(nextAsset: RegisterAsset) {
    setAssets((current) => [nextAsset, ...current.filter((asset) => asset.id !== nextAsset.id)]);
    setCurrentPage(1);
    setActiveAsset((current) => (current?.id === nextAsset.id ? nextAsset : current));
    setMarketplaceAsset((current) => (current?.id === nextAsset.id ? nextAsset : current));
    setProjectionAsset((current) => (current?.id === nextAsset.id ? nextAsset : current));
  }

  function syncMediaUpdatedAsset(nextAsset: RegisterAsset) {
    setAssets((current) => current.map((asset) => (asset.id === nextAsset.id ? nextAsset : asset)));
    setActiveAsset((current) => (current?.id === nextAsset.id ? nextAsset : current));
    setMarketplaceAsset((current) => (current?.id === nextAsset.id ? nextAsset : current));
    setProjectionAsset((current) => (current?.id === nextAsset.id ? nextAsset : current));
  }

  function resetAssetQuoteState(nextScope: QuoteScope = 'asset') {
    setQuoteScope(nextScope);
    setSelectedQuoteLeadType(null);
    setQuotePartners([]);
    setSelectedQuotePartnerId('');
    setQuotePartnerSearch('');
    setQuoteLeadStep(null);
    setQuoteConsentAccepted(false);
    setQuoteOwnerMessage('');
    setQuoteLeadStep(null);
    setQuoteConsentAccepted(false);
    setQuoteIncludePhotos(true);
    setQuoteIncludeDocuments(true);
    setQuoteIncludeScanHistory(false);
    setIsLoadingQuotePartners(false);
    setIsSendingQuoteLead(false);

    if (quoteLeafletMapRef.current) {
      quoteLeafletMapRef.current.remove();
      quoteLeafletMapRef.current = null;
      quoteMarkerLayerRef.current = null;
      quoteMarkersByPartnerRef.current.clear();
    }
  }

  function openAssetQuoteOptions(asset: RegisterAsset) {
    setNotice(null);
    setIsAssetFilterOpen(false);
    resetAssetQuoteState('asset');
    setQuoteAsset(asset);
  }

  function closeAssetQuoteModal() {
    if (isSendingQuoteLead) return;
    setQuoteAsset(null);
    resetAssetQuoteState('asset');
  }

  async function loadQuotePartners(leadType: AssetLeadType | null = selectedQuoteLeadType, searchValue = quotePartnerSearch) {
    const option = quoteOptionForLeadType(leadType);

    if (!option) {
      setQuotePartners([]);
      setSelectedQuotePartnerId('');
      return;
    }

    setIsLoadingQuotePartners(true);

    try {
      const params = new URLSearchParams({ type: option.partnerType });
      if (searchValue.trim()) params.set('search', searchValue.trim());

      const response = await fetch(`/api/partners?${params.toString()}`, { cache: 'no-store', credentials: 'include' });
      const payload = await response.json().catch(() => null);
      const data = payload as PartnerDirectoryApiResponse | null;

      if (!response.ok || !data?.ok || !Array.isArray(data.partners)) {
        throw new Error(extractApiError(payload, 'Failed to load partner directory.'));
      }

      setQuotePartners(data.partners);
      setSelectedQuotePartnerId((current) => (data.partners?.some((partner) => partner.userId === current) ? current : ''));
    } catch (error) {
      setQuotePartners([]);
      setSelectedQuotePartnerId('');
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load partner directory.' });
    } finally {
      setIsLoadingQuotePartners(false);
    }
  }

  function openQuotePartnerPicker(leadType: AssetLeadType) {
    setSelectedQuoteLeadType(leadType);
    setSelectedQuotePartnerId('');
    setQuotePartnerSearch('');
    setQuoteOwnerMessage('');
    setQuoteLeadStep(null);
    setQuoteConsentAccepted(false);
    setQuotePartners([]);
    setQuoteIncludePhotos(true);
    setQuoteIncludeDocuments(true);
    setQuoteIncludeScanHistory(false);
  }

  function goBackToQuoteOptions() {
    if (isFullRegisterQuoteLead) {
      setQuoteAsset(null);
      resetAssetQuoteState('asset');
      setIsRegisterShareModalOpen(true);
      return;
    }

    setSelectedQuoteLeadType(null);
    setQuotePartners([]);
    setSelectedQuotePartnerId('');
    setQuotePartnerSearch('');
    setQuoteLeadStep(null);
    setQuoteConsentAccepted(false);

    if (quoteLeafletMapRef.current) {
      quoteLeafletMapRef.current.remove();
      quoteLeafletMapRef.current = null;
      quoteMarkerLayerRef.current = null;
      quoteMarkersByPartnerRef.current.clear();
    }
  }

  function focusQuotePartnerOnMap(partner: PartnerDirectoryEntry) {
    setSelectedQuotePartnerId(partner.userId);

    const marker = quoteMarkersByPartnerRef.current.get(partner.userId);
    const map = quoteLeafletMapRef.current;

    if (!map || !marker) return;

    const latLng = marker.getLatLng();
    const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : DEFAULT_PARTNER_MAP_ZOOM;
    const nextZoom = Math.max(currentZoom, 11);

    if (typeof map.flyTo === 'function') {
      map.flyTo(latLng, nextZoom, { animate: true, duration: 0.35 });
    } else {
      map.setView(latLng, nextZoom, { animate: true });
    }

    window.setTimeout(() => {
      marker.openPopup();
    }, 120);
  }

  function openQuoteLeadMessage(partner: PartnerDirectoryEntry) {
    setSelectedQuotePartnerId(partner.userId);
    setQuoteConsentAccepted(false);
    setQuoteLeadStep('message');
  }

  function closeQuoteLeadStep() {
    if (isSendingQuoteLead) return;
    setQuoteLeadStep(null);
    setQuoteConsentAccepted(false);
  }

  function goToQuoteLeadConsent() {
    if (!selectedQuotePartner || !selectedQuoteOption) {
      setNotice({ tone: 'error', message: 'Choose a company first.' });
      return;
    }

    setQuoteConsentAccepted(false);
    setQuoteLeadStep('consent');
  }

  function goBackToQuoteLeadMessage() {
    if (isSendingQuoteLead) return;
    setQuoteConsentAccepted(false);
    setQuoteLeadStep('message');
  }

  async function handleSendAssetQuoteLead() {
    if (!selectedQuoteOption || !quoteAsset) {
      setNotice({ tone: 'error', message: 'Choose an asset quote option first.' });
      return;
    }

    const leadAssetId = quoteAsset.id;

    if (!selectedQuotePartner) {
      setNotice({ tone: 'error', message: `Choose a ${formatQuotePartnerType(selectedQuoteOption.partnerType).toLowerCase()} company first.` });
      return;
    }

    if (!quoteConsentAccepted) {
      setNotice({ tone: 'error', message: 'Accept the POPIA and permission note before sending this request.' });
      return;
    }

    setIsSendingQuoteLead(true);

    try {
      const profile = isFullRegisterQuoteLead ? reportProfile ?? (await ensureAccountProfile()) : null;
      const includedSections = isFullRegisterQuoteLead
        ? buildFullRegisterLeadSections(selectedQuoteOption.leadType, profile)
        : {
            assetDetails: true,
            valuationSummary: true,
            mainPhoto: true,
            photos: quoteIncludePhotos,
            documents: quoteIncludeDocuments,
            scanHistory: quoteIncludeScanHistory,
            source: 'asset_register_options',
          };

      const response = await fetch('/api/asset-leads', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: leadAssetId,
          partnerUserId: selectedQuotePartner.userId,
          leadType: selectedQuoteOption.leadType,
          ownerMessage: quoteOwnerMessage,
          includedSections,
        }),
      });

      const payload = await response.json().catch(() => null);
      const data = payload as AssetLeadApiResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(extractApiError(payload, 'Failed to send asset lead.'));
      }

      const fullRegisterQuoteLabel = selectedQuoteOption.leadType === 'insurance' ? 'insurance quote' : 'refinance quote';

      setNotice({
        tone: 'success',
        message: isFullRegisterQuoteLead
          ? `Full Asset Register ${fullRegisterQuoteLabel} sent to ${quotePartnerName(selectedQuotePartner)}.`
          : `${selectedQuoteOption.shortTitle.toLowerCase()} request sent to ${quotePartnerName(selectedQuotePartner)}.`,
      });
      closeAssetQuoteModal();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to send asset lead.' });
    } finally {
      setIsSendingQuoteLead(false);
    }
  }

  function openDeleteConfirmDialog(asset: RegisterAsset) {
    setDeleteCandidateAsset(asset);
  }

  function closeDeleteConfirmDialog() {
    if (busyDeleteId) return;
    setDeleteCandidateAsset(null);
  }

  function openAssetReportDialog() {
    setIsPricingModalOpen(false);
    setIsQrModalOpen(false);
    setCopiedScanLinkAssetId(null);
    setAssetReportStep('options');
    setAssetFuelReportYear('all');
    setAssetFuelReportMonth('all');
    setAssetMaintenanceReportType('all');
    setAssetMaintenanceReportYear('all');
    setAssetMaintenanceReportMonth('all');
    setOpenAssetReportSelect(null);
    setIsAssetReportModalOpen(true);
  }

  function closeAssetReportDialog() {
    setIsAssetReportModalOpen(false);
    setAssetReportStep('options');
    setAssetFuelReportYear('all');
    setAssetFuelReportMonth('all');
    setAssetMaintenanceReportType('all');
    setAssetMaintenanceReportYear('all');
    setAssetMaintenanceReportMonth('all');
    setOpenAssetReportSelect(null);
  }

  function openPricingDialog() {
    setIsAssetReportModalOpen(false);
    setIsQrModalOpen(false);
    setCopiedScanLinkAssetId(null);
    setIsPricingModalOpen(true);
  }

  function closePricingDialog() {
    if (isLoadingPricingPreview || isSavingPricingPreview) return;
    setPricingPreview(null);
    setIsPricingModalOpen(false);
  }

  function closePricingPreviewDialog() {
    if (isLoadingPricingPreview || isSavingPricingPreview) return;
    setPricingPreview(null);
  }

  function openQrDialog() {
    setIsAssetReportModalOpen(false);
    setIsPricingModalOpen(false);
    setIsQrModalOpen(true);
  }

  function closeQrDialog() {
    setIsQrModalOpen(false);
    setCopiedScanLinkAssetId(null);
  }

  async function openMarketplaceModal(asset: RegisterAsset) {
    closeActionDialog();
    const profile = await ensureAccountProfile();
    setMarketplaceAsset(asset);
    setMarketplaceDraft(createMarketplaceDraft(asset, profile));
    setIsPublishingMarketplace(false);
  }

  function closeMarketplaceModal() {
    setMarketplaceAsset(null);
    setMarketplaceDraft(null);
    setIsPublishingMarketplace(false);
  }

  async function ensureAccountProfile(): Promise<AccountProfile | null> {
    if (accountProfile) {
      return accountProfile;
    }

    try {
      const response = await fetch('/api/account-profile', {
        cache: 'no-store',
        credentials: 'include',
      });

      const data = (await response.json()) as AccountProfileApiResponse;

      if (!response.ok || !data.ok || !data.profile) {
        return null;
      }

      setAccountProfile(data.profile);
      return data.profile;
    } catch {
      return null;
    }
  }

  function handlePhotoFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!selectedFiles.length) {
      return;
    }

    const filesToQueue = selectedFiles.slice(0, MAX_PHOTOS).map((file) => ({
      id: createPendingPhotoId(),
      file,
      previewUrl: createPhotoPreviewUrl(file),
    }));

    setPendingPhotoFiles((current) => {
      const combined = [...current, ...filesToQueue];
      const next = combined.slice(-MAX_PHOTOS);
      const removed = combined.slice(0, combined.length - next.length);

      removed.forEach((entry) => revokePhotoPreviewUrl(entry.previewUrl));
      pendingPhotoFilesRef.current = next;
      return next;
    });

    const willReplaceOldPhotos = assetDraft.photos.length + pendingPhotoFiles.length + filesToQueue.length > MAX_PHOTOS;
    setNotice({
      tone: 'success',
      message: `${filesToQueue.length} photo${filesToQueue.length === 1 ? '' : 's'} ready.${willReplaceOldPhotos ? ` New photos will replace the oldest saved photos once the ${editingAsset ? 'asset is updated' : 'asset is added'}.` : ' Choose Make main to show one first everywhere.'}`,
    });
  }

  function selectMainDraftPhoto(item: DraftPhotoItem) {
    if (item.source === 'saved' && item.url) {
      setMainPhotoSelection({ source: 'saved', url: item.url });
      return;
    }

    if (item.source === 'pending' && item.pendingId) {
      setMainPhotoSelection({ source: 'pending', id: item.pendingId });
    }
  }

  function removeDraftPhoto(photoUrl: string) {
    setAssetDraft((current) => ({
      ...current,
      photos: current.photos.filter((photo) => photo !== photoUrl),
    }));

    setMainPhotoSelection((current) => (current?.source === 'saved' && current.url === photoUrl ? null : current));
  }

  function removePendingPhotoFile(photoId: string) {
    setPendingPhotoFiles((current) => {
      const removed = current.find((entry) => entry.id === photoId);
      if (removed) {
        revokePhotoPreviewUrl(removed.previewUrl);
      }

      const next = current.filter((entry) => entry.id !== photoId);
      pendingPhotoFilesRef.current = next;
      return next;
    });

    setMainPhotoSelection((current) => (current?.source === 'pending' && current.id === photoId ? null : current));
  }


  function handleDocumentFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!selectedFiles.length) {
      return;
    }

    const remainingSlots = MAX_DOCUMENTS - assetDraft.documents.length - pendingDocumentFiles.length;

    if (remainingSlots <= 0) {
      setNotice({ tone: 'error', message: `You can upload a maximum of ${MAX_DOCUMENTS} documents per asset.` });
      return;
    }

    const filesToQueue = selectedFiles.slice(0, remainingSlots);

    setPendingDocumentFiles((current) => [...current, ...filesToQueue]);
    setNotice({
      tone: 'success',
      message: `${filesToQueue.length} document${filesToQueue.length === 1 ? '' : 's'} ready. Click Add asset to upload.`,
    });
  }

  function removeDraftDocument(documentId: string) {
    setAssetDraft((current) => ({
      ...current,
      documents: current.documents.filter((document) => document.id !== documentId),
    }));
  }

  function removePendingDocumentFile(fileIndex: number) {
    setPendingDocumentFiles((current) => current.filter((_, index) => index !== fileIndex));
  }

  async function uploadAssetMediaFiles(files: File[], uploadType: DetailMediaUploadType): Promise<UploadedAssetFile[]> {
    if (!files.length) return [];

    const formData = new FormData();
    formData.append('uploadType', uploadType);

    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch('/api/asset-register/uploads', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const data = (await response.json()) as AssetUploadApiResponse;

    if (!response.ok || !data.ok || !data.uploads?.length) {
      throw new Error(data.error ?? (uploadType === 'document' ? 'Failed to upload documents.' : 'Failed to upload images.'));
    }

    return data.uploads;
  }

  async function uploadQueuedPhotoFiles(files: PendingPhotoFile[]): Promise<Map<string, string>> {
    if (!files.length) return new Map<string, string>();

    setIsUploadingPhotos(true);

    try {
      const uploads = await uploadAssetMediaFiles(files.map((entry) => entry.file), 'photo');

      return new Map(
        uploads
          .map((entry, index) => {
            const pendingPhoto = files[index];
            return pendingPhoto ? ([pendingPhoto.id, entry.url] as const) : null;
          })
          .filter((entry): entry is readonly [string, string] => entry !== null),
      );
    } finally {
      setIsUploadingPhotos(false);
    }
  }

  function uploadedFilesToDocuments(uploads: UploadedAssetFile[]): AssetDocument[] {
    return uploads.map((entry) => ({
      id: entry.uploadId || entry.url,
      url: entry.url,
      fileName: entry.fileName,
      contentType: entry.contentType,
      byteSize: entry.byteSize,
      uploadedAtIso: new Date().toISOString(),
    }));
  }

  async function uploadQueuedDocumentFiles(files: File[]): Promise<AssetDocument[]> {
    if (!files.length) return [];

    setIsUploadingDocuments(true);

    try {
      const uploads = await uploadAssetMediaFiles(files, 'document');
      return uploadedFilesToDocuments(uploads);
    } finally {
      setIsUploadingDocuments(false);
    }
  }

  async function patchAssetMedia(asset: RegisterAsset, photos: string[], documents: AssetDocument[]): Promise<RegisterAsset> {
    const response = await fetch('/api/asset-register', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assetId: asset.id,
        photos,
        documents,
      }),
    });

    const data = (await response.json()) as AssetRegisterApiResponse;

    if (!response.ok || !data.ok || !data.item) {
      throw new Error(data.error ?? 'Failed to update asset files.');
    }

    return data.item;
  }

  function triggerDetailMediaInput(assetId: string, type: DetailMediaUploadType) {
    document.getElementById(mediaInputId(assetId, type))?.click();
  }

  function handleDetailMediaKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, assetId: string, type: DetailMediaUploadType) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    triggerDetailMediaInput(assetId, type);
  }

  async function handleDetailPhotoFilesSelected(asset: RegisterAsset, event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!selectedFiles.length) {
      return;
    }

    const filesToUpload = selectedFiles.slice(0, MAX_PHOTOS);
    setDetailMediaUpload({ assetId: asset.id, type: 'photo' });

    try {
      const uploads = await uploadAssetMediaFiles(filesToUpload, 'photo');
      const uploadedPhotoUrls = uploads.map((entry) => entry.url).filter(Boolean);
      const nextPhotos = limitPhotosToNewest([...normalizePhotos(asset.photos), ...uploadedPhotoUrls]);
      const updatedAsset = await patchAssetMedia(asset, nextPhotos, assetDocuments(asset));
      const updatedPhotos = normalizePhotos(updatedAsset.photos);
      const firstUploadedIndex = updatedPhotos.findIndex((photo) => uploadedPhotoUrls.includes(photo));

      syncMediaUpdatedAsset(updatedAsset);
      setExpandedAssetId(updatedAsset.id);

      if (firstUploadedIndex >= 0) {
        setDetailPhotoIndex(updatedAsset.id, firstUploadedIndex);
      }

      setNotice({
        tone: 'success',
        message: `${uploadedPhotoUrls.length} photo${uploadedPhotoUrls.length === 1 ? '' : 's'} uploaded.${normalizePhotos(asset.photos).length + uploadedPhotoUrls.length > MAX_PHOTOS ? ' Oldest photos were replaced to keep the asset at 12 photos.' : ''}`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload photos.',
      });
    } finally {
      setDetailMediaUpload(null);
    }
  }

  async function handleDetailDocumentFilesSelected(asset: RegisterAsset, event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!selectedFiles.length) {
      return;
    }

    const currentDocuments = assetDocuments(asset);
    const remainingSlots = MAX_DOCUMENTS - currentDocuments.length;

    if (remainingSlots <= 0) {
      setNotice({ tone: 'error', message: `This asset already has the maximum of ${MAX_DOCUMENTS} documents.` });
      return;
    }

    const filesToUpload = selectedFiles.slice(0, remainingSlots);
    setDetailMediaUpload({ assetId: asset.id, type: 'document' });

    try {
      const uploads = await uploadAssetMediaFiles(filesToUpload, 'document');
      const uploadedDocuments = uploadedFilesToDocuments(uploads);
      const nextDocuments = normalizeDocuments([...currentDocuments, ...uploadedDocuments]);
      const updatedAsset = await patchAssetMedia(asset, normalizePhotos(asset.photos), nextDocuments);

      syncMediaUpdatedAsset(updatedAsset);
      setExpandedAssetId(updatedAsset.id);
      setNotice({
        tone: 'success',
        message: `${uploadedDocuments.length} document${uploadedDocuments.length === 1 ? '' : 's'} uploaded.${selectedFiles.length > filesToUpload.length ? ` Only ${filesToUpload.length} could be added because the asset is limited to ${MAX_DOCUMENTS} documents.` : ''}`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload documents.',
      });
    } finally {
      setDetailMediaUpload(null);
    }
  }

  async function handleAssetSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (manualAssetStep !== 4) {
      return;
    }

    if (!validateAssetDetailsDraft()) {
      setManualAssetStep(2);
      return;
    }

    const value = parseRegisterValueInput(assetDraft.value);
    const replacementPrice = parseRegisterValueInput(assetDraft.replacementPrice);
    const hasYearModel = assetDraft.yearModel.trim() !== '';
    const yearModel = hasYearModel ? Number(assetDraft.yearModel) : null;
    const hasHours = assetDraft.hours.trim() !== '';
    const hours = hasHours ? parseUsageAmountInput(assetDraft.hours) : null;
    const hasLifeWorkedPercent = assetDraft.lifeWorkedPercent.trim() !== '';
    const lifeWorkedPercent = hasLifeWorkedPercent ? Number(assetDraft.lifeWorkedPercent) : null;
    const usageErrorLabel = assetDraft.usageMetric === 'km' ? 'Kilometres' : 'Machine hours';

    if (!assetDraft.title.trim() || value <= 0) {
      setNotice({ tone: 'error', message: 'Asset title and current value are required.' });
      return;
    }

    if (!replacementPrice || replacementPrice <= 0) {
      setNotice({ tone: 'error', message: 'Replacement price is required and must be greater than zero.' });
      return;
    }

    if (hasYearModel && (!Number.isFinite(yearModel) || Number(yearModel) < 1800 || Number(yearModel) > new Date().getFullYear() + 1)) {
      setNotice({ tone: 'error', message: `${yearFieldLabel} must be a valid year.` });
      return;
    }

    if (hasHours && (!Number.isFinite(hours) || Number(hours) < 0)) {
      setNotice({ tone: 'error', message: `${usageErrorLabel} must be zero or greater.` });
      return;
    }

    if (hasLifeWorkedPercent && (!Number.isFinite(lifeWorkedPercent) || Number(lifeWorkedPercent) < 0 || Number(lifeWorkedPercent) > 100)) {
      setNotice({ tone: 'error', message: 'Lifetime worked must be between 0% and 100%.' });
      return;
    }

    if (
      editingAsset &&
      hasHours &&
      editingAsset.hours !== null &&
      typeof editingAsset.hours !== 'undefined' &&
      Number(hours) < Number(editingAsset.hours)
    ) {
      setNotice({
        tone: 'error',
        message: `${usageErrorLabel} cannot be lower than the reading already saved on this asset.`,
      });
      return;
    }

    const currentLifeWorkedPercent = editingAsset ? getAssetLifeWorkedPercent(editingAsset) : null;
    if (
      editingAsset &&
      hasLifeWorkedPercent &&
      currentLifeWorkedPercent !== null &&
      Number(lifeWorkedPercent) < currentLifeWorkedPercent
    ) {
      setNotice({
        tone: 'error',
        message: 'Lifetime worked cannot be lower than the percentage already saved on this asset.',
      });
      return;
    }

    const roundedLifeWorkedPercent = showLifeWorkedPercentField && hasLifeWorkedPercent
      ? Math.round(Number(lifeWorkedPercent) * 10) / 10
      : null;
    const licenseRegistrationNumber = assetDraft.licenseStatus === 'yes'
      ? normalizeLicenseRegistrationText(assetDraft.licenseRegistrationNumber)
      : '';
    const specsJson: Record<string, unknown> = {
      financeStatus: assetDraft.financeStatus,
      finance_status: assetDraft.financeStatus,
      insuranceStatus: assetDraft.insuranceStatus,
      insurance_status: assetDraft.insuranceStatus,
      licenseStatus: assetDraft.licenseStatus,
      license_status: assetDraft.licenseStatus,
      licensedStatus: assetDraft.licenseStatus,
      licensed_status: assetDraft.licenseStatus,
      licenceStatus: assetDraft.licenseStatus,
      licence_status: assetDraft.licenseStatus,
      licencedStatus: assetDraft.licenseStatus,
      licenced_status: assetDraft.licenseStatus,
      licenseRegistrationNumber,
      license_registration_number: licenseRegistrationNumber,
      licenceRegistrationNumber: licenseRegistrationNumber,
      licence_registration_number: licenseRegistrationNumber,
      licenseRegistration: licenseRegistrationNumber,
      license_registration: licenseRegistrationNumber,
      registrationNumber: licenseRegistrationNumber,
      registration_number: licenseRegistrationNumber,
      numberPlate: licenseRegistrationNumber,
      number_plate: licenseRegistrationNumber,
      replacementPriceExVat: replacementPrice,
      replacement_price_ex_vat: replacementPrice,
      replacementPrice: replacementPrice,
      replacement_price: replacementPrice,
      replacementPriceUsedExVat: replacementPrice,
      replacement_price_used_ex_vat: replacementPrice,
      userReplacementPriceExVat: replacementPrice,
      user_replacement_price_ex_vat: replacementPrice,
      officialReplacementPriceExVat: replacementPrice,
      official_replacement_price_ex_vat: replacementPrice,
      replacementPriceBasis: 'user',
      replacement_price_basis: 'user',
      insuranceNote: assetDraft.insuranceStatus === 'yes' ? assetDraft.insuranceNote.trim() : '',
      insurance_note: assetDraft.insuranceStatus === 'yes' ? assetDraft.insuranceNote.trim() : '',
      insuredNote: assetDraft.insuranceStatus === 'yes' ? assetDraft.insuranceNote.trim() : '',
      insured_note: assetDraft.insuranceStatus === 'yes' ? assetDraft.insuranceNote.trim() : '',
    };
    if (roundedLifeWorkedPercent !== null) {
      specsJson.life_worked_percent = roundedLifeWorkedPercent;
      specsJson.worked_percent = roundedLifeWorkedPercent;
      specsJson.percent_worked = roundedLifeWorkedPercent;
      specsJson.lifetime_worked_percent = roundedLifeWorkedPercent;
    }

    setIsSavingAsset(true);

    try {
      const orderedDraftPhotos = buildDraftPhotoItems(assetDraft.photos, pendingPhotoFiles, mainPhotoSelection);
      const uploadedPhotoUrlsById = await uploadQueuedPhotoFiles(pendingPhotoFiles);
      const uploadedDocuments = await uploadQueuedDocumentFiles(pendingDocumentFiles);
      const photoUrlsByKey = new Map<string, string>();

      assetDraft.photos.forEach((photo) => {
        photoUrlsByKey.set(savedDraftPhotoKey(photo), photo);
      });

      uploadedPhotoUrlsById.forEach((url, pendingId) => {
        photoUrlsByKey.set(pendingDraftPhotoKey(pendingId), url);
      });

      const selectedMainPhotoKey = mainPhotoSelectionKey(mainPhotoSelection);
      const photos = limitDraftPhotosWithMainPreference(
        orderedDraftPhotos
          .map((photo) => photoUrlsByKey.get(photo.key) ?? '')
          .filter(Boolean),
        Boolean(selectedMainPhotoKey),
      );
      const documents = normalizeDocuments([...assetDraft.documents, ...uploadedDocuments]);

      const payload = {
        registerId: activeRegister?.id || activeRegisterId || null,
        kind: editingAsset?.valuationRunId ? editingAsset.kind : assetDraft.kind,
        title: assetDraft.title,
        value,
        replacementPriceExVat: replacementPrice,
        note: assetDraft.note.trim(),
        serialNumber: assetDraft.serialNumber,
        isFinanced: assetDraft.financeStatus === 'yes',
        isInsured: assetDraft.insuranceStatus === 'yes',
        isLicensed: assetDraft.licenseStatus === 'yes',
        licenseRegistrationNumber,
        financeNote: assetDraft.financeStatus === 'yes' ? assetDraft.financeNote : '',
        photos,
        documents,
        yearModel: hasYearModel ? Math.round(Number(yearModel)) : null,
        hours: showUsageHoursField && hasHours ? Math.round(Number(hours)) : null,
        usageMetric: showUsageHoursField ? assetDraft.usageMetric : null,
        lifeWorkedPercent: roundedLifeWorkedPercent,
        specsJson,
        condition: showConditionField ? assetDraft.condition || null : null,
      };

      let assetIdToFocus: string | null = null;

      if (editingAssetId !== null) {
        const response = await fetch('/api/asset-register', {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assetId: editingAssetId,
            ...payload,
          }),
        });

        const data = (await response.json()) as AssetRegisterApiResponse;

        if (!response.ok || !data.ok || !data.item) {
          throw new Error(data.error ?? 'Failed to update asset.');
        }

        syncUpdatedAsset(data.item);

        assetIdToFocus = data.item.id;
        setExpandedAssetId(data.item.id);
        setNotice({
          tone: 'success',
          message: 'Asset updated successfully.',
        });
      } else {
        const response = await fetch('/api/asset-register', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = (await response.json()) as AssetRegisterApiResponse;

        if (!response.ok || !data.ok || !data.item) {
          throw new Error(data.error ?? 'Failed to add asset.');
        }

        const savedAsset = data.item as RegisterAsset;
        setAssets((current) => [savedAsset, ...current]);
        setSearchTerm('');
        setAssetFilter('all');
        setCurrentPage(1);
        setExpandedAssetId(savedAsset.id);
        assetIdToFocus = savedAsset.id;
        setNotice({ tone: 'success', message: 'Asset added successfully.' });
      }

      closeAssetModal();

      if (assetIdToFocus) {
        scrollToAssetCard(assetIdToFocus);
      }
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to save asset.',
      });
    } finally {
      setIsSavingAsset(false);
    }
  }

  async function handleDeleteAsset(assetId: string): Promise<boolean> {
    setBusyDeleteId(assetId);

    try {
      const response = await fetch(`/api/asset-register?id=${assetId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = (await response.json()) as AssetRegisterApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to delete asset.');
      }

      setAssets((current) => current.filter((asset) => asset.id !== assetId));

      if (editingAssetId === assetId) {
        resetEditor();
      }

      if (activeAsset?.id === assetId) {
        setActiveAsset(null);
      }

      if (projectionAsset?.id === assetId) {
        closeProjectionModal();
      }

      setNotice({ tone: 'success', message: 'Asset removed.' });
      return true;
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete asset.',
      });
      return false;
    } finally {
      setBusyDeleteId(null);
    }
  }

  function handleDeleteFromDialog(asset: RegisterAsset) {
    openDeleteConfirmDialog(asset);
  }

  async function handleConfirmDeleteAsset() {
    if (!deleteCandidateAsset) return;

    const deletedAssetId = deleteCandidateAsset.id;
    const wasDeleted = await handleDeleteAsset(deletedAssetId);

    if (wasDeleted) {
      setDeleteCandidateAsset((current) => (current?.id === deletedAssetId ? null : current));
    }
  }

  async function handleConfirmMarketplacePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!marketplaceAsset || !marketplaceDraft) {
      return;
    }

    const parsedPrice = parseMoneyInput(marketplaceDraft.askingPriceExVat);
    const askingPriceExVat = Math.round(parsedPrice ?? 0);

    if (!Number.isFinite(askingPriceExVat) || askingPriceExVat <= 0) {
      setNotice({ tone: 'error', message: 'Enter a valid marketplace price before continuing.' });
      return;
    }

    if (!marketplaceDraft.sellerName.trim() || !marketplaceDraft.sellerPhone.trim()) {
      setNotice({ tone: 'error', message: 'Add at least a contact name and phone number before sending to marketplace.' });
      return;
    }

    if (!isMarketplaceEligible(marketplaceAsset)) {
      setNotice({ tone: 'error', message: 'Property/Buildings cannot be sent to marketplace.' });
      return;
    }

    setIsPublishingMarketplace(true);

    try {
      const response = await fetch('/api/marketplace', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: marketplaceAsset.id,
          askingPriceExVat,
          marketplaceNotes: marketplaceDraft.description.trim(),
          sellerPhone: marketplaceDraft.sellerPhone.trim(),
          sellerName: marketplaceDraft.sellerName.trim(),
          sellerCompany: marketplaceDraft.sellerCompany.trim(),
          sellerEmail: marketplaceDraft.sellerEmail.trim(),
          province: marketplaceDraft.province.trim(),
          area: marketplaceDraft.area.trim(),
        }),
      });
      const data = (await response.json()) as MarketplaceApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to send asset to marketplace.');
      }

      const publishedAsset: RegisterAsset = {
        ...marketplaceAsset,
        sellerPhone: marketplaceDraft.sellerPhone.trim(),
        marketplaceNotes: marketplaceDraft.description.trim(),
        marketplaceStatus: data.marketplaceStatus ?? 'live',
        openPartnerNote: data.note ?? marketplaceAsset.openPartnerNote ?? null,
        updatedAtIso: new Date().toISOString(),
      };

      syncUpdatedAsset(publishedAsset);
      setNotice({
        tone: 'success',
        message: `${publishedAsset.title} is ready on the marketplace.`,
      });
      closeMarketplaceModal();

      const listingIdentifier = data.listing?.id ?? data.listing?.sourceAssetId ?? data.assetId ?? publishedAsset.id;
      window.location.assign(`/marketplace?listing=${encodeURIComponent(String(listingIdentifier))}`);
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to send asset to marketplace.',
      });
      setIsPublishingMarketplace(false);
    }
  }

  function handlePublishFromDialog(asset: RegisterAsset) {
    void openMarketplaceModal(asset);
  }

  async function handleRemoveFromMarketplace(asset: RegisterAsset) {
    setBusyMarketplaceRemoveId(asset.id);

    try {
      const response = await fetch(`/api/marketplace?assetId=${encodeURIComponent(asset.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await response.json()) as MarketplaceApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to remove asset from marketplace.');
      }

      const removedAsset: RegisterAsset = {
        ...asset,
        marketplaceStatus: data.marketplaceStatus ?? 'draft',
        updatedAtIso: new Date().toISOString(),
      };

      syncUpdatedAsset(removedAsset);
      setNotice({ tone: 'success', message: `${removedAsset.title} was removed from marketplace.` });
      closeActionDialog();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to remove asset from marketplace.',
      });
    } finally {
      setBusyMarketplaceRemoveId(null);
    }
  }


  async function handleUpdateEstimate(asset: RegisterAsset, selectedMethod?: RevalueMethod, closePricingAfterSuccess = false) {
    setBusyRevalueAssetId(asset.id);
    setBusyRevalueAction(selectedMethod ?? null);

    try {
      const response = await fetch('/api/asset-register/revalue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          ...(selectedMethod ? { selectedMethod } : {}),
        }),
      });
      const data = (await response.json()) as RevalueAssetApiResponse;

      if (!response.ok || !data.ok || !data.item) {
        throw new Error(data.error ?? 'Failed to update estimate.');
      }

      const updatedAsset = data.item;
      syncUpdatedAsset(updatedAsset);

      if (closePricingAfterSuccess) {
        setIsPricingModalOpen(false);
      }

      const updatedMethod = data.selectedMethod ?? updatedAsset.selectedMethod;
      const updateLabel = updatedMethod === 'market' ? 'market price' : 'Aim4price price';
      const marketplaceNote = isLiveOnMarketplace(asset) ? ' Marketplace asking price was not changed.' : '';
      setNotice({
        tone: 'success',
        message: `${updatedAsset.title} ${updateLabel} updated to ${money(updatedAsset.value)}.${data.warning ? ` ${data.warning}` : ''}${marketplaceNote}`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to update estimate.',
      });
    } finally {
      setBusyRevalueAssetId(null);
      setBusyRevalueAction(null);
    }
  }

  function pricingPreviewIntro(method: RevalueMethod): string {
    return method === 'market'
      ? 'Aim4price will refresh the market midpoint from the latest valuation data. Review the new value before saving it to the Asset Register.'
      : 'Aim4price will rerun the saved valuation using the latest asset details. Review the new value before saving it to the Asset Register.';
  }

  async function openRevaluePreviewDialog(asset: RegisterAsset, method: RevalueMethod) {
    const initialPreview: PricingRevaluePreview = {
      asset,
      method,
      result: null,
      error: null,
    };

    setPricingPreview(initialPreview);
    setIsLoadingPricingPreview(true);
    setIsSavingPricingPreview(false);

    try {
      const response = await fetch('/api/asset-register/revalue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          selectedMethod: method,
          previewOnly: true,
        }),
      });
      const data = (await response.json()) as RevalueAssetApiResponse;

      if (!response.ok || !data.ok || !data.item) {
        throw new Error(data.error ?? 'Failed to calculate the new value preview.');
      }

      setPricingPreview((current) => {
        if (!current || current.asset.id !== asset.id || current.method !== method) {
          return current;
        }

        return {
          ...current,
          result: data,
          error: null,
        };
      });
    } catch (error) {
      setPricingPreview((current) => {
        if (!current || current.asset.id !== asset.id || current.method !== method) {
          return current;
        }

        return {
          ...current,
          result: null,
          error: error instanceof Error ? error.message : 'Failed to calculate the new value preview.',
        };
      });
    } finally {
      setIsLoadingPricingPreview(false);
    }
  }

  async function handleSavePricingPreview() {
    if (!pricingPreview) return;

    const { asset, method } = pricingPreview;
    setIsSavingPricingPreview(true);

    try {
      const response = await fetch('/api/asset-register/revalue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          selectedMethod: method,
        }),
      });
      const data = (await response.json()) as RevalueAssetApiResponse;

      if (!response.ok || !data.ok || !data.item) {
        throw new Error(data.error ?? 'Failed to save the new value.');
      }

      const updatedAsset = data.item;
      syncUpdatedAsset(updatedAsset);
      setPricingPreview(null);
      setIsPricingModalOpen(false);

      const updatedMethod = data.selectedMethod ?? updatedAsset.selectedMethod;
      const updateLabel = updatedMethod === 'market' ? 'market price' : 'Aim4price value';
      const marketplaceNote = isLiveOnMarketplace(asset) ? ' Marketplace asking price was not changed.' : '';
      setNotice({
        tone: 'success',
        message: `${updatedAsset.title} ${updateLabel} saved at ${money(updatedAsset.value)}.${data.warning ? ` ${data.warning}` : ''}${marketplaceNote}`,
      });
    } catch (error) {
      setPricingPreview((current) => (current ? {
        ...current,
        error: error instanceof Error ? error.message : 'Failed to save the new value.',
      } : current));
    } finally {
      setIsSavingPricingPreview(false);
    }
  }

  async function handleMarkPartnerNoteNoted(noteId: string, assetId: string) {
    try {
      const response = await fetch(`/api/asset-notes/${encodeURIComponent(noteId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'noted' }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to mark note as noted.');
      }

      const notedAtIso = new Date().toISOString();
      const markNoteAsNoted = (asset: RegisterAsset): RegisterAsset => ({
        ...asset,
        openPartnerNote: null,
        partnerNotes: asset.partnerNotes?.map((note) => (note.id === noteId ? { ...note, status: 'noted', notedAtIso } : note)),
      });

      setAssets((current) => current.map((entry) => (entry.id === assetId ? markNoteAsNoted(entry) : entry)));
      setActiveAsset((current) => (current?.id === assetId ? markNoteAsNoted(current) : current));
      setMarketplaceAsset((current) => (current?.id === assetId ? markNoteAsNoted(current) : current));
      setNotice({ tone: 'success', message: 'Partner note marked as noted.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to mark note as noted.',
      });
    }
  }

  async function handleMarkMaintenanceStatusNoted(maintenanceStatusId: string, assetId: string) {
    setBusyMaintenanceStatusId(maintenanceStatusId);

    try {
      const response = await fetch(`/api/asset-maintenance-status/${encodeURIComponent(maintenanceStatusId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'noted' }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to mark maintenance as noted.');
      }

      setAssets((current) => current.map((entry) => (entry.id === assetId ? { ...entry, latestMaintenanceStatus: null } : entry)));
      setActiveAsset((current) => (current?.id === assetId ? { ...current, latestMaintenanceStatus: null } : current));
      setMarketplaceAsset((current) => (current?.id === assetId ? { ...current, latestMaintenanceStatus: null } : current));
      setProjectionAsset((current) => (current?.id === assetId ? { ...current, latestMaintenanceStatus: null } : current));
      setNotice({ tone: 'success', message: 'Maintenance marked as noted.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to mark maintenance as noted.',
      });
    } finally {
      setBusyMaintenanceStatusId((current) => (current === maintenanceStatusId ? null : current));
    }
  }

  function handlePrintAssetSheet(asset: RegisterAsset) {
    const assetPhotoUrls = asset.photos
      .map((photo) => toAbsoluteUrl(photo))
      .filter((photoUrl): photoUrl is string => Boolean(photoUrl));
    const documentsCount = assetDocuments(asset).length;
    const ownerProfile = reportProfile;
    const profileLocation = [ownerProfile?.townCity, ownerProfile?.province]
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .join(', ');
    const profileAddress = [ownerProfile?.addressLine1, ownerProfile?.addressLine2, profileLocation]
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .join(', ');
    const ownerBusinessName =
      ownerProfile?.businessName?.trim() ||
      ownerProfile?.marketplaceSellerName?.trim() ||
      ownerProfile?.name?.trim() ||
      'Aim4price client';
    const ownerBusinessEmail = ownerProfile?.marketplaceEmail?.trim() || ownerProfile?.email?.trim() || '—';
    const ownerContactDetails = ownerProfile?.marketplacePhone?.trim() || ownerProfile?.phone?.trim() || '—';
    const ownerLocationAddress = profileAddress || ownerProfile?.marketplaceLocation?.trim() || '—';
    const familyLabel = assetKindLabel(asset);
    const initialModelValue = asset.modelName || asset.typedModelName || '';
    const reportBrandName = deriveAssetReportBrandName(asset, initialModelValue);
    const modelValue = deriveAssetReportModelName(asset, reportBrandName);
    const selectedMethodCards = buildAssetSheetMethodCards(asset).filter((card) => card.selected);
    const methodCards = selectedMethodCards.length ? selectedMethodCards : buildAssetSheetMethodCards(asset).slice(0, 1);
    const assetRows = [
      { label: 'Category', value: familyLabel },
      { label: 'Brand', value: reportBrandName },
      { label: 'Model', value: modelValue },
      ...(asset.powerKw ? [{ label: 'Power', value: `${asset.powerKw} kW` }] : []),
      ...(asset.tractorType ? [{ label: 'Type', value: formatTractorType(asset.tractorType) }] : []),
      ...(asset.drive ? [{ label: 'Drive', value: formatDrive(asset.drive) }] : []),
      ...(asset.cab ? [{ label: 'Cab', value: formatCab(asset.cab) }] : []),
      { label: asset.kind === 'property' ? 'Year Built' : 'Year', value: asset.yearModel ? String(asset.yearModel) : '—' },
      { label: 'Usage', value: buildAssetUsageValue(asset) },
      { label: 'Condition', value: conditionLabel(asset.condition) },
      { label: 'Replacement Price', value: readAssetReplacementPriceExVat(asset) !== null ? `${money(readAssetReplacementPriceExVat(asset) ?? 0)} excl. VAT` : 'Not set' },
      { label: 'Serial Number', value: asset.serialNumber || '—' },
      { label: 'Insured', value: statusChoiceReportLabel(readInsuranceStatusChoice(asset)) },
      { label: 'Financed', value: statusChoiceReportLabel(readFinanceStatusChoice(asset)) },
      { label: 'Licensed', value: statusChoiceReportLabel(readLicenseStatusChoice(asset)) },
      ...(readLicenseStatusChoice(asset) === 'yes' && readLicenseRegistrationNumber(asset)
        ? [{ label: 'Registration', value: readLicenseRegistrationNumber(asset) }]
        : []),
      { label: 'Documents', value: documentsCount ? `${documentsCount} saved` : 'None' },
      { label: 'Last Updated', value: assetStatusDateLabel(asset) },
    ];

    const didOpen = openAssetSheetPrint({
      logoUrl: getRegisterReportLogoUrl(activeRegister),
      generatedAt: formatDate(new Date().toISOString()),
      assetBadge: familyLabel,
      heroTitle: asset.title,
      heroMeta: buildAssetMeta(asset),
      valueLabel: 'Estimated Value',
      value: money(asset.value),
      valueNote: methodLabel(asset.selectedMethod),
      statusLabel: assetStatusDateLabel(asset),
      issuerName: 'Aim4price',
      issuerAddress: 'Saved asset register data',
      issuerPhone: '',
      issuerEmail: 'aim4price@gmail.com',
      clientRows: [
        { label: 'Business Name', value: ownerBusinessName },
        { label: 'Contact Details', value: ownerContactDetails },
        { label: 'Business Email', value: ownerBusinessEmail },
        { label: 'Location / Address', value: ownerLocationAddress },
      ],
      photoUrl: assetPhotoUrls[0] ?? null,
      photoUrls: assetPhotoUrls,
      facts: assetRows,
      notes: [
        ...(getManualAssetNote(asset.note) ? [{ label: 'Asset Notes', value: getManualAssetNote(asset.note) }] : []),
        ...(asset.financeNote ? [{ label: 'Finance Note', value: asset.financeNote }] : []),
        ...(readInsuranceNote(asset) ? [{ label: 'Insurance Note', value: readInsuranceNote(asset) }] : []),
        ...buildAssetPartnerNoteRows(asset),
      ],
      methodCards,
      footerNote:
        'Values are indicative estimates based on saved asset-register information and available pricing inputs. This is not a certified valuation, inspection report or guarantee of selling price. Final value remains subject to physical inspection, documentation, attachments, condition, location and live market demand.',
    });

    if (!didOpen) {
      setNotice({
        tone: 'error',
        message: 'Unable to open the asset valuation report. Please allow pop-ups and try again.',
      });
      return;
    }

    closeActionDialog();
  }

  async function handleCopyScanLink(asset: RegisterAsset) {
    const scanUrl = buildAssetScanUrl(asset);

    if (!scanUrl) {
      setNotice({ tone: 'error', message: 'This asset does not have a scan link yet.' });
      return;
    }

    function markScanLinkCopied() {
      setCopiedScanLinkAssetId(asset.id);
      window.setTimeout(() => {
        setCopiedScanLinkAssetId((current) => (current === asset.id ? null : current));
      }, 2200);
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(scanUrl);
        markScanLinkCopied();
        setNotice({ tone: 'success', message: 'Scan link copied.' });
        return;
      }

      window.prompt('Copy this asset scan link', scanUrl);
      markScanLinkCopied();
      setNotice({ tone: 'success', message: 'Scan link ready to copy.' });
    } catch (error) {
      setCopiedScanLinkAssetId(null);
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to copy the scan link.',
      });
    }
  }

  function assetReportLabel(reportKind: AssetPdfReportKind): string {
    return reportKind === 'fuel' ? 'Fuel report' : 'Maintenance report';
  }

  function handleOpenAssetPdfReport(asset: RegisterAsset, reportKind: AssetPdfReportKind, filters?: AssetPdfReportFilters): boolean {
    const reportUrl = buildAssetPdfReportUrl(asset, reportKind, filters, 'pdf');
    const opened = window.open(reportUrl, '_blank', 'noopener,noreferrer');
    const reportLabel = assetReportLabel(reportKind);

    if (!opened) {
      setNotice({
        tone: 'error',
        message: `Unable to open the ${reportLabel.toLowerCase()}. Please allow pop-ups and try again.`,
      });
      return false;
    }

    setNotice({
      tone: 'success',
      message: `${reportLabel} opened in a new tab. Use Print to save it as a PDF.`,
    });
    return true;
  }

  async function handleDownloadAssetReportXlsx(asset: RegisterAsset, reportKind: AssetPdfReportKind, filters?: AssetPdfReportFilters) {
    const reportLabel = assetReportLabel(reportKind);

    try {
      const response = await fetch(buildAssetPdfReportUrl(asset, reportKind, filters, 'xlsx'), {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        try {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? `Failed to download the ${reportLabel.toLowerCase()} Excel file.`);
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }

          throw new Error(`Failed to download the ${reportLabel.toLowerCase()} Excel file.`);
        }
      }

      const blob = await response.blob();
      const fallbackName = `${asset.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'asset'}-${reportKind}-report.xlsx`;
      const fileName = parseDownloadFileName(response, fallbackName);
      downloadBlob(blob, fileName);
      setNotice({ tone: 'success', message: `${reportLabel} Excel downloaded.` });
      closeActionDialog();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : `Failed to download the ${reportLabel.toLowerCase()} Excel file.`,
      });
    }
  }

  function openAssetFuelReportFilter() {
    setAssetReportStep('fuel-filter');
    setAssetFuelReportYear('all');
    setAssetFuelReportMonth('all');
    setOpenAssetReportSelect(null);
  }

  function openAssetMaintenanceReportFilter() {
    setAssetReportStep('maintenance-filter');
    setAssetMaintenanceReportType('all');
    setAssetMaintenanceReportYear('all');
    setAssetMaintenanceReportMonth('all');
    setOpenAssetReportSelect(null);
  }

  function backToAssetReportOptions() {
    setAssetReportStep('options');
    setOpenAssetReportSelect(null);
  }

  function toggleAssetReportSelect(selectKey: AssetReportSelectKey) {
    setOpenAssetReportSelect((currentSelectKey) => (currentSelectKey === selectKey ? null : selectKey));
  }

  function selectAssetFuelReportYear(value: string) {
    setAssetFuelReportYear(value);
    setAssetFuelReportMonth('all');
    setOpenAssetReportSelect(null);
  }

  function selectAssetFuelReportMonth(value: string) {
    setAssetFuelReportMonth(value);
    setOpenAssetReportSelect(null);
  }

  function selectAssetMaintenanceReportType(value: string) {
    setAssetMaintenanceReportType(value);
    setOpenAssetReportSelect(null);
  }

  function selectAssetMaintenanceReportYear(value: string) {
    setAssetMaintenanceReportYear(value);
    setAssetMaintenanceReportMonth('all');
    setOpenAssetReportSelect(null);
  }

  function selectAssetMaintenanceReportMonth(value: string) {
    setAssetMaintenanceReportMonth(value);
    setOpenAssetReportSelect(null);
  }

  async function handleDownloadFilteredFuelReport(asset: RegisterAsset, format: AssetReportFormat = 'pdf') {
    const filters: AssetPdfReportFilters = {
      year: assetFuelReportYear,
      month: assetFuelReportYear === 'all' ? 'all' : assetFuelReportMonth,
    };

    if (format === 'xlsx') {
      await handleDownloadAssetReportXlsx(asset, 'fuel', filters);
      return;
    }

    const didOpen = handleOpenAssetPdfReport(asset, 'fuel', filters);

    if (didOpen) {
      closeActionDialog();
    }
  }

  async function handleDownloadFilteredMaintenanceReport(asset: RegisterAsset, format: AssetReportFormat = 'pdf') {
    const filters: AssetPdfReportFilters = {
      maintenanceType: assetMaintenanceReportType,
      year: assetMaintenanceReportYear,
      month: assetMaintenanceReportYear === 'all' ? 'all' : assetMaintenanceReportMonth,
    };

    if (format === 'xlsx') {
      await handleDownloadAssetReportXlsx(asset, 'maintenance', filters);
      return;
    }

    const didOpen = handleOpenAssetPdfReport(asset, 'maintenance', filters);

    if (didOpen) {
      closeActionDialog();
    }
  }

  async function handleDownloadQr(asset: RegisterAsset) {
    try {
      const response = await fetch(`/api/asset-register/qr?assetId=${encodeURIComponent(asset.id)}&format=png&download=1`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        try {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? 'Failed to download the asset QR image.');
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }

          throw new Error('Failed to download the asset QR image.');
        }
      }

      const blob = await response.blob();
      const fallbackName = `${asset.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'asset'}-qr.png`;
      const fileName = parseDownloadFileName(response, fallbackName);
      downloadBlob(blob, fileName);
      setNotice({ tone: 'success', message: 'Asset QR image downloaded.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to download the asset QR image.',
      });
    }
  }

  function handlePrintQrSheet(asset: RegisterAsset) {
    const opened = window.open(buildAssetQrPrintUrl(asset), '_blank', 'noopener,noreferrer');

    if (!opened) {
      setNotice({ tone: 'error', message: 'Unable to open the QR print page. Please allow pop-ups and try again.' });
      return;
    }

    setNotice({ tone: 'success', message: 'QR print sheet opened in a new tab.' });
  }

  function openRegisterShareModal() {
    if (!assets.length || isLoading) {
      return;
    }

    setNotice(null);
    setIsAssetFilterOpen(false);
    setIsRegisterShareModalOpen(true);
  }

  function closeRegisterShareModal() {
    if (isExporting || isSendingQuoteLead) return;
    setIsRegisterShareModalOpen(false);
  }

  function buildFullRegisterLeadAssetSnapshot(asset: RegisterAsset): Record<string, unknown> {
    const financeStatus = readFinanceStatusChoice(asset);
    const insuranceStatus = readInsuranceStatusChoice(asset);
    const licenseStatus = readLicenseStatusChoice(asset);

    return {
      id: asset.id,
      title: asset.title,
      kind: asset.kind,
      value: asset.value,
      selectedValueExVat: asset.selectedValueExVat,
      replacementPriceExVat: readAssetReplacementPriceExVat(asset),
      replacementPriceUsedExVat: readAssetReplacementPriceExVat(asset),
      userReplacementPriceExVat: readAssetReplacementPriceExVat(asset),
      selectedMethod: asset.selectedMethod,
      brandName: asset.brandName,
      modelName: asset.modelName,
      typedModelName: asset.typedModelName,
      equipmentFamilyKey: asset.equipmentFamilyKey,
      equipmentFamilyLabel: asset.equipmentFamilyLabel,
      yearModel: asset.yearModel,
      hours: asset.hours,
      specsJson: {
        ...(isPlainRecord(asset.specsJson) ? asset.specsJson : {}),
        financeStatus,
        insuranceStatus,
        licenseStatus,
        replacementPriceExVat: readAssetReplacementPriceExVat(asset),
        replacement_price_ex_vat: readAssetReplacementPriceExVat(asset),
        replacementPriceUsedExVat: readAssetReplacementPriceExVat(asset),
        replacement_price_used_ex_vat: readAssetReplacementPriceExVat(asset),
      },
      depreciationMethodUsed: asset.depreciationMethodUsed,
      lifeWorkedPercent: asset.lifeWorkedPercent,
      lifeRemainingPercent: asset.lifeRemainingPercent,
      estimatedHours: asset.estimatedHours,
      maxLifetimeHours: asset.maxLifetimeHours,
      condition: asset.condition,
      powerKw: asset.powerKw,
      serialNumber: asset.serialNumber,
      isFinanced: financeStatus === 'yes',
      isInsured: insuranceStatus === 'yes',
      isLicensed: licenseStatus === 'yes',
      licenseRegistrationNumber: readLicenseRegistrationNumber(asset),
      aim4priceValueExVat: asset.aim4priceValueExVat,
      marketMidExVat: asset.marketMidExVat,
      photoUrl: toAbsoluteUrl(assetPreviewImage(asset)),
      createdAtIso: asset.createdAtIso,
      updatedAtIso: asset.updatedAtIso,
    };
  }

  function buildFullRegisterLeadSections(leadType: AssetLeadType, profile: AccountProfile | null): Record<string, unknown> {
    const registerAssets = assets.map(buildFullRegisterLeadAssetSnapshot);
    const generatedAtIso = new Date().toISOString();
    const leadLabel = leadType === 'insurance' ? 'Full insurance quote' : 'Full refinance quote';
    const registerLeadType = leadType === 'insurance' ? 'full_insurance_quote' : 'full_refinance_quote';

    return {
      assetDetails: true,
      valuationSummary: true,
      mainPhoto: true,
      photos: false,
      documents: false,
      scanHistory: false,
      registerLead: true,
      source: 'full_asset_register',
      registerLeadType,
      pdfReport: true,
      liveAccess: false,
      registerSnapshot: {
        snapshotType: 'full_asset_register',
        title: 'Full Asset Register',
        leadLabel,
        generatedAtIso,
        ownerName: buildOwnerName(profile),
        ownerMeta: buildOwnerMeta(profile),
        logoUrl: getRegisterReportLogoUrl(activeRegister),
        assetCount: assets.length,
        totalAssets: assets.length,
        totalValue,
        registerValue: totalValue,
        totalValueInclVat,
        totalReplacementValue,
        totalReplacementValueInclVat,
        replacementPricedAssetCount,
        aim4priceAssetCount: aim4priceValuedEquipmentCount,
        manualAssetCount: manualAssetStats.count,
        financedAssetCount: financedAssetStats.count,
        insuredAssetCount: insuredAssetStats.count,
        licensedAssetCount: licensedAssetStats.count,
        assets: registerAssets,
      },
    };
  }

  function openFullRegisterQuotePartnerPicker(leadType: Extract<AssetLeadType, 'finance' | 'insurance'>) {
    const anchorAsset = assets[0];

    if (!anchorAsset) {
      setNotice({ tone: 'error', message: 'Add at least one asset before sending a full-register lead.' });
      return;
    }

    setIsRegisterShareModalOpen(false);
    resetAssetQuoteState('register');
    setQuoteAsset(anchorAsset);
    setSelectedQuoteLeadType(leadType);
    setSelectedQuotePartnerId('');
    setQuotePartnerSearch('');
    setQuoteOwnerMessage('');
    setQuoteLeadStep(null);
    setQuoteConsentAccepted(false);
    setQuotePartners([]);
    setQuoteIncludePhotos(false);
    setQuoteIncludeDocuments(false);
    setQuoteIncludeScanHistory(false);
  }

  function openSummaryModal() {
    setIsSummaryModalOpen(true);
  }

  function closeSummaryModal() {
    setIsSummaryModalOpen(false);
  }

  function selectAssetFilter(nextFilter: AssetFilterKey) {
    setAssetFilter(nextFilter);
    setIsAssetFilterOpen(false);
  }

  function clearAssetFilter() {
    setAssetFilter('all');
    setIsAssetFilterOpen(false);
  }

  function openExportModal() {
    if (!assets.length) {
      return;
    }

    setExportFormat('pdf');
    setExportStep('format');
    setPdfReportKind('full');
    setPdfReportSelection('');
    setIsExportModalOpen(true);
  }

  function closeExportModal() {
    if (isExporting) return;

    setIsExportModalOpen(false);
    setExportStep('format');
    setPdfReportSelection('');
  }

  function selectExportFormat(nextFormat: ExportFormat) {
    setExportFormat(nextFormat);
    setExportStep('format');
    setPdfReportSelection('');
  }

  function openPdfReportChooser() {
    setExportStep('pdf-report');
    setPdfReportSelection('');
  }

  function closePdfReportChooser() {
    if (isExporting) return;

    setExportStep('format');
    setPdfReportSelection('');
  }

  function handlePdfReportChoice(reportKind: PdfReportKind) {
    setPdfReportSelection(reportKind);
    void handleExportPdfReport(reportKind);
  }

  async function handleExportPdf(reportKind: PdfReportKind = pdfReportKind) {
    const reportOption = getPdfReportOption(reportKind);
    const reportAssets = filterAssetsByPdfReportKind(assets, reportKind);
    const reportValue = sumAssetValues(reportAssets);
    const reportValueInclVat = Math.round(reportValue * 1.15);
    const reportReplacementValue = sumAssetReplacementValues(reportAssets);
    const reportReplacementValueInclVat = Math.round(reportReplacementValue * 1.15);
    const reportReplacementPricedCount = countAssetsWithReplacementPrice(reportAssets);
    const reportAim4priceStats = calculateAssetStats(reportAssets, isAim4priceValuedAsset);
    const reportInsuredStats = calculateAssetStats(reportAssets, (asset) => readInsuranceStatusChoice(asset) === 'yes');
    const reportFinancedStats = calculateAssetStats(reportAssets, (asset) => readFinanceStatusChoice(asset) === 'yes');
    const reportLicensedStats = calculateAssetStats(reportAssets, (asset) => readLicenseStatusChoice(asset) === 'yes');
    const profile = reportProfile ?? (await ensureAccountProfile());
    const profileLocation = [profile?.townCity, profile?.province].filter(Boolean).join(' ');
    const profileAddress = [profile?.addressLine1, profile?.addressLine2, profileLocation].filter(Boolean).join(' ');
    const ownerName = buildOwnerName(profile);
    const ownerEmail = profile?.marketplaceEmail?.trim() || '—';
    const ownerPhone = profile?.phone?.trim() || '—';

    const didOpen = openAssetRegisterSummaryPrint({
      logoUrl: getRegisterReportLogoUrl(activeRegister),
      generatedAt: formatDate(new Date().toISOString()),
      reportTitle: `${reportOption.label} Report`,
      reportSubtitle: 'Aim4price asset register',
      valueLabel: reportKind === 'full' ? 'Register Value' : 'Filtered Register Value',
      assetSectionTitle: reportOption.sectionTitle,
      emptyStateMessage: reportOption.emptyLabel,
      ownerName,
      ownerMeta: buildOwnerMeta(profile),
      intro: reportOption.intro,
      registerValue: money(reportValue),
      registerValueNote: `VAT excluded · ${money(reportValueInclVat)} incl. VAT · Replacement ${money(reportReplacementValue)} excl. VAT`,
      ownerRows: [
        { label: 'Name', value: ownerName },
        { label: 'Business email', value: ownerEmail },
        { label: 'Phone', value: ownerPhone },
        { label: 'Address', value: profileAddress || '—' },
      ],
      stats: [
        { label: 'Assets', value: String(reportAssets.length), note: reportKind === 'full' ? 'Saved register items.' : reportOption.description },
        { label: 'Value ex VAT', value: money(reportValue), note: 'Filtered report total excluding VAT.' },
        { label: 'Value incl VAT', value: money(reportValueInclVat), note: 'Filtered report total including 15% VAT.' },
        { label: 'Replacement value', value: money(reportReplacementValue), note: `${reportReplacementPricedCount} assets · ${money(reportReplacementValueInclVat)} incl. VAT.` },
        { label: 'Aim4price values', value: String(reportAim4priceStats.count), note: `${money(reportAim4priceStats.value)} total value.` },
        { label: 'Insured assets', value: String(reportInsuredStats.count), note: `${money(reportInsuredStats.value)} marked insured.` },
        { label: 'Financed assets', value: String(reportFinancedStats.count), note: `${money(reportFinancedStats.value)} marked financed.` },
        { label: 'Licensed assets', value: String(reportLicensedStats.count), note: `${money(reportLicensedStats.value)} marked licensed.` },
      ],
      notes: reportAssets.flatMap((asset) => buildAssetPartnerNoteRows(asset, true)),
      rows: reportAssets.map((asset) => {
        const initialModelValue = asset.modelName || asset.typedModelName || '';
        const reportBrandName = deriveAssetReportBrandName(asset, initialModelValue);
        const reportModelName = deriveAssetReportModelName(asset, reportBrandName);
        const documentsCount = assetDocuments(asset).length;

        return {
          asset: asset.title,
          type: assetKindLabel(asset),
          method: methodLabel(asset.selectedMethod),
          detail: buildExportDetail(asset),
          value: money(asset.value),
          replacementPrice: readAssetReplacementPriceExVat(asset) !== null ? money(readAssetReplacementPriceExVat(asset) ?? 0) : 'Not set',
          status: assetStatusDateLabel(asset),
          brand: reportBrandName,
          model: reportModelName,
          year: asset.yearModel ? String(asset.yearModel) : '—',
          usage: buildAssetUsageValue(asset),
          condition: conditionLabel(asset.condition),
          serial: asset.serialNumber || '—',
          insured: statusChoiceReportLabel(readInsuranceStatusChoice(asset)),
          financed: statusChoiceReportLabel(readFinanceStatusChoice(asset)),
          licensed: statusChoiceReportLabel(readLicenseStatusChoice(asset)),
          licenseRegistrationNumber: readLicenseRegistrationNumber(asset) || undefined,
          documents: documentsCount ? `${documentsCount} saved` : 'None',
          updated: assetStatusDateLabel(asset),
          photoUrl: toAbsoluteUrl(assetPreviewImage(asset)) ?? null,
        };
      }),
      footerNote:
        'Values are indicative estimates based on saved Aim4price asset-register information and available pricing inputs. Values exclude VAT unless stated otherwise. This is not a certified valuation, inspection report or guarantee of selling price. Final values remain subject to physical inspection, documents, attachments, condition, location and live market demand.',
    });

    if (!didOpen) {
      throw new Error(`Unable to open the ${reportOption.label.toLowerCase()} PDF. Please allow pop-ups and try again.`);
    }
  }

  async function handleExportPdfReport(reportKind: PdfReportKind) {
    if (!assets.length || isExporting) {
      return;
    }

    const reportOption = getPdfReportOption(reportKind);

    setExportFormat('pdf');
    setPdfReportKind(reportKind);
    setIsExporting(true);

    try {
      await handleExportPdf(reportKind);
      setIsExportModalOpen(false);
      setNotice({
        tone: 'success',
        message: `${reportOption.label} PDF opened.`,
      });
    } catch (error) {
      setPdfReportSelection('');
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to export the asset register PDF.',
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportXlsx() {
    const response = await fetch(buildAssetRegisterExportUrl(activeRegister?.id || activeRegisterId), {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      try {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to export the asset register XLSX file.');
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }

        throw new Error('Failed to export the asset register XLSX file.');
      }
    }

    const blob = await response.blob();
    const fallbackName = `aim4price-asset-register-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const fileName = parseDownloadFileName(response, fallbackName);
    downloadBlob(blob, fileName);
  }

  async function handleQuickExportXlsx() {
    if (!assets.length || isExporting) {
      return;
    }

    setExportFormat('xlsx');
    setIsExporting(true);

    try {
      await handleExportXlsx();
      setNotice({ tone: 'success', message: 'Asset register Excel downloaded.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to export the asset register Excel file.',
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleConfirmExport() {
    if (!assets.length) {
      return;
    }

    if (exportFormat === 'pdf') {
      openPdfReportChooser();
      return;
    }

    setIsExporting(true);

    try {
      await handleExportXlsx();
      setIsExportModalOpen(false);
      setNotice({ tone: 'success', message: 'Asset register XLSX downloaded.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to export the asset register.',
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function requestProjection(asset: RegisterAsset, formState: ProjectionFormState) {
    const targetYear = Math.round(Number(formState.targetYear));
    const inflationRatePct = Number(formState.inflationRatePct);
    const extraHours = formState.extraHours.trim() ? Number(formState.extraHours) : 0;

    if (!Number.isFinite(targetYear)) {
      setShouldScrollToProjectionResult(false);
      setProjectionError('Select a valid target year.');
      return;
    }

    if (!Number.isFinite(inflationRatePct)) {
      setShouldScrollToProjectionResult(false);
      setProjectionError('Enter a valid inflation rate.');
      return;
    }

    if (!Number.isFinite(extraHours) || extraHours < 0) {
      setShouldScrollToProjectionResult(false);
      setProjectionError('Extra hours must be zero or greater.');
      return;
    }

    const requestId = projectionRequestRef.current + 1;
    projectionRequestRef.current = requestId;

    setIsLoadingProjection(true);
    setProjectionError(null);

    try {
      const response = await fetch('/api/asset-register/projection', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetId: asset.id,
          targetYear,
          inflationRatePct,
          extraHours,
        }),
      });

      const data = (await response.json()) as ProjectionApiResponse;

      if (projectionRequestRef.current !== requestId) {
        return;
      }

      if (!response.ok || !data.ok || !data.projection) {
        throw new Error(data.error ?? 'Failed to calculate future price.');
      }

      setProjectionResult(data.projection);
    } catch (error) {
      if (projectionRequestRef.current !== requestId) {
        return;
      }

      setProjectionResult(null);
      setShouldScrollToProjectionResult(false);
      setProjectionError(error instanceof Error ? error.message : 'Failed to calculate future price.');
    } finally {
      if (projectionRequestRef.current === requestId) {
        setIsLoadingProjection(false);
      }
    }
  }

  function closeProjectionModal() {
    projectionRequestRef.current += 1;
    setProjectionAsset(null);
    setProjectionResult(null);
    setProjectionError(null);
    setProjectionForm(createDefaultProjectionForm());
    setShouldScrollToProjectionResult(false);
    setIsLoadingProjection(false);
  }

  function openProjectionModal(asset: RegisterAsset) {
    const defaults = createDefaultProjectionForm();
    closeActionDialog();
    setProjectionAsset(asset);
    setProjectionForm(defaults);
    setProjectionResult(null);
    setProjectionError(null);
    setShouldScrollToProjectionResult(false);
    void requestProjection(asset, defaults);
  }

  function updateProjectionForm(nextState: Partial<ProjectionFormState>) {
    setProjectionForm((current) => ({
      ...current,
      ...nextState,
    }));
    setProjectionResult(null);
    setProjectionError(null);
    setShouldScrollToProjectionResult(false);
  }

  function handleProjectionPreset(nextState: Partial<ProjectionFormState>) {
    updateProjectionForm(nextState);
  }

  function handleProjectionSubmit() {
    if (!projectionAsset) {
      return;
    }

    setShouldScrollToProjectionResult(true);
    void requestProjection(projectionAsset, projectionForm);
  }

  const hasActiveAssetFilter = assetFilter !== 'all';
  const registerRangeDescription = filteredAssets.length
    ? `Showing ${pageStart + 1}-${pageEnd} of ${filteredAssets.length} ${filteredAssets.length === 1 ? 'asset' : 'assets'}${hasActiveAssetFilter ? ` · ${activeAssetFilterLabel}` : ''}`
    : searchTerm.trim() || hasActiveAssetFilter
      ? 'No assets match the current search or filter.'
      : 'No saved assets yet.';
  const assetFormStepDescription =
    manualAssetStep === 1
      ? 'Select the asset type.'
      : manualAssetStep === 2
        ? 'Add the basic asset details.'
        : manualAssetStep === 3
          ? 'Choose finance and insurance status.'
          : 'Upload files if needed, then add the asset.';
  const selectedManualAssetType = getManualAssetOption(assetFormKind);
  const manualDraftDocumentCount = assetDraft.documents.length + pendingDocumentFiles.length;
  const manualDraftRawPhotoCount = assetDraft.photos.length + pendingPhotoFiles.length;
  const manualDraftPhotoCount = Math.min(MAX_PHOTOS, manualDraftRawPhotoCount);
  const draftPhotoItems = useMemo(
    () => buildDraftPhotoItems(assetDraft.photos, pendingPhotoFiles, mainPhotoSelection),
    [assetDraft.photos, mainPhotoSelection, pendingPhotoFiles],
  );
  const manualStepPrimaryLabel =
    manualAssetStep === 2
      ? 'Next'
      : manualAssetStep === 3
        ? 'Next'
        : editingAsset
          ? 'Update asset'
          : 'Add asset';
  const marketplacePhotoUrls = marketplaceAsset ? normalizePhotos(marketplaceAsset.photos) : [];
  const marketplaceListingTitle = marketplaceAsset ? buildMarketplaceListingTitle(marketplaceAsset, true) : '';
  const marketplaceModalTitle = marketplaceAsset
    ? isLiveOnMarketplace(marketplaceAsset)
      ? 'Update marketplace listing'
      : 'Send to marketplace'
    : '';

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <section className={styles.shell}>
        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <section className={styles.registerPanel}>
          <div className={styles.registerHeader}>
            <div className={`${styles.registerTitleBlock} ${styles.businessRegisterTitleBlock}`}>
              <h1>{isLoading ? 'Loading...' : activeRegister?.businessName || buildOwnerName(reportProfile)}</h1>
            </div>

            <div className={`${styles.headerActions} ${canUseOwnerOnlyAssetActions ? styles.ownerRegisterHeaderActions : styles.sharedRegisterHeaderActions}`}>
              {canUseOwnerOnlyAssetActions ? (
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.summaryTriggerButton} ${styles.headerOptionsButton}`}
                  onClick={openSummaryModal}
                  disabled={isLoading}
                >
                  <OptionsIcon className={styles.buttonIcon} />
                  <span>Summary</span>
                </button>
              ) : null}

              {canUseOwnerOnlyAssetActions ? (
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.headerShareButton}`}
                  onClick={openRegisterShareModal}
                  disabled={!assets.length || isLoading || isExporting}
                >
                  <ShareIcon className={styles.buttonIcon} />
                  <span>Share</span>
                </button>
              ) : null}

              {canUseOwnerOnlyAssetActions ? (
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.headerDownloadButton}`}
                  onClick={openExportModal}
                  disabled={!assets.length || isLoading || isExporting}
                >
                  <DownloadIcon className={styles.buttonIcon} />
                  <span>Download</span>
                </button>
              ) : null}

              <div className={styles.assetFilterWrap} ref={assetFilterWrapRef}>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.filterTriggerButton} ${hasActiveAssetFilter ? styles.filterTriggerButtonActive : ''} ${isAssetFilterOpen ? styles.filterTriggerButtonOpen : ''}`}
                  onClick={() => setIsAssetFilterOpen((current) => !current)}
                  disabled={isLoading}
                  aria-haspopup="menu"
                  aria-expanded={isAssetFilterOpen}
                >
                  <FilterIcon className={styles.buttonIcon} />
                  <span>Filters</span>
                  <ChevronDownIcon className={styles.filterChevron} />
                </button>

                {isAssetFilterOpen ? (
                  <div className={styles.assetFilterMenu} role="menu" aria-label="Filter asset register">
                    {ASSET_FILTER_OPTIONS.map((option) => {
                      const isActiveFilter = assetFilter === option.value;

                      return (
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={isActiveFilter}
                          key={option.value}
                          className={`${styles.assetFilterMenuButton} ${isActiveFilter ? styles.assetFilterMenuButtonActive : ''}`}
                          onClick={() => selectAssetFilter(option.value)}
                        >
                          <span>{option.label}</span>
                          {isActiveFilter ? <span className={styles.assetFilterMenuTick}>✓</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <section className={styles.assetSummaryCarousel} aria-label="Asset register summary">
            <button
              type="button"
              className={styles.assetSummaryArrow}
              onClick={() => handleRegisterSummarySlide(-1)}
              disabled={isRegisterSummaryAtStart}
              aria-label="Show previous asset register summary cards"
            >
              <span aria-hidden="true">&lt;</span>
            </button>

            <div
              className={styles.assetSummaryViewport}
              ref={registerSummaryViewportRef}
              onScroll={handleRegisterSummaryScroll}
              tabIndex={0}
              aria-label="Scrollable asset register summary cards"
            >
              <div className={`${styles.summaryRow} ${styles.heroSummaryRow} ${styles.assetSummaryTrack}`}>
                <div className={`${styles.summaryTile} ${styles.registerValueTile} ${styles.heroSummaryTile} ${styles.heroRegisterTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Register value</span>
                  </div>

                  <div className={styles.heroSummaryValueRow}>
                    <strong className={`${styles.heroSummaryValue} ${styles.heroRegisterValue}`}>
                      {money(displayedRegisterValue)}
                      {registerValueVatMode === 'excluded' ? <span className={styles.heroRegisterVatSuffix}> + VAT</span> : null}
                    </strong>
                  </div>

                  <div className={`${styles.heroSummaryFooter} ${styles.heroVatFooter}`}>
                    <div className={styles.vatToggleGroup} aria-label="Register value VAT display">
                      <button
                        type="button"
                        className={`${styles.vatToggleButton} ${registerValueVatMode === 'excluded' ? styles.vatToggleButtonActive : ''}`}
                        onClick={() => setRegisterValueVatMode('excluded')}
                        aria-pressed={registerValueVatMode === 'excluded'}
                      >
                        Excl. VAT
                      </button>
                      <button
                        type="button"
                        className={`${styles.vatToggleButton} ${registerValueVatMode === 'included' ? styles.vatToggleButtonActive : ''}`}
                        onClick={() => setRegisterValueVatMode('included')}
                        aria-pressed={registerValueVatMode === 'included'}
                      >
                        Incl. VAT
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`${styles.summaryTile} ${styles.metricSummaryTile} ${styles.heroSummaryTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Aim4price valued equipment</span>
                  </div>

                  <div className={styles.heroSummaryValueRow}>
                    <strong className={styles.heroSummaryValue}>{aim4priceValuedEquipmentCount}</strong>
                  </div>

                  <div className={styles.heroSummaryFooter} aria-hidden="true" />
                </div>

                <div className={`${styles.summaryTile} ${styles.totalAssetsTile} ${styles.heroSummaryTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Total assets</span>
                  </div>

                  <div className={styles.heroSummaryValueRow}>
                    <strong className={styles.heroSummaryValue}>{assets.length}</strong>
                  </div>

                  <div className={`${styles.heroSummaryFooter} ${styles.heroTotalFooter}`}>
                    <small>{registerRangeDescription}</small>
                  </div>
                </div>

                <div className={`${styles.summaryTile} ${styles.metricSummaryTile} ${styles.heroSummaryTile} ${styles.summaryBreakdownTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Manual assets</span>
                  </div>

                  <div className={styles.summaryBreakdownBody}>
                    <div className={styles.summaryBreakdownCount}>
                      <span>Count</span>
                      <strong>{manualAssetStats.count}</strong>
                    </div>

                    <div className={styles.summaryBreakdownValues}>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Excl. VAT</span>
                        <strong>{money(manualAssetStats.value)}</strong>
                      </div>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Incl. VAT</span>
                        <strong>{money(Math.round(manualAssetStats.value * 1.15))}</strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles.heroSummaryFooter} aria-hidden="true" />
                </div>

                <div className={`${styles.summaryTile} ${styles.metricSummaryTile} ${styles.heroSummaryTile} ${styles.summaryBreakdownTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Assets financed</span>
                  </div>

                  <div className={styles.summaryBreakdownBody}>
                    <div className={styles.summaryBreakdownCount}>
                      <span>Count</span>
                      <strong>{financedAssetStats.count}</strong>
                    </div>

                    <div className={styles.summaryBreakdownValues}>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Excl. VAT</span>
                        <strong>{money(financedAssetStats.value)}</strong>
                      </div>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Incl. VAT</span>
                        <strong>{money(Math.round(financedAssetStats.value * 1.15))}</strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles.heroSummaryFooter} aria-hidden="true" />
                </div>

                <div className={`${styles.summaryTile} ${styles.metricSummaryTile} ${styles.heroSummaryTile} ${styles.summaryBreakdownTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Assets insured</span>
                  </div>

                  <div className={styles.summaryBreakdownBody}>
                    <div className={styles.summaryBreakdownCount}>
                      <span>Count</span>
                      <strong>{insuredAssetStats.count}</strong>
                    </div>

                    <div className={styles.summaryBreakdownValues}>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Excl. VAT</span>
                        <strong>{money(insuredAssetStats.value)}</strong>
                      </div>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Incl. VAT</span>
                        <strong>{money(Math.round(insuredAssetStats.value * 1.15))}</strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles.heroSummaryFooter} aria-hidden="true" />
                </div>

                <div className={`${styles.summaryTile} ${styles.metricSummaryTile} ${styles.heroSummaryTile} ${styles.summaryBreakdownTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Assets licensed</span>
                  </div>

                  <div className={styles.summaryBreakdownBody}>
                    <div className={styles.summaryBreakdownCount}>
                      <span>Count</span>
                      <strong>{licensedAssetStats.count}</strong>
                    </div>

                    <div className={styles.summaryBreakdownValues}>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Excl. VAT</span>
                        <strong>{money(licensedAssetStats.value)}</strong>
                      </div>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Incl. VAT</span>
                        <strong>{money(Math.round(licensedAssetStats.value * 1.15))}</strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles.heroSummaryFooter} aria-hidden="true" />
                </div>

                <div className={`${styles.summaryTile} ${styles.registerValueTile} ${styles.heroSummaryTile} ${styles.heroRegisterTile} ${styles.replacementSummaryTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Replacement value</span>
                  </div>

                  <div className={styles.heroSummaryValueRow}>
                    <strong className={`${styles.heroSummaryValue} ${styles.heroRegisterValue}`}>
                      {money(displayedReplacementValue)}
                      {replacementValueVatMode === 'excluded' ? <span className={styles.heroRegisterVatSuffix}> + VAT</span> : null}
                    </strong>
                  </div>

                  <div className={`${styles.heroSummaryFooter} ${styles.heroVatFooter}`}>
                    <div className={styles.vatToggleGroup} aria-label="Replacement value VAT display">
                      <button
                        type="button"
                        className={`${styles.vatToggleButton} ${replacementValueVatMode === 'excluded' ? styles.vatToggleButtonActive : ''}`}
                        onClick={() => setReplacementValueVatMode('excluded')}
                        aria-pressed={replacementValueVatMode === 'excluded'}
                      >
                        Excl. VAT
                      </button>
                      <button
                        type="button"
                        className={`${styles.vatToggleButton} ${replacementValueVatMode === 'included' ? styles.vatToggleButtonActive : ''}`}
                        onClick={() => setReplacementValueVatMode('included')}
                        aria-pressed={replacementValueVatMode === 'included'}
                      >
                        Incl. VAT
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className={styles.assetSummaryArrow}
              onClick={() => handleRegisterSummarySlide(1)}
              disabled={isRegisterSummaryAtEnd}
              aria-label="Show next asset register summary cards"
            >
              <span aria-hidden="true">&gt;</span>
            </button>
          </section>

          <div className={styles.toolbar}>
            <label className={styles.searchWrap}>
              <SearchIcon className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by asset, brand, model or serial"
                aria-label="Search asset register"
              />

              {searchTerm ? (
                <button
                  type="button"
                  className={styles.clearSearchButton}
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                >
                  <CloseIcon className={styles.buttonIcon} />
                </button>
              ) : null}
            </label>

            {canUseOwnerOnlyAssetActions ? (
              <button type="button" className={`${styles.primaryButton} ${styles.toolbarPrimaryButton}`} onClick={openAddAssetChoiceModal}>
                <PlusIcon className={styles.buttonIcon} />
                <span>Add Asset</span>
              </button>
            ) : null}
          </div>

          {!isLoading && assets.length ? (
            filteredAssets.length ? (
              <>
                <div className={styles.assetList}>
                  {visibleAssets.map((asset) => {
                    const previewPhoto = assetPreviewImage(asset);
                    const isLive = isLiveOnMarketplace(asset);
                    const isExpanded = expandedAssetId === asset.id;
                    const detailDocuments = assetDocuments(asset);
                    const estimateNeedsUpdate = doesEstimateNeedUpdate(asset) && isValuationUpdateAvailable(asset);
                    const openPartnerNote = asset.openPartnerNote ?? null;
                    const partnerNoteAuthor = openPartnerNote?.partnerBusinessName || openPartnerNote?.partnerName || 'Aim4price partner';
                    const partnerNoteToneClass = openPartnerNote ? quoteToneClassForPartnerType(openPartnerNote.partnerType) : '';
                    const partnerNoteLabel = openPartnerNote?.partnerType ? `${formatQuotePartnerType(openPartnerNote.partnerType)} note` : 'Partner note';
                    const latestMaintenanceStatus = asset.latestMaintenanceStatus ?? null;
                    const maintenanceDoneLabel =
                      latestMaintenanceStatus?.kind === 'checked'
                        ? 'Maintenance checked'
                        : latestMaintenanceStatus?.kind === 'repaired'
                          ? 'Maintenance repaired'
                          : 'Maintenance serviced';
                    const maintenanceDoneMeta = latestMaintenanceStatus
                      ? [
                          latestMaintenanceStatus.operatorName ? `By ${latestMaintenanceStatus.operatorName}` : '',
                          latestMaintenanceStatus.createdAtIso ? formatDate(latestMaintenanceStatus.createdAtIso) : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : '';
                    const isMarkingMaintenanceNoted = latestMaintenanceStatus
                      ? busyMaintenanceStatusId === latestMaintenanceStatus.id
                      : false;

                    return (
                      <article
                        id={`asset-card-${asset.id}`}
                        className={`${styles.assetCard} ${isExpanded ? styles.assetCardExpanded : ''} ${estimateNeedsUpdate ? styles.assetCardEstimateStale : ''} ${openPartnerNote ? `${styles.assetCardPartnerNote} ${partnerNoteToneClass}` : ''} ${latestMaintenanceStatus ? styles.assetCardMaintenanceDone : ''}`}
                        key={asset.id}
                      >
                        <div className={styles.assetHeader}>
                          <div className={styles.assetTitleBlock}>
                            {isLive || estimateNeedsUpdate || openPartnerNote || latestMaintenanceStatus ? (
                              <div className={styles.badgeRow}>
                                {isLive ? <span className={`${styles.badge} ${styles.badgeSuccess}`}>Live on marketplace</span> : null}
                                {estimateNeedsUpdate ? (
                                  <span className={`${styles.badge} ${styles.badgeWarning}`}>Estimate needs update</span>
                                ) : null}
                                {openPartnerNote ? <span className={`${styles.badge} ${styles.badgeInfo} ${partnerNoteToneClass}`}>{partnerNoteLabel}</span> : null}
                                {latestMaintenanceStatus ? <span className={`${styles.badge} ${styles.badgeMaintenanceDone}`}>{maintenanceDoneLabel}</span> : null}
                              </div>
                            ) : null}
                            <h2>{asset.title}</h2>
                            <p>{buildAssetMeta(asset)}</p>
                            <div className={styles.assetMetaRow}>
                              <span className={styles.assetValueMethodLabel}>{methodLabel(asset.selectedMethod)} value</span>
                              <span className={styles.assetSavedDateLabel}>{assetStatusDateLabel(asset)}</span>
                            </div>

                          </div>

                          <div className={styles.assetHeaderAside}>
                            <div className={styles.valueBlock}>
                              <strong>{money(asset.value)}</strong>
                              <span>Excl. VAT</span>
                            </div>

                            <div className={styles.assetHeaderActions}>
                              {estimateNeedsUpdate && canUseOwnerOnlyAssetActions ? (
                                <button
                                  type="button"
                                  className={`${styles.expandButton} ${styles.updateEstimateInlineButton}`}
                                  disabled={busyRevalueAssetId === asset.id}
                                  onClick={() => void handleUpdateEstimate(asset)}
                                >
                                  <TrendIcon className={styles.buttonIcon} />
                                  <span>{busyRevalueAssetId === asset.id ? 'Updating...' : 'Update estimate'}</span>
                                </button>
                              ) : null}

                              <button
                                type="button"
                                className={`${styles.optionsButton} ${styles.cardOptionsButton}`}
                                onClick={() => openAssetQuoteOptions(asset)}
                              >
                                <OptionsIcon className={styles.buttonIcon} />
                                <span>Options</span>
                              </button>

                              <button
                                type="button"
                                className={`${styles.expandButton} ${styles.cardViewDetailsButton}`}
                                onClick={() => setExpandedAssetId((current) => (current === asset.id ? null : asset.id))}
                                aria-expanded={isExpanded}
                                aria-controls={`asset-panel-${asset.id}`}
                              >
                                {isExpanded ? <ChevronUpIcon className={styles.buttonIcon} /> : <ChevronDownIcon className={styles.buttonIcon} />}
                                <span>{isExpanded ? 'Hide details' : 'View details'}</span>
                              </button>

                              <button
                                type="button"
                                className={`${styles.optionsButton} ${styles.cardManageButton}`}
                                onClick={() => openActionDialog(asset)}
                              >
                                <ManageIcon className={styles.buttonIcon} />
                                <span>Manage</span>
                              </button>
                            </div>
                          </div>

                          {openPartnerNote ? (
                            <div className={`${styles.partnerNoteBanner} ${partnerNoteToneClass}`}>
                              <div className={styles.partnerNoteText}>
                                <strong>Note from {partnerNoteAuthor}</strong>
                                <p>{openPartnerNote.noteText}</p>
                                {openPartnerNote.attachment ? (
                                  <a
                                    className={styles.partnerNoteAttachmentLink}
                                    href={openPartnerNote.attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <span>Open quote PDF</span>
                                    <small>{openPartnerNote.attachment.fileName} · {formatByteSize(openPartnerNote.attachment.byteSize)}</small>
                                  </a>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className={styles.partnerNoteButton}
                                onClick={() => void handleMarkPartnerNoteNoted(openPartnerNote.id, asset.id)}
                              >
                                Noted
                              </button>
                            </div>
                          ) : null}

                          {latestMaintenanceStatus ? (
                            <div className={`${styles.partnerNoteBanner} ${styles.maintenanceDoneBanner}`}>
                              <div className={styles.partnerNoteText}>
                                <strong>Maintenance has been done</strong>
                                <p>{latestMaintenanceStatus.summary}</p>
                                {latestMaintenanceStatus.note ? <p>Note: {latestMaintenanceStatus.note}</p> : null}
                                {maintenanceDoneMeta ? <small className={styles.maintenanceDoneMeta}>{maintenanceDoneMeta}</small> : null}
                              </div>
                              <button
                                type="button"
                                className={styles.partnerNoteButton}
                                disabled={isMarkingMaintenanceNoted}
                                onClick={() => void handleMarkMaintenanceStatusNoted(latestMaintenanceStatus.id, asset.id)}
                              >
                                {isMarkingMaintenanceNoted ? 'Noting...' : 'Noted'}
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {isExpanded ? (
                          <div className={styles.assetBody} id={`asset-panel-${asset.id}`}>
                            {(() => {
                              const detailPhotos = getDetailPhotos(asset);
                              const detailPhotoIndex = getDetailPhotoIndex(asset);
                              const detailPhoto = detailPhotos[detailPhotoIndex] || previewPhoto;
                              const hasMultiplePhotos = detailPhotos.length > 1;
                              const hasRealPhotos = detailPhotos.length > 0;
                              const isDetailPhotoUploading = detailMediaUpload?.assetId === asset.id && detailMediaUpload.type === 'photo';
                              const isDetailDocumentUploading = detailMediaUpload?.assetId === asset.id && detailMediaUpload.type === 'document';

                              return (
                                <>
                                  <div className={styles.previewWrap}>
                                    <input
                                      id={mediaInputId(asset.id, 'photo')}
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp"
                                      multiple
                                      className={styles.fileInput}
                                      onChange={(event) => { void handleDetailPhotoFilesSelected(asset, event); }}
                                      disabled={isDetailPhotoUploading}
                                    />

                                    <div
                                      className={`${styles.previewStage} ${canUseOwnerOnlyAssetActions ? styles.previewStageClickable : ''} ${isDetailPhotoUploading ? styles.assetMediaBusy : ''}`}
                                      role={canUseOwnerOnlyAssetActions ? 'button' : undefined}
                                      tabIndex={canUseOwnerOnlyAssetActions ? 0 : undefined}
                                      onClick={() => {
                                        if (canUseOwnerOnlyAssetActions && !isDetailPhotoUploading) {
                                          triggerDetailMediaInput(asset.id, 'photo');
                                        }
                                      }}
                                      onKeyDown={(event) => handleDetailMediaKeyDown(event, asset.id, 'photo')}
                                      onTouchStart={(event) => handleDetailPhotoTouchStart(event.changedTouches[0]?.clientX ?? 0)}
                                      onTouchEnd={(event) => handleDetailPhotoTouchEnd(asset, event.changedTouches[0]?.clientX ?? 0)}
                                      aria-label={hasRealPhotos ? 'Upload more asset photos' : 'Upload asset photos'}
                                    >
                                      {hasRealPhotos && detailPhoto ? (
                                        <>
                                          <img src={detailPhoto} alt={`${asset.title} photo ${detailPhotoIndex + 1}`} className={styles.previewImage} />

                                          {hasMultiplePhotos ? (
                                            <>
                                              <button
                                                type="button"
                                                className={`${styles.previewNavButton} ${styles.previewNavPrev}`}
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  cycleDetailPhoto(asset, -1);
                                                }}
                                                aria-label="Show previous photo"
                                              >
                                                <ChevronLeftIcon className={styles.buttonIcon} />
                                              </button>

                                              <button
                                                type="button"
                                                className={`${styles.previewNavButton} ${styles.previewNavNext}`}
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  cycleDetailPhoto(asset, 1);
                                                }}
                                                aria-label="Show next photo"
                                              >
                                                <ChevronRightIcon className={styles.buttonIcon} />
                                              </button>

                                              <div className={styles.previewCounter}>
                                                {detailPhotoIndex + 1} / {detailPhotos.length}
                                              </div>
                                            </>
                                          ) : null}
                                        </>
                                      ) : (
                                        <div className={styles.previewPlaceholder}>
                                          <div className={styles.previewPlaceholderBadges}>
                                            <span className={`${styles.badge} ${styles.badgeNeutral} ${styles.previewPlaceholderBadge}`}>
                                              {assetFamilyLabel(asset)}
                                            </span>
                                          </div>
                                        </div>
                                      )}

                                      {canUseOwnerOnlyAssetActions ? (
                                        <button
                                          type="button"
                                          className={styles.previewUploadPill}
                                          disabled={isDetailPhotoUploading}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            triggerDetailMediaInput(asset.id, 'photo');
                                          }}
                                        >
                                          <PlusIcon className={styles.buttonIcon} />
                                          <span>{isDetailPhotoUploading ? 'Uploading...' : hasRealPhotos ? 'Add photos' : 'Upload photos'}</span>
                                        </button>
                                      ) : null}
                                    </div>

                                    {hasMultiplePhotos ? (
                                      <div className={styles.previewThumbRow}>
                                        {detailPhotos.map((photo, index) => {
                                          const isActivePhoto = index === detailPhotoIndex;
                                          return (
                                            <button
                                              type="button"
                                              key={`${asset.id}-detail-photo-${index}`}
                                              className={`${styles.previewThumbButton} ${isActivePhoto ? styles.previewThumbButtonActive : ''}`}
                                              onClick={() => setDetailPhotoIndex(asset.id, index)}
                                              aria-label={`View photo ${index + 1}`}
                                            >
                                              <img src={photo} alt={`${asset.title} thumbnail ${index + 1}`} className={styles.previewThumbImage} />
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className={styles.assetDocumentsPanel}>
                                    <input
                                      id={mediaInputId(asset.id, 'document')}
                                      type="file"
                                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,image/jpeg,image/png,image/webp"
                                      multiple
                                      className={styles.fileInput}
                                      onChange={(event) => { void handleDetailDocumentFilesSelected(asset, event); }}
                                      disabled={isDetailDocumentUploading}
                                    />

                                    <button
                                      type="button"
                                      className={`${styles.assetDocumentsCard} ${styles.assetDocumentsUploadCard} ${isDetailDocumentUploading ? styles.assetMediaBusy : ''}`}
                                      onClick={() => triggerDetailMediaInput(asset.id, 'document')}
                                      disabled={isDetailDocumentUploading}
                                    >
                                      <div className={styles.assetDocumentsMainLabel}>
                                        <DocumentIcon className={styles.buttonIcon} />
                                        <strong>Documents</strong>
                                      </div>
                                      <span className={styles.assetMediaHint}>
                                        {isDetailDocumentUploading
                                          ? 'Uploading...'
                                          : detailDocuments.length
                                            ? `${detailDocuments.length} saved · click to add`
                                            : 'Click to upload documents'}
                                      </span>
                                    </button>

                                    {detailDocuments.length ? (
                                      <div className={styles.assetDocumentList}>
                                        {detailDocuments.map((document) => (
                                          <button
                                            type="button"
                                            className={styles.assetDocumentLink}
                                            key={document.id}
                                            onClick={() => { void openAssetDocument(document); }}
                                            title={`Open ${document.fileName}`}
                                          >
                                            <DocumentIcon className={styles.buttonIcon} />
                                            <span>{shortDocumentName(document.fileName)}</span>
                                          </button>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className={styles.assetDetailDivider} aria-hidden="true" />

                                  <div className={styles.assetDetailsPanel}>
                                    <div className={styles.assetDetailsGrid}>
                                      <div className={styles.assetPrimaryDetails}>
                                        <div className={styles.assetDetailRow}>
                                          <span>Serial</span>
                                          <strong>{asset.serialNumber || '—'}</strong>
                                        </div>
                                        <div className={styles.assetDetailRow}>
                                          <span>{asset.kind === 'property' ? 'Year Built' : 'Year'}</span>
                                          <strong>{asset.yearModel || '—'}</strong>
                                        </div>
                                        <div className={styles.assetDetailRow}>
                                          <span>Usage</span>
                                          <strong>{buildAssetUsageValue(asset)}</strong>
                                        </div>
                                        <div className={styles.assetDetailRow}>
                                          <span>Condition</span>
                                          <strong>{conditionLabel(asset.condition)}</strong>
                                        </div>
                                      </div>

                                      <div className={styles.assetStatusDetails}>
                                        <div className={styles.assetStatusRow}>
                                          <span>Financed</span>
                                          {renderAssetStatusMark(readFinanceStatusChoice(asset))}
                                        </div>
                                        <div className={styles.assetStatusRow}>
                                          <span>Insured</span>
                                          {renderAssetStatusMark(readInsuranceStatusChoice(asset))}
                                        </div>
                                        <div className={styles.assetStatusRow}>
                                          <span>Licensed</span>
                                          {renderAssetStatusMark(readLicenseStatusChoice(asset))}
                                        </div>
                                        {readLicenseStatusChoice(asset) === 'yes' && readLicenseRegistrationNumber(asset) ? (
                                          <div className={`${styles.assetStatusRow} ${styles.assetRegistrationRow}`}>
                                            <strong>{readLicenseRegistrationNumber(asset)}</strong>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className={styles.assetReplacementPriceBubble}>
                                      <span>Replacement Price</span>
                                      <strong>{readAssetReplacementPriceExVat(asset) ? money(readAssetReplacementPriceExVat(asset) ?? 0) : 'Not set'}</strong>
                                      <small>Excl. VAT</small>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>

                {pageCount > 1 ? (
                  <div className={styles.paginationBar}>
                    <div className={styles.paginationMeta}>
                      Page {currentPage} of {pageCount}
                    </div>

                    <div className={styles.paginationActions}>
                      <button
                        type="button"
                        className={styles.paginationButton}
                        onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeftIcon className={styles.buttonIcon} />
                        <span>Previous</span>
                      </button>

                      {paginationItems.map((item, index) =>
                        item === 'ellipsis' ? (
                          <span className={styles.paginationEllipsis} key={`ellipsis-${index}`}>
                            …
                          </span>
                        ) : (
                          <button
                            type="button"
                            key={item}
                            className={`${styles.paginationButton} ${item === currentPage ? styles.paginationButtonActive : ''}`}
                            onClick={() => setCurrentPage(item)}
                          >
                            {item}
                          </button>
                        ),
                      )}

                      <button
                        type="button"
                        className={styles.paginationButton}
                        onClick={() => setCurrentPage((current) => Math.min(pageCount, current + 1))}
                        disabled={currentPage === pageCount}
                      >
                        <span>Next</span>
                        <ChevronRightIcon className={styles.buttonIcon} />
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className={styles.emptyState}>
                <h3>No assets match your search or filter</h3>
                <p>Try a broader term, choose another filter, or clear both to see the full register again.</p>
                <div className={styles.emptyStateActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setSearchTerm('');
                      clearAssetFilter();
                    }}
                  >
                    Clear search and filter
                  </button>
                </div>
              </div>
            )
          ) : !isLoading ? (
            <div className={styles.emptyState}>
              <h3>No assets saved yet</h3>
              <p>Run a valuation or add a manual asset to start building your register.</p>
              {canUseOwnerOnlyAssetActions ? (
                <div className={styles.emptyStateActions}>
                  <Link href="/valuation" className={styles.secondaryButton}>
                    Go to valuation
                  </Link>
                  <button type="button" className={styles.primaryButton} onClick={openAddAssetChoiceModal}>
                    <PlusIcon className={styles.buttonIcon} />
                    <span>Add Asset</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </section>

      {isRegisterShareModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeRegisterShareModal} />

          <div
            className={`${styles.optionsModal} ${styles.assetQuoteModal} ${styles.registerShareModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-register-share-title"
          >
            <div className={`${styles.modalHeader} ${styles.optionsModalHeader} ${styles.assetQuoteModalHeader} ${styles.registerShareModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-register-share-title">Share full Asset Register</h3>
                <p>Send the complete register as a once-off to a finance or insurance partner.</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeRegisterShareModal}
                aria-label="Close register share options"
                disabled={isExporting}
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.optionsScrollBody} ${styles.assetQuoteScrollBody} ${styles.registerShareModalBody}`}>
              <div className={styles.optionsContent}>
                <div className={`${styles.optionsGrid} ${styles.assetOptionsGrid} ${styles.assetQuoteChoiceGrid} ${styles.registerShareOptionGrid}`}>
                  <button
                    type="button"
                    className={`${styles.optionActionButton} ${styles.assetQuoteChoiceCard} ${styles.registerShareOptionCard} ${quoteToneClassForLeadType('finance')}`}
                    onClick={() => openFullRegisterQuotePartnerPicker('finance')}
                    disabled={isExporting}
                  >
                    <span className={styles.assetQuoteChoiceIconTile}>
                      {renderQuoteOptionIcon('finance', styles.assetQuoteChoiceIcon)}
                    </span>
                    <span className={styles.assetQuoteChoiceText}>
                      <strong>Get refinance quote</strong>
                      <small>
                        <span>Send a once-off full-register to a finance partner.</span>
                      </small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.optionActionButton} ${styles.assetQuoteChoiceCard} ${styles.registerShareOptionCard} ${quoteToneClassForLeadType('insurance')}`}
                    onClick={() => openFullRegisterQuotePartnerPicker('insurance')}
                    disabled={isExporting}
                  >
                    <span className={styles.assetQuoteChoiceIconTile}>
                      {renderQuoteOptionIcon('insurance', styles.assetQuoteChoiceIcon)}
                    </span>
                    <span className={styles.assetQuoteChoiceText}>
                      <strong>Get insurance quote</strong>
                      <small>
                        <span>Send a once-off full-register to an insurance partner.</span>
                      </small>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isSummaryModalOpen ? (
        <div className={`${styles.modalOverlay} ${styles.summaryModalOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closeSummaryModal} />

          <div className={`${styles.modalCard} ${styles.summaryModal}`} role="dialog" aria-modal="true" aria-labelledby="asset-register-summary-title">
            <div className={`${styles.modalHeader} ${styles.summaryModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-register-summary-title">Register summary</h3>
                <p>Live totals calculated from the saved assets in this register. Financed, insured and licensed totals update when those asset statuses are changed.</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeSummaryModal}
                aria-label="Close register summary"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={styles.summaryModalBody}>
              <section className={styles.summaryCurrentPanel} aria-label="Current register values">
                <div className={styles.summarySectionHeader}>
                  <div>
                    <span>Current register values</span>
                    <p>Saved asset values currently used in the register totals.</p>
                  </div>
                </div>

                <div className={styles.summaryValueTable}>
                  <div className={styles.summaryValueTableHeader} aria-hidden="true">
                    <span>Category</span>
                    <span>Count</span>
                    <span>Excl. VAT</span>
                    <span>Incl. VAT</span>
                  </div>

                  <div className={styles.summaryValueTableRows}>
                    <div className={styles.summaryValueTableRow}>
                      <span>Total assets</span>
                      <strong>{assets.length}</strong>
                      <small>{money(totalValue)}</small>
                      <small>{money(totalValueInclVat)}</small>
                    </div>

                    <div className={styles.summaryValueTableRow}>
                      <span>Aim4price assets</span>
                      <strong>{aim4priceValuedEquipmentCount}</strong>
                      <small>{money(aim4priceValuedEquipmentValue)}</small>
                      <small>{money(Math.round(aim4priceValuedEquipmentValue * 1.15))}</small>
                    </div>

                    <div className={styles.summaryValueTableRow}>
                      <span>Manual assets</span>
                      <strong>{manualAssetStats.count}</strong>
                      <small>{money(manualAssetStats.value)}</small>
                      <small>{money(Math.round(manualAssetStats.value * 1.15))}</small>
                    </div>

                    <div className={styles.summaryValueTableRow}>
                      <span>Assets financed</span>
                      <strong>{financedAssetStats.count}</strong>
                      <small>{money(financedAssetStats.value)}</small>
                      <small>{money(Math.round(financedAssetStats.value * 1.15))}</small>
                    </div>

                    <div className={styles.summaryValueTableRow}>
                      <span>Assets insured</span>
                      <strong>{insuredAssetStats.count}</strong>
                      <small>{money(insuredAssetStats.value)}</small>
                      <small>{money(Math.round(insuredAssetStats.value * 1.15))}</small>
                    </div>

                    <div className={styles.summaryValueTableRow}>
                      <span>Assets licensed</span>
                      <strong>{licensedAssetStats.count}</strong>
                      <small>{money(licensedAssetStats.value)}</small>
                      <small>{money(Math.round(licensedAssetStats.value * 1.15))}</small>
                    </div>
                  </div>
                </div>
              </section>

              <section className={`${styles.summaryReplacementPanel} ${styles.summaryReplacementRegisterTile}`} aria-label="Replacement value summary">
                <div className={styles.summaryReplacementTileHead}>
                  <div className={styles.summaryReplacementCopy}>
                    <span>Replacement value</span>
                    <p>Total replacement cost for assets with saved replacement prices. This is separate from the current register-value totals above.</p>
                  </div>
                </div>

                <div className={styles.summaryReplacementMainValue}>
                  <strong>{money(totalReplacementValue)}</strong>
                  <small>Excl. VAT</small>
                </div>

                <div className={styles.summaryReplacementTileFooter} aria-label="Replacement value supporting totals">
                  <div className={styles.summaryReplacementFooterMetric}>
                    <span>Incl. VAT</span>
                    <strong>{money(totalReplacementValueInclVat)}</strong>
                  </div>
                  <div className={styles.summaryReplacementFooterMetric}>
                    <span>Assets priced</span>
                    <strong>{replacementPricedAssetCount}</strong>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {isAddChoiceModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeAddAssetChoiceModal} />

          <div className={`${styles.modalCard} ${styles.addAssetChoiceModal}`} role="dialog" aria-modal="true" aria-labelledby="add-asset-choice-title">
            <div className={`${styles.modalHeader} ${styles.addAssetChoiceHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="add-asset-choice-title">Choose how to add the asset</h3>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeAddAssetChoiceModal}
                aria-label="Close add asset options"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={styles.addAssetChoiceGrid}>
              <Link href="/valuation" className={`${styles.addAssetChoiceButton} ${styles.addAssetChoiceButtonPrimary}`}>
                <TrendIcon className={styles.buttonIcon} />
                <span>
                  <strong>Aim4price Value</strong>
                  <small>Estimate with Aim4price, save it to this register, and allow pricing to auto-update when the asset gets updated.</small>
                </span>
              </Link>

              <button type="button" className={styles.addAssetChoiceButton} onClick={openManualEntryFromChoice}>
                <DocumentIcon className={styles.buttonIcon} />
                <span>
                  <strong>Manual Entry</strong>
                  <small>Add a known value, asset details, documents, photos and status information yourself.</small>
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAssetModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeAssetModal} />

          <div
            className={`${styles.modalCard} ${styles.assetFormModal} ${manualAssetStep === 1 ? styles.assetFormModalStepOne : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-form-title"
          >
            <div className={`${styles.modalHeader} ${styles.assetFormModalHeader} ${styles.manualWizardHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-form-title">{editingAsset ? 'Update asset' : 'Add asset'}</h3>
                <p>{assetFormStepDescription}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeAssetModal}
                aria-label="Close asset form"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.manualStepScrollBody} ${manualAssetStep === 1 ? styles.manualStepScrollBodyNoScroll : ''}`}>
              <form className={`${styles.modalForm} ${styles.manualAssetForm} ${styles.manualStepForm}`} onSubmit={(event) => event.preventDefault()}>
                {manualAssetStep === 1 ? (
                  <section className={`${styles.manualStageCard} ${styles.manualSingleStageCard} ${styles.manualCompactStageCard} ${styles.manualStepOneCard} ${styles.fullWidth}`}>
                    <div className={styles.manualStepIntro}>
                      <h4>Asset type</h4>
                    </div>

                    {editingAsset?.valuationRunId ? (
                      <label className={`${styles.field} ${styles.assetTypeField} ${styles.manualLockedTypeCard}`}>
                        <span>Asset type</span>
                        <input value={kindLabel(editingAsset.kind)} disabled readOnly />
                      </label>
                    ) : (
                      <ModalSelect<AssetKind>
                        label="Choose type"
                        value={hasManualAssetKindSelection ? assetFormKind : ''}
                        placeholder="Select asset type"
                        options={MANUAL_ASSET_TYPE_OPTIONS}
                        onChange={(nextKind) => selectManualAssetKind(nextKind, true)}
                        className={styles.manualCompactSelectField}
                        autoFocus
                      />
                    )}
                  </section>
                ) : null}

                {manualAssetStep === 2 ? (
                  <section className={`${styles.manualStageCard} ${styles.manualSingleStageCard} ${styles.manualCompactStageCard} ${styles.fullWidth}`}>
                    <div className={styles.manualStepIntro}>
                      <h4>Details</h4>
                    </div>

                    <div className={styles.manualSelectedTypeStrip}>
                      <span>Type</span>
                      <strong>{selectedManualAssetType.label}</strong>
                    </div>

                    <div className={`${styles.manualStageGrid} ${styles.manualPrimaryFields} ${styles.manualValueGrid}`}>
                      <label className={`${styles.field} ${styles.manualTitleField}`}>
                        <span>Asset title</span>
                        <input
                          value={assetDraft.title}
                          onChange={(event) =>
                            setAssetDraft((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          placeholder={selectedManualAssetType.titlePlaceholder}
                          autoFocus
                        />
                      </label>

                      <label className={`${styles.field} ${styles.manualValueField}`}>
                        <span>Current Value excl. VAT</span>
                        <div className={styles.manualCurrencyInput}>
                          <span>R</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatRegisterValueInput(assetDraft.value)}
                            onChange={(event) =>
                              setAssetDraft((current) => ({
                                ...current,
                                value: formatRegisterValueInput(event.target.value),
                              }))
                            }
                            placeholder="0"
                          />
                        </div>
                      </label>

                      <label className={`${styles.field} ${styles.manualReplacementValueField}`}>
                        <span>Replacement Price excl. VAT *</span>
                        <div className={styles.manualCurrencyInput}>
                          <span>R</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatRegisterValueInput(assetDraft.replacementPrice)}
                            onChange={(event) =>
                              setAssetDraft((current) => ({
                                ...current,
                                replacementPrice: formatRegisterValueInput(event.target.value),
                              }))
                            }
                            placeholder="Required"
                          />
                        </div>
                      </label>
                    </div>

                    <div className={`${styles.manualStageGrid} ${styles.manualOptionalGrid}`}>
                      <label className={styles.field}>
                        <span>Serial / reference</span>
                        <input
                          value={assetDraft.serialNumber}
                          onChange={(event) =>
                            setAssetDraft((current) => ({
                              ...current,
                              serialNumber: event.target.value,
                            }))
                          }
                          placeholder="Optional"
                        />
                      </label>

                      <label className={styles.field}>
                        <span>{yearFieldLabel}</span>
                        <input
                          type="number"
                          min="1800"
                          max={new Date().getFullYear() + 1}
                          step="1"
                          value={assetDraft.yearModel}
                          onChange={(event) =>
                            setAssetDraft((current) => ({
                              ...current,
                              yearModel: event.target.value,
                            }))
                          }
                          placeholder="Optional"
                        />
                      </label>

                      {assetFormKind === 'vehicle' ? (
                        <ModalSelect<UsageMetric>
                          label="Usage type"
                          value={assetDraft.usageMetric}
                          options={[
                            { value: 'km', label: 'Kilometres', description: 'Use odometer readings for vehicles.' },
                            { value: 'hours', label: 'Hours', description: 'Use machine or engine hours.' },
                          ]}
                          onChange={(nextUsageMetric) =>
                            setAssetDraft((current) => ({
                              ...current,
                              usageMetric: normalizeUsageMetric(nextUsageMetric, 'vehicle'),
                            }))
                          }
                        />
                      ) : null}

                      {showUsageHoursField ? (
                        <label className={styles.field}>
                          <span>{usageFieldLabel}</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatUsageAmountInput(assetDraft.hours)}
                            onChange={(event) =>
                              setAssetDraft((current) => ({
                                ...current,
                                hours: formatUsageAmountInput(event.target.value),
                              }))
                            }
                            placeholder="Optional"
                          />
                        </label>
                      ) : null}

                      {showLifeWorkedPercentField ? (
                        <label className={styles.field}>
                          <span>Lifetime worked %</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={assetDraft.lifeWorkedPercent}
                            onChange={(event) =>
                              setAssetDraft((current) => ({
                                ...current,
                                lifeWorkedPercent: event.target.value,
                              }))
                            }
                            placeholder="Optional"
                          />
                        </label>
                      ) : null}

                      {showConditionField ? (
                        <ModalSelect<AssetConditionValue>
                          label="Condition"
                          value={assetDraft.condition}
                          options={CONDITION_OPTIONS}
                          onChange={(nextCondition) =>
                            setAssetDraft((current) => ({
                              ...current,
                              condition: nextCondition,
                            }))
                          }
                        />
                      ) : null}

                      <label className={`${styles.field} ${styles.fullWidth}`}>
                        <span>Notes</span>
                        <textarea
                          rows={3}
                          value={assetDraft.note}
                          onChange={(event) =>
                            setAssetDraft((current) => ({
                              ...current,
                              note: event.target.value,
                            }))
                          }
                          placeholder="Optional"
                        />
                      </label>
                    </div>
                  </section>
                ) : null}

                {manualAssetStep === 3 ? (
                  <section className={`${styles.manualStageCard} ${styles.manualSingleStageCard} ${styles.manualCompactStageCard} ${styles.fullWidth}`}>
                    <div className={styles.manualStepIntro}>
                      <h4>Finance, insurance and license</h4>
                    </div>

                    <div className={styles.manualStageGrid}>
                      <ModalSelect<AssetStatusChoice>
                        label="Finance status"
                        value={assetDraft.financeStatus}
                        options={FINANCE_STATUS_OPTIONS}
                        onChange={setAssetFinanceStatus}
                      />

                      <ModalSelect<AssetStatusChoice>
                        label="Insurance status"
                        value={assetDraft.insuranceStatus}
                        options={INSURANCE_STATUS_OPTIONS}
                        onChange={setAssetInsuranceStatus}
                      />

                      <ModalSelect<AssetStatusChoice>
                        label="License status"
                        value={assetDraft.licenseStatus}
                        options={LICENSE_STATUS_OPTIONS}
                        onChange={setAssetLicenseStatus}
                      />

                      {assetDraft.licenseStatus === 'yes' ? (
                        <label className={`${styles.field} ${styles.manualStatusNoteField}`}>
                          <span>Numberplate / registration</span>
                          <input
                            value={assetDraft.licenseRegistrationNumber}
                            onChange={(event) =>
                              setAssetDraft((current) => ({
                                ...current,
                                licenseRegistrationNumber: event.target.value.toUpperCase(),
                              }))
                            }
                            placeholder="Example: CA 123-456"
                          />
                        </label>
                      ) : null}

                      {assetDraft.financeStatus === 'yes' ? (
                        <label className={`${styles.field} ${styles.manualStatusNoteField}`}>
                          <span>Finance note</span>
                          <input
                            value={assetDraft.financeNote}
                            onChange={(event) =>
                              setAssetDraft((current) => ({
                                ...current,
                                financeNote: event.target.value,
                              }))
                            }
                            placeholder="Optional"
                          />
                        </label>
                      ) : null}

                      {assetDraft.insuranceStatus === 'yes' ? (
                        <label className={`${styles.field} ${styles.manualStatusNoteField}`}>
                          <span>Insurance note</span>
                          <input
                            value={assetDraft.insuranceNote}
                            onChange={(event) =>
                              setAssetDraft((current) => ({
                                ...current,
                                insuranceNote: event.target.value,
                              }))
                            }
                            placeholder="Optional"
                          />
                        </label>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {manualAssetStep === 4 ? (
                  <section className={`${styles.manualStageCard} ${styles.manualSingleStageCard} ${styles.manualCompactStageCard} ${styles.fullWidth}`}>
                    <div className={styles.manualStepIntro}>
                      <h4>Documents and photos</h4>
                    </div>

                    <div className={styles.manualReviewStrip}>
                      <div>
                        <span>Type</span>
                        <strong>{selectedManualAssetType.label}</strong>
                      </div>
                      <div>
                        <span>Title</span>
                        <strong>{assetDraft.title.trim() || 'No title'}</strong>
                      </div>
                      <div className={styles.manualReviewValueTile}>
                        <span>Current Value</span>
                        <strong>
                          {money(parseRegisterValueInput(assetDraft.value))}
                          <small>Excl. VAT</small>
                        </strong>
                      </div>
                      <div className={styles.manualReviewValueTile}>
                        <span>Replacement Price</span>
                        <strong>
                          {money(parseRegisterValueInput(assetDraft.replacementPrice))}
                          <small>Excl. VAT</small>
                        </strong>
                      </div>
                    </div>

                    <div className={styles.manualStageGrid}>
                      <div className={styles.field}>
                        <span>Documents <small>(optional)</small></span>

                        <div className={styles.documentUploadPanel}>
                          <div className={styles.uploadRow}>
                            <label
                              className={`${styles.secondaryButton} ${styles.filePickerButton} ${isUploadingDocuments || manualDraftDocumentCount >= MAX_DOCUMENTS ? styles.filePickerButtonDisabled : ''}`}
                            >
                              <span>{isUploadingDocuments ? 'Uploading...' : 'Add documents'}</span>
                              <input
                                ref={documentInputRef}
                                type="file"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,image/jpeg,image/png,image/webp"
                                multiple
                                className={styles.fileInput}
                                onChange={handleDocumentFilesSelected}
                                disabled={isUploadingDocuments || manualDraftDocumentCount >= MAX_DOCUMENTS}
                              />
                            </label>

                            <span className={styles.uploadCount}>
                              {manualDraftDocumentCount} / {MAX_DOCUMENTS}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.field}>
                        <span>Photos <small>(optional)</small></span>

                        <div className={styles.uploadPanel}>
                          <div className={styles.uploadRow}>
                            <label
                              className={`${styles.secondaryButton} ${styles.filePickerButton} ${isUploadingPhotos ? styles.filePickerButtonDisabled : ''}`}
                            >
                              <span>{isUploadingPhotos ? 'Uploading...' : manualDraftPhotoCount >= MAX_PHOTOS ? 'Add / replace photos' : 'Add photos'}</span>
                              <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                className={styles.fileInput}
                                onChange={handlePhotoFilesSelected}
                                disabled={isUploadingPhotos}
                              />
                            </label>

                            <span className={styles.uploadCount}>
                              {manualDraftPhotoCount} / {MAX_PHOTOS}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {assetDraft.documents.length ? (
                      <div className={styles.documentDraftList}>
                        {assetDraft.documents.map((document) => (
                          <div className={styles.documentDraftRow} key={document.id}>
                            <span className={styles.documentDraftIcon}>
                              <DocumentIcon className={styles.buttonIcon} />
                            </span>
                            <div>
                              <strong>{shortDocumentName(document.fileName)}</strong>
                              <small>{formatByteSize(document.byteSize)}</small>
                            </div>
                            <button
                              type="button"
                              className={styles.documentOpenLink}
                              onClick={() => { void openAssetDocument(document); }}
                            >
                              Open
                            </button>
                            <button type="button" className={styles.documentRemoveButton} onClick={() => removeDraftDocument(document.id)}>
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}


                    {pendingDocumentFiles.length ? (
                      <div className={styles.documentDraftList}>
                        {pendingDocumentFiles.map((file, index) => (
                          <div className={`${styles.documentDraftRow} ${styles.pendingDraftRow}`} key={`${file.name}-${file.size}-${index}`}>
                            <span className={styles.documentDraftIcon}>
                              <DocumentIcon className={styles.buttonIcon} />
                            </span>
                            <div>
                              <strong>{shortDocumentName(file.name)}</strong>
                              <small>Ready to upload · {formatByteSize(file.size)}</small>
                            </div>
                            <button type="button" className={styles.documentRemoveButton} onClick={() => removePendingDocumentFile(index)}>
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {draftPhotoItems.length ? (
                      <div className={styles.photoDraftSection}>
                        <div className={styles.photoMainHelp}>
                          <strong>Main photo</strong>
                          <span>The first photo below is used first on the asset card, PDFs and marketplace listing.</span>
                        </div>

                        <div className={styles.photoGrid}>
                          {draftPhotoItems.map((photoItem, index) => (
                            <div
                              className={`${styles.photoThumb} ${photoItem.isMain ? styles.photoThumbMain : ''} ${photoItem.source === 'pending' ? styles.pendingPhotoThumb : ''}`}
                              key={photoItem.key}
                            >
                              <div className={styles.photoThumbMedia}>
                                <img
                                  src={photoItem.previewUrl || FALLBACK_ASSET_IMAGE}
                                  alt={photoItem.isMain ? 'Main asset photo' : `Asset photo ${index + 1}`}
                                />
                                {photoItem.isMain ? <span className={styles.photoMainBadge}>Main photo</span> : null}
                                {photoItem.source === 'pending' ? <span className={styles.photoPendingBadge}>Ready</span> : null}
                              </div>

                              <div className={styles.photoThumbActions}>
                                <button
                                  type="button"
                                  className={`${styles.photoMakeMainButton} ${photoItem.isMain ? styles.photoMakeMainButtonActive : ''}`}
                                  onClick={() => selectMainDraftPhoto(photoItem)}
                                  disabled={photoItem.isMain}
                                >
                                  {photoItem.isMain ? 'Main' : 'Make main'}
                                </button>

                                <button
                                  type="button"
                                  className={styles.photoRemoveButton}
                                  onClick={() =>
                                    photoItem.source === 'saved' && photoItem.url
                                      ? removeDraftPhoto(photoItem.url)
                                      : photoItem.pendingId
                                        ? removePendingPhotoFile(photoItem.pendingId)
                                        : undefined
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <div className={`${styles.formActions} ${styles.assetFormActions} ${styles.manualStepFormActions}`}>
                  <div className={styles.assetFormActionRight}>
                    {manualAssetStep === 1 ? (
                      <button type="button" className={styles.secondaryButton} onClick={closeAssetModal}>
                        Cancel
                      </button>
                    ) : (
                      <button type="button" className={styles.secondaryButton} onClick={goToPreviousManualAssetStep}>
                        Back
                      </button>
                    )}

                    {manualAssetStep > 1 ? (
                      <button type="button" className={styles.secondaryButton} onClick={closeAssetModal}>
                        Cancel
                      </button>
                    ) : null}

                    {manualAssetStep < 4 ? (
                      manualAssetStep > 1 || editingAsset?.valuationRunId ? (
                        <button type="button" className={styles.primaryButton} onClick={goToNextManualAssetStep}>
                          {manualAssetStep === 1 ? 'Next' : manualStepPrimaryLabel}
                        </button>
                      ) : null
                    ) : (
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => void handleAssetSubmit()}
                        disabled={isSavingAsset || isUploadingPhotos || isUploadingDocuments}
                      >
                        {isSavingAsset ? 'Saving...' : manualStepPrimaryLabel}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {isQuoteModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeAssetQuoteModal} />

          <div
            className={`${styles.optionsModal} ${styles.assetQuoteModal} ${selectedQuoteOption ? styles.assetQuotePartnerPickerModal : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-quote-title"
          >
            <div className={`${styles.modalHeader} ${styles.optionsModalHeader} ${styles.assetQuoteModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-quote-title">{selectedQuoteOption ? selectedQuoteOption.mapTitle : isFullRegisterQuoteLead ? 'Share full Asset Register' : quoteAsset?.title}</h3>
                {!selectedQuoteOption ? (
                  <p>{quoteAsset ? `${buildAssetMeta(quoteAsset)} · ${money(quoteAsset.value)} excl. VAT` : ''}</p>
                ) : isFullRegisterQuoteLead ? (
                  <p>Once-off full-register snapshot · {assets.length} {assets.length === 1 ? 'asset' : 'assets'} · {money(totalValue)} excl. VAT</p>
                ) : null}
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeAssetQuoteModal}
                aria-label="Close asset options"
                disabled={isSendingQuoteLead}
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.optionsScrollBody} ${styles.assetQuoteScrollBody}`}>
              {!selectedQuoteOption ? (
                <div className={styles.optionsContent}>
                  <div className={`${styles.optionsGrid} ${styles.assetOptionsGrid} ${styles.assetQuoteChoiceGrid}`}>
                    {ASSET_QUOTE_OPTIONS.map((option) => (
                      <button
                        key={option.leadType}
                        type="button"
                        className={`${styles.optionActionButton} ${styles.assetQuoteChoiceCard} ${quoteToneClassForLeadType(option.leadType)}`}
                        onClick={() => openQuotePartnerPicker(option.leadType)}
                      >
                        <span className={styles.assetQuoteChoiceIconTile}>
                          {renderQuoteOptionIcon(option.leadType, styles.assetQuoteChoiceIcon)}
                        </span>
                        <span className={styles.assetQuoteChoiceText}>
                          <strong>{option.title}</strong>
                          <small>
                            <span>{option.descriptionLines[0]}</span>
                            <span>{option.descriptionLines[1]}</span>
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.assetQuoteContent}>
                  <form
                    className={styles.assetQuoteSearchBar}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void loadQuotePartners(selectedQuoteOption.leadType, quotePartnerSearch);
                    }}
                  >
                    <input
                      className={styles.assetQuoteSearchInput}
                      value={quotePartnerSearch}
                      onChange={(event) => setQuotePartnerSearch(event.target.value)}
                      placeholder="Search by business, town, province, service or brand"
                      aria-label="Search business directory"
                    />
                    <button type="submit" className={styles.secondaryButton} disabled={isLoadingQuotePartners}>
                      <SearchIcon className={styles.buttonIcon} />
                      <span>{isLoadingQuotePartners ? 'Searching...' : 'Search'}</span>
                    </button>
                    <Link href="/companies" className={`${styles.secondaryButton} ${styles.assetQuoteAllCompaniesButton}`}>
                      <span>All Companies</span>
                    </Link>
                  </form>

                  <div className={styles.assetQuoteMapStage}>
                    <aside className={styles.assetQuoteMapSidebar} aria-label="Available companies">
                      <div className={styles.assetQuoteSidebarHeader}>
                        <button type="button" className={styles.assetQuoteBackButton} onClick={goBackToQuoteOptions} disabled={isSendingQuoteLead}>
                          <ChevronLeftIcon className={styles.buttonIcon} />
                          <span>Back</span>
                        </button>
                      </div>

                      <div className={styles.assetQuotePartnerList}>
                        {isLoadingQuotePartners ? (
                          <p className={styles.assetQuoteEmptyState}>Loading companies...</p>
                        ) : quotePartners.length ? (
                          quotePartners.map((partner) => (
                            <button
                              key={partner.userId}
                              type="button"
                              className={`${styles.assetQuotePartnerCard} ${quoteToneClassForPartnerType(partner.partnerType)} ${selectedQuotePartnerId === partner.userId ? styles.assetQuotePartnerCardActive : ''}`}
                              onClick={() => focusQuotePartnerOnMap(partner)}
                            >
                              <span className={styles.assetQuotePartnerBody}>
                                <span className={styles.assetQuotePartnerHeader}>
                                  <strong>{quotePartnerName(partner)}</strong>
                                </span>
                                <span className={styles.assetQuotePartnerMeta}>
                                  <span>{quotePartnerLocation(partner)}</span>
                                  <span>{quotePartnerServicesDisplay(partner)}</span>
                                  <span>{quotePartnerRadiusDisplay(partner)}</span>
                                </span>
                                {partner.brandFocus ? <span className={styles.assetQuotePartnerCopy}>Brands: {partner.brandFocus}</span> : null}
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className={styles.assetQuoteEmptyState}>{selectedQuoteOption.emptyPartnerText}</p>
                        )}
                      </div>
                    </aside>

                    <div className={styles.assetQuoteMapShell}>
                      {quotePartnersWithCoordinates.length ? (
                        <div ref={quoteMapElementRef} className={styles.assetQuoteMapCanvas} aria-label="Business map" />
                      ) : (
                        <div className={styles.assetQuoteMapFallback}>
                          <OptionsIcon className={styles.buttonIcon} />
                          <p>Businesses with saved latitude and longitude will appear on this map.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {quoteLeadStep && selectedQuoteOption && selectedQuotePartner ? (
                    <div className={styles.assetQuoteStepOverlay}>
                      <button
                        type="button"
                        className={styles.assetQuoteStepBackdrop}
                        onClick={closeQuoteLeadStep}
                        aria-label="Close request step"
                        disabled={isSendingQuoteLead}
                      />

                      <section className={`${styles.assetQuoteStepModal} ${quoteLeadStep === 'message' ? styles.assetQuoteMessageStepModal : ''}`} aria-live="polite">
                        <div className={styles.assetQuoteStepHeader}>
                          <div>
                            <span>{quotePartnerName(selectedQuotePartner)}</span>
                            <h4>{quoteLeadStep === 'message' ? 'Message to selected company' : 'Confirm and send request'}</h4>
                          </div>
                          <button
                            type="button"
                            className={styles.assetQuoteStepCloseButton}
                            onClick={closeQuoteLeadStep}
                            aria-label="Close request step"
                            disabled={isSendingQuoteLead}
                          >
                            <CloseIcon className={styles.buttonIcon} />
                          </button>
                        </div>

                        {quoteLeadStep === 'message' ? (
                          <div className={`${styles.assetQuoteStepBody} ${styles.assetQuoteMessageStepBody}`}>
                            <aside className={styles.assetQuoteSelectedCompanyPanel} aria-label="Selected company details">
                              <div className={styles.assetQuoteSelectedMediaGrid}>
                                <span className={`${styles.assetQuoteSelectedMediaTile} ${styles.assetQuoteSelectedLogoTile}`}>
                                  {selectedQuotePartner.logoUrl ? (
                                    <img src={selectedQuotePartner.logoUrl} alt={`${quotePartnerName(selectedQuotePartner)} logo`} />
                                  ) : (
                                    <span className={styles.assetQuoteSelectedLogoFallback}>{quotePartnerInitial(selectedQuotePartner)}</span>
                                  )}
                                </span>
                              </div>

                              <div className={styles.assetQuoteSelectedCompanyInfo}>
                                <div className={styles.assetQuoteSelectedCompanyTitle}>
                                  <strong>{quotePartnerName(selectedQuotePartner)}</strong>
                                  <span>{quotePartnerLocation(selectedQuotePartner)}</span>
                                </div>

                                <div className={styles.assetQuoteSelectedContactList}>
                                  {selectedQuotePartner.email && selectedQuotePartnerEmailHref ? (
                                    <a className={styles.assetQuoteSelectedContactRow} href={selectedQuotePartnerEmailHref}>
                                      <small>Business email</small>
                                      <span>{selectedQuotePartner.email}</span>
                                    </a>
                                  ) : (
                                    <span className={styles.assetQuoteSelectedContactRow}>
                                      <small>Business email</small>
                                      <span>Business email not saved</span>
                                    </span>
                                  )}

                                  {selectedQuotePartner.phone && selectedQuotePartnerPhoneHref ? (
                                    <a className={styles.assetQuoteSelectedContactRow} href={selectedQuotePartnerPhoneHref}>
                                      <small>Contact</small>
                                      <span>{selectedQuotePartner.phone}</span>
                                    </a>
                                  ) : (
                                    <span className={styles.assetQuoteSelectedContactRow}>
                                      <small>Contact</small>
                                      <span>Contact not saved</span>
                                    </span>
                                  )}

                                  {selectedQuotePartnerWebsiteHref ? (
                                    <a className={styles.assetQuoteSelectedContactRow} href={selectedQuotePartnerWebsiteHref} target="_blank" rel="noreferrer">
                                      <small>Website</small>
                                      <span>{formatWebsiteDisplay(selectedQuotePartnerWebsiteHref)}</span>
                                    </a>
                                  ) : (
                                    <span className={styles.assetQuoteSelectedContactRow}>
                                      <small>Website</small>
                                      <span>Website not saved</span>
                                    </span>
                                  )}

                                  <span className={styles.assetQuoteSelectedContactRow}>
                                    <small>Address</small>
                                    <span>{quotePartnerAddress(selectedQuotePartner)}</span>
                                  </span>
                                </div>
                              </div>
                            </aside>

                            <div className={styles.assetQuoteMessagePanel}>
                              <p className={styles.assetQuoteStepNotice}>
                                {isFullRegisterQuoteLead
                                  ? 'This sends a once-off full Asset Register snapshot. It does not grant live register access.'
                                  : 'This sends one asset only. It does not share the full register.'}
                              </p>

                              <label className={styles.assetQuoteMessageField}>
                                <span>
                                  Message to company
                                  <small>Optional</small>
                                </span>
                                <textarea
                                  value={quoteOwnerMessage}
                                  onChange={(event) => setQuoteOwnerMessage(event.target.value)}
                                  placeholder={
                                    isFullRegisterQuoteLead
                                      ? 'Example: Please review my full register for refinance or insurance options.'
                                      : 'Example: Please contact me about cover or finance options for this asset.'
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.assetQuoteStepBody}>
                            <div className={styles.assetQuotePopiaBox}>
                              <strong>Disclaimer and POPIA note</strong>
                              <p>
                                {isFullRegisterQuoteLead
                                  ? 'By sending this request, you allow Aim4price to share a once-off full Asset Register snapshot, saved valuation details and your saved business contact details with the chosen company.'
                                  : 'By sending this request, you allow Aim4price to share this selected asset, its saved valuation details and your saved business contact details with the chosen company.'}
                                {' '}This is only a lead request and does not create a finance, insurance, valuation or sales agreement.
                              </p>
                              <p>
                                {isFullRegisterQuoteLead
                                  ? 'You confirm that you have permission to share the complete register information and understand that the selected company may contact you outside Aim4price.'
                                  : 'You confirm that you have permission to share this asset information and understand that the selected company may contact you outside Aim4price.'}
                              </p>
                            </div>

                            <label className={styles.assetQuoteConsentCheck}>
                              <input
                                type="checkbox"
                                checked={quoteConsentAccepted}
                                onChange={(event) => setQuoteConsentAccepted(event.target.checked)}
                              />
                              <span>I accept the disclaimer and POPIA permission note.</span>
                            </label>
                          </div>
                        )}

                        <div className={styles.assetQuoteStepFooter}>
                          {quoteLeadStep === 'message' ? (
                            <>
                              <button type="button" className={styles.secondaryButton} onClick={closeQuoteLeadStep} disabled={isSendingQuoteLead}>
                                Cancel
                              </button>
                              <button type="button" className={styles.primaryButton} onClick={goToQuoteLeadConsent}>
                                Next
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" className={styles.secondaryButton} onClick={goBackToQuoteLeadMessage} disabled={isSendingQuoteLead}>
                                Back
                              </button>
                              <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={() => void handleSendAssetQuoteLead()}
                                disabled={isSendingQuoteLead || !quoteConsentAccepted}
                              >
                                {isSendingQuoteLead ? 'Sending...' : `Send to ${quotePartnerName(selectedQuotePartner)}`}
                              </button>
                            </>
                          )}
                        </div>
                      </section>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

          </div>
        </div>
      ) : null}

      {activeAsset ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeActionDialog} />

          <div className={styles.optionsModal} role="dialog" aria-modal="true" aria-labelledby="asset-manage-title">
            <div className={`${styles.modalHeader} ${styles.optionsModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-manage-title">{activeAsset.title}</h3>
                <p>{buildAssetMeta(activeAsset)}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeActionDialog}
                aria-label="Close asset management"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.optionsScrollBody}`}>
              <div className={styles.optionsContent}>
                <div className={`${styles.optionsGrid} ${styles.assetOptionsGrid}`}>
                  <button
                    type="button"
                    className={`${styles.optionActionButton} ${styles.optionFeaturedButton}`}
                    onClick={() => { closeActionDialog(); openUpdater(activeAsset); }}
                  >
                    <UpdateAssetIcon className={styles.buttonIcon} />
                    <span>
                      <strong>Update asset</strong>
                      <small>Edit details, documents, photos and status.</small>
                    </span>
                  </button>

                  {canManageAssetPricing(activeAsset) ? (
                    <button type="button" className={styles.optionActionButton} onClick={openPricingDialog}>
                      <TrendIcon className={styles.buttonIcon} />
                      <span>
                        <strong>Manage pricing</strong>
                        <small>Recalculate, refresh or get a future value.</small>
                      </span>
                    </button>
                  ) : null}

                  {canUseOwnerOnlyAssetActions ? (
                    <button type="button" className={styles.optionActionButton} onClick={openQrDialog}>
                      <QrIcon className={styles.buttonIcon} />
                      <span>
                        <strong>QR code</strong>
                        <small>Copy, download or print the asset QR label.</small>
                      </span>
                    </button>
                  ) : null}

                  <button type="button" className={styles.optionActionButton} onClick={openAssetReportDialog}>
                    <DownloadIcon className={styles.buttonIcon} />
                    <span>
                      <strong>Download reports</strong>
                      <small>Valuation PDF plus fuel and maintenance PDF/Excel reports.</small>
                    </span>
                  </button>

                  {canUseMarketplaceActions && isMarketplaceEligible(activeAsset) ? (
                    <button type="button" className={styles.optionActionButton} onClick={() => handlePublishFromDialog(activeAsset)}>
                      <CartIcon className={styles.buttonIcon} />
                      <span>
                        <strong>{isLiveOnMarketplace(activeAsset) ? 'Update marketplace listing' : 'Send to marketplace'}</strong>
                        <small>{isLiveOnMarketplace(activeAsset) ? 'Refresh the live marketplace listing.' : 'Create a marketplace listing from this asset.'}</small>
                      </span>
                    </button>
                  ) : null}

                  {canUseOwnerOnlyAssetActions && isLiveOnMarketplace(activeAsset) ? (
                    <button
                      type="button"
                      className={styles.optionActionButton}
                      disabled={busyMarketplaceRemoveId === activeAsset.id}
                      onClick={() => void handleRemoveFromMarketplace(activeAsset)}
                    >
                      <CartIcon className={styles.buttonIcon} />
                      <span>
                        <strong>{busyMarketplaceRemoveId === activeAsset.id ? 'Removing...' : 'Remove from marketplace'}</strong>
                        <small>Withdraw the live listing.</small>
                      </span>
                    </button>
                  ) : null}

                  {canUseOwnerOnlyAssetActions ? (
                    <button
                      type="button"
                      className={`${styles.optionActionButton} ${styles.optionDangerButton}`}
                      disabled={busyDeleteId === activeAsset.id}
                      onClick={() => handleDeleteFromDialog(activeAsset)}
                    >
                      <TrashIcon className={styles.buttonIcon} />
                      <span>
                        <strong>{busyDeleteId === activeAsset.id ? 'Removing...' : 'Delete asset'}</strong>
                        <small>Permanently remove this saved asset.</small>
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeAsset && isPricingModalOpen ? (
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closePricingDialog} />

          <div className={`${styles.modalCard} ${styles.pricingModal}`} role="dialog" aria-modal="true" aria-labelledby="asset-pricing-title">
            <div className={`${styles.modalHeader} ${styles.pricingModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-pricing-title">{activeAsset.title}</h3>
                <p>{buildAssetMeta(activeAsset)}</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closePricingDialog} aria-label="Close pricing options">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.pricingModalBody}`}>
              <div className={styles.pricingOptionsGrid}>
                <button
                  type="button"
                  className={styles.pricingOptionButton}
                  disabled={!canRefreshAssetEstimate(activeAsset) || busyRevalueAssetId === activeAsset.id || isLoadingPricingPreview || isSavingPricingPreview}
                  onClick={() => void openRevaluePreviewDialog(activeAsset, 'aim4price')}
                >
                  <TrendIcon className={styles.buttonIcon} />
                  <span>
                    <strong>Recalculate Aim4price value</strong>
                    <small>Preview a fresh Aim4price valuation before saving it.</small>
                  </span>
                </button>

                <button
                  type="button"
                  className={styles.pricingOptionButton}
                  disabled={!canRefreshAssetEstimate(activeAsset) || busyRevalueAssetId === activeAsset.id || isLoadingPricingPreview || isSavingPricingPreview}
                  onClick={() => void openRevaluePreviewDialog(activeAsset, 'market')}
                >
                  <TrendIcon className={styles.buttonIcon} />
                  <span>
                    <strong>Get newest market price</strong>
                    <small>Preview the newest market midpoint before saving it.</small>
                  </span>
                </button>

                <button
                  type="button"
                  className={styles.pricingOptionButton}
                  disabled={!canProjectFuturePrice(activeAsset) || busyRevalueAssetId === activeAsset.id || isLoadingPricingPreview || isSavingPricingPreview}
                  onClick={() => openProjectionModal(activeAsset)}
                >
                  <TrendIcon className={styles.buttonIcon} />
                  <span>
                    <strong>Calculate future price</strong>
                    <small>Open the future value calculator for year, inflation and hours.</small>
                  </span>
                </button>
              </div>

              {!canRefreshAssetEstimate(activeAsset) ? (
                <p className={styles.pricingOptionHint}>Automatic recalculation is only available for assets saved from an Aim4price valuation.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {pricingPreview ? (
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay} ${styles.pricingPreviewOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closePricingPreviewDialog} />

          <div className={`${styles.modalCard} ${styles.pricingResultModal}`} role="dialog" aria-modal="true" aria-labelledby="pricing-preview-title">
            <div className={`${styles.modalHeader} ${styles.pricingResultHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="pricing-preview-title">{pricingPreview.asset.title}</h3>
                <p>{buildAssetMeta(pricingPreview.asset)}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closePricingPreviewDialog}
                aria-label="Close value preview"
                disabled={isLoadingPricingPreview || isSavingPricingPreview}
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.pricingResultBody}`}>
              <p className={styles.pricingPreviewIntroCopy}>{pricingPreviewIntro(pricingPreview.method)}</p>

              {isLoadingPricingPreview ? (
                <div className={styles.pricingPreviewStatus}>Calculating the new value preview...</div>
              ) : pricingPreview.error ? (
                <div className={`${styles.pricingPreviewStatus} ${styles.pricingPreviewError}`}>
                  <strong>Could not calculate preview</strong>
                  <span>{pricingPreview.error}</span>
                </div>
              ) : pricingPreview.result?.item ? (
                <>
                  <section className={styles.pricingResultHero} aria-live="polite">
                    <span>Preview value</span>
                    <strong>{money(pricingPreview.result.newValueExVat ?? pricingPreview.result.item.value)}</strong>
                    <p>This is not saved yet. Save it only if you want to replace the current Asset Register value.</p>
                  </section>

                  <div className={styles.pricingCompareGrid}>
                    <div>
                      <span>Current saved value</span>
                      <strong>{money(pricingPreview.result.oldValueExVat ?? pricingPreview.asset.value)}</strong>
                    </div>
                    <div>
                      <span>New preview value</span>
                      <strong>{money(pricingPreview.result.newValueExVat ?? pricingPreview.result.item.value)}</strong>
                    </div>
                    <div>
                      <span>Pricing method</span>
                      <strong>{methodLabel(pricingPreview.result.selectedMethod ?? pricingPreview.result.item.selectedMethod)}</strong>
                    </div>
                  </div>

                  {pricingPreview.method === 'market' ? (
                    <section className={styles.marketEvidenceCard}>
                      <div className={styles.marketEvidenceHeader}>
                        <div>
                          <h3>Market evidence</h3>
                          <p>Listings used after model, year, usage and price checks.</p>
                        </div>
                        <span className={styles.marketEvidenceCount}>
                          {(pricingPreview.result.marketCount ?? pricingPreview.result.marketSources?.length ?? 0) > 0
                            ? `${pricingPreview.result.marketCount ?? pricingPreview.result.marketSources?.length ?? 0} used`
                            : 'No matches'}
                        </span>
                      </div>

                      {(pricingPreview.result.marketAverageExVat ?? pricingPreview.result.newValueExVat ?? pricingPreview.result.item.marketMidExVat) !== null ? (
                        <div className={styles.marketEvidenceSummary}>
                          <span>Marketplace average</span>
                          <strong>{money(pricingPreview.result.marketAverageExVat ?? pricingPreview.result.newValueExVat ?? pricingPreview.result.item.marketMidExVat)}</strong>
                        </div>
                      ) : null}

                      {pricingPreview.result.marketSources?.length ? (
                        pricingPreview.result.marketSources.slice(0, 6).map((source) => {
                          const sourceHref = normalizeExternalUrl(source.sourceUrl);
                          const price = marketSourcePrice(source);

                          return (
                            <article key={String(source.id)} className={styles.marketEvidenceItem}>
                              <div className={styles.marketEvidenceItemHeader}>
                                <span>{formatMarketSourceLabel(source.sourceName)}</span>
                                <small className={styles.marketEvidencePrice}>{money(price)}</small>
                              </div>
                              <strong>{source.title || 'Marketplace listing'}</strong>
                              <p className={styles.marketEvidenceMeta}>{formatPricingMarketMeta(source)}</p>
                              {sourceHref ? (
                                <a className={styles.marketEvidenceLink} href={sourceHref} target="_blank" rel="noreferrer">
                                  Open listing →
                                </a>
                              ) : (
                                <span className={styles.marketEvidenceNoLink}>No source link saved</span>
                              )}
                            </article>
                          );
                        })
                      ) : (
                        <div className={styles.marketEvidenceEmpty}>
                          <strong>No matching marketplace average yet</strong>
                          <p>When Aim4price finds similar listings, they will appear here as supporting evidence.</p>
                        </div>
                      )}
                    </section>
                  ) : null}

                  {pricingPreview.result.warning ? (
                    <p className={styles.pricingPreviewWarning}>{pricingPreview.result.warning}</p>
                  ) : null}

                  <div className={styles.pricingPreviewActions}>
                    <button type="button" className={styles.secondaryButton} onClick={closePricingPreviewDialog} disabled={isSavingPricingPreview}>
                      Keep current value
                    </button>
                    <button type="button" className={styles.primaryButton} onClick={() => void handleSavePricingPreview()} disabled={isSavingPricingPreview}>
                      {isSavingPricingPreview ? 'Saving...' : 'Save new value'}
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.pricingPreviewStatus}>No preview result is available yet.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeAsset && isAssetReportModalOpen ? (
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closeAssetReportDialog} />

          <div
            className={`${styles.modalCard} ${styles.assetReportModal} ${assetReportStep !== 'options' ? styles.assetFuelReportModal : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-report-title"
          >
            <div className={`${styles.modalHeader} ${styles.assetReportModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-report-title">
                  {assetReportStep === 'fuel-filter'
                    ? 'Export fuel report'
                    : assetReportStep === 'maintenance-filter'
                      ? 'Export maintenance report'
                      : 'Download reports'}
                </h3>
                <p>{activeAsset.title}</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closeAssetReportDialog} aria-label="Close report options">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.assetReportModalBody}`}>
              {assetReportStep === 'fuel-filter' ? (
                <>
                  <div className={styles.assetFuelReportFilterBox}>
                    <ReportSelect
                      label="Year"
                      value={assetFuelReportYear}
                      options={assetReportYearOptions}
                      isOpen={openAssetReportSelect === 'year'}
                      onToggle={() => toggleAssetReportSelect('year')}
                      onChange={selectAssetFuelReportYear}
                    />

                    <ReportSelect
                      label="Month"
                      value={assetFuelReportMonth}
                      options={assetReportMonthOptions}
                      isOpen={openAssetReportSelect === 'month'}
                      disabled={assetFuelReportYear === 'all'}
                      onToggle={() => toggleAssetReportSelect('month')}
                      onChange={selectAssetFuelReportMonth}
                    />
                  </div>

                  <div className={`${styles.formActions} ${styles.exportActions} ${styles.assetFuelReportActions}`}>
                    <button type="button" className={styles.secondaryButton} onClick={backToAssetReportOptions}>Back</button>
                    <button type="button" className={styles.primaryButton} onClick={() => void handleDownloadFilteredFuelReport(activeAsset, 'pdf')}>
                      <PdfIcon className={styles.buttonIcon} />
                      <span>Download PDF</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.primaryButton} ${styles.assetReportExcelButton}`}
                      onClick={() => void handleDownloadFilteredFuelReport(activeAsset, 'xlsx')}
                    >
                      <SpreadsheetIcon className={styles.buttonIcon} />
                      <span>Download Excel</span>
                    </button>
                  </div>
                </>
              ) : assetReportStep === 'maintenance-filter' ? (
                <>
                  <div className={`${styles.assetFuelReportFilterBox} ${styles.assetMaintenanceReportFilterBox}`}>
                    <ReportSelect
                      label="Type"
                      value={assetMaintenanceReportType}
                      options={assetMaintenanceReportTypeOptions}
                      isOpen={openAssetReportSelect === 'type'}
                      onToggle={() => toggleAssetReportSelect('type')}
                      onChange={selectAssetMaintenanceReportType}
                    />

                    <ReportSelect
                      label="Year"
                      value={assetMaintenanceReportYear}
                      options={assetReportYearOptions}
                      isOpen={openAssetReportSelect === 'year'}
                      onToggle={() => toggleAssetReportSelect('year')}
                      onChange={selectAssetMaintenanceReportYear}
                    />

                    <ReportSelect
                      label="Month"
                      value={assetMaintenanceReportMonth}
                      options={assetReportMonthOptions}
                      isOpen={openAssetReportSelect === 'month'}
                      disabled={assetMaintenanceReportYear === 'all'}
                      onToggle={() => toggleAssetReportSelect('month')}
                      onChange={selectAssetMaintenanceReportMonth}
                    />
                  </div>

                  <div className={`${styles.formActions} ${styles.exportActions} ${styles.assetFuelReportActions}`}>
                    <button type="button" className={styles.secondaryButton} onClick={backToAssetReportOptions}>Back</button>
                    <button type="button" className={styles.primaryButton} onClick={() => void handleDownloadFilteredMaintenanceReport(activeAsset, 'pdf')}>
                      <PdfIcon className={styles.buttonIcon} />
                      <span>Download PDF</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.primaryButton} ${styles.assetReportExcelButton}`}
                      onClick={() => void handleDownloadFilteredMaintenanceReport(activeAsset, 'xlsx')}
                    >
                      <SpreadsheetIcon className={styles.buttonIcon} />
                      <span>Download Excel</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.assetReportOptionsGrid}>
                  <button type="button" className={styles.assetReportOptionButton} onClick={() => handlePrintAssetSheet(activeAsset)}>
                    <PdfIcon className={styles.buttonIcon} />
                    <span>
                      <strong>Download asset valuation</strong>
                      <small>Asset details, value summary, notes and saved documents.</small>
                    </span>
                  </button>

                  {canUseOwnerOnlyAssetActions ? (
                    <>
                      <button type="button" className={styles.assetReportOptionButton} onClick={openAssetFuelReportFilter}>
                        <DocumentIcon className={styles.buttonIcon} />
                        <span>
                          <strong>Download fuel report</strong>
                          <small>Choose a year and month, then download PDF or Excel.</small>
                        </span>
                      </button>

                      <button type="button" className={styles.assetReportOptionButton} onClick={openAssetMaintenanceReportFilter}>
                        <DocumentIcon className={styles.buttonIcon} />
                        <span>
                          <strong>Download maintenance report</strong>
                          <small>Filter by type, year and month, then download PDF or Excel.</small>
                        </span>
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {deleteCandidateAsset ? (
        <div className={`${styles.modalOverlay} ${styles.confirmDeleteOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closeDeleteConfirmDialog} />

          <div
            className={styles.deleteConfirmModal}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            aria-describedby="delete-confirm-copy"
          >
            <button
              type="button"
              className={styles.deleteConfirmCloseButton}
              onClick={closeDeleteConfirmDialog}
              aria-label="Close delete confirmation"
              disabled={busyDeleteId === deleteCandidateAsset.id}
            >
              <CloseIcon className={styles.buttonIcon} />
            </button>

            <div className={styles.deleteConfirmContent}>
              <h3 id="delete-confirm-title">Are you sure you want to delete this?</h3>
              <p id="delete-confirm-copy">
                All data will be lost. This permanently removes <strong>{deleteCandidateAsset.title}</strong> from your Asset Register,
                including saved notes, photos, documents, marketplace status and QR scan history.
              </p>

              <div className={styles.deleteConfirmAsset}>
                <span>Selected asset</span>
                <strong>{deleteCandidateAsset.title}</strong>
                <small>{buildAssetMeta(deleteCandidateAsset)} · {money(deleteCandidateAsset.value)}</small>
              </div>

              <div className={styles.deleteConfirmActions}>
                <button type="button" className={styles.secondaryButton} onClick={closeDeleteConfirmDialog} disabled={busyDeleteId === deleteCandidateAsset.id}>
                  Cancel
                </button>

                <button
                  type="button"
                  className={`${styles.primaryButton} ${styles.deleteConfirmButton}`}
                  onClick={() => void handleConfirmDeleteAsset()}
                  disabled={busyDeleteId === deleteCandidateAsset.id}
                >
                  <span>{busyDeleteId === deleteCandidateAsset.id ? 'Deleting...' : 'Yes, delete asset'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isExportModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeExportModal} />

          <div className={`${styles.modalCard} ${styles.exportModal}`} role="dialog" aria-modal="true" aria-labelledby="export-title">
            <div className={`${styles.modalHeader} ${styles.exportModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="export-title">Export asset register</h3>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closeExportModal} aria-label="Close export options">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.exportModalScrollBody}`}>
              <div className={styles.exportModalBody}>
                {exportStep === 'format' ? (
                  <>
                    <div className={styles.exportChoices}>
                      <button
                        type="button"
                        className={`${styles.exportOption} ${exportFormat === 'pdf' ? styles.exportOptionActive : ''}`}
                        onClick={() => selectExportFormat('pdf')}
                        aria-pressed={exportFormat === 'pdf'}
                      >
                        <span className={styles.exportGraphic}>
                          <ExportGraphic src="/brand/pdf.png" alt="PDF export" icon={<PdfIcon className={styles.exportOptionIcon} />} />
                        </span>

                        <span className={styles.exportOptionTitleBlock}>
                          <strong>PDF report</strong>
                          <small>Choose a clear PDF report for clients, banks or insurance partners.</small>
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.exportOption} ${exportFormat === 'xlsx' ? styles.exportOptionActive : ''}`}
                        onClick={() => selectExportFormat('xlsx')}
                        aria-pressed={exportFormat === 'xlsx'}
                      >
                        <span className={styles.exportGraphic}>
                          <ExportGraphic src="/brand/sheet.png" alt="Spreadsheet export" icon={<SpreadsheetIcon className={styles.exportOptionIcon} />} />
                        </span>

                        <span className={styles.exportOptionTitleBlock}>
                          <strong>XLSX workbook</strong>
                          <small>Download all register rows in an Excel-ready workbook.</small>
                        </span>
                      </button>
                    </div>

                    <div className={`${styles.formActions} ${styles.exportActions}`}>
                      <button type="button" className={styles.secondaryButton} onClick={closeExportModal} disabled={isExporting}>
                        Cancel
                      </button>

                      <button type="button" className={styles.primaryButton} onClick={handleConfirmExport} disabled={isExporting}>
                        {exportFormat === 'pdf' ? <ChevronRightIcon className={styles.buttonIcon} /> : <DownloadIcon className={styles.buttonIcon} />}
                        <span>{exportFormat === 'pdf' ? 'Next' : isExporting ? 'Preparing export...' : 'Download XLSX'}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.pdfReportSelector}>
                      <div className={styles.pdfReportChoices}>
                        {PDF_REPORT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`${styles.pdfReportOption} ${pdfReportSelection === option.value ? styles.pdfReportOptionActive : ''}`}
                            onClick={() => handlePdfReportChoice(option.value)}
                            disabled={isExporting}
                            aria-pressed={pdfReportSelection === option.value}
                          >
                            <span className={styles.pdfReportOptionMain}>
                              <strong>{option.label}</strong>
                              <small>{option.description}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={`${styles.formActions} ${styles.exportActions}`}>
                      <button type="button" className={styles.secondaryButton} onClick={closePdfReportChooser} disabled={isExporting}>
                        Back
                      </button>

                      <button type="button" className={styles.secondaryButton} onClick={closeExportModal} disabled={isExporting}>
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {marketplaceAsset && marketplaceDraft ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeMarketplaceModal} />

          <div className={`${styles.modalCard} ${styles.marketplaceModal}`} role="dialog" aria-modal="true" aria-labelledby="marketplace-confirm-title">
            <div className={`${styles.modalHeader} ${styles.marketplaceModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="marketplace-confirm-title">{marketplaceModalTitle}</h3>
                <p>Check the listing title, asking price, photos and seller details before it goes live.</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closeMarketplaceModal} aria-label="Close marketplace modal">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.marketplaceModalScrollBody}`}>
              <form className={styles.marketplaceForm} onSubmit={handleConfirmMarketplacePublish}>
                <section className={styles.marketplaceAssetSummary}>
                  <div className={styles.marketplaceTitlePreview}>
                    <span>Listing title</span>
                    <strong>{marketplaceListingTitle}</strong>
                    <small>Year model, usage and condition are included in the marketplace title.</small>
                  </div>

                  <div className={styles.marketplaceAssetSummaryValue}>
                    <span>Register value</span>
                    <strong>{money(marketplaceAsset.value)}</strong>
                    <small>Excl. VAT</small>
                  </div>
                </section>

                <div className={styles.marketplaceBodyGrid}>
                  <div className={styles.marketplaceListingColumn}>
                    <section className={styles.marketplacePricePanel}>
                      <label className={`${styles.field} ${styles.marketplacePriceField}`}>
                        <span>Asking price excl. VAT</span>
                        <div className={styles.marketplaceCurrencyInput}>
                          <span className={styles.marketplaceCurrencyPrefix}>R</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={marketplaceDraft.askingPriceExVat}
                            onChange={(event) =>
                              setMarketplaceDraft((current) =>
                                current ? { ...current, askingPriceExVat: formatMarketplacePriceInput(event.target.value) } : current,
                              )
                            }
                            onBlur={() =>
                              setMarketplaceDraft((current) =>
                                current ? { ...current, askingPriceExVat: formatMarketplacePriceInput(current.askingPriceExVat) } : current,
                              )
                            }
                            placeholder="0"
                            autoFocus
                            aria-label="Marketplace price excluding VAT"
                          />
                        </div>
                        <small className={styles.marketplacePriceHint}>The entered price is saved as the listing asking price excluding VAT.</small>
                      </label>
                    </section>

                    <section className={styles.marketplacePhotosPanel}>
                      <div className={styles.marketplacePanelHeading}>
                        <span>Photos</span>
                        <small>
                          {marketplacePhotoUrls.length
                            ? `${marketplacePhotoUrls.length} uploaded photo${marketplacePhotoUrls.length === 1 ? '' : 's'} will be shown on the listing.`
                            : 'No photos are uploaded for this asset yet.'}
                        </small>
                      </div>

                      {marketplacePhotoUrls.length ? (
                        <div className={styles.marketplacePhotoPreview}>
                          <img
                            src={marketplacePhotoUrls[0]}
                            alt={`${marketplaceAsset.title} main marketplace photo`}
                            className={styles.marketplaceMainPhoto}
                          />

                          {marketplacePhotoUrls.length > 1 ? (
                            <div className={styles.marketplacePhotoStrip} aria-label="Marketplace listing photos">
                              {marketplacePhotoUrls.slice(0, 6).map((photoUrl, index) => (
                                <img key={`${photoUrl}-${index}`} src={photoUrl} alt={`${marketplaceAsset.title} photo ${index + 1}`} />
                              ))}
                              {marketplacePhotoUrls.length > 6 ? <span>+{marketplacePhotoUrls.length - 6}</span> : null}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className={styles.marketplaceNoPhotos}>
                          <strong>No photos uploaded</strong>
                          <span>Add photos in Update asset to show real asset photos on the marketplace.</span>
                        </div>
                      )}
                    </section>

                    <label className={`${styles.field} ${styles.marketplaceNotesField}`}>
                      <span>Listing notes</span>
                      <textarea
                        value={marketplaceDraft.description}
                        onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, description: event.target.value } : current))}
                        placeholder="Add important buyer notes, extras, service history or known issues."
                      />
                    </label>
                  </div>

                  <section className={styles.marketplaceSellerPanel}>
                    <div className={styles.marketplaceSellerHeader}>
                      <h4>Edit seller details</h4>
                      <span>Shown to signed-in marketplace users</span>
                    </div>

                    <div className={styles.marketplaceSellerGrid}>
                      <label className={`${styles.field} ${styles.marketplaceContactField} ${styles.marketplaceWideField}`}>
                        <span>Business name</span>
                        <input
                          value={marketplaceDraft.sellerCompany}
                          onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, sellerCompany: event.target.value } : current))}
                          placeholder="Business name"
                          aria-label="Business name"
                        />
                      </label>

                      <label className={`${styles.field} ${styles.marketplaceContactField}`}>
                        <span>Contact name</span>
                        <input
                          value={marketplaceDraft.sellerName}
                          onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, sellerName: event.target.value } : current))}
                          placeholder="Contact name"
                          aria-label="Contact name"
                        />
                      </label>

                      <label className={`${styles.field} ${styles.marketplaceContactField}`}>
                        <span>Phone</span>
                        <input
                          value={marketplaceDraft.sellerPhone}
                          onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, sellerPhone: event.target.value } : current))}
                          placeholder="Phone"
                          aria-label="Phone"
                        />
                      </label>

                      <label className={`${styles.field} ${styles.marketplaceContactField} ${styles.marketplaceWideField}`}>
                        <span>Business email</span>
                        <input
                          type="email"
                          value={marketplaceDraft.sellerEmail}
                          onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, sellerEmail: event.target.value } : current))}
                          placeholder="Business email"
                          aria-label="Business email"
                        />
                      </label>

                      <label className={`${styles.field} ${styles.marketplaceContactField}`}>
                        <span>Province</span>
                        <input
                          value={marketplaceDraft.province}
                          onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, province: event.target.value } : current))}
                          placeholder="Province"
                          aria-label="Province"
                        />
                      </label>

                      <label className={`${styles.field} ${styles.marketplaceContactField}`}>
                        <span>Area</span>
                        <input
                          value={marketplaceDraft.area}
                          onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, area: event.target.value } : current))}
                          placeholder="Area"
                          aria-label="Area"
                        />
                      </label>
                    </div>
                  </section>
                </div>

                <div className={`${styles.formActions} ${styles.marketplaceActions}`}>
                  <button type="button" className={styles.secondaryButton} onClick={closeMarketplaceModal} disabled={isPublishingMarketplace}>
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={isPublishingMarketplace || (parseMoneyInput(marketplaceDraft.askingPriceExVat) ?? 0) <= 0}
                  >
                    {isPublishingMarketplace
                      ? 'Publishing...'
                      : isLiveOnMarketplace(marketplaceAsset)
                        ? 'Update and view listing'
                        : 'Confirm and view listing'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {activeAsset && isQrModalOpen ? (
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closeQrDialog} />

          <div className={`${styles.modalCard} ${styles.qrModal}`} role="dialog" aria-modal="true" aria-labelledby="asset-qr-title">
            <div className={`${styles.modalHeader} ${styles.qrModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-qr-title">{activeAsset.title}</h3>
                <p>Use this permanent QR for scan access. Public QR scans always ask for the farm PIN.</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closeQrDialog} aria-label="Close QR code">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.qrModalScrollBody}`}>
              <div className={styles.qrModalBody}>
                <div className={styles.qrPreviewCard}>
                  <span className={styles.qrPreviewEyebrow}>Permanent asset QR</span>
                  <div className={styles.qrPreviewFrame}>
                    {activeAsset.publicAssetCode ? (
                      <img src={buildAssetQrSvgUrl(activeAsset)} alt={`QR code for ${activeAsset.title}`} />
                    ) : (
                      <p className={styles.qrPreviewFallback}>QR artwork is not ready for this asset yet.</p>
                    )}
                  </div>
                </div>

                <div className={styles.qrPrimaryActionsCard}>
                  <button
                    type="button"
                    className={`${styles.qrPrimaryActionButton} ${copiedScanLinkAssetId === activeAsset.id ? styles.qrCopiedButton : ''}`}
                    onClick={() => void handleCopyScanLink(activeAsset)}
                  >
                    <CopyIcon className={styles.buttonIcon} />
                    <span>{copiedScanLinkAssetId === activeAsset.id ? 'Copied' : 'Copy scan link'}</span>
                  </button>

                  <button type="button" className={styles.qrPrimaryActionButton} onClick={() => handlePrintQrSheet(activeAsset)}>
                    <PrintIcon className={styles.buttonIcon} />
                    <span>Print QR label</span>
                  </button>

                  <button type="button" className={styles.qrPrimaryActionButton} onClick={() => void handleDownloadQr(activeAsset)}>
                    <QrIcon className={styles.buttonIcon} />
                    <span>Download QR</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {projectionAsset ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeProjectionModal} />

          <div className={`${styles.modalCard} ${styles.projectionModal}`} role="dialog" aria-modal="true" aria-labelledby="projection-title">
            <div className={`${styles.modalHeader} ${styles.projectionModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="projection-title">{projectionAsset.title}</h3>
                <p>Change the year, inflation, or extra hours. Then calculate the estimated future value.</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closeProjectionModal} aria-label="Close future price modal">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.projectionScrollBody}`}>
              <div className={styles.projectionSimpleBody}>
                <div className={styles.projectionBaselineStrip}>
                  <div>
                    <span>Current value</span>
                    <strong>{money(projectionAsset.value)}</strong>
                  </div>
                  <div>
                    <span>Condition</span>
                    <strong>{conditionLabel(projectionAsset.condition)}</strong>
                  </div>
                  <div>
                    <span>Current usage</span>
                    <strong>{buildAssetUsageValue(projectionAsset)}</strong>
                  </div>
                </div>

                <section className={styles.projectionSimpleCard}>
                  <div className={styles.projectionSimpleSectionHeader}>
                    <h4>Future settings</h4>
                    <p>Only change what you know. Leave extra hours empty if usage stays the same.</p>
                  </div>

                  <div className={styles.projectionInputRow}>
                    <label className={styles.field}>
                      <span>Target year</span>
                      <select
                        value={projectionForm.targetYear}
                        onChange={(event) => updateProjectionForm({ targetYear: event.target.value })}
                      >
                        {projectionYearOptions.map((year) => (
                          <option key={year} value={String(year)}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span>Inflation % p.a.</span>
                      <input
                        type="number"
                        min="-50"
                        max="200"
                        step="0.1"
                        value={projectionForm.inflationRatePct}
                        onChange={(event) => updateProjectionForm({ inflationRatePct: event.target.value })}
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Add extra hours</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={projectionForm.extraHours}
                        onChange={(event) => updateProjectionForm({ extraHours: event.target.value })}
                        placeholder="Type extra hours"
                      />
                    </label>
                  </div>

                  <div className={styles.projectionQuickRow}>
                    <span>Quick inflation</span>
                    <button type="button" className={styles.projectionPresetButton} onClick={() => handleProjectionPreset({ inflationRatePct: '5' })}>
                      5%
                    </button>
                    <button type="button" className={styles.projectionPresetButton} onClick={() => handleProjectionPreset({ inflationRatePct: '8' })}>
                      8%
                    </button>
                    <button type="button" className={styles.projectionPresetButton} onClick={() => handleProjectionPreset({ inflationRatePct: '10' })}>
                      10%
                    </button>
                  </div>

                  <button type="button" className={`${styles.primaryButton} ${styles.projectionFullWidthButton}`} onClick={handleProjectionSubmit} disabled={isLoadingProjection}>
                    {isLoadingProjection ? 'Calculating...' : 'Calculate future price'}
                  </button>
                </section>

                {projectionError ? <div className={styles.projectionError}>{projectionError}</div> : null}

                {projectionResult ? (
                  <section ref={projectionResultRef} className={styles.projectionSimpleResult} aria-live="polite">
                    <span>Projected future price</span>
                    <strong>{money(projectionResult.projected.retailExVat)}</strong>
                    <p>Estimated ex VAT value for {projectionResult.targetYear}.</p>

                    <div className={styles.projectionSimpleMeta}>
                      <div>
                        <span>Year</span>
                        <strong>{projectionResult.baseYear} → {projectionResult.targetYear}</strong>
                      </div>
                      <div>
                        <span>Hours</span>
                        <strong>{projectionResult.current.hours.toLocaleString('en-ZA')} → {projectionResult.projected.hours.toLocaleString('en-ZA')}</strong>
                      </div>
                      <div>
                        <span>Inflation</span>
                        <strong>{formatPercent(projectionResult.inflationRatePct)} p.a.</strong>
                      </div>
                    </div>
                  </section>
                ) : isLoadingProjection ? (
                  <div className={styles.projectionLoading}>Calculating future price...</div>
                ) : (
                  <div className={styles.projectionEmptyResult}>
                    <strong>No projection yet</strong>
                    <span>Enter the simple settings above and calculate.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}