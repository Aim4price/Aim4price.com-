'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

type NoticeTone = 'success' | 'error';
type AccessMode = 'owner_session' | 'scan_pin';

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
  operatorName: string;
  hours: string;
  fuelPercent: string;
  condition: string;
  note: string;
  locationText: string;
  latitude: string;
  longitude: string;
  photoUrls: string[];
};

const initialDraft: DraftState = {
  operatorName: '',
  hours: '',
  fuelPercent: '',
  condition: '',
  note: '',
  locationText: '',
  latitude: '',
  longitude: '',
  photoUrls: [],
};

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

function formatCondition(value?: string | null): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return '—';
  if (normalized === 'excellent') return 'Excellent';
  if (normalized === 'good') return 'Good';
  if (normalized === 'fair') return 'Fair';
  if (normalized === 'used') return 'Used';
  if (normalized === 'serious') return 'Requires attention';
  return normalized;
}

function normalizePublicAssetCode(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function normalizePinInput(value: string): string {
  return value.replace(/\D+/g, '').slice(0, 8);
}

function normalizeNumericInput(value: string): string {
  return value.replace(/[^0-9.\-]/g, '');
}

function hasMeaningfulDraftValue(draft: DraftState): boolean {
  return Boolean(
    draft.hours ||
      draft.fuelPercent ||
      draft.condition ||
      draft.note.trim() ||
      draft.locationText.trim() ||
      draft.latitude.trim() ||
      draft.longitude.trim() ||
      draft.photoUrls.length,
  );
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
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);

  useEffect(() => {
    void loadAsset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedCode]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 3800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

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
      setDraft((current) => ({ ...current, condition: current.condition || data.asset!.condition || '' }));
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
      setNotice({ tone: 'success', message: `${data.uploads.length} photo${data.uploads.length === 1 ? '' : 's'} added to this scan update.` });
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

  function handleCaptureLocation() {
    if (!navigator.geolocation) {
      setNotice({ tone: 'error', message: 'Location is not supported on this device.' });
      return;
    }

    setIsCapturingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraft((current) => ({
          ...current,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }));
        setIsCapturingLocation(false);
        setNotice({ tone: 'success', message: 'Location captured for this update.' });
      },
      (error) => {
        setIsCapturingLocation(false);
        setNotice({ tone: 'error', message: error.message || 'Failed to capture location.' });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  async function handleSaveUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasMeaningfulDraftValue(draft)) {
      setNotice({ tone: 'error', message: 'Add at least one field before saving.' });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/scan/assets/${encodeURIComponent(normalizedCode)}/event`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorName: draft.operatorName,
          hours: draft.hours,
          fuelPercent: draft.fuelPercent,
          condition: draft.condition,
          note: draft.note,
          photoUrls: draft.photoUrls,
          latitude: draft.latitude,
          longitude: draft.longitude,
          locationText: draft.locationText,
        }),
      });
      const data = (await response.json().catch(() => null)) as SaveScanEventResponse | null;

      if (!response.ok || !data?.ok || !data.asset) {
        throw new Error(data?.error ?? 'Failed to save the scan update.');
      }

      setAsset(data.asset);
      setRecentEvents(data.recentEvents ?? []);
      setDraft((current) => ({ ...initialDraft, operatorName: current.operatorName }));
      setNotice({ tone: 'success', message: 'Scan update saved.' });
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
      setNotice({ tone: 'success', message: 'Scan access locked.' });
    } catch {
      setNotice({ tone: 'error', message: 'Failed to lock scan access.' });
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>Aim4price operational scan</span>
            <h1>{asset?.title || 'Asset scan'}</h1>
            <p>Update hours, fuel, notes, photos and the latest location without opening the valuation or finance side.</p>
          </div>

          <div className={styles.heroAside}>
            <div className={styles.heroStat}>
              <span>Asset code</span>
              <strong>{asset?.plateLabel || normalizedCode || '—'}</strong>
            </div>
            <div className={styles.heroStat}>
              <span>Scan access</span>
              <strong>{accessMode === 'owner_session' ? 'Owner session' : accessMode === 'scan_pin' ? 'Farm PIN' : 'Locked'}</strong>
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
              <p>Use the PIN saved in Aim4price Account to unlock this asset’s operational page.</p>
            </div>

            <form className={styles.pinForm} onSubmit={handlePinSubmit}>
              <label className={styles.field}>
                <span>QR scan PIN</span>
                <input inputMode="numeric" autoComplete="one-time-code" placeholder="4 to 8 digits" value={pin} onChange={(event) => setPin(normalizePinInput(event.target.value))} disabled={isSubmittingPin} />
              </label>

              <div className={styles.pinActions}>
                <button type="submit" className={styles.primaryButton} disabled={isSubmittingPin || pin.length < 4}>
                  {isSubmittingPin ? 'Unlocking…' : 'Unlock scan page'}
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
          <div className={styles.layout}>
            <section className={styles.mainCard}>
              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.kicker}>Operational details</span>
                  <h2>{asset.title}</h2>
                  <p>Only operational fields are shown here. Valuations and finance values stay hidden.</p>
                </div>
                {accessMode === 'scan_pin' ? <button type="button" className={styles.secondaryButton} onClick={handleLockAccess}>Lock scan access</button> : null}
              </div>

              <div className={styles.summaryGrid}>
                <article className={styles.summaryTile}><span>Plate label</span><strong>{asset.plateLabel || '—'}</strong></article>
                <article className={styles.summaryTile}><span>Serial number</span><strong>{asset.serialNumber || 'Not saved'}</strong></article>
                <article className={styles.summaryTile}><span>Current hours</span><strong>{asset.hours ?? '—'}</strong></article>
                <article className={styles.summaryTile}><span>Fuel level</span><strong>{asset.fuelPercent !== null ? `${asset.fuelPercent}%` : '—'}</strong></article>
                <article className={styles.summaryTile}><span>Condition</span><strong>{formatCondition(asset.condition)}</strong></article>
                <article className={styles.summaryTile}><span>Last scanned</span><strong>{formatDate(asset.lastScannedAtIso)}</strong></article>
              </div>

              <form className={styles.form} onSubmit={handleSaveUpdate}>
                <label className={styles.field}>
                  <span>Operator name</span>
                  <input placeholder="Optional" value={draft.operatorName} onChange={(event) => setDraft((current) => ({ ...current, operatorName: event.target.value.slice(0, 80) }))} disabled={isSaving} />
                </label>

                <div className={styles.fieldRow}>
                  <label className={styles.field}>
                    <span>Hours</span>
                    <input inputMode="numeric" placeholder={asset.hours !== null ? String(asset.hours) : 'Enter hours'} value={draft.hours} onChange={(event) => setDraft((current) => ({ ...current, hours: normalizeNumericInput(event.target.value) }))} disabled={isSaving} />
                  </label>
                  <label className={styles.field}>
                    <span>Fuel %</span>
                    <input inputMode="numeric" placeholder={asset.fuelPercent !== null ? String(asset.fuelPercent) : '0 to 100'} value={draft.fuelPercent} onChange={(event) => setDraft((current) => ({ ...current, fuelPercent: normalizeNumericInput(event.target.value) }))} disabled={isSaving} />
                  </label>
                  <label className={styles.field}>
                    <span>Condition</span>
                    <select value={draft.condition} onChange={(event) => setDraft((current) => ({ ...current, condition: event.target.value }))} disabled={isSaving}>
                      <option value="">Leave unchanged</option>
                      <option value="excellent">Excellent</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="used">Used</option>
                      <option value="serious">Requires attention</option>
                    </select>
                  </label>
                </div>

                <label className={styles.field}>
                  <span>Location note</span>
                  <input placeholder={asset.lastKnownLocationText || 'North shed, workshop, field gate…'} value={draft.locationText} onChange={(event) => setDraft((current) => ({ ...current, locationText: event.target.value.slice(0, 160) }))} disabled={isSaving} />
                </label>

                <div className={styles.fieldRow}>
                  <label className={styles.field}>
                    <span>Latitude</span>
                    <input inputMode="decimal" placeholder={asset.lastKnownLat !== null ? String(asset.lastKnownLat) : '-33.9249'} value={draft.latitude} onChange={(event) => setDraft((current) => ({ ...current, latitude: normalizeNumericInput(event.target.value) }))} disabled={isSaving} />
                  </label>
                  <label className={styles.field}>
                    <span>Longitude</span>
                    <input inputMode="decimal" placeholder={asset.lastKnownLng !== null ? String(asset.lastKnownLng) : '18.4241'} value={draft.longitude} onChange={(event) => setDraft((current) => ({ ...current, longitude: normalizeNumericInput(event.target.value) }))} disabled={isSaving} />
                  </label>
                  <div className={styles.fieldActionWrap}>
                    <span>GPS capture</span>
                    <button type="button" className={styles.secondaryButton} onClick={handleCaptureLocation} disabled={isCapturingLocation || isSaving}>{isCapturingLocation ? 'Capturing…' : 'Use current location'}</button>
                  </div>
                </div>

                <label className={styles.field}>
                  <span>Note</span>
                  <textarea placeholder="Add service notes, movement notes, fuel status or anything the team should record." value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value.slice(0, 1600) }))} disabled={isSaving} />
                </label>

                <div className={styles.field}>
                  <span>Photos for this update</span>
                  <div className={styles.uploadRow}>
                    <label className={styles.uploadButton}>
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleUploadChange} disabled={isUploading || isSaving} />
                      {isUploading ? 'Uploading…' : 'Add photos'}
                    </label>
                    <p className={styles.helperText}>These photos will be attached to this scan event and merged into the asset record.</p>
                  </div>

                  {draft.photoUrls.length ? (
                    <div className={styles.photoGrid}>
                      {draft.photoUrls.map((url, index) => (
                        <article key={`${url}-${index}`} className={styles.photoCard}>
                          <img src={url} alt={`Scan upload ${index + 1}`} className={styles.photoImage} />
                          <button type="button" className={styles.removePhotoButton} onClick={() => handleRemovePhoto(url)}>Remove</button>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className={styles.formActions}>
                  <button type="submit" className={styles.primaryButton} disabled={isSaving || !hasMeaningfulDraftValue(draft)}>{isSaving ? 'Saving update…' : 'Save scan update'}</button>
                  <button type="button" className={styles.secondaryButton} onClick={() => setDraft((current) => ({ ...initialDraft, operatorName: current.operatorName }))} disabled={isSaving}>Clear form</button>
                </div>
              </form>
            </section>

            <aside className={styles.sidebar}>
              <section className={styles.sidebarCard}>
                <span className={styles.kicker}>Current note</span>
                <h3>Latest asset note</h3>
                <p>{asset.note || 'No current note saved on this asset yet.'}</p>
              </section>
              <section className={styles.sidebarCard}>
                <span className={styles.kicker}>Current location</span>
                <h3>Last known position</h3>
                <p>{asset.lastKnownLocationText || 'No location note saved yet.'}</p>
                {asset.lastKnownLat !== null && asset.lastKnownLng !== null ? <p className={styles.metaText}>{asset.lastKnownLat}, {asset.lastKnownLng}</p> : null}
              </section>
              <section className={styles.sidebarCard}>
                <span className={styles.kicker}>Asset photos</span>
                <h3>Saved photos</h3>
                {asset.photos.length ? <div className={styles.sidebarPhotoGrid}>{asset.photos.map((photo, index) => <img key={`${photo}-${index}`} src={photo} alt={`Asset photo ${index + 1}`} className={styles.sidebarPhoto} />)}</div> : <p>No photos saved yet.</p>}
              </section>
            </aside>
          </div>
        ) : null}

        {!isLoading && asset ? (
          <section className={styles.historyCard}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.kicker}>Recent activity</span>
                <h2>Scan history</h2>
                <p>The latest operational updates saved through the QR scan workflow.</p>
              </div>
            </div>
            {recentEvents.length ? (
              <div className={styles.historyList}>
                {recentEvents.map((entry) => (
                  <article key={entry.id} className={styles.historyItem}>
                    <div className={styles.historyTopRow}>
                      <strong>{formatDate(entry.createdAtIso)}</strong>
                      <span className={styles.historyBadge}>{entry.actorType === 'owner_session' ? 'Owner session' : 'Farm PIN'}</span>
                    </div>
                    <div className={styles.historyMetaGrid}>
                      <span>Operator: {entry.operatorName || '—'}</span>
                      <span>Hours: {entry.hours ?? '—'}</span>
                      <span>Fuel: {entry.fuelPercent !== null ? `${entry.fuelPercent}%` : '—'}</span>
                      <span>Condition: {formatCondition(entry.condition)}</span>
                    </div>
                    {entry.locationText ? <p className={styles.historyText}>Location: {entry.locationText}</p> : null}
                    {entry.note ? <p className={styles.historyText}>{entry.note}</p> : null}
                    {entry.photoUrls.length ? <div className={styles.historyPhotoRow}>{entry.photoUrls.map((url, index) => <img key={`${entry.id}-${index}`} src={url} alt={`History photo ${index + 1}`} className={styles.historyPhoto} />)}</div> : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.helperText}>No scan history yet. The first QR update will appear here.</p>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
