'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DealerMaintenanceTrackedAsset } from '../lib/dealer-maintenance-tracker';
import assetStyles from '../app/asset-register/page.module.css';
import leadStyles from '../app/leads/page.module.css';
import maintenanceStyles from '../app/maintenance/page.module.css';
import trackerStyles from './DealerMaintenanceTrackerClient.module.css';

type ReportDropdownKey = 'asset' | 'type' | 'status' | 'assignedTo';
type DownloadScope = 'total' | 'asset' | 'upcoming' | 'done';
type DownloadFormat = 'pdf' | 'xlsx';
type DownloadStep = 'scope' | 'asset' | 'format';
type Option = { value: string; label: string };

type Props = {
  accessId: string;
  onClose: () => void;
  onError?: (message: string) => void;
};

type TrackerResponse = {
  ok?: boolean;
  assets?: DealerMaintenanceTrackedAsset[];
  error?: string;
};

const reportScopeOptions: Array<{ value: DownloadScope; title: string; description: string }> = [
  { value: 'total', title: 'Total maintenance report', description: 'All authorised maintenance records for this owner matching the selected filters.' },
  { value: 'asset', title: 'Specific asset maintenance report', description: 'The full maintenance timeline for one authorised tracked asset.' },
  { value: 'upcoming', title: 'Upcoming maintenance report', description: 'Open maintenance records, including due soon and overdue work.' },
  { value: 'done', title: 'Completed / Done maintenance report', description: 'Completed services and checkups for authorised assets.' },
];

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m16 16 4.4 4.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function ChevronDownIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 6.5 11 11m0-11-11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function DownloadIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Not saved';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value);
}

