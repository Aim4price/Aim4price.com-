'use client';

import { useEffect, useMemo, useState } from 'react';
import DealerAssetCorrectionEditor from './DealerAssetCorrectionEditor';
import DealerMaintenanceReportModal from './DealerMaintenanceReportModal';
import {
  WorkspaceTitlePanel,
  workspaceStyles,
} from './WorkspacePrimitives';
import type {
  DealerMaintenanceRecordSummary,
  DealerMaintenanceTrackedAsset,
  DealerMaintenanceTrackerStatus,
} from '../lib/dealer-maintenance-tracker';
import assetStyles from '../app/asset-register/page.module.css';
import leadStyles from '../app/leads/page.module.css';
import styles from './DealerMaintenanceTrackerClient.module.css';

type TrackerStatusFilter = 'all' | 'attention' | 'upcoming' | 'no_open';
type FilterDropdownKey = 'owner' | 'status';
type Option = { value: string; label: string };

type Props = {
  initialAssets: DealerMaintenanceTrackedAsset[];
  dealerAppMode?: boolean;
  initialOpenAccessId?: string | null;
};

type TrackerResponse = {
  ok?: boolean;
  assets?: DealerMaintenanceTrackedAsset[];
  error?: string;
};

const statusOptions: Option[] = [
  { value: 'all', label: 'All tracked assets' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'no_open', label: 'No open maintenance' },
];

function SearchIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m16 16 4.4 4.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function RefreshIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M19.2 8.2A8 8 0 1 0 20 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M19.4 3.8v5.1h-5.1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function FilterIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function ChevronDownIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CloseIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 6.5 11 11m0-11-11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function DownloadIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function formatUsage(value: number | null, metric: string | null): string {
  if (value === null || !Number.isFinite(value)) return 'Not recorded';
  if (metric === 'percentage') return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}%`;
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} ${metric === 'km' ? 'km' : 'hours'}`;
}

function formatDate(value: string | null, includeTime = false): string {
  if (!value) return 'Not set';
  const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: value.includes('T') ? 'Africa/Johannesburg' : 'UTC',
  }).format(parsed);
}

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Not saved';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value);
}

function dueLabel(record: DealerMaintenanceRecordSummary, fallbackMetric: string): string {
  return record.triggerType === 'usage'
    ? formatUsage(record.dueUsage, record.usageMetric || fallbackMetric)
    : formatDate(record.dueDate);
}

function remainingLabel(record: DealerMaintenanceRecordSummary, fallbackMetric: string): string {
  if (record.status === 'done') return record.completedAtIso ? `Completed ${formatDate(record.completedAtIso)}` : 'Completed';
  if (record.triggerType === 'date') {
    if (!record.dueDate) return 'Not set';
    const days = Math.ceil((new Date(`${record.dueDate}T00:00:00`).getTime() - Date.now()) / 86_400_000);
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    return `${days} days`;
  }
  if (record.remainingUsage === null) return 'Usage needed';
  if (record.remainingUsage < 0) return `${formatUsage(Math.abs(record.remainingUsage), record.usageMetric || fallbackMetric)} overdue`;
  return formatUsage(record.remainingUsage, record.usageMetric || fallbackMetric);
}

function recurringLabel(record: DealerMaintenanceRecordSummary): string {
  if (!record.recurringEnabled) return 'Not recurring';
  if (record.recurringIntervalValue === null || !record.recurringIntervalUnit) return 'Recurring';
  return `Every ${record.recurringIntervalValue.toLocaleString('en-ZA')} ${record.recurringIntervalUnit}`;
}

function statusClass(status: DealerMaintenanceTrackerStatus): string {
  if (status === 'overdue' || status === 'due') return styles.statusUrgent;
  if (status === 'due_soon' || status === 'usage_needed') return styles.statusAttention;
  if (status === 'no_open') return styles.statusNoOpen;
  return styles.statusUpcoming;
}

function needsAttention(status: DealerMaintenanceTrackerStatus): boolean {
  return ['overdue', 'due', 'due_soon', 'usage_needed'].includes(status);
}

