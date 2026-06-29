'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type SVGProps } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type FlowMode = 'source-choice' | 'asset-manual' | 'asset-automatic' | 'manual-form' | 'upload' | 'review' | null;
type InvoiceSource = 'manual' | 'automatic';
type FilterSource = 'all' | InvoiceSource;
type UsageMetric = 'none' | 'hours' | 'km';
type NoticeTone = 'success' | 'error';

type AssetOption = {
  id: string;
  title: string;
  kind: string;
  categoryLabel: string;
  yearModel: number | null;
  usageReading: number | null;
  usageMetric: 'hours' | 'km';
  condition: string;
  value: number;
  selectedMethod: string;
  meta: string;
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
  assetUsageMetric: 'hours' | 'km';
  assetCondition: string;
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
  error?: string;
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
  assetId: string;
  source: FilterSource;
  year: string;
  month: string;
};

type FilterDropdownKey = 'asset' | 'source' | 'year' | 'month';

type FilterSelectOption = {
  value: string;
  label: string;
};

type Notice = {
  tone: NoticeTone;
  message: string;
};

type ReportFormat = 'pdf' | 'xlsx';

const DEFAULT_FILTERS: InvoiceFilterState = {
  assetId: 'all',
  source: 'all',
  year: 'all',
  month: 'all',
};

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
  onOpenChange: (key: FilterDropdownKey | null) => void;
  onChange: (value: string) => void;
};

