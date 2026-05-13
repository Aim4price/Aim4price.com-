'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import styles from './page.module.css';

type FuelStorageStatus = 'active' | 'archived';
type FuelStorageEventType = 'opening_balance' | 'stock_in' | 'asset_issue' | 'dip' | 'adjustment';

type FuelStoragePublicPreview = {
  id: string;
  name: string;
  fuelType: string;
  publicFuelStorageCode: string;
  pinRequired: boolean;
  status: FuelStorageStatus;
};

type FuelLedgerStorage = FuelStoragePublicPreview & {
  capacityLitres: number | null;
  currentLitres: number;
  stockPercent: number | null;
  reorderLevelLitres: number | null;
  locationLabel: string;
  notes: string;
  pinEnabled: boolean;
  hasPin: boolean;
  pinUpdatedAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
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

type PreviewResponse = {
  ok: boolean;
  preview?: boolean;
  storage?: FuelStoragePublicPreview;
  pinRequired?: boolean;
  error?: string;
};

type PayloadResponse = {
  ok: boolean;
  storage?: FuelLedgerStorage;
  assets?: FuelLedgerAsset[];
  recentEvents?: FuelLedgerEvent[];
  error?: string;
  pinRequired?: boolean;
};

type Notice = {
  tone: 'success' | 'error';
  message: string;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

type FuelScanClientProps = {
  publicFuelStorageCode: string;
};

function normalizeFuelCode(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function formatLitres(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} L`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}%`;
}

function formatHours(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-ZA').format(Math.round(value));
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
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

function buildAssetLabel(asset: FuelLedgerAsset): string {
  const parts = [asset.brandName, asset.modelName].filter(Boolean);
  const suffix = [asset.plateLabel, asset.publicAssetCode].filter(Boolean).join(' · ');
  return [asset.title || parts.join(' ') || 'Asset', suffix].filter(Boolean).join(' — ');
}

export default function FuelScanClient({ publicFuelStorageCode }: FuelScanClientProps) {
  const normalizedCode = normalizeFuelCode(publicFuelStorageCode);
  const [preview, setPreview] = useState<FuelStoragePublicPreview | null>(null);
  const [storage, setStorage] = useState<FuelLedgerStorage | null>(null);
  const [assets, setAssets] = useState<FuelLedgerAsset[]>([]);
  const [recentEvents, setRecentEvents] = useState<FuelLedgerEvent[]>([]);
  const [pin, setPin] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [assetId, setAssetId] = useState('');
  const [litres, setLitres] = useState('');
  const [assetFuelPercentAfter, setAssetFuelPercentAfter] = useState('');
  const [assetUsageReading, setAssetUsageReading] = useState('');
  const [note, setNote] = useState('');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState('Waiting for GPS permission.');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === assetId) ?? null, [assetId, assets]);
  const fuelAssets = useMemo(() => assets.filter((asset) => asset.canReceiveFuel), [assets]);
  const unauthenticated = !storage;

  function captureLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('GPS is not available on this device.');
      return;
    }

    setLocationStatus('Getting GPS location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCoordinates(nextCoordinates);
        setLocationStatus(`GPS captured: ${nextCoordinates.latitude.toFixed(6)}, ${nextCoordinates.longitude.toFixed(6)}`);
      },
      () => {
        setCoordinates(null);
        setLocationStatus('GPS permission is required before saving fuel.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function loadPreview() {
    setIsLoading(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/fuel-scan/storage/${encodeURIComponent(normalizedCode)}?preview=1`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await response.json()) as PreviewResponse;

      if (!response.ok || !data.ok || !data.storage) {
        throw new Error(data.error || 'Fuel storage not found.');
      }

      setPreview(data.storage);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load fuel storage.' });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPayload() {
    const response = await fetch(`/api/fuel-scan/storage/${encodeURIComponent(normalizedCode)}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    const data = (await response.json()) as PayloadResponse;

    if (!response.ok || !data.ok || !data.storage) {
      throw new Error(data.error || 'Enter the fuel storage PIN to continue.');
    }

    setStorage(data.storage);
    setPreview(data.storage);
    setAssets(data.assets ?? []);
    setRecentEvents(data.recentEvents ?? []);
    captureLocation();
  }

  useEffect(() => {
    void loadPreview();
  }, [normalizedCode]);

  useEffect(() => {
    if (!assetId) return;
    const asset = assets.find((entry) => entry.id === assetId);
    if (!asset) return;
    if (asset.fuelPercent !== null && assetFuelPercentAfter === '') {
      setAssetFuelPercentAfter(String(asset.fuelPercent));
    }
    if (asset.hours !== null && assetUsageReading === '') {
      setAssetUsageReading(String(asset.hours));
    }
  }, [assetId, assets, assetFuelPercentAfter, assetUsageReading]);

  async function handlePinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthenticating(true);
    setNotice(null);

    try {
      const response = await fetch('/api/fuel-scan/auth', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicFuelStorageCode: normalizedCode, pin }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Incorrect fuel PIN.');
      }

      await loadPayload();
      setNotice({ tone: 'success', message: 'PIN accepted. Choose the asset that received fuel.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Fuel PIN failed.' });
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleIssueSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);

    try {
      if (!coordinates) {
        throw new Error('GPS location is required. Press Capture GPS and allow location access.');
      }

      const response = await fetch(`/api/fuel-scan/storage/${encodeURIComponent(normalizedCode)}/issue`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          litres: litres === '' ? null : Number(litres),
          assetFuelPercentAfter: assetFuelPercentAfter === '' ? null : Number(assetFuelPercentAfter),
          assetUsageReading: assetUsageReading === '' ? null : Number(assetUsageReading),
          operatorName,
          note,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          locationText: `GPS ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`,
        }),
      });
      const data = (await response.json()) as PayloadResponse & { event?: FuelLedgerEvent };

      if (!response.ok || !data.ok || !data.storage) {
        throw new Error(data.error || 'Failed to save fuel issue.');
      }

      setStorage(data.storage);
      setAssets(data.assets ?? []);
      setRecentEvents(data.recentEvents ?? []);
      setAssetId('');
      setLitres('');
      setAssetFuelPercentAfter('');
      setAssetUsageReading('');
      setNote('');
      setNotice({ tone: 'success', message: 'Fuel issue saved. Asset fuel percentage and fuel report have been updated.' });
      captureLocation();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save fuel issue.' });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className={styles.scanShell}>
        <section className={styles.card}><h1>Loading Fuel Ledger...</h1></section>
      </main>
    );
  }

  return (
    <main className={styles.scanShell}>
      <section className={styles.heroCard}>
        <span className={styles.eyebrow}>Aim4price Fuel Ledger</span>
        <h1>{preview?.name || storage?.name || 'Fuel storage'}</h1>
        <p>{preview?.fuelType?.toUpperCase() || storage?.fuelType?.toUpperCase() || 'DIESEL'} · {normalizedCode}</p>
      </section>

      {notice ? <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : styles.noticeSuccess}`}>{notice.message}</div> : null}

      {unauthenticated ? (
        <form className={styles.card} onSubmit={handlePinSubmit}>
          <div className={styles.sectionTitle}>
            <h2>Enter fuel storage PIN</h2>
            <p>This QR code is for issuing fuel from this storage unit to account assets.</p>
          </div>
          <label className={styles.formField}>
            Fuel PIN
            <input value={pin} onChange={(event) => setPin(event.target.value)} inputMode="numeric" placeholder="Enter PIN" autoFocus required />
          </label>
          <button type="submit" className={styles.primaryButton} disabled={isAuthenticating}>{isAuthenticating ? 'Checking...' : 'Unlock fuel storage'}</button>
        </form>
      ) : (
        <section className={styles.gridLayout}>
          <form className={styles.card} onSubmit={handleIssueSubmit}>
            <div className={styles.sectionTitle}>
              <h2>Issue fuel to asset</h2>
              <p>Capture litres, the asset fuel percentage after filling, the manager name and GPS.</p>
            </div>

            <div className={styles.storageLevel}>
              <span>Available in storage</span>
              <strong>{formatLitres(storage.currentLitres)}</strong>
              <div className={styles.progressTrack} aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, storage.stockPercent ?? 0))}%` }} /></div>
            </div>

            <label className={styles.formField}>
              Asset that received fuel
              <select value={assetId} onChange={(event) => setAssetId(event.target.value)} required>
                <option value="">Choose asset</option>
                {fuelAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>{buildAssetLabel(asset)}</option>
                ))}
              </select>
            </label>

            {selectedAsset ? (
              <div className={styles.assetSnapshot}>
                <div><span>Current fuel</span><strong>{formatPercent(selectedAsset.fuelPercent)}</strong></div>
                <div><span>Current hours</span><strong>{formatHours(selectedAsset.hours)}</strong></div>
                <div><span>Type</span><strong>{selectedAsset.assetTypeLabel || selectedAsset.kind || 'Asset'}</strong></div>
              </div>
            ) : null}

            <div className={styles.formGrid}>
              <label className={styles.formField}>
                Litres issued
                <input type="number" min="0" step="0.01" value={litres} onChange={(event) => setLitres(event.target.value)} required />
              </label>
              <label className={styles.formField}>
                Asset fuel % after fill
                <input type="number" min="0" max="100" step="1" value={assetFuelPercentAfter} onChange={(event) => setAssetFuelPercentAfter(event.target.value)} required />
              </label>
              <label className={styles.formField}>
                Hour / km reading
                <input type="number" min="0" step="1" value={assetUsageReading} onChange={(event) => setAssetUsageReading(event.target.value)} placeholder="Optional" />
              </label>
              <label className={styles.formField}>
                Manager / operator
                <input value={operatorName} onChange={(event) => setOperatorName(event.target.value)} required />
              </label>
            </div>

            <label className={styles.formField}>
              Note
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Optional note" />
            </label>

            <div className={styles.gpsBox}>
              <div>
                <strong>Location</strong>
                <span>{locationStatus}</span>
              </div>
              <button type="button" onClick={captureLocation}>Capture GPS</button>
            </div>

            <button type="submit" className={styles.primaryButton} disabled={isSaving || !coordinates}>{isSaving ? 'Saving fuel...' : 'Save fuel issue'}</button>
          </form>

          <aside className={styles.card}>
            <div className={styles.sectionTitle}>
              <h2>Recent entries</h2>
              <p>Latest movement from this fuel storage.</p>
            </div>
            <div className={styles.eventList}>
              {recentEvents.slice(0, 10).map((event) => (
                <article key={event.id} className={styles.eventItem}>
                  <div>
                    <strong>{eventTypeLabel(event.eventType)}</strong>
                    <span>{formatLitres(event.litres)}</span>
                  </div>
                  <p>{event.assetTitle || event.operatorName || event.storageName}</p>
                  <small>{formatDateTime(event.createdAtIso)}</small>
                </article>
              ))}
              {!recentEvents.length ? <p className={styles.emptyText}>No entries for this storage yet.</p> : null}
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}
