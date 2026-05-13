'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type FuelStorageStatus = 'active' | 'archived';
type ModalMode = 'create-storage' | 'edit-storage' | 'pin' | null;
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
  recentEvents?: unknown[];
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

export default function FuelClient() {
  const [storages, setStorages] = useState<FuelLedgerStorage[]>([]);
  const [summary, setSummary] = useState<FuelLedgerSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [storageDraft, setStorageDraft] = useState<StorageDraft>(emptyStorageDraft);
  const [pinDraft, setPinDraft] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [filterText, setFilterText] = useState('');

  const selectedStorage = useMemo(
    () => storages.find((storage) => storage.id === selectedStorageId) ?? null,
    [selectedStorageId, storages],
  );

  const visibleStorages = useMemo(
    () => storages.filter((storage) => matchesFilter(storage, filterMode, filterText)),
    [filterMode, filterText, storages],
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

  function closeModal() {
    if (isSaving) return;
    setModalMode(null);
    setSelectedStorageId(null);
    setStorageDraft(emptyStorageDraft);
    setPinDraft('');
  }

  async function applyLedgerResponse(response: Response) {
    const data = (await response.json()) as FuelLedgerResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Fuel Ledger action failed.');
    }

    if (data.storages) setStorages(data.storages);
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

  async function handleDeleteStorage(storage: FuelLedgerStorage) {
    const shouldDelete = window.confirm(`Delete ${storage.name}? Its QR code will stop accepting fuel entries, but old fuel history stays in reports.`);
    if (!shouldDelete) return;

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/fuel/storage/${storage.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      await applyLedgerResponse(response);
      setNotice({ tone: 'success', message: 'Fuel storage deleted.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to delete storage.' });
    } finally {
      setIsSaving(false);
    }
  }

  const hasActiveFilters = filterMode !== 'all' || filterText.trim().length > 0;

  return (
    <>
      <AppHeader active="none" />
      <main className={styles.pageShell}>
        <section className={styles.ledgerPanel}>
          <div className={styles.topActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setIsFilterOpen((current) => !current)}>
              Filter{hasActiveFilters ? ' active' : ''}
            </button>
            <a href="/api/fuel/report" target="_blank" rel="noreferrer" className={styles.secondaryButton}>
              Fuel Report
            </a>
            <button type="button" className={styles.primaryButton} onClick={openCreateStorage}>
              Add Storage
            </button>
          </div>

          {notice ? <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : styles.noticeSuccess}`}>{notice.message}</div> : null}

          <section className={styles.summaryGrid} aria-label="Fuel Ledger summary">
            <article className={styles.summaryCard}>
              <span>Total storage</span>
              <strong>{summary?.totalStorageUnits ?? 0}</strong>
              <small>{summary?.lowStorageCount ?? 0} low storage</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Fuel issued · 30 days</span>
              <strong>{formatLitres(summary?.issuedLitres30Days ?? 0)}</strong>
              <small>QR fuel entries</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Total Stock</span>
              <strong>{formatLitres(summary?.currentLitres ?? 0)}</strong>
              <small>{formatPercent(summary?.currentStockPercent ?? null)} of known capacity</small>
            </article>
          </section>

          {isFilterOpen ? (
            <div className={styles.filterPanel}>
              <div className={styles.searchWrap}>
                <span className={styles.searchIcon} aria-hidden="true">⌕</span>
                <input
                  className={styles.searchInput}
                  value={filterText}
                  onChange={(event) => setFilterText(event.target.value)}
                  placeholder="Search by tank, bowser, fuel type or location"
                />
                {filterText ? (
                  <button type="button" className={styles.clearSearchButton} onClick={() => setFilterText('')} aria-label="Clear search">
                    ×
                  </button>
                ) : null}
              </div>
              <div className={styles.filterSegments}>
                <button type="button" className={filterMode === 'all' ? styles.filterActive : ''} onClick={() => setFilterMode('all')}>All</button>
                <button type="button" className={filterMode === 'low' ? styles.filterActive : ''} onClick={() => setFilterMode('low')}>Low</button>
                <button type="button" className={filterMode === 'empty' ? styles.filterActive : ''} onClick={() => setFilterMode('empty')}>Empty</button>
                <button type="button" className={filterMode === 'full' ? styles.filterActive : ''} onClick={() => setFilterMode('full')}>Full</button>
              </div>
            </div>
          ) : null}

          {isLoading ? <div className={styles.emptyState}>Loading Fuel Ledger...</div> : null}

          {!isLoading && !storages.length ? (
            <div className={styles.emptyState}>
              <strong>No fuel storage yet.</strong>
              <span>Add your first tank, bowser or storage unit.</span>
              <button type="button" className={styles.primaryButton} onClick={openCreateStorage}>
                Add Storage
              </button>
            </div>
          ) : null}

          {!isLoading && storages.length > 0 && visibleStorages.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>No storage matches the filter.</strong>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setFilterMode('all');
                  setFilterText('');
                }}
              >
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
                      <span className={styles.storageType}>{formatFuelType(storage.fuelType)}</span>
                      <h2>{storage.name}</h2>
                      <div className={styles.storageDetails}>
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
                        <span>{formatPercent(storage.stockPercent)}</span>
                        <span>{storageIsLow ? 'Low stock' : storage.reorderLevelLitres === null ? 'No reorder level' : `Low at ${formatLitres(storage.reorderLevelLitres)}`}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.unitActions}>
                    <button type="button" className={styles.unitButton} onClick={() => openEditStorage(storage)} disabled={isSaving}>
                      Manage
                    </button>
                    <a className={styles.unitButton} href={`/api/fuel/storage/${storage.id}/qr?format=print`} target="_blank" rel="noreferrer">
                      QR Code
                    </a>
                    <button type="button" className={styles.unitButton} onClick={() => openPin(storage)} disabled={isSaving}>
                      Change PIN
                    </button>
                    <button type="button" className={`${styles.unitButton} ${styles.deleteUnitButton}`} onClick={() => void handleDeleteStorage(storage)} disabled={isSaving}>
                      Delete Unit
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
                <span className={styles.modalEyebrow}>{modalMode === 'create-storage' ? 'Add Storage' : 'Manage Storage'}</span>
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
                <textarea value={storageDraft.notes} onChange={(event) => setStorageDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional storage notes" rows={3} />
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
    </>
  );
}
