'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import styles from './page.module.css';

type FuelStorageStatus = 'active' | 'archived';
type FuelStorageEventType = 'opening_balance' | 'stock_in' | 'asset_issue' | 'dip' | 'adjustment';
type IssueStep = 'asset' | 'usage' | 'beforeFuel' | 'litres' | 'filledFuel' | 'work' | 'notes';
type ScanMode = 'action-choice' | 'fuel-assets' | 'storage-refill' | 'dipstick-note';
type DoneAction = 'asset_issue' | 'storage_refill' | 'dipstick_note';

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
  dipstickNote: string;
  dipstickNoteUpdatedAtIso: string | null;
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
  serialNumber: string;
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
  activityText: string;
  workAreaText: string;
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
const TOTAL_SCAN_PAGES = 9;
const ISSUE_STEPS: IssueStep[] = ['asset', 'usage', 'beforeFuel', 'litres', 'filledFuel', 'work', 'notes'];
const STEP_LABELS: Record<IssueStep, string> = {
  asset: 'Choose asset',
  usage: 'New recorded',
  beforeFuel: 'Fuel before',
  litres: 'Litres issued',
  filledFuel: 'Fuel after',
  work: 'Activity',
  notes: 'Confirm',
};

function normalizeIntegerInput(value: string): string {
  return value.replace(/\D+/g, '');
}

