'use client';

import { useEffect, useState, type FormEvent } from 'react';
import FieldManagerNavLink from '../../../field-manager-nav-link';
import styles from '../../../page.module.css';

type MaintenanceType = 'service' | 'checkup';
type TriggerType = 'date' | 'usage';

type FieldManagerAsset = {
  id: string;
  title: string;
  hours: number | null;
  lifeWorkedPercent: number | null;
  usageMode: 'hours' | 'km' | 'percent' | 'none';
};

type AssetResponse = {
  ok?: boolean;
  asset?: FieldManagerAsset;
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

function defaultDraft(asset: FieldManagerAsset): ScheduleDraft {
  const usageMetric = asset.usageMode === 'km' ? 'km' : asset.usageMode === 'percent' ? 'percentage' : 'hours';
  const currentUsage = asset.usageMode === 'percent' ? asset.lifeWorkedPercent : asset.hours;
  const dateOriented = asset.usageMode === 'none' || asset.usageMode === 'percent';
  const interval = usageMetric === 'km' ? 10000 : usageMetric === 'percentage' ? 10 : 250;
  const alert = usageMetric === 'km' ? 1000 : usageMetric === 'percentage' ? 5 : 20;

  return {
    ...EMPTY_DRAFT,
    triggerType: dateOriented ? 'date' : 'usage',
    dueDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    dueUsage: String(Math.max(0, Math.round((currentUsage ?? 0) + interval))),
    alertBeforeValue: String(dateOriented ? 7 : alert),
    recurringIntervalValue: String(dateOriented ? 1 : interval),
  };
}

function usageMetricFor(asset: FieldManagerAsset): 'hours' | 'km' | 'percentage' {
  if (asset.usageMode === 'km') return 'km';
  if (asset.usageMode === 'percent') return 'percentage';
  return 'hours';
}

function usageLabel(asset: FieldManagerAsset): string {
  if (asset.usageMode === 'km') return 'kilometres';
  if (asset.usageMode === 'percent') return 'percentage';
  return 'hours';
}

function maintenanceTypeLabel(maintenanceType: MaintenanceType): string {
  return maintenanceType === 'checkup' ? 'checkup' : 'service';
}

function usageNotificationLabel(asset: FieldManagerAsset, maintenanceType: MaintenanceType): string {
  const maintenanceLabel = maintenanceTypeLabel(maintenanceType);
  if (asset.usageMode === 'km') return `Notify kilometers before ${maintenanceLabel}`;
  if (asset.usageMode === 'percent') return `Notify percentage points before ${maintenanceLabel}`;
  return `Notify hours before ${maintenanceLabel}`;
}

export default function FieldManagerMaintenanceClient({ publicAssetCode, assetId, assetHref }: {
  publicAssetCode: string;
  assetId: string;
  assetHref: string;
}) {
  const [asset, setAsset] = useState<FieldManagerAsset | null>(null);
  const [draft, setDraft] = useState<ScheduleDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;

    async function loadAsset() {
      if (!publicAssetCode.trim() || !assetId) {
        setNotice('This asset could not be opened for maintenance scheduling.');
        setLoading(false);
        return;
      }

      try {
        const query = new URLSearchParams({ fieldManager: '1', assetId });
        const response = await fetch(
          `/api/scan/assets/${encodeURIComponent(publicAssetCode)}?${query.toString()}`,
          { credentials: 'include', cache: 'no-store' },
        );
        const payload = await response.json().catch(() => null) as AssetResponse | null;

        if (response.status === 401) {
          window.location.replace('/field-manager/login');
          return;
        }
        if (!response.ok || !payload?.ok || !payload.asset) {
          throw new Error(payload?.error || 'This asset is not available to this Field Manager login.');
        }
        if (!active) return;
        setAsset(payload.asset);
        setDraft(defaultDraft(payload.asset));
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : 'Failed to open maintenance scheduling.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAsset();
    return () => { active = false; };
  }, [assetId, publicAssetCode]);

  function update<K extends keyof ScheduleDraft>(key: K, value: ScheduleDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function changeTriggerType(triggerType: TriggerType) {
    if (!asset) return;
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
    if (!asset || saving) return;
    const usageMetric = usageMetricFor(asset);
    setSaving(true);
    setNotice('');

    try {
      const response = await fetch(`/api/field-manager/assets/${encodeURIComponent(asset.id)}/maintenance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;

      if (response.status === 401) {
        window.location.replace('/field-manager/login');
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to create the maintenance schedule.');
      }
      setCreated(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to create the maintenance schedule.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={`${styles.mobilePage} ${styles.maintenancePage}`}>
      <section className={`${styles.assetsShell} ${styles.maintenanceShell}`}>
        <header className={styles.assetsHeader} aria-label="Field Manager maintenance navigation">
          <FieldManagerNavLink href={assetHref} label="Back" />
        </header>

        {loading ? <p className={styles.mobileEmpty}>Opening maintenance scheduling…</p> : null}
        {notice ? <div className={styles.errorNotice}>{notice}</div> : null}

        {!loading && created && asset ? (
          <section className={styles.maintenanceSuccess}>
            <span>Maintenance</span>
            <h1>Schedule created</h1>
            <p>The schedule for {asset.title} has been saved and added to Overview.</p>
            <a href={assetHref}>Back to asset</a>
          </section>
        ) : null}

        {!loading && !created && asset ? (
          <>
            <section className={styles.maintenanceIntro}>
              <span>Maintenance</span>
              <h1>Schedule Maintenance</h1>
              <p>{asset.title}</p>
            </section>

            <section className={styles.maintenanceCard}>
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
                    {asset.usageMode === 'percent' ? (
                      <>
                        <option value="date">Date</option>
                        <option value="usage">Usage</option>
                      </>
                    ) : (
                      <>
                        {asset.usageMode !== 'none' ? <option value="usage">Usage</option> : null}
                        <option value="date">Date</option>
                      </>
                    )}
                  </select>
                </label>

                {draft.triggerType === 'usage' ? (
                  <>
                    <label className={styles.maintenanceField}>
                      <span>Due at {usageLabel(asset)}</span>
                      <input type="number" min="0" step="0.01" required value={draft.dueUsage} onChange={(event) => update('dueUsage', event.target.value)} />
                    </label>
                    <label className={styles.maintenanceField}>
                      <span>{usageNotificationLabel(asset, draft.maintenanceType)}</span>
                      <input type="number" min="0" step="0.01" required value={draft.alertBeforeValue} onChange={(event) => update('alertBeforeValue', event.target.value)} />
                    </label>
                  </>
                ) : (
                  <>
                    <label className={styles.maintenanceField}>
                      <span>Due date</span>
                      <input type="date" required value={draft.dueDate} onChange={(event) => update('dueDate', event.target.value)} />
                    </label>
                    <label className={styles.maintenanceField}>
                      <span>Notify days before {maintenanceTypeLabel(draft.maintenanceType)}</span>
                      <input type="number" min="0" step="1" required value={draft.alertBeforeValue} onChange={(event) => update('alertBeforeValue', event.target.value)} />
                    </label>
                  </>
                )}

                <label className={`${styles.maintenanceField} ${styles.maintenanceFieldFull}`}>
                  <span>Title</span>
                  <input required maxLength={180} value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="Next service" />
                </label>

                <label className={`${styles.maintenanceField} ${styles.maintenanceFieldFull}`}>
                  <span>Notes</span>
                  <textarea maxLength={5000} value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Service requirements or reminders" />
                </label>

                <label className={`${styles.maintenanceRecurringChoice} ${styles.maintenanceFieldFull}`}>
                  <input type="checkbox" checked={draft.recurringEnabled} onChange={(event) => update('recurringEnabled', event.target.checked)} />
                  <span><strong>Recurring maintenance</strong><small>Create the next schedule automatically when this one is completed.</small></span>
                </label>

                {draft.recurringEnabled ? (
                  <label className={`${styles.maintenanceField} ${styles.maintenanceFieldFull}`}>
                    <span>Recurring interval {draft.triggerType === 'date' ? 'in months' : `in ${usageLabel(asset)}`}</span>
                    <input type="number" min="1" step="0.01" required value={draft.recurringIntervalValue} onChange={(event) => update('recurringIntervalValue', event.target.value)} />
                  </label>
                ) : null}

                <button className={`${styles.maintenanceAddButton} ${styles.maintenanceFieldFull}`} type="submit" disabled={saving}>
                  {saving ? 'Creating schedule…' : 'Create schedule'}
                </button>
              </form>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