function filenameFromResponse(response: Response, fallback: string): string {
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/i);
  return (match?.[1] ?? fallback).replace(/[\\/:*?"<>|]+/g, '-');
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
  dropdownKey: ReportDropdownKey;
  openDropdown: ReportDropdownKey | null;
  onOpenChange: (key: ReportDropdownKey | null) => void;
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

export default function DealerMaintenanceReportModal({ accessId, onClose, onError }: Props) {
  const [assets, setAssets] = useState<DealerMaintenanceTrackedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [downloadStep, setDownloadStep] = useState<DownloadStep>('scope');
  const [downloadScope, setDownloadScope] = useState<DownloadScope>('total');
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>('pdf');
  const [downloadAssetId, setDownloadAssetId] = useState('all');
  const [downloadAssetSearch, setDownloadAssetSearch] = useState('');
  const [reportType, setReportType] = useState('all');
  const [reportStatus, setReportStatus] = useState('all');
  const [reportAssignedTo, setReportAssignedTo] = useState('all');
  const [openReportDropdown, setOpenReportDropdown] = useState<ReportDropdownKey | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadLiveAccess() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/dealer/maintenance', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as TrackerResponse | null;
        if (!response.ok || !payload?.ok || !Array.isArray(payload.assets)) {
          throw new Error(payload?.error || 'Failed to load authorised maintenance reports.');
        }
        const anchor = payload.assets.find((asset) => asset.accessId === accessId);
        if (!anchor?.permissions.canViewMaintenanceReports) {
          throw new Error('Maintenance Reports permission is no longer active for this tracked asset.');
        }
        setAssets(payload.assets);
      } catch (cause) {
        if (controller.signal.aborted) return;
        const message = cause instanceof Error ? cause.message : 'Failed to load authorised maintenance reports.';
        setError(message);
        onError?.(message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadLiveAccess();
    return () => controller.abort();
  }, [accessId]);

  const anchorAsset = assets.find((asset) => asset.accessId === accessId) ?? null;
  const reportAssets = useMemo(
    () => anchorAsset
      ? assets.filter((asset) =>
          asset.ownerUserId === anchorAsset.ownerUserId
          && asset.permissions.canViewMaintenanceReports)
      : [],
    [anchorAsset, assets],
  );
  const filteredReportAssets = useMemo(() => {
    const query = downloadAssetSearch.trim().toLowerCase();
    return reportAssets.filter((asset) =>
      !query || `${asset.assetTitle} ${asset.brandName} ${asset.modelName}`.toLowerCase().includes(query));
  }, [downloadAssetSearch, reportAssets]);
  const reportAssigneeOptions = useMemo<Option[]>(() => {
    const map = new Map<string, string>();
    reportAssets.flatMap((asset) => asset.maintenanceRecords).forEach((record) => {
      if (record.assignedFieldManagerId) {
        map.set(record.assignedFieldManagerId, record.assignedName || 'Field Manager');
      }
    });
    return [
      { value: 'all', label: 'All assignees' },
      { value: 'unassigned', label: 'Unassigned' },
      ...Array.from(map.entries())
        .sort((left, right) => left[1].localeCompare(right[1]))
        .map(([value, label]) => ({ value, label })),
    ];
  }, [reportAssets]);
  const reportAssetOptions = useMemo<Option[]>(() => [
    { value: 'all', label: 'All authorised assets' },
    ...reportAssets.map((asset) => ({ value: asset.assetId, label: asset.assetTitle })),
  ], [reportAssets]);

  function buildReportUrl(): string {
    const params = new URLSearchParams({
      accessId,
      scope: downloadScope,
      format: downloadFormat,
    });
    if (downloadAssetId !== 'all') params.set('assetId', downloadAssetId);
    if (reportType !== 'all') params.set('type', reportType);
    if (reportAssignedTo !== 'all') params.set('assignedTo', reportAssignedTo);
    if (downloadScope !== 'upcoming' && downloadScope !== 'done' && reportStatus !== 'all') {
      params.set('status', reportStatus);
    }
    return `/api/dealer/maintenance/report?${params.toString()}`;
  }

  async function submitReport() {
    if (submitting) return;
    if (downloadScope === 'asset' && downloadAssetId === 'all') {
      setError('Choose an authorised asset for the specific asset report.');
      return;
    }

    const popup = downloadFormat === 'pdf' ? window.open('', '_blank') : null;
    if (downloadFormat === 'pdf' && !popup) {
      setError('Enable pop-ups to open the maintenance report.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(buildReportUrl(), {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        const message = response.status === 403
          ? 'Maintenance Reports permission is no longer active for one or more selected assets.'
          : payload?.error || 'The maintenance report could not be generated.';
        popup?.close();
        throw new Error(message);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (downloadFormat === 'pdf') {
        popup!.location.replace(blobUrl);
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filenameFromResponse(response, 'asset-maintenance-report.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The maintenance report could not be generated.';
      setError(message);
      onError?.(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={maintenanceStyles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="dealer-maintenance-download-title">
      <section className={`${maintenanceStyles.downloadModal} ${maintenanceStyles.maintenanceExportModal}`}>
        <header className={maintenanceStyles.modalHeader}>
          <div>
            <h2 id="dealer-maintenance-download-title">
              {downloadStep === 'scope'
                ? 'Download maintenance reports'
                : downloadStep === 'asset'
                  ? 'Choose asset for maintenance report'
                  : 'Choose download format'}
            </h2>
            <div className={maintenanceStyles.maintenanceExportHeadingRow}>
              <p>
                {downloadStep === 'scope'
                  ? 'Choose filters and which authorised maintenance records should be included.'
                  : downloadStep === 'asset'
                    ? 'Select an asset shared by this owner with Maintenance Reports permission.'
                    : 'Choose the owner-style PDF report or XLSX workbook.'}
              </p>
            </div>
          </div>
          <button className={maintenanceStyles.closeButton} type="button" onClick={onClose} aria-label="Close reports"><CloseIcon /></button>
        </header>
        <div className={maintenanceStyles.modalDivider} />

        {error ? <div className={trackerStyles.reportError} role="alert">{error}</div> : null}
        {loading ? (
          <div className={`${maintenanceStyles.formModalScrollBody} ${maintenanceStyles.maintenanceExportBody}`}>
            <div className={assetStyles.emptyState}>Checking current Maintenance Reports permission...</div>
          </div>
        ) : !anchorAsset ? (
          <footer className={`${maintenanceStyles.modalFooter} ${maintenanceStyles.maintenanceExportFooter}`}>
            <button className={maintenanceStyles.secondaryButton} type="button" onClick={onClose}>Close</button>
          </footer>
        ) : downloadStep === 'scope' ? (
          <>
            <div className={`${maintenanceStyles.formModalScrollBody} ${maintenanceStyles.maintenanceExportBody}`}>
              <div className={trackerStyles.reportFilters}>
                <Dropdown label="Asset" value={downloadAssetId} options={reportAssetOptions} dropdownKey="asset" openDropdown={openReportDropdown} onOpenChange={setOpenReportDropdown} onChange={setDownloadAssetId} />
                <Dropdown label="Maintenance type" value={reportType} options={[{ value: 'all', label: 'All types' }, { value: 'service', label: 'Service' }, { value: 'checkup', label: 'Checkup' }]} dropdownKey="type" openDropdown={openReportDropdown} onOpenChange={setOpenReportDropdown} onChange={setReportType} />
                <Dropdown label="Status" value={reportStatus} options={[{ value: 'all', label: 'All statuses' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'done', label: 'Done' }]} dropdownKey="status" openDropdown={openReportDropdown} onOpenChange={setOpenReportDropdown} onChange={setReportStatus} />
                <Dropdown label="Assigned to" value={reportAssignedTo} options={reportAssigneeOptions} dropdownKey="assignedTo" openDropdown={openReportDropdown} onOpenChange={setOpenReportDropdown} onChange={setReportAssignedTo} />
              </div>
              <div className={maintenanceStyles.maintenanceScopeList}>
                {reportScopeOptions.map((option) => (
                  <button key={option.value} type="button" className={`${maintenanceStyles.maintenanceScopeOption} ${downloadScope === option.value ? maintenanceStyles.maintenanceScopeOptionActive : ''}`} onClick={() => setDownloadScope(option.value)}>
                    <span className={maintenanceStyles.maintenanceScopeIcon} aria-hidden="true"><DownloadIcon /></span>
                    <span className={maintenanceStyles.maintenanceScopeCopy}><strong>{option.title}</strong><small>{option.description}</small></span>
                    <span className={maintenanceStyles.maintenanceSelectionMark} aria-hidden="true">✓</span>
                  </button>
                ))}
              </div>
            </div>
            <footer className={`${maintenanceStyles.modalFooter} ${maintenanceStyles.maintenanceExportFooter}`}>
              <button className={maintenanceStyles.secondaryButton} type="button" onClick={onClose}>Cancel</button>
              <button className={maintenanceStyles.primaryButton} type="button" onClick={() => setDownloadStep(downloadScope === 'asset' ? 'asset' : 'format')}>Next</button>
            </footer>
          </>
        ) : downloadStep === 'asset' ? (
          <>
            <div className={`${maintenanceStyles.formModalScrollBody} ${maintenanceStyles.maintenanceExportBody}`}>
              <div className={maintenanceStyles.pickerToolbar}>
                <label className={maintenanceStyles.pickerSearchField}><SearchIcon /><input type="search" value={downloadAssetSearch} onChange={(event) => setDownloadAssetSearch(event.target.value)} placeholder="Search authorised assets..." /></label>
                <button className={`${maintenanceStyles.secondaryButton} ${maintenanceStyles.pickerClearButton}`} type="button" onClick={() => setDownloadAssetSearch('')} disabled={!downloadAssetSearch}>Clear</button>
              </div>
              <div className={maintenanceStyles.assetList}>
                {filteredReportAssets.map((asset) => (
                  <button key={asset.assetId} className={`${maintenanceStyles.assetRow} ${downloadAssetId === asset.assetId ? maintenanceStyles.maintenanceScopeOptionActive : ''}`} type="button" onClick={() => { setDownloadAssetId(asset.assetId); setDownloadStep('format'); }}>
                    <span className={maintenanceStyles.assetInfo}><strong>{asset.assetTitle}</strong><small>{[asset.brandName, asset.modelName, asset.yearModel].filter(Boolean).join(' · ') || asset.assetKind}</small></span>
                    <span className={maintenanceStyles.assetValue}><strong>{formatCurrency(asset.replacementPriceExVat)}</strong><small>replacement price</small></span>
                  </button>
                ))}
              </div>
            </div>
            <footer className={`${maintenanceStyles.modalFooter} ${maintenanceStyles.maintenanceExportFooter}`}>
              <button className={maintenanceStyles.secondaryButton} type="button" onClick={() => setDownloadStep('scope')}>Back</button>
              <button className={maintenanceStyles.secondaryButton} type="button" onClick={onClose}>Cancel</button>
            </footer>
          </>
        ) : (
          <>
            <div className={`${maintenanceStyles.formModalScrollBody} ${maintenanceStyles.maintenanceExportBody}`}>
              <div className={maintenanceStyles.maintenanceFormatGrid}>
                {([{ value: 'pdf', title: 'PDF report', description: 'Clean print-ready report using the owner maintenance report design.' }, { value: 'xlsx', title: 'XLSX workbook', description: 'Excel-ready authorised maintenance data.' }] as const).map((option) => (
                  <button key={option.value} type="button" className={`${maintenanceStyles.maintenanceFormatOption} ${downloadFormat === option.value ? maintenanceStyles.maintenanceFormatOptionActive : ''}`} onClick={() => setDownloadFormat(option.value)}>
                    <span className={maintenanceStyles.maintenanceFormatGraphic}><img src={option.value === 'pdf' ? '/brand/pdf.png' : '/brand/sheet.png'} alt="" /></span>
                    <span className={maintenanceStyles.maintenanceFormatCopy}><strong>{option.title}</strong><small>{option.description}</small></span>
                    <span className={maintenanceStyles.maintenanceSelectionMark} aria-hidden="true">✓</span>
                  </button>
                ))}
              </div>
            </div>
            <footer className={`${maintenanceStyles.modalFooter} ${maintenanceStyles.maintenanceExportFooter}`}>
              <button className={maintenanceStyles.secondaryButton} type="button" onClick={() => setDownloadStep(downloadScope === 'asset' ? 'asset' : 'scope')} disabled={submitting}>Back</button>
              <button className={maintenanceStyles.secondaryButton} type="button" onClick={onClose} disabled={submitting}>Cancel</button>
              <button className={maintenanceStyles.primaryButton} type="button" onClick={() => void submitReport()} disabled={submitting}>{submitting ? 'Preparing...' : downloadFormat === 'pdf' ? 'Open PDF report' : 'Download Excel'}</button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
