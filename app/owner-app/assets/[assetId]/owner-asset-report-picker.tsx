'use client';

import { useEffect, useState } from 'react';
import type { ExternalShareFileSource } from '../../../../lib/external-file-share';
import { openCanonicalReportHtml } from '../../../../lib/report-print';
import styles from '../../owner-app.module.css';

export type OwnerAssetReportPickerAsset = {
  id: string;
  registerId: string | null;
  kind: string;
  title: string;
  createdAtIso: string;
  updatedAtIso: string;
  lastScannedAtIso: string | null;
};

type ShareableReport = 'valuation' | 'maintenance' | 'fuel' | 'depreciation' | 'ownership';
type OwnerAssetReportFormat = 'pdf' | 'xlsx';
type OwnerAssetReportRouteFormat = OwnerAssetReportFormat | 'html';

type OwnerAssetReportPickerProps = {
  asset: OwnerAssetReportPickerAsset;
  mode?: 'open' | 'attach';
  valuationReportHtml?: string | null;
  onAttach?: (source: ExternalShareFileSource) => void;
  onDismiss?: () => void;
};

const REPORT_TITLES: Record<ShareableReport, string> = {
  valuation: 'Asset valuation',
  maintenance: 'Maintenance report',
  fuel: 'Fuel report',
  depreciation: 'Depreciation log',
  ownership: 'Cost of ownership',
};

const REPORT_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  checked: 'Checked',
  serviced: 'Service',
  repaired: 'Repair',
};

function slugFileName(value: string): string {
  return String(value || 'aim4price-asset')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'aim4price-asset';
}

function reportYear(value: string | null | undefined): number | null {
  if (!value) return null;
  const year = new Date(value).getFullYear();
  return Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : null;
}

function reportFilterMeta(
  report: ShareableReport,
  year: string,
  month: string,
  maintenanceType: string,
): { labelSuffix: string; fileSuffix: string } {
  if (report === 'valuation') return { labelSuffix: '', fileSuffix: '' };

  const selectedYear = year === 'all' ? '' : year;
  const selectedMonth = month === 'all' ? '' : month.padStart(2, '0');
  const monthIndex = selectedMonth ? Number(selectedMonth) - 1 : -1;
  const monthLabel = monthIndex >= 0 && monthIndex < REPORT_MONTHS.length ? REPORT_MONTHS[monthIndex] : '';
  const selectedMaintenanceType = report === 'maintenance' && maintenanceType !== 'all' ? maintenanceType : '';
  const maintenanceLabel = selectedMaintenanceType
    ? MAINTENANCE_TYPE_LABELS[selectedMaintenanceType] ?? selectedMaintenanceType.replace(/[-_]+/g, ' ')
    : '';
  const periodLabel = selectedYear && monthLabel ? `${monthLabel} ${selectedYear}` : selectedYear || monthLabel;
  const labelParts = [maintenanceLabel, periodLabel].filter(Boolean);
  const fileParts = [selectedMaintenanceType, selectedYear, selectedMonth].filter(Boolean);

  return {
    labelSuffix: labelParts.length ? ` · ${labelParts.join(' · ')}` : '',
    fileSuffix: fileParts.length ? `-${fileParts.join('-')}` : '',
  };
}

function reportFileName(
  assetTitle: string,
  report: ShareableReport,
  year: string,
  month: string,
  maintenanceType: string,
  format: OwnerAssetReportFormat,
): string {
  const filterMeta = reportFilterMeta(report, year, month, maintenanceType);
  return `${slugFileName(assetTitle)}-${report}${filterMeta.fileSuffix}.${format}`;
}

export function buildOwnerAssetReportUrl(
  asset: OwnerAssetReportPickerAsset,
  report: ShareableReport,
  format: OwnerAssetReportRouteFormat,
  year = 'all',
  month = 'all',
  maintenanceType = 'all',
): string {
  if (report === 'valuation') {
    const params = new URLSearchParams({
      format,
      reportKind: 'full',
      assetIds: asset.id,
      entityName: `${asset.title} - Asset Valuation Report`,
      source: 'owner-app',
    });
    if (asset.registerId) {
      params.set('scope', 'single');
      params.set('registerIds', asset.registerId);
    }
    return `/api/asset-register/export?${params.toString()}`;
  }

  const params = new URLSearchParams({
    assetId: asset.id,
    format,
    source: 'owner-app',
  });
  if (report !== 'ownership') params.set('report', report);
  if (year !== 'all') {
    params.set('year', year);
    if (month !== 'all') params.set('month', month);
  }
  if (report === 'maintenance' && maintenanceType !== 'all') {
    params.set('maintenanceType', maintenanceType);
  }

  return report === 'ownership'
    ? `/api/my-invoices/report?${params.toString()}`
    : `/api/asset-register/scan-report?${params.toString()}`;
}

