'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

type NoticeTone = 'success' | 'error';
type EditorKey = 'usage' | 'fuel' | 'notes' | 'service' | 'photos';
type LocationState = 'idle' | 'capturing' | 'ready' | 'error';
type ScanAssetUsageMode = 'hours' | 'percent' | 'km' | 'none';

type ScanSafeAsset = {
  id: string;
  userId: string;
  publicAssetCode: string;
  plateLabel: string;
  qrStatus: string;
  title: string;
  kind: string;
  equipmentFamilyKey: string;
  equipmentFamilyLabel: string;
  serialNumber: string;
  hours: number | null;
  usageMode: ScanAssetUsageMode;
  usageMetric: 'hours' | 'km';
  lifeWorkedPercent: number | null;
  isPropelled: boolean;
  canUpdateFuel: boolean;
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

type ScanAssetResponse = {
  ok: boolean;
  asset?: ScanSafeAsset;
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
  error?: string;
  pinRequired?: boolean;
};

type DraftState = {
  hours: string;
  lifeWorkedPercent: string;
  fuelPercent: string;
  note: string;
  serviceNote: string;
  latitude: string;
  longitude: string;
  photoUrls: string[];
};

const initialDraft: DraftState = {
  hours: '',
  lifeWorkedPercent: '',
  fuelPercent: '',
  note: '',
  serviceNote: '',
  latitude: '',
  longitude: '',
  photoUrls: [],
};

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

function normalizePercentInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  const normalized = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('').slice(0, 1)}` : parts[0];

  if (!normalized) return '';
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return '';
  if (parsed > 100) return '100';
  return normalized;
}

function hasMeaningfulDraftValue(draft: DraftState): boolean {
  return Boolean(
    draft.hours.trim() !== '' ||
      draft.lifeWorkedPercent.trim() !== '' ||
      draft.fuelPercent.trim() !== '' ||
      draft.note.trim() ||
      draft.serviceNote.trim() ||
      draft.photoUrls.length,
  );
}

function hasLocationCaptured(draft: DraftState): boolean {
  return Boolean(draft.latitude.trim() && draft.longitude.trim());
}

function formatCoordinate(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(6) : value;
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-ZA').format(Math.round(value));
}

function formatFuel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}%`;
}

function formatUsage(asset: ScanSafeAsset | null): string {
  if (!asset) return '—';

  if (asset.usageMode === 'percent') {
    return asset.lifeWorkedPercent === null ? '—' : `${formatPercent(asset.lifeWorkedPercent)} worked`;
  }

  if (asset.usageMode === 'km') {
    return asset.hours === null ? '—' : `${formatNumber(asset.hours)} km`;
  }

  if (asset.usageMode === 'hours') {
    return asset.hours === null ? '—' : `${formatNumber(asset.hours)} hours`;
  }

  return 'Not tracked';
}

function usageTitle(asset: ScanSafeAsset | null): string {
  if (!asset) return 'Usage';
  if (asset.usageMode === 'percent') return 'Lifetime worked %';
  if (asset.usageMode === 'km') return 'Odometer';
  if (asset.usageMode === 'hours') return 'Hour meter';
  return 'Usage';
}

function usageModalLabel(asset: ScanSafeAsset): string {
  if (asset.usageMode === 'percent') return 'Lifetime worked percentage';
  if (asset.usageMode === 'km') return 'Odometer reading';
  return 'Hour meter reading';
}

function usagePlaceholder(asset: ScanSafeAsset): string {
  if (asset.usageMode === 'percent') return asset.lifeWorkedPercent !== null ? String(asset.lifeWorkedPercent) : 'Enter % worked';
  if (asset.usageMode === 'km') return asset.hours !== null ? String(asset.hours) : 'Enter current kilometres';
  return asset.hours !== null ? String(asset.hours) : 'Enter current hours';
}

function assetPlaceholderLabel(asset: ScanSafeAsset): string {
  const label = asset.equipmentFamilyLabel || asset.kind || 'Asset';
  return label.replace(/[_-]+/g, ' ').trim() || 'Asset';
}

