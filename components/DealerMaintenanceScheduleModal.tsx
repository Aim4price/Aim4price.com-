'use client';
import MaintenanceEntryChoice from './MaintenanceEntryChoice';
import { useLeadDialog } from './leads/useLeadDialog';
import ScheduleDatePicker from '../app/maintenance/ScheduleDatePicker';
import CostDetailIcon from './CostDetailIcon';
import dialogStyles from './AccountDialog.module.css';

import DropdownOverlay from './DropdownOverlay';
import { useEffect, useRef, useState } from 'react';
import type {
  DealerMaintenanceRecordSummary,
  DealerMaintenanceScheduleProposal,
  DealerMaintenanceTrackedAsset,
} from '../lib/dealer-maintenance-tracker';
import styles from '../app/maintenance/page.module.css';
import accountStyles from '../app/account/page.module.css';

type Props = {
  externalShare?: { token: string; assetId: string };
  accessId: string;
  leadId?: string | null;
  initialProposal?: DealerMaintenanceScheduleProposal | null;
  initialRecord?: DealerMaintenanceRecordSummary | null;
  onClose: () => void;
  onAssetUpdated?: (asset: DealerMaintenanceTrackedAsset) => void;
  onError?: (message: string) => void;
};

type MaintenanceType = 'service' | 'checkup';
type TriggerType = 'date' | 'usage';
type DateIntervalUnit = 'days' | 'weeks' | 'months';
type ScheduleStep = 'maintenance-type' | 'trigger-type' | 'form';

type Draft = {
  maintenanceType: MaintenanceType;
  triggerType: TriggerType;
  notes: string;
  dueDate: string;
  dueUsage: string;
  alertBeforeValue: string;
  alertBeforeUnit: DateIntervalUnit | DealerMaintenanceTrackedAsset['usageMetric'];
  recurringEnabled: boolean;
  recurringIntervalValue: string;
  recurringIntervalUnit: DateIntervalUnit | DealerMaintenanceTrackedAsset['usageMetric'];
};

type AssetResponse = {
  ok?: boolean;
  asset?: DealerMaintenanceTrackedAsset;
  error?: string;
};

type SaveResponse = {
  ok?: boolean;
  asset?: DealerMaintenanceTrackedAsset;
  error?: string;
};

type DropdownOption = {
  value: string;
  label: string;
};

const DATE_UNIT_OPTIONS: DropdownOption[] = [
  { value: 'days', label: 'days' },
  { value: 'weeks', label: 'weeks' },
  { value: 'months', label: 'months' },
];

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
      <path fill="currentColor" d="M5.2 7.5 10 12.3l4.8-4.8 1.1 1.1-5.3 5.3a.9.9 0 0 1-1.2 0L4.1 8.6l1.1-1.1Z" />
    </svg>
  );
}


function todayInputDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Africa/Johannesburg',
  }).format(new Date());
}

function defaultUsageInterval(metric: DealerMaintenanceTrackedAsset['usageMetric']): number {
  if (metric === 'km') return 10_000;
  if (metric === 'percentage') return 10;
  return 250;
}

function defaultUsageAlert(metric: DealerMaintenanceTrackedAsset['usageMetric']): number {
  if (metric === 'km') return 1_000;
  if (metric === 'percentage') return 5;
  return 20;
}

function emptyDraft(asset?: DealerMaintenanceTrackedAsset | null): Draft {
  const metric = asset?.usageMetric ?? 'hours';
  const currentUsage = typeof asset?.currentUsage === 'number' ? asset.currentUsage : 0;
  return {
    maintenanceType: 'service',
    triggerType: 'date',
    notes: '',
    dueDate: todayInputDate(),
    dueUsage: String(Math.round((currentUsage + defaultUsageInterval(metric)) * 100) / 100),
    alertBeforeValue: '7',
    alertBeforeUnit: 'days',
    recurringEnabled: false,
    recurringIntervalValue: '1',
    recurringIntervalUnit: 'months',
  };
}