export function buildOwnerValuationReportSource(
  asset: OwnerAssetReportPickerAsset,
  valuationReportHtml: string,
): ExternalShareFileSource {
  const fileName = reportFileName(asset.title, 'valuation', 'all', 'all', 'all', 'pdf');
  let htmlHash = 2166136261;
  for (let index = 0; index < valuationReportHtml.length; index += 1) {
    htmlHash ^= valuationReportHtml.charCodeAt(index);
    htmlHash = Math.imul(htmlHash, 16777619);
  }
  return {
    id: `owner-report:pdf:valuation:${asset.id}:${(htmlHash >>> 0).toString(36)}`,
    kind: 'report',
    label: `${REPORT_TITLES.valuation} · PDF`,
    description: 'Aim4price asset valuation',
    fileName,
    url: '/api/reports/render-pdf',
    contentType: 'application/pdf',
    credentials: 'include',
    request: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: valuationReportHtml, fileName }),
    },
    preferSourceFileName: true,
  };
}

export default function OwnerAssetReportPicker({
  asset,
  mode = 'open',
  valuationReportHtml,
  onAttach,
  onDismiss,
}: OwnerAssetReportPickerProps) {
  const currentYear = new Date().getFullYear();
  const reportYears = [
    currentYear,
    reportYear(asset.lastScannedAtIso),
    reportYear(asset.updatedAtIso),
    reportYear(asset.createdAtIso),
  ].filter((value): value is number => value !== null);
  const firstYear = Math.min(...reportYears, currentYear);
  const lastYear = Math.max(...reportYears, currentYear);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => String(lastYear - index));
  const months = REPORT_MONTHS;
  const reports: Array<{ id: ShareableReport; title: string }> = [
    { id: 'valuation', title: REPORT_TITLES.valuation },
    { id: 'maintenance', title: REPORT_TITLES.maintenance },
    ...(asset.kind !== 'property' ? [
      { id: 'fuel' as const, title: REPORT_TITLES.fuel },
      { id: 'depreciation' as const, title: REPORT_TITLES.depreciation },
    ] : []),
    { id: 'ownership', title: REPORT_TITLES.ownership },
  ];
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');
  const [maintenanceType, setMaintenanceType] = useState('all');
  const [format, setFormat] = useState<OwnerAssetReportFormat>('pdf');
  const [selectedReport, setSelectedReport] = useState<ShareableReport | null>(null);
  const [reportError, setReportError] = useState('');
  const selectedReportDetails = reports.find((report) => report.id === selectedReport) ?? null;

  useEffect(() => {
    if (mode !== 'attach' && !selectedReport) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (selectedReport) setSelectedReport(null);
      else onDismiss?.();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mode, onDismiss, selectedReport]);

  function normalReportUrl(report: ShareableReport, reportFormat: OwnerAssetReportFormat): string {
    const routeFormat: OwnerAssetReportRouteFormat = reportFormat === 'pdf' ? 'html' : reportFormat;
    return buildOwnerAssetReportUrl(asset, report, routeFormat, year, month, maintenanceType);
  }

  function shareReportSource(report: ShareableReport, reportFormat: OwnerAssetReportFormat): ExternalShareFileSource | null {
    const url = buildOwnerAssetReportUrl(asset, report, reportFormat, year, month, maintenanceType);
    const filterMeta = reportFilterMeta(report, year, month, maintenanceType);
    const fileName = reportFileName(asset.title, report, year, month, maintenanceType, reportFormat);

    if (report === 'valuation' && reportFormat === 'pdf') {
      if (!valuationReportHtml) return null;
      return buildOwnerValuationReportSource(asset, valuationReportHtml);
    }

    return {
      id: `owner-report:${reportFormat}:${url}`,
      kind: 'report',
      label: `${REPORT_TITLES[report]}${filterMeta.labelSuffix} · ${reportFormat === 'pdf' ? 'PDF' : 'Excel'}`,
      description: `Aim4price ${REPORT_TITLES[report].toLowerCase()}`,
      fileName,
      url,
      contentType: reportFormat === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      credentials: 'include',
    };
  }

  function chooseReport(report: ShareableReport) {
    setYear('all');
    setMonth('all');
    setMaintenanceType('all');
    setFormat('pdf');
    setReportError('');
    setSelectedReport(report);
  }

  function attachSelectedReport() {
    if (!selectedReport) return;
    const source = shareReportSource(selectedReport, format);
    if (source) onAttach?.(source);
  }

  function openSelectedValuationPdf() {
    if (!valuationReportHtml) return;
    setReportError('');

    if (!openCanonicalReportHtml('Aim4price asset valuation', valuationReportHtml)) {
      setReportError('Please allow pop-ups to open this report.');
      return;
    }

    setSelectedReport(null);
  }

  const reportList = (
    <div className={styles.reportList}>
      {reports.map((report) => (
        <button type="button" className={styles.reportCard} key={report.id} onClick={() => chooseReport(report.id)}>
          <span>{report.title}</span>
        </button>
      ))}
    </div>
  );

  const filters = selectedReport && selectedReportDetails ? (
    <>
      <div className={styles.reportFilterGrid}>
        <label className={styles.field}>
          <span>Format</span>
          <select value={format} onChange={(event) => setFormat(event.target.value as OwnerAssetReportFormat)}>
            <option value="pdf">PDF</option>
            <option value="xlsx">Excel</option>
          </select>
        </label>
        {selectedReport !== 'valuation' ? (
          <>
            <label className={styles.field}>
              <span>Year</span>
              <select value={year} onChange={(event) => { setYear(event.target.value); setMonth('all'); }}>
                <option value="all">All years</option>
                {years.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>Month</span>
              <select value={month} disabled={year === 'all'} onChange={(event) => setMonth(event.target.value)}>
                <option value="all">All months</option>
                {months.map((label, index) => <option key={label} value={String(index + 1)}>{label}</option>)}
              </select>
            </label>
          </>
        ) : null}
        {selectedReport === 'maintenance' ? (
          <label className={`${styles.field} ${styles.fieldFull}`}>
            <span>Maintenance type</span>
            <select value={maintenanceType} onChange={(event) => setMaintenanceType(event.target.value)}>
              <option value="all">All maintenance</option>
              <option value="checked">Checked</option>
              <option value="serviced">Service</option>
              <option value="repaired">Repair</option>
            </select>
          </label>
        ) : null}
      </div>
      <div className={styles.reportFilterActions}>
        <button type="button" onClick={() => setSelectedReport(null)}>{mode === 'attach' ? 'Back' : 'Cancel'}</button>
        {mode === 'attach' ? (
          <button
            type="button"
            className={styles.ownerReportAttachButton}
            onClick={attachSelectedReport}
            disabled={selectedReport === 'valuation' && format === 'pdf' && !valuationReportHtml}
          >
            {format === 'pdf' ? 'Add PDF' : 'Add Excel'}
          </button>
        ) : selectedReport === 'valuation' && format === 'pdf' ? (
          <button type="button" className={styles.ownerReportAttachButton} onClick={openSelectedValuationPdf} disabled={!valuationReportHtml}>
            Open PDF
          </button>
        ) : (
          <a href={normalReportUrl(selectedReport, format)} target="_blank" rel="noreferrer" onClick={() => setSelectedReport(null)}>
            {format === 'pdf' ? 'Open PDF' : 'Download Excel'}
          </a>
        )}
      </div>
      {reportError ? <p role="alert" className={styles.errorNotice}>{reportError}</p> : null}
    </>
  ) : null;

  if (mode === 'attach') {
    return (
      <div className={styles.reportFilterDialog} role="dialog" aria-modal="true" aria-labelledby="owner-share-report-title">
        <button type="button" className={styles.reportFilterBackdrop} onClick={onDismiss} aria-label="Close Aim4price reports" />
        <section className={`${styles.reportFilterModal} ${styles.ownerShareReportModal}`}>
          <div className={styles.reportFilterModalHeader}>
            <div>
              <h2 id="owner-share-report-title">{selectedReportDetails?.title || 'Add Aim4price report'}</h2>
              {!selectedReport ? <p>Choose the exact Aim4price PDF or Excel report to attach to this message.</p> : null}
            </div>
            <button type="button" onClick={onDismiss} aria-label="Close Aim4price reports">×</button>
          </div>
          {selectedReport ? filters : reportList}
        </section>
      </div>
    );
  }

  return (
    <section className={`${styles.section} ${styles.editorSection}`}>
      {reportList}
      {selectedReport && selectedReportDetails ? (
        <div className={styles.reportFilterDialog} role="dialog" aria-modal="true" aria-labelledby="owner-report-filter-title">
          <button type="button" className={styles.reportFilterBackdrop} onClick={() => setSelectedReport(null)} aria-label="Close report filters" />
          <section className={styles.reportFilterModal}>
            <div className={styles.reportFilterModalHeader}>
              <div><h2 id="owner-report-filter-title">{selectedReportDetails.title}</h2></div>
              <button type="button" onClick={() => setSelectedReport(null)} aria-label="Close report filters">×</button>
            </div>
            {filters}
          </section>
        </div>
      ) : null}
    </section>
  );
}
