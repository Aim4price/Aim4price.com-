'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  DealerMaintenanceScheduleProposal,
  DealerMaintenanceTrackedAsset,
} from '../lib/dealer-maintenance-tracker';
import assetStyles from '../app/asset-register/page.module.css';
import styles from './DealerMaintenanceScheduleModal.module.css';

type Props = {
  accessId: string;
  leadId?: string | null;
  onClose: () => void;
  onCreated?: (proposals: DealerMaintenanceScheduleProposal[]) => void;
  onError?: (message: string) => void;
};

type Draft = {
  maintenanceType: 'service' | 'checkup';
  triggerType: 'date' | 'usage';
  title: string;
  notes: string;
  dueDate: string;
  dueUsage: string;
  alertBeforeValue: string;
  recurringEnabled: boolean;
  recurringIntervalValue: string;
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
  error?: string;
};

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
    title: '',
    notes: '',
    dueDate: todayInputDate(),
    dueUsage: String(Math.round((currentUsage + defaultUsageInterval(metric)) * 100) / 100),
    alertBeforeValue: '7',
    recurringEnabled: false,
    recurringIntervalValue: '1',
  };
}

function metricLabel(metric: DealerMaintenanceTrackedAsset['usageMetric']): string {
  if (metric === 'km') return 'km';
  if (metric === 'percentage') return '%';
  return 'hours';
}