function draftFromProposal(
  proposal: DealerMaintenanceScheduleProposal,
  asset: DealerMaintenanceTrackedAsset,
): Draft {
  return {
    maintenanceType: proposal.maintenanceType,
    triggerType: proposal.triggerType,
    notes: proposal.notes,
    dueDate: proposal.dueDate || todayInputDate(),
    dueUsage: proposal.dueUsage === null ? '' : String(proposal.dueUsage),
    alertBeforeValue: proposal.alertBeforeValue === null ? '0' : String(proposal.alertBeforeValue),
    alertBeforeUnit: (proposal.alertBeforeUnit || (proposal.triggerType === 'date' ? 'days' : asset.usageMetric)) as Draft['alertBeforeUnit'],
    recurringEnabled: proposal.recurringEnabled,
    recurringIntervalValue: proposal.recurringIntervalValue === null ? '' : String(proposal.recurringIntervalValue),
    recurringIntervalUnit: (proposal.recurringIntervalUnit || (proposal.triggerType === 'date' ? 'months' : asset.usageMetric)) as Draft['recurringIntervalUnit'],
  };
}

function draftFromRecord(
  record: DealerMaintenanceRecordSummary,
  asset: DealerMaintenanceTrackedAsset,
): Draft {
  return {
    maintenanceType: record.maintenanceType,
    triggerType: record.triggerType,
    notes: record.notes,
    dueDate: record.dueDate || todayInputDate(),
    dueUsage: record.dueUsage === null ? '' : String(record.dueUsage),
    alertBeforeValue: record.alertBeforeValue === null ? '0' : String(record.alertBeforeValue),
    alertBeforeUnit: (record.alertBeforeUnit || (record.triggerType === 'date' ? 'days' : asset.usageMetric)) as Draft['alertBeforeUnit'],
    recurringEnabled: record.recurringEnabled,
    recurringIntervalValue: record.recurringIntervalValue === null ? '' : String(record.recurringIntervalValue),
    recurringIntervalUnit: (record.recurringIntervalUnit || (record.triggerType === 'date' ? 'months' : asset.usageMetric)) as Draft['recurringIntervalUnit'],
  };
}

