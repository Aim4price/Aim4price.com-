'use client';

import DropdownOverlay from './DropdownOverlay';
import { useEffect, useMemo, useState } from 'react';
import type { DealerMaintenanceTrackedAsset } from '../lib/dealer-maintenance-tracker';
import { openCanonicalReportUrl } from '../lib/report-open';
import assetStyles from '../app/asset-register/page.module.css';
import trackerStyles from './DealerMaintenanceTrackerClient.module.css';

type DownloadFormat = 'pdf' | 'xlsx';
type ReportRouteFormat = DownloadFormat | 'html';
type ReportStep = 'format' | 'timeline';
type ReportSelectKey = 'type' | 'year' | 'month';
type ReportOption = { value: string; label: string };

type Props = {
  accessId: string;
  pdfOnly?: boolean;
  onBack?: () => void;
  onClose: () => void;
  onError?: (message: string) => void;
};

type TrackerResponse = {
  ok?: boolean;
  assets?: DealerMaintenanceTrackedAsset[];
  error?: string;
};

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const TYPE_OPTIONS: ReportOption[] = [
  { value: 'all', label: 'All' },
  { value: 'checked', label: 'Checked' },
  { value: 'serviced', label: 'Service' },
  { value: 'repaired', label: 'Repair' },
];

const MONTH_OPTIONS: ReportOption[] = [
  { value: 'all', label: 'All months' },
  ...MONTH_LABELS.map((label, index) => ({
    value: String(index + 1).padStart(2, '0'),
    label,
  })),
];

