'use client';

import DocumentFileLink from '../../components/DocumentFileLink';

import QrCodePreview from '../../components/QrCodePreview';

import DropdownOverlay from '../../components/DropdownOverlay';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode, type SVGProps } from 'react';
import AppHeader from '../../components/AppHeader';
import CaptureRequestStatusList, { type CaptureRequestStatusItem } from '../../components/CaptureRequestStatusList';
import styles from './page.module.css';
import wizardStyles from '../../components/AimWizardModal.module.css';
import { fuelSlipDecimalToInput, parseFuelSlipDecimal } from '../../lib/fuel-slip-number';
import { ManageFuelStorageChoiceModal, MissingFuelEntryModal, ReconcileFuelBalanceModal, type MissingFuelLedgerPayload } from './missing-fuel-entry-modal';

type FuelStorageStatus = 'active' | 'archived';
type ModalMode = 'create-storage' | 'edit-storage' | 'manage-storage-choice' | 'missing-entry' | 'reconcile-balance' | 'pin' | 'report' | 'qr' | 'fuel-slip' | 'fuel-slip-menu' | 'fuel-slip-manager' | 'exclusions' | null;
type FuelSlipFlowStep = 'source-choice' | 'target-manual' | 'target-automatic' | 'manual-form' | 'upload' | 'review' | null;
type FuelSlipFormPage = 'details' | 'extra';
type ReportFormat = 'pdf' | 'xlsx';
type ReportStep = 'format' | 'filters';
type ReportSelectKey = 'storage' | 'year' | 'month';
type FuelSlipManagerFilterKey = 'target' | 'capture' | 'year' | 'month';
type FuelSlipCaptureFilter = 'all' | 'manual' | 'automatic' | 'needs_review';

type FuelLedgerStorage = {
  id: string;
  name: string;
  fuelType: string;
  capacityLitres: number | null;
  currentLitres: number;
  stockPercent: number | null;
  reorderLevelLitres: number | null;
  locationLabel: string;
  notes: string;
  dipstickNote: string;
  dipstickNoteUpdatedAtIso: string | null;
  status: FuelStorageStatus;
  publicFuelStorageCode: string;
  pinEnabled: boolean;
  hasPin: boolean;
  pinUpdatedAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  balanceVerificationStatus?: 'verified' | 'needs_check';
  balanceNeedsChecking?: boolean;
  balanceCheckReason?: string;
  balanceCheckSourceEventId?: string;
  balanceCheckMarkedAtIso?: string | null;
};

type FuelLedgerEvent = {
  id: string;
  storageId: string;
  storageName: string;
  eventType: string;
  sourceType?: string;
  sourceLabel?: string;
  fuelSlipId?: string;
  totalAmount?: number | null;
  documentFileUrl?: string;
  paymentMethod?: string;
  cardNumberMasked?: string;
  litres: number;
  createdAtIso: string;
};

type FuelLedgerAsset = {
  id: string;
  title: string;
  kind: string;
  assetTypeLabel: string;
  brandName: string;
  modelName: string;
  serialNumber: string;
  plateLabel: string;
  publicAssetCode: string;
  hours: number | null;
  fuelPercent: number | null;
  yearModel?: number | null;
  condition?: string;
  selectedMethod?: string;
  currentValue?: number | null;
  canReceiveFuel: boolean;
  isActive?: boolean;
  usageMetric: 'hours' | 'km' | 'both' | 'percentage' | 'none';
  lifeWorkedPercent: number | null;
  workUseExcluded: boolean;
  workUseExclusionReason: string;
};

type FuelSlipRecord = {
  id: string;
  sourceType: 'fuel_slip';
  sourceLabel: 'Fuel Slip';
  targetType: 'asset' | 'storage_tank';
  assetId: string;
  assetTitle: string;
  storageId: string;
  storageName: string;
  fuelStorageEventId: string;
  assetInvoiceId: string;
  invoiceDocumentId: string;
  uploadId: string;
  documentFileUrl: string;
  originalFilename: string;
  contentType: string;
  byteSize: number | null;
  supplierName: string;
  supplierVatNumber: string;
  slipNumber: string;
  transactionNumber: string;
  documentDate: string;
  documentTime: string;
  fuelType: string;
  litres: number | null;
  pricePerLitre: number | null;
  totalAmount: number | null;
  vatAmount: number | null;
  vatIncluded: boolean | null;
  vatRate: number | null;
  paymentMethod: string;
  cardType: string;
  cardNumberMasked: string;
  cardLast4: string;
  merchantNumber: string;
  terminalNumber: string;
  siteNumber: string;
  odometerReading: number | null;
  hourMeterReading: number | null;
  operatorName: string;
  activityText: string;
  workAreaText: string;
  note: string;
  assetFuelPercentBefore: number | null;
  assetFuelPercentAfter: number | null;
  extractionStatus: 'manual' | 'extracted' | 'needs_review';
  ocrConfidence: number | null;
  reviewRequired: boolean;
  rawExtractedText: string;
  extractionWarnings: string[];
  workUseExcluded: boolean;
  workUseExclusionReason: string;
  recordStatus: 'active' | 'voided';
  voidedAtIso: string | null;
  voidedByName: string;
  voidReason: string;
  createdAtIso: string;
  updatedAtIso: string;
};

type FuelLedgerSummary = {
  totalStorageUnits: number;
  totalCapacityLitres: number;
  currentLitres: number;
  currentStockPercent: number | null;
  lowStorageCount: number;
  issuedLitres30Days: number;
  filledLitres30Days: number;
  activeAssetsCount: number;
};

type FuelLedgerResponse = {
  ok: boolean;
  storages?: FuelLedgerStorage[];
  recentEvents?: FuelLedgerEvent[];
  recentFuelSlips?: FuelSlipRecord[];
  fuelSlip?: FuelSlipRecord;
  assets?: FuelLedgerAsset[];
  summary?: FuelLedgerSummary;
  error?: string;
  pendingReview?: boolean;
  message?: string;
};

type FuelLedgerAuditEvent = {
  id: string;
  action: string;
  actorName: string;
  actorEmail: string;
  reason: string;
  createdAtIso: string;
};

type AccountantFuelLedgerResponse = FuelLedgerResponse & {
  fuel?: FuelLedgerResponse;
};

type StorageDraft = {
  name: string;
  fuelType: string;
  capacityLitres: string;
  currentLitres: string;
  reorderLevelLitres: string;
  locationLabel: string;
  notes: string;
  pin: string;
};

type FuelSlipDraft = {
  id: string;
  mode: 'manual' | 'automatic';
  targetKey: string;
  uploadId: string;
  documentFileUrl: string;
  originalFilename: string;
  contentType: string;
  byteSize: number | null;
  supplierName: string;
  supplierVatNumber: string;
  slipNumber: string;
  transactionNumber: string;
  documentDate: string;
  documentTime: string;
  fuelType: string;
  litres: string;
  pricePerLitre: string;
  totalAmount: string;
  vatAmount: string;
  vatIncluded: string;
  vatRate: string;
  paymentMethod: string;
  cardType: string;
  cardNumberMasked: string;
  cardLast4: string;
  merchantNumber: string;
  terminalNumber: string;
  siteNumber: string;
  odometerReading: string;
  hourMeterReading: string;
  operatorName: string;
  activityText: string;
  workAreaText: string;
  note: string;
  assetFuelPercentBefore: string;
  assetFuelPercentAfter: string;
  extractionStatus: 'manual' | 'extracted' | 'needs_review';
  ocrConfidence: number | null;
  reviewRequired: boolean;
  rawExtractedText: string;
  extractionWarnings: string[];
};

type FuelSlipMissingFieldKey =
  | 'documentDate'
  | 'fuelType'
  | 'litres'
  | 'totalAmount'
  | 'odometerReading'
  | 'hourMeterReading'
  | 'operatorName'
  | 'activityText'
  | 'workAreaText';

type FuelSlipValidationTargetType = 'asset' | 'storage_tank' | null;
type FuelSlipValidationUsageMetric = FuelLedgerAsset['usageMetric'] | null;

type FuelSlipExtractionDraft = {
  supplierName?: string;
  supplierVatNumber?: string;
  slipNumber?: string;
  transactionNumber?: string;
  documentDate?: string;
  documentTime?: string;
  fuelType?: string;
  litres?: number | null;
  pricePerLitre?: number | null;
  totalAmount?: number | null;
  vatAmount?: number | null;
  vatIncluded?: boolean | null;
  vatRate?: number | null;
  paymentMethod?: string;
  cardType?: string;
  cardNumberMasked?: string;
  cardLast4?: string;
  merchantNumber?: string;
  terminalNumber?: string;
  siteNumber?: string;
  extractionStatus?: 'manual' | 'extracted' | 'needs_review';
  ocrConfidence?: number | null;
  reviewRequired?: boolean;
};

type FuelSlipExtractResponse = {
  ok: boolean;
  upload?: {
    uploadId: string;
    documentFileUrl: string;
    originalFilename: string;
    contentType: string;
    byteSize: number | null;
  };
  extraction?: {
    draft: FuelSlipExtractionDraft;
    rawText: string;
    warnings: string[];
  };
  error?: string;
  pendingReview?: boolean;
  message?: string;
};

type FuelCaptureRequestResponse = {
  ok: boolean;
  request?: CaptureRequestStatusItem;
  requests?: CaptureRequestStatusItem[];
  message?: string;
  error?: string;
};

type Notice = {
  tone: 'success' | 'error';
  message: string;
};

type ReportSelectOption = {
  value: string;
  label: string;
};

type FuelSlipManagerFilterState = {
  targetKey: string;
  capture: FuelSlipCaptureFilter;
  year: string;
  month: string;
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

type FuelSlipFilterDropdownProps = {
  label: string;
  dropdownKey: FuelSlipManagerFilterKey;
  value: string;
  options: ReportSelectOption[];
  openDropdown: FuelSlipManagerFilterKey | null;
  disabled?: boolean;
  searchable?: boolean;
  searchValue?: string;
  searchPlaceholder?: string;
  noMatchesLabel?: string;
  onOpenChange: (key: FuelSlipManagerFilterKey | null) => void;
  onChange: (value: string) => void;
  onSearchChange?: (value: string) => void;
};

type StorageFuelTypeSelectProps = {
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
};

const FUEL_TYPE_OPTIONS: ReportSelectOption[] = [
  { value: 'diesel', label: 'Diesel' },
  { value: 'petrol', label: 'Petrol' },
  { value: 'adblue', label: 'AdBlue' },
  { value: 'paraffin', label: 'Paraffin' },
];

const emptyStorageDraft: StorageDraft = {
  name: '',
  fuelType: 'diesel',
  capacityLitres: '',
  currentLitres: '',
  reorderLevelLitres: '',
  locationLabel: '',
  notes: '',
  pin: '',
};


const emptyFuelSlipDraft: FuelSlipDraft = {
  id: '',
  mode: 'manual',
  targetKey: '',
  uploadId: '',
  documentFileUrl: '',
  originalFilename: '',
  contentType: '',
  byteSize: null,
  supplierName: '',
  supplierVatNumber: '',
  slipNumber: '',
  transactionNumber: '',
  documentDate: '',
  documentTime: '',
  fuelType: '',
  litres: '',
  pricePerLitre: '',
  totalAmount: '',
  vatAmount: '',
  vatIncluded: '',
  vatRate: '',
  paymentMethod: '',
  cardType: '',
  cardNumberMasked: '',
  cardLast4: '',
  merchantNumber: '',
  terminalNumber: '',
  siteNumber: '',
  odometerReading: '',
  hourMeterReading: '',
  operatorName: '',
  activityText: '',
  workAreaText: '',
  note: '',
  assetFuelPercentBefore: '',
  assetFuelPercentAfter: '',
  extractionStatus: 'manual',
  ocrConfidence: null,
  reviewRequired: false,
  rawExtractedText: '',
  extractionWarnings: [],
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
];

const REPORT_SOURCE_ALL_WITH_SLIPS = 'all_with_slips';
const REPORT_SOURCE_ALL_STORAGE_UNITS = 'all_storage_units';

const DEFAULT_FUEL_SLIP_MANAGER_FILTERS: FuelSlipManagerFilterState = {
  targetKey: 'all',
  capture: 'all',
  year: 'all',
  month: 'all',
};

const FUEL_SLIP_REQUIRED_NOTICE = 'Complete the red fields before this fuel slip can post to the Fuel Ledger.';

function normalizeFuelSlipWarningText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isGenericFuelSlipCompletionWarning(value: unknown): boolean {
  const normalized = normalizeFuelSlipWarningText(value).toLowerCase();

  if (!normalized) return false;
  if (normalized.startsWith('fuel slip saved as not completed')) return true;
  if (normalized.startsWith('fuel slip saved for review')) return true;
  if (normalized === 'complete the missing fuel slip fields before posting fuel usage.') return true;
  if (normalized.includes('before it can post to the fuel ledger')) return true;
  if (normalized.includes('enter the required odometer or hour-meter reading before posting fuel usage')) return true;

  return false;
}

function getVisibleFuelSlipExtractionWarnings(warnings: unknown): string[] {
  if (!Array.isArray(warnings)) return [];

  return warnings
    .map((warning) => normalizeFuelSlipWarningText(warning))
    .filter((warning) => warning && !isGenericFuelSlipCompletionWarning(warning))
    .slice(0, 12);
}

function fuelSlipTargetTypeFromKey(targetKey: string): FuelSlipValidationTargetType {
  const [targetType] = targetKey.split(':');
  if (targetType === 'asset' || targetType === 'storage_tank') return targetType;
  return null;
}

function hasFuelSlipPositiveNumber(value: string, decimals: number): boolean {
  const parsed = parseFuelSlipDecimal(value, decimals);
  return parsed !== null && parsed > 0;
}

function hasFuelSlipNonNegativeNumber(value: string, decimals: number): boolean {
  const parsed = parseFuelSlipDecimal(value, decimals);
  return parsed !== null && parsed >= 0;
}

function getFuelSlipMissingFields(
  draft: FuelSlipDraft,
  targetType: FuelSlipValidationTargetType,
  usageMetric: FuelSlipValidationUsageMetric,
  assetResolved: boolean,
): FuelSlipMissingFieldKey[] {
  const missing: FuelSlipMissingFieldKey[] = [];

  if (!draft.documentDate.trim()) missing.push('documentDate');
  if (!draft.fuelType.trim()) missing.push('fuelType');
  if (!hasFuelSlipPositiveNumber(draft.litres, 3)) missing.push('litres');
  if (!hasFuelSlipNonNegativeNumber(draft.totalAmount, 2)) missing.push('totalAmount');

  if (targetType === 'asset') {
    const effectiveUsageMetric: FuelSlipValidationUsageMetric = assetResolved ? usageMetric : 'both';

    if (effectiveUsageMetric === 'km') {
      if (!hasFuelSlipNonNegativeNumber(draft.odometerReading, 2)) missing.push('odometerReading');
    } else if (effectiveUsageMetric === 'hours') {
      if (!hasFuelSlipNonNegativeNumber(draft.hourMeterReading, 2)) missing.push('hourMeterReading');
    } else if (effectiveUsageMetric === 'both') {
      const hasOdometer = hasFuelSlipNonNegativeNumber(draft.odometerReading, 2);
      const hasHours = hasFuelSlipNonNegativeNumber(draft.hourMeterReading, 2);

      if (!hasOdometer && !hasHours) {
        missing.push('odometerReading', 'hourMeterReading');
      }
    }

    if (!draft.operatorName.trim()) missing.push('operatorName');
    if (!draft.activityText.trim()) missing.push('activityText');
    if (!draft.workAreaText.trim()) missing.push('workAreaText');
  }

  return missing;
}

function getFuelSlipMissingFieldPage(field: FuelSlipMissingFieldKey): FuelSlipFormPage {
  return field === 'documentDate' || field === 'fuelType' || field === 'litres' || field === 'totalAmount'
    ? 'details'
    : 'extra';
}

const FUEL_SLIP_MANAGER_PAGE_SIZE = 20;

const FUEL_SLIP_CAPTURE_FILTER_OPTIONS: ReportSelectOption[] = [
  { value: 'all', label: 'All fuel slips' },
  { value: 'manual', label: 'Manual fuel slips' },
  { value: 'automatic', label: 'Uploaded fuel slips' },
  { value: 'needs_review', label: 'Not completed' },
];

function IconBase(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />;
}

function GearIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 15.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.15 2.15 0 1 1-3.04 3.04l-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.08 1.65V21.4a2.15 2.15 0 1 1-4.3 0v-.09a1.8 1.8 0 0 0-1.08-1.65 1.8 1.8 0 0 0-1.98.36l-.04.04a2.15 2.15 0 1 1-3.04-3.04l.04-.04A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.65-1.08h-.1a2.15 2.15 0 1 1 0-4.3h.1A1.8 1.8 0 0 0 4.6 8.54a1.8 1.8 0 0 0-.36-1.98l-.04-.04a2.15 2.15 0 1 1 3.04-3.04l.04.04a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 10.34 2.2V2.1a2.15 2.15 0 1 1 4.3 0v.1a1.8 1.8 0 0 0 1.08 1.65 1.8 1.8 0 0 0 1.98-.36l.04-.04a2.15 2.15 0 1 1 3.04 3.04l-.04.04a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.65 1.08h.1a2.15 2.15 0 1 1 0 4.3h-.1A1.8 1.8 0 0 0 19.4 15Z" />
    </IconBase>
  );
}

function QrIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 4h6v6H4z" />
      <path d="M14 4h6v6h-6z" />
      <path d="M4 14h6v6H4z" />
      <path d="M14 14h2v2h-2z" />
      <path d="M18 14h2v4h-2z" />
      <path d="M14 18h4v2h-4z" />
    </IconBase>
  );
}

function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </IconBase>
  );
}

function PrintIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M7 8V3h10v5" />
      <path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v7H7z" />
    </IconBase>
  );
}

function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </IconBase>
  );
}

function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </IconBase>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </IconBase>
  );
}


function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3v11" />
      <path d="m7 9 5 5 5-5" />
      <path d="M5 20h14" />
    </IconBase>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </IconBase>
  );
}

function FilterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 5h16M7 12h10M10 19h4" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </IconBase>
  );
}

function ExclusionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 18 18 6" />
    </IconBase>
  );
}

function OpenFileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 15h6" />
    </IconBase>
  );
}

function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </IconBase>
  );
}

function HistoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  );
}

function FuelSlipsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M7 3h10v18l-2-1.2L13 21l-2-1.2L9 21l-2-1.2z" />
      <path d="M10 8h4" />
      <path d="M10 12h4" />
      <path d="M10 16h2" />
    </IconBase>
  );
}

function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="m9 18 6-6-6-6" />
    </IconBase>
  );
}

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

function PdfIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v5h5" />
      <path d="M8 13h1.5a1.5 1.5 0 0 0 0-3H8v6" />
      <path d="M12.5 16v-6h1.2a2.3 2.3 0 0 1 0 6z" />
      <path d="M17 10h3" />
      <path d="M17 13h2" />
      <path d="M17 10v6" />
    </IconBase>
  );
}

function SpreadsheetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 4h16v16H4z" />
      <path d="M4 9h16" />
      <path d="M4 14h16" />
      <path d="M9 4v16" />
      <path d="M14 4v16" />
    </IconBase>
  );
}

type ExportGraphicProps = {
  src: string;
  alt: string;
  icon: ReactNode;
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
    <div className={`${styles.reportSelectField} ${isOpen ? styles.reportSelectFieldOpen : ''} ${disabled ? styles.reportSelectFieldDisabled : ''}`} data-report-select-root="true">
      <span className={styles.reportSelectLabel}>{label}</span>
      <button type="button" className={styles.reportSelectButton} onClick={onToggle} disabled={disabled} aria-haspopup="listbox" aria-expanded={isOpen}>
        <span>{selectedOption?.label ?? 'Select option'}</span>
        <ChevronDownIcon className={styles.reportSelectChevron} />
      </button>

      {isOpen && !disabled ? (
        <DropdownOverlay className={styles.reportSelectMenu} role="listbox" aria-label={label}>
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
        </DropdownOverlay>
      ) : null}
    </div>
  );
}

function FuelSlipFilterDropdown({
  label,
  dropdownKey,
  value,
  options,
  openDropdown,
  disabled = false,
  searchable = false,
  searchValue = '',
  searchPlaceholder = 'Search options',
  noMatchesLabel = 'No options found',
  onOpenChange,
  onChange,
  onSearchChange,
}: FuelSlipFilterDropdownProps) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const isOpen = openDropdown === dropdownKey && !disabled;
  const searchQuery = searchValue.trim().toLowerCase();
  const fixedOption = searchable ? options[0] : null;
  const searchableOptions = searchable ? options.slice(1) : options;
  const visibleOptions = searchable && searchQuery
    ? searchableOptions.filter((option) => option.label.toLowerCase().includes(searchQuery))
    : searchableOptions;
  const menuOptions = searchable && fixedOption ? [fixedOption, ...visibleOptions] : visibleOptions;
  const noSearchMatches = searchable && Boolean(searchQuery) && visibleOptions.length === 0;

  return (
    <div className={styles.filterField}>
      <span>{label}</span>
      <div
        className={`${styles.customFilterSelect} ${isOpen ? styles.customFilterSelectOpen : ''} ${disabled ? styles.customFilterSelectDisabled : ''}`}
        data-fuel-slip-custom-select-root="true"
      >
        <button
          type="button"
          className={`${styles.customFilterSelectButton} ${isOpen ? styles.customFilterSelectButtonOpen : ''}`}
          onClick={() => onOpenChange(isOpen ? null : dropdownKey)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={label}
        >
          <span className={styles.customFilterSelectButtonText}>{selectedOption?.label ?? 'Choose option'}</span>
          <ChevronDownIcon className={styles.customFilterSelectChevron} />
        </button>

        {isOpen ? (
          <DropdownOverlay className={styles.customFilterSelectMenu} role="listbox" aria-label={label}>
            {searchable ? (
              <div className={styles.customFilterSearchRow}>
                <input
                  type="search"
                  className={styles.customFilterSearchInput}
                  value={searchValue}
                  onChange={(event) => onSearchChange?.(event.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  autoComplete="off"
                />
              </div>
            ) : null}

            {menuOptions.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  type="button"
                  key={`${dropdownKey}-${option.value}`}
                  className={`${styles.customFilterSelectOption} ${isSelected ? styles.customFilterSelectOptionActive : ''}`}
                  onClick={() => {
                    onChange(option.value);
                    onOpenChange(null);
                  }}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className={styles.customFilterSelectOptionLabel}>{option.label}</span>
                </button>
              );
            })}

            {noSearchMatches ? (
              <div className={`${styles.customFilterSelectOption} ${styles.customFilterSelectEmptyOption}`} role="option" aria-disabled="true">
                <span className={styles.customFilterSelectOptionLabel}>{noMatchesLabel}</span>
              </div>
            ) : null}
          </DropdownOverlay>
        ) : null}
      </div>
    </div>
  );
}