function normalizeFuelCode(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function normalizeOperatorName(value: string): string {
  return value.replace(/\s+/g, ' ').slice(0, 80);
}

function normalizeShortText(value: string, maxLength = 120): string {
  return value.replace(/\s+/g, ' ').slice(0, maxLength);
}

function formatLitres(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} L`;
}


function formatHours(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return 'Not captured';
  return new Intl.NumberFormat('en-ZA').format(Math.round(value));
}

function assetDisplayName(asset: FuelLedgerAsset): string {
  return asset.title || [asset.brandName, asset.modelName].filter(Boolean).join(' ') || asset.assetTypeLabel || 'Asset';
}

function assetSerialText(asset: FuelLedgerAsset): string {
  return asset.serialNumber || 'Not captured';
}


function assetSearchText(asset: FuelLedgerAsset): string {
  return [
    asset.title,
    asset.brandName,
    asset.modelName,
    asset.assetTypeLabel,
    asset.kind,
    asset.serialNumber,
    asset.plateLabel,
    asset.publicAssetCode,
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

function safeNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  const [litres, setLitres] = useState('');
  const [assetFuelPercentBefore, setAssetFuelPercentBefore] = useState('');
  const [assetFuelPercentAfter, setAssetFuelPercentAfter] = useState('');
  const [assetUsageReading, setAssetUsageReading] = useState('');
  const [usageNotApplicable, setUsageNotApplicable] = useState(false);
  const [activityText, setActivityText] = useState('');
  const [workAreaText, setWorkAreaText] = useState('');
  const [note, setNote] = useState('');
  const [scanMode, setScanMode] = useState<ScanMode>('action-choice');
  const [refillLitres, setRefillLitres] = useState('');
  const [refillNote, setRefillNote] = useState('');
  const [dipstickNote, setDipstickNote] = useState('');
  const [showStorageRefillWarning, setShowStorageRefillWarning] = useState(false);
  const [doneAction, setDoneAction] = useState<DoneAction>('asset_issue');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState('Location must be enabled before this fuel QR can continue.');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [issueStep, setIssueStep] = useState<IssueStep>('asset');

  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === assetId) ?? null, [assetId, assets]);
  const selectedAssetName = selectedAsset ? assetDisplayName(selectedAsset) : '';
  const visibleAccountName = accountBusinessName || preview?.accountBusinessName || storage?.accountBusinessName || 'Aim4price account';
  const visibleStorageName = storage?.name || preview?.name || 'Fuel storage';
  const visibleFuelType = storage?.fuelType || preview?.fuelType || 'Diesel';
  const unauthenticated = !storage;
  const issueStepIndex = ISSUE_STEPS.indexOf(issueStep);
  const issueStepNumber = issueStepIndex + 3;
  const issueStepProgress = (issueStepNumber / TOTAL_SCAN_PAGES) * 100;
  const choiceStepProgress = (2 / TOTAL_SCAN_PAGES) * 100;

  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => assetSearchText(asset).includes(query));
  }, [assetSearch, assets]);

  function captureLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setCoordinates(null);
      setLocationStatus('GPS is not available on this device. Location must be enabled to continue.');
      return;
    }

    setIsCapturingLocation(true);
    setLocationStatus('Getting GPS location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCoordinates(nextCoordinates);
        setLocationStatus(`GPS captured: ${nextCoordinates.latitude.toFixed(6)}, ${nextCoordinates.longitude.toFixed(6)}`);
        setIsCapturingLocation(false);
      },
      () => {
        setCoordinates(null);
        setLocationStatus('GPS permission is required. Enable location access and capture GPS again.');
        setIsCapturingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
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
    setIssueStep('asset');
    setScanMode('action-choice');
    setDipstickNote(data.storage.dipstickNote || '');
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
    setLitres('');
    setAssetFuelPercentBefore('');
    setAssetFuelPercentAfter('');
    setAssetUsageReading('');
    setUsageNotApplicable(false);
    setActivityText('');
    setWorkAreaText('');
    setNote('');
    setScanMode('action-choice');
    setRefillLitres('');
    setRefillNote('');
    setDipstickNote('');
    setShowStorageRefillWarning(false);
    setDoneAction('asset_issue');
    setCoordinates(null);
    setLocationStatus('Location must be enabled before this fuel QR can continue.');
    setIssueStep('asset');
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedCode]);

  useEffect(() => {
    if (!assetId) {
      setAssetFuelPercentBefore('');
      setAssetFuelPercentAfter('');
      setAssetUsageReading('');
      setUsageNotApplicable(false);
      return;
    }

    const asset = assets.find((entry) => entry.id === assetId);
    if (!asset) return;

    const currentFuelPercent = asset.fuelPercent !== null ? String(asset.fuelPercent) : '0';
    setAssetFuelPercentBefore(currentFuelPercent);
    setAssetFuelPercentAfter(currentFuelPercent);
    setAssetUsageReading('');
    setUsageNotApplicable(false);
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
      if (!coordinates) {
        throw new Error('Capture GPS first. Location must be enabled before this fuel QR can continue.');
      }

      if (pin.length < 4) {
        throw new Error('Enter the fuel PIN.');
      }

      if (operatorName.trim().length < 2) {
        throw new Error('Enter your name before continuing.');
      }

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

  function validateUsageStep() {
    if (usageNotApplicable) return;

    const reading = safeNumber(assetUsageReading);
    if (reading === null || reading < 0) {
      throw new Error('Enter the new hours / km reading, or mark it not applicable.');
    }

    if (selectedAsset?.hours !== null && typeof selectedAsset?.hours !== 'undefined' && reading < selectedAsset.hours) {
      throw new Error('The new reading cannot be lower than the last recorded reading.');
    }
  }

  function validateCurrentStep() {
    if (issueStep === 'asset' && !assetId) {
      throw new Error('Choose the asset that received fuel.');
    }

    if (issueStep === 'usage') {
      validateUsageStep();
    }

    if (issueStep === 'litres') {
      const litresNumber = safeNumber(litres);

      if (litresNumber === null || litresNumber <= 0) {
        throw new Error('Enter the litres issued to the asset.');
      }
    }

    if (issueStep === 'filledFuel') {
      const beforeNumber = Number(fuelPercentText(assetFuelPercentBefore));
      const afterNumber = Number(fuelPercentText(assetFuelPercentAfter));

      if (afterNumber < beforeNumber) {
        throw new Error('The fuel level after filling cannot be lower than the level before filling.');
      }
    }

    if (issueStep === 'work') {
      if (activityText.trim().length < 2) {
        throw new Error('Enter what activity the asset will do.');
      }
      if (workAreaText.trim().length < 2) {
        throw new Error('Enter where the asset will work.');
      }
    }
  }

  function goToNextStep() {
    setNotice(null);

    try {
      validateCurrentStep();
      const nextStep = ISSUE_STEPS[Math.min(issueStepIndex + 1, ISSUE_STEPS.length - 1)];
      setIssueStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Complete this step before continuing.' });
    }
  }

  function goToPreviousStep() {
    setNotice(null);
    const previousStep = ISSUE_STEPS[Math.max(issueStepIndex - 1, 0)];
    setIssueStep(previousStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleIssueSubmit() {
    setIsSaving(true);
    setNotice(null);

    try {
      if (!assetId) {
        throw new Error('Choose the asset that received fuel.');
      }

      validateUsageStep();

      if (!litres || Number(litres) <= 0) {
        throw new Error('Enter the litres issued.');
      }

      if (Number(fuelPercentText(assetFuelPercentAfter)) < Number(fuelPercentText(assetFuelPercentBefore))) {
        throw new Error('The fuel level after filling cannot be lower than the level before filling.');
      }

      if (operatorName.trim().length < 2) {
        throw new Error('Enter your name on the first page before saving.');
      }

      if (activityText.trim().length < 2 || workAreaText.trim().length < 2) {
        throw new Error('Enter the work activity and where the asset will work.');
      }

      if (!coordinates) {
        throw new Error('GPS location is required. Enable location and capture GPS again.');
      }

      const response = await fetch(`/api/fuel-scan/storage/${encodeURIComponent(normalizedCode)}/issue`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          litres: Number(litres),
          assetFuelPercentBefore: Number(fuelPercentText(assetFuelPercentBefore)),
          assetFuelPercentAfter: Number(fuelPercentText(assetFuelPercentAfter)),
          assetUsageReading: usageNotApplicable ? null : Number(assetUsageReading),
          operatorName,
          activityText,
          workAreaText,
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
      setDoneAction('asset_issue');
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


  function returnToChoice() {
    setNotice(null);
    setShowStorageRefillWarning(false);
    setScanMode('action-choice');
    setIssueStep('asset');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startFuelAssets() {
    setNotice(null);
    setShowStorageRefillWarning(false);
    setScanMode('fuel-assets');
    setIssueStep('asset');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startStorageRefill() {
    setNotice(null);
    setShowStorageRefillWarning(true);
  }

  function confirmStorageRefillStart() {
    setNotice(null);
    setShowStorageRefillWarning(false);
    setRefillLitres('');
    setRefillNote('');
    setScanMode('storage-refill');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelStorageRefillStart() {
    setShowStorageRefillWarning(false);
  }

  function startDipstickNote() {
    setNotice(null);
    setShowStorageRefillWarning(false);
    setDipstickNote(storage?.dipstickNote || '');
    setScanMode('dipstick-note');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleStorageRefillSubmit() {
    setIsSaving(true);
    setNotice(null);

    try {
      if (!storage) {
        throw new Error('Fuel storage not loaded. Scan the QR code again.');
      }

      const litresNumber = safeNumber(refillLitres);
      if (litresNumber === null || litresNumber <= 0) {
        throw new Error('Enter the litres added to the storage tank.');
      }

      if (storage.capacityLitres !== null && storage.currentLitres + litresNumber > storage.capacityLitres + 0.001) {
        throw new Error(`Storage refill exceeds tank capacity. ${formatLitres(storage.currentLitres)} is currently in the tank and capacity is ${formatLitres(storage.capacityLitres)}.`);
      }

      if (operatorName.trim().length < 2) {
        throw new Error('Enter your name before saving the storage refill.');
      }

      if (!coordinates) {
        throw new Error('GPS location is required. Enable location and capture GPS again.');
      }

      const response = await fetch(`/api/fuel-scan/storage/${encodeURIComponent(normalizedCode)}/refill`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          litres: litresNumber,
          operatorName,
          note: refillNote,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          locationText: `GPS ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`,
        }),
      });
      const data = (await response.json()) as PayloadResponse & { event?: FuelLedgerEvent };

      if (!response.ok || !data.ok || !data.storage) {
        throw new Error(data.error || 'Failed to save storage refill.');
      }

      setStorage(data.storage);
      setPreview(data.storage);
      setAccountBusinessName(data.accountBusinessName || data.storage.accountBusinessName || accountBusinessName);
      setAssets(data.assets ?? []);
      setDoneAction('storage_refill');
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
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save storage refill.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDipstickNoteSubmit() {
    setIsSaving(true);
    setNotice(null);

    try {
      if (!storage) {
        throw new Error('Fuel storage not loaded. Scan the QR code again.');
      }

      const noteText = dipstickNote.trim();
      if (noteText.length < 2) {
        throw new Error('Enter the dipstick note before saving.');
      }

      const response = await fetch(`/api/fuel-scan/storage/${encodeURIComponent(normalizedCode)}/dipstick`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dipstickNote: noteText }),
      });
      const data = (await response.json()) as PayloadResponse;

      if (!response.ok || !data.ok || !data.storage) {
        throw new Error(data.error || 'Failed to save dipstick note.');
      }

      setStorage(data.storage);
      setPreview(data.storage);
      setAccountBusinessName(data.accountBusinessName || data.storage.accountBusinessName || accountBusinessName);
      setAssets(data.assets ?? []);
      setDoneAction('dipstick_note');
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
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save dipstick note.' });
    } finally {
      setIsSaving(false);
    }
  }

  function chooseAsset(nextAssetId: string) {
    setAssetId(nextAssetId);
    setAssetSearch('');
    setIssueStep('usage');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderStepControls({ canContinue = true, submit = false }: { canContinue?: boolean; submit?: boolean } = {}) {
    return (
      <div className={styles.stepControls}>
        {issueStepIndex > 0 ? (
          <button type="button" className={styles.secondaryButton} onClick={goToPreviousStep} disabled={isSaving}>
            Back
          </button>
        ) : null}
        {submit ? (
          <button type="button" className={styles.primaryButton} onClick={handleIssueSubmit} disabled={isSaving || !canContinue}>
            {isSaving ? 'Saving...' : 'Save fuel'}
          </button>
        ) : (
          <button type="button" className={styles.primaryButton} onClick={goToNextStep} disabled={!canContinue || isSaving}>
            Continue
          </button>
        )}
      </div>
    );
  }

  function renderFuelSlider(value: string, onChange: (value: string) => void) {
    const currentFuelPercent = fuelPercentText(value);

    return (
      <div className={styles.fuelSliderBlock}>
        <div className={styles.fuelValueRow}>
          <strong>{currentFuelPercent}%</strong>
          <span>Asset fuel gauge</span>
        </div>
        <div className={styles.sliderTrackWrap}>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            className={styles.rangeInput}
            value={currentFuelPercent}
            style={{
              background: `linear-gradient(90deg, #176b4f 0%, #176b4f ${currentFuelPercent}%, #dce8e4 ${currentFuelPercent}%, #dce8e4 100%)`,
            }}
            onChange={(event) => onChange(fuelPercentText(event.target.value))}
          />
          <div className={styles.fuelScale}>
            <span>Empty</span>
            <span>Full</span>
          </div>
        </div>
        <div className={styles.quickFuelGrid}>
          {QUICK_FUEL_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={`${styles.quickFuelButton} ${currentFuelPercent === String(option) ? styles.quickFuelButtonActive : ''}`}
              onClick={() => onChange(String(option))}
              disabled={isSaving}
            >
              {option}%
            </button>
          ))}
        </div>
      </div>
    );
  }


  function renderActionChoice() {
    return (
      <section className={`${styles.stepCard} ${styles.choiceCard}`}>
        <div className={styles.stepTitleBlock}>
          <span>Step 2 of {TOTAL_SCAN_PAGES}</span>
          <h1>Choose fuel action</h1>
          <p>{visibleStorageName} · {formatLitres(storage?.currentLitres)} available</p>
        </div>
        <div className={styles.actionChoiceList}>
          <button type="button" className={`${styles.actionChoiceButton} ${styles.actionChoiceButtonRefill}`} onClick={startStorageRefill} disabled={isSaving}>
            <strong>Storage Refill</strong>
            <span>Add fuel TO this storage tank. The tank level increases and the fuel ledger records Fuel In / Storage Refill.</span>
          </button>
          <button type="button" className={`${styles.actionChoiceButton} ${styles.actionChoiceButtonAssets}`} onClick={startFuelAssets} disabled={isSaving}>
            <strong>Fuel Assets</strong>
            <span>Issue fuel OUT of this storage tank to an asset. This continues the existing Fuel Out process.</span>
          </button>
          <button type="button" className={`${styles.actionChoiceButton} ${styles.actionChoiceButtonNote}`} onClick={startDipstickNote} disabled={isSaving}>
            <strong>Dipstick Note</strong>
            <span>Save an internal dipstick comment only. No litre change and no PDF or Excel fuel entry.</span>
          </button>
        </div>
      </section>
    );
  }

  function renderStorageRefillWarning() {
    if (!showStorageRefillWarning) return null;

    return (
      <div className={styles.confirmationBackdrop} role="dialog" aria-modal="true" aria-labelledby="storage-refill-warning-title">
        <div className={styles.confirmationCard}>
          <div className={styles.confirmationIcon} aria-hidden="true">!</div>
          <h2 id="storage-refill-warning-title">Storage refill warning</h2>
          <p>You are about to add fuel to the storage tank. This will change the tank level and fuel ledger records.</p>
          <div className={styles.confirmationActions}>
            <button type="button" className={styles.secondaryButton} onClick={cancelStorageRefillStart}>
              Back
            </button>
            <button type="button" className={styles.primaryButton} onClick={confirmStorageRefillStart}>
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderStorageRefillStep() {
    const litresNumber = safeNumber(refillLitres);
    const projectedLitres = storage && litresNumber !== null && litresNumber > 0 ? storage.currentLitres + litresNumber : null;

    return (
      <section className={styles.stepCard}>
        <div className={styles.stepTitleBlock}>
          <span>Storage refill</span>
          <h1>Add fuel to tank</h1>
          <p>Adds delivered fuel into {visibleStorageName} and updates the fuel ledger.</p>
        </div>
        <div className={styles.storageNoticeBox}>
          <strong>Tank level increases</strong>
          <span>Only enter fuel physically delivered into this storage tank.</span>
        </div>
        <div className={styles.compactMetaGrid}>
          <div><span>Current level</span><strong>{formatLitres(storage?.currentLitres)}</strong></div>
          <div><span>After refill</span><strong>{projectedLitres !== null ? formatLitres(projectedLitres) : '—'}</strong></div>
        </div>
        <label className={styles.field}>
          <span>Litres added</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={refillLitres}
            onChange={(event) => setRefillLitres(event.target.value)}
            placeholder="Litres added"
            autoFocus
          />
        </label>
        <label className={styles.field}>
          <span>Refill note (optional)</span>
          <textarea value={refillNote} onChange={(event) => setRefillNote(event.target.value)} rows={3} placeholder="Delivery note, invoice or driver" />
        </label>
        <div className={styles.stepControls}>
          <button type="button" className={styles.secondaryButton} onClick={returnToChoice} disabled={isSaving}>
            Back
          </button>
          <button type="button" className={styles.primaryButton} onClick={handleStorageRefillSubmit} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save refill'}
          </button>
        </div>
      </section>
    );
  }

  function renderDipstickNoteStep() {
    return (
      <section className={styles.stepCard}>
        <div className={styles.stepTitleBlock}>
          <span>Dipstick note</span>
          <h1>Record dipstick note</h1>
          <p>Saves a note on {visibleStorageName}. No litre change. No export entry.</p>
        </div>
        <div className={styles.storageNoticeBox}>
          <strong>Note only</strong>
          <span>Shows on the storage tank card until updated or cleared.</span>
        </div>
        <label className={styles.field}>
          <span>Note</span>
          <textarea
            value={dipstickNote}
            onChange={(event) => setDipstickNote(event.target.value.slice(0, 700))}
            rows={5}
            placeholder="Example: Dipstick lower than system level."
            autoFocus
          />
        </label>
        <div className={styles.stepControls}>
          <button type="button" className={styles.secondaryButton} onClick={returnToChoice} disabled={isSaving}>
            Back
          </button>
          <button type="button" className={styles.primaryButton} onClick={handleDipstickNoteSubmit} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save note'}
          </button>
        </div>
      </section>
    );
  }

  function renderScanProgress(label: string, title: string, stepText: string, width: number) {
    return (
      <div className={styles.stepProgress} aria-label={`${label}: ${title}`}>
        <div>
          <span>{label}</span>
          <strong>{title}</strong>
        </div>
        <small>{stepText}</small>
        <i><b style={{ width: `${width}%` }} /></i>
      </div>
    );
  }

  function renderIssueStep() {
    if (issueStep === 'asset') {
      return (
        <section className={`${styles.stepCard} ${styles.assetStepCard}`}>
          <div className={styles.stepTitleBlock}>
            <span>Step {issueStepNumber} of {TOTAL_SCAN_PAGES}</span>
            <h1>Choose asset</h1>
            <p>Tap the asset that received fuel.</p>
          </div>
          <button type="button" className={styles.secondaryButton} onClick={returnToChoice} disabled={isSaving}>
            Back to fuel actions
          </button>
          <div className={styles.assetSearchWrap}>
            <label className={styles.searchField}>
              <span>Search</span>
              <input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Search asset title or serial" autoFocus />
            </label>
            <div className={styles.assetSearchSummary}>
              <span>{filteredAssets.length} {filteredAssets.length === 1 ? 'asset' : 'assets'} available</span>
              {assetSearch.trim() ? (
                <button type="button" onClick={() => setAssetSearch('')}>
                  Clear search
                </button>
              ) : null}
            </div>
          </div>
          <div className={styles.assetChoiceList}>
            {filteredAssets.map((asset) => {
              const displayName = assetDisplayName(asset);
              const typeText = asset.assetTypeLabel || asset.kind || 'Asset';

              return (
                <button
                  type="button"
                  key={asset.id}
                  className={`${styles.assetChoiceButton} ${asset.id === assetId ? styles.assetChoiceButtonActive : ''}`}
                  onClick={() => chooseAsset(asset.id)}
                  aria-label={`Choose ${displayName}`}
                >
                  <div className={styles.assetChoiceTopline}>
                    <span>{typeText}</span>
                    <i aria-hidden="true">Tap</i>
                  </div>
                  <strong>{displayName}</strong>
                  <div className={styles.assetDetailRows}>
                    <span><b>Serial</b><em>{assetSerialText(asset)}</em></span>
                    <span><b>Last recorded</b><em>{formatHours(asset.hours)}</em></span>
                  </div>
                </button>
              );
            })}
            {!filteredAssets.length ? <p className={styles.emptyText}>No assets found.</p> : null}
          </div>
        </section>
      );
    }

    if (issueStep === 'usage') {
      return (
        <section className={styles.stepCard}>
          <div className={styles.stepTitleBlock}>
            <span>Step {issueStepNumber} of {TOTAL_SCAN_PAGES}</span>
            <h1>New recorded</h1>
            <p>{selectedAssetName}</p>
          </div>
          <div className={styles.readingCard}>
            <span>Last recorded</span>
            <strong>{formatHours(selectedAsset?.hours)}</strong>
          </div>
          <label className={styles.field}>
            <span>New hours / km reading</span>
            <input
              type="number"
              min="0"
              step="1"
              value={assetUsageReading}
              onChange={(event) => {
                setAssetUsageReading(event.target.value);
                setUsageNotApplicable(false);
              }}
              placeholder="Current reading"
              disabled={usageNotApplicable}
              autoFocus
            />
          </label>
          <button
            type="button"
            className={`${styles.optionButton} ${usageNotApplicable ? styles.optionButtonActive : ''}`}
            onClick={() => {
              setUsageNotApplicable((current) => !current);
              setAssetUsageReading('');
            }}
          >
            No hour / km meter on this asset
          </button>
          {renderStepControls()}
        </section>
      );
    }

    if (issueStep === 'beforeFuel') {
      return (
        <section className={styles.stepCard}>
          <div className={styles.stepTitleBlock}>
            <span>Step {issueStepNumber} of {TOTAL_SCAN_PAGES}</span>
            <h1>Fuel before</h1>
            <p>Set the asset fuel gauge before filling.</p>
          </div>
          {renderFuelSlider(assetFuelPercentBefore, setAssetFuelPercentBefore)}
          {renderStepControls()}
        </section>
      );
    }

    if (issueStep === 'litres') {
      return (
        <section className={styles.stepCard}>
          <div className={styles.stepTitleBlock}>
            <span>Step {issueStepNumber} of {TOTAL_SCAN_PAGES}</span>
            <h1>Litres issued</h1>
            <p>Enter the litres filled into the selected asset.</p>
          </div>
          <label className={styles.field}>
            <span>Litres issued</span>
            <input type="number" min="0" step="0.01" value={litres} onChange={(event) => setLitres(event.target.value)} placeholder="Litres issued" autoFocus />
          </label>
          <div className={styles.compactMetaGrid}>
            <div><span>Asset</span><strong>{selectedAssetName || '—'}</strong></div>
            <div><span>Fuel before</span><strong>{fuelPercentText(assetFuelPercentBefore)}%</strong></div>
          </div>
          {renderStepControls()}
        </section>
      );
    }

    if (issueStep === 'filledFuel') {
      return (
        <section className={styles.stepCard}>
          <div className={styles.stepTitleBlock}>
            <span>Step {issueStepNumber} of {TOTAL_SCAN_PAGES}</span>
            <h1>Fuel after</h1>
            <p>Set the asset fuel gauge after filling.</p>
          </div>
          <div className={styles.compactMetaGrid}>
            <div><span>Litres</span><strong>{litres ? formatLitres(Number(litres)) : '—'}</strong></div>
            <div><span>Fuel before</span><strong>{fuelPercentText(assetFuelPercentBefore)}%</strong></div>
          </div>
          {renderFuelSlider(assetFuelPercentAfter, setAssetFuelPercentAfter)}
          {renderStepControls()}
        </section>
      );
    }

    if (issueStep === 'work') {
      return (
        <section className={styles.stepCard}>
          <div className={styles.stepTitleBlock}>
            <span>Step {issueStepNumber} of {TOTAL_SCAN_PAGES}</span>
            <h1>Activity</h1>
            <p>What will the asset do, and where?</p>
          </div>
          <label className={styles.field}>
            <span>What activity</span>
            <input value={activityText} onChange={(event) => setActivityText(normalizeShortText(event.target.value))} placeholder="Example: Planting, spraying, transport" autoFocus />
          </label>
          <label className={styles.field}>
            <span>Where</span>
            <input value={workAreaText} onChange={(event) => setWorkAreaText(normalizeShortText(event.target.value))} placeholder="Example: Bashan B6, Shed 2, Road camp" />
          </label>
          {renderStepControls()}
        </section>
      );
    }

    return (
      <section className={styles.stepCard}>
        <div className={styles.stepTitleBlock}>
          <span>Step {issueStepNumber} of {TOTAL_SCAN_PAGES}</span>
          <h1>Notes + confirm</h1>
          <p>Check the details, then save.</p>
        </div>
        <label className={styles.field}>
          <span>Optional note</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Optional note" autoFocus />
        </label>
        <div className={styles.reviewBox}>
          <div><span>Asset</span><strong>{selectedAssetName || '—'}</strong></div>
          <div><span>Litres</span><strong>{litres ? formatLitres(Number(litres)) : '—'}</strong></div>
          <div><span>Fuel</span><strong>{fuelPercentText(assetFuelPercentBefore)}% → {fuelPercentText(assetFuelPercentAfter)}%</strong></div>
          <div><span>Your name</span><strong>{operatorName || '—'}</strong></div>
          <div><span>Activity</span><strong>{activityText || '—'}</strong></div>
          <div><span>Where</span><strong>{workAreaText || '—'}</strong></div>
        </div>
        {renderStepControls({ submit: true })}
      </section>
    );
  }

  if (isLoading) {
    return null;
  }

  if (isDone) {
    const doneCopy: Record<DoneAction, { title: string; message: string }> = {
      asset_issue: {
        title: 'Fuel out saved.',
        message: 'The fuel issue was added to the fuel ledger and the asset record.',
      },
      storage_refill: {
        title: 'Storage refill saved.',
        message: 'The storage tank level was increased and Fuel In / Storage Refill was added to the fuel ledger.',
      },
      dipstick_note: {
        title: 'Dipstick note saved.',
        message: 'The note was saved on the storage tank card only. Tank litres and exports were not changed.',
      },
    };

    return (
      <main className={styles.scanPage}>
        <section className={styles.thankYouScreen}>
          <h1>{doneCopy[doneAction].title}</h1>
          <p>{doneCopy[doneAction].message}</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.scanPage}>
      <div className={styles.scanShell}>
        {notice ? <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : styles.noticeSuccess}`}>{notice.message}</div> : null}

        {unauthenticated ? (
          <section className={`${styles.pinStepCard} ${!coordinates ? styles.pinStepCardBlocked : ''}`}>
            <div className={styles.qrTitleBlock}>
              <span>Fuel QR for</span>
              <h1>{visibleAccountName}</h1>
              <p>{visibleStorageName} · {visibleFuelType}</p>
            </div>
            <form className={styles.pinForm} onSubmit={handlePinSubmit}>
              <label className={styles.field}>
                <span>Fuel PIN</span>
                <input
                  value={pin}
                  onChange={(event) => setPin(normalizeIntegerInput(event.target.value).slice(0, 8))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="4 to 8 digits"
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Your name</span>
                <input
                  value={operatorName}
                  onChange={(event) => setOperatorName(normalizeOperatorName(event.target.value))}
                  autoComplete="name"
                  placeholder="Name of person scanning"
                  required
                />
              </label>
              {coordinates ? (
                <div className={`${styles.locationGate} ${styles.locationGateReady}`}>
                  <div>
                    <strong>Location ready</strong>
                    <span>{locationStatus}</span>
                  </div>
                  <button type="button" onClick={captureLocation} disabled={isCapturingLocation}>
                    {isCapturingLocation ? 'Capturing...' : 'Recapture GPS'}
                  </button>
                </div>
              ) : null}
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={isAuthenticating || pin.length < 4 || !coordinates || operatorName.trim().length < 2}
              >
                {isAuthenticating ? 'Checking...' : 'Continue'}
              </button>
            </form>

            {!coordinates ? (
              <div className={styles.locationPromptBackdrop} role="dialog" aria-modal="true" aria-labelledby="fuel-location-title">
                <div className={styles.locationPromptCard}>
                  <div className={styles.locationPromptIcon} aria-hidden="true">⌖</div>
                  <h2 id="fuel-location-title">Keep location on</h2>
                  <p>Every fuel issue saves a GPS point automatically. Allow location access on this phone before continuing.</p>
                  <span>{locationStatus}</span>
                  <button type="button" className={styles.primaryButton} onClick={captureLocation} disabled={isCapturingLocation}>
                    {isCapturingLocation ? 'Capturing...' : 'Continue'}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : scanMode === 'action-choice' ? (
          <>
            {renderScanProgress('Fuel QR', 'Choose action', `2/${TOTAL_SCAN_PAGES}`, choiceStepProgress)}
            {renderActionChoice()}
            {renderStorageRefillWarning()}
          </>
        ) : scanMode === 'storage-refill' ? (
          <>
            {renderScanProgress('Storage refill', 'Add fuel to tank', 'Fuel In', 100)}
            {renderStorageRefillStep()}
          </>
        ) : scanMode === 'dipstick-note' ? (
          <>
            {renderScanProgress('Dipstick note', 'Internal note', 'No export', 100)}
            {renderDipstickNoteStep()}
          </>
        ) : (
          <>
            {renderScanProgress('Fuel Assets', STEP_LABELS[issueStep], `${issueStepNumber}/${TOTAL_SCAN_PAGES}`, issueStepProgress)}
            {renderIssueStep()}
          </>
        )}
      </div>
    </main>
  );
}