function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 9.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.5 6.5 11 11m0-11-11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PdfIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l4 4v14H7zM14 3v5h5M9.5 15.5h5M9.5 12h5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpreadsheetIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="2" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M4 9h16M10 9v11.5M15 9v11.5M4 15h16" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function parseDownloadFileName(response: Response, fallback: string): string {
  const disposition = response.headers.get('content-disposition') || '';
  const quotedMatch = /filename="([^"]+)"/i.exec(disposition);
  return (quotedMatch?.[1] || fallback).replace(/[\\/:*?"<>|]+/g, '-');
}

function extractYear(value?: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  const year = parsed.getFullYear();
  return Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : null;
}

function reportYearOptions(asset: DealerMaintenanceTrackedAsset | null): ReportOption[] {
  const currentYear = new Date().getFullYear();
  const candidateYears = [
    currentYear,
    extractYear(asset?.createdAtIso),
    extractYear(asset?.updatedAtIso),
    extractYear(asset?.usageUpdatedAtIso),
    ...(asset?.maintenanceRecords.flatMap((record) => [
      extractYear(record.createdAtIso),
      extractYear(record.updatedAtIso),
      extractYear(record.completedAtIso),
    ]) ?? []),
    ...(asset?.loggedProblems.flatMap((problem) => [
      extractYear(problem.createdAtIso),
      extractYear(problem.notedAtIso),
    ]) ?? []),
  ].filter((year): year is number => typeof year === 'number' && Number.isFinite(year));

  const minYear = Math.min(...candidateYears, currentYear);
  const maxYear = Math.max(...candidateYears, currentYear);
  const options: ReportOption[] = [{ value: 'all', label: 'All years' }];

  for (let year = maxYear; year >= minYear; year -= 1) {
    options.push({ value: String(year), label: String(year) });
  }

  return options;
}

function ReportSelect({
  label,
  value,
  options,
  selectKey,
  openSelect,
  disabled = false,
  onOpenChange,
  onChange,
}: {
  label: string;
  value: string;
  options: ReportOption[];
  selectKey: ReportSelectKey;
  openSelect: ReportSelectKey | null;
  disabled?: boolean;
  onOpenChange: (key: ReportSelectKey | null) => void;
  onChange: (value: string) => void;
}) {
  const isOpen = openSelect === selectKey;
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className={`${assetStyles.reportSelectField} ${isOpen ? assetStyles.reportSelectFieldOpen : ''} ${disabled ? assetStyles.reportSelectFieldDisabled : ''}`}>
      <span className={assetStyles.reportSelectLabel}>{label}</span>
      <button
        type="button"
        className={assetStyles.reportSelectButton}
        onClick={() => onOpenChange(isOpen ? null : selectKey)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selectedOption?.label ?? 'Select option'}</span>
        <ChevronDownIcon className={assetStyles.reportSelectChevron} />
      </button>

      {isOpen && !disabled ? (
        <DropdownOverlay className={assetStyles.reportSelectMenu} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${assetStyles.reportSelectOption} ${option.value === value ? assetStyles.reportSelectOptionActive : ''}`}
              onClick={() => {
                onChange(option.value);
                onOpenChange(null);
              }}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </button>
          ))}
        </DropdownOverlay>
      ) : null}
    </div>
  );
}

export default function DealerMaintenanceReportModal({
  accessId,
  pdfOnly = false,
  onBack,
  onClose,
  onError,
}: Props) {
  const [asset, setAsset] = useState<DealerMaintenanceTrackedAsset | null>(null);
  const [step, setStep] = useState<ReportStep>(pdfOnly ? 'timeline' : 'format');
  const [format, setFormat] = useState<DownloadFormat>('pdf');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<DownloadFormat | null>(null);
  const [error, setError] = useState('');
  const [reportType, setReportType] = useState('all');
  const [reportYear, setReportYear] = useState('all');
  const [reportMonth, setReportMonth] = useState('all');
  const [openSelect, setOpenSelect] = useState<ReportSelectKey | null>(null);

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
          throw new Error(payload?.error || 'Failed to confirm this tracked asset.');
        }
        const selectedAsset = payload.assets.find((entry) => entry.accessId === accessId);
        if (!selectedAsset || !selectedAsset.permissions.canViewMaintenanceReports) {
          throw new Error('Maintenance report access is no longer active for this asset.');
        }
        setAsset(selectedAsset);
      } catch (cause) {
        if (controller.signal.aborted) return;
        const message = cause instanceof Error ? cause.message : 'Failed to confirm this tracked asset.';
        setAsset(null);
        setError(message);
        onError?.(message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadLiveAccess();
    return () => controller.abort();
  }, [accessId]);

  const yearOptions = useMemo(() => reportYearOptions(asset), [asset]);
  const assetMeta = asset
    ? [asset.brandName, asset.modelName, asset.yearModel].filter(Boolean).join(' · ') || asset.assetKind
    : 'Checking current maintenance tracking access';

  function buildReportUrl(format: ReportRouteFormat): string {
    if (!asset) return '';
    const params = new URLSearchParams({
      assetId: asset.assetId,
      accessId: asset.accessId,
      report: 'maintenance',
      maintenanceType: reportType,
    });
    if (format !== 'pdf') params.set('format', format);
    if (reportYear !== 'all') {
      params.set('year', reportYear);
      if (reportMonth !== 'all') params.set('month', reportMonth);
    }
    return `/api/asset-register/scan-report?${params.toString()}`;
  }

  async function downloadReport() {
    if (!asset || downloading) return;

    if (format === 'pdf') {
      const opened = openCanonicalReportUrl(buildReportUrl('html'));
      if (!opened) {
        const message = 'Enable pop-ups to open the maintenance report.';
        setError(message);
        onError?.(message);
      }
      return;
    }

    setDownloading(format);
    setError('');
    try {
      const response = await fetch(buildReportUrl(format), {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(
          response.status === 403
            ? 'Maintenance report access is no longer active for this asset.'
            : payload?.error || 'The maintenance report could not be generated.',
        );
      }

      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = parseDownloadFileName(response, `${asset.assetTitle}-maintenance-report.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The maintenance report could not be generated.';
      setError(message);
      onError?.(message);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className={`${assetStyles.modalOverlay} ${assetStyles.subModalOverlay}`}>
      <div className={assetStyles.modalBackdrop} onClick={onClose} />
      <div
        className={`${assetStyles.modalCard} ${assetStyles.assetReportModal} ${assetStyles.assetFuelReportModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dealer-maintenance-report-title"
      >
        <div className={`${assetStyles.modalHeader} ${assetStyles.assetReportModalHeader}`}>
          <div className={assetStyles.modalHeaderText}>
            <h3 id="dealer-maintenance-report-title">{asset?.assetTitle || 'Maintenance report'}</h3>
            <p>{assetMeta}</p>
          </div>
          <button type="button" className={assetStyles.modalCloseButton} onClick={onClose} aria-label="Close maintenance report">
            <CloseIcon className={assetStyles.buttonIcon} />
          </button>
        </div>

        <div className={`${assetStyles.modalScrollBody} ${assetStyles.assetReportModalBody}`}>
          {error ? <div className={trackerStyles.reportError} role="alert">{error}</div> : null}
          {loading ? (
            <div className={assetStyles.emptyState}>Checking current maintenance report access…</div>
          ) : asset ? (
            !pdfOnly && step === 'format' ? (
              <>
                <div className={assetStyles.assetTimelineStageHeading}>
                  <strong>Choose export format</strong>
                  <span>Select PDF or Excel, then continue to the report timeline.</span>
                </div>

                <div className={assetStyles.assetTimelineFormatGrid} aria-label="Report format">
                  <button
                    type="button"
                    className={`${assetStyles.assetTimelineFormatOption} ${format === 'pdf' ? assetStyles.assetTimelineFormatOptionActive : ''}`}
                    onClick={() => setFormat('pdf')}
                    aria-pressed={format === 'pdf'}
                  >
                    <span className={assetStyles.assetTimelineFormatGraphic}>
                      <img src="/brand/pdf.png" alt="" className={assetStyles.exportGraphicImage} />
                    </span>
                    <span className={assetStyles.assetTimelineFormatCopy}>
                      <strong>PDF report</strong>
                      <small>Open a clear report for clients, banks or insurance partners.</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`${assetStyles.assetTimelineFormatOption} ${format === 'xlsx' ? assetStyles.assetTimelineFormatOptionActive : ''}`}
                    onClick={() => setFormat('xlsx')}
                    aria-pressed={format === 'xlsx'}
                  >
                    <span className={assetStyles.assetTimelineFormatGraphic}>
                      <img src="/brand/sheet.png" alt="" className={assetStyles.exportGraphicImage} />
                    </span>
                    <span className={assetStyles.assetTimelineFormatCopy}>
                      <strong>XLSX workbook</strong>
                      <small>Download the selected timeline records in an Excel-ready workbook.</small>
                    </span>
                  </button>
                </div>

                <div className={`${assetStyles.formActions} ${assetStyles.exportActions} ${assetStyles.assetFuelReportActions}`}>
                  <button type="button" className={`${assetStyles.secondaryButton} ${assetStyles.assetTimelineSecondaryButton}`} onClick={onBack ?? onClose}>
                    Back
                  </button>
                  <button type="button" className={`${assetStyles.secondaryButton} ${assetStyles.assetTimelineSecondaryButton}`} onClick={onClose}>
                    Cancel
                  </button>
                  <button type="button" className={assetStyles.primaryButton} onClick={() => setStep('timeline')}>
                    Next
                  </button>
                </div>
              </>
            ) : (
            <>
              <div className={assetStyles.assetTimelineStageHeading}>
                <strong>Report timeline</strong>
                <span>Choose the maintenance type, year and month to include.</span>
              </div>

              <div className={`${assetStyles.assetFuelReportFilterBox} ${assetStyles.assetMaintenanceReportFilterBox}`}>
                <ReportSelect
                  label="Type"
                  value={reportType}
                  options={TYPE_OPTIONS}
                  selectKey="type"
                  openSelect={openSelect}
                  onOpenChange={setOpenSelect}
                  onChange={setReportType}
                />
                <ReportSelect
                  label="Year"
                  value={reportYear}
                  options={yearOptions}
                  selectKey="year"
                  openSelect={openSelect}
                  onOpenChange={setOpenSelect}
                  onChange={(value) => {
                    setReportYear(value);
                    setReportMonth('all');
                  }}
                />
                <ReportSelect
                  label="Month"
                  value={reportMonth}
                  options={MONTH_OPTIONS}
                  selectKey="month"
                  openSelect={openSelect}
                  disabled={reportYear === 'all'}
                  onOpenChange={setOpenSelect}
                  onChange={setReportMonth}
                />
              </div>

              <div className={`${assetStyles.formActions} ${assetStyles.exportActions} ${assetStyles.assetFuelReportActions}`}>
                <button
                  type="button"
                  className={`${assetStyles.secondaryButton} ${assetStyles.assetTimelineSecondaryButton}`}
                  onClick={() => {
                    setOpenSelect(null);
                    if (pdfOnly) {
                      (onBack ?? onClose)();
                      return;
                    }
                    setStep('format');
                  }}
                  disabled={Boolean(downloading)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={`${assetStyles.secondaryButton} ${assetStyles.assetTimelineSecondaryButton}`}
                  onClick={onClose}
                  disabled={Boolean(downloading)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={assetStyles.primaryButton}
                  onClick={() => void downloadReport()}
                  disabled={Boolean(downloading)}
                >
                  {format === 'pdf'
                    ? <PdfIcon className={assetStyles.buttonIcon} />
                    : <SpreadsheetIcon className={assetStyles.buttonIcon} />}
                  <span>{downloading
                    ? format === 'pdf' ? 'Preparing PDF…' : 'Preparing Excel…'
                    : format === 'pdf' ? 'Open PDF report' : 'Download Excel'}</span>
                </button>
              </div>
            </>
            )
          ) : (
            <div className={`${assetStyles.formActions} ${assetStyles.exportActions} ${assetStyles.assetFuelReportActions}`}>
              <button type="button" className={assetStyles.secondaryButton} onClick={onClose}>Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
