'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  buildMaintenanceCompletionNote,
  checkedOptionsForProfile,
  resolveAssetServiceProfile,
  serviceCopyForProfile,
  servicedOptionsForProfile,
} from '../lib/maintenance-service-guidelines';
import styles from './DesktopServiceModal.module.css';
import dialogStyles from './MaintenanceDialog.module.css';
import { useMaintenanceChecklist } from '../lib/use-maintenance-checklist';
import { checklistOptions, buildMaintenanceWorkSnapshot, type MaintenanceIdentity, type MaintenanceWorkSnapshot } from '../lib/maintenance-catalogue';

export type DesktopServiceCompletion = {
  completedAt: string;
  completedUsage: number | null;
  completedNotes: string;
  completedBy: string;
  linkToScheduledMaintenance?: boolean;
  clientEventId: string;
  maintenanceWork?: MaintenanceWorkSnapshot[];
};

export type DesktopServiceRecord = {
  id: string;
  assetTitle: string;
  maintenanceIdentity?: MaintenanceIdentity;
  assetKind: string;
  assetCategoryLabel?: string | null;
  assetYearModel?: number | null;
  assetCondition?: string | null;
  assetMeta?: string | null;
  maintenanceType: 'service' | 'checkup';
  triggerType?: 'date' | 'usage';
  title: string;
  currentUsage: number | null;
  usageMetric: 'hours' | 'km' | 'percentage' | null;
  assetUsageMetric?: 'hours' | 'km' | 'percentage' | null;
  assignedName?: string | null;
  recurringEnabled?: boolean;
  recurringIntervalValue?: number | null;
  recurringIntervalUnit?: string | null;
};

type Props = {
  record: DesktopServiceRecord;
  busy?: boolean;
  askScheduleLink?: boolean;
  dealerAppMode?: boolean;
  standalone?: boolean;
  onBack?: () => void;
  onClose: () => void;
  onSubmit: (completion: DesktopServiceCompletion) => void | Promise<void>;
};

function todayInputValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function usageUnit(metric: DesktopServiceRecord['usageMetric']): string {
  if (metric === 'km') return 'km';
  if (metric === 'percentage') return '%';
  return 'hours';
}

function intervalLabel(record: DesktopServiceRecord): string {
  if (!record.recurringEnabled || !record.recurringIntervalValue || !record.recurringIntervalUnit) return '';
  const value = record.recurringIntervalValue;
  const unit = value === 1 ? record.recurringIntervalUnit.replace(/s$/, '') : record.recurringIntervalUnit;
  return `Every ${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} ${unit}`;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 6.5 11 11m0-11-11 11" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7" /></svg>;
}

