'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode, type SVGProps } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type FuelStorageStatus = 'active' | 'archived';
type ModalMode = 'create-storage' | 'edit-storage' | 'pin' | 'report' | null;
type ReportFormat = 'pdf' | 'xlsx';
type ReportStep = 'format' | 'filters';
type ReportSelectKey = 'storage' | 'year' | 'month';

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
  litres: number;
  createdAtIso: string;
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
  assets?: unknown[];
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

type Notice = {
  tone: 'success' | 'error';
  message: string;
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

function eventDateParts(event: FuelLedgerEvent): { year: string; month: string } | null {
  const date = new Date(event.createdAtIso);
  if (Number.isNaN(date.getTime())) return null;

  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1).padStart(2, '0'),
  };
}


function getMonthOptions(events: FuelLedgerEvent[], year: string): string[] {
  const months = new Set<string>();

  for (const event of events) {
    const parts = eventDateParts(event);
    if (!parts) continue;
    if (year !== 'all' && parts.year !== year) continue;
    months.add(parts.month);
  }

  return Array.from(months).sort((a, b) => Number(a) - Number(b));
}

function getYearOptions(events: FuelLedgerEvent[]): string[] {
  const years = new Set<string>();

  for (const event of events) {
    const parts = eventDateParts(event);
    if (parts) years.add(parts.year);
  }

  if (!years.size) {
    years.add(String(new Date().getFullYear()));
  }

  return Array.from(years).sort((a, b) => Number(b) - Number(a));
}


function buildReportUrl(storageId: string, year: string, month: string, format: ReportFormat = 'pdf'): string {
  const url = new URL('/api/fuel/report', window.location.origin);
  url.searchParams.set('format', format);

  if (storageId !== 'all') {
    url.searchParams.set('storageId', storageId);
  }

  if (year !== 'all') {
    url.searchParams.set('year', year);
  }

  if (year !== 'all' && month !== 'all') {
    url.searchParams.set('month', month);
  }

  return url.toString();
}

export default function FuelClient() {
  const [storages, setStorages] = useState<FuelLedgerStorage[]>([]);
  const [recentEvents, setRecentEvents] = useState<FuelLedgerEvent[]>([]);
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
  const [reportStorageId, setReportStorageId] = useState('all');
  const [reportYear, setReportYear] = useState('all');
  const [reportMonth, setReportMonth] = useState('all');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('pdf');
  const [reportStep, setReportStep] = useState<ReportStep>('format');
  const [openReportSelect, setOpenReportSelect] = useState<ReportSelectKey | null>(null);
  const [isStorageFuelSelectOpen, setIsStorageFuelSelectOpen] = useState(false);

  const selectedStorage = useMemo(
    () => storages.find((storage) => storage.id === selectedStorageId) ?? null,
    [selectedStorageId, storages],
  );

  const visibleStorages = useMemo(
    () => storages.filter((storage) => matchesSearch(storage, searchText)),
    [searchText, storages],
  );

  const yearOptions = useMemo(() => getYearOptions(recentEvents), [recentEvents]);
  const reportMonthOptions = useMemo(() => getMonthOptions(recentEvents, reportYear), [recentEvents, reportYear]);
  const reportStorageOptions = useMemo<ReportSelectOption[]>(
    () => [
      { value: 'all', label: 'All storage units' },
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

  function openReportModal() {
    setReportYear('all');
    setReportMonth('all');
    setReportStorageId('all');
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

  return (
    <>
      <main className={styles.page}>
        <AppHeader active="none" />

        <section className={styles.shell}>
          {notice ? <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : styles.noticeSuccess}`}>{notice.message}</div> : null}

          <section className={styles.ledgerPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.pageTitleBlock}>
                <h1>QR FUEL TRACKING SYSTEM</h1>
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
                      <div className={styles.storageTitleBlock}>
                        <h2>{storage.name}</h2>
                        <div className={styles.storageDetails}>
                          <span>{formatFuelType(storage.fuelType)}</span>
                          <span>{formatLitres(storage.currentLitres)} available</span>
                          <span>{storage.capacityLitres === null ? 'Capacity not set' : `${formatLitres(storage.capacityLitres)} capacity`}</span>
                          <span>{storage.locationLabel || storage.publicFuelStorageCode}</span>
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
                      <div className={styles.storageValueBlock}>
                        <strong>{formatLitres(storage.currentLitres)}</strong>
                        <span>{formatPercent(storage.stockPercent)} full</span>
                      </div>

                      <div className={styles.unitActions}>
                        <button type="button" className={styles.unitButton} onClick={() => openEditStorage(storage)} disabled={isSaving}>
                          <GearIcon className={styles.buttonIcon} />
                          <span>Manage</span>
                        </button>
                        <a className={styles.unitButton} href={`/api/fuel/storage/${storage.id}/qr?format=print`} target="_blank" rel="noreferrer">
                          <QrIcon className={styles.buttonIcon} />
                          <span>QR Code</span>
                        </a>
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
                              <span>{formatLitres(storage.currentLitres)} remaining. Reorder level is {formatLitres(storage.reorderLevelLitres)}.</span>
                            </div>
                          </div>
                        ) : null}

                        {dipstickNoteText ? (
                          <div className={styles.storageWarningNote}>
                            <div>
                              <strong>Dipstick note</strong>
                              <span>Dipstick note: {dipstickNoteText}</span>
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
          <button type="button" className={styles.mobileQuickButton} onClick={openReportModal}>
            <DownloadIcon className={styles.buttonIcon} />
            <span>Reports</span>
          </button>
        </nav>
      </main>

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
                        label="Storage unit"
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
