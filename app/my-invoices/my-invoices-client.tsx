'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type SVGProps } from 'react';
import AppHeader from '../../components/AppHeader';
import { WorkspaceTitlePanel } from '../../components/WorkspacePrimitives';
import styles from './page.module.css';

type FlowMode = 'source-choice' | 'asset-manual' | 'asset-automatic' | 'manual-form' | 'upload' | 'review' | null;
type InvoiceSource = 'manual' | 'automatic' | 'fuel_slip';
type FilterSource = 'all' | InvoiceSource;
type UsageMetric = 'none' | 'hours' | 'km' | 'percentage';
type NoticeTone = 'success' | 'error';
type OwnerStorageStatus = 'owner' | 'pending' | 'approved' | 'declined';

type AssetOption = {
  id: string;
  ownerUserId?: string;
  title: string;
  kind: string;
  categoryLabel: string;
  yearModel: number | null;
  usageReading: number | null;
  usageMetric: 'hours' | 'km' | 'percentage';
  condition: string;
  value: number;
  selectedMethod: string;
  meta: string;
  ownerName?: string;
};

type InvoiceDocument = {
  id: string;
  uploadUrl: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  source: InvoiceSource;
  rawExtractedText: string;
  extractionStatus: string;
  extractionWarnings: string[];
  createdAtIso: string;
};

type InvoiceBlock = {
  id: string;
  blockType: 'maintenance' | 'parts' | 'repair' | 'other';
  description: string;
  totalIncVat: number | null;
};

type InvoiceRecord = {
  id: string;
  assetId: string;
  assetTitle: string;
  assetCategoryLabel: string;
  assetYearModel: number | null;
  assetUsageReading: number | null;
  assetUsageMetric: 'hours' | 'km' | 'percentage';
  assetCondition: string;
  ownerName: string;
  createdByDealerUserId: string;
  createdByDealerStaffId: string;
  createdByDisplayName: string;
  ownerStorageStatus: OwnerStorageStatus;
  ownerStorageDecidedAtIso: string | null;
  invoiceDocumentId: string | null;
  document: InvoiceDocument | null;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  subtotalExVat: number | null;
  vatAmount: number | null;
  totalIncVat: number;
  usageReading: number | null;
  usageMetric: UsageMetric;
  source: InvoiceSource;
  notes: string;
  maintenanceWorkDone: string;
  partsSupplied: string;
  repairWorkDone: string;
  blocks: InvoiceBlock[];
  createdAtIso: string;
  updatedAtIso: string;
};

type InvoiceSummary = {
  totalSpent: number;
  maintenanceSpend: number;
  partsSpend: number;
  repairSpend: number;
  otherSpend: number;
  vatTotal: number;
  invoiceCount: number;
};

type InvoicesResponse = {
  ok: boolean;
  assets?: AssetOption[];
  invoices?: InvoiceRecord[];
  summary?: InvoiceSummary;
  invoice?: InvoiceRecord | null;
  duplicateWarnings?: string[];
  dealerDefaults?: DealerDefaults;
  message?: string;
  error?: string;
};

type DealerDefaults = {
  supplierName: string;
  vatNumber: string;
  address: string;
};

type MyInvoicesClientProps = {
  dealerMode?: boolean;
  showAppHeader?: boolean;
  initialAssetId?: string;
  initialOpenAdd?: boolean;
  initialDealerDefaults?: DealerDefaults;
};

type UploadResponse = {
  ok: boolean;
  document?: InvoiceDocument;
  error?: string;
};

type ExtractionDraft = {
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  subtotalExVat?: number | null;
  vatAmount?: number | null;
  totalIncVat?: number | null;
  usageReading?: number | null;
  usageMetric?: UsageMetric;
  maintenanceWorkDone?: string;
  partsSupplied?: string;
  repairWorkDone?: string;
  notes?: string;
};

type ExtractionResponse = {
  ok: boolean;
  document?: InvoiceDocument;
  extraction?: {
    draft: ExtractionDraft;
    rawText: string;
    warnings: string[];
    quality: 'none' | 'weak' | 'good';
  };
  error?: string;
};

type InvoiceDraft = {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  subtotalExVat: string;
  vatAmount: string;
  totalIncVat: string;
  usageReading: string;
  usageMetric: UsageMetric;
  maintenanceWorkDone: string;
  partsSupplied: string;
  repairWorkDone: string;
  notes: string;
  source: InvoiceSource;
  invoiceDocumentId: string | null;
};

type InvoiceFilterState = {
  ownerId: string;
  assetId: string;
  source: FilterSource;
  year: string;
  month: string;
};

type FilterDropdownKey = 'owner' | 'asset' | 'source' | 'year' | 'month' | 'download-year' | 'download-month';

type FilterSelectOption = {
  value: string;
  label: string;
};

type Notice = {
  tone: NoticeTone;
  message: string;
};

type ReportFormat = 'pdf' | 'xlsx' | 'csv';
type DownloadExportFormat = Exclude<ReportFormat, 'csv'>;
type DownloadStep = 'format' | 'timeline' | 'fuel';

const DOWNLOAD_STEPS: Array<{ key: DownloadStep; label: string }> = [
  { key: 'format', label: 'Format' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'fuel', label: 'Fuel costs' },
];

const DEFAULT_FILTERS: InvoiceFilterState = {
  ownerId: 'all',
  assetId: 'all',
  source: 'all',
  year: 'all',
  month: 'all',
};

const INVOICE_PAGE_SIZE = 10;

const MONTH_OPTIONS = [
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

const SOURCE_FILTER_OPTIONS: FilterSelectOption[] = [
  { value: 'all', label: 'All cost sources' },
  { value: 'manual', label: 'Manual cost records' },
  { value: 'automatic', label: 'Uploaded invoice/photo records' },
  { value: 'fuel_slip', label: 'Fuel Slip costs' },
];

const DEALER_SOURCE_FILTER_OPTIONS: FilterSelectOption[] = [
  { value: 'all', label: 'All dealer cost sources' },
  { value: 'manual', label: 'Manual cost records' },
  { value: 'automatic', label: 'Uploaded invoice/photo records' },
];

const USAGE_METRIC_OPTIONS: Array<{ value: UsageMetric; label: string }> = [
  { value: 'none', label: 'No usage reading' },
  { value: 'hours', label: 'Hours reading' },
  { value: 'km', label: 'Kilometre reading' },
  { value: 'percentage', label: 'Percentage reading' },
];

function IconBase(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />;
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

function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
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

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </IconBase>
  );
}

