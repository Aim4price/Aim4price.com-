'use client';

import DropdownOverlay from '../../components/DropdownOverlay';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type SVGProps } from 'react';
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
  selectedMethod?: string;
  currentValue?: number | null;
  canReceiveFuel: boolean;
  isActive?: boolean;
  usageMetric: 'hours' | 'km' | 'both' | 'percentage' | 'none';
  lifeWorkedPercent: number | null;
  workUseExcluded: boolean;
  workUseExclusionReason: string;
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

function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="M5 12h14M13 6l6 6-6 6" /></IconBase>;
}

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="m6 9 6 6 6-6" /></IconBase>;
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

function formatNumber(value: number | null | undefined, maximumFractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not recorded';
  return value.toLocaleString('en-ZA', { maximumFractionDigits });
}

function formatLitres(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Not recorded' : `${formatNumber(value, 3)} L`;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `R${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function titleCaseText(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function savedUsageText(asset: MissingFuelAsset): string {
  if (asset.usageMetric === 'percentage') {
    return asset.lifeWorkedPercent === null || !Number.isFinite(asset.lifeWorkedPercent)
      ? 'Not recorded'
      : `${formatNumber(asset.lifeWorkedPercent, 1)}% worked`;
  }

  if (asset.hours === null || !Number.isFinite(asset.hours)) return 'Not recorded';
  if (asset.usageMetric === 'km') return `${formatNumber(asset.hours, 0)} km`;
  if (asset.usageMetric === 'hours') return `${formatNumber(asset.hours, 1)} hours`;
  if (asset.usageMetric === 'both') return `${formatNumber(asset.hours, 1)} — unit not specified`;
  return 'Not recorded';
}

type UsageOption = {
  value: UsageMetric;
  label: string;
  description: string;
};

function usageOptionsForAsset(asset: MissingFuelAsset): UsageOption[] {
  const noReadingOption: UsageOption = {
    value: 'none',
    label: 'No historical usage recorded',
    description: 'Use this when the meter reading was not captured at the time.',
  };

  if (asset.usageMetric === 'both') {
    return [
      { value: 'hours', label: 'Hour meter (hours)', description: 'Record the historical engine-hour reading.' },
      { value: 'km', label: 'Odometer (km)', description: 'Record the historical kilometre reading.' },
      noReadingOption,
    ];
  }

  if (asset.usageMetric === 'hours') {
    return [
      { value: 'hours', label: 'Engine hours', description: 'This is the saved usage type for this asset.' },
      noReadingOption,
    ];
  }

  if (asset.usageMetric === 'km') {
    return [
      { value: 'km', label: 'Kilometres / odometer', description: 'This is the saved usage type for this asset.' },
      noReadingOption,
    ];
  }

  if (asset.usageMetric === 'percentage') {
    return [
      { value: 'percentage', label: 'Life worked percentage', description: 'This is the saved usage type for this asset.' },
      noReadingOption,
    ];
  }

  return [noReadingOption];
}

function assetPickerUsage(asset: MissingFuelAsset): string {
  if (asset.usageMetric === 'percentage') {
    return asset.lifeWorkedPercent === null ? '' : `Usage: ${formatNumber(asset.lifeWorkedPercent, 1)}%`;
  }
  if (asset.hours === null || asset.hours <= 0) return '';
  if (asset.usageMetric === 'km') return `Usage: ${formatNumber(asset.hours, 0)} km`;
  if (asset.usageMetric === 'hours') return `Usage: ${formatNumber(asset.hours, 0)} hours`;
  if (asset.usageMetric === 'both') return `Usage: ${formatNumber(asset.hours, 0)}`;
  return '';
}

function assetPickerMeta(asset: MissingFuelAsset): string {
  return [
    typeof asset.yearModel === 'number' ? `Year Model: ${asset.yearModel}` : '',
    assetPickerUsage(asset),
    asset.condition ? `Condition: ${titleCaseText(asset.condition)}` : '',
  ].filter(Boolean).join(' • ');
}

function assetPickerDetail(asset: MissingFuelAsset): string {
  return [
    asset.assetTypeLabel || 'Asset',
    asset.selectedMethod === 'manual' ? 'Manual' : 'Aim4price',
  ].filter(Boolean).join(' • ');
}

function emptyDraft(): MissingEntryDraft {
  return {
    issueDate: johannesburgDate(), issueTime: '', issueTimeRecorded: false,
    usageMetric: 'none', usageReading: '', assetFuelPercentBefore: '', litres: '', assetFuelPercentAfter: '',
    operatorName: '', activityText: '',
  };
}

