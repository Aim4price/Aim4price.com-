'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode, type SVGProps } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type FuelStorageStatus = 'active' | 'archived';
type ModalMode = 'create-storage' | 'edit-storage' | 'pin' | 'report' | 'qr' | 'fuel-slip' | 'fuel-slip-menu' | 'fuel-slip-manager' | null;
type FuelSlipFlowStep = 'source-choice' | 'target-manual' | 'target-automatic' | 'manual-form' | 'upload' | 'review' | null;
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
  usageMetric: 'hours' | 'km' | 'both' | 'none';
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
  documentFileUrl: string;
  originalFilename: string;
  supplierName: string;
  supplierVatNumber: string;
  slipNumber: string;
  transactionNumber: string;
  documentDate: string;
  documentTime: string;
  fuelType: string;
  litres: number;
  pricePerLitre: number | null;
  totalAmount: number;
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
  extractionStatus: 'manual' | 'extracted' | 'needs_review';
  ocrConfidence: number | null;
  reviewRequired: boolean;
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
  assets?: FuelLedgerAsset[];
  summary?: FuelLedgerSummary;
  error?: string;
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
  extractionStatus: 'manual' | 'extracted' | 'needs_review';
  ocrConfidence: number | null;
  reviewRequired: boolean;
  rawExtractedText: string;
  extractionWarnings: string[];
};

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
  fuelType: 'Diesel',
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

const FUEL_SLIP_MANAGER_PAGE_SIZE = 10;

