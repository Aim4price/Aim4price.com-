'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import OwnerAppNav from '../owner-app-nav';
import { ownerAppDate } from '../owner-app-types';
import styles from '../owner-app.module.css';

type UsageMetric = 'hours' | 'km' | 'percentage';
type MaintenanceType = 'service' | 'checkup';
type TriggerType = 'date' | 'usage';

type AssetOption = {
  id: string;
  title: string;
  categoryLabel: string;
  usageReading: number | null;
  usageMetric: UsageMetric;
  meta: string;
};

type FieldManagerOption = {
  id: string;
  displayName: string;
  isActive: boolean;
};

type MaintenanceRecord = {
  id: string;
  assetId: string;
  assetTitle: string;
  assetMeta: string;
  maintenanceType: MaintenanceType;
  triggerType: TriggerType;
  status: 'upcoming' | 'done' | 'cancelled';
  computedStatus: 'upcoming' | 'due_soon' | 'due' | 'overdue' | 'done' | 'cancelled';
  computedStatusLabel: string;
  title: string;
  notes: string;
  assignedName: string;
  dueDate: string | null;
  dueUsage: number | null;
  usageMetric: UsageMetric | null;
  currentUsage: number | null;
  recurringEnabled: boolean;
};

type MaintenanceSummary = {
  totalCount: number;
  openCount: number;
  doneCount: number;
  dueSoonCount: number;
  dueCount: number;
  overdueCount: number;
};

type MaintenancePayload = {
  ok?: boolean;
  error?: string;
  assets?: AssetOption[];
  fieldManagers?: FieldManagerOption[];
  records?: MaintenanceRecord[];
  summary?: MaintenanceSummary;
};

type MaintenanceDraft = {
  assetId: string;
  maintenanceType: MaintenanceType;
  triggerType: TriggerType;
  title: string;
  notes: string;
  assignedFieldManagerId: string;
  dueDate: string;
  dueUsage: string;
  usageMetric: UsageMetric;
  alertBeforeValue: string;
  recurringEnabled: boolean;
  recurringIntervalValue: string;
};

const EMPTY_SUMMARY: MaintenanceSummary = {
  totalCount: 0,
  openCount: 0,
  doneCount: 0,
  dueSoonCount: 0,
  dueCount: 0,
  overdueCount: 0,
};

function dateInputAfterDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function defaultUsageInterval(metric: UsageMetric): number {
  if (metric === 'km') return 10_000;
  if (metric === 'percentage') return 10;
  return 250;
}

function defaultUsageAlert(metric: UsageMetric): number {
  if (metric === 'km') return 1_000;
  if (metric === 'percentage') return 5;
  return 20;
}

function emptyDraft(asset?: AssetOption): MaintenanceDraft {
  const metric = asset?.usageMetric || 'hours';
  const currentUsage = typeof asset?.usageReading === 'number' ? asset.usageReading : 0;
  const usageInterval = defaultUsageInterval(metric);

  return {
    assetId: asset?.id || '',
    maintenanceType: 'service',
    triggerType: 'date',
    title: '',
    notes: '',
    assignedFieldManagerId: '',
    dueDate: dateInputAfterDays(30),
    dueUsage: String(Math.round((currentUsage + usageInterval) * 100) / 100),
    usageMetric: metric,
    alertBeforeValue: '7',
    recurringEnabled: false,
    recurringIntervalValue: '12',
  };
}

function usageLabel(value: number | null, metric: UsageMetric | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not recorded';
  const text = value.toLocaleString('en-ZA', { maximumFractionDigits: 1 });
  if (metric === 'percentage') return `${text}%`;
  return `${text} ${metric || 'hours'}`;
}

function dueLabel(record: MaintenanceRecord): string {
  return record.triggerType === 'date'
    ? ownerAppDate(record.dueDate)
    : usageLabel(record.dueUsage, record.usageMetric);
}

function statusClass(record: MaintenanceRecord): string {
  if (record.computedStatus === 'overdue' || record.computedStatus === 'due') return `${styles.statusText} ${styles.statusOverdue}`;
  if (record.computedStatus === 'upcoming') return `${styles.statusText} ${styles.statusOkay}`;
  return styles.statusText;
}

