'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  DealerMaintenanceAccessSummary,
  DealerMaintenancePermissions,
} from '../lib/dealer-maintenance-tracker';
import styles from './DealerMaintenanceAccessSettings.module.css';

type Props = {
  assetId: string;
  entries: DealerMaintenanceAccessSummary[];
  mutationUrl: string;
  onEntriesChange: (entries: DealerMaintenanceAccessSummary[]) => void;
  canEdit?: boolean;
  emptyText?: string;
};

type AccessResponse = {
  ok?: boolean;
  trackingAccess?: DealerMaintenanceAccessSummary;
  error?: string;
};

export const DEFAULT_DEALER_MAINTENANCE_PERMISSIONS: DealerMaintenancePermissions = {
  canViewLoggedProblems: false,
  canViewMaintenanceReports: true,
  canViewCostOfOwnership: false,
  canCreateMaintenanceSchedules: true,
  canUpdateSerial: true,
  canUpdateReplacementPrice: true,
};

export const dealerMaintenancePermissionOptions: Array<{
  key: keyof DealerMaintenancePermissions;
  title: string;
  description: string;
}> = [
  {
    key: 'canViewLoggedProblems',
    title: 'Logged Problems',
    description: 'Let the dealer view owner and Field Manager problem notes for this asset.',
  },
  {
    key: 'canViewMaintenanceReports',
    title: 'Maintenance Reports',
    description: 'Let the dealer download PDF and XLSX maintenance reports.',
  },
  {
    key: 'canViewCostOfOwnership',
    title: 'Cost of Ownership',
    description: 'Let the dealer download PDF and Excel ownership costs and VAT.',
  },
  {
    key: 'canCreateMaintenanceSchedules',
    title: 'Create Maintenance Schedules',
    description: 'Let the dealer propose schedules that require owner approval before becoming official.',
  },
  {
    key: 'canUpdateSerial',
    title: 'Update Serial',
    description: 'Let the dealer suggest serial-number corrections for your approval.',
  },
  {
    key: 'canUpdateReplacementPrice',
    title: 'Update Replacement Price',
    description: 'Let the dealer suggest replacement-price changes for your approval.',
  },
];

function copyPermissions(value: DealerMaintenancePermissions): DealerMaintenancePermissions {
  return { ...value };
}

type PermissionPickerProps = {
  value: DealerMaintenancePermissions;
  onChange: (permissions: DealerMaintenancePermissions) => void;
  disabled?: boolean;
};

