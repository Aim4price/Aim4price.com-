'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  assetGroupRelationshipLabel,
  type AssetGroup,
  type AssetGroupRelationship,
  type AssetGroupSaveInput,
  type AssetGroupValueMode,
} from '../../lib/asset-groups-shared';
import registerStyles from '../../app/asset-register/page.module.css';
import styles from './AssetGroupManagerModal.module.css';

type IconProps = { className?: string };
type AssetGroupModalView = 'menu' | 'members' | 'settings' | 'reports' | 'delete' | 'create';

function MembersIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M2.75 20v-2.1A5.25 5.25 0 0 1 8 12.65a5.25 5.25 0 0 1 5.25 5.25V20M14.25 13.05a4.6 4.6 0 0 1 7 3.92V20" />
    </svg>
  );
}

function SettingsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4" />
      <circle cx="16" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="14" cy="18" r="2" />
    </svg>
  );
}

function DownloadIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v11M7.5 10.5 12 15l4.5-4.5M4 20h16" />
    </svg>
  );
}

function TrashIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 3h6l1 4H8l1-4ZM7 7l1 14h8l1-14M10 11v6M14 11v6" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

function SpreadsheetIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h8M12 7v8" />
    </svg>
  );
}

function PdfIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7zM14 3v5h5M9 15h6M9 18h5" />
    </svg>
  );
}

type ReportGraphicProps = {
  src: string;
  alt: string;
  icon: JSX.Element;
};

