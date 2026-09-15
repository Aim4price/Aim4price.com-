'use client';

import { useEffect, useRef, useMemo, useState, type KeyboardEvent, type FormEvent } from 'react';
import {
  buildMaintenanceCompletionNote,
  checkedOptionsForProfile,
  resolveAssetServiceProfile,
  serviceCopyForProfile,
  servicedOptionsForProfile,
} from '../lib/maintenance-service-guidelines';
import styles from './DesktopServiceModal.module.css';
import dialogStyles from './MaintenanceDialog.module.css';
import { useAssetChecklistItems } from '../lib/use-asset-checklist-items';
import { useMaintenanceChecklist } from '../lib/use-maintenance-checklist';
import { checklistOptions, buildMaintenanceWorkSnapshot, buildCustomMaintenanceWorkSnapshot, type MaintenanceIdentity, type MaintenanceWorkSnapshot } from '../lib/maintenance-catalogue';

export type DesktopServiceCompletion = {
  completedAt: string;
  completedUsage: number | null;
  completedNotes: string;
  completedBy: string;
  linkToScheduledMaintenance?: boolean;
  continueSchedule?: boolean;
  clientEventId: string;
  maintenanceWork?: MaintenanceWorkSnapshot[];
};

export type DesktopServiceRecord = {
  assetId?: string;
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
  dueDate?: string | null;
  dueUsage?: number | null;
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
  const baseChecklist = useMaintenanceChecklist(record, selectedItems.length > 0);
  const savedChecklist = useAssetChecklistItems(dealerAppMode ? undefined : record.assetId);
  const checklist = { ...baseChecklist, customItems: savedChecklist.items };
  const repairChecklist = { ...checklist, items: [] };
  const repairOptions = mode === 'serviced' ? checklistOptions(repairChecklist, 'repaired') : [];
  const options = [...(checklist.items.length ? checklistOptions(checklist, mode) : (mode === 'checked' ? checkedOptionsForProfile(profile) : servicedOptionsForProfile(profile)).map((option, index) => ({ ...option, id: `fallback_${index}` }))), ...repairOptions];
  const today = todayInputValue();
  const [completedAt, setCompletedAt] = useState(today);
  const [completedUsage, setCompletedUsage] = useState(standalone || record.currentUsage === null ? '' : String(record.currentUsage));
  const [company, setCompany] = useState('');
  const [mechanic, setMechanic] = useState(record.maintenanceType === 'checkup' ? record.assignedName?.trim() || '' : '');
  const [notes, setNotes] = useState('');
  const [ownItem, setOwnItem] = useState('');
  const [customItems, setCustomItems] = useState<string[]>([]);
  const [inHouse, setInHouse] = useState(false);
  const [error, setError] = useState('');
  const [clientEventId] = useState(() => globalThis.crypto.randomUUID());
  const [scheduleDecision, setScheduleDecision] = useState<
    'scheduled' | 'separate' | null
  >(askScheduleLink ? null : 'scheduled');
  const [continueSchedule, setContinueSchedule] = useState<boolean | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; if (trigger?.isConnected) trigger.focus(); };
  }, []);
  useEffect(() => { dialogRef.current?.focus(); }, [scheduleDecision]);
  function dialogKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]') ?? []).filter(element => element.getClientRects().length > 0);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  const previousChoice = useRef<'scheduled' | 'separate' | null>(null);
  function chooseSchedule(value: 'scheduled' | 'separate') {
    if (value !== previousChoice.current) {
      setCompletedUsage('');
      if (value === 'separate' && completedAt === today) setCompletedAt('');
    }
    previousChoice.current = value;
    setScheduleDecision(value);
    setError('');
  }
  const actionName = record.maintenanceType === 'checkup' ? 'check-up' : 'service';
  const unit = usageUnit(record.usageMetric ?? record.assetUsageMetric ?? null);
  const isSeparateCompletion = scheduleDecision === 'separate';
  const requiresUsageReading = !standalone && !isSeparateCompletion && record.triggerType === 'usage';
  const asksRecurrence = !dealerAppMode && !standalone && !isSeparateCompletion && !!record.recurringEnabled;
  const dueLabel = record.triggerType === 'usage' && record.dueUsage != null ? `Due at ${record.dueUsage.toLocaleString('en-ZA')} ${unit}` : record.dueDate ? `Due ${new Date(record.dueDate.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No due target set';
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
    if (busy) return;
    setError('');
    if (asksRecurrence && continueSchedule === null) { setError('Choose whether to continue or end this schedule.'); return; }

    if (!completedAt) {
      setError(`Select the date the ${actionName} was completed.`);
      return;
    }
    if (completedAt > today) {
      setError('The completion date cannot be in the future.');
      return;
    }
    if (!selectedItems.length && !customItems.length && !ownItem.trim() && !notes.trim()) {
      setError(mode === 'checked'
        ? 'Select at least one checked item or add notes/problems.'
        : 'Select at least one completed service item or add notes/problems.');
      return;
    }
    if (mode === 'serviced' && !inHouse && !company.trim()) {
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
      const ownWork = buildCustomMaintenanceWorkSnapshot(checklist, mode, [...customItems, ownItem]);
      const workLabels = [...selectedItems, ...ownWork.items.map((item) => item.label)];
      await onSubmit({
        completedAt,
        completedUsage: usage,
        completedNotes: buildMaintenanceCompletionNote({
          serviceMode: mode,
          checkedItems: mode === 'checked' ? workLabels : [],
          servicedItems: mode === 'serviced' ? workLabels : [],
          repairDetails: '',
          serviceCompany: inHouse ? 'Owner / in-house' : company,
          mechanicName: mechanic,
          note: notes,
        }),
        maintenanceWork: [buildMaintenanceWorkSnapshot(checklist, mode, selectedItems), ...(mode === 'serviced' && repairOptions.some(item => selectedItems.includes(item.label)) ? [buildMaintenanceWorkSnapshot(repairChecklist, 'repaired', selectedItems)] : []), ...(ownWork.items.length ? [ownWork] : [])],
        completedBy: mechanic.trim(),
        linkToScheduledMaintenance: !standalone && scheduleDecision !== 'separate',
        ...(asksRecurrence ? { continueSchedule: continueSchedule === true } : {}),
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
        <section className={`${styles.modal} ${styles.saveChoiceModal} ${!dealerAppMode ? dialogStyles.dialog : ''}`} ref={dialogRef} tabIndex={-1} onKeyDown={dialogKeys} role="dialog" aria-modal="true" aria-labelledby="scheduled-service-choice-title">
          <header className={styles.header}>
            <div>
              <h2 id="scheduled-service-choice-title">Was this work for the scheduled {actionName}?</h2>
              <p>{record.assetTitle}</p>
            </div>
            <button className={`${styles.closeButton} ${!dealerAppMode ? styles.squareClose : ''}`} type="button" onClick={onClose} aria-label="Close service choice" disabled={busy}>
              <CloseIcon />
            </button>
          </header>
          <div className={`${styles.body} ${!dealerAppMode ? dialogStyles.body : ''}`}>
            <div className={styles.scheduleSummary}>
              <span>Scheduled {actionName}</span>
              <strong>{record.title}</strong>
              <small>{dueLabel} · {intervalLabel(record) || 'One-time schedule'}</small>
            </div>
            <div className={styles.saveChoices}>
              <button type="button" onClick={() => chooseSchedule('scheduled')} disabled={busy}>
                <strong>Yes, complete this schedule</strong>
                <span>Save the work against this scheduled {actionName} and mark it done.{record.recurringEnabled && !dealerAppMode ? ' Next, choose whether to keep it recurring.' : ''}</span>
              </button>
              <button type="button" onClick={() => chooseSchedule('separate')} disabled={busy}>
                <strong>No, record previous or other work</strong>
                <span>Add completed work to the asset’s history. This schedule and its reminders stay open.</span>
              </button>
            </div>
          </div>

        </section>
      </div>
    );
  }

  return (
    <div className={styles.overlay} data-website-overlay role="presentation">
      <button className={`${styles.backdrop} ${!dealerAppMode ? dialogStyles.backdrop : ''}`} type="button" onClick={onClose} aria-label="Close service form" disabled={busy} />
      <section className={`${styles.modal} ${!dealerAppMode ? styles.completionModal : ''}`} ref={dialogRef} tabIndex={-1} onKeyDown={dialogKeys} role="dialog" aria-modal="true" aria-labelledby="desktop-service-title">
        <header className={styles.header}>
          <div>
            <h2 id="desktop-service-title">{standalone || isSeparateCompletion ? `Record completed ${actionName}` : `Complete scheduled ${actionName}`}</h2>
            <p>{record.assetTitle}</p>
          </div>
          <button className={`${styles.closeButton} ${!dealerAppMode ? styles.squareClose : ''}`} type="button" onClick={onClose} aria-label="Close service form" disabled={busy}>
            <CloseIcon />
          </button>
        </header>

        <form onSubmit={(event) => void submit(event)}>
          <div className={styles.body}>
            {!standalone ? <div className={styles.infoBanner}>
              <strong>{isSeparateCompletion ? 'Save to history · schedule stays open' : `Completing “${record.title}”`}</strong>
              <span>{isSeparateCompletion ? 'Use the date and usage when this work was actually done. Existing reminders will not change.' : asksRecurrence ? continueSchedule === null ? 'Choose below what happens after this completion.' : continueSchedule ? 'This occurrence will close and the next reminder will be created.' : 'This occurrence will close. No further reminder will be created.' : record.recurringEnabled ? 'The next reminder will be created automatically.' : 'This one-time schedule will close when you save.'}</span>
            </div> : null}

            {asksRecurrence ? <fieldset className={styles.recurrenceChoice}>
              <legend>After this {actionName}, keep the schedule recurring?</legend>
              <div>
                <label><input type="radio" name="continue-schedule" checked={continueSchedule === true} onChange={() => setContinueSchedule(true)} required disabled={busy} /><span><strong>Continue the schedule</strong><small>Mark this work done and create the next reminder. {intervalLabel(record)}.</small></span></label>
                <label><input type="radio" name="continue-schedule" checked={continueSchedule === false} onChange={() => setContinueSchedule(false)} required disabled={busy} /><span><strong>End the schedule</strong><small>Mark this work done without creating another reminder.</small></span></label>
              </div>
            </fieldset> : null}

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <span>1</span>
                <div>
                  <h3>{mode === 'checked' ? copy.checkedHeader : copy.servicedHeader}</h3>
                  <p>{checklist.label} · {mode === 'checked' ? 'Inspect condition and safe operation.' : 'Select service work completed.'} Select only the work actually completed.</p>
                </div>
                <strong className={styles.selectedCount}>{selectedItems.length + customItems.length} selected</strong>
              </div>
              {savedChecklist.loading ? <p role="status">Loading your saved checklist items…</p> : null}
              {savedChecklist.error ? <p role="alert">Your saved checklist items could not be loaded. <button type="button" onClick={savedChecklist.reload}>Try again</button></p> : null}
              <p className={styles.fieldHint}>Saved custom checklist items appear below. Extra items entered here are saved with this completion only.</p>
              <div className={styles.customWork}>
                <label className={styles.field}>
                  <span>{mode === 'checked' ? 'Add a check completed' : 'Add other work completed'}</span>
                  <input type="text" maxLength={160} value={ownItem} onChange={(event) => setOwnItem(event.target.value)} placeholder={mode === 'checked' ? 'e.g. Checked trailer brake lights' : 'e.g. Replaced hydraulic hose'} onKeyDown={(event) => {
                    if (event.key === 'Enter') { event.preventDefault(); if (ownItem.trim() && customItems.length < 20) { setCustomItems((items) => Array.from(new Set([...items, ownItem.trim()]))); setOwnItem(''); } }
                  }} />
                </label>
                <button type="button" className={styles.cancelButton} disabled={!ownItem.trim() || customItems.length >= 20 || busy} onClick={() => { setCustomItems((items) => Array.from(new Set([...items, ownItem.trim()]))); setOwnItem(''); }}>+ Add item</button>
                {customItems.length ? <ul className={styles.customWorkList}>{customItems.map((item) => <li key={item}><span>{item}</span><button type="button" disabled={busy} onClick={() => setCustomItems((items) => items.filter((value) => value !== item))} aria-label={`Remove ${item}`}>×</button></li>)}</ul> : null}
              </div>
              <div className={styles.checklist}>
                {options.map((option) => {
                  const selected = selectedItems.includes(option.label);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={selected ? styles.checkOptionSelected : styles.checkOption}
                      onClick={() => toggleItem(option.label)}
                      aria-pressed={selected}
                      disabled={busy}
                    >
                      <span className={styles.checkbox}>{selected ? <CheckIcon /> : null}</span>
                      <span><strong>{option.label}</strong>{option.id.startsWith('asset_custom_') ? <small className={styles.customTag}>Your saved checklist item</small> : null}{option.description ? <small>{option.description}</small> : null}</span>
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
                {mode === 'serviced' ? <label className={styles.inHouseChoice}><input type="checkbox" checked={inHouse} onChange={(event) => setInHouse(event.target.checked)} />I did the work / in-house</label> : null}
                {mode === 'serviced' && !inHouse ? (
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
                  ? 'Save to history'
                  : askScheduleLink
                    ? asksRecurrence && continueSchedule === true ? 'Save & continue schedule' : 'Save & close schedule'
                    : `Save completed ${actionName}`}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
