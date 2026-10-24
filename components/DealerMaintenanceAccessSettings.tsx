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
  canViewHistory: false,
  canViewParts: false,
  canAddParts: false,
  canViewLoggedProblems: false,
  canViewMaintenanceReports: false,
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
  {key:'canUpdateDetails', title:'Update details', description:'Edit details and documents.'},
  {key:'canUpdateSerial', title:'Update serial / VIN', description:'Edit the asset identifier.'},
  {key:'canAccessLocation', title:'Update location', description:'Change the asset location.'},
  {key:'canAddPhotos', title:'Add photos', description:'Upload asset photos.'},
  {key:'canAddCosts', title:'Add costs', description:'Record costs and documents.'},
  {key:'canViewLoggedProblems', title:'Log problems', description:'Record and resolve problems.'},
  {key:'canViewParts', title:'View parts', description:'View saved part numbers.'},
  {key:'canAddParts', title:'Manage parts', description:'Add, edit or delete parts.'},
  {key:'canAddMaintenance', title:'Add maintenance', description:'Record completed work.'},
  {key:'canCreateMaintenanceSchedules', title:'Schedule maintenance', description:'Plan upcoming work.'},
  {key:'canViewHistory', title:'View history', description:'Read permitted asset activity.'},
  {key:'canSuggestCurrentValue', title:'Update current value', description:'Update or suggest a value.'},
  {key:'canUpdateReplacementPrice', title:'Update replacement price', description:'Update or suggest a price.'},
  {key:'canViewMaintenanceReports', title:'View maintenance reports', description:'View and download reports.'},
  {key:'canViewCostOfOwnership', title:'View ownership costs', description:'View and download cost reports.'},

];

export const dealerMaintenancePermissionGroups: Array<{ title: string; keys: Array<keyof DealerMaintenancePermissions>; note?: string }> = [
  { title: 'Asset details', keys: ['canUpdateDetails', 'canUpdateSerial', 'canAccessLocation', 'canAddPhotos'] },
  { title: 'Costs and values', keys: ['canAddCosts', 'canSuggestCurrentValue', 'canUpdateReplacementPrice'], note: 'Manual values can be updated. Aim4price values require owner approval. Upload invoices through Add costs.' },
  { title: 'Maintenance and parts', keys: ['canAddMaintenance', 'canCreateMaintenanceSchedules', 'canViewLoggedProblems', 'canViewParts', 'canAddParts'] },
  { title: 'History and reports', keys: ['canViewHistory', 'canViewMaintenanceReports', 'canViewCostOfOwnership'] },
];

function copyPermissions(value: DealerMaintenancePermissions): DealerMaintenancePermissions {
  return { ...value };
}

type PermissionPickerProps = {
  marketPrice?: { enabled: boolean; onChange: (enabled: boolean) => void };
  lockedPermissions?: Array<keyof DealerMaintenancePermissions>;
  value: DealerMaintenancePermissions;
  onChange: (permissions: DealerMaintenancePermissions, marketPriceEnabled?: boolean) => void;
  disabled?: boolean;
};

export function DealerMaintenancePermissionPicker({
  value,
  onChange,
  disabled = false,
  lockedPermissions = [],
  marketPrice,
}: PermissionPickerProps) {
  const editableOptions = dealerMaintenancePermissionOptions.filter(({key}) => !lockedPermissions.includes(key));
  const selectedCount = editableOptions.filter(({key}) => value[key] === true).length;
  return (
    <>
      <div className={styles.permissionGroups} data-permission-groups>
        {dealerMaintenancePermissionGroups.map(group => (
          <fieldset key={group.title} className={styles.permissionGroup}>
            <legend>{group.title}</legend>
            <div className={styles.permissions} data-permission-grid>
              {group.keys.map(key => dealerMaintenancePermissionOptions.find(option => option.key === key)!).map(option => (
                <label key={option.key} className={`${styles.permission} ${value[option.key] ? styles.permissionEnabled : ''}`}>
                  <input type="checkbox" checked={value[option.key] === true}
                    onChange={event => onChange({ ...value, [option.key]: event.target.checked, ...(option.key === 'canUpdateDetails' ? Object.fromEntries(['canUpdateYear', 'canUpdateUsage', 'canUpdateCondition'].filter(key => !lockedPermissions.includes(key as keyof DealerMaintenancePermissions)).map(key => [key,event.target.checked])) : {}) })}
                    disabled={disabled || lockedPermissions.includes(option.key)} />
                  <span><strong>{option.title}</strong><small>{lockedPermissions.includes(option.key) ? 'Always included with this asset link.' : option.description}</small></span>
                </label>
              ))}
              {group.title === 'Costs and values' && marketPrice && <label className={`${styles.permission} ${marketPrice.enabled ? styles.permissionEnabled : ''}`}>
                <input type="checkbox" checked={marketPrice.enabled} disabled={disabled} onChange={event => marketPrice.onChange(event.target.checked)} />
                <span><strong>Update market price</strong><small>Review and save the market assessment.</small></span>
              </label>}
            </div>
            {group.note && <p className={styles.permissionNote} data-permission-note>{group.note}</p>}
          </fieldset>
        ))}
      </div>
      <div className={styles.permissionToolbar} data-permission-toolbar>
        <label className={styles.selectAll}>
          <input type="checkbox" disabled={disabled || !editableOptions.length}
            checked={editableOptions.length > 0 && selectedCount === editableOptions.length && (!marketPrice || marketPrice.enabled)}
            ref={input => { if (input) input.indeterminate = (selectedCount + (marketPrice?.enabled ? 1 : 0)) > 0 && (selectedCount + (marketPrice?.enabled ? 1 : 0)) < editableOptions.length + (marketPrice ? 1 : 0); }}
            onChange={event => onChange({ ...value,
              ...(!lockedPermissions.includes('canUpdateDetails') ? Object.fromEntries(['canUpdateYear', 'canUpdateUsage', 'canUpdateCondition'].filter(key => !lockedPermissions.includes(key as keyof DealerMaintenancePermissions)).map(key => [key, event.target.checked])) : {}),
              ...Object.fromEntries(editableOptions.map(({key}) => [key, event.target.checked])),
            }, marketPrice ? event.target.checked : undefined)} />
          <span>Select all permissions</span>
        </label>
      </div>
    </>
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
