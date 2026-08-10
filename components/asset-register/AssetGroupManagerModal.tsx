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

type IconProps = { className?: string };
type AssetGroupModalView = 'menu' | 'members' | 'settings' | 'reports' | 'delete' | 'create';

function MembersIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M2.75 20v-2.1A5.25 5.25 0 0 1 8 12.65a5.25 5.25 0 0 1 5.25 5.25V20M14.25 13.05a4.6 4.6 0 0 1 7 3.92V20" />
    </svg>
  );
}

function SettingsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4" />
      <circle cx="16" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="14" cy="18" r="2" />
    </svg>
  );
}

function DownloadIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v11M7.5 10.5 12 15l4.5-4.5M4 20h16" />
    </svg>
  );
}

function TrashIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M9 3h6l1 4H8l1-4ZM7 7l1 14h8l1-14M10 11v6M14 11v6" />
    </svg>
  );
}

function BackIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m14.5 5-7 7 7 7" />
    </svg>
  );
}

export type AssetGroupModalAsset = {
  id: string;
  title: string;
  registerId: string | null;
  registerName?: string | null;
  value: number;
};

type Props = {
  open: boolean;
  anchorAsset: AssetGroupModalAsset | null;
  group: AssetGroup | null;
  assets: AssetGroupModalAsset[];
  groups: AssetGroup[];
  combinedMode?: boolean;
  busy?: boolean;
  reportBusy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (input: AssetGroupSaveInput) => void | Promise<void>;
  onDelete: (group: AssetGroup) => void | Promise<void>;
  onDownloadPdf?: (group: AssetGroup) => void | Promise<void>;
  onDownloadXlsx?: (group: AssetGroup) => void | Promise<void>;
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
  combinedMode = false,
  busy = false,
  reportBusy = false,
  error,
  onClose,
  onSave,
  onDelete,
  onDownloadPdf,
  onDownloadXlsx,
}: Props) {
  const [name, setName] = useState('');
  const [valueMode, setValueMode] = useState<AssetGroupValueMode>('separate');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [primaryAssetId, setPrimaryAssetId] = useState('');
  const [relationships, setRelationships] = useState<Record<string, AssetGroupRelationship>>({});
  const [search, setSearch] = useState('');
  const [view, setView] = useState<AssetGroupModalView>('create');

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
    setValueMode(combinedMode ? 'separate' : group?.valueMode ?? 'separate');
    setSelectedAssetIds(initialMemberIds);
    setPrimaryAssetId(initialPrimaryAssetId);
    setRelationships(Object.fromEntries(
      (group?.members ?? []).map((member) => [member.assetId, member.relationship]),
    ));
    setSearch('');
    setView(group ? 'menu' : 'create');
  }, [anchorAsset, combinedMode, group, open]);

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

  const showSettingsForm = view === 'create' || view === 'settings';
  const showMembersForm = view === 'create' || view === 'members';
  const modalTitle = !group
    ? 'Create an umbrella'
    : view === 'menu'
      ? group.name
      : view === 'members'
        ? 'Manage linked assets'
        : view === 'settings'
          ? 'Umbrella settings'
          : view === 'reports'
            ? 'Download reports'
            : 'Remove umbrella';
  const modalSubtitle = !group
    ? 'Group related assets while keeping every record independent.'
    : view === 'menu'
      ? `${group.members.length} linked ${group.members.length === 1 ? 'asset' : 'assets'} · ${money(countedValue)} represented value`
      : view === 'members'
        ? `Add, remove and organise assets in ${group.name}.`
        : view === 'settings'
          ? `Rename ${group.name} or change how its values count.`
          : view === 'reports'
            ? `Download reports containing only ${group.name}.`
            : `Remove the grouping without deleting its assets.`;

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy && !reportBusy) onClose();
    }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="asset-group-title">
        <header className={styles.header}>
          {group && view !== 'menu' ? (
            <button type="button" className={styles.backButton} onClick={() => setView('menu')} disabled={busy || reportBusy} aria-label="Back to umbrella options">
              <BackIcon className={styles.backIcon} />
            </button>
          ) : null}
          <div className={styles.headerText}>
            <h2 id="asset-group-title">{modalTitle}</h2>
            <p>{modalSubtitle}</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} disabled={busy || reportBusy} aria-label="Close umbrella manager">
            ×
          </button>
        </header>

        {group && view === 'menu' ? (
          <div className={styles.menuBody}>
            <div className={styles.menuGrid}>
              <button type="button" className={`${styles.menuAction} ${styles.menuActionPrimary}`} onClick={() => setView('members')}>
                <MembersIcon className={styles.menuActionIcon} />
                <span>
                  <strong>Manage assets</strong>
                  <small>Add, remove and organise linked assets.</small>
                </span>
              </button>
              <button type="button" className={styles.menuAction} onClick={() => setView('settings')}>
                <SettingsIcon className={styles.menuActionIcon} />
                <span>
                  <strong>Umbrella settings</strong>
                  <small>Rename the umbrella or change how values count.</small>
                </span>
              </button>
              <button type="button" className={styles.menuAction} onClick={() => setView('reports')} disabled={!onDownloadPdf && !onDownloadXlsx}>
                <DownloadIcon className={styles.menuActionIcon} />
                <span>
                  <strong>Download reports</strong>
                  <small>Choose a report containing only this umbrella.</small>
                </span>
              </button>
              <button type="button" className={`${styles.menuAction} ${styles.menuActionDanger}`} onClick={() => setView('delete')}>
                <TrashIcon className={styles.menuActionIcon} />
                <span>
                  <strong>Remove umbrella</strong>
                  <small>Ungroup the assets without deleting their records.</small>
                </span>
              </button>
            </div>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
          </div>
        ) : group && view === 'reports' ? (
          <>
            <div className={styles.subviewBody}>
              <div className={styles.reportMenuGrid} aria-label={`${group.name} reports`}>
                {onDownloadPdf ? (
                  <button type="button" className={styles.reportMenuAction} onClick={() => void onDownloadPdf(group)} disabled={busy || reportBusy}>
                    <span className={styles.reportFormat}>PDF</span>
                    <span>
                      <strong>{reportBusy ? 'Preparing…' : 'Download PDF'}</strong>
                      <small>Formatted umbrella report for sharing or printing.</small>
                    </span>
                  </button>
                ) : null}
                {onDownloadXlsx ? (
                  <button type="button" className={styles.reportMenuAction} onClick={() => void onDownloadXlsx(group)} disabled={busy || reportBusy}>
                    <span className={styles.reportFormat}>XLSX</span>
                    <span>
                      <strong>{reportBusy ? 'Preparing…' : 'Download Excel'}</strong>
                      <small>Detailed workbook of every linked asset.</small>
                    </span>
                  </button>
                ) : null}
              </div>
              <p className={styles.scopeNote}>Only assets linked to {group.name} are included. Unrelated Asset Register items stay private.</p>
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
            </div>
            <footer className={styles.footer}>
              <button type="button" className={styles.cancelButton} onClick={() => setView('menu')} disabled={busy || reportBusy}>Back</button>
            </footer>
          </>
        ) : group && view === 'delete' ? (
          <>
            <div className={styles.subviewBody}>
              <section className={styles.deleteNotice}>
                <TrashIcon className={styles.deleteNoticeIcon} />
                <div>
                  <strong>Remove {group.name}?</strong>
                  <p>The umbrella will be removed, but all {group.members.length} linked asset records, values, maintenance history, documents and photos will remain unchanged.</p>
                </div>
              </section>
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
            </div>
            <footer className={styles.footer}>
              <button type="button" className={styles.cancelButton} onClick={() => setView('menu')} disabled={busy}>Cancel</button>
              <button type="button" className={styles.deleteButton} onClick={() => void onDelete(group)} disabled={busy}>
                {busy ? 'Removing…' : 'Remove umbrella'}
              </button>
            </footer>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className={styles.body}>
              <p className={styles.intro}>
                {view === 'members'
                  ? 'Choose the assets that belong together. Each asset keeps its own details, maintenance, documents and valuation history.'
                  : 'Keep related assets together while every asset keeps its own independent record.'}
              </p>

              {showSettingsForm ? (
                <>
                  <label className={styles.field}>
                    <span>Umbrella name</span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value.slice(0, 80))}
                      placeholder="Example: Farm transport set"
                      autoFocus
                      required
                    />
                  </label>

                  {combinedMode ? (
                    <section className={styles.combinedModeNotice} aria-label="Combined Asset Register umbrella values">
                      <strong>Combined umbrella</strong>
                      <span>Assets stay in their own Asset Registers and every value is counted separately.</span>
                    </section>
                  ) : (
                    <fieldset className={styles.valueModeFieldset}>
                      <legend>How should these values count?</legend>
                      <label className={valueMode === 'separate' ? styles.choiceActive : styles.choice}>
                        <input type="radio" name="asset-group-value-mode" checked={valueMode === 'separate'} onChange={() => setValueMode('separate')} />
                        <span>
                          <strong>Count every asset separately</strong>
                          <small>Best for a truck and trailer, or equipment that works together but has separate value.</small>
                        </span>
                      </label>
                      <label className={valueMode === 'included_in_primary' ? styles.choiceActive : styles.choice}>
                        <input type="radio" name="asset-group-value-mode" checked={valueMode === 'included_in_primary'} onChange={() => setValueMode('included_in_primary')} />
                        <span>
                          <strong>Linked assets are included in the primary value</strong>
                          <small>Best when land value already includes buildings, or one asset’s value already covers its components.</small>
                        </span>
                      </label>
                    </fieldset>
                  )}
                </>
              ) : null}

              {showMembersForm ? (
                <section className={styles.assetSection}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <span>Assets in this umbrella</span>
                      <small>{combinedMode
                        ? 'Choose at least two assets from any of your Asset Registers.'
                        : 'Choose at least two assets from this Asset Register.'}</small>
                    </div>
                    <strong>{selectedAssetIds.length} selected</strong>
                  </div>

                  <label className={styles.searchField}>
                    <span className={styles.srOnly}>Search assets</span>
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets" />
                  </label>

                  <div className={styles.assetList}>
                    {visibleAssets.map((asset) => {
                      const existingGroup = membershipByAssetId.get(asset.id);
                      const unavailable = Boolean(existingGroup && existingGroup.id !== group?.id);
                      const selected = selectedAssetIds.includes(asset.id);

                      return (
                        <div className={selected ? styles.assetRowSelected : styles.assetRow} key={asset.id}>
                          <label>
                            <input type="checkbox" checked={selected} disabled={unavailable || asset.id === anchorAsset.id} onChange={() => toggleAsset(asset)} />
                            <span>
                              <strong>{asset.title}</strong>
                              <small>{unavailable
                                ? `Already in ${existingGroup?.name}`
                                : [combinedMode ? asset.registerName : '', money(asset.value)].filter(Boolean).join(' · ')}</small>
                            </span>
                          </label>

                          {selected ? (
                            <div className={styles.memberControls}>
                              <label>
                                <span>Role</span>
                                <select value={asset.id === primaryAssetId ? 'primary' : 'linked'} onChange={(event) => {
                                  if (event.target.value === 'primary') handlePrimaryChange(asset.id);
                                }}>
                                  <option value="primary">Primary asset</option>
                                  <option value="linked">Linked asset</option>
                                </select>
                              </label>

                              {asset.id !== primaryAssetId ? (
                                <label>
                                  <span>Relationship</span>
                                  <select value={relationships[asset.id] ?? 'works_with'} onChange={(event) => setRelationships((current) => ({
                                    ...current,
                                    [asset.id]: event.target.value as AssetGroupRelationship,
                                  }))}>
                                    {RELATIONSHIP_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                  </select>
                                </label>
                              ) : <p>{assetGroupRelationshipLabel('primary')}</p>}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <aside className={styles.summary}>
                <span>{combinedMode ? 'Combined value represented by this umbrella' : 'Register value represented by this umbrella'}</span>
                <strong>{money(countedValue)}</strong>
                <small>{valueMode === 'separate' ? 'All selected values are counted.' : 'Only the primary asset counts toward register totals.'}</small>
              </aside>

              {error ? <p className={styles.error} role="alert">{error}</p> : null}
            </div>

            <footer className={styles.footer}>
              <button type="button" className={styles.cancelButton} onClick={() => group ? setView('menu') : onClose()} disabled={busy}>
                {group ? 'Back' : 'Cancel'}
              </button>
              <button type="submit" className={styles.saveButton} disabled={busy || selectedAssetIds.length < 2 || !primaryAssetId || !name.trim()}>
                {busy ? 'Saving…' : group ? 'Save changes' : 'Create umbrella'}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
