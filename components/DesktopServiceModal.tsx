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
};

export type DesktopServiceRecord = {
  id: string;
  assetTitle: string;
  assetKind: string;
  assetCategoryLabel?: string | null;
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

function WrenchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.8 6.2a5 5 0 0 0-6.5 6.5L3.5 17.5a2.1 2.1 0 0 0 3 3l4.8-4.8a5 5 0 0 0 6.5-6.5l-3 3-3-3 3-3Z" /></svg>;
}

export default function DesktopServiceModal({ record, busy = false, onClose, onSubmit }: Props) {
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
  const actionName = record.maintenanceType === 'checkup' ? 'check-up' : 'service';
  const unit = usageUnit(record.usageMetric ?? record.assetUsageMetric ?? null);

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
    if (record.triggerType === 'usage' && usage === null) {
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
    });
  }

  return (
    <div className={styles.overlay} role="presentation">
      <button className={styles.backdrop} type="button" onClick={onClose} aria-label="Close service form" disabled={busy} />
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="desktop-service-title">
        <header className={styles.header}>
          <div className={styles.headerIcon}>{mode === 'checked' ? <CheckIcon /> : <WrenchIcon />}</div>
          <div>
            <span className={styles.eyebrow}>Desktop backup entry</span>
            <h2 id="desktop-service-title">Record {actionName}</h2>
            <p>{record.assetTitle} · {record.title}</p>
          </div>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close service form" disabled={busy}>
            <CloseIcon />
          </button>
        </header>

        <form onSubmit={(event) => void submit(event)}>
          <div className={styles.body}>
            <div className={styles.infoBanner}>
              <strong>Log work that has already been completed.</strong>
              <span>Use the actual date and final usage reading. This saves the same service record as the app.</span>
            </div>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <span>1</span>
                <div><h3>When was it done?</h3><p>Capture the actual completion date and reading.</p></div>
              </div>
              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span>Completion date</span>
                  <input type="date" value={completedAt} max={today} onChange={(event) => setCompletedAt(event.target.value)} required />
                </label>
                <label className={styles.field}>
                  <span>Usage at completion <small>({unit})</small></span>
                  <div className={styles.usageInput}>
                    <input type="number" min={record.currentUsage ?? 0} step="0.1" value={completedUsage} onChange={(event) => setCompletedUsage(event.target.value)} placeholder={`Current ${unit}`} required={record.triggerType === 'usage'} />
                    <b>{unit}</b>
                  </div>
                </label>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <span>2</span>
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

            {record.recurringEnabled ? (
              <div className={styles.recurringBanner}>
                <CheckIcon />
                <div><strong>Recurring maintenance</strong><span>This entry will be saved as done and a new schedule will be created automatically{intervalLabel(record) ? ` · ${intervalLabel(record)}` : ''}.</span></div>
              </div>
            ) : null}

            {error ? <div className={styles.error} role="alert">{error}</div> : null}
          </div>

          <footer className={styles.footer}>
            <button className={styles.cancelButton} type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button className={styles.submitButton} type="submit" disabled={busy}>
              {busy ? 'Saving service…' : `Save ${actionName} as done`}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
