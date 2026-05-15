'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import {
  openAssetRegisterSummaryPrint,
  openAssetSheetPrint,
  type ReportMethodCard,
} from '../../lib/report-print';
import styles from './page.module.css';

type NoticeTone = 'success' | 'error';
type PartnerType = 'dealer' | 'finance' | 'insurance';
type AssetLeadType = 'finance' | 'insurance' | 'replacement_quote';

type PartnerDirectoryEntry = {
  userId: string;
  partnerType: PartnerType;
  displayName: string;
  businessName: string;
  phone: string;
  province: string;
  townCity: string;
  addressLine1: string;
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
  description: string;
  mapTitle: string;
  sendLabel: string;
  emptyPartnerText: string;
};

declare global {
  interface Window {
    L?: any;
  }
}

type AssetKind = 'tractor' | 'equipment' | 'manual' | 'property' | 'vehicle' | 'tools';
type AssetMethod = 'aim4price' | 'market' | 'manual';
type ConditionKey = 'excellent' | 'good' | 'fair' | 'used' | 'serious';
type AssetConditionValue = ConditionKey | '';
type UsageMetric = 'hours' | 'km';
type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';
type ManualAssetStep = 1 | 2 | 3 | 4;
type ExportFormat = 'pdf' | 'xlsx';
type ExportStep = 'format' | 'pdf-report';
type PdfReportKind = 'full' | 'financed' | 'insured' | 'licensed' | 'not-financed' | 'not-insured' | 'not-licensed';
type AssetScanReportKind = 'fuel' | 'scan' | 'maintenance';

type PdfReportOption = {
  value: PdfReportKind;
  label: string;
  description: string;
  intro: string;
  sectionTitle: string;
  emptyLabel: string;
};

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

type RegisterAsset = {
  id: string;
  userId: string;
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
};

type AssetRegisterApiResponse = {
  ok: boolean;
  items?: RegisterAsset[];
  summary?: {
    count: number;
    totalValue: number;
  };
  item?: RegisterAsset;
  error?: string;
};

type AssetUploadApiResponse = {
  ok: boolean;
  uploads?: Array<{
    uploadId: string;
    url: string;
    fileName: string;
    contentType: string;
    byteSize: number;
  }>;
  error?: string;
};

type MarketplaceApiResponse = {
  ok: boolean;
  assetId?: string;
  marketplaceStatus?: string;
  listing?: {
    id?: string | number | null;
    sourceAssetId?: string | number | null;
  } | null;
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

type RevalueAssetApiResponse = {
  ok: boolean;
  item?: RegisterAsset;
  valuationRunId?: number;
  selectedMethod?: AssetMethod;
  oldValueExVat?: number;
  newValueExVat?: number;
  warning?: string;
  error?: string;
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
  { value: 'highest-value', label: 'Highest value' },
  { value: 'lowest-value', label: 'Lowest value' },
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
    description: 'Send this asset to a bank or finance partner for a finance or refinance discussion.',
    mapTitle: 'Choose a finance partner',
    sendLabel: 'Send finance request',
    emptyPartnerText: 'No listed finance partners found yet. Finance partners must enable their directory listing under Account details.',
  },
  {
    leadType: 'insurance',
    partnerType: 'insurance',
    title: 'Get insurance quote',
    shortTitle: 'Insurance quote',
    description: 'Send this asset to an insurance partner or broker for a cover and insured-value review.',
    mapTitle: 'Choose an insurance partner',
    sendLabel: 'Send insurance request',
    emptyPartnerText: 'No listed insurance partners found yet. Insurance partners must enable their directory listing under Account details.',
  },
  {
    leadType: 'replacement_quote',
    partnerType: 'dealer',
    title: 'Get replacement quote',
    shortTitle: 'Replacement quote',
    description: 'Send this asset to a machinery dealer for a new or replacement machine quote.',
    mapTitle: 'Choose a dealer',
    sendLabel: 'Send replacement quote request',
    emptyPartnerText: 'No listed dealers found yet. Dealer accounts must enable their directory listing under Account details.',
  },
];


