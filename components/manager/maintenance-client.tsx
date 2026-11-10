'use client';
import MaintenanceDetailsCard from '../MaintenanceDetailsCard';
import { useLedgerCardFocus } from '../../lib/use-ledger-card-focus';
import AppMaintenanceActions from '../AppMaintenanceActions';
import DateInput from '../DateInput';
import { useEffect, useState, type FormEvent } from 'react';
import { resolveAssetUsage } from '../../lib/asset-usage';
import OwnerAppNav from '../../app/owner-app/owner-app-nav';
import styles from './mobile.module.css';
type MaintenanceType = 'service' | 'checkup';
type TriggerType = 'date' | 'usage';
type ManagerAsset = {
    id: string;
    title: string;
    hours: number | null;
    lifeWorkedPercent: number | null;
    usageMode: 'hours' | 'km' | 'percent' | 'none';
};
type OwnerMaintenanceRecord = {
    id: string;
    title: string;
    maintenanceType: MaintenanceType;
    triggerType: TriggerType;
    status: 'upcoming' | 'done' | 'cancelled';
    computedStatusLabel: string;
    dueDate: string | null;
    dueUsage: number | null;
    usageMetric: 'hours' | 'km' | 'percentage' | null;
    recurringEnabled: boolean;
    generatedFromMaintenanceId: string | null;
    completedAtIso: string | null;
    assignedName: string;
    notes: string;
};
type AssetResponse = {
    ok?: boolean;
    asset?: ManagerAsset;
    item?: {
        id: string;
        title: string;
        kind: string;
        hours: number | null;
        lifeWorkedPercent: number | null;
        specsJson: Record<string, unknown>;
    };
    maintenance?: OwnerMaintenanceRecord[];
    records?: OwnerMaintenanceRecord[];
    error?: string;
};
type ScheduleDraft = {
    maintenanceType: MaintenanceType;
    triggerType: TriggerType;
    title: string;
    notes: string;
    dueDate: string;
    dueUsage: string;
    alertBeforeValue: string;
    recurringEnabled: boolean;
    recurringIntervalValue: string;
};
const EMPTY_DRAFT: ScheduleDraft = {
    maintenanceType: 'service',
    triggerType: 'date',
    title: 'Next service',
    notes: '',
    dueDate: '',
    dueUsage: '',
    alertBeforeValue: '7',
    recurringEnabled: false,
    recurringIntervalValue: '1',
};
function defaultDraft(asset: ManagerAsset): ScheduleDraft {
    const usageMetric = asset.usageMode === 'km' ? 'km' : asset.usageMode === 'percent' ? 'percentage' : 'hours';
    const currentUsage = asset.usageMode === 'percent' ? asset.lifeWorkedPercent : asset.hours;
    const dateOriented = asset.usageMode === 'none' || asset.usageMode === 'percent';
    const interval = usageMetric === 'km' ? 10000 : usageMetric === 'percentage' ? 10 : 250;
    const alert = usageMetric === 'km' ? 1000 : usageMetric === 'percentage' ? 5 : 20;
    return {
        ...EMPTY_DRAFT,
        triggerType: dateOriented ? 'date' : 'usage',
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        dueUsage: String(Math.max(0, Math.round((currentUsage ?? 0) + interval))),
        alertBeforeValue: String(dateOriented ? 7 : alert),
        recurringIntervalValue: String(dateOriented ? 1 : interval),
    };
}
function usageMetricFor(asset: ManagerAsset): 'hours' | 'km' | 'percentage' {
    if (asset.usageMode === 'km')
        return 'km';
    if (asset.usageMode === 'percent')
        return 'percentage';
    return 'hours';
}
function usageLabel(asset: ManagerAsset): string {
    if (asset.usageMode === 'km')
        return 'kilometres';
    if (asset.usageMode === 'percent')
        return 'percentage';
    return 'hours';
}
function maintenanceTypeLabel(maintenanceType: MaintenanceType): string {
    return maintenanceType === 'checkup' ? 'checkup' : 'service';
}
function ownerMaintenanceDueLabel(record: OwnerMaintenanceRecord): string {
    if (record.triggerType === 'date' && record.dueDate) {
        return `Due ${new Intl.DateTimeFormat('en-ZA', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
        }).format(new Date(`${record.dueDate.slice(0, 10)}T00:00:00Z`))}`;
    }
    if (record.triggerType === 'usage' && record.dueUsage !== null) {
        const unit = record.usageMetric === 'km' ? 'km' : record.usageMetric === 'percentage' ? '%' : 'hours';
        return `Due at ${new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 }).format(record.dueUsage)} ${unit}`;
    }
    return 'Due target unavailable';
}
function usageNotificationLabel(asset: ManagerAsset, maintenanceType: MaintenanceType): string {
    const maintenanceLabel = maintenanceTypeLabel(maintenanceType);
    if (asset.usageMode === 'km')
        return `Notify kilometers before ${maintenanceLabel}`;
    if (asset.usageMode === 'percent')
        return `Notify percentage points before ${maintenanceLabel}`;
    return `Notify hours before ${maintenanceLabel}`;
}
function ownerAssetForSchedule(item: NonNullable<AssetResponse['item']>): ManagerAsset {
    const usage = resolveAssetUsage(item);
    const savedUsageMode = String(item.specsJson.usageMode
        ?? item.specsJson.usage_mode
        ?? item.specsJson.selectedUsageMode
        ?? item.specsJson.selected_usage_mode
        ?? '').trim().toLowerCase();
    let usageMode: ManagerAsset['usageMode'] = 'none';
    if (item.kind !== 'property') {
        if (savedUsageMode.includes('percent') || usage.metric === 'percentage')
            usageMode = 'percent';
        else if (['km', 'kms', 'kilometres', 'kilometers'].includes(savedUsageMode))
            usageMode = 'km';
        else if (['hour', 'hours', 'hrs', 'engine_hours'].includes(savedUsageMode))
            usageMode = 'hours';
        else if (usage.value !== null || item.kind === 'tractor' || item.kind === 'vehicle') {
            usageMode = usage.metric === 'km' ? 'km' : 'hours';
        }
    }
    return {
        id: item.id,
        title: item.title,
        hours: item.hours,
        lifeWorkedPercent: item.lifeWorkedPercent,
        usageMode,
    };
}
export default function ManagerMaintenanceClient({ publicAssetCode = '', assetId, assetHref, mode = 'owner', highlightMaintenanceId = '', canRecord = false, canSchedule = false, }: {
    canRecord?: boolean;
    canSchedule?: boolean;
    publicAssetCode?: string;
    assetId: string;
    assetHref: string;
    mode?: 'owner';
    highlightMaintenanceId?: string;
}) {
    const [asset, setAsset] = useState<ManagerAsset | null>(null);
    const [draft, setDraft] = useState<ScheduleDraft>(EMPTY_DRAFT);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [created, setCreated] = useState(false);
    const [notice, setNotice] = useState('');
    const [maintenanceRecords, setMaintenanceRecords] = useState<OwnerMaintenanceRecord[]>([]);
    const [expandedRecordId, setExpandedRecordId] = useLedgerCardFocus('app-maintenance');
    const [focusedMaintenanceId, setFocusedMaintenanceId] = useState(highlightMaintenanceId);
    const [actionMaintenanceId, setActionMaintenanceId] = useState<string | null>(null);
    const upcomingMaintenance = maintenanceRecords.find((record) => record.status === 'upcoming') ?? null;
    const hasRecurringSchedule = Boolean(upcomingMaintenance?.recurringEnabled || upcomingMaintenance?.generatedFromMaintenanceId);
    useEffect(() => {
        let active = true;
        async function loadAsset() {
            if (!assetId || (false)) {
                setNotice('This asset could not be opened for maintenance scheduling.');
                setLoading(false);
                return;
            }
            try {
                const query = new URLSearchParams({ fieldManager: '1', assetId });
                const response = await fetch(`/api/owner-app/assets/${encodeURIComponent(assetId)}`, {
                    credentials: 'include',
                    cache: 'no-store',
                });
                const payload = await response.json().catch(() => null) as AssetResponse | null;
                if (response.status === 401) {
                    window.location.replace('/owner-app/login');
                    return;
                }
                const loadedAsset = payload?.item ? ownerAssetForSchedule(payload.item) : null;
                if (!response.ok || !payload?.ok || !loadedAsset) {
                    throw new Error(payload?.error || ('This asset is not available to this Owner login.'));
                }
                let loadedMaintenance = Array.isArray(payload?.maintenance) ? payload.maintenance : [];
                ;
                if (!active)
                    return;
                setAsset(loadedAsset);
                setDraft(defaultDraft(loadedAsset));
                setMaintenanceRecords(loadedMaintenance);
            }
            catch (error) {
                if (active)
                    setNotice(error instanceof Error ? error.message : 'Failed to open maintenance scheduling.');
            }
            finally {
                if (active)
                    setLoading(false);
            }
        }
        void loadAsset();
        return () => { active = false; };
    }, [assetId, mode, publicAssetCode]);
    useEffect(() => {
        if (!focusedMaintenanceId || !maintenanceRecords.some((record) => record.id === focusedMaintenanceId))
            return;
        const frameId = window.requestAnimationFrame(() => {
            document.getElementById(`maintenance-${focusedMaintenanceId}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [focusedMaintenanceId, maintenanceRecords]);
    async function refreshOwnerMaintenance(nextFromParentId = ''): Promise<void> {
        const response = await fetch(`/api/owner-app/assets/${encodeURIComponent(assetId)}`, {
            credentials: 'include',
            cache: 'no-store',
        });
        const payload = await response.json().catch(() => null) as AssetResponse | null;
        if (response.status === 401) {
            window.location.replace('/owner-app/login');
            return;
        }
        if (!response.ok || !payload?.ok || !Array.isArray(payload.maintenance)) {
            throw new Error(payload?.error || 'Failed to refresh maintenance schedules.');
        }
        setMaintenanceRecords(payload.maintenance);
        if (nextFromParentId) {
            const nextRecord = payload.maintenance.find((record) => record.generatedFromMaintenanceId === nextFromParentId && record.status === 'upcoming');
            setFocusedMaintenanceId(nextRecord?.id || nextFromParentId);
        }
    }
    async function updateOwnerMaintenance(record: OwnerMaintenanceRecord, action: 'maintenance-cancel' | 'maintenance-reopen'): Promise<void> {
        if (actionMaintenanceId)
            return;
        setActionMaintenanceId(record.id);
        setNotice('');
        try {
            const response = await fetch(`/api/owner-app/assets/${encodeURIComponent(assetId)}/actions`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, maintenanceId: record.id }),
            });
            const payload = await response.json().catch(() => null) as {
                ok?: boolean;
                error?: string;
            } | null;
            if (response.status === 401) {
                window.location.replace('/owner-app/login');
                return;
            }
            if (!response.ok || !payload?.ok) {
                throw new Error(payload?.error || 'Failed to update the maintenance schedule.');
            }
            await refreshOwnerMaintenance();
            setNotice(action === 'maintenance-reopen'
                ? 'Maintenance schedule reopened.'
                : 'Maintenance schedule cancelled.');
        }
        catch (error) {
            setNotice(error instanceof Error ? error.message : 'Failed to update the maintenance schedule.');
        }
        finally {
            setActionMaintenanceId(null);
        }
    }
    function openMaintenanceWork(record: OwnerMaintenanceRecord): void {
        {
            const query = new URLSearchParams({
                maintenanceId: record.id,
                maintenanceType: record.maintenanceType,
                returnTo: `${assetHref}/maintenance?maintenanceId=${encodeURIComponent(record.id)}`,
            });
            window.location.assign(`/owner-app/operations/maintenance/${encodeURIComponent(assetId)}?${query.toString()}`);
            return;
        }
    }

    function update<K extends keyof ScheduleDraft>(key: K, value: ScheduleDraft[K]) {
        setDraft((current) => ({ ...current, [key]: value }));
    }
    function changeTriggerType(triggerType: TriggerType) {
        if (!asset)
            return;
        setDraft((current) => ({
            ...current,
            triggerType,
            alertBeforeValue: triggerType === 'date'
                ? '7'
                : usageMetricFor(asset) === 'km'
                    ? '1000'
                    : usageMetricFor(asset) === 'percentage'
                        ? '5'
                        : '20',
            recurringIntervalValue: triggerType === 'date'
                ? '1'
                : usageMetricFor(asset) === 'km'
                    ? '10000'
                    : usageMetricFor(asset) === 'percentage'
                        ? '10'
                        : '250',
        }));
    }
    async function createSchedule(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!asset || saving)
            return;
        const usageMetric = usageMetricFor(asset);
        setSaving(true);
        setNotice('');
        try {
            const schedule = {
                maintenanceType: draft.maintenanceType,
                triggerType: draft.triggerType,
                title: draft.title,
                notes: draft.notes,
                dueDate: draft.triggerType === 'date' ? draft.dueDate : null,
                dueUsage: draft.triggerType === 'usage' ? draft.dueUsage : null,
                usageMetric: draft.triggerType === 'usage' ? usageMetric : null,
                alertBeforeValue: draft.alertBeforeValue,
                alertBeforeUnit: draft.triggerType === 'date' ? 'days' : usageMetric,
                recurringEnabled: draft.recurringEnabled,
                recurringIntervalValue: draft.recurringEnabled ? draft.recurringIntervalValue : null,
                recurringIntervalUnit: draft.recurringEnabled
                    ? draft.triggerType === 'date' ? 'months' : usageMetric
                    : null,
            };
            const response = await fetch(`/api/owner-app/assets/${encodeURIComponent(asset.id)}/actions`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'maintenance-create', ...schedule }),
            });
            const payload = await response.json().catch(() => null) as {
                ok?: boolean;
                error?: string;
            } | null;
            if (response.status === 401) {
                window.location.replace('/owner-app/login');
                return;
            }
            if (!response.ok || !payload?.ok) {
                throw new Error(payload?.error || 'Failed to create the maintenance schedule.');
            }
            await refreshOwnerMaintenance();
            setCreated(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        catch (error) {
            setNotice(error instanceof Error ? error.message : 'Failed to create the maintenance schedule.');
        }
        finally {
            setSaving(false);
        }
    }
    return (<main className={`${styles.mobilePage} ${styles.maintenancePage}`}>
      <section className={`${styles.assetsShell} ${styles.maintenanceShell}`}>
        {<OwnerAppNav backHref={assetHref}/>}

        {loading ? <p className={styles.mobileEmpty}>Opening maintenance scheduling…</p> : null}
        {notice ? (<div className={/marked done|schedule reopened|schedule cancelled/i.test(notice) ? styles.maintenanceActionNotice : styles.errorNotice} role="status">
            {notice}
          </div>) : null}

        {!loading && created && asset ? (<section className={styles.maintenanceSuccess}>
            <span>Maintenance</span>
            <h1>Schedule created</h1>
            <p>The schedule for {asset.title} has been saved and added to Overview.</p>
            <a href={assetHref}>Back to asset</a>
          </section>) : null}

        {!loading && !created && asset ? (<>
            <section className={styles.maintenanceIntro}>
              <span>Maintenance</span>
              <h1>{upcomingMaintenance ? 'Maintenance scheduled' : 'Schedule maintenance'}</h1>
              <p>{asset.title}</p>
            </section>

            <AppMaintenanceActions apiBase={`/api/${'owner-app'}/assets/${asset.id}`} assetTitle={asset.title} onRecord={() => window.location.assign(`${assetHref}${assetHref.includes('?') ? '&' : '?'}action=record`)}/>

            {upcomingMaintenance ? (<section className={`${styles.maintenanceCard} ${styles.maintenanceActiveCard}`} aria-label="Active maintenance schedule">
                <div className={styles.maintenanceActiveCopy}>
                  <span>{hasRecurringSchedule ? 'Recurring schedule' : 'Scheduled maintenance'}</span>
                  <p>
                    {hasRecurringSchedule
                    ? 'A recurring schedule is already in place.'
                    : 'Maintenance is already scheduled for this asset.'}
                  </p>
                </div>
                {upcomingMaintenance.title?.trim() ? (<h2 className={styles.maintenanceActiveTitle}>{upcomingMaintenance.title}</h2>) : null}
                <div className={styles.maintenanceNextDue}>
                  <span>Next due</span>
                  <strong>{ownerMaintenanceDueLabel(upcomingMaintenance)}</strong>
                </div>
              </section>) : null}

            {['upcoming', 'history'].map(group => {
                const records = maintenanceRecords.filter(record => group === 'upcoming' ? record.status === 'upcoming' : record.status !== 'upcoming');
                return records.length ? (<section key={group} className={styles.maintenanceScheduleSection} aria-labelledby={`maintenance-${group}-title`}>
                <div className={styles.maintenanceScheduleHeading}>
                  <div>
                    <span>Maintenance</span>
                    <h2 id={`maintenance-${group}-title`}>{group === 'upcoming' ? 'Current schedules' : 'Maintenance history'}</h2>
                  </div>
                  <strong>{records.length}</strong>
                </div>
                <div className={styles.maintenanceScheduleList}>
                  {records.map((record) => {
                        const isFocused = focusedMaintenanceId === record.id;
                        const isRecurringSchedule = Boolean(record.recurringEnabled || record.generatedFromMaintenanceId);
                        const isDone = record.status === 'done';
                        const isUpcomingRecurringSchedule = isRecurringSchedule && record.status === 'upcoming';
                        const isUpdating = actionMaintenanceId === record.id;
                        return (<MaintenanceDetailsCard expanded={expandedRecordId === record.id} onToggle={() => setExpandedRecordId(current => current === record.id ? null : record.id)} data-ledger-card={`app-maintenance:${record.id}`} id={`maintenance-${record.id}`} key={record.id} className={`${styles.maintenanceScheduleCard} ${isUpcomingRecurringSchedule ? styles.maintenanceScheduleCardRecurring : ''} ${isDone ? styles.maintenanceScheduleCardDone : ''} ${isFocused ? styles.maintenanceScheduleCardSelected : ''}`}>
                        <div className={styles.maintenanceScheduleLabels}>
                          <span className={isUpcomingRecurringSchedule ? styles.maintenanceScheduleRecurringLabel : ''}>
                            {isDone ? 'Completed work' : record.status === 'cancelled' ? 'Maintenance cancelled' : isRecurringSchedule ? 'Recurring schedule' : maintenanceTypeLabel(record.maintenanceType)}
                          </span>
                          <strong>{record.computedStatusLabel}</strong>
                        </div>
                        {record.title?.trim() ? <h3>{record.title}</h3> : null}
                        <p>{isDone ? record.completedAtIso ? `Completed ${new Date(record.completedAtIso).toLocaleDateString('en-ZA')}` : 'Completion date not saved' : ownerMaintenanceDueLabel(record)}</p>
                        <div id={`app-maintenance-details-${record.id}`} hidden={expandedRecordId !== record.id}>
                        <small>Type: {maintenanceTypeLabel(record.maintenanceType)}</small>
                        {record.completedAtIso ? <small>Completed: {new Date(record.completedAtIso).toLocaleDateString('en-ZA')}</small> : null}
                        {record.assignedName ? <small>Assigned to {record.assignedName}</small> : null}
                        {record.notes ? <small>{record.notes}</small> : null}
                        </div>
                        <div className={styles.maintenanceScheduleActions}>
                          <button type="button" aria-expanded={expandedRecordId === record.id} aria-controls={`app-maintenance-details-${record.id}`} onClick={() => setExpandedRecordId(current => current === record.id ? null : record.id)}>
                            {expandedRecordId === record.id ? 'Hide details' : 'View details'}
                          </button>
                          {record.status === 'upcoming' ? (<>
                              <button type="button" disabled={!canRecord || Boolean(actionMaintenanceId)} onClick={() => openMaintenanceWork(record)}>
                                Record work
                              </button>
                              {canSchedule && (<button type="button" disabled={Boolean(actionMaintenanceId)} onClick={() => void updateOwnerMaintenance(record, 'maintenance-cancel')}>
                                  Cancel
                                </button>)}
                            </>) : record.status === 'done' && canSchedule ? (<button type="button" disabled={Boolean(actionMaintenanceId)} onClick={() => void updateOwnerMaintenance(record, 'maintenance-reopen')}>
                              {isUpdating ? 'Updating…' : 'Reopen'}
                            </button>) : null}
                        </div>
                      </MaintenanceDetailsCard>);
                    })}
                </div>
              </section>) : null;
            })}

            {canSchedule && !upcomingMaintenance ? (<section className={styles.maintenanceCard}>
                <p className={styles.maintenanceDescription}>Schedule the next service or checkup for this asset.</p>
              <form className={styles.maintenanceFormGrid} onSubmit={(event) => void createSchedule(event)}>
                <label className={styles.maintenanceField}>
                  <span>Type</span>
                  <select value={draft.maintenanceType} onChange={(event) => update('maintenanceType', event.target.value as MaintenanceType)}>
                    <option value="service">Service</option>
                    <option value="checkup">Checkup</option>
                  </select>
                </label>

                <label className={styles.maintenanceField}>
                  <span>Based on</span>
                  <select value={draft.triggerType} onChange={(event) => changeTriggerType(event.target.value as TriggerType)}>
                    {asset.usageMode === 'percent' ? (<>
                        <option value="date">Date</option>
                        <option value="usage">Usage</option>
                      </>) : (<>
                        {asset.usageMode !== 'none' ? <option value="usage">Usage</option> : null}
                        <option value="date">Date</option>
                      </>)}
                  </select>
                </label>

                {draft.triggerType === 'usage' ? (<>
                    <label className={styles.maintenanceField}>
                      <span>Due at {usageLabel(asset)}</span>
                      <input type="number" min="0" step="0.01" required value={draft.dueUsage} onChange={(event) => update('dueUsage', event.target.value)}/>
                    </label>
                    <label className={styles.maintenanceField}>
                      <span>{usageNotificationLabel(asset, draft.maintenanceType)}</span>
                      <input type="number" min="0" step="0.01" required value={draft.alertBeforeValue} onChange={(event) => update('alertBeforeValue', event.target.value)}/>
                    </label>
                  </>) : (<>
                    <label className={styles.maintenanceField}>
                      <span>Due date</span>
                      <DateInput required value={draft.dueDate} onValueChange={(value) => update('dueDate', value)}/>
                    </label>
                    <label className={styles.maintenanceField}>
                      <span>Notify days before {maintenanceTypeLabel(draft.maintenanceType)}</span>
                      <input type="number" min="0" step="1" required value={draft.alertBeforeValue} onChange={(event) => update('alertBeforeValue', event.target.value)}/>
                    </label>
                  </>)}

                <label className={`${styles.maintenanceField} ${styles.maintenanceFieldFull}`}>
                  <span>Title</span>
                  <input required maxLength={180} value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="Next service"/>
                </label>

                <label className={`${styles.maintenanceField} ${styles.maintenanceFieldFull}`}>
                  <span>Notes</span>
                  <textarea maxLength={5000} value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Service requirements or reminders"/>
                </label>

                <label className={`${styles.maintenanceRecurringChoice} ${styles.maintenanceFieldFull}`}>
                  <input type="checkbox" checked={draft.recurringEnabled} onChange={(event) => update('recurringEnabled', event.target.checked)}/>
                  <span><strong>Recurring maintenance</strong><small>Create the next schedule automatically when this one is completed.</small></span>
                </label>

                {draft.recurringEnabled ? (<label className={`${styles.maintenanceField} ${styles.maintenanceFieldFull}`}>
                    <span>Recurring interval {draft.triggerType === 'date' ? 'in months' : `in ${usageLabel(asset)}`}</span>
                    <input type="number" min="1" step="0.01" required value={draft.recurringIntervalValue} onChange={(event) => update('recurringIntervalValue', event.target.value)}/>
                  </label>) : null}

                <button className={`${styles.maintenanceAddButton} ${styles.maintenanceFieldFull}`} type="submit" disabled={saving}>
                  {saving ? 'Creating schedule…' : 'Create schedule'}
                </button>
                </form>
              </section>) : null}
          </>) : null}
      </section>
    </main>);
}
