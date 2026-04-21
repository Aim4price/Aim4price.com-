'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

type NoticeTone = 'success' | 'error';
type AccessMode = 'owner_session' | 'scan_pin';
type EditorKey = 'hours' | 'fuel' | 'notes' | 'photos';
type LocationState = 'idle' | 'capturing' | 'ready' | 'error';

type ScanSafeAsset = {
  id: string;
  userId: string;
  publicAssetCode: string;
  plateLabel: string;
  qrStatus: string;
  title: string;
  serialNumber: string;
  hours: number | null;
  fuelPercent: number | null;
  condition: string;
  note: string;
  photos: string[];
  lastScannedAtIso: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastKnownLocationText: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

type ScanEventRecord = {
  id: string;
  actorType: string;
  operatorName: string;
  hours: number | null;
  fuelPercent: number | null;
  condition: string;
  note: string;
  photoUrls: string[];
  latitude: number | null;
  longitude: number | null;
  locationText: string;
  createdAtIso: string;
};

type ScanAssetResponse = {
  ok: boolean;
  accessMode?: AccessMode;
  asset?: ScanSafeAsset;
  recentEvents?: ScanEventRecord[];
  pinRequired?: boolean;
  error?: string;
};

type ScanAuthResponse = {
  ok: boolean;
  error?: string;
};

type ScanUploadResponse = {
  ok: boolean;
  uploads?: Array<{
    uploadId: string;
    url: string;
    fileName: string;
    contentType: string;
    byteSize: number;
  }>;
  error?: string;
  pinRequired?: boolean;
};

type SaveScanEventResponse = {
  ok: boolean;
  asset?: ScanSafeAsset;
  event?: ScanEventRecord;
  recentEvents?: ScanEventRecord[];
  error?: string;
  pinRequired?: boolean;
};

type DraftState = {
  hours: string;
  fuelPercent: string;
  note: string;
  latitude: string;
  longitude: string;
  photoUrls: string[];
};

const initialDraft: DraftState = {
  hours: '',
  fuelPercent: '',
  note: '',
  latitude: '',
  longitude: '',
  photoUrls: [],
};

const FALLBACK_ASSET_IMAGE = '/brand/Tractor.png';
const QUICK_FUEL_OPTIONS = [25, 50, 75, 100] as const;

function formatDate(value?: string | null): string {
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

function normalizePublicAssetCode(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function normalizePinInput(value: string): string {
  return value.replace(/\D+/g, '').slice(0, 8);
}

function normalizeIntegerInput(value: string): string {
  return value.replace(/\D+/g, '');
}

function hasMeaningfulDraftValue(draft: DraftState): boolean {
  return Boolean(draft.hours || draft.fuelPercent || draft.note.trim() || draft.photoUrls.length);
}

function hasLocationCaptured(draft: DraftState): boolean {
  return Boolean(draft.latitude.trim() && draft.longitude.trim());
}

function formatCoordinate(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(6) : value;
}

function assetPreview(asset: ScanSafeAsset | null): string {
  return asset?.photos?.[0] || FALLBACK_ASSET_IMAGE;
}

type IconProps = { className?: string };

function MeterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M4 16a8 8 0 1 1 16 0" />
      <path d="M12 13l4-4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function FuelIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M5 4h10v16H5z" />
      <path d="M15 8h2.5l1.5 2v6a2 2 0 0 1-2 2h-2" />
      <path d="M8 8h4" />
    </svg>
  );
}

function NotesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5z" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function CameraIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M4 7h3l2-2h6l2 2h3v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function LocationIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  );
}

function LockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </svg>
  );
}

function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function PhotoCountLabel(count: number): string {
  if (!count) return 'No new photos yet';
  return `${count} photo${count === 1 ? '' : 's'} ready`;
}

