'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  assetGroupRelationshipLabel,
  type AssetGroup,
  type AssetGroupRelationship,
  type AssetGroupSaveInput,
  type AssetGroupValueMode,
} from '../../lib/asset-groups-shared';
import styles from './AssetGroupManagerModal.module.css';

export type AssetGroupModalAsset = {
  id: string;
  title: string;
  registerId: string | null;
  value: number;
};

type Props = {
  open: boolean;
  anchorAsset: AssetGroupModalAsset | null;
  group: AssetGroup | null;
  assets: AssetGroupModalAsset[];
  groups: AssetGroup[];
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (input: AssetGroupSaveInput) => void | Promise<void>;
  onDelete: (group: AssetGroup) => void | Promise<void>;
};

const RELATIONSHIP_OPTIONS: Array<{ value: AssetGroupRelationship; label: string }> = [
  { value: 'works_with', label: 'Works with the primary asset' },
  { value: 'located_at', label: 'Located at the primary asset' },
  { value: 'component_of', label: 'Component of the primary asset' },
  { value: 'attached_to', label: 'Attached to the primary asset' },
  { value: 'other', label: 'Linked to the primary asset' },
];

function defaultGroupName(asset: AssetGroupModalAsset | null): string {
  const title = String(asset?.title ?? '').trim();
  return title ? `${title} group` : 'Asset group';
}

function money(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value) || 0)).replace('ZAR', 'R');
}

