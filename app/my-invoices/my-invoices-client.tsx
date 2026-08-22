'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type SVGProps } from 'react';
import { useSearchParams } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import CaptureRequestDecisionModal from '../../components/CaptureRequestDecisionModal';
import CaptureRequestStatusList, { type CaptureRequestStatusItem } from '../../components/CaptureRequestStatusList';
import { WorkspaceTitlePanel } from '../../components/WorkspacePrimitives';
import styles from './page.module.css';

type FlowMode = 'source-choice' | 'asset-manual' | 'asset-automatic' | 'manual-form' | 'upload' | 'review' | 'recurring' | null;
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

type BudgetPeriod = 'monthly' | 'annual';
type CostBudgetStatusName = 'on_track' | 'warning' | 'over_budget';

type CostBudgetProgress = {
  id: string;
  assetId: string | null;
  assetTitle: string;
  period: BudgetPeriod;
  amount: number;
  warningPercent: number;
  warningAmount: number;
  includeFuelSlipCosts: boolean;
  revision: number;
  periodKey: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  spent: number;
  remaining: number;
  overBy: number;
  percentUsed: number;
  status: CostBudgetStatusName;
  createdAtIso: string;
  updatedAtIso: string;
};

type CostBudgetDraft = {
  assetId: string;
  period: BudgetPeriod;
  amount: string;
  warningPercent: string;
  includeFuelSlipCosts: boolean;
};

type CostBudgetsResponse = {
  ok: boolean;
  budgets?: CostBudgetProgress[];
  budget?: CostBudgetProgress;
  error?: string;
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

type AccountantInvoicesResponse = InvoicesResponse & {
  cost?: InvoicesResponse;
};

type DealerDefaults = {
  supplierName: string;
  vatNumber: string;
  address: string;
};

type MyInvoicesClientProps = {
  accountantShareId?: string;
  accountantRegisterId?: string;
  dealerMode?: boolean;
  showAppHeader?: boolean;
  initialAssetId?: string;
  initialOpenAdd?: boolean;
  initialReturnTo?: string;
  initialDealerDefaults?: DealerDefaults;
};

type UploadResponse = {
  ok: boolean;
  document?: InvoiceDocument;
  error?: string;
};

type CaptureRequestResponse = {
  ok: boolean;
  request?: CaptureRequestStatusItem;
  requests?: CaptureRequestStatusItem[];
  message?: string;
  error?: string;
};

type InvoiceDropCodeRecord = {
  id: string;
  assetId: string;
  lastFour: string;
  createdAtIso: string;
};

type InvoiceDropCodeResponse = {
  ok: boolean;
  dropCode?: (InvoiceDropCodeRecord & { code?: string }) | null;
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

type CommitmentFrequency = 'monthly' | 'quarterly' | 'six_monthly' | 'annual';

type RecurringCommitmentDraft = {
  description: string;
  category: string;
  amount: string;
  frequency: CommitmentFrequency;
  startDate: string;
  endDate: string;
  renewalDate: string;
  sourceReference: string;
  note: string;
};

type RecurringCommitmentResponse = {
  ok: boolean;
  error?: string;
};

type AccountingSoftware = 'sage_business_cloud' | 'generic_csv';
type AccountingEffect = 'Increase' | 'Decrease';

type AccountingSupplier = {
  id: string;
  name: string;
  aliases: string[];
};

type AccountingSettings = {
  configured: boolean;
  software: AccountingSoftware;
  defaultEffect: AccountingEffect;
  standardVatLabel: string;
  noVatLabel: string;
  defaultAffectingAccount: string;
  fuelAffectingAccount: string;
  affectingAccounts: string[];
  suppliers: AccountingSupplier[];
  updatedAtIso: string | null;
};

type AccountingSettingsResponse = {
  ok: boolean;
  settings?: AccountingSettings;
  error?: string;
};

type AccountingExportIssue = {
  invoiceId: string;
  invoiceNumber: string;
  assetTitle: string;
  supplierName: string;
  field: 'invoice_date' | 'supplier' | 'vat' | 'affecting_account';
  message: string;
};

type AccountingExportErrorResponse = {
  ok: false;
  error?: string;
  issues?: AccountingExportIssue[];
  configured?: boolean;
};

type ReportFormat = 'pdf' | 'xlsx' | 'csv';
type DownloadExportFormat = ReportFormat;
type DownloadStep = 'format' | 'accounting' | 'timeline' | 'fuel';

const STANDARD_DOWNLOAD_STEPS: Array<{ key: DownloadStep; label: string }> = [
  { key: 'format', label: 'Format' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'fuel', label: 'Fuel costs' },
];

const CSV_DOWNLOAD_STEPS: Array<{ key: DownloadStep; label: string }> = [
  { key: 'format', label: 'Format' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'fuel', label: 'Fuel costs' },
];

const ACCOUNTING_SOFTWARE_OPTIONS: Array<{
  value: AccountingSoftware;
  label: string;
  description: string;
}> = [
  {
    value: 'sage_business_cloud',
    label: 'Sage Business Cloud Accounting',
    description: 'Supplier Adjustments Quick Entry Grid.',
  },
  {
    value: 'generic_csv',
    label: 'Generic accounting CSV',
    description: 'Map the CSV columns during import.',
  },
];

const DEFAULT_ACCOUNTING_SETTINGS: AccountingSettings = {
  configured: false,
  software: 'sage_business_cloud',
  defaultEffect: 'Increase',
  standardVatLabel: 'Standard Rate 15%',
  noVatLabel: 'No VAT',
  defaultAffectingAccount: 'Repairs and maintenance – tractors',
  fuelAffectingAccount: '',
  affectingAccounts: ['Repairs and maintenance – tractors'],
  suppliers: [],
  updatedAtIso: null,
};

const DEFAULT_FILTERS: InvoiceFilterState = {
  ownerId: 'all',
  assetId: 'all',
  source: 'all',
  year: 'all',
  month: 'all',
};

function buildEmptyCostBudgetDraft(assetId = 'all'): CostBudgetDraft {
  return {
    assetId,
    period: 'monthly',
    amount: '',
    warningPercent: '80',
    includeFuelSlipCosts: true,
  };
}

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
      <path d="M4 5h16M7 12h10M10 19h4" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
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

function ContributionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="18" cy="5" r="2.25" />
      <circle cx="6" cy="12" r="2.25" />
      <circle cx="18" cy="19" r="2.25" />
      <path d="m8 11 7.8-4.6" />
      <path d="m8 13 7.8 4.6" />
    </IconBase>
  );
}

function CsvIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M6 2.75h8l4 4V21.25H6z" />
      <path d="M14 2.75v4h4" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
      <path d="M9 19h4" />
    </IconBase>
  );
}

function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 6h7" />
      <path d="M15 6h5" />
      <circle cx="13" cy="6" r="2" />
      <path d="M4 12h3" />
      <path d="M11 12h9" />
      <circle cx="9" cy="12" r="2" />
      <path d="M4 18h10" />
      <path d="M18 18h2" />
      <circle cx="16" cy="18" r="2" />
    </IconBase>
  );
}

function LedgerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 3v18" />
      <path d="M11.5 8h5" />
      <path d="M11.5 12h5" />
      <path d="M11.5 16h3.5" />
    </IconBase>
  );
}

function VatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="8" cy="8" r="2" />
      <circle cx="16" cy="16" r="2" />
      <path d="m17.5 6.5-11 11" />
    </IconBase>
  );
}

function SupplierIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 21V8l8-5 8 5v13" />
      <path d="M8 21v-5h8v5" />
      <path d="M8 10h.01" />
      <path d="M12 10h.01" />
      <path d="M16 10h.01" />
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
  return source === 'automatic' ? 'Aim4price captured' : 'Manual';
}

function ownerStorageLabel(status: OwnerStorageStatus): string {
  if (status === 'approved') return 'Dealer and owner';
  if (status === 'declined') return 'Dealer only';
  if (status === 'pending') return 'Owner decision pending';
  return 'Owner Cost Ledger';
}