export default function DesktopServiceModal({
  record,
  busy = false,
  askScheduleLink = false,
  dealerAppMode = false,
  standalone = false,
  onBack,
  onClose,
  onSubmit,
}: Props) {
  const mode = record.maintenanceType === 'checkup' ? 'checked' : 'serviced';
  const profile = useMemo(() => resolveAssetServiceProfile({
    title: record.assetTitle,
    kind: record.assetKind,
    categoryLabel: record.assetCategoryLabel,
    usageMetric: record.usageMetric ?? record.assetUsageMetric,
  }), [record.assetCategoryLabel, record.assetKind, record.assetTitle, record.assetUsageMetric, record.usageMetric]);
  const copy = serviceCopyForProfile(profile);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const checklist = useMaintenanceChecklist(record, selectedItems.length > 0);
  const options = checklist.items.length ? checklistOptions(checklist, mode) : mode === 'checked' ? checkedOptionsForProfile(profile) : servicedOptionsForProfile(profile);
  const today = todayInputValue();
  const [completedAt, setCompletedAt] = useState(today);
  const [completedUsage, setCompletedUsage] = useState(standalone || record.currentUsage === null ? '' : String(record.currentUsage));
  const [company, setCompany] = useState('');
  const [mechanic, setMechanic] = useState(record.maintenanceType === 'checkup' ? record.assignedName?.trim() || '' : '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [clientEventId] = useState(() => globalThis.crypto.randomUUID());
  const [scheduleDecision, setScheduleDecision] = useState<
    'scheduled' | 'separate' | null
  >(askScheduleLink ? null : 'scheduled');
  const actionName = record.maintenanceType === 'checkup' ? 'check-up' : 'service';
  const unit = usageUnit(record.usageMetric ?? record.assetUsageMetric ?? null);
  const isSeparateCompletion = scheduleDecision === 'separate';
  const requiresUsageReading = !standalone && !isSeparateCompletion && record.triggerType === 'usage';
  const savedUsageLabel = record.currentUsage === null
    ? `No saved ${unit} reading`
    : `Saved reading: ${record.currentUsage.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} ${unit}`;

  function toggleItem(label: string) {
    setSelectedItems((current) => current.includes(label)
      ? current.filter((item) => item !== label)
      : [...current, label]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!completedAt) {
      setError(`Select the date the ${actionName} was completed.`);
      return;
    }
    if (completedAt > today) {
      setError('The completion date cannot be in the future.');
      return;
    }
    if (!selectedItems.length && !notes.trim()) {
      setError(mode === 'checked'
        ? 'Select at least one checked item or add notes/problems.'
        : 'Select at least one completed service item or add notes/problems.');
      return;
    }
    if (mode === 'serviced' && !company.trim()) {
      setError(`${copy.companyLabel} is required.`);
      return;
    }
    if (!mechanic.trim()) {
      setError(mode === 'checked' ? 'Enter who completed the check-up.' : `${copy.mechanicLabel} is required.`);
      return;
    }

    const usage = completedUsage.trim() === '' ? null : Number(completedUsage);
    if (requiresUsageReading && usage === null) {
      setError(`Enter the final ${unit} reading for this usage-based maintenance.`);
      return;
    }
    if (usage !== null && (!Number.isFinite(usage) || usage < 0)) {
      setError('Enter a valid non-negative usage reading.');
      return;
    }
    if (!standalone && !isSeparateCompletion && usage !== null && record.currentUsage !== null && usage < record.currentUsage) {
      setError(`The completed reading cannot be lower than the saved ${record.currentUsage.toLocaleString('en-ZA')} ${unit}.`);
      return;
    }

    try {
      await onSubmit({
        completedAt,
        completedUsage: usage,
        completedNotes: buildMaintenanceCompletionNote({
          serviceMode: mode,
          checkedItems: mode === 'checked' ? selectedItems : [],
          servicedItems: mode === 'serviced' ? selectedItems : [],
          repairDetails: '',
          serviceCompany: company,
          mechanicName: mechanic,
          note: notes,
        }),
        maintenanceWork: [buildMaintenanceWorkSnapshot(checklist, mode, selectedItems)],
        completedBy: mechanic.trim(),
        linkToScheduledMaintenance: !standalone && scheduleDecision !== 'separate',
        clientEventId,
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save completed work.");
    }
  }

  if (askScheduleLink && scheduleDecision === null) {
    return (
      <div className={`${styles.overlay} ${dealerAppMode ? styles.dealerChoiceOverlay : ''}`} data-website-overlay role="presentation">
        <button className={`${styles.backdrop} ${!dealerAppMode ? dialogStyles.backdrop : ''}`} type="button" onClick={onClose} aria-label="Close service choice" disabled={busy} />
        <section className={`${styles.modal} ${styles.saveChoiceModal} ${!dealerAppMode ? dialogStyles.dialog : ''}`} role="dialog" aria-modal="true" aria-labelledby="scheduled-service-choice-title">
          <header className={styles.header}>
            <div>
              <h2 id="scheduled-service-choice-title">Which work was done?</h2>
              <p>{record.assetTitle}</p>
            </div>
            <button className={dealerAppMode ? styles.closeButton : dialogStyles.close} type="button" onClick={onClose} aria-label="Close service choice" disabled={busy}>
              <CloseIcon />
            </button>
          </header>
          <div className={`${styles.body} ${!dealerAppMode ? dialogStyles.body : ''}`}>
            <div className={styles.scheduleSummary}>
              <span>Scheduled {actionName}</span>
              <strong>{record.title}</strong>
              <small>{intervalLabel(record) || 'One-time'}</small>
            </div>
            <div className={styles.saveChoices}>
              <button type="button" onClick={() => setScheduleDecision('scheduled')} disabled={busy}>
                <strong>Complete scheduled</strong>
                <span>{record.recurringEnabled ? 'Mark done and create the next reminder.' : 'Mark this scheduled work as done.'}</span>
              </button>
              <button type="button" onClick={() => setScheduleDecision('separate')} disabled={busy}>
                <strong>Record other work</strong>
                <span>Keep this schedule open.</span>
              </button>
            </div>
          </div>

        </section>
      </div>
    );
  }

  return (
    <div className={styles.overlay} data-website-overlay role="presentation">
      <button className={styles.backdrop} type="button" onClick={onClose} aria-label="Close service form" disabled={busy} />
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="desktop-service-title">
        <header className={styles.header}>
          <div>
            <h2 id="desktop-service-title">{standalone ? 'Record completed work' : `Record ${actionName}`}</h2>
            <p>{record.assetTitle}</p>
          </div>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close service form" disabled={busy}>
            <CloseIcon />
          </button>
        </header>

        <form onSubmit={(event) => void submit(event)}>
          <div className={styles.body}>
            {!standalone ? <div className={styles.infoBanner}>
              <strong>{isSeparateCompletion ? 'Record other work' : `Completing “${record.title}”`}</strong>
              <span>{isSeparateCompletion ? 'The scheduled work stays open.' : record.recurringEnabled ? 'The next reminder will be created automatically.' : 'This scheduled work will be marked done.'}</span>
            </div> : null}

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <span>1</span>
                <div>
                  <h3>{mode === 'checked' ? copy.checkedHeader : copy.servicedHeader}</h3>
                  <p>{checklist.label} · Select applicable items. Add other work in notes.</p>
                </div>
                <strong className={styles.selectedCount}>{selectedItems.length} selected</strong>
              </div>
              <div className={styles.checklist}>
                {options.map((option) => {
                  const selected = selectedItems.includes(option.label);
                  return (
                    <button
                      key={option.label}
                      type="button"
                      className={selected ? styles.checkOptionSelected : styles.checkOption}
                      onClick={() => toggleItem(option.label)}
                      aria-pressed={selected}
                    >
                      <span className={styles.checkbox}>{selected ? <CheckIcon /> : null}</span>
                      <span><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <span>2</span>
                <div><h3>When was it completed?</h3><p>Enter the date and reading at the time.</p></div>
              </div>
              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span>Completion date</span>
                  <input type="date" value={completedAt} max={today} onChange={(event) => setCompletedAt(event.target.value)} required />
                </label>
                <label className={styles.field}>
                  <span>Usage at completion <small>({unit}, {requiresUsageReading ? 'required' : 'optional'})</small></span>
                  <div className={styles.usageInput}>
                    <input type="number" min={standalone || isSeparateCompletion ? 0 : record.currentUsage ?? 0} step="0.1" value={completedUsage} onChange={(event) => setCompletedUsage(event.target.value)} placeholder={`Final ${unit} reading`} required={requiresUsageReading} />
                    <b>{unit}</b>
                  </div>
                  <small className={styles.fieldHint}>{savedUsageLabel}</small>
                </label>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <span>3</span>
                <div>
                  <h3>{mode === 'checked' ? 'Who completed the check-up?' : copy.detailsHeader}</h3>
                  <p>{mode === 'checked' ? 'Save the person responsible for this inspection.' : copy.detailsSubheader}</p>
                </div>
              </div>
              <div className={styles.fieldGrid}>
                {mode === 'serviced' ? (
                  <label className={styles.field}>
                    <span>{copy.companyLabel}</span>
                    <input type="text" value={company} onChange={(event) => setCompany(event.target.value)} placeholder={copy.companyPlaceholder} required />
                  </label>
                ) : null}
                <label className={`${styles.field} ${mode === 'checked' ? styles.fieldWide : ''}`}>
                  <span>{mode === 'checked' ? 'Checked by' : copy.mechanicLabel}</span>
                  <input type="text" value={mechanic} onChange={(event) => setMechanic(event.target.value)} placeholder={mode === 'checked' ? 'Name of person who checked the asset' : copy.mechanicPlaceholder} required />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Work details / notes <small>(optional if items are selected)</small></span>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={mode === 'checked' ? copy.checkedNotePlaceholder : copy.servicedNotePlaceholder} rows={3} />
                </label>
              </div>
            </section>

            {error ? <div className={styles.error} role="alert">{error}</div> : null}
          </div>

          <footer className={styles.footer}>
            {onBack || askScheduleLink ? <button className={styles.cancelButton} type="button" disabled={busy} onClick={() => { if (askScheduleLink) setScheduleDecision(null); else onBack?.(); }}>Back</button> : null}
            <button className={styles.cancelButton} type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button className={styles.submitButton} type="submit" disabled={busy}>
              {busy
                ? `Saving…`
                : standalone || isSeparateCompletion
                  ? 'Save record'
                  : askScheduleLink
                    ? `Complete scheduled ${actionName}`
                    : `Save completed ${actionName}`}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
