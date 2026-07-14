'use client';

import { useEffect, useMemo, useState } from 'react';
import OwnerAppNav from '../owner-app-nav';
import type { OwnerAppAsset, OwnerAppAssetsResponse, OwnerAppRegister } from '../owner-app-types';
import styles from '../owner-app.module.css';

type ReportFormat = 'pdf' | 'xlsx';

function openReport(url: string, format: ReportFormat) {
  if (format === 'xlsx') {
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.href = url;
}

function withParams(path: string, params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return `${path}?${search.toString()}`;
}

export default function OwnerAppReportsClient() {
  const [assets, setAssets] = useState<OwnerAppAsset[]>([]);
  const [registers, setRegisters] = useState<OwnerAppRegister[]>([]);
  const [assetId, setAssetId] = useState('all');
  const [registerId, setRegisterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    fetch('/api/owner-app/assets', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as OwnerAppAssetsResponse | null;
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Reports could not be prepared.');
        if (!active) return;

        const nextAssets = payload.assets ?? [];
        const nextRegisters = payload.registers ?? [];
        const requestedAssetId = new URLSearchParams(window.location.search).get('assetId') || 'all';
        const selectedAsset = nextAssets.find((asset) => asset.id === requestedAssetId);

        setAssets(nextAssets);
        setRegisters(nextRegisters);
        setAssetId(selectedAsset?.id || 'all');
        setRegisterId(selectedAsset?.registerId || nextRegisters.find((register) => register.isSelected)?.id || nextRegisters[0]?.id || '');
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Reports could not be prepared.'); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []);

  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === assetId) ?? null, [assetId, assets]);

  function chooseAsset(nextAssetId: string) {
    setAssetId(nextAssetId);
    const asset = assets.find((entry) => entry.id === nextAssetId);
    if (asset?.registerId) setRegisterId(asset.registerId);
  }

  function assetRegisterReport(format: ReportFormat) {
    openReport(withParams('/api/asset-register/export', {
      format,
      registerId,
      reportKind: 'full',
    }), format);
  }

  function maintenanceReport(format: ReportFormat) {
    openReport(withParams('/api/maintenance/report', {
      format,
      scope: selectedAsset ? 'asset' : 'total',
      assetId: selectedAsset?.id,
    }), format);
  }

  function costReport(format: ReportFormat) {
    openReport(withParams('/api/my-invoices/report', {
      format,
      assetId: selectedAsset?.id,
      includeFuelSlipCosts: 'true',
    }), format);
  }

  function fuelReport(format: ReportFormat) {
    if (selectedAsset) {
      openReport(withParams('/api/asset-register/scan-report', {
        format,
        assetId: selectedAsset.id,
        report: 'fuel',
      }), format);
      return;
    }

    openReport(withParams('/api/fuel/report', { format }), format);
  }

  function depreciationReport(format: ReportFormat) {
    if (!selectedAsset) return;
    openReport(withParams('/api/asset-register/scan-report', {
      format,
      assetId: selectedAsset.id,
      report: 'depreciation',
    }), format);
  }

  const reports = [
    {
      number: '01',
      title: 'Asset Register',
      text: 'Your complete selected asset register with values, replacement prices and saved asset information.',
      run: assetRegisterReport,
      disabled: !registerId,
    },
    {
      number: '02',
      title: 'Maintenance',
      text: selectedAsset ? `Maintenance history and upcoming work for ${selectedAsset.title}.` : 'All scheduled and completed maintenance records.',
      run: maintenanceReport,
      disabled: false,
    },
    {
      number: '03',
      title: 'Cost of Ownership',
      text: selectedAsset ? `Saved invoices, fuel and costs for ${selectedAsset.title}.` : 'All saved invoices, fuel and ownership costs.',
      run: costReport,
      disabled: false,
    },
    {
      number: '04',
      title: 'Fuel',
      text: selectedAsset ? `Fuel activity recorded against ${selectedAsset.title}.` : 'Fuel storage, issues and linked fuel slip activity.',
      run: fuelReport,
      disabled: false,
    },
  ];

  return (
    <main className={styles.appPage}>
      <OwnerAppNav title="Reports" backHref="/app" />
      <div className={styles.shell}>
        <header className={styles.pageHeader}>
          <p className={styles.pageEyebrow}>Reports</p>
          <h1>Take your records with you.</h1>
          <p>Open a clean report or download the matching Excel workbook.</p>
        </header>

        {loading ? <div className={styles.loadingState}><span className={styles.spinner} aria-label="Preparing reports" /></div> : null}
        {error ? <div className={`${styles.notice} ${styles.noticeError}`} role="alert">{error}</div> : null}

        {!loading && !error ? (
          <>
            <section className={styles.reportSelectors} aria-label="Report selection">
              <label className={styles.field}>
                <span>Report scope</span>
                <select value={assetId} onChange={(event) => chooseAsset(event.target.value)}>
                  <option value="all">All records</option>
                  {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title}</option>)}
                </select>
              </label>

              <label className={styles.field}>
                <span>Asset Register</span>
                <select value={registerId} onChange={(event) => setRegisterId(event.target.value)}>
                  {registers.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}
                </select>
              </label>
            </section>

            <section className={styles.reportList} aria-label="Available reports">
              {reports.map((report) => (
                <article key={report.number} className={styles.reportCard}>
                  <div className={styles.reportCardTop}>
                    <div>
                      <h2>{report.title}</h2>
                      <p>{report.text}</p>
                    </div>
                    <span className={styles.reportNumber}>{report.number}</span>
                  </div>
                  <div className={styles.reportActions}>
                    <button type="button" className={styles.primaryButton} onClick={() => report.run('pdf')} disabled={report.disabled}>Open PDF</button>
                    <button type="button" className={styles.secondaryButton} onClick={() => report.run('xlsx')} disabled={report.disabled}>Download Excel</button>
                  </div>
                </article>
              ))}

              {selectedAsset ? (
                <article className={styles.reportCard}>
                  <div className={styles.reportCardTop}>
                    <div>
                      <h2>Depreciation Log</h2>
                      <p>Value, usage and condition changes recorded for {selectedAsset.title}.</p>
                    </div>
                    <span className={styles.reportNumber}>05</span>
                  </div>
                  <div className={styles.reportActions}>
                    <button type="button" className={styles.primaryButton} onClick={() => depreciationReport('pdf')}>Open PDF</button>
                    <button type="button" className={styles.secondaryButton} onClick={() => depreciationReport('xlsx')}>Download Excel</button>
                  </div>
                </article>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
