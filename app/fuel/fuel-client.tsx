'use client';

import { useEffect, useMemo, useState, type FormEvent, type SVGProps } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type FuelStorageStatus = 'active' | 'archived';
type ModalMode = 'create-storage' | 'edit-storage' | 'pin' | 'filter' | 'report' | null;
type FilterMode = 'all' | 'low' | 'empty' | 'full';

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
  return storage.reorderLevelLitres !== null && storage.currentLitres <= storage.reorderLevelLitres;
}

function getProgressPercent(storage: FuelLedgerStorage): number {
  const rawPercent = storage.stockPercent ?? (storage.currentLitres > 0 ? 100 : 0);
  return Math.max(0, Math.min(100, rawPercent));
}

function matchesFilter(storage: FuelLedgerStorage, filterMode: FilterMode, searchTerm: string): boolean {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const searchableText = [storage.name, storage.fuelType, storage.locationLabel, storage.publicFuelStorageCode].join(' ').toLowerCase();

  if (normalizedSearch && !searchableText.includes(normalizedSearch)) {
    return false;
  }

  if (filterMode === 'low') return isLowStorage(storage);
  if (filterMode === 'empty') return storage.currentLitres <= 0;
  if (filterMode === 'full') return storage.stockPercent !== null && storage.stockPercent >= 95;

  return true;
}

function eventDateParts(event: FuelLedgerEvent): { year: string; month: string } | null {
  const date = new Date(event.createdAtIso);
  if (Number.isNaN(date.getTime())) return null;

  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1).padStart(2, '0'),
  };
}

