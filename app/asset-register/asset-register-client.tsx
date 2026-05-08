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
type AssetKind = 'tractor' | 'equipment' | 'manual' | 'property' | 'vehicle' | 'tools';
type AssetMethod = 'aim4price' | 'market' | 'manual';
type ConditionKey = 'excellent' | 'good' | 'fair' | 'used' | 'serious';
type AssetConditionValue = ConditionKey | '';
type ExportFormat = 'pdf' | 'xlsx';
type RegisterFilterOption =
  | 'all'
  | 'insured'
  | 'not_insured'
  | 'financed'
  | 'not_financed'
  | 'highest_value'
  | 'lowest_value'
  | 'aim4price_value'
  | 'manual_value';

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
  error?: string;
};

type AccountProfile = {
  userId: string;
  name: string;
  email: string;
  businessName: string;
  phone: string;
  accountType: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
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
  financeNote: string;
  photos: string[];
  documents: AssetDocument[];
  hours: string;
  condition: AssetConditionValue;
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
  value: Extract<AssetKind, 'vehicle' | 'tools' | 'property' | 'equipment'>;
  label: string;
  description: string;
  titlePlaceholder: string;
}> = [
  {
    value: 'vehicle',
    label: 'Vehicle',
    description: 'Bakkies, trucks, trailers and other road or farm vehicles.',
    titlePlaceholder: 'Example: Toyota Hilux farm bakkie',
  },
  {
    value: 'tools',
    label: 'Tools',
    description: 'Smaller tools, workshop items and handheld equipment.',
    titlePlaceholder: 'Example: Workshop tool set',
  },
  {
    value: 'property',
    label: 'Property',
    description: 'Buildings, sheds, houses, stores and fixed improvements.',
    titlePlaceholder: 'Example: Main workshop building',
  },
  {
    value: 'equipment',
    label: 'Equipment',
    description: 'General machines and larger equipment not added through valuation.',
    titlePlaceholder: 'Example: Water pump trailer',
  },
];

const REGISTER_FILTER_OPTIONS: Array<{
  value: RegisterFilterOption;
  label: string;
  description: string;
}> = [
  {
    value: 'all',
    label: 'All assets',
    description: 'Show the full asset register.',
  },
  {
    value: 'insured',
    label: 'Insured',
    description: 'Only assets marked as insured.',
  },
  {
    value: 'not_insured',
    label: 'Not insured',
    description: 'Only assets not marked as insured.',
  },
  {
    value: 'financed',
    label: 'Financed',
    description: 'Only assets marked as financed.',
  },
  {
    value: 'not_financed',
    label: 'Not financed',
    description: 'Only assets not marked as financed.',
  },
  {
    value: 'highest_value',
    label: 'Highest value',
    description: 'Sort from highest register value to lowest.',
  },
  {
    value: 'lowest_value',
    label: 'Lowest value',
    description: 'Sort from lowest register value to highest.',
  },
  {
    value: 'aim4price_value',
    label: 'Aim4price value',
    description: 'Only assets using the Aim4price value.',
  },
  {
    value: 'manual_value',
    label: 'Manual value',
    description: 'Only assets using a manual register value.',
  },
];

const CONDITION_OPTIONS: Array<{ value: AssetConditionValue; label: string }> = [
  { value: '', label: 'Select condition' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'used', label: 'Used' },
  { value: 'serious', label: 'Requires attention' },
];

const initialAssetDraft: AssetDraft = {
  kind: 'equipment',
  title: '',
  value: '',
  note: '',
  serialNumber: '',
  isFinanced: false,
  isInsured: false,
  financeNote: '',
  photos: [],
  documents: [],
  hours: '',
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

function DownloadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 3v10" />
      <path d="m8 9 4 4 4-4" />
      <path d="M4 20h16" />
    </svg>
  );
}

function FilterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
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
  const normalized = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPercent(value: number): string {
  const normalized = Number(value || 0);
  return `${normalized.toFixed(normalized % 1 === 0 ? 0 : 1)}%`;
}

function formatRatioPercent(value: number): string {
  const normalized = Number(value || 0) * 100;
  return `${normalized.toFixed(normalized % 1 === 0 ? 0 : 1)}%`;
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
      manual: 'Manual asset',
      property: 'Property',
      vehicle: 'Vehicle',
      tools: 'Tools',
    }[value] ?? 'Manual asset'
  );
}

function normalizeDraftKind(value: AssetKind): AssetKind {
  return value === 'manual' ? 'equipment' : value;
}


function getManualAssetOption(kind: AssetKind) {
  const normalizedKind = normalizeDraftKind(kind);
  return MANUAL_ASSET_TYPE_OPTIONS.find((option) => option.value === normalizedKind) ?? MANUAL_ASSET_TYPE_OPTIONS[3];
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
  return asset.kind !== 'property' && asset.value > 0 && (isTractorAsset(asset) || isValuedEquipmentAsset(asset));
}

function isLiveOnMarketplace(asset: RegisterAsset): boolean {
  return String(asset.marketplaceStatus ?? 'draft').toLowerCase() === 'live';
}