function FilterDropdown({
  label,
  dropdownKey,
  value,
  options,
  openDropdown,
  disabled = false,
  onOpenChange,
  onChange,
}: FilterDropdownProps) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const isOpen = openDropdown === dropdownKey && !disabled;

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
            {options.map((option) => {
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
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function sourceLabel(source: InvoiceSource): string {
  return source === 'automatic' ? 'Automatic' : 'Manual';
}

function buildEmptyDraft(source: InvoiceSource): InvoiceDraft {
  return {
    supplierName: '',
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

function draftFromExtraction(extractionDraft: ExtractionDraft, source: InvoiceSource, documentId: string): InvoiceDraft {
  return {
    supplierName: extractionDraft.supplierName ?? '',
    invoiceNumber: extractionDraft.invoiceNumber ?? '',
    invoiceDate: extractionDraft.invoiceDate ?? '',
    subtotalExVat: formatMoneyWithCents(extractionDraft.subtotalExVat ?? null),
    vatAmount: formatMoneyWithCents(extractionDraft.vatAmount ?? null),
    totalIncVat: formatMoneyWithCents(extractionDraft.totalIncVat ?? null),
    usageReading: extractionDraft.usageReading === null || typeof extractionDraft.usageReading === 'undefined' ? '' : String(extractionDraft.usageReading),
    usageMetric: extractionDraft.usageMetric ?? 'none',
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
    subtotalExVat: formatMoneyWithCents(invoice.subtotalExVat),
    vatAmount: formatMoneyWithCents(invoice.vatAmount),
    totalIncVat: formatMoneyWithCents(invoice.totalIncVat),
    usageReading: invoice.usageReading === null || typeof invoice.usageReading === 'undefined' ? '' : String(invoice.usageReading),
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
  return `${asset.title} ${asset.categoryLabel} ${asset.meta} ${asset.value}`.toLowerCase();
}

function invoiceSearchText(invoice: InvoiceRecord): string {
  return [
    invoice.supplierName,
    invoice.invoiceNumber,
    invoice.assetTitle,
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

function buildInvoiceListUrl(filters: InvoiceFilterState): string {
  const params = new URLSearchParams();

  if (filters.assetId !== 'all') params.set('assetId', filters.assetId);
  if (filters.year !== 'all') params.set('year', filters.year);
  if (filters.month !== 'all') params.set('month', filters.month);

  const query = params.toString();
  return query ? `/api/my-invoices?${query}` : '/api/my-invoices';
}

function buildReportUrl(filters: InvoiceFilterState, format: ReportFormat): string {
  const params = new URLSearchParams({ format });

  if (filters.assetId !== 'all') params.set('assetId', filters.assetId);
  if (filters.year !== 'all') params.set('year', filters.year);
  if (filters.month !== 'all') params.set('month', filters.month);

  return `/api/my-invoices/report?${params.toString()}`;
}

export default function MyInvoicesClient() {
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<FilterDropdownKey | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [reportFormat, setReportFormat] = useState<ReportFormat>('pdf');
  const [draft, setDraft] = useState<InvoiceDraft>(buildEmptyDraft('manual'));
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [manualUploadFile, setManualUploadFile] = useState<File | null>(null);
  const [automaticUploadFile, setAutomaticUploadFile] = useState<File | null>(null);
  const [uploadedDocument, setUploadedDocument] = useState<InvoiceDocument | null>(null);
  const [rawTextPreview, setRawTextPreview] = useState('');
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);

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
  }, [activeFilters.assetId, activeFilters.year, activeFilters.month]);

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

  const yearOptions = useMemo(() => {
    const years = new Set(availableYears);
    for (const value of [activeFilters.year, draftFilters.year]) {
      const year = Number(value);
      if (Number.isInteger(year) && year >= 2000 && year <= 2100) years.add(year);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [activeFilters.year, availableYears, draftFilters.year]);

  const assetFilterOptions = useMemo<FilterSelectOption[]>(() => [
    { value: 'all', label: 'All saved assets' },
    ...assets.map((asset) => ({ value: asset.id, label: asset.title })),
  ], [assets]);

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
      activeFilters.assetId !== 'all',
      activeFilters.source !== 'all',
      activeFilters.year !== 'all',
      activeFilters.month !== 'all',
    ].filter(Boolean).length;
  }, [activeFilters]);

  const sourceChoiceOpen = flow === 'source-choice';
  const assetPickerOpen = flow === 'asset-manual' || flow === 'asset-automatic';
  const formOpen = flow === 'manual-form' || flow === 'review';
  const flowTitle = flow === 'asset-automatic' ? 'Choose asset for uploaded cost' : 'Choose asset for manual cost';
  const formTitle = flow === 'review' ? 'Review cost details' : 'Enter cost manually';
  const hasInvoiceSearch = invoiceSearch.trim().length > 0;
  const modalOpen = sourceChoiceOpen || assetPickerOpen || flow === 'upload' || formOpen || filterOpen || downloadOpen;

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
    if (!filterOpen || !openFilterDropdown) return undefined;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('[data-filter-dropdown="true"]')) setOpenFilterDropdown(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenFilterDropdown(null);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [filterOpen, openFilterDropdown]);

  async function fetchInvoiceData(filters: InvoiceFilterState): Promise<InvoicesResponse> {
    const response = await fetch(buildInvoiceListUrl(filters), { cache: 'no-store' });
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
    setDraft(buildEmptyDraft('manual'));
  }

  function openAddInvoiceModal() {
    setNotice(null);
    setSelectedAssetId('');
    setPickerSearch('');
    setEditingInvoiceId(null);
    setManualUploadFile(null);
    setAutomaticUploadFile(null);
    setUploadedDocument(null);
    setRawTextPreview('');
    setExtractionWarnings([]);
    setDraft(buildEmptyDraft('manual'));
    setFlow('source-choice');
  }

  function startFlow(source: InvoiceSource) {
    setNotice(null);
    setSelectedAssetId('');
    setPickerSearch('');
    setEditingInvoiceId(null);
    setManualUploadFile(null);
    setAutomaticUploadFile(null);
    setUploadedDocument(null);
    setRawTextPreview('');
    setExtractionWarnings([]);
    setDraft(buildEmptyDraft(source));
    setFlow(source === 'manual' ? 'asset-manual' : 'asset-automatic');
  }

  function selectAssetAndContinue(assetId: string) {
    setSelectedAssetId(assetId);
    setPickerSearch('');

    if (flow === 'asset-automatic') {
      setDraft(buildEmptyDraft('automatic'));
      setFlow('upload');
      return;
    }

    setDraft(buildEmptyDraft('manual'));
    setFlow('manual-form');
  }

  function openFilterPanel() {
    setDraftFilters(activeFilters);
    setOpenFilterDropdown(null);
    setFilterOpen(true);
  }

  function closeFilterPanel() {
    setDraftFilters(activeFilters);
    setOpenFilterDropdown(null);
    setFilterOpen(false);
  }

  function applyFilters() {
    setActiveFilters(draftFilters);
    setOpenFilterDropdown(null);
    setFilterOpen(false);
  }

  function clearFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setActiveFilters(DEFAULT_FILTERS);
    setOpenFilterDropdown(null);
    setFilterOpen(false);
  }

  function handleDownloadReport(format: ReportFormat) {
    const url = buildReportUrl(activeFilters, format);

    if (format === 'xlsx') {
      const link = document.createElement('a');
      link.href = url;
      link.download = '';
      link.rel = 'noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setDownloadOpen(false);
      return;
    }

    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = url;
    setDownloadOpen(false);
  }

  async function uploadInvoiceFile(assetId: string, source: InvoiceSource, file: File): Promise<InvoiceDocument> {
    const formData = new FormData();
    formData.append('assetId', assetId);
    formData.append('source', source);
    formData.append('file', file);

    const response = await fetch('/api/my-invoices/upload', {
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

      const response = await fetch('/api/my-invoices/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id, assetId: selectedAssetId }),
      });
      const data = (await response.json()) as ExtractionResponse;

      if (!response.ok || !data.ok || !data.extraction) {
        setDraft({ ...buildEmptyDraft('automatic'), invoiceDocumentId: document.id });
        setExtractionWarnings([data.error || 'Aim4price could not read this invoice/photo automatically. Complete the cost details manually.']);
        setRawTextPreview('');
        setFlow('review');
        return;
      }

      const nextDocument = data.document ?? document;
      setUploadedDocument(nextDocument);
      setDraft(draftFromExtraction(data.extraction.draft, 'automatic', nextDocument.id));
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

      const response = await fetch(editingInvoiceId ? `/api/my-invoices/${editingInvoiceId}` : '/api/my-invoices', {
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
      setNotice({ tone: 'success', message: `Cost record saved.${duplicateText}` });
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

  async function deleteInvoice(invoice: InvoiceRecord) {
    const costRecordLabel = invoice.invoiceNumber ? `cost record ${invoice.invoiceNumber}` : 'this cost record';
    const confirmed = window.confirm(`Delete ${costRecordLabel}? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingInvoiceId(invoice.id);
    setNotice(null);

    try {
      const response = await fetch(`/api/my-invoices/${invoice.id}`, { method: 'DELETE' });
      const data = (await response.json()) as InvoicesResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'The cost record could not be deleted.');
      }

      await reloadData();
      setNotice({ tone: 'success', message: 'Cost record deleted.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The cost record could not be deleted.' });
    } finally {
      setDeletingInvoiceId(null);
    }
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
    <main className={styles.page}>
      <AppHeader active="none" />
      <section className={styles.shell}>
        {notice ? <div className={`${styles.notice} ${styles[notice.tone === 'success' ? 'noticeSuccess' : 'noticeError']}`}>{notice.message}</div> : null}

        <section className={styles.pageTitleBlock}>
          <div>
            <h1>ASSET COST TRACKING SYSTEM</h1>
          </div>
        </section>

        <section className={styles.invoiceToolbar} aria-label="Saved cost record controls">
          <label className={styles.searchWrap}>
            <SearchIcon className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              value={invoiceSearch}
              onChange={(event) => setInvoiceSearch(event.target.value)}
              placeholder="Search suppliers, assets, invoice numbers or costs..."
              aria-label="Search saved cost records"
            />
            {hasInvoiceSearch ? (
              <button type="button" className={styles.clearSearchButton} onClick={() => setInvoiceSearch('')} aria-label="Clear saved cost record search">
                ×
              </button>
            ) : null}
          </label>

          <div className={styles.toolbarButtons}>
            <button type="button" className={`${styles.secondaryButton} ${styles.toolbarButton} ${styles.toolbarAddButton}`} onClick={openAddInvoiceModal}>
              <span className={styles.plusMark} aria-hidden="true">+</span>
              <span>Add Cost</span>
            </button>
            <button type="button" className={`${styles.secondaryButton} ${styles.toolbarButton} ${styles.toolbarFilterButton}`} onClick={openFilterPanel}>
              <FilterIcon className={styles.buttonIcon} />
              <span>Filter</span>
              {activeFilterCount ? <strong>{activeFilterCount}</strong> : null}
            </button>
            <button type="button" className={`${styles.primaryButton} ${styles.toolbarButton} ${styles.toolbarDownloadButton}`} onClick={() => setDownloadOpen(true)}>
              <DownloadIcon className={styles.buttonIcon} />
              <span>Download</span>
            </button>
          </div>
        </section>

        <section className={styles.invoicePanel} aria-label="Saved cost records">
          <div className={styles.savedListHeader}>
            <div>
              <h2>Saved cost records</h2>
              <p>{isLoading ? 'Loading saved cost records...' : `${visibleInvoices.length.toLocaleString('en-ZA')} shown from ${invoices.length.toLocaleString('en-ZA')} saved cost records.`}</p>
            </div>
          </div>

          <div className={styles.invoiceList}>
            {isLoading ? <div className={styles.emptyState}>Loading saved cost records...</div> : null}

            {!isLoading && !visibleInvoices.length ? (
              <div className={styles.emptyState}>No asset costs saved yet. Add a manual cost or upload an invoice/photo.</div>
            ) : null}

            {!isLoading ? visibleInvoices.map((invoice) => (
              <article className={styles.invoiceRow} key={invoice.id}>
                <div className={styles.invoiceMain}>
                  <div className={styles.invoiceTopLine}>
                    <span className={`${styles.sourceBadge} ${invoice.source === 'automatic' ? styles.sourceAutomatic : styles.sourceManual}`}>{sourceLabel(invoice.source)}</span>
                    <span>{formatDate(invoice.invoiceDate)}</span>
                  </div>
                  <h3>{invoice.supplierName || 'Unknown supplier'}</h3>
                  <p>{invoice.assetTitle || 'Saved asset'}</p>
                  <div className={styles.invoiceMetaList}>
                    <span>{invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : 'No invoice number'}</span>
                    {invoice.vatAmount !== null ? <span>VAT {formatMoney(invoice.vatAmount)}</span> : null}
                    {invoice.updatedAtIso ? <span>Updated {formatDateTime(invoice.updatedAtIso)}</span> : null}
                  </div>
                </div>

                <div className={styles.invoiceValue}>
                  <span>Total incl. VAT</span>
                  <strong>{formatMoney(invoice.totalIncVat)}</strong>
                  {invoice.usageMetric !== 'none' && invoice.usageReading !== null ? <small>{invoice.usageReading.toLocaleString('en-ZA')} {invoice.usageMetric}</small> : null}
                </div>

                <div className={styles.rowActions}>
                  {invoice.document?.uploadUrl ? (
                    <a className={styles.secondaryButtonSmall} href={invoice.document.uploadUrl} target="_blank" rel="noreferrer">
                      Open file
                    </a>
                  ) : null}
                  <button type="button" className={styles.secondaryButtonSmall} onClick={() => editInvoice(invoice)}>Edit</button>
                  <button
                    type="button"
                    className={styles.dangerButtonSmall}
                    onClick={() => void deleteInvoice(invoice)}
                    disabled={deletingInvoiceId === invoice.id}
                  >
                    {deletingInvoiceId === invoice.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </article>
            )) : null}
          </div>
        </section>
      </section>

      {sourceChoiceOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Choose cost capture method">
          <div className={`${styles.downloadModal} ${styles.sourceChoiceModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Add asset cost</h2>
                <p>Save an invoice, repair, parts or maintenance cost against a saved asset.</p>
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
              </div>
              <button type="button" className={styles.closeButton} onClick={closeFilterPanel} aria-label="Close filter"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.filterGrid}>
              <FilterDropdown
                label="Asset"
                dropdownKey="asset"
                value={draftFilters.assetId}
                options={assetFilterOptions}
                openDropdown={openFilterDropdown}
                onOpenChange={setOpenFilterDropdown}
                onChange={(value) => setDraftFilters((current) => ({ ...current, assetId: value }))}
              />
              <FilterDropdown
                label="Source"
                dropdownKey="source"
                value={draftFilters.source}
                options={SOURCE_FILTER_OPTIONS}
                openDropdown={openFilterDropdown}
                onOpenChange={setOpenFilterDropdown}
                onChange={(value) => setDraftFilters((current) => ({ ...current, source: value as FilterSource }))}
              />
              <FilterDropdown
                label="Year"
                dropdownKey="year"
                value={draftFilters.year}
                options={yearFilterOptions}
                openDropdown={openFilterDropdown}
                onOpenChange={setOpenFilterDropdown}
                onChange={(value) => setDraftFilters((current) => ({ ...current, year: value, month: value === 'all' ? 'all' : current.month }))}
              />
              <FilterDropdown
                label="Month"
                dropdownKey="month"
                value={draftFilters.month}
                options={monthFilterOptions}
                openDropdown={openFilterDropdown}
                onOpenChange={setOpenFilterDropdown}
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

      {downloadOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Export Cost of Ownership report">
          <div className={`${styles.downloadModal} ${styles.reportModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Export Cost of Ownership report</h2>
                <p>Download the Cost of Ownership report using the active asset, year and month filters.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => setDownloadOpen(false)} aria-label="Close download"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.reportChoiceGrid}>
              <button
                type="button"
                className={`${styles.reportOption} ${reportFormat === 'pdf' ? styles.reportOptionActive : ''}`}
                onClick={() => setReportFormat('pdf')}
                aria-pressed={reportFormat === 'pdf'}
              >
                <span className={styles.reportGraphic}>
                  <img className={styles.reportGraphicImage} src="/brand/pdf.png" alt="" />
                </span>
                <span className={styles.reportTitleBlock}>
                  <strong>PDF report</strong>
                  <small>Open the printable Cost of Ownership report for the current filters.</small>
                </span>
              </button>
              <button
                type="button"
                className={`${styles.reportOption} ${reportFormat === 'xlsx' ? styles.reportOptionActive : ''}`}
                onClick={() => setReportFormat('xlsx')}
                aria-pressed={reportFormat === 'xlsx'}
              >
                <span className={styles.reportGraphic}>
                  <img className={styles.reportGraphicImage} src="/brand/sheet.png" alt="" />
                </span>
                <span className={styles.reportTitleBlock}>
                  <strong>XLSX workbook</strong>
                  <small>Download the filtered cost record data as an Excel-ready workbook.</small>
                </span>
              </button>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => setDownloadOpen(false)}>Cancel</button>
              <button type="button" className={styles.primaryButton} onClick={() => handleDownloadReport(reportFormat)}>
                <DownloadIcon className={styles.buttonIcon} />
                <span>{reportFormat === 'pdf' ? 'Open PDF report' : 'Download XLSX'}</span>
              </button>
            </div>
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
                    <strong>{asset.title}</strong>
                    <small>{asset.meta}</small>
                    <small>{asset.categoryLabel} · {asset.selectedMethod === 'manual' ? 'Manual' : 'Aim4price'}</small>
                  </span>
                  <span className={styles.assetValue}>
                    <strong>{formatMoney(asset.value)}</strong>
                    <small>current value</small>
                  </span>
                </button>
              )) : <div className={styles.emptyState}>No matching assets found.</div>}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {flow === 'upload' ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Upload invoice/photo">
          <div className={styles.formModal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Upload invoice/photo</h2>
                <p>{selectedAsset?.title ?? 'Selected asset'} · Automatic</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.formModalScrollBody}>
              <section className={styles.uploadPanel}>
                <h3>Documents and photos</h3>
                <div className={styles.uploadBox}>
                  <label className={styles.uploadButton}>
                    <UploadIcon />
                    Add invoice/photo
                    <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleAutomaticFileChange} />
                  </label>
                  <span className={styles.uploadCounter}>{automaticUploadFile ? '1 / 1' : '0 / 1'}</span>
                  {automaticUploadFile ? <p>{automaticUploadFile.name}</p> : null}
                </div>
                <p className={styles.helperText}>Digital PDFs are read with free text extraction. Images and scanned PDFs remain editable if extraction is weak.</p>
              </section>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => setFlow('asset-automatic')}>Back</button>
              <button type="button" className={styles.primaryButton} onClick={handleAutomaticExtract} disabled={!automaticUploadFile || isExtracting}>
                {isExtracting ? 'Reading invoice/photo...' : 'Review cost details'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label={formTitle}>
          <form className={styles.formModal} onSubmit={submitInvoiceDraft}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{formTitle}</h2>
                <p>{selectedAsset?.title ?? 'Selected asset'} · {draft.source === 'automatic' ? 'Automatic' : 'Manual'}</p>
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
                  <label>
                    <span>Usage metric</span>
                    <select value={draft.usageMetric} onChange={(event) => setDraftField('usageMetric', event.target.value as UsageMetric)}>
                      <option value="none">None</option>
                      <option value="hours">Hours</option>
                      <option value="km">KM</option>
                    </select>
                  </label>
                  <label>
                    <span>Usage reading</span>
                    <input inputMode="decimal" value={draft.usageReading} disabled={draft.usageMetric === 'none'} onChange={(event) => setDraftField('usageReading', event.target.value)} />
                  </label>
                  <label>
                    <span>Subtotal Excl. VAT</span>
                    <input inputMode="decimal" value={draft.subtotalExVat} onChange={(event) => setDraftField('subtotalExVat', event.target.value)} />
                  </label>
                  <label>
                    <span>VAT amount</span>
                    <input inputMode="decimal" value={draft.vatAmount} onChange={(event) => setDraftField('vatAmount', event.target.value)} />
                  </label>
                  <label>
                    <span>Total Incl. VAT</span>
                    <input inputMode="decimal" value={draft.totalIncVat} onChange={(event) => setDraftField('totalIncVat', event.target.value)} />
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
                  <section className={styles.uploadInline}>
                    <span>Optional document/photo upload</span>
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
                else if (flow === 'manual-form') setFlow('asset-manual');
                else if (flow === 'review') setFlow('upload');
                else closeModal();
              }}>Back</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save cost record'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
