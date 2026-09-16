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
  const [stage, setStage] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => { stageRef.current?.scrollTo(0, 0); stageRef.current?.focus(); }, [stage, scheduleDecision]);
  function chooseSchedule(value: 'scheduled' | 'separate') {
    if (value !== previousChoice.current) {
      setCompletedUsage('');
      if (value === 'separate' && completedAt === today) setCompletedAt('');
    }
    previousChoice.current = value;
    setStage(1);
    setScheduleDecision(value);
    setError('');
  }
  const actionName = record.maintenanceType === 'checkup' ? 'check-up' : 'service';
  const unit = usageUnit(record.usageMetric ?? record.assetUsageMetric ?? null);
  const isSeparateCompletion = scheduleDecision === 'separate';
  const requiresUsageReading = !standalone && !isSeparateCompletion && record.triggerType === 'usage';
  const asksRecurrence = !dealerAppMode && !standalone && !isSeparateCompletion && !!record.recurringEnabled;
  const stageCount = asksRecurrence ? 4 : 3;
  const dueLabel = record.triggerType === 'usage' && record.dueUsage != null ? `Due at ${record.dueUsage.toLocaleString('en-ZA')} ${unit}` : record.dueDate ? `Due ${new Date(record.dueDate.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No due target set';
  const savedUsageLabel = record.currentUsage === null
    ? null
    : `Saved reading: ${record.currentUsage.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} ${unit}`;

  function toggleItem(label: string) {
    setSelectedItems((current) => current.includes(label)
      ? current.filter((item) => item !== label)
      : [...current, label]);
  }

  function stageError(current: number): string {
    if (current === 1 && !selectedItems.length && !customItems.length && !ownItem.trim() && !notes.trim()) {
      return 'Select completed work or add a note.';
    }
    if (current === 2) {
      if (!completedAt || !Number.isFinite(new Date(completedAt).getTime())) return `Select the date the ${actionName} was completed.`;
      if (completedAt > today) return 'The completion date cannot be in the future.';
      const usage = completedUsage.trim() === '' ? null : Number(completedUsage);
      if (requiresUsageReading && usage === null) return `Enter the final ${unit} reading for this usage-based maintenance.`;
      if (usage !== null && (!Number.isFinite(usage) || usage < 0)) return 'Enter a valid non-negative usage reading.';
      if (!standalone && !isSeparateCompletion && usage !== null && record.currentUsage !== null && usage < record.currentUsage) {
        return `The completed reading cannot be lower than the saved ${record.currentUsage.toLocaleString('en-ZA')} ${unit}.`;
      }
    }
    if (current === 3) {
      if (mode === 'serviced' && !inHouse && !company.trim()) return `${copy.companyLabel} is required.`;
      if (!mechanic.trim()) return mode === 'checked' ? 'Enter who completed the check-up.' : `${copy.mechanicLabel} is required.`;
    }
    if (current === 4 && asksRecurrence && continueSchedule === null) return 'Choose whether to continue or end this schedule.';
    return '';
  }

  function nextStage() {
    if (busy) return;
    const message = stageError(stage);
    setError(message);
    if (!message) setStage(current => Math.min(current + 1, stageCount));
  }

  function previousStage() {
    setError('');
    if (stage > 1) setStage(current => current - 1);
    else if (askScheduleLink) setScheduleDecision(null);
    else onBack?.();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (stage < stageCount) { nextStage(); return; }
    setError('');
    for (let current = 1; current <= stageCount; current++) {
      const message = stageError(current);
      if (message) { setStage(current); setError(message); return; }
    }
    const usage = completedUsage.trim() === '' ? null : Number(completedUsage);

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
              <h2 id="scheduled-service-choice-title">Which work was done?</h2>
              <p>{record.assetTitle}</p>
            </div>
            <button className={`${styles.closeButton} ${!dealerAppMode ? dialogStyles.close : ''}`} type="button" onClick={onClose} aria-label="Close service choice" disabled={busy}>
              <CloseIcon />
            </button>
          </header>
          <div className={`${styles.body} ${!dealerAppMode ? dialogStyles.body : ''}`}>
            <div className={styles.scheduleSummary}>
              <strong>{record.title}</strong>
              <small>{dueLabel}{record.recurringEnabled && intervalLabel(record) ? ` · ${intervalLabel(record)}` : ''}</small>
            </div>
            <div className={styles.saveChoices}>
              <button type="button" onClick={() => chooseSchedule('scheduled')} disabled={busy}>
                <span className={styles.choiceIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-13 5 3 3 5-5" /></svg></span>
                <span className={styles.choiceCopy}><strong>Scheduled {actionName}</strong><small>Mark this {actionName} as done.</small></span>
                <span className={styles.choiceArrow} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></svg></span>
              </button>
              <button type="button" onClick={() => chooseSchedule('separate')} disabled={busy}>
                <span className={styles.choiceIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7m2-4v5l3 2" /></svg></span>
                <span className={styles.choiceCopy}><strong>Other work</strong><small>Save to history. Keep this {actionName} open.</small></span>
                <span className={styles.choiceArrow} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></svg></span>
              </button>
            </div>
          </div>
          <footer className={styles.footer}><button className={styles.cancelButton} type="button" onClick={onClose} disabled={busy}>Cancel</button></footer>
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

        <form noValidate onSubmit={(event) => void submit(event)}>
          <div className={styles.body} ref={stageRef} tabIndex={-1} aria-label={`Step ${stage} of ${stageCount}`}>
            {stage === 1 ? <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <span>1</span>
                <div>
                  <h3>{mode === 'checked' ? copy.checkedHeader : copy.servicedHeader}</h3>
                  <p>{checklist.label} · {mode === 'checked' ? 'Inspect condition and safe operation.' : 'Select service work completed.'} Select only the work actually completed.</p>
                </div>
              </div>
              {savedChecklist.loading ? <p role="status">Loading your saved checklist items…</p> : null}
              {savedChecklist.error ? <p role="alert">Your saved checklist items could not be loaded. <button type="button" onClick={savedChecklist.reload}>Try again</button></p> : null}
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
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Work details / notes <small>(optional if items are selected)</small></span>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={mode === 'checked' ? copy.checkedNotePlaceholder : copy.servicedNotePlaceholder} rows={3} />
                </label>
            </section> : null}

            {stage === 2 ? <section className={styles.section}>
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
                  {savedUsageLabel ? <small className={styles.fieldHint}>{savedUsageLabel}</small> : null}
                </label>
              </div>
            </section> : null}

            {stage === 3 ? <section className={styles.section}>
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

              </div>
            </section> : null}

            {stage === 4 && asksRecurrence ? <fieldset className={styles.recurrenceChoice}>
              <legend>After this {actionName}, keep the schedule recurring?</legend>
              <div>
                <label><input type="radio" name="continue-schedule" checked={continueSchedule === true} onChange={() => setContinueSchedule(true)} required disabled={busy} /><span><strong>Continue the schedule</strong><small>Mark this work done and create the next reminder. {intervalLabel(record)}.</small></span></label>
                <label><input type="radio" name="continue-schedule" checked={continueSchedule === false} onChange={() => setContinueSchedule(false)} required disabled={busy} /><span><strong>End the schedule</strong><small>Mark this work done without creating another reminder.</small></span></label>
              </div>
            </fieldset> : null}

            {error ? <div className={styles.error} role="alert">{error}</div> : null}
          </div>

          <footer className={styles.footer}>
            {stage > 1 || onBack || askScheduleLink ? <button className={styles.cancelButton} type="button" disabled={busy} onClick={previousStage}>Back</button> : null}
            <button className={styles.cancelButton} type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button className={styles.submitButton} type="submit" disabled={busy}>
              {stage < stageCount ? 'Next' : busy
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
