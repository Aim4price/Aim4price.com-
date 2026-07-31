'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import styles from '../app/asset-register/page.module.css';

type AccountingValue = {
  carryingValue: number;
  asAtDate: string;
  sourceReference: string;
} | null;

type SharedDocument = {
  id: string;
  url: string;
  fileName: string;
  byteSize: number;
};

export type AccountantManagedAsset = {
  id: string;
  title: string;
  specsJson: Record<string, unknown>;
  financeNote: string;
  documents: SharedDocument[];
  accountingValue?: AccountingValue;
};

type View = 'menu' | 'finance' | 'accounting' | 'documents' | 'reports';

type Props = {
  shareId: string;
  asset: AccountantManagedAsset;
  allowDirectUpdates: boolean;
  includeFuelLedger: boolean;
  includeCostLedger: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
};

const financeFields = [
  ['financierName', 'Financier'],
  ['financeType', 'Finance type'],
  ['referenceNumber', 'Agreement / facility reference'],
  ['originalAmount', 'Original finance amount'],
  ['outstandingBalance', 'Latest outstanding balance'],
  ['settlementAmount', 'Settlement amount'],
  ['instalment', 'Instalment'],
  ['balloon', 'Balloon'],
  ['startDate', 'Start date'],
  ['endDate', 'Expected end date'],
  ['latestBalanceDate', 'Latest balance date'],
  ['settlementDate', 'Settlement date'],
  ['sourceReference', 'Source document / reference'],
  ['securityDescription', 'Recorded collateral / security'],
] as const;

type FinanceKey = (typeof financeFields)[number][0];
type FinanceDraft = Record<FinanceKey, string> & { financeStatus: string; financeNote: string };

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function first(specs: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = text(specs[key]);
    if (value) return value;
  }
  return '';
}

function financeDraft(asset: AccountantManagedAsset): FinanceDraft {
  const specs = asset.specsJson ?? {};
  return {
    financeStatus: first(specs, 'financeStatus', 'finance_status') || 'unknown',
    financeNote: asset.financeNote || '',
    financierName: first(specs, 'financierName', 'financier_name'),
    financeType: first(specs, 'financeType', 'finance_type'),
    referenceNumber: first(specs, 'financeReferenceNumber', 'finance_reference_number'),
    originalAmount: first(specs, 'financeOriginalAmountExVat', 'finance_original_amount_ex_vat'),
    outstandingBalance: first(specs, 'financeCurrentOutstandingExVat', 'finance_current_outstanding_ex_vat'),
    settlementAmount: first(specs, 'financeSettlementAmountExVat', 'finance_settlement_amount_ex_vat'),
    instalment: first(specs, 'financeMonthlyPaymentExVat', 'finance_monthly_payment_ex_vat'),
    balloon: first(specs, 'financeBalloonPaymentExVat', 'finance_balloon_payment_ex_vat'),
    startDate: first(specs, 'financeStartDate', 'finance_start_date'),
    endDate: first(specs, 'financeEndDate', 'finance_end_date'),
    latestBalanceDate: first(specs, 'financeLatestBalanceDate', 'finance_latest_balance_date'),
    settlementDate: first(specs, 'financeSettlementDate', 'finance_settlement_date'),
    sourceReference: first(specs, 'financeSourceReference', 'finance_source_reference'),
    securityDescription: first(specs, 'financeSecurityDescription', 'finance_security_description'),
  };
}

function ActionIcon({ type }: { type: 'finance' | 'accounting' | 'document' | 'report' }) {
  const paths = {
    finance: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M7 10h10M7 15h4"/></>,
    accounting: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
    document: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
    report: <><path d="M4 19V9M10 19V4M16 19v-7M22 19H2"/></>,
  }[type];
  return <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{paths}</svg>;
}

