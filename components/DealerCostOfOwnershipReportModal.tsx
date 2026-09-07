'use client';

import DropdownOverlay from './DropdownOverlay';
import { useMemo, useState } from 'react';
import assetStyles from '../app/asset-register/page.module.css';
import { openCanonicalReportUrl } from '../lib/report-open';
import trackerStyles from './DealerMaintenanceTrackerClient.module.css';

type DownloadFormat = 'pdf' | 'xlsx';
type ReportRouteFormat = DownloadFormat | 'html';
type ReportStep = 'format' | 'timeline';
type ReportSelectKey = 'year' | 'month';
type ReportOption = { value: string; label: string };

type Props = {
  accessId: string;
  assetTitle: string;
  assetMeta: string;
  createdAtIso?: string | null;
  updatedAtIso?: string | null;
  pdfOnly?: boolean;
  onBack?: () => void;
  onClose: () => void;
  onError?: (message: string) => void;
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

const MONTH_OPTIONS: ReportOption[] = [
  { value: 'all', label: 'All months' },
  ...MONTH_LABELS.map((label, index) => ({
    value: String(index + 1).padStart(2, '0'),
    label,
  })),
];

function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.5 6.5 11 11m0-11-11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 9.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function reportYearOptions(createdAtIso?: string | null, updatedAtIso?: string | null): ReportOption[] {
  const currentYear = new Date().getFullYear();
  const candidateYears = [
    currentYear,
    extractYear(createdAtIso),
    extractYear(updatedAtIso),
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

export default function DealerCostOfOwnershipReportModal({
  accessId,
  assetTitle,
  assetMeta,
  createdAtIso,
  updatedAtIso,
  pdfOnly = false,
  onBack,
  onClose,
  onError,
}: Props) {
  const [step, setStep] = useState<ReportStep>(pdfOnly ? 'timeline' : 'format');
  const [format, setFormat] = useState<DownloadFormat>('pdf');
  const [reportYear, setReportYear] = useState('all');
  const [reportMonth, setReportMonth] = useState('all');
  const [openSelect, setOpenSelect] = useState<ReportSelectKey | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const yearOptions = useMemo(
    () => reportYearOptions(createdAtIso, updatedAtIso),
    [createdAtIso, updatedAtIso],
  );

  function buildReportUrl(routeFormat: ReportRouteFormat = format): string {
    const params = new URLSearchParams({
      accessId,
      format: routeFormat,
    });
    if (reportYear !== 'all') {
      params.set('year', reportYear);
      if (reportMonth !== 'all') params.set('month', reportMonth);
    }
    return `/api/my-invoices/report?${params.toString()}`;
  }

  async function downloadReport() {
    if (downloading) return;

    if (format === 'pdf') {
      const opened = openCanonicalReportUrl(buildReportUrl('html'));
      if (!opened) {
        const message = 'Enable pop-ups to open the Cost of Ownership report.';
        setError(message);
        onError?.(message);
        return;
      }
      onClose();
      return;
    }

    setDownloading(true);
    setError('');
    try {
      const response = await fetch(buildReportUrl(), {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(
          response.status === 403
            ? 'Cost of Ownership access is no longer active for this asset.'
            : payload?.error || 'The Cost of Ownership report could not be generated.',
        );
      }

      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = parseDownloadFileName(response, `${assetTitle}-cost-of-ownership.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      onClose();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The Cost of Ownership report could not be generated.';
      setError(message);
      onError?.(message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={`${assetStyles.modalOverlay} ${assetStyles.subModalOverlay}`} data-website-overlay>
      <div className={assetStyles.modalBackdrop} data-website-overlay onClick={onClose} />
      <div
        className={`${assetStyles.modalCard} ${assetStyles.assetReportModal} ${assetStyles.assetFuelReportModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dealer-cost-of-ownership-report-title"
      >
        <div className={`${assetStyles.modalHeader} ${assetStyles.assetReportModalHeader}`}>
          <div className={assetStyles.modalHeaderText}>
            <h3 id="dealer-cost-of-ownership-report-title">{assetTitle}</h3>
            <p>{assetMeta}</p>
          </div>
          <button type="button" className={assetStyles.modalCloseButton} onClick={onClose} aria-label="Close Cost of Ownership report">
            <CloseIcon className={assetStyles.buttonIcon} />
          </button>
        </div>

        <div className={`${assetStyles.modalScrollBody} ${assetStyles.assetReportModalBody}`}>
          {error ? <div className={trackerStyles.reportError} role="alert">{error}</div> : null}

          {!pdfOnly && step === 'format' ? (
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
                    <small>Open a clear ownership cost report.</small>
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
                    <small>Download ownership costs and VAT in Excel.</small>
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
                <span>Choose the year and month to include.</span>
              </div>

              <div className={assetStyles.assetFuelReportFilterBox}>
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
                  disabled={downloading}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={`${assetStyles.secondaryButton} ${assetStyles.assetTimelineSecondaryButton}`}
                  onClick={onClose}
                  disabled={downloading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={assetStyles.primaryButton}
                  onClick={() => void downloadReport()}
                  disabled={downloading}
                >
                  <DownloadIcon className={assetStyles.buttonIcon} />
                  <span>
                    {downloading
                      ? 'Preparing report…'
                      : format === 'pdf'
                        ? 'Open PDF report'
                        : 'Download Excel'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


