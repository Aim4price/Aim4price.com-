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

const permissionOptions: Array<{
  key: keyof DealerMaintenancePermissions;
  title: string;
  description: string;
}> = [
  {
    key: 'canViewLoggedProblems',
    title: 'Logged Problems',
    description: 'Show owner and Field Manager problem notes recorded against this asset.',
  },
  {
    key: 'canViewMaintenanceReports',
    title: 'Maintenance Reports',
    description: 'Allow owner-style PDF and XLSX maintenance reports for authorised assets.',
  },
  {
    key: 'canUpdateSerial',
    title: 'Update Serial',
    description: 'Allow serial-number corrections that still require owner approval.',
  },
  {
    key: 'canUpdateReplacementPrice',
    title: 'Update Replacement Price',
    description: 'Allow replacement-price corrections that still require owner approval.',
  },
];

function copyPermissions(value: DealerMaintenancePermissions): DealerMaintenancePermissions {
  return { ...value };
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

  useEffect(() => {
    setDrafts(Object.fromEntries(entries.map((entry) => [entry.id, copyPermissions(entry.permissions)])));
  }, [entries]);

  const changedIds = useMemo(
    () => new Set(entries.flatMap((entry) => {
      const draft = drafts[entry.id];
      if (!draft) return [];
      return permissionOptions.some(({ key }) => draft[key] !== entry.permissions[key]) ? [entry.id] : [];
    })),
    [drafts, entries],
  );

  function updateDraft(entryId: string, key: keyof DealerMaintenancePermissions, checked: boolean) {
    setDrafts((current) => ({
      ...current,
      [entryId]: {
        ...(current[entryId] ?? entries.find((entry) => entry.id === entryId)?.permissions ?? {
          canViewLoggedProblems: false,
          canViewMaintenanceReports: false,
          canUpdateSerial: true,
          canUpdateReplacementPrice: true,
        }),
        [key]: checked,
      },
    }));
    setNotice(null);
  }

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

  return (
    <div className={styles.manager}>
      {notice ? (
        <p className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </p>
      ) : null}

      <div className={styles.list}>
        {entries.map((entry) => {
          const draft = drafts[entry.id] ?? entry.permissions;
          const isBusy = busyId === entry.id;
          return (
            <article key={entry.id} className={styles.card}>
              <header>
                <div>
                  <strong>{entry.dealerName}</strong>
                  <small>{entry.grantedByName ? `Shared by ${entry.grantedByName}` : 'Maintenance tracking active'}</small>
                </div>
                <span>Active</span>
              </header>

              <div className={styles.permissions}>
                {permissionOptions.map((option) => (
                  <label key={option.key} className={styles.permission}>
                    <input
                      type="checkbox"
                      checked={draft[option.key]}
                      onChange={(event) => updateDraft(entry.id, option.key, event.target.checked)}
                      disabled={!canEdit || isBusy}
                    />
                    <span>
                      <strong>{option.title}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </div>

              {canEdit ? (
                <footer>
                  <button
                    type="button"
                    className={styles.stopButton}
                    onClick={() => void revoke(entry)}
                    disabled={Boolean(busyId)}
                  >
                    {isBusy && !changedIds.has(entry.id) ? 'Stopping…' : 'Stop tracking'}
                  </button>
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={() => void save(entry)}
                    disabled={Boolean(busyId) || !changedIds.has(entry.id)}
                  >
                    {isBusy && changedIds.has(entry.id) ? 'Saving…' : 'Save permissions'}
                  </button>
                </footer>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