function matchesSearch(asset: DealerMaintenanceTrackedAsset, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [
    asset.ownerName,
    asset.assetTitle,
    asset.assetKind,
    asset.brandName,
    asset.modelName,
    asset.serialNumber,
    asset.statusLabel,
    asset.nextMaintenance?.title,
    ...asset.maintenanceRecords.map((record) => `${record.title} ${record.notes} ${record.completedNotes}`),
  ].some((value) => String(value || '').toLowerCase().includes(query));
}

function Dropdown({
  label,
  value,
  options,
  dropdownKey,
  openDropdown,
  onOpenChange,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  dropdownKey: string;
  openDropdown: string | null;
  onOpenChange: (key: string | null) => void;
  onChange: (value: string) => void;
}) {
  const isOpen = openDropdown === dropdownKey;
  const selected = options.find((option) => option.value === value) ?? options[0];
  return (
    <label className={`${assetStyles.field} ${leadStyles.leadFilterField} ${isOpen ? leadStyles.leadFilterFieldOpen : ''}`}>
      <span>{label}</span>
      <div className={leadStyles.leadFilterDropdown}>
        <button
          type="button"
          className={`${leadStyles.leadFilterSelectButton} ${isOpen ? leadStyles.leadFilterSelectButtonOpen : ''}`}
          onClick={() => onOpenChange(isOpen ? null : dropdownKey)}
          aria-expanded={isOpen}
        >
          <span>{selected?.label || 'Choose'}</span>
          <ChevronDownIcon className={leadStyles.leadFilterSelectIcon} />
        </button>
        {isOpen ? (
          <div className={leadStyles.leadFilterSelectMenu} role="listbox" aria-label={label}>
            {options.map((option) => (
              <button
                type="button"
                key={option.value}
                className={`${leadStyles.leadFilterSelectOption} ${option.value === value ? leadStyles.leadFilterSelectOptionActive : ''}`}
                onClick={() => {
                  onChange(option.value);
                  onOpenChange(null);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  );
}

function RecordCard({ record, asset }: { record: DealerMaintenanceRecordSummary; asset: DealerMaintenanceTrackedAsset }) {
  return (
    <article className={styles.recordCard}>
      <header>
        <div>
          <span>{record.maintenanceType === 'checkup' ? 'Checkup' : 'Service'}</span>
          <h4>{record.title}</h4>
        </div>
        <strong className={record.status === 'done' ? styles.recordDone : styles.recordOpen}>{record.computedStatusLabel}</strong>
      </header>
      <div className={styles.recordGrid}>
        <div><span>Due</span><strong>{dueLabel(record, asset.usageMetric)}</strong></div>
        <div><span>Current usage</span><strong>{formatUsage(record.currentUsage, record.usageMetric || asset.usageMetric)}</strong></div>
        <div><span>{record.status === 'done' ? 'Completed usage' : 'Remaining'}</span><strong>{record.status === 'done' ? formatUsage(record.completedUsage, record.usageMetric || asset.usageMetric) : remainingLabel(record, asset.usageMetric)}</strong></div>
        <div><span>Assigned to</span><strong>{record.assignedName || 'Unassigned'}</strong></div>
        <div><span>Recurring</span><strong>{recurringLabel(record)}</strong></div>
        <div><span>Updated</span><strong>{formatDate(record.updatedAtIso)}</strong></div>
      </div>
      {record.notes ? <div className={styles.note}><span>Maintenance note</span><p>{record.notes}</p></div> : null}
      {record.completedNotes ? <div className={`${styles.note} ${styles.completedNote}`}><span>Completion note</span><p>{record.completedNotes}</p>{record.completedBy ? <small>Completed by {record.completedBy}</small> : null}</div> : null}
    </article>
  );
}

export default function DealerMaintenanceTrackerClient({ initialAssets, dealerAppMode = false, initialOpenAccessId = null }: Props) {
  const [assets, setAssets] = useState(initialAssets);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<TrackerStatusFilter>('all');
  const [draftOwnerFilter, setDraftOwnerFilter] = useState('all');
  const [draftStatusFilter, setDraftStatusFilter] = useState<TrackerStatusFilter>('all');
  const [openFilterDropdown, setOpenFilterDropdown] = useState<FilterDropdownKey | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [openAccessId, setOpenAccessId] = useState<string | null>(
    initialAssets.some((asset) => asset.accessId === initialOpenAccessId) ? initialOpenAccessId : null,
  );
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [reportAccessId, setReportAccessId] = useState<string | null>(null);

  useEffect(() => setAssets(initialAssets), [initialAssets]);

  const ownerOptions = useMemo<Option[]>(() => [
    { value: 'all', label: 'All asset owners' },
    ...Array.from(new Map(assets.map((asset) => [asset.ownerUserId, asset.ownerName])).entries())
      .sort((left, right) => left[1].localeCompare(right[1]))
      .map(([value, label]) => ({ value, label })),
  ], [assets]);

  const filteredAssets = useMemo(() => assets.filter((asset) => {
    if (!matchesSearch(asset, search)) return false;
    if (ownerFilter !== 'all' && asset.ownerUserId !== ownerFilter) return false;
    if (statusFilter === 'attention' && !needsAttention(asset.status)) return false;
    if (statusFilter === 'upcoming' && asset.status !== 'upcoming') return false;
    if (statusFilter === 'no_open' && asset.status !== 'no_open') return false;
    return true;
  }), [assets, ownerFilter, search, statusFilter]);

  const attentionCount = assets.filter((asset) => needsAttention(asset.status)).length;
  const noOpenCount = assets.filter((asset) => asset.status === 'no_open').length;
  const hasActiveFilter = ownerFilter !== 'all' || statusFilter !== 'all';
  const activeFilterLabel = hasActiveFilter ? 'Filtered' : 'Filter';

  async function refresh() {
    if (loading) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch('/api/dealer/maintenance', { credentials: 'include', cache: 'no-store' });
      const payload = await response.json().catch(() => null) as TrackerResponse | null;
      if (!response.ok || !payload?.ok || !Array.isArray(payload.assets)) {
        throw new Error(payload?.error || 'Failed to refresh the Maintenance Tracker.');
      }
      setAssets(payload.assets);
      setNotice({ tone: 'success', text: 'Maintenance Tracker refreshed.' });
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Failed to refresh the Maintenance Tracker.' });
    } finally {
      setLoading(false);
    }
  }

  function openFilters() {
    setDraftOwnerFilter(ownerFilter);
    setDraftStatusFilter(statusFilter);
    setOpenFilterDropdown(null);
    setFilterOpen(true);
  }

  function clearFilters() {
    setOwnerFilter('all');
    setStatusFilter('all');
    setDraftOwnerFilter('all');
    setDraftStatusFilter('all');
    setFilterOpen(false);
  }

  function openReports(asset: DealerMaintenanceTrackedAsset) {
    setReportAccessId(asset.accessId);
  }

  function syncCorrection(assetId: string, correction: NonNullable<DealerMaintenanceTrackedAsset['dealerCorrection']>) {
    setAssets((current) => current.map((asset) => asset.assetId === assetId
      ? {
          ...asset,
          dealerCorrection: correction,
          serialNumber: correction.serialNumberChanged && correction.proposedSerialNumber ? correction.proposedSerialNumber : asset.serialNumber,
          replacementPriceExVat: correction.replacementPriceChanged ? correction.proposedReplacementPriceExVat : asset.replacementPriceExVat,
        }
      : asset));
  }

  return (
    <main className={`${assetStyles.page} ${workspaceStyles.page} ${leadStyles.leadsPage} ${leadStyles.dealerOwnerParity} ${styles.trackerPage} ${dealerAppMode ? styles.dealerApp : ''}`}>
      <section className={`${assetStyles.shell} ${workspaceStyles.shell}`}>
        {notice ? <div className={`${assetStyles.notice} ${notice.tone === 'success' ? assetStyles.noticeSuccess : assetStyles.noticeError}`}>{notice.text}</div> : null}

        <section className={`${assetStyles.registerPanel} ${leadStyles.leadsRegisterPanel}`}>
          <WorkspaceTitlePanel title="Maintenance Tracker" />

          <section className={`${assetStyles.summaryRow} ${assetStyles.heroSummaryRow} ${leadStyles.leadSummaryRow}`} aria-label="Maintenance Tracker summary">
            <article className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${leadStyles.leadOwnerSummaryCard} ${leadStyles.leadOwnerSummaryCardOpen}`}>
              <div className={assetStyles.heroSummaryHead}><span className={assetStyles.heroSummaryTitle}>Tracked equipment</span></div>
              <div className={assetStyles.heroSummaryValueRow}><strong className={assetStyles.heroSummaryValue}>{assets.length}</strong></div>
              <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter}`}><small>Actively shared by owners or Field Managers.</small></div>
            </article>
            <article className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${leadStyles.leadOwnerSummaryCard} ${leadStyles.leadOwnerSummaryCardNew}`}>
              <div className={assetStyles.heroSummaryHead}><span className={assetStyles.heroSummaryTitle}>Needs attention</span></div>
              <div className={assetStyles.heroSummaryValueRow}><strong className={assetStyles.heroSummaryValue}>{attentionCount}</strong></div>
              <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter}`}><small>Due, overdue, due soon or awaiting usage.</small></div>
            </article>
            <article className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${leadStyles.leadOwnerSummaryCard} ${leadStyles.leadOwnerSummaryCardDone}`}>
              <div className={assetStyles.heroSummaryHead}><span className={assetStyles.heroSummaryTitle}>No open maintenance</span></div>
              <div className={assetStyles.heroSummaryValueRow}><strong className={assetStyles.heroSummaryValue}>{noOpenCount}</strong></div>
              <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter}`}><small>Still tracked with completed history retained.</small></div>
            </article>
          </section>

          <div className={`${assetStyles.toolbar} ${workspaceStyles.controlsRow} ${leadStyles.leadSearchToolbar}`}>
            <label className={`${assetStyles.searchWrap} ${workspaceStyles.searchField}`}>
              <SearchIcon className={assetStyles.searchIcon} />
              <input className={assetStyles.searchInput} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search owner, equipment, serial or maintenance" aria-label="Search tracked equipment" />
              {search ? <button type="button" className={assetStyles.clearSearchButton} onClick={() => setSearch('')} aria-label="Clear search"><CloseIcon className={assetStyles.buttonIcon} /></button> : null}
            </label>
            <div className={leadStyles.leadToolbarActions}>
              <button type="button" className={`${assetStyles.secondaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral} ${leadStyles.leadRefreshButton}`} onClick={() => void refresh()} disabled={loading}>
                <RefreshIcon className={`${assetStyles.buttonIcon} ${loading ? leadStyles.leadRefreshIconActive : ''}`} /><span>Refresh</span>
              </button>
              <button type="button" className={`${assetStyles.secondaryButton} ${assetStyles.filterTriggerButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionMint} ${leadStyles.leadFilterButton} ${hasActiveFilter ? assetStyles.filterTriggerButtonActive : ''}`} onClick={openFilters} disabled={loading}>
                <FilterIcon className={assetStyles.buttonIcon} /><span>{activeFilterLabel}</span><ChevronDownIcon className={assetStyles.filterChevron} />
              </button>
            </div>
          </div>

          <div className={`${leadStyles.leadResultSummary} ${leadStyles.leadResultSummaryDealer}`}>
            <span>Showing</span><strong>{filteredAssets.length}</strong><span>of {assets.length} tracked assets</span>
          </div>

          {!filteredAssets.length ? <div className={`${assetStyles.emptyState} ${workspaceStyles.emptyState}`}>{assets.length ? 'No tracked assets match this search or filter.' : 'No tracked assets yet. Assets appear here after an owner or Field Manager enables dealer maintenance tracking.'}</div> : null}

          <div className={leadStyles.leadStack}>
            {filteredAssets.map((asset) => {
              const isOpen = openAccessId === asset.accessId;
              const correctionVisible = asset.permissions.canUpdateSerial || asset.permissions.canUpdateReplacementPrice || Boolean(asset.dealerCorrection);
              return (
                <article key={asset.accessId} className={`${workspaceStyles.card} ${leadStyles.leadThread} ${needsAttention(asset.status) ? leadStyles.leadThreadNew : ''} ${asset.status === 'no_open' ? leadStyles.leadThreadDone : ''} ${isOpen ? leadStyles.leadThreadOpen : ''}`}>
                  <div className={leadStyles.clientPanel}>
                    <div className={leadStyles.clientPanelHeader}>
                      <div className={leadStyles.clientIdentity}>
                        <div className={leadStyles.leadCardTitleRow}><h3>{asset.ownerName}</h3></div>
                        <strong className={leadStyles.leadAssetName}>{asset.assetTitle}</strong>
                        <span className={leadStyles.clientKicker}>{[asset.brandName, asset.modelName, asset.yearModel].filter(Boolean).join(' · ') || asset.assetKind} · {asset.statusLabel}</span>
                      </div>
                      <div className={leadStyles.clientDecisionArea}>
                        <div className={leadStyles.clientActionRow}>
                          {isOpen ? (
                            <button type="button" className={`${assetStyles.secondaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral} ${leadStyles.closeLeadButton}`} onClick={() => setOpenAccessId(null)}>Close</button>
                          ) : (
                            <button type="button" className={`${assetStyles.primaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${leadStyles.openLeadButton}`} onClick={() => setOpenAccessId(asset.accessId)}>Open</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className={`${assetStyles.assetCard} ${leadStyles.leadAssetCard} ${assetStyles.assetCardExpanded}`}>
                      <div className={`${assetStyles.assetHeader} ${leadStyles.leadAssetHeader}`}>
                        <div className={assetStyles.assetTitleBlock}>
                          <h2>{asset.assetTitle}</h2>
                          <p>{[asset.brandName, asset.modelName, asset.yearModel].filter(Boolean).join(' · ') || asset.assetKind}</p>
                          <div className={assetStyles.assetMetaRow}><span className={assetStyles.assetSavedDateLabel}>Tracking shared by {asset.grantedByName || 'the asset owner'}</span></div>
                        </div>
                        <div className={`${assetStyles.assetHeaderAside} ${leadStyles.leadAssetHeaderAside}`}>
                          <span className={`${styles.statusBadge} ${statusClass(asset.status)}`}>{asset.statusLabel}</span>
                        </div>
                      </div>

                      <div className={styles.expandedBody}>
                        <section className={styles.assetOverview}>
                          <div className={styles.photoPanel}>
                            {asset.photoUrls.length ? asset.photoUrls.map((url, index) => <img key={`${url}-${index}`} src={url} alt={`${asset.assetTitle} photo ${index + 1}`} />) : <div className={styles.photoFallback}>{asset.assetTitle.charAt(0).toUpperCase()}</div>}
                          </div>
                          <div className={styles.overviewContent}>
                            <div className={styles.statGrid}>
                              <div><span>Current usage</span><strong>{formatUsage(asset.currentUsage, asset.usageMetric)}</strong></div>
                              <div><span>Next maintenance</span><strong>{asset.nextMaintenance?.title || 'No open maintenance'}</strong></div>
                              <div><span>Due</span><strong>{asset.nextMaintenance ? dueLabel(asset.nextMaintenance, asset.usageMetric) : 'Not scheduled'}</strong></div>
                              <div><span>Remaining</span><strong>{asset.nextMaintenance ? remainingLabel(asset.nextMaintenance, asset.usageMetric) : 'No open schedule'}</strong></div>
                              <div><span>Serial number</span><strong>{asset.serialNumber || 'Not saved'}</strong></div>
                              <div><span>Replacement price</span><strong>{formatCurrency(asset.replacementPriceExVat)} excl. VAT</strong></div>
                            </div>

                            <div className={styles.actionRow}>
                              {asset.permissions.canViewMaintenanceReports ? (
                                <button type="button" className={styles.reportButton} onClick={() => openReports(asset)}><DownloadIcon /><span><strong>Maintenance reports</strong><small>Owner-style PDF or XLSX report.</small></span></button>
                              ) : null}
                            </div>
                          </div>
                        </section>

                        {correctionVisible ? (
                          <section className={styles.section}>
                            <header><div><span>Owner-approved updates</span><h3>Asset corrections</h3></div></header>
                            <div className={styles.correctionGrid}>
                              <DealerAssetCorrectionEditor
                                assetTitle={asset.assetTitle}
                                sourceType="maintenance"
                                sourceId={asset.accessId}
                                serialNumber={asset.serialNumber}
                                replacementPriceExVat={asset.replacementPriceExVat}
                                correction={asset.dealerCorrection}
                                canUpdateSerial={asset.permissions.canUpdateSerial}
                                canUpdateReplacementPrice={asset.permissions.canUpdateReplacementPrice}
                                onSaved={(correction) => syncCorrection(asset.assetId, correction)}
                              />
                            </div>
                          </section>
                        ) : null}

                        {asset.permissions.canViewLoggedProblems ? (
                          <section className={styles.section}>
                            <header><div><span>Needs attention</span><h3>Logged problems</h3></div><strong>{asset.loggedProblems.length}</strong></header>
                            {asset.loggedProblems.length ? (
                              <div className={styles.problemList}>
                                {asset.loggedProblems.map((problem) => (
                                  <article key={problem.id}>
                                    <span>Logged problem</span>
                                    <p>{problem.note}</p>
                                    <small>{problem.operatorName ? `Logged by ${problem.operatorName} · ` : ''}{formatDate(problem.createdAtIso, true)}</small>
                                  </article>
                                ))}
                              </div>
                            ) : <div className={styles.sectionEmpty}>No logged problems for this asset.</div>}
                          </section>
                        ) : null}

                        <section className={styles.section}>
                          <header><div><span>Maintenance schedule</span><h3>Open maintenance</h3></div><strong>{asset.openMaintenanceRecords.length}</strong></header>
                          {asset.openMaintenanceRecords.length ? <div className={styles.recordList}>{asset.openMaintenanceRecords.map((record) => <RecordCard key={record.id} record={record} asset={asset} />)}</div> : <div className={styles.sectionEmpty}>No open maintenance. This asset remains tracked and its completed history is still available.</div>}
                        </section>

                        <section className={styles.section}>
                          <header><div><span>Maintenance history</span><h3>Completed maintenance</h3></div><strong>{asset.completedMaintenanceRecords.length}</strong></header>
                          {asset.completedMaintenanceRecords.length ? <div className={styles.recordList}>{asset.completedMaintenanceRecords.map((record) => <RecordCard key={record.id} record={record} asset={asset} />)}</div> : <div className={styles.sectionEmpty}>No completed maintenance has been saved yet.</div>}
                        </section>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </section>

      {filterOpen ? (
        <div className={assetStyles.modalOverlay}>
          <div className={assetStyles.modalBackdrop} onClick={() => setFilterOpen(false)} />
          <div className={`${assetStyles.modalCard} ${workspaceStyles.modal} ${leadStyles.leadFilterModal}`} role="dialog" aria-modal="true" aria-labelledby="tracker-filter-title">
            <div className={assetStyles.modalHeader}>
              <div><h3 id="tracker-filter-title">Filter tracked equipment</h3><p className={leadStyles.leadFilterIntro}>Filter by asset owner and current maintenance position.</p></div>
              <button type="button" className={`${assetStyles.modalCloseButton} ${workspaceStyles.modalClose}`} onClick={() => setFilterOpen(false)} aria-label="Close filters"><CloseIcon className={assetStyles.buttonIcon} /></button>
            </div>
            <div className={`${workspaceStyles.modalBody} ${leadStyles.leadFilterForm}`}>
              <Dropdown label="Asset owner" value={draftOwnerFilter} options={ownerOptions} dropdownKey="owner" openDropdown={openFilterDropdown} onOpenChange={(key) => setOpenFilterDropdown(key as FilterDropdownKey | null)} onChange={setDraftOwnerFilter} />
              <Dropdown label="Maintenance status" value={draftStatusFilter} options={statusOptions} dropdownKey="status" openDropdown={openFilterDropdown} onOpenChange={(key) => setOpenFilterDropdown(key as FilterDropdownKey | null)} onChange={(value) => setDraftStatusFilter(value as TrackerStatusFilter)} />
            </div>
            <div className={`${assetStyles.formActions} ${workspaceStyles.modalFooter} ${leadStyles.leadFilterActions}`}>
              <button type="button" className={assetStyles.secondaryButton} onClick={clearFilters}>Clear filters</button>
              <button type="button" className={assetStyles.primaryButton} onClick={() => { setOwnerFilter(draftOwnerFilter); setStatusFilter(draftStatusFilter); setFilterOpen(false); }}>Apply filters</button>
            </div>
          </div>
        </div>
      ) : null}

      {reportAccessId ? (
        <DealerMaintenanceReportModal
          accessId={reportAccessId}
          onClose={() => setReportAccessId(null)}
          onError={(message) => setNotice({ tone: 'error', text: message })}
        />
      ) : null}
    </main>
  );
}