function StorageFuelTypeSelect({ value, isOpen, onToggle, onChange }: StorageFuelTypeSelectProps) {
  const selectedOption = FUEL_TYPE_OPTIONS.find((option) => option.value === value);

  return (
    <div className={`${styles.storageFuelTypeSelect} ${isOpen ? styles.storageFuelTypeSelectOpen : ''}`} data-storage-fuel-select-root="true">
      <button type="button" className={styles.storageFuelTypeButton} onClick={onToggle} aria-haspopup="listbox" aria-expanded={isOpen} aria-label="Select fuel type">
        <span>{selectedOption?.label ?? formatFuelType(value)}</span>
        <ChevronDownIcon className={styles.storageFuelTypeChevron} />
      </button>

      {isOpen ? (
        <DropdownOverlay className={styles.storageFuelTypeMenu} role="listbox" aria-label="Fuel type">
          {FUEL_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.storageFuelTypeOption} ${option.value === value ? styles.storageFuelTypeOptionActive : ''}`}
              onClick={() => onChange(option.value)}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </button>
          ))}
        </DropdownOverlay>
      ) : null}
    </div>
  );
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}


function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </IconBase>
  );
}

function ManualFuelSlipIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M7 3h7l3 3v15H7z" />
      <path d="M14 3v4h4" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
      <path d="M9 19h4" />
    </IconBase>
  );
}

function AutomaticFuelSlipIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3v10" />
      <path d="m8 9 4 4 4-4" />
      <path d="M5 18h14" />
      <path d="M4 5l1-2 1 2 2 1-2 1-1 2-1-2-2-1z" />
      <path d="M18 4l.7-1.4L19.4 4l1.4.7-1.4.7-.7 1.4-.7-1.4-1.4-.7z" />
    </IconBase>
  );
}


function formatLitres(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 3 })} L`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}%`;
}

function formatFuelType(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'adblue') return 'AdBlue';
  if (!normalized) return 'Fuel';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}


function formatCurrency(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return '—';
  return `R${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFuelSlipDate(value: string): string {
  if (!value) return 'Date not set';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function fuelSlipTargetLabel(slip: FuelSlipRecord): string {
  if (slip.targetType === 'storage_tank') return slip.storageName || 'Storage tank';
  return slip.assetTitle || 'Asset';
}

function fuelSlipStatusLabel(slip: FuelSlipRecord): string {
  if (slip.reviewRequired || slip.extractionStatus === 'needs_review') return 'Not completed';
  if (slip.extractionStatus === 'extracted') return 'Aim4price captured';
  return 'Manual';
}

function formatFuelSlipDateTime(value: string | null | undefined): string {
  if (!value) return 'Date not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function fuelSlipRecordedDate(slip: FuelSlipRecord): Date | null {
  if (slip.documentDate) {
    const rawTime = /^\d{2}:\d{2}(?::\d{2})?$/.test(slip.documentTime) ? slip.documentTime : '00:00:00';
    const time = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
    const documentDate = new Date(`${slip.documentDate.slice(0, 10)}T${time}`);

    if (!Number.isNaN(documentDate.getTime())) {
      return documentDate;
    }
  }

  if (slip.createdAtIso) {
    const createdDate = new Date(slip.createdAtIso);
    if (!Number.isNaN(createdDate.getTime())) return createdDate;
  }

  return null;
}

function fuelSlipYearKey(slip: FuelSlipRecord): string {
  const date = fuelSlipRecordedDate(slip);
  return date ? String(date.getFullYear()) : '';
}

function fuelSlipMonthKey(slip: FuelSlipRecord): string {
  const date = fuelSlipRecordedDate(slip);
  return date ? String(date.getMonth() + 1) : '';
}

function fuelSlipTargetKey(slip: FuelSlipRecord): string {
  if (slip.targetType === 'storage_tank') return slip.storageId ? `storage_tank:${slip.storageId}` : 'storage_tank';
  return slip.assetId ? `asset:${slip.assetId}` : 'asset';
}

function fuelSlipNeedsReview(slip: FuelSlipRecord): boolean {
  return Boolean(slip.reviewRequired || slip.extractionStatus === 'needs_review');
}

function fuelSlipCaptureKey(slip: FuelSlipRecord): FuelSlipCaptureFilter {
  if (fuelSlipNeedsReview(slip)) return 'needs_review';
  if (slip.extractionStatus === 'extracted') return 'automatic';
  return 'manual';
}

function fuelSlipTargetTypeLabel(slip: FuelSlipRecord): string {
  return slip.targetType === 'storage_tank' ? 'Storage tank' : 'Asset';
}

function buildFuelSlipDraftFromRecord(slip: FuelSlipRecord): FuelSlipDraft {
  const needsReview = fuelSlipNeedsReview(slip);

  return {
    ...emptyFuelSlipDraft,
    id: slip.id,
    mode: slip.extractionStatus === 'manual' ? 'manual' : 'automatic',
    targetKey: fuelSlipTargetKey(slip),
    uploadId: slip.uploadId || '',
    documentFileUrl: slip.documentFileUrl || '',
    originalFilename: slip.originalFilename || '',
    contentType: slip.contentType || '',
    byteSize: slip.byteSize,
    supplierName: slip.supplierName || '',
    supplierVatNumber: slip.supplierVatNumber || '',
    slipNumber: slip.slipNumber || '',
    transactionNumber: slip.transactionNumber || '',
    documentDate: slip.documentDate || '',
    documentTime: slip.documentTime || '',
    fuelType: slip.fuelType || '',
    litres: numberToInput(slip.litres, 3),
    pricePerLitre: numberToInput(slip.pricePerLitre, 4),
    totalAmount: numberToInput(slip.totalAmount, 2),
    vatAmount: numberToInput(slip.vatAmount, 2),
    vatIncluded: slip.vatIncluded === null ? '' : String(slip.vatIncluded),
    vatRate: numberToInput(slip.vatRate, 4),
    paymentMethod: slip.paymentMethod || '',
    cardType: slip.cardType || '',
    cardNumberMasked: slip.cardNumberMasked || '',
    cardLast4: cardLast4FromValue(slip.cardLast4 || slip.cardNumberMasked),
    merchantNumber: slip.merchantNumber || '',
    terminalNumber: slip.terminalNumber || '',
    siteNumber: slip.siteNumber || '',
    odometerReading: numberToInput(slip.odometerReading, 2),
    hourMeterReading: numberToInput(slip.hourMeterReading, 2),
    operatorName: slip.operatorName || '',
    activityText: slip.activityText || '',
    workAreaText: slip.workAreaText || '',
    note: slip.note || '',
    assetFuelPercentBefore: numberToInput(slip.assetFuelPercentBefore, 0),
    assetFuelPercentAfter: numberToInput(slip.assetFuelPercentAfter, 0),
    extractionStatus: slip.extractionStatus,
    ocrConfidence: slip.ocrConfidence,
    reviewRequired: needsReview,
    rawExtractedText: slip.rawExtractedText || '',
    extractionWarnings: getVisibleFuelSlipExtractionWarnings(slip.extractionWarnings),
  };
}

function fuelSlipSearchText(slip: FuelSlipRecord): string {
  return [
    slip.supplierName,
    slip.supplierVatNumber,
    slip.slipNumber,
    slip.transactionNumber,
    slip.fuelType,
    slip.paymentMethod,
    cardLast4FromValue(slip.cardLast4 || slip.cardNumberMasked),
    slip.assetTitle,
    slip.storageName,
    slip.operatorName,
    slip.activityText,
    slip.workAreaText,
    slip.note,
    slip.originalFilename,
    formatCurrency(slip.totalAmount),
    formatLitres(slip.litres),
  ]
    .join(' ')
    .toLowerCase();
}

function matchesFuelSlipManagerFilters(slip: FuelSlipRecord, filters: FuelSlipManagerFilterState, searchTerm: string): boolean {
  if (filters.targetKey !== 'all' && fuelSlipTargetKey(slip) !== filters.targetKey) return false;
  if (filters.capture !== 'all' && fuelSlipCaptureKey(slip) !== filters.capture) return false;
  if (filters.year !== 'all' && fuelSlipYearKey(slip) !== filters.year) return false;
  if (filters.month !== 'all' && fuelSlipMonthKey(slip) !== filters.month) return false;
  if (searchTerm && !fuelSlipSearchText(slip).includes(searchTerm)) return false;
  return true;
}

function getFuelSlipYearOptions(slips: FuelSlipRecord[]): string[] {
  const years = new Set<string>();

  for (const slip of slips) {
    const year = fuelSlipYearKey(slip);
    if (year) years.add(year);
  }

  return Array.from(years).sort((a, b) => Number(b) - Number(a));
}

function csvCell(value: unknown): string {
  const text = sanitizeFuelSlipSensitiveText(value).replace(/\r?\n/g, ' ').trim();
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function buildFuelSlipCsv(slips: FuelSlipRecord[]): string {
  const headers = [
    'Date',
    'Supplier',
    'Supplier VAT number',
    'Target type',
    'Target',
    'Slip number',
    'Transaction number',
    'Fuel type',
    'Litres',
    'Price per litre',
    'Total incl. VAT',
    'VAT amount',
    'VAT included',
    'VAT rate',
    'Payment method',
    'Card type',
    'Card last 4',
    'Merchant number',
    'Terminal number',
    'Site number',
    'Odometer reading',
    'Hour-meter reading',
    'Operator / manager',
    'Activity / reason',
    'Work area / direction',
    'Asset fuel % before',
    'Asset fuel % after',
    'Note',
    'Capture status',
    'Review required',
    'Original filename',
    'Document URL',
    'Created at',
    'Updated at',
  ];

  const rows = slips.map((slip) => [
    slip.documentDate || '',
    slip.supplierName,
    slip.supplierVatNumber,
    slip.targetType === 'storage_tank' ? 'Storage tank' : 'Asset',
    fuelSlipTargetLabel(slip),
    slip.slipNumber,
    slip.transactionNumber,
    slip.fuelType,
    csvNumber(slip.litres),
    csvNumber(slip.pricePerLitre),
    csvNumber(slip.totalAmount),
    csvNumber(slip.vatAmount),
    slip.vatIncluded === null ? '' : slip.vatIncluded ? 'Yes' : 'No',
    csvNumber(slip.vatRate),
    slip.paymentMethod,
    slip.cardType,
    cardLast4FromValue(slip.cardLast4 || slip.cardNumberMasked),
    slip.merchantNumber,
    slip.terminalNumber,
    slip.siteNumber,
    csvNumber(slip.odometerReading),
    csvNumber(slip.hourMeterReading),
    slip.operatorName,
    slip.activityText,
    slip.workAreaText,
    csvNumber(slip.assetFuelPercentBefore),
    csvNumber(slip.assetFuelPercentAfter),
    slip.note,
    fuelSlipStatusLabel(slip),
    slip.reviewRequired ? 'Yes' : 'No',
    slip.originalFilename,
    slip.documentFileUrl,
    slip.createdAtIso,
    slip.updatedAtIso,
  ]);

  return `\ufeff${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

function fuelSlipDownloadFileName(): string {
  return `fuel-slips-${new Date().toISOString().slice(0, 10)}.csv`;
}

function numberToInput(value: number | null | undefined, decimals?: number): string {
  return fuelSlipDecimalToInput(value, decimals);
}

function booleanToInput(value: boolean | null | undefined): string {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return '';
}


function numberInputToValue(value: string, decimals = 2): number | null {
  return parseFuelSlipDecimal(value, decimals);
}

function percentInputToValue(value: string): number | null {
  const parsed = parseFuelSlipDecimal(value, 0);
  if (parsed === null || !Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function safeFuelSlipCardMask(last4: string): string {
  return /^\d{4}$/.test(last4) ? `************${last4}` : '';
}

function cardLast4FromValue(value: unknown): string {
  const text = String(value ?? '').trim().slice(0, 240);
  if (!text) return '';

  const maskClass = String.raw`[*xX#•·●∙]`;
  const masked = new RegExp(String.raw`(?:\b\d{4,6}[\s-]*)?(?:${maskClass}{1,}[\s-]*){1,8}(\d{4})\b`).exec(text);
  if (masked) return masked[1];

  const firstMasked = new RegExp(String.raw`\b\d{4,6}[\s-]*(?:${maskClass}{1,}[\s-]*){1,6}(\d{4})\b`).exec(text);
  if (firstMasked) return firstMasked[1];

  if ((text.match(new RegExp(maskClass, 'g')) ?? []).length >= 2) {
    const maskedTail = new RegExp(String.raw`(?:${maskClass}\s*){2,}.{0,48}?(\d{4})\b`).exec(text);
    if (maskedTail) return maskedTail[1];
  }

  const contextTail = /(?:ending|last\s*4|last\s*four|card|kaart|pan|acc(?:ount)?)[^\d]{0,32}(\d{4})\b/i.exec(text);
  if (contextTail) return contextTail[1];

  const digits = text.replace(/\D/g, '');
  if (digits.length >= 13 && digits.length <= 19) return digits.slice(-4);
  if (/^\d{4}$/.test(digits)) return digits;

  return '';
}

function normalizeFuelSlipCard(value: unknown, fallbackLast4?: unknown): { masked: string; last4: string } {
  const fallbackDigits = String(fallbackLast4 ?? '').replace(/\D/g, '').slice(-4);
  const last4 = cardLast4FromValue(value) || (/^\d{4}$/.test(fallbackDigits) ? fallbackDigits : '');
  return { masked: safeFuelSlipCardMask(last4), last4 };
}

const FUEL_SLIP_TECHNICAL_NUMBER_LINE = /\b(?:UTI|UTL|UIL|URL|UTIL|AID|IAD|CTQ|TVR|AC|RRN|TSN|terminal\s*(?:id|number|no|nr)?|merchant\s*(?:id|number|no|nr)?|batch\s*(?:number|no|nr)?|auth(?:orisation|orization)?\s*(?:code|number|no|nr)?|trace\s*(?:number|no|nr)?)\b/i;
const FUEL_SLIP_CARD_CONTEXT = /\b(?:card|pan|account|acc|visa|master\s*card|mastercard|debit|credit|kaart|eft|ending|last\s*4|last\s*four)\b/i;

function isFuelSlipTechnicalOnlyNumberLine(line: string): boolean {
  const text = String(line ?? '').replace(/\u00a0/g, ' ').trim();
  return FUEL_SLIP_TECHNICAL_NUMBER_LINE.test(text) && !FUEL_SLIP_CARD_CONTEXT.test(text);
}

function sanitizeFuelSlipSensitiveLine(line: string): string {
  if (isFuelSlipTechnicalOnlyNumberLine(line)) return line;

  const maskClass = String.raw`[*xX#•·●∙]`;
  return line
    .replace(new RegExp(String.raw`\b\d{4,6}[\s-]*(?:${maskClass}{1,}[\s-]*){1,6}\d{4}\b`, 'g'), (match) => normalizeFuelSlipCard(match).masked || match)
    .replace(new RegExp(String.raw`\b(?:${maskClass}{1,}[\s-]*){1,8}\d{4}\b`, 'g'), (match) => normalizeFuelSlipCard(match).masked || match)
    .replace(/\b(?:\d[ \t-]?){13,19}\b/g, (match) => normalizeFuelSlipCard(match).masked || match);
}

function sanitizeFuelSlipSensitiveText(value: unknown): string {
  return String(value ?? '')
    .split(/(\r?\n)/)
    .map((part) => (/^\r?\n$/.test(part) ? part : sanitizeFuelSlipSensitiveLine(part)))
    .join('');
}

function formatCardEnding(value: unknown, fallbackLast4?: unknown): string {
  const card = normalizeFuelSlipCard(value, fallbackLast4);
  return card.last4 ? `Card ending ${card.last4}` : '';
}

function applyExtractionToFuelSlipDraft(current: FuelSlipDraft, response: FuelSlipExtractResponse): FuelSlipDraft {
  const extracted = response.extraction?.draft ?? {};
  const upload = response.upload;

  return {
    ...current,
    mode: 'automatic',
    uploadId: upload?.uploadId ?? current.uploadId,
    documentFileUrl: upload?.documentFileUrl ?? current.documentFileUrl,
    originalFilename: upload?.originalFilename ?? current.originalFilename,
    contentType: upload?.contentType ?? current.contentType,
    byteSize: typeof upload?.byteSize === 'number' ? upload.byteSize : current.byteSize,
    supplierName: extracted.supplierName ?? current.supplierName,
    supplierVatNumber: extracted.supplierVatNumber ?? current.supplierVatNumber,
    slipNumber: extracted.slipNumber ?? current.slipNumber,
    transactionNumber: extracted.transactionNumber ?? current.transactionNumber,
    documentDate: extracted.documentDate ?? current.documentDate,
    documentTime: extracted.documentTime ?? current.documentTime,
    fuelType: extracted.fuelType ?? current.fuelType,
    litres: numberToInput(extracted.litres, 3) || current.litres,
    pricePerLitre: numberToInput(extracted.pricePerLitre, 4) || current.pricePerLitre,
    totalAmount: numberToInput(extracted.totalAmount, 2) || current.totalAmount,
    vatAmount: numberToInput(extracted.vatAmount, 2) || current.vatAmount,
    vatIncluded: booleanToInput(extracted.vatIncluded) || current.vatIncluded,
    vatRate: numberToInput(extracted.vatRate, 4) || current.vatRate,
    paymentMethod: extracted.paymentMethod ?? current.paymentMethod,
    cardType: extracted.cardType ?? current.cardType,
    cardNumberMasked: normalizeFuelSlipCard(extracted.cardLast4 || extracted.cardNumberMasked || current.cardLast4 || current.cardNumberMasked, current.cardLast4).masked,
    cardLast4: normalizeFuelSlipCard(extracted.cardLast4 || extracted.cardNumberMasked || current.cardLast4 || current.cardNumberMasked, current.cardLast4).last4,
    merchantNumber: extracted.merchantNumber ?? current.merchantNumber,
    terminalNumber: extracted.terminalNumber ?? current.terminalNumber,
    siteNumber: extracted.siteNumber ?? current.siteNumber,
    extractionStatus: extracted.extractionStatus ?? 'needs_review',
    ocrConfidence: typeof extracted.ocrConfidence === 'number' ? extracted.ocrConfidence : current.ocrConfidence,
    reviewRequired: Boolean(extracted.reviewRequired ?? response.extraction?.warnings?.length),
    rawExtractedText: sanitizeFuelSlipSensitiveText(response.extraction?.rawText ?? current.rawExtractedText),
    extractionWarnings: getVisibleFuelSlipExtractionWarnings(response.extraction?.warnings ?? current.extractionWarnings),
  };
}

function buildStorageDraft(storage?: FuelLedgerStorage): StorageDraft {
  if (!storage) return emptyStorageDraft;

  return {
    name: storage.name,
    fuelType: storage.fuelType,
    capacityLitres: storage.capacityLitres === null ? '' : String(storage.capacityLitres),
    currentLitres: String(storage.currentLitres),
    reorderLevelLitres: storage.reorderLevelLitres === null ? '' : String(storage.reorderLevelLitres),
    locationLabel: storage.locationLabel,
    notes: storage.notes,
    pin: '',
  };
}

function buildApiBodyFromStorageDraft(draft: StorageDraft) {
  return {
    name: draft.name,
    fuelType: draft.fuelType,
    capacityLitres: draft.capacityLitres === '' ? null : Number(draft.capacityLitres),
    currentLitres: draft.currentLitres === '' ? null : Number(draft.currentLitres),
    reorderLevelLitres: draft.reorderLevelLitres === '' ? null : Number(draft.reorderLevelLitres),
    locationLabel: draft.locationLabel,
    notes: draft.notes,
    pin: draft.pin,
  };
}

function isLowStorage(storage: FuelLedgerStorage): boolean {
  return storage.reorderLevelLitres !== null && storage.currentLitres < storage.reorderLevelLitres;
}

function getDipstickNote(storage: FuelLedgerStorage): string {
  return storage.dipstickNote.trim();
}

function getProgressPercent(storage: FuelLedgerStorage): number {
  const rawPercent = storage.stockPercent ?? (storage.currentLitres > 0 ? 100 : 0);
  return Math.max(0, Math.min(100, rawPercent));
}

function matchesSearch(storage: FuelLedgerStorage, searchTerm: string): boolean {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  if (!normalizedSearch) return true;

  const searchableText = [
    storage.name,
    formatFuelType(storage.fuelType),
    storage.fuelType,
    storage.publicFuelStorageCode,
    storage.locationLabel,
  ]
    .join(' ')
    .toLowerCase();
  return searchableText.includes(normalizedSearch);
}

function titleCaseText(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatFuelSlipAssetUsage(asset: FuelLedgerAsset): string {
  if (asset.usageMetric === 'percentage') {
    if (typeof asset.lifeWorkedPercent !== 'number' || !Number.isFinite(asset.lifeWorkedPercent)) return '';
    return `Usage: ${asset.lifeWorkedPercent.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}%`;
  }

  if (typeof asset.hours !== 'number' || !Number.isFinite(asset.hours) || asset.hours <= 0) return '';

  const value = asset.hours.toLocaleString('en-ZA', { maximumFractionDigits: 0 });
  if (asset.usageMetric === 'km') return `Usage: ${value} km`;
  if (asset.usageMetric === 'both') return `Usage: ${value}`;
  if (asset.usageMetric === 'hours') return `Usage: ${value} hours`;
  return '';
}

function fuelSlipAssetMeta(asset: FuelLedgerAsset): string {
  return [
    typeof asset.yearModel === 'number' ? `Year Model: ${asset.yearModel}` : '',
    formatFuelSlipAssetUsage(asset),
    asset.condition ? `Condition: ${titleCaseText(asset.condition)}` : '',
  ].filter(Boolean).join(' • ');
}

function fuelSlipAssetDetail(asset: FuelLedgerAsset): string {
  return [
    asset.assetTypeLabel || 'Asset',
    asset.selectedMethod === 'manual' ? 'Manual' : 'Aim4price',
  ].filter(Boolean).join(' • ');
}

function isIncludedFuelEntryAsset(asset: FuelLedgerAsset): boolean {
  return asset.canReceiveFuel && asset.isActive !== false && !asset.workUseExcluded;
}

function fuelSlipStorageMeta(storage: FuelLedgerStorage): string {
  return [
    `Fuel type: ${formatFuelType(storage.fuelType)}`,
    `Current: ${formatLitres(storage.currentLitres)}`,
    storage.capacityLitres === null ? '' : `Capacity: ${formatLitres(storage.capacityLitres)}`,
  ].filter(Boolean).join(' • ');
}

function matchesFuelSlipAsset(asset: FuelLedgerAsset, searchTerm: string): boolean {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  if (!normalizedSearch) return true;

  return [
    asset.title,
    asset.assetTypeLabel,
    asset.brandName,
    asset.modelName,
    asset.serialNumber,
    asset.plateLabel,
    asset.publicAssetCode,
    asset.condition,
    asset.selectedMethod,
  ].join(' ').toLowerCase().includes(normalizedSearch);
}

function matchesFuelSlipStorage(storage: FuelLedgerStorage, searchTerm: string): boolean {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  if (!normalizedSearch) return true;

  return [
    storage.name,
    storage.fuelType,
    formatFuelType(storage.fuelType),
    storage.locationLabel,
    storage.publicFuelStorageCode,
  ].join(' ').toLowerCase().includes(normalizedSearch);
}

function reportDateParts(entry: { createdAtIso?: string; documentDate?: string }): { year: string; month: string } | null {
  const dateValue = entry.documentDate || entry.createdAtIso;
  const date = new Date(entry.documentDate ? `${entry.documentDate}T00:00:00` : String(dateValue ?? ''));
  if (Number.isNaN(date.getTime())) return null;

  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1).padStart(2, '0'),
  };
}


function getMonthOptions(entries: Array<{ createdAtIso?: string; documentDate?: string }>, year: string): string[] {
  const months = new Set<string>();

  for (const entry of entries) {
    const parts = reportDateParts(entry);
    if (!parts) continue;
    if (year !== 'all' && parts.year !== year) continue;
    months.add(parts.month);
  }

  return Array.from(months).sort((a, b) => Number(a) - Number(b));
}

function getYearOptions(entries: Array<{ createdAtIso?: string; documentDate?: string }>): string[] {
  const years = new Set<string>();

  for (const entry of entries) {
    const parts = reportDateParts(entry);
    if (parts) years.add(parts.year);
  }

  if (!years.size) {
    years.add(String(new Date().getFullYear()));
  }

  return Array.from(years).sort((a, b) => Number(b) - Number(a));
}


function buildReportUrl(sourceId: string, year: string, month: string, format: ReportFormat = 'pdf', accountantShareId?: string, accountantRegisterId?: string): string {
  const url = new URL('/api/fuel/report', window.location.origin);
  url.searchParams.set('format', format);
  if (accountantShareId) url.searchParams.set('accountantShareId', accountantShareId);
  if (accountantRegisterId) url.searchParams.set('accountantRegisterId', accountantRegisterId);

  if (sourceId === REPORT_SOURCE_ALL_STORAGE_UNITS) {
    url.searchParams.set('includeFuelSlips', 'false');
  } else if (sourceId && sourceId !== REPORT_SOURCE_ALL_WITH_SLIPS) {
    url.searchParams.set('storageId', sourceId);
  }

  if (year !== 'all') {
    url.searchParams.set('year', year);
  }

  if (year !== 'all' && month !== 'all') {
    url.searchParams.set('month', month);
  }

  return url.toString();
}

function withAccountantShare(url: string, accountantShareId?: string, accountantRegisterId?: string): string {
  if (!accountantShareId) return url;

  const scopedUrl = new URL(url, window.location.origin);
  scopedUrl.searchParams.set('accountantShareId', accountantShareId);
  if (accountantRegisterId) scopedUrl.searchParams.set('accountantRegisterId', accountantRegisterId);
  return `${scopedUrl.pathname}${scopedUrl.search}`;
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

function buildFuelScanUrl(storage: FuelLedgerStorage): string | null {
  const publicFuelStorageCode = String(storage.publicFuelStorageCode ?? '').trim();

  if (!publicFuelStorageCode) {
    return null;
  }

  return toAbsoluteUrl(`/fuel-scan/${encodeURIComponent(publicFuelStorageCode)}`);
}


function buildFuelQrPrintUrl(storage: FuelLedgerStorage, accountantShareId?: string, accountantRegisterId?: string): string {
  return withAccountantShare(`/api/fuel/storage/${encodeURIComponent(storage.id)}/qr?format=print`, accountantShareId, accountantRegisterId);
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

export default function FuelClient({
  addedByLabel,
  accountantShareId,
  accountantRegisterId,
  initialAssetId = '',
  initialOpenAdd = false,
  initialReturnTo = '',
}: {
  addedByLabel: string;
  accountantShareId?: string;
  accountantRegisterId?: string;
  initialAssetId?: string;
  initialOpenAdd?: boolean;
  initialReturnTo?: string;
}) {
  const isAccountantReadOnly = false;
  const scopedApiUrl = (url: string) => withAccountantShare(url, accountantShareId, accountantRegisterId);
  const [storages, setStorages] = useState<FuelLedgerStorage[]>([]);
  const [recentEvents, setRecentEvents] = useState<FuelLedgerEvent[]>([]);
  const [assets, setAssets] = useState<FuelLedgerAsset[]>([]);
  const [recentFuelSlips, setRecentFuelSlips] = useState<FuelSlipRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedLedger, setHasLoadedLedger] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [captureRequests, setCaptureRequests] = useState<CaptureRequestStatusItem[]>([]);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [deleteCandidateStorage, setDeleteCandidateStorage] = useState<FuelLedgerStorage | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [storageDraft, setStorageDraft] = useState<StorageDraft>(emptyStorageDraft);
  const [pinDraft, setPinDraft] = useState('');
  const [searchText, setSearchText] = useState('');
  const [reportStorageId, setReportStorageId] = useState(REPORT_SOURCE_ALL_WITH_SLIPS);
  const [reportYear, setReportYear] = useState('all');
  const [reportMonth, setReportMonth] = useState('all');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('pdf');
  const [reportStep, setReportStep] = useState<ReportStep>('format');
  const [openReportSelect, setOpenReportSelect] = useState<ReportSelectKey | null>(null);
  const [isStorageFuelSelectOpen, setIsStorageFuelSelectOpen] = useState(false);
  const [copiedScanLinkStorageId, setCopiedScanLinkStorageId] = useState<string | null>(null);
  const [fuelSlipDraft, setFuelSlipDraft] = useState<FuelSlipDraft>(emptyFuelSlipDraft);
  const [fuelSlipFlow, setFuelSlipFlow] = useState<FuelSlipFlowStep>(null);
  const [fuelSlipFormPage, setFuelSlipFormPage] = useState<FuelSlipFormPage>('details');
  const [fuelSlipPickerSearch, setFuelSlipPickerSearch] = useState('');
  const [fuelSlipUploadFile, setFuelSlipUploadFile] = useState<File | null>(null);
  const [isExtractingFuelSlip, setIsExtractingFuelSlip] = useState(false);
  const [fuelSlipUploadFileName, setFuelSlipUploadFileName] = useState('');
  const [fuelSlipManagerSearch, setFuelSlipManagerSearch] = useState('');
  const [fuelSlipManagerFilters, setFuelSlipManagerFilters] = useState<FuelSlipManagerFilterState>(DEFAULT_FUEL_SLIP_MANAGER_FILTERS);
  const [draftFuelSlipManagerFilters, setDraftFuelSlipManagerFilters] = useState<FuelSlipManagerFilterState>(DEFAULT_FUEL_SLIP_MANAGER_FILTERS);
  const [fuelSlipManagerFilterOpen, setFuelSlipManagerFilterOpen] = useState(false);
  const [openFuelSlipManagerFilterSelect, setOpenFuelSlipManagerFilterSelect] = useState<FuelSlipManagerFilterKey | null>(null);
  const [fuelSlipManagerTargetSearch, setFuelSlipManagerTargetSearch] = useState('');
  const [fuelSlipDownloadOpen, setFuelSlipDownloadOpen] = useState(false);
  const [draftFuelSlipDownloadFilters, setDraftFuelSlipDownloadFilters] = useState<FuelSlipManagerFilterState>(DEFAULT_FUEL_SLIP_MANAGER_FILTERS);
  const [openFuelSlipDownloadSelect, setOpenFuelSlipDownloadSelect] = useState<FuelSlipManagerFilterKey | null>(null);
  const [fuelSlipDownloadTargetSearch, setFuelSlipDownloadTargetSearch] = useState('');
  const [fuelSlipDownloadError, setFuelSlipDownloadError] = useState('');
  const [currentFuelSlipManagerPage, setCurrentFuelSlipManagerPage] = useState(1);
  const [expandedFuelSlipId, setExpandedFuelSlipId] = useState<string | null>(null);
  const [fuelSlipReturnToManager, setFuelSlipReturnToManager] = useState(false);
  const [isDownloadingFuelSlips, setIsDownloadingFuelSlips] = useState(false);
  const [deleteCandidateFuelSlip, setDeleteCandidateFuelSlip] = useState<FuelSlipRecord | null>(null);
  const [busyFuelSlipDeleteId, setBusyFuelSlipDeleteId] = useState<string | null>(null);
  const [exclusionSearch, setExclusionSearch] = useState('');
  const [selectedExclusionAssetIds, setSelectedExclusionAssetIds] = useState<string[]>([]);
  const [isExclusionEditorOpen, setIsExclusionEditorOpen] = useState(false);
  const [exclusionReason, setExclusionReason] = useState('');
  const [busyExclusionAssetId, setBusyExclusionAssetId] = useState<string | null>(null);
  const [historyFuelSlip, setHistoryFuelSlip] = useState<FuelSlipRecord | null>(null);
  const [fuelHistoryEvents, setFuelHistoryEvents] = useState<FuelLedgerAuditEvent[]>([]);
  const [isFuelHistoryLoading, setIsFuelHistoryLoading] = useState(false);
  const [fuelHistoryError, setFuelHistoryError] = useState('');
  const [fuelSlipAttemptedSubmit, setFuelSlipAttemptedSubmit] = useState(false);
  const [fuelSlipValidationNotice, setFuelSlipValidationNotice] = useState('');
  const [fuelSlipFocusField, setFuelSlipFocusField] = useState<FuelSlipMissingFieldKey | null>(null);
  const [quickLaunchAssetId, setQuickLaunchAssetId] = useState<string | null>(null);
  const initialQuickLaunchHandledRef = useRef(false);
  const fuelSlipManagerListRef = useRef<HTMLDivElement | null>(null);
  const fuelSlipManagerChildDialogRef = useRef<HTMLDivElement | null>(null);
  const fuelSlipManagerChildTriggerRef = useRef<HTMLElement | null>(null);
  const fuelSlipManagerChildOpenRef = useRef(false);
  const fuelSlipExtractionRequestRef = useRef(0);

  const selectedStorage = useMemo(
    () => storages.find((storage) => storage.id === selectedStorageId) ?? null,
    [selectedStorageId, storages],
  );

  const visibleStorages = useMemo(
    () => storages.filter((storage) => matchesSearch(storage, searchText)),
    [searchText, storages],
  );
  const includedFuelAssets = useMemo(
    () => assets.filter(isIncludedFuelEntryAsset),
    [assets],
  );

  const selectedExclusionAssets = useMemo(() => {
    const selectedIds = new Set(selectedExclusionAssetIds);
    return assets.filter((asset) => selectedIds.has(asset.id));
  }, [assets, selectedExclusionAssetIds]);
  const selectedExclusionAssetIdSet = useMemo(
    () => new Set(selectedExclusionAssetIds),
    [selectedExclusionAssetIds],
  );
  const exclusionSelectionAction = selectedExclusionAssets[0]?.workUseExcluded ? 'include' : 'exclude';
  const quickLaunchAsset = useMemo(
    () => quickLaunchAssetId ? assets.find((asset) => asset.id === quickLaunchAssetId) ?? null : null,
    [assets, quickLaunchAssetId],
  );
  const filteredExclusionAssets = useMemo(() => {
    const term = exclusionSearch.trim().toLowerCase();
    if (!term) return assets;
    return assets.filter((asset) => matchesFuelSlipAsset(asset, term));
  }, [assets, exclusionSearch]);
  const bulkSelectableExclusionAssets = useMemo(() => {
    const targetStatus = selectedExclusionAssets[0]?.workUseExcluded ?? false;
    return filteredExclusionAssets.filter((asset) => asset.workUseExcluded === targetStatus);
  }, [filteredExclusionAssets, selectedExclusionAssets]);
  const areAllBulkSelectableExclusionAssetsSelected = Boolean(bulkSelectableExclusionAssets.length)
    && bulkSelectableExclusionAssets.every((asset) => selectedExclusionAssetIdSet.has(asset.id));

  const reportDateEntries = useMemo(
    () => [...recentEvents, ...recentFuelSlips.map((slip) => ({ createdAtIso: slip.createdAtIso, documentDate: slip.documentDate }))],
    [recentEvents, recentFuelSlips],
  );
  const yearOptions = useMemo(() => getYearOptions(reportDateEntries), [reportDateEntries]);
  const reportMonthOptions = useMemo(() => getMonthOptions(reportDateEntries, reportYear), [reportDateEntries, reportYear]);
  const reportStorageOptions = useMemo<ReportSelectOption[]>(
    () => [
      { value: REPORT_SOURCE_ALL_WITH_SLIPS, label: 'All storage units + slips' },
      { value: REPORT_SOURCE_ALL_STORAGE_UNITS, label: 'All storage units' },
      ...storages.map((storage) => ({ value: storage.id, label: storage.name })),
    ],
    [storages],
  );
  const reportYearOptions = useMemo<ReportSelectOption[]>(
    () => [
      { value: 'all', label: 'All years' },
      ...yearOptions.map((year) => ({ value: year, label: year })),
    ],
    [yearOptions],
  );
  const reportMonthSelectOptions = useMemo<ReportSelectOption[]>(
    () => [
      { value: 'all', label: 'All months' },
      ...reportMonthOptions.map((month) => ({ value: month, label: MONTH_LABELS[Number(month) - 1] })),
    ],
    [reportMonthOptions],
  );

  const fuelSlipTargetOptions = useMemo<ReportSelectOption[]>(
    () => [
      ...includedFuelAssets.map((asset) => ({
        value: `asset:${asset.id}`,
        label: `${asset.title}${asset.assetTypeLabel ? ` · ${asset.assetTypeLabel}` : ''}`,
      })),
      ...storages.map((storage) => ({
        value: `storage_tank:${storage.id}`,
        label: `${storage.name} · Storage tank`,
      })),
    ],
    [includedFuelAssets, storages],
  );

  const selectedFuelSlipTarget = useMemo(() => {
    if (!fuelSlipDraft.targetKey) return null;
    const [type, id] = fuelSlipDraft.targetKey.split(':');
    if (type === 'asset') return { type: 'asset' as const, asset: assets.find((asset) => asset.id === id) ?? null, storage: null as FuelLedgerStorage | null, id };
    if (type === 'storage_tank') return { type: 'storage_tank' as const, asset: null as FuelLedgerAsset | null, storage: storages.find((storage) => storage.id === id) ?? null, id };
    return null;
  }, [assets, fuelSlipDraft.targetKey, storages]);

  const selectedFuelSlipAsset = selectedFuelSlipTarget?.type === 'asset' ? selectedFuelSlipTarget.asset : null;
  const selectedFuelSlipTargetType = selectedFuelSlipTarget?.type ?? fuelSlipTargetTypeFromKey(fuelSlipDraft.targetKey);
  const selectedFuelSlipAssetResolved = selectedFuelSlipTargetType === 'asset' ? Boolean(selectedFuelSlipAsset) : true;
  const selectedFuelSlipUsageMetric: FuelSlipValidationUsageMetric = selectedFuelSlipTargetType === 'asset'
    ? selectedFuelSlipAsset?.usageMetric ?? (selectedFuelSlipAssetResolved ? 'none' : 'both')
    : null;
  const showFuelSlipOdometer = selectedFuelSlipTargetType === 'asset' && (!selectedFuelSlipAssetResolved || selectedFuelSlipUsageMetric === 'km' || selectedFuelSlipUsageMetric === 'both');
  const showFuelSlipHours = selectedFuelSlipTargetType === 'asset' && (!selectedFuelSlipAssetResolved || selectedFuelSlipUsageMetric === 'hours' || selectedFuelSlipUsageMetric === 'both');
  const fuelSlipSearchTerm = fuelSlipPickerSearch.trim().toLowerCase();
  const filteredFuelSlipAssets = useMemo(
    () => includedFuelAssets.filter((asset) => matchesFuelSlipAsset(asset, fuelSlipSearchTerm)),
    [fuelSlipSearchTerm, includedFuelAssets],
  );
  const filteredFuelSlipStorages = useMemo(
    () => storages.filter((storage) => matchesFuelSlipStorage(storage, fuelSlipSearchTerm)),
    [storages, fuelSlipSearchTerm],
  );
  const selectedFuelSlipTargetName = selectedFuelSlipTarget?.type === 'storage_tank'
    ? selectedFuelSlipTarget.storage?.name ?? 'Selected storage tank'
    : selectedFuelSlipTarget?.asset?.title ?? 'Selected asset or storage tank';
  const fuelSlipTargetPickerTitle = 'Choose Saved Asset';
  const fuelSlipFormModeLabel = fuelSlipDraft.id
    ? 'Saved slip review'
    : fuelSlipFlow === 'review'
      ? 'Aim4price verified capture'
      : 'Manual entry';
  const fuelSlipFormSubtitle = `${selectedFuelSlipTargetName} · ${fuelSlipFormModeLabel}`;
  const fuelSlipMissingFields = useMemo(
    () => getFuelSlipMissingFields(fuelSlipDraft, selectedFuelSlipTargetType, selectedFuelSlipUsageMetric, selectedFuelSlipAssetResolved),
    [fuelSlipDraft, selectedFuelSlipAssetResolved, selectedFuelSlipTargetType, selectedFuelSlipUsageMetric],
  );
  const shouldShowFuelSlipMissingFields = Boolean(fuelSlipAttemptedSubmit || fuelSlipDraft.reviewRequired || fuelSlipDraft.extractionStatus === 'needs_review');
  const visibleFuelSlipMissingFields = useMemo(
    () => shouldShowFuelSlipMissingFields ? new Set(fuelSlipMissingFields) : new Set<FuelSlipMissingFieldKey>(),
    [fuelSlipMissingFields, shouldShowFuelSlipMissingFields],
  );
  const visibleFuelSlipExtractionWarnings = useMemo(
    () => getVisibleFuelSlipExtractionWarnings(fuelSlipDraft.extractionWarnings),
    [fuelSlipDraft.extractionWarnings],
  );
  const fuelSlipUploadReady = Boolean(fuelSlipUploadFile);
  const fuelSlipManagerSearchTerm = fuelSlipManagerSearch.trim().toLowerCase();

  const fuelSlipManagerTargetOptions = useMemo<ReportSelectOption[]>(
    () => [
      { value: 'all', label: 'All saved assets and storage tanks' },
      ...assets.map((asset) => ({ value: `asset:${asset.id}`, label: asset.title || 'Saved asset' })),
      ...storages.map((storage) => ({ value: `storage_tank:${storage.id}`, label: `${storage.name} · Storage tank` })),
    ],
    [assets, storages],
  );

  const fuelSlipManagerYearOptions = useMemo<ReportSelectOption[]>(
    () => [
      { value: 'all', label: 'All fuel slip years' },
      ...getFuelSlipYearOptions(recentFuelSlips).map((year) => ({ value: year, label: year })),
    ],
    [recentFuelSlips],
  );

  const fuelSlipManagerMonthOptions = useMemo<ReportSelectOption[]>(
    () => [
      { value: 'all', label: 'All fuel slip months' },
      ...MONTH_LABELS.map((month, index) => ({ value: String(index + 1), label: month })),
    ],
    [],
  );

  const visibleFuelSlipManagerSlips = useMemo(
    () => recentFuelSlips.filter((slip) => matchesFuelSlipManagerFilters(slip, fuelSlipManagerFilters, fuelSlipManagerSearchTerm)),
    [fuelSlipManagerFilters, fuelSlipManagerSearchTerm, recentFuelSlips],
  );

  const totalFuelSlipManagerPages = useMemo(
    () => Math.max(1, Math.ceil(visibleFuelSlipManagerSlips.length / FUEL_SLIP_MANAGER_PAGE_SIZE)),
    [visibleFuelSlipManagerSlips.length],
  );
  const safeFuelSlipManagerPage = Math.min(currentFuelSlipManagerPage, totalFuelSlipManagerPages);
  const paginatedFuelSlipManagerSlips = useMemo(() => {
    const startIndex = (safeFuelSlipManagerPage - 1) * FUEL_SLIP_MANAGER_PAGE_SIZE;
    return visibleFuelSlipManagerSlips.slice(startIndex, startIndex + FUEL_SLIP_MANAGER_PAGE_SIZE);
  }, [safeFuelSlipManagerPage, visibleFuelSlipManagerSlips]);
  const shouldShowFuelSlipManagerPagination = visibleFuelSlipManagerSlips.length > FUEL_SLIP_MANAGER_PAGE_SIZE;
  const fuelSlipManagerResultStart = visibleFuelSlipManagerSlips.length
    ? ((safeFuelSlipManagerPage - 1) * FUEL_SLIP_MANAGER_PAGE_SIZE) + 1
    : 0;
  const fuelSlipManagerResultEnd = Math.min(
    safeFuelSlipManagerPage * FUEL_SLIP_MANAGER_PAGE_SIZE,
    visibleFuelSlipManagerSlips.length,
  );
  const fuelSlipManagerFilteredTotals = useMemo(() => visibleFuelSlipManagerSlips.reduce(
    (totals, slip) => ({
      litres: totals.litres + (slip.litres ?? 0),
      amount: totals.amount + (slip.totalAmount ?? 0),
    }),
    { litres: 0, amount: 0 },
  ), [visibleFuelSlipManagerSlips]);
  const fuelSlipManagerIncompleteTotalCount = useMemo(
    () => visibleFuelSlipManagerSlips.filter((slip) => slip.litres === null || slip.totalAmount === null).length,
    [visibleFuelSlipManagerSlips],
  );
  const activeFuelSlipManagerFilterCount = useMemo(() => [
    fuelSlipManagerFilters.targetKey !== 'all',
    fuelSlipManagerFilters.capture !== 'all',
    fuelSlipManagerFilters.year !== 'all',
    fuelSlipManagerFilters.month !== 'all',
  ].filter(Boolean).length, [fuelSlipManagerFilters]);
  const activeFuelSlipManagerFilterChips = useMemo(() => {
    const chips: Array<{ id: FuelSlipManagerFilterKey; label: string }> = [];

    if (fuelSlipManagerFilters.targetKey !== 'all') {
      const target = fuelSlipManagerTargetOptions.find((option) => option.value === fuelSlipManagerFilters.targetKey);
      chips.push({ id: 'target', label: `Target: ${target?.label ?? 'Selected target'}` });
    }
    if (fuelSlipManagerFilters.capture !== 'all') {
      const capture = FUEL_SLIP_CAPTURE_FILTER_OPTIONS.find((option) => option.value === fuelSlipManagerFilters.capture);
      chips.push({ id: 'capture', label: `Source / status: ${capture?.label ?? 'Selected source'}` });
    }
    if (fuelSlipManagerFilters.year !== 'all') {
      chips.push({ id: 'year', label: `Year: ${fuelSlipManagerFilters.year}` });
    }
    if (fuelSlipManagerFilters.month !== 'all') {
      const month = fuelSlipManagerMonthOptions.find((option) => option.value === fuelSlipManagerFilters.month);
      chips.push({ id: 'month', label: `Month: ${month?.label ?? fuelSlipManagerFilters.month}` });
    }

    return chips;
  }, [fuelSlipManagerFilters, fuelSlipManagerMonthOptions, fuelSlipManagerTargetOptions]);
  const activeFuelSlipManagerRefinementCount = activeFuelSlipManagerFilterCount + (fuelSlipManagerSearch.trim() ? 1 : 0);
  const isFuelSlipManagerChildDialogOpen = fuelSlipManagerFilterOpen
    || fuelSlipDownloadOpen
    || Boolean(historyFuelSlip)
    || Boolean(deleteCandidateFuelSlip);


  async function loadLedger(options: { silent?: boolean; discardAssetsOnError?: boolean } = {}) {
    if (!options.silent) {
      setIsLoading(true);
    }

    try {
      const ledgerUrl = accountantShareId
        ? `/api/accountant/registers/${encodeURIComponent(accountantShareId)}/ledger?kind=fuel${accountantRegisterId ? `&registerId=${encodeURIComponent(accountantRegisterId)}` : ''}`
        : '/api/fuel';
      const response = await fetch(ledgerUrl, { credentials: 'include', cache: 'no-store' });
      const payload = (await response.json()) as AccountantFuelLedgerResponse;
      const data = payload.fuel ?? payload;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to load Fuel Ledger.');
      }

      setStorages(data.storages ?? []);
      setRecentEvents(data.recentEvents ?? []);
      setAssets(data.assets ?? []);
      setRecentFuelSlips(data.recentFuelSlips ?? []);
      setHasLoadedLedger(true);
    } catch (error) {
      setHasLoadedLedger(false);
      if (options.discardAssetsOnError) setAssets([]);
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load Fuel Ledger.' });
    } finally {
      if (!options.silent) {
        setIsLoading(false);
      }
    }
  }

  async function loadCaptureRequests() {
    try {
      const response = await fetch(scopedApiUrl('/api/capture-requests?requestType=fuel_slip&active=1'), {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await response.json()) as FuelCaptureRequestResponse;
      if (response.ok && data.ok) setCaptureRequests(data.requests ?? []);
    } catch {
      // The Fuel Ledger remains available if capture status cannot load.
    }
  }

  async function retractCaptureRequest(requestId: string): Promise<void> {
    const response = await fetch(`/api/capture-requests/${encodeURIComponent(requestId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = (await response.json().catch(() => null)) as FuelCaptureRequestResponse | null;
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || 'This submission could not be retracted. Please try again.');
    }

    setCaptureRequests((current) => current.filter((request) => request.id !== requestId));
    setNotice({
      tone: 'success',
      message: data.message || 'Submission retracted. It was removed from assisted capture.',
    });
  }

  useEffect(() => {
    void loadLedger();
    void loadCaptureRequests();
  }, [accountantRegisterId, accountantShareId]);

  useEffect(() => {
    if (!initialOpenAdd || initialQuickLaunchHandledRef.current || isLoading || !hasLoadedLedger) return;

    initialQuickLaunchHandledRef.current = true;
    const requestedAssetId = initialAssetId.trim();

    if (!requestedAssetId) {
      setNotice({ tone: 'error', message: 'The Add fuel link does not identify an asset. Open Manage on the asset and try again.' });
      return;
    }

    const requestedAsset = assets.find((asset) => asset.id === requestedAssetId);
    if (!requestedAsset) {
      setNotice({ tone: 'error', message: 'The selected asset is no longer available in the Fuel Ledger.' });
      return;
    }

    if (!requestedAsset.canReceiveFuel) {
      setNotice({ tone: 'error', message: `${requestedAsset.title} is not configured to receive fuel.` });
      return;
    }

    if (requestedAsset.workUseExcluded) {
      setNotice({ tone: 'error', message: `${requestedAsset.title} is excluded from work-use fuel. Include it again under Fuel Ledger exclusions before adding a fuel slip.` });
      return;
    }

    resetFuelSlipValidationState();
    setQuickLaunchAssetId(requestedAsset.id);
    setFuelSlipDraft({ ...emptyFuelSlipDraft, targetKey: `asset:${requestedAsset.id}` });
    setFuelSlipFlow('source-choice');
    setFuelSlipFormPage('details');
    setFuelSlipPickerSearch('');
    setFuelSlipUploadFile(null);
    setFuelSlipUploadFileName('');
    setIsStorageFuelSelectOpen(false);
    setNotice(null);
    setModalMode('fuel-slip');
  }, [assets, hasLoadedLedger, initialAssetId, initialOpenAdd, isLoading]);

  useEffect(() => {
    if (!openReportSelect) return undefined;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-report-select-root="true"]')) {
        setOpenReportSelect(null);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openReportSelect]);

  useEffect(() => {
    if (!isStorageFuelSelectOpen) return undefined;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-storage-fuel-select-root="true"]')) {
        setIsStorageFuelSelectOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isStorageFuelSelectOpen]);

  useEffect(() => {
    setCurrentFuelSlipManagerPage(1);
    setExpandedFuelSlipId(null);
  }, [fuelSlipManagerFilters, fuelSlipManagerSearch]);

  useEffect(() => {
    setCurrentFuelSlipManagerPage((page) => Math.min(page, totalFuelSlipManagerPages));
  }, [totalFuelSlipManagerPages]);

  useEffect(() => {
    if (modalMode !== 'fuel-slip-manager') return;
    if (fuelSlipManagerListRef.current) fuelSlipManagerListRef.current.scrollTop = 0;
  }, [fuelSlipManagerFilters, fuelSlipManagerSearch, modalMode, safeFuelSlipManagerPage]);

  useEffect(() => {
    const wasOpen = fuelSlipManagerChildOpenRef.current;
    fuelSlipManagerChildOpenRef.current = isFuelSlipManagerChildDialogOpen;

    if (!wasOpen && isFuelSlipManagerChildDialogOpen) {
      const frame = window.requestAnimationFrame(() => {
        const dialog = fuelSlipManagerChildDialogRef.current;
        const firstControl = dialog?.querySelector<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
        );
        firstControl?.focus({ preventScroll: true });
      });
      return () => window.cancelAnimationFrame(frame);
    }

    if (wasOpen && !isFuelSlipManagerChildDialogOpen) {
      const trigger = fuelSlipManagerChildTriggerRef.current;
      fuelSlipManagerChildTriggerRef.current = null;
      const frame = window.requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      });
      return () => window.cancelAnimationFrame(frame);
    }

    return undefined;
  }, [isFuelSlipManagerChildDialogOpen]);

  useEffect(() => {
    if (modalMode !== 'fuel-slip-manager') return undefined;

    function handleFuelSlipManagerKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (openFuelSlipManagerFilterSelect) {
          event.preventDefault();
          setOpenFuelSlipManagerFilterSelect(null);
          return;
        }
        if (openFuelSlipDownloadSelect) {
          event.preventDefault();
          setOpenFuelSlipDownloadSelect(null);
          return;
        }
        if (deleteCandidateFuelSlip) {
          event.preventDefault();
          if (!busyFuelSlipDeleteId) setDeleteCandidateFuelSlip(null);
          return;
        }
        if (historyFuelSlip) {
          event.preventDefault();
          closeFuelSlipHistory();
          return;
        }
        if (fuelSlipDownloadOpen) {
          event.preventDefault();
          closeFuelSlipDownloadPanel();
          return;
        }
        if (fuelSlipManagerFilterOpen) {
          event.preventDefault();
          closeFuelSlipManagerFilterPanel();
          return;
        }
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== 'Tab' || !isFuelSlipManagerChildDialogOpen) return;
      const dialog = fuelSlipManagerChildDialogRef.current;
      if (!dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      )).filter((control) => control.offsetParent !== null);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleFuelSlipManagerKeyDown);
    return () => document.removeEventListener('keydown', handleFuelSlipManagerKeyDown);
  }, [
    busyFuelSlipDeleteId,
    deleteCandidateFuelSlip,
    fuelSlipDownloadOpen,
    fuelSlipManagerFilterOpen,
    historyFuelSlip,
    isFuelSlipManagerChildDialogOpen,
    modalMode,
    openFuelSlipDownloadSelect,
    openFuelSlipManagerFilterSelect,
  ]);

  useEffect(() => {
    const availableYears = new Set(fuelSlipManagerYearOptions.map((option) => option.value));
    const normalizeYear = (filters: FuelSlipManagerFilterState) => (
      availableYears.has(filters.year) ? filters : { ...filters, year: 'all' }
    );
    setFuelSlipManagerFilters(normalizeYear);
    setDraftFuelSlipManagerFilters(normalizeYear);
    setDraftFuelSlipDownloadFilters(normalizeYear);
  }, [fuelSlipManagerYearOptions]);

  useEffect(() => {
    const managerDropdownOpen = fuelSlipManagerFilterOpen && Boolean(openFuelSlipManagerFilterSelect);
    const downloadDropdownOpen = fuelSlipDownloadOpen && Boolean(openFuelSlipDownloadSelect);

    if (!managerDropdownOpen && !downloadDropdownOpen) return undefined;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-fuel-slip-custom-select-root="true"]')) {
        setOpenFuelSlipManagerFilterSelect(null);
        setOpenFuelSlipDownloadSelect(null);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [fuelSlipDownloadOpen, fuelSlipManagerFilterOpen, openFuelSlipDownloadSelect, openFuelSlipManagerFilterSelect]);

  useEffect(() => {
    if (!fuelSlipFocusField) return undefined;

    const timer = window.setTimeout(() => {
      const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-fuel-slip-field="${fuelSlipFocusField}"]`);
      if (element) {
        element.focus({ preventScroll: false });
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      setFuelSlipFocusField(null);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fuelSlipFocusField, fuelSlipFormPage]);

  useEffect(() => {
    if (fuelSlipValidationNotice && fuelSlipMissingFields.length === 0) {
      setFuelSlipValidationNotice('');
    }
  }, [fuelSlipMissingFields.length, fuelSlipValidationNotice]);

  function openCreateStorage() {
    setSelectedStorageId(null);
    setStorageDraft(emptyStorageDraft);
    setIsStorageFuelSelectOpen(false);
    setNotice(null);
    setModalMode('create-storage');
  }

  function openManageStorageChoice(storage: FuelLedgerStorage) {
    setSelectedStorageId(storage.id);
    setIsStorageFuelSelectOpen(false);
    setNotice(null);
    setModalMode('manage-storage-choice');
  }

  function openEditStorage(storage: FuelLedgerStorage) {
    setSelectedStorageId(storage.id);
    setStorageDraft(buildStorageDraft(storage));
    setIsStorageFuelSelectOpen(false);
    setNotice(null);
    setModalMode('edit-storage');
  }

  function openMissingFuelEntry(storage: FuelLedgerStorage) {
    setSelectedStorageId(storage.id);
    setNotice(null);
    setModalMode('missing-entry');
  }

  function openReconcileBalance(storage: FuelLedgerStorage) {
    setSelectedStorageId(storage.id);
    setNotice(null);
    setModalMode('reconcile-balance');
  }

  function openPin(storage: FuelLedgerStorage) {
    setSelectedStorageId(storage.id);
    setPinDraft('');
    setIsStorageFuelSelectOpen(false);
    setNotice(null);
    setModalMode('pin');
  }

  function openQrModal(storage: FuelLedgerStorage) {
    setSelectedStorageId(storage.id);
    setCopiedScanLinkStorageId(null);
    setIsStorageFuelSelectOpen(false);
    setNotice(null);
    setModalMode('qr');
  }

  function openFuelSlipMenu() {
    if (isAccountantReadOnly) {
      openFuelSlipManager();
      return;
    }

    resetFuelSlipValidationState();
    setFuelSlipFlow(null);
    setFuelSlipFormPage('details');
    setFuelSlipPickerSearch('');
    setFuelSlipUploadFile(null);
    setFuelSlipUploadFileName('');
    setFuelSlipManagerFilterOpen(false);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerTargetSearch('');
    setFuelSlipDownloadOpen(false);
    setOpenFuelSlipDownloadSelect(null);
    setFuelSlipDownloadTargetSearch('');
    setFuelSlipDownloadError('');
    setIsStorageFuelSelectOpen(false);
    setQuickLaunchAssetId(null);
    setNotice(null);
    setModalMode('fuel-slip-menu');
  }

  function rememberFuelSlipManagerChildTrigger() {
    const activeElement = document.activeElement;
    fuelSlipManagerChildTriggerRef.current = activeElement instanceof HTMLElement ? activeElement : null;
  }

  function openFuelSlipModal(returnToManager = false) {
    resetFuelSlipValidationState();
    setFuelSlipReturnToManager(returnToManager);
    setFuelSlipDraft(emptyFuelSlipDraft);
    setFuelSlipFlow('source-choice');
    setFuelSlipFormPage('details');
    setFuelSlipPickerSearch('');
    setFuelSlipUploadFile(null);
    setFuelSlipUploadFileName('');
    setFuelSlipManagerFilterOpen(false);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerTargetSearch('');
    setFuelSlipDownloadOpen(false);
    setOpenFuelSlipDownloadSelect(null);
    setFuelSlipDownloadTargetSearch('');
    setFuelSlipDownloadError('');
    setIsStorageFuelSelectOpen(false);
    setQuickLaunchAssetId(null);
    setNotice(null);
    setModalMode('fuel-slip');
    void loadLedger({ discardAssetsOnError: true });
  }

  function openFuelSlipManager() {
    resetFuelSlipValidationState();
    setFuelSlipReturnToManager(false);
    setDraftFuelSlipManagerFilters(fuelSlipManagerFilters);
    setFuelSlipManagerFilterOpen(false);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerTargetSearch('');
    setFuelSlipDownloadOpen(false);
    setOpenFuelSlipDownloadSelect(null);
    setFuelSlipDownloadTargetSearch('');
    setFuelSlipDownloadError('');
    setDeleteCandidateFuelSlip(null);
    setExpandedFuelSlipId(null);
    setFuelSlipFlow(null);
    setFuelSlipFormPage('details');
    setIsStorageFuelSelectOpen(false);
    setQuickLaunchAssetId(null);
    setNotice(null);
    setModalMode('fuel-slip-manager');
  }

  function openFuelSlipReview(slip: FuelSlipRecord) {
    resetFuelSlipValidationState();
    setFuelSlipReturnToManager(true);
    setFuelSlipDraft(buildFuelSlipDraftFromRecord(slip));
    setFuelSlipFlow('review');
    setFuelSlipFormPage('details');
    setFuelSlipPickerSearch('');
    setFuelSlipUploadFile(null);
    setFuelSlipUploadFileName('');
    setFuelSlipManagerFilterOpen(false);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerTargetSearch('');
    setFuelSlipDownloadOpen(false);
    setOpenFuelSlipDownloadSelect(null);
    setFuelSlipDownloadTargetSearch('');
    setFuelSlipDownloadError('');
    setDeleteCandidateFuelSlip(null);
    setIsStorageFuelSelectOpen(false);
    setQuickLaunchAssetId(null);
    setNotice(null);
    setModalMode('fuel-slip');
  }

  function openFuelSlipDeleteConfirm(slip: FuelSlipRecord) {
    rememberFuelSlipManagerChildTrigger();
    setFuelSlipManagerFilterOpen(false);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerTargetSearch('');
    setFuelSlipDownloadOpen(false);
    setOpenFuelSlipDownloadSelect(null);
    setFuelSlipDownloadTargetSearch('');
    setFuelSlipDownloadError('');
    setDeleteCandidateFuelSlip(slip);
    setNotice(null);
  }

  async function openFuelSlipHistory(slip: FuelSlipRecord) {
    rememberFuelSlipManagerChildTrigger();
    setHistoryFuelSlip(slip);
    setFuelHistoryEvents([]);
    setFuelHistoryError('');
    setIsFuelHistoryLoading(true);
    try {
      const response = await fetch(scopedApiUrl(`/api/fuel/audit?recordType=fuel_slip&recordId=${encodeURIComponent(slip.id)}`), {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await response.json()) as { ok: boolean; events?: FuelLedgerAuditEvent[]; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Change history could not be loaded.');
      setFuelHistoryEvents(data.events ?? []);
    } catch (error) {
      setFuelHistoryError(error instanceof Error ? error.message : 'Change history could not be loaded.');
    } finally {
      setIsFuelHistoryLoading(false);
    }
  }

  function closeFuelSlipHistory() {
    setHistoryFuelSlip(null);
    setFuelHistoryEvents([]);
    setFuelHistoryError('');
    setIsFuelHistoryLoading(false);
  }

  function openReportModal() {
    setReportYear('all');
    setReportMonth('all');
    setReportStorageId(REPORT_SOURCE_ALL_WITH_SLIPS);
    setReportFormat('pdf');
    setReportStep('format');
    setOpenReportSelect(null);
    setIsStorageFuelSelectOpen(false);
    setNotice(null);
    setModalMode('report');
  }

  function openExclusionsModal() {
    setExclusionSearch('');
    setSelectedExclusionAssetIds([]);
    setIsExclusionEditorOpen(false);
    setExclusionReason('');
    setNotice(null);
    setModalMode('exclusions');
  }

  function toggleExclusionAsset(asset: FuelLedgerAsset) {
    const alreadySelected = selectedExclusionAssetIdSet.has(asset.id);
    const currentStatus = selectedExclusionAssets[0]?.workUseExcluded;
    if (!alreadySelected && typeof currentStatus === 'boolean' && currentStatus !== asset.workUseExcluded) {
      setNotice({
        tone: 'error',
        message: `Clear the current selection before choosing assets to ${asset.workUseExcluded ? 'include again' : 'exclude'}.`,
      });
      return;
    }

    setSelectedExclusionAssetIds((currentIds) => {
      if (currentIds.includes(asset.id)) return currentIds.filter((assetId) => assetId !== asset.id);
      return [...currentIds, asset.id];
    });
    setIsExclusionEditorOpen(false);
    setExclusionReason('');
    setNotice(null);
  }

  function toggleAllVisibleExclusionAssets() {
    const selectableAssetIds = bulkSelectableExclusionAssets.map((asset) => asset.id);
    if (!selectableAssetIds.length) return;

    const selectableAssetIdSet = new Set(selectableAssetIds);
    setSelectedExclusionAssetIds((currentIds) => {
      const currentIdSet = new Set(currentIds);
      const allSelected = selectableAssetIds.every((assetId) => currentIdSet.has(assetId));
      if (allSelected) return currentIds.filter((assetId) => !selectableAssetIdSet.has(assetId));
      return [...currentIds, ...selectableAssetIds.filter((assetId) => !currentIdSet.has(assetId))];
    });
    setIsExclusionEditorOpen(false);
    setExclusionReason('');
    setNotice(null);
  }

  function openExclusionEditor() {
    if (!selectedExclusionAssets.length) return;
    setExclusionReason('');
    setNotice(null);
    setIsExclusionEditorOpen(true);
  }

  async function updateSelectedAssetWorkUseExclusions() {
    if (busyExclusionAssetId || !selectedExclusionAssets.length) return;
    const excluded = exclusionSelectionAction === 'exclude';
    if (excluded && exclusionReason.trim().length < 2) {
      setNotice({ tone: 'error', message: 'Add a short reason, for example “Generator serving normal houses”.' });
      return;
    }

    setNotice(null);
    const savedAssetIds = new Set<string>();
    try {
      for (const asset of selectedExclusionAssets) {
        setBusyExclusionAssetId(asset.id);
        const response = await fetch(scopedApiUrl(`/api/fuel/exclusions/${encodeURIComponent(asset.id)}`), {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ excluded, reason: excluded ? exclusionReason.trim() : '' }),
        });
        await applyLedgerResponse(response);
        savedAssetIds.add(asset.id);
      }

      const assetLabel = selectedExclusionAssets.length === 1 ? 'asset' : 'assets';
      setNotice({
        tone: 'success',
        message: `${selectedExclusionAssets.length} ${assetLabel} ${excluded ? 'excluded from' : 'included in'} work-use totals.`,
      });
      setSelectedExclusionAssetIds([]);
      setIsExclusionEditorOpen(false);
      setExclusionReason('');
    } catch (error) {
      setSelectedExclusionAssetIds((currentIds) => currentIds.filter((assetId) => !savedAssetIds.has(assetId)));
      setIsExclusionEditorOpen(false);
      const savedPrefix = savedAssetIds.size ? `${savedAssetIds.size} saved. ` : '';
      setNotice({ tone: 'error', message: `${savedPrefix}${error instanceof Error ? error.message : 'The exclusions could not be updated.'}` });
    } finally {
      setBusyExclusionAssetId(null);
    }
  }

  function returnFromQuickLaunch(): boolean {
    if (!quickLaunchAssetId || !initialReturnTo || typeof window === 'undefined') return false;

    try {
      const target = new URL(initialReturnTo, window.location.origin);
      if (target.origin !== window.location.origin) return false;
      window.location.assign(`${target.pathname}${target.search}${target.hash}`);
      return true;
    } catch {
      return false;
    }
  }

  function closeModal() {
    if (isSaving || busyExclusionAssetId) return;
    fuelSlipExtractionRequestRef.current += 1;
    const shouldReturnToAsset = Boolean(quickLaunchAssetId && initialReturnTo);
    setModalMode(null);
    setSelectedStorageId(null);
    setStorageDraft(emptyStorageDraft);
    setPinDraft('');
    setReportStep('format');
    setReportFormat('pdf');
    setOpenReportSelect(null);
    setIsStorageFuelSelectOpen(false);
    setCopiedScanLinkStorageId(null);
    setFuelSlipDraft(emptyFuelSlipDraft);
    setFuelSlipFlow(null);
    setFuelSlipFormPage('details');
    setFuelSlipPickerSearch('');
    setFuelSlipUploadFile(null);
    setFuelSlipUploadFileName('');
    setIsExtractingFuelSlip(false);
    setFuelSlipManagerFilterOpen(false);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerTargetSearch('');
    setFuelSlipDownloadOpen(false);
    setOpenFuelSlipDownloadSelect(null);
    setFuelSlipDownloadTargetSearch('');
    setFuelSlipDownloadError('');
    setDeleteCandidateFuelSlip(null);
    setBusyFuelSlipDeleteId(null);
    setIsDownloadingFuelSlips(false);
    setFuelSlipAttemptedSubmit(false);
    setFuelSlipValidationNotice('');
    setFuelSlipFocusField(null);
    setFuelSlipReturnToManager(false);
    setExclusionSearch('');
    setSelectedExclusionAssetIds([]);
    setIsExclusionEditorOpen(false);
    setExclusionReason('');
    setQuickLaunchAssetId(null);
    closeFuelSlipHistory();
    if (shouldReturnToAsset) returnFromQuickLaunch();
  }

  function closeFuelSlipFlow(options: { force?: boolean } = {}) {
    if ((isSaving || isExtractingFuelSlip) && !options.force) return;
    if (!fuelSlipReturnToManager) {
      closeModal();
      return;
    }

    fuelSlipExtractionRequestRef.current += 1;
    resetFuelSlipValidationState();
    setFuelSlipDraft(emptyFuelSlipDraft);
    setFuelSlipFlow(null);
    setFuelSlipFormPage('details');
    setFuelSlipPickerSearch('');
    setFuelSlipUploadFile(null);
    setFuelSlipUploadFileName('');
    setFuelSlipManagerFilterOpen(false);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipDownloadOpen(false);
    setOpenFuelSlipDownloadSelect(null);
    setFuelSlipDownloadTargetSearch('');
    setFuelSlipDownloadError('');
    setQuickLaunchAssetId(null);
    setFuelSlipReturnToManager(false);
    setModalMode('fuel-slip-manager');
  }

  function resetFuelSlipValidationState() {
    setFuelSlipAttemptedSubmit(false);
    setFuelSlipValidationNotice('');
    setFuelSlipFocusField(null);
  }

  function clearSearch() {
    setSearchText('');
  }

  function applyLedgerData(data: FuelLedgerResponse | MissingFuelLedgerPayload) {
    if (data.storages) setStorages(data.storages as FuelLedgerStorage[]);
    if (data.recentEvents) setRecentEvents(data.recentEvents as FuelLedgerEvent[]);
    if (data.assets) setAssets(data.assets as FuelLedgerAsset[]);
    if (data.recentFuelSlips) setRecentFuelSlips(data.recentFuelSlips as FuelSlipRecord[]);
  }

  async function applyLedgerResponse(response: Response): Promise<FuelLedgerResponse> {
    const data = (await response.json()) as FuelLedgerResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Fuel Ledger action failed.');
    }

    applyLedgerData(data);
    return data;
  }

  async function handleStorageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);

    try {
      const isEdit = modalMode === 'edit-storage' && selectedStorage;
      const response = await fetch(scopedApiUrl(isEdit ? `/api/fuel/storage/${selectedStorage.id}` : '/api/fuel'), {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildApiBodyFromStorageDraft(storageDraft)),
      });

      await applyLedgerResponse(response);
      setNotice({ tone: 'success', message: isEdit ? 'Fuel storage updated.' : 'Fuel storage created. Print the QR label before using it.' });
      closeModal();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save fuel storage.' });
    } finally {
      setIsSaving(false);
    }
  }


  function setFuelSlipField<K extends keyof FuelSlipDraft>(field: K, value: FuelSlipDraft[K]) {
    setFuelSlipDraft((current) => ({ ...current, [field]: value }));
  }

  function setFuelSlipNumericField(field: 'litres' | 'pricePerLitre' | 'totalAmount', value: string) {
    setFuelSlipDraft((current) => ({ ...current, [field]: value }));
  }

  function handleFuelSlipCardLast4Change(value: string) {
    const digits = value.replace(/\D/g, '');
    const last4 = digits.length > 4 ? digits.slice(-4) : digits.slice(0, 4);
    const masked = safeFuelSlipCardMask(last4);
    setFuelSlipDraft((current) => ({
      ...current,
      cardNumberMasked: masked,
      cardLast4: last4,
    }));
  }

  function startFuelSlipFlow(mode: 'manual' | 'automatic') {
    resetFuelSlipValidationState();
    const lockedTargetKey = quickLaunchAssetId ? `asset:${quickLaunchAssetId}` : '';
    setFuelSlipDraft({
      ...emptyFuelSlipDraft,
      mode,
      targetKey: lockedTargetKey,
      extractionStatus: mode === 'manual' ? 'manual' : 'needs_review',
      reviewRequired: mode === 'automatic',
    });
    setFuelSlipPickerSearch('');
    setFuelSlipUploadFile(null);
    setFuelSlipUploadFileName('');
    setFuelSlipFormPage('details');
    setFuelSlipFlow(quickLaunchAssetId
      ? mode === 'manual' ? 'manual-form' : 'upload'
      : mode === 'manual' ? 'target-manual' : 'target-automatic');
  }

  function handleFuelSlipTargetChange(value: string) {
    resetFuelSlipValidationState();
    setFuelSlipDraft((current) => current.targetKey === value ? current : ({
      ...current,
      targetKey: value,
      odometerReading: '',
      hourMeterReading: '',
      operatorName: '',
      activityText: '',
      workAreaText: '',
      note: '',
      assetFuelPercentBefore: '',
      assetFuelPercentAfter: '',
    }));
  }

  function selectFuelSlipTarget(value: string) {
    handleFuelSlipTargetChange(value);
    setFuelSlipPickerSearch('');
    setFuelSlipFormPage('details');
    setFuelSlipFlow(fuelSlipFlow === 'target-manual' ? 'manual-form' : 'upload');
  }

  function handleFuelSlipUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    resetFuelSlipValidationState();
    setFuelSlipUploadFile(file);
    setFuelSlipUploadFileName(file?.name ?? '');
    setFuelSlipDraft((current) => ({
      ...current,
      mode: 'automatic',
      uploadId: '',
      documentFileUrl: '',
      originalFilename: '',
      contentType: '',
      byteSize: null,
      rawExtractedText: '',
      extractionWarnings: [],
      extractionStatus: 'needs_review',
      reviewRequired: true,
    }));
    event.target.value = '';
  }

  async function handleFuelSlipExtract() {
    if (isExtractingFuelSlip) return;

    if (!fuelSlipUploadFile) {
      setNotice({ tone: 'error', message: 'Choose a fuel slip photo or PDF first.' });
      return;
    }

    const [targetType, targetId] = fuelSlipDraft.targetKey.split(':');
    if ((targetType !== 'asset' && targetType !== 'storage_tank') || !targetId) {
      setNotice({ tone: 'error', message: 'Choose an asset or storage tank first.' });
      return;
    }

    const extractionRequest = fuelSlipExtractionRequestRef.current + 1;
    fuelSlipExtractionRequestRef.current = extractionRequest;
    setIsExtractingFuelSlip(true);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.append('file', fuelSlipUploadFile);
      formData.append('targetType', targetType);
      formData.append('targetId', targetId);

      const response = await fetch(scopedApiUrl('/api/capture-requests/fuel-slip'), {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = (await response.json()) as FuelCaptureRequestResponse;

      if (fuelSlipExtractionRequestRef.current !== extractionRequest) return;

      if (!response.ok || !data.ok || !data.request) {
        throw new Error(data.error || 'The fuel slip could not be sent for Aim4price capture.');
      }

      setCaptureRequests((current) => [data.request!, ...current.filter((request) => request.id !== data.request!.id)]);
      closeFuelSlipFlow({ force: true });
      setNotice({
        tone: 'success',
        message: `${data.request.referenceCode} received. Aim4price will capture and verify it within 24 hours.`,
      });
    } catch (error) {
      if (fuelSlipExtractionRequestRef.current !== extractionRequest) return;
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The fuel slip could not be sent for capture.' });
    } finally {
      if (fuelSlipExtractionRequestRef.current === extractionRequest) setIsExtractingFuelSlip(false);
    }
  }

  function preventFuelSlipImplicitSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  async function handleFuelSlipSaveClick() {
    const [targetType, targetId] = fuelSlipDraft.targetKey.split(':');
    const card = normalizeFuelSlipCard(fuelSlipDraft.cardLast4 || fuelSlipDraft.cardNumberMasked);

    if (targetType !== 'asset' && targetType !== 'storage_tank') {
      setNotice({ tone: 'error', message: 'Choose asset or storage tank.' });
      return;
    }

    if (!fuelSlipDraft.id && targetType === 'asset') {
      const targetAsset = assets.find((asset) => asset.id === targetId);
      if (!targetAsset || !isIncludedFuelEntryAsset(targetAsset)) {
        setFuelSlipDraft((current) => ({ ...current, targetKey: '' }));
        setFuelSlipFlow(fuelSlipDraft.mode === 'manual' ? 'target-manual' : 'target-automatic');
        setNotice({
          tone: 'error',
          message: targetAsset?.workUseExcluded
            ? `${targetAsset.title} is excluded from fuel entry. Include it again under Fuel Ledger exclusions before adding a fuel slip.`
            : 'That asset is no longer available for fuel entry. Choose another included asset.',
        });
        return;
      }
    }

    const missingFields = getFuelSlipMissingFields(
      fuelSlipDraft,
      targetType,
      selectedFuelSlipUsageMetric,
      selectedFuelSlipAssetResolved,
    );

    if (missingFields.length) {
      const firstMissingField = missingFields[0];
      setFuelSlipAttemptedSubmit(true);
      setFuelSlipValidationNotice(FUEL_SLIP_REQUIRED_NOTICE);
      setFuelSlipFormPage(getFuelSlipMissingFieldPage(firstMissingField));
      setFuelSlipFocusField(firstMissingField);
      return;
    }

    setIsSaving(true);
    setNotice(null);
    setFuelSlipValidationNotice('');

    try {
      const reviewingExistingSlip = Boolean(fuelSlipDraft.id);
      const payload = {
        id: fuelSlipDraft.id || undefined,
        fuelSlipId: fuelSlipDraft.id || undefined,
        mode: fuelSlipDraft.mode,
        targetType,
        targetId,
        assetId: targetType === 'asset' ? targetId : null,
        storageId: targetType === 'storage_tank' ? targetId : null,
        uploadId: fuelSlipDraft.uploadId || null,
        documentFileUrl: fuelSlipDraft.documentFileUrl || null,
        originalFilename: fuelSlipDraft.originalFilename || null,
        contentType: fuelSlipDraft.contentType || null,
        byteSize: fuelSlipDraft.byteSize,
        supplierName: fuelSlipDraft.supplierName,
        supplierVatNumber: fuelSlipDraft.supplierVatNumber,
        slipNumber: fuelSlipDraft.slipNumber,
        transactionNumber: fuelSlipDraft.transactionNumber,
        documentDate: fuelSlipDraft.documentDate,
        documentTime: fuelSlipDraft.documentTime,
        fuelType: fuelSlipDraft.fuelType,
        litres: numberInputToValue(fuelSlipDraft.litres, 3),
        pricePerLitre: numberInputToValue(fuelSlipDraft.pricePerLitre, 4),
        totalAmount: numberInputToValue(fuelSlipDraft.totalAmount, 2),
        vatAmount: numberInputToValue(fuelSlipDraft.vatAmount, 2),
        vatIncluded: fuelSlipDraft.vatIncluded === '' ? null : fuelSlipDraft.vatIncluded === 'true',
        vatRate: numberInputToValue(fuelSlipDraft.vatRate, 4),
        paymentMethod: fuelSlipDraft.paymentMethod,
        cardType: fuelSlipDraft.cardType,
        cardNumberMasked: card.masked,
        cardLast4: card.last4,
        merchantNumber: fuelSlipDraft.merchantNumber,
        terminalNumber: fuelSlipDraft.terminalNumber,
        siteNumber: fuelSlipDraft.siteNumber,
        odometerReading: numberInputToValue(fuelSlipDraft.odometerReading, 2),
        hourMeterReading: numberInputToValue(fuelSlipDraft.hourMeterReading, 2),
        operatorName: fuelSlipDraft.operatorName,
        activityText: fuelSlipDraft.activityText,
        workAreaText: fuelSlipDraft.workAreaText,
        note: fuelSlipDraft.note,
        assetFuelPercentBefore: percentInputToValue(fuelSlipDraft.assetFuelPercentBefore),
        assetFuelPercentAfter: percentInputToValue(fuelSlipDraft.assetFuelPercentAfter),
        extractionStatus: fuelSlipDraft.extractionStatus,
        ocrConfidence: fuelSlipDraft.ocrConfidence,
        reviewRequired: fuelSlipDraft.reviewRequired,
        rawExtractedText: sanitizeFuelSlipSensitiveText(fuelSlipDraft.rawExtractedText),
        extractionWarnings: fuelSlipDraft.extractionWarnings,
      };

      const response = await fetch(
        scopedApiUrl(reviewingExistingSlip ? `/api/fuel/slips/${encodeURIComponent(fuelSlipDraft.id)}` : '/api/fuel/slips'),
        {
          method: reviewingExistingSlip ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      const data = await applyLedgerResponse(response);

      if (data.pendingReview) {
        const returnedSlip = data.fuelSlip ?? data.recentFuelSlips?.find((slip) => slip.id === (fuelSlipDraft.id || data.fuelSlip?.id));
        if (returnedSlip) {
          setFuelSlipDraft(buildFuelSlipDraftFromRecord(returnedSlip));
        }
        const followUpMissingFields = returnedSlip
          ? getFuelSlipMissingFields(
            buildFuelSlipDraftFromRecord(returnedSlip),
            fuelSlipTargetTypeFromKey(fuelSlipTargetKey(returnedSlip)),
            selectedFuelSlipUsageMetric,
            selectedFuelSlipAssetResolved,
          )
          : missingFields;
        const firstMissingField = followUpMissingFields[0] ?? 'operatorName';
        setFuelSlipAttemptedSubmit(true);
        setFuelSlipValidationNotice(FUEL_SLIP_REQUIRED_NOTICE);
        setFuelSlipFormPage(getFuelSlipMissingFieldPage(firstMissingField));
        setFuelSlipFocusField(firstMissingField);
        return;
      }

      setFuelSlipAttemptedSubmit(false);
      setFuelSlipValidationNotice('');
      setNotice({ tone: 'success', message: data.message || 'Fuel Slip saved to Fuel Ledger.' });

      if (returnFromQuickLaunch()) return;

      setFuelSlipDraft(emptyFuelSlipDraft);
      setFuelSlipFlow(null);
      setFuelSlipFormPage('details');
      setFuelSlipPickerSearch('');
      setFuelSlipUploadFile(null);
      setFuelSlipUploadFileName('');
      setFuelSlipManagerFilterOpen(false);
      setOpenFuelSlipManagerFilterSelect(null);
      setFuelSlipDownloadOpen(false);
      setOpenFuelSlipDownloadSelect(null);
      setFuelSlipDownloadTargetSearch('');
      setFuelSlipDownloadError('');
      if (reviewingExistingSlip) {
        setExpandedFuelSlipId(fuelSlipDraft.id);
      } else {
        setFuelSlipManagerSearch('');
        setFuelSlipManagerFilters(DEFAULT_FUEL_SLIP_MANAGER_FILTERS);
        setDraftFuelSlipManagerFilters(DEFAULT_FUEL_SLIP_MANAGER_FILTERS);
        setFuelSlipManagerTargetSearch('');
        setCurrentFuelSlipManagerPage(1);
        setExpandedFuelSlipId(null);
      }
      setQuickLaunchAssetId(null);
      setFuelSlipReturnToManager(false);
      setModalMode('fuel-slip-manager');
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save fuel slip.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmVoidFuelSlip() {
    if (!deleteCandidateFuelSlip || busyFuelSlipDeleteId) return;

    setBusyFuelSlipDeleteId(deleteCandidateFuelSlip.id);
    setNotice(null);

    try {
      const response = await fetch(scopedApiUrl(`/api/fuel/slips/${encodeURIComponent(deleteCandidateFuelSlip.id)}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Voided from Fuel Ledger manager' }),
      });

      const data = await applyLedgerResponse(response);
      setNotice({ tone: 'success', message: data.message || 'Fuel slip voided. Its change history has been kept.' });
      setDeleteCandidateFuelSlip(null);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to void fuel slip.' });
    } finally {
      setBusyFuelSlipDeleteId(null);
    }
  }

  async function handlePinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStorage) return;
    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch(scopedApiUrl(`/api/fuel/storage/${selectedStorage.id}/pin`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinDraft }),
      });
      const data = (await response.json()) as { ok: boolean; storage?: FuelLedgerStorage; error?: string };

      if (!response.ok || !data.ok || !data.storage) {
        throw new Error(data.error || 'Failed to save fuel PIN.');
      }

      setStorages((current) => current.map((storage) => (storage.id === data.storage?.id ? data.storage : storage)));
      setNotice({ tone: 'success', message: 'Fuel QR PIN updated.' });
      closeModal();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save fuel PIN.' });
    } finally {
      setIsSaving(false);
    }
  }



  async function handleCopyFuelScanLink(storage: FuelLedgerStorage) {
    const scanUrl = buildFuelScanUrl(storage);

    if (!scanUrl) {
      setNotice({ tone: 'error', message: 'This fuel storage unit does not have a scan link yet.' });
      return;
    }

    function markScanLinkCopied() {
      setCopiedScanLinkStorageId(storage.id);
      window.setTimeout(() => {
        setCopiedScanLinkStorageId((current) => (current === storage.id ? null : current));
      }, 2200);
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(scanUrl);
        markScanLinkCopied();
        setNotice({ tone: 'success', message: 'Fuel scan link copied.' });
        return;
      }

      window.prompt('Copy this fuel scan link', scanUrl);
      markScanLinkCopied();
      setNotice({ tone: 'success', message: 'Fuel scan link ready to copy.' });
    } catch (error) {
      setCopiedScanLinkStorageId(null);
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to copy the fuel scan link.',
      });
    }
  }

  function handlePrintFuelQrLabel(storage: FuelLedgerStorage) {
    const opened = window.open(buildFuelQrPrintUrl(storage, accountantShareId, accountantRegisterId), '_blank', 'noopener,noreferrer');

    if (!opened) {
      setNotice({ tone: 'error', message: 'Unable to open the fuel QR print page. Please allow pop-ups and try again.' });
      return;
    }

    setNotice({ tone: 'success', message: 'Fuel QR print label opened in a new tab.' });
  }

  async function handleDownloadFuelQr(storage: FuelLedgerStorage) {
    try {
      const response = await fetch(scopedApiUrl(`/api/fuel/storage/${encodeURIComponent(storage.id)}/qr?format=png&download=1`), {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        try {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? 'Failed to download the fuel QR image.');
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }

          throw new Error('Failed to download the fuel QR image.');
        }
      }

      const blob = await response.blob();
      const fallbackName = `${storage.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'fuel-storage'}-qr.png`;
      const fileName = parseDownloadFileName(response, fallbackName);
      downloadBlob(blob, fileName);
      setNotice({ tone: 'success', message: 'Fuel QR image downloaded.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to download the fuel QR image.',
      });
    }
  }

  function openFuelSlipManagerFilterPanel() {
    rememberFuelSlipManagerChildTrigger();
    setDraftFuelSlipManagerFilters(fuelSlipManagerFilters);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerTargetSearch('');
    setFuelSlipDownloadOpen(false);
    setOpenFuelSlipDownloadSelect(null);
    setFuelSlipDownloadTargetSearch('');
    setFuelSlipDownloadError('');
    setFuelSlipManagerFilterOpen(true);
  }

  function closeFuelSlipManagerFilterPanel() {
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerTargetSearch('');
    setFuelSlipManagerFilterOpen(false);
  }

  function clearFuelSlipManagerFilters() {
    setDraftFuelSlipManagerFilters(DEFAULT_FUEL_SLIP_MANAGER_FILTERS);
    setFuelSlipManagerFilters(DEFAULT_FUEL_SLIP_MANAGER_FILTERS);
    setCurrentFuelSlipManagerPage(1);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerTargetSearch('');
    setFuelSlipManagerFilterOpen(false);
  }

  function removeFuelSlipManagerFilter(filter: FuelSlipManagerFilterKey) {
    setFuelSlipManagerFilters((current) => {
      if (filter === 'target') return { ...current, targetKey: 'all' };
      if (filter === 'capture') return { ...current, capture: 'all' };
      if (filter === 'year') return { ...current, year: 'all' };
      return { ...current, month: 'all' };
    });
    setCurrentFuelSlipManagerPage(1);
  }

  function applyFuelSlipManagerFilters() {
    setFuelSlipManagerFilters(draftFuelSlipManagerFilters);
    setCurrentFuelSlipManagerPage(1);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerTargetSearch('');
    setFuelSlipManagerFilterOpen(false);
  }

  function openFuelSlipDownloadPanel() {
    rememberFuelSlipManagerChildTrigger();
    setDraftFuelSlipDownloadFilters(fuelSlipManagerFilters);
    setOpenFuelSlipDownloadSelect(null);
    setFuelSlipDownloadTargetSearch('');
    setFuelSlipDownloadError('');
    setFuelSlipManagerFilterOpen(false);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerTargetSearch('');
    setFuelSlipDownloadOpen(true);
  }

  function closeFuelSlipDownloadPanel() {
    setOpenFuelSlipDownloadSelect(null);
    setFuelSlipDownloadTargetSearch('');
    setFuelSlipDownloadError('');
    setFuelSlipDownloadOpen(false);
  }

  function clearFuelSlipDownloadFilters() {
    setDraftFuelSlipDownloadFilters(DEFAULT_FUEL_SLIP_MANAGER_FILTERS);
    setOpenFuelSlipDownloadSelect(null);
    setFuelSlipDownloadTargetSearch('');
    setFuelSlipDownloadError('');
  }

  function handleFuelSlipDownload() {
    if (isDownloadingFuelSlips) return;

    const downloadableSlips = recentFuelSlips.filter((slip) => matchesFuelSlipManagerFilters(slip, draftFuelSlipDownloadFilters, fuelSlipManagerSearchTerm));

    if (!downloadableSlips.length) {
      setFuelSlipDownloadError('No fuel slips match the selected download filters.');
      return;
    }

    setIsDownloadingFuelSlips(true);
    setFuelSlipDownloadError('');

    try {
      downloadBlob(new Blob([buildFuelSlipCsv(downloadableSlips)], { type: 'text/csv;charset=utf-8' }), fuelSlipDownloadFileName());
      setNotice({ tone: 'success', message: 'Fuel slip CSV downloaded.' });
      closeFuelSlipDownloadPanel();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Fuel slip CSV could not be downloaded.' });
    } finally {
      setIsDownloadingFuelSlips(false);
    }
  }

  async function handleClearDipstickNote(storage: FuelLedgerStorage) {
    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch(scopedApiUrl(`/api/fuel/storage/${storage.id}/dipstick`), {
        method: 'DELETE',
        credentials: 'include',
      });

      await applyLedgerResponse(response);
      setNotice({ tone: 'success', message: 'Dipstick note cleared.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to clear dipstick note.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmArchiveStorage() {
    if (!deleteCandidateStorage) return;

    setBusyDeleteId(deleteCandidateStorage.id);
    setNotice(null);

    try {
      const response = await fetch(scopedApiUrl(`/api/fuel/storage/${deleteCandidateStorage.id}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Archived from Fuel Ledger' }),
      });

      const data = await applyLedgerResponse(response);
      setNotice({ tone: 'success', message: data.message || 'Fuel storage archived. Its ledger history has been kept.' });
      setDeleteCandidateStorage(null);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to archive storage.' });
    } finally {
      setBusyDeleteId(null);
    }
  }

  function handleOpenReport() {
    const normalizedMonth = reportYear === 'all' ? 'all' : reportMonth;
    window.open(buildReportUrl(reportStorageId, reportYear, normalizedMonth, 'pdf', accountantShareId, accountantRegisterId), '_blank', 'noopener,noreferrer');
    closeModal();
  }

  function handleReportNext() {
    setOpenReportSelect(null);
    setReportStep('filters');
  }

  function handleReportBack() {
    setOpenReportSelect(null);
    setReportStep('format');
  }

  function toggleReportSelect(selectKey: ReportSelectKey) {
    setOpenReportSelect((current) => (current === selectKey ? null : selectKey));
  }

  function toggleStorageFuelSelect() {
    setIsStorageFuelSelectOpen((current) => !current);
  }

  function selectStorageFuelType(value: string) {
    setStorageDraft((current) => ({ ...current, fuelType: value }));
    setIsStorageFuelSelectOpen(false);
  }

  function selectReportStorage(value: string) {
    setReportStorageId(value);
    setOpenReportSelect(null);
  }

  function selectReportYear(value: string) {
    setReportYear(value);
    setReportMonth('all');
    setOpenReportSelect(null);
  }

  function selectReportMonth(value: string) {
    setReportMonth(value);
    setOpenReportSelect(null);
  }

  function handleDownloadSelectedReport() {
    if (reportFormat === 'xlsx') {
      handleDownloadXlsxReport();
      return;
    }

    handleOpenReport();
  }

  function handleDownloadXlsxReport() {
    const normalizedMonth = reportYear === 'all' ? 'all' : reportMonth;
    const downloadLink = document.createElement('a');
    downloadLink.href = buildReportUrl(reportStorageId, reportYear, normalizedMonth, 'xlsx', accountantShareId, accountantRegisterId);
    downloadLink.download = '';
    downloadLink.rel = 'noreferrer';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    closeModal();
  }

  const hasActiveSearch = searchText.trim().length > 0;

  function handleFuelSlipFormBack() {
    if (fuelSlipFormPage === 'extra') {
      setFuelSlipFormPage('details');
      return;
    }

    if (fuelSlipFlow === 'manual-form') {
      setFuelSlipFlow(quickLaunchAssetId ? 'source-choice' : 'target-manual');
      return;
    }

    if (fuelSlipDraft.id) {
      resetFuelSlipValidationState();
      setFuelSlipFlow(null);
      setFuelSlipReturnToManager(false);
      setModalMode('fuel-slip-manager');
      return;
    }

    setFuelSlipFlow('upload');
  }

  function handleFuelSlipUploadBack() {
    if (isExtractingFuelSlip) return;
    setFuelSlipFlow(quickLaunchAssetId ? 'source-choice' : 'target-automatic');
  }

  function focusFuelSlipFirstEditableField() {
    window.requestAnimationFrame(() => {
      const scrollBody = document.querySelector<HTMLElement>('[data-fuel-slip-scroll-body="true"]');
      scrollBody?.scrollTo({ top: 0, left: 0, behavior: 'auto' });

      const firstEditableField = scrollBody?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
      );
      firstEditableField?.focus({ preventScroll: true });
    });
  }

  function handleFuelSlipStepSelect(page: 'details' | 'extra') {
    setFuelSlipFormPage(page);
    focusFuelSlipFirstEditableField();
  }

  function handleFuelSlipNextPage() {
    handleFuelSlipStepSelect('extra');
  }

  function isFuelSlipFieldMissing(field: FuelSlipMissingFieldKey): boolean {
    return visibleFuelSlipMissingFields.has(field);
  }

  function fuelSlipFieldClassName(field: FuelSlipMissingFieldKey, baseClassName?: string): string | undefined {
    const classNames = [baseClassName, isFuelSlipFieldMissing(field) ? styles.fuelSlipFieldMissing : ''].filter(Boolean);
    return classNames.length ? classNames.join(' ') : undefined;
  }

  function fuelSlipRequiredHint(field: FuelSlipMissingFieldKey, message = 'Required'): ReactNode {
    return isFuelSlipFieldMissing(field) ? <small className={styles.fuelSlipRequiredHint}>{message}</small> : null;
  }

  function fuelSlipAriaInvalid(field: FuelSlipMissingFieldKey): true | undefined {
    return isFuelSlipFieldMissing(field) ? true : undefined;
  }

  function renderFuelSlipValidationNotice() {
    return fuelSlipValidationNotice ? <p className={styles.fuelSlipValidationNotice} role="alert">{fuelSlipValidationNotice}</p> : null;
  }

  function renderFuelSlipDetailsFields() {
    return (
      <section className={styles.invoiceFormCard}>
        <div className={styles.formGrid}>
          <label>
            <span>Supplier / garage</span>
            <input value={fuelSlipDraft.supplierName} onChange={(event) => setFuelSlipField('supplierName', event.target.value)} placeholder="Supplier name" />
          </label>
          <label className={fuelSlipFieldClassName('documentDate')}>
            <span>Slip date</span>
            <input type="date" value={fuelSlipDraft.documentDate} onChange={(event) => setFuelSlipField('documentDate', event.target.value)} aria-invalid={fuelSlipAriaInvalid('documentDate')} data-fuel-slip-field="documentDate" />
            {fuelSlipRequiredHint('documentDate')}
          </label>
          <label className={fuelSlipFieldClassName('fuelType')}>
            <span>Fuel type</span>
            <input value={fuelSlipDraft.fuelType} onChange={(event) => setFuelSlipField('fuelType', event.target.value)} placeholder="Diesel 50ppm, Unleaded 95" aria-invalid={fuelSlipAriaInvalid('fuelType')} data-fuel-slip-field="fuelType" />
            {fuelSlipRequiredHint('fuelType')}
          </label>
          <label className={fuelSlipFieldClassName('litres')}>
            <span>Litres</span>
            <input type="text" inputMode="decimal" value={fuelSlipDraft.litres} onChange={(event) => setFuelSlipNumericField('litres', event.target.value)} placeholder="25.21" aria-invalid={fuelSlipAriaInvalid('litres')} data-fuel-slip-field="litres" />
            {fuelSlipRequiredHint('litres', 'Required: must be greater than 0')}
          </label>
          <label className={styles.invoiceCurrencyField}>
            <span>Price per litre</span>
            <div className={styles.invoiceCurrencyInput}>
              <span aria-hidden="true">R</span>
              <input type="text" inputMode="decimal" value={fuelSlipDraft.pricePerLitre} onChange={(event) => setFuelSlipNumericField('pricePerLitre', event.target.value)} placeholder="19.83" />
            </div>
          </label>
          <label className={fuelSlipFieldClassName('totalAmount', styles.invoiceCurrencyField)}>
            <span>Total amount</span>
            <div className={styles.invoiceCurrencyInput}>
              <span aria-hidden="true">R</span>
              <input type="text" inputMode="decimal" value={fuelSlipDraft.totalAmount} onChange={(event) => setFuelSlipNumericField('totalAmount', event.target.value)} placeholder="500.00" aria-invalid={fuelSlipAriaInvalid('totalAmount')} data-fuel-slip-field="totalAmount" />
            </div>
            {fuelSlipRequiredHint('totalAmount')}
          </label>
          <label>
            <span>Card last 4</span>
            <input value={fuelSlipDraft.cardLast4} onChange={(event) => handleFuelSlipCardLast4Change(event.target.value)} inputMode="numeric" maxLength={4} pattern="[0-9]{0,4}" placeholder="Last 4 only" />
          </label>
          <label>
            <span>Slip/reference number</span>
            <input value={fuelSlipDraft.slipNumber} onChange={(event) => setFuelSlipField('slipNumber', event.target.value)} placeholder="Optional" />
          </label>
          <label>
            <span>Transaction/reference number</span>
            <input value={fuelSlipDraft.transactionNumber} onChange={(event) => setFuelSlipField('transactionNumber', event.target.value)} placeholder="Optional" />
          </label>
        </div>

        <details className={styles.fuelSlipMoreDetails}>
          <summary>VAT and payment metadata</summary>
          <div className={styles.formGrid}>
            <label>
              <span>Supplier VAT number</span>
              <input value={fuelSlipDraft.supplierVatNumber} onChange={(event) => setFuelSlipField('supplierVatNumber', event.target.value)} placeholder="Optional" />
            </label>
            <label>
              <span>Slip time</span>
              <input type="time" value={fuelSlipDraft.documentTime} onChange={(event) => setFuelSlipField('documentTime', event.target.value)} />
            </label>
            <label>
              <span>Payment method</span>
              <input value={fuelSlipDraft.paymentMethod} onChange={(event) => setFuelSlipField('paymentMethod', event.target.value)} placeholder="Card, cash, account" />
            </label>
            <label>
              <span>Card type</span>
              <input value={fuelSlipDraft.cardType} onChange={(event) => setFuelSlipField('cardType', event.target.value)} placeholder="Optional" />
            </label>
            <label>
              <span>VAT amount</span>
              <input type="text" inputMode="decimal" value={fuelSlipDraft.vatAmount} onChange={(event) => setFuelSlipField('vatAmount', event.target.value)} placeholder="Optional" />
            </label>
            <label>
              <span>VAT included</span>
              <select value={fuelSlipDraft.vatIncluded} onChange={(event) => setFuelSlipField('vatIncluded', event.target.value)}>
                <option value="">Unknown</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label>
              <span>VAT rate</span>
              <input type="text" inputMode="decimal" value={fuelSlipDraft.vatRate} onChange={(event) => setFuelSlipField('vatRate', event.target.value)} placeholder="15" />
            </label>
            <label>
              <span>Merchant number</span>
              <input value={fuelSlipDraft.merchantNumber} onChange={(event) => setFuelSlipField('merchantNumber', event.target.value)} placeholder="Optional" />
            </label>
            <label>
              <span>Terminal number</span>
              <input value={fuelSlipDraft.terminalNumber} onChange={(event) => setFuelSlipField('terminalNumber', event.target.value)} placeholder="Optional" />
            </label>
            <label>
              <span>Site number</span>
              <input value={fuelSlipDraft.siteNumber} onChange={(event) => setFuelSlipField('siteNumber', event.target.value)} placeholder="Optional" />
            </label>
          </div>
        </details>
      </section>
    );
  }

  function renderFuelSlipWizardProgress() {
    const steps = [
      { page: 'details', label: 'Slip', step: 1 },
      { page: 'extra', label: 'Usage & work', step: 2 },
    ] as const;

    return (
      <ol
        className={`${styles.fuelSlipWizardProgress} ${wizardStyles.progress}`}
        aria-label={`Step ${fuelSlipFormPage === 'details' ? 1 : 2} of 2`}
      >
        {steps.map(({ page, label, step }) => {
          const isCurrent = fuelSlipFormPage === page;
          const isComplete = page === 'details' && fuelSlipFormPage === 'extra';

          return (
            <li
              key={page}
              className={[
                styles.fuelSlipWizardProgressItem,
                wizardStyles.progressItem,
                isCurrent ? wizardStyles.progressItemCurrent : '',
                isComplete ? wizardStyles.progressItemComplete : '',
              ].join(' ')}
              data-complete={isComplete ? 'true' : undefined}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span aria-hidden="true">{isComplete ? '✓' : step}</span>
              <strong>{label}</strong>
            </li>
          );
        })}
      </ol>
    );
  }

  function renderFuelSlipExtraFields() {
    const isAssetSlip = selectedFuelSlipTargetType === 'asset';
    const usageHelp = isAssetSlip && !selectedFuelSlipAssetResolved
      ? 'The linked asset usage metric could not be resolved. Enter current km / odometer or current hours before this slip can post.'
      : selectedFuelSlipUsageMetric === 'both'
        ? 'This asset accepts km and hours. Enter at least one valid reading before the slip can post.'
        : selectedFuelSlipUsageMetric === 'hours'
          ? 'Current hours are required before this slip can post.'
          : '';

    return (
      <section className={styles.invoiceFormCard}>
        {usageHelp ? <p className={styles.fuelSlipHelperText}>{usageHelp}</p> : null}

        <div className={styles.formGrid}>
          {isAssetSlip && showFuelSlipOdometer ? (
            <label className={fuelSlipFieldClassName('odometerReading')}>
              <span>Current km / odometer</span>
              <input type="text" inputMode="numeric" value={fuelSlipDraft.odometerReading} onChange={(event) => setFuelSlipField('odometerReading', event.target.value)} placeholder="Current km" aria-invalid={fuelSlipAriaInvalid('odometerReading')} data-fuel-slip-field="odometerReading" />
              {fuelSlipRequiredHint('odometerReading', selectedFuelSlipUsageMetric === 'both' ? 'Required: enter km or hours' : 'Required')}
            </label>
          ) : null}
          {isAssetSlip && showFuelSlipHours ? (
            <label className={fuelSlipFieldClassName('hourMeterReading')}>
              <span>Current hours</span>
              <input type="text" inputMode="decimal" value={fuelSlipDraft.hourMeterReading} onChange={(event) => setFuelSlipField('hourMeterReading', event.target.value)} placeholder="Current hours" aria-invalid={fuelSlipAriaInvalid('hourMeterReading')} data-fuel-slip-field="hourMeterReading" />
              {fuelSlipRequiredHint('hourMeterReading', selectedFuelSlipUsageMetric === 'both' ? 'Required: enter km or hours' : 'Required')}
            </label>
          ) : null}
          <label className={isAssetSlip ? fuelSlipFieldClassName('operatorName') : undefined}>
            <span>Operator / manager name</span>
            <input value={fuelSlipDraft.operatorName} onChange={(event) => setFuelSlipField('operatorName', event.target.value)} placeholder="Who captured or approved this slip" aria-invalid={isAssetSlip ? fuelSlipAriaInvalid('operatorName') : undefined} data-fuel-slip-field="operatorName" />
            {isAssetSlip ? fuelSlipRequiredHint('operatorName') : null}
          </label>
          {isAssetSlip ? (
            <>
              <label className={fuelSlipFieldClassName('activityText')}>
                <span>Activity / reason for fuel</span>
                <input value={fuelSlipDraft.activityText} onChange={(event) => setFuelSlipField('activityText', event.target.value)} placeholder="Work reason or activity" aria-invalid={fuelSlipAriaInvalid('activityText')} data-fuel-slip-field="activityText" />
                {fuelSlipRequiredHint('activityText')}
              </label>
              <label className={fuelSlipFieldClassName('workAreaText')}>
                <span>Where / direction / work area</span>
                <input value={fuelSlipDraft.workAreaText} onChange={(event) => setFuelSlipField('workAreaText', event.target.value)} placeholder="Location, route or work area" aria-invalid={fuelSlipAriaInvalid('workAreaText')} data-fuel-slip-field="workAreaText" />
                {fuelSlipRequiredHint('workAreaText')}
              </label>
              <label>
                <span>Asset fuel percentage after fill</span>
                <input type="text" inputMode="numeric" value={fuelSlipDraft.assetFuelPercentAfter} onChange={(event) => setFuelSlipField('assetFuelPercentAfter', event.target.value.replace(/[^0-9]/g, '').slice(0, 3))} placeholder="0 - 100" />
              </label>
            </>
          ) : null}
          <label className={styles.fuelSlipFullField}>
            <span>Optional note</span>
            <textarea value={fuelSlipDraft.note} onChange={(event) => setFuelSlipField('note', event.target.value)} placeholder="Optional note for this fuel slip" rows={3} />
          </label>
        </div>
      </section>
    );
  }

  return (
    <>
      <main className={styles.page}>
        <AppHeader active="none" />

        <section className={styles.shell}>
          {notice ? <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : styles.noticeSuccess}`}>{notice.message}</div> : null}

          <section className={styles.ledgerPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.pageTitleBlock}>
                <h1>FUEL TRACKING SYSTEM</h1>
              </div>

              <div className={styles.topActions}>
                <div className={styles.topActionButtons}>
                  {!isAccountantReadOnly ? (
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${styles.topActionButton} ${styles.topAddButton}`}
                      onClick={openCreateStorage}
                    >
                      <PlusIcon className={styles.buttonIcon} />
                      <span>Add Storage Tank</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`${styles.secondaryButton} ${styles.topActionButton} ${styles.topExclusionsButton}`}
                    onClick={openExclusionsModal}
                  >
                    <ExclusionIcon className={styles.buttonIcon} />
                    <span>Exclusions</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.secondaryButton} ${styles.topActionButton} ${styles.topFuelSlipButton}`}
                    onClick={openFuelSlipMenu}
                  >
                    <span>Fuel Slips</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.secondaryButton} ${styles.topActionButton} ${styles.topReportButton}`}
                    onClick={openReportModal}
                  >
                    <DownloadIcon className={styles.buttonIcon} />
                    <span>Download</span>
                  </button>
                </div>

                <label className={styles.searchWrap}>
                  <SearchIcon className={styles.searchIcon} />
                  <input
                    type="search"
                    className={styles.searchInput}
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search by storage name, type or serial"
                    aria-label="Search by storage name, type or serial"
                  />
                  {hasActiveSearch ? (
                    <button type="button" className={styles.clearSearchButton} onClick={clearSearch} aria-label="Clear search">
                      ×
                    </button>
                  ) : null}
                </label>
              </div>
            </div>

            <CaptureRequestStatusList
              requests={captureRequests}
              title="Fuel slips being captured"
              onRetract={!accountantShareId && !accountantRegisterId ? retractCaptureRequest : undefined}
            />

            {!isLoading && !storages.length ? (
              <div className={styles.emptyState}>
                <strong>No fuel storage yet.</strong>
                <span>{isAccountantReadOnly ? 'No fuel storage or fuel records have been shared for this register.' : 'Add your first tank, bowser or storage unit.'}</span>
                {!isAccountantReadOnly ? (
                  <button type="button" className={styles.primaryButton} onClick={openCreateStorage}>
                    <PlusIcon className={styles.buttonIcon} />
                    <span>Add Storage Tank</span>
                  </button>
                ) : null}
              </div>
            ) : null}

            {!isLoading && storages.length > 0 && visibleStorages.length === 0 ? (
              <div className={styles.emptyState}>
                <strong>No storage matches the search.</strong>
                <button type="button" className={styles.secondaryButton} onClick={clearSearch}>
                  Clear Search
                </button>
              </div>
            ) : null}

            <div className={styles.storageList}>
              {visibleStorages.map((storage) => {
                const progress = getProgressPercent(storage);
                const storageIsLow = isLowStorage(storage);
                const dipstickNoteText = getDipstickNote(storage);
                const balanceNeedsChecking = Boolean(storage.balanceNeedsChecking || storage.balanceVerificationStatus === 'needs_check');
                const hasStorageWarning = storageIsLow || Boolean(dipstickNoteText) || balanceNeedsChecking;

                return (
                  <article key={storage.id} className={`${styles.storageCard} ${hasStorageWarning ? styles.storageCardLow : ''}`}>
                    <div className={styles.storageInfo}>
                      <div className={styles.storageHeadingRow}>
                        <div className={styles.storageTitleBlock}>
                          <h2>{storage.name}</h2>
                          <div className={styles.storageDetails}>
                            <span>{formatFuelType(storage.fuelType)}</span>
                            <span>{formatLitres(storage.currentLitres)} available</span>
                            <span>{storage.capacityLitres === null ? 'Capacity not set' : `${formatLitres(storage.capacityLitres)} capacity`}</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.storageProgressBlock}>
                        <div className={styles.progressTrack} aria-hidden="true">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                        <div className={styles.progressMeta}>
                          <span>{storage.reorderLevelLitres === null ? 'No low level set' : `Low at ${formatLitres(storage.reorderLevelLitres)}`}</span>
                          <span>{formatPercent(storage.stockPercent)}</span>
                        </div>
                      </div>
                    </div>

                    {!isAccountantReadOnly ? <div className={styles.storageHeaderAside}>
                      <div className={styles.unitActions}>
                        <button type="button" className={styles.unitButton} onClick={() => openManageStorageChoice(storage)} disabled={isSaving}>
                          <GearIcon className={styles.buttonIcon} />
                          <span>Manage</span>
                        </button>
                        <button type="button" className={styles.unitButton} onClick={() => openQrModal(storage)} disabled={isSaving}>
                          <QrIcon className={styles.buttonIcon} />
                          <span>QR Code</span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.unitButton} ${styles.changePinButton}`}
                          onClick={() => openPin(storage)}
                          disabled={isSaving}
                        >
                          <LockIcon className={styles.buttonIcon} />
                          <span>Change PIN</span>
                        </button>
                        <button type="button" className={`${styles.unitButton} ${styles.deleteUnitButton}`} onClick={() => setDeleteCandidateStorage(storage)} disabled={isSaving}>
                          <TrashIcon className={styles.buttonIcon} />
                          <span>Archive Unit</span>
                        </button>
                      </div>
                    </div> : null}

                    {hasStorageWarning ? (
                      <div className={styles.storageWarningList}>
                        {storageIsLow ? (
                          <div className={styles.storageWarningNote}>
                            <div>
                              <strong>Storage below reorder level</strong>
                              <span>{formatLitres(storage.currentLitres)} remaining. Reorder at {formatLitres(storage.reorderLevelLitres)}.</span>
                            </div>
                          </div>
                        ) : null}

                        {balanceNeedsChecking ? (
                          <div className={`${styles.storageWarningNote} ${styles.balanceCheckWarning}`}>
                            <div>
                              <strong>Balance needs checking</strong>
                              <span>{storage.balanceCheckReason || 'Measure the tank physically and reconcile the recorded current litres.'}</span>
                            </div>
                            {!isAccountantReadOnly ? (
                              <button type="button" className={styles.reconcileBalanceButton} onClick={() => openReconcileBalance(storage)} disabled={isSaving}>
                                Reconcile Balance
                              </button>
                            ) : null}
                          </div>
                        ) : null}

                        {dipstickNoteText ? (
                          <div className={styles.storageWarningNote}>
                            <div>
                              <strong>Dipstick note</strong>
                              <span>{dipstickNoteText}</span>
                            </div>
                            {!isAccountantReadOnly ? (
                              <button type="button" className={styles.clearDipstickButton} onClick={() => handleClearDipstickNote(storage)} disabled={isSaving}>
                                Clear note
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>

          </section>
        </section>

        <nav className={styles.mobileQuickActions} aria-label="Fuel quick actions">
          {!isAccountantReadOnly ? (
            <button type="button" className={styles.mobileQuickButton} onClick={openCreateStorage}>
              <PlusIcon className={styles.buttonIcon} />
              <span>Add</span>
            </button>
          ) : null}
          <button type="button" className={styles.mobileQuickButton} onClick={openFuelSlipMenu}>
            <FuelSlipsIcon className={styles.buttonIcon} />
            <span>Slips</span>
          </button>
          <button type="button" className={styles.mobileQuickButton} onClick={openExclusionsModal}>
            <ExclusionIcon className={styles.buttonIcon} />
            <span>Exclude</span>
          </button>
          <button type="button" className={styles.mobileQuickButton} onClick={openReportModal}>
            <DownloadIcon className={styles.buttonIcon} />
            <span>Reports</span>
          </button>
        </nav>
      </main>

      {modalMode === 'manage-storage-choice' && selectedStorage ? (
        <ManageFuelStorageChoiceModal
          storage={selectedStorage}
          onClose={closeModal}
          onManage={() => openEditStorage(selectedStorage)}
          onMissingEntry={() => openMissingFuelEntry(selectedStorage)}
        />
      ) : null}

      {modalMode === 'missing-entry' && selectedStorage ? (
        <MissingFuelEntryModal
          storage={selectedStorage}
          assets={includedFuelAssets}
          addedByLabel={addedByLabel}
          accountantShareId={accountantShareId}
          accountantRegisterId={accountantRegisterId}
          onClose={closeModal}
          onLedgerUpdated={applyLedgerData}
          onReconcile={() => openReconcileBalance(selectedStorage)}
        />
      ) : null}

      {modalMode === 'reconcile-balance' && selectedStorage ? (
        <ReconcileFuelBalanceModal
          storage={selectedStorage}
          accountantShareId={accountantShareId}
          accountantRegisterId={accountantRegisterId}
          onClose={closeModal}
          onLedgerUpdated={(data: MissingFuelLedgerPayload) => {
            applyLedgerData(data);
            setNotice({ tone: 'success', message: 'Tank balance reconciled.' });
          }}
        />
      ) : null}

      {modalMode === 'exclusions' ? (
        <div className={styles.fuelSlipFlowBackdrop} data-website-overlay role="dialog" aria-modal="true" aria-label="Fuel ledger exclusions">
          <div className={`${styles.assetModal} ${styles.exclusionsModal}`} data-asset-choice-surface="true" data-asset-choice-modal="true">
            <div className={styles.modalHeader} data-asset-choice-header="true">
              <div>
                <h2>
                  {isExclusionEditorOpen
                    ? exclusionSelectionAction === 'exclude' ? 'Confirm Fuel Exclusions' : 'Confirm Work-use Inclusion'
                    : 'Choose Saved Assets'}
                </h2>
                <p>
                  {isExclusionEditorOpen
                    ? `${selectedExclusionAssets.length} ${selectedExclusionAssets.length === 1 ? 'asset' : 'assets'} selected.`
                    : 'Select assets to exclude from work-use totals, or choose an excluded asset to include it again.'}
                </p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close exclusions"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />

            {notice ? <div className={`${styles.exclusionNotice} ${notice.tone === 'error' ? styles.noticeError : styles.noticeSuccess}`}>{notice.message}</div> : null}

            {isExclusionEditorOpen ? (
              <div className={styles.exclusionEditor}>
                <div className={styles.exclusionEditorHeading}>
                  <h3>{exclusionSelectionAction === 'exclude' ? 'Exclude these assets from work-use totals?' : 'Include these assets in work-use totals again?'}</h3>
                  <p>
                    Fuel movement and tank balances will stay unchanged. Only the work-use classification changes, and the change is kept in history.
                  </p>
                </div>
                <div className={styles.exclusionSelectedAssets}>
                  {selectedExclusionAssets.map((asset) => (
                    <div key={asset.id}>
                      <strong>{asset.title}</strong>
                      <small>{fuelSlipAssetMeta(asset) || 'Asset details not set'}</small>
                    </div>
                  ))}
                </div>
                {exclusionSelectionAction === 'exclude' ? (
                  <label className={styles.exclusionReasonField}>
                    <span>Reason for all selected assets</span>
                    <input
                      value={exclusionReason}
                      onChange={(event) => setExclusionReason(event.target.value)}
                      placeholder="Example: Generator serving normal houses"
                      maxLength={500}
                      autoFocus
                    />
                    <small>Only exclude an asset when its fuel is fully outside work use.</small>
                  </label>
                ) : (
                  <div className={styles.exclusionReasonSummary}>
                    <span>What will happen</span>
                    <strong>The selected assets will count as work use again. Their previous exclusion reasons remain available in change history.</strong>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className={`${styles.pickerToolbar} ${styles.exclusionPickerToolbar}`} data-asset-choice-toolbar="true">
                  <input
                    value={exclusionSearch}
                    onChange={(event) => setExclusionSearch(event.target.value)}
                    placeholder="Search saved assets..."
                    aria-label="Search saved assets for fuel exclusions"
                  />
                  <button
                    type="button"
                    className={`${styles.secondaryButton} ${styles.exclusionSelectAllButton}`}
                    onClick={toggleAllVisibleExclusionAssets}
                    disabled={!bulkSelectableExclusionAssets.length}
                    aria-pressed={areAllBulkSelectableExclusionAssetsSelected}
                    aria-label={areAllBulkSelectableExclusionAssetsSelected
                      ? 'Unselect all shown assets'
                      : exclusionSelectionAction === 'include'
                        ? 'Select all shown excluded assets to include again'
                        : 'Select all shown assets to exclude'}
                  >
                    {areAllBulkSelectableExclusionAssetsSelected
                      ? `Unselect shown (${bulkSelectableExclusionAssets.length})`
                      : exclusionSelectionAction === 'include'
                        ? `Select all excluded (${bulkSelectableExclusionAssets.length})`
                        : `Select all shown (${bulkSelectableExclusionAssets.length})`}
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={() => setExclusionSearch('')} disabled={!exclusionSearch}>Clear search</button>
                </div>
                <div className={styles.assetList} data-asset-choice-list="true">
                  {isLoading ? <div className={styles.emptyState}>Loading saved assets...</div> : filteredExclusionAssets.length ? filteredExclusionAssets.map((asset) => {
                    const isSelected = selectedExclusionAssetIdSet.has(asset.id);
                    return (
                      <button
                        type="button"
                        key={asset.id}
                        className={styles.assetRow}
                        onClick={() => toggleExclusionAsset(asset)}
                        aria-pressed={isSelected}
                        data-asset-choice-row="true"
                        data-asset-choice-selected={isSelected ? 'true' : undefined}
                      >
                        <span className={styles.assetInfo} data-asset-choice-copy="true">
                          <strong>{asset.title}</strong>
                          <small data-asset-choice-meta="true">{fuelSlipAssetMeta(asset) || 'Asset details not set'}</small>
                          <small data-asset-choice-secondary="true">{asset.workUseExcluded ? asset.workUseExclusionReason || 'Not used for work purposes' : 'Fuel entries currently count as work use'}</small>
                        </span>
                        <span className={styles.assetValue} data-asset-choice-value="true">
                          <span className={`${styles.exclusionChoice} ${isSelected ? styles.exclusionChoiceSelected : ''}`}>
                            <span className={styles.exclusionChoiceBox} aria-hidden="true">{isSelected ? '✓' : ''}</span>
                            <strong>{isSelected ? 'Selected' : asset.workUseExcluded ? 'Include again' : 'Exclude'}</strong>
                          </span>
                        </span>
                      </button>
                    );
                  }) : <div className={styles.emptyState}>No matching saved assets found.</div>}
                </div>
              </>
            )}

            <div className={styles.modalFooter} data-asset-choice-footer="true">
              {isExclusionEditorOpen ? (
                <>
                  <button type="button" className={styles.secondaryButton} onClick={() => setIsExclusionEditorOpen(false)} disabled={Boolean(busyExclusionAssetId)}>Back</button>
                  <button
                    type="button"
                    className={`${styles.primaryButton} ${exclusionSelectionAction === 'exclude' ? styles.exclusionDangerButton : ''}`}
                    onClick={() => void updateSelectedAssetWorkUseExclusions()}
                    disabled={Boolean(busyExclusionAssetId)}
                  >
                    {busyExclusionAssetId
                      ? 'Saving...'
                      : exclusionSelectionAction === 'exclude'
                        ? `Exclude ${selectedExclusionAssets.length} ${selectedExclusionAssets.length === 1 ? 'asset' : 'assets'}`
                        : `Include ${selectedExclusionAssets.length} ${selectedExclusionAssets.length === 1 ? 'asset' : 'assets'}`}
                  </button>
                </>
              ) : (
                <>
                  <span className={styles.exclusionSelectionCount} aria-live="polite">
                    {selectedExclusionAssets.length
                      ? `${selectedExclusionAssets.length} selected to ${exclusionSelectionAction === 'include' ? 'include again' : 'exclude'}`
                      : 'Select one or more assets'}
                  </span>
                  {selectedExclusionAssets.length ? (
                    <button type="button" className={styles.secondaryButton} onClick={() => setSelectedExclusionAssetIds([])}>Clear selection</button>
                  ) : null}
                  <button type="button" className={styles.secondaryButton} onClick={closeModal}>Close</button>
                  <button type="button" className={styles.primaryButton} onClick={openExclusionEditor} disabled={!selectedExclusionAssets.length}>
                    {selectedExclusionAssets.length
                      ? exclusionSelectionAction === 'exclude'
                        ? `Review exclusions (${selectedExclusionAssets.length})`
                        : `Review inclusions (${selectedExclusionAssets.length})`
                      : 'Review selection'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'fuel-slip-menu' ? (
        <div className={styles.fuelSlipFlowBackdrop} data-website-overlay role="dialog" aria-modal="true" aria-label="Fuel slips">
          <div
            className={`${styles.downloadModal} ${styles.sourceChoiceModal} ${styles.fuelSlipChoiceModal} ${styles.fuelSlipMenuModal}`}
            data-fuel-slip-choice-modal="menu"
          >
            <div className={styles.modalHeader}>
              <div>
                <h2>Fuel slips</h2>
                <p>Review saved fuel slips or add one to an included asset or storage tank.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close fuel slips"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.sourceChoiceGrid}>
              <button type="button" className={`${styles.sourceChoiceOption} ${styles.fuelSlipChoiceOption}`} onClick={openFuelSlipManager}>
                <span className={styles.choiceGraphic}>
                  <FuelSlipsIcon />
                </span>
                <span className={styles.choiceTitleBlock}>
                  <strong>Manage fuel slips</strong>
                  <small>Review, download or void saved slips.</small>
                </span>
                <span className={styles.fuelSlipChoiceArrow} aria-hidden="true">
                  <ChevronRightIcon />
                </span>
              </button>
              <button type="button" className={`${styles.sourceChoiceOption} ${styles.fuelSlipChoiceOption}`} onClick={() => openFuelSlipModal()}>
                <span className={styles.choiceGraphic}>
                  <PlusIcon />
                </span>
                <span className={styles.choiceTitleBlock}>
                  <strong>Add fuel slip</strong>
                  <small>Capture a new slip manually or from a file.</small>
                </span>
                <span className={styles.fuelSlipChoiceArrow} aria-hidden="true">
                  <ChevronRightIcon />
                </span>
              </button>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'fuel-slip-manager' ? (
        <div className={`${styles.fuelSlipFlowBackdrop} ${styles.fuelSlipManagerBackdrop}`} data-website-overlay>
          <div
            className={`${styles.fuelSlipManagerModal} ${wizardStyles.dialog}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fuel-slip-manager-title"
            aria-hidden={isFuelSlipManagerChildDialogOpen ? true : undefined}
          >
            <div className={`${styles.fuelSlipManagerHeader} ${wizardStyles.header}`}>
              <div className={`${wizardStyles.headerText} ${styles.fuelSlipManagerHeaderCopy}`}>
                <h2 id="fuel-slip-manager-title">Manage fuel slips</h2>
                <p>Search, filter, review and download saved fuel slips.</p>
              </div>
              <button type="button" className={`${styles.closeButton} ${wizardStyles.closeButton}`} onClick={closeModal} aria-label="Close manage fuel slips"><CloseIcon /></button>
            </div>

            <div className={`${styles.fuelSlipManagerBody} ${wizardStyles.body}`}>
              <section className={styles.fuelSlipManagerToolbar} aria-label="Fuel slip manager controls">
                <label className={styles.searchWrap}>
                  <SearchIcon className={styles.searchIcon} />
                  <input
                    type="search"
                    className={styles.searchInput}
                    value={fuelSlipManagerSearch}
                    onChange={(event) => setFuelSlipManagerSearch(event.target.value)}
                    placeholder="Search supplier, target, slip or transaction number..."
                    aria-label="Search saved fuel slips"
                  />
                  {fuelSlipManagerSearch.trim() ? (
                    <button type="button" className={styles.clearSearchButton} onClick={() => setFuelSlipManagerSearch('')} aria-label="Clear fuel slip search">
                      ×
                    </button>
                  ) : null}
                </label>

                <div className={styles.fuelSlipManagerToolbarButtons}>
                  {!isAccountantReadOnly ? (
                    <button type="button" className={`${styles.secondaryButton} ${styles.fuelSlipManagerToolbarButton} ${styles.fuelSlipManagerAddButton}`} onClick={() => openFuelSlipModal(true)}>
                      <PlusIcon className={styles.buttonIcon} />
                      <span>Add fuel slip</span>
                    </button>
                  ) : null}
                  <button type="button" className={`${styles.secondaryButton} ${styles.fuelSlipManagerToolbarButton} ${styles.fuelSlipManagerFilterButton}`} onClick={openFuelSlipManagerFilterPanel}>
                    <FilterIcon className={styles.buttonIcon} />
                    <span>Filter</span>
                    {activeFuelSlipManagerFilterCount ? <strong>{activeFuelSlipManagerFilterCount}</strong> : null}
                  </button>
                  <button
                    type="button"
                    className={`${styles.primaryButton} ${styles.fuelSlipManagerToolbarButton} ${styles.fuelSlipManagerDownloadButton}`}
                    onClick={openFuelSlipDownloadPanel}
                    disabled={!recentFuelSlips.length || isDownloadingFuelSlips}
                  >
                    <DownloadIcon className={styles.buttonIcon} />
                    <span>Download</span>
                  </button>
                </div>
              </section>

              <section className={styles.fuelSlipManagerContextBar} aria-label="Current fuel slip view">
                <div className={styles.fuelSlipManagerContextLead}>
                  <span className={styles.fuelSlipManagerContextIcon} aria-hidden="true"><FilterIcon /></span>
                  <span className={styles.fuelSlipManagerContextCopy}>
                    <strong>{activeFuelSlipManagerRefinementCount ? 'Refined view' : 'All saved slips'}</strong>
                    <small>{activeFuelSlipManagerRefinementCount
                      ? `${activeFuelSlipManagerRefinementCount} active ${activeFuelSlipManagerRefinementCount === 1 ? 'search or filter' : 'searches and filters'}`
                      : recentFuelSlips.length >= 2000
                        ? 'Latest 2,000 loaded slips'
                        : `${recentFuelSlips.length.toLocaleString('en-ZA')} loaded ${recentFuelSlips.length === 1 ? 'slip' : 'slips'}`}</small>
                  </span>
                </div>
                {activeFuelSlipManagerRefinementCount ? (
                  <div className={styles.fuelSlipManagerContextChips} role="group" aria-label="Active fuel slip search and filters">
                    {fuelSlipManagerSearch.trim() ? (
                      <button type="button" title={fuelSlipManagerSearch.trim()} onClick={() => setFuelSlipManagerSearch('')} aria-label={`Remove search for ${fuelSlipManagerSearch.trim()}`}>
                        <span>Search: “{fuelSlipManagerSearch.trim()}”</span>
                        <strong aria-hidden="true">×</strong>
                      </button>
                    ) : null}
                    {activeFuelSlipManagerFilterChips.map((chip) => (
                      <button type="button" key={chip.id} title={chip.label} onClick={() => removeFuelSlipManagerFilter(chip.id)} aria-label={`Remove ${chip.label} filter`}>
                        <span>{chip.label}</span>
                        <strong aria-hidden="true">×</strong>
                      </button>
                    ))}
                  </div>
                ) : null}
                {activeFuelSlipManagerRefinementCount ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFuelSlipManagerSearch('');
                      clearFuelSlipManagerFilters();
                    }}
                  >
                    Clear all
                  </button>
                ) : null}
              </section>

              <section className={styles.fuelSlipManagerPanel} aria-label="Saved fuel slips">
                <div className={styles.fuelSlipManagerSummary}>
                  <div className={styles.fuelSlipManagerResultCopy} aria-live="polite">
                    <strong>{visibleFuelSlipManagerSlips.length.toLocaleString('en-ZA')} {visibleFuelSlipManagerSlips.length === 1 ? 'fuel slip' : 'fuel slips'}</strong>
                    <span>{visibleFuelSlipManagerSlips.length
                      ? `Showing ${fuelSlipManagerResultStart.toLocaleString('en-ZA')}–${fuelSlipManagerResultEnd.toLocaleString('en-ZA')} of ${visibleFuelSlipManagerSlips.length.toLocaleString('en-ZA')}`
                      : 'Adjust the search or filters to see more results.'}</span>
                    {fuelSlipManagerIncompleteTotalCount ? (
                      <small>{fuelSlipManagerIncompleteTotalCount.toLocaleString('en-ZA')} incomplete {fuelSlipManagerIncompleteTotalCount === 1 ? 'slip has' : 'slips have'} missing values that are not included in the totals.</small>
                    ) : null}
                  </div>
                  <div className={styles.fuelSlipManagerTotals} aria-label="Totals for matching fuel slips">
                    <span>
                      <small>Recorded litres</small>
                      <strong>{formatLitres(fuelSlipManagerFilteredTotals.litres)}</strong>
                    </span>
                    <span>
                      <small>Recorded amount</small>
                      <strong>{formatCurrency(fuelSlipManagerFilteredTotals.amount)}</strong>
                    </span>
                  </div>
                </div>

                <div className={styles.fuelSlipManagerTableHeader} aria-hidden="true">
                  <span>Date</span>
                  <span>Supplier &amp; target</span>
                  <span>Fuel</span>
                  <span>Litres</span>
                  <span>Total</span>
                  <span>Status</span>
                  <span>Details</span>
                </div>

                <div className={styles.fuelSlipManagerList} ref={fuelSlipManagerListRef}>
                  {isLoading ? <div className={styles.fuelSlipManagerEmptyState}>Loading saved fuel slips...</div> : null}

                  {!isLoading && !recentFuelSlips.length ? (
                    <div className={styles.fuelSlipManagerEmptyState}>
                      <strong>No fuel slips yet</strong>
                      <span>Add the first slip to start building a searchable fuel history.</span>
                      {!isAccountantReadOnly ? (
                        <button type="button" className={styles.primaryButton} onClick={() => openFuelSlipModal(true)}>
                          <PlusIcon className={styles.buttonIcon} />
                          <span>Add fuel slip</span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {!isLoading && recentFuelSlips.length > 0 && !visibleFuelSlipManagerSlips.length ? (
                    <div className={styles.fuelSlipManagerEmptyState}>
                      <strong>No matching fuel slips</strong>
                      <span>Try a different supplier, asset, date or status.</span>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => {
                          setFuelSlipManagerSearch('');
                          clearFuelSlipManagerFilters();
                        }}
                      >
                        Show all fuel slips
                      </button>
                    </div>
                  ) : null}

                  {!isLoading ? paginatedFuelSlipManagerSlips.map((slip) => {
                    const updatedLabel = slip.updatedAtIso ? `Updated ${formatFuelSlipDateTime(slip.updatedAtIso)}` : '';
                    const cardEndingLabel = formatCardEnding(slip.cardLast4 || slip.cardNumberMasked);
                    const needsReview = fuelSlipNeedsReview(slip);
                    const deletingThisSlip = busyFuelSlipDeleteId === slip.id;
                    const isExpanded = expandedFuelSlipId === slip.id;
                    const detailsId = `fuel-slip-manager-details-${slip.id}`;

                    return (
                      <article
                        className={styles.fuelSlipManagerRow}
                        key={slip.id}
                        data-expanded={isExpanded ? 'true' : undefined}
                        aria-label={`${slip.supplierName || 'Unknown supplier'} fuel slip`}
                      >
                        <div className={styles.fuelSlipManagerRowMain}>
                          <span className={styles.fuelSlipManagerDate} aria-label={`Date: ${formatFuelSlipDate(slip.documentDate)}. ${slip.slipNumber ? `Slip number: ${slip.slipNumber}` : `Target type: ${fuelSlipTargetTypeLabel(slip)}`}`}>
                            <strong>{formatFuelSlipDate(slip.documentDate)}</strong>
                            <small>{slip.slipNumber ? `Slip ${slip.slipNumber}` : fuelSlipTargetTypeLabel(slip)}</small>
                          </span>
                          <span className={styles.fuelSlipManagerIdentity} aria-label={`Supplier: ${slip.supplierName || 'Unknown supplier'}. Target: ${fuelSlipTargetLabel(slip)}`}>
                            <strong>{slip.supplierName || 'Unknown supplier'}</strong>
                            <small>{fuelSlipTargetLabel(slip)}</small>
                          </span>
                          <span className={styles.fuelSlipManagerMetric} aria-label={`Fuel: ${slip.fuelType || 'Not recorded'}. Price per litre: ${slip.pricePerLitre !== null ? formatCurrency(slip.pricePerLitre) : 'Not recorded'}`}>
                            <strong>{slip.fuelType || 'Not recorded'}</strong>
                            <small>{slip.pricePerLitre !== null ? `${formatCurrency(slip.pricePerLitre)}/L` : 'No unit price'}</small>
                          </span>
                          <span className={styles.fuelSlipManagerMetric} aria-label={`Litres: ${formatLitres(slip.litres)}`}>
                            <strong>{formatLitres(slip.litres)}</strong>
                            <small>Quantity</small>
                          </span>
                          <span className={`${styles.fuelSlipManagerMetric} ${styles.fuelSlipManagerAmount}`} aria-label={`Total amount: ${formatCurrency(slip.totalAmount)}`}>
                            <strong>{formatCurrency(slip.totalAmount)}</strong>
                            <small>Total amount</small>
                          </span>
                          {needsReview && !isAccountantReadOnly ? (
                            <button
                              type="button"
                              className={`${styles.fuelSlipManagerStatusBadge} ${styles.fuelSlipManagerStatusReview} ${styles.fuelSlipManagerStatusAction}`}
                              onClick={() => openFuelSlipReview(slip)}
                              aria-label={`Review incomplete fuel slip from ${slip.supplierName || 'unknown supplier'} on ${formatFuelSlipDate(slip.documentDate)}`}
                            >
                              Review needed
                            </button>
                          ) : (
                            <span className={`${styles.fuelSlipManagerStatusBadge} ${needsReview ? styles.fuelSlipManagerStatusReview : ''}`} aria-label={`Status: ${fuelSlipStatusLabel(slip)}`}>
                              {fuelSlipStatusLabel(slip)}
                            </span>
                          )}
                          <button
                            type="button"
                            className={styles.fuelSlipManagerExpandButton}
                            onClick={() => setExpandedFuelSlipId((current) => current === slip.id ? null : slip.id)}
                            aria-expanded={isExpanded}
                            aria-controls={detailsId}
                            aria-label={`${isExpanded ? 'Hide' : 'View'} details for ${slip.supplierName || 'unknown supplier'} on ${formatFuelSlipDate(slip.documentDate)}`}
                          >
                            <span>{isExpanded ? 'Hide' : 'View'}</span>
                            <ChevronDownIcon aria-hidden="true" />
                          </button>
                        </div>

                        {isExpanded ? (
                          <div className={styles.fuelSlipManagerExpanded} id={detailsId}>
                            <div className={styles.fuelSlipManagerSecondaryGrid}>
                              <span>
                                <small>Target type</small>
                                <strong>{fuelSlipTargetTypeLabel(slip)}</strong>
                              </span>
                              <span>
                                <small>Card</small>
                                <strong>{cardEndingLabel || 'Not recorded'}</strong>
                              </span>
                              <span>
                                <small>Work use</small>
                                <strong>{slip.workUseExcluded ? 'Excluded' : 'Included'}</strong>
                              </span>
                              <span>
                                <small>Last updated</small>
                                <strong>{updatedLabel || 'Saved fuel slip'}</strong>
                              </span>
                              <span>
                                <small>Slip / reference</small>
                                <strong>{slip.slipNumber || 'Not recorded'}</strong>
                              </span>
                              <span>
                                <small>Transaction</small>
                                <strong>{slip.transactionNumber || 'Not recorded'}</strong>
                              </span>
                            </div>
                            <div className={styles.fuelSlipManagerRowActions}>
                              {slip.documentFileUrl ? (
                                <DocumentFileLink className={`${styles.secondaryButton} ${styles.fuelSlipManagerOpenButton}`} href={withAccountantShare(slip.documentFileUrl, accountantShareId, accountantRegisterId)} fuelDocument fuelSource={slip.documentFileUrl} target="_blank" rel="noreferrer">
                                  <OpenFileIcon className={styles.buttonIcon} />
                                  <span>Open file</span>
                                </DocumentFileLink>
                              ) : null}
                              <button
                                type="button"
                                className={`${styles.secondaryButton} ${styles.fuelSlipManagerOpenButton}`}
                                onClick={() => void openFuelSlipHistory(slip)}
                                disabled={deletingThisSlip}
                              >
                                <HistoryIcon className={styles.buttonIcon} />
                                <span>Change history</span>
                              </button>
                              {!isAccountantReadOnly ? (
                                <>
                                  {needsReview ? (
                                    <button
                                      type="button"
                                      className={`${styles.secondaryButton} ${styles.fuelSlipManagerReviewButton}`}
                                      onClick={() => openFuelSlipReview(slip)}
                                      disabled={deletingThisSlip}
                                    >
                                      <FuelSlipsIcon className={styles.buttonIcon} />
                                      <span>Review / complete</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className={`${styles.secondaryButton} ${styles.fuelSlipManagerEditButton}`}
                                      onClick={() => openFuelSlipReview(slip)}
                                      disabled={deletingThisSlip}
                                    >
                                      <EditIcon className={styles.buttonIcon} />
                                      <span>Edit</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className={`${styles.secondaryButton} ${styles.fuelSlipManagerDeleteButton}`}
                                    onClick={() => openFuelSlipDeleteConfirm(slip)}
                                    disabled={deletingThisSlip}
                                  >
                                    <TrashIcon className={styles.buttonIcon} />
                                    <span>{deletingThisSlip ? 'Voiding...' : 'Void'}</span>
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  }) : null}
                </div>

                {!isLoading && shouldShowFuelSlipManagerPagination ? (
                  <nav className={styles.fuelSlipManagerPaginationRow} aria-label="Fuel slips pagination">
                    <button
                      type="button"
                      className={styles.fuelSlipManagerPaginationButton}
                      onClick={() => setCurrentFuelSlipManagerPage(1)}
                      disabled={safeFuelSlipManagerPage <= 1}
                    >
                      First
                    </button>
                    <button
                      type="button"
                      className={styles.fuelSlipManagerPaginationButton}
                      onClick={() => setCurrentFuelSlipManagerPage((page) => Math.max(1, page - 1))}
                      disabled={safeFuelSlipManagerPage <= 1}
                    >
                      Previous
                    </button>
                    <span className={styles.fuelSlipManagerPaginationStatus}>Page {safeFuelSlipManagerPage.toLocaleString('en-ZA')} of {totalFuelSlipManagerPages.toLocaleString('en-ZA')}</span>
                    <button
                      type="button"
                      className={styles.fuelSlipManagerPaginationButton}
                      onClick={() => setCurrentFuelSlipManagerPage((page) => Math.min(totalFuelSlipManagerPages, page + 1))}
                      disabled={safeFuelSlipManagerPage >= totalFuelSlipManagerPages}
                    >
                      Next
                    </button>
                    <button
                      type="button"
                      className={styles.fuelSlipManagerPaginationButton}
                      onClick={() => setCurrentFuelSlipManagerPage(totalFuelSlipManagerPages)}
                      disabled={safeFuelSlipManagerPage >= totalFuelSlipManagerPages}
                    >
                      Last
                    </button>
                  </nav>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'fuel-slip-manager' && fuelSlipManagerFilterOpen ? (
        <div className={styles.fuelSlipSubModalBackdrop} data-website-overlay>
          <div className={`${styles.fuelSlipFilterModal} ${styles.fuelSlipManagerFilterModal}`} ref={fuelSlipManagerChildDialogRef} role="dialog" aria-modal="true" aria-labelledby="fuel-slip-filter-title" aria-describedby="fuel-slip-filter-description">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="fuel-slip-filter-title">Filter fuel slips</h2>
                <p id="fuel-slip-filter-description">Narrow the Fuel Ledger by target, source and slip period.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeFuelSlipManagerFilterPanel} aria-label="Close fuel slip filters"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.fuelSlipFilterGrid}>
              <FuelSlipFilterDropdown
                label="Target"
                dropdownKey="target"
                value={draftFuelSlipManagerFilters.targetKey}
                options={fuelSlipManagerTargetOptions}
                openDropdown={openFuelSlipManagerFilterSelect}
                searchable
                searchValue={fuelSlipManagerTargetSearch}
                searchPlaceholder="Search saved assets or storage tanks"
                noMatchesLabel="No matching targets found"
                onOpenChange={setOpenFuelSlipManagerFilterSelect}
                onSearchChange={setFuelSlipManagerTargetSearch}
                onChange={(value) => setDraftFuelSlipManagerFilters((current) => ({ ...current, targetKey: value }))}
              />

              <FuelSlipFilterDropdown
                label="Source / status"
                dropdownKey="capture"
                value={draftFuelSlipManagerFilters.capture}
                options={FUEL_SLIP_CAPTURE_FILTER_OPTIONS}
                openDropdown={openFuelSlipManagerFilterSelect}
                onOpenChange={setOpenFuelSlipManagerFilterSelect}
                onChange={(value) => setDraftFuelSlipManagerFilters((current) => ({ ...current, capture: value as FuelSlipCaptureFilter }))}
              />

              <FuelSlipFilterDropdown
                label="Year"
                dropdownKey="year"
                value={draftFuelSlipManagerFilters.year}
                options={fuelSlipManagerYearOptions}
                openDropdown={openFuelSlipManagerFilterSelect}
                onOpenChange={setOpenFuelSlipManagerFilterSelect}
                onChange={(value) => setDraftFuelSlipManagerFilters((current) => ({ ...current, year: value }))}
              />

              <FuelSlipFilterDropdown
                label="Month"
                dropdownKey="month"
                value={draftFuelSlipManagerFilters.month}
                options={fuelSlipManagerMonthOptions}
                openDropdown={openFuelSlipManagerFilterSelect}
                onOpenChange={setOpenFuelSlipManagerFilterSelect}
                onChange={(value) => setDraftFuelSlipManagerFilters((current) => ({ ...current, month: value }))}
              />
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeFuelSlipManagerFilterPanel}>Close</button>
              <button type="button" className={styles.secondaryButton} onClick={clearFuelSlipManagerFilters}>Clear filters</button>
              <button type="button" className={styles.primaryButton} onClick={applyFuelSlipManagerFilters}>Apply filters</button>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'fuel-slip-manager' && fuelSlipDownloadOpen ? (
        <div className={styles.fuelSlipSubModalBackdrop} data-website-overlay>
          <div className={styles.fuelSlipFilterModal} ref={fuelSlipManagerChildDialogRef} role="dialog" aria-modal="true" aria-labelledby="fuel-slip-download-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="fuel-slip-download-title">Download fuel slips</h2>
                <p>{fuelSlipManagerSearch.trim()
                  ? `Exports loaded slips matching “${fuelSlipManagerSearch.trim()}” and the filters below.`
                  : 'Choose filters for the loaded slips you want to export.'}</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeFuelSlipDownloadPanel} aria-label="Close fuel slip download"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.fuelSlipFilterGrid}>
              <FuelSlipFilterDropdown
                label="Target"
                dropdownKey="target"
                value={draftFuelSlipDownloadFilters.targetKey}
                options={fuelSlipManagerTargetOptions}
                openDropdown={openFuelSlipDownloadSelect}
                searchable
                searchValue={fuelSlipDownloadTargetSearch}
                searchPlaceholder="Search saved assets or storage tanks"
                noMatchesLabel="No matching targets found"
                onOpenChange={setOpenFuelSlipDownloadSelect}
                onSearchChange={setFuelSlipDownloadTargetSearch}
                onChange={(value) => {
                  setFuelSlipDownloadError('');
                  setDraftFuelSlipDownloadFilters((current) => ({ ...current, targetKey: value }));
                }}
              />

              <FuelSlipFilterDropdown
                label="Source / status"
                dropdownKey="capture"
                value={draftFuelSlipDownloadFilters.capture}
                options={FUEL_SLIP_CAPTURE_FILTER_OPTIONS}
                openDropdown={openFuelSlipDownloadSelect}
                onOpenChange={setOpenFuelSlipDownloadSelect}
                onChange={(value) => {
                  setFuelSlipDownloadError('');
                  setDraftFuelSlipDownloadFilters((current) => ({ ...current, capture: value as FuelSlipCaptureFilter }));
                }}
              />

              <FuelSlipFilterDropdown
                label="Year"
                dropdownKey="year"
                value={draftFuelSlipDownloadFilters.year}
                options={fuelSlipManagerYearOptions}
                openDropdown={openFuelSlipDownloadSelect}
                onOpenChange={setOpenFuelSlipDownloadSelect}
                onChange={(value) => {
                  setFuelSlipDownloadError('');
                  setDraftFuelSlipDownloadFilters((current) => ({ ...current, year: value }));
                }}
              />

              <FuelSlipFilterDropdown
                label="Month"
                dropdownKey="month"
                value={draftFuelSlipDownloadFilters.month}
                options={fuelSlipManagerMonthOptions}
                openDropdown={openFuelSlipDownloadSelect}
                onOpenChange={setOpenFuelSlipDownloadSelect}
                onChange={(value) => {
                  setFuelSlipDownloadError('');
                  setDraftFuelSlipDownloadFilters((current) => ({ ...current, month: value }));
                }}
              />
            </div>
            {fuelSlipDownloadError ? (
              <p className={styles.fuelSlipDownloadError}>{fuelSlipDownloadError}</p>
            ) : null}
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeFuelSlipDownloadPanel}>Close</button>
              <button type="button" className={styles.secondaryButton} onClick={clearFuelSlipDownloadFilters}>Clear filters</button>
              <button type="button" className={styles.primaryButton} onClick={handleFuelSlipDownload} disabled={isDownloadingFuelSlips}>Download</button>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'fuel-slip-manager' && historyFuelSlip ? (
        <div className={styles.fuelSlipSubModalBackdrop} data-website-overlay>
          <div className={`${styles.fuelSlipFilterModal} ${styles.fuelHistoryModal}`} ref={fuelSlipManagerChildDialogRef} role="dialog" aria-modal="true" aria-labelledby="fuel-slip-history-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="fuel-slip-history-title">Change history</h2>
                <p>{historyFuelSlip.supplierName || 'Fuel slip'} · {formatFuelSlipDate(historyFuelSlip.documentDate)}</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeFuelSlipHistory} aria-label="Close change history"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.fuelHistoryList}>
              {isFuelHistoryLoading ? <div className={styles.fuelSlipManagerEmptyState}>Loading change history...</div> : null}
              {fuelHistoryError ? <div className={`${styles.exclusionNotice} ${styles.noticeError}`}>{fuelHistoryError}</div> : null}
              {!isFuelHistoryLoading && !fuelHistoryError && !fuelHistoryEvents.length ? (
                <div className={styles.fuelSlipManagerEmptyState}>No recorded changes yet.</div>
              ) : null}
              {fuelHistoryEvents.map((event) => (
                <article className={styles.fuelHistoryRow} key={event.id}>
                  <div>
                    <strong>{event.action === 'created' ? 'Created' : event.action === 'updated' ? 'Corrected' : event.action === 'voided' ? 'Voided' : event.action}</strong>
                    <span>{formatFuelSlipDateTime(event.createdAtIso)}</span>
                  </div>
                  <p>{event.actorName || event.actorEmail || 'Account user'}{event.reason ? ` · ${event.reason}` : ''}</p>
                </article>
              ))}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeFuelSlipHistory}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'fuel-slip-manager' && deleteCandidateFuelSlip ? (
        <div className={`${styles.modalOverlay} ${styles.confirmDeleteOverlay} ${styles.fuelSlipDeleteOverlay}`} data-website-overlay>
          <div className={styles.deleteConfirmModal} ref={fuelSlipManagerChildDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="fuel-slip-delete-title" aria-describedby="fuel-slip-delete-copy">
            <button
              type="button"
              className={styles.deleteConfirmCloseButton}
              onClick={() => setDeleteCandidateFuelSlip(null)}
              aria-label="Close void fuel slip confirmation"
              disabled={busyFuelSlipDeleteId === deleteCandidateFuelSlip.id}
            >
              ×
            </button>

            <div className={styles.deleteConfirmContent}>
              <h3 id="fuel-slip-delete-title">Void this fuel slip?</h3>
              <p id="fuel-slip-delete-copy">
                The active posting will be reversed, but the original slip and who changed it remain in Change History.
              </p>

              <div className={styles.deleteConfirmAsset}>
                <span>Selected fuel slip</span>
                <strong>Supplier: {deleteCandidateFuelSlip.supplierName || 'Unknown supplier'}</strong>
                <small>
                  Target: {fuelSlipTargetLabel(deleteCandidateFuelSlip)} · Date: {formatFuelSlipDate(deleteCandidateFuelSlip.documentDate)} · Litres: {formatLitres(deleteCandidateFuelSlip.litres)} · Total amount: {formatCurrency(deleteCandidateFuelSlip.totalAmount)}
                </small>
              </div>

              <div className={styles.deleteConfirmActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setDeleteCandidateFuelSlip(null)} disabled={busyFuelSlipDeleteId === deleteCandidateFuelSlip.id}>
                  Cancel
                </button>

                <button type="button" className={`${styles.primaryButton} ${styles.deleteConfirmButton}`} onClick={confirmVoidFuelSlip} disabled={busyFuelSlipDeleteId === deleteCandidateFuelSlip.id}>
                  <span>{busyFuelSlipDeleteId === deleteCandidateFuelSlip.id ? 'Voiding...' : 'Yes, void slip'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'fuel-slip' && fuelSlipFlow === 'source-choice' ? (
        <div className={styles.fuelSlipFlowBackdrop} data-website-overlay role="dialog" aria-modal="true" aria-label="Add fuel slip">
          <div
            className={`${styles.downloadModal} ${styles.sourceChoiceModal} ${styles.fuelSlipChoiceModal} ${styles.fuelSlipAddModal}`}
            data-fuel-slip-choice-modal="add"
          >
            <div className={styles.modalHeader}>
              <div>
                <h2>Add fuel slip</h2>
                <p>{quickLaunchAsset
                  ? `Save this fuel slip against ${quickLaunchAsset.title}. Choose how you want to capture it.`
                  : 'Choose how to capture a fuel slip for an included asset or storage tank.'}</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => closeFuelSlipFlow()} aria-label="Close add fuel slip"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.sourceChoiceGrid}>
              <button type="button" className={`${styles.sourceChoiceOption} ${styles.fuelSlipChoiceOption}`} onClick={() => startFuelSlipFlow('manual')}>
                <span className={styles.choiceGraphic}>
                  <ManualFuelSlipIcon />
                </span>
                <span className={styles.choiceTitleBlock}>
                  <strong>Enter slip manually</strong>
                  <small>Enter supplier, date, litres and amount yourself.</small>
                </span>
                <span className={styles.fuelSlipChoiceArrow} aria-hidden="true">
                  <ChevronRightIcon />
                </span>
              </button>
              <button type="button" className={`${styles.sourceChoiceOption} ${styles.fuelSlipChoiceOption}`} onClick={() => startFuelSlipFlow('automatic')}>
                <span className={styles.choiceGraphic}>
                  <AutomaticFuelSlipIcon />
                </span>
                <span className={styles.choiceTitleBlock}>
                  <strong>Upload for Aim4price capture</strong>
                  <small>Upload a photo or PDF for capture within 24 hours.</small>
                </span>
                <span className={styles.fuelSlipChoiceArrow} aria-hidden="true">
                  <ChevronRightIcon />
                </span>
              </button>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => closeFuelSlipFlow()}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'fuel-slip' && (fuelSlipFlow === 'target-manual' || fuelSlipFlow === 'target-automatic') ? (
        <div className={styles.fuelSlipFlowBackdrop} data-website-overlay role="dialog" aria-modal="true" aria-label={fuelSlipTargetPickerTitle}>
          <div className={styles.assetModal} data-asset-choice-surface="true" data-asset-choice-modal="true">
            <div className={styles.modalHeader} data-asset-choice-header="true">
              <div>
                <h2>{fuelSlipTargetPickerTitle}</h2>
                <p>Select an included asset or the storage tank this fuel slip belongs to.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => closeFuelSlipFlow()} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.pickerToolbar} data-asset-choice-toolbar="true">
              <input
                value={fuelSlipPickerSearch}
                onChange={(event) => setFuelSlipPickerSearch(event.target.value)}
                placeholder="Search assets or storage tanks..."
                aria-label="Search assets or storage tanks"
              />
              <button type="button" className={styles.secondaryButton} onClick={() => setFuelSlipPickerSearch('')}>Clear</button>
            </div>
            <div className={styles.assetList} data-asset-choice-list="true">
              {isLoading ? (
                <div className={styles.emptyState}>Loading assets and storage tanks...</div>
              ) : filteredFuelSlipAssets.length || filteredFuelSlipStorages.length ? (
                <>
                  {filteredFuelSlipAssets.map((asset) => (
                    <button
                      type="button"
                      key={`asset-${asset.id}`}
                      className={styles.assetRow}
                      data-asset-choice-row="true"
                      onClick={() => selectFuelSlipTarget(`asset:${asset.id}`)}
                    >
                      <span className={styles.assetInfo} data-asset-choice-copy="true">
                        <strong>{asset.title}</strong>
                        <small data-asset-choice-meta="true">{fuelSlipAssetMeta(asset) || 'Asset details not set'}</small>
                        <small data-asset-choice-secondary="true">{fuelSlipAssetDetail(asset)}</small>
                      </span>
                      <span className={styles.assetValue} data-asset-choice-value="true">
                        <strong>{formatCurrency(asset.currentValue)}</strong>
                        <small>current value</small>
                      </span>
                    </button>
                  ))}
                  {filteredFuelSlipStorages.map((storage) => (
                    <button
                      type="button"
                      key={`storage-${storage.id}`}
                      className={`${styles.assetRow} ${styles.storageTargetRow}`}
                      data-asset-choice-row="true"
                      onClick={() => selectFuelSlipTarget(`storage_tank:${storage.id}`)}
                    >
                      <span className={styles.assetInfo} data-asset-choice-copy="true">
                        <strong>{storage.name}</strong>
                        <small data-asset-choice-meta="true">{fuelSlipStorageMeta(storage)}</small>
                        <small data-asset-choice-secondary="true">Storage tank{storage.locationLabel ? ` · ${storage.locationLabel}` : ''}</small>
                      </span>
                      <span className={styles.assetValue} data-asset-choice-value="true">
                        <strong>{formatLitres(storage.currentLitres)}</strong>
                        <small>available</small>
                      </span>
                    </button>
                  ))}
                </>
              ) : <div className={styles.emptyState}>No matching assets or storage tanks found.</div>}
            </div>
            <div className={styles.modalFooter} data-asset-choice-footer="true">
              <button type="button" className={styles.secondaryButton} onClick={() => closeFuelSlipFlow()}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'fuel-slip' && fuelSlipFlow === 'upload' ? (
        <div className={styles.fuelSlipFlowBackdrop} data-website-overlay role="dialog" aria-modal="true" aria-labelledby="fuel-slip-upload-title">
          <div className={`${styles.formModal} ${styles.costUploadModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h2 id="fuel-slip-upload-title">Upload fuel slip/photo</h2>
                <p>{selectedFuelSlipTargetName} · Aim4price assisted capture</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => closeFuelSlipFlow()} aria-label="Close" disabled={isExtractingFuelSlip}><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.formModalScrollBody}>
              <section className={styles.uploadPanel}>
                <h3>Documents and photos</h3>
                <div className={`${styles.uploadBox} ${fuelSlipUploadReady ? styles.uploadBoxReady : ''}`}>
                  <label className={styles.uploadButton}>
                    <UploadIcon />
                    Add fuel slip/photo
                    <input type="file" accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp" onChange={handleFuelSlipUploadChange} disabled={isSaving || isExtractingFuelSlip} />
                  </label>
                  <span className={styles.uploadCounter}>{fuelSlipUploadReady ? '1 / 1' : '0 / 1'}</span>
                  {fuelSlipUploadFileName ? <p>{fuelSlipUploadFileName}</p> : null}
                </div>
              </section>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={handleFuelSlipUploadBack} disabled={isExtractingFuelSlip}>Back</button>
              <button type="button" className={styles.primaryButton} onClick={handleFuelSlipExtract} disabled={!fuelSlipUploadFile || isExtractingFuelSlip}>
                {isExtractingFuelSlip ? 'Sending fuel slip/photo...' : 'Send for capture'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'fuel-slip' && fuelSlipFlow === 'manual-form' ? (
        <div className={`${styles.fuelSlipFlowBackdrop} ${wizardStyles.overlay}`} data-website-overlay>
          <form className={`${styles.formModal} ${styles.costFormModal} ${styles.fuelSlipCostFormModal} ${styles.fuelSlipWizardModal} ${wizardStyles.dialog}`} onSubmit={preventFuelSlipImplicitSubmit} role="dialog" aria-modal="true" aria-labelledby="fuel-slip-manual-title">
            <div className={`${styles.modalHeader} ${wizardStyles.header}`}>
              <div className={wizardStyles.headerText}>
                <h2 id="fuel-slip-manual-title">Enter fuel slip manually</h2>
                <p>{fuelSlipFormSubtitle} · {fuelSlipFormPage === 'details' ? 'Slip details' : 'Usage and work details'}</p>
              </div>
              <button type="button" className={`${styles.closeButton} ${wizardStyles.closeButton}`} onClick={() => closeFuelSlipFlow()} aria-label="Close" disabled={isSaving}><CloseIcon /></button>
            </div>
            <div className={`${styles.modalDivider} ${wizardStyles.divider}`} />
            <div key={fuelSlipFormPage} className={`${styles.formModalScrollBody} ${wizardStyles.body}`} data-fuel-slip-scroll-body="true">
              <p className={wizardStyles.intro}>Complete one short step at a time. Your fuel slip is saved on the final step.</p>
              {renderFuelSlipWizardProgress()}
              <section className={`${styles.fuelSlipWizardPanel} ${wizardStyles.panel}`}>
                <div className={`${styles.fuelSlipWizardHeading} ${wizardStyles.panelHeading}`}>
                  <span className={wizardStyles.panelNumber} aria-hidden="true">{fuelSlipFormPage === 'details' ? 1 : 2}</span>
                  <h3>{fuelSlipFormPage === 'details' ? 'Add the slip details' : 'Add usage and work details'}</h3>
                  <p>{fuelSlipFormPage === 'details'
                    ? 'Capture the supplier, date, fuel and totals.'
                    : 'Record the reading, operator and work context.'}</p>
                </div>
                {renderFuelSlipValidationNotice()}
                {fuelSlipFormPage === 'details' ? renderFuelSlipDetailsFields() : renderFuelSlipExtraFields()}
              </section>
            </div>
            <div className={`${styles.modalFooter} ${wizardStyles.footer}`}>
              <button type="button" className={`${styles.secondaryButton} ${wizardStyles.secondaryAction}`} onClick={handleFuelSlipFormBack} disabled={isSaving}>Back</button>
              {fuelSlipFormPage === 'details' ? (
                <button type="button" className={`${styles.primaryButton} ${wizardStyles.primaryAction}`} onClick={handleFuelSlipNextPage} disabled={isSaving}>Next</button>
              ) : (
                <button type="button" className={`${styles.primaryButton} ${wizardStyles.primaryAction}`} onClick={handleFuelSlipSaveClick} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save fuel slip'}</button>
              )}
            </div>
          </form>
        </div>
      ) : null}

      {modalMode === 'fuel-slip' && fuelSlipFlow === 'review' ? (
        <div className={`${styles.fuelSlipFlowBackdrop} ${wizardStyles.overlay}`} data-website-overlay>
          <form className={`${styles.formModal} ${styles.costFormModal} ${styles.fuelSlipCostFormModal} ${styles.fuelSlipReviewFormModal} ${styles.fuelSlipWizardModal} ${wizardStyles.dialog}`} onSubmit={preventFuelSlipImplicitSubmit} role="dialog" aria-modal="true" aria-labelledby="fuel-slip-review-title">
            <div className={`${styles.modalHeader} ${wizardStyles.header}`}>
              <div className={wizardStyles.headerText}>
                <h2 id="fuel-slip-review-title">{fuelSlipDraft.id ? 'Review / complete fuel slip' : 'Review fuel slip details'}</h2>
                <p>{fuelSlipFormSubtitle} · {fuelSlipFormPage === 'details' ? 'Slip details' : 'Usage and work details'}</p>
              </div>
              <button type="button" className={`${styles.closeButton} ${wizardStyles.closeButton}`} onClick={() => closeFuelSlipFlow()} aria-label="Close" disabled={isSaving}><CloseIcon /></button>
            </div>
            <div className={`${styles.modalDivider} ${wizardStyles.divider}`} />
            <div key={fuelSlipFormPage} className={`${styles.formModalScrollBody} ${wizardStyles.body}`} data-fuel-slip-scroll-body="true">
              <p className={wizardStyles.intro}>Check one short step at a time. Your changes are saved on the final step.</p>
              {renderFuelSlipWizardProgress()}
              <section className={`${styles.fuelSlipWizardPanel} ${wizardStyles.panel}`}>
                <div className={`${styles.fuelSlipWizardHeading} ${wizardStyles.panelHeading}`}>
                  <span className={wizardStyles.panelNumber} aria-hidden="true">{fuelSlipFormPage === 'details' ? 1 : 2}</span>
                  <h3>{fuelSlipFormPage === 'details' ? 'Check the slip details' : 'Check usage and work details'}</h3>
                  <p>{fuelSlipFormPage === 'details'
                    ? 'Confirm the supplier, date, fuel and totals.'
                    : 'Complete the reading, operator and work context.'}</p>
                </div>
                {renderFuelSlipValidationNotice()}

                {visibleFuelSlipExtractionWarnings.length ? (
                  <div className={styles.warningBox}>
                    {visibleFuelSlipExtractionWarnings.map((warning) => <p key={warning}>{warning}</p>)}
                  </div>
                ) : null}

                {fuelSlipFormPage === 'details' ? renderFuelSlipDetailsFields() : renderFuelSlipExtraFields()}

                {fuelSlipFormPage === 'details' && fuelSlipDraft.documentFileUrl ? (
                  <DocumentFileLink className={styles.fileLink} href={withAccountantShare(fuelSlipDraft.documentFileUrl, accountantShareId, accountantRegisterId)} fuelDocument={Boolean(fuelSlipDraft.id)} fuelSource={fuelSlipDraft.documentFileUrl} target="_blank" rel="noreferrer">Open attached fuel slip/photo: {fuelSlipDraft.originalFilename || 'Uploaded file'}</DocumentFileLink>
                ) : null}

                {fuelSlipFormPage === 'details' && fuelSlipDraft.rawExtractedText ? (
                  <details className={styles.rawPreview}>
                    <summary>Extracted slip text</summary>
                    <pre>{sanitizeFuelSlipSensitiveText(fuelSlipDraft.rawExtractedText)}</pre>
                  </details>
                ) : null}
              </section>
            </div>
            <div className={`${styles.modalFooter} ${wizardStyles.footer}`}>
              <button
                type="button"
                className={`${styles.secondaryButton} ${wizardStyles.secondaryAction}`}
                onClick={handleFuelSlipFormBack}
                disabled={isSaving}
              >
                Back
              </button>
              {fuelSlipFormPage === 'details' ? (
                <button type="button" className={`${styles.primaryButton} ${wizardStyles.primaryAction}`} onClick={handleFuelSlipNextPage} disabled={isSaving}>Next</button>
              ) : (
                <button type="button" className={`${styles.primaryButton} ${wizardStyles.primaryAction}`} onClick={handleFuelSlipSaveClick} disabled={isSaving}>{isSaving ? 'Saving...' : fuelSlipDraft.id ? 'Save changes' : 'Save fuel slip'}</button>
              )}
            </div>
          </form>
        </div>
      ) : null}

      {modalMode === 'create-storage' || modalMode === 'edit-storage' ? (
        <div className={styles.modalOverlay} data-website-overlay role="dialog" aria-modal="true">
          <form className={styles.modalCard} onSubmit={handleStorageSubmit}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{modalMode === 'create-storage' ? 'Add Fuel Storage' : selectedStorage?.name ?? 'Manage Fuel Storage'}</h2>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal}>×</button>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.storageNameField}>
                Storage name
                <input value={storageDraft.name} onChange={(event) => setStorageDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Main diesel tank" required />
              </label>
              <div className={styles.storageFuelTypeField}>
                <span>Fuel type</span>
                <StorageFuelTypeSelect value={storageDraft.fuelType} isOpen={isStorageFuelSelectOpen} onToggle={toggleStorageFuelSelect} onChange={selectStorageFuelType} />
              </div>
              <label>
                Capacity litres
                <input type="number" min="0" step="0.01" value={storageDraft.capacityLitres} onChange={(event) => setStorageDraft((current) => ({ ...current, capacityLitres: event.target.value }))} placeholder="10000" />
              </label>
              <label>
                Current litres
                <input type="number" min="0" step="0.01" value={storageDraft.currentLitres} onChange={(event) => setStorageDraft((current) => ({ ...current, currentLitres: event.target.value }))} placeholder="6500" />
              </label>
              <label>
                Reorder level
                <input type="number" min="0" step="0.01" value={storageDraft.reorderLevelLitres} onChange={(event) => setStorageDraft((current) => ({ ...current, reorderLevelLitres: event.target.value }))} placeholder="1500" />
              </label>
              <label className={styles.locationLabelField}>
                Location label
                <input value={storageDraft.locationLabel} onChange={(event) => setStorageDraft((current) => ({ ...current, locationLabel: event.target.value }))} placeholder="Yard / Workshop / Farm 1" />
              </label>
              {modalMode === 'create-storage' ? (
                <label>
                  QR PIN
                  <input value={storageDraft.pin} onChange={(event) => setStorageDraft((current) => ({ ...current, pin: event.target.value }))} placeholder="4 to 8 digits" inputMode="numeric" required />
                </label>
              ) : null}
              <label className={styles.fullField}>
                Notes
                <textarea value={storageDraft.notes} onChange={(event) => setStorageDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional storage notes" rows={2} />
              </label>
            </div>

            <div className={styles.fuelModalFooter}>
              <button type="button" className={styles.fuelModalCancelButton} onClick={closeModal} disabled={isSaving}>Cancel</button>
              {modalMode === 'edit-storage' ? (
                <button type="submit" className={styles.fuelModalPrimaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
              ) : (
                <button type="submit" className={styles.fuelModalPrimaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Storage'}</button>
              )}
            </div>
          </form>
        </div>
      ) : null}

      {modalMode === 'pin' && selectedStorage ? (
        <div className={styles.modalOverlay} data-website-overlay role="dialog" aria-modal="true">
          <form className={styles.modalCardSmall} onSubmit={handlePinSubmit}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{selectedStorage.name}</h2>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal}>×</button>
            </div>
            <label className={styles.pinField}>
              New PIN
              <input value={pinDraft} onChange={(event) => setPinDraft(event.target.value)} inputMode="numeric" placeholder="4 to 8 digits" required />
            </label>
            <div className={styles.fuelModalFooter}>
              <button type="button" className={styles.fuelModalCancelButton} onClick={closeModal} disabled={isSaving}>Cancel</button>
              <button type="submit" className={styles.fuelModalPrimaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save PIN'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {modalMode === 'qr' && selectedStorage ? (
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay}`} data-website-overlay>
          <div className={styles.modalBackdrop} onClick={closeModal} />

          <div className={`${styles.modalCard} ${styles.qrModal}`} role="dialog" aria-modal="true" aria-labelledby="fuel-qr-title">
            <div className={`${styles.modalHeader} ${styles.qrModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="fuel-qr-title">{selectedStorage.name}</h3>
                <p>Use this permanent QR for fuel scan access. Public QR scans always ask for the fuel PIN.</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closeModal} aria-label="Close QR code">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.qrModalScrollBody}`}>
              <div className={styles.qrModalBody}>
                <div className={styles.qrPreviewCard}>
                  <span className={styles.qrPreviewEyebrow}>Permanent fuel QR</span>
                  <div className={styles.qrPreviewFrame}>
                    {selectedStorage.publicFuelStorageCode ? (
                      <QrCodePreview value={buildFuelScanUrl(selectedStorage)} label={`QR code for ${selectedStorage.name}`} />
                    ) : (
                      <p className={styles.qrPreviewFallback}>QR artwork is not ready for this fuel storage unit yet.</p>
                    )}
                  </div>
                </div>

                <div className={styles.qrPrimaryActionsCard}>
                  <button
                    type="button"
                    className={`${styles.qrPrimaryActionButton} ${copiedScanLinkStorageId === selectedStorage.id ? styles.qrCopiedButton : ''}`}
                    onClick={() => void handleCopyFuelScanLink(selectedStorage)}
                  >
                    <CopyIcon className={styles.buttonIcon} />
                    <span>{copiedScanLinkStorageId === selectedStorage.id ? 'Copied' : 'Copy scan link'}</span>
                  </button>

                  <button type="button" className={styles.qrPrimaryActionButton} onClick={() => handlePrintFuelQrLabel(selectedStorage)}>
                    <PrintIcon className={styles.buttonIcon} />
                    <span>Print QR label</span>
                  </button>

                  <button type="button" className={styles.qrPrimaryActionButton} onClick={() => void handleDownloadFuelQr(selectedStorage)}>
                    <QrIcon className={styles.buttonIcon} />
                    <span>Download QR</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'report' ? (
        <div className={styles.modalOverlay} data-website-overlay role="dialog" aria-modal="true" aria-labelledby="fuel-report-title">
          <div className={`${styles.modalCard} ${styles.exportModal}`}>
            <div className={`${styles.modalHeader} ${styles.exportModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h2 id="fuel-report-title">Export fuel report</h2>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close fuel report options">×</button>
            </div>

            <div className={styles.exportModalScrollBody}>
              <div className={styles.exportModalBody}>
                {reportStep === 'format' ? (
                  <>
                    <div className={styles.exportChoices}>
                      <button
                        type="button"
                        className={`${styles.exportOption} ${reportFormat === 'pdf' ? styles.exportOptionActive : ''}`}
                        onClick={() => setReportFormat('pdf')}
                        aria-pressed={reportFormat === 'pdf'}
                      >
                        <span className={styles.exportGraphic}>
                          <ExportGraphic src="/brand/pdf.png" alt="PDF fuel report" icon={<PdfIcon className={styles.exportOptionIcon} />} />
                        </span>

                        <span className={styles.exportOptionTitleBlock}>
                          <strong>PDF report</strong>
                          <small>Download a clean printable Fuel Ledger report.</small>
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.exportOption} ${reportFormat === 'xlsx' ? styles.exportOptionActive : ''}`}
                        onClick={() => setReportFormat('xlsx')}
                        aria-pressed={reportFormat === 'xlsx'}
                      >
                        <span className={styles.exportGraphic}>
                          <ExportGraphic src="/brand/sheet.png" alt="Fuel spreadsheet export" icon={<SpreadsheetIcon className={styles.exportOptionIcon} />} />
                        </span>

                        <span className={styles.exportOptionTitleBlock}>
                          <strong>XLSX workbook</strong>
                          <small>Download the filtered fuel ledger rows in Excel format.</small>
                        </span>
                      </button>
                    </div>

                    <div className={`${styles.modalActions} ${styles.exportActions}`}>
                      <button type="button" className={`${styles.secondaryButton} ${styles.exportSecondaryButton}`} onClick={closeModal}>Cancel</button>
                      <button type="button" className={`${styles.primaryButton} ${styles.exportPrimaryButton}`} onClick={handleReportNext}>
                        <ChevronRightIcon className={styles.buttonIcon} />
                        <span>Next</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.reportFilterBox}>
                      <ReportSelect
                        label="Source"
                        value={reportStorageId}
                        options={reportStorageOptions}
                        isOpen={openReportSelect === 'storage'}
                        onToggle={() => toggleReportSelect('storage')}
                        onChange={selectReportStorage}
                      />

                      <ReportSelect
                        label="Year"
                        value={reportYear}
                        options={reportYearOptions}
                        isOpen={openReportSelect === 'year'}
                        onToggle={() => toggleReportSelect('year')}
                        onChange={selectReportYear}
                      />

                      <ReportSelect
                        label="Month"
                        value={reportMonth}
                        options={reportMonthSelectOptions}
                        isOpen={openReportSelect === 'month'}
                        disabled={reportYear === 'all'}
                        onToggle={() => toggleReportSelect('month')}
                        onChange={selectReportMonth}
                      />
                    </div>

                    <div className={`${styles.modalActions} ${styles.exportActions}`}>
                      <button type="button" className={`${styles.secondaryButton} ${styles.exportSecondaryButton}`} onClick={handleReportBack}>Back</button>
                      <button type="button" className={`${styles.primaryButton} ${styles.exportPrimaryButton}`} onClick={handleDownloadSelectedReport}>
                        <DownloadIcon className={styles.buttonIcon} />
                        <span>{reportFormat === 'pdf' ? 'Download PDF' : 'Download XLSX'}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteCandidateStorage ? (
        <div className={`${styles.modalOverlay} ${styles.confirmDeleteOverlay}`} data-website-overlay role="alertdialog" aria-modal="true" aria-labelledby="delete-fuel-title" aria-describedby="delete-fuel-copy">
          <div className={styles.deleteConfirmModal}>
            <button
              type="button"
              className={styles.deleteConfirmCloseButton}
              onClick={() => setDeleteCandidateStorage(null)}
              aria-label="Close archive confirmation"
              disabled={busyDeleteId === deleteCandidateStorage.id}
            >
              ×
            </button>

            <div className={styles.deleteConfirmContent}>
              <h3 id="delete-fuel-title">Archive this storage unit?</h3>
              <p id="delete-fuel-copy">
                <strong>{deleteCandidateStorage.name}</strong> will disappear from active storage and its QR access will stop. Its issue history and report records will be kept.
              </p>

              <div className={styles.deleteConfirmAsset}>
                <span>Selected storage unit</span>
                <strong>{deleteCandidateStorage.name}</strong>
                <small>{formatFuelType(deleteCandidateStorage.fuelType)} · {formatLitres(deleteCandidateStorage.currentLitres)} available · {deleteCandidateStorage.locationLabel || deleteCandidateStorage.publicFuelStorageCode}</small>
              </div>

              <div className={styles.deleteConfirmActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setDeleteCandidateStorage(null)} disabled={busyDeleteId === deleteCandidateStorage.id}>
                  Cancel
                </button>

                <button
                  type="button"
                  className={`${styles.primaryButton} ${styles.deleteConfirmButton}`}
                  onClick={() => void handleConfirmArchiveStorage()}
                  disabled={busyDeleteId === deleteCandidateStorage.id}
                >
                  <span>{busyDeleteId === deleteCandidateStorage.id ? 'Archiving...' : 'Yes, archive unit'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

