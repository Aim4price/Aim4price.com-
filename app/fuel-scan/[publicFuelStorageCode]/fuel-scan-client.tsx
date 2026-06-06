'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import styles from './page.module.css';

type FuelStorageStatus = 'active' | 'archived';
type FuelStorageEventType = 'opening_balance' | 'stock_in' | 'asset_issue' | 'dip' | 'adjustment';
type IssueStep = 'asset' | 'usage' | 'beforeFuel' | 'filledFuel' | 'operator' | 'work' | 'notes';

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
const ISSUE_STEPS: IssueStep[] = ['asset', 'usage', 'beforeFuel', 'filledFuel', 'operator', 'work', 'notes'];
const STEP_LABELS: Record<IssueStep, string> = {
  asset: 'Choose asset',
  usage: 'Hours / km',
  beforeFuel: 'Fuel before',
  filledFuel: 'Fuel filled',
  operator: 'Operator',
  work: 'Activity',
  notes: 'Notes',
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

function formatPercent(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}%`;
}

function formatHours(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return 'Not captured';
  return new Intl.NumberFormat('en-ZA').format(Math.round(value));
}

function assetDisplayName(asset: FuelLedgerAsset): string {
  return asset.title || [asset.brandName, asset.modelName].filter(Boolean).join(' ') || asset.assetTypeLabel || 'Asset';
}

function assetIdentityLine(asset: FuelLedgerAsset): string {
  const serial = asset.serialNumber || 'Serial not captured';
  const plate = asset.plateLabel || 'No number plate';
  return `Serial: ${serial} · Plate: ${plate}`;
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
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState('Capture GPS before entering the fuel PIN.');
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
  const issueStepNumber = issueStepIndex + 1;
  const issueStepProgress = ((issueStepNumber || 1) / ISSUE_STEPS.length) * 100;

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
    setCoordinates(null);
    setLocationStatus('Capture GPS before entering the fuel PIN.');
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

    if (issueStep === 'filledFuel') {
      const litresNumber = safeNumber(litres);
      const beforeNumber = Number(fuelPercentText(assetFuelPercentBefore));
      const afterNumber = Number(fuelPercentText(assetFuelPercentAfter));

      if (litresNumber === null || litresNumber <= 0) {
        throw new Error('Enter the litres filled into the asset.');
      }

      if (afterNumber < beforeNumber) {
        throw new Error('The fuel level after filling cannot be lower than the level before filling.');
      }
    }

    if (issueStep === 'operator' && operatorName.trim().length < 2) {
      throw new Error('Enter the manager or operator name.');
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

      if (operatorName.trim().length < 2) {
        throw new Error('Enter the manager or operator name.');
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
            {isSaving ? 'Saving...' : 'Save fuel issue'}
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
    return (
      <div className={styles.fuelSliderBlock}>
        <strong>{fuelPercentText(value)}%</strong>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          className={styles.rangeInput}
          value={fuelPercentText(value)}
          onChange={(event) => onChange(fuelPercentText(event.target.value))}
        />
        <div className={styles.quickFuelGrid}>
          {QUICK_FUEL_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={`${styles.quickFuelButton} ${fuelPercentText(value) === String(option) ? styles.quickFuelButtonActive : ''}`}
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

  function renderIssueStep() {
    if (issueStep === 'asset') {
      return (
        <section className={`${styles.stepCard} ${styles.assetStepCard}`}>
          <div className={styles.stepTitleBlock}>
            <span>Step {issueStepNumber} of {ISSUE_STEPS.length}</span>
            <h1>Choose asset</h1>
            <p>Tap the asset that received fuel.</p>
          </div>
          <label className={styles.searchField}>
            <span>Search</span>
            <input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Search asset title, serial or plate" autoFocus />
          </label>
          <div className={styles.assetChoiceList}>
            {filteredAssets.map((asset) => (
              <button
                type="button"
                key={asset.id}
                className={`${styles.assetChoiceButton} ${asset.id === assetId ? styles.assetChoiceButtonActive : ''}`}
                onClick={() => chooseAsset(asset.id)}
              >
                <strong>{assetDisplayName(asset)}</strong>
                <span>{assetIdentityLine(asset)}</span>
              </button>
            ))}
            {!filteredAssets.length ? <p className={styles.emptyText}>No assets found.</p> : null}
          </div>
        </section>
      );
    }

    if (issueStep === 'usage') {
      return (
        <section className={styles.stepCard}>
          <div className={styles.stepTitleBlock}>
            <span>Step {issueStepNumber} of {ISSUE_STEPS.length}</span>
            <h1>Hours / km</h1>
            <p>{selectedAssetName}</p>
          </div>
          <div className={styles.readingCard}>
            <span>Last recorded</span>
            <strong>{formatHours(selectedAsset?.hours)}</strong>
          </div>
          <label className={styles.field}>
            <span>New recorded hours / km</span>
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
            <span>Step {issueStepNumber} of {ISSUE_STEPS.length}</span>
            <h1>Fuel before</h1>
            <p>Set the asset fuel gauge before filling.</p>
          </div>
          {renderFuelSlider(assetFuelPercentBefore, setAssetFuelPercentBefore)}
          {renderStepControls()}
        </section>
      );
    }

    if (issueStep === 'filledFuel') {
      return (
        <section className={styles.stepCard}>
          <div className={styles.stepTitleBlock}>
            <span>Step {issueStepNumber} of {ISSUE_STEPS.length}</span>
            <h1>Fuel filled</h1>
            <p>Enter litres and the fuel gauge after filling.</p>
          </div>
          <label className={styles.field}>
            <span>Litres filled</span>
            <input type="number" min="0" step="0.01" value={litres} onChange={(event) => setLitres(event.target.value)} placeholder="Litres" autoFocus />
          </label>
          <div className={styles.compactMetaGrid}>
            <div><span>Before</span><strong>{fuelPercentText(assetFuelPercentBefore)}%</strong></div>
            <div><span>After</span><strong>{fuelPercentText(assetFuelPercentAfter)}%</strong></div>
          </div>
          {renderFuelSlider(assetFuelPercentAfter, setAssetFuelPercentAfter)}
          {renderStepControls()}
        </section>
      );
    }

    if (issueStep === 'operator') {
      return (
        <section className={styles.stepCard}>
          <div className={styles.stepTitleBlock}>
            <span>Step {issueStepNumber} of {ISSUE_STEPS.length}</span>
            <h1>Operator</h1>
            <p>Who issued or received the fuel?</p>
          </div>
          <label className={styles.field}>
            <span>Manager / operator</span>
            <input value={operatorName} onChange={(event) => setOperatorName(normalizeOperatorName(event.target.value))} placeholder="Name" autoFocus />
          </label>
          {renderStepControls()}
        </section>
      );
    }

    if (issueStep === 'work') {
      return (
        <section className={styles.stepCard}>
          <div className={styles.stepTitleBlock}>
            <span>Step {issueStepNumber} of {ISSUE_STEPS.length}</span>
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
          <span>Step {issueStepNumber} of {ISSUE_STEPS.length}</span>
          <h1>Notes</h1>
          <p>Add anything important, then save.</p>
        </div>
        <label className={styles.field}>
          <span>Optional note</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Optional note" autoFocus />
        </label>
        <div className={styles.reviewBox}>
          <div><span>Asset</span><strong>{selectedAssetName || '—'}</strong></div>
          <div><span>Litres</span><strong>{litres ? formatLitres(Number(litres)) : '—'}</strong></div>
          <div><span>Fuel</span><strong>{fuelPercentText(assetFuelPercentBefore)}% → {fuelPercentText(assetFuelPercentAfter)}%</strong></div>
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
    return (
      <main className={styles.scanPage}>
        <section className={styles.thankYouScreen}>
          <h1>Saved.</h1>
          <p>The fuel issue was added to the fuel ledger and the asset record.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.scanPage}>
      <div className={styles.scanShell}>
        {notice ? <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : styles.noticeSuccess}`}>{notice.message}</div> : null}

        {unauthenticated ? (
          <section className={styles.pinStepCard}>
            <div className={styles.qrTitleBlock}>
              <span>Fuel QR for</span>
              <h1>{visibleAccountName}</h1>
              <p>{visibleStorageName} · {visibleFuelType}</p>
            </div>
            <form className={styles.pinForm} onSubmit={handlePinSubmit}>
              <div className={`${styles.locationGate} ${coordinates ? styles.locationGateReady : ''}`}>
                <div>
                  <strong>Location required</strong>
                  <span>{locationStatus}</span>
                </div>
                <button type="button" onClick={captureLocation} disabled={isCapturingLocation}>
                  {isCapturingLocation ? 'Capturing...' : coordinates ? 'Recapture GPS' : 'Capture GPS'}
                </button>
              </div>
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
              <button type="submit" className={styles.primaryButton} disabled={isAuthenticating || pin.length < 4 || !coordinates}>
                {isAuthenticating ? 'Checking...' : 'Continue'}
              </button>
            </form>
          </section>
        ) : (
          <>
            <div className={styles.stepProgress} aria-label={`Step ${issueStepNumber} of ${ISSUE_STEPS.length}: ${STEP_LABELS[issueStep]}`}>
              <div>
                <span>Fuel issue</span>
                <strong>{STEP_LABELS[issueStep]}</strong>
              </div>
              <small>{issueStepNumber}/{ISSUE_STEPS.length}</small>
              <i><b style={{ width: `${issueStepProgress}%` }} /></i>
            </div>
            {renderIssueStep()}
          </>
        )}
      </div>
    </main>
  );
}
