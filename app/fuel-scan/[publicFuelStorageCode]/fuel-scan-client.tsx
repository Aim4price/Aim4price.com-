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
  accountBusinessName?: string;
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
  accountBusinessName?: string;
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

const QUICK_FUEL_OPTIONS = [25, 50, 75, 100] as const;

function normalizeIntegerInput(value: string): string {
  return value.replace(/\D+/g, '');
}

function normalizeFuelCode(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function normalizeOperatorName(value: string): string {
  return value.replace(/\s+/g, ' ').slice(0, 80);
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

function assetDisplayName(asset: FuelLedgerAsset): string {
  return asset.title || [asset.brandName, asset.modelName].filter(Boolean).join(' ') || asset.assetTypeLabel || 'Asset';
}

function assetSearchText(asset: FuelLedgerAsset): string {
  return [
    asset.title,
    asset.brandName,
    asset.modelName,
    asset.assetTypeLabel,
    asset.kind,
    asset.plateLabel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function fuelPercentText(value: string): string {
  const normalized = normalizeIntegerInput(value).slice(0, 3);
  if (!normalized) return '0';
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return '0';
  return String(Math.max(0, Math.min(100, parsed)));
}

export default function FuelScanClient({ publicFuelStorageCode }: FuelScanClientProps) {
  const normalizedCode = normalizeFuelCode(publicFuelStorageCode);
  const [preview, setPreview] = useState<FuelStoragePublicPreview | null>(null);
  const [storage, setStorage] = useState<FuelLedgerStorage | null>(null);
  const [accountBusinessName, setAccountBusinessName] = useState('');
  const [assets, setAssets] = useState<FuelLedgerAsset[]>([]);
  const [pin, setPin] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [assetId, setAssetId] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [litres, setLitres] = useState('');
  const [assetFuelPercentAfter, setAssetFuelPercentAfter] = useState('');
  const [assetUsageReading, setAssetUsageReading] = useState('');
  const [note, setNote] = useState('');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState('GPS will be captured automatically after unlocking.');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === assetId) ?? null, [assetId, assets]);
  const selectedAssetName = selectedAsset ? assetDisplayName(selectedAsset) : '';
  const visibleAccountName = accountBusinessName || preview?.accountBusinessName || storage?.accountBusinessName || 'Aim4price account';
  const visibleStorageName = storage?.name || preview?.name || 'Fuel storage';
  const visibleFuelType = storage?.fuelType || preview?.fuelType || 'Diesel';
  const unauthenticated = !storage;

  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => assetSearchText(asset).includes(query));
  }, [assetSearch, assets]);

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
      setAccountBusinessName(data.storage.accountBusinessName || '');
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
    setAccountBusinessName(data.accountBusinessName || data.storage.accountBusinessName || '');
    setAssets(data.assets ?? []);
    captureLocation();
  }

  useEffect(() => {
    const previousBodyBackground = document.body.style.background;
    const footerElements = Array.from(document.querySelectorAll<HTMLElement>('footer'));
    const previousFooterDisplays = footerElements.map((element) => ({ element, display: element.style.display }));

    document.body.style.background = '#f3f7f8';
    footerElements.forEach((element) => {
      element.style.display = 'none';
    });

    try {
      const savedName = window.localStorage.getItem('aim4price_fuel_operator_name');
      if (savedName) setOperatorName(savedName);
    } catch {
      // Local storage is optional for this scan screen.
    }

    return () => {
      document.body.style.background = previousBodyBackground;
      previousFooterDisplays.forEach(({ element, display }) => {
        element.style.display = display;
      });
    };
  }, []);

  useEffect(() => {
    setIsDone(false);
    setStorage(null);
    setAssets([]);
    setAssetId('');
    setAssetSearch('');
    setIsAssetPickerOpen(false);
    setLitres('');
    setAssetFuelPercentAfter('');
    setAssetUsageReading('');
    setNote('');
    setCoordinates(null);
    setLocationStatus('GPS will be captured automatically after unlocking.');
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedCode]);

  useEffect(() => {
    if (!assetId) {
      setAssetFuelPercentAfter('');
      setAssetUsageReading('');
      return;
    }

    const asset = assets.find((entry) => entry.id === assetId);
    if (!asset) return;

    setAssetFuelPercentAfter(asset.fuelPercent !== null ? String(asset.fuelPercent) : '0');
    setAssetUsageReading(asset.hours !== null ? String(asset.hours) : '');
  }, [assetId, assets]);

  useEffect(() => {
    if (!operatorName.trim()) return;
    try {
      window.localStorage.setItem('aim4price_fuel_operator_name', operatorName.trim());
    } catch {
      // Local storage is optional for this scan screen.
    }
  }, [operatorName]);

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
      setPin('');
      setNotice(null);
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
      if (!assetId) {
        throw new Error('Choose the asset that received fuel.');
      }

      if (!litres || Number(litres) <= 0) {
        throw new Error('Enter the litres issued.');
      }

      if (!coordinates) {
        throw new Error('GPS location is required. Press Capture GPS and allow location access.');
      }

      const response = await fetch(`/api/fuel-scan/storage/${encodeURIComponent(normalizedCode)}/issue`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          litres: Number(litres),
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
      setPreview(data.storage);
      setAccountBusinessName(data.accountBusinessName || data.storage.accountBusinessName || accountBusinessName);
      setAssets(data.assets ?? []);
      setIsAssetPickerOpen(false);
      setNotice(null);
      setIsDone(true);

      try {
        window.history.replaceState({ aim4priceFuelQrDone: true }, '', window.location.href);
      } catch {
        // Ignore history replacement errors.
      }

      window.setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 80);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save fuel issue.' });
    } finally {
      setIsSaving(false);
    }
  }

  function chooseAsset(nextAssetId: string) {
    setAssetId(nextAssetId);
    setAssetSearch('');
    setIsAssetPickerOpen(false);
  }

  if (isLoading) {
    return (
      <main className={styles.scanPage}>
        <div className={styles.scanShell}>
          <section className={styles.card}><h1>Loading fuel access...</h1></section>
        </div>
      </main>
    );
  }

  if (isDone) {
    return (
      <main className={styles.scanPage}>
        <section className={styles.thankYouScreen}>
          <h1>Thank you.</h1>
          <p>The fuel issue has been saved and this QR session is closed.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.scanPage}>
      <div className={styles.scanShell}>
        {unauthenticated ? (
          <section className={styles.accountCard}>
            <span>Fuel QR for</span>
            <h1>{visibleAccountName}</h1>
            <p>{visibleStorageName} · {visibleFuelType}</p>
          </section>
        ) : (
          <section className={styles.storageOpenCard}>
            <div>
              <span>Fuel storage unlocked</span>
              <h1>{visibleStorageName}</h1>
              <p>{visibleFuelType} · {formatLitres(storage.currentLitres)} available</p>
            </div>
            <div className={styles.storageProgress} aria-hidden="true">
              <i style={{ width: `${Math.max(0, Math.min(100, storage.stockPercent ?? 0))}%` }} />
            </div>
          </section>
        )}

        {notice ? <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : styles.noticeSuccess}`}>{notice.message}</div> : null}

        {unauthenticated ? (
          <form className={styles.pinCard} onSubmit={handlePinSubmit}>
            <div className={styles.titleBlock}>
              <h2>Enter fuel storage PIN</h2>
              <p>Unlock fuel issue access for this account.</p>
            </div>
            <label className={styles.field}>
              <span>Fuel PIN</span>
              <input
                value={pin}
                onChange={(event) => setPin(normalizeIntegerInput(event.target.value).slice(0, 8))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="4 to 8 digits"
                autoFocus
                required
              />
            </label>
            <button type="submit" className={styles.primaryButton} disabled={isAuthenticating || pin.length < 4}>{isAuthenticating ? 'Checking...' : 'Unlock fuel storage'}</button>
          </form>
        ) : (
          <form className={styles.issueCard} onSubmit={handleIssueSubmit}>
            <div className={styles.titleBlock}>
              <h2>Issue fuel</h2>
              <p>Choose the asset, enter litres, set fuel level, then save.</p>
            </div>

            <button type="button" className={styles.assetPickerButton} onClick={() => setIsAssetPickerOpen(true)}>
              <span>Asset that received fuel</span>
              <strong>{selectedAsset ? selectedAssetName : 'Choose asset'}</strong>
              <small>{selectedAsset ? 'Tap to change asset' : `${assets.length} asset${assets.length === 1 ? '' : 's'} available`}</small>
            </button>

            {selectedAsset ? (
              <div className={styles.assetSnapshot}>
                <div><span>Fuel</span><strong>{formatPercent(selectedAsset.fuelPercent)}</strong></div>
                <div><span>Hours / km</span><strong>{formatHours(selectedAsset.hours)}</strong></div>
                <div><span>Type</span><strong>{selectedAsset.assetTypeLabel || selectedAsset.kind || 'Asset'}</strong></div>
              </div>
            ) : null}

            <label className={styles.field}>
              <span>Litres issued</span>
              <input type="number" min="0" step="0.01" value={litres} onChange={(event) => setLitres(event.target.value)} placeholder="Litres" required />
            </label>

            <div className={styles.fuelSliderBlock}>
              <span>Asset fuel % after fill</span>
              <strong>{fuelPercentText(assetFuelPercentAfter)}%</strong>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                className={styles.rangeInput}
                value={fuelPercentText(assetFuelPercentAfter)}
                onChange={(event) => setAssetFuelPercentAfter(fuelPercentText(event.target.value))}
                required
              />
              <div className={styles.quickFuelGrid}>
                {QUICK_FUEL_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={`${styles.quickFuelButton} ${assetFuelPercentAfter === String(option) ? styles.quickFuelButtonActive : ''}`}
                    onClick={() => setAssetFuelPercentAfter(String(option))}
                    disabled={isSaving}
                  >
                    {option}%
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.twoColumnFields}>
              <label className={styles.field}>
                <span>Hour / km reading</span>
                <input type="number" min="0" step="1" value={assetUsageReading} onChange={(event) => setAssetUsageReading(event.target.value)} placeholder="Optional" />
              </label>
              <label className={styles.field}>
                <span>Manager / operator</span>
                <input value={operatorName} onChange={(event) => setOperatorName(normalizeOperatorName(event.target.value))} placeholder="Name" required />
              </label>
            </div>

            <label className={styles.field}>
              <span>Note</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Optional note" />
            </label>

            <div className={`${styles.gpsBox} ${coordinates ? styles.gpsBoxReady : ''}`}>
              <div>
                <strong>Location</strong>
                <span>{locationStatus}</span>
              </div>
              <button type="button" onClick={captureLocation}>Capture GPS</button>
            </div>

            <button type="submit" className={styles.primaryButton} disabled={isSaving || !coordinates}>{isSaving ? 'Saving fuel...' : 'Save fuel issue'}</button>
          </form>
        )}
      </div>

      {isAssetPickerOpen ? (
        <div className={styles.assetPickerOverlay} role="dialog" aria-modal="true" aria-labelledby="fuel-asset-picker-title">
          <button type="button" className={styles.assetPickerBackdrop} onClick={() => setIsAssetPickerOpen(false)} aria-label="Close asset chooser" />
          <section className={styles.assetPickerSheet}>
            <div className={styles.assetPickerHeader}>
              <div>
                <h2 id="fuel-asset-picker-title">Choose asset</h2>
                <p>Tap the asset that received fuel.</p>
              </div>
              <button type="button" onClick={() => setIsAssetPickerOpen(false)} aria-label="Close asset chooser">×</button>
            </div>
            <input
              className={styles.assetSearchInput}
              value={assetSearch}
              onChange={(event) => setAssetSearch(event.target.value)}
              placeholder="Search asset title"
              autoFocus
            />
            <div className={styles.assetChoiceList}>
              {filteredAssets.map((asset) => (
                <button
                  type="button"
                  key={asset.id}
                  className={`${styles.assetChoiceButton} ${asset.id === assetId ? styles.assetChoiceButtonActive : ''}`}
                  onClick={() => chooseAsset(asset.id)}
                >
                  {assetDisplayName(asset)}
                </button>
              ))}
              {!filteredAssets.length ? <p>No assets found.</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
