'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type FuelStorageStatus = 'active' | 'archived';
type FuelStorageEventType = 'opening_balance' | 'stock_in' | 'asset_issue' | 'dip' | 'adjustment';
type ModalMode = 'create-storage' | 'edit-storage' | 'stock' | 'pin' | null;

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
  storagePublicCode: string;
  eventType: FuelStorageEventType;
  assetId: string;
  assetTitle: string;
  assetPlateLabel: string;
  litres: number;
  storageLevelBefore: number | null;
  storageLevelAfter: number | null;
  assetFuelPercentBefore: number | null;
  assetFuelPercentAfter: number | null;
  assetUsageReading: number | null;
  operatorName: string;
  note: string;
  latitude: number | null;
  longitude: number | null;
  locationText: string;
  createdAtIso: string;
};

type FuelLedgerAsset = {
  id: string;
  title: string;
  kind: string;
  assetTypeLabel: string;
  brandName: string;
  modelName: string;
  plateLabel: string;
  publicAssetCode: string;
  hours: number | null;
  fuelPercent: number | null;
  canReceiveFuel: boolean;
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

type StockDraft = {
  mode: 'stock_in' | 'dip';
  litres: string;
  currentLitres: string;
  operatorName: string;
  note: string;
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

const emptyStockDraft: StockDraft = {
  mode: 'stock_in',
  litres: '',
  currentLitres: '',
  operatorName: '',
  note: '',
};

function formatLitres(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} L`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}%`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function eventTypeLabel(value: FuelStorageEventType): string {
  if (value === 'opening_balance') return 'Opening balance';
  if (value === 'stock_in') return 'Stock in';
  if (value === 'asset_issue') return 'Asset issue';
  if (value === 'dip') return 'Manual dip';
  return 'Adjustment';
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

function getStorageTone(storage: FuelLedgerStorage): string {
  if (storage.status === 'archived') return styles.storageCardArchived;
  if (isLowStorage(storage)) return styles.storageCardLow;
  return '';
}

export default function FuelClient() {
  const [storages, setStorages] = useState<FuelLedgerStorage[]>([]);
  const [events, setEvents] = useState<FuelLedgerEvent[]>([]);
  const [assets, setAssets] = useState<FuelLedgerAsset[]>([]);
  const [summary, setSummary] = useState<FuelLedgerSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [storageDraft, setStorageDraft] = useState<StorageDraft>(emptyStorageDraft);
  const [stockDraft, setStockDraft] = useState<StockDraft>(emptyStockDraft);
  const [pinDraft, setPinDraft] = useState('');

  const selectedStorage = useMemo(
    () => storages.find((storage) => storage.id === selectedStorageId) ?? null,
    [selectedStorageId, storages],
  );
  const fuelAssets = useMemo(() => assets.filter((asset) => asset.canReceiveFuel), [assets]);

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
      setEvents(data.recentEvents ?? []);
      setAssets(data.assets ?? []);
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

  function openStock(storage: FuelLedgerStorage, mode: 'stock_in' | 'dip' = 'stock_in') {
    setSelectedStorageId(storage.id);
    setStockDraft({
      ...emptyStockDraft,
      mode,
      currentLitres: mode === 'dip' ? String(storage.currentLitres) : '',
    });
    setNotice(null);
    setModalMode('stock');
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
    setStockDraft(emptyStockDraft);
    setPinDraft('');
  }

  async function applyLedgerResponse(response: Response) {
    const data = (await response.json()) as FuelLedgerResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Fuel Ledger action failed.');
    }

    if (data.storages) setStorages(data.storages);
    if (data.recentEvents) setEvents(data.recentEvents);
    if (data.assets) setAssets(data.assets);
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

  async function handleStockSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStorage) return;
    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/fuel/storage/${selectedStorage.id}/stock`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: stockDraft.mode,
          litres: stockDraft.litres === '' ? null : Number(stockDraft.litres),
          currentLitres: stockDraft.currentLitres === '' ? null : Number(stockDraft.currentLitres),
          operatorName: stockDraft.operatorName,
          note: stockDraft.note,
        }),
      });

      await applyLedgerResponse(response);
      setNotice({ tone: 'success', message: stockDraft.mode === 'stock_in' ? 'Fuel stock added.' : 'Fuel dip captured.' });
      closeModal();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save stock entry.' });
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

  return (
    <>
      <AppHeader active="none" />
      <main className={styles.pageShell}>
        <section className={styles.heroSection}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Fuel Ledger</span>
            <h1>Track fuel from the tank to the machine.</h1>
            <p>
              Create QR-coded fuel storage units, issue litres to assets through a PIN-protected scan page, and keep one clean ledger for stock, consumption, GPS and fuel reports.
            </p>
          </div>
          <div className={styles.heroActions}>
            <button type="button" className={styles.primaryButton} onClick={openCreateStorage}>
              Add Fuel Storage
            </button>
            <a href="/api/fuel/report" target="_blank" rel="noreferrer" className={styles.secondaryButton}>
              Fuel Report
            </a>
          </div>
        </section>

        {notice ? <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : styles.noticeSuccess}`}>{notice.message}</div> : null}

        <section className={styles.summaryGrid} aria-label="Fuel Ledger summary">
          <article className={styles.summaryCard}>
            <span>Total storage</span>
            <strong>{formatLitres(summary?.currentLitres ?? 0)}</strong>
            <small>{formatPercent(summary?.currentStockPercent ?? null)} of known capacity</small>
          </article>
          <article className={styles.summaryCard}>
            <span>Fuel issued · 30 days</span>
            <strong>{formatLitres(summary?.issuedLitres30Days ?? 0)}</strong>
            <small>Captured from QR fuel entries</small>
          </article>
          <article className={styles.summaryCard}>
            <span>Fuel filled · 30 days</span>
            <strong>{formatLitres(summary?.filledLitres30Days ?? 0)}</strong>
            <small>Stock in and opening balances</small>
          </article>
          <article className={`${styles.summaryCard} ${(summary?.lowStorageCount ?? 0) > 0 ? styles.summaryWarning : ''}`}>
            <span>Low storage</span>
            <strong>{summary?.lowStorageCount ?? 0}</strong>
            <small>{summary?.totalStorageUnits ?? 0} active storage units</small>
          </article>
        </section>

        <section className={styles.contentGrid}>
          <div className={styles.mainColumn}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Fuel storage units</h2>
                <p>Main tanks, diesel bowsers, service trailers and drums that can issue fuel by QR scan.</p>
              </div>
              <button type="button" className={styles.compactButton} onClick={() => void loadLedger({ silent: true })}>
                Refresh
              </button>
            </div>

            {isLoading ? <div className={styles.emptyState}>Loading Fuel Ledger...</div> : null}

            {!isLoading && !storages.length ? (
              <div className={styles.emptyState}>
                <strong>No fuel storage yet.</strong>
                <span>Add your main tank or diesel bowser first. The storage QR then becomes the entry point for fuel issues.</span>
                <button type="button" className={styles.primaryButton} onClick={openCreateStorage}>
                  Add first storage
                </button>
              </div>
            ) : null}

            <div className={styles.storageGrid}>
              {storages.map((storage) => (
                <article key={storage.id} className={`${styles.storageCard} ${getStorageTone(storage)}`}>
                  <div className={styles.storageTopRow}>
                    <div className={styles.storageTitleBlock}>
                      <span className={styles.storageType}>{storage.fuelType.toUpperCase()}</span>
                      <h3>{storage.name}</h3>
                      <p>{storage.locationLabel || storage.publicFuelStorageCode}</p>
                    </div>
                    <span className={styles.statusPill}>{storage.status === 'archived' ? 'Archived' : isLowStorage(storage) ? 'Low' : 'Active'}</span>
                  </div>

                  <div className={styles.levelBlock}>
                    <div className={styles.levelHeader}>
                      <span>Available fuel</span>
                      <strong>{formatLitres(storage.currentLitres)}</strong>
                    </div>
                    <div className={styles.progressTrack} aria-hidden="true">
                      <span style={{ width: `${Math.max(0, Math.min(100, storage.stockPercent ?? 0))}%` }} />
                    </div>
                    <div className={styles.levelFooter}>
                      <span>{storage.capacityLitres === null ? 'Capacity not set' : `Capacity ${formatLitres(storage.capacityLitres)}`}</span>
                      <span>{storage.reorderLevelLitres === null ? 'No reorder level' : `Low at ${formatLitres(storage.reorderLevelLitres)}`}</span>
                    </div>
                  </div>

                  <div className={styles.storageMetaGrid}>
                    <div><span>QR code</span><strong>{storage.publicFuelStorageCode}</strong></div>
                    <div><span>PIN</span><strong>{storage.pinEnabled ? 'Enabled' : 'Needs PIN'}</strong></div>
                    <div><span>Updated</span><strong>{formatDateTime(storage.updatedAtIso)}</strong></div>
                    <div><span>Report</span><strong>{storage.status === 'active' ? 'Live' : 'Stopped'}</strong></div>
                  </div>

                  <div className={styles.actionGrid}>
                    <button type="button" onClick={() => openStock(storage, 'stock_in')} disabled={storage.status !== 'active' || isSaving}>
                      Add stock
                    </button>
                    <button type="button" onClick={() => openStock(storage, 'dip')} disabled={storage.status !== 'active' || isSaving}>
                      Dip level
                    </button>
                    <a href={`/api/fuel/storage/${storage.id}/qr?format=print`} target="_blank" rel="noreferrer">Print QR</a>
                    <a href={`/api/fuel/report?storageId=${encodeURIComponent(storage.id)}`} target="_blank" rel="noreferrer">Report</a>
                    <button type="button" onClick={() => openPin(storage)} disabled={storage.status !== 'active' || isSaving}>
                      Change PIN
                    </button>
                    <button type="button" onClick={() => openEditStorage(storage)} disabled={isSaving}>
                      Manage
                    </button>
                  </div>

                  {storage.status === 'active' ? (
                    <button type="button" className={styles.deleteButton} onClick={() => void handleDeleteStorage(storage)} disabled={isSaving}>
                      Delete storage
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          <aside className={styles.sideColumn}>
            <section className={styles.sidePanel}>
              <h2>V1 logic</h2>
              <div className={styles.logicList}>
                <div><strong>1</strong><span>Fuel arrives into storage with stock in or opening balance.</span></div>
                <div><strong>2</strong><span>Manager scans storage QR and enters the storage PIN.</span></div>
                <div><strong>3</strong><span>Manager selects an account asset, litres issued and the asset fuel percentage.</span></div>
                <div><strong>4</strong><span>Aim4price reduces tank stock, updates the asset fuel %, GPS and fuel report trail.</span></div>
              </div>
            </section>

            <section className={styles.sidePanel}>
              <h2>Fuel-ready assets</h2>
              <p>{fuelAssets.length} of {assets.length} assets are marked as self-propelled or likely fuel-using.</p>
            </section>

            <section className={styles.sidePanel}>
              <h2>Recent fuel movement</h2>
              <div className={styles.eventList}>
                {events.slice(0, 10).map((event) => (
                  <article key={event.id} className={styles.eventItem}>
                    <div>
                      <strong>{eventTypeLabel(event.eventType)}</strong>
                      <span>{event.assetTitle || event.storageName}</span>
                    </div>
                    <p>{formatLitres(event.litres)} · {formatDateTime(event.createdAtIso)}</p>
                  </article>
                ))}
                {!events.length ? <div className={styles.mutedText}>No fuel movement captured yet.</div> : null}
              </div>
            </section>
          </aside>
        </section>
      </main>

      {modalMode === 'create-storage' || modalMode === 'edit-storage' ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <form className={styles.modalCard} onSubmit={handleStorageSubmit}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>{modalMode === 'create-storage' ? 'New storage' : 'Manage storage'}</span>
                <h2>{modalMode === 'create-storage' ? 'Add Fuel Storage' : 'Update Fuel Storage'}</h2>
                <p>Use names like Main Tank, Diesel Bowser, Workshop Tank or Trailer Bowser.</p>
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
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save storage'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {modalMode === 'stock' && selectedStorage ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <form className={styles.modalCard} onSubmit={handleStockSubmit}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>{stockDraft.mode === 'stock_in' ? 'Stock in' : 'Tank dip'}</span>
                <h2>{selectedStorage.name}</h2>
                <p>Current system level: {formatLitres(selectedStorage.currentLitres)}.</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal}>×</button>
            </div>

            <div className={styles.segmentedControl}>
              <button type="button" className={stockDraft.mode === 'stock_in' ? styles.segmentActive : ''} onClick={() => setStockDraft((current) => ({ ...current, mode: 'stock_in' }))}>Add fuel</button>
              <button type="button" className={stockDraft.mode === 'dip' ? styles.segmentActive : ''} onClick={() => setStockDraft((current) => ({ ...current, mode: 'dip', currentLitres: String(selectedStorage.currentLitres) }))}>Correct by dip</button>
            </div>

            <div className={styles.formGrid}>
              {stockDraft.mode === 'stock_in' ? (
                <label>
                  Litres filled
                  <input type="number" min="0" step="0.01" value={stockDraft.litres} onChange={(event) => setStockDraft((current) => ({ ...current, litres: event.target.value }))} required />
                </label>
              ) : (
                <label>
                  Actual current litres
                  <input type="number" min="0" step="0.01" value={stockDraft.currentLitres} onChange={(event) => setStockDraft((current) => ({ ...current, currentLitres: event.target.value }))} required />
                </label>
              )}
              <label>
                Operator / manager
                <input value={stockDraft.operatorName} onChange={(event) => setStockDraft((current) => ({ ...current, operatorName: event.target.value }))} placeholder="Name" />
              </label>
              <label className={styles.fullField}>
                Note
                <textarea value={stockDraft.note} onChange={(event) => setStockDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Invoice number, supplier or manual reason" rows={3} />
              </label>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal} disabled={isSaving}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save entry'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {modalMode === 'pin' && selectedStorage ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <form className={styles.modalCardSmall} onSubmit={handlePinSubmit}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>Fuel QR PIN</span>
                <h2>{selectedStorage.name}</h2>
                <p>Changing the PIN expires old scan sessions for this fuel storage QR code.</p>
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
