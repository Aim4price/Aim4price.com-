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

export type DesktopServiceCompletion = {
  completedAt: string;
  completedUsage: number | null;
  completedNotes: string;
  completedBy: string;
  linkToScheduledMaintenance?: boolean;
  clientEventId: string;
};

export type DesktopServiceRecord = {
  id: string;
  assetTitle: string;
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

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function serviceAssetMeta(record: DesktopServiceRecord): string {
  const unit = usageUnit(record.usageMetric ?? record.assetUsageMetric ?? null);
  const details = [
    record.assetTitle,
    typeof record.assetYearModel === 'number' && record.assetYearModel > 0
      ? `Year Model: ${record.assetYearModel}`
      : '',
    typeof record.currentUsage === 'number' && Number.isFinite(record.currentUsage)
      ? `Usage: ${record.currentUsage.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} ${unit}`
      : '',
    record.assetCondition?.trim() ? `Condition: ${record.assetCondition.trim()}` : '',
    titleCase(record.assetCategoryLabel?.trim() || record.assetKind.trim()),
  ].filter(Boolean);

  return details.length > 1 ? details.join(' · ') : record.assetMeta?.trim() || record.assetTitle;
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
  const options = mode === 'checked' ? checkedOptionsForProfile(profile) : servicedOptionsForProfile(profile);
  const today = todayInputValue();
  const [completedAt, setCompletedAt] = useState(today);
  const [completedUsage, setCompletedUsage] = useState(record.currentUsage === null ? '' : String(record.currentUsage));
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
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
  const requiresUsageReading = record.triggerType === 'usage';
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
    if (usage !== null && record.currentUsage !== null && usage < record.currentUsage) {
      setError(`The completed reading cannot be lower than the saved ${record.currentUsage.toLocaleString('en-ZA')} ${unit}.`);
      return;
    }

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
      completedBy: mechanic.trim(),
      linkToScheduledMaintenance: scheduleDecision !== 'separate',
      clientEventId,
    });
  }

  if (askScheduleLink && scheduleDecision === null) {
    return (
      <div className={`${styles.overlay} ${dealerAppMode ? styles.dealerChoiceOverlay : ''}`} data-website-overlay role="presentation">
        <button className={styles.backdrop} type="button" onClick={onClose} aria-label="Close service choice" disabled={busy} />
        <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="scheduled-service-choice-title">
          <header className={styles.header}>
            <div>
              <h2 id="scheduled-service-choice-title">{dealerAppMode ? `Save ${actionName}` : <>How should this {actionName} be saved?</>}</h2>
              <p>{dealerAppMode ? record.assetTitle : serviceAssetMeta(record)}</p>
            </div>
            <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close service choice" disabled={busy}>
              <CloseIcon />
            </button>
          </header>
          <div className={styles.body}>
            <div className={styles.scheduleSummary}>
              <span>Scheduled {actionName}</span>
              <strong>{record.title}</strong>
              <small>{intervalLabel(record) || 'One-time scheduled maintenance'}</small>
            </div>
            <div className={styles.choiceComparison}>
              <div>
                <strong>{dealerAppMode ? 'Complete scheduled' : 'Complete this scheduled item'}</strong>
                <span>{dealerAppMode ? 'Save the work and close this scheduled item.' : <>Choose “Yes” when the completed work was for “{record.title}”. The scheduled item will close.</>}</span>
              </div>
              <div>
                <strong>{dealerAppMode ? 'Save separately' : 'Keep the scheduled item open'}</strong>
                <span>{dealerAppMode ? 'Save other work. Keep this scheduled item open.' : <>Choose “No” when different work was done. A separate record will be saved and this schedule will stay unchanged.</>}</span>
              </div>
            </div>
          </div>
          <footer className={styles.footer}>
            <button
              className={styles.cancelButton}
              type="button"
              onClick={() => setScheduleDecision('separate')}
              disabled={busy}
            >
              {dealerAppMode ? 'Save separately' : 'No, save separately'}
            </button>
            <button
              className={styles.submitButton}
              type="button"
              onClick={() => setScheduleDecision('scheduled')}
              disabled={busy}
            >
              {dealerAppMode ? 'Complete scheduled' : <>Yes, complete scheduled {actionName}</>}
            </button>
          </footer>
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
            <h2 id="desktop-service-title">Record completed {actionName}</h2>
            <p>{serviceAssetMeta(record)}</p>
          </div>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close service form" disabled={busy}>
            <CloseIcon />
          </button>
        </header>

        <form onSubmit={(event) => void submit(event)}>
          <div className={styles.body}>
            <div className={`${styles.infoBanner} ${isSeparateCompletion ? styles.separateBanner : ''}`}>
              <strong>{isSeparateCompletion ? `Saving a separate ${actionName}` : `Completing “${record.title}”`}</strong>
              <span>
                {isSeparateCompletion
                  ? `Log work that has already been completed. “${record.title}” will remain open and unchanged.`
                  : 'Log work that has already been completed. This scheduled item will be marked as done.'}
              </span>
            </div>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <span>1</span>
                <div>
                  <h3>{mode === 'checked' ? copy.checkedHeader : copy.servicedHeader}</h3>
                  <p>{mode === 'checked' ? copy.checkedSubheader : copy.servicedSubheader}</p>
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
                      <span><strong>{option.label}</strong><small>{option.description}</small></span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <span>2</span>
                <div><h3>When was it completed?</h3><p>Use the actual date and the reading after the work.</p></div>
              </div>
              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span>Completion date</span>
                  <input type="date" value={completedAt} max={today} onChange={(event) => setCompletedAt(event.target.value)} required />
                </label>
                <label className={styles.field}>
                  <span>Usage at completion <small>({unit}, {requiresUsageReading ? 'required' : 'optional'})</small></span>
                  <div className={styles.usageInput}>
                    <input type="number" min={record.currentUsage ?? 0} step="0.1" value={completedUsage} onChange={(event) => setCompletedUsage(event.target.value)} placeholder={`Final ${unit} reading`} required={requiresUsageReading} />
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
                  <span>Notes / problems <small>(optional if items are selected)</small></span>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={mode === 'checked' ? copy.checkedNotePlaceholder : copy.servicedNotePlaceholder} rows={4} />
                </label>
              </div>
            </section>

            {record.recurringEnabled && !isSeparateCompletion ? (
              <div className={styles.recurringBanner}>
                <CheckIcon />
                <div><strong>What happens after saving</strong><span>This scheduled item will close and the next one will be created automatically{intervalLabel(record) ? ` · ${intervalLabel(record)}` : ''}.</span></div>
              </div>
            ) : null}

            {isSeparateCompletion ? (
              <div className={`${styles.recurringBanner} ${styles.separateBanner}`}>
                <span className={styles.infoIcon} aria-hidden="true">i</span>
                <div><strong>The scheduled item stays open</strong><span>Only this separate completed {actionName} will be added to the asset history.</span></div>
              </div>
            ) : null}

            {error ? <div className={styles.error} role="alert">{error}</div> : null}
          </div>

          <footer className={styles.footer}>
            <button className={styles.cancelButton} type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button className={styles.submitButton} type="submit" disabled={busy}>
              {busy
                ? `Saving ${actionName}…`
                : isSeparateCompletion
                  ? `Save separate ${actionName}`
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

