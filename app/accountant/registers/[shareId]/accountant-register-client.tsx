'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import AppHeader from '../../../../components/AppHeader';
import type { AccountantAsset, AccountantRegisterAccess, AccountingValueReference } from '../../../../lib/accountant-workspace';
import type { AssetRegisterSummary } from '../../../../lib/asset-registers';
import styles from './page.module.css';

type Props = {
  shareId: string;
  initialData: { access: AccountantRegisterAccess; register: AssetRegisterSummary; registers: AssetRegisterSummary[]; items: AccountantAsset[] };
};
type Modal = 'reports' | 'manage' | 'finance' | 'accounting' | 'documents' | null;

function money(value: unknown): string {
  const amount = Number(value);
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

function date(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

function textSpec(asset: AccountantAsset, ...keys: string[]): string {
  for (const key of keys) {
    const value = String(asset.specsJson?.[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function numberSpec(asset: AccountantAsset, ...keys: string[]): string {
  for (const key of keys) {
    const value = asset.specsJson?.[key];
    if (value !== null && typeof value !== 'undefined' && Number.isFinite(Number(value))) return String(value);
  }
  return '';
}

function financeStatus(asset: AccountantAsset): string {
  return textSpec(asset, 'financeStatus', 'finance_status') || (asset.isFinanced ? 'yes' : 'unknown');
}

function condition(asset: AccountantAsset): string {
  const value = String(asset.condition || 'Not recorded').replace(/_/g, ' ');
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function usage(asset: AccountantAsset): string {
  if (asset.hours === null) return 'Not recorded';
  const metric = textSpec(asset, 'usageMetric', 'usage_metric') === 'km' ? 'km' : 'hours';
  return `${Number(asset.hours).toLocaleString('en-ZA')} ${metric}`;
}

function replacement(asset: AccountantAsset): number {
  return Number(asset.replacementPriceExVat || asset.specsJson?.replacementPriceExVat || 0);
}

function Icon({ name }: { name: 'search' | 'refresh' | 'filter' | 'download' | 'manage' | 'file' | 'money' }) {
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.5-4.7L4 8m0-4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.7L20 16m0 4v-4h-4"/></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M5 20h14"/></>,
    manage: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/></>,
    file: <><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/></>,
    money: <><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.8-.7-1.8-1-3-1-1.7 0-3 .8-3 2s1.1 1.8 3 2.2 3 1 3 2.3-1.3 2.2-3.2 2.2c-1.2 0-2.4-.4-3.3-1.2M12 5.5v13"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function financeDraft(asset: AccountantAsset) {
  return {
    financeStatus: financeStatus(asset),
    financeType: textSpec(asset, 'financeType', 'finance_type'),
    financierName: textSpec(asset, 'financierName', 'financier_name'),
    referenceNumber: textSpec(asset, 'financeReferenceNumber', 'finance_reference_number'),
    originalAmount: numberSpec(asset, 'financeOriginalAmountExVat', 'finance_original_amount_ex_vat'),
    outstandingBalance: numberSpec(asset, 'financeCurrentOutstandingExVat', 'finance_current_outstanding_ex_vat'),
    settlementAmount: numberSpec(asset, 'financeSettlementAmountExVat', 'finance_settlement_amount_ex_vat'),
    instalment: numberSpec(asset, 'financeMonthlyPaymentExVat', 'finance_monthly_payment_ex_vat'),
    balloon: numberSpec(asset, 'financeBalloonPaymentExVat', 'finance_balloon_payment_ex_vat'),
    startDate: textSpec(asset, 'financeStartDate', 'finance_start_date'),
    endDate: textSpec(asset, 'financeEndDate', 'finance_end_date'),
    latestBalanceDate: textSpec(asset, 'financeLatestBalanceDate', 'finance_latest_balance_date'),
    settlementDate: textSpec(asset, 'financeSettlementDate', 'finance_settlement_date'),
    sourceReference: textSpec(asset, 'financeSourceReference', 'finance_source_reference'),
    securityDescription: textSpec(asset, 'financeSecurityDescription', 'finance_security_description'),
    financeNote: asset.financeNote || '',
  };
}

export default function AccountantRegisterClient({ initialData, shareId }: Props) {
  const [access, setAccess] = useState(initialData.access);
  const [register, setRegister] = useState(initialData.register);
  const [assets, setAssets] = useState(initialData.items);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'financed' | 'paid' | 'unknown'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeAsset, setActiveAsset] = useState<AccountantAsset | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [finance, setFinance] = useState(() => financeDraft(initialData.items[0] || {} as AccountantAsset));
  const [carryingValue, setCarryingValue] = useState('');
  const [carryingDate, setCarryingDate] = useState(new Date().toISOString().slice(0, 10));
  const [carryingSource, setCarryingSource] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const status = financeStatus(asset);
      const matchesFilter = filter === 'all' || (filter === 'financed' ? status === 'yes' : filter === 'paid' ? status === 'no' : !['yes', 'no'].includes(status));
      return matchesFilter && (!search || `${asset.title} ${asset.brandName} ${asset.modelName} ${asset.serialNumber}`.toLowerCase().includes(search));
    });
  }, [assets, filter, query]);
  const totalValue = assets.reduce((sum, asset) => sum + Number(asset.value || 0), 0);
  const valuedCount = assets.filter((asset) => asset.selectedMethod !== 'manual').length;

  function openManage(asset: AccountantAsset) {
    setActiveAsset(asset);
    setFinance(financeDraft(asset));
    setCarryingValue(asset.accountingValue ? String(asset.accountingValue.carryingValue) : '');
    setCarryingDate(asset.accountingValue?.asAtDate || new Date().toISOString().slice(0, 10));
    setCarryingSource(asset.accountingValue?.sourceReference || '');
    setModal('manage');
  }

  async function refresh() {
    setSaving(true);
    try {
      const response = await fetch(`/api/accountant/registers/${encodeURIComponent(shareId)}`, { credentials: 'include', cache: 'no-store' });
      const data = await response.json() as typeof initialData & { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Asset Register could not be refreshed.');
      setAccess(data.access); setRegister(data.register); setAssets(data.items);
      setNotice({ tone: 'success', text: 'Asset Register refreshed.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Asset Register could not be refreshed.' });
    } finally { setSaving(false); }
  }

  function syncAsset(item: AccountantAsset) {
    setAssets((items) => items.map((asset) => asset.id === item.id ? item : asset));
    setActiveAsset(item);
  }

  async function saveFinance(event: FormEvent) {
    event.preventDefault(); if (!activeAsset) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/accountant/registers/${encodeURIComponent(shareId)}/assets/${encodeURIComponent(activeAsset.id)}/finance`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finance) });
      const data = await response.json() as { ok?: boolean; item?: AccountantAsset; error?: string };
      if (!response.ok || !data.ok || !data.item) throw new Error(data.error || 'Finance details could not be saved.');
      syncAsset(data.item); setModal('manage'); setNotice({ tone: 'success', text: `Finance details for ${activeAsset.title} were saved and added to owner history.` });
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Finance details could not be saved.' }); }
    finally { setSaving(false); }
  }

  async function saveAccounting(event: FormEvent) {
    event.preventDefault(); if (!activeAsset) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/accountant/registers/${encodeURIComponent(shareId)}/assets/${encodeURIComponent(activeAsset.id)}/accounting-value`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ carryingValue, asAtDate: carryingDate, sourceReference: carryingSource }) });
      const data = await response.json() as { ok?: boolean; accountingValue?: AccountingValueReference; error?: string };
      if (!response.ok || !data.ok || !data.accountingValue) throw new Error(data.error || 'Accounting value could not be saved.');
      syncAsset({ ...activeAsset, accountingValue: data.accountingValue }); setModal('manage'); setNotice({ tone: 'success', text: 'Accounting carrying value reference saved. Aim4price did not calculate it.' });
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Accounting value could not be saved.' }); }
    finally { setSaving(false); }
  }

  async function uploadDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || !activeAsset) return;
    setSaving(true);
    try {
      const form = new FormData(); form.set('file', file);
      const response = await fetch(`/api/accountant/registers/${encodeURIComponent(shareId)}/assets/${encodeURIComponent(activeAsset.id)}/documents`, { method: 'POST', credentials: 'include', body: form });
      const data = await response.json() as { ok?: boolean; item?: AccountantAsset; error?: string };
      if (!response.ok || !data.ok || !data.item) throw new Error(data.error || 'Document could not be uploaded.');
      syncAsset(data.item); setNotice({ tone: 'success', text: `${file.name} was attached and recorded in owner history.` });
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Document could not be uploaded.' }); }
    finally { setSaving(false); }
  }

  const reportUrl = (kind: string, assetId?: string) => `/api/accountant/registers/${encodeURIComponent(shareId)}/reports?kind=${encodeURIComponent(kind)}${assetId ? `&assetId=${encodeURIComponent(assetId)}` : ''}`;

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />
      <section className={styles.shell}>
        {notice ? <div className={`${styles.notice} ${notice.tone === 'success' ? styles.success : styles.error}`}>{notice.text}</div> : null}
        <section className={styles.registerPanel}>
          <header className={styles.registerHeader}>
            <div className={styles.titleCard}><h1>{register.businessName}</h1><span>{access.ownerBusinessName}</span></div>
            <div className={styles.headerActions}>
              <Link className={styles.backButton} href="/accountant/registers">Asset Registers</Link>
              <button type="button" className={styles.lightButton} onClick={() => setModal('reports')}><Icon name="download"/>Download</button>
            </div>
          </header>
          <section className={styles.summaryGrid}>
            <article className={styles.valueSummary}><span>Register value</span><strong>{money(totalValue)}<small> + VAT</small></strong><div>Excl. VAT</div></article>
            <article><span>Aim4price valued equipment</span><strong>{valuedCount}</strong><div>Market-value records</div></article>
            <article><span>Total assets</span><strong>{assets.length}</strong><div>{access.allowDirectUpdates ? 'Direct updates allowed' : 'Read-only access'}</div></article>
          </section>
          <div className={styles.toolbar}>
            <label className={styles.search}><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by asset, brand, model or serial" /></label>
            <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Filter assets"><option value="all">All assets</option><option value="financed">Financed</option><option value="paid">Paid off</option><option value="unknown">Unknown</option></select>
            <button type="button" className={styles.lightButton} onClick={() => void refresh()} disabled={saving}><Icon name="refresh"/>{saving ? 'Working...' : 'Refresh'}</button>
          </div>
          <div className={styles.assetList}>
            {visible.map((asset) => {
              const expanded = expandedId === asset.id;
              const status = financeStatus(asset);
              return <article className={`${styles.assetCard} ${expanded ? styles.expanded : ''}`} key={asset.id}>
                <header className={styles.assetHeader}>
                  <div><h2>{asset.title}</h2><p>Year Model: {asset.yearModel || 'Unknown'} · Usage: {usage(asset)} · Condition: {condition(asset)}</p><strong>{asset.selectedMethod === 'manual' ? 'Manual' : 'Aim4price'} value</strong><small>Updated {date(asset.updatedAtIso)}</small></div>
                  <aside><div className={styles.assetValue}>{money(asset.value)}<span>Excl. VAT</span></div><div className={styles.assetActions}><button type="button" onClick={() => setExpandedId(expanded ? null : asset.id)}>{expanded ? 'Hide details' : 'View details'}</button><button type="button" className={styles.manageButton} onClick={() => openManage(asset)}><Icon name="manage"/>Manage</button></div></aside>
                </header>
                {expanded ? <div className={styles.details}>
                  <section className={styles.documentsPanel}><div className={styles.panelTitle}><Icon name="file"/><strong>Documents</strong><span>{asset.documents.length}</span></div>{asset.documents.length ? <div className={styles.documentList}>{asset.documents.map((document) => <a href={document.url} target="_blank" rel="noreferrer" key={document.id}>{document.fileName}</a>)}</div> : <p>No documents shared for this asset.</p>}</section>
                  <section className={styles.facts}>
                    <div><span>Serial</span><strong>{asset.serialNumber || 'Not recorded'}</strong></div><div><span>Financed</span><strong className={status === 'yes' ? styles.yes : status === 'no' ? styles.no : ''}>{status === 'yes' ? '✓' : status === 'no' ? 'No' : 'Unknown'}</strong></div>
                    <div><span>Year</span><strong>{asset.yearModel || 'Unknown'}</strong></div><div><span>Insured</span><strong className={asset.isInsured ? styles.yes : styles.no}>{asset.isInsured ? '✓' : 'No'}</strong></div>
                    <div><span>Usage</span><strong>{usage(asset)}</strong></div><div><span>Licensed</span><strong className={asset.isLicensed ? styles.yes : styles.no}>{asset.isLicensed ? '✓' : 'No'}</strong></div>
                    <div><span>Condition</span><strong>{condition(asset)}</strong></div><div><span>Registration</span><strong>{asset.licenseRegistrationNumber || 'Not recorded'}</strong></div>
                    <div className={styles.full}><span>Replacement price</span><strong>{replacement(asset) ? money(replacement(asset)) : 'Not recorded'}</strong></div>
                    <div className={styles.full}><span>Accounting carrying value</span><strong>{asset.accountingValue ? `${money(asset.accountingValue.carryingValue)} · ${date(asset.accountingValue.asAtDate)}` : 'Not recorded'}</strong></div>
                  </section>
                </div> : null}
              </article>;
            })}
          </div>
        </section>
      </section>

      {modal ? <div className={styles.modalOverlay}><button type="button" className={styles.backdrop} onClick={() => !saving && setModal(null)} aria-label="Close modal"/><section className={styles.modal} role="dialog" aria-modal="true">
        <header><div><h2>{modal === 'reports' ? 'Accountant reports' : activeAsset?.title}</h2><p>{modal === 'reports' ? 'Aim4price asset information organised for accounting review.' : 'Accountant Workspace'}</p></div><button type="button" onClick={() => setModal(null)} aria-label="Close">×</button></header>
        {modal === 'reports' ? <div className={styles.optionGrid}>
          <a href={reportUrl('depreciation')}><Icon name="download"/><span><strong>Asset Depreciation Schedule</strong><small>Aim4price market-value movement, not tax depreciation.</small></span></a>
          <a href={reportUrl('additions-disposals')}><Icon name="download"/><span><strong>Additions &amp; Disposals</strong><small>Acquisitions, additions and retained disposal history.</small></span></a>
          <a href={reportUrl('cost-of-ownership')}><Icon name="download"/><span><strong>Cost of Ownership</strong><small>Recorded maintenance, parts, repairs and other costs.</small></span></a>
          <a href={reportUrl('financed-paid-off')}><Icon name="download"/><span><strong>Financed versus Paid Off</strong><small>Recorded finance status, balances and facility references.</small></span></a>
          <a href={reportUrl('market-accounting')}><Icon name="download"/><span><strong>Market Value versus Accounting Value</strong><small>Separate market, replacement, carrying and finance values.</small></span></a>
        </div> : null}
        {modal === 'manage' && activeAsset ? <div className={styles.optionGrid}>
          <button type="button" onClick={() => setModal('finance')}><Icon name="money"/><span><strong>Finance</strong><small>{access.allowDirectUpdates ? 'Update recorded finance details.' : 'View recorded finance details.'}</small></span></button>
          <button type="button" onClick={() => setModal('documents')}><Icon name="file"/><span><strong>Documents</strong><small>{access.allowDirectUpdates ? 'View and upload supporting documents.' : 'View supporting documents.'}</small></span></button>
          <button type="button" onClick={() => setModal('accounting')}><Icon name="money"/><span><strong>Accounting value</strong><small>Record a carrying-value reference; Aim4price does not calculate it.</small></span></button>
          <a href={reportUrl('market-accounting', activeAsset.id)}><Icon name="download"/><span><strong>Market &amp; accounting comparison</strong><small>Market, replacement, finance and accounting values kept separate.</small></span></a>
          <a href={reportUrl('depreciation', activeAsset.id)}><Icon name="download"/><span><strong>Aim4price depreciation trend</strong><small>Saved market-value movements and revaluations.</small></span></a>
          <a href={reportUrl('financed-paid-off', activeAsset.id)}><Icon name="download"/><span><strong>Finance remaining</strong><small>Recorded finance or facility terms and balances.</small></span></a>
          {access.includeCostLedger ? <a href={reportUrl('cost-of-ownership', activeAsset.id)}><Icon name="download"/><span><strong>Cost of ownership</strong><small>Recorded maintenance, parts, repairs and other costs.</small></span></a> : null}
          {access.includeFuelLedger ? <a href={reportUrl('fuel', activeAsset.id)}><Icon name="download"/><span><strong>Fuel report</strong><small>Read-only recorded fuel issues and supporting records.</small></span></a> : null}
          <a href={reportUrl('audit-history', activeAsset.id)}><Icon name="download"/><span><strong>Asset change history</strong><small>Audited owner and authorised partner changes.</small></span></a>
        </div> : null}
        {modal === 'finance' && activeAsset ? <form className={styles.form} onSubmit={saveFinance}>
          <div className={styles.formNotice}>{access.allowDirectUpdates ? 'Changes save directly and remain visible in owner audit history.' : 'This register is read-only. Ask the owner to enable Allow direct updates.'}</div>
          <label><span>Finance status</span><select value={finance.financeStatus} onChange={(event) => setFinance({ ...finance, financeStatus: event.target.value })} disabled={!access.allowDirectUpdates}><option value="yes">Financed</option><option value="no">Paid off</option><option value="unknown">Unknown</option><option value="not_applicable">Not applicable</option></select></label>
          <div className={styles.formGrid}>{(['financierName','financeType','referenceNumber','originalAmount','outstandingBalance','settlementAmount','instalment','balloon','startDate','endDate','latestBalanceDate','settlementDate','sourceReference','securityDescription'] as const).map((key) => <label key={key}><span>{({financierName:'Financier',financeType:'Finance type',referenceNumber:'Agreement / facility reference',originalAmount:'Original finance amount',outstandingBalance:'Latest outstanding balance',settlementAmount:'Settlement amount',instalment:'Instalment',balloon:'Balloon',startDate:'Start date',endDate:'Expected end date',latestBalanceDate:'Latest balance date',settlementDate:'Settlement date',sourceReference:'Source document / reference',securityDescription:'Recorded collateral / security'} as const)[key]}</span><input type={key.toLowerCase().includes('date') ? 'date' : 'text'} value={finance[key]} onChange={(event) => setFinance({ ...finance, [key]: event.target.value })} disabled={!access.allowDirectUpdates}/></label>)}</div>
          <label><span>Finance note</span><textarea value={finance.financeNote} onChange={(event) => setFinance({ ...finance, financeNote: event.target.value })} disabled={!access.allowDirectUpdates}/></label>
          <div className={styles.formActions}><button type="button" onClick={() => setModal('manage')}>Back</button>{access.allowDirectUpdates ? <button type="submit" className={styles.primary} disabled={saving}>{saving ? 'Saving...' : 'Save finance details'}</button> : null}</div>
        </form> : null}
        {modal === 'accounting' && activeAsset ? <form className={styles.form} onSubmit={saveAccounting}>
          <div className={styles.formNotice}>The carrying value is supplied by the accountant. Aim4price keeps it separate and does not calculate accounting or tax depreciation.</div>
          <label><span>Accounting carrying value</span><input value={carryingValue} onChange={(event) => setCarryingValue(event.target.value)} disabled={!access.allowDirectUpdates}/></label><label><span>As-at date</span><input type="date" value={carryingDate} onChange={(event) => setCarryingDate(event.target.value)} disabled={!access.allowDirectUpdates}/></label><label><span>Source or reference</span><input value={carryingSource} onChange={(event) => setCarryingSource(event.target.value)} disabled={!access.allowDirectUpdates}/></label>
          <div className={styles.formActions}><button type="button" onClick={() => setModal('manage')}>Back</button>{access.allowDirectUpdates ? <button type="submit" className={styles.primary} disabled={saving}>{saving ? 'Saving...' : 'Save accounting value'}</button> : null}</div>
        </form> : null}
        {modal === 'documents' && activeAsset ? <div className={styles.form}><div className={styles.documentList}>{activeAsset.documents.length ? activeAsset.documents.map((document) => <a href={document.url} target="_blank" rel="noreferrer" key={document.id}>{document.fileName}<small>{Math.round(document.byteSize / 1024)} KB</small></a>) : <p>No documents attached.</p>}</div><input ref={fileRef} type="file" hidden onChange={(event) => void uploadDocument(event)} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp"/><div className={styles.formActions}><button type="button" onClick={() => setModal('manage')}>Back</button>{access.allowDirectUpdates ? <button type="button" className={styles.primary} disabled={saving} onClick={() => fileRef.current?.click()}>{saving ? 'Uploading...' : 'Upload document'}</button> : null}</div></div> : null}
      </section></div> : null}
    </main>
  );
}