export function DealerMaintenancePermissionPicker({
  value,
  onChange,
  disabled = false,
}: PermissionPickerProps) {
  return (
    <div className={styles.permissions}>
      {dealerMaintenancePermissionOptions.map((option) => (
        <label
          key={option.key}
          className={`${styles.permission} ${value[option.key] ? styles.permissionEnabled : ''}`}
        >
          <input
            type="checkbox"
            checked={value[option.key]}
            onChange={(event) => onChange({ ...value, [option.key]: event.target.checked })}
            disabled={disabled}
          />
          <span>
            <strong>{option.title}</strong>
            <small>{option.description}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

export default function DealerMaintenanceAccessSettings({
  assetId,
  entries,
  mutationUrl,
  onEntriesChange,
  canEdit = true,
  emptyText = 'No dealer is currently tracking this asset.',
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, DealerMaintenancePermissions>>({});
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState('');

  useEffect(() => {
    setDrafts(Object.fromEntries(entries.map((entry) => [entry.id, copyPermissions(entry.permissions)])));
    setSelectedEntryId((current) => entries.some((entry) => entry.id === current) ? current : '');
  }, [entries]);

  const changedIds = useMemo(
    () => new Set(entries.flatMap((entry) => {
      const draft = drafts[entry.id];
      if (!draft) return [];
      return dealerMaintenancePermissionOptions.some(({ key }) => draft[key] !== entry.permissions[key]) ? [entry.id] : [];
    })),
    [drafts, entries],
  );

  async function save(entry: DealerMaintenanceAccessSummary) {
    const permissions = drafts[entry.id];
    if (!permissions || busyId) return;
    setBusyId(entry.id);
    setNotice(null);
    try {
      const response = await fetch(mutationUrl, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, accessId: entry.id, permissions }),
      });
      const payload = await response.json().catch(() => null) as AccessResponse | null;
      if (!response.ok || !payload?.ok || !payload.trackingAccess) {
        throw new Error(payload?.error || 'Failed to save dealer tracking permissions.');
      }
      onEntriesChange(entries.map((item) => item.id === entry.id ? payload.trackingAccess as DealerMaintenanceAccessSummary : item));
      setNotice({ tone: 'success', text: `${entry.dealerName} permissions saved.` });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Failed to save dealer tracking permissions.' });
    } finally {
      setBusyId('');
    }
  }

  async function revoke(entry: DealerMaintenanceAccessSummary) {
    if (busyId) return;
    setBusyId(entry.id);
    setNotice(null);
    try {
      const response = await fetch(mutationUrl, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, accessId: entry.id, dealerUserId: entry.dealerUserId, partnerUserId: entry.dealerUserId }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to stop dealer tracking.');
      }
      onEntriesChange(entries.filter((item) => item.id !== entry.id));
      setSelectedEntryId('');
      setNotice({ tone: 'success', text: `${entry.dealerName} can no longer track this asset.` });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Failed to stop dealer tracking.' });
    } finally {
      setBusyId('');
    }
  }

  if (!entries.length) {
    return <p className={styles.empty}>{emptyText}</p>;
  }

  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null;

  return (
    <div className={styles.manager}>
      {notice ? (
        <p className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </p>
      ) : null}

      {selectedEntry ? (
        <div className={styles.detailStep}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => setSelectedEntryId('')}
            disabled={Boolean(busyId)}
          >
            <span aria-hidden="true">‹</span>
            All dealers
          </button>

          <article className={styles.card}>
            <header>
              <div>
                <strong>{selectedEntry.dealerName}</strong>
                <small>{selectedEntry.grantedByName ? `Shared by ${selectedEntry.grantedByName}` : 'Maintenance tracking active'}</small>
              </div>
              <span className={styles.activeStatus}><i aria-hidden="true" />Active</span>
            </header>

            <DealerMaintenancePermissionPicker
              value={drafts[selectedEntry.id] ?? selectedEntry.permissions}
              onChange={(permissions) => {
                setDrafts((current) => ({ ...current, [selectedEntry.id]: permissions }));
                setNotice(null);
              }}
              disabled={!canEdit || busyId === selectedEntry.id}
            />

            {canEdit ? (
              <footer>
                <span className={`${styles.changeStatus} ${changedIds.has(selectedEntry.id) ? styles.changeStatusPending : ''}`}>
                  {changedIds.has(selectedEntry.id) ? 'Unsaved changes' : 'Permissions up to date'}
                </span>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.stopButton}
                    onClick={() => void revoke(selectedEntry)}
                    disabled={Boolean(busyId)}
                  >
                    {busyId === selectedEntry.id && !changedIds.has(selectedEntry.id) ? 'Stopping…' : 'Stop tracking'}
                  </button>
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={() => void save(selectedEntry)}
                    disabled={Boolean(busyId) || !changedIds.has(selectedEntry.id)}
                  >
                    {busyId === selectedEntry.id && changedIds.has(selectedEntry.id) ? 'Saving…' : 'Save permissions'}
                  </button>
                </div>
              </footer>
            ) : null}
          </article>
        </div>
      ) : (
        <div className={styles.list} aria-label="Dealers with tracking access">
          {entries.map((entry) => {
            const enabledCount = dealerMaintenancePermissionOptions.filter((option) => (
              (drafts[entry.id] ?? entry.permissions)[option.key]
            )).length;
            return (
              <button
                key={entry.id}
                type="button"
                className={styles.dealerChoice}
                onClick={() => {
                  setSelectedEntryId(entry.id);
                  setNotice(null);
                }}
              >
                <span className={styles.dealerChoiceInitial} aria-hidden="true">
                  {entry.dealerName.trim().charAt(0).toUpperCase() || 'D'}
                </span>
                <span className={styles.dealerChoiceCopy}>
                  <strong>{entry.dealerName}</strong>
                  <small>{enabledCount} of {dealerMaintenancePermissionOptions.length} permissions enabled</small>
                </span>
                <span className={styles.activeStatus}><i aria-hidden="true" />Active</span>
                <span className={styles.dealerChoiceChevron} aria-hidden="true">›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