function captureMethodLabel(source: InvoiceSource): string {
  if (source === 'fuel_slip') return 'Fuel Slip';
  return source === 'automatic' ? 'Aim4price verified capture' : 'Manual entry';
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

function buildRecurringCommitmentDraft(): RecurringCommitmentDraft {
  return {
    description: '',
    category: 'insurance',
    amount: '',
    frequency: 'monthly',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    renewalDate: '',
    sourceReference: '',
    note: '',
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
  accountingSoftware?: AccountingSoftware,
  accountantShareId?: string,
  accountantRegisterId?: string,
): string {
  const params = new URLSearchParams({ format, includeFuelSlipCosts: includeFuelSlipCosts ? 'true' : 'false' });

  if (filters.assetId !== 'all') params.set('assetId', filters.assetId);
  if (filters.year !== 'all') params.set('year', filters.year);
  if (filters.month !== 'all') params.set('month', filters.month);
  if (format === 'csv' && accountingSoftware) params.set('accountingSoftware', accountingSoftware);
  if (accountantShareId) params.set('accountantShareId', accountantShareId);
  if (accountantRegisterId) params.set('accountantRegisterId', accountantRegisterId);

  return `/api/my-invoices/report?${params.toString()}`;
}

function withAccountantShare(url: string, accountantShareId?: string, accountantRegisterId?: string): string {
  if (!accountantShareId) return url;

  const scopedUrl = new URL(url, window.location.origin);
  scopedUrl.searchParams.set('accountantShareId', accountantShareId);
  if (accountantRegisterId) scopedUrl.searchParams.set('accountantRegisterId', accountantRegisterId);
  return `${scopedUrl.pathname}${scopedUrl.search}`;
}

function copyAccountingSettings(settings: AccountingSettings): AccountingSettings {
  return {
    ...settings,
    affectingAccounts: [...settings.affectingAccounts],
    suppliers: settings.suppliers.map((supplier) => ({
      ...supplier,
      aliases: [...supplier.aliases],
    })),
  };
}

function clientSupplierId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `supplier-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function aliasesText(aliases: string[]): string {
  return aliases.join('\n');
}

function parseAliases(value: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of value.split(/[\n,;]+/)) {
    const alias = item.replace(/\s+/g, ' ').trim();
    const key = alias.toLowerCase();
    if (!alias || seen.has(key)) continue;
    seen.add(key);
    result.push(alias);
  }

  return result;
}

function downloadFileName(response: Response, fallback: string): string {
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1]?.trim() || fallback;
}

export default function MyInvoicesClient({
  accountantShareId,
  accountantRegisterId,
  dealerMode = false,
  showAppHeader,
  initialAssetId = '',
  initialOpenAdd = false,
  initialReturnTo = '',
  initialDealerDefaults = { supplierName: '', vatNumber: '', address: '' },
}: MyInvoicesClientProps = {}) {
  const routeSearchParams = useSearchParams();
  const apiRoot = dealerMode
      ? '/api/dealer/cost'
      : '/api/my-invoices';
  const captureApiRoot = dealerMode ? '/api/dealer/capture-requests' : '/api/capture-requests';
  const accountScopedUrl = (url: string) => withAccountantShare(url, accountantShareId, accountantRegisterId);
  const shouldShowAppHeader = showAppHeader ?? !dealerMode;
  const canManageInvoiceDropCodes = !dealerMode && !accountantShareId && !accountantRegisterId;
  const canRetractCaptureRequests = !dealerMode && !accountantShareId && !accountantRegisterId;
  const canManageBudgets = !dealerMode && !accountantShareId && !accountantRegisterId;
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [captureRequests, setCaptureRequests] = useState<CaptureRequestStatusItem[]>([]);
  const [captureReviewRequestId, setCaptureReviewRequestId] = useState<string | null>(null);
  const [invoiceDropCodeOpen, setInvoiceDropCodeOpen] = useState(false);
  const [invoiceDropAssetId, setInvoiceDropAssetId] = useState('');
  const [invoiceDropCode, setInvoiceDropCode] = useState<InvoiceDropCodeRecord | null>(null);
  const [newInvoiceDropCode, setNewInvoiceDropCode] = useState('');
  const [invoiceDropPublicUrl, setInvoiceDropPublicUrl] = useState('/drop-invoice');
  const [invoiceDropCodeLoading, setInvoiceDropCodeLoading] = useState(false);
  const [invoiceDropCodeSaving, setInvoiceDropCodeSaving] = useState(false);
  const [invoiceDropCodeError, setInvoiceDropCodeError] = useState('');
  const [invoiceDropCodeMessage, setInvoiceDropCodeMessage] = useState('');
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
  const [accountingSettings, setAccountingSettings] = useState<AccountingSettings | null>(null);
  const [accountingSettingsDraft, setAccountingSettingsDraft] = useState<AccountingSettings>(
    copyAccountingSettings(DEFAULT_ACCOUNTING_SETTINGS),
  );
  const [selectedAccountingSoftware, setSelectedAccountingSoftware] = useState<AccountingSoftware>('sage_business_cloud');
  const [accountingSettingsOpen, setAccountingSettingsOpen] = useState(false);
  const [accountingSettingsLoading, setAccountingSettingsLoading] = useState(false);
  const [accountingSettingsSaving, setAccountingSettingsSaving] = useState(false);
  const [accountingSettingsError, setAccountingSettingsError] = useState('');
  const [newAffectingAccount, setNewAffectingAccount] = useState('');
  const [accountingExportIssues, setAccountingExportIssues] = useState<AccountingExportIssue[]>([]);
  const [accountingExportError, setAccountingExportError] = useState('');
  const [accountingExportDownloading, setAccountingExportDownloading] = useState(false);
  const [dealerDefaults, setDealerDefaults] = useState<DealerDefaults>(initialDealerDefaults);
  const [draft, setDraft] = useState<InvoiceDraft>(buildEmptyDraft('manual', initialDealerDefaults.supplierName));
  const [recurringDraft, setRecurringDraft] = useState<RecurringCommitmentDraft>(buildRecurringCommitmentDraft);
  const [recurringAssetIds, setRecurringAssetIds] = useState<string[]>([]);
  const [recurringAssetPickerOpen, setRecurringAssetPickerOpen] = useState(false);
  const [recurringAssetSearch, setRecurringAssetSearch] = useState('');
  const [recurringError, setRecurringError] = useState('');
  const [assetLockedForFlow, setAssetLockedForFlow] = useState(false);
  const [initialLaunchHandled, setInitialLaunchHandled] = useState(!initialOpenAdd);
  const [quickLaunchActive, setQuickLaunchActive] = useState(false);
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
  const [costBudgets, setCostBudgets] = useState<CostBudgetProgress[]>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(canManageBudgets);
  const [budgetLoadError, setBudgetLoadError] = useState('');
  const [budgetManagerNotice, setBudgetManagerNotice] = useState<Notice | null>(null);
  const [budgetManagerOpen, setBudgetManagerOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetAssetPickerOpen, setBudgetAssetPickerOpen] = useState(false);
  const [budgetAssetSearch, setBudgetAssetSearch] = useState('');
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<CostBudgetDraft>(() => buildEmptyCostBudgetDraft());
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetFormError, setBudgetFormError] = useState('');
  const [budgetDeleteCandidate, setBudgetDeleteCandidate] = useState<CostBudgetProgress | null>(null);
  const [budgetDeletingId, setBudgetDeletingId] = useState<string | null>(null);
  const [budgetDeleteError, setBudgetDeleteError] = useState('');
  const [focusedBudgetId, setFocusedBudgetId] = useState<string | null>(null);
  const [handledBudgetDeepLinkId, setHandledBudgetDeepLinkId] = useState('');
  const pageShellRef = useRef<HTMLElement>(null);
  const budgetManagerTriggerRef = useRef<HTMLButtonElement>(null);
  const budgetManagerDialogRef = useRef<HTMLDivElement>(null);
  const budgetManagerReturnFocusRef = useRef('');
  const budgetScopeTriggerRef = useRef<HTMLButtonElement>(null);
  const budgetDeleteButtonRef = useRef<HTMLButtonElement>(null);
  const budgetDeleteCancelRef = useRef<HTMLButtonElement>(null);
  const budgetDeleteReturnFocusRef = useRef(false);

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
    if (!canManageBudgets) {
      setCostBudgets([]);
      setBudgetsLoading(false);
      return;
    }

    let cancelled = false;
    setBudgetsLoading(true);
    setBudgetLoadError('');

    void fetchCostBudgetData()
      .then((budgets) => {
        if (!cancelled) setCostBudgets(budgets);
      })
      .catch((error) => {
        if (!cancelled) {
          setBudgetLoadError(error instanceof Error ? error.message : 'Spending budgets could not be loaded.');
        }
      })
      .finally(() => {
        if (!cancelled) setBudgetsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canManageBudgets]);

  useEffect(() => {
    if (!canManageBudgets || budgetsLoading || budgetLoadError) return;
    const budgetId = routeSearchParams.get('budgetId')?.trim() || '';
    if (!budgetId) {
      if (handledBudgetDeepLinkId) setHandledBudgetDeepLinkId('');
      return;
    }
    if (handledBudgetDeepLinkId === budgetId) return;
    setHandledBudgetDeepLinkId(budgetId);

    const budget = costBudgets.find((item) => item.id === budgetId);
    if (!budget) {
      setNotice({ tone: 'error', message: 'That spending budget is no longer available.' });
      return;
    }

    const filters: InvoiceFilterState = {
      ownerId: 'all',
      assetId: budget.assetId || 'all',
      source: 'all',
      year: budget.periodKey.slice(0, 4),
      month: budget.period === 'monthly' ? String(Number(budget.periodKey.slice(5, 7))) : 'all',
    };
    budgetManagerReturnFocusRef.current = budget.id;
    setBudgetManagerNotice(null);
    setBudgetManagerOpen(true);
    setFocusedBudgetId(budget.id);
    setActiveFilters(filters);
    setDraftFilters(filters);
    window.setTimeout(() => {
      document.getElementById(`cost-budget-${budget.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }, [
    budgetLoadError,
    budgetsLoading,
    canManageBudgets,
    costBudgets,
    handledBudgetDeepLinkId,
    routeSearchParams,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadCaptureRequests() {
      const requests = await fetchCaptureRequests();
      if (!cancelled && requests) setCaptureRequests(requests);
    }

    void loadCaptureRequests();
    return () => { cancelled = true; };
  }, [accountantRegisterId, accountantShareId, captureApiRoot]);

  useEffect(() => {
    if (!canManageInvoiceDropCodes) return;
    const requestId = new URLSearchParams(window.location.search).get('captureRequestId')?.trim();
    if (requestId) setCaptureReviewRequestId(requestId);
  }, [canManageInvoiceDropCodes]);

  useEffect(() => {
    setInvoiceDropPublicUrl(`${window.location.origin}/drop-invoice`);
  }, []);

  useEffect(() => {
    if (!canManageInvoiceDropCodes || !invoiceDropCodeOpen || !invoiceDropAssetId) return undefined;
    let cancelled = false;

    setInvoiceDropCodeLoading(true);
    setInvoiceDropCodeError('');
    setInvoiceDropCodeMessage('');
    setNewInvoiceDropCode('');
    setInvoiceDropCode(null);

    async function loadInvoiceDropCode() {
      try {
        const response = await fetch(`/api/invoice-drop-codes/${encodeURIComponent(invoiceDropAssetId)}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = (await response.json()) as InvoiceDropCodeResponse;
        if (!response.ok || !data.ok) throw new Error(data.error || 'The Invoice Drop code could not be loaded.');
        if (!cancelled) {
          const active = data.dropCode;
          setInvoiceDropCode(active ? {
            id: active.id,
            assetId: active.assetId,
            lastFour: active.lastFour,
            createdAtIso: active.createdAtIso,
          } : null);
        }
      } catch (error) {
        if (!cancelled) {
          setInvoiceDropCodeError(error instanceof Error ? error.message : 'The Invoice Drop code could not be loaded.');
        }
      } finally {
        if (!cancelled) setInvoiceDropCodeLoading(false);
      }
    }

    void loadInvoiceDropCode();
    return () => { cancelled = true; };
  }, [canManageInvoiceDropCodes, invoiceDropAssetId, invoiceDropCodeOpen]);

  useEffect(() => {
    if (initialLaunchHandled || isLoading) return;
    setInitialLaunchHandled(true);

    const requestedAssetId = initialAssetId.trim();
    if (requestedAssetId && assets.some((asset) => asset.id === requestedAssetId)) {
      setQuickLaunchActive(true);
      openAddInvoiceModal(requestedAssetId);
      return;
    }

    if (requestedAssetId) {
      setNotice({
        tone: 'error',
        message: dealerMode
          ? 'This asset is not currently shared with your dealership.'
          : 'This asset is not available in your Cost Ledger.',
      });
    }
  }, [assets, dealerMode, initialAssetId, initialLaunchHandled, isLoading]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  const invoiceDropAsset = useMemo(
    () => assets.find((asset) => asset.id === invoiceDropAssetId) ?? null,
    [assets, invoiceDropAssetId],
  );

  const filteredAssets = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => assetSearchText(asset).includes(query));
  }, [assets, pickerSearch]);

  const recurringSelectedAssets = useMemo(
    () => assets.filter((asset) => recurringAssetIds.includes(asset.id)),
    [assets, recurringAssetIds],
  );

  const filteredRecurringAssets = useMemo(() => {
    const query = recurringAssetSearch.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => assetSearchText(asset).includes(query));
  }, [assets, recurringAssetSearch]);

  const selectedBudgetAsset = useMemo(
    () => assets.find((asset) => asset.id === budgetDraft.assetId) ?? null,
    [assets, budgetDraft.assetId],
  );

  const filteredBudgetAssets = useMemo(() => {
    const query = budgetAssetSearch.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => assetSearchText(asset).includes(query));
  }, [assets, budgetAssetSearch]);

  const focusedBudget = useMemo(
    () => costBudgets.find((budget) => budget.id === focusedBudgetId) ?? null,
    [costBudgets, focusedBudgetId],
  );

  const visibleInvoices = useMemo(() => {
    const query = invoiceSearch.trim().toLowerCase();

    return invoices.filter((invoice) => {
      if (focusedBudget && !focusedBudget.includeFuelSlipCosts && invoice.source === 'fuel_slip') return false;
      if (activeFilters.source !== 'all' && invoice.source !== activeFilters.source) return false;
      if (query && !invoiceSearchText(invoice).includes(query)) return false;
      return true;
    });
  }, [activeFilters.source, focusedBudget, invoiceSearch, invoices]);

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
  const budgetAttentionCount = useMemo(
    () => costBudgets.filter((budget) => budget.status !== 'on_track').length,
    [costBudgets],
  );
  const quickLaunchReturnTo = initialOpenAdd && initialAssetId ? initialReturnTo : '';

  const sourceChoiceOpen = flow === 'source-choice';
  const assetPickerOpen = flow === 'asset-manual' || flow === 'asset-automatic';
  const formOpen = flow === 'manual-form' || flow === 'review';
  const recurringOpen = flow === 'recurring';
  const flowTitle = flow === 'asset-automatic' ? 'Choose asset for uploaded cost' : 'Choose asset for manual cost';
  const formTitle = flow === 'review' ? 'Review cost details' : 'Enter cost manually';
  const hasInvoiceSearch = invoiceSearch.trim().length > 0;
  const deleteConfirmOpen = Boolean(deleteCandidateInvoice);
  const downloadSteps = downloadFormat === 'csv' ? CSV_DOWNLOAD_STEPS : STANDARD_DOWNLOAD_STEPS;
  const selectedAccountingSoftwareOption = ACCOUNTING_SOFTWARE_OPTIONS.find(
    (option) => option.value === selectedAccountingSoftware,
  ) ?? ACCOUNTING_SOFTWARE_OPTIONS[0];
  const modalOpen = sourceChoiceOpen
    || assetPickerOpen
    || flow === 'upload'
    || formOpen
    || recurringOpen
    || invoiceDropCodeOpen
    || filterOpen
    || downloadOpen
    || accountingSettingsOpen
    || deleteConfirmOpen
    || budgetManagerOpen
    || budgetModalOpen
    || Boolean(budgetDeleteCandidate);
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
    const pageShell = pageShellRef.current;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    pageShell?.setAttribute('inert', '');

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      pageShell?.removeAttribute('inert');
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!budgetManagerOpen || budgetModalOpen || budgetDeleteCandidate) return undefined;
    const dialog = budgetManagerDialogRef.current;
    if (!dialog) return undefined;
    const dialogElement: HTMLDivElement = dialog;

    const focusFrame = window.requestAnimationFrame(() => {
      const returnTarget = budgetManagerReturnFocusRef.current;
      const returnButton = returnTarget
        ? Array.from(dialogElement.querySelectorAll<HTMLButtonElement>('[data-budget-trigger]'))
          .find((button) => button.dataset.budgetTrigger === returnTarget)
        : null;
      const fallbackButton = dialogElement.querySelector<HTMLButtonElement>('[data-budget-manager-close]')
        ?? dialogElement.querySelector<HTMLButtonElement>('[data-budget-trigger="add"]');
      (returnButton ?? fallbackButton ?? dialogElement).focus();
      budgetManagerReturnFocusRef.current = '';
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setBudgetManagerOpen(false);
        setBudgetManagerNotice(null);
        budgetManagerReturnFocusRef.current = '';
        window.requestAnimationFrame(() => budgetManagerTriggerRef.current?.focus());
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(dialogElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) {
        event.preventDefault();
        dialogElement.focus();
        return;
      }
      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && activeIndex <= 0) {
        event.preventDefault();
        focusable[focusable.length - 1]?.focus();
      } else if (!event.shiftKey && (activeIndex === -1 || activeIndex === focusable.length - 1)) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [budgetDeleteCandidate, budgetManagerOpen, budgetModalOpen]);

  useEffect(() => {
    if (!budgetModalOpen || budgetAssetPickerOpen) return undefined;
    const focusFrame = window.requestAnimationFrame(() => {
      const target = budgetDeleteReturnFocusRef.current
        ? budgetDeleteButtonRef.current
        : budgetScopeTriggerRef.current;
      (target ?? budgetScopeTriggerRef.current)?.focus();
      budgetDeleteReturnFocusRef.current = false;
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [budgetAssetPickerOpen, budgetModalOpen]);

  useEffect(() => {
    if (!budgetDeleteCandidate) return undefined;
    const focusFrame = window.requestAnimationFrame(() => budgetDeleteCancelRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !budgetDeletingId) {
        event.preventDefault();
        budgetDeleteReturnFocusRef.current = true;
        setBudgetDeleteCandidate(null);
        setBudgetDeleteError('');
        setBudgetModalOpen(true);
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = budgetDeleteCancelRef.current?.closest('[role="alertdialog"]');
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
      if (!focusable.length) return;
      const activeIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);
      if (event.shiftKey && activeIndex <= 0) {
        event.preventDefault();
        focusable[focusable.length - 1]?.focus();
      } else if (!event.shiftKey && (activeIndex === -1 || activeIndex === focusable.length - 1)) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [budgetDeleteCandidate, budgetDeletingId]);

  useEffect(() => {
    if (!budgetModalOpen || !budgetAssetPickerOpen) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setBudgetAssetPickerOpen(false);
      setBudgetAssetSearch('');
      window.requestAnimationFrame(() => budgetScopeTriggerRef.current?.focus());
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [budgetAssetPickerOpen, budgetModalOpen]);

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
    const response = await fetch(accountScopedUrl(buildInvoiceListUrl(filters, apiRoot)), { cache: 'no-store' });
    const payload = (await response.json()) as AccountantInvoicesResponse;
    const data = payload.cost ?? payload;

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'My Cost Ledger could not be loaded.');
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

  async function fetchCostBudgetData(): Promise<CostBudgetProgress[]> {
    const response = await fetch('/api/my-invoices/budgets', {
      credentials: 'include',
      cache: 'no-store',
    });
    const data = (await response.json().catch(() => null)) as CostBudgetsResponse | null;
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || 'Spending budgets could not be loaded.');
    }
    return data.budgets ?? [];
  }

  async function reloadBudgets(): Promise<void> {
    if (!canManageBudgets) return;
    const budgets = await fetchCostBudgetData();
    setCostBudgets(budgets);
    setBudgetLoadError('');
  }

  function dispatchCostLedgerUpdated() {
    window.dispatchEvent(new Event('aim4price:cost-ledger-updated'));
  }

  function openBudgetManager() {
    budgetManagerReturnFocusRef.current = '';
    setBudgetManagerNotice(null);
    setBudgetManagerOpen(true);
  }

  function closeBudgetManager() {
    setBudgetManagerOpen(false);
    setBudgetManagerNotice(null);
    budgetManagerReturnFocusRef.current = '';
    window.requestAnimationFrame(() => budgetManagerTriggerRef.current?.focus());
  }

  function openCreateBudget() {
    budgetManagerReturnFocusRef.current = 'add';
    setBudgetManagerNotice(null);
    const defaultAssetId = activeFilters.assetId !== 'all'
      && assets.some((asset) => asset.id === activeFilters.assetId)
      ? activeFilters.assetId
      : 'all';
    setEditingBudgetId(null);
    setBudgetDraft(buildEmptyCostBudgetDraft(defaultAssetId));
    setBudgetAssetPickerOpen(false);
    setBudgetAssetSearch('');
    setBudgetFormError('');
    setBudgetModalOpen(true);
  }

  function openEditBudget(budget: CostBudgetProgress) {
    budgetManagerReturnFocusRef.current = budget.id;
    setBudgetManagerNotice(null);
    setEditingBudgetId(budget.id);
    setBudgetDraft({
      assetId: budget.assetId || 'all',
      period: budget.period,
      amount: formatInvoiceMoneyInput(formatMoneyWithCents(budget.amount)),
      warningPercent: String(budget.warningPercent),
      includeFuelSlipCosts: budget.includeFuelSlipCosts,
    });
    setBudgetAssetPickerOpen(false);
    setBudgetAssetSearch('');
    setBudgetFormError('');
    setBudgetModalOpen(true);
  }

  function closeBudgetAssetPicker() {
    setBudgetAssetPickerOpen(false);
    setBudgetAssetSearch('');
    window.requestAnimationFrame(() => budgetScopeTriggerRef.current?.focus());
  }

  function chooseBudgetAsset(assetId: string) {
    setBudgetDraft((current) => ({ ...current, assetId }));
    closeBudgetAssetPicker();
  }

  function closeBudgetModal() {
    if (budgetSaving) return;
    setBudgetModalOpen(false);
    setBudgetAssetPickerOpen(false);
    setBudgetAssetSearch('');
    setEditingBudgetId(null);
    setBudgetDraft(buildEmptyCostBudgetDraft());
    setBudgetFormError('');
  }

  async function submitCostBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const wasEditing = Boolean(editingBudgetId);
    setBudgetSaving(true);
    setBudgetFormError('');

    try {
      const endpoint = editingBudgetId
        ? `/api/my-invoices/budgets/${encodeURIComponent(editingBudgetId)}`
        : '/api/my-invoices/budgets';
      const response = await fetch(endpoint, {
        method: editingBudgetId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: budgetDraft.assetId === 'all' ? null : budgetDraft.assetId,
          period: budgetDraft.period,
          amount: budgetDraft.amount,
          warningPercent: Number(budgetDraft.warningPercent),
          includeFuelSlipCosts: budgetDraft.includeFuelSlipCosts,
        }),
      });
      const data = (await response.json().catch(() => null)) as CostBudgetsResponse | null;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'The spending budget could not be saved.');
      }

      await reloadBudgets();
      setBudgetModalOpen(false);
      setBudgetAssetPickerOpen(false);
      setBudgetAssetSearch('');
      setEditingBudgetId(null);
      setBudgetDraft(buildEmptyCostBudgetDraft());
      const successNotice: Notice = {
        tone: 'success',
        message: wasEditing ? 'Spending budget updated.' : 'Spending budget created.',
      };
      setBudgetManagerNotice(successNotice);
      setNotice(successNotice);
      dispatchCostLedgerUpdated();
    } catch (error) {
      setBudgetFormError(error instanceof Error ? error.message : 'The spending budget could not be saved.');
    } finally {
      setBudgetSaving(false);
    }
  }

  function askToDeleteBudget() {
    const budget = editingBudgetId
      ? costBudgets.find((item) => item.id === editingBudgetId) ?? null
      : null;
    if (!budget) return;
    setBudgetModalOpen(false);
    setBudgetAssetPickerOpen(false);
    setBudgetAssetSearch('');
    setBudgetDeleteError('');
    budgetDeleteReturnFocusRef.current = false;
    setBudgetDeleteCandidate(budget);
  }

  function closeDeleteBudgetDialog() {
    if (budgetDeletingId) return;
    budgetDeleteReturnFocusRef.current = true;
    setBudgetDeleteCandidate(null);
    setBudgetDeleteError('');
    setBudgetAssetPickerOpen(false);
    setBudgetAssetSearch('');
    setBudgetModalOpen(true);
  }

  async function confirmDeleteBudget() {
    if (!budgetDeleteCandidate) return;
    const budgetId = budgetDeleteCandidate.id;
    setBudgetDeletingId(budgetId);
    setBudgetDeleteError('');

    try {
      const response = await fetch(`/api/my-invoices/budgets/${encodeURIComponent(budgetId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await response.json().catch(() => null)) as CostBudgetsResponse | null;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'The spending budget could not be deleted.');
      }

      await reloadBudgets();
      if (focusedBudgetId === budgetId) clearFocusedBudgetView();
      setBudgetDeleteCandidate(null);
      setEditingBudgetId(null);
      const successNotice: Notice = { tone: 'success', message: 'Spending budget deleted.' };
      setBudgetManagerNotice(successNotice);
      setNotice(successNotice);
      dispatchCostLedgerUpdated();
    } catch (error) {
      setBudgetDeleteError(error instanceof Error ? error.message : 'The spending budget could not be deleted.');
    } finally {
      setBudgetDeletingId(null);
    }
  }

  function removeBudgetQueryParameter() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('budgetId')) return;
    for (const key of ['budgetId', 'assetId', 'year', 'month']) {
      url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function clearFocusedBudgetView() {
    setFocusedBudgetId(null);
    setActiveFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    removeBudgetQueryParameter();
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
    const shouldReturn = quickLaunchActive && quickLaunchReturnTo;
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
    setRecurringDraft(buildRecurringCommitmentDraft());
    setRecurringAssetIds([]);
    setRecurringAssetPickerOpen(false);
    setRecurringAssetSearch('');
    setRecurringError('');
    setQuickLaunchActive(false);

    if (shouldReturn) {
      window.location.assign(shouldReturn);
    }
  }

  function openInvoiceDropCodeManager() {
    const defaultAssetId = selectedAssetId && assets.some((asset) => asset.id === selectedAssetId)
      ? selectedAssetId
      : assets[0]?.id ?? '';
    setNotice(null);
    setInvoiceDropAssetId(defaultAssetId);
    setInvoiceDropCode(null);
    setNewInvoiceDropCode('');
    setInvoiceDropCodeError('');
    setInvoiceDropCodeMessage('');
    setInvoiceDropCodeOpen(true);
  }

  function closeInvoiceDropCodeManager() {
    setInvoiceDropCodeOpen(false);
    setInvoiceDropAssetId('');
    setInvoiceDropCode(null);
    // Plaintext exists in browser memory only for this just-issued view.
    setNewInvoiceDropCode('');
    setInvoiceDropCodeError('');
    setInvoiceDropCodeMessage('');
  }

  async function copyInvoiceDropText(value: string, successMessage: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setInvoiceDropCodeMessage(successMessage);
      setInvoiceDropCodeError('');
    } catch {
      setInvoiceDropCodeError('Copy was blocked by your browser. Select the text and copy it manually.');
    }
  }

  async function issueSelectedInvoiceDropCode() {
    if (!invoiceDropAssetId || invoiceDropCodeSaving) return;
    if (invoiceDropCode && !window.confirm('Rotate this code? The current code will stop working immediately.')) return;

    setInvoiceDropCodeSaving(true);
    setInvoiceDropCodeError('');
    setInvoiceDropCodeMessage('');
    setNewInvoiceDropCode('');

    try {
      const response = await fetch(`/api/invoice-drop-codes/${encodeURIComponent(invoiceDropAssetId)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const data = (await response.json()) as InvoiceDropCodeResponse;
      const issued = data.dropCode;
      if (!response.ok || !data.ok || !issued?.code) {
        throw new Error(data.error || 'The Invoice Drop code could not be created.');
      }

      setInvoiceDropCode({
        id: issued.id,
        assetId: issued.assetId,
        lastFour: issued.lastFour,
        createdAtIso: issued.createdAtIso,
      });
      setNewInvoiceDropCode(issued.code);
      setInvoiceDropCodeMessage('New contribution code created. Copy it now; Aim4price will not show the full code again.');
    } catch (error) {
      setInvoiceDropCodeError(error instanceof Error ? error.message : 'The Invoice Drop code could not be created.');
    } finally {
      setInvoiceDropCodeSaving(false);
    }
  }

  async function revokeSelectedInvoiceDropCode() {
    if (!invoiceDropAssetId || !invoiceDropCode || invoiceDropCodeSaving) return;
    if (!window.confirm('Revoke this code? Anyone holding it will no longer be able to submit an invoice for this asset.')) return;

    setInvoiceDropCodeSaving(true);
    setInvoiceDropCodeError('');
    setInvoiceDropCodeMessage('');

    try {
      const response = await fetch(`/api/invoice-drop-codes/${encodeURIComponent(invoiceDropAssetId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const data = (await response.json()) as InvoiceDropCodeResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || 'The Invoice Drop code could not be revoked.');
      setInvoiceDropCode(null);
      setNewInvoiceDropCode('');
      setInvoiceDropCodeMessage('Contribution code revoked.');
    } catch (error) {
      setInvoiceDropCodeError(error instanceof Error ? error.message : 'The Invoice Drop code could not be revoked.');
    } finally {
      setInvoiceDropCodeSaving(false);
    }
  }

  async function shareInvoiceDropLink() {
    const shareText = newInvoiceDropCode
      ? `Upload the invoice at Aim4price and use contribution code ${newInvoiceDropCode}. This code permits invoice submission only.`
      : 'Upload the invoice securely at Aim4price. Ask the asset owner for the contribution code.';

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Aim4price Invoice Drop', text: shareText, url: invoiceDropPublicUrl });
        setInvoiceDropCodeMessage('Invoice Drop details shared.');
        setInvoiceDropCodeError('');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    await copyInvoiceDropText(invoiceDropPublicUrl, 'Public Invoice Drop link copied.');
  }

  async function copyInvoiceDropInstructions() {
    if (!newInvoiceDropCode) return;
    await copyInvoiceDropText(
      `Upload the invoice at ${invoiceDropPublicUrl}\nContribution code: ${newInvoiceDropCode}\nThis code permits invoice submission only and does not reveal asset details.`,
      'Invoice Drop link and new code copied.',
    );
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

  function startRecurringCommitment() {
    setNotice(null);
    setRecurringDraft(buildRecurringCommitmentDraft());
    setRecurringAssetIds(selectedAssetId && assets.some((asset) => asset.id === selectedAssetId) ? [selectedAssetId] : []);
    setRecurringAssetPickerOpen(false);
    setRecurringAssetSearch('');
    setRecurringError('');
    setFlow('recurring');
  }

  function toggleRecurringAsset(assetId: string) {
    setRecurringAssetIds((current) => current.includes(assetId)
      ? current.filter((id) => id !== assetId)
      : [...current, assetId]);
  }

  function setRecurringField<K extends keyof RecurringCommitmentDraft>(key: K, value: RecurringCommitmentDraft[K]) {
    setRecurringDraft((current) => ({ ...current, [key]: value }));
  }

  async function submitRecurringCommitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecurringError('');
    if (!recurringAssetIds.length) {
      setRecurringError('Choose at least one linked asset.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(accountScopedUrl('/api/recurring-commitments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...recurringDraft,
          amount: recurringDraft.amount.replace(/\s/g, '').replace(',', '.'),
          assetIds: recurringAssetIds,
          status: 'active',
        }),
      });
      const payload = await response.json() as RecurringCommitmentResponse;
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'The recurring commitment could not be saved.');
      closeModal();
      setNotice({ tone: 'success', message: 'Recurring commitment saved separately from incurred Cost Ledger expenses.' });
    } catch (error) {
      setRecurringError(error instanceof Error ? error.message : 'The recurring commitment could not be saved.');
    } finally {
      setIsSaving(false);
    }
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
    setFocusedBudgetId(null);
    removeBudgetQueryParameter();
    setOpenFilterDropdown(null);
    setFilterAssetSearch('');
    setFilterOwnerSearch('');
    setFilterOpen(false);
  }

  function clearFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setActiveFilters(DEFAULT_FILTERS);
    setFocusedBudgetId(null);
    removeBudgetQueryParameter();
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

  async function loadAccountingSettings(force = false): Promise<AccountingSettings | null> {
    if (accountingSettings && !force) return accountingSettings;

    setAccountingSettingsLoading(true);
    setAccountingSettingsError('');

    try {
      const response = await fetch(accountScopedUrl('/api/my-invoices/accounting-settings'), { cache: 'no-store' });
      const data = (await response.json()) as AccountingSettingsResponse;
      if (!response.ok || !data.ok || !data.settings) {
        throw new Error(data.error || 'Accounting CSV settings could not be loaded.');
      }

      const nextSettings = copyAccountingSettings(data.settings);
      setAccountingSettings(nextSettings);
      setAccountingSettingsDraft(copyAccountingSettings(nextSettings));
      setSelectedAccountingSoftware(nextSettings.software);
      return nextSettings;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Accounting CSV settings could not be loaded.';
      setAccountingSettingsError(message);
      return null;
    } finally {
      setAccountingSettingsLoading(false);
    }
  }

  function openDownloadModal() {
    setIncludeFuelSlipCosts(true);
    setDownloadFilters(activeFilters);
    setDownloadStep('format');
    setDownloadFormat('pdf');
    setAccountingExportIssues([]);
    setAccountingExportError('');
    setOpenFilterDropdown(null);
    setDownloadOpen(true);
  }

  function closeDownloadModal() {
    setOpenFilterDropdown(null);
    setDownloadStep('format');
    setAccountingExportIssues([]);
    setAccountingExportError('');
    setAccountingSettingsOpen(false);
    setDownloadOpen(false);
  }

  function chooseDownloadFormat(format: DownloadExportFormat) {
    setDownloadFormat(format);
    setAccountingExportIssues([]);
    setAccountingExportError('');

    if (format === 'csv') {
      if (accountingSettings) {
        setSelectedAccountingSoftware(accountingSettings.software);
      } else {
        void loadAccountingSettings();
      }
    }
  }

  function showDownloadFormatStep() {
    setOpenFilterDropdown(null);
    setDownloadStep('format');
  }

  function showDownloadAccountingStep() {
    setOpenFilterDropdown(null);
    setDownloadStep('accounting');
    if (!accountingSettings && !accountingSettingsLoading) void loadAccountingSettings();
  }

  function showDownloadTimelineStep() {
    setOpenFilterDropdown(null);
    setDownloadStep('timeline');
  }

  function showNextStepAfterFormat() {
    if (downloadFormat === 'csv') {
      showDownloadAccountingStep();
      return;
    }
    showDownloadTimelineStep();
  }

  function showPreviousStepBeforeTimeline() {
    if (downloadFormat === 'csv') {
      showDownloadAccountingStep();
      return;
    }
    showDownloadFormatStep();
  }

  function showDownloadFuelStep() {
    setOpenFilterDropdown(null);
    setDownloadStep('fuel');
  }

  async function openAccountingSettings() {
    const loaded = await loadAccountingSettings();
    const nextDraft = copyAccountingSettings(loaded ?? accountingSettings ?? DEFAULT_ACCOUNTING_SETTINGS);
    nextDraft.software = selectedAccountingSoftware;
    setAccountingSettingsDraft(nextDraft);
    setNewAffectingAccount('');
    setAccountingSettingsError('');
    setAccountingSettingsOpen(true);
  }

  function closeAccountingSettings() {
    if (accountingSettingsSaving) return;
    setAccountingSettingsDraft(copyAccountingSettings(accountingSettings ?? DEFAULT_ACCOUNTING_SETTINGS));
    setNewAffectingAccount('');
    setAccountingSettingsError('');
    setAccountingSettingsOpen(false);
  }

  function setAccountingDraftField<K extends keyof AccountingSettings>(
    key: K,
    value: AccountingSettings[K],
  ) {
    setAccountingSettingsDraft((current) => ({ ...current, [key]: value }));
  }

  function addAffectingAccount() {
    const account = newAffectingAccount.replace(/\s+/g, ' ').trim();
    if (!account) return;

    setAccountingSettingsDraft((current) => {
      const exists = current.affectingAccounts.some(
        (entry) => entry.toLowerCase() === account.toLowerCase(),
      );
      return {
        ...current,
        affectingAccounts: exists ? current.affectingAccounts : [...current.affectingAccounts, account],
        defaultAffectingAccount: current.defaultAffectingAccount || account,
      };
    });
    setNewAffectingAccount('');
  }

  function removeAffectingAccount(account: string) {
    setAccountingSettingsDraft((current) => {
      const affectingAccounts = current.affectingAccounts.filter((entry) => entry !== account);
      return {
        ...current,
        affectingAccounts,
        defaultAffectingAccount: current.defaultAffectingAccount === account
          ? affectingAccounts[0] ?? ''
          : current.defaultAffectingAccount,
        fuelAffectingAccount: current.fuelAffectingAccount === account
          ? ''
          : current.fuelAffectingAccount,
      };
    });
  }

  function addAccountingSupplier() {
    setAccountingSettingsDraft((current) => ({
      ...current,
      suppliers: [
        ...current.suppliers,
        {
          id: clientSupplierId(),
          name: '',
          aliases: [],
        },
      ],
    }));
  }

  function updateAccountingSupplier(
    supplierId: string,
    patch: Partial<Pick<AccountingSupplier, 'name' | 'aliases'>>,
  ) {
    setAccountingSettingsDraft((current) => ({
      ...current,
      suppliers: current.suppliers.map((supplier) =>
        supplier.id === supplierId ? { ...supplier, ...patch } : supplier,
      ),
    }));
  }

  function removeAccountingSupplier(supplierId: string) {
    setAccountingSettingsDraft((current) => ({
      ...current,
      suppliers: current.suppliers.filter((supplier) => supplier.id !== supplierId),
    }));
  }

  async function saveAccountingSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountingSettingsSaving(true);
    setAccountingSettingsError('');

    try {
      const response = await fetch(accountScopedUrl('/api/my-invoices/accounting-settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountingSettingsDraft),
      });
      const data = (await response.json()) as AccountingSettingsResponse;
      if (!response.ok || !data.ok || !data.settings) {
        throw new Error(data.error || 'Accounting CSV settings could not be saved.');
      }

      const nextSettings = copyAccountingSettings(data.settings);
      setAccountingSettings(nextSettings);
      setAccountingSettingsDraft(copyAccountingSettings(nextSettings));
      setSelectedAccountingSoftware(nextSettings.software);
      setAccountingExportIssues([]);
      setAccountingExportError('');
      setAccountingSettingsOpen(false);
      setNotice({ tone: 'success', message: 'Accounting CSV settings saved.' });
    } catch (error) {
      setAccountingSettingsError(
        error instanceof Error ? error.message : 'Accounting CSV settings could not be saved.',
      );
    } finally {
      setAccountingSettingsSaving(false);
    }
  }

  async function handleDownloadReport(format: ReportFormat) {
    const url = buildReportUrl(
      downloadFilters,
      format,
      includeFuelSlipCosts,
      selectedAccountingSoftware,
      accountantShareId,
      accountantRegisterId,
    );

    if (format === 'csv') {
      if (!accountingSettings?.configured) {
        setAccountingExportError('Complete Accounting CSV Settings before downloading this file.');
        setAccountingExportIssues([]);
        showDownloadAccountingStep();
        return;
      }

      setAccountingExportDownloading(true);
      setAccountingExportIssues([]);
      setAccountingExportError('');

      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
          const data = await response.json().catch(() => null) as AccountingExportErrorResponse | null;
          setAccountingExportError(data?.error || 'The accounting CSV could not be generated.');
          setAccountingExportIssues(data?.issues ?? []);
          setDownloadStep('accounting');
          return;
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = downloadFileName(response, 'cost-ledger-accounting.csv');
        link.rel = 'noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        closeDownloadModal();
      } catch (error) {
        setAccountingExportError(
          error instanceof Error ? error.message : 'The accounting CSV could not be downloaded.',
        );
        setDownloadStep('accounting');
      } finally {
        setAccountingExportDownloading(false);
      }
      return;
    }

    if (format === 'xlsx') {
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

    const response = await fetch(accountScopedUrl(`${apiRoot}/upload`), {
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
      const formData = new FormData();
      formData.append('assetId', selectedAssetId);
      formData.append('file', automaticUploadFile);

      const response = await fetch(accountScopedUrl(`${captureApiRoot}/invoice`), {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = (await response.json()) as CaptureRequestResponse;
      if (!response.ok || !data.ok || !data.request) {
        throw new Error(data.error || 'The invoice/photo could not be sent for Aim4price capture.');
      }

      setCaptureRequests((current) => [data.request!, ...current.filter((request) => request.id !== data.request!.id)]);
      closeModal();
      setNotice({
        tone: 'success',
        message: `${data.request.referenceCode} received. Aim4price will capture and verify it within 24 hours.`,
      });
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

      const response = await fetch(accountScopedUrl(editingInvoiceId ? `${apiRoot}/${editingInvoiceId}` : apiRoot), {
        method: editingInvoiceId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as InvoicesResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'The cost record could not be saved.');
      }

      await Promise.all([reloadData(), reloadBudgets()]);
      if (canManageBudgets) dispatchCostLedgerUpdated();
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
      const response = await fetch(accountScopedUrl(`${apiRoot}/${invoiceId}`), { method: 'DELETE' });
      const data = (await response.json()) as InvoicesResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'The cost record could not be deleted.');
      }

      await Promise.all([reloadData(), reloadBudgets()]);
      if (canManageBudgets) dispatchCostLedgerUpdated();
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

  async function fetchCaptureRequests(): Promise<CaptureRequestStatusItem[] | null> {
    try {
      const url = accountScopedUrl(`${captureApiRoot}?requestType=invoice&active=1`);
      const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
      const data = (await response.json()) as CaptureRequestResponse;
      return response.ok && data.ok ? data.requests ?? [] : null;
    } catch {
      // Ledger records remain usable when capture status is temporarily unavailable.
      return null;
    }
  }

  async function retractCaptureRequest(requestId: string): Promise<void> {
    const response = await fetch(`/api/capture-requests/${encodeURIComponent(requestId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = (await response.json().catch(() => null)) as CaptureRequestResponse | null;
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || 'This submission could not be retracted. Please try again.');
    }

    setCaptureRequests((current) => current.filter((request) => request.id !== requestId));
    setNotice({
      tone: 'success',
      message: data.message || 'Submission retracted. It was removed from assisted capture.',
    });
  }

  function closeCaptureReview() {
    setCaptureReviewRequestId(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has('captureRequestId')) {
      url.searchParams.delete('captureRequestId');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  async function handleCaptureReviewResolved(message: string) {
    closeCaptureReview();
    setNotice({ tone: 'success', message });
    const [requests, invoiceData] = await Promise.all([
      fetchCaptureRequests(),
      fetchInvoiceData(activeFilters).catch(() => null),
      reloadBudgets().catch(() => undefined),
    ]);
    if (requests) setCaptureRequests(requests);
    if (invoiceData) applyInvoiceData(invoiceData);
    if (canManageBudgets) dispatchCostLedgerUpdated();
  }

  return (
    <main className={`${styles.page} ${dealerMode ? styles.dealerCostsPage : ''}`}>
      {shouldShowAppHeader ? <AppHeader active={dealerMode ? 'cost' : 'none'} /> : null}
      <section ref={pageShellRef} className={styles.shell}>
        {notice ? <div className={`${styles.notice} ${styles[notice.tone === 'success' ? 'noticeSuccess' : 'noticeError']}`}>{notice.message}</div> : null}

        {dealerMode ? (
          <WorkspaceTitlePanel
            title="CLIENT ASSET COSTS"
            className={styles.dealerCostsTitlePanel}
          />
        ) : (
          <section className={styles.pageTitleBlock}>
            <div>
              <h1>COST LEDGER</h1>
            </div>
          </section>
        )}

        {!dealerMode ? (
          <section
            className={`${styles.costActionGrid} ${canManageBudgets && canManageInvoiceDropCodes ? '' : styles.costActionGridCompact}`}
            aria-label="Cost Ledger actions"
          >
            <button
              type="button"
              className={`${styles.secondaryButton} ${styles.costActionButton} ${styles.costActionAdd}`}
              onClick={() => openAddInvoiceModal()}
            >
              <span className={styles.plusMark} aria-hidden="true">+</span>
              <span>Add Cost</span>
            </button>

            {canManageBudgets ? (
              <button
                ref={budgetManagerTriggerRef}
                type="button"
                className={`${styles.secondaryButton} ${styles.costActionButton} ${styles.costActionBudgets}`}
                onClick={openBudgetManager}
                aria-haspopup="dialog"
                aria-label={budgetAttentionCount
                  ? `Budgets, ${budgetAttentionCount} ${budgetAttentionCount === 1 ? 'alert' : 'alerts'} need attention`
                  : 'Budgets'}
              >
                <LedgerIcon />
                <span>Budgets</span>
                {budgetAttentionCount ? (
                  <strong className={styles.costActionAlert} aria-hidden="true">{budgetAttentionCount}</strong>
                ) : null}
              </button>
            ) : null}

            {canManageInvoiceDropCodes ? (
              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.costActionButton} ${styles.costActionContribution}`}
                onClick={() => {
                  if (!assets.length) {
                    setNotice({ tone: 'error', message: 'Add a saved asset before creating a contribution code.' });
                    return;
                  }
                  openInvoiceDropCodeManager();
                }}
                disabled={isLoading}
                aria-haspopup="dialog"
                aria-label={isLoading
                  ? 'Contribution, loading saved assets'
                  : assets.length
                    ? 'Contribution'
                    : 'Contribution, add a saved asset first'}
              >
                <ContributionIcon />
                <span className={styles.costActionCopy}>
                  <span>Contribution</span>
                  {isLoading ? <small>Loading assets...</small> : !assets.length ? <small>Add an asset first</small> : null}
                </span>
              </button>
            ) : null}

            <button
              type="button"
              className={`${styles.primaryButton} ${styles.costActionButton} ${styles.costActionDownload}`}
              onClick={openDownloadModal}
            >
              <DownloadIcon />
              <span>Download</span>
            </button>
          </section>
        ) : null}

        <section className={`${styles.invoiceToolbar} ${!dealerMode ? styles.ownerInvoiceToolbar : ''}`} aria-label="Saved cost record controls">
          <label className={styles.searchWrap}>
            <SearchIcon className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              value={invoiceSearch}
              onChange={(event) => setInvoiceSearch(event.target.value)}
              placeholder={dealerMode
                ? 'Search client, asset or invoice'
                : 'Search suppliers, assets, invoice numbers or costs...'}
              aria-label="Search saved cost records"
            />
            {hasInvoiceSearch ? (
              <button type="button" className={styles.clearSearchButton} onClick={() => setInvoiceSearch('')} aria-label="Clear saved cost record search">
                ×
              </button>
            ) : null}
          </label>

          {dealerMode ? (
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
            </div>
          ) : (
            <button type="button" className={`${styles.secondaryButton} ${styles.toolbarButton} ${styles.toolbarFilterButton} ${styles.searchFilterButton}`} onClick={openFilterPanel}>
              <FilterIcon className={styles.buttonIcon} />
              <span>Filter</span>
              {activeFilterCount ? <strong>{activeFilterCount}</strong> : null}
            </button>
          )}
        </section>

        <CaptureRequestStatusList
          requests={captureRequests}
          onReview={canManageInvoiceDropCodes ? setCaptureReviewRequestId : undefined}
          onRetract={canRetractCaptureRequests ? retractCaptureRequest : undefined}
        />

        {focusedBudget ? (
          <div className={styles.budgetFocusBar}>
            <span>
              Showing costs counted by the <strong>{focusedBudget.assetTitle}</strong> {focusedBudget.period} budget
              {!focusedBudget.includeFuelSlipCosts ? ' (Fuel Slip costs excluded)' : ''}.
            </span>
            <button type="button" onClick={clearFocusedBudgetView}>Clear budget view</button>
          </div>
        ) : null}

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
                        <>
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
                        </>
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

      {canManageInvoiceDropCodes ? (
        <CaptureRequestDecisionModal
          requestId={captureReviewRequestId}
          onClose={closeCaptureReview}
          onResolved={(message) => void handleCaptureReviewResolved(message)}
        />
      ) : null}

      {budgetManagerOpen && !budgetModalOpen && !budgetDeleteCandidate ? (
        <div className={styles.modalBackdrop}>
          <div
            ref={budgetManagerDialogRef}
            className={`${styles.formModal} ${styles.budgetManagerModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="budget-manager-title"
            aria-busy={budgetsLoading}
            tabIndex={-1}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="budget-manager-title">Total spend budgets</h2>
                <p>Track incurred Cost Ledger spending across all saved assets or one selected asset.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeBudgetManager} aria-label="Close spending budgets" data-budget-manager-close>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.modalDivider} />

            <div className={`${styles.formModalScrollBody} ${styles.budgetManagerBody}`}>
              <section className={`${styles.budgetSection} ${styles.budgetManagerSection}`} aria-label="Spending budget overview">
                <div className={styles.budgetManagerToolbar}>
                  <div>
                    <span className={styles.budgetEyebrow}>Cost control</span>
                    <strong>
                      {budgetsLoading
                        ? 'Loading budgets...'
                        : `${costBudgets.length.toLocaleString('en-ZA')} active ${costBudgets.length === 1 ? 'budget' : 'budgets'}`}
                    </strong>
                  </div>
                  <button type="button" className={styles.primaryButton} onClick={openCreateBudget} disabled={budgetsLoading} data-budget-trigger="add">
                    <span className={styles.plusMark} aria-hidden="true">+</span>
                    Add budget
                  </button>
                </div>

                {budgetManagerNotice ? (
                  <div
                    className={`${styles.budgetManagerNotice} ${styles[budgetManagerNotice.tone === 'success'
                      ? 'budgetManagerNoticeSuccess'
                      : 'budgetManagerNoticeError']}`}
                    role={budgetManagerNotice.tone === 'error' ? 'alert' : 'status'}
                    aria-live={budgetManagerNotice.tone === 'error' ? 'assertive' : 'polite'}
                  >
                    {budgetManagerNotice.message}
                  </div>
                ) : null}

                {budgetsLoading ? <div className={styles.budgetEmpty}>Loading spending budgets...</div> : null}
                {!budgetsLoading && budgetLoadError ? (
                  <div className={styles.budgetError} role="alert">
                    <span>{budgetLoadError}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setBudgetLoadError('');
                        setBudgetsLoading(true);
                        void reloadBudgets()
                          .catch((error) => setBudgetLoadError(error instanceof Error ? error.message : 'Spending budgets could not be loaded.'))
                          .finally(() => setBudgetsLoading(false));
                      }}
                    >
                      Try again
                    </button>
                  </div>
                ) : null}
                {!budgetsLoading && !budgetLoadError && !costBudgets.length ? (
                  <div className={styles.budgetEmpty}>
                    <strong>No spending budget yet.</strong>
                    <span>Add a monthly or annual total-spend limit to start tracking cost of ownership.</span>
                  </div>
                ) : null}

                {!budgetsLoading && costBudgets.length ? (
                  <div className={styles.budgetGrid}>
                    {costBudgets.map((budget) => {
                      const progress = Math.max(0, Math.min(100, budget.percentUsed));
                      const statusLabel = budget.status === 'over_budget'
                        ? 'Over budget'
                        : budget.status === 'warning'
                          ? 'Near limit'
                          : 'On track';
                      return (
                        <article
                          id={`cost-budget-${budget.id}`}
                          key={budget.id}
                          className={[
                            styles.budgetCard,
                            styles[budget.status === 'over_budget'
                              ? 'budgetCardOver'
                              : budget.status === 'warning'
                                ? 'budgetCardWarning'
                                : 'budgetCardOnTrack'],
                            focusedBudgetId === budget.id ? styles.budgetCardFocused : '',
                          ].join(' ')}
                        >
                          <div className={styles.budgetCardTop}>
                            <div>
                              <strong>{budget.assetTitle}</strong>
                              <div className={styles.budgetCardContext}>
                                <span className={styles.budgetPeriodBadge}>{budget.period === 'monthly' ? 'Monthly' : 'Annual'}</span>
                                <span>{budget.periodLabel}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              className={styles.budgetEditButton}
                              onClick={() => openEditBudget(budget)}
                              aria-label={`Edit ${budget.assetTitle} ${budget.period} budget`}
                              data-budget-trigger={budget.id}
                            >
                              <EditIcon />
                            </button>
                          </div>
                          <div className={styles.budgetAmount}>
                            <strong>{formatMoney(budget.spent)}</strong>
                            <span>of {formatMoney(budget.amount)} spent</span>
                          </div>
                          <div
                            className={styles.budgetProgressTrack}
                            role="progressbar"
                            aria-label={`${budget.assetTitle} budget used`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(progress)}
                          >
                            <span className={styles.budgetProgressFill} style={{ width: `${progress}%` }} />
                          </div>
                          <div className={styles.budgetStatusRow}>
                            <strong className={styles.budgetStatusPill}>{statusLabel}</strong>
                            <span>{budget.percentUsed.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}% used</span>
                          </div>
                          <div className={styles.budgetMeta}>
                            <span>{budget.status === 'over_budget' ? `${formatMoney(budget.overBy)} over budget` : `${formatMoney(budget.remaining)} remaining`}</span>
                            <span>Alert at {budget.warningPercent}% · Fuel {budget.includeFuelSlipCosts ? 'included' : 'excluded'}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            </div>

            <div className={`${styles.modalFooter} ${styles.budgetManagerFooter}`}>
              <button type="button" className={styles.secondaryButton} onClick={closeBudgetManager}>Done</button>
            </div>
          </div>
        </div>
      ) : null}

      {budgetModalOpen ? (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby={budgetAssetPickerOpen ? 'budget-scope-picker-title' : 'budget-modal-title'}
        >
          {budgetAssetPickerOpen ? (
            <div className={`${styles.assetModal} ${styles.budgetAssetPickerModal}`}>
              <div className={styles.modalHeader}>
                <div>
                  <h2 id="budget-scope-picker-title">Choose budget scope</h2>
                  <p>Track all saved assets together or focus this budget on one asset.</p>
                </div>
                <button type="button" className={styles.closeButton} onClick={closeBudgetModal} aria-label="Close budget form">
                  <CloseIcon />
                </button>
              </div>
              <div className={styles.modalDivider} />
              <div className={styles.pickerToolbar}>
                <input
                  type="search"
                  value={budgetAssetSearch}
                  onChange={(event) => setBudgetAssetSearch(event.target.value)}
                  placeholder="Search saved assets..."
                  aria-label="Search saved assets"
                  autoComplete="off"
                  autoFocus
                />
                <button type="button" className={styles.secondaryButton} onClick={() => setBudgetAssetSearch('')} disabled={!budgetAssetSearch}>
                  Clear
                </button>
              </div>
              <div className={`${styles.assetList} ${styles.budgetAssetList}`}>
                <button
                  type="button"
                  className={`${styles.assetRow} ${styles.budgetScopeRow} ${budgetDraft.assetId === 'all' ? styles.budgetScopeRowSelected : ''}`}
                  onClick={() => chooseBudgetAsset('all')}
                  aria-pressed={budgetDraft.assetId === 'all'}
                >
                  <span className={styles.assetInfo}>
                    <strong>All saved assets</strong>
                    <small>Combine incurred Cost Ledger spend across {assets.length.toLocaleString('en-ZA')} saved {assets.length === 1 ? 'asset' : 'assets'}.</small>
                  </span>
                  <span className={styles.budgetScopeRowAction}>{budgetDraft.assetId === 'all' ? 'Selected' : 'Choose'}</span>
                </button>

                {filteredBudgetAssets.length ? filteredBudgetAssets.map((asset) => {
                  const isSelected = budgetDraft.assetId === asset.id;
                  return (
                    <button
                      type="button"
                      key={asset.id}
                      className={`${styles.assetRow} ${styles.budgetScopeRow} ${isSelected ? styles.budgetScopeRowSelected : ''}`}
                      onClick={() => chooseBudgetAsset(asset.id)}
                      aria-pressed={isSelected}
                    >
                      <span className={styles.assetInfo}>
                        {asset.ownerName ? <small>{asset.ownerName}</small> : null}
                        <strong>{asset.title}</strong>
                        <small>{asset.meta}</small>
                        <small>{asset.categoryLabel} · {asset.selectedMethod === 'manual' ? 'Manual' : 'Aim4price'}</small>
                      </span>
                      <span className={styles.assetValue}>
                        <strong>{formatMoney(asset.value)}</strong>
                        <small>{isSelected ? 'selected scope' : 'current value'}</small>
                      </span>
                    </button>
                  );
                }) : (
                  <div className={styles.emptyState} role="status">No matching saved assets found.</div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryButton} onClick={closeBudgetAssetPicker}>Back to budget</button>
              </div>
            </div>
          ) : (
            <form className={`${styles.formModal} ${styles.budgetModal}`} onSubmit={submitCostBudget}>
              <div className={styles.modalHeader}>
                <div>
                  <h2 id="budget-modal-title">{editingBudgetId ? 'Edit spending budget' : 'Add spending budget'}</h2>
                  <p>Choose what to track and when Aim4price should alert you.</p>
                </div>
                <button type="button" className={styles.closeButton} onClick={closeBudgetModal} aria-label="Close budget form">
                  <CloseIcon />
                </button>
              </div>
              <div className={styles.modalDivider} />

              <div className={`${styles.formModalScrollBody} ${styles.budgetFormBody}`}>
                <div className={styles.budgetSetupGrid}>
                  <section className={styles.budgetSetupCard} aria-labelledby="budget-coverage-heading">
                    <div className={styles.budgetSetupCardHeader}>
                      <span className={styles.budgetSetupIcon} aria-hidden="true"><LedgerIcon /></span>
                      <div>
                        <h3 id="budget-coverage-heading">Budget coverage</h3>
                        <p>Choose the assets and time period this limit should watch.</p>
                      </div>
                    </div>

                    <button
                      ref={budgetScopeTriggerRef}
                      type="button"
                      className={styles.budgetScopeTrigger}
                      onClick={() => {
                        setBudgetAssetSearch('');
                        setBudgetAssetPickerOpen(true);
                      }}
                      disabled={budgetSaving}
                      aria-haspopup="dialog"
                    >
                      <span className={styles.budgetScopeCopy}>
                        <span>Asset scope</span>
                        <strong>
                          {budgetDraft.assetId === 'all'
                            ? 'All saved assets'
                            : selectedBudgetAsset?.title ?? 'Asset unavailable'}
                        </strong>
                        <small>
                          {budgetDraft.assetId === 'all'
                            ? `Combined spend across ${assets.length.toLocaleString('en-ZA')} saved ${assets.length === 1 ? 'asset' : 'assets'}`
                            : selectedBudgetAsset
                              ? `${selectedBudgetAsset.categoryLabel}${selectedBudgetAsset.yearModel ? ` · ${selectedBudgetAsset.yearModel}` : ''}`
                              : 'Choose another saved asset for this budget'}
                        </small>
                      </span>
                      <span className={styles.budgetScopeAction}>{budgetDraft.assetId === 'all' ? 'Choose' : 'Change'}<ChevronDownIcon /></span>
                    </button>

                    <fieldset className={styles.budgetPeriodField}>
                      <legend>Budget period</legend>
                      <div className={styles.budgetPeriodControl}>
                        {(['monthly', 'annual'] as const).map((period) => (
                          <button
                            type="button"
                            key={period}
                            className={budgetDraft.period === period ? styles.budgetPeriodOptionActive : ''}
                            onClick={() => setBudgetDraft((current) => ({ ...current, period }))}
                            aria-pressed={budgetDraft.period === period}
                            disabled={budgetSaving}
                          >
                            {period === 'monthly' ? 'Monthly' : 'Annual'}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </section>

                  <section className={styles.budgetSetupCard} aria-labelledby="budget-limit-heading">
                    <div className={styles.budgetSetupCardHeader}>
                      <span className={styles.budgetSetupIcon} aria-hidden="true"><VatIcon /></span>
                      <div>
                        <h3 id="budget-limit-heading">Limit &amp; alert</h3>
                        <p>Set the VAT-inclusive ceiling and your early warning point.</p>
                      </div>
                    </div>

                    <div className={styles.budgetLimitGrid}>
                      <label className={styles.budgetField}>
                        <span>Budget amount (incl. VAT)</span>
                        <div className={styles.budgetMoneyInput}>
                          <span>R</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={budgetDraft.amount}
                            onChange={(event) => setBudgetDraft((current) => ({
                              ...current,
                              amount: formatInvoiceMoneyInput(event.target.value),
                            }))}
                            placeholder="50 000.00"
                            autoComplete="off"
                            required
                            disabled={budgetSaving}
                          />
                        </div>
                      </label>

                      <label className={styles.budgetField}>
                        <span>Warning level</span>
                        <div className={styles.budgetPercentInput}>
                          <input
                            type="number"
                            min="1"
                            max="99"
                            step="1"
                            value={budgetDraft.warningPercent}
                            onChange={(event) => setBudgetDraft((current) => ({ ...current, warningPercent: event.target.value }))}
                            required
                            disabled={budgetSaving}
                          />
                          <span>%</span>
                        </div>
                        <small>We&apos;ll alert you when total spend reaches this level.</small>
                      </label>
                    </div>
                  </section>
                </div>

                <label className={styles.budgetFuelToggle}>
                  <input
                    type="checkbox"
                    checked={budgetDraft.includeFuelSlipCosts}
                    onChange={(event) => setBudgetDraft((current) => ({
                      ...current,
                      includeFuelSlipCosts: event.target.checked,
                    }))}
                    disabled={budgetSaving}
                  />
                  <span aria-hidden="true" />
                  <div>
                    <strong>Include Fuel Slip costs</strong>
                    <small>Turn this off if fuel should not count toward this limit.</small>
                  </div>
                </label>

                <div className={styles.budgetHelper}>
                  Only incurred VAT-inclusive Cost Ledger costs count. Pending dealer costs, pending captures, recurring commitments and category budgets are excluded.
                </div>
                {budgetFormError ? <div className={styles.budgetFormError} role="alert">{budgetFormError}</div> : null}
              </div>

              <div className={`${styles.modalFooter} ${styles.budgetModalFooter}`}>
                <div>
                  {editingBudgetId ? (
                    <button ref={budgetDeleteButtonRef} type="button" className={styles.budgetDeleteButton} onClick={askToDeleteBudget} disabled={budgetSaving}>
                      Delete budget
                    </button>
                  ) : null}
                </div>
                <div className={styles.budgetModalActions}>
                  <button type="button" className={styles.secondaryButton} onClick={closeBudgetModal} disabled={budgetSaving}>Cancel</button>
                  <button type="submit" className={styles.primaryButton} disabled={budgetSaving}>
                    {budgetSaving ? 'Saving...' : editingBudgetId ? 'Save changes' : 'Create budget'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      ) : null}

      {budgetDeleteCandidate ? (
        <div className={styles.modalBackdrop} role="alertdialog" aria-modal="true" aria-labelledby="delete-budget-title" aria-describedby="delete-budget-description">
          <div className={styles.budgetDeleteDialog}>
            <div>
              <span className={styles.budgetDeleteEyebrow}>Delete budget</span>
              <h2 id="delete-budget-title">Remove this spending budget?</h2>
              <p id="delete-budget-description">This removes the limit and its future alerts. Your Cost Ledger records will not be changed.</p>
            </div>
            <div className={styles.budgetDeleteSummary}>
              <strong>{budgetDeleteCandidate.assetTitle}</strong>
              <span>{budgetDeleteCandidate.period === 'monthly' ? 'Monthly' : 'Annual'} · {formatMoney(budgetDeleteCandidate.amount)}</span>
            </div>
            {budgetDeleteError ? <div className={styles.budgetFormError} role="alert">{budgetDeleteError}</div> : null}
            <div className={styles.budgetDeleteActions}>
              <button ref={budgetDeleteCancelRef} type="button" className={styles.secondaryButton} onClick={closeDeleteBudgetDialog} disabled={Boolean(budgetDeletingId)}>Keep budget</button>
              <button type="button" className={styles.budgetDeleteButton} onClick={() => void confirmDeleteBudget()} disabled={Boolean(budgetDeletingId)}>
                {budgetDeletingId ? 'Deleting...' : 'Delete budget'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {invoiceDropCodeOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Manage Invoice Drop contribution code">
          <div className={`${styles.downloadModal} ${styles.invoiceDropCodeModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Invoice Drop code</h2>
                <p>Invite an outside dealer, workshop or supplier to send an invoice for one asset.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeInvoiceDropCodeManager} aria-label="Close Invoice Drop code manager"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />

            <div className={styles.invoiceDropCodeBody}>
              <label className={styles.invoiceDropAssetField}>
                <span>Asset</span>
                <select
                  value={invoiceDropAssetId}
                  onChange={(event) => {
                    setInvoiceDropAssetId(event.target.value);
                    setInvoiceDropCode(null);
                    setNewInvoiceDropCode('');
                    setInvoiceDropCodeError('');
                    setInvoiceDropCodeMessage('');
                  }}
                  disabled={invoiceDropCodeSaving}
                >
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.title}</option>
                  ))}
                </select>
                {invoiceDropAsset ? <small>{invoiceDropAsset.categoryLabel}{invoiceDropAsset.yearModel ? ` · ${invoiceDropAsset.yearModel}` : ''}</small> : null}
              </label>

              <div className={styles.invoiceDropSafetyNote}>
                <strong>Contribution-only access</strong>
                <p>This code can only submit an invoice into Aim4price&apos;s review queue. It cannot open your account, identify the asset, or reveal any asset details.</p>
              </div>

              {invoiceDropCodeLoading ? <div className={styles.invoiceDropCodeLoading}>Checking this asset&apos;s active code...</div> : null}

              {!invoiceDropCodeLoading ? (
                <section className={styles.invoiceDropCodeCard} aria-live="polite">
                  <div className={styles.invoiceDropCodeCardHeader}>
                    <div>
                      <span>Active contribution code</span>
                      <strong>{invoiceDropCode ? 'Ready to receive invoices' : 'No active code'}</strong>
                    </div>
                    {invoiceDropCode ? <span className={styles.invoiceDropCodeActiveBadge}>Active</span> : null}
                  </div>

                  {newInvoiceDropCode ? (
                    <div className={styles.invoiceDropCodeReveal}>
                      <code>{newInvoiceDropCode}</code>
                      <p>Copy this full code now. For security, Aim4price will show only the last four characters after you close this window.</p>
                      <div className={styles.invoiceDropCodeInlineActions}>
                        <button type="button" className={styles.primaryButton} onClick={() => void copyInvoiceDropText(newInvoiceDropCode, 'New contribution code copied.')}>
                          Copy code
                        </button>
                        <button type="button" className={styles.secondaryButton} onClick={() => void copyInvoiceDropInstructions()}>
                          Copy link + code
                        </button>
                      </div>
                    </div>
                  ) : invoiceDropCode ? (
                    <div className={styles.invoiceDropCodeMasked}>
                      <code aria-label={`Active code ending in ${invoiceDropCode.lastFour}`}>A4P-••••-••••-{invoiceDropCode.lastFour}</code>
                      <small>Created {formatDateTime(invoiceDropCode.createdAtIso)}. The full code is never shown again.</small>
                    </div>
                  ) : (
                    <p className={styles.invoiceDropCodeEmpty}>Create a code when you are ready to invite someone to submit an invoice for this asset.</p>
                  )}

                  <div className={styles.invoiceDropCodeActions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => void issueSelectedInvoiceDropCode()}
                      disabled={!invoiceDropAssetId || invoiceDropCodeSaving}
                    >
                      {invoiceDropCodeSaving ? 'Updating...' : invoiceDropCode ? 'Rotate code' : 'Create code'}
                    </button>
                    {invoiceDropCode ? (
                      <button
                        type="button"
                        className={styles.invoiceDropRevokeButton}
                        onClick={() => void revokeSelectedInvoiceDropCode()}
                        disabled={invoiceDropCodeSaving}
                      >
                        Revoke code
                      </button>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className={styles.invoiceDropLinkCard}>
                <div>
                  <span>Public upload page</span>
                  <strong>{invoiceDropPublicUrl}</strong>
                </div>
                <div className={styles.invoiceDropCodeInlineActions}>
                  <a className={styles.secondaryButton} href="/drop-invoice" target="_blank" rel="noreferrer">Open page</a>
                  <button type="button" className={styles.secondaryButton} onClick={() => void copyInvoiceDropText(invoiceDropPublicUrl, 'Public Invoice Drop link copied.')}>Copy link</button>
                  <button type="button" className={styles.secondaryButton} onClick={() => void shareInvoiceDropLink()}>Share</button>
                </div>
              </section>

              {invoiceDropCodeError ? <div className={styles.invoiceDropCodeError} role="alert">{invoiceDropCodeError}</div> : null}
              {invoiceDropCodeMessage ? <div className={styles.invoiceDropCodeSuccess} role="status">{invoiceDropCodeMessage}</div> : null}
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeInvoiceDropCodeManager}>Done</button>
            </div>
          </div>
        </div>
      ) : null}

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
                  <strong>Upload for Aim4price capture</strong>
                  <small>Send a PDF or photo and Aim4price will capture and verify it within 24 hours.</small>
                </span>
              </button>
              {!dealerMode ? (
                <button type="button" className={`${styles.sourceChoiceOption} ${styles.recurringChoiceOption}`} onClick={startRecurringCommitment}>
                  <span className={styles.choiceGraphic}>
                    <ManualInvoiceIcon />
                  </span>
                  <span className={styles.choiceTitleBlock}>
                    <strong>Add recurring commitment</strong>
                    <small>Track future recurring asset costs.</small>
                  </span>
                </button>
              ) : null}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {recurringOpen && !recurringAssetPickerOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Add recurring commitment">
          <form className={`${styles.formModal} ${styles.costFormModal} ${styles.recurringCommitmentModal}`} onSubmit={submitRecurringCommitment}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Add recurring commitment</h2>
                <p>Track a future cost and every asset it covers.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.formModalScrollBody}>
              <section className={`${styles.invoiceFormCard} ${styles.recurringCommitmentCard}`}>
                <div className={`${styles.formGrid} ${styles.recurringCommitmentGrid}`}>
                  <label>
                    <span>Description</span>
                    <input value={recurringDraft.description} onChange={(event) => setRecurringField('description', event.target.value)} placeholder="Insurance policy or service plan" required />
                  </label>
                  <label>
                    <span>Category</span>
                    <select value={recurringDraft.category} onChange={(event) => setRecurringField('category', event.target.value)}>
                      <option value="insurance">Insurance</option>
                      <option value="service_plan">Service plan</option>
                      <option value="licence">Licence</option>
                      <option value="subscription">Subscription</option>
                      <option value="lease">Lease</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    <span>Amount</span>
                    <input inputMode="decimal" value={recurringDraft.amount} onChange={(event) => setRecurringField('amount', formatInvoiceMoneyInput(event.target.value))} placeholder="R 0" required />
                  </label>
                  <label>
                    <span>Frequency</span>
                    <select value={recurringDraft.frequency} onChange={(event) => setRecurringField('frequency', event.target.value as CommitmentFrequency)}>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="six_monthly">Every six months</option>
                      <option value="annual">Annual</option>
                    </select>
                  </label>
                  <label>
                    <span>Start date</span>
                    <input type="date" value={recurringDraft.startDate} onChange={(event) => setRecurringField('startDate', event.target.value)} required />
                  </label>
                  <label>
                    <span>End date <small>(optional)</small></span>
                    <input type="date" value={recurringDraft.endDate} onChange={(event) => setRecurringField('endDate', event.target.value)} />
                  </label>
                  <label>
                    <span>Renewal date <small>(optional)</small></span>
                    <input type="date" value={recurringDraft.renewalDate} onChange={(event) => setRecurringField('renewalDate', event.target.value)} />
                  </label>
                  <label>
                    <span>Source / reference <small>(optional)</small></span>
                    <input value={recurringDraft.sourceReference} onChange={(event) => setRecurringField('sourceReference', event.target.value)} />
                  </label>
                  <div className={`${styles.recurringAssetField} ${styles.recurringCommitmentWide}`}>
                    <span className={styles.recurringAssetFieldLabel}>Linked assets</span>
                    <button
                      type="button"
                      className={styles.recurringAssetTrigger}
                      onClick={() => setRecurringAssetPickerOpen(true)}
                      aria-haspopup="dialog"
                      disabled={assetLockedForFlow}
                    >
                      <span>
                        <strong>{recurringAssetIds.length ? `${recurringAssetIds.length} asset${recurringAssetIds.length === 1 ? '' : 's'} selected` : 'Choose linked assets'}</strong>
                        <small>{assetLockedForFlow ? 'This asset is fixed for this quick add.' : 'Select every asset covered by this commitment.'}</small>
                      </span>
                      <b>{assetLockedForFlow ? 'Locked' : recurringAssetIds.length ? 'Change' : 'Choose'}</b>
                    </button>
                    {recurringSelectedAssets.length ? <div className={styles.recurringAssetChips}>
                      {recurringSelectedAssets.map((asset) => <span key={asset.id}>{asset.title}</span>)}
                    </div> : null}
                  </div>
                </div>
                <div className={`${styles.textAreaGrid} ${styles.recurringCommitmentNote}`}>
                  <label><span>Note <small>(optional)</small></span><textarea value={recurringDraft.note} onChange={(event) => setRecurringField('note', event.target.value)} rows={3} /></label>
                </div>
                {recurringError ? <div className={styles.warningBox} role="alert"><p>{recurringError}</p></div> : null}
              </section>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => setFlow('source-choice')} disabled={isSaving}>Back</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save commitment'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {recurringOpen && recurringAssetPickerOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Choose linked assets">
          <div className={`${styles.assetModal} ${styles.recurringAssetPickerModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Choose linked assets</h2>
                <p>Select every asset covered by this commitment.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => setRecurringAssetPickerOpen(false)} aria-label="Close linked asset picker"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.pickerToolbar}>
              <input
                type="search"
                value={recurringAssetSearch}
                onChange={(event) => setRecurringAssetSearch(event.target.value)}
                placeholder="Search assets..."
                aria-label="Search linked assets"
              />
              <button type="button" className={styles.secondaryButton} onClick={() => setRecurringAssetSearch('')} disabled={!recurringAssetSearch}>Clear</button>
            </div>
            <div className={`${styles.assetList} ${styles.recurringAssetList}`}>
              {filteredRecurringAssets.length ? filteredRecurringAssets.map((asset) => {
                const selected = recurringAssetIds.includes(asset.id);
                return (
                  <button
                    type="button"
                    key={asset.id}
                    className={`${styles.assetRow} ${styles.recurringAssetRow} ${selected ? styles.recurringAssetRowSelected : ''}`}
                    onClick={() => toggleRecurringAsset(asset.id)}
                    aria-pressed={selected}
                  >
                    <span className={styles.recurringAssetCheck} aria-hidden="true">{selected ? '✓' : ''}</span>
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
                );
              }) : <div className={styles.emptyState}>No matching assets found.</div>}
            </div>
            <div className={`${styles.modalFooter} ${styles.recurringAssetPickerFooter}`}>
              <button type="button" className={styles.secondaryButton} onClick={() => setRecurringAssetIds([])} disabled={!recurringAssetIds.length}>Clear selection</button>
              <button type="button" className={styles.primaryButton} onClick={() => setRecurringAssetPickerOpen(false)}>
                {recurringAssetIds.length ? `Done · ${recurringAssetIds.length} selected` : 'Done'}
              </button>
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
          <div className={`${styles.downloadModal} ${styles.reportModal} ${styles.downloadExportModal} ${downloadStep === 'format' ? styles.downloadFormatModal : ''} ${downloadStep === 'accounting' ? styles.downloadAccountingModal : ''}`}>
            <div className={styles.modalHeader}>
              <div>
                <h2>
                  {downloadStep === 'format'
                    ? 'Download cost records'
                    : downloadStep === 'accounting'
                      ? 'Choose accounting system'
                      : downloadStep === 'timeline'
                        ? 'Choose report timeline'
                        : 'External fuel costs'}
                </h2>
                <p>
                  {downloadStep === 'format'
                    ? 'Choose a file format to begin.'
                    : downloadStep === 'accounting'
                      ? 'Choose a CSV format and confirm your mappings.'
                      : downloadStep === 'timeline'
                        ? 'Select the year and optional month to include.'
                        : 'Choose whether Fuel Slip records should be included.'}
                </p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeDownloadModal} aria-label="Close download"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <ol className={styles.downloadStageRail} aria-label="Cost ledger download progress">
              {downloadSteps.map((step, index) => {
                const activeIndex = downloadSteps.findIndex((item) => item.key === downloadStep);
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
                    onClick={() => chooseDownloadFormat('pdf')}
                    aria-pressed={downloadFormat === 'pdf'}
                  >
                    <span className={`${styles.reportGraphic} ${styles.reportFileGraphic} ${styles.pdfReportGraphic}`} aria-hidden="true">
                      <CsvIcon />
                      <span className={styles.reportFormatBadge}>PDF</span>
                    </span>
                    <span className={styles.reportTitleBlock}>
                      <strong>PDF report</strong>
                      <small>A clear report for clients, banks or insurers.</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.reportOption} ${downloadFormat === 'xlsx' ? styles.reportOptionActive : ''}`}
                    onClick={() => chooseDownloadFormat('xlsx')}
                    aria-pressed={downloadFormat === 'xlsx'}
                  >
                    <span className={`${styles.reportGraphic} ${styles.reportFileGraphic} ${styles.xlsxReportGraphic}`} aria-hidden="true">
                      <CsvIcon />
                      <span className={styles.reportFormatBadge}>XLSX</span>
                    </span>
                    <span className={styles.reportTitleBlock}>
                      <strong>XLSX workbook</strong>
                      <small>All report rows in an editable workbook.</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.reportOption} ${downloadFormat === 'csv' ? styles.reportOptionActive : ''}`}
                    onClick={() => chooseDownloadFormat('csv')}
                    aria-pressed={downloadFormat === 'csv'}
                  >
                    <span className={`${styles.reportGraphic} ${styles.reportFileGraphic} ${styles.csvReportGraphic}`} aria-hidden="true">
                      <CsvIcon />
                      <span className={styles.reportFormatBadge}>CSV</span>
                    </span>
                    <span className={styles.reportTitleBlock}>
                      <strong>Accounting CSV</strong>
                      <small>Mapped rows for accounting import.</small>
                    </span>
                  </button>
                </div>
                <div className={`${styles.modalFooter} ${styles.downloadModalFooter} ${styles.downloadFormatFooter}`}>
                  <button type="button" className={`${styles.secondaryButton} ${styles.downloadSecondaryButton}`} onClick={closeDownloadModal}>Cancel</button>
                  <button type="button" className={`${styles.primaryButton} ${styles.downloadNextButton}`} onClick={showNextStepAfterFormat}>
                    <span>Next</span>
                  </button>
                </div>
              </div>
            ) : downloadStep === 'accounting' ? (
              <div className={styles.downloadStageContent}>
                <div className={styles.accountingSoftwareGrid} aria-label="Accounting software">
                  {ACCOUNTING_SOFTWARE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.accountingSoftwareOption} ${selectedAccountingSoftware === option.value ? styles.accountingSoftwareOptionActive : ''}`}
                      onClick={() => {
                        setSelectedAccountingSoftware(option.value);
                        setAccountingExportIssues([]);
                        setAccountingExportError('');
                      }}
                      aria-pressed={selectedAccountingSoftware === option.value}
                    >
                      <span
                        className={`${styles.accountingSoftwareMark} ${option.value === 'sage_business_cloud' ? styles.sageAccountingMark : styles.genericAccountingMark}`}
                        aria-hidden="true"
                      >
                        {option.value === 'sage_business_cloud' ? <LedgerIcon /> : <CsvIcon />}
                      </span>
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                    </button>
                  ))}
                </div>

                <section className={styles.accountingSetupPanel} aria-label="Accounting CSV settings">
                  <div className={styles.accountingSetupHeader}>
                    <span className={styles.accountingSetupHeadingIcon} aria-hidden="true">
                      <SettingsIcon />
                    </span>
                    <div className={styles.accountingSetupCopy}>
                      <div className={styles.accountingSetupTitleRow}>
                        <h3>Accounting CSV settings</h3>
                        <span className={`${styles.accountingStatus} ${accountingSettings?.configured ? styles.accountingStatusReady : styles.accountingStatusRequired}`}>
                          {accountingSettings?.configured ? 'Ready' : 'Setup required'}
                        </span>
                      </div>
                      <p>Map suppliers, VAT and accounts before export.</p>
                    </div>
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${styles.accountingSettingsButton}`}
                      onClick={() => void openAccountingSettings()}
                      disabled={accountingSettingsLoading}
                    >
                      <SettingsIcon className={styles.buttonIcon} />
                      <span>{accountingSettings?.configured ? 'Edit settings' : 'Set up CSV'}</span>
                    </button>
                  </div>

                  {accountingSettingsLoading ? (
                    <p className={styles.accountingLoadingText}>Loading accounting settings...</p>
                  ) : accountingSettings?.configured ? (
                    <dl className={styles.accountingSetupSummary}>
                      <div><dt>Effect</dt><dd>{accountingSettings.defaultEffect}</dd></div>
                      <div><dt>Standard VAT</dt><dd>{accountingSettings.standardVatLabel}</dd></div>
                      <div><dt>Default account</dt><dd>{accountingSettings.defaultAffectingAccount}</dd></div>
                      <div><dt>Saved suppliers</dt><dd>{accountingSettings.suppliers.length}</dd></div>
                    </dl>
                  ) : (
                    <p className={styles.accountingRequiredText}>
                      Add a supplier and confirm the VAT and default account mappings.
                    </p>
                  )}
                </section>

                {accountingExportError ? (
                  <section className={styles.accountingIssuePanel} role="alert">
                    <strong>{accountingExportError}</strong>
                    {accountingExportIssues.length ? (
                      <>
                        <p>Fix the following rows before downloading. No values were guessed.</p>
                        <ul className={styles.accountingIssueList}>
                          {accountingExportIssues.slice(0, 12).map((issue, index) => (
                            <li key={`${issue.invoiceId}-${issue.field}-${index}`}>
                              <span>{issue.invoiceNumber || issue.assetTitle || 'Cost record'}</span>
                              <span>{issue.message}</span>
                            </li>
                          ))}
                        </ul>
                        {accountingExportIssues.length > 12 ? (
                          <p>And {accountingExportIssues.length - 12} more issue(s).</p>
                        ) : null}
                      </>
                    ) : null}
                  </section>
                ) : null}

                <div className={`${styles.modalFooter} ${styles.downloadModalFooter}`}>
                  <button type="button" className={`${styles.secondaryButton} ${styles.downloadSecondaryButton}`} onClick={showDownloadFormatStep}>Back</button>
                  <div className={styles.downloadFooterActions}>
                    <button type="button" className={`${styles.secondaryButton} ${styles.downloadSecondaryButton}`} onClick={closeDownloadModal}>Cancel</button>
                    <button
                      type="button"
                      className={`${styles.primaryButton} ${styles.downloadNextButton}`}
                      onClick={showDownloadTimelineStep}
                      disabled={accountingSettingsLoading || !accountingSettings?.configured}
                    >
                      <span>Next</span>
                    </button>
                  </div>
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
                  <button type="button" className={`${styles.secondaryButton} ${styles.downloadSecondaryButton}`} onClick={showPreviousStepBeforeTimeline}>Back</button>
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
                      onClick={() => void handleDownloadReport(downloadFormat)}
                      disabled={accountingExportDownloading}
                    >
                      <DownloadIcon className={styles.buttonIcon} />
                      <span>
                        {accountingExportDownloading
                          ? 'Preparing CSV...'
                          : downloadFormat === 'pdf'
                          ? 'Open PDF report'
                          : downloadFormat === 'xlsx'
                            ? 'Download Excel'
                            : `Download ${selectedAccountingSoftwareOption.label === 'Generic accounting CSV' ? 'accounting' : 'Sage'} CSV`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!dealerMode && accountingSettingsOpen ? (
        <div className={`${styles.modalBackdrop} ${styles.accountingSettingsBackdrop}`} role="dialog" aria-modal="true" aria-label="Accounting CSV settings">
          <form className={`${styles.formModal} ${styles.accountingSettingsModal}`} onSubmit={saveAccountingSettings}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Accounting CSV Settings</h2>
                <p>Set supplier, VAT and account mappings.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeAccountingSettings} aria-label="Close accounting settings"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />

            <div className={styles.accountingSettingsBody}>
              <section className={styles.accountingSettingsSection}>
                <div className={styles.accountingSettingsSectionHeading}>
                  <div className={styles.accountingSectionHeadingCopy}>
                    <span className={styles.accountingSectionIcon} aria-hidden="true"><SettingsIcon /></span>
                    <div>
                      <h3>Export profile</h3>
                      <p>Choose the CSV format and default effect.</p>
                    </div>
                  </div>
                </div>
                <div className={styles.accountingSettingsGrid}>
                  <label>
                    <span>Accounting software</span>
                    <select
                      value={accountingSettingsDraft.software}
                      onChange={(event) => setAccountingDraftField('software', event.target.value as AccountingSoftware)}
                    >
                      {ACCOUNTING_SOFTWARE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Default effect</span>
                    <select
                      value={accountingSettingsDraft.defaultEffect}
                      onChange={(event) => setAccountingDraftField('defaultEffect', event.target.value as AccountingEffect)}
                    >
                      <option value="Increase">Increase</option>
                      <option value="Decrease">Decrease</option>
                    </select>
                  </label>
                </div>
                <div className={styles.accountingLockedHeaders}>
                  <strong>Sage column outline</strong>
                  <p>Date · Effect · Supplier · Reference · Description · VAT % · Excl. VAT · VAT · Incl. VAT · by Affecting Acc.</p>
                  <small>The importer headers stay locked; the values below are configurable.</small>
                </div>
              </section>

              <section className={styles.accountingSettingsSection}>
                <div className={styles.accountingSettingsSectionHeading}>
                  <div className={styles.accountingSectionHeadingCopy}>
                    <span className={styles.accountingSectionIcon} aria-hidden="true"><VatIcon /></span>
                    <div>
                      <h3>VAT output values</h3>
                      <p>Set the exact VAT labels used by the importer.</p>
                    </div>
                  </div>
                </div>
                <div className={styles.accountingSettingsGrid}>
                  <label>
                    <span>Standard VAT label</span>
                    <input
                      value={accountingSettingsDraft.standardVatLabel}
                      onChange={(event) => setAccountingDraftField('standardVatLabel', event.target.value)}
                      placeholder="Standard Rate 15%"
                      required
                    />
                  </label>
                  <label>
                    <span>No VAT label</span>
                    <input
                      value={accountingSettingsDraft.noVatLabel}
                      onChange={(event) => setAccountingDraftField('noVatLabel', event.target.value)}
                      placeholder="No VAT"
                      required
                    />
                  </label>
                </div>
              </section>

              <section className={styles.accountingSettingsSection}>
                <div className={styles.accountingSettingsSectionHeading}>
                  <div className={styles.accountingSectionHeadingCopy}>
                    <span className={styles.accountingSectionIcon} aria-hidden="true"><LedgerIcon /></span>
                    <div>
                      <h3>Affecting accounts</h3>
                      <p>Add the financial-statement account names used in imports.</p>
                    </div>
                  </div>
                </div>
                <div className={styles.accountingAccountAddRow}>
                  <input
                    value={newAffectingAccount}
                    onChange={(event) => setNewAffectingAccount(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addAffectingAccount();
                      }
                    }}
                    placeholder="e.g. Repairs and maintenance – tractors"
                    aria-label="New affecting account"
                  />
                  <button type="button" className={styles.secondaryButton} onClick={addAffectingAccount}>Add account</button>
                </div>
                <div className={styles.accountingAccountChips}>
                  {accountingSettingsDraft.affectingAccounts.map((account) => (
                    <span key={account}>
                      {account}
                      <button type="button" onClick={() => removeAffectingAccount(account)} aria-label={`Remove ${account}`}>×</button>
                    </span>
                  ))}
                </div>
                <div className={styles.accountingSettingsGrid}>
                  <label>
                    <span>Default affecting account</span>
                    <select
                      value={accountingSettingsDraft.defaultAffectingAccount}
                      onChange={(event) => setAccountingDraftField('defaultAffectingAccount', event.target.value)}
                      required
                    >
                      <option value="">Choose an account</option>
                      {accountingSettingsDraft.affectingAccounts.map((account) => (
                        <option key={account} value={account}>{account}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Fuel affecting account (optional)</span>
                    <select
                      value={accountingSettingsDraft.fuelAffectingAccount}
                      onChange={(event) => setAccountingDraftField('fuelAffectingAccount', event.target.value)}
                    >
                      <option value="">Use default affecting account</option>
                      {accountingSettingsDraft.affectingAccounts.map((account) => (
                        <option key={account} value={account}>{account}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className={styles.accountingSettingsSection}>
                <div className={styles.accountingSettingsSectionHeading}>
                  <div className={styles.accountingSectionHeadingCopy}>
                    <span className={styles.accountingSectionIcon} aria-hidden="true"><SupplierIcon /></span>
                    <div>
                      <h3>Saved suppliers and aliases</h3>
                      <p>Aliases match dealer invoice variations to the saved supplier name.</p>
                    </div>
                  </div>
                  <button type="button" className={styles.secondaryButton} onClick={addAccountingSupplier}>Add supplier</button>
                </div>
                {accountingSettingsDraft.suppliers.length ? (
                  <div className={styles.accountingSupplierList}>
                    {accountingSettingsDraft.suppliers.map((supplier, index) => (
                      <article className={styles.accountingSupplierCard} key={supplier.id}>
                        <div className={styles.accountingSupplierCardHeader}>
                          <strong>Supplier {index + 1}</strong>
                          <button type="button" onClick={() => removeAccountingSupplier(supplier.id)}>Remove</button>
                        </div>
                        <div className={styles.accountingSupplierGrid}>
                          <label>
                            <span>Saved supplier name</span>
                            <input
                              value={supplier.name}
                              onChange={(event) => updateAccountingSupplier(supplier.id, { name: event.target.value })}
                              placeholder="Haddad"
                              required
                            />
                          </label>
                          <label>
                            <span>Aliases (one per line)</span>
                            <textarea
                              value={aliasesText(supplier.aliases)}
                              onChange={(event) => updateAccountingSupplier(supplier.id, { aliases: parseAliases(event.target.value) })}
                              placeholder={'Haddad Tractors\nHaddad (Pty) Ltd'}
                              rows={3}
                            />
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className={styles.accountingRequiredText}>Add at least one supplier before saving these settings.</p>
                )}
              </section>

              {accountingSettingsError ? <div className={styles.accountingSettingsError} role="alert">{accountingSettingsError}</div> : null}
            </div>

            <div className={`${styles.modalFooter} ${styles.accountingSettingsFooter}`}>
              <button type="button" className={styles.secondaryButton} onClick={closeAccountingSettings} disabled={accountingSettingsSaving}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={accountingSettingsSaving}>
                {accountingSettingsSaving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </form>
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
                <p>{selectedAsset?.title ?? 'Selected asset'} · Aim4price assisted capture</p>
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
                {isExtracting ? 'Sending invoice/photo...' : 'Send for capture'}
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