function matchesPeriod(event: FuelLedgerEvent, year: string, month: string): boolean {
  const parts = eventDateParts(event);
  if (!parts) return false;
  if (year !== 'all' && parts.year !== year) return false;
  if (month !== 'all' && parts.month !== month) return false;
  return true;
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

function periodLabel(year: string, month: string): string {
  if (year === 'all') return '30 days';
  if (month !== 'all') return `${MONTH_LABELS[Number(month) - 1] ?? 'Month'} ${year}`;
  return year;
}

function buildReportUrl(storageId: string, year: string, month: string): string {
  const url = new URL('/api/fuel/report', window.location.origin);

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
  const [summary, setSummary] = useState<FuelLedgerSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [deleteCandidateStorage, setDeleteCandidateStorage] = useState<FuelLedgerStorage | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [storageDraft, setStorageDraft] = useState<StorageDraft>(emptyStorageDraft);
  const [pinDraft, setPinDraft] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [filterText, setFilterText] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [reportStorageId, setReportStorageId] = useState('all');
  const [reportYear, setReportYear] = useState('all');
  const [reportMonth, setReportMonth] = useState('all');

  const selectedStorage = useMemo(
    () => storages.find((storage) => storage.id === selectedStorageId) ?? null,
    [selectedStorageId, storages],
  );

  const visibleStorages = useMemo(
    () => storages.filter((storage) => matchesFilter(storage, filterMode, filterText)),
    [filterMode, filterText, storages],
  );

  const yearOptions = useMemo(() => getYearOptions(recentEvents), [recentEvents]);
  const filterMonthOptions = useMemo(() => getMonthOptions(recentEvents, filterYear), [filterYear, recentEvents]);
  const reportMonthOptions = useMemo(() => getMonthOptions(recentEvents, reportYear), [recentEvents, reportYear]);

  const periodEvents = useMemo(
    () => recentEvents.filter((event) => matchesPeriod(event, filterYear, filterMonth)),
    [filterMonth, filterYear, recentEvents],
  );

  const periodIssuedLitres = useMemo(
    () => periodEvents.filter((event) => event.eventType === 'asset_issue').reduce((sum, event) => sum + Number(event.litres || 0), 0),
    [periodEvents],
  );

  const issuedLitres = filterYear === 'all' && filterMonth === 'all' ? summary?.issuedLitres30Days ?? 0 : periodIssuedLitres;
  const issuedPeriodLabel = periodLabel(filterYear, filterMonth);

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
      setSummary(data.summary ?? null);
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

  function openCreateStorage() {
    setSelectedStorageId(null);
    setStorageDraft(emptyStorageDraft);
    setNotice(null);
    setModalMode('create-storage');
  }

  function openEditStorage(storage: FuelLedgerStorage) {
    setSelectedStorageId(storage.id);
    setStorageDraft(buildStorageDraft(storage));
    setNotice(null);
    setModalMode('edit-storage');
  }

  function openPin(storage: FuelLedgerStorage) {
    setSelectedStorageId(storage.id);
    setPinDraft('');
    setNotice(null);
    setModalMode('pin');
  }

  function openFilterModal() {
    setNotice(null);
    setModalMode('filter');
  }

  function openReportModal() {
    setReportYear(filterYear);
    setReportMonth(filterYear === 'all' ? 'all' : filterMonth);
    setReportStorageId('all');
    setNotice(null);
    setModalMode('report');
  }

  function closeModal() {
    if (isSaving) return;
    setModalMode(null);
    setSelectedStorageId(null);
    setStorageDraft(emptyStorageDraft);
    setPinDraft('');
  }

  function clearFilters() {
    setFilterMode('all');
    setFilterText('');
    setFilterYear('all');
    setFilterMonth('all');
  }

  async function applyLedgerResponse(response: Response) {
    const data = (await response.json()) as FuelLedgerResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Fuel Ledger action failed.');
    }

    if (data.storages) setStorages(data.storages);
    if (data.recentEvents) setRecentEvents(data.recentEvents);
    if (data.summary) setSummary(data.summary);
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
    window.open(buildReportUrl(reportStorageId, reportYear, normalizedMonth), '_blank', 'noopener,noreferrer');
    closeModal();
  }

  const hasActiveFilters = filterMode !== 'all' || filterText.trim().length > 0 || filterYear !== 'all' || filterMonth !== 'all';

  return (
    <>
      <AppHeader active="none" />
      <main className={styles.pageShell}>
        <section className={styles.ledgerPanel}>
          <div className={styles.panelHeader}>
            <div className={styles.pageTitleBlock}>
              <h1>Aim4price Fuel Tracking System</h1>
            </div>

            <div className={styles.topActions}>
              <button type="button" className={styles.secondaryButton} onClick={openFilterModal}>
                Filter{hasActiveFilters ? ' active' : ''}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={openReportModal}>
                Fuel Report
              </button>
              <button type="button" className={styles.primaryButton} onClick={openCreateStorage}>
                + Add Storage Tank
              </button>
            </div>
          </div>

          {notice ? <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : styles.noticeSuccess}`}>{notice.message}</div> : null}

          <section className={styles.summaryGrid} aria-label="Fuel Ledger summary">
            <article className={styles.summaryCard}>
              <span>Total storage</span>
              <strong>{summary?.totalStorageUnits ?? 0}</strong>
              <small>{summary?.lowStorageCount ?? 0} low storage</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Fuel issued · {issuedPeriodLabel}</span>
              <strong>{formatLitres(issuedLitres)}</strong>
              <small>QR fuel entries</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Total Stock</span>
              <strong>{formatLitres(summary?.currentLitres ?? 0)}</strong>
              <small>{formatPercent(summary?.currentStockPercent ?? null)} of known capacity</small>
            </article>
          </section>

          {isLoading ? <div className={styles.emptyState}>Loading Fuel Ledger...</div> : null}

          {!isLoading && !storages.length ? (
            <div className={styles.emptyState}>
              <strong>No fuel storage yet.</strong>
              <span>Add your first tank, bowser or storage unit.</span>
              <button type="button" className={styles.primaryButton} onClick={openCreateStorage}>
                + Add Storage Tank
              </button>
            </div>
          ) : null}

          {!isLoading && storages.length > 0 && visibleStorages.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>No storage matches the filter.</strong>
              <button type="button" className={styles.secondaryButton} onClick={clearFilters}>
                Clear Filter
              </button>
            </div>
          ) : null}

          <div className={styles.storageList}>
            {visibleStorages.map((storage) => {
              const progress = getProgressPercent(storage);
              const storageIsLow = isLowStorage(storage);

              return (
                <article key={storage.id} className={`${styles.storageCard} ${storageIsLow ? styles.storageCardLow : ''}`}>
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

                  <div className={styles.unitActions}>
                    <button type="button" className={styles.unitButton} onClick={() => openEditStorage(storage)} disabled={isSaving}>
                      <GearIcon className={styles.buttonIcon} />
                      <span>Manage</span>
                    </button>
                    <a className={styles.unitButton} href={`/api/fuel/storage/${storage.id}/qr?format=print`} target="_blank" rel="noreferrer">
                      <QrIcon className={styles.buttonIcon} />
                      <span>QR Code</span>
                    </a>
                    <button type="button" className={styles.unitButton} onClick={() => openPin(storage)} disabled={isSaving}>
                      <LockIcon className={styles.buttonIcon} />
                      <span>Change PIN</span>
                    </button>
                    <button type="button" className={`${styles.unitButton} ${styles.deleteUnitButton}`} onClick={() => setDeleteCandidateStorage(storage)} disabled={isSaving}>
                      <TrashIcon className={styles.buttonIcon} />
                      <span>Delete Unit</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      {modalMode === 'create-storage' || modalMode === 'edit-storage' ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <form className={styles.modalCard} onSubmit={handleStorageSubmit}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>{modalMode === 'create-storage' ? 'Add Storage Tank' : 'Manage Storage Tank'}</span>
                <h2>{modalMode === 'create-storage' ? 'Add Fuel Storage' : selectedStorage?.name ?? 'Manage Fuel Storage'}</h2>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal}>×</button>
            </div>

            <div className={styles.formGrid}>
              <label>
                Storage name
                <input value={storageDraft.name} onChange={(event) => setStorageDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Main diesel tank" required />
              </label>
              <label>
                Fuel type
                <select value={storageDraft.fuelType} onChange={(event) => setStorageDraft((current) => ({ ...current, fuelType: event.target.value }))}>
                  <option value="diesel">Diesel</option>
                  <option value="petrol">Petrol</option>
                  <option value="adblue">AdBlue</option>
                  <option value="paraffin">Paraffin</option>
                </select>
              </label>
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
              <label>
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

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal} disabled={isSaving}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Storage'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {modalMode === 'pin' && selectedStorage ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <form className={styles.modalCardSmall} onSubmit={handlePinSubmit}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>Change PIN</span>
                <h2>{selectedStorage.name}</h2>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal}>×</button>
            </div>
            <label className={styles.pinField}>
              New PIN
              <input value={pinDraft} onChange={(event) => setPinDraft(event.target.value)} inputMode="numeric" placeholder="4 to 8 digits" required />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal} disabled={isSaving}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save PIN'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {modalMode === 'filter' ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCardSmall}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>Filter</span>
                <h2>Filter fuel view</h2>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal}>×</button>
            </div>

            <div className={styles.formGridSingle}>
              <label>
                Storage search
                <input value={filterText} onChange={(event) => setFilterText(event.target.value)} placeholder="Main tank, diesel, Farm 1..." />
              </label>
              <label>
                Stock status
                <select value={filterMode} onChange={(event) => setFilterMode(event.target.value as FilterMode)}>
                  <option value="all">All storage</option>
                  <option value="low">Low storage</option>
                  <option value="empty">Empty storage</option>
                  <option value="full">Full storage</option>
                </select>
              </label>
              <label>
                Year available
                <select
                  value={filterYear}
                  onChange={(event) => {
                    setFilterYear(event.target.value);
                    setFilterMonth('all');
                  }}
                >
                  <option value="all">All years</option>
                  {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label>
                Month available
                <select value={filterMonth} onChange={(event) => setFilterMonth(event.target.value)} disabled={filterYear === 'all'}>
                  <option value="all">All months</option>
                  {filterMonthOptions.map((month) => (
                    <option key={month} value={month}>{MONTH_LABELS[Number(month) - 1]}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={clearFilters}>Clear filters</button>
              <button type="button" className={styles.primaryButton} onClick={closeModal}>Apply filters</button>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode === 'report' ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCardSmall}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>Fuel Report</span>
                <h2>Choose report filters</h2>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal}>×</button>
            </div>

            <div className={styles.formGridSingle}>
              <label>
                Storage unit
                <select value={reportStorageId} onChange={(event) => setReportStorageId(event.target.value)}>
                  <option value="all">All storage units</option>
                  {storages.map((storage) => <option key={storage.id} value={storage.id}>{storage.name}</option>)}
                </select>
              </label>
              <label>
                Year available
                <select
                  value={reportYear}
                  onChange={(event) => {
                    setReportYear(event.target.value);
                    setReportMonth('all');
                  }}
                >
                  <option value="all">All years</option>
                  {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label>
                Month available
                <select value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} disabled={reportYear === 'all'}>
                  <option value="all">All months</option>
                  {reportMonthOptions.map((month) => (
                    <option key={month} value={month}>{MONTH_LABELS[Number(month) - 1]}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal}>Cancel</button>
              <button type="button" className={styles.primaryButton} onClick={handleOpenReport}>Open Fuel Report</button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteCandidateStorage ? (
        <div className={`${styles.modalOverlay} ${styles.confirmDeleteOverlay}`} role="alertdialog" aria-modal="true" aria-labelledby="delete-fuel-title" aria-describedby="delete-fuel-copy">
          <div className={styles.deleteConfirmModal}>
            <div className={styles.deleteConfirmIcon}>
              <TrashIcon className={styles.buttonIcon} />
            </div>

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
                  <TrashIcon className={styles.buttonIcon} />
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