export default function AccountantAssetManageModal({
  shareId,
  asset,
  allowDirectUpdates,
  includeFuelLedger,
  includeCostLedger,
  onClose,
  onChanged,
}: Props) {
  const [view, setView] = useState<View>('menu');
  const [finance, setFinance] = useState<FinanceDraft>(() => financeDraft(asset));
  const [carryingValue, setCarryingValue] = useState(asset.accountingValue ? String(asset.accountingValue.carryingValue) : '');
  const [asAtDate, setAsAtDate] = useState(asset.accountingValue?.asAtDate || new Date().toISOString().slice(0, 10));
  const [accountingSource, setAccountingSource] = useState(asset.accountingValue?.sourceReference || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const root = `/api/accountant/registers/${encodeURIComponent(shareId)}`;
  const reportUrl = (kind: string) => `${root}/reports?kind=${encodeURIComponent(kind)}&assetId=${encodeURIComponent(asset.id)}`;
  const documents = useMemo(() => Array.isArray(asset.documents) ? asset.documents : [], [asset.documents]);

  async function saveFinance(event: FormEvent) {
    event.preventDefault();
    if (!allowDirectUpdates || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${root}/assets/${encodeURIComponent(asset.id)}/finance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finance),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Finance details could not be saved.');
      onChanged('Finance details saved to the owner’s live Asset Register.');
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Finance details could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function saveAccounting(event: FormEvent) {
    event.preventDefault();
    if (!allowDirectUpdates || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${root}/assets/${encodeURIComponent(asset.id)}/accounting-value`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carryingValue, asAtDate, sourceReference: accountingSource }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Accounting value could not be saved.');
      onChanged('Accounting carrying value saved separately from the Aim4price market value.');
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Accounting value could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadDocument(file: File | null) {
    if (!file || !allowDirectUpdates || busy) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch(`${root}/assets/${encodeURIComponent(asset.id)}/documents`, { method: 'POST', body: form });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'The document could not be uploaded.');
      onChanged('Document added to the owner’s live Asset Register with accountant attribution.');
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The document could not be uploaded.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const title = view === 'menu' ? asset.title : {
    finance: 'Finance details', accounting: 'Accounting carrying value', documents: 'Documents', reports: 'Asset reports', menu: asset.title,
  }[view];

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalBackdrop} onClick={busy ? undefined : onClose} />
      <section className={styles.optionsModal} role="dialog" aria-modal="true" aria-labelledby="accountant-asset-manage-title">
        <div className={`${styles.modalHeader} ${styles.optionsModalHeader}`}>
          <div className={styles.modalHeaderText}>
            <h3 id="accountant-asset-manage-title">{title}</h3>
            <p>{view === 'menu' ? 'Accountant Workspace' : asset.title}</p>
          </div>
          <button type="button" className={styles.modalCloseButton} onClick={onClose} disabled={busy} aria-label="Close asset management">×</button>
        </div>

        <div className={`${styles.modalScrollBody} ${view === 'menu' ? styles.optionsScrollBody : styles.assetSettingsBody}`}>
          {view === 'menu' ? (
            <div className={styles.optionsContent}>
              {!allowDirectUpdates ? <div className={styles.accountantReadOnlyNotice}>The owner has shared this register as read-only. Reports and documents remain viewable.</div> : null}
              <div className={`${styles.optionsGrid} ${styles.assetOptionsGrid}`}>
                <button type="button" className={`${styles.optionActionButton} ${styles.optionFeaturedButton}`} onClick={() => setView('finance')}>
                  <ActionIcon type="finance"/><span><strong>Finance details</strong><small>Review or update recorded finance and facility information.</small></span>
                </button>
                <button type="button" className={styles.optionActionButton} onClick={() => setView('accounting')}>
                  <ActionIcon type="accounting"/><span><strong>Accounting carrying value</strong><small>Keep the accountant-supplied value separate from Aim4price.</small></span>
                </button>
                <button type="button" className={styles.optionActionButton} onClick={() => setView('documents')}>
                  <ActionIcon type="document"/><span><strong>Documents</strong><small>Open shared documents or add an attributed supporting file.</small></span>
                </button>
                <button type="button" className={styles.optionActionButton} onClick={() => setView('reports')}>
                  <ActionIcon type="report"/><span><strong>Download reports</strong><small>Download accountant-ready information for this asset.</small></span>
                </button>
              </div>
            </div>
          ) : null}

          {view === 'finance' ? (
            <form className={styles.accountantManageForm} onSubmit={saveFinance}>
              <div className={styles.accountantReadOnlyNotice}>{allowDirectUpdates ? 'Saved changes update the owner’s live register and are written to the audit history.' : 'Ask the owner to enable Allow direct updates before changing finance details.'}</div>
              <div className={styles.accountantManageGrid}>
                <label className={styles.assetSettingsField}><span>Finance status</span><select value={finance.financeStatus} onChange={(event) => setFinance((current) => ({ ...current, financeStatus: event.target.value }))} disabled={!allowDirectUpdates}><option value="yes">Financed</option><option value="no">Paid off / not financed</option><option value="unknown">Unknown</option></select></label>
                {financeFields.map(([key, label]) => <label className={styles.assetSettingsField} key={key}><span>{label}</span><input type={key.toLowerCase().includes('date') ? 'date' : 'text'} value={finance[key]} onChange={(event) => setFinance((current) => ({ ...current, [key]: event.target.value }))} disabled={!allowDirectUpdates}/></label>)}
                <label className={`${styles.assetSettingsField} ${styles.accountantFullField}`}><span>Finance note</span><textarea value={finance.financeNote} onChange={(event) => setFinance((current) => ({ ...current, financeNote: event.target.value }))} disabled={!allowDirectUpdates}/></label>
              </div>
              {error ? <p className={styles.assetSettingsError}>{error}</p> : null}
              <div className={styles.assetSettingsActions}><button type="button" className={styles.secondaryButton} onClick={() => setView('menu')}>Back</button>{allowDirectUpdates ? <button type="submit" className={styles.primaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save finance details'}</button> : null}</div>
            </form>
          ) : null}

          {view === 'accounting' ? (
            <form className={styles.accountantManageForm} onSubmit={saveAccounting}>
              <div className={styles.accountantReadOnlyNotice}>Aim4price does not calculate accounting or tax depreciation. This is the accountant-supplied carrying value.</div>
              <div className={styles.accountantManageGrid}>
                <label className={styles.assetSettingsField}><span>Carrying value</span><input inputMode="decimal" value={carryingValue} onChange={(event) => setCarryingValue(event.target.value)} disabled={!allowDirectUpdates} required/></label>
                <label className={styles.assetSettingsField}><span>As-at date</span><input type="date" value={asAtDate} onChange={(event) => setAsAtDate(event.target.value)} disabled={!allowDirectUpdates} required/></label>
                <label className={`${styles.assetSettingsField} ${styles.accountantFullField}`}><span>Source document / reference</span><input value={accountingSource} onChange={(event) => setAccountingSource(event.target.value)} disabled={!allowDirectUpdates}/></label>
              </div>
              {error ? <p className={styles.assetSettingsError}>{error}</p> : null}
              <div className={styles.assetSettingsActions}><button type="button" className={styles.secondaryButton} onClick={() => setView('menu')}>Back</button>{allowDirectUpdates ? <button type="submit" className={styles.primaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save accounting value'}</button> : null}</div>
            </form>
          ) : null}

          {view === 'documents' ? (
            <div className={styles.accountantManageForm}>
              <div className={styles.accountantDocumentList}>{documents.length ? documents.map((document) => <a key={document.id} href={document.url} target="_blank" rel="noreferrer"><ActionIcon type="document"/><span><strong>{document.fileName}</strong><small>{Math.max(1, Math.round(document.byteSize / 1024))} KB</small></span></a>) : <div className={styles.accountantReadOnlyNotice}>No documents have been added to this asset.</div>}</div>
              <input ref={fileRef} type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp" onChange={(event) => void uploadDocument(event.target.files?.[0] ?? null)}/>
              {error ? <p className={styles.assetSettingsError}>{error}</p> : null}
              <div className={styles.assetSettingsActions}><button type="button" className={styles.secondaryButton} onClick={() => setView('menu')}>Back</button>{allowDirectUpdates ? <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : 'Add document'}</button> : null}</div>
            </div>
          ) : null}

          {view === 'reports' ? (
            <div className={styles.optionsContent}>
              <div className={`${styles.optionsGrid} ${styles.assetOptionsGrid}`}>
                <a className={styles.optionActionButton} href={reportUrl('market-accounting')}><ActionIcon type="report"/><span><strong>Market versus accounting</strong><small>Market, replacement, finance and carrying values.</small></span></a>
                <a className={styles.optionActionButton} href={reportUrl('depreciation')}><ActionIcon type="report"/><span><strong>Aim4price depreciation trend</strong><small>Saved market-value movement and revaluations.</small></span></a>
                <a className={styles.optionActionButton} href={reportUrl('financed-paid-off')}><ActionIcon type="report"/><span><strong>Finance remaining</strong><small>Recorded finance terms, balances and facility references.</small></span></a>
                {includeCostLedger ? <a className={styles.optionActionButton} href={reportUrl('cost-of-ownership')}><ActionIcon type="report"/><span><strong>Cost of ownership</strong><small>Recorded maintenance, parts, repairs and costs.</small></span></a> : null}
                {includeFuelLedger ? <a className={styles.optionActionButton} href={reportUrl('fuel')}><ActionIcon type="report"/><span><strong>Fuel report</strong><small>Read-only fuel records and supporting documents.</small></span></a> : null}
                <a className={styles.optionActionButton} href={reportUrl('audit-history')}><ActionIcon type="report"/><span><strong>Asset change history</strong><small>Audited owner and authorised accountant changes.</small></span></a>
              </div>
              <div className={styles.assetSettingsActions}><button type="button" className={styles.secondaryButton} onClick={() => setView('menu')}>Back</button></div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