function usageUnitLabel(metric: DealerMaintenanceTrackedAsset['usageMetric']): string {
  if (metric === 'km') return 'km';
  if (metric === 'percentage') return '%';
  return 'hours';
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatUsage(value: number | null, metric: DealerMaintenanceTrackedAsset['usageMetric']): string {
  if (value === null || !Number.isFinite(value)) return '-';
  if (metric === 'percentage') {
    return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}%`;
  }
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} ${usageUnitLabel(metric)}`;
}

function selectedAssetLabel(asset: DealerMaintenanceTrackedAsset): string {
  const details = [
    asset.yearModel ? `Year Model: ${asset.yearModel}` : '',
    asset.currentUsage !== null ? `Usage: ${formatUsage(asset.currentUsage, asset.usageMetric)}` : '',
    asset.condition ? `Condition: ${titleCase(asset.condition)}` : '',
  ].filter(Boolean);
  return details.length ? details.join(' • ') : asset.assetTitle;
}

function ProposalDropdown({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
  disabled = false,
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  hideLabel?: boolean;
  disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;
    function closeFromOutside(event: MouseEvent | TouchEvent) {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', closeFromOutside);
    document.addEventListener('touchstart', closeFromOutside);
    return () => {
      document.removeEventListener('mousedown', closeFromOutside);
      document.removeEventListener('touchstart', closeFromOutside);
    };
  }, [isOpen]);

  return (
    <div className={hideLabel ? styles.dropdownOnlyField : styles.filterField}>
      {hideLabel ? null : <span>{label}</span>}
      <div ref={rootRef} className={`${styles.customFilterSelect} ${isOpen ? styles.customFilterSelectOpen : ''} ${disabled ? styles.customFilterSelectDisabled : ''}`}>
        <button
          type="button"
          className={`${styles.customFilterSelectButton} ${isOpen ? styles.customFilterSelectButtonOpen : ''}`}
          onClick={() => setIsOpen((current) => !current)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={label}
        >
          <span className={styles.customFilterSelectButtonText}>{selectedOption?.label ?? 'Choose option'}</span>
          <ChevronDownIcon className={styles.customFilterSelectChevron} />
        </button>
        {isOpen ? (
          <DropdownOverlay className={styles.customFilterSelectMenu} role="listbox" aria-label={label}>
            {options.map((option) => (
              <button
                key={`${label}-${option.value}`}
                type="button"
                className={`${styles.customFilterSelectOption} ${option.value === value ? styles.customFilterSelectOptionActive : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={option.value === value}
              >
                <span className={styles.customFilterSelectOptionLabel}>{option.label}</span>
              </button>
            ))}
          </DropdownOverlay>
        ) : null}
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.maintenanceCurrentUsage}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function DealerMaintenanceScheduleModal({
  accessId,
  externalShare,
  leadId,
  initialProposal = null,
  initialRecord = null,
  onClose,
  onAssetUpdated,
  onError,
}: Props) {
  const [asset, setAsset] = useState<DealerMaintenanceTrackedAsset | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [step, setStep] = useState<ScheduleStep>('maintenance-type');
  const [scheduleStep, setScheduleStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useLeadDialog(dismiss, saving);
  function dismiss() {
    if (!saving) onClose();
  }
  function goBack() {
    if (saving) return;
    setError('');
    if (step === 'form' && scheduleStep > 0) setScheduleStep((current) => current - 1);
    else if (step === 'form' && !initialRecord && !initialProposal) setStep('trigger-type');
    else if (step === 'trigger-type') setStep('maintenance-type');
    else onClose();
  }

  useEffect(() => {
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
  }, []);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('h3[tabindex]')?.focus({ preventScroll: true });
  }, [step, scheduleStep]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(externalShare ? `/api/asset-share-links/${externalShare.token}/assets/${externalShare.assetId}` : `/api/dealer/maintenance/${encodeURIComponent(accessId)}`, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as AssetResponse | null;
        if (!response.ok || !payload?.ok || !payload.asset) {
          throw new Error(payload?.error || 'Failed to load the shared asset.');
        }
        if (!payload.asset.permissions.canCreateMaintenanceSchedules) {
          throw new Error('The asset owner has not enabled dealer-created maintenance schedules.');
        }
        setAsset(payload.asset);
        setScheduleStep(0);
        if (initialProposal) {
          setDraft(draftFromProposal(initialProposal, payload.asset));
          setStep('form');
        } else if (initialRecord) {
          setDraft(draftFromRecord(initialRecord, payload.asset));
          setStep('form');
        } else {
          setDraft(emptyDraft(payload.asset));
          setStep('maintenance-type');
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        const message = cause instanceof Error ? cause.message : 'Failed to load the shared asset.';
        setError(message);
        onError?.(message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [accessId, initialProposal?.id, initialRecord?.id, externalShare?.token, externalShare?.assetId]);

  function updateDraft(update: Partial<Draft>) {
    setDraft((current) => {
      const next = { ...current, ...update };
      if (update.triggerType === 'date' && current.triggerType !== 'date') {
        next.alertBeforeValue = '7';
        next.alertBeforeUnit = 'days';
        next.recurringIntervalValue = '1';
        next.recurringIntervalUnit = 'months';
      }
      if (update.triggerType === 'usage' && current.triggerType !== 'usage' && asset) {
        next.alertBeforeValue = String(defaultUsageAlert(asset.usageMetric));
        next.alertBeforeUnit = asset.usageMetric;
        next.recurringIntervalValue = String(defaultUsageInterval(asset.usageMetric));
        next.recurringIntervalUnit = asset.usageMetric;
      }
      return next;
    });
    setError('');
  }

  async function submit() {
    if (!asset || saving) return;
    if (draft.triggerType === 'date' && !draft.dueDate) {
      setError('Choose a due date.');
      return;
    }
    if (draft.triggerType === 'usage' && draft.dueUsage.trim() === '') {
      setError('Enter a usage target.');
      return;
    }
    if (draft.recurringEnabled && draft.recurringIntervalValue.trim() === '') {
      setError('Enter a recurring interval.');
      return;
    }

    if (!Number.isFinite(Number(draft.alertBeforeValue)) || Number(draft.alertBeforeValue) < 0
      || (draft.triggerType === 'date' && !Number.isInteger(Number(draft.alertBeforeValue)))) {
      setError('Enter a valid reminder amount.'); return;
    }
    if (draft.triggerType === 'usage' && (!Number.isFinite(Number(draft.dueUsage)) || Number(draft.dueUsage) < 0)) {
      setError('Enter a valid usage target.'); return;
    }
    if (draft.recurringEnabled && (!Number.isFinite(Number(draft.recurringIntervalValue)) || Number(draft.recurringIntervalValue) <= 0
      || (draft.triggerType === 'date' && !Number.isInteger(Number(draft.recurringIntervalValue))))) {
      setError('Enter a valid repeat interval.'); return;
    }
    setSaving(true);
    setError('');
    try {
      const schedulePayload = {
        accessId,
        leadId: leadId || null,
        maintenanceType: draft.maintenanceType,
        triggerType: draft.triggerType,
        title: initialProposal?.title || initialRecord?.title || '',
        notes: draft.notes,
        dueDate: draft.triggerType === 'date' ? draft.dueDate : null,
        dueUsage: draft.triggerType === 'usage' ? draft.dueUsage : null,
        usageMetric: draft.triggerType === 'usage' ? asset.usageMetric : null,
        alertBeforeValue: draft.alertBeforeValue,
        alertBeforeUnit: draft.alertBeforeUnit,
        recurringEnabled: draft.recurringEnabled,
        recurringIntervalValue: draft.recurringEnabled ? draft.recurringIntervalValue : null,
        recurringIntervalUnit: draft.recurringEnabled ? draft.recurringIntervalUnit : null,
      };
      const editingActiveSchedule = Boolean(initialRecord);
      const editingProposal = Boolean(initialProposal);
      const endpoint = externalShare ? `/api/asset-share-links/${externalShare.token}/assets/${externalShare.assetId}` : editingActiveSchedule
        ? `/api/dealer/maintenance/${encodeURIComponent(accessId)}`
        : '/api/dealer/maintenance/schedule-proposals';
      const response = await fetch(endpoint, {
        method: editingActiveSchedule || editingProposal ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...schedulePayload,
          ...(initialRecord ? { maintenanceId: initialRecord.id } : {}),
          ...(initialProposal ? { proposalId: initialProposal.id } : {}),
        }),
      });
      const payload = await response.json().catch(() => null) as SaveResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || (editingActiveSchedule || editingProposal
          ? 'Failed to update the maintenance schedule.'
          : 'Failed to save the maintenance schedule.'));
      }
      if (!payload.asset) throw new Error('The saved maintenance schedule could not be loaded.');
      onAssetUpdated?.(payload.asset);
      onClose();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Failed to save the maintenance schedule.';
      setError(message);
      onError?.(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !asset) {
    return (
      <div className={`${styles.page} ${styles.modalBackdrop} ${styles.maintenanceChoiceBackdrop}`} data-website-overlay style={externalShare ? { zIndex: 26000 } : undefined} role="dialog" ref={node => { dialogRef.current = node; }} tabIndex={-1} aria-modal="true" aria-labelledby="dealer-schedule-loading-title">
        <section className={`${styles.formModal} ${styles.maintenanceStepModal} ${styles.schedulingDialog}`}>
          <header className={styles.modalHeader}>
            <div>
              <h2 id="dealer-schedule-loading-title">{initialRecord ? 'Edit schedule' : initialProposal ? 'Create schedule' : 'Schedule maintenance'}</h2>
              <p>{loading ? 'Loading the shared asset…' : 'The shared asset could not be opened.'}</p>
            </div>
            <button className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`} type="button" onClick={dismiss} aria-label="Close maintenance schedule" data-modal-close="true">
              <CloseIcon />
            </button>
          </header>
          <div className={styles.modalDivider} />
          <div className={styles.maintenanceChoiceBody}>
            <div className={styles.emptyState}>{error || 'Loading…'}</div>
          </div>
          <footer className={styles.modalFooter}>
            <button className={styles.secondaryButton} type="button" onClick={dismiss}>Cancel</button>
          </footer>
        </section>
      </div>
    );
  }

  if (step === 'maintenance-type') {
    return <MaintenanceEntryChoice step="type" timing="upcoming" assetTitle={asset.assetTitle} assetDetails={selectedAssetLabel(asset)}
      onClose={dismiss} onType={maintenanceType => { updateDraft({ maintenanceType }); setStep('trigger-type'); }} />;

  }

  if (step === 'trigger-type') {
    return (
      <div className={`${styles.page} ${styles.modalBackdrop} ${styles.maintenanceChoiceBackdrop}`} data-website-overlay style={externalShare ? { zIndex: 26000 } : undefined} role="dialog" ref={node => { dialogRef.current = node; }} tabIndex={-1} aria-modal="true" aria-labelledby="dealer-maintenance-trigger-title">
        <section className={`${styles.formModal} ${styles.maintenanceStepModal} ${styles.schedulingDialog}`}>
          <header className={styles.modalHeader}>
            <div>
              <h2 id="dealer-maintenance-trigger-title">Due by date or usage?</h2>
              <p>{asset.assetTitle}</p>
              <p>{selectedAssetLabel(asset)}</p>
            </div>
            <button className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`} type="button" onClick={dismiss} aria-label="Close maintenance trigger selection" data-modal-close="true">
              <CloseIcon />
            </button>
          </header>
          <div className={styles.modalDivider} />
          <div className={styles.maintenanceChoiceBody}>
            <div className={styles.maintenanceChoiceGrid}>
              <button
                className={styles.maintenanceChoiceCard}
                type="button"
                onClick={() => {
                  updateDraft({ triggerType: 'date' });
                  setScheduleStep(0);
                  setStep('form');
                }}
              >
                <span className={styles.maintenanceChoiceIcon} aria-hidden="true"><CostDetailIcon kind="calendar" /></span>
                <strong>Specific date</strong>
                <small>Choose a due date.</small>
              </button>
              <button
                className={styles.maintenanceChoiceCard}
                type="button"
                onClick={() => {
                  updateDraft({ triggerType: 'usage' });
                  setScheduleStep(0);
                  setStep('form');
                }}
              >
                <span className={styles.maintenanceChoiceIcon} aria-hidden="true"><CostDetailIcon kind="usage" /></span>
                <strong>Usage</strong>
                <small>Choose a target {usageUnitLabel(asset.usageMetric)} reading.</small>
              </button>
            </div>
          </div>
          <footer className={styles.modalFooter}>
            <button className={styles.secondaryButton} type="button" onClick={() => setStep('maintenance-type')}>Back</button>
            <button className={styles.secondaryButton} type="button" onClick={dismiss}>Cancel</button>
          </footer>
        </section>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${styles.modalBackdrop} ${styles.maintenanceChoiceBackdrop}`} data-website-overlay style={externalShare ? { zIndex: 26000 } : undefined} role="dialog" ref={node => { dialogRef.current = node; }} tabIndex={-1} aria-modal="true" aria-labelledby="dealer-maintenance-form-title">
      <section className={`${styles.formModal} ${styles.schedulingDialog} ${styles.simpleScheduleDialog}`}>
        <header className={styles.modalHeader}>
          <div>
            <h2 id="dealer-maintenance-form-title">
              {initialRecord
                ? `Edit ${draft.maintenanceType} schedule`
                : `Schedule ${draft.maintenanceType}`}
            </h2>
            <p>{asset.assetTitle}</p>
            <p>{selectedAssetLabel(asset)}</p>
          </div>
          <button className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`} type="button" onClick={dismiss} disabled={saving} aria-label="Close maintenance form" data-modal-close="true">
            <CloseIcon />
          </button>
        </header>
            <div key={scheduleStep} className={`${styles.formModalScrollBody} ${dialogStyles.body}`}>
              <div className={styles.scheduleSectionHeading}>
                <CostDetailIcon kind={scheduleStep === 0 && draft.triggerType === 'usage' ? 'usage' : (['calendar', 'clock', 'calendar', 'document'] as const)[scheduleStep]} />
                <h3 tabIndex={-1} aria-live="polite">{['When is it due?', 'When should we remind you?', 'Should this repeat?', 'Any notes?'][scheduleStep]}</h3>
              </div>
              <div className={styles.scheduleQuestion}>
                {scheduleStep === 0 ? (
                  <>
                    {draft.triggerType === 'date' ? (
                      <ScheduleDatePicker value={draft.dueDate} onChange={(dueDate) => updateDraft({ dueDate })} />
                    ) : (
                      <label className={styles.filterField}>
                        <span>Due at ({usageUnitLabel(asset.usageMetric)})</span>
                        <input aria-label="Due usage" required type="number" min="0" step="0.01" value={draft.dueUsage} onChange={(event) => updateDraft({ dueUsage: event.target.value })} />
                        <small>Current: {formatUsage(asset.currentUsage, asset.usageMetric)}</small>
                      </label>
                    )}
                  </>
                ) : null}
                {scheduleStep === 1 ? (
                  <label className={styles.filterField}>
                    <span>Remind me before</span>
                    <div className={styles.maintenanceInlineFields}>
                      <input aria-label="Reminder amount" required type="number" min="0" step={draft.triggerType === 'date' ? '1' : '0.01'} value={draft.alertBeforeValue} onChange={(event) => updateDraft({ alertBeforeValue: event.target.value })} />
                      {draft.triggerType === 'date' ? (
                        <ProposalDropdown label="Reminder unit" hideLabel value={draft.alertBeforeUnit} options={DATE_UNIT_OPTIONS} onChange={(value) => updateDraft({ alertBeforeUnit: value as DateIntervalUnit })} />
                      ) : <ReadOnlyField label="Unit" value={usageUnitLabel(asset.usageMetric)} />}
                    </div>
                  </label>
                ) : null}
                {scheduleStep === 2 ? (
                  <>
                    <fieldset className={styles.scheduleRepeat}>
                      <legend className={styles.scheduleHiddenLabel}>Repeat this schedule?</legend>
                      <div>
                        <button type="button" aria-pressed={!draft.recurringEnabled} onClick={() => updateDraft({ recurringEnabled: false })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 10h16m-12 5 3 3 5-5" /></svg><span>Once only</span></button>
                        <button type="button" aria-pressed={draft.recurringEnabled} onClick={() => updateDraft({ recurringEnabled: true })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 7H7a4 4 0 0 0-4 4m2 6h12a4 4 0 0 0 4-4M16 4l3 3-3 3M8 14l-3 3 3 3" /></svg><span>Repeat</span></button>
                      </div>
                    </fieldset>
                    {draft.recurringEnabled ? (
                      <label className={styles.filterField}>
                        <span>Repeat every</span>
                        <div className={styles.maintenanceInlineFields}>
                          <input aria-label="Repeat interval" required type="number" min={draft.triggerType === 'date' ? '1' : '0.01'} step={draft.triggerType === 'date' ? '1' : '0.01'} value={draft.recurringIntervalValue} onChange={(event) => updateDraft({ recurringIntervalValue: event.target.value })} />
                          {draft.triggerType === 'date' ? (
                            <ProposalDropdown label="Repeat unit" hideLabel value={draft.recurringIntervalUnit} options={DATE_UNIT_OPTIONS} onChange={(value) => updateDraft({ recurringIntervalUnit: value as DateIntervalUnit })} />
                          ) : <ReadOnlyField label="Unit" value={usageUnitLabel(asset.usageMetric)} />}
                        </div>
                      </label>
                    ) : null}
                  </>
                ) : null}
                {scheduleStep === 3 ? (
                  <label className={styles.filterField}>
                    <span>Notes (optional)</span>
                    <textarea maxLength={4000} aria-label="Notes" value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} placeholder="Anything the team should know?" />
                  </label>
                ) : null}
              </div>
              {error ? <p role="alert">{error}</p> : null}
            </div>
        <footer className={styles.modalFooter}>
          {scheduleStep > 0 || (!initialRecord && !initialProposal) ? <button className={styles.secondaryButton} type="button" onClick={goBack} disabled={saving}>Back</button> : null}
          <button className={styles.secondaryButton} type="button" onClick={dismiss} disabled={saving}>Cancel</button>
          <button className={styles.primaryButton} data-primary-action type="button" disabled={saving} onClick={(event) => {
            if (scheduleStep === 0 && draft.triggerType === 'date' && !draft.dueDate) { setError('Choose a due date.'); return; }
            const fields = event.currentTarget.closest('section')?.querySelectorAll<HTMLInputElement>('input');
            if (fields && Array.from(fields).some((field) => !field.reportValidity())) return;
            setError('');
            if (scheduleStep < 3) setScheduleStep((current) => current + 1);
            else void submit();
          }}>{saving ? 'Saving…' : scheduleStep < 3 ? 'Next' : initialRecord || initialProposal ? 'Save changes' : 'Create schedule'}</button>
        </footer>
      </section>
    </div>
  );
}