function countPendingDraftSections(draft: DraftState): number {
  let total = 0;
  if (draft.hours.trim() !== '' || draft.lifeWorkedPercent.trim() !== '') total += 1;
  if (draft.fuelPercent.trim() !== '') total += 1;
  if (draft.note.trim()) total += 1;
  if (draft.serviceNote.trim()) total += 1;
  if (draft.photoUrls.length) total += 1;
  return total;
}

function buildEditorSummary(editor: EditorKey, draft: DraftState, asset: ScanSafeAsset | null, isUploading = false): string {
  if (editor === 'usage') {
    if (asset?.usageMode === 'percent') {
      return draft.lifeWorkedPercent.trim() !== ''
        ? `${draft.lifeWorkedPercent}% worked ready to save`
        : asset.lifeWorkedPercent !== null
          ? `${formatPercent(asset.lifeWorkedPercent)} worked saved now`
          : 'Tap to capture lifetime worked %';
    }

    if (asset?.usageMode === 'km') {
      return draft.hours.trim() !== ''
        ? `${new Intl.NumberFormat('en-ZA').format(Number(draft.hours))} km ready to save`
        : asset.hours !== null
          ? `${formatNumber(asset.hours)} km saved now`
          : 'Tap to capture kilometres';
    }

    return draft.hours.trim() !== ''
      ? `${new Intl.NumberFormat('en-ZA').format(Number(draft.hours))} hours ready to save`
      : asset?.hours !== null && typeof asset?.hours !== 'undefined'
        ? `${formatNumber(asset.hours)} hours saved now`
        : 'Tap to capture the hour meter';
  }

  if (editor === 'fuel') {
    return draft.fuelPercent.trim() !== ''
      ? `${draft.fuelPercent}% ready to save`
      : asset?.fuelPercent !== null && typeof asset?.fuelPercent !== 'undefined'
        ? `${formatFuel(asset.fuelPercent)} saved now`
        : 'Tap to capture the fuel level';
  }

  if (editor === 'service') {
    return draft.serviceNote.trim()
      ? 'Service / check note ready'
      : 'Tap when the asset was serviced or checked';
  }

  if (editor === 'notes') {
    return draft.note.trim()
      ? `${draft.note.trim().length} characters ready`
      : asset?.note
        ? 'Asset already has notes saved'
        : 'Tap to add a short note';
  }

  if (isUploading) {
    return 'Uploading photos…';
  }

  if (draft.photoUrls.length) {
    return `${draft.photoUrls.length} new photo${draft.photoUrls.length === 1 ? '' : 's'} ready`;
  }

  if (asset?.photos.length) {
    return `${asset.photos.length} photo${asset.photos.length === 1 ? '' : 's'} already saved`;
  }

  return 'Tap to add fresh photos';
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

function ServiceIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m14.7 6.3 3 3" />
      <path d="M9 18.5 4.5 14l2.1-2.1L9 14.3 17.4 6l2.1 2.1z" />
      <path d="M4 21h16" />
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

function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

function getModalCopy(editor: EditorKey | null, asset: ScanSafeAsset | null): { eyebrow: string; title: string; description: string } {
  if (editor === 'usage') {
    if (asset?.usageMode === 'percent') {
      return {
        eyebrow: 'Lifetime worked',
        title: 'Update the worked percentage',
        description: 'This asset was valued by percentage worked, so QR updates cannot use hours.',
      };
    }

    if (asset?.usageMode === 'km') {
      return {
        eyebrow: 'Odometer',
        title: 'Capture the latest kilometres',
        description: 'Use the current odometer reading. It cannot be lower than the saved reading.',
      };
    }

    return {
      eyebrow: 'Hour meter',
      title: 'Capture the latest hours',
      description: 'Use the current reading from the machine’s hour meter only.',
    };
  }

  if (editor === 'fuel') {
    return {
      eyebrow: 'Fuel',
      title: 'Capture the tank level',
      description: 'Choose the percentage that best matches the tank right now.',
    };
  }

  if (editor === 'service') {
    return {
      eyebrow: 'Serviced / checked',
      title: 'Add a service or check note',
      description: 'Record what was checked, serviced, repaired, or confirmed by the operator.',
    };
  }

  if (editor === 'notes') {
    return {
      eyebrow: 'Notes',
      title: 'Add a short operational note',
      description: 'Keep it short and useful for the owner or manager.',
    };
  }

  return {
    eyebrow: 'Photos',
    title: 'Add fresh photos',
    description: 'Use clear photos that show the asset or the issue quickly.',
  };
}

export default function ScanClient({ publicAssetCode }: { publicAssetCode: string }) {
  const normalizedCode = useMemo(() => normalizePublicAssetCode(publicAssetCode), [publicAssetCode]);
  const [asset, setAsset] = useState<ScanSafeAsset | null>(null);
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [pin, setPin] = useState('');
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [isLoadingAsset, setIsLoadingAsset] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [locationMessage, setLocationMessage] = useState('Location will be captured automatically once the asset is unlocked.');
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [activeEditor, setActiveEditor] = useState<EditorKey | null>(null);
  const autoLocationKeyRef = useRef<string>('');

  useEffect(() => {
    setAsset(null);
    setDraft(initialDraft);
    setPin('');
    setIsUnavailable(false);
    setIsSubmittingPin(false);
    setIsLoadingAsset(false);
    setIsSaving(false);
    setIsUploading(false);
    setActiveEditor(null);
    setLocationState('idle');
    setLocationMessage('Location will be captured automatically once the asset is unlocked.');
    autoLocationKeyRef.current = '';
  }, [normalizedCode]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 3800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!activeEditor) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeEditor]);

  useEffect(() => {
    if (!asset?.id) return;
    if (autoLocationKeyRef.current === asset.id) return;
    autoLocationKeyRef.current = asset.id;
    void captureLocation(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id]);

  async function loadUnlockedAsset() {
    setIsLoadingAsset(true);
    setIsUnavailable(false);

    try {
      const response = await fetch(`/api/scan/assets/${encodeURIComponent(normalizedCode)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => null)) as ScanAssetResponse | null;

      if (response.status === 401) {
        throw new Error(data?.error ?? 'Enter the farm scan PIN again.');
      }

      if (response.status === 403 || response.status === 404) {
        setAsset(null);
        setIsUnavailable(true);
        throw new Error(data?.error ?? (response.status === 404 ? 'Asset not found.' : 'Scan access is not enabled yet.'));
      }

      if (!response.ok || !data?.ok || !data.asset) {
        throw new Error(data?.error ?? 'Failed to open this asset.');
      }

      setAsset(data.asset);
      setDraft(initialDraft);
      setLocationState('idle');
      setLocationMessage('Capturing the scan location automatically…');
    } finally {
      setIsLoadingAsset(false);
    }
  }

  async function handlePinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pin.length < 4) {
      setNotice({ tone: 'error', message: 'Enter the farm scan PIN.' });
      return;
    }

    setIsSubmittingPin(true);
    setIsUnavailable(false);

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
      await loadUnlockedAsset();
      setNotice({ tone: 'success', message: 'Asset unlocked. Tap a block to update it.' });
    } catch (error) {
      setAsset(null);
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Incorrect scan PIN.' });
    } finally {
      setIsSubmittingPin(false);
    }
  }

  async function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []) as File[];
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
      setNotice({ tone: 'success', message: `${data.uploads.length} photo${data.uploads.length === 1 ? '' : 's'} added.` });
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
    setLocationMessage(isAutomatic ? 'Capturing the asset location automatically…' : 'Capturing your current location…');

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
          setLocationMessage('Location captured. This QR update will place the asset exactly where it was scanned.');
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

  function buildSaveNote(): string {
    const parts: string[] = [];
    const serviceNote = draft.serviceNote.trim();
    const normalNote = draft.note.trim();

    if (serviceNote) {
      parts.push(`Serviced/Checked: ${serviceNote}`);
    }

    if (normalNote) {
      parts.push(normalNote);
    }

    return parts.join('\n\n');
  }

  async function handleSaveUpdate() {
    if (!asset) return;

    if (!hasMeaningfulDraftValue(draft)) {
      setNotice({ tone: 'error', message: 'Tap one of the update blocks and add something before saving.' });
      return;
    }

    if (!hasLocationCaptured(draft)) {
      setNotice({ tone: 'error', message: 'Location is required for every QR update. Allow GPS and try again.' });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/scan/assets/${encodeURIComponent(normalizedCode)}/event`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hours: asset.usageMode === 'hours' || asset.usageMode === 'km' ? draft.hours : '',
          lifeWorkedPercent: asset.usageMode === 'percent' ? draft.lifeWorkedPercent : '',
          fuelPercent: asset.canUpdateFuel ? draft.fuelPercent : '',
          note: buildSaveNote(),
          photoUrls: draft.photoUrls,
          latitude: draft.latitude,
          longitude: draft.longitude,
        }),
      });
      const data = (await response.json().catch(() => null)) as SaveScanEventResponse | null;

      if (!response.ok || !data?.ok || !data.asset) {
        throw new Error(data?.error ?? 'Failed to save the QR update.');
      }

      setAsset(data.asset);
      setDraft(initialDraft);
      setActiveEditor(null);
      setNotice({ tone: 'success', message: 'QR update saved.' });
      setLocationState('idle');
      setLocationMessage('Capturing the next scan location automatically…');
      void captureLocation(true);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save the QR update.' });
    } finally {
      setIsSaving(false);
    }
  }

  const locationReady = hasLocationCaptured(draft);
  const canSave = locationReady && hasMeaningfulDraftValue(draft) && !isSaving;
  const pendingCount = countPendingDraftSections(draft);
  const modalCopy = getModalCopy(activeEditor, asset);
  const assetPhoto = asset?.photos?.[0] ?? null;
  const showUsageAction = asset ? asset.usageMode !== 'none' : false;
  const showFuelAction = Boolean(asset?.canUpdateFuel);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>Aim4price QR update</span>
            <h1>{asset?.title || 'Unlock this asset'}</h1>
            <p>
              Every public QR scan asks for the farm PIN first. Then the manager can save the correct usage, service note,
              photos and GPS point without opening the full account.
            </p>
          </div>

          <div className={styles.heroAside}>
            <div className={styles.heroStat}>
              <span>Asset code</span>
              <strong>{asset?.plateLabel || normalizedCode || '—'}</strong>
            </div>
            <div className={styles.heroStat}>
              <span>Location rule</span>
              <strong>GPS required</strong>
            </div>
          </div>
        </header>

        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>{notice.message}</div>
        ) : null}

        {!asset && !isUnavailable ? (
          <section className={styles.pinCard}>
            <div className={styles.pinCardCopy}>
              <span className={styles.kicker}>Farm PIN required</span>
              <h2>Enter the farm scan PIN</h2>
              <p>This public QR page never opens the finance side. Unlock the asset, then tap one of the update blocks below.</p>
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
                  disabled={isSubmittingPin || isLoadingAsset}
                />
              </label>

              <div className={styles.pinActions}>
                <button type="submit" className={styles.primaryButton} disabled={isSubmittingPin || isLoadingAsset || pin.length < 4}>
                  {isSubmittingPin || isLoadingAsset ? 'Opening asset…' : 'Open asset'}
                </button>
                <Link href="/" className={styles.secondaryButton}>Back to Aim4price</Link>
              </div>
            </form>
          </section>
        ) : null}

        {isUnavailable ? (
          <section className={styles.unavailableCard}>
            <span className={styles.kicker}>Unavailable</span>
            <h2>This asset could not be opened</h2>
            <p>Check the QR code, or ask the owner to confirm that the farm scan PIN is enabled for this account.</p>
          </section>
        ) : null}

        {asset ? (
          <>
            <section className={styles.assetCard}>
              <div className={styles.assetTopRow}>
                <div className={styles.assetMediaWrap}>
                  {assetPhoto ? (
                    <img src={assetPhoto} alt={`${asset.title} preview`} className={styles.assetPhoto} />
                  ) : (
                    <div className={styles.assetPlaceholder}>
                      <span className={styles.assetPlaceholderLabel}>{assetPlaceholderLabel(asset)}</span>
                    </div>
                  )}
                </div>

                <div className={styles.assetSummary}>
                  <div>
                    <span className={styles.kicker}>Operational asset</span>
                    <h2>{asset.title}</h2>
                    <p>{asset.serialNumber ? `Serial ${asset.serialNumber}` : 'Serial number not saved yet.'}</p>
                  </div>

                  <div className={styles.summaryGrid}>
                    <article className={styles.summaryTile}>
                      <span>Plate label</span>
                      <strong>{asset.plateLabel || 'Pending'}</strong>
                    </article>
                    <article className={styles.summaryTile}>
                      <span>Last scan</span>
                      <strong>{formatDate(asset.lastScannedAtIso)}</strong>
                    </article>
                    <article className={styles.summaryTile}>
                      <span>{usageTitle(asset)}</span>
                      <strong>{formatUsage(asset)}</strong>
                    </article>
                    {asset.canUpdateFuel ? (
                      <article className={styles.summaryTile}>
                        <span>Saved fuel</span>
                        <strong>{formatFuel(asset.fuelPercent)}</strong>
                      </article>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.locationCard}>
              <div className={styles.locationCopy}>
                <div className={`${styles.locationPill} ${locationState === 'ready' ? styles.locationPillReady : locationState === 'capturing' ? styles.locationPillLoading : locationState === 'error' ? styles.locationPillError : ''}`}>
                  <LocationIcon className={styles.locationPillIcon} />
                  <span>
                    {locationState === 'ready'
                      ? 'GPS ready'
                      : locationState === 'capturing'
                        ? 'Capturing GPS'
                        : locationState === 'error'
                          ? 'Location required'
                          : 'Waiting for GPS'}
                  </span>
                </div>
                <div>
                  <span className={styles.kicker}>Required location</span>
                  <h3>Every QR update must save where the asset was scanned</h3>
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
                {locationState === 'capturing' ? 'Capturing…' : 'Retry GPS'}
              </button>
            </section>

            <section className={styles.quickActionGrid}>
              {showUsageAction ? (
                <button type="button" className={styles.quickActionCard} onClick={() => setActiveEditor('usage')}>
                  <div className={styles.quickActionIconWrap}>
                    <MeterIcon className={styles.quickActionIcon} />
                  </div>
                  <div className={styles.quickActionCopy}>
                    <strong>{usageTitle(asset)}</strong>
                    <span>{buildEditorSummary('usage', draft, asset)}</span>
                  </div>
                  <ChevronRightIcon className={styles.quickActionChevron} />
                </button>
              ) : null}

              {showFuelAction ? (
                <button type="button" className={styles.quickActionCard} onClick={() => setActiveEditor('fuel')}>
                  <div className={styles.quickActionIconWrap}>
                    <FuelIcon className={styles.quickActionIcon} />
                  </div>
                  <div className={styles.quickActionCopy}>
                    <strong>Fuel</strong>
                    <span>{buildEditorSummary('fuel', draft, asset)}</span>
                  </div>
                  <ChevronRightIcon className={styles.quickActionChevron} />
                </button>
              ) : null}

              <button type="button" className={styles.quickActionCard} onClick={() => setActiveEditor('service')}>
                <div className={styles.quickActionIconWrap}>
                  <ServiceIcon className={styles.quickActionIcon} />
                </div>
                <div className={styles.quickActionCopy}>
                  <strong>Serviced/Checked</strong>
                  <span>{buildEditorSummary('service', draft, asset)}</span>
                </div>
                <ChevronRightIcon className={styles.quickActionChevron} />
              </button>

              <button type="button" className={styles.quickActionCard} onClick={() => setActiveEditor('notes')}>
                <div className={styles.quickActionIconWrap}>
                  <NotesIcon className={styles.quickActionIcon} />
                </div>
                <div className={styles.quickActionCopy}>
                  <strong>Notes</strong>
                  <span>{buildEditorSummary('notes', draft, asset)}</span>
                </div>
                <ChevronRightIcon className={styles.quickActionChevron} />
              </button>

              <button type="button" className={styles.quickActionCard} onClick={() => setActiveEditor('photos')}>
                <div className={styles.quickActionIconWrap}>
                  <CameraIcon className={styles.quickActionIcon} />
                </div>
                <div className={styles.quickActionCopy}>
                  <strong>Photos</strong>
                  <span>{buildEditorSummary('photos', draft, asset, isUploading)}</span>
                </div>
                <ChevronRightIcon className={styles.quickActionChevron} />
              </button>
            </section>

            <section className={styles.saveBar}>
              <div className={styles.saveBarCopy}>
                <strong>
                  {pendingCount
                    ? `${pendingCount} block${pendingCount === 1 ? '' : 's'} ready to save`
                    : 'Choose an update block above'}
                </strong>
                <span>
                  {locationReady
                    ? 'When you save, Aim4price stores the update and the live GPS scan point together.'
                    : 'GPS must be captured before any QR update can be saved.'}
                </span>
              </div>

              <div className={styles.saveBarActions}>
                <button type="button" className={styles.primaryButton} disabled={!canSave} onClick={() => void handleSaveUpdate()}>
                  {isSaving ? 'Saving update…' : 'Save QR update'}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setDraft((current) => ({ ...initialDraft, latitude: current.latitude, longitude: current.longitude }))}
                  disabled={isSaving || !hasMeaningfulDraftValue(draft)}
                >
                  Clear changes
                </button>
              </div>
            </section>
          </>
        ) : null}
      </div>

      {asset && activeEditor ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={() => setActiveEditor(null)} />

          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="scan-editor-title">
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>{modalCopy.eyebrow}</span>
                <h3 id="scan-editor-title">{modalCopy.title}</h3>
                <p>{modalCopy.description}</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={() => setActiveEditor(null)} aria-label="Close editor">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {activeEditor === 'usage' && asset.usageMode !== 'none' ? (
                <label className={styles.field}>
                  <span>{usageModalLabel(asset)}</span>
                  <input
                    inputMode="numeric"
                    placeholder={usagePlaceholder(asset)}
                    value={asset.usageMode === 'percent' ? draft.lifeWorkedPercent : draft.hours}
                    onChange={(event) =>
                      setDraft((current) =>
                        asset.usageMode === 'percent'
                          ? { ...current, lifeWorkedPercent: normalizePercentInput(event.target.value), hours: '' }
                          : { ...current, hours: normalizeIntegerInput(event.target.value), lifeWorkedPercent: '' },
                      )
                    }
                    disabled={isSaving}
                  />
                  <p className={styles.helperText}>
                    {asset.usageMode === 'percent'
                      ? 'Only percentage worked can be changed for this asset. Hours are blocked for this QR page.'
                      : 'This reading cannot be lower than the reading already saved on this asset.'}
                  </p>
                </label>
              ) : null}

              {activeEditor === 'fuel' ? (
                <div className={styles.modalStack}>
                  <div className={styles.fuelReadout}>{draft.fuelPercent || (asset.fuelPercent !== null ? String(asset.fuelPercent) : '0')}%</div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    className={styles.rangeInput}
                    value={draft.fuelPercent || (asset.fuelPercent !== null ? String(asset.fuelPercent) : '0')}
                    onChange={(event) => setDraft((current) => ({ ...current, fuelPercent: normalizeIntegerInput(event.target.value).slice(0, 3) }))}
                    disabled={isSaving}
                  />
                  <div className={styles.quickOptionRow}>
                    {QUICK_FUEL_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option}
                        className={`${styles.quickOptionButton} ${draft.fuelPercent === String(option) ? styles.quickOptionButtonActive : ''}`}
                        onClick={() => setDraft((current) => ({ ...current, fuelPercent: String(option) }))}
                        disabled={isSaving}
                      >
                        {option}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeEditor === 'service' ? (
                <label className={styles.field}>
                  <span>Service / check note</span>
                  <textarea
                    placeholder="Example: Checked oil and filters, greased boom, no leaks found…"
                    value={draft.serviceNote}
                    onChange={(event) => setDraft((current) => ({ ...current, serviceNote: event.target.value.slice(0, 1600) }))}
                    disabled={isSaving}
                  />
                </label>
              ) : null}

              {activeEditor === 'notes' ? (
                <label className={styles.field}>
                  <span>Short note</span>
                  <textarea
                    placeholder="Moved to north field, delivered, washed, minor issue noticed…"
                    value={draft.note}
                    onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value.slice(0, 1600) }))}
                    disabled={isSaving}
                  />
                </label>
              ) : null}

              {activeEditor === 'photos' ? (
                <div className={styles.modalStack}>
                  <div className={styles.uploadRow}>
                    <label className={styles.uploadButton}>
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleUploadChange} disabled={isUploading || isSaving} />
                      {isUploading ? 'Uploading…' : 'Add photos'}
                    </label>
                    <p className={styles.helperText}>Use clear light and make the asset easy to identify.</p>
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
                  ) : (
                    <p className={styles.helperText}>No new photos added for this update yet.</p>
                  )}
                </div>
              ) : null}
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => setActiveEditor(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