function formatDate(value: string | null): string {
  if (!value) return 'No date';
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function proposalDueLabel(proposal: DealerMaintenanceScheduleProposal): string {
  if (proposal.triggerType === 'date') return `Due ${formatDate(proposal.dueDate)}`;
  return `Due at ${Number(proposal.dueUsage ?? 0).toLocaleString('en-ZA')} ${metricLabel(proposal.usageMetric ?? 'hours')}`;
}

function statusLabel(proposal: DealerMaintenanceScheduleProposal): string {
  if (proposal.status === 'approved') return 'Approved';
  if (proposal.status === 'declined') return 'Disapproved';
  return 'Awaiting owner approval';
}

export default function DealerMaintenanceScheduleModal({
  accessId,
  leadId,
  onClose,
  onCreated,
  onError,
}: Props) {
  const [asset, setAsset] = useState<DealerMaintenanceTrackedAsset | null>(null);
  const [proposals, setProposals] = useState<DealerMaintenanceScheduleProposal[]>([]);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
          throw new Error(payload?.error || 'Failed to load the tracked asset.');
        }
        if (!payload.asset.permissions.canCreateMaintenanceSchedules) {
          throw new Error('The asset owner has not enabled dealer-created maintenance schedules.');
        }
        setAsset(payload.asset);
        setProposals(payload.asset.scheduleProposals ?? []);
        setDraft(emptyDraft(payload.asset));
      } catch (cause) {
        if (controller.signal.aborted) return;
        const message = cause instanceof Error ? cause.message : 'Failed to load the tracked asset.';
        setError(message);
        onError?.(message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [accessId]);

  const currentUsageLabel = useMemo(() => {
    if (!asset || asset.currentUsage === null) return `Not saved · ${metricLabel(asset?.usageMetric ?? 'hours')}`;
    return `${asset.currentUsage.toLocaleString('en-ZA')} ${metricLabel(asset.usageMetric)}`;
  }, [asset]);

  function updateDraft(update: Partial<Draft>) {
    setDraft((current) => {
      const next = { ...current, ...update };
      if (update.triggerType === 'date') {
        next.alertBeforeValue = '7';
        next.recurringIntervalValue = '1';
      }
      if (update.triggerType === 'usage' && asset) {
        next.alertBeforeValue = String(defaultUsageAlert(asset.usageMetric));
        next.recurringIntervalValue = String(defaultUsageInterval(asset.usageMetric));
      }
      return next;
    });
    setError('');
    setSuccess('');
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
    setSuccess('');
    try {
      const response = await fetch('/api/dealer/maintenance/schedule-proposals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessId,
          leadId: leadId || null,
          maintenanceType: draft.maintenanceType,
          triggerType: draft.triggerType,
          title: draft.title,
          notes: draft.notes,
          dueDate: draft.triggerType === 'date' ? draft.dueDate : null,
          dueUsage: draft.triggerType === 'usage' ? draft.dueUsage : null,
          usageMetric: draft.triggerType === 'usage' ? asset.usageMetric : null,
          alertBeforeValue: draft.alertBeforeValue,
          alertBeforeUnit: draft.triggerType === 'date' ? 'days' : asset.usageMetric,
          recurringEnabled: draft.recurringEnabled,
          recurringIntervalValue: draft.recurringEnabled ? draft.recurringIntervalValue : null,
          recurringIntervalUnit: draft.recurringEnabled
            ? draft.triggerType === 'date' ? 'months' : asset.usageMetric
            : null,
        }),
      });
      const payload = await response.json().catch(() => null) as SaveResponse | null;
      if (!response.ok || !payload?.ok || !payload.proposal || !Array.isArray(payload.proposals)) {
        throw new Error(payload?.error || 'Failed to send the maintenance schedule.');
      }
      setProposals(payload.proposals);
      setDraft(emptyDraft(asset));
      setSuccess('Maintenance schedule sent to the owner for approval.');
      onCreated?.(payload.proposals);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Failed to send the maintenance schedule.';
      setError(message);
      onError?.(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={assetStyles.modalOverlay}>
      <div className={assetStyles.modalBackdrop} onClick={saving ? undefined : onClose} />
      <section className={`${assetStyles.modalCard} ${styles.modal}`} role="dialog" aria-modal="true" aria-labelledby="dealer-schedule-title">
        <header className={`${assetStyles.modalHeader} ${styles.header}`}>
          <div className={assetStyles.modalHeaderText}>
            <h3 id="dealer-schedule-title">Create maintenance schedule</h3>
            <p>{asset ? `${asset.assetTitle} · ${asset.ownerName}` : 'Checking Maintenance Tracker access'}</p>
          </div>
          <button type="button" className={assetStyles.modalCloseButton} onClick={onClose} disabled={saving} aria-label="Close maintenance schedule">
            <CloseIcon className={assetStyles.buttonIcon} />
          </button>
        </header>

        <div className={`${assetStyles.modalScrollBody} ${styles.body}`}>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {success ? <p className={styles.success} role="status">{success}</p> : null}

          {loading ? (
            <div className={styles.empty}>Checking current tracking access…</div>
          ) : asset ? (
            <>
              <div className={styles.approvalNotice}>
                <strong>Owner approval required</strong>
                <p>The schedule becomes part of the owner&apos;s Asset Register only after approval. If disapproved, it remains visible only to your dealership.</p>
              </div>

              <div className={styles.choiceGrid}>
                <div>
                  <span className={styles.fieldLabel}>Maintenance type</span>
                  <div className={styles.choiceRow}>
                    {(['service', 'checkup'] as const).map((value) => (
                      <button
                        type="button"
                        key={value}
                        className={draft.maintenanceType === value ? styles.choiceActive : ''}
                        onClick={() => updateDraft({ maintenanceType: value })}
                      >
                        {value === 'service' ? 'Service' : 'Checkup'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className={styles.fieldLabel}>Schedule using</span>
                  <div className={styles.choiceRow}>
                    {(['date', 'usage'] as const).map((value) => (
                      <button
                        type="button"
                        key={value}
                        className={draft.triggerType === value ? styles.choiceActive : ''}
                        onClick={() => updateDraft({ triggerType: value })}
                      >
                        {value === 'date' ? 'Specific date' : 'Usage'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span>Schedule title <small>Optional</small></span>
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(event) => updateDraft({ title: event.target.value })}
                    placeholder={draft.maintenanceType === 'service' ? 'Scheduled service' : 'Scheduled checkup'}
                    maxLength={180}
                  />
                </label>

                {draft.triggerType === 'date' ? (
                  <label className={styles.field}>
                    <span>Due date</span>
                    <input type="date" value={draft.dueDate} onChange={(event) => updateDraft({ dueDate: event.target.value })} />
                  </label>
                ) : (
                  <>
                    <div className={styles.readOnlyField}>
                      <span>Current usage</span>
                      <strong>{currentUsageLabel}</strong>
                    </div>
                    <label className={styles.field}>
                      <span>Due usage ({metricLabel(asset.usageMetric)})</span>
                      <input type="number" min="0" step="0.01" value={draft.dueUsage} onChange={(event) => updateDraft({ dueUsage: event.target.value })} />
                    </label>
                  </>
                )}

                <label className={styles.field}>
                  <span>Alert before ({draft.triggerType === 'date' ? 'days' : metricLabel(asset.usageMetric)})</span>
                  <input type="number" min="0" step="0.01" value={draft.alertBeforeValue} onChange={(event) => updateDraft({ alertBeforeValue: event.target.value })} />
                </label>

                <label className={styles.toggleField}>
                  <input type="checkbox" checked={draft.recurringEnabled} onChange={(event) => updateDraft({ recurringEnabled: event.target.checked })} />
                  <span>
                    <strong>Recurring schedule</strong>
                    <small>Create the next schedule automatically after completion.</small>
                  </span>
                </label>

                {draft.recurringEnabled ? (
                  <label className={styles.field}>
                    <span>Repeat every ({draft.triggerType === 'date' ? 'months' : metricLabel(asset.usageMetric)})</span>
                    <input type="number" min="0.01" step="0.01" value={draft.recurringIntervalValue} onChange={(event) => updateDraft({ recurringIntervalValue: event.target.value })} />
                  </label>
                ) : null}

                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>Notes <small>Optional</small></span>
                  <textarea
                    value={draft.notes}
                    onChange={(event) => updateDraft({ notes: event.target.value })}
                    placeholder="Add service details, parts, supplier notes or a reason for the schedule."
                    maxLength={4000}
                  />
                </label>
              </div>

              <section className={styles.proposalHistory}>
                <header>
                  <div><span>Dealer schedule history</span><strong>Previous proposals</strong></div>
                  <b>{proposals.length}</b>
                </header>
                {proposals.length ? (
                  <div className={styles.proposalList}>
                    {proposals.map((proposal) => (
                      <article key={proposal.id} className={`${styles.proposalCard} ${styles[`proposal${proposal.status.charAt(0).toUpperCase()}${proposal.status.slice(1)}`]}`}>
                        <div>
                          <span>{proposal.maintenanceType === 'checkup' ? 'Checkup' : 'Service'}</span>
                          <strong>{proposal.title}</strong>
                          <small>{proposalDueLabel(proposal)} · Sent {formatDate(proposal.createdAtIso.slice(0, 10))}</small>
                        </div>
                        <b>{statusLabel(proposal)}</b>
                        {proposal.status === 'declined' ? <em>Dealer only</em> : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className={styles.empty}>No dealer-created schedules have been sent yet.</p>
                )}
              </section>
            </>
          ) : null}
        </div>

        <footer className={`${assetStyles.formActions} ${styles.footer}`}>
          <button type="button" className={assetStyles.secondaryButton} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className={assetStyles.primaryButton} onClick={() => void submit()} disabled={loading || !asset || saving}>
            {saving ? 'Sending…' : 'Send for owner approval'}
          </button>
        </footer>
      </section>
    </div>
  );
}