function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function withAccountantShare(url: string, accountantShareId?: string, accountantRegisterId?: string): string {
  if (!accountantShareId) return url;
  const scopedUrl = new URL(url, window.location.origin);
  scopedUrl.searchParams.set('accountantShareId', accountantShareId);
  if (accountantRegisterId) scopedUrl.searchParams.set('accountantRegisterId', accountantRegisterId);
  return `${scopedUrl.pathname}${scopedUrl.search}`;
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
            <span className={styles.manageChoiceArrow}><ArrowRightIcon /></span>
          </button>
          <button type="button" className={`${styles.sourceChoiceOption} ${styles.manageChoiceOption} ${styles.desktopMissingEntryChoice}`} onClick={onMissingEntry}>
            <span className={styles.choiceGraphic}><HistoryFuelIcon /></span>
            <span className={styles.choiceTitleBlock}><strong>Back Track Fuel</strong><small>Add fuel that was issued earlier but not recorded.</small></span>
            <span className={styles.manageChoiceArrow}><ArrowRightIcon /></span>
          </button>
        </div>
        <div className={styles.modalFooter}><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}

export function MissingFuelEntryModal({ storage, assets, addedByLabel, accountantShareId, accountantRegisterId, onClose, onLedgerUpdated, onReconcile }: {
  storage: MissingFuelStorage;
  assets: MissingFuelAsset[];
  addedByLabel: string;
  accountantShareId?: string;
  accountantRegisterId?: string;
  onClose: () => void;
  onLedgerUpdated: (payload: MissingFuelLedgerPayload) => void;
  onReconcile: () => void;
}) {
  const eligibleAssets = useMemo(
    () => assets.filter((asset) => asset.canReceiveFuel && asset.isActive !== false && !asset.workUseExcluded),
    [assets],
  );
  const [step, setStep] = useState<MissingEntryStep>('asset');
  const [assetId, setAssetId] = useState('');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<MissingEntryDraft>(() => emptyDraft());
  const [treatment, setTreatment] = useState<TankBalanceTreatment>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [usageMenuOpen, setUsageMenuOpen] = useState(false);
  const usageButtonRef = useRef<HTMLButtonElement>(null);
  const usageOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [idempotencyKey] = useState(() => createIdempotencyKey('missing-fuel'));

  const selectedAsset = useMemo(() => eligibleAssets.find((asset) => asset.id === assetId) ?? null, [assetId, eligibleAssets]);
  const filteredAssets = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return eligibleAssets;
    return eligibleAssets.filter((asset) => [asset.title, asset.brandName, asset.modelName, asset.assetTypeLabel, asset.kind, asset.plateLabel, asset.serialNumber, asset.publicAssetCode].join(' ').toLowerCase().includes(term));
  }, [eligibleAssets, search]);
  const usageOptions = useMemo(() => selectedAsset ? usageOptionsForAsset(selectedAsset) : [], [selectedAsset]);
  const selectedUsageOption = usageOptions.find((option) => option.value === draft.usageMetric) ?? usageOptions[0];
  const litres = parseNumber(draft.litres);
  const currentAfterDeduction = treatment === 'not_yet_reflected' && litres !== null ? storage.currentLitres - litres : storage.currentLitres;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isSaving) return;
      if (usageMenuOpen) {
        event.preventDefault();
        setUsageMenuOpen(false);
        return;
      }
      onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!usageMenuOpen) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('[data-backtrack-usage-select="true"]')) setUsageMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isSaving, onClose, usageMenuOpen]);

  function chooseAsset(asset: MissingFuelAsset) {
    setAssetId(asset.id);
    setDraft((current) => ({ ...current, usageMetric: defaultMetric(asset), usageReading: '' }));
    setUsageMenuOpen(false);
    setError('');
    setStep('details');
  }

  function focusUsageOption(index: number) {
    if (!usageOptions.length) return;
    const normalizedIndex = (index + usageOptions.length) % usageOptions.length;
    window.requestAnimationFrame(() => usageOptionRefs.current[normalizedIndex]?.focus());
  }

  function openUsageMenuAt(index: number) {
    if (usageOptions.length <= 1) return;
    setUsageMenuOpen(true);
    focusUsageOption(index);
  }

  function toggleUsageMenu() {
    if (usageMenuOpen) {
      setUsageMenuOpen(false);
      return;
    }
    const selectedIndex = Math.max(0, usageOptions.findIndex((option) => option.value === draft.usageMetric));
    openUsageMenuAt(selectedIndex);
  }

  function handleUsageButtonKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const selectedIndex = Math.max(0, usageOptions.findIndex((option) => option.value === draft.usageMetric));
    if (event.key === 'Home') openUsageMenuAt(0);
    else if (event.key === 'End') openUsageMenuAt(usageOptions.length - 1);
    else openUsageMenuAt(selectedIndex);
  }

  function handleUsageOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setUsageMenuOpen(false);
      usageButtonRef.current?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') focusUsageOption(0);
    else if (event.key === 'End') focusUsageOption(usageOptions.length - 1);
    else focusUsageOption(index + (event.key === 'ArrowDown' ? 1 : -1));
  }

  function chooseUsageOption(option: UsageOption) {
    setDraft({ ...draft, usageMetric: option.value, usageReading: option.value === draft.usageMetric ? draft.usageReading : '' });
    setUsageMenuOpen(false);
    window.requestAnimationFrame(() => usageButtonRef.current?.focus());
  }

  function validateDetails(): string {
    if (!selectedAsset) return 'Choose the asset that received the fuel.';
    if (!draft.issueDate || draft.issueDate > johannesburgDate()) return 'Fuel issue date must be today or earlier.';
    if (draft.issueTimeRecorded && !draft.issueTime) return 'Enter the historical fuel issue time or keep Time not recorded selected.';
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
    return '';
  }

  function reviewEntry() {
    const validationError = validateDetails();
    if (validationError) { setError(validationError); return; }
    setError('');
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
        tankBalanceTreatment: treatment,
        idempotencyKey,
      };
      const response = await fetch(withAccountantShare(`/api/fuel/storage/${encodeURIComponent(storage.id)}/missing-entry`, accountantShareId, accountantRegisterId), {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await response.json() as MissingFuelLedgerPayload;
      if (!response.ok || !data.ok) throw new Error(data.error || 'Failed to save the missing fuel entry.');
      onLedgerUpdated(data);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save the missing fuel entry.');
    } finally {
      setIsSaving(false);
    }
  }

  const footer = saved ? (
    <div className={`${styles.missingEntryFooter} ${styles.missingEntrySuccessFooter}`}>
      <button type="button" className={`${styles.primaryButton} ${styles.backtrackPrimaryButton}`} onClick={onClose}>Done</button>
    </div>
  ) : (
    <div className={styles.missingEntryFooter}>
      <div className={styles.missingEntryFooterSecondary}>
        {step !== 'asset' ? <button type="button" className={styles.secondaryButton} onClick={() => { setError(''); setUsageMenuOpen(false); setStep(step === 'review' ? 'details' : 'asset'); }} disabled={isSaving}>Back</button> : null}
        <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isSaving}>Cancel</button>
      </div>
      {step === 'asset' ? null : step === 'details' ? <button type="button" className={`${styles.primaryButton} ${styles.backtrackPrimaryButton}`} onClick={reviewEntry}>Next</button> : <button type="button" className={`${styles.primaryButton} ${styles.backtrackPrimaryButton}`} onClick={() => void saveEntry()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Done'}</button>}
    </div>
  );

  return (
    <div className={`${styles.fuelSlipFlowBackdrop} ${styles.desktopMissingEntryModal}`} role="dialog" aria-modal="true" aria-labelledby="missing-fuel-title">
      <div className={`${styles.missingEntryModal} ${saved ? styles.missingEntrySuccessModal : ''}`}>
        <header className={styles.missingEntryHeader}>
          <div><h2 id="missing-fuel-title">Back Track Fuel</h2><p>{selectedAsset?.title ?? 'Choose an asset'}</p></div>
          <button type="button" className={styles.closeButton} onClick={onClose} disabled={isSaving} aria-label="Close missing fuel entry"><CloseIcon /></button>
        </header>

        <div className={styles.missingEntryScrollBody}>
          {saved ? (
            <section className={styles.missingEntrySuccess}>
              <span className={styles.successIcon}><CheckIcon /></span>
              <h3>Fuel entry saved</h3>
              <p>The earlier fuel issue has been added to the ledger.</p>
            </section>
          ) : (
            <>
              {error ? <div className={styles.missingEntryError} role="alert">{error}</div> : null}

              {step === 'asset' ? (
                <section className={styles.missingAssetStep}>
                  <div className={`${styles.pickerToolbar} ${styles.backtrackPickerToolbar}`}>
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets..." aria-label="Search eligible assets" />
                    <button type="button" className={styles.secondaryButton} onClick={() => setSearch('')}>Clear</button>
                  </div>
                  <div className={`${styles.assetList} ${styles.backtrackAssetList}`}>
                    {filteredAssets.map((asset) => (
                      <button key={asset.id} type="button" className={styles.assetRow} onClick={() => chooseAsset(asset)}>
                        <span className={styles.assetInfo}>
                          <strong>{asset.title}</strong>
                          <small>{assetPickerMeta(asset) || 'Asset details not set'}</small>
                          <small>{assetPickerDetail(asset)}</small>
                        </span>
                        <span className={styles.assetValue}>
                          <strong>{formatCurrency(asset.currentValue)}</strong>
                          <small>current value</small>
                        </span>
                      </button>
                    ))}
                    {!filteredAssets.length ? <div className={styles.emptyState}>No matching included assets found.</div> : null}
                  </div>
                </section>
              ) : null}

              {step === 'details' && selectedAsset ? (
                <section className={styles.missingDetailsStep}>
                  <div className={styles.missingFormGrid}>
                    <label><span>Fuel issue date *</span><input type="date" value={draft.issueDate} max={johannesburgDate()} onChange={(event) => setDraft({ ...draft, issueDate: event.target.value })} /></label>
                    <div className={`${styles.missingFormCard} ${styles.missingTimeField}`}>
                      <div className={styles.missingTimeHeader}>
                        <span>Fuel issue time</span>
                        <label className={`${styles.missingInlineCheck} ${!draft.issueTimeRecorded ? styles.missingInlineCheckActive : ''}`}><input type="checkbox" checked={!draft.issueTimeRecorded} onChange={(event) => setDraft({ ...draft, issueTimeRecorded: !event.target.checked, issueTime: event.target.checked ? '' : draft.issueTime })} /><span>Time not recorded</span></label>
                      </div>
                      <div className={styles.missingTimeInputSlot}>
                        {draft.issueTimeRecorded ? <input type="time" aria-label="Fuel issue time" value={draft.issueTime} onChange={(event) => setDraft({ ...draft, issueTime: event.target.value })} /> : null}
                      </div>
                    </div>
                    <div className={`${styles.missingStaticField} ${styles.savedUsageField}`}><span>Saved usage</span><strong>{savedUsageText(selectedAsset)}</strong></div>
                    <div className={`${styles.missingFormCard} ${styles.missingUsageField}`}>
                      <span>Usage for this fuel issue</span>
                      <div
                        className={`${styles.backtrackUsageSelect} ${usageMenuOpen ? styles.backtrackUsageSelectOpen : ''}`}
                        data-backtrack-usage-select="true"
                        onBlur={(event) => {
                          const nextTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
                          if (!nextTarget || !event.currentTarget.contains(nextTarget)) setUsageMenuOpen(false);
                        }}
                      >
                        <button
                          type="button"
                          ref={usageButtonRef}
                          className={`${styles.backtrackUsageSelectButton} ${usageMenuOpen ? styles.backtrackUsageSelectButtonOpen : ''}`}
                          onClick={toggleUsageMenu}
                          onKeyDown={handleUsageButtonKeyDown}
                          disabled={usageOptions.length <= 1}
                          aria-haspopup="listbox"
                          aria-expanded={usageMenuOpen}
                        >
                          <span>{selectedUsageOption?.label ?? 'Choose the saved usage type'}</span>
                          <ChevronDownIcon />
                        </button>
                        {usageMenuOpen ? (
                          <DropdownOverlay className={styles.backtrackUsageSelectMenu} role="listbox" aria-label="Usage for this fuel issue">
                            {usageOptions.map((option, index) => {
                              const isSelected = option.value === draft.usageMetric;
                              return (
                                <button
                                  type="button"
                                  key={option.value}
                                  ref={(element) => { usageOptionRefs.current[index] = element; }}
                                  className={`${styles.backtrackUsageOption} ${isSelected ? styles.backtrackUsageOptionActive : ''}`}
                                  onClick={() => chooseUsageOption(option)}
                                  onKeyDown={(event) => handleUsageOptionKeyDown(event, index)}
                                  role="option"
                                  aria-selected={isSelected}
                                >
                                  <span><strong>{option.label}</strong><small>{option.description}</small></span>
                                  {isSelected ? <CheckIcon /> : null}
                                </button>
                              );
                            })}
                          </DropdownOverlay>
                        ) : null}
                      </div>
                      <small>{selectedUsageOption?.description}</small>
                    </div>
                    <label><span>{draft.usageMetric === 'none' ? 'Usage reading' : `${usageLabel(draft.usageMetric)} reading at the time *`}</span><div className={styles.inputWithSuffix}><input type="number" min="0" max={draft.usageMetric === 'percentage' ? '100' : undefined} step="0.01" value={draft.usageReading} disabled={draft.usageMetric === 'none'} onChange={(event) => setDraft({ ...draft, usageReading: event.target.value })} /><em>{usageUnit(draft.usageMetric)}</em></div></label>
                    <label><span>Fuel percentage before *</span><div className={styles.inputWithSuffix}><input type="number" min="0" max="100" step="1" value={draft.assetFuelPercentBefore} onChange={(event) => setDraft({ ...draft, assetFuelPercentBefore: event.target.value })} /><em>%</em></div></label>
                    <label><span>Litres issued *</span><div className={styles.inputWithSuffix}><input type="number" min="0.001" step="0.001" value={draft.litres} onChange={(event) => setDraft({ ...draft, litres: event.target.value })} /><em>L</em></div></label>
                    <label><span>Fuel percentage after *</span><div className={styles.inputWithSuffix}><input type="number" min="0" max="100" step="1" value={draft.assetFuelPercentAfter} onChange={(event) => setDraft({ ...draft, assetFuelPercentAfter: event.target.value })} /><em>%</em></div></label>
                    <label><span>Operator / manager *</span><input value={draft.operatorName} onChange={(event) => setDraft({ ...draft, operatorName: event.target.value })} placeholder="Name of operator or manager" /></label>
                    <label><span>Specific activity *</span><input value={draft.activityText} onChange={(event) => setDraft({ ...draft, activityText: event.target.value })} placeholder="e.g. Ploughing field 4" /></label>
                  </div>
                </section>
              ) : null}

              {step === 'review' && selectedAsset ? (
                <section className={styles.missingReviewStep}>
                  <div className={styles.missingStepIntro}><h3>Reduce {storage.name}?</h3><p>Should {formatLitres(litres)} be deducted from the current tank balance?</p></div>
                  <div className={styles.balanceTreatmentGrid}>
                    <button type="button" aria-pressed={treatment === 'not_yet_reflected'} className={treatment === 'not_yet_reflected' ? styles.balanceTreatmentSelected : ''} onClick={() => { setTreatment('not_yet_reflected'); setError(''); }}><strong>Yes, reduce it</strong><span>Deduct {formatLitres(litres)} now.</span></button>
                    <button type="button" aria-pressed={treatment === 'already_reflected'} className={treatment === 'already_reflected' ? styles.balanceTreatmentSelected : ''} onClick={() => { setTreatment('already_reflected'); setError(''); }}><strong>No, leave it</strong><span>The fuel is already reflected.</span></button>
                    <button type="button" aria-pressed={treatment === 'not_sure'} className={treatment === 'not_sure' ? styles.balanceTreatmentSelected : ''} onClick={() => { setTreatment('not_sure'); setError(''); }}><strong>I’m not sure</strong><span>Flag the tank for a balance check.</span></button>
                  </div>
                  {treatment === 'not_yet_reflected' ? <div className={currentAfterDeduction < 0 ? styles.balanceDeductionError : styles.balanceDeductionPreview}><div><span>Current recorded litres</span><strong>{formatLitres(storage.currentLitres)}</strong></div><div><span>Litres being deducted</span><strong>− {formatLitres(litres)}</strong></div><div><span>New recorded litres</span><strong>{formatLitres(currentAfterDeduction)}</strong></div>{currentAfterDeduction < 0 ? <p>Insufficient recorded stock. Select I’m not sure and reconcile physically.</p> : null}</div> : null}
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

export function ReconcileFuelBalanceModal({ storage, accountantShareId, accountantRegisterId, onClose, onLedgerUpdated }: {
  storage: MissingFuelStorage;
  accountantShareId?: string;
  accountantRegisterId?: string;
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
      const response = await fetch(withAccountantShare(`/api/fuel/storage/${encodeURIComponent(storage.id)}/reconcile`, accountantShareId, accountantRegisterId), {
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
        <div className={styles.missingEntryFooter}><button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isSaving}>Cancel</button><button type="button" className={`${styles.primaryButton} ${styles.backtrackPrimaryButton}`} onClick={() => void save()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Reconciliation'}</button></div>
      </div>
    </div>
  );
}