export default function ScanClient({ publicAssetCode }: { publicAssetCode: string }) {
  const normalizedCode = useMemo(() => normalizePublicAssetCode(publicAssetCode), [publicAssetCode]);
  const [asset, setAsset] = useState<ScanSafeAsset | null>(null);
  const [recentEvents, setRecentEvents] = useState<ScanEventRecord[]>([]);
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [pin, setPin] = useState('');
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [accessMode, setAccessMode] = useState<AccessMode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [locationMessage, setLocationMessage] = useState('Location will be captured automatically once this asset opens.');
  const [needsPin, setNeedsPin] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [activeEditor, setActiveEditor] = useState<EditorKey>('hours');
  const autoLocationKeyRef = useRef<string>('');

  useEffect(() => {
    void loadAsset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedCode]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 3800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!asset?.id) return;
    if (autoLocationKeyRef.current === asset.id) return;
    autoLocationKeyRef.current = asset.id;
    void captureLocation(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id]);

  async function loadAsset() {
    setIsLoading(true);
    setIsUnavailable(false);

    try {
      const response = await fetch(`/api/scan/assets/${encodeURIComponent(normalizedCode)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => null)) as ScanAssetResponse | null;

      if (response.status === 401) {
        setNeedsPin(Boolean(data?.pinRequired ?? true));
        setAsset(null);
        setRecentEvents([]);
        setAccessMode(null);
        return;
      }

      if (response.status === 403 || response.status === 404) {
        setNeedsPin(false);
        setIsUnavailable(true);
        setAsset(null);
        setRecentEvents([]);
        setAccessMode(null);
        setNotice({ tone: 'error', message: data?.error ?? (response.status === 404 ? 'Asset not found.' : 'Scan access is not enabled yet.') });
        return;
      }

      if (!response.ok || !data?.ok || !data.asset) {
        throw new Error(data?.error ?? 'Failed to load the scan page.');
      }

      setAsset(data.asset);
      setRecentEvents(data.recentEvents ?? []);
      setAccessMode(data.accessMode ?? null);
      setNeedsPin(false);
      setLocationState('idle');
      setLocationMessage('Location will be captured automatically for this QR update.');
      setDraft((current) => ({
        ...current,
        latitude: '',
        longitude: '',
      }));
    } catch (error) {
      setNeedsPin(false);
      setIsUnavailable(true);
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load the scan page.' });
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingPin(true);

    try {
      const response = await fetch('/api/scan/auth', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicAssetCode: normalizedCode, pin }),
      });
      const data = (await response.json().catch(() => null)) as ScanAuthResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? 'Incorrect scan PIN.');
      }

      setPin('');
      setNotice({ tone: 'success', message: 'Scan access unlocked.' });
      autoLocationKeyRef.current = '';
      await loadAsset();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Incorrect scan PIN.' });
    } finally {
      setIsSubmittingPin(false);
    }
  }

  async function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.set('publicAssetCode', normalizedCode);
      files.forEach((file) => formData.append('files', file));

      const response = await fetch('/api/scan/uploads', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as ScanUploadResponse | null;

      if (!response.ok || !data?.ok || !data.uploads?.length) {
        throw new Error(data?.error ?? 'Failed to upload photos.');
      }

      setDraft((current) => ({
        ...current,
        photoUrls: Array.from(new Set([...current.photoUrls, ...data.uploads!.map((entry) => entry.url)])).slice(0, 12),
      }));
      setNotice({ tone: 'success', message: `${data.uploads.length} photo${data.uploads.length === 1 ? '' : 's'} added to this update.` });
      setActiveEditor('photos');
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to upload photos.' });
    } finally {
      event.target.value = '';
      setIsUploading(false);
    }
  }

  function handleRemovePhoto(url: string) {
    setDraft((current) => ({ ...current, photoUrls: current.photoUrls.filter((entry) => entry !== url) }));
  }

  async function captureLocation(isAutomatic = false) {
    if (typeof window === 'undefined' || !window.isSecureContext) {
      setLocationState('error');
      setLocationMessage('Location can only be captured on a secure HTTPS page.');
      return;
    }

    if (!navigator.geolocation) {
      setLocationState('error');
      setLocationMessage('Location is not supported on this device.');
      return;
    }

    setLocationState('capturing');
    setLocationMessage(isAutomatic ? 'Capturing this asset’s location automatically…' : 'Capturing your current location…');

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = String(position.coords.latitude);
          const longitude = String(position.coords.longitude);
          setDraft((current) => ({
            ...current,
            latitude,
            longitude,
          }));
          setLocationState('ready');
          setLocationMessage('Location captured. This update will save the asset exactly where it was scanned.');
          if (!isAutomatic) {
            setNotice({ tone: 'success', message: 'Location captured.' });
          }
          resolve();
        },
        (error) => {
          setLocationState('error');
          setLocationMessage(error.message || 'Location is required before this QR update can be saved.');
          if (!isAutomatic) {
            setNotice({ tone: 'error', message: error.message || 'Failed to capture location.' });
          }
          resolve();
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  }

  async function handleSaveUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasMeaningfulDraftValue(draft)) {
      setNotice({ tone: 'error', message: 'Choose at least one update card and add something before saving.' });
      return;
    }

    if (!hasLocationCaptured(draft)) {
      setNotice({ tone: 'error', message: 'Location is required for every QR update. Tap “Capture location” and try again.' });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/scan/assets/${encodeURIComponent(normalizedCode)}/event`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hours: draft.hours,
          fuelPercent: draft.fuelPercent,
          note: draft.note,
          photoUrls: draft.photoUrls,
          latitude: draft.latitude,
          longitude: draft.longitude,
        }),
      });
      const data = (await response.json().catch(() => null)) as SaveScanEventResponse | null;

      if (!response.ok || !data?.ok || !data.asset) {
        throw new Error(data?.error ?? 'Failed to save the scan update.');
      }

      const preservedLatitude = draft.latitude;
      const preservedLongitude = draft.longitude;
      setAsset(data.asset);
      setRecentEvents(data.recentEvents ?? []);
      setDraft({
        ...initialDraft,
        latitude: preservedLatitude,
        longitude: preservedLongitude,
      });
      setNotice({ tone: 'success', message: 'Scan update saved.' });
      setActiveEditor('hours');
      setLocationState('ready');
      setLocationMessage('Location is still ready for the next update on this asset.');
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save the scan update.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLockAccess() {
    try {
      await fetch('/api/scan/logout', { method: 'POST', credentials: 'include' });
      setNeedsPin(true);
      setAsset(null);
      setRecentEvents([]);
      setAccessMode(null);
      setDraft(initialDraft);
      setLocationState('idle');
      setLocationMessage('Location will be captured automatically once this asset opens.');
      setNotice({ tone: 'success', message: 'Scan access locked.' });
    } catch {
      setNotice({ tone: 'error', message: 'Failed to lock scan access.' });
    }
  }

  const locationReady = hasLocationCaptured(draft);
  const canSave = locationReady && hasMeaningfulDraftValue(draft) && !isSaving;
  const assetPhoto = assetPreview(asset);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>Aim4price QR update</span>
            <h1>{asset?.title || 'Asset scan'}</h1>
            <p>Keep QR updates fast: tap a card, change what matters, and save the machine’s live location automatically.</p>
          </div>
          <div className={styles.heroAside}>
            <div className={styles.heroStat}>
              <span>Plate label</span>
              <strong>{asset?.plateLabel || normalizedCode || '—'}</strong>
            </div>
            <div className={styles.heroStat}>
              <span>Last scan</span>
              <strong>{asset ? formatDate(asset.lastScannedAtIso) : 'Locked'}</strong>
            </div>
          </div>
        </header>

        {notice ? <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>{notice.message}</div> : null}

        {isLoading ? <div className={styles.loadingCard}>Loading scan page…</div> : null}

        {!isLoading && needsPin ? (
          <section className={styles.pinCard}>
            <div>
              <span className={styles.kicker}>Scan access</span>
              <h2>Enter the farm PIN</h2>
              <p>Every public QR scan uses the farm PIN. This page never opens the finance or valuation side.</p>
            </div>

            <form className={styles.pinForm} onSubmit={handlePinSubmit}>
              <label className={styles.field}>
                <span>QR scan PIN</span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="4 to 8 digits"
                  value={pin}
                  onChange={(event) => setPin(normalizePinInput(event.target.value))}
                  disabled={isSubmittingPin}
                />
              </label>

              <div className={styles.pinActions}>
                <button type="submit" className={styles.primaryButton} disabled={isSubmittingPin || pin.length < 4}>
                  {isSubmittingPin ? 'Unlocking…' : 'Unlock asset'}
                </button>
                <Link href="/" className={styles.secondaryButton}>Back to Aim4price</Link>
              </div>
            </form>
          </section>
        ) : null}

        {!isLoading && isUnavailable ? (
          <section className={styles.unavailableCard}>
            <span className={styles.kicker}>Unavailable</span>
            <h2>This asset could not be opened</h2>
            <p>Check the QR code, or ask the owner to confirm that scan PIN access is enabled for this account.</p>
          </section>
        ) : null}

        {!isLoading && asset ? (
          <>
            <section className={styles.assetCard}>
              <div className={styles.assetTopRow}>
                <div className={styles.assetMediaWrap}>
                  <img src={assetPhoto} alt={`${asset.title} preview`} className={styles.assetPhoto} />
                </div>

                <div className={styles.assetSummary}>
                  <div className={styles.assetSummaryHeader}>
                    <div>
                      <span className={styles.kicker}>Operational asset</span>
                      <h2>{asset.title}</h2>
                      <p>{asset.serialNumber ? `Serial ${asset.serialNumber}` : 'Serial number not saved yet.'}</p>
                    </div>
                    {accessMode === 'scan_pin' ? (
                      <button type="button" className={styles.secondaryButton} onClick={handleLockAccess}>
                        <LockIcon className={styles.buttonIcon} />
                        <span>Lock</span>
                      </button>
                    ) : null}
                  </div>

                  <div className={styles.summaryGrid}>
                    <article className={styles.summaryTile}>
                      <span>Current hours</span>
                      <strong>{asset.hours !== null ? asset.hours.toLocaleString('en-ZA') : '—'}</strong>
                    </article>
                    <article className={styles.summaryTile}>
                      <span>Fuel level</span>
                      <strong>{asset.fuelPercent !== null ? `${asset.fuelPercent}%` : '—'}</strong>
                    </article>
                    <article className={styles.summaryTile}>
                      <span>Saved photos</span>
                      <strong>{asset.photos.length}</strong>
                    </article>
                    <article className={styles.summaryTile}>
                      <span>Last scanned</span>
                      <strong>{formatDate(asset.lastScannedAtIso)}</strong>
                    </article>
                  </div>
                </div>
              </div>
            </section>

            <form className={styles.form} onSubmit={handleSaveUpdate}>
              <section className={styles.locationCard}>
                <div className={styles.locationCopy}>
                  <div className={`${styles.locationPill} ${locationState === 'ready' ? styles.locationPillReady : locationState === 'capturing' ? styles.locationPillLoading : styles.locationPillError}`}>
                    <LocationIcon className={styles.locationPillIcon} />
                    <span>
                      {locationState === 'ready'
                        ? 'Location ready'
                        : locationState === 'capturing'
                          ? 'Capturing location'
                          : locationState === 'error'
                            ? 'Location required'
                            : 'Waiting for location'}
                    </span>
                  </div>
                  <div>
                    <span className={styles.kicker}>Required GPS</span>
                    <h3>Every QR update saves where the asset was scanned</h3>
                    <p>{locationMessage}</p>
                    {locationReady ? (
                      <p className={styles.metaText}>
                        {formatCoordinate(draft.latitude)}, {formatCoordinate(draft.longitude)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => void captureLocation(false)}
                  disabled={locationState === 'capturing' || isSaving}
                >
                  {locationState === 'capturing' ? 'Capturing…' : 'Capture location'}
                </button>
              </section>

              <section className={styles.quickActionGrid}>
                <button
                  type="button"
                  className={`${styles.quickActionCard} ${activeEditor === 'hours' ? styles.quickActionCardActive : ''}`}
                  onClick={() => setActiveEditor('hours')}
                >
                  <MeterIcon className={styles.quickActionIcon} />
                  <div>
                    <strong>Hour Meter</strong>
                    <span>{draft.hours ? `${draft.hours} ready to save` : asset.hours !== null ? `${asset.hours.toLocaleString('en-ZA')} currently saved` : 'Tap to update hours'}</span>
                  </div>
                  <ChevronRightIcon className={styles.quickActionChevron} />
                </button>

                <button
                  type="button"
                  className={`${styles.quickActionCard} ${activeEditor === 'fuel' ? styles.quickActionCardActive : ''}`}
                  onClick={() => setActiveEditor('fuel')}
                >
                  <FuelIcon className={styles.quickActionIcon} />
                  <div>
                    <strong>Fuel</strong>
                    <span>{draft.fuelPercent ? `${draft.fuelPercent}% ready to save` : asset.fuelPercent !== null ? `${asset.fuelPercent}% currently saved` : 'Tap to update fuel'}</span>
                  </div>
                  <ChevronRightIcon className={styles.quickActionChevron} />
                </button>

                <button
                  type="button"
                  className={`${styles.quickActionCard} ${activeEditor === 'notes' ? styles.quickActionCardActive : ''}`}
                  onClick={() => setActiveEditor('notes')}
                >
                  <NotesIcon className={styles.quickActionIcon} />
                  <div>
                    <strong>Notes</strong>
                    <span>{draft.note.trim() ? `${draft.note.trim().length} characters ready to save` : 'Tap to add a simple note'}</span>
                  </div>
                  <ChevronRightIcon className={styles.quickActionChevron} />
                </button>

                <button
                  type="button"
                  className={`${styles.quickActionCard} ${activeEditor === 'photos' ? styles.quickActionCardActive : ''}`}
                  onClick={() => setActiveEditor('photos')}
                >
                  <CameraIcon className={styles.quickActionIcon} />
                  <div>
                    <strong>Photos</strong>
                    <span>{PhotoCountLabel(draft.photoUrls.length)}</span>
                  </div>
                  <ChevronRightIcon className={styles.quickActionChevron} />
                </button>
              </section>

              <section className={styles.editorCard}>
                {activeEditor === 'hours' ? (
                  <div className={styles.editorSection}>
                    <div className={styles.editorHeader}>
                      <div>
                        <span className={styles.kicker}>Hour meter</span>
                        <h3>Update the latest machine hours</h3>
                        <p>Only enter the latest visible reading from the hour meter.</p>
                      </div>
                    </div>
                    <label className={styles.field}>
                      <span>Hours</span>
                      <input
                        inputMode="numeric"
                        placeholder={asset.hours !== null ? String(asset.hours) : 'Enter hours'}
                        value={draft.hours}
                        onChange={(event) => setDraft((current) => ({ ...current, hours: normalizeIntegerInput(event.target.value) }))}
                        disabled={isSaving}
                      />
                    </label>
                  </div>
                ) : null}

                {activeEditor === 'fuel' ? (
                  <div className={styles.editorSection}>
                    <div className={styles.editorHeader}>
                      <div>
                        <span className={styles.kicker}>Fuel</span>
                        <h3>Update the fuel level</h3>
                        <p>Use the percentage that best matches the tank level right now.</p>
                      </div>
                    </div>
                    <label className={styles.field}>
                      <span>Fuel %</span>
                      <input
                        inputMode="numeric"
                        placeholder={asset.fuelPercent !== null ? String(asset.fuelPercent) : '0 to 100'}
                        value={draft.fuelPercent}
                        onChange={(event) => setDraft((current) => ({ ...current, fuelPercent: normalizeIntegerInput(event.target.value).slice(0, 3) }))}
                        disabled={isSaving}
                      />
                    </label>
                    <div className={styles.quickOptionRow}>
                      {QUICK_FUEL_OPTIONS.map((option) => (
                        <button
                          type="button"
                          key={option}
                          className={`${styles.quickOptionButton} ${draft.fuelPercent === String(option) ? styles.quickOptionButtonActive : ''}`}
                          onClick={() => setDraft((current) => ({ ...current, fuelPercent: String(option) }))}
                        >
                          {option}%
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeEditor === 'notes' ? (
                  <div className={styles.editorSection}>
                    <div className={styles.editorHeader}>
                      <div>
                        <span className={styles.kicker}>Notes</span>
                        <h3>Add a short update note</h3>
                        <p>Keep it simple: moved field, delivered, repaired, service due, fuel topped up, and so on.</p>
                      </div>
                    </div>
                    <label className={styles.field}>
                      <span>Note</span>
                      <textarea
                        placeholder="Add a short update note"
                        value={draft.note}
                        onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value.slice(0, 1600) }))}
                        disabled={isSaving}
                      />
                    </label>
                  </div>
                ) : null}

                {activeEditor === 'photos' ? (
                  <div className={styles.editorSection}>
                    <div className={styles.editorHeader}>
                      <div>
                        <span className={styles.kicker}>Photos</span>
                        <h3>Add clear new photos</h3>
                        <p>These photos are attached to this scan update and merged into the asset record.</p>
                      </div>
                    </div>

                    <div className={styles.uploadRow}>
                      <label className={styles.uploadButton}>
                        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleUploadChange} disabled={isUploading || isSaving} />
                        {isUploading ? 'Uploading…' : 'Add photos'}
                      </label>
                      <p className={styles.helperText}>Use good light and capture the machine clearly.</p>
                    </div>

                    {draft.photoUrls.length ? (
                      <div className={styles.photoGrid}>
                        {draft.photoUrls.map((url, index) => (
                          <article key={`${url}-${index}`} className={styles.photoCard}>
                            <img src={url} alt={`Scan upload ${index + 1}`} className={styles.photoImage} />
                            <button type="button" className={styles.removePhotoButton} onClick={() => handleRemovePhoto(url)}>
                              Remove
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <div className={styles.saveBar}>
                <div className={styles.saveBarCopy}>
                  <strong>{locationReady ? 'Ready to save' : 'Location required before saving'}</strong>
                  <span>
                    {locationReady
                      ? 'This QR update will store the asset where it was scanned.'
                      : 'Allow GPS access so Aim4price can place this machine correctly on the asset map.'}
                  </span>
                </div>
                <div className={styles.saveBarActions}>
                  <button type="submit" className={styles.primaryButton} disabled={!canSave}>
                    {isSaving ? 'Saving update…' : 'Save QR update'}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() =>
                      setDraft((current) => ({
                        ...initialDraft,
                        latitude: current.latitude,
                        longitude: current.longitude,
                      }))
                    }
                    disabled={isSaving}
                  >
                    Clear changes
                  </button>
                </div>
              </div>
            </form>

            <section className={styles.historyCard}>
              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.kicker}>Recent activity</span>
                  <h2>Scan history</h2>
                  <p>The latest QR updates saved for this asset.</p>
                </div>
              </div>
              {recentEvents.length ? (
                <div className={styles.historyList}>
                  {recentEvents.map((entry) => (
                    <article key={entry.id} className={styles.historyItem}>
                      <div className={styles.historyTopRow}>
                        <strong>{formatDate(entry.createdAtIso)}</strong>
                        <span className={styles.historyBadge}>{entry.actorType === 'scan_pin' ? 'Farm PIN' : 'Owner session'}</span>
                      </div>
                      <div className={styles.historyMetaGrid}>
                        <span>Hours: {entry.hours ?? '—'}</span>
                        <span>Fuel: {entry.fuelPercent !== null ? `${entry.fuelPercent}%` : '—'}</span>
                        <span>
                          GPS: {entry.latitude !== null && entry.longitude !== null ? `${entry.latitude.toFixed(5)}, ${entry.longitude.toFixed(5)}` : '—'}
                        </span>
                      </div>
                      {entry.note ? <p className={styles.historyText}>{entry.note}</p> : null}
                      {entry.photoUrls.length ? (
                        <div className={styles.historyPhotoRow}>
                          {entry.photoUrls.map((url, index) => (
                            <img key={`${entry.id}-${index}`} src={url} alt={`History photo ${index + 1}`} className={styles.historyPhoto} />
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.helperText}>No scan history yet. The first QR update will appear here.</p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