const initialAssetDraft: AssetDraft = {
  kind: 'equipment',
  title: '',
  value: '',
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

function money(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value || 0);
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

function isPdfReportKind(value: string): value is PdfReportKind {
  return PDF_REPORT_OPTIONS.some((option) => option.value === value);
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

function normalizePhotos(value: string[]): string[] {
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
    })
    .slice(0, MAX_PHOTOS);
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

function buildDraftFromAsset(asset: RegisterAsset): AssetDraft {
  const financeStatus = readFinanceStatusChoice(asset);
  const insuranceStatus = readInsuranceStatusChoice(asset);
  const licenseStatus = readLicenseStatusChoice(asset);
  const insuranceNote = readInsuranceNote(asset);

  return {
    kind: normalizeDraftKind(asset.kind),
    title: asset.title,
    value: formatRegisterValueInput(asset.value || ''),
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
    sellerEmail: profile?.marketplaceEmail?.trim() || profile?.email?.trim() || '',
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
  const parts = [profile.email, profile.phone, location, address].filter(Boolean);

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

function buildAssetScanReportUrl(asset: RegisterAsset, reportKind: AssetScanReportKind = 'scan'): string {
  return `/api/asset-register/scan-report?assetId=${encodeURIComponent(asset.id)}&report=${encodeURIComponent(reportKind)}`;
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

function quotePartnerName(partner: PartnerDirectoryEntry): string {
  return partner.businessName || partner.displayName || 'Aim4price partner';
}

function quotePartnerLocation(partner: PartnerDirectoryEntry): string {
  return [partner.townCity, partner.province].filter(Boolean).join(', ') || 'Location not saved';
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

function extractApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === 'string' && record.error.trim()) return record.error;
    if (typeof record.message === 'string' && record.message.trim()) return record.message;
  }

  return fallback;
}

function renderQuoteOptionIcon(leadType: AssetLeadType, className?: string) {
  if (leadType === 'finance') return <BankIcon className={className} />;
  if (leadType === 'insurance') return <ShieldIcon className={className} />;
  return <QuoteMachineIcon className={className} />;
}

export default function AssetRegisterClient() {
  const [assets, setAssets] = useState<RegisterAsset[]>([]);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [assetDraft, setAssetDraft] = useState<AssetDraft>(initialAssetDraft);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isAddChoiceModalOpen, setIsAddChoiceModalOpen] = useState(false);
  const [manualAssetStep, setManualAssetStep] = useState<ManualAssetStep>(1);
  const [hasManualAssetKindSelection, setHasManualAssetKindSelection] = useState(false);
  const [activeAsset, setActiveAsset] = useState<RegisterAsset | null>(null);
  const [quoteAsset, setQuoteAsset] = useState<RegisterAsset | null>(null);
  const [selectedQuoteLeadType, setSelectedQuoteLeadType] = useState<AssetLeadType | null>(null);
  const [quotePartners, setQuotePartners] = useState<PartnerDirectoryEntry[]>([]);
  const [selectedQuotePartnerId, setSelectedQuotePartnerId] = useState('');
  const [quotePartnerSearch, setQuotePartnerSearch] = useState('');
  const [quoteOwnerMessage, setQuoteOwnerMessage] = useState('');
  const [quoteIncludePhotos, setQuoteIncludePhotos] = useState(true);
  const [quoteIncludeDocuments, setQuoteIncludeDocuments] = useState(true);
  const [quoteIncludeScanHistory, setQuoteIncludeScanHistory] = useState(false);
  const [isLoadingQuotePartners, setIsLoadingQuotePartners] = useState(false);
  const [isSendingQuoteLead, setIsSendingQuoteLead] = useState(false);
  const quoteMapElementRef = useRef<HTMLDivElement | null>(null);
  const quoteLeafletMapRef = useRef<any>(null);
  const quoteMarkerLayerRef = useRef<any>(null);
  const [isAssetReportModalOpen, setIsAssetReportModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copiedScanLinkAssetId, setCopiedScanLinkAssetId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
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
  const [searchTerm, setSearchTerm] = useState('');
  const [assetFilter, setAssetFilter] = useState<AssetFilterKey>('all');
  const [isAssetFilterOpen, setIsAssetFilterOpen] = useState(false);
  const assetFilterWrapRef = useRef<HTMLDivElement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [registerValueVatMode, setRegisterValueVatMode] = useState<'excluded' | 'included'>('excluded');
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
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
  const projectionRequestRef = useRef(0);
  const projectionResultRef = useRef<HTMLElement | null>(null);
  const [shouldScrollToProjectionResult, setShouldScrollToProjectionResult] = useState(false);
  const projectionYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 16 }, (_, index) => currentYear + index);
  }, []);

  const selectedQuoteOption = useMemo(() => quoteOptionForLeadType(selectedQuoteLeadType), [selectedQuoteLeadType]);
  const selectedQuotePartner = useMemo(
    () => quotePartners.find((partner) => partner.userId === selectedQuotePartnerId) ?? null,
    [quotePartners, selectedQuotePartnerId],
  );
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

    async function loadAssetRegister() {
      setIsLoading(true);

      try {
        const [assetsResponse, profileResponse] = await Promise.all([
          fetch('/api/asset-register', {
            cache: 'no-store',
            credentials: 'include',
          }),
          fetch('/api/account-profile', {
            cache: 'no-store',
            credentials: 'include',
          }).catch(() => null),
        ]);

        const assetsData = (await assetsResponse.json()) as AssetRegisterApiResponse;

        if (!assetsResponse.ok || !assetsData.ok) {
          throw new Error(assetsData.error ?? 'Failed to load asset register.');
        }

        if (!mounted) return;

        setAssets(Array.isArray(assetsData.items) ? assetsData.items : []);

        if (profileResponse) {
          try {
            const profileData = (await profileResponse.json()) as AccountProfileApiResponse;
            if (profileResponse.ok && profileData.ok && profileData.profile) {
              setAccountProfile(profileData.profile);
            }
          } catch {
            // no-op
          }
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

  const anyModalOpen =
    isAddChoiceModalOpen ||
    isAssetModalOpen ||
    Boolean(activeAsset) ||
    Boolean(quoteAsset) ||
    Boolean(deleteCandidateAsset) ||
    isAssetReportModalOpen ||
    isQrModalOpen ||
    isSummaryModalOpen ||
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

      if (quoteAsset) {
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
  }, [activeAsset, anyModalOpen, deleteCandidateAsset, isAddChoiceModalOpen, isAssetModalOpen, isAssetReportModalOpen, isExportModalOpen, isQrModalOpen, isSummaryModalOpen, marketplaceAsset, projectionAsset, quoteAsset]);

  useEffect(() => {
    if (!quoteAsset || !selectedQuoteLeadType) return;
    void loadQuotePartners(selectedQuoteLeadType, '');
  }, [quoteAsset, selectedQuoteLeadType]);

  useEffect(() => {
    if (!quoteAsset || !selectedQuoteOption || !quoteMapElementRef.current || !quotePartnersWithCoordinates.length) {
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

        const bounds = L.latLngBounds([]);

        quotePartnersWithCoordinates.forEach((partner) => {
          const lat = Number(partner.latitude);
          const lng = Number(partner.longitude);
          const marker = L.marker([lat, lng]).addTo(quoteMarkerLayerRef.current);
          marker.bindPopup(`<strong>${escapeHtml(quotePartnerName(partner))}</strong><br />${escapeHtml(quotePartnerLocation(partner))}`);
          marker.on('click', () => setSelectedQuotePartnerId(partner.userId));
          bounds.extend([lat, lng]);
        });

        if (bounds.isValid()) {
          quoteLeafletMapRef.current.fitBounds(bounds.pad(0.22));
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
  }, [quoteAsset, selectedQuoteOption, quotePartnersWithCoordinates]);

  useEffect(() => {
    if (quoteAsset && selectedQuoteOption && quotePartnersWithCoordinates.length) {
      return undefined;
    }

    if (quoteLeafletMapRef.current) {
      quoteLeafletMapRef.current.remove();
      quoteLeafletMapRef.current = null;
      quoteMarkerLayerRef.current = null;
    }

    return undefined;
  }, [quoteAsset, selectedQuoteOption, quotePartnersWithCoordinates.length]);

  const totalValue = useMemo(() => {
    return assets.reduce((sum, asset) => sum + Math.round(Number(asset.value || 0)), 0);
  }, [assets]);

  const totalValueInclVat = useMemo(() => Math.round(totalValue * 1.15), [totalValue]);
  const displayedRegisterValue = registerValueVatMode === 'included' ? totalValueInclVat : totalValue;

  const aim4priceValuedEquipmentCount = useMemo(() => {
    return assets.filter((asset) => isAim4priceValuedAsset(asset)).length;
  }, [assets]);

  const aim4priceValuedEquipmentValue = useMemo(() => {
    return assets
      .filter((asset) => isAim4priceValuedAsset(asset))
      .reduce((sum, asset) => sum + Math.round(Number(asset.value || 0)), 0);
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
        nextAssets = [...nextAssets].sort((left, right) => Number(right.value || 0) - Number(left.value || 0));
        break;
      case 'lowest-value':
        nextAssets = [...nextAssets].sort((left, right) => Number(left.value || 0) - Number(right.value || 0));
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

    return nextAssets;
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
    const hasYearModel = assetDraft.yearModel.trim() !== '';
    const yearModel = hasYearModel ? Number(assetDraft.yearModel) : null;
    const hasHours = assetDraft.hours.trim() !== '';
    const hours = hasHours ? parseUsageAmountInput(assetDraft.hours) : null;
    const hasLifeWorkedPercent = assetDraft.lifeWorkedPercent.trim() !== '';
    const lifeWorkedPercent = hasLifeWorkedPercent ? Number(assetDraft.lifeWorkedPercent) : null;
    const usageErrorLabel = assetDraft.usageMetric === 'km' ? 'Kilometres' : 'Machine hours';

    if (!assetDraft.title.trim() || value <= 0) {
      setNotice({ tone: 'error', message: 'Asset title and value are required before moving to the next step.' });
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
    setIsQrModalOpen(false);
    setCopiedScanLinkAssetId(null);
    setDeleteCandidateAsset(null);
    setActiveAsset(null);
  }

  function resetAssetQuoteState() {
    setSelectedQuoteLeadType(null);
    setQuotePartners([]);
    setSelectedQuotePartnerId('');
    setQuotePartnerSearch('');
    setQuoteOwnerMessage('');
    setQuoteIncludePhotos(true);
    setQuoteIncludeDocuments(true);
    setQuoteIncludeScanHistory(false);
    setIsLoadingQuotePartners(false);
    setIsSendingQuoteLead(false);

    if (quoteLeafletMapRef.current) {
      quoteLeafletMapRef.current.remove();
      quoteLeafletMapRef.current = null;
      quoteMarkerLayerRef.current = null;
    }
  }

  function openAssetQuoteOptions(asset: RegisterAsset) {
    setNotice(null);
    setIsAssetFilterOpen(false);
    setQuoteAsset(asset);
    resetAssetQuoteState();
  }

  function closeAssetQuoteModal() {
    if (isSendingQuoteLead) return;
    setQuoteAsset(null);
    resetAssetQuoteState();
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
    setQuotePartners([]);
    setQuoteIncludePhotos(true);
    setQuoteIncludeDocuments(true);
    setQuoteIncludeScanHistory(false);
  }

  function goBackToQuoteOptions() {
    setSelectedQuoteLeadType(null);
    setQuotePartners([]);
    setSelectedQuotePartnerId('');
    setQuotePartnerSearch('');

    if (quoteLeafletMapRef.current) {
      quoteLeafletMapRef.current.remove();
      quoteLeafletMapRef.current = null;
      quoteMarkerLayerRef.current = null;
    }
  }

  async function handleSendAssetQuoteLead() {
    if (!quoteAsset || !selectedQuoteOption) {
      setNotice({ tone: 'error', message: 'Choose a quote option first.' });
      return;
    }

    if (!selectedQuotePartner) {
      setNotice({ tone: 'error', message: `Choose a ${formatQuotePartnerType(selectedQuoteOption.partnerType).toLowerCase()} partner first.` });
      return;
    }

    setIsSendingQuoteLead(true);

    try {
      const response = await fetch('/api/asset-leads', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: quoteAsset.id,
          partnerUserId: selectedQuotePartner.userId,
          leadType: selectedQuoteOption.leadType,
          ownerMessage: quoteOwnerMessage,
          includedSections: {
            assetDetails: true,
            valuationSummary: true,
            mainPhoto: true,
            photos: quoteIncludePhotos,
            documents: quoteIncludeDocuments,
            scanHistory: quoteIncludeScanHistory,
            source: 'asset_register_options',
          },
        }),
      });

      const payload = await response.json().catch(() => null);
      const data = payload as AssetLeadApiResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(extractApiError(payload, 'Failed to send asset lead.'));
      }

      setNotice({
        tone: 'success',
        message: `${selectedQuoteOption.shortTitle} request sent to ${quotePartnerName(selectedQuotePartner)}.`,
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
    setIsQrModalOpen(false);
    setCopiedScanLinkAssetId(null);
    setIsAssetReportModalOpen(true);
  }

  function closeAssetReportDialog() {
    setIsAssetReportModalOpen(false);
  }

  function openQrDialog() {
    setIsAssetReportModalOpen(false);
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

    const remainingSlots = MAX_PHOTOS - assetDraft.photos.length - pendingPhotoFiles.length;

    if (remainingSlots <= 0) {
      setNotice({ tone: 'error', message: `You can upload a maximum of ${MAX_PHOTOS} photos per asset.` });
      return;
    }

    const filesToQueue = selectedFiles.slice(0, remainingSlots).map((file) => ({
      id: createPendingPhotoId(),
      file,
      previewUrl: createPhotoPreviewUrl(file),
    }));

    setPendingPhotoFiles((current) => {
      const next = [...current, ...filesToQueue];
      pendingPhotoFilesRef.current = next;
      return next;
    });
    setNotice({
      tone: 'success',
      message: `${filesToQueue.length} photo${filesToQueue.length === 1 ? '' : 's'} ready. Choose Make main to show one first everywhere.`,
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

  async function uploadQueuedPhotoFiles(files: PendingPhotoFile[]): Promise<Map<string, string>> {
    if (!files.length) return new Map<string, string>();

    const formData = new FormData();
    files.forEach((entry) => {
      formData.append('files', entry.file);
    });

    setIsUploadingPhotos(true);

    try {
      const response = await fetch('/api/asset-register/uploads', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = (await response.json()) as AssetUploadApiResponse;

      if (!response.ok || !data.ok || !data.uploads?.length) {
        throw new Error(data.error ?? 'Failed to upload images.');
      }

      return new Map(
        data.uploads
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

  async function uploadQueuedDocumentFiles(files: File[]): Promise<AssetDocument[]> {
    if (!files.length) return [];

    const formData = new FormData();
    formData.append('uploadType', 'document');

    files.forEach((file) => {
      formData.append('files', file);
    });

    setIsUploadingDocuments(true);

    try {
      const response = await fetch('/api/asset-register/uploads', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = (await response.json()) as AssetUploadApiResponse;

      if (!response.ok || !data.ok || !data.uploads?.length) {
        throw new Error(data.error ?? 'Failed to upload documents.');
      }

      return data.uploads.map((entry) => ({
        id: entry.uploadId || entry.url,
        url: entry.url,
        fileName: entry.fileName,
        contentType: entry.contentType,
        byteSize: entry.byteSize,
        uploadedAtIso: new Date().toISOString(),
      }));
    } finally {
      setIsUploadingDocuments(false);
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
    const hasYearModel = assetDraft.yearModel.trim() !== '';
    const yearModel = hasYearModel ? Number(assetDraft.yearModel) : null;
    const hasHours = assetDraft.hours.trim() !== '';
    const hours = hasHours ? parseUsageAmountInput(assetDraft.hours) : null;
    const hasLifeWorkedPercent = assetDraft.lifeWorkedPercent.trim() !== '';
    const lifeWorkedPercent = hasLifeWorkedPercent ? Number(assetDraft.lifeWorkedPercent) : null;
    const usageErrorLabel = assetDraft.usageMetric === 'km' ? 'Kilometres' : 'Machine hours';

    if (!assetDraft.title.trim() || value <= 0) {
      setNotice({ tone: 'error', message: 'Asset title and value are required.' });
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

      const photos = normalizePhotos(
        orderedDraftPhotos
          .map((photo) => photoUrlsByKey.get(photo.key) ?? '')
          .filter(Boolean),
      );
      const documents = normalizeDocuments([...assetDraft.documents, ...uploadedDocuments]);

      const payload = {
        kind: editingAsset?.valuationRunId ? editingAsset.kind : assetDraft.kind,
        title: assetDraft.title,
        value,
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

        setAssets((current) => current.map((asset) => (asset.id === data.item!.id ? data.item! : asset)));

        if (activeAsset?.id === data.item.id) {
          setActiveAsset(data.item);
        }

        if (projectionAsset?.id === data.item.id) {
          setProjectionAsset(data.item);
        }

        assetIdToFocus = data.item.id;
        setExpandedAssetId(data.item.id);
        setNotice({ tone: 'success', message: 'Asset updated successfully.' });
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
        updatedAtIso: new Date().toISOString(),
      };

      setAssets((current) => current.map((asset) => (asset.id === publishedAsset.id ? publishedAsset : asset)));
      setActiveAsset((current) => (current?.id === publishedAsset.id ? publishedAsset : current));
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

      setAssets((current) => current.map((entry) => (entry.id === removedAsset.id ? removedAsset : entry)));
      setActiveAsset((current) => (current?.id === removedAsset.id ? removedAsset : current));
      setMarketplaceAsset((current) => (current?.id === removedAsset.id ? removedAsset : current));
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


  async function handleUpdateEstimate(asset: RegisterAsset) {
    setBusyRevalueAssetId(asset.id);

    try {
      const response = await fetch('/api/asset-register/revalue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id }),
      });
      const data = (await response.json()) as RevalueAssetApiResponse;

      if (!response.ok || !data.ok || !data.item) {
        throw new Error(data.error ?? 'Failed to update estimate.');
      }

      setAssets((current) => current.map((entry) => (entry.id === data.item!.id ? data.item! : entry)));
      setActiveAsset((current) => (current?.id === data.item!.id ? data.item! : current));
      setMarketplaceAsset((current) => (current?.id === data.item!.id ? data.item! : current));

      if (projectionAsset?.id === data.item.id) {
        setProjectionAsset(data.item);
      }

      const marketplaceNote = isLiveOnMarketplace(asset) ? ' Marketplace asking price was not changed.' : '';
      setNotice({
        tone: 'success',
        message: `${data.item.title} estimate updated to ${money(data.item.value)}.${data.warning ? ` ${data.warning}` : ''}${marketplaceNote}`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to update estimate.',
      });
    } finally {
      setBusyRevalueAssetId(null);
    }
  }

  function handlePrintAssetSheet(asset: RegisterAsset) {
    const assetPhotoUrls = asset.photos
      .map((photo) => toAbsoluteUrl(photo))
      .filter((photoUrl): photoUrl is string => Boolean(photoUrl));
    const documentsCount = assetDocuments(asset).length;
    const profileLocation = [accountProfile?.townCity, accountProfile?.province].filter(Boolean).join(' ');
    const profileAddress = [accountProfile?.addressLine1, accountProfile?.addressLine2, profileLocation].filter(Boolean).join(' ');
    const ownerName = accountProfile?.businessName?.trim() || accountProfile?.name?.trim() || 'Aim4price client';
    const ownerEmail = accountProfile?.email?.trim() || '—';
    const ownerPhone = accountProfile?.phone?.trim() || '—';
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
      logoUrl: toAbsoluteUrl(accountProfile?.logoUrl) ?? toAbsoluteUrl('/brand/aim4price-mark-black.png') ?? '',
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
        { label: 'Name', value: ownerName },
        { label: 'Email', value: ownerEmail },
        { label: 'Phone', value: ownerPhone },
        ...(profileAddress ? [{ label: 'Address', value: profileAddress }] : []),
      ],
      photoUrl: assetPhotoUrls[0] ?? null,
      photoUrls: assetPhotoUrls,
      facts: assetRows,
      notes: [
        ...(getManualAssetNote(asset.note) ? [{ label: 'Asset Notes', value: getManualAssetNote(asset.note) }] : []),
        ...(asset.financeNote ? [{ label: 'Finance Note', value: asset.financeNote }] : []),
        ...(readInsuranceNote(asset) ? [{ label: 'Insurance Note', value: readInsuranceNote(asset) }] : []),
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

  function scanReportLabel(reportKind: AssetScanReportKind): string {
    if (reportKind === 'fuel') return 'Fuel report';
    if (reportKind === 'maintenance') return 'Maintenance report';
    return 'Scan report';
  }

  function handleOpenScanReport(asset: RegisterAsset, reportKind: AssetScanReportKind = 'scan'): boolean {
    const reportUrl = buildAssetScanReportUrl(asset, reportKind);
    const opened = window.open(reportUrl, '_blank', 'noopener,noreferrer');
    const reportLabel = scanReportLabel(reportKind);

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

  function handleDownloadScanReport(asset: RegisterAsset, reportKind: AssetScanReportKind = 'scan') {
    const didOpen = handleOpenScanReport(asset, reportKind);

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

  function handlePdfReportSelectionChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextReportKind = event.target.value;

    if (!isPdfReportKind(nextReportKind)) {
      return;
    }

    setPdfReportSelection(nextReportKind);
    void handleExportPdfReport(nextReportKind);
  }

  async function handleExportPdf(reportKind: PdfReportKind = pdfReportKind) {
    const reportOption = getPdfReportOption(reportKind);
    const reportAssets = filterAssetsByPdfReportKind(assets, reportKind);
    const reportValue = sumAssetValues(reportAssets);
    const reportValueInclVat = Math.round(reportValue * 1.15);
    const reportAim4priceStats = calculateAssetStats(reportAssets, isAim4priceValuedAsset);
    const reportInsuredStats = calculateAssetStats(reportAssets, (asset) => readInsuranceStatusChoice(asset) === 'yes');
    const reportFinancedStats = calculateAssetStats(reportAssets, (asset) => readFinanceStatusChoice(asset) === 'yes');
    const reportLicensedStats = calculateAssetStats(reportAssets, (asset) => readLicenseStatusChoice(asset) === 'yes');
    const profile = await ensureAccountProfile();
    const profileLocation = [profile?.townCity, profile?.province].filter(Boolean).join(' ');
    const profileAddress = [profile?.addressLine1, profile?.addressLine2, profileLocation].filter(Boolean).join(' ');
    const ownerName = buildOwnerName(profile);
    const ownerEmail = profile?.email?.trim() || '—';
    const ownerPhone = profile?.phone?.trim() || '—';

    const didOpen = openAssetRegisterSummaryPrint({
      logoUrl: toAbsoluteUrl(profile?.logoUrl) ?? toAbsoluteUrl('/brand/aim4price-mark-black.png') ?? '',
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
      registerValueNote: `VAT excluded · ${money(reportValueInclVat)} incl. VAT`,
      ownerRows: [
        { label: 'Name', value: ownerName },
        { label: 'Email', value: ownerEmail },
        { label: 'Phone', value: ownerPhone },
        { label: 'Address', value: profileAddress || '—' },
      ],
      stats: [
        { label: 'Assets', value: String(reportAssets.length), note: reportKind === 'full' ? 'Saved register items.' : reportOption.description },
        { label: 'Value ex VAT', value: money(reportValue), note: 'Filtered report total excluding VAT.' },
        { label: 'Value incl VAT', value: money(reportValueInclVat), note: 'Filtered report total including 15% VAT.' },
        { label: 'Aim4price values', value: String(reportAim4priceStats.count), note: `${money(reportAim4priceStats.value)} total value.` },
        { label: 'Insured assets', value: String(reportInsuredStats.count), note: `${money(reportInsuredStats.value)} marked insured.` },
        { label: 'Financed assets', value: String(reportFinancedStats.count), note: `${money(reportFinancedStats.value)} marked financed.` },
        { label: 'Licensed assets', value: String(reportLicensedStats.count), note: `${money(reportLicensedStats.value)} marked licensed.` },
      ],
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
    const response = await fetch('/api/asset-register/export?format=xlsx', {
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
  const currentManualStepMeta = MANUAL_FORM_STEPS.find((entry) => entry.step === manualAssetStep) ?? MANUAL_FORM_STEPS[0];
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
  const manualDraftPhotoCount = assetDraft.photos.length + pendingPhotoFiles.length;
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
            <div className={styles.headerActions}>
              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.summaryTriggerButton}`}
                onClick={openSummaryModal}
                disabled={isLoading}
              >
                <span>Summary</span>
              </button>

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
                  <span>{hasActiveAssetFilter ? activeAssetFilterLabel : 'Filter'}</span>
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

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={openExportModal}
                disabled={!assets.length || isLoading}
              >
                <DownloadIcon className={styles.buttonIcon} />
                <span>Download full Asset Register</span>
              </button>

            </div>
          </div>

          <div className={`${styles.summaryRow} ${styles.heroSummaryRow}`}>
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
          </div>

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

            <button type="button" className={`${styles.primaryButton} ${styles.toolbarPrimaryButton}`} onClick={openAddAssetChoiceModal}>
              <PlusIcon className={styles.buttonIcon} />
              <span>Add Asset</span>
            </button>
          </div>

          {isLoading ? (
            <div className={styles.emptyState}>Loading assets...</div>
          ) : assets.length ? (
            filteredAssets.length ? (
              <>
                <div className={styles.assetList}>
                  {visibleAssets.map((asset) => {
                    const previewPhoto = assetPreviewImage(asset);
                    const isLive = isLiveOnMarketplace(asset);
                    const isExpanded = expandedAssetId === asset.id;
                    const detailDocuments = assetDocuments(asset);
                    const estimateNeedsUpdate = doesEstimateNeedUpdate(asset) && isValuationUpdateAvailable(asset);

                    return (
                      <article
                        id={`asset-card-${asset.id}`}
                        className={`${styles.assetCard} ${isExpanded ? styles.assetCardExpanded : ''} ${estimateNeedsUpdate ? styles.assetCardEstimateStale : ''}`}
                        key={asset.id}
                      >
                        <div className={styles.assetHeader}>
                          <div className={styles.assetTitleBlock}>
                            {isLive || estimateNeedsUpdate ? (
                              <div className={styles.badgeRow}>
                                {isLive ? <span className={`${styles.badge} ${styles.badgeSuccess}`}>Live on marketplace</span> : null}
                                {estimateNeedsUpdate ? (
                                  <span className={`${styles.badge} ${styles.badgeWarning}`}>Estimate needs update</span>
                                ) : null}
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
                              {estimateNeedsUpdate ? (
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
                                className={`${styles.optionsButton} ${styles.assetQuoteOpenButton}`}
                                onClick={() => openAssetQuoteOptions(asset)}
                              >
                                <OptionsIcon className={styles.buttonIcon} />
                                <span>Options</span>
                              </button>

                              <button
                                type="button"
                                className={styles.expandButton}
                                onClick={() => setExpandedAssetId((current) => (current === asset.id ? null : asset.id))}
                                aria-expanded={isExpanded}
                                aria-controls={`asset-panel-${asset.id}`}
                              >
                                {isExpanded ? <ChevronUpIcon className={styles.buttonIcon} /> : <ChevronDownIcon className={styles.buttonIcon} />}
                                <span>{isExpanded ? 'Hide details' : 'View details'}</span>
                              </button>

                              <button
                                type="button"
                                className={styles.optionsButton}
                                onClick={() => openActionDialog(asset)}
                              >
                                <ManageIcon className={styles.buttonIcon} />
                                <span>Manage</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className={styles.assetBody} id={`asset-panel-${asset.id}`}>
                            {(() => {
                              const detailPhotos = getDetailPhotos(asset);
                              const detailPhotoIndex = getDetailPhotoIndex(asset);
                              const detailPhoto = detailPhotos[detailPhotoIndex] || previewPhoto;
                              const hasMultiplePhotos = detailPhotos.length > 1;
                              const hasRealPhotos = detailPhotos.length > 0;

                              return (
                                <>
                                  <div className={styles.previewWrap}>
                                    <div
                                      className={styles.previewStage}
                                      onTouchStart={(event) => handleDetailPhotoTouchStart(event.changedTouches[0]?.clientX ?? 0)}
                                      onTouchEnd={(event) => handleDetailPhotoTouchEnd(asset, event.changedTouches[0]?.clientX ?? 0)}
                                    >
                                      {hasRealPhotos && detailPhoto ? (
                                        <>
                                          <img src={detailPhoto} alt={`${asset.title} photo ${detailPhotoIndex + 1}`} className={styles.previewImage} />

                                          {hasMultiplePhotos ? (
                                            <>
                                              <button
                                                type="button"
                                                className={`${styles.previewNavButton} ${styles.previewNavPrev}`}
                                                onClick={() => cycleDetailPhoto(asset, -1)}
                                                aria-label="Show previous photo"
                                              >
                                                <ChevronLeftIcon className={styles.buttonIcon} />
                                              </button>

                                              <button
                                                type="button"
                                                className={`${styles.previewNavButton} ${styles.previewNavNext}`}
                                                onClick={() => cycleDetailPhoto(asset, 1)}
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
                                    <div className={styles.assetDocumentsCard}>
                                      <div className={styles.assetDocumentsMainLabel}>
                                        <strong>Documents</strong>
                                      </div>
                                    </div>

                                    {detailDocuments.length ? (
                                      <div className={styles.assetDocumentList}>
                                        {detailDocuments.slice(0, 4).map((document) => (
                                          <a href={document.url} target="_blank" rel="noreferrer" className={styles.assetDocumentLink} key={document.id}>
                                            <DocumentIcon className={styles.buttonIcon} />
                                            <span>{shortDocumentName(document.fileName)}</span>
                                          </a>
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
          ) : (
            <div className={styles.emptyState}>
              <h3>No assets saved yet</h3>
              <p>Run a valuation or add a manual asset to start building your register.</p>
              <div className={styles.emptyStateActions}>
                <Link href="/valuation" className={styles.secondaryButton}>
                  Go to valuation
                </Link>
                <button type="button" className={styles.primaryButton} onClick={openAddAssetChoiceModal}>
                  <PlusIcon className={styles.buttonIcon} />
                  <span>Add Asset</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </section>

      {isSummaryModalOpen ? (
        <div className={styles.modalOverlay}>
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

            <div className={`${styles.modalScrollBody} ${styles.summaryModalScrollBody}`}>
              <div className={styles.summaryModalBody}>
                <section className={styles.summaryTotalsHero} aria-label="Asset register totals">
                  <article className={`${styles.summaryHeroMetric} ${styles.summaryHeroMetricFeatured}`}>
                    <span className={styles.summaryHeroLabel}>Register value</span>
                    <strong className={styles.summaryHeroValue}>{money(totalValue)}</strong>
                    <small className={styles.summaryHeroNote}>{money(totalValueInclVat)} incl. VAT</small>
                  </article>

                  <article className={styles.summaryHeroMetric}>
                    <span className={styles.summaryHeroLabel}>Aim4price valued equipment</span>
                    <strong className={styles.summaryHeroValue}>{aim4priceValuedEquipmentCount}</strong>
                    <small className={styles.summaryHeroNote}>{money(aim4priceValuedEquipmentValue)} register value</small>
                  </article>

                  <article className={styles.summaryHeroMetric}>
                    <span className={styles.summaryHeroLabel}>Total assets</span>
                    <strong className={styles.summaryHeroValue}>{assets.length}</strong>
                    <small className={styles.summaryHeroNote}>Full saved register count</small>
                  </article>
                </section>

                <section className={styles.summaryStatusGrid} aria-label="Finance, insurance and licensing totals">
                  <article className={`${styles.summaryStatusCard} ${styles.summaryStatusCardFinanced}`}>
                    <div className={styles.summaryStatusHeader}>
                      <span>Assets financed</span>
                      <strong>{financedAssetStats.count}</strong>
                    </div>
                    <div className={styles.summaryStatusValue}>{money(financedAssetStats.value)}</div>
                    <p>{assets.length ? formatRatioPercent(financedAssetStats.count / assets.length) : '0%'} of assets · {money(Math.round(financedAssetStats.value * 1.15))} incl. VAT</p>
                  </article>

                  <article className={`${styles.summaryStatusCard} ${styles.summaryStatusCardInsured}`}>
                    <div className={styles.summaryStatusHeader}>
                      <span>Assets insured</span>
                      <strong>{insuredAssetStats.count}</strong>
                    </div>
                    <div className={styles.summaryStatusValue}>{money(insuredAssetStats.value)}</div>
                    <p>{assets.length ? formatRatioPercent(insuredAssetStats.count / assets.length) : '0%'} of assets · {money(Math.round(insuredAssetStats.value * 1.15))} incl. VAT</p>
                  </article>

                  <article className={`${styles.summaryStatusCard} ${styles.summaryStatusCardLicensed}`}>
                    <div className={styles.summaryStatusHeader}>
                      <span>Assets licensed</span>
                      <strong>{licensedAssetStats.count}</strong>
                    </div>
                    <div className={styles.summaryStatusValue}>{money(licensedAssetStats.value)}</div>
                    <p>{assets.length ? formatRatioPercent(licensedAssetStats.count / assets.length) : '0%'} of assets · {money(Math.round(licensedAssetStats.value * 1.15))} incl. VAT</p>
                  </article>
                </section>

              </div>
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
                <div className={styles.manualWizardHeaderKicker}>
                  <span>Step {manualAssetStep} of 4</span>
                  <strong>{currentManualStepMeta.label}</strong>
                </div>
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
                <div className={styles.manualStepProgress} aria-label="Manual asset progress">
                  {MANUAL_FORM_STEPS.map((entry) => {
                    const isActiveStep = entry.step === manualAssetStep;
                    const isCompleteStep = entry.step < manualAssetStep;

                    return (
                      <span
                        key={entry.step}
                        className={`${styles.manualStepProgressItem} ${isActiveStep ? styles.manualStepProgressItemActive : ''} ${isCompleteStep ? styles.manualStepProgressItemComplete : ''}`}
                      >
                        <span>{isCompleteStep ? '✓' : entry.step}</span>
                        <small>{entry.label}</small>
                      </span>
                    );
                  })}
                </div>

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
                      <label className={`${styles.field} ${styles.manualCompactSelectField}`}>
                        <span>Choose type</span>
                        <select
                          value={hasManualAssetKindSelection ? assetFormKind : ''}
                          onChange={(event) => {
                            const nextKind = event.target.value as AssetKind;
                            if (nextKind) {
                              selectManualAssetKind(nextKind, true);
                            }
                          }}
                          autoFocus
                        >
                          <option value="">Select asset type</option>
                          {MANUAL_ASSET_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
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

                    <div className={`${styles.manualStageGrid} ${styles.manualPrimaryFields}`}>
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
                        <span>Value excl. VAT</span>
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
                        <label className={styles.field}>
                          <span>Usage type</span>
                          <select
                            value={assetDraft.usageMetric}
                            onChange={(event) =>
                              setAssetDraft((current) => ({
                                ...current,
                                usageMetric: normalizeUsageMetric(event.target.value, 'vehicle'),
                              }))
                            }
                          >
                            <option value="km">Kilometres</option>
                            <option value="hours">Hours</option>
                          </select>
                        </label>
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
                        <label className={styles.field}>
                          <span>Condition</span>
                          <select
                            value={assetDraft.condition}
                            onChange={(event) =>
                              setAssetDraft((current) => ({
                                ...current,
                                condition: event.target.value as AssetConditionValue,
                              }))
                            }
                          >
                            {CONDITION_OPTIONS.map((option) => (
                              <option key={option.value || 'blank'} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
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
                      <label className={styles.field}>
                        <span>Finance status</span>
                        <select
                          value={assetDraft.financeStatus}
                          onChange={(event) => setAssetFinanceStatus(event.target.value as AssetStatusChoice)}
                        >
                          {FINANCE_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className={styles.field}>
                        <span>Insurance status</span>
                        <select
                          value={assetDraft.insuranceStatus}
                          onChange={(event) => setAssetInsuranceStatus(event.target.value as AssetStatusChoice)}
                        >
                          {INSURANCE_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className={styles.field}>
                        <span>License status</span>
                        <select
                          value={assetDraft.licenseStatus}
                          onChange={(event) => setAssetLicenseStatus(event.target.value as AssetStatusChoice)}
                        >
                          {LICENSE_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

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
                        <span>Value</span>
                        <strong>
                          {money(parseRegisterValueInput(assetDraft.value))}
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
                              className={`${styles.secondaryButton} ${styles.filePickerButton} ${isUploadingPhotos || manualDraftPhotoCount >= MAX_PHOTOS ? styles.filePickerButtonDisabled : ''}`}
                            >
                              <span>{isUploadingPhotos ? 'Uploading...' : 'Add photos'}</span>
                              <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                className={styles.fileInput}
                                onChange={handlePhotoFilesSelected}
                                disabled={isUploadingPhotos || manualDraftPhotoCount >= MAX_PHOTOS}
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
                            <a href={document.url} target="_blank" rel="noreferrer" className={styles.documentOpenLink}>
                              Open
                            </a>
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

      {quoteAsset ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeAssetQuoteModal} />

          <div className={`${styles.optionsModal} ${styles.assetQuoteModal}`} role="dialog" aria-modal="true" aria-labelledby="asset-quote-title">
            <div className={`${styles.modalHeader} ${styles.optionsModalHeader} ${styles.assetQuoteModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <span className={styles.modalEyebrow}>Asset options</span>
                <h3 id="asset-quote-title">{selectedQuoteOption ? selectedQuoteOption.mapTitle : 'Request quotes for this asset'}</h3>
                <p>{quoteAsset.title} · {buildAssetMeta(quoteAsset)} · {money(quoteAsset.value)} excl. VAT</p>
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
                <div className={styles.assetQuoteContent}>
                  <div className={styles.assetQuoteIntroCard}>
                    <div className={styles.assetQuoteIntroMedia}>
                      <img src={assetPreviewImage(quoteAsset) || FALLBACK_ASSET_IMAGE} alt={quoteAsset.title} />
                    </div>
                    <div>
                      <span className={styles.assetQuoteKicker}>Send a controlled asset lead</span>
                      <h4>{quoteAsset.title}</h4>
                      <p>
                        Choose what you need. Aim4price will send this asset as a structured lead to the selected partner.
                        The partner does not receive access to your full Asset Register from these buttons.
                      </p>
                    </div>
                  </div>

                  <div className={styles.assetQuoteChoiceGrid}>
                    {ASSET_QUOTE_OPTIONS.map((option) => (
                      <button
                        key={option.leadType}
                        type="button"
                        className={styles.assetQuoteChoiceCard}
                        onClick={() => openQuotePartnerPicker(option.leadType)}
                      >
                        <span className={styles.assetQuoteChoiceIcon}>{renderQuoteOptionIcon(option.leadType, styles.buttonIcon)}</span>
                        <span>
                          <strong>{option.title}</strong>
                          <small>{option.description}</small>
                        </span>
                        <ChevronRightIcon className={styles.buttonIcon} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.assetQuoteContent}>
                  <div className={styles.assetQuoteStepBar}>
                    <button type="button" className={styles.secondaryButton} onClick={goBackToQuoteOptions} disabled={isSendingQuoteLead}>
                      <ChevronLeftIcon className={styles.buttonIcon} />
                      <span>Back</span>
                    </button>
                    <div>
                      <strong>{selectedQuoteOption.shortTitle}</strong>
                      <span>Showing {formatQuotePartnerType(selectedQuoteOption.partnerType).toLowerCase()} partner accounts.</span>
                    </div>
                  </div>

                  <form
                    className={styles.assetQuoteSearchBar}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void loadQuotePartners(selectedQuoteOption.leadType, quotePartnerSearch);
                    }}
                  >
                    <label className={styles.field}>
                      <span>Search partner directory</span>
                      <input
                        value={quotePartnerSearch}
                        onChange={(event) => setQuotePartnerSearch(event.target.value)}
                        placeholder="Search by business, town, province, service or brand"
                      />
                    </label>
                    <button type="submit" className={styles.secondaryButton} disabled={isLoadingQuotePartners}>
                      <SearchIcon className={styles.buttonIcon} />
                      <span>{isLoadingQuotePartners ? 'Searching...' : 'Search'}</span>
                    </button>
                  </form>

                  <div className={styles.assetQuotePartnerGrid}>
                    <div className={styles.assetQuotePartnerList}>
                      {isLoadingQuotePartners ? (
                        <p className={styles.assetQuoteEmptyState}>Loading partners...</p>
                      ) : quotePartners.length ? (
                        quotePartners.map((partner) => (
                          <button
                            key={partner.userId}
                            type="button"
                            className={`${styles.assetQuotePartnerCard} ${selectedQuotePartnerId === partner.userId ? styles.assetQuotePartnerCardActive : ''}`}
                            onClick={() => setSelectedQuotePartnerId(partner.userId)}
                          >
                            <span className={styles.assetQuotePartnerHeader}>
                              <strong>{quotePartnerName(partner)}</strong>
                              <small>{formatQuotePartnerType(partner.partnerType)}</small>
                            </span>
                            <span className={styles.assetQuotePartnerMeta}>
                              <span>{quotePartnerLocation(partner)}</span>
                              {partner.serviceRadiusKm ? <span>{partner.serviceRadiusKm} km radius</span> : null}
                            </span>
                            {partner.description ? <span className={styles.assetQuotePartnerCopy}>{partner.description}</span> : null}
                            {partner.brandFocus ? <span className={styles.assetQuotePartnerCopy}>Brands: {partner.brandFocus}</span> : null}
                          </button>
                        ))
                      ) : (
                        <p className={styles.assetQuoteEmptyState}>{selectedQuoteOption.emptyPartnerText}</p>
                      )}
                    </div>

                    <div className={styles.assetQuoteMapShell}>
                      {quotePartnersWithCoordinates.length ? (
                        <div ref={quoteMapElementRef} className={styles.assetQuoteMapCanvas} aria-label="Partner map" />
                      ) : (
                        <div className={styles.assetQuoteMapFallback}>
                          <OptionsIcon className={styles.buttonIcon} />
                          <p>Partners with saved latitude and longitude will appear on this map.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.assetQuoteLeadPanel}>
                    <div className={styles.assetQuoteLeadPanelHeader}>
                      <strong>Lead contents</strong>
                      <span>This sends one asset only. It does not share the full register.</span>
                    </div>

                    <div className={styles.assetQuoteCheckboxGrid}>
                      <label className={styles.assetQuoteCheckbox}>
                        <input type="checkbox" checked readOnly />
                        <span>Asset details and valuation summary</span>
                      </label>
                      <label className={styles.assetQuoteCheckbox}>
                        <input type="checkbox" checked={quoteIncludePhotos} onChange={(event) => setQuoteIncludePhotos(event.target.checked)} />
                        <span>Photos</span>
                      </label>
                      <label className={styles.assetQuoteCheckbox}>
                        <input type="checkbox" checked={quoteIncludeDocuments} onChange={(event) => setQuoteIncludeDocuments(event.target.checked)} />
                        <span>Saved documents</span>
                      </label>
                      <label className={styles.assetQuoteCheckbox}>
                        <input type="checkbox" checked={quoteIncludeScanHistory} onChange={(event) => setQuoteIncludeScanHistory(event.target.checked)} />
                        <span>QR scan history</span>
                      </label>
                    </div>

                    <label className={styles.field}>
                      <span>Message to partner</span>
                      <textarea
                        value={quoteOwnerMessage}
                        onChange={(event) => setQuoteOwnerMessage(event.target.value)}
                        placeholder="Optional note, for example: Please contact me about refinancing this tractor."
                      />
                    </label>
                  </div>

                  <div className={styles.assetQuoteDisclaimer}>
                    By sending this lead, you allow the selected partner to view the asset information included above and contact you outside Aim4price.
                    This does not create a finance, insurance, valuation or sales agreement.
                  </div>
                </div>
              )}
            </div>

            {selectedQuoteOption ? (
              <div className={styles.assetQuoteFooter}>
                <button type="button" className={styles.secondaryButton} onClick={closeAssetQuoteModal} disabled={isSendingQuoteLead}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleSendAssetQuoteLead()}
                  disabled={isSendingQuoteLead || !selectedQuotePartner}
                >
                  {isSendingQuoteLead ? 'Sending...' : selectedQuotePartner ? `${selectedQuoteOption.sendLabel} to ${quotePartnerName(selectedQuotePartner)}` : 'Choose partner'}
                </button>
              </div>
            ) : null}
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

                  <button type="button" className={styles.optionActionButton} onClick={openAssetReportDialog}>
                    <DownloadIcon className={styles.buttonIcon} />
                    <span>
                      <strong>Download PDF Reports</strong>
                      <small>Valuation, Fuel, QR Scan, Maintenance.</small>
                    </span>
                  </button>

                  <button type="button" className={styles.optionActionButton} onClick={openQrDialog}>
                    <QrIcon className={styles.buttonIcon} />
                    <span>
                      <strong>QR code</strong>
                      <small>Copy, download or print the asset QR label.</small>
                    </span>
                  </button>

                  {canProjectFuturePrice(activeAsset) ? (
                    <button type="button" className={styles.optionActionButton} onClick={() => openProjectionModal(activeAsset)}>
                      <TrendIcon className={styles.buttonIcon} />
                      <span>
                        <strong>Calculate future price</strong>
                        <small>Project value using year, inflation and hours.</small>
                      </span>
                    </button>
                  ) : null}

                  {isMarketplaceEligible(activeAsset) ? (
                    <button type="button" className={styles.optionActionButton} onClick={() => handlePublishFromDialog(activeAsset)}>
                      <CartIcon className={styles.buttonIcon} />
                      <span>
                        <strong>{isLiveOnMarketplace(activeAsset) ? 'Update marketplace listing' : 'Send to marketplace'}</strong>
                        <small>{isLiveOnMarketplace(activeAsset) ? 'Refresh the live marketplace listing.' : 'Create a marketplace listing from this asset.'}</small>
                      </span>
                    </button>
                  ) : null}

                  {isLiveOnMarketplace(activeAsset) ? (
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
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeAsset && isAssetReportModalOpen ? (
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closeAssetReportDialog} />

          <div className={`${styles.modalCard} ${styles.assetReportModal}`} role="dialog" aria-modal="true" aria-labelledby="asset-report-title">
            <div className={`${styles.modalHeader} ${styles.assetReportModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-report-title">Download PDF Reports</h3>
                <p>{activeAsset.title}</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closeAssetReportDialog} aria-label="Close PDF report options">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.assetReportModalBody}`}>
              <div className={styles.assetReportOptionsGrid}>
                <button type="button" className={styles.assetReportOptionButton} onClick={() => handlePrintAssetSheet(activeAsset)}>
                  <PdfIcon className={styles.buttonIcon} />
                  <span>
                    <strong>Download asset valuation</strong>
                    <small>Asset details, value summary, notes and saved documents.</small>
                  </span>
                </button>

                <button type="button" className={styles.assetReportOptionButton} onClick={() => handleDownloadScanReport(activeAsset, 'fuel')}>
                  <DocumentIcon className={styles.buttonIcon} />
                  <span>
                    <strong>Download fuel report</strong>
                    <small>Date, usage reading, tank percentage, operator and scan location.</small>
                  </span>
                </button>

                <button type="button" className={styles.assetReportOptionButton} onClick={() => handleDownloadScanReport(activeAsset, 'scan')}>
                  <DocumentIcon className={styles.buttonIcon} />
                  <span>
                    <strong>Download scan report</strong>
                    <small>Full QR scan history, updates, usage, fuel, notes, photos and locations.</small>
                  </span>
                </button>

                <button type="button" className={styles.assetReportOptionButton} onClick={() => handleDownloadScanReport(activeAsset, 'maintenance')}>
                  <DocumentIcon className={styles.buttonIcon} />
                  <span>
                    <strong>Download maintenance report</strong>
                    <small>Checks, services, repairs, company details, mechanic details and locations.</small>
                  </span>
                </button>
              </div>
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
            <div className={styles.deleteConfirmIcon}>
              <TrashIcon className={styles.buttonIcon} />
            </div>

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
                  <TrashIcon className={styles.buttonIcon} />
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
                <span className={styles.modalEyebrow}>Download full Asset Register</span>
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
                        <div className={styles.exportOptionTop}>
                          <span className={styles.exportGraphic}>
                            <ExportGraphic src="/brand/pdf.png" alt="PDF export" icon={<PdfIcon className={styles.exportOptionIcon} />} />
                          </span>

                          <div className={styles.exportOptionTitleBlock}>
                            <strong>PDF summary</strong>
                            <span className={styles.exportOptionStatus}>{exportFormat === 'pdf' ? 'Selected' : 'Select'}</span>
                          </div>
                        </div>

                        <ul className={styles.exportFeatureList}>
                          <li>Choose one of five filtered PDF reports</li>
                          <li>Totals recalculate per selected report</li>
                          <li>Clean client / bank handover</li>
                        </ul>
                      </button>

                      <button
                        type="button"
                        className={`${styles.exportOption} ${exportFormat === 'xlsx' ? styles.exportOptionActive : ''}`}
                        onClick={() => selectExportFormat('xlsx')}
                        aria-pressed={exportFormat === 'xlsx'}
                      >
                        <div className={styles.exportOptionTop}>
                          <span className={styles.exportGraphic}>
                            <ExportGraphic src="/brand/sheet.png" alt="Spreadsheet export" icon={<SpreadsheetIcon className={styles.exportOptionIcon} />} />
                          </span>

                          <div className={styles.exportOptionTitleBlock}>
                            <strong>XLSX workbook</strong>
                            <span className={styles.exportOptionStatus}>{exportFormat === 'xlsx' ? 'Selected' : 'Select'}</span>
                          </div>
                        </div>

                        <ul className={styles.exportFeatureList}>
                          <li>Detailed register rows</li>
                          <li>Spreadsheet-friendly data</li>
                          <li>Easy offline editing</li>
                        </ul>
                      </button>
                    </div>

                    <div className={`${styles.formActions} ${styles.exportActions}`}>
                      <button type="button" className={styles.primaryButton} onClick={handleConfirmExport} disabled={isExporting}>
                        {exportFormat === 'pdf' ? <ChevronRightIcon className={styles.buttonIcon} /> : <DownloadIcon className={styles.buttonIcon} />}
                        <span>{exportFormat === 'pdf' ? 'Next' : isExporting ? 'Preparing export...' : 'Download XLSX'}</span>
                      </button>

                      <button type="button" className={styles.secondaryButton} onClick={closeExportModal} disabled={isExporting}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.pdfReportDropdownPanel}>
                      <select
                        className={styles.pdfReportDropdown}
                        value={pdfReportSelection}
                        onChange={handlePdfReportSelectionChange}
                        disabled={isExporting}
                        aria-label="Choose PDF summary option"
                      >
                        <option value="" disabled>Choose option</option>
                        {PDF_REPORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDownIcon className={styles.pdfReportDropdownIcon} />
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
                        <span>Email</span>
                        <input
                          type="email"
                          value={marketplaceDraft.sellerEmail}
                          onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, sellerEmail: event.target.value } : current))}
                          placeholder="Email"
                          aria-label="Email"
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
                <span className={styles.modalEyebrow}>Calculate future price</span>
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