function ManualInvoiceIcon(props: SVGProps<SVGSVGElement>) {
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

function AutomaticInvoiceIcon(props: SVGProps<SVGSVGElement>) {
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

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
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

type FilterDropdownProps = {
  label: string;
  dropdownKey: FilterDropdownKey;
  value: string;
  options: FilterSelectOption[];
  openDropdown: FilterDropdownKey | null;
  disabled?: boolean;
  searchable?: boolean;
  searchValue?: string;
  searchPlaceholder?: string;
  noMatchesLabel?: string;
  onOpenChange: (key: FilterDropdownKey | null) => void;
  onChange: (value: string) => void;
  onSearchChange?: (value: string) => void;
};

function FilterDropdown({
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
}: FilterDropdownProps) {
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
        data-filter-dropdown="true"
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
          <div className={styles.customFilterSelectMenu} role="listbox" aria-label={label}>
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
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'R 0';
  return `R ${Math.round(value).toLocaleString('en-ZA')}`;
}

function formatMoneyWithCents(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return value.toFixed(2);
}

function formatGroupedInteger(value: unknown): string {
  const digits = String(value ?? '').replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatInvoiceMoneyInput(value: unknown): string {
  const raw = String(value ?? '')
    .replace(/zar/gi, '')
    .replace(/rand/gi, '')
    .replace(/r/gi, '')
    .replace(/\u00a0/g, ' ')
    .trim();

  if (!raw) return '';

  const normalized = raw.replace(/,/g, '.');
  const decimalIndex = normalized.indexOf('.');
  const hasDecimal = decimalIndex >= 0;
  const integerPart = hasDecimal ? normalized.slice(0, decimalIndex) : normalized;
  const decimalPart = hasDecimal ? normalized.slice(decimalIndex + 1).replace(/[^0-9]/g, '').slice(0, 2) : '';
  const groupedInteger = formatGroupedInteger(integerPart);

  if (!groupedInteger && !hasDecimal) return '';

  return hasDecimal ? `${groupedInteger || '0'}.${decimalPart}` : groupedInteger;
}

function formatInvoiceUsageInput(value: unknown): string {
  return formatGroupedInteger(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function conditionLabel(value: string | null | undefined): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (!normalized) return '';

  return (
    {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      used: 'Used',
      serious: 'Requires attention',
    }[normalized] ??
    normalized
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '')
      .join(' ')
  );
}

function formatAssetUsageReading(value: number | null | undefined, metric: Exclude<UsageMetric, 'none'>): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';

  if (metric === 'percentage') {
    return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}%`;
  }

  if (value <= 0) return '';

  const rounded = Math.round(value);
  const unit = metric === 'km' ? 'km' : 'hours';

  return `${rounded.toLocaleString('en-ZA')} ${unit}`;
}

function invoiceAssetYearLabel(invoice: InvoiceRecord): string {
  const category = String(invoice.assetCategoryLabel ?? '').toLowerCase();
  return category.includes('property') || category.includes('building') ? 'Year Built' : 'Year Model';
}

function buildInvoiceAssetMeta(invoice: InvoiceRecord): string {
  const assetTitle = String(invoice.assetTitle || 'Saved asset').trim();
  const assetYear = typeof invoice.assetYearModel === 'number' && Number.isFinite(invoice.assetYearModel) && invoice.assetYearModel > 0
    ? `${invoiceAssetYearLabel(invoice)}: ${invoice.assetYearModel}`
    : '';
  const assetUsage = formatAssetUsageReading(invoice.assetUsageReading, invoice.assetUsageMetric);
  const assetCondition = conditionLabel(invoice.assetCondition);
  const details = [
    assetYear,
    assetUsage ? `Usage: ${assetUsage}` : '',
    assetCondition ? `Condition: ${assetCondition}` : '',
  ].filter(Boolean);

  return details.length ? `${assetTitle} ${details.join(' • ')}` : assetTitle;
}

function sourceLabel(source: InvoiceSource): string {
  if (source === 'fuel_slip') return 'Fuel Slip';
  return source === 'automatic' ? 'Automatic' : 'Manual';
}

function ownerStorageLabel(status: OwnerStorageStatus): string {
  if (status === 'approved') return 'Dealer and owner';
  if (status === 'declined') return 'Dealer only';
  if (status === 'pending') return 'Owner decision pending';
  return 'Owner Cost Ledger';
}


function captureMethodLabel(source: InvoiceSource): string {
  if (source === 'fuel_slip') return 'Fuel Slip';
  return source === 'automatic' ? 'Automatic capture' : 'Manual entry';
}

function buildEmptyDraft(source: InvoiceSource, defaultSupplierName = ''): InvoiceDraft {
  return {
    supplierName: defaultSupplierName,
    invoiceNumber: '',
    invoiceDate: '',
    subtotalExVat: '',
    vatAmount: '',
    totalIncVat: '',
    usageReading: '',
    usageMetric: 'none',
    maintenanceWorkDone: '',
    partsSupplied: '',
    repairWorkDone: '',
    notes: '',
    source,
    invoiceDocumentId: null,
  };
}

function draftFromExtraction(
  extractionDraft: ExtractionDraft,
  source: InvoiceSource,
  documentId: string,
  defaultUsageMetric: UsageMetric = 'none',
  defaultSupplierName = '',
): InvoiceDraft {
  return {
    supplierName: extractionDraft.supplierName || defaultSupplierName,
    invoiceNumber: extractionDraft.invoiceNumber ?? '',
    invoiceDate: extractionDraft.invoiceDate ?? '',
    subtotalExVat: formatInvoiceMoneyInput(formatMoneyWithCents(extractionDraft.subtotalExVat ?? null)),
    vatAmount: formatInvoiceMoneyInput(formatMoneyWithCents(extractionDraft.vatAmount ?? null)),
    totalIncVat: formatInvoiceMoneyInput(formatMoneyWithCents(extractionDraft.totalIncVat ?? null)),
    usageReading: extractionDraft.usageReading === null || typeof extractionDraft.usageReading === 'undefined' ? '' : formatInvoiceUsageInput(extractionDraft.usageReading),
    usageMetric: extractionDraft.usageMetric && extractionDraft.usageMetric !== 'none' ? extractionDraft.usageMetric : defaultUsageMetric,
    maintenanceWorkDone: extractionDraft.maintenanceWorkDone ?? '',
    partsSupplied: extractionDraft.partsSupplied ?? '',
    repairWorkDone: extractionDraft.repairWorkDone ?? '',
    notes: extractionDraft.notes ?? '',
    source,
    invoiceDocumentId: documentId,
  };
}

function draftFromInvoice(invoice: InvoiceRecord): InvoiceDraft {
  return {
    supplierName: invoice.supplierName ?? '',
    invoiceNumber: invoice.invoiceNumber ?? '',
    invoiceDate: invoice.invoiceDate ?? '',
    subtotalExVat: formatInvoiceMoneyInput(formatMoneyWithCents(invoice.subtotalExVat)),
    vatAmount: formatInvoiceMoneyInput(formatMoneyWithCents(invoice.vatAmount)),
    totalIncVat: formatInvoiceMoneyInput(formatMoneyWithCents(invoice.totalIncVat)),
    usageReading: invoice.usageReading === null || typeof invoice.usageReading === 'undefined' ? '' : formatInvoiceUsageInput(invoice.usageReading),
    usageMetric: invoice.usageMetric ?? 'none',
    maintenanceWorkDone: invoice.maintenanceWorkDone ?? '',
    partsSupplied: invoice.partsSupplied ?? '',
    repairWorkDone: invoice.repairWorkDone ?? '',
    notes: invoice.notes ?? '',
    source: invoice.source,
    invoiceDocumentId: invoice.invoiceDocumentId,
  };
}

function assetSearchText(asset: AssetOption): string {
  return `${asset.ownerName ?? ''} ${asset.title} ${asset.categoryLabel} ${asset.meta} ${asset.value}`.toLowerCase();
}

function invoiceSearchText(invoice: InvoiceRecord): string {
  return [
    invoice.supplierName,
    invoice.invoiceNumber,
    invoice.assetTitle,
    invoice.ownerName,
    invoice.createdByDisplayName,
    ownerStorageLabel(invoice.ownerStorageStatus),
    invoice.source,
    sourceLabel(invoice.source),
    invoice.invoiceDate,
    invoice.totalIncVat,
    invoice.vatAmount,
    invoice.notes,
    invoice.maintenanceWorkDone,
    invoice.partsSupplied,
    invoice.repairWorkDone,
  ]
    .join(' ')
    .toLowerCase();
}

function invoiceYear(invoice: InvoiceRecord): number | null {
  if (!invoice.invoiceDate) return null;
  const year = Number(invoice.invoiceDate.slice(0, 4));
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

function buildInvoiceListUrl(filters: InvoiceFilterState, apiRoot: string): string {
  const params = new URLSearchParams();

  if (filters.ownerId !== 'all') params.set('ownerId', filters.ownerId);
  if (filters.assetId !== 'all') params.set('assetId', filters.assetId);
  if (filters.year !== 'all') params.set('year', filters.year);
  if (filters.month !== 'all') params.set('month', filters.month);

  const query = params.toString();
  return query ? `${apiRoot}?${query}` : apiRoot;
}

function buildReportUrl(
  filters: InvoiceFilterState,
  format: ReportFormat,
  includeFuelSlipCosts: boolean,
): string {
  const params = new URLSearchParams({ format, includeFuelSlipCosts: includeFuelSlipCosts ? 'true' : 'false' });

  if (filters.assetId !== 'all') params.set('assetId', filters.assetId);
  if (filters.year !== 'all') params.set('year', filters.year);
  if (filters.month !== 'all') params.set('month', filters.month);

  return `/api/my-invoices/report?${params.toString()}`;
}

export default function MyInvoicesClient({
  dealerMode = false,
  showAppHeader,
  initialAssetId = '',
  initialOpenAdd = false,
  initialDealerDefaults = { supplierName: '', vatNumber: '', address: '' },
}: MyInvoicesClientProps = {}) {
  const apiRoot = dealerMode ? '/api/dealer/cost' : '/api/my-invoices';
  const shouldShowAppHeader = showAppHeader ?? !dealerMode;
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [flow, setFlow] = useState<FlowMode>(null);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<InvoiceFilterState>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<InvoiceFilterState>(DEFAULT_FILTERS);
  const [downloadFilters, setDownloadFilters] = useState<InvoiceFilterState>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentInvoicePage, setCurrentInvoicePage] = useState(1);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<FilterDropdownKey | null>(null);
  const [usageMetricDropdownOpen, setUsageMetricDropdownOpen] = useState(false);
  const [filterAssetSearch, setFilterAssetSearch] = useState('');
  const [filterOwnerSearch, setFilterOwnerSearch] = useState('');
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadStep, setDownloadStep] = useState<DownloadStep>('format');
  const [downloadFormat, setDownloadFormat] = useState<DownloadExportFormat>('pdf');
  const [includeFuelSlipCosts, setIncludeFuelSlipCosts] = useState(true);
  const [dealerDefaults, setDealerDefaults] = useState<DealerDefaults>(initialDealerDefaults);
  const [draft, setDraft] = useState<InvoiceDraft>(buildEmptyDraft('manual', initialDealerDefaults.supplierName));
  const [assetLockedForFlow, setAssetLockedForFlow] = useState(false);
  const [initialLaunchHandled, setInitialLaunchHandled] = useState(!initialOpenAdd);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [manualUploadFile, setManualUploadFile] = useState<File | null>(null);
  const [automaticUploadFile, setAutomaticUploadFile] = useState<File | null>(null);
  const [uploadedDocument, setUploadedDocument] = useState<InvoiceDocument | null>(null);
  const [rawTextPreview, setRawTextPreview] = useState('');
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);
  const [deleteCandidateInvoice, setDeleteCandidateInvoice] = useState<InvoiceRecord | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInvoices() {
      setIsLoading(true);

      try {
        const data = await fetchInvoiceData(activeFilters);

        if (!cancelled) {
          applyInvoiceData(data);
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'My Cost Ledger could not be loaded.' });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadInvoices();

    return () => {
      cancelled = true;
    };
  }, [activeFilters.ownerId, activeFilters.assetId, activeFilters.year, activeFilters.month]);

  useEffect(() => {
    if (initialLaunchHandled || isLoading) return;
    setInitialLaunchHandled(true);

    const requestedAssetId = initialAssetId.trim();
    if (requestedAssetId && assets.some((asset) => asset.id === requestedAssetId)) {
      openAddInvoiceModal(requestedAssetId);
      return;
    }

    if (requestedAssetId) {
      setNotice({ tone: 'error', message: 'This asset is not currently shared with your dealership.' });
    }
  }, [assets, initialAssetId, initialLaunchHandled, isLoading]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  const filteredAssets = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => assetSearchText(asset).includes(query));
  }, [assets, pickerSearch]);

  const visibleInvoices = useMemo(() => {
    const query = invoiceSearch.trim().toLowerCase();

    return invoices.filter((invoice) => {
      if (activeFilters.source !== 'all' && invoice.source !== activeFilters.source) return false;
      if (query && !invoiceSearchText(invoice).includes(query)) return false;
      return true;
    });
  }, [activeFilters.source, invoiceSearch, invoices]);

  const totalInvoicePages = useMemo(() => Math.max(1, Math.ceil(visibleInvoices.length / INVOICE_PAGE_SIZE)), [visibleInvoices.length]);
  const safeInvoicePage = Math.min(currentInvoicePage, totalInvoicePages);
  const paginatedInvoices = useMemo(() => {
    const startIndex = (safeInvoicePage - 1) * INVOICE_PAGE_SIZE;
    return visibleInvoices.slice(startIndex, startIndex + INVOICE_PAGE_SIZE);
  }, [safeInvoicePage, visibleInvoices]);
  const shouldShowPagination = visibleInvoices.length > INVOICE_PAGE_SIZE;

  const yearOptions = useMemo(() => {
    const years = new Set(availableYears);
    for (const value of [activeFilters.year, draftFilters.year, downloadFilters.year]) {
      const year = Number(value);
      if (Number.isInteger(year) && year >= 2000 && year <= 2100) years.add(year);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [activeFilters.year, availableYears, downloadFilters.year, draftFilters.year]);

  const ownerFilterOptions = useMemo<FilterSelectOption[]>(() => {
    const owners = new Map<string, string>();
    for (const asset of assets) {
      const ownerId = String(asset.ownerUserId ?? '').trim();
      const ownerName = String(asset.ownerName ?? '').trim();
      if (ownerId && !owners.has(ownerId)) owners.set(ownerId, ownerName || 'Asset owner');
    }

    return [
      { value: 'all', label: 'All companies and owners' },
      ...Array.from(owners.entries())
        .sort((left, right) => left[1].localeCompare(right[1]))
        .map(([value, label]) => ({ value, label })),
    ];
  }, [assets]);

  const assetFilterOptions = useMemo<FilterSelectOption[]>(() => {
    const visibleAssets = dealerMode && draftFilters.ownerId !== 'all'
      ? assets.filter((asset) => asset.ownerUserId === draftFilters.ownerId)
      : dealerMode
        ? []
        : assets;

    return [
      {
        value: 'all',
        label: dealerMode && draftFilters.ownerId === 'all'
          ? 'Choose a company or owner first'
          : dealerMode
            ? 'All assets for this owner'
            : 'All saved assets',
      },
      ...visibleAssets.map((asset) => ({ value: asset.id, label: asset.title })),
    ];
  }, [assets, dealerMode, draftFilters.ownerId]);

  const yearFilterOptions = useMemo<FilterSelectOption[]>(() => [
    { value: 'all', label: 'All invoice years' },
    ...yearOptions.map((year) => ({ value: String(year), label: String(year) })),
  ], [yearOptions]);

  const monthFilterOptions = useMemo<FilterSelectOption[]>(() => [
    { value: 'all', label: 'All invoice months' },
    ...MONTH_OPTIONS.map((month, index) => ({ value: String(index + 1), label: month })),
  ], []);

  const activeFilterCount = useMemo(() => {
    return [
      dealerMode && activeFilters.ownerId !== 'all',
      activeFilters.assetId !== 'all',
      activeFilters.source !== 'all',
      activeFilters.year !== 'all',
      activeFilters.month !== 'all',
    ].filter(Boolean).length;
  }, [activeFilters, dealerMode]);

  const sourceChoiceOpen = flow === 'source-choice';
  const assetPickerOpen = flow === 'asset-manual' || flow === 'asset-automatic';
  const formOpen = flow === 'manual-form' || flow === 'review';
  const flowTitle = flow === 'asset-automatic' ? 'Choose asset for uploaded cost' : 'Choose asset for manual cost';
  const formTitle = flow === 'review' ? 'Review cost details' : 'Enter cost manually';
  const hasInvoiceSearch = invoiceSearch.trim().length > 0;
  const deleteConfirmOpen = Boolean(deleteCandidateInvoice);
  const modalOpen = sourceChoiceOpen || assetPickerOpen || flow === 'upload' || formOpen || filterOpen || downloadOpen || deleteConfirmOpen;
  const selectedUsageMetricOption = USAGE_METRIC_OPTIONS.find((option) => option.value === draft.usageMetric) ?? USAGE_METRIC_OPTIONS[0];

  useEffect(() => {
    setCurrentInvoicePage(1);
  }, [activeFilters.ownerId, activeFilters.assetId, activeFilters.source, activeFilters.year, activeFilters.month, invoiceSearch]);

  useEffect(() => {
    setCurrentInvoicePage((page) => Math.min(page, totalInvoicePages));
  }, [totalInvoicePages]);

  useEffect(() => {
    if (!modalOpen) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [modalOpen]);

  useEffect(() => {
    if ((!filterOpen && !downloadOpen) || !openFilterDropdown) return undefined;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('[data-filter-dropdown="true"]')) {
        setOpenFilterDropdown(null);
        setFilterAssetSearch('');
        setFilterOwnerSearch('');
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenFilterDropdown(null);
        setFilterAssetSearch('');
        setFilterOwnerSearch('');
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [downloadOpen, filterOpen, openFilterDropdown]);

  useEffect(() => {
    if (!formOpen) setUsageMetricDropdownOpen(false);
  }, [formOpen]);

  useEffect(() => {
    if (!usageMetricDropdownOpen) return undefined;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('[data-usage-metric-dropdown="true"]')) {
        setUsageMetricDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setUsageMetricDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [usageMetricDropdownOpen]);

  async function fetchInvoiceData(filters: InvoiceFilterState): Promise<InvoicesResponse> {
    const response = await fetch(buildInvoiceListUrl(filters, apiRoot), { cache: 'no-store' });
    const data = (await response.json()) as InvoicesResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'My Cost Ledger could not be loaded.');
    }

    return data;
  }

  function applyInvoiceData(data: InvoicesResponse) {
    const nextInvoices = data.invoices ?? [];

    setAssets(data.assets ?? []);
    setInvoices(nextInvoices);
    if (data.dealerDefaults) setDealerDefaults(data.dealerDefaults);
    setAvailableYears((current) => {
      const years = new Set(current);
      for (const invoice of nextInvoices) {
        const year = invoiceYear(invoice);
        if (year) years.add(year);
      }
      return Array.from(years).sort((a, b) => b - a);
    });
  }

  async function reloadData(filters: InvoiceFilterState = activeFilters) {
    const data = await fetchInvoiceData(filters);
    applyInvoiceData(data);
  }

  function defaultUsageMetricForAsset(assetId: string): UsageMetric {
    const asset = assets.find((candidate) => candidate.id === assetId);
    return asset?.usageMetric ?? 'none';
  }

  function buildDraftForAsset(source: InvoiceSource, assetId: string): InvoiceDraft {
    return {
      ...buildEmptyDraft(source, dealerMode ? dealerDefaults.supplierName : ''),
      usageMetric: defaultUsageMetricForAsset(assetId),
    };
  }

  function closeModal() {
    setFlow(null);
    setSelectedAssetId('');
    setPickerSearch('');
    setEditingInvoiceId(null);
    setManualUploadFile(null);
    setAutomaticUploadFile(null);
    setUploadedDocument(null);
    setRawTextPreview('');
    setExtractionWarnings([]);
    setUsageMetricDropdownOpen(false);
    setAssetLockedForFlow(false);
    setDraft(buildEmptyDraft('manual', dealerMode ? dealerDefaults.supplierName : ''));
  }

  function openAddInvoiceModal(assetId = '') {
    const normalizedAssetId = assetId.trim();
    setNotice(null);
    setSelectedAssetId(normalizedAssetId);
    setPickerSearch('');
    setEditingInvoiceId(null);
    setManualUploadFile(null);
    setAutomaticUploadFile(null);
    setUploadedDocument(null);
    setRawTextPreview('');
    setExtractionWarnings([]);
    setUsageMetricDropdownOpen(false);
    setAssetLockedForFlow(Boolean(normalizedAssetId));
    setDraft(buildEmptyDraft('manual', dealerMode ? dealerDefaults.supplierName : ''));
    setFlow('source-choice');
  }

  function startFlow(source: InvoiceSource) {
    const presetAssetId = selectedAssetId && assets.some((asset) => asset.id === selectedAssetId)
      ? selectedAssetId
      : '';
    setNotice(null);
    setSelectedAssetId(presetAssetId);
    setPickerSearch('');
    setEditingInvoiceId(null);
    setManualUploadFile(null);
    setAutomaticUploadFile(null);
    setUploadedDocument(null);
    setRawTextPreview('');
    setExtractionWarnings([]);
    setUsageMetricDropdownOpen(false);
    setDraft(presetAssetId
      ? buildDraftForAsset(source, presetAssetId)
      : buildEmptyDraft(source, dealerMode ? dealerDefaults.supplierName : ''));
    setAssetLockedForFlow(Boolean(presetAssetId));
    setFlow(presetAssetId
      ? source === 'manual' ? 'manual-form' : 'upload'
      : source === 'manual' ? 'asset-manual' : 'asset-automatic');
  }

  function selectAssetAndContinue(assetId: string) {
    setSelectedAssetId(assetId);
    setPickerSearch('');
    setAssetLockedForFlow(false);

    if (flow === 'asset-automatic') {
      setDraft(buildDraftForAsset('automatic', assetId));
      setFlow('upload');
      return;
    }

    setDraft(buildDraftForAsset('manual', assetId));
    setFlow('manual-form');
  }

  function openFilterPanel() {
    setDraftFilters(activeFilters);
    setOpenFilterDropdown(null);
    setFilterAssetSearch('');
    setFilterOwnerSearch('');
    setFilterOpen(true);
  }

  function closeFilterPanel() {
    setDraftFilters(activeFilters);
    setOpenFilterDropdown(null);
    setFilterAssetSearch('');
    setFilterOwnerSearch('');
    setFilterOpen(false);
  }

  function applyFilters() {
    setActiveFilters(draftFilters);
    setOpenFilterDropdown(null);
    setFilterAssetSearch('');
    setFilterOwnerSearch('');
    setFilterOpen(false);
  }

  function clearFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setActiveFilters(DEFAULT_FILTERS);
    setOpenFilterDropdown(null);
    setFilterAssetSearch('');
    setFilterOwnerSearch('');
    setFilterOpen(false);
  }

  function handleFilterDropdownOpenChange(key: FilterDropdownKey | null) {
    setOpenFilterDropdown(key);

    if (key !== 'asset') {
      setFilterAssetSearch('');
    }
    if (key !== 'owner') {
      setFilterOwnerSearch('');
    }
  }

  function openDownloadModal() {
    setIncludeFuelSlipCosts(true);
    setDownloadFilters(activeFilters);
    setDownloadStep('format');
    setDownloadFormat('pdf');
    setOpenFilterDropdown(null);
    setDownloadOpen(true);
  }

  function closeDownloadModal() {
    setOpenFilterDropdown(null);
    setDownloadStep('format');
    setDownloadOpen(false);
  }

  function showDownloadFormatStep() {
    setOpenFilterDropdown(null);
    setDownloadStep('format');
  }

  function showDownloadTimelineStep() {
    setOpenFilterDropdown(null);
    setDownloadStep('timeline');
  }

  function showDownloadFuelStep() {
    setOpenFilterDropdown(null);
    setDownloadStep('fuel');
  }

  function handleDownloadReport(format: ReportFormat) {
    const url = buildReportUrl(downloadFilters, format, includeFuelSlipCosts);

    if (format === 'xlsx' || format === 'csv') {
      const link = document.createElement('a');
      link.href = url;
      link.download = '';
      link.rel = 'noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
      closeDownloadModal();
      return;
    }

    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = url;
    closeDownloadModal();
  }

  async function uploadInvoiceFile(assetId: string, source: InvoiceSource, file: File): Promise<InvoiceDocument> {
    const formData = new FormData();
    formData.append('assetId', assetId);
    formData.append('source', source);
    formData.append('file', file);

    const response = await fetch(`${apiRoot}/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = (await response.json()) as UploadResponse;

    if (!response.ok || !data.ok || !data.document) {
      throw new Error(data.error || 'The invoice/photo file could not be uploaded.');
    }

    return data.document;
  }

  async function handleAutomaticExtract() {
    if (!selectedAssetId || !automaticUploadFile) return;

    setIsExtracting(true);
    setNotice(null);

    try {
      const document = await uploadInvoiceFile(selectedAssetId, 'automatic', automaticUploadFile);
      setUploadedDocument(document);

      const response = await fetch(`${apiRoot}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id, assetId: selectedAssetId }),
      });
      const data = (await response.json()) as ExtractionResponse;

      if (!response.ok || !data.ok || !data.extraction) {
        setDraft({ ...buildDraftForAsset('automatic', selectedAssetId), invoiceDocumentId: document.id });
        setExtractionWarnings([data.error || 'Aim4price could not read this invoice/photo automatically. Complete the cost details manually.']);
        setRawTextPreview('');
        setFlow('review');
        return;
      }

      const nextDocument = data.document ?? document;
      setUploadedDocument(nextDocument);
      setDraft(draftFromExtraction(
        data.extraction.draft,
        'automatic',
        nextDocument.id,
        defaultUsageMetricForAsset(selectedAssetId),
        dealerMode ? dealerDefaults.supplierName : '',
      ));
      setExtractionWarnings(data.extraction.warnings ?? []);
      setRawTextPreview((data.extraction.rawText ?? '').slice(0, 3000));
      setFlow('review');
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The uploaded cost flow could not continue.' });
    } finally {
      setIsExtracting(false);
    }
  }

  async function submitInvoiceDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedAssetId) {
      setNotice({ tone: 'error', message: 'Choose an asset before saving the cost record.' });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      let invoiceDocumentId = draft.invoiceDocumentId;

      if (manualUploadFile) {
        const document = await uploadInvoiceFile(selectedAssetId, draft.source, manualUploadFile);
        invoiceDocumentId = document.id;
      }

      const payload = {
        assetId: selectedAssetId,
        invoiceDocumentId,
        supplierName: draft.supplierName,
        invoiceNumber: draft.invoiceNumber,
        invoiceDate: draft.invoiceDate,
        subtotalExVat: draft.subtotalExVat,
        vatAmount: draft.vatAmount,
        totalIncVat: draft.totalIncVat,
        usageReading: draft.usageReading,
        usageMetric: draft.usageMetric,
        source: draft.source,
        maintenanceWorkDone: draft.maintenanceWorkDone,
        partsSupplied: draft.partsSupplied,
        repairWorkDone: draft.repairWorkDone,
        notes: draft.notes,
      };

      const response = await fetch(editingInvoiceId ? `${apiRoot}/${editingInvoiceId}` : apiRoot, {
        method: editingInvoiceId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as InvoicesResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'The cost record could not be saved.');
      }

      await reloadData();
      const duplicateText = data.duplicateWarnings?.length ? ` ${data.duplicateWarnings.join(' ')}` : '';
      closeModal();
      setNotice({
        tone: 'success',
        message: dealerMode
          ? `Cost record saved on the dealer side. The owner has been notified and can choose whether to store it in their Cost Ledger.${duplicateText}`
          : `Cost record saved.${duplicateText}`,
      });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The cost record could not be saved.' });
    } finally {
      setIsSaving(false);
    }
  }

  function editInvoice(invoice: InvoiceRecord) {
    setNotice(null);
    setSelectedAssetId(invoice.assetId);
    setEditingInvoiceId(invoice.id);
    setManualUploadFile(null);
    setAutomaticUploadFile(null);
    setUploadedDocument(invoice.document);
    setRawTextPreview((invoice.document?.rawExtractedText ?? '').slice(0, 3000));
    setExtractionWarnings(invoice.document?.extractionWarnings ?? []);
    setDraft(draftFromInvoice(invoice));
    setFlow(invoice.source === 'automatic' ? 'review' : 'manual-form');
  }

  function openDeleteInvoiceDialog(invoice: InvoiceRecord) {
    setNotice(null);
    setDeleteCandidateInvoice(invoice);
  }

  function closeDeleteInvoiceDialog() {
    if (deletingInvoiceId && deleteCandidateInvoice?.id === deletingInvoiceId) return;
    setDeleteCandidateInvoice(null);
  }

  async function confirmDeleteInvoice() {
    if (!deleteCandidateInvoice) return;

    const invoiceId = deleteCandidateInvoice.id;
    setDeletingInvoiceId(invoiceId);
    setNotice(null);

    try {
      const response = await fetch(`${apiRoot}/${invoiceId}`, { method: 'DELETE' });
      const data = (await response.json()) as InvoicesResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'The cost record could not be deleted.');
      }

      await reloadData();
      setDeleteCandidateInvoice((current) => (current?.id === invoiceId ? null : current));
      setNotice({
        tone: 'success',
        message: data.message || (dealerMode ? 'Cost removed from your dealer records.' : 'Cost record deleted.'),
      });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The cost record could not be deleted.' });
    } finally {
      setDeletingInvoiceId(null);
    }
  }

  function setUsageMetric(value: UsageMetric) {
    setDraft((current) => ({
      ...current,
      usageMetric: value,
      usageReading: value === 'none' ? '' : current.usageReading,
    }));
    setUsageMetricDropdownOpen(false);
  }

  function setDraftField<K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleManualFileChange(event: ChangeEvent<HTMLInputElement>) {
    setManualUploadFile(event.target.files?.[0] ?? null);
  }

  function handleAutomaticFileChange(event: ChangeEvent<HTMLInputElement>) {
    setAutomaticUploadFile(event.target.files?.[0] ?? null);
  }

  return (
    <main className={`${styles.page} ${dealerMode ? styles.dealerCostsPage : ''}`}>
      {shouldShowAppHeader ? <AppHeader active={dealerMode ? 'cost' : 'none'} /> : null}
      <section className={styles.shell}>
        {notice ? <div className={`${styles.notice} ${styles[notice.tone === 'success' ? 'noticeSuccess' : 'noticeError']}`}>{notice.message}</div> : null}

        {dealerMode ? (
          <WorkspaceTitlePanel
            title="CLIENT ASSET COSTS"
            className={styles.dealerCostsTitlePanel}
          />
        ) : (
          <section className={styles.pageTitleBlock}>
            <div>
              <h1>ASSET COST TRACKING SYSTEM</h1>
            </div>
          </section>
        )}

        <section className={styles.invoiceToolbar} aria-label="Saved cost record controls">
          <label className={styles.searchWrap}>
            <SearchIcon className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              value={invoiceSearch}
              onChange={(event) => setInvoiceSearch(event.target.value)}
              placeholder={dealerMode
                ? 'Search clients, shared assets, invoice numbers or costs...'
                : 'Search suppliers, assets, invoice numbers or costs...'}
              aria-label="Search saved cost records"
            />
            {hasInvoiceSearch ? (
              <button type="button" className={styles.clearSearchButton} onClick={() => setInvoiceSearch('')} aria-label="Clear saved cost record search">
                ×
              </button>
            ) : null}
          </label>

          <div className={`${styles.toolbarButtons} ${dealerMode ? styles.dealerToolbarButtons : ''}`}>
            <button type="button" className={`${styles.secondaryButton} ${styles.toolbarButton} ${styles.toolbarAddButton}`} onClick={() => openAddInvoiceModal()}>
              <span className={styles.plusMark} aria-hidden="true">+</span>
              <span>Add Cost</span>
            </button>
            <button type="button" className={`${styles.secondaryButton} ${styles.toolbarButton} ${styles.toolbarFilterButton}`} onClick={openFilterPanel}>
              <FilterIcon className={styles.buttonIcon} />
              <span>Filter</span>
              {activeFilterCount ? <strong>{activeFilterCount}</strong> : null}
            </button>
            {!dealerMode ? (
              <button type="button" className={`${styles.primaryButton} ${styles.toolbarButton} ${styles.toolbarDownloadButton}`} onClick={openDownloadModal}>
                <DownloadIcon className={styles.buttonIcon} />
                <span>Download</span>
              </button>
            ) : null}
          </div>
        </section>

        <section className={styles.invoicePanel} aria-label="Saved cost records">
          <div className={styles.invoiceList}>
            {isLoading ? <div className={styles.emptyState}>Loading saved cost records...</div> : null}

            {!isLoading && !visibleInvoices.length ? (
              <div className={styles.emptyState}>No asset costs saved yet. Add a manual cost or upload an invoice/photo.</div>
            ) : null}

            {!isLoading ? paginatedInvoices.map((invoice) => {
              const updatedLabel = invoice.updatedAtIso ? `Updated ${formatDateTime(invoice.updatedAtIso)}` : '';

              return (
                <article className={styles.invoiceRow} key={invoice.id}>
                  <div className={styles.invoiceHeader}>
                    <div className={styles.invoiceTitleBlock}>
                      <h2 className={styles.invoiceTitle}>{invoice.supplierName || 'Unknown supplier'}</h2>
                      <p className={styles.invoiceAsset}>
                        {dealerMode && invoice.ownerName ? `${invoice.ownerName} · ` : ''}
                        {buildInvoiceAssetMeta(invoice)}
                      </p>
                      <div className={styles.invoiceMetaList}>
                        <span className={styles.invoiceValueMethodLabel}>{invoice.invoiceNumber || 'No invoice number'}</span>
                        <span className={styles.invoiceSavedDateLabel}>{sourceLabel(invoice.source)}</span>
                        {invoice.createdByDisplayName ? (
                          <span className={styles.invoiceSavedDateLabel}>Added by {invoice.createdByDisplayName}</span>
                        ) : null}
                        {dealerMode ? (
                          <span className={styles.invoiceSavedDateLabel}>
                            Visibility: {ownerStorageLabel(invoice.ownerStorageStatus)}
                          </span>
                        ) : null}
                        {updatedLabel ? <span className={styles.invoiceSavedDateLabel}>{updatedLabel}</span> : null}
                      </div>
                    </div>

                    <div className={styles.invoiceHeaderAside}>
                      <div className={styles.invoiceValueBlock}>
                        <strong className={styles.invoicePrice}>{formatMoney(invoice.totalIncVat)}</strong>
                        <span className={styles.invoiceVatLabel}>Total incl. VAT</span>
                      </div>

                      <div className={styles.rowActions}>
                        {invoice.document?.uploadUrl ? (
                          <a className={`${styles.secondaryButtonSmall} ${styles.invoiceOpenButton}`} href={invoice.document.uploadUrl} target="_blank" rel="noreferrer">
                            <OpenFileIcon className={styles.buttonIcon} />
                            <span>Open file</span>
                          </a>
                        ) : null}
                        <button type="button" className={`${styles.secondaryButtonSmall} ${styles.invoiceEditButton}`} onClick={() => editInvoice(invoice)}>
                          <EditIcon className={styles.buttonIcon} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.dangerButtonSmall} ${styles.invoiceDeleteButton}`}
                          onClick={() => openDeleteInvoiceDialog(invoice)}
                          disabled={deletingInvoiceId === invoice.id}
                        >
                          <TrashIcon className={styles.buttonIcon} />
                          <span>{deletingInvoiceId === invoice.id ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            }) : null}
          </div>

          {!isLoading && shouldShowPagination ? (
            <nav className={styles.paginationRow} aria-label="Cost records pagination">
              <button
                type="button"
                className={styles.paginationButton}
                onClick={() => setCurrentInvoicePage((page) => Math.max(1, page - 1))}
                disabled={safeInvoicePage <= 1}
              >
                Previous
              </button>
              <span className={styles.paginationStatus}>Page {safeInvoicePage.toLocaleString('en-ZA')} of {totalInvoicePages.toLocaleString('en-ZA')}</span>
              <button
                type="button"
                className={styles.paginationButton}
                onClick={() => setCurrentInvoicePage((page) => Math.min(totalInvoicePages, page + 1))}
                disabled={safeInvoicePage >= totalInvoicePages}
              >
                Next
              </button>
            </nav>
          ) : null}
        </section>
      </section>

      {sourceChoiceOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Choose cost capture method">
          <div className={`${styles.downloadModal} ${styles.sourceChoiceModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Add asset cost</h2>
                <p>Save an invoice, repair, parts or maintenance cost against {dealerMode ? 'a shared client asset' : 'a saved asset'}.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close add asset cost"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.sourceChoiceGrid}>
              <button type="button" className={styles.sourceChoiceOption} onClick={() => startFlow('manual')}>
                <span className={styles.choiceGraphic}>
                  <ManualInvoiceIcon />
                </span>
                <span className={styles.choiceTitleBlock}>
                  <strong>Enter cost manually</strong>
                  <small>Type the supplier, invoice date, VAT, usage and work details yourself.</small>
                </span>
              </button>
              <button type="button" className={styles.sourceChoiceOption} onClick={() => startFlow('automatic')}>
                <span className={styles.choiceGraphic}>
                  <AutomaticInvoiceIcon />
                </span>
                <span className={styles.choiceTitleBlock}>
                  <strong>Upload invoice/photo</strong>
                  <small>Upload a PDF or photo, then review the extracted cost details.</small>
                </span>
              </button>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {filterOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Filter saved cost records">
          <div className={styles.filterModal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Filter cost records</h2>
                <p>
                  {dealerMode
                    ? 'Choose a company or owner first, then narrow the records to one of their shared assets.'
                    : 'Narrow the Cost Ledger by asset, source and invoice period.'}
                </p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeFilterPanel} aria-label="Close filter"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={`${styles.filterGrid} ${dealerMode ? styles.dealerFilterGrid : ''}`}>
              {dealerMode ? (
                <FilterDropdown
                  label="Company / owner"
                  dropdownKey="owner"
                  value={draftFilters.ownerId}
                  options={ownerFilterOptions}
                  openDropdown={openFilterDropdown}
                  searchable
                  searchValue={filterOwnerSearch}
                  searchPlaceholder="Search companies and owners"
                  noMatchesLabel="No companies or owners found"
                  onOpenChange={handleFilterDropdownOpenChange}
                  onChange={(value) => setDraftFilters((current) => ({
                    ...current,
                    ownerId: value,
                    assetId: 'all',
                  }))}
                  onSearchChange={setFilterOwnerSearch}
                />
              ) : null}
              <FilterDropdown
                label="Asset"
                dropdownKey="asset"
                value={draftFilters.assetId}
                options={assetFilterOptions}
                openDropdown={openFilterDropdown}
                searchable
                searchValue={filterAssetSearch}
                searchPlaceholder={dealerMode ? 'Search this owner’s assets' : 'Search saved assets'}
                noMatchesLabel={dealerMode ? 'No shared assets found for this owner' : 'No saved assets found'}
                onOpenChange={handleFilterDropdownOpenChange}
                onChange={(value) => setDraftFilters((current) => ({ ...current, assetId: value }))}
                onSearchChange={setFilterAssetSearch}
                disabled={dealerMode && draftFilters.ownerId === 'all'}
              />
              <FilterDropdown
                label="Source"
                dropdownKey="source"
                value={draftFilters.source}
                options={dealerMode ? DEALER_SOURCE_FILTER_OPTIONS : SOURCE_FILTER_OPTIONS}
                openDropdown={openFilterDropdown}
                onOpenChange={handleFilterDropdownOpenChange}
                onChange={(value) => setDraftFilters((current) => ({ ...current, source: value as FilterSource }))}
              />
              <FilterDropdown
                label="Year"
                dropdownKey="year"
                value={draftFilters.year}
                options={yearFilterOptions}
                openDropdown={openFilterDropdown}
                onOpenChange={handleFilterDropdownOpenChange}
                onChange={(value) => setDraftFilters((current) => ({ ...current, year: value, month: value === 'all' ? 'all' : current.month }))}
              />
              <FilterDropdown
                label="Month"
                dropdownKey="month"
                value={draftFilters.month}
                options={monthFilterOptions}
                openDropdown={openFilterDropdown}
                onOpenChange={handleFilterDropdownOpenChange}
                onChange={(value) => setDraftFilters((current) => ({ ...current, month: value }))}
                disabled={draftFilters.year === 'all'}
              />
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeFilterPanel}>Close</button>
              <button type="button" className={styles.secondaryButton} onClick={clearFilters}>Clear filters</button>
              <button type="button" className={styles.primaryButton} onClick={applyFilters}>Apply filters</button>
            </div>
          </div>
        </div>
      ) : null}

      {!dealerMode && downloadOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Download cost records">
          <div className={`${styles.downloadModal} ${styles.reportModal} ${styles.downloadExportModal} ${downloadStep === 'format' ? styles.downloadFormatModal : ''}`}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.downloadStepEyebrow}>
                  Step {DOWNLOAD_STEPS.findIndex((step) => step.key === downloadStep) + 1} of {DOWNLOAD_STEPS.length}
                </span>
                <h2>
                  {downloadStep === 'format'
                    ? 'Download cost records'
                    : downloadStep === 'timeline'
                      ? 'Choose report timeline'
                      : 'External fuel costs'}
                </h2>
                <p>
                  {downloadStep === 'format'
                    ? 'Choose PDF or Excel to begin.'
                    : downloadStep === 'timeline'
                      ? 'Select the year and optional month to include.'
                      : 'Choose whether Fuel Slip records should be included.'}
                </p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeDownloadModal} aria-label="Close download"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <ol className={styles.downloadStageRail} aria-label="Cost ledger download progress">
              {DOWNLOAD_STEPS.map((step, index) => {
                const activeIndex = DOWNLOAD_STEPS.findIndex((item) => item.key === downloadStep);
                const isActive = step.key === downloadStep;
                const isComplete = index < activeIndex;

                return (
                  <li
                    key={step.key}
                    className={`${styles.downloadStageItem} ${isActive ? styles.downloadStageItemActive : ''} ${isComplete ? styles.downloadStageItemComplete : ''}`}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <span className={styles.downloadStageNumber}>{isComplete ? '✓' : index + 1}</span>
                    <span>{step.label}</span>
                  </li>
                );
              })}
            </ol>
            {downloadStep === 'format' ? (
              <div className={styles.downloadStageContent}>
                <div className={`${styles.reportChoiceGrid} ${styles.downloadFormatGrid}`}>
                  <button
                    type="button"
                    className={`${styles.reportOption} ${downloadFormat === 'pdf' ? styles.reportOptionActive : ''}`}
                    onClick={() => setDownloadFormat('pdf')}
                    aria-pressed={downloadFormat === 'pdf'}
                  >
                    <span className={styles.reportGraphic}>
                      <img src="/brand/pdf.png" alt="PDF report" className={styles.reportGraphicImage} />
                    </span>
                    <span className={styles.reportTitleBlock}>
                      <strong>PDF report</strong>
                      <small>Open a clear report for clients, banks or insurance partners.</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.reportOption} ${downloadFormat === 'xlsx' ? styles.reportOptionActive : ''}`}
                    onClick={() => setDownloadFormat('xlsx')}
                    aria-pressed={downloadFormat === 'xlsx'}
                  >
                    <span className={styles.reportGraphic}>
                      <img src="/brand/sheet.png" alt="Excel workbook" className={styles.reportGraphicImage} />
                    </span>
                    <span className={styles.reportTitleBlock}>
                      <strong>XLSX workbook</strong>
                      <small>Download all report rows in an Excel-ready workbook.</small>
                    </span>
                  </button>
                </div>
                <div className={`${styles.modalFooter} ${styles.downloadModalFooter} ${styles.downloadFormatFooter}`}>
                  <button type="button" className={`${styles.secondaryButton} ${styles.downloadSecondaryButton}`} onClick={closeDownloadModal}>Cancel</button>
                  <button type="button" className={`${styles.primaryButton} ${styles.downloadNextButton}`} onClick={showDownloadTimelineStep}>
                    <span>Next</span>
                  </button>
                </div>
              </div>
            ) : downloadStep === 'timeline' ? (
              <div className={styles.downloadStageContent}>
                <section className={styles.reportPeriodPanel} aria-label="Report timeline">
                  <div className={styles.reportSectionHeading}>
                    <strong>Report timeline</strong>
                    <span>Choose a year, then narrow the report to a specific month if needed.</span>
                  </div>
                  <div className={styles.reportPeriodGrid}>
                    <FilterDropdown
                      label="Year"
                      dropdownKey="download-year"
                      value={downloadFilters.year}
                      options={yearFilterOptions}
                      openDropdown={openFilterDropdown}
                      onOpenChange={handleFilterDropdownOpenChange}
                      onChange={(value) => setDownloadFilters((current) => ({
                        ...current,
                        year: value,
                        month: value === 'all' ? 'all' : current.month,
                      }))}
                    />
                    <FilterDropdown
                      label="Month"
                      dropdownKey="download-month"
                      value={downloadFilters.month}
                      options={monthFilterOptions}
                      openDropdown={openFilterDropdown}
                      onOpenChange={handleFilterDropdownOpenChange}
                      onChange={(value) => setDownloadFilters((current) => ({ ...current, month: value }))}
                      disabled={downloadFilters.year === 'all'}
                    />
                  </div>
                </section>
                <div className={`${styles.modalFooter} ${styles.downloadModalFooter}`}>
                  <button type="button" className={`${styles.secondaryButton} ${styles.downloadSecondaryButton}`} onClick={showDownloadFormatStep}>Back</button>
                  <div className={styles.downloadFooterActions}>
                    <button type="button" className={`${styles.secondaryButton} ${styles.downloadSecondaryButton}`} onClick={closeDownloadModal}>Cancel</button>
                    <button type="button" className={`${styles.primaryButton} ${styles.downloadNextButton}`} onClick={showDownloadFuelStep}>
                      <span>Next</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.downloadStageContent}>
                <section className={styles.downloadFuelPanel} aria-label="External fuel costs">
                  <div className={styles.reportSectionHeading}>
                    <strong>Include external fuel costs?</strong>
                    <span>Fuel Slip records can be included in the ledger and its totals, or left out completely.</span>
                  </div>
                  <div className={`${styles.reportChoiceGrid} ${styles.downloadFuelChoiceGrid}`}>
                    <button
                      type="button"
                      className={`${styles.reportOption} ${includeFuelSlipCosts ? styles.reportOptionActive : ''}`}
                      onClick={() => setIncludeFuelSlipCosts(true)}
                      aria-pressed={includeFuelSlipCosts}
                    >
                      <span className={styles.reportGraphic}>
                        <ManualInvoiceIcon />
                      </span>
                      <span className={styles.reportTitleBlock}>
                        <strong>Include fuel slip costs</strong>
                        <small>Fuel Slip records stay in the report and are included in totals.</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.reportOption} ${!includeFuelSlipCosts ? styles.reportOptionActive : ''}`}
                      onClick={() => setIncludeFuelSlipCosts(false)}
                      aria-pressed={!includeFuelSlipCosts}
                    >
                      <span className={styles.reportGraphic}>
                        <AutomaticInvoiceIcon />
                      </span>
                      <span className={styles.reportTitleBlock}>
                        <strong>Exclude fuel slip costs</strong>
                        <small>Fuel Slip records are left out of the report and its totals.</small>
                      </span>
                    </button>
                  </div>
                </section>
                <div className={`${styles.modalFooter} ${styles.downloadModalFooter}`}>
                  <button type="button" className={`${styles.secondaryButton} ${styles.downloadSecondaryButton}`} onClick={showDownloadTimelineStep}>Back</button>
                  <div className={styles.downloadFooterActions}>
                    <button type="button" className={`${styles.secondaryButton} ${styles.downloadSecondaryButton}`} onClick={closeDownloadModal}>Cancel</button>
                    <button
                      type="button"
                      className={`${styles.primaryButton} ${styles.downloadSubmitButton}`}
                      onClick={() => handleDownloadReport(downloadFormat)}
                    >
                      <DownloadIcon className={styles.buttonIcon} />
                      <span>
                        {downloadFormat === 'pdf'
                          ? 'Open PDF report'
                          : 'Download Excel'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {assetPickerOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label={flowTitle}>
          <div className={styles.assetModal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{flowTitle}</h2>
                <p>Select the saved asset this cost belongs to.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.pickerToolbar}>
              <input
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
                placeholder="Search assets..."
                aria-label="Search assets"
              />
              <button type="button" className={styles.secondaryButton} onClick={() => setPickerSearch('')}>Clear</button>
            </div>
            <div className={styles.assetList}>
              {isLoading ? (
                <div className={styles.emptyState}>Loading assets...</div>
              ) : filteredAssets.length ? filteredAssets.map((asset) => (
                <button
                  type="button"
                  key={asset.id}
                  className={styles.assetRow}
                  onClick={() => selectAssetAndContinue(asset.id)}
                >
                  <span className={styles.assetInfo}>
                    {asset.ownerName ? <small>{asset.ownerName}</small> : null}
                    <strong>{asset.title}</strong>
                    <small>{asset.meta}</small>
                    <small>{asset.categoryLabel} · {asset.selectedMethod === 'manual' ? 'Manual' : 'Aim4price'}</small>
                  </span>
                  <span className={styles.assetValue}>
                    <strong>{formatMoney(asset.value)}</strong>
                    <small>current value</small>
                  </span>
                </button>
              )) : <div className={styles.emptyState}>{dealerMode ? 'No matching shared assets found.' : 'No matching assets found.'}</div>}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {flow === 'upload' ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Upload invoice/photo">
          <div className={`${styles.formModal} ${styles.costUploadModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Upload invoice/photo</h2>
                <p>{selectedAsset?.title ?? 'Selected asset'} · Automatic capture</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.formModalScrollBody}>
              <section className={styles.uploadPanel}>
                <h3>Documents and photos</h3>
                <div className={`${styles.uploadBox} ${automaticUploadFile ? styles.uploadBoxReady : ''}`}>
                  <label className={styles.uploadButton}>
                    <UploadIcon />
                    Add invoice/photo
                    <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleAutomaticFileChange} />
                  </label>
                  <span className={styles.uploadCounter}>{automaticUploadFile ? '1 / 1' : '0 / 1'}</span>
                  {automaticUploadFile ? <p>{automaticUploadFile.name}</p> : null}
                </div>
              </section>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => setFlow(assetLockedForFlow ? 'source-choice' : 'asset-automatic')}>Back</button>
              <button type="button" className={styles.primaryButton} onClick={handleAutomaticExtract} disabled={!automaticUploadFile || isExtracting}>
                {isExtracting ? 'Reading invoice/photo...' : 'Review cost details'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label={formTitle}>
          <form className={`${styles.formModal} ${styles.costFormModal}`} onSubmit={submitInvoiceDraft}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{formTitle}</h2>
                <p>{selectedAsset?.title ?? 'Selected asset'} · {captureMethodLabel(draft.source)}</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />

            <div className={styles.formModalScrollBody}>
              {extractionWarnings.length ? (
                <div className={styles.warningBox}>
                  {extractionWarnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              ) : null}

              <section className={styles.invoiceFormCard}>
                {dealerMode && dealerDefaults.supplierName ? (
                  <div className={styles.dealerDetailsCard}>
                    <span>Dealer details pulled from your account</span>
                    <strong>{dealerDefaults.supplierName}</strong>
                    {dealerDefaults.vatNumber ? <small>VAT: {dealerDefaults.vatNumber}</small> : null}
                    {dealerDefaults.address ? <small>{dealerDefaults.address}</small> : null}
                  </div>
                ) : null}
                <div className={styles.formGrid}>
                  <label>
                    <span>Supplier name</span>
                    <input value={draft.supplierName} onChange={(event) => setDraftField('supplierName', event.target.value)} />
                  </label>
                  <label>
                    <span>Invoice number</span>
                    <input value={draft.invoiceNumber} onChange={(event) => setDraftField('invoiceNumber', event.target.value)} />
                  </label>
                  <label>
                    <span>Invoice date</span>
                    <input type="date" value={draft.invoiceDate} onChange={(event) => setDraftField('invoiceDate', event.target.value)} />
                  </label>
                  <div className={styles.costUsageMetricField}>
                    <span>Usage metric</span>
                    <div
                      className={`${styles.customFilterSelect} ${usageMetricDropdownOpen ? styles.customFilterSelectOpen : ''}`}
                      data-usage-metric-dropdown="true"
                    >
                      <button
                        type="button"
                        className={`${styles.customFilterSelectButton} ${usageMetricDropdownOpen ? styles.customFilterSelectButtonOpen : ''}`}
                        onClick={() => setUsageMetricDropdownOpen((current) => !current)}
                        aria-haspopup="listbox"
                        aria-expanded={usageMetricDropdownOpen}
                        aria-label="Usage metric"
                      >
                        <span className={styles.customFilterSelectButtonText}>{selectedUsageMetricOption.label}</span>
                        <ChevronDownIcon className={styles.customFilterSelectChevron} />
                      </button>

                      {usageMetricDropdownOpen ? (
                        <div className={styles.customFilterSelectMenu} role="listbox" aria-label="Usage metric">
                          {USAGE_METRIC_OPTIONS.map((option) => {
                            const isSelected = option.value === draft.usageMetric;

                            return (
                              <button
                                type="button"
                                key={`usage-metric-${option.value}`}
                                className={`${styles.customFilterSelectOption} ${isSelected ? styles.customFilterSelectOptionActive : ''}`}
                                onClick={() => setUsageMetric(option.value)}
                                role="option"
                                aria-selected={isSelected}
                              >
                                <span className={styles.customFilterSelectOptionLabel}>{option.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <label>
                    <span>Usage reading</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={draft.usageReading}
                      disabled={draft.usageMetric === 'none'}
                      onChange={(event) => setDraftField('usageReading', formatInvoiceUsageInput(event.target.value))}
                      placeholder={draft.usageMetric === 'none' ? 'Not applicable' : 'Optional'}
                    />
                  </label>
                  <label className={styles.invoiceCurrencyField}>
                    <span>Subtotal excl. VAT</span>
                    <div className={styles.invoiceCurrencyInput}>
                      <span aria-hidden="true">R</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft.subtotalExVat}
                        onChange={(event) => setDraftField('subtotalExVat', formatInvoiceMoneyInput(event.target.value))}
                        placeholder="0"
                      />
                    </div>
                  </label>
                  <label className={styles.invoiceCurrencyField}>
                    <span>VAT amount</span>
                    <div className={styles.invoiceCurrencyInput}>
                      <span aria-hidden="true">R</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft.vatAmount}
                        onChange={(event) => setDraftField('vatAmount', formatInvoiceMoneyInput(event.target.value))}
                        placeholder="0"
                      />
                    </div>
                  </label>
                  <label className={styles.invoiceCurrencyField}>
                    <span>Total incl. VAT</span>
                    <div className={styles.invoiceCurrencyInput}>
                      <span aria-hidden="true">R</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft.totalIncVat}
                        onChange={(event) => setDraftField('totalIncVat', formatInvoiceMoneyInput(event.target.value))}
                        placeholder="Required"
                      />
                    </div>
                  </label>
                </div>

                <div className={styles.textAreaGrid}>
                  <label>
                    <span>Maintenance work done</span>
                    <textarea value={draft.maintenanceWorkDone} onChange={(event) => setDraftField('maintenanceWorkDone', event.target.value)} rows={4} />
                  </label>
                  <label>
                    <span>Parts supplied</span>
                    <textarea value={draft.partsSupplied} onChange={(event) => setDraftField('partsSupplied', event.target.value)} rows={4} />
                  </label>
                  <label>
                    <span>Repair work done</span>
                    <textarea value={draft.repairWorkDone} onChange={(event) => setDraftField('repairWorkDone', event.target.value)} rows={4} />
                  </label>
                  <label>
                    <span>Notes</span>
                    <textarea value={draft.notes} onChange={(event) => setDraftField('notes', event.target.value)} rows={4} />
                  </label>
                </div>

                {draft.source === 'manual' ? (
                  <section className={`${styles.uploadInline} ${manualUploadFile || uploadedDocument ? styles.uploadInlineReady : ''}`}>
                    <span>Optional document/photo</span>
                    <label className={styles.uploadButtonSmall}>
                      <UploadIcon />
                      Add file
                      <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleManualFileChange} />
                    </label>
                    <strong>{manualUploadFile ? manualUploadFile.name : uploadedDocument?.fileName || 'No file selected'}</strong>
                  </section>
                ) : null}

                {uploadedDocument?.uploadUrl ? (
                  <a className={styles.fileLink} href={uploadedDocument.uploadUrl} target="_blank" rel="noreferrer">Open attached invoice/photo: {uploadedDocument.fileName}</a>
                ) : null}

                {rawTextPreview ? (
                  <details className={styles.rawPreview}>
                    <summary>Raw extraction preview</summary>
                    <pre>{rawTextPreview}</pre>
                  </details>
                ) : null}
              </section>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => {
                if (editingInvoiceId) closeModal();
                else if (flow === 'manual-form') setFlow(assetLockedForFlow ? 'source-choice' : 'asset-manual');
                else if (flow === 'review') setFlow('upload');
                else closeModal();
              }}>Back</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save cost record'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteCandidateInvoice ? (
        <div className={`${styles.modalBackdrop} ${styles.confirmDeleteBackdrop}`} onClick={closeDeleteInvoiceDialog}>
          <div
            className={styles.deleteConfirmModal}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-cost-confirm-title"
            aria-describedby="delete-cost-confirm-copy"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.deleteConfirmCloseButton}
              onClick={closeDeleteInvoiceDialog}
              aria-label="Close delete confirmation"
              disabled={deletingInvoiceId === deleteCandidateInvoice.id}
            >
              <CloseIcon className={styles.buttonIcon} />
            </button>

            <div className={styles.deleteConfirmContent}>
              <h3 id="delete-cost-confirm-title">
                {dealerMode ? 'Remove this cost from your dealer records?' : 'Are you sure you want to delete this?'}
              </h3>
              <p id="delete-cost-confirm-copy">
                {dealerMode
                  ? 'The cost will disappear from your dealer workspace. The owner will be notified and can choose whether to keep their copy in the Cost Ledger or delete it permanently.'
                  : 'This cost record will be permanently removed from the Asset Cost Tracking System, including saved invoice details and any attached invoice/photo file.'}
              </p>

              <div className={styles.deleteConfirmAsset}>
                <span>Selected cost record</span>
                <strong>{deleteCandidateInvoice.supplierName || 'Unknown supplier'}</strong>
                <small>
                  {[
                    deleteCandidateInvoice.assetTitle || 'Saved asset',
                    deleteCandidateInvoice.invoiceNumber || null,
                    deleteCandidateInvoice.vatAmount !== null ? `VAT ${formatMoney(deleteCandidateInvoice.vatAmount)}` : null,
                    `Total incl. VAT ${formatMoney(deleteCandidateInvoice.totalIncVat)}`,
                  ].filter(Boolean).join(' · ')}
                </small>
              </div>

              <div className={styles.deleteConfirmActions}>
                <button type="button" className={styles.secondaryButton} onClick={closeDeleteInvoiceDialog} disabled={deletingInvoiceId === deleteCandidateInvoice.id}>
                  Cancel
                </button>

                <button
                  type="button"
                  className={`${styles.primaryButton} ${styles.deleteConfirmButton}`}
                  onClick={() => void confirmDeleteInvoice()}
                  disabled={deletingInvoiceId === deleteCandidateInvoice.id}
                >
                  <span>
                    {deletingInvoiceId === deleteCandidateInvoice.id
                      ? 'Removing...'
                      : dealerMode
                        ? 'Yes, remove from dealer records'
                        : 'Yes, delete cost record'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </main>
  );
}