export default function OwnerAppMaintenanceClient() {
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [fieldManagers, setFieldManagers] = useState<FieldManagerOption[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [summary, setSummary] = useState<MaintenanceSummary>(EMPTY_SUMMARY);
  const [draft, setDraft] = useState<MaintenanceDraft>(emptyDraft());
  const [scheduling, setScheduling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyRecordId, setBusyRecordId] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  function applyPayload(payload: MaintenancePayload) {
    if (payload.assets) setAssets(payload.assets);
    if (payload.fieldManagers) setFieldManagers(payload.fieldManagers.filter((manager) => manager.isActive));
    if (payload.records) setRecords(payload.records);
    if (payload.summary) setSummary(payload.summary);
  }

  useEffect(() => {
    let active = true;

    fetch('/api/maintenance', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as MaintenancePayload | null;
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Maintenance could not be loaded.');
        if (!active) return;

        applyPayload(payload);
        const requestedAssetId = new URLSearchParams(window.location.search).get('assetId') || '';
        const selectedAsset = payload.assets?.find((asset) => asset.id === requestedAssetId) || payload.assets?.[0];
        setDraft(emptyDraft(selectedAsset));
        if (requestedAssetId && selectedAsset) setScheduling(true);
      })
      .catch((cause) => { if (active) setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Maintenance could not be loaded.' }); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []);

  const openRecords = useMemo(() => records
    .filter((record) => record.status === 'upcoming')
    .sort((left, right) => {
      const priority = { overdue: 0, due: 1, due_soon: 2, upcoming: 3, done: 4, cancelled: 5 } as const;
      return priority[left.computedStatus] - priority[right.computedStatus];
    }), [records]);

  function startScheduling() {
    setNotice(null);
    setDraft(emptyDraft(assets[0]));
    setScheduling(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function chooseAsset(assetId: string) {
    const asset = assets.find((entry) => entry.id === assetId);
    if (!asset) {
      setDraft((current) => ({ ...current, assetId }));
      return;
    }

    const next = emptyDraft(asset);
    setDraft((current) => ({
      ...next,
      maintenanceType: current.maintenanceType,
      triggerType: current.triggerType,
      title: current.title,
      notes: current.notes,
      assignedFieldManagerId: current.assignedFieldManagerId,
      recurringEnabled: current.recurringEnabled,
    }));
  }

  function chooseTrigger(triggerType: TriggerType) {
    setDraft((current) => ({
      ...current,
      triggerType,
      alertBeforeValue: triggerType === 'date' ? '7' : String(defaultUsageAlert(current.usageMetric)),
      recurringIntervalValue: triggerType === 'date' ? '12' : String(defaultUsageInterval(current.usageMetric)),
    }));
  }

  async function saveMaintenance() {
    if (!draft.assetId) {
      setNotice({ tone: 'error', text: 'Choose an asset before saving maintenance.' });
      return;
    }

    if (draft.triggerType === 'date' && !draft.dueDate) {
      setNotice({ tone: 'error', text: 'Choose a due date.' });
      return;
    }

    if (draft.triggerType === 'usage' && !draft.dueUsage.trim()) {
      setNotice({ tone: 'error', text: 'Enter the target usage.' });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const isUsage = draft.triggerType === 'usage';
      const response = await fetch('/api/maintenance', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: draft.assetId,
          maintenanceType: draft.maintenanceType,
          triggerType: draft.triggerType,
          title: draft.title,
          notes: draft.notes,
          assignedFieldManagerId: draft.assignedFieldManagerId || null,
          dueDate: isUsage ? null : draft.dueDate,
          dueUsage: isUsage ? draft.dueUsage : null,
          usageMetric: isUsage ? draft.usageMetric : null,
          alertBeforeValue: draft.alertBeforeValue,
          alertBeforeUnit: isUsage ? draft.usageMetric : 'days',
          recurringEnabled: draft.recurringEnabled,
          recurringIntervalValue: draft.recurringEnabled ? draft.recurringIntervalValue : null,
          recurringIntervalUnit: draft.recurringEnabled ? (isUsage ? draft.usageMetric : 'months') : null,
        }),
      });
      const payload = await response.json().catch(() => null) as MaintenancePayload | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Maintenance could not be scheduled.');

      applyPayload(payload);
      setScheduling(false);
      setNotice({ tone: 'success', text: 'Maintenance scheduled.' });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Maintenance could not be scheduled.' });
    } finally {
      setSaving(false);
    }
  }

  async function markDone(record: MaintenanceRecord) {
    if (busyRecordId) return;
    setBusyRecordId(record.id);
    setNotice(null);

    try {
      const response = await fetch(`/api/maintenance/${encodeURIComponent(record.id)}/complete`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'done',
          completedUsage: record.currentUsage ?? record.dueUsage,
        }),
      });
      const payload = await response.json().catch(() => null) as MaintenancePayload | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Maintenance could not be marked done.');

      applyPayload(payload);
      setNotice({ tone: 'success', text: record.recurringEnabled ? 'Maintenance completed and the next recurring item was created.' : 'Maintenance completed.' });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Maintenance could not be marked done.' });
    } finally {
      setBusyRecordId('');
    }
  }

  return (
    <main className={styles.appPage}>
      <OwnerAppNav title="Maintenance" backHref="/app" />
      <div className={styles.shell}>
        <header className={styles.pageHeader}>
          <p className={styles.pageEyebrow}>Maintenance</p>
          <h1>Know what comes next.</h1>
          <p>Schedule work by date or usage and keep it connected to the correct asset.</p>
        </header>

        {notice ? <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</div> : null}

        {loading ? <div className={styles.loadingState}><span className={styles.spinner} aria-label="Loading maintenance" /></div> : null}

        {!loading ? (
          <>
            {scheduling ? (
              <section className={styles.schedulePanel} aria-labelledby="schedule-maintenance-title">
                <header className={styles.scheduleHeader}>
                  <p className={styles.pageEyebrow}>New maintenance</p>
                  <h2 id="schedule-maintenance-title">Schedule maintenance</h2>
                  <p className={styles.sectionIntro}>Choose the asset, when it is due and whether it should repeat.</p>
                </header>

                <div className={styles.scheduleForm}>
                  <label className={styles.field}>
                    <span>Asset</span>
                    <select value={draft.assetId} onChange={(event) => chooseAsset(event.target.value)}>
                      <option value="">Choose an asset</option>
                      {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title}</option>)}
                    </select>
                  </label>

                  <div className={styles.field}>
                    <span>Maintenance type</span>
                    <div className={styles.choiceGrid}>
                      <button type="button" className={`${styles.choiceButton} ${draft.maintenanceType === 'service' ? styles.choiceButtonActive : ''}`} onClick={() => setDraft((current) => ({ ...current, maintenanceType: 'service' }))}>Service</button>
                      <button type="button" className={`${styles.choiceButton} ${draft.maintenanceType === 'checkup' ? styles.choiceButtonActive : ''}`} onClick={() => setDraft((current) => ({ ...current, maintenanceType: 'checkup' }))}>Checkup</button>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <span>Schedule by</span>
                    <div className={styles.choiceGrid}>
                      <button type="button" className={`${styles.choiceButton} ${draft.triggerType === 'date' ? styles.choiceButtonActive : ''}`} onClick={() => chooseTrigger('date')}>Date</button>
                      <button type="button" className={`${styles.choiceButton} ${draft.triggerType === 'usage' ? styles.choiceButtonActive : ''}`} onClick={() => chooseTrigger('usage')}>Usage</button>
                    </div>
                  </div>

                  <label className={styles.field}>
                    <span>Title (optional)</span>
                    <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Example: Annual service" maxLength={180} />
                  </label>

                  {draft.triggerType === 'date' ? (
                    <label className={styles.field}>
                      <span>Due date</span>
                      <input type="date" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} />
                    </label>
                  ) : (
                    <label className={styles.field}>
                      <span>Due at ({draft.usageMetric === 'percentage' ? '%' : draft.usageMetric})</span>
                      <input type="number" min="0" step="0.1" inputMode="decimal" value={draft.dueUsage} onChange={(event) => setDraft((current) => ({ ...current, dueUsage: event.target.value }))} />
                    </label>
                  )}

                  <label className={styles.field}>
                    <span>Remind me {draft.triggerType === 'date' ? 'days' : draft.usageMetric === 'percentage' ? '%' : draft.usageMetric} before</span>
                    <input type="number" min="0" step="1" inputMode="numeric" value={draft.alertBeforeValue} onChange={(event) => setDraft((current) => ({ ...current, alertBeforeValue: event.target.value }))} />
                  </label>

                  {fieldManagers.length ? (
                    <label className={styles.field}>
                      <span>Assign to (optional)</span>
                      <select value={draft.assignedFieldManagerId} onChange={(event) => setDraft((current) => ({ ...current, assignedFieldManagerId: event.target.value }))}>
                        <option value="">Unassigned</option>
                        {fieldManagers.map((manager) => <option key={manager.id} value={manager.id}>{manager.displayName}</option>)}
                      </select>
                    </label>
                  ) : null}

                  <div className={styles.recurringBox}>
                    <label className={styles.checkboxRow}>
                      <input type="checkbox" checked={draft.recurringEnabled} onChange={(event) => setDraft((current) => ({ ...current, recurringEnabled: event.target.checked }))} />
                      <span>Create the next maintenance item automatically when this one is completed.</span>
                    </label>
                    {draft.recurringEnabled ? (
                      <label className={styles.field}>
                        <span>Repeat every ({draft.triggerType === 'date' ? 'months' : draft.usageMetric === 'percentage' ? '%' : draft.usageMetric})</span>
                        <input type="number" min="0.1" step="0.1" inputMode="decimal" value={draft.recurringIntervalValue} onChange={(event) => setDraft((current) => ({ ...current, recurringIntervalValue: event.target.value }))} />
                      </label>
                    ) : null}
                  </div>

                  <label className={styles.field}>
                    <span>Notes (optional)</span>
                    <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Work required, parts or instructions" />
                  </label>

                  <div className={styles.scheduleActions}>
                    <button type="button" className={styles.secondaryButton} onClick={() => setScheduling(false)} disabled={saving}>Cancel</button>
                    <button type="button" className={styles.primaryButton} onClick={() => void saveMaintenance()} disabled={saving}>{saving ? 'Saving…' : 'Schedule maintenance'}</button>
                  </div>
                </div>
              </section>
            ) : (
              <div className={styles.maintenanceToolbar}>
                <button type="button" className={styles.primaryButton} onClick={startScheduling} disabled={!assets.length}>Schedule maintenance</button>
                <Link className={styles.secondaryButton} href="/app/reports">Download reports</Link>
              </div>
            )}

            <section className={styles.maintenanceSummary} aria-label="Maintenance summary">
              <div className={styles.statBox}><span>Open</span><strong>{summary.openCount}</strong></div>
              <div className={styles.statBox}><span>Due soon</span><strong>{summary.dueSoonCount + summary.dueCount}</strong></div>
              <div className={styles.statBox}><span>Overdue</span><strong>{summary.overdueCount}</strong></div>
            </section>

            <section className={styles.section} aria-labelledby="upcoming-maintenance-title">
              <div className={styles.sectionHeader}><h2 id="upcoming-maintenance-title">Upcoming maintenance</h2></div>
              <div className={styles.maintenanceList}>
                {openRecords.length ? openRecords.map((record) => (
                  <article key={record.id} className={styles.maintenanceCard}>
                    <div className={styles.maintenanceCardTop}>
                      <div>
                        <h2>{record.title || (record.maintenanceType === 'service' ? 'Service' : 'Checkup')}</h2>
                        <p className={styles.maintenanceMeta}>{record.assetTitle}</p>
                      </div>
                      <span className={statusClass(record)}>{record.computedStatusLabel}</span>
                    </div>
                    <div className={styles.assetFacts}>
                      <div className={styles.assetFact}><span>Due</span><strong>{dueLabel(record)}</strong></div>
                      <div className={styles.assetFact}><span>Assigned to</span><strong>{record.assignedName || 'Unassigned'}</strong></div>
                    </div>
                    {record.notes ? <p className={styles.maintenanceMeta}>{record.notes}</p> : null}
                    <button type="button" className={styles.secondaryButton} onClick={() => void markDone(record)} disabled={Boolean(busyRecordId)}>
                      {busyRecordId === record.id ? 'Saving…' : 'Mark done'}
                    </button>
                  </article>
                )) : <div className={styles.emptyState}>No upcoming maintenance is scheduled.</div>}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