const FUEL_SLIP_CAPTURE_FILTER_OPTIONS: ReportSelectOption[] = [
  { value: 'all', label: 'All fuel slip sources' },
  { value: 'manual', label: 'Manual fuel slips' },
  { value: 'automatic', label: 'Uploaded fuel slips' },
  { value: 'needs_review', label: 'Needs review' },
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
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
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

function StorageFuelTypeSelect({ value, isOpen, onToggle, onChange }: StorageFuelTypeSelectProps) {
  const selectedOption = FUEL_TYPE_OPTIONS.find((option) => option.value === value);

  return (
    <div className={`${styles.storageFuelTypeSelect} ${isOpen ? styles.storageFuelTypeSelectOpen : ''}`} data-storage-fuel-select-root="true">
      <button type="button" className={styles.storageFuelTypeButton} onClick={onToggle} aria-haspopup="listbox" aria-expanded={isOpen} aria-label="Select fuel type">
        <span>{selectedOption?.label ?? formatFuelType(value)}</span>
        <ChevronDownIcon className={styles.storageFuelTypeChevron} />
      </button>

      {isOpen ? (
        <div className={styles.storageFuelTypeMenu} role="listbox" aria-label="Fuel type">
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
        </div>
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
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} L`;
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
  if (slip.reviewRequired || slip.extractionStatus === 'needs_review') return 'Needs review';
  if (slip.extractionStatus === 'extracted') return 'Extracted';
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

function fuelSlipCaptureKey(slip: FuelSlipRecord): FuelSlipCaptureFilter {
  if (slip.reviewRequired || slip.extractionStatus === 'needs_review') return 'needs_review';
  if (slip.extractionStatus === 'extracted') return 'automatic';
  return 'manual';
}

function fuelSlipSearchText(slip: FuelSlipRecord): string {
  return [
    slip.supplierName,
    slip.supplierVatNumber,
    slip.slipNumber,
    slip.transactionNumber,
    slip.fuelType,
    slip.paymentMethod,
    slip.cardNumberMasked,
    slip.assetTitle,
    slip.storageName,
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
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
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
    'Card number',
    'Merchant number',
    'Terminal number',
    'Site number',
    'Odometer reading',
    'Hour-meter reading',
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
    slip.cardNumberMasked,
    slip.merchantNumber,
    slip.terminalNumber,
    slip.siteNumber,
    csvNumber(slip.odometerReading),
    csvNumber(slip.hourMeterReading),
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

function numberToInput(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function booleanToInput(value: boolean | null | undefined): string {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return '';
}


function numberInputToValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFuelSlipCard(value: string): { masked: string; last4: string } {
  const text = value.trim().slice(0, 80);
  const digits = text.replace(/\D/g, '');
  const last4 = digits.length >= 4 ? digits.slice(-4) : '';

  if (digits.length >= 13 && digits.length <= 19) {
    return { masked: `${'*'.repeat(Math.max(0, digits.length - 4))}${last4}`, last4 };
  }

  if (/[xX*]{2,}/.test(text)) {
    return { masked: text.replace(/[0-9](?=(?:\D*\d){4})/g, '*'), last4 };
  }

  return { masked: text, last4 };
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
    litres: numberToInput(extracted.litres) || current.litres,
    pricePerLitre: numberToInput(extracted.pricePerLitre) || current.pricePerLitre,
    totalAmount: numberToInput(extracted.totalAmount) || current.totalAmount,
    vatAmount: numberToInput(extracted.vatAmount) || current.vatAmount,
    vatIncluded: booleanToInput(extracted.vatIncluded) || current.vatIncluded,
    vatRate: numberToInput(extracted.vatRate) || current.vatRate,
    paymentMethod: extracted.paymentMethod ?? current.paymentMethod,
    cardType: extracted.cardType ?? current.cardType,
    cardNumberMasked: normalizeFuelSlipCard(extracted.cardNumberMasked ?? current.cardNumberMasked).masked,
    cardLast4: extracted.cardLast4 ?? normalizeFuelSlipCard(extracted.cardNumberMasked ?? current.cardNumberMasked).last4 ?? current.cardLast4,
    merchantNumber: extracted.merchantNumber ?? current.merchantNumber,
    terminalNumber: extracted.terminalNumber ?? current.terminalNumber,
    siteNumber: extracted.siteNumber ?? current.siteNumber,
    extractionStatus: extracted.extractionStatus ?? 'needs_review',
    ocrConfidence: typeof extracted.ocrConfidence === 'number' ? extracted.ocrConfidence : current.ocrConfidence,
    reviewRequired: Boolean(extracted.reviewRequired ?? response.extraction?.warnings?.length),
    rawExtractedText: response.extraction?.rawText ?? current.rawExtractedText,
    extractionWarnings: response.extraction?.warnings ?? current.extractionWarnings,
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
  if (typeof asset.hours !== 'number' || !Number.isFinite(asset.hours)) return '';
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


function buildReportUrl(sourceId: string, year: string, month: string, format: ReportFormat = 'pdf'): string {
  const url = new URL('/api/fuel/report', window.location.origin);
  url.searchParams.set('format', format);

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

function buildFuelQrSvgUrl(storage: FuelLedgerStorage): string {
  return `/api/fuel/storage/${encodeURIComponent(storage.id)}/qr?format=svg`;
}

function buildFuelQrPrintUrl(storage: FuelLedgerStorage): string {
  return `/api/fuel/storage/${encodeURIComponent(storage.id)}/qr?format=print`;
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

export default function FuelClient() {
  const [storages, setStorages] = useState<FuelLedgerStorage[]>([]);
  const [recentEvents, setRecentEvents] = useState<FuelLedgerEvent[]>([]);
  const [assets, setAssets] = useState<FuelLedgerAsset[]>([]);
  const [recentFuelSlips, setRecentFuelSlips] = useState<FuelSlipRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
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
  const [fuelSlipPickerSearch, setFuelSlipPickerSearch] = useState('');
  const [fuelSlipUploadFile, setFuelSlipUploadFile] = useState<File | null>(null);
  const [isExtractingFuelSlip, setIsExtractingFuelSlip] = useState(false);
  const [fuelSlipUploadFileName, setFuelSlipUploadFileName] = useState('');
  const [fuelSlipManagerSearch, setFuelSlipManagerSearch] = useState('');
  const [fuelSlipManagerFilters, setFuelSlipManagerFilters] = useState<FuelSlipManagerFilterState>(DEFAULT_FUEL_SLIP_MANAGER_FILTERS);
  const [draftFuelSlipManagerFilters, setDraftFuelSlipManagerFilters] = useState<FuelSlipManagerFilterState>(DEFAULT_FUEL_SLIP_MANAGER_FILTERS);
  const [fuelSlipManagerFilterOpen, setFuelSlipManagerFilterOpen] = useState(false);
  const [openFuelSlipManagerFilterSelect, setOpenFuelSlipManagerFilterSelect] = useState<FuelSlipManagerFilterKey | null>(null);
  const [currentFuelSlipManagerPage, setCurrentFuelSlipManagerPage] = useState(1);

  const selectedStorage = useMemo(
    () => storages.find((storage) => storage.id === selectedStorageId) ?? null,
    [selectedStorageId, storages],
  );

  const visibleStorages = useMemo(
    () => storages.filter((storage) => matchesSearch(storage, searchText)),
    [searchText, storages],
  );

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
      ...assets.map((asset) => ({
        value: `asset:${asset.id}`,
        label: `${asset.title}${asset.assetTypeLabel ? ` · ${asset.assetTypeLabel}` : ''}`,
      })),
      ...storages.map((storage) => ({
        value: `storage_tank:${storage.id}`,
        label: `${storage.name} · Storage tank`,
      })),
    ],
    [assets, storages],
  );

  const selectedFuelSlipTarget = useMemo(() => {
    if (!fuelSlipDraft.targetKey) return null;
    const [type, id] = fuelSlipDraft.targetKey.split(':');
    if (type === 'asset') return { type: 'asset' as const, asset: assets.find((asset) => asset.id === id) ?? null, storage: null as FuelLedgerStorage | null, id };
    if (type === 'storage_tank') return { type: 'storage_tank' as const, asset: null as FuelLedgerAsset | null, storage: storages.find((storage) => storage.id === id) ?? null, id };
    return null;
  }, [assets, fuelSlipDraft.targetKey, storages]);

  const selectedFuelSlipAsset = selectedFuelSlipTarget?.type === 'asset' ? selectedFuelSlipTarget.asset : null;
  const showFuelSlipOdometer = selectedFuelSlipAsset?.usageMetric === 'km' || selectedFuelSlipAsset?.usageMetric === 'both';
  const showFuelSlipHours = selectedFuelSlipAsset?.usageMetric === 'hours' || selectedFuelSlipAsset?.usageMetric === 'both';
  const fuelSlipSearchTerm = fuelSlipPickerSearch.trim().toLowerCase();
  const filteredFuelSlipAssets = useMemo(
    () => assets.filter((asset) => matchesFuelSlipAsset(asset, fuelSlipSearchTerm)),
    [assets, fuelSlipSearchTerm],
  );
  const filteredFuelSlipStorages = useMemo(
    () => storages.filter((storage) => matchesFuelSlipStorage(storage, fuelSlipSearchTerm)),
    [storages, fuelSlipSearchTerm],
  );
  const selectedFuelSlipTargetName = selectedFuelSlipTarget?.type === 'storage_tank'
    ? selectedFuelSlipTarget.storage?.name ?? 'Selected storage tank'
    : selectedFuelSlipTarget?.asset?.title ?? 'Selected asset or storage tank';
  const fuelSlipTargetPickerTitle = fuelSlipFlow === 'target-manual'
    ? 'Choose asset or storage tank for manual fuel slip'
    : 'Choose asset or storage tank for uploaded fuel slip';
  const fuelSlipFormTitle = fuelSlipFlow === 'review' ? 'Review fuel slip details' : 'Enter fuel slip manually';
  const fuelSlipFormSubtitle = `${selectedFuelSlipTargetName} · ${fuelSlipFlow === 'review' ? 'Automatic capture' : 'Manual entry'}`;
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
  const activeFuelSlipManagerFilterCount = useMemo(() => [
    fuelSlipManagerFilters.targetKey !== 'all',
    fuelSlipManagerFilters.capture !== 'all',
    fuelSlipManagerFilters.year !== 'all',
    fuelSlipManagerFilters.month !== 'all',
  ].filter(Boolean).length, [fuelSlipManagerFilters]);


  async function loadLedger(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setIsLoading(true);
    }

    try {
      const response = await fetch('/api/fuel', { credentials: 'include', cache: 'no-store' });
      const data = (await response.json()) as FuelLedgerResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to load Fuel Ledger.');
      }

      setStorages(data.storages ?? []);
      setRecentEvents(data.recentEvents ?? []);
      setAssets(data.assets ?? []);
      setRecentFuelSlips(data.recentFuelSlips ?? []);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load Fuel Ledger.' });
    } finally {
      if (!options.silent) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadLedger();
  }, []);

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
  }, [fuelSlipManagerFilters, fuelSlipManagerSearch]);

  useEffect(() => {
    setCurrentFuelSlipManagerPage((page) => Math.min(page, totalFuelSlipManagerPages));
  }, [totalFuelSlipManagerPages]);

  useEffect(() => {
    if (!fuelSlipManagerFilterOpen || !openFuelSlipManagerFilterSelect) return undefined;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-report-select-root="true"]')) {
        setOpenFuelSlipManagerFilterSelect(null);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [fuelSlipManagerFilterOpen, openFuelSlipManagerFilterSelect]);

  function openCreateStorage() {
    setSelectedStorageId(null);
    setStorageDraft(emptyStorageDraft);
    setIsStorageFuelSelectOpen(false);
    setNotice(null);
    setModalMode('create-storage');
  }

  function openEditStorage(storage: FuelLedgerStorage) {
    setSelectedStorageId(storage.id);
    setStorageDraft(buildStorageDraft(storage));
    setIsStorageFuelSelectOpen(false);
    setNotice(null);
    setModalMode('edit-storage');
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
    setFuelSlipFlow(null);
    setFuelSlipPickerSearch('');
    setFuelSlipUploadFile(null);
    setFuelSlipUploadFileName('');
    setFuelSlipManagerFilterOpen(false);
    setOpenFuelSlipManagerFilterSelect(null);
    setIsStorageFuelSelectOpen(false);
    setNotice(null);
    setModalMode('fuel-slip-menu');
  }

  function openFuelSlipModal() {
    setFuelSlipDraft(emptyFuelSlipDraft);
    setFuelSlipFlow('source-choice');
    setFuelSlipPickerSearch('');
    setFuelSlipUploadFile(null);
    setFuelSlipUploadFileName('');
    setFuelSlipManagerFilterOpen(false);
    setOpenFuelSlipManagerFilterSelect(null);
    setIsStorageFuelSelectOpen(false);
    setNotice(null);
    setModalMode('fuel-slip');
  }

  function openFuelSlipManager() {
    setDraftFuelSlipManagerFilters(fuelSlipManagerFilters);
    setFuelSlipManagerFilterOpen(false);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipFlow(null);
    setIsStorageFuelSelectOpen(false);
    setNotice(null);
    setModalMode('fuel-slip-manager');
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

  function closeModal() {
    if (isSaving) return;
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
    setFuelSlipPickerSearch('');
    setFuelSlipUploadFile(null);
    setFuelSlipUploadFileName('');
    setIsExtractingFuelSlip(false);
    setFuelSlipManagerFilterOpen(false);
    setOpenFuelSlipManagerFilterSelect(null);
  }

  function clearSearch() {
    setSearchText('');
  }

  async function applyLedgerResponse(response: Response) {
    const data = (await response.json()) as FuelLedgerResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Fuel Ledger action failed.');
    }

    if (data.storages) setStorages(data.storages);
    if (data.recentEvents) setRecentEvents(data.recentEvents);
    if (data.assets) setAssets(data.assets);
    if (data.recentFuelSlips) setRecentFuelSlips(data.recentFuelSlips);
  }

  async function handleStorageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);

    try {
      const isEdit = modalMode === 'edit-storage' && selectedStorage;
      const response = await fetch(isEdit ? `/api/fuel/storage/${selectedStorage.id}` : '/api/fuel', {
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

  function handleFuelSlipCardNumberChange(value: string) {
    const card = normalizeFuelSlipCard(value);
    setFuelSlipDraft((current) => ({
      ...current,
      cardNumberMasked: card.masked,
      cardLast4: card.last4 || current.cardLast4,
    }));
  }

  function startFuelSlipFlow(mode: 'manual' | 'automatic') {
    setFuelSlipDraft({
      ...emptyFuelSlipDraft,
      mode,
      extractionStatus: mode === 'manual' ? 'manual' : 'needs_review',
      reviewRequired: mode === 'automatic',
    });
    setFuelSlipPickerSearch('');
    setFuelSlipUploadFile(null);
    setFuelSlipUploadFileName('');
    setFuelSlipFlow(mode === 'manual' ? 'target-manual' : 'target-automatic');
  }

  function handleFuelSlipTargetChange(value: string) {
    setFuelSlipDraft((current) => ({
      ...current,
      targetKey: value,
      odometerReading: '',
      hourMeterReading: '',
    }));
  }

  function selectFuelSlipTarget(value: string) {
    handleFuelSlipTargetChange(value);
    setFuelSlipPickerSearch('');
    setFuelSlipFlow(fuelSlipFlow === 'target-manual' ? 'manual-form' : 'upload');
  }

  function handleFuelSlipUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
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
    if (!fuelSlipUploadFile) {
      setNotice({ tone: 'error', message: 'Choose a fuel slip photo or PDF first.' });
      return;
    }

    setIsExtractingFuelSlip(true);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.append('file', fuelSlipUploadFile);

      const response = await fetch('/api/fuel/slips/extract', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = (await response.json()) as FuelSlipExtractResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Fuel slip extraction failed.');
      }

      setFuelSlipDraft((current) => applyExtractionToFuelSlipDraft(current, data));
      setFuelSlipFlow('review');
      setNotice({
        tone: data.extraction?.draft.reviewRequired ? 'error' : 'success',
        message: data.extraction?.draft.reviewRequired
          ? 'Fuel slip uploaded. Review and correct the fields before saving.'
          : 'Fuel slip uploaded and fields extracted. Review before saving.',
      });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Fuel slip extraction failed.' });
    } finally {
      setIsExtractingFuelSlip(false);
    }
  }

  async function handleFuelSlipSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const [targetType, targetId] = fuelSlipDraft.targetKey.split(':');
    const card = normalizeFuelSlipCard(fuelSlipDraft.cardNumberMasked);

    if (targetType !== 'asset' && targetType !== 'storage_tank') {
      setNotice({ tone: 'error', message: 'Choose asset or storage tank.' });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch('/api/fuel/slips', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          litres: numberInputToValue(fuelSlipDraft.litres),
          pricePerLitre: numberInputToValue(fuelSlipDraft.pricePerLitre),
          totalAmount: numberInputToValue(fuelSlipDraft.totalAmount),
          vatAmount: numberInputToValue(fuelSlipDraft.vatAmount),
          vatIncluded: fuelSlipDraft.vatIncluded === '' ? null : fuelSlipDraft.vatIncluded === 'true',
          vatRate: numberInputToValue(fuelSlipDraft.vatRate),
          paymentMethod: fuelSlipDraft.paymentMethod,
          cardType: fuelSlipDraft.cardType,
          cardNumberMasked: card.masked,
          cardLast4: fuelSlipDraft.cardLast4 || card.last4,
          merchantNumber: fuelSlipDraft.merchantNumber,
          terminalNumber: fuelSlipDraft.terminalNumber,
          siteNumber: fuelSlipDraft.siteNumber,
          odometerReading: numberInputToValue(fuelSlipDraft.odometerReading),
          hourMeterReading: numberInputToValue(fuelSlipDraft.hourMeterReading),
          extractionStatus: fuelSlipDraft.extractionStatus,
          ocrConfidence: fuelSlipDraft.ocrConfidence,
          reviewRequired: fuelSlipDraft.reviewRequired,
          rawExtractedText: fuelSlipDraft.rawExtractedText,
          extractionWarnings: fuelSlipDraft.extractionWarnings,
        }),
      });

      await applyLedgerResponse(response);
      setNotice({ tone: 'success', message: 'Fuel Slip saved to Fuel Ledger.' });
      closeModal();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save fuel slip.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStorage) return;
    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/fuel/storage/${selectedStorage.id}/pin`, {
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
    const opened = window.open(buildFuelQrPrintUrl(storage), '_blank', 'noopener,noreferrer');

    if (!opened) {
      setNotice({ tone: 'error', message: 'Unable to open the fuel QR print page. Please allow pop-ups and try again.' });
      return;
    }

    setNotice({ tone: 'success', message: 'Fuel QR print label opened in a new tab.' });
  }

  async function handleDownloadFuelQr(storage: FuelLedgerStorage) {
    try {
      const response = await fetch(`/api/fuel/storage/${encodeURIComponent(storage.id)}/qr?format=png&download=1`, {
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
    setDraftFuelSlipManagerFilters(fuelSlipManagerFilters);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerFilterOpen(true);
  }

  function closeFuelSlipManagerFilterPanel() {
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerFilterOpen(false);
  }

  function clearFuelSlipManagerFilters() {
    setDraftFuelSlipManagerFilters(DEFAULT_FUEL_SLIP_MANAGER_FILTERS);
    setFuelSlipManagerFilters(DEFAULT_FUEL_SLIP_MANAGER_FILTERS);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerFilterOpen(false);
  }

  function applyFuelSlipManagerFilters() {
    setFuelSlipManagerFilters(draftFuelSlipManagerFilters);
    setOpenFuelSlipManagerFilterSelect(null);
    setFuelSlipManagerFilterOpen(false);
  }

  function toggleFuelSlipManagerFilterSelect(key: FuelSlipManagerFilterKey) {
    setOpenFuelSlipManagerFilterSelect((current) => (current === key ? null : key));
  }

  function handleFuelSlipBulkDownload() {
    if (!visibleFuelSlipManagerSlips.length) {
      setNotice({ tone: 'error', message: 'No fuel slips match the current filters.' });
      return;
    }

    downloadBlob(new Blob([buildFuelSlipCsv(visibleFuelSlipManagerSlips)], { type: 'text/csv;charset=utf-8' }), fuelSlipDownloadFileName());
    setNotice({ tone: 'success', message: 'Fuel slip CSV downloaded.' });
  }

  async function handleClearDipstickNote(storage: FuelLedgerStorage) {
    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/fuel/storage/${storage.id}/dipstick`, {
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

  async function handleConfirmDeleteStorage() {
    if (!deleteCandidateStorage) return;

    setBusyDeleteId(deleteCandidateStorage.id);
    setNotice(null);

    try {
      const response = await fetch(`/api/fuel/storage/${deleteCandidateStorage.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      await applyLedgerResponse(response);
      setNotice({ tone: 'success', message: 'Fuel storage unit deleted.' });
      setDeleteCandidateStorage(null);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to delete storage.' });
    } finally {
      setBusyDeleteId(null);
    }
  }

  function handleOpenReport() {
    const normalizedMonth = reportYear === 'all' ? 'all' : reportMonth;
    window.open(buildReportUrl(reportStorageId, reportYear, normalizedMonth, 'pdf'), '_blank', 'noopener,noreferrer');
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
    downloadLink.href = buildReportUrl(reportStorageId, reportYear, normalizedMonth, 'xlsx');
    downloadLink.download = '';
    downloadLink.rel = 'noreferrer';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    closeModal();
  }

  const hasActiveSearch = searchText.trim().length > 0;

  function renderFuelSlipFormFields() {
    return (
      <section className={styles.invoiceFormCard}>
        <div className={styles.formGrid}>
          <label>
            <span>Supplier / garage</span>
            <input value={fuelSlipDraft.supplierName} onChange={(event) => setFuelSlipField('supplierName', event.target.value)} placeholder="Supplier name" />
          </label>
          <label>
            <span>Supplier VAT number</span>
            <input value={fuelSlipDraft.supplierVatNumber} onChange={(event) => setFuelSlipField('supplierVatNumber', event.target.value)} placeholder="VAT number" />
          </label>
          <label>
            <span>Slip / invoice number</span>
            <input value={fuelSlipDraft.slipNumber} onChange={(event) => setFuelSlipField('slipNumber', event.target.value)} placeholder="Slip number" />
          </label>
          <label>
            <span>Transaction number</span>
            <input value={fuelSlipDraft.transactionNumber} onChange={(event) => setFuelSlipField('transactionNumber', event.target.value)} placeholder="Transaction number" />
          </label>
          <label>
            <span>Slip date</span>
            <input type="date" value={fuelSlipDraft.documentDate} onChange={(event) => setFuelSlipField('documentDate', event.target.value)} required />
          </label>
          <label>
            <span>Slip time</span>
            <input value={fuelSlipDraft.documentTime} onChange={(event) => setFuelSlipField('documentTime', event.target.value)} placeholder="07:40:43" />
          </label>
          <label>
            <span>Fuel type</span>
            <input value={fuelSlipDraft.fuelType} onChange={(event) => setFuelSlipField('fuelType', event.target.value)} placeholder="Diesel 50ppm" />
          </label>
          <label>
            <span>Litres</span>
            <input type="number" step="0.01" min="0" value={fuelSlipDraft.litres} onChange={(event) => setFuelSlipField('litres', event.target.value)} required />
          </label>
          <label className={styles.invoiceCurrencyField}>
            <span>Price per litre</span>
            <div className={styles.invoiceCurrencyInput}>
              <span aria-hidden="true">R</span>
              <input type="text" inputMode="decimal" value={fuelSlipDraft.pricePerLitre} onChange={(event) => setFuelSlipField('pricePerLitre', event.target.value)} placeholder="0" />
            </div>
          </label>
          <label className={styles.invoiceCurrencyField}>
            <span>Total amount</span>
            <div className={styles.invoiceCurrencyInput}>
              <span aria-hidden="true">R</span>
              <input type="text" inputMode="decimal" value={fuelSlipDraft.totalAmount} onChange={(event) => setFuelSlipField('totalAmount', event.target.value)} placeholder="Required" required />
            </div>
          </label>
          <label className={styles.invoiceCurrencyField}>
            <span>VAT amount</span>
            <div className={styles.invoiceCurrencyInput}>
              <span aria-hidden="true">R</span>
              <input type="text" inputMode="decimal" value={fuelSlipDraft.vatAmount} onChange={(event) => setFuelSlipField('vatAmount', event.target.value)} placeholder="0" />
            </div>
          </label>
          <label>
            <span>VAT included</span>
            <select value={fuelSlipDraft.vatIncluded} onChange={(event) => setFuelSlipField('vatIncluded', event.target.value)}>
              <option value="">Not sure</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label>
            <span>VAT rate</span>
            <input type="number" step="0.01" min="0" value={fuelSlipDraft.vatRate} onChange={(event) => setFuelSlipField('vatRate', event.target.value)} placeholder="15" />
          </label>
          <label>
            <span>Payment method</span>
            <input value={fuelSlipDraft.paymentMethod} onChange={(event) => setFuelSlipField('paymentMethod', event.target.value)} placeholder="Card / Cash / Account" />
          </label>
          <label>
            <span>Card type</span>
            <input value={fuelSlipDraft.cardType} onChange={(event) => setFuelSlipField('cardType', event.target.value)} placeholder="Visa / Mastercard" />
          </label>
          <label>
            <span>Masked card number</span>
            <input value={fuelSlipDraft.cardNumberMasked} onChange={(event) => handleFuelSlipCardNumberChange(event.target.value)} placeholder="**** **** **** 1234" />
          </label>
          <label>
            <span>Merchant/site number</span>
            <input value={fuelSlipDraft.merchantNumber} onChange={(event) => setFuelSlipField('merchantNumber', event.target.value)} placeholder="Merchant number" />
          </label>
          <label>
            <span>Terminal number</span>
            <input value={fuelSlipDraft.terminalNumber} onChange={(event) => setFuelSlipField('terminalNumber', event.target.value)} placeholder="Terminal number" />
          </label>
          <label>
            <span>Site number</span>
            <input value={fuelSlipDraft.siteNumber} onChange={(event) => setFuelSlipField('siteNumber', event.target.value)} placeholder="Site number" />
          </label>
          {selectedFuelSlipTarget?.type === 'asset' && showFuelSlipOdometer ? (
            <label>
              <span>Current km / odometer</span>
              <input type="number" min="0" step="1" value={fuelSlipDraft.odometerReading} onChange={(event) => setFuelSlipField('odometerReading', event.target.value)} required />
            </label>
          ) : null}
          {selectedFuelSlipTarget?.type === 'asset' && showFuelSlipHours ? (
            <label>
              <span>Current hours</span>
              <input type="number" min="0" step="1" value={fuelSlipDraft.hourMeterReading} onChange={(event) => setFuelSlipField('hourMeterReading', event.target.value)} required />
            </label>
          ) : null}
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

                <div className={styles.topActionButtons}>
                  <button
                    type="button"
                    className={`${styles.secondaryButton} ${styles.topActionButton} ${styles.topAddButton}`}
                    onClick={openCreateStorage}
                  >
                    <PlusIcon className={styles.buttonIcon} />
                    <span>Add Storage Tank</span>
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
              </div>
            </div>

            {!isLoading && !storages.length ? (
              <div className={styles.emptyState}>
                <strong>No fuel storage yet.</strong>
                <span>Add your first tank, bowser or storage unit.</span>
                <button type="button" className={styles.primaryButton} onClick={openCreateStorage}>
                  <PlusIcon className={styles.buttonIcon} />
                  <span>Add Storage Tank</span>
                </button>
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
                const hasStorageWarning = storageIsLow || Boolean(dipstickNoteText);

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
                            <span>{storage.locationLabel || storage.publicFuelStorageCode}</span>
                          </div>
                        </div>

                        <div className={styles.storageValueBlock}>
                          <strong>{formatLitres(storage.currentLitres)}</strong>
                          <span>{formatPercent(storage.stockPercent)} full</span>
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

                    <div className={styles.storageHeaderAside}>
                      <div className={styles.unitActions}>
                        <button type="button" className={styles.unitButton} onClick={() => openEditStorage(storage)} disabled={isSaving}>
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
                          <span>Delete Unit</span>
                        </button>
                      </div>
                    </div>

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

                        {dipstickNoteText ? (
                          <div className={styles.storageWarningNote}>
                            <div>
                              <strong>Dipstick note</strong>
                              <span>{dipstickNoteText}</span>
                            </div>
                            <button type="button" className={styles.clearDipstickButton} onClick={() => handleClearDipstickNote(storage)} disabled={isSaving}>
                              Clear note
                            </button>
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
          <button type="button" className={styles.mobileQuickButton} onClick={openCreateStorage}>
            <PlusIcon className={styles.buttonIcon} />
            <span>Add</span>
          </button>
          <button type="button" className={styles.mobileQuickButton} onClick={openFuelSlipMenu}>
            <FuelSlipsIcon className={styles.buttonIcon} />
            <span>Slips</span>
          </button>
          <button type="button" className={styles.mobileQuickButton} onClick={openReportModal}>
            <DownloadIcon className={styles.buttonIcon} />
            <span>Reports</span>
          </button>
        </nav>
      </main>

      {modalMode === 'fuel-slip-menu' ? (
        <div className={styles.fuelSlipFlowBackdrop} role="dialog" aria-modal="true" aria-label="Fuel slips">
          <div className={`${styles.downloadModal} ${styles.sourceChoiceModal} ${styles.fuelSlipMenuModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Fuel slips</h2>
                <p>Manage saved fuel slip data or add a new manual/uploaded fuel slip.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close fuel slips"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.sourceChoiceGrid}>
              <button type="button" className={styles.sourceChoiceOption} onClick={openFuelSlipManager}>
                <span className={styles.choiceGraphic}>
                  <FuelSlipsIcon />
                </span>
                <span className={styles.choiceTitleBlock}>
                  <strong>Manage Fuel Slips</strong>
                  <small>Open saved fuel slip data with search, filters and a bulk CSV download.</small>
                </span>
              </button>
              <button type="button" className={styles.sourceChoiceOption} onClick={openFuelSlipModal}>
                <span className={styles.choiceGraphic}>
                  <PlusIcon />
                </span>
                <span className={styles.choiceTitleBlock}>
                  <strong>Add Fuel Slips</strong>
                  <small>Continue through the existing manual or uploaded fuel slip capture flow.</small>
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
        <div className={styles.fuelSlipFlowBackdrop} role="dialog" aria-modal="true" aria-label="Manage fuel slips">
          <div className={styles.fuelSlipManagerModal}>
            <div className={styles.fuelSlipManagerHeader}>
              <div>
                <h2>Manage Fuel Slips</h2>
                <p>Search, filter and download saved fuel slip data.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close manage fuel slips"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />

            <section className={styles.fuelSlipManagerToolbar} aria-label="Fuel slip manager controls">
              <label className={styles.searchWrap}>
                <SearchIcon className={styles.searchIcon} />
                <input
                  type="search"
                  className={styles.searchInput}
                  value={fuelSlipManagerSearch}
                  onChange={(event) => setFuelSlipManagerSearch(event.target.value)}
                  placeholder="Search suppliers, assets, storage units, slip numbers or amounts..."
                  aria-label="Search saved fuel slips"
                />
                {fuelSlipManagerSearch.trim() ? (
                  <button type="button" className={styles.clearSearchButton} onClick={() => setFuelSlipManagerSearch('')} aria-label="Clear fuel slip search">
                    ×
                  </button>
                ) : null}
              </label>

              <div className={styles.fuelSlipManagerToolbarButtons}>
                <button type="button" className={`${styles.secondaryButton} ${styles.fuelSlipManagerToolbarButton} ${styles.fuelSlipManagerAddButton}`} onClick={openFuelSlipModal}>
                  <PlusIcon className={styles.buttonIcon} />
                  <span>Add Fuel Slip</span>
                </button>
                <button type="button" className={`${styles.secondaryButton} ${styles.fuelSlipManagerToolbarButton} ${styles.fuelSlipManagerFilterButton}`} onClick={openFuelSlipManagerFilterPanel}>
                  <FilterIcon className={styles.buttonIcon} />
                  <span>Filter</span>
                  {activeFuelSlipManagerFilterCount ? <strong>{activeFuelSlipManagerFilterCount}</strong> : null}
                </button>
                <button type="button" className={`${styles.primaryButton} ${styles.fuelSlipManagerToolbarButton} ${styles.fuelSlipManagerDownloadButton}`} onClick={handleFuelSlipBulkDownload} disabled={!visibleFuelSlipManagerSlips.length}>
                  <DownloadIcon className={styles.buttonIcon} />
                  <span>Download</span>
                </button>
              </div>
            </section>

            <section className={styles.fuelSlipManagerPanel} aria-label="Saved fuel slips">
              <div className={styles.fuelSlipManagerList}>
                {isLoading ? <div className={styles.fuelSlipManagerEmptyState}>Loading saved fuel slips...</div> : null}

                {!isLoading && !visibleFuelSlipManagerSlips.length ? (
                  <div className={styles.fuelSlipManagerEmptyState}>No saved fuel slips match the current search or filters.</div>
                ) : null}

                {!isLoading ? paginatedFuelSlipManagerSlips.map((slip) => {
                  const updatedLabel = slip.updatedAtIso ? `Updated ${formatFuelSlipDateTime(slip.updatedAtIso)}` : '';
                  const referenceLabel = slip.slipNumber || slip.transactionNumber || 'No slip number';

                  return (
                    <article className={styles.fuelSlipManagerRow} key={slip.id}>
                      <div className={styles.fuelSlipManagerRowHeader}>
                        <div className={styles.fuelSlipManagerTitleBlock}>
                          <h3 className={styles.fuelSlipManagerTitle}>{slip.supplierName || 'Unknown supplier'}</h3>
                          <p className={styles.fuelSlipManagerTarget}>{fuelSlipTargetLabel(slip)} · {slip.targetType === 'storage_tank' ? 'Storage tank' : 'Asset'}{slip.fuelType ? ` · ${slip.fuelType}` : ''}</p>
                          <div className={styles.fuelSlipManagerMetaList}>
                            <span className={styles.fuelSlipManagerReferenceLabel}>{referenceLabel}</span>
                            <span>{fuelSlipStatusLabel(slip)}</span>
                            <span>{formatFuelSlipDate(slip.documentDate)}</span>
                            {updatedLabel ? <span>{updatedLabel}</span> : null}
                          </div>
                        </div>

                        <div className={styles.fuelSlipManagerRowAside}>
                          <div className={styles.fuelSlipManagerValueBlock}>
                            <strong>{formatCurrency(slip.totalAmount)}</strong>
                            <span>{formatLitres(slip.litres)}{slip.pricePerLitre !== null ? ` · ${formatCurrency(slip.pricePerLitre)}/L` : ''}</span>
                          </div>

                          <div className={styles.fuelSlipManagerRowActions}>
                            {slip.documentFileUrl ? (
                              <a className={`${styles.secondaryButton} ${styles.fuelSlipManagerOpenButton}`} href={slip.documentFileUrl} target="_blank" rel="noreferrer">
                                <OpenFileIcon className={styles.buttonIcon} />
                                <span>Open file</span>
                              </a>
                            ) : (
                              <span className={styles.fuelSlipManagerNoFile}>No file attached</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                }) : null}
              </div>

              {!isLoading && shouldShowFuelSlipManagerPagination ? (
                <nav className={styles.fuelSlipManagerPaginationRow} aria-label="Fuel slips pagination">
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
                </nav>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}

      {modalMode === 'fuel-slip-manager' && fuelSlipManagerFilterOpen ? (
        <div className={styles.fuelSlipSubModalBackdrop} role="dialog" aria-modal="true" aria-label="Filter saved fuel slips">
          <div className={styles.fuelSlipFilterModal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Filter Fuel Slips</h2>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeFuelSlipManagerFilterPanel} aria-label="Close fuel slip filters"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.fuelSlipFilterGrid}>
              <ReportSelect
                label="Target"
                value={draftFuelSlipManagerFilters.targetKey}
                options={fuelSlipManagerTargetOptions}
                isOpen={openFuelSlipManagerFilterSelect === 'target'}
                onToggle={() => toggleFuelSlipManagerFilterSelect('target')}
                onChange={(value) => {
                  setDraftFuelSlipManagerFilters((current) => ({ ...current, targetKey: value }));
                  setOpenFuelSlipManagerFilterSelect(null);
                }}
              />
              <ReportSelect
                label="Source"
                value={draftFuelSlipManagerFilters.capture}
                options={FUEL_SLIP_CAPTURE_FILTER_OPTIONS}
                isOpen={openFuelSlipManagerFilterSelect === 'capture'}
                onToggle={() => toggleFuelSlipManagerFilterSelect('capture')}
                onChange={(value) => {
                  setDraftFuelSlipManagerFilters((current) => ({ ...current, capture: value as FuelSlipCaptureFilter }));
                  setOpenFuelSlipManagerFilterSelect(null);
                }}
              />
              <ReportSelect
                label="Year"
                value={draftFuelSlipManagerFilters.year}
                options={fuelSlipManagerYearOptions}
                isOpen={openFuelSlipManagerFilterSelect === 'year'}
                onToggle={() => toggleFuelSlipManagerFilterSelect('year')}
                onChange={(value) => {
                  setDraftFuelSlipManagerFilters((current) => ({ ...current, year: value, month: value === 'all' ? 'all' : current.month }));
                  setOpenFuelSlipManagerFilterSelect(null);
                }}
              />
              <ReportSelect
                label="Month"
                value={draftFuelSlipManagerFilters.month}
                options={fuelSlipManagerMonthOptions}
                isOpen={openFuelSlipManagerFilterSelect === 'month'}
                disabled={draftFuelSlipManagerFilters.year === 'all'}
                onToggle={() => toggleFuelSlipManagerFilterSelect('month')}
                onChange={(value) => {
                  setDraftFuelSlipManagerFilters((current) => ({ ...current, month: value }));
                  setOpenFuelSlipManagerFilterSelect(null);
                }}
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

      {modalMode === 'fuel-slip' && fuelSlipFlow === 'source-choice' ? (
        <div className={styles.fuelSlipFlowBackdrop} role="dialog" aria-modal="true" aria-label="Add fuel slip">
          <div className={`${styles.downloadModal} ${styles.sourceChoiceModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Add fuel slip</h2>
                <p>Save a fuel slip against a saved asset or storage tank.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close add fuel slip"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.sourceChoiceGrid}>
              <button type="button" className={styles.sourceChoiceOption} onClick={() => startFuelSlipFlow('manual')}>
                <span className={styles.choiceGraphic}>
                  <ManualFuelSlipIcon />
                </span>
                <span className={styles.choiceTitleBlock}>
                  <strong>Enter slip manually</strong>
                  <small>Type the supplier, slip date, litres, VAT, payment and card details yourself.</small>
                </span>
              </button>
              <button type="button" className={styles.sourceChoiceOption} onClick={() => startFuelSlipFlow('automatic')}>
                <span className={styles.choiceGraphic}>
                  <AutomaticFuelSlipIcon />
                </span>
                <span className={styles.choiceTitleBlock}>
                  <strong>Upload fuel slip/photo</strong>
                  <small>Upload a photo or PDF, then review the extracted slip details.</small>
                </span>
              </button>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'fuel-slip' && (fuelSlipFlow === 'target-manual' || fuelSlipFlow === 'target-automatic') ? (
        <div className={styles.fuelSlipFlowBackdrop} role="dialog" aria-modal="true" aria-label={fuelSlipTargetPickerTitle}>
          <div className={styles.assetModal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{fuelSlipTargetPickerTitle}</h2>
                <p>Select the saved asset or storage tank this fuel slip belongs to.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.pickerToolbar}>
              <input
                value={fuelSlipPickerSearch}
                onChange={(event) => setFuelSlipPickerSearch(event.target.value)}
                placeholder="Search assets or storage tanks..."
                aria-label="Search assets or storage tanks"
              />
              <button type="button" className={styles.secondaryButton} onClick={() => setFuelSlipPickerSearch('')}>Clear</button>
            </div>
            <div className={styles.assetList}>
              {isLoading ? (
                <div className={styles.emptyState}>Loading assets and storage tanks...</div>
              ) : filteredFuelSlipAssets.length || filteredFuelSlipStorages.length ? (
                <>
                  {filteredFuelSlipAssets.map((asset) => (
                    <button
                      type="button"
                      key={`asset-${asset.id}`}
                      className={styles.assetRow}
                      onClick={() => selectFuelSlipTarget(`asset:${asset.id}`)}
                    >
                      <span className={styles.assetInfo}>
                        <strong>{asset.title}</strong>
                        <small>{fuelSlipAssetMeta(asset) || 'Asset details not set'}</small>
                        <small>{fuelSlipAssetDetail(asset)}</small>
                      </span>
                      <span className={styles.assetValue}>
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
                      onClick={() => selectFuelSlipTarget(`storage_tank:${storage.id}`)}
                    >
                      <span className={styles.assetInfo}>
                        <strong>{storage.name}</strong>
                        <small>{fuelSlipStorageMeta(storage)}</small>
                        <small>Storage tank{storage.locationLabel ? ` · ${storage.locationLabel}` : ''}</small>
                      </span>
                      <span className={styles.assetValue}>
                        <strong>{formatLitres(storage.currentLitres)}</strong>
                        <small>available</small>
                      </span>
                    </button>
                  ))}
                </>
              ) : <div className={styles.emptyState}>No matching assets or storage tanks found.</div>}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'fuel-slip' && fuelSlipFlow === 'upload' ? (
        <div className={styles.fuelSlipFlowBackdrop} role="dialog" aria-modal="true" aria-label="Upload fuel slip/photo">
          <div className={`${styles.formModal} ${styles.costUploadModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Upload fuel slip/photo</h2>
                <p>{selectedFuelSlipTargetName} · Automatic capture</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.formModalScrollBody}>
              <section className={styles.uploadPanel}>
                <h3>Documents and photos</h3>
                <div className={`${styles.uploadBox} ${fuelSlipUploadReady ? styles.uploadBoxReady : ''}`}>
                  <label className={styles.uploadButton}>
                    <UploadIcon />
                    Add fuel slip/photo
                    <input type="file" accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp,text/plain" onChange={handleFuelSlipUploadChange} disabled={isSaving || isExtractingFuelSlip} />
                  </label>
                  <span className={styles.uploadCounter}>{fuelSlipUploadReady ? '1 / 1' : '0 / 1'}</span>
                  {fuelSlipUploadFileName ? <p>{fuelSlipUploadFileName}</p> : null}
                </div>
                <p className={styles.helperText}>Fuel slip photos are read with OCR. Digital PDFs are read with text extraction. Review the fields before saving.</p>
              </section>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => setFuelSlipFlow('target-automatic')}>Back</button>
              <button type="button" className={styles.primaryButton} onClick={handleFuelSlipExtract} disabled={!fuelSlipUploadFile || isExtractingFuelSlip}>
                {isExtractingFuelSlip ? 'Reading fuel slip/photo...' : 'Review slip details'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'fuel-slip' && fuelSlipFlow === 'manual-form' ? (
        <div className={styles.fuelSlipFlowBackdrop} role="dialog" aria-modal="true" aria-label="Enter fuel slip manually">
          <form className={`${styles.formModal} ${styles.costFormModal} ${styles.fuelSlipCostFormModal}`} onSubmit={handleFuelSlipSubmit}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Enter fuel slip manually</h2>
                <p>{fuelSlipFormSubtitle}</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.formModalScrollBody}>
              {renderFuelSlipFormFields()}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => setFuelSlipFlow('target-manual')} disabled={isSaving}>Back</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Fuel Slip'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {modalMode === 'fuel-slip' && fuelSlipFlow === 'review' ? (
        <div className={styles.fuelSlipFlowBackdrop} role="dialog" aria-modal="true" aria-label={fuelSlipFormTitle}>
          <form className={`${styles.formModal} ${styles.costFormModal} ${styles.fuelSlipCostFormModal}`} onSubmit={handleFuelSlipSubmit}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Review fuel slip details</h2>
                <p>{fuelSlipFormSubtitle}</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.formModalScrollBody}>
              {fuelSlipDraft.extractionWarnings.length ? (
                <div className={styles.warningBox}>
                  {fuelSlipDraft.extractionWarnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              ) : null}

              {renderFuelSlipFormFields()}

              {fuelSlipDraft.documentFileUrl ? (
                <a className={styles.fileLink} href={fuelSlipDraft.documentFileUrl} target="_blank" rel="noreferrer">Open attached fuel slip/photo: {fuelSlipDraft.originalFilename || 'Uploaded file'}</a>
              ) : null}

              {fuelSlipDraft.rawExtractedText ? (
                <details className={styles.rawPreview}>
                  <summary>Raw extraction preview</summary>
                  <pre>{fuelSlipDraft.rawExtractedText}</pre>
                </details>
              ) : null}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => setFuelSlipFlow('upload')} disabled={isSaving}>Back</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Fuel Slip'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {modalMode === 'create-storage' || modalMode === 'edit-storage' ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
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
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
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
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay}`}>
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
                      <img src={buildFuelQrSvgUrl(selectedStorage)} alt={`QR code for ${selectedStorage.name}`} />
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
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="fuel-report-title">
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
        <div className={`${styles.modalOverlay} ${styles.confirmDeleteOverlay}`} role="alertdialog" aria-modal="true" aria-labelledby="delete-fuel-title" aria-describedby="delete-fuel-copy">
          <div className={styles.deleteConfirmModal}>
            <button
              type="button"
              className={styles.deleteConfirmCloseButton}
              onClick={() => setDeleteCandidateStorage(null)}
              aria-label="Close delete confirmation"
              disabled={busyDeleteId === deleteCandidateStorage.id}
            >
              ×
            </button>

            <div className={styles.deleteConfirmContent}>
              <h3 id="delete-fuel-title">Are you sure you want to delete this?</h3>
              <p id="delete-fuel-copy">
                All data will be lost. This permanently removes <strong>{deleteCandidateStorage.name}</strong> from your Fuel Ledger,
                including stock records, QR access, issue history and fuel report data.
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
                  onClick={() => void handleConfirmDeleteStorage()}
                  disabled={busyDeleteId === deleteCandidateStorage.id}
                >
                  <span>{busyDeleteId === deleteCandidateStorage.id ? 'Deleting...' : 'Yes, delete unit'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
