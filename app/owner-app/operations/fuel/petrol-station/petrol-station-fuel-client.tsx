'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import FuelLocationModal, { type FuelLocationCoordinates } from '../../../../../components/FuelLocationModal';
import BalancedHeadingText from '../../../balanced-heading';
import styles from './page.module.css';

type FuelAsset = {
  id: string;
  title: string;
  assetTypeLabel: string;
  brandName: string;
  modelName: string;
  serialNumber: string;
  plateLabel: string;
  hours: number | null;
  fuelPercent: number | null;
  yearModel: number | null;
  lifeWorkedPercent: number | null;
  canReceiveFuel: boolean;
  usageMetric: 'hours' | 'km' | 'both' | 'percentage' | 'none';
  workUseExcluded: boolean;
  workUseExclusionReason: string;
};

type FuelLedgerResponse = {
  ok?: boolean;
  assets?: FuelAsset[];
  error?: string;
};

type UploadResponse = {
  ok?: boolean;
  uploads?: Array<{
    uploadId: string;
    url: string;
    fileName: string;
    contentType: string;
    byteSize: number;
  }>;
  error?: string;
};

type SaveResponse = {
  ok?: boolean;
  pendingReview?: boolean;
  message?: string;
  error?: string;
};

type Step = 'asset' | 'usage' | 'before' | 'fuel' | 'amount' | 'after' | 'activity' | 'slip';
type FuelType = 'diesel' | 'petrol';

const STEPS: Step[] = ['asset', 'usage', 'before', 'fuel', 'amount', 'after', 'activity', 'slip'];
const STEP_TITLES: Record<Step, string> = {
  asset: 'Choose asset',
  usage: 'Update usage',
  before: 'Fuel before',
  fuel: 'Fuel type',
  amount: 'Fuel and cost',
  after: 'Fuel after',
  activity: 'Petrol station',
  slip: 'Proof (optional)',
};

function todayDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function currentTime(): string {
  return new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function numberValue(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function assetName(asset: FuelAsset): string {
  return asset.title || [asset.brandName, asset.modelName].filter(Boolean).join(' ') || 'Saved asset';
}

function assetMeta(asset: FuelAsset): string {
  return asset.plateLabel || asset.serialNumber || asset.assetTypeLabel || 'Asset details not captured';
}

function serialDisplayText(asset: FuelAsset): string {
  return asset.serialNumber || 'Not captured';
}

function yearDisplayText(asset: FuelAsset): string {
  if (asset.yearModel) return String(asset.yearModel);
  return asset.title.match(/\b(?:19|20)\d{2}\b/)?.[0] || 'Not captured';
}

function hasMeter(asset: FuelAsset | null): boolean {
  return Boolean(asset && ['hours', 'km', 'both'].includes(asset.usageMetric));
}

function meterLabel(asset: FuelAsset | null): string {
  return asset?.usageMetric === 'km' || (asset?.usageMetric === 'both' && asset.assetTypeLabel.toLowerCase().includes('vehicle'))
    ? 'Current kilometre reading'
    : 'Current hour reading';
}

function meterUnit(asset: FuelAsset | null): 'km' | 'hours' {
  return meterLabel(asset).includes('kilometre') ? 'km' : 'hours';
}

function usageDisplayText(asset: FuelAsset): string {
  if (asset.usageMetric === 'none') return 'Not applicable';
  if (asset.usageMetric === 'percentage') {
    return asset.lifeWorkedPercent === null ? 'Not captured' : `${asset.lifeWorkedPercent.toLocaleString('en-ZA')}%`;
  }
  if (asset.hours === null) return 'Not captured';
  return `${asset.hours.toLocaleString('en-ZA')} ${meterUnit(asset)}`;
}

function clampFuel(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return String(Math.max(0, Math.min(100, Math.round(parsed))));
}

type PetrolStationFuelClientProps = {
  operatorName: string;
  fieldManagerMode?: boolean;
};

export default function PetrolStationFuelClient({
  operatorName,
  fieldManagerMode = false,
}: PetrolStationFuelClientProps) {
  const [assets, setAssets] = useState<FuelAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState<Step>('asset');
  const [assetId, setAssetId] = useState('');
  const [search, setSearch] = useState('');
  const [usageReading, setUsageReading] = useState('');
  const [usageNotApplicable, setUsageNotApplicable] = useState(false);
  const [fuelBefore, setFuelBefore] = useState('0');
  const [fuelAfter, setFuelAfter] = useState('100');
  const [fuelType, setFuelType] = useState<FuelType>('diesel');
  const [litres, setLitres] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [stationName, setStationName] = useState('');
  const [slipNumber, setSlipNumber] = useState('');
  const [documentDate, setDocumentDate] = useState(todayDate);
  const [activityText, setActivityText] = useState('Refuelling at petrol station');
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [coordinates, setCoordinates] = useState<FuelLocationCoordinates | null>(null);
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === assetId) ?? null, [assetId, assets]);
  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const visibleAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => [
      assetName(asset),
      assetMeta(asset),
      asset.brandName,
      asset.modelName,
      asset.serialNumber,
      asset.yearModel,
      asset.hours,
    ]
      .join(' ')
      .toLowerCase()
      .includes(query));
  }, [assets, search]);

  const acceptLocation = useCallback((nextCoordinates: FuelLocationCoordinates) => {
    setCoordinates(nextCoordinates);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAssets() {
      setIsLoading(true);
      setLoadError('');

      try {
        const requestOptions: RequestInit = {
          credentials: 'include',
          cache: 'no-store',
        };
        const response = fieldManagerMode
          ? await fetch('/api/field-manager/petrol-station', requestOptions)
          : await fetch('/api/fuel', requestOptions);
        const payload = (await response.json().catch(() => null)) as FuelLedgerResponse | null;

        if (response.status === 401) {
          window.location.replace(fieldManagerMode ? '/field-manager/login' : '/owner-app/login');
          return;
        }

        if (!response.ok || !payload?.ok || !Array.isArray(payload.assets)) {
          throw new Error(payload?.error || 'Failed to load assets that can receive fuel.');
        }

        if (active) {
          setAssets(payload.assets.filter((asset) => asset.canReceiveFuel && !asset.workUseExcluded));
        }
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : 'Failed to load fuel assets.');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadAssets();
    return () => { active = false; };
  }, [fieldManagerMode]);

  useEffect(() => {
    if (!receipt || !receipt.type.startsWith('image/')) {
      setReceiptPreview('');
      return undefined;
    }

    const url = URL.createObjectURL(receipt);
    setReceiptPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [receipt]);

  function selectAsset(asset: FuelAsset) {
    setAssetId(asset.id);
    setFuelBefore(String(asset.fuelPercent ?? 0));
    setFuelAfter(String(Math.max(asset.fuelPercent ?? 0, 100)));
    setUsageReading('');
    setUsageNotApplicable(!hasMeter(asset));
    setSearch('');
    setStep('usage');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validateStep(): string {
    if (step === 'asset' && !selectedAsset) return 'Choose the asset being fuelled.';
    if (step === 'usage' && hasMeter(selectedAsset) && !usageNotApplicable) {
      const reading = numberValue(usageReading);
      const savedReading = selectedAsset?.hours;
      if (reading === null) return `Enter the ${meterLabel(selectedAsset).toLowerCase()}.`;
      if (savedReading !== null && typeof savedReading !== 'undefined' && reading < savedReading) {
        return 'The new reading cannot be lower than the saved reading.';
      }
    }
    if (step === 'amount') {
      if ((numberValue(litres) ?? 0) <= 0) return 'Enter litres greater than 0.';
      if ((numberValue(totalAmount) ?? 0) <= 0) return 'Enter the total amount paid.';
    }
    if (step === 'after' && Number(clampFuel(fuelAfter)) < Number(clampFuel(fuelBefore))) {
      return 'The fuel level after filling cannot be lower than before filling.';
    }
    if (step === 'activity') {
      if (stationName.trim().length < 2) return 'Enter the petrol station name.';
      if (activityText.trim().length < 2) return 'Enter the reason or activity for this fuel.';
    }
    return '';
  }

  function nextStep() {
    const error = validateStep();
    if (error) {
      setNotice(error);
      return;
    }

    setNotice('');
    setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function previousStep() {
    setNotice('');
    setStep(STEPS[Math.max(stepIndex - 1, 0)]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleReceiptChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setReceipt(file);
    setNotice('');
    event.target.value = '';
  }

  async function saveFuelCost() {
    const validationError = validateStep();
    if (validationError) {
      setNotice(validationError);
      return;
    }
    if (!coordinates) {
      setNotice('GPS location is required before saving this fuel cost.');
      return;
    }
    if (!selectedAsset) return;

    setIsSaving(true);
    setNotice('');

    try {
      let upload: NonNullable<UploadResponse['uploads']>[number] | null = null;
      if (receipt) {
        const formData = new FormData();
        formData.append('file', receipt);

        const uploadOptions: RequestInit = {
          method: 'POST',
          credentials: 'include',
          body: formData,
        };
        const uploadResponse = fieldManagerMode
          ? await fetch('/api/field-manager/petrol-station/upload', uploadOptions)
          : await fetch('/api/fuel/slips/upload', uploadOptions);
        const uploadPayload = (await uploadResponse.json().catch(() => null)) as UploadResponse | null;
        upload = uploadPayload?.uploads?.[0] ?? null;

        if (!uploadResponse.ok || !uploadPayload?.ok || !upload) {
          throw new Error(uploadPayload?.error || 'The fuel slip photo could not be uploaded.');
        }
      }

      const litresNumber = numberValue(litres) as number;
      const totalNumber = numberValue(totalAmount) as number;
      const unit = meterUnit(selectedAsset);
      const reading = usageNotApplicable ? null : numberValue(usageReading);
      const locationText = `GPS ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;

      const saveOptions: RequestInit = {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: upload ? 'automatic' : 'manual',
          targetType: 'asset',
          targetId: selectedAsset.id,
          assetId: selectedAsset.id,
          uploadId: upload?.uploadId || '',
          documentFileUrl: upload?.url || '',
          originalFilename: upload?.fileName || '',
          contentType: upload?.contentType || '',
          byteSize: upload?.byteSize ?? null,
          supplierName: stationName.trim(),
          slipNumber: slipNumber.trim(),
          documentDate,
          documentTime: currentTime(),
          fuelType,
          litres: litresNumber,
          pricePerLitre: Math.round((totalNumber / litresNumber) * 10_000) / 10_000,
          totalAmount: totalNumber,
          odometerReading: unit === 'km' ? reading : null,
          hourMeterReading: unit === 'hours' ? reading : null,
          operatorName: operatorName.trim() || (fieldManagerMode ? 'Field Manager' : 'Owner'),
          activityText: activityText.trim(),
          workAreaText: stationName.trim(),
          note: note.trim(),
          assetFuelPercentBefore: Number(clampFuel(fuelBefore)),
          assetFuelPercentAfter: Number(clampFuel(fuelAfter)),
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          locationText,
          gpsAccuracyMeters: coordinates.accuracyMeters,
          clientCapturedAt: coordinates.capturedAtIso,
          extractionStatus: 'manual',
          reviewRequired: false,
          extractionWarnings: [],
        }),
      };
      const response = fieldManagerMode
        ? await fetch('/api/field-manager/petrol-station', saveOptions)
        : await fetch('/api/fuel/slips', saveOptions);
      const payload = (await response.json().catch(() => null)) as SaveResponse | null;

      if (!response.ok || !payload?.ok || payload.pendingReview) {
        throw new Error(payload?.error || payload?.message || 'The fuel cost could not be saved.');
      }

      setIsDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The fuel cost could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  function resetFlow() {
    setStep('asset');
    setAssetId('');
    setSearch('');
    setUsageReading('');
    setUsageNotApplicable(false);
    setFuelBefore('0');
    setFuelAfter('100');
    setFuelType('diesel');
    setLitres('');
    setTotalAmount('');
    setStationName('');
    setSlipNumber('');
    setDocumentDate(todayDate());
    setActivityText('Refuelling at petrol station');
    setNote('');
    setReceipt(null);
    setNotice('');
    setIsDone(false);
  }

  function renderSlider(value: string, onChange: (next: string) => void) {
    const percent = clampFuel(value);
    return (
      <div className={styles.fuelGauge}>
        <strong>{percent}%</strong>
        <span>Asset fuel gauge</span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={percent}
          style={{ background: `linear-gradient(90deg, #236851 0%, #236851 ${percent}%, #dce8e4 ${percent}%, #dce8e4 100%)` }}
          onChange={(event) => onChange(clampFuel(event.target.value))}
        />
        <div className={styles.gaugeScale}><span>Empty</span><span>Full</span></div>
        <div className={styles.quickGrid}>
          {[25, 50, 75, 100].map((option) => (
            <button
              key={option}
              type="button"
              className={percent === String(option) ? styles.quickActive : ''}
              onClick={() => onChange(String(option))}
            >
              {option}%
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderStep() {
    if (step === 'asset') {
      return (
        <>
          <label className={styles.searchField}>
            <span className={styles.visuallyHidden}>Search assets</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search asset, model, reg or serial" />
          </label>
          <div className={styles.assetList}>
            {visibleAssets.map((asset) => (
              <article key={asset.id} className={styles.assetCard}>
                <h2><BalancedHeadingText text={assetName(asset)} /></h2>
                <div className={styles.assetMetaGrid}>
                  <div>
                    <span>Serial</span>
                    <strong>{serialDisplayText(asset)}</strong>
                  </div>
                  <div>
                    <span>Year</span>
                    <strong>{yearDisplayText(asset)}</strong>
                  </div>
                  <div>
                    <span>Usage</span>
                    <strong>{usageDisplayText(asset)}</strong>
                  </div>
                </div>
                <button type="button" onClick={() => selectAsset(asset)}>Open</button>
              </article>
            ))}
            {!visibleAssets.length && !isLoading ? <p className={styles.empty}>No matching fuel assets.</p> : null}
          </div>
        </>
      );
    }

    if (step === 'usage') {
      return (
        <>
          <div className={styles.savedReading}>
            <span>Saved in asset register</span>
            <strong>{selectedAsset?.hours === null ? 'Not captured' : `${selectedAsset?.hours.toLocaleString('en-ZA')} ${meterUnit(selectedAsset)}`}</strong>
          </div>
          {hasMeter(selectedAsset) ? (
            <label className={styles.field}>
              <span>{meterLabel(selectedAsset)}</span>
              <input type="number" min="0" value={usageReading} onChange={(event) => setUsageReading(event.target.value)} placeholder="Enter the reading now" disabled={usageNotApplicable} />
            </label>
          ) : null}
          <label className={styles.checkField}>
            <input type="checkbox" checked={usageNotApplicable} onChange={(event) => setUsageNotApplicable(event.target.checked)} />
            <span>No meter reading</span>
          </label>
        </>
      );
    }

    if (step === 'before') return renderSlider(fuelBefore, setFuelBefore);

    if (step === 'fuel') {
      return (
        <div className={styles.fuelTypeGrid}>
          {(['diesel', 'petrol'] as FuelType[]).map((option) => (
            <button key={option} type="button" className={fuelType === option ? styles.fuelTypeActive : ''} onClick={() => setFuelType(option)}>
              <span aria-hidden="true">⛽</span>
              <strong>{option === 'diesel' ? 'Diesel' : 'Petrol'}</strong>
            </button>
          ))}
        </div>
      );
    }

    if (step === 'amount') {
      return (
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Litres filled</span><input type="number" min="0" step="0.001" value={litres} onChange={(event) => setLitres(event.target.value)} placeholder="0.00" /></label>
          <label className={styles.field}><span>Total paid (R)</span><input type="number" min="0" step="0.01" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} placeholder="0.00" /></label>
          <label className={styles.field}><span>Fuel date</span><input type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} /></label>
        </div>
      );
    }

    if (step === 'after') return renderSlider(fuelAfter, setFuelAfter);

    if (step === 'activity') {
      return (
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Petrol station</span><input value={stationName} onChange={(event) => setStationName(event.target.value)} placeholder="Example: Engen George" /></label>
          <label className={styles.field}><span>Slip number (optional)</span><input value={slipNumber} onChange={(event) => setSlipNumber(event.target.value)} placeholder="Receipt or transaction number" /></label>
          <label className={styles.field}><span>Reason / activity</span><input value={activityText} onChange={(event) => setActivityText(event.target.value)} placeholder="Reason for the fuel" /></label>
          <label className={styles.field}><span>Note (optional)</span><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a short note" /></label>
        </div>
      );
    }

    return (
      <div className={styles.receiptBlock}>
        <label className={styles.receiptButton}>
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handleReceiptChange} />
          <span className={styles.receiptIcon} aria-hidden="true">▣</span>
          <strong>{receipt ? 'Replace fuel slip photo' : 'Add fuel slip photo (optional)'}</strong>
          <small>Proof can be added now, or kept separately by your accountant.</small>
        </label>
        {receiptPreview ? <img src={receiptPreview} alt="Selected fuel slip" className={styles.receiptPreview} /> : null}
        {receipt ? <p className={styles.fileName}>{receipt.name}</p> : null}
        <div className={styles.costSummary}>
          <div><span>Asset</span><strong>{selectedAsset ? assetName(selectedAsset) : '—'}</strong></div>
          <div><span>Fuel</span><strong>{fuelType === 'diesel' ? 'Diesel' : 'Petrol'} · {litres || '0'} L</strong></div>
          <div><span>Cost</span><strong>R {Number(totalAmount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
        </div>
      </div>
    );
  }

  if (isDone) {
    return (
      <section className={styles.doneCard}>
        <span aria-hidden="true">✓</span>
        <h1>Fuel cost saved</h1>
        <p>The fuel record{receipt ? ' and slip photo are' : ' is'} now saved against {selectedAsset ? assetName(selectedAsset) : 'the asset'}.</p>
        <button type="button" onClick={resetFlow}>Record another fill</button>
        <a href={fieldManagerMode ? '/field-manager/diesel' : '/owner-app/operations/fuel'}>Back to fuel options</a>
      </section>
    );
  }

  return (
    <section className={styles.shell}>
      {!isLoading && !loadError && !coordinates ? (
        <FuelLocationModal
          subject="Petrol station fuel"
          onReady={acceptLocation}
          onCancel={() => window.location.assign(fieldManagerMode ? '/field-manager/diesel' : '/owner-app/operations/fuel')}
        />
      ) : null}

      <div className={styles.progressCard} aria-label={`${STEP_TITLES[step]} step ${stepIndex + 1} of ${STEPS.length}`}>
        <div><span>Petrol station</span><strong>{STEP_TITLES[step]}</strong></div>
        <small>{stepIndex + 1}/{STEPS.length}</small>
        <i><b style={{ width: `${progress}%` }} /></i>
      </div>

      <section className={styles.stepCard}>
        <div className={styles.heading}>
          <span>Step {stepIndex + 1} of {STEPS.length}</span>
          <h1>{STEP_TITLES[step]}</h1>
          <p>
            {step === 'asset' ? 'Choose the asset receiving fuel.' : null}
            {step === 'usage' ? 'Keep the asset register reading current.' : null}
            {step === 'before' ? 'Set the fuel gauge before filling.' : null}
            {step === 'fuel' ? 'Choose the fuel added to the asset.' : null}
            {step === 'amount' ? 'Record the litres and amount paid.' : null}
            {step === 'after' ? 'Set the fuel gauge after filling.' : null}
            {step === 'activity' ? 'Add the station and reason for the fill.' : null}
            {step === 'slip' ? 'Take a photo so the cost keeps its proof.' : null}
          </p>
        </div>

        {loadError ? <div className={styles.errorNotice} role="alert">{loadError}</div> : null}
        {isLoading ? <p className={styles.empty}>Loading fuel assets…</p> : renderStep()}
        {notice ? <div className={styles.errorNotice} role="alert">{notice}</div> : null}

        {!isLoading && !loadError && step !== 'asset' ? (
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={previousStep} disabled={isSaving}>Back</button>
            {step === 'slip' ? (
              <button type="button" className={styles.primaryButton} onClick={() => void saveFuelCost()} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save fuel cost'}
              </button>
            ) : (
              <button type="button" className={styles.primaryButton} onClick={nextStep}>Continue</button>
            )}
          </div>
        ) : null}
      </section>
    </section>
  );
}
