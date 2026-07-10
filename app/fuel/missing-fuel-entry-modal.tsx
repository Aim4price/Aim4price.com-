'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type SVGProps } from 'react';
import styles from './page.module.css';

export type MissingFuelStorage = {
  id: string;
  name: string;
  fuelType: string;
  capacityLitres: number | null;
  currentLitres: number;
  balanceNeedsChecking?: boolean;
  balanceVerificationStatus?: 'verified' | 'needs_check';
  balanceCheckReason?: string;
};

export type MissingFuelAsset = {
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
  yearModel?: number | null;
  condition?: string;
  canReceiveFuel: boolean;
  isActive?: boolean;
  usageMetric: 'hours' | 'km' | 'both' | 'percentage' | 'none';
  lifeWorkedPercent: number | null;
};

export type MissingFuelLedgerPayload = {
  ok: boolean;
  storages?: MissingFuelStorage[];
  assets?: MissingFuelAsset[];
  recentEvents?: unknown[];
  recentFuelSlips?: unknown[];
  summary?: unknown;
  error?: string;
  message?: string;
  event?: { id?: string; entryAddedAtIso?: string; addedByName?: string };
};

type UsageMetric = 'hours' | 'km' | 'percentage' | 'none';
type TankBalanceTreatment = 'already_reflected' | 'not_yet_reflected' | 'not_sure' | '';
type MissingEntryStep = 'asset' | 'details' | 'review';

type MissingEntryDraft = {
  issueDate: string;
  issueTime: string;
  issueTimeRecorded: boolean;
  usageMetric: UsageMetric;
  usageReading: string;
  assetFuelPercentBefore: string;
  litres: string;
  assetFuelPercentAfter: string;
  operatorName: string;
  activityText: string;
  workAreaText: string;
  lateEntryReason: string;
  note: string;
  evidenceType: string;
  evidenceReference: string;
};

type ReconcileDraft = {
  currentLitres: string;
  measurementDate: string;
  measurementTime: string;
  note: string;
};

function IconBase(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />;
}

function GearIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.03.03-2.86 2.86-.03-.03A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21h-4v-.05a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.03.03-2.86-2.86.03-.03A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.05a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.03-.03 2.86-2.86.03.03A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.05a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.03-.03 2.86 2.86-.03.03A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21v4h-.05a1.7 1.7 0 0 0-1.55 1Z" /></IconBase>;
}

function HistoryFuelIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" /><path d="M8 19.5V17a2 2 0 0 1 2-2h1" /></IconBase>;
}

function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="m6 6 12 12M18 6 6 18" /></IconBase>;
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></IconBase>;
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="m5 12 4 4L19 6" /></IconBase>;
}

function WarningIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="M10.3 3.6 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></IconBase>;
}

function createIdempotencyKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}:${crypto.randomUUID()}`;
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function johannesburgDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function johannesburgDateTimeLabel(date = new Date()): string {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short',
  }).format(date);
}

function formatNumber(value: number | null | undefined, maximumFractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not recorded';
  return value.toLocaleString('en-ZA', { maximumFractionDigits });
}

function formatLitres(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Not recorded' : `${formatNumber(value, 3)} L`;
}

function usageLabel(metric: UsageMetric): string {
  if (metric === 'hours') return 'Hours';
  if (metric === 'km') return 'Kilometres';
  if (metric === 'percentage') return 'Percentage';
  return 'No meter / Not recorded';
}

function usageUnit(metric: UsageMetric): string {
  if (metric === 'hours') return 'hours';
  if (metric === 'km') return 'km';
  if (metric === 'percentage') return '%';
  return '';
}

function defaultMetric(asset: MissingFuelAsset): UsageMetric {
  if (asset.usageMetric === 'both') return 'none';
  return asset.usageMetric;
}

function assetCurrentUsage(asset: MissingFuelAsset): string {
  if (asset.usageMetric === 'percentage') return asset.lifeWorkedPercent === null ? 'Usage not recorded' : `${formatNumber(asset.lifeWorkedPercent, 1)}% usage`;
  if (asset.usageMetric === 'none') return 'No meter';
  if (asset.usageMetric === 'km') return asset.hours === null ? 'Kilometres not recorded' : `${formatNumber(asset.hours, 2)} km`;
  if (asset.usageMetric === 'both') return asset.hours === null ? 'Meter reading not recorded' : `${formatNumber(asset.hours, 2)} saved reading`;
  return asset.hours === null ? 'Hours not recorded' : `${formatNumber(asset.hours, 2)} hours`;
}

function emptyDraft(): MissingEntryDraft {
  return {
    issueDate: johannesburgDate(), issueTime: '', issueTimeRecorded: false,
    usageMetric: 'none', usageReading: '', assetFuelPercentBefore: '', litres: '', assetFuelPercentAfter: '',
    operatorName: '', activityText: '', workAreaText: '', lateEntryReason: '', note: '',
    evidenceType: 'no_supporting_record', evidenceReference: '',
  };
}

function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function evidenceStatus(draft: MissingEntryDraft, file: File | null): string {
  return file || draft.evidenceReference.trim()
    ? 'Evidence supplied — review required'
    : 'Internal record only — supporting evidence not supplied';
}

function balanceTreatmentLabel(value: TankBalanceTreatment): string {
  if (value === 'already_reflected') return 'Already reflected — no current stock change';
  if (value === 'not_yet_reflected') return 'Not yet reflected — deduct from current stock';
  if (value === 'not_sure') return 'I’m not sure — physical reconciliation required';
  return 'Not selected';
}

export function ManageFuelStorageChoiceModal({ storage, onClose, onManage, onMissingEntry }: {
  storage: MissingFuelStorage;
  onClose: () => void;
  onManage: () => void;
  onMissingEntry: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.fuelSlipFlowBackdrop} role="dialog" aria-modal="true" aria-labelledby="manage-storage-choice-title">
      <div className={`${styles.downloadModal} ${styles.sourceChoiceModal} ${styles.manageStorageChoiceModal}`}>
        <div className={styles.modalHeader}>
          <div><h2 id="manage-storage-choice-title">{storage.name}</h2><p>Choose what you need to manage.</p></div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close storage options"><CloseIcon /></button>
        </div>
        <div className={styles.modalDivider} />
        <div className={styles.sourceChoiceGrid}>
          <button type="button" className={`${styles.sourceChoiceOption} ${styles.manageChoiceOption}`} onClick={onManage}>
            <span className={styles.choiceGraphic}><GearIcon /></span>
            <span className={styles.choiceTitleBlock}><strong>Manage Storage</strong><small>Update the tank details and current balance.</small></span>
          </button>
          <button type="button" className={`${styles.sourceChoiceOption} ${styles.manageChoiceOption} ${styles.desktopMissingEntryChoice}`} onClick={onMissingEntry}>
            <span className={styles.choiceGraphic}><HistoryFuelIcon /></span>
            <span className={styles.choiceTitleBlock}><strong>Add Missing Fuel Entry</strong><small>Record fuel issued earlier from this tank but not captured.</small></span>
          </button>
        </div>
        <div className={styles.modalFooter}><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}

export function MissingFuelEntryModal({ storage, assets, addedByLabel, onClose, onLedgerUpdated, onReconcile }: {
  storage: MissingFuelStorage;
  assets: MissingFuelAsset[];
  addedByLabel: string;
  onClose: () => void;
  onLedgerUpdated: (payload: MissingFuelLedgerPayload) => void;
  onReconcile: () => void;
}) {
  const eligibleAssets = useMemo(() => assets.filter((asset) => asset.canReceiveFuel && asset.isActive !== false), [assets]);
  const [step, setStep] = useState<MissingEntryStep>('asset');
  const [assetId, setAssetId] = useState('');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<MissingEntryDraft>(() => emptyDraft());
  const [treatment, setTreatment] = useState<TankBalanceTreatment>('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedNeedsReconcile, setSavedNeedsReconcile] = useState(false);
  const [entryAddedLabel, setEntryAddedLabel] = useState(johannesburgDateTimeLabel());
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey('missing-fuel'));

  const selectedAsset = useMemo(() => eligibleAssets.find((asset) => asset.id === assetId) ?? null, [assetId, eligibleAssets]);
  const filteredAssets = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return eligibleAssets;
    return eligibleAssets.filter((asset) => [asset.title, asset.brandName, asset.modelName, asset.assetTypeLabel, asset.kind, asset.plateLabel, asset.serialNumber, asset.publicAssetCode].join(' ').toLowerCase().includes(term));
  }, [eligibleAssets, search]);
  const litres = parseNumber(draft.litres);
  const currentAfterDeduction = treatment === 'not_yet_reflected' && litres !== null ? storage.currentLitres - litres : storage.currentLitres;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !isSaving) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isSaving, onClose]);

  function chooseAsset(asset: MissingFuelAsset) {
    setAssetId(asset.id);
    setDraft((current) => ({ ...current, usageMetric: defaultMetric(asset), usageReading: '' }));
    setError('');
    setStep('details');
  }

  function validateDetails(): string {
    if (!selectedAsset) return 'Choose the asset that received the fuel.';
    if (!draft.issueDate || draft.issueDate > johannesburgDate()) return 'Fuel issue date must be today or earlier.';
    if (draft.issueTimeRecorded && !draft.issueTime) return 'Enter the historical fuel issue time or select Time not recorded.';
    const usage = parseNumber(draft.usageReading);
    if (draft.usageMetric !== 'none' && usage === null) return `Enter the historical ${usageLabel(draft.usageMetric).toLowerCase()} reading or choose No meter / Not recorded.`;
    if (draft.usageMetric === 'percentage' && usage !== null && (usage < 0 || usage > 100)) return 'Percentage usage must be between 0 and 100.';
    const before = parseNumber(draft.assetFuelPercentBefore);
    const after = parseNumber(draft.assetFuelPercentAfter);
    if (before === null || before < 0 || before > 100) return 'Fuel percentage before must be between 0 and 100.';
    if (litres === null || litres <= 0) return 'Litres issued must be greater than zero.';
    if (after === null || after < 0 || after > 100) return 'Fuel percentage after must be between 0 and 100.';
    if (after < before) return 'Fuel percentage after cannot be lower than fuel percentage before.';
    if (draft.operatorName.trim().length < 2) return 'Enter the operator or manager.';
    if (draft.activityText.trim().length < 3) return 'Enter the specific activity the fuel was used for.';
    if (draft.workAreaText.trim().length < 2) return 'Enter the historical work area or location.';
    if (draft.lateEntryReason.trim().length < 5) return 'Explain why the entry was entered late.';
    if (draft.evidenceType === 'no_supporting_record' && (evidenceFile || draft.evidenceReference.trim())) return 'Choose the correct supporting-evidence type for the file or reference.';
    if (evidenceFile && evidenceFile.size > 12 * 1024 * 1024) return 'Supporting evidence must be 12 MB or smaller.';
    return '';
  }

  function reviewEntry() {
    const validationError = validateDetails();
    if (validationError) { setError(validationError); return; }
    setError('');
    setEntryAddedLabel(johannesburgDateTimeLabel());
    setStep('review');
  }

  async function saveEntry() {
    const validationError = validateDetails();
    if (validationError) { setError(validationError); setStep('details'); return; }
    if (!treatment) { setError('Choose how the current tank balance should be handled.'); return; }
    if (treatment === 'not_yet_reflected' && currentAfterDeduction < 0) {
      setError('The current recorded tank stock is insufficient. Choose I’m not sure and reconcile the tank physically.');
      return;
    }
    if (!selectedAsset) return;

    setIsSaving(true);
    setError('');
    try {
      const payload = {
        assetId: selectedAsset.id,
        issueDate: draft.issueDate,
        issueTime: draft.issueTimeRecorded ? draft.issueTime : null,
        issueTimeRecorded: draft.issueTimeRecorded,
        usageMetric: draft.usageMetric,
        usageReading: draft.usageMetric === 'none' ? null : parseNumber(draft.usageReading),
        assetFuelPercentBefore: parseNumber(draft.assetFuelPercentBefore),
        litres,
        assetFuelPercentAfter: parseNumber(draft.assetFuelPercentAfter),
        operatorName: draft.operatorName,
        activityText: draft.activityText,
        workAreaText: draft.workAreaText,
        lateEntryReason: draft.lateEntryReason,
        note: draft.note,
        evidenceType: draft.evidenceType,
        evidenceReference: draft.evidenceReference,
        tankBalanceTreatment: treatment,
        idempotencyKey,
      };
      const formData = new FormData();
      formData.set('payload', JSON.stringify(payload));
      if (evidenceFile) formData.set('evidence', evidenceFile);
      const response = await fetch(`/api/fuel/storage/${encodeURIComponent(storage.id)}/missing-entry`, { method: 'POST', credentials: 'include', body: formData });
      const data = await response.json() as MissingFuelLedgerPayload;
      if (!response.ok || !data.ok) throw new Error(data.error || 'Failed to save the missing fuel entry.');
      onLedgerUpdated(data);
      setEntryAddedLabel(data.event?.entryAddedAtIso ? johannesburgDateTimeLabel(new Date(data.event.entryAddedAtIso)) : johannesburgDateTimeLabel());
      setSavedNeedsReconcile(treatment === 'not_sure');
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save the missing fuel entry.');
    } finally {
      setIsSaving(false);
    }
  }

  function addAnother() {
    setStep('asset'); setAssetId(''); setSearch(''); setDraft(emptyDraft()); setTreatment(''); setEvidenceFile(null);
    setSaved(false); setSavedNeedsReconcile(false); setError(''); setIdempotencyKey(createIdempotencyKey('missing-fuel'));
  }

  const footer = saved ? null : (
    <div className={styles.missingEntryFooter}>
      <div className={styles.missingEntryFooterSecondary}>
        {step !== 'asset' ? <button type="button" className={styles.secondaryButton} onClick={() => { setError(''); setStep(step === 'review' ? 'details' : 'asset'); }} disabled={isSaving}>Back</button> : null}
        <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isSaving}>Cancel</button>
      </div>
      {step === 'asset' ? null : step === 'details' ? <button type="button" className={styles.primaryButton} onClick={reviewEntry}>Review</button> : <button type="button" className={styles.primaryButton} onClick={() => void saveEntry()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Missing Entry'}</button>}
    </div>
  );

  return (
    <div className={`${styles.fuelSlipFlowBackdrop} ${styles.desktopMissingEntryModal}`} role="dialog" aria-modal="true" aria-labelledby="missing-fuel-title">
      <div className={styles.missingEntryModal}>
        <header className={styles.missingEntryHeader}>
          <div><span className={styles.missingEntryEyebrow}>Late fuel record</span><h2 id="missing-fuel-title">{saved ? 'Missing fuel entry saved' : 'Add Missing Fuel Entry'}</h2>{!saved ? <p>{storage.name} · Historical issue only</p> : null}</div>
          <button type="button" className={styles.closeButton} onClick={onClose} disabled={isSaving} aria-label="Close missing fuel entry"><CloseIcon /></button>
        </header>

        <div className={styles.missingEntryScrollBody}>
          {saved ? (
            <section className={styles.missingEntrySuccess}>
              <span className={styles.successIcon}><CheckIcon /></span>
              <h3>Missing fuel entry saved</h3>
              <p>The historical fuel issue was recorded without changing the asset’s current meter, fuel level, GPS or valuation state.</p>
              <div className={styles.reviewSummaryCard}><div><span>Storage tank</span><strong>{storage.name}</strong></div><div><span>Entry added on</span><strong>{entryAddedLabel}</strong></div><div><span>Source</span><strong>Late Entry</strong></div></div>
              {savedNeedsReconcile ? <div className={styles.balanceWarningBox}><WarningIcon /><div><strong>Balance needs checking</strong><span>The tank level was not changed. Complete a physical reconciliation before clearing this warning.</span></div></div> : null}
              <div className={styles.successActions}>
                <button type="button" className={styles.secondaryButton} onClick={addAnother}>Add another entry</button>
                {savedNeedsReconcile ? <button type="button" className={styles.secondaryButton} onClick={onReconcile}>Reconcile Balance</button> : null}
                <button type="button" className={styles.primaryButton} onClick={onClose}>Done</button>
              </div>
            </section>
          ) : (
            <>
              <div className={styles.missingEntryTankBanner}><span>Selected tank</span><strong>{storage.name}</strong><small>{formatLitres(storage.currentLitres)} currently recorded · Fixed capacity {formatLitres(storage.capacityLitres)}</small></div>
              <div className={styles.missingEntryProgress} aria-label="Missing fuel entry progress">
                <span className={step === 'asset' ? styles.progressCurrent : styles.progressComplete}>1. Choose Asset</span>
                <span className={step === 'details' ? styles.progressCurrent : step === 'review' ? styles.progressComplete : ''}>2. Entry Details</span>
                <span className={step === 'review' ? styles.progressCurrent : ''}>3. Tank Balance and Review</span>
              </div>
              {error ? <div className={styles.missingEntryError} role="alert">{error}</div> : null}

              {step === 'asset' ? (
                <section className={styles.missingAssetStep}>
                  <div className={styles.missingStepIntro}><h3>Choose Asset</h3><p>Only active assets eligible to receive fuel are shown. Storage tanks are excluded.</p></div>
                  <div className={styles.missingAssetSearch}><SearchIcon /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, brand, model, category, registration, serial or asset code" aria-label="Search eligible assets" />{search ? <button type="button" onClick={() => setSearch('')}>Clear Search</button> : null}</div>
                  <div className={styles.missingAssetList}>
                    {filteredAssets.map((asset) => (
                      <button key={asset.id} type="button" className={styles.missingAssetCard} onClick={() => chooseAsset(asset)}>
                        <span><strong>{asset.title}</strong><small>{[asset.yearModel ? `Year Model: ${asset.yearModel}` : '', asset.condition ? `Condition: ${asset.condition}` : ''].filter(Boolean).join(' · ')}</small><small>{[asset.assetTypeLabel || asset.kind, asset.plateLabel ? `Reg: ${asset.plateLabel}` : '', asset.serialNumber ? `Serial: ${asset.serialNumber}` : '', asset.publicAssetCode ? `Code: ${asset.publicAssetCode}` : ''].filter(Boolean).join(' · ')}</small></span>
                        <span className={styles.missingAssetMetrics}><strong>{assetCurrentUsage(asset)}</strong><small>{asset.fuelPercent === null ? 'Fuel % not recorded' : `${formatNumber(asset.fuelPercent, 0)}% fuel`}</small></span>
                      </button>
                    ))}
                    {!filteredAssets.length ? <div className={styles.missingAssetEmpty}>No eligible assets match this search.</div> : null}
                  </div>
                </section>
              ) : null}

              {step === 'details' && selectedAsset ? (
                <section className={styles.missingDetailsStep}>
                  <div className={styles.selectedMissingAsset}><span>Selected asset</span><strong>{selectedAsset.title}</strong><small>{assetCurrentUsage(selectedAsset)} · {selectedAsset.fuelPercent === null ? 'Fuel % not recorded' : `${formatNumber(selectedAsset.fuelPercent, 0)}% current fuel`}</small></div>
                  <div className={styles.missingFormGrid}>
                    <label><span>Fuel issue date *</span><input type="date" value={draft.issueDate} max={johannesburgDate()} onChange={(event) => setDraft({ ...draft, issueDate: event.target.value })} /></label>
                    <label><span>Fuel issue time</span><input type="time" value={draft.issueTime} disabled={!draft.issueTimeRecorded} onChange={(event) => setDraft({ ...draft, issueTime: event.target.value })} /></label>
                    <label className={styles.missingCheckLabel}><input type="checkbox" checked={!draft.issueTimeRecorded} onChange={(event) => setDraft({ ...draft, issueTimeRecorded: !event.target.checked, issueTime: event.target.checked ? '' : draft.issueTime })} /><span>Time not recorded</span></label>
                    <label><span>Usage metric</span><select value={draft.usageMetric} onChange={(event) => setDraft({ ...draft, usageMetric: event.target.value as UsageMetric, usageReading: '' })}>
                      {selectedAsset.usageMetric === 'both' ? <><option value="hours">Hours</option><option value="km">Kilometres</option></> : selectedAsset.usageMetric !== 'none' ? <option value={selectedAsset.usageMetric}>{usageLabel(selectedAsset.usageMetric)}</option> : null}
                      <option value="none">No meter / Not recorded</option>
                    </select></label>
                    <label><span>{draft.usageMetric === 'none' ? 'Usage reading' : `${usageLabel(draft.usageMetric)} reading at the time *`}</span><div className={styles.inputWithSuffix}><input type="number" min="0" max={draft.usageMetric === 'percentage' ? '100' : undefined} step="0.01" value={draft.usageReading} disabled={draft.usageMetric === 'none'} onChange={(event) => setDraft({ ...draft, usageReading: event.target.value })} /><em>{usageUnit(draft.usageMetric)}</em></div></label>
                    <label><span>Fuel percentage before *</span><div className={styles.inputWithSuffix}><input type="number" min="0" max="100" step="1" value={draft.assetFuelPercentBefore} onChange={(event) => setDraft({ ...draft, assetFuelPercentBefore: event.target.value })} /><em>%</em></div></label>
                    <label><span>Litres issued *</span><div className={styles.inputWithSuffix}><input type="number" min="0.001" step="0.001" value={draft.litres} onChange={(event) => setDraft({ ...draft, litres: event.target.value })} /><em>L</em></div></label>
                    <label><span>Fuel percentage after *</span><div className={styles.inputWithSuffix}><input type="number" min="0" max="100" step="1" value={draft.assetFuelPercentAfter} onChange={(event) => setDraft({ ...draft, assetFuelPercentAfter: event.target.value })} /><em>%</em></div></label>
                    <label><span>Operator / manager *</span><input value={draft.operatorName} onChange={(event) => setDraft({ ...draft, operatorName: event.target.value })} placeholder="Name of operator or manager" /></label>
                    <label><span>Specific activity *</span><input value={draft.activityText} onChange={(event) => setDraft({ ...draft, activityText: event.target.value })} placeholder="e.g. Ploughing field 4" /></label>
                    <label className={styles.fullWidthField}><span>Work area / historical location *</span><input value={draft.workAreaText} onChange={(event) => setDraft({ ...draft, workAreaText: event.target.value })} placeholder="Written location only — no desktop GPS is captured" /></label>
                    <label className={styles.fullWidthField}><span>Reason entered late *</span><textarea rows={3} value={draft.lateEntryReason} onChange={(event) => setDraft({ ...draft, lateEntryReason: event.target.value })} placeholder="e.g. QR was not scanned; paper dispensing record captured later" /></label>
                    <label className={styles.fullWidthField}><span>General note</span><textarea rows={2} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Optional note" /></label>
                    <label><span>Supporting-evidence type</span><select value={draft.evidenceType} onChange={(event) => setDraft({ ...draft, evidenceType: event.target.value })}>
                      <option value="handwritten_dispensing_sheet">Handwritten dispensing sheet</option><option value="pump_or_meter_record">Pump or meter record</option><option value="supplier_slip_or_invoice">Supplier slip or invoice</option><option value="operator_confirmation">Operator confirmation</option><option value="other_supporting_record">Other supporting record</option><option value="no_supporting_record">No supporting record</option>
                    </select></label>
                    <label><span>Evidence reference</span><input value={draft.evidenceReference} onChange={(event) => setDraft({ ...draft, evidenceReference: event.target.value })} placeholder="Optional sheet, slip or invoice reference" /></label>
                    <label className={styles.fullWidthField}><span>Supporting document or photograph</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => setEvidenceFile(event.target.files?.[0] ?? null)} /><small>One PDF, JPG, PNG or WEBP file. Maximum 12 MB.</small></label>
                  </div>
                </section>
              ) : null}

              {step === 'review' && selectedAsset ? (
                <section className={styles.missingReviewStep}>
                  <div className={styles.missingStepIntro}><h3>How should the current tank balance be handled?</h3><p>No risky option is preselected. The fixed tank capacity never changes; only today’s recorded litres may change.</p></div>
                  <div className={styles.balanceTreatmentGrid}>
                    <button type="button" className={treatment === 'already_reflected' ? styles.balanceTreatmentSelected : ''} onClick={() => { setTreatment('already_reflected'); setError(''); }}><strong>Already reflected</strong><span>The current tank level is correct or was measured after this fuel issue. Do not change it.</span></button>
                    <button type="button" className={treatment === 'not_yet_reflected' ? styles.balanceTreatmentSelected : ''} onClick={() => { setTreatment('not_yet_reflected'); setError(''); }}><strong>Not yet reflected</strong><span>Subtract the missing litres from today’s recorded tank level.</span></button>
                    <button type="button" className={treatment === 'not_sure' ? styles.balanceTreatmentSelected : ''} onClick={() => { setTreatment('not_sure'); setError(''); }}><strong>I’m not sure</strong><span>Save without changing the tank level and flag it for physical reconciliation.</span></button>
                  </div>
                  {treatment === 'not_yet_reflected' ? <div className={currentAfterDeduction < 0 ? styles.balanceDeductionError : styles.balanceDeductionPreview}><div><span>Current recorded litres</span><strong>{formatLitres(storage.currentLitres)}</strong></div><div><span>Litres being deducted</span><strong>− {formatLitres(litres)}</strong></div><div><span>New recorded litres</span><strong>{formatLitres(currentAfterDeduction)}</strong></div>{currentAfterDeduction < 0 ? <p>Insufficient recorded stock. Select I’m not sure and reconcile physically.</p> : null}</div> : null}
                  <div className={styles.reviewSummaryCard}>
                    <div><span>Storage tank</span><strong>{storage.name}</strong></div><div><span>Asset</span><strong>{selectedAsset.title}</strong></div>
                    <div><span>Fuel issued on</span><strong>{draft.issueDate}{draft.issueTimeRecorded && draft.issueTime ? ` at ${draft.issueTime}` : ' · Time not recorded'}</strong></div><div><span>Entry added on</span><strong>{entryAddedLabel} (server time finalised on save)</strong></div>
                    <div><span>Added by</span><strong>{addedByLabel}</strong></div><div><span>Usage at the time</span><strong>{draft.usageMetric === 'none' ? 'No meter / Not recorded' : `${draft.usageReading} ${usageUnit(draft.usageMetric)}`}</strong></div><div><span>Fuel percentage</span><strong>{draft.assetFuelPercentBefore}% → {draft.assetFuelPercentAfter}%</strong></div>
                    <div><span>Litres issued</span><strong>{formatLitres(litres)}</strong></div><div><span>Operator / manager</span><strong>{draft.operatorName}</strong></div>
                    <div><span>Activity</span><strong>{draft.activityText}</strong></div><div><span>Work area / location</span><strong>{draft.workAreaText}</strong></div>
                    <div className={styles.reviewWideRow}><span>Reason entered late</span><strong>{draft.lateEntryReason}</strong></div><div><span>Evidence status</span><strong>{evidenceStatus(draft, evidenceFile)}</strong></div>
                    <div><span>Tank balance treatment</span><strong>{balanceTreatmentLabel(treatment)}</strong></div><div><span>Historical storage before</span><strong>Not recorded</strong></div><div><span>Historical storage after</span><strong>Not recorded</strong></div>
                    <div><span>GPS</span><strong>Not captured</strong></div><div><span>Source</span><strong>Late Entry</strong></div>
                  </div>
                  <div className={styles.lateEntryAuditNotice}><strong>Audit handling</strong><span>This saves the historical issue and the real date it was added separately. It never rewrites the asset’s current usage, fuel percentage, GPS, location, last scan or valuation state.</span></div>
                </section>
              ) : null}
            </>
          )}
        </div>
        {footer}
      </div>
    </div>
  );
}

export function ReconcileFuelBalanceModal({ storage, onClose, onLedgerUpdated }: {
  storage: MissingFuelStorage;
  onClose: () => void;
  onLedgerUpdated: (payload: MissingFuelLedgerPayload) => void;
}) {
  const [draft, setDraft] = useState<ReconcileDraft>({ currentLitres: '', measurementDate: johannesburgDate(), measurementTime: '', note: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(() => createIdempotencyKey('fuel-reconciliation'));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !isSaving) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isSaving, onClose]);

  async function save() {
    const currentLitres = parseNumber(draft.currentLitres);
    if (currentLitres === null || currentLitres < 0) { setError('Enter the physically measured current litres.'); return; }
    if (storage.capacityLitres !== null && currentLitres > storage.capacityLitres) { setError(`Measured litres cannot exceed the fixed capacity of ${formatLitres(storage.capacityLitres)}.`); return; }
    if (!draft.measurementDate || draft.measurementDate > johannesburgDate()) { setError('Measurement date must be today or earlier.'); return; }
    if (!draft.measurementTime) { setError('Enter the physical measurement time.'); return; }
    setIsSaving(true); setError('');
    try {
      const response = await fetch(`/api/fuel/storage/${encodeURIComponent(storage.id)}/reconcile`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentLitres, measurementDate: draft.measurementDate, measurementTime: draft.measurementTime, note: draft.note, idempotencyKey }),
      });
      const data = await response.json() as MissingFuelLedgerPayload;
      if (!response.ok || !data.ok) throw new Error(data.error || 'Failed to reconcile the tank balance.');
      onLedgerUpdated(data); onClose();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Failed to reconcile the tank balance.'); }
    finally { setIsSaving(false); }
  }

  return (
    <div className={styles.fuelSlipFlowBackdrop} role="dialog" aria-modal="true" aria-labelledby="reconcile-fuel-title">
      <div className={styles.reconcileBalanceModal}>
        <header className={styles.missingEntryHeader}><div><span className={styles.missingEntryEyebrow}>Physical reconciliation</span><h2 id="reconcile-fuel-title">Reconcile Balance</h2><p>{storage.name}</p></div><button type="button" className={styles.closeButton} onClick={onClose} disabled={isSaving} aria-label="Close reconciliation"><CloseIcon /></button></header>
        <div className={styles.missingEntryScrollBody}>
          <div className={styles.balanceWarningBox}><WarningIcon /><div><strong>Balance needs checking</strong><span>{storage.balanceCheckReason || 'Measure the tank physically before replacing the recorded current balance.'}</span></div></div>
          {error ? <div className={styles.missingEntryError} role="alert">{error}</div> : null}
          <div className={styles.reconcileCurrentCard}><span>Current book balance</span><strong>{formatLitres(storage.currentLitres)}</strong><small>Fixed capacity: {formatLitres(storage.capacityLitres)}</small></div>
          <div className={styles.missingFormGrid}>
            <label><span>Physically measured current litres *</span><div className={styles.inputWithSuffix}><input type="number" min="0" max={storage.capacityLitres ?? undefined} step="0.001" value={draft.currentLitres} onChange={(event) => setDraft({ ...draft, currentLitres: event.target.value })} /><em>L</em></div></label>
            <label><span>Measurement date *</span><input type="date" max={johannesburgDate()} value={draft.measurementDate} onChange={(event) => setDraft({ ...draft, measurementDate: event.target.value })} /></label>
            <label><span>Measurement time *</span><input type="time" value={draft.measurementTime} onChange={(event) => setDraft({ ...draft, measurementTime: event.target.value })} /></label>
            <label className={styles.fullWidthField}><span>Reconciliation note</span><textarea rows={3} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Optional measurement or reconciliation note" /></label>
          </div>
          <div className={styles.lateEntryAuditNotice}><strong>Separate audit event</strong><span>Saving creates a present-day reconciliation record with the previous and new current litres. It does not create or count another fuel issue.</span></div>
        </div>
        <div className={styles.missingEntryFooter}><button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isSaving}>Cancel</button><button type="button" className={styles.primaryButton} onClick={() => void save()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Reconciliation'}</button></div>
      </div>
    </div>
  );
}
