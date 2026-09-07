'use client';

import DropdownOverlay from './DropdownOverlay';
import { useEffect, useRef, useState } from 'react';
import type {
  DealerMaintenanceRecordSummary,
  DealerMaintenanceScheduleProposal,
  DealerMaintenanceTrackedAsset,
} from '../lib/dealer-maintenance-tracker';
import styles from '../app/maintenance/page.module.css';

type Props = {
  accessId: string;
  leadId?: string | null;
  initialProposal?: DealerMaintenanceScheduleProposal | null;
  initialRecord?: DealerMaintenanceRecordSummary | null;
  onClose: () => void;
  onCreated?: (proposals: DealerMaintenanceScheduleProposal[]) => void;
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
  proposal?: DealerMaintenanceScheduleProposal;
  proposals?: DealerMaintenanceScheduleProposal[];
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

function ServiceGearIcon() {
  return (
    <svg className={styles.maintenanceChoiceSvg} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M19.4 13a7.7 7.7 0 0 0 .1-1 7.7 7.7 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a8.2 8.2 0 0 0-1.7-1L15 3.3h-4L10.6 6a8.2 8.2 0 0 0-1.7 1L6.4 6 4.4 9.4 6.5 11a7.7 7.7 0 0 0-.1 1c0 .3 0 .7.1 1l-2.1 1.6 2 3.4 2.5-1a8.2 8.2 0 0 0 1.7 1l.4 2.7h4l.4-2.7a8.2 8.2 0 0 0 1.7-1l2.5 1 2-3.4-2.2-1.6ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
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
    asset.assetKind ? titleCase(asset.assetKind) : '',
  ].filter(Boolean);
  return details.length ? details.join(' • ') : asset.assetTitle;
}

function triggerLabel(triggerType: TriggerType): string {
  return triggerType === 'date' ? 'Specific date' : 'Usage';
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

function SwitchField({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.switchField} ${checked ? styles.switchFieldActive : ''}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.switchTrack}><span /></span>
      <strong>Recurring</strong>
    </button>
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
  leadId,
  initialProposal = null,
  initialRecord = null,
  onClose,
  onCreated,
  onAssetUpdated,
  onError,
}: Props) {
  const [asset, setAsset] = useState<DealerMaintenanceTrackedAsset | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [step, setStep] = useState<ScheduleStep>('maintenance-type');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/dealer/maintenance/${encodeURIComponent(accessId)}`, {
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
  }, [accessId, initialProposal?.id, initialRecord?.id]);

  function updateDraft(update: Partial<Draft>) {
    setDraft((current) => {
      const next = { ...current, ...update };
      if (update.triggerType === 'date') {
        next.alertBeforeValue = '7';
        next.alertBeforeUnit = 'days';
        next.recurringIntervalValue = '1';
        next.recurringIntervalUnit = 'months';
      }
      if (update.triggerType === 'usage' && asset) {
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
      const endpoint = editingActiveSchedule
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
          : 'Failed to send the proposed schedule.'));
      }
      if (editingActiveSchedule) {
        if (!payload.asset) throw new Error('The updated maintenance schedule could not be loaded.');
        onAssetUpdated?.(payload.asset);
      } else {
        if (!payload.proposal || !Array.isArray(payload.proposals)) {
          throw new Error('The maintenance proposal could not be loaded.');
        }
        onCreated?.(payload.proposals);
      }
      onClose();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Failed to send the proposed schedule.';
      setError(message);
      onError?.(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !asset) {
    return (
      <div className={`${styles.page} ${styles.modalBackdrop}`} data-website-overlay role="dialog" aria-modal="true" aria-labelledby="dealer-schedule-loading-title">
        <section className={`${styles.formModal} ${styles.maintenanceStepModal}`}>
          <header className={styles.modalHeader}>
            <div>
              <h2 id="dealer-schedule-loading-title">{initialRecord ? 'Edit schedule' : initialProposal ? 'Edit proposal' : 'Send a proposed schedule'}</h2>
              <p>{loading ? 'Loading the shared asset…' : 'The shared asset could not be opened.'}</p>
            </div>
            <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close proposed schedule">
              <CloseIcon />
            </button>
          </header>
          <div className={styles.modalDivider} />
          <div className={styles.maintenanceChoiceBody}>
            <div className={styles.emptyState}>{error || 'Loading…'}</div>
          </div>
          <footer className={styles.modalFooter}>
            <button className={styles.secondaryButton} type="button" onClick={onClose}>Cancel</button>
          </footer>
        </section>
      </div>
    );
  }

  if (step === 'maintenance-type') {
    return (
      <div className={`${styles.page} ${styles.modalBackdrop}`} data-website-overlay role="dialog" aria-modal="true" aria-labelledby="dealer-maintenance-type-title">
        <section className={`${styles.formModal} ${styles.maintenanceStepModal}`}>
          <header className={styles.modalHeader}>
            <div>
              <h2 id="dealer-maintenance-type-title">What are you scheduling?</h2>
              <p>{selectedAssetLabel(asset)}</p>
            </div>
            <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close maintenance type selection">
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
                  updateDraft({ maintenanceType: 'service' });
                  setStep('trigger-type');
                }}
              >
                <span className={styles.maintenanceChoiceIcon} aria-hidden="true"><ServiceGearIcon /></span>
                <strong>Service</strong>
                <small>Routine servicing or repairs.</small>
              </button>
              <button
                className={styles.maintenanceChoiceCard}
                type="button"
                onClick={() => {
                  updateDraft({ maintenanceType: 'checkup' });
                  setStep('trigger-type');
                }}
              >
                <span className={styles.maintenanceChoiceIcon} aria-hidden="true">✓</span>
                <strong>Checkup</strong>
                <small>Inspection or condition check.</small>
              </button>
            </div>
          </div>
          <footer className={styles.modalFooter}>
            <button className={styles.secondaryButton} type="button" onClick={onClose}>Back</button>
            <button className={styles.secondaryButton} type="button" onClick={onClose}>Cancel</button>
          </footer>
        </section>
      </div>
    );
  }

  if (step === 'trigger-type') {
    return (
      <div className={`${styles.page} ${styles.modalBackdrop}`} data-website-overlay role="dialog" aria-modal="true" aria-labelledby="dealer-maintenance-trigger-title">
        <section className={`${styles.formModal} ${styles.maintenanceStepModal}`}>
          <header className={styles.modalHeader}>
            <div>
              <h2 id="dealer-maintenance-trigger-title">When should it be due?</h2>
              <p>{titleCase(draft.maintenanceType)} • {selectedAssetLabel(asset)}</p>
            </div>
            <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close maintenance trigger selection">
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
                  setStep('form');
                }}
              >
                <span className={styles.maintenanceChoiceIcon} aria-hidden="true">31</span>
                <strong>Specific date</strong>
                <small>Choose a due date.</small>
              </button>
              <button
                className={styles.maintenanceChoiceCard}
                type="button"
                onClick={() => {
                  updateDraft({ triggerType: 'usage' });
                  setStep('form');
                }}
              >
                <span className={styles.maintenanceChoiceIcon} aria-hidden="true">↗</span>
                <strong>Usage</strong>
                <small>Choose a target {usageUnitLabel(asset.usageMetric)} reading.</small>
              </button>
            </div>
          </div>
          <footer className={styles.modalFooter}>
            <button className={styles.secondaryButton} type="button" onClick={() => setStep('maintenance-type')}>Back</button>
            <button className={styles.secondaryButton} type="button" onClick={onClose}>Cancel</button>
          </footer>
        </section>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${styles.modalBackdrop}`} data-website-overlay role="dialog" aria-modal="true" aria-labelledby="dealer-maintenance-form-title">
      <section className={`${styles.formModal} ${styles.maintenanceStepModal}`}>
        <header className={styles.modalHeader}>
          <div>
            <h2 id="dealer-maintenance-form-title">
              {initialRecord
                ? `Edit ${draft.maintenanceType} schedule`
                : initialProposal
                  ? `Edit ${draft.maintenanceType} proposal`
                  : `Schedule ${draft.maintenanceType}`}
            </h2>
            <p>{`${triggerLabel(draft.triggerType)} • ${selectedAssetLabel(asset)}`}</p>
          </div>
          <button className={styles.closeButton} type="button" onClick={onClose} disabled={saving} aria-label="Close maintenance form">
            <CloseIcon />
          </button>
        </header>
        <div className={styles.modalDivider} />
        <div className={styles.formModalScrollBody}>
          {error ? <div className={`${styles.notice} ${styles.noticeError}`} role="alert">{error}</div> : null}
          <div className={styles.maintenanceSectionTitle}>{draft.triggerType === 'date' ? 'Specific date setup' : 'Usage setup'}</div>
          <div className={styles.maintenanceFieldGrid}>
            {draft.triggerType === 'date' ? (
              <>
                <label className={styles.filterField}>
                  <span>Due date</span>
                  <input type="date" value={draft.dueDate} onChange={(event) => updateDraft({ dueDate: event.target.value })} />
                </label>
                <label className={styles.filterField}>
                  <span>Alert before</span>
                  <div className={styles.maintenanceInlineFields}>
                    <input type="number" min="0" step="1" value={draft.alertBeforeValue} onChange={(event) => updateDraft({ alertBeforeValue: event.target.value })} />
                    <ProposalDropdown
                      label="Alert unit"
                      hideLabel
                      value={draft.alertBeforeUnit}
                      options={DATE_UNIT_OPTIONS}
                      onChange={(value) => updateDraft({ alertBeforeUnit: value as DateIntervalUnit })}
                    />
                  </div>
                </label>
                <SwitchField checked={draft.recurringEnabled} onChange={(checked) => updateDraft({ recurringEnabled: checked })} />
                {draft.recurringEnabled ? (
                  <label className={styles.filterField}>
                    <span>Recurring interval</span>
                    <div className={styles.maintenanceInlineFields}>
                      <input type="number" min="1" step="1" value={draft.recurringIntervalValue} onChange={(event) => updateDraft({ recurringIntervalValue: event.target.value })} />
                      <ProposalDropdown
                        label="Recurring unit"
                        hideLabel
                        value={draft.recurringIntervalUnit}
                        options={DATE_UNIT_OPTIONS}
                        onChange={(value) => updateDraft({ recurringIntervalUnit: value as DateIntervalUnit })}
                      />
                    </div>
                  </label>
                ) : null}
              </>
            ) : (
              <>
                <ReadOnlyField label="Current usage" value={formatUsage(asset.currentUsage, asset.usageMetric)} />
                <ReadOnlyField label="Usage metric" value={usageUnitLabel(asset.usageMetric)} />
                <label className={styles.filterField}>
                  <span>Due usage</span>
                  <input type="number" min="0" step="0.01" value={draft.dueUsage} onChange={(event) => updateDraft({ dueUsage: event.target.value })} />
                </label>
                <label className={styles.filterField}>
                  <span>Alert before</span>
                  <div className={styles.maintenanceInlineFields}>
                    <input type="number" min="0" step="0.01" value={draft.alertBeforeValue} onChange={(event) => updateDraft({ alertBeforeValue: event.target.value })} />
                    <ReadOnlyField label="Unit" value={usageUnitLabel(asset.usageMetric)} />
                  </div>
                </label>
                <SwitchField checked={draft.recurringEnabled} onChange={(checked) => updateDraft({ recurringEnabled: checked })} />
                {draft.recurringEnabled ? (
                  <label className={styles.filterField}>
                    <span>Recurring interval</span>
                    <div className={styles.maintenanceInlineFields}>
                      <input type="number" min="0" step="0.01" value={draft.recurringIntervalValue} onChange={(event) => updateDraft({ recurringIntervalValue: event.target.value })} />
                      <ReadOnlyField label="Unit" value={usageUnitLabel(asset.usageMetric)} />
                    </div>
                  </label>
                ) : null}
              </>
            )}

            <ProposalDropdown
              label="Assigned to"
              value="unassigned"
              options={[{ value: 'unassigned', label: 'Unassigned' }]}
              onChange={() => undefined}
              disabled
            />

            <label className={`${styles.filterField} ${styles.maintenanceFieldFull}`}>
              <span>Notes</span>
              <textarea
                value={draft.notes}
                onChange={(event) => updateDraft({ notes: event.target.value })}
                placeholder="Add service/checkup notes, supplier detail or internal reminders..."
                maxLength={4000}
              />
            </label>
          </div>
        </div>
        <footer className={styles.modalFooter}>
          {!initialProposal && !initialRecord ? (
            <button className={styles.secondaryButton} type="button" onClick={() => setStep('trigger-type')} disabled={saving}>Back</button>
          ) : null}
          <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className={styles.primaryButton} type="button" onClick={() => void submit()} disabled={saving}>
            {saving
              ? initialProposal || initialRecord ? 'Saving…' : 'Sending…'
              : initialProposal || initialRecord ? 'Save changes' : 'Send proposal'}
          </button>
        </footer>
      </section>
    </div>
  );
}