function ReportGraphic({ src, alt, icon }: ReportGraphicProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <span className={registerStyles.exportGraphicFallback}>{icon}</span>;
  }

  return <img src={src} alt={alt} className={registerStyles.exportGraphicImage} onError={() => setHasError(true)} />;
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
  const [reportFormat, setReportFormat] = useState<'pdf' | 'xlsx'>('pdf');

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
    setReportFormat('pdf');
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

  function handleDownloadSelectedReport() {
    if (!group || busy || reportBusy) return;

    if (reportFormat === 'pdf') {
      void onDownloadPdf?.(group);
      return;
    }

    void onDownloadXlsx?.(group);
  }

  const showSettingsForm = view === 'create' || view === 'settings';
  const showMembersForm = view === 'create' || view === 'members';
  const groupSummary = group
    ? `${group.members.length} linked ${group.members.length === 1 ? 'asset' : 'assets'} · ${money(countedValue)} represented value`
    : '';
  const modalTitle = !group
    ? 'Create an umbrella'
    : view === 'menu' || view === 'reports'
      ? group.name
      : view === 'members'
        ? 'Manage linked assets'
        : view === 'settings'
          ? 'Umbrella settings'
          : 'Remove umbrella';
  const modalSubtitle = !group
    ? 'Group related assets while keeping every record independent.'
    : view === 'menu' || view === 'reports'
      ? groupSummary
      : view === 'members'
        ? `Add, remove and organise assets in ${group.name}.`
        : view === 'settings'
          ? `Rename ${group.name} or change how its values count.`
          : `Remove the grouping without deleting its assets.`;
  const useManageModalDesign = Boolean(group && view === 'menu');
  const useReportModalDesign = Boolean(group && view === 'reports');
  const useSharedAssetModalDesign = useManageModalDesign || useReportModalDesign;

  return (
    <div className={useSharedAssetModalDesign ? registerStyles.modalOverlay : styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy && !reportBusy) onClose();
    }}>
      {useSharedAssetModalDesign ? (
        <div className={registerStyles.modalBackdrop} onClick={() => {
          if (!busy && !reportBusy) onClose();
        }} />
      ) : null}
      <section
        className={useManageModalDesign
          ? registerStyles.optionsModal
          : useReportModalDesign
            ? `${registerStyles.modalCard} ${registerStyles.assetReportModal}`
            : styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-group-title"
      >
        <header className={useManageModalDesign
          ? `${registerStyles.modalHeader} ${registerStyles.optionsModalHeader}`
          : useReportModalDesign
            ? `${registerStyles.modalHeader} ${registerStyles.assetReportModalHeader}`
            : styles.header}>
          <div className={useSharedAssetModalDesign ? registerStyles.modalHeaderText : styles.headerText}>
            {useSharedAssetModalDesign
              ? <h3 id="asset-group-title">{modalTitle}</h3>
              : <h2 id="asset-group-title">{modalTitle}</h2>}
            <p>{modalSubtitle}</p>
          </div>
          <button
            type="button"
            className={useSharedAssetModalDesign ? registerStyles.modalCloseButton : styles.closeButton}
            onClick={onClose}
            disabled={busy || reportBusy}
            aria-label="Close umbrella manager"
          >
            {useSharedAssetModalDesign ? <CloseIcon className={registerStyles.buttonIcon} /> : '×'}
          </button>
        </header>

        {group && view === 'menu' ? (
          <div className={`${registerStyles.modalScrollBody} ${registerStyles.optionsScrollBody}`}>
            <div className={registerStyles.optionsContent}>
              <div className={`${registerStyles.optionsGrid} ${registerStyles.assetOptionsGrid}`}>
                <button type="button" className={`${registerStyles.optionActionButton} ${registerStyles.optionFeaturedButton}`} onClick={() => setView('members')}>
                  <MembersIcon className={registerStyles.buttonIcon} />
                  <span>
                    <strong>Manage assets</strong>
                    <small>Add, remove and organise linked assets.</small>
                  </span>
                </button>
                <button type="button" className={registerStyles.optionActionButton} onClick={() => setView('settings')}>
                  <SettingsIcon className={registerStyles.buttonIcon} />
                  <span>
                    <strong>Umbrella settings</strong>
                    <small>Rename the umbrella or change how values count.</small>
                  </span>
                </button>
                <button type="button" className={registerStyles.optionActionButton} onClick={() => setView('reports')} disabled={!onDownloadPdf && !onDownloadXlsx}>
                  <DownloadIcon className={registerStyles.buttonIcon} />
                  <span>
                    <strong>Download reports</strong>
                    <small>Choose a report for this umbrella.</small>
                  </span>
                </button>
                <button type="button" className={`${registerStyles.optionActionButton} ${registerStyles.optionDangerButton}`} onClick={() => setView('delete')}>
                  <TrashIcon className={registerStyles.buttonIcon} />
                  <span>
                    <strong>Remove umbrella</strong>
                    <small>Ungroup the assets without deleting their records.</small>
                  </span>
                </button>
              </div>
            </div>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
          </div>
        ) : group && view === 'reports' ? (
          <div className={`${registerStyles.modalScrollBody} ${registerStyles.assetReportModalBody}`}>
            <div className={registerStyles.assetTimelineStageHeading}>
              <strong>Choose export format</strong>
              <span>Select PDF or Excel. Only assets linked to {group.name} are included.</span>
            </div>

            <div className={registerStyles.assetTimelineFormatGrid} aria-label={`${group.name} report format`}>
              <button
                type="button"
                className={`${registerStyles.assetTimelineFormatOption} ${reportFormat === 'pdf' ? registerStyles.assetTimelineFormatOptionActive : ''}`}
                onClick={() => setReportFormat('pdf')}
                disabled={!onDownloadPdf || busy || reportBusy}
                aria-pressed={reportFormat === 'pdf'}
              >
                <span className={registerStyles.assetTimelineFormatGraphic}>
                  <ReportGraphic src="/brand/pdf.png" alt="PDF report" icon={<PdfIcon className={registerStyles.assetTimelineFormatFallbackIcon} />} />
                </span>
                <span className={registerStyles.assetTimelineFormatCopy}>
                  <strong>PDF report</strong>
                  <small>Open a clear report for dealers, banks or insurance partners.</small>
                </span>
              </button>

              <button
                type="button"
                className={`${registerStyles.assetTimelineFormatOption} ${reportFormat === 'xlsx' ? registerStyles.assetTimelineFormatOptionActive : ''}`}
                onClick={() => setReportFormat('xlsx')}
                disabled={!onDownloadXlsx || busy || reportBusy}
                aria-pressed={reportFormat === 'xlsx'}
              >
                <span className={registerStyles.assetTimelineFormatGraphic}>
                  <ReportGraphic src="/brand/sheet.png" alt="Excel workbook" icon={<SpreadsheetIcon className={registerStyles.assetTimelineFormatFallbackIcon} />} />
                </span>
                <span className={registerStyles.assetTimelineFormatCopy}>
                  <strong>XLSX workbook</strong>
                  <small>Download every linked asset in an Excel-ready workbook.</small>
                </span>
              </button>
            </div>

            {error ? <p className={styles.error} role="alert">{error}</p> : null}

            <div className={`${registerStyles.formActions} ${registerStyles.exportActions} ${registerStyles.assetFuelReportActions}`}>
              <button type="button" className={`${registerStyles.secondaryButton} ${registerStyles.assetTimelineSecondaryButton}`} onClick={() => setView('menu')} disabled={busy || reportBusy}>Back</button>
              <button type="button" className={`${registerStyles.secondaryButton} ${registerStyles.assetTimelineSecondaryButton}`} onClick={onClose} disabled={busy || reportBusy}>Cancel</button>
              <button
                type="button"
                className={registerStyles.primaryButton}
                onClick={handleDownloadSelectedReport}
                disabled={busy || reportBusy || (reportFormat === 'pdf' ? !onDownloadPdf : !onDownloadXlsx)}
              >
                <span>{reportBusy ? 'Preparing…' : reportFormat === 'pdf' ? 'Open PDF report' : 'Download Excel'}</span>
              </button>
            </div>
          </div>
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