function assetKindLabel(asset: RegisterAsset): string {
  return assetFamilyLabel(asset);
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
  return {
    kind: normalizeDraftKind(asset.kind),
    title: asset.title,
    value: String(asset.value || ''),
    note: asset.note,
    serialNumber: asset.serialNumber,
    isFinanced: asset.isFinanced,
    isInsured: asset.isInsured,
    financeNote: asset.financeNote,
    photos: normalizePhotos(asset.photos),
    documents: assetDocuments(asset),
    hours: asset.hours === null || typeof asset.hours === 'undefined' ? '' : String(asset.hours),
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
    note: asset.note || undefined,
    createdAtIso: asset.createdAtIso,
    updatedAtIso: asset.updatedAtIso,
    serialNumber: asset.serialNumber || undefined,
    isFinanced: asset.isFinanced,
    isInsured: asset.isInsured,
    financeNote: asset.financeNote || undefined,
    photos: asset.photos,
    documents: assetDocuments(asset),
  };
}

function createMarketplaceDraft(asset: RegisterAsset, profile: AccountProfile | null): MarketplacePublishDraft {
  return {
    sellerName: profile?.name?.trim() || profile?.businessName?.trim() || 'Aim4price seller',
    sellerCompany: profile?.businessName?.trim() || '',
    sellerPhone: asset.sellerPhone?.trim() || profile?.phone?.trim() || '',
    sellerEmail: profile?.email?.trim() || '',
    province: profile?.province?.trim() || '',
    area: profile?.townCity?.trim() || '',
    askingPriceExVat: String(Math.round(asset.selectedValueExVat || asset.value || 0)),
    description: (asset.marketplaceNotes || asset.note || `Clean ${asset.title} listing from the Aim4price asset register.`).trim(),
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
  if (asset.kind === 'property') return 'Property';
  if (asset.kind === 'vehicle') return 'Vehicle';
  if (asset.kind === 'tools') return 'Tools';
  return 'Manual';
}

function assetFamilyLabel(asset: RegisterAsset): string {
  if (asset.equipmentFamilyLabel) return asset.equipmentFamilyLabel;
  if (isTractorAsset(asset)) return 'Tractor';
  if (asset.kind === 'equipment') return 'Equipment';
  if (asset.kind === 'property') return 'Property';
  if (asset.kind === 'vehicle') return 'Vehicle';
  if (asset.kind === 'tools') return 'Tools';
  if (isValuedEquipmentAsset(asset)) return 'Valued equipment';
  return 'Manual asset';
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
  const depreciationMethod = String(asset.depreciationMethodUsed ?? '').trim().toLowerCase();
  const usesPercentDepreciation = depreciationMethod === 'semi_depreciation' || depreciationMethod === 'percentage_depreciation';

  if (percent !== null && (usesPercentDepreciation || !hasHours)) {
    return formatUsagePercent(percent);
  }

  if (hasHours) {
    return `${Math.round(hours).toLocaleString('en-ZA')} hours`;
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
    asset.yearModel ? `Year Model: ${asset.yearModel}` : '',
    buildAssetUsageMeta(asset),
    asset.condition ? `Condition: ${conditionLabel(asset.condition)}` : '',
  ].filter(Boolean);

  return parts.join(' • ') || 'No key details saved yet';
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
    asset.note,
    asset.financeNote,
    ...assetDocuments(asset).map((document) => document.fileName),
    assetDocuments(asset).length ? 'documents paperwork invoice natis papers' : '',
    asset.isInsured ? 'insured insurance' : 'not insured no insurance',
    asset.tractorType,
    asset.drive,
    asset.cab,
    asset.yearModel ? String(asset.yearModel) : '',
    asset.hours !== null && typeof asset.hours !== 'undefined' ? String(asset.hours) : '',
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
    `Insurance: ${asset.isInsured ? 'Insured' : 'Not insured'}`,
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

function buildAssetScanReportUrl(asset: RegisterAsset): string {
  return `/api/asset-register/scan-report?assetId=${encodeURIComponent(asset.id)}`;
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

export default function AssetRegisterClient() {
  const [assets, setAssets] = useState<RegisterAsset[]>([]);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [assetDraft, setAssetDraft] = useState<AssetDraft>(initialAssetDraft);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [activeAsset, setActiveAsset] = useState<RegisterAsset | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copiedScanLinkAssetId, setCopiedScanLinkAssetId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [detailPhotoIndexByAsset, setDetailPhotoIndexByAsset] = useState<Record<string, number>>({});
  const detailTouchStartXRef = useRef<number | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [deleteCandidateAsset, setDeleteCandidateAsset] = useState<RegisterAsset | null>(null);
  const [marketplaceAsset, setMarketplaceAsset] = useState<RegisterAsset | null>(null);
  const [marketplaceDraft, setMarketplaceDraft] = useState<MarketplacePublishDraft | null>(null);
  const [isPublishingMarketplace, setIsPublishingMarketplace] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRegisterFilter, setActiveRegisterFilter] = useState<RegisterFilterOption>('all');
  const [isRegisterFilterOpen, setIsRegisterFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [registerValueVatMode, setRegisterValueVatMode] = useState<'excluded' | 'included'>('excluded');
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [projectionAsset, setProjectionAsset] = useState<RegisterAsset | null>(null);
  const [projectionForm, setProjectionForm] = useState<ProjectionFormState>(createDefaultProjectionForm());
  const [projectionResult, setProjectionResult] = useState<AssetFutureProjection | null>(null);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const [isLoadingProjection, setIsLoadingProjection] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const projectionRequestRef = useRef(0);
  const projectionResultRef = useRef<HTMLElement | null>(null);
  const [shouldScrollToProjectionResult, setShouldScrollToProjectionResult] = useState(false);
  const projectionYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 16 }, (_, index) => currentYear + index);
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
  }, [activeRegisterFilter, searchTerm]);

  useEffect(() => {
    if (!isRegisterFilterOpen) return undefined;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target instanceof Node ? event.target : null;

      if (!target || filterMenuRef.current?.contains(target)) {
        return;
      }

      setIsRegisterFilterOpen(false);
    };

    const handleFilterEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsRegisterFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleFilterEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleFilterEscape);
    };
  }, [isRegisterFilterOpen]);

  const anyModalOpen =
    isAssetModalOpen ||
    Boolean(activeAsset) ||
    Boolean(deleteCandidateAsset) ||
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

      if (deleteCandidateAsset) {
        closeDeleteConfirmDialog();
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

      if (activeAsset) {
        closeActionDialog();
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
  }, [activeAsset, anyModalOpen, deleteCandidateAsset, isAssetModalOpen, isExportModalOpen, isQrModalOpen, isSummaryModalOpen, marketplaceAsset, projectionAsset]);

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
        if (!asset.isFinanced) {
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
        if (!asset.isInsured) {
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

  const showUsageHoursField = useMemo(() => {
    return assetFormKind === 'tractor' || assetFormKind === 'equipment' || assetFormKind === 'vehicle';
  }, [assetFormKind]);

  const showConditionField = useMemo(() => {
    return assetFormKind !== 'property';
  }, [assetFormKind]);

  const usageFieldLabel = assetFormKind === 'vehicle' ? 'Odometer / hours' : 'Machine hours';
  const usageFieldPlaceholder = assetFormKind === 'vehicle' ? 'Enter kilometres or hours' : 'Enter machine hours';
  const usageFieldHint =
    assetFormKind === 'vehicle'
      ? 'Use mileage or engine hours — whichever you use to track this vehicle.'
      : 'This can be updated later whenever the machine hours change.';

  const activeRegisterFilterLabel = useMemo(() => {
    return REGISTER_FILTER_OPTIONS.find((option) => option.value === activeRegisterFilter)?.label ?? 'All assets';
  }, [activeRegisterFilter]);

  const filteredAssets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    let nextAssets = [...assets];

    switch (activeRegisterFilter) {
      case 'insured':
        nextAssets = nextAssets.filter((asset) => asset.isInsured);
        break;
      case 'not_insured':
        nextAssets = nextAssets.filter((asset) => !asset.isInsured);
        break;
      case 'financed':
        nextAssets = nextAssets.filter((asset) => asset.isFinanced);
        break;
      case 'not_financed':
        nextAssets = nextAssets.filter((asset) => !asset.isFinanced);
        break;
      case 'aim4price_value':
        nextAssets = nextAssets.filter((asset) => asset.selectedMethod === 'aim4price');
        break;
      case 'manual_value':
        nextAssets = nextAssets.filter((asset) => asset.selectedMethod === 'manual');
        break;
      default:
        break;
    }

    if (normalizedSearch) {
      nextAssets = nextAssets.filter((asset) => buildSearchableText(asset).includes(normalizedSearch));
    }

    if (activeRegisterFilter === 'highest_value') {
      nextAssets.sort((left, right) => Number(right.value || 0) - Number(left.value || 0));
    }

    if (activeRegisterFilter === 'lowest_value') {
      nextAssets.sort((left, right) => Number(left.value || 0) - Number(right.value || 0));
    }

    return nextAssets;
  }, [activeRegisterFilter, assets, searchTerm]);

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
    setEditingAssetId(null);
    setAssetDraft(initialAssetDraft);

    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }

    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  }

  function openCreateModal() {
    resetEditor();
    setIsAssetModalOpen(true);
  }

  function closeAssetModal() {
    setIsAssetModalOpen(false);
    resetEditor();
  }

  function openUpdater(asset: RegisterAsset) {
    setEditingAssetId(asset.id);
    setAssetDraft(buildDraftFromAsset(asset));
    setIsAssetModalOpen(true);
  }

  function openActionDialog(asset: RegisterAsset) {
    setActiveAsset(asset);
  }

  function closeActionDialog() {
    setIsQrModalOpen(false);
    setCopiedScanLinkAssetId(null);
    setDeleteCandidateAsset(null);
    setActiveAsset(null);
  }

  function openDeleteConfirmDialog(asset: RegisterAsset) {
    setDeleteCandidateAsset(asset);
  }

  function closeDeleteConfirmDialog() {
    if (busyDeleteId) return;
    setDeleteCandidateAsset(null);
  }

  function openQrDialog() {
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

  async function handlePhotoFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!selectedFiles.length) {
      return;
    }

    const remainingSlots = MAX_PHOTOS - assetDraft.photos.length;

    if (remainingSlots <= 0) {
      setNotice({ tone: 'error', message: `You can upload a maximum of ${MAX_PHOTOS} photos per asset.` });
      return;
    }

    const filesToUpload = selectedFiles.slice(0, remainingSlots);
    const formData = new FormData();

    filesToUpload.forEach((file) => {
      formData.append('files', file);
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

      const uploadedUrls = data.uploads.map((entry) => entry.url);

      setAssetDraft((current) => ({
        ...current,
        photos: normalizePhotos([...current.photos, ...uploadedUrls]),
      }));

      setNotice({
        tone: 'success',
        message: `${data.uploads.length} photo${data.uploads.length === 1 ? '' : 's'} uploaded.`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload images.',
      });
    } finally {
      setIsUploadingPhotos(false);
    }
  }

  function removeDraftPhoto(photoUrl: string) {
    setAssetDraft((current) => ({
      ...current,
      photos: current.photos.filter((photo) => photo !== photoUrl),
    }));
  }


  async function handleDocumentFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!selectedFiles.length) {
      return;
    }

    const remainingSlots = MAX_DOCUMENTS - assetDraft.documents.length;

    if (remainingSlots <= 0) {
      setNotice({ tone: 'error', message: `You can upload a maximum of ${MAX_DOCUMENTS} documents per asset.` });
      return;
    }

    const filesToUpload = selectedFiles.slice(0, remainingSlots);
    const formData = new FormData();
    formData.append('uploadType', 'document');

    filesToUpload.forEach((file) => {
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

      const uploadedDocuments = data.uploads.map((entry) => ({
        id: entry.uploadId || entry.url,
        url: entry.url,
        fileName: entry.fileName,
        contentType: entry.contentType,
        byteSize: entry.byteSize,
        uploadedAtIso: new Date().toISOString(),
      }));

      setAssetDraft((current) => ({
        ...current,
        documents: normalizeDocuments([...current.documents, ...uploadedDocuments]),
      }));

      setNotice({
        tone: 'success',
        message: `${data.uploads.length} document${data.uploads.length === 1 ? '' : 's'} uploaded.`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload documents.',
      });
    } finally {
      setIsUploadingDocuments(false);
    }
  }

  function removeDraftDocument(documentId: string) {
    setAssetDraft((current) => ({
      ...current,
      documents: current.documents.filter((document) => document.id !== documentId),
    }));
  }

  async function handleAssetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = Math.round(Number(assetDraft.value) || 0);
    const photos = normalizePhotos(assetDraft.photos);
    const documents = normalizeDocuments(assetDraft.documents);
    const hasHours = assetDraft.hours.trim() !== '';
    const hours = hasHours ? Number(assetDraft.hours) : null;

    if (!assetDraft.title.trim() || value <= 0) {
      setNotice({ tone: 'error', message: 'Asset title and value are required.' });
      return;
    }

    if (hasHours && (!Number.isFinite(hours) || Number(hours) < 0)) {
      setNotice({ tone: 'error', message: 'Machine hours must be zero or greater.' });
      return;
    }

    setIsSavingAsset(true);

    const payload = {
      kind: editingAsset?.valuationRunId ? editingAsset.kind : assetDraft.kind,
      title: assetDraft.title,
      value,
      note: assetDraft.note,
      serialNumber: assetDraft.serialNumber,
      isFinanced: assetDraft.isFinanced,
      isInsured: assetDraft.isInsured,
      financeNote: assetDraft.financeNote,
      photos,
      documents,
      hours: showUsageHoursField && hasHours ? Math.round(Number(hours)) : null,
      condition: showConditionField ? assetDraft.condition || null : null,
    };

    try {
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

        setNotice({ tone: 'success', message: 'Asset updated.' });
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

        setAssets((current) => [data.item as RegisterAsset, ...current]);
        setNotice({ tone: 'success', message: 'Asset added to the register.' });
      }

      closeAssetModal();
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
      setNotice({ tone: 'error', message: 'Only valued equipment assets can be sent to marketplace.' });
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

  function handlePrintAssetSheet(asset: RegisterAsset) {
    const didOpen = openAssetSheetPrint({
      logoUrl: toAbsoluteUrl('/brand/aim4price-mark-white.png') ?? '',
      generatedAt: formatDate(new Date().toISOString()),
      assetBadge: assetKindLabel(asset),
      heroTitle: asset.title,
      heroMeta: buildAssetMeta(asset),
      valueLabel: `${methodLabel(asset.selectedMethod)} value`,
      value: money(asset.value),
      valueNote: 'Saved asset register snapshot.',
      statusLabel: assetStatusDateLabel(asset),
      photoUrl: toAbsoluteUrl(asset.photos[0] || FALLBACK_ASSET_IMAGE) ?? null,
      facts: [
        { label: 'Asset type', value: assetKindLabel(asset) },
        { label: 'Method', value: methodLabel(asset.selectedMethod) },
        { label: 'Brand', value: asset.brandName || '—' },
        { label: 'Model', value: asset.modelName || '—' },
        { label: 'Drive', value: asset.drive ? formatDrive(asset.drive) : '—' },
        { label: 'Cab', value: asset.cab ? formatCab(asset.cab) : '—' },
        { label: 'Power', value: asset.powerKw !== null && typeof asset.powerKw !== 'undefined' ? `${asset.powerKw} kW` : '—' },
        { label: 'Year', value: asset.yearModel ? String(asset.yearModel) : '—' },
        {
          label: 'Usage',
          value: buildAssetUsageValue(asset),
        },
        { label: 'Condition', value: conditionLabel(asset.condition) },
        { label: 'Serial', value: asset.serialNumber || '—' },
        { label: 'Finance', value: asset.isFinanced ? 'Financed' : 'Not financed' },
        { label: 'Insurance', value: asset.isInsured ? 'Insured' : 'Not insured' },
        { label: 'Documents', value: assetDocuments(asset).length ? `${assetDocuments(asset).length} saved` : 'No documents' },
        { label: 'Updated', value: assetStatusDateLabel(asset) },
      ],
      notes: [
        ...(asset.note ? [{ label: 'Notes', value: asset.note }] : []),
        ...(asset.financeNote ? [{ label: 'Finance note', value: asset.financeNote }] : []),
      ],
      methodCards: buildAssetSheetMethodCards(asset),
      footerNote: 'Aim4price asset sheet. All register values shown exclude VAT.',
    });

    if (!didOpen) {
      setNotice({
        tone: 'error',
        message: 'Unable to open the asset sheet PDF window. Please allow pop-ups and try again.',
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

  function handleOpenScanReport(asset: RegisterAsset) {
    const reportUrl = buildAssetScanReportUrl(asset);
    const opened = window.open(reportUrl, '_blank', 'noopener,noreferrer');

    if (!opened) {
      setNotice({
        tone: 'error',
        message: 'Unable to open the QR scan report. Please allow pop-ups and try again.',
      });
      return;
    }

    setNotice({
      tone: 'success',
      message: 'QR scan report opened in a new tab. Use Print to save it as a PDF.',
    });
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

  function openExportModal() {
    if (!assets.length) {
      return;
    }

    setExportFormat('pdf');
    setIsExportModalOpen(true);
  }

  function closeExportModal() {
    if (isExporting) return;
    setIsExportModalOpen(false);
  }

  async function handleExportPdf() {
    const profile = await ensureAccountProfile();
    const didOpen = openAssetRegisterSummaryPrint({
      logoUrl: toAbsoluteUrl('/brand/aim4price-mark-white.png') ?? '',
      generatedAt: formatDate(new Date().toISOString()),
      ownerName: buildOwnerName(profile),
      ownerMeta: buildOwnerMeta(profile),
      intro: 'Complete asset register snapshot for sharing, printing or record keeping.',
      stats: [
        { label: 'Register value', value: money(totalValue), note: 'Saved values exclude VAT.' },
        { label: 'Aim4price valued equipment', value: String(aim4priceValuedEquipmentCount), note: 'Assets saved from Aim4price valuations.' },
        { label: 'Total assets', value: String(assets.length), note: 'Full saved register count.' },
        { label: 'Assets financed', value: money(financedAssetStats.value), note: `${financedAssetStats.count} marked as financed.` },
        { label: 'Assets insured', value: money(insuredAssetStats.value), note: `${insuredAssetStats.count} marked as insured.` },
      ],
      rows: assets.map((asset) => ({
        asset: asset.title,
        type: assetKindLabel(asset),
        method: methodLabel(asset.selectedMethod),
        detail: buildExportDetail(asset),
        value: money(asset.value),
        status: assetStatusDateLabel(asset),
      })),
      footerNote: 'Aim4price asset register. All register values shown exclude VAT.',
    });

    if (!didOpen) {
      throw new Error('Unable to open the full asset register PDF. Please allow pop-ups and try again.');
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

    setIsExporting(true);

    try {
      if (exportFormat === 'xlsx') {
        await handleExportXlsx();
      } else {
        await handleExportPdf();
      }

      setIsExportModalOpen(false);
      setNotice({
        tone: 'success',
        message: exportFormat === 'xlsx' ? 'Asset register XLSX downloaded.' : 'Asset register PDF opened.',
      });
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

  const isRegisterFilterActive = activeRegisterFilter !== 'all';
  const registerRangeDescription = filteredAssets.length
    ? `Showing ${pageStart + 1}-${pageEnd} of ${filteredAssets.length} ${filteredAssets.length === 1 ? 'asset' : 'assets'}`
    : searchTerm.trim() && isRegisterFilterActive
      ? 'No assets match the current search and filter.'
      : searchTerm.trim()
        ? 'No assets match the current search.'
        : isRegisterFilterActive
          ? 'No assets match the selected filter.'
          : 'No saved assets yet.';

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

              <div className={styles.filterMenuWrap} ref={filterMenuRef}>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.filterTriggerButton} ${isRegisterFilterActive ? styles.filterTriggerButtonActive : ''}`}
                  onClick={() => setIsRegisterFilterOpen((current) => !current)}
                  disabled={isLoading}
                  aria-haspopup="menu"
                  aria-expanded={isRegisterFilterOpen}
                >
                  <FilterIcon className={styles.buttonIcon} />
                  <span>{isRegisterFilterActive ? activeRegisterFilterLabel : 'Filter'}</span>
                  <ChevronDownIcon className={styles.buttonIcon} />
                </button>

                {isRegisterFilterOpen ? (
                  <div className={styles.filterMenu} role="menu" aria-label="Filter asset register">
                    {REGISTER_FILTER_OPTIONS.map((option) => {
                      const isActiveOption = option.value === activeRegisterFilter;

                      return (
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={isActiveOption}
                          className={`${styles.filterMenuOption} ${isActiveOption ? styles.filterMenuOptionActive : ''}`}
                          key={option.value}
                          onClick={() => {
                            setActiveRegisterFilter(option.value);
                            setIsRegisterFilterOpen(false);
                          }}
                        >
                          <span>{option.label}</span>
                          <small>{option.description}</small>
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
                placeholder="Search by asset, brand, model, serial or note"
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

            <button type="button" className={`${styles.primaryButton} ${styles.toolbarPrimaryButton}`} onClick={openCreateModal}>
              <PlusIcon className={styles.buttonIcon} />
              <span>Manually add asset</span>
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

                    return (
                      <article className={`${styles.assetCard} ${isExpanded ? styles.assetCardExpanded : ''}`} key={asset.id}>
                        <div className={styles.assetHeader}>
                          <div className={styles.assetTitleBlock}>
                            {isLive ? (
                              <div className={styles.badgeRow}>
                                <span className={`${styles.badge} ${styles.badgeSuccess}`}>Live on marketplace</span>
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
                                <OptionsIcon className={styles.buttonIcon} />
                                <span>Options</span>
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
                                          <span>Year</span>
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
                                          <strong>{asset.isFinanced ? 'Yes' : 'No'}</strong>
                                        </div>
                                        <div className={styles.assetStatusRow}>
                                          <span>Insured</span>
                                          <strong>{asset.isInsured ? 'Yes' : 'No'}</strong>
                                        </div>
                                      </div>
                                    </div>

                                    {asset.note || asset.financeNote ? (
                                      <div className={styles.noteStack}>
                                        {asset.note ? <p className={styles.note}>{asset.note}</p> : null}
                                        {asset.financeNote ? <p className={styles.note}>Finance: {asset.financeNote}</p> : null}
                                      </div>
                                    ) : null}
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
                <h3>No assets match this view</h3>
                <p>Clear the search or choose All assets to see the full register again.</p>
                <div className={styles.emptyStateActions}>
                  {searchTerm ? (
                    <button type="button" className={styles.secondaryButton} onClick={() => setSearchTerm('')}>
                      Clear search
                    </button>
                  ) : null}

                  {isRegisterFilterActive ? (
                    <button type="button" className={styles.secondaryButton} onClick={() => setActiveRegisterFilter('all')}>
                      Clear filter
                    </button>
                  ) : null}
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
                <button type="button" className={styles.primaryButton} onClick={openCreateModal}>
                  <PlusIcon className={styles.buttonIcon} />
                  <span>Manually add asset</span>
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
                <p>Live totals calculated from the saved assets in this register. Financed and insured totals update when those asset checkboxes are changed.</p>
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

                <section className={styles.summaryStatusGrid} aria-label="Finance and insurance totals">
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
                </section>

              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isAssetModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeAssetModal} />

          <div className={`${styles.modalCard} ${styles.assetFormModal}`} role="dialog" aria-modal="true" aria-labelledby="asset-form-title">
            <div className={`${styles.modalHeader} ${styles.assetFormModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <span className={styles.modalEyebrow}>{editingAsset ? 'Update asset' : 'Manually add asset'}</span>
                <h3 id="asset-form-title">{editingAsset ? 'Update asset details' : 'Add another asset'}</h3>
                <p>
                  {editingAsset
                    ? 'Update the saved asset details without leaving the register.'
                    : 'Choose a type, enter the value, then add notes or photos if needed.'}
                </p>
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

            <div className={styles.modalScrollBody}>
              <form className={styles.modalForm} onSubmit={handleAssetSubmit}>
              <label className={`${styles.field} ${styles.assetTypeField} ${styles.fullWidth}`}>
                <span>Asset type</span>
                {editingAsset?.valuationRunId ? (
                  <input value={kindLabel(editingAsset.kind)} disabled readOnly />
                ) : (
                  <select
                    value={assetFormKind}
                    onChange={(event) => {
                      const nextKind = event.target.value as AssetKind;
                      setAssetDraft((current) => ({
                        ...current,
                        kind: nextKind,
                        hours: nextKind === 'property' || nextKind === 'tools' ? '' : current.hours,
                        condition: nextKind === 'property' ? '' : current.condition,
                      }));
                    }}
                  >
                    {MANUAL_ASSET_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
                <small className={styles.fieldHint}>
                  {editingAsset?.valuationRunId
                    ? 'This asset type comes from the saved valuation and cannot be changed here.'
                    : getManualAssetOption(assetFormKind).description}
                </small>
              </label>

              <label className={styles.field}>
                <span>Title</span>
                <input
                  value={assetDraft.title}
                  onChange={(event) =>
                    setAssetDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder={getManualAssetOption(assetFormKind).titlePlaceholder}
                />
              </label>

              <label className={styles.field}>
                <span>Value</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={assetDraft.value}
                  onChange={(event) =>
                    setAssetDraft((current) => ({
                      ...current,
                      value: event.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </label>

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
                  placeholder="Serial number or internal reference"
                />
              </label>

              {showUsageHoursField ? (
                <label className={styles.field}>
                  <span>{usageFieldLabel}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={assetDraft.hours}
                    onChange={(event) =>
                      setAssetDraft((current) => ({
                        ...current,
                        hours: event.target.value,
                      }))
                    }
                    placeholder={usageFieldPlaceholder}
                  />
                  <small className={styles.fieldHint}>{usageFieldHint}</small>
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
                  <small className={styles.fieldHint}>Condition feeds through to cleaner asset sheets and better saved asset information.</small>
                </label>
              ) : null}

              <label className={`${styles.field} ${styles.fullWidth}`}>
                <span>Notes</span>
                <textarea
                  rows={4}
                  value={assetDraft.note}
                  onChange={(event) =>
                    setAssetDraft((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Extra details about the asset"
                />
              </label>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={assetDraft.isFinanced}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setAssetDraft((current) => ({
                      ...current,
                      isFinanced: checked,
                      financeNote: checked ? current.financeNote : '',
                    }));
                  }}
                />
                <span>This asset is financed</span>
              </label>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={assetDraft.isInsured}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setAssetDraft((current) => ({
                      ...current,
                      isInsured: checked,
                    }));
                  }}
                />
                <span>This asset is insured</span>
              </label>

              {assetDraft.isFinanced ? (
                <label className={`${styles.field} ${styles.fullWidth}`}>
                  <span>Finance note</span>
                  <input
                    value={assetDraft.financeNote}
                    onChange={(event) =>
                      setAssetDraft((current) => ({
                        ...current,
                        financeNote: event.target.value,
                      }))
                    }
                    placeholder="Bank, lender or finance reference"
                  />
                </label>
              ) : null}

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <span>Documents <small>(optional)</small></span>

                <div className={styles.documentUploadPanel}>
                  <input
                    ref={documentInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,image/jpeg,image/png,image/webp"
                    multiple
                    className={styles.fileInput}
                    onChange={handleDocumentFilesSelected}
                    disabled={isUploadingDocuments || assetDraft.documents.length >= MAX_DOCUMENTS}
                  />

                  <div className={styles.uploadRow}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => documentInputRef.current?.click()}
                      disabled={isUploadingDocuments || assetDraft.documents.length >= MAX_DOCUMENTS}
                    >
                      {isUploadingDocuments ? 'Uploading...' : 'Add documents'}
                    </button>

                    <span className={styles.uploadCount}>
                      {assetDraft.documents.length} / {MAX_DOCUMENTS} documents
                    </span>
                  </div>

                  <small className={styles.fieldHint}>Upload invoices, NATIS papers, insurance documents, finance contracts or service records.</small>
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

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <span>Photo gallery <small>(optional)</small></span>

                <div className={styles.uploadPanel}>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className={styles.fileInput}
                    onChange={handlePhotoFilesSelected}
                    disabled={isUploadingPhotos || assetDraft.photos.length >= MAX_PHOTOS}
                  />

                  <div className={styles.uploadRow}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhotos || assetDraft.photos.length >= MAX_PHOTOS}
                    >
                      {isUploadingPhotos ? 'Uploading...' : 'Add photos'}
                    </button>

                    <span className={styles.uploadCount}>
                      {assetDraft.photos.length} / {MAX_PHOTOS} photos
                    </span>
                  </div>
                </div>
              </div>

              {assetDraft.photos.length ? (
                <div className={styles.photoGrid}>
                  {assetDraft.photos.map((photo, index) => (
                    <div className={styles.photoThumb} key={`${photo}-${index}`}>
                      <img src={photo} alt={`Asset photo ${index + 1}`} />
                      <button
                        type="button"
                        className={styles.photoRemoveButton}
                        onClick={() => removeDraftPhoto(photo)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className={`${styles.formActions} ${styles.assetFormActions}`}>
                <button type="button" className={styles.secondaryButton} onClick={closeAssetModal}>
                  Cancel
                </button>

                <button type="submit" className={styles.primaryButton} disabled={isSavingAsset || isUploadingPhotos || isUploadingDocuments}>
                  {isSavingAsset ? 'Saving...' : editingAsset ? 'Update asset' : 'Add asset'}
                </button>
              </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {activeAsset ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeActionDialog} />

          <div className={styles.optionsModal} role="dialog" aria-modal="true" aria-labelledby="asset-options-title">
            <div className={`${styles.modalHeader} ${styles.optionsModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-options-title">{activeAsset.title}</h3>
                <p>{buildAssetMeta(activeAsset)}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeActionDialog}
                aria-label="Close asset options"
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
                    <EditIcon className={styles.buttonIcon} />
                    <span>
                      <strong>Update asset</strong>
                      <small>Edit details, documents, photos and status.</small>
                    </span>
                  </button>

                  <button type="button" className={styles.optionActionButton} onClick={openQrDialog}>
                    <QrIcon className={styles.buttonIcon} />
                    <span>
                      <strong>QR code</strong>
                      <small>Copy, download or print the asset QR label.</small>
                    </span>
                  </button>

                  <button type="button" className={styles.optionActionButton} onClick={() => handlePrintAssetSheet(activeAsset)}>
                    <DownloadIcon className={styles.buttonIcon} />
                    <span>
                      <strong>Download asset PDF</strong>
                      <small>Open a clean asset sheet for records.</small>
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
                      <StoreIcon className={styles.buttonIcon} />
                      <span>
                        <strong>{isLiveOnMarketplace(activeAsset) ? 'Update marketplace' : 'Send to marketplace'}</strong>
                        <small>{isLiveOnMarketplace(activeAsset) ? 'Refresh the live listing details.' : 'Create a marketplace listing from this asset.'}</small>
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
                <div className={styles.exportChoices}>
                  <button
                    type="button"
                    className={`${styles.exportOption} ${exportFormat === 'pdf' ? styles.exportOptionActive : ''}`}
                    onClick={() => setExportFormat('pdf')}
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
                      <li>Printable register summary</li>
                      <li>Clean client / bank handover</li>
                      <li>Fast visual review</li>
                    </ul>
                  </button>

                  <button
                    type="button"
                    className={`${styles.exportOption} ${exportFormat === 'xlsx' ? styles.exportOptionActive : ''}`}
                    onClick={() => setExportFormat('xlsx')}
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

                <div className={styles.exportHelp}>
                  <strong>Ready to export {assets.length} {assets.length === 1 ? 'asset' : 'assets'}.</strong>
                  <span>The download uses the full saved register.</span>
                </div>

                <div className={`${styles.formActions} ${styles.exportActions}`}>
                  <button type="button" className={styles.primaryButton} onClick={handleConfirmExport} disabled={isExporting}>
                    <DownloadIcon className={styles.buttonIcon} />
                    <span>{isExporting ? 'Preparing export...' : exportFormat === 'xlsx' ? 'Download XLSX' : 'Open PDF summary'}</span>
                  </button>

                  <button type="button" className={styles.secondaryButton} onClick={closeExportModal} disabled={isExporting}>
                    Cancel
                  </button>
                </div>
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
                <span className={styles.modalEyebrow}>Send to marketplace</span>
                <h3 id="marketplace-confirm-title">Confirm listing details</h3>
                <p>Review the contact details, machinery price and listing notes before the asset goes live on the marketplace.</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closeMarketplaceModal} aria-label="Close marketplace modal">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={styles.modalScrollBody}>
              <div className={styles.modalBody}>
                <div className={styles.optionsMeta}>
                <div className={styles.optionMetaTile}>
                  <span>Asset</span>
                  <strong>{marketplaceAsset.title}</strong>
                </div>
                  <div className={styles.optionMetaTile}>
                    <span>Saved register value</span>
                    <strong>{money(marketplaceAsset.value)}</strong>
                  </div>
                </div>

                <form className={styles.modalForm} onSubmit={handleConfirmMarketplacePublish}>
                <label className={styles.field}>
                  <span>Contact name</span>
                  <input
                    value={marketplaceDraft.sellerName}
                    onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, sellerName: event.target.value } : current))}
                    placeholder="Seller or contact name"
                  />
                </label>

                <label className={styles.field}>
                  <span>Company</span>
                  <input
                    value={marketplaceDraft.sellerCompany}
                    onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, sellerCompany: event.target.value } : current))}
                    placeholder="Business name"
                  />
                </label>

                <label className={styles.field}>
                  <span>Phone</span>
                  <input
                    value={marketplaceDraft.sellerPhone}
                    onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, sellerPhone: event.target.value } : current))}
                    placeholder="Contact phone"
                  />
                </label>

                <label className={styles.field}>
                  <span>Email</span>
                  <input
                    type="email"
                    value={marketplaceDraft.sellerEmail}
                    onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, sellerEmail: event.target.value } : current))}
                    placeholder="Contact email"
                  />
                </label>

                <label className={styles.field}>
                  <span>Province</span>
                  <input
                    value={marketplaceDraft.province}
                    onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, province: event.target.value } : current))}
                    placeholder="Province"
                  />
                </label>

                <label className={styles.field}>
                  <span>Area / town</span>
                  <input
                    value={marketplaceDraft.area}
                    onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, area: event.target.value } : current))}
                    placeholder="Area or town"
                  />
                </label>

                <label className={styles.field}>
                  <span>Marketplace price (excl. VAT)</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={marketplaceDraft.askingPriceExVat}
                    onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, askingPriceExVat: event.target.value } : current))}
                    placeholder="Listing price"
                  />
                </label>

                <label className={`${styles.field} ${styles.fullWidth}`}>
                  <span>Listing notes</span>
                  <textarea
                    value={marketplaceDraft.description}
                    onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, description: event.target.value } : current))}
                    placeholder="Short marketplace description"
                  />
                </label>

                <div className={styles.formActions}>
                  <button type="submit" className={styles.primaryButton} disabled={isPublishingMarketplace}>
                    {isPublishingMarketplace
                      ? 'Publishing...'
                      : isLiveOnMarketplace(marketplaceAsset)
                        ? 'Update marketplace listing'
                        : 'Confirm and send'}
                  </button>

                  <button type="button" className={styles.secondaryButton} onClick={closeMarketplaceModal} disabled={isPublishingMarketplace}>
                    Cancel
                  </button>
                </div>
                </form>
              </div>
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

                <div className={styles.qrDetailsCard}>
                  <span className={styles.qrPreviewEyebrow}>Scanner details</span>

                  <div className={styles.qrDetailRow}>
                    <span>Plate label</span>
                    <strong>{activeAsset.plateLabel || 'Pending'}</strong>
                  </div>

                  <div className={styles.qrDetailRow}>
                    <span>Last scanned</span>
                    <strong>{activeAsset.lastScannedAtIso ? formatDate(activeAsset.lastScannedAtIso) : 'No QR updates yet'}</strong>
                  </div>
                </div>
              </div>

              <div className={`${styles.optionsGrid} ${styles.qrActionsGrid}`}>
                <button type="button" className={styles.optionActionButton} onClick={() => handleOpenScanReport(activeAsset)}>
                  <PdfIcon className={styles.buttonIcon} />
                  <span>QR scan report</span>
                </button>

                <button
                  type="button"
                  className={`${styles.optionActionButton} ${copiedScanLinkAssetId === activeAsset.id ? styles.qrCopiedButton : ''}`}
                  onClick={() => void handleCopyScanLink(activeAsset)}
                >
                  <CopyIcon className={styles.buttonIcon} />
                  <span>{copiedScanLinkAssetId === activeAsset.id ? 'Copied' : 'Copy scan link'}</span>
                </button>

                <button type="button" className={styles.optionActionButton} onClick={() => void handleDownloadQr(activeAsset)}>
                  <QrIcon className={styles.buttonIcon} />
                  <span>Download QR Image</span>
                </button>

                <button type="button" className={styles.optionActionButton} onClick={() => handlePrintQrSheet(activeAsset)}>
                  <PrintIcon className={styles.buttonIcon} />
                  <span>Print QR label</span>
                </button>
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