export default function AssetGroupManagerModal({
  open,
  anchorAsset,
  group,
  assets,
  groups,
  busy = false,
  error,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [name, setName] = useState('');
  const [valueMode, setValueMode] = useState<AssetGroupValueMode>('separate');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [primaryAssetId, setPrimaryAssetId] = useState('');
  const [relationships, setRelationships] = useState<Record<string, AssetGroupRelationship>>({});
  const [search, setSearch] = useState('');

  const membershipByAssetId = useMemo(() => {
    const result = new Map<string, AssetGroup>();
    groups.forEach((entry) => entry.members.forEach((member) => result.set(member.assetId, entry)));
    return result;
  }, [groups]);

  useEffect(() => {
    if (!open) return;

    const initialMemberIds = group?.members.map((member) => member.assetId)
      ?? (anchorAsset ? [anchorAsset.id] : []);
    const initialPrimaryAssetId = group?.members.find((member) => member.role === 'primary')?.assetId
      ?? anchorAsset?.id
      ?? initialMemberIds[0]
      ?? '';

    setName(group?.name ?? defaultGroupName(anchorAsset));
    setValueMode(group?.valueMode ?? 'separate');
    setSelectedAssetIds(initialMemberIds);
    setPrimaryAssetId(initialPrimaryAssetId);
    setRelationships(Object.fromEntries(
      (group?.members ?? []).map((member) => [member.assetId, member.relationship]),
    ));
    setSearch('');
  }, [anchorAsset, group, open]);

  const visibleAssets = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return assets
      .filter((asset) => !normalized || asset.title.toLowerCase().includes(normalized))
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [assets, search]);

  const selectedAssets = useMemo(
    () => selectedAssetIds.map((assetId) => assets.find((asset) => asset.id === assetId)).filter(Boolean) as AssetGroupModalAsset[],
    [assets, selectedAssetIds],
  );

  const countedValue = selectedAssets.reduce((sum, asset) => {
    if (valueMode === 'included_in_primary' && asset.id !== primaryAssetId) return sum;
    return sum + Math.round(Number(asset.value) || 0);
  }, 0);

  if (!open || !anchorAsset) return null;

  function toggleAsset(asset: AssetGroupModalAsset) {
    const existingGroup = membershipByAssetId.get(asset.id);
    if (existingGroup && existingGroup.id !== group?.id) return;

    setSelectedAssetIds((current) => {
      if (current.includes(asset.id)) {
        if (asset.id === anchorAsset?.id) return current;
        const next = current.filter((assetId) => assetId !== asset.id);
        if (primaryAssetId === asset.id) {
          setPrimaryAssetId(anchorAsset?.id ?? next[0] ?? '');
        }
        return next;
      }

      return [...current, asset.id];
    });
  }

  function handlePrimaryChange(assetId: string) {
    const previousPrimaryAssetId = primaryAssetId;
    setPrimaryAssetId(assetId);
    setRelationships((current) => ({
      ...current,
      ...(previousPrimaryAssetId && previousPrimaryAssetId !== assetId
        ? { [previousPrimaryAssetId]: 'works_with' as AssetGroupRelationship }
        : {}),
      [assetId]: 'primary',
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || selectedAssetIds.length < 2 || !primaryAssetId || !name.trim()) return;

    void onSave({
      groupId: group?.id,
      registerId: anchorAsset?.registerId ?? '',
      name: name.trim(),
      valueMode,
      primaryAssetId,
      memberIds: selectedAssetIds,
      relationships,
    });
  }

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="asset-group-title">
        <header className={styles.header}>
          <span className={styles.umbrella} aria-hidden="true">☂</span>
          <div>
            <p>Asset grouping</p>
            <h2 id="asset-group-title">{group ? 'Manage asset group' : 'Create an asset group'}</h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} disabled={busy} aria-label="Close asset group">
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className={styles.body}>
            <p className={styles.intro}>
              Keep related assets together while each asset keeps its own details, maintenance, documents and valuation history.
            </p>

            <label className={styles.field}>
              <span>Group name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 80))}
                placeholder="Example: Farm transport set"
                autoFocus
                required
              />
            </label>

            <fieldset className={styles.valueModeFieldset}>
              <legend>How should these values count?</legend>
              <label className={valueMode === 'separate' ? styles.choiceActive : styles.choice}>
                <input
                  type="radio"
                  name="asset-group-value-mode"
                  checked={valueMode === 'separate'}
                  onChange={() => setValueMode('separate')}
                />
                <span>
                  <strong>Count every asset separately</strong>
                  <small>Best for a truck and trailer, or equipment that works together but has separate value.</small>
                </span>
              </label>
              <label className={valueMode === 'included_in_primary' ? styles.choiceActive : styles.choice}>
                <input
                  type="radio"
                  name="asset-group-value-mode"
                  checked={valueMode === 'included_in_primary'}
                  onChange={() => setValueMode('included_in_primary')}
                />
                <span>
                  <strong>Linked assets are included in the primary value</strong>
                  <small>Best when land value already includes buildings, or one asset’s value already covers its components.</small>
                </span>
              </label>
            </fieldset>

            <section className={styles.assetSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <span>Assets in this group</span>
                  <small>Choose at least two assets from this Asset Register.</small>
                </div>
                <strong>{selectedAssetIds.length} selected</strong>
              </div>

              <label className={styles.searchField}>
                <span className={styles.srOnly}>Search assets</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search assets"
                />
              </label>

              <div className={styles.assetList}>
                {visibleAssets.map((asset) => {
                  const existingGroup = membershipByAssetId.get(asset.id);
                  const unavailable = Boolean(existingGroup && existingGroup.id !== group?.id);
                  const selected = selectedAssetIds.includes(asset.id);

                  return (
                    <div className={selected ? styles.assetRowSelected : styles.assetRow} key={asset.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={unavailable || asset.id === anchorAsset.id}
                          onChange={() => toggleAsset(asset)}
                        />
                        <span>
                          <strong>{asset.title}</strong>
                          <small>{unavailable ? `Already in ${existingGroup?.name}` : money(asset.value)}</small>
                        </span>
                      </label>

                      {selected ? (
                        <div className={styles.memberControls}>
                          <label>
                            <span>Role</span>
                            <select
                              value={asset.id === primaryAssetId ? 'primary' : 'linked'}
                              onChange={(event) => {
                                if (event.target.value === 'primary') handlePrimaryChange(asset.id);
                              }}
                            >
                              <option value="primary">Primary asset</option>
                              <option value="linked">Linked asset</option>
                            </select>
                          </label>

                          {asset.id !== primaryAssetId ? (
                            <label>
                              <span>Relationship</span>
                              <select
                                value={relationships[asset.id] ?? 'works_with'}
                                onChange={(event) => setRelationships((current) => ({
                                  ...current,
                                  [asset.id]: event.target.value as AssetGroupRelationship,
                                }))}
                              >
                                {RELATIONSHIP_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <p>{assetGroupRelationshipLabel('primary')}</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className={styles.summary}>
              <span>Register value represented by this group</span>
              <strong>{money(countedValue)}</strong>
              <small>{valueMode === 'separate' ? 'All selected values are counted.' : 'Only the primary asset counts toward register totals.'}</small>
            </aside>

            {error ? <p className={styles.error} role="alert">{error}</p> : null}
          </div>

          <footer className={styles.footer}>
            {group ? (
              <button type="button" className={styles.deleteButton} onClick={() => void onDelete(group)} disabled={busy}>
                Remove group
              </button>
            ) : <span />}
            <div>
              <button type="button" className={styles.cancelButton} onClick={onClose} disabled={busy}>Cancel</button>
              <button
                type="submit"
                className={styles.saveButton}
                disabled={busy || selectedAssetIds.length < 2 || !primaryAssetId || !name.trim()}
              >
                {busy ? 'Saving…' : group ? 'Save group' : 'Create group'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
