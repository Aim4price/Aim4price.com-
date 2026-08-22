'use client';

import { useEffect, useState } from 'react';
import type { ExternalShareFileSource } from '../../../../components/asset-register/AssetExternalShare';
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

type FilterableReport = 'maintenance' | 'fuel' | 'depreciation' | 'ownership';
type ShareableReport = 'valuation' | FilterableReport;

type OwnerAssetReportPickerProps = {
  asset: OwnerAssetReportPickerAsset;
  mode?: 'open' | 'attach';
  openValuationReport?: () => void;
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
): string {
  const filterMeta = reportFilterMeta(report, year, month, maintenanceType);
  return `${slugFileName(assetTitle)}-${report}${filterMeta.fileSuffix}.pdf`;
}

export default function OwnerAssetReportPicker({
  asset,
  mode = 'open',
  openValuationReport,
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
  const filterableReports: Array<{ id: FilterableReport; title: string }> = [
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
  const [selectedReport, setSelectedReport] = useState<FilterableReport | null>(null);
  const selectedReportDetails = filterableReports.find((report) => report.id === selectedReport) ?? null;

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

  function normalReportUrl(report: FilterableReport): string {
    const params = new URLSearchParams({ assetId: asset.id });
    if (report === 'ownership') {
      params.set('format', 'pdf');
      params.set('source', 'owner-app');
    } else {
      params.set('report', report);
    }
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

  function shareReportSource(report: ShareableReport): ExternalShareFileSource {
    const params = new URLSearchParams({
      source: report === 'valuation' ? 'valuation' : report === 'ownership' ? 'ownership' : 'scan',
      assetId: asset.id,
    });
    if (report === 'valuation' && asset.registerId) params.set('registerId', asset.registerId);
    if (report !== 'valuation' && report !== 'ownership') params.set('report', report);
    if (year !== 'all') {
      params.set('year', year);
      if (month !== 'all') params.set('month', month);
    }
    if (report === 'maintenance' && maintenanceType !== 'all') {
      params.set('maintenanceType', maintenanceType);
    }
    const url = `/api/reports/share-pdf?${params.toString()}`;
    const filterMeta = reportFilterMeta(report, year, month, maintenanceType);
    const fileName = reportFileName(asset.title, report, year, month, maintenanceType);

    return {
      id: `owner-report:${report}:${asset.id}:${params.toString() || 'all'}`,
      kind: 'report',
      label: `${REPORT_TITLES[report]}${filterMeta.labelSuffix} · PDF`,
      description: `Aim4price ${REPORT_TITLES[report].toLowerCase()}`,
      fileName,
      url,
      contentType: 'application/pdf',
      credentials: 'include',
      preferSourceFileName: true,
    };
  }

  function chooseReport(report: FilterableReport) {
    setYear('all');
    setMonth('all');
    setMaintenanceType('all');
    setSelectedReport(report);
  }

  function chooseValuation() {
    if (mode === 'attach') {
      onAttach?.(shareReportSource('valuation'));
      return;
    }
    openValuationReport?.();
  }

  function attachSelectedReport() {
    if (!selectedReport) return;
    onAttach?.(shareReportSource(selectedReport));
  }

  const reportList = (
    <div className={styles.reportList}>
      <button type="button" className={styles.reportCard} onClick={chooseValuation}>
        <span>{REPORT_TITLES.valuation}</span>
      </button>
      {filterableReports.map((report) => (
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
          <button type="button" className={styles.ownerReportAttachButton} onClick={attachSelectedReport}>Add PDF</button>
        ) : (
          <a href={normalReportUrl(selectedReport)} target="_blank" rel="noreferrer" onClick={() => setSelectedReport(null)}>Open report</a>
        )}
      </div>
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
              {!selectedReport ? <p>Choose a polished Aim4price PDF to attach to this message.</p> : null}
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
