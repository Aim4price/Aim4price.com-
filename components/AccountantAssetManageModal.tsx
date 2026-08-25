'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import styles from '../app/asset-register/page.module.css';

type AccountingValue = {
  carryingValue: number;
  asAtDate: string;
  sourceReference: string;
  originalAccountingCost?: number | null;
  accumulatedDepreciation?: number | null;
  sourceAccountingSystem?: string;
  accountantNote?: string;
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
  value?: number;
  yearModel?: number | null;
  hours?: number | null;
  brandName?: string;
  modelName?: string;
  selectedMethod?: string;
  specsJson: Record<string, unknown>;
  financeNote: string;
  documents: SharedDocument[];
  accountingValue?: AccountingValue;
};

type View = 'menu' | 'finance' | 'accounting' | 'documents' | 'reports' | 'dispose';

type Props = {
  shareId: string;
  asset: AccountantManagedAsset;
  assets: AccountantManagedAsset[];
  allowDirectUpdates: boolean;
  includeFuelLedger: boolean;
  includeCostLedger: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
};

const financeAgreementFields = [
  ['financierName', 'Financier'],
  ['financeType', 'Finance type'],
  ['referenceNumber', 'Agreement / facility reference'],
] as const;

const financeAmountFields = [
  ['originalAmount', 'Original amount'],
  ['outstandingBalance', 'Outstanding balance'],
  ['settlementAmount', 'Settlement amount'],
  ['instalment', 'Instalment amount'],
  ['balloon', 'Balloon payment'],
] as const;

const financeDateFields = [
  ['startDate', 'Start date'],
  ['endDate', 'Expected end date'],
  ['latestBalanceDate', 'Latest balance date'],
  ['settlementDate', 'Settlement date'],
] as const;

const financeRecordFields = [
  ['sourceReference', 'Source document / reference'],
  ['securityDescription', 'Recorded collateral / security'],
] as const;

const financeAcquisitionFields = [
  ['financeBoughtWhen', 'Acquisition date'],
  ['financeBoughtForExVat', 'Acquisition amount'],
] as const;

const financeFields = [
  ...financeAgreementFields,
  ...financeAmountFields,
  ...financeDateFields,
  ...financeRecordFields,
  ...financeAcquisitionFields,
] as const;

type FinanceKey = (typeof financeFields)[number][0];
type FinanceDraft = Record<FinanceKey, string> & {
  financeStatus: string;
  financeNote: string;
  agreementId: string;
  agreementName: string;
  agreementStatus: string;
  agreementScope: string;
  linkRole: string;
  instalmentFrequency: string;
  balloonDate: string;
  interestRate: string;
  originalAmountAllocation: string;
  settlementAllocation: string;
  allocationDate: string;
  allocationNote: string;
};

type FinanceAgreementOption = {
  id: string;
  agreementName: string;
  referenceNumber: string;
  financierName: string;
  agreementType: string;
  agreementStatus: string;
  agreementScope: string;
  startDate: string;
  maturityDate: string;
  originalAmount: number | null;
  instalment: number | null;
  instalmentFrequency: string;
  balloon: number | null;
  balloonDate: string;
  interestRate: number | null;
  outstandingBalance: number | null;
  latestBalanceDate: string;
  settlementAmount: number | null;
  settlementDate: string;
  sourceReference: string;
  securityDescription: string;
  financeNote: string;
  links: Array<{
    assetId: string;
    linkRole: string;
    originalAmountAllocation: number | null;
    settlementAllocation: number | null;
    allocationDate: string;
    allocationNote: string;
  }>;
};

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
    agreementId: '',
    agreementName: '',
    agreementStatus: 'draft',
    agreementScope: 'unknown',
    linkRole: 'directly_financed',
    instalmentFrequency: 'monthly',
    balloonDate: '',
    interestRate: '',
    originalAmountAllocation: '',
    settlementAllocation: '',
    allocationDate: '',
    allocationNote: '',
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
    financeBoughtWhen: first(specs, 'financeBoughtWhen', 'finance_bought_when'),
    financeBoughtForExVat: first(specs, 'financeBoughtForExVat', 'finance_bought_for_ex_vat'),
  };
}

function amountText(value: number | null): string {
  return value === null ? '' : String(value);
}

function money(value: number | undefined): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function assetMeta(item: AccountantManagedAsset): string {
  return [item.yearModel ? `Year Model: ${item.yearModel}` : '', item.hours != null ? `Usage: ${Number(item.hours).toLocaleString('en-ZA')} hours` : '', item.brandName, item.modelName]
    .filter(Boolean)
    .join(' · ');
}

function financeAgreementDraft(asset: AccountantManagedAsset, agreement: FinanceAgreementOption): FinanceDraft {
  const link = agreement.links.find((item) => item.assetId === asset.id);
  return {
    ...financeDraft(asset),
    financeStatus: ['active', 'draft'].includes(agreement.agreementStatus)
      ? 'yes'
      : agreement.agreementStatus === 'settled'
        ? 'paid'
        : agreement.agreementStatus === 'cancelled'
          ? 'no'
          : 'unknown',
    agreementId: agreement.id,
    agreementName: agreement.agreementName,
    agreementStatus: agreement.agreementStatus,
    agreementScope: agreement.agreementScope,
    linkRole: link?.linkRole || 'directly_financed',
    financierName: agreement.financierName,
    financeType: agreement.agreementType,
    referenceNumber: agreement.referenceNumber,
    originalAmount: amountText(agreement.originalAmount),
    outstandingBalance: amountText(agreement.outstandingBalance),
    settlementAmount: amountText(agreement.settlementAmount),
    instalment: amountText(agreement.instalment),
    instalmentFrequency: agreement.instalmentFrequency || 'monthly',
    balloon: amountText(agreement.balloon),
    balloonDate: agreement.balloonDate,
    interestRate: amountText(agreement.interestRate),
    startDate: agreement.startDate,
    endDate: agreement.maturityDate,
    latestBalanceDate: agreement.latestBalanceDate,
    settlementDate: agreement.settlementDate,
    sourceReference: agreement.sourceReference,
    securityDescription: agreement.securityDescription,
    financeNote: agreement.financeNote,
    originalAmountAllocation: amountText(link?.originalAmountAllocation ?? null),
    settlementAllocation: amountText(link?.settlementAllocation ?? null),
    allocationDate: link?.allocationDate || '',
    allocationNote: link?.allocationNote || '',
  };
}

function ActionIcon({ type }: { type: 'finance' | 'accounting' | 'document' | 'report' | 'dispose' }) {
  const paths = {
    finance: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M7 10h10M7 15h4"/></>,
    accounting: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
    document: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
    report: <><path d="M4 19V9M10 19V4M16 19v-7M22 19H2"/></>,
    dispose: <><path d="M4 7h16M7 7l1 14h8l1-14M9 7V4h6v3"/><path d="M10 11v6M14 11v6"/></>,
  }[type];
  return <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{paths}</svg>;
}

export default function AccountantAssetManageModal({
  shareId,
  asset,
  assets,
  allowDirectUpdates,
  includeFuelLedger,
  includeCostLedger,
  onClose,
  onChanged,
}: Props) {
  const [view, setView] = useState<View>('menu');
  const [finance, setFinance] = useState<FinanceDraft>(() => financeDraft(asset));
  const [financeAgreements, setFinanceAgreements] = useState<FinanceAgreementOption[]>([]);
  const [loadingFinanceAgreements, setLoadingFinanceAgreements] = useState(false);
  const [showFinanceAdvanced, setShowFinanceAdvanced] = useState(false);
  const [linkedFinanceAssetIds, setLinkedFinanceAssetIds] = useState<string[]>([asset.id]);
  const [financeAssetPickerOpen, setFinanceAssetPickerOpen] = useState(false);
  const [financeAssetSearch, setFinanceAssetSearch] = useState('');
  const [carryingValue, setCarryingValue] = useState(asset.accountingValue ? String(asset.accountingValue.carryingValue) : '');
  const [asAtDate, setAsAtDate] = useState(asset.accountingValue?.asAtDate || new Date().toISOString().slice(0, 10));
  const [accountingSource, setAccountingSource] = useState(asset.accountingValue?.sourceReference || '');
  const [originalAccountingCost, setOriginalAccountingCost] = useState(asset.accountingValue?.originalAccountingCost == null ? '' : String(asset.accountingValue.originalAccountingCost));
  const [accumulatedDepreciation, setAccumulatedDepreciation] = useState(asset.accountingValue?.accumulatedDepreciation == null ? '' : String(asset.accountingValue.accumulatedDepreciation));
  const [sourceAccountingSystem, setSourceAccountingSystem] = useState(asset.accountingValue?.sourceAccountingSystem || '');
  const [accountantNote, setAccountantNote] = useState(asset.accountingValue?.accountantNote || '');
  const [lifecycleReason, setLifecycleReason] = useState('sold');
  const [lifecycleOutcomeInfluence, setLifecycleOutcomeInfluence] = useState<'' | 'yes' | 'no' | 'unsure'>('');
  const [lifecycleDate, setLifecycleDate] = useState(new Date().toISOString().slice(0, 10));
  const [lifecycleAmount, setLifecycleAmount] = useState('');
  const [lifecycleNote, setLifecycleNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const root = `/api/accountant/registers/${encodeURIComponent(shareId)}`;
  const reportUrl = (kind: string) => `${root}/reports?kind=${encodeURIComponent(kind)}&assetId=${encodeURIComponent(asset.id)}`;
  const documents = useMemo(() => Array.isArray(asset.documents) ? asset.documents : [], [asset.documents]);
  const selectedFinanceAssets = useMemo(
    () => assets.filter((item) => linkedFinanceAssetIds.includes(item.id)),
    [assets, linkedFinanceAssetIds],
  );
  const visibleFinanceAssets = useMemo(() => {
    const query = financeAssetSearch.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((item) => [item.title, assetMeta(item), money(item.value)].join(' ').toLowerCase().includes(query));
  }, [assets, financeAssetSearch]);

  useEffect(() => {
    if (view !== 'finance') return;
    let cancelled = false;
    setLoadingFinanceAgreements(true);
    setError('');
    fetch(`${root}/assets/${encodeURIComponent(asset.id)}/finance`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as { ok?: boolean; agreements?: FinanceAgreementOption[]; linkedAgreementIds?: string[]; error?: string };
        if (!response.ok || !data.ok) throw new Error(data.error || 'Finance Agreements could not be loaded.');
        if (cancelled) return;
        const agreements = Array.isArray(data.agreements) ? data.agreements : [];
        setFinanceAgreements(agreements);
        const linkedId = data.linkedAgreementIds?.[0];
        const linked = agreements.find((agreement) => agreement.id === linkedId);
        if (linked) {
          setFinance(financeAgreementDraft(asset, linked));
          const availableIds = new Set(assets.map((item) => item.id));
          setLinkedFinanceAssetIds(Array.from(new Set([
            asset.id,
            ...linked.links.map((item) => item.assetId).filter((id) => availableIds.has(id)),
          ])));
        } else {
          setLinkedFinanceAssetIds([asset.id]);
        }
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Finance Agreements could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoadingFinanceAgreements(false);
      });
    return () => { cancelled = true; };
  }, [asset, assets, root, view]);

  async function saveFinance(event: FormEvent) {
    event.preventDefault();
    if (!allowDirectUpdates || busy) return;
    if (finance.financeType === 'bulk_group' && linkedFinanceAssetIds.length < 2) {
      setError('Choose at least two assets for group finance.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${root}/assets/${encodeURIComponent(asset.id)}/finance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...finance,
          linkedAssetIds: finance.financeType === 'bulk_group' ? linkedFinanceAssetIds : [asset.id],
          agreementStatus: finance.financeStatus === 'paid'
            ? 'settled'
            : finance.financeStatus === 'yes'
              ? 'active'
              : finance.financeStatus === 'no'
                ? 'cancelled'
                : 'draft',
        }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Finance details could not be saved.');
      onChanged('Finance Agreement saved to the owner’s live Asset Register.');
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Finance details could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  function selectFinanceAgreement(agreementId: string) {
    if (!agreementId) {
      setFinance((current) => ({ ...financeDraft(asset), financeStatus: current.financeStatus }));
      setLinkedFinanceAssetIds([asset.id]);
      return;
    }
    const agreement = financeAgreements.find((item) => item.id === agreementId);
    if (agreement) {
      setFinance(financeAgreementDraft(asset, agreement));
      const availableIds = new Set(assets.map((item) => item.id));
      setLinkedFinanceAssetIds(Array.from(new Set([
        asset.id,
        ...agreement.links.map((item) => item.assetId).filter((id) => availableIds.has(id)),
      ])));
    }
  }

  function setFinanceType(nextFinanceType: string) {
    setFinance((current) => ({ ...current, financeType: nextFinanceType }));
    setLinkedFinanceAssetIds((current) => nextFinanceType === 'bulk_group'
      ? Array.from(new Set([asset.id, ...current]))
      : [asset.id]);
  }

  function toggleFinanceAsset(assetId: string) {
    if (assetId === asset.id) return;
    setLinkedFinanceAssetIds((current) => current.includes(assetId)
      ? current.filter((id) => id !== assetId)
      : [...current, assetId]);
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
        body: JSON.stringify({ carryingValue, asAtDate, sourceReference: accountingSource,
          originalAccountingCost, accumulatedDepreciation, sourceAccountingSystem, accountantNote }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Accounting value could not be saved.');
      onChanged('Accounting Book Value saved separately from the Aim4price Market Value.');
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Accounting value could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function saveLifecycle(event: FormEvent) {
    event.preventDefault();
    if (!allowDirectUpdates || busy) return;
    const impactQuestionRequired = ['sold', 'traded_in', 'scrapped'].includes(lifecycleReason);
    if (impactQuestionRequired && !lifecycleOutcomeInfluence) {
      setError('Tell us whether Aim4price helped with this outcome.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${root}/assets/${encodeURIComponent(asset.id)}/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: lifecycleReason,
          effectiveDate: lifecycleDate,
          amount: lifecycleAmount,
          note: lifecycleNote,
          aim4priceOutcomeInfluence: impactQuestionRequired ? lifecycleOutcomeInfluence : null,
        }),
      });
      const data = await response.json() as { ok?: boolean; mode?: 'disposed' | 'deleted'; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'The asset status could not be updated.');
      onChanged(data.mode === 'deleted' ? 'Incorrect asset record deleted. Its audit record was retained.' : 'Asset disposed and retained in historical records.');
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The asset status could not be updated.');
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

  const title = financeAssetPickerOpen ? 'Choose financed assets' : view === 'menu' ? asset.title : {
    finance: 'Finance Agreement', accounting: 'Accounting Book Value', documents: 'Documents', reports: 'Asset reports',
    dispose: 'Dispose asset', menu: asset.title,
  }[view];
  const financeHasAgreement = finance.financeStatus === 'yes' || finance.financeStatus === 'paid';

  return (
    <div className={`${styles.modalOverlay} ${styles.accountantManageOverlay}`}>
      <div className={`${styles.modalBackdrop} ${styles.accountantManageBackdrop}`} onClick={busy ? undefined : onClose} />
      <section className={`${styles.optionsModal} ${styles.accountantManageModal} ${view === 'finance' ? styles.accountantFinanceModal : ''}`} role="dialog" aria-modal="true" aria-labelledby="accountant-asset-manage-title">
        <div className={`${styles.modalHeader} ${styles.optionsModalHeader}`}>
          <div className={styles.modalHeaderText}>
            <h3 id="accountant-asset-manage-title">{title}</h3>
            <p>{financeAssetPickerOpen ? 'Select every asset covered by the same agreement.' : view === 'menu' ? 'Accountant Workspace' : asset.title}</p>
          </div>
          <button type="button" className={styles.modalCloseButton} onClick={financeAssetPickerOpen ? () => setFinanceAssetPickerOpen(false) : onClose} disabled={busy} aria-label={financeAssetPickerOpen ? 'Close financed asset picker' : 'Close asset management'}>×</button>
        </div>

        <div className={`${styles.modalScrollBody} ${styles.accountantManageBody} ${view === 'menu' ? styles.optionsScrollBody : styles.assetSettingsBody}`}>
          {view === 'menu' ? (
            <div className={styles.optionsContent}>
              {!allowDirectUpdates ? <div className={styles.accountantReadOnlyNotice}>The owner has shared this register as read-only. Reports and documents remain viewable.</div> : null}
              <div className={`${styles.optionsGrid} ${styles.assetOptionsGrid}`}>
                <button type="button" className={`${styles.optionActionButton} ${styles.optionFeaturedButton}`} onClick={() => setView('finance')}>
                  <ActionIcon type="finance"/><span><strong>Finance Agreements</strong><small>Manage finance, payment and acquisition details.</small></span>
                </button>
                <button type="button" className={styles.optionActionButton} onClick={() => setView('accounting')}>
                  <ActionIcon type="accounting"/><span><strong>Accounting Book Value</strong><small>Keep book value separate from market value.</small></span>
                </button>
                <button type="button" className={styles.optionActionButton} onClick={() => setView('documents')}>
                  <ActionIcon type="document"/><span><strong>Documents</strong><small>View or add supporting documents.</small></span>
                </button>
                <button type="button" className={styles.optionActionButton} onClick={() => setView('reports')}>
                  <ActionIcon type="report"/><span><strong>Download reports</strong><small>Download reports for this asset.</small></span>
                </button>
                <button type="button" className={styles.optionActionButton} onClick={() => { setLifecycleReason('sold'); setLifecycleOutcomeInfluence(''); setView('dispose'); }}>
                  <ActionIcon type="dispose"/><span><strong>Dispose asset</strong><small>Record a sale, trade, loss or transfer.</small></span>
                </button>
              </div>
            </div>
          ) : null}

          {view === 'finance' && financeAssetPickerOpen ? (
            <div className={`${styles.optionsContent} ${styles.accountantFinanceAssetPicker}`}>
              <div className={styles.pdfAssetDownloadToolbar}>
                <input
                  className={styles.pdfAssetSearchInput}
                  type="search"
                  value={financeAssetSearch}
                  onChange={(event) => setFinanceAssetSearch(event.target.value)}
                  placeholder="Search assets..."
                  aria-label="Search financed assets"
                  autoFocus
                />
                <div className={styles.pdfAssetDownloadToolbarActions}>
                  <button type="button" className={styles.secondaryButton} onClick={() => setLinkedFinanceAssetIds(Array.from(new Set([asset.id, ...visibleFinanceAssets.map((item) => item.id)])))}>Select all</button>
                  <button type="button" className={styles.secondaryButton} onClick={() => setLinkedFinanceAssetIds([asset.id])} disabled={linkedFinanceAssetIds.length <= 1}>Clear</button>
                </div>
              </div>
              <div className={`${styles.pdfAssetDownloadList} ${styles.accountantFinanceAssetList}`}>
                {visibleFinanceAssets.length ? visibleFinanceAssets.map((item) => {
                  const selected = linkedFinanceAssetIds.includes(item.id);
                  const required = item.id === asset.id;
                  return (
                    <label key={item.id} className={`${styles.pdfAssetDownloadRow} ${selected ? styles.pdfAssetDownloadRowSelected : ''} ${required ? styles.bulkFinanceCurrentAsset : ''}`}>
                      <input className={styles.pdfAssetDownloadCheckboxInput} type="checkbox" checked={selected} onChange={() => toggleFinanceAsset(item.id)} disabled={required || !allowDirectUpdates} />
                      <span className={styles.pdfAssetDownloadCheckbox} aria-hidden="true" />
                      <span className={styles.pdfAssetDownloadCopy}>
                        <strong>{item.title}</strong>
                        <span>{assetMeta(item) || 'Saved asset'}</span>
                        <small>{item.selectedMethod === 'manual' ? 'Manual value' : 'Aim4price value'}{required ? ' · Current asset' : ''}</small>
                      </span>
                      <span className={styles.pdfAssetDownloadValue}>
                        <strong>{money(item.value)}</strong>
                        <small>current value</small>
                      </span>
                    </label>
                  );
                }) : <div className={styles.pdfAssetDownloadEmpty}>No assets match your search.</div>}
              </div>
              <div className={`${styles.assetSettingsActions} ${styles.accountantFinancePickerActions}`}>
                <button type="button" className={styles.secondaryButton} onClick={() => setFinanceAssetPickerOpen(false)}>Back</button>
                <button type="button" className={styles.primaryButton} onClick={() => setFinanceAssetPickerOpen(false)}>{linkedFinanceAssetIds.length} selected · Done</button>
              </div>
            </div>
          ) : null}

          {view === 'finance' && !financeAssetPickerOpen ? (
            <form className={`${styles.accountantManageForm} ${styles.accountantFinanceForm}`} onSubmit={saveFinance}>
              <div className={styles.accountantReadOnlyNotice}>{allowDirectUpdates ? 'Changes update the owner’s live register and audit history.' : 'Ask the owner to enable direct updates before changing finance.'}</div>

              <section className={styles.accountantFinanceSection}>
                <div className={styles.accountantFinanceSectionHeader}><h4>Finance and acquisition</h4></div>
                <div className={styles.accountantManageGrid}>
                  <label className={styles.assetSettingsField}><span>Finance status</span><select value={finance.financeStatus} onChange={(event) => setFinance((current) => ({ ...current, financeStatus: event.target.value }))} disabled={!allowDirectUpdates}><option value="yes">Financed</option><option value="paid">Paid off</option><option value="no">Not financed</option><option value="unknown">Not sure</option></select></label>
                  <label className={styles.assetSettingsField}><span>Acquisition date <small>(optional)</small></span><input type="date" value={finance.financeBoughtWhen} onChange={(event) => setFinance((current) => ({ ...current, financeBoughtWhen: event.target.value }))} disabled={!allowDirectUpdates}/></label>
                  <label className={styles.assetSettingsField}><span>Acquisition amount <small>(optional, excl. VAT)</small></span><span className={styles.accountantCurrencyField}><b>R</b><input type="text" inputMode="decimal" value={finance.financeBoughtForExVat} onChange={(event) => setFinance((current) => ({ ...current, financeBoughtForExVat: event.target.value }))} disabled={!allowDirectUpdates} placeholder="0.00"/></span></label>
                  {financeHasAgreement ? <label className={styles.assetSettingsField}><span>Finance Agreement</span><select value={finance.agreementId} onChange={(event) => selectFinanceAgreement(event.target.value)} disabled={loadingFinanceAgreements}><option value="">Create a new agreement</option>{financeAgreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.agreementName}{agreement.referenceNumber ? ` — ${agreement.referenceNumber}` : ''}</option>)}</select></label> : null}
                  {financeHasAgreement ? <label className={styles.assetSettingsField}><span>Finance type</span><select value={finance.financeType} onChange={(event) => setFinanceType(event.target.value)} disabled={!allowDirectUpdates}><option value="">Select finance type</option><option value="asset_specific">Asset-specific finance</option><option value="bulk_group">Group finance</option><option value="unknown">Not sure</option></select></label> : null}
                  {financeHasAgreement ? <label className={styles.assetSettingsField}><span>Financier <small>(optional)</small></span><input type="text" value={finance.financierName} onChange={(event) => setFinance((current) => ({ ...current, financierName: event.target.value }))} disabled={!allowDirectUpdates} placeholder="Bank or finance house"/></label> : null}
                  {financeHasAgreement ? <label className={styles.assetSettingsField}><span>Agreement / reference <small>(optional)</small></span><input type="text" value={finance.referenceNumber} onChange={(event) => setFinance((current) => ({ ...current, referenceNumber: event.target.value }))} disabled={!allowDirectUpdates}/></label> : null}
                  {finance.financeStatus === 'yes' ? <label className={styles.assetSettingsField}><span>Current outstanding amount <small>(optional)</small></span><span className={styles.accountantCurrencyField}><b>R</b><input type="text" inputMode="decimal" value={finance.outstandingBalance} onChange={(event) => setFinance((current) => ({ ...current, outstandingBalance: event.target.value }))} disabled={!allowDirectUpdates} placeholder="0.00"/></span></label> : null}
                  {financeHasAgreement ? <label className={`${styles.assetSettingsField} ${styles.accountantFullField}`}><span>Finance note <small>(optional)</small></span><textarea value={finance.financeNote} onChange={(event) => setFinance((current) => ({ ...current, financeNote: event.target.value }))} disabled={!allowDirectUpdates}/></label> : null}
                </div>
                {financeHasAgreement && finance.financeType === 'bulk_group' ? (
                  <div className={styles.bulkFinanceLinkCard}>
                    <div>
                      <strong>Assets covered by this agreement</strong>
                      <small>Choose every asset financed as part of this group.</small>
                    </div>
                    <button type="button" className={styles.bulkFinanceChooseButton} onClick={() => { setFinanceAssetSearch(''); setFinanceAssetPickerOpen(true); }} disabled={!allowDirectUpdates}>
                      <span>{linkedFinanceAssetIds.length} selected</span>
                      <strong>Choose assets</strong>
                    </button>
                    <div className={styles.bulkFinanceSelectedAssets}>{selectedFinanceAssets.map((item) => <span key={item.id}>{item.title}</span>)}</div>
                  </div>
                ) : null}
                {finance.financeStatus === 'paid' ? <p className={styles.accountantFinanceVatNote}>Paid-off finance remains in history with no active balance.</p> : null}
              </section>

              {financeHasAgreement ? <button type="button" className={styles.assetStatusAdvancedToggle} onClick={() => setShowFinanceAdvanced((current) => !current)} aria-expanded={showFinanceAdvanced}><span>Advanced details</span><strong>{showFinanceAdvanced ? 'Hide' : 'Show'}</strong></button> : null}

              {financeHasAgreement && showFinanceAdvanced ? <>
                <section className={styles.accountantFinanceSection}>
                  <div className={styles.accountantFinanceSectionHeader}><h4>Agreement details</h4></div>
                  <div className={styles.accountantManageGrid}>
                    <label className={styles.assetSettingsField}><span>Agreement name</span><input type="text" value={finance.agreementName} onChange={(event) => setFinance((current) => ({ ...current, agreementName: event.target.value }))} disabled={!allowDirectUpdates} placeholder={`${asset.title} finance`}/></label>
                    <label className={styles.assetSettingsField}><span>Agreement scope</span><select value={finance.agreementScope} onChange={(event) => setFinance((current) => ({ ...current, agreementScope: event.target.value }))} disabled={!allowDirectUpdates}><option value="complete">All financed items are represented</option><option value="partial">Some financed items are not represented</option><option value="unknown">Unknown</option></select></label>
                    {financeAmountFields.filter(([key]) => key !== 'outstandingBalance').map(([key, label]) => <label className={styles.assetSettingsField} key={key}><span>{label}</span><span className={styles.accountantCurrencyField}><b>R</b><input type="text" inputMode="decimal" placeholder="0.00" value={finance[key]} onChange={(event) => setFinance((current) => ({ ...current, [key]: event.target.value }))} disabled={!allowDirectUpdates}/></span></label>)}
                    <label className={styles.assetSettingsField}><span>Instalment frequency</span><select value={finance.instalmentFrequency} onChange={(event) => setFinance((current) => ({ ...current, instalmentFrequency: event.target.value }))} disabled={!allowDirectUpdates}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="six_monthly">Six-monthly</option><option value="annual">Annual</option></select></label>
                    <label className={styles.assetSettingsField}><span>Interest rate <small>(reference only)</small></span><input type="text" inputMode="decimal" value={finance.interestRate} onChange={(event) => setFinance((current) => ({ ...current, interestRate: event.target.value }))} disabled={!allowDirectUpdates}/></label>
                    <label className={styles.assetSettingsField}><span>Balloon date</span><input type="date" value={finance.balloonDate} onChange={(event) => setFinance((current) => ({ ...current, balloonDate: event.target.value }))} disabled={!allowDirectUpdates}/></label>
                    {financeDateFields.map(([key, label]) => <label className={styles.assetSettingsField} key={key}><span>{label}</span><input type="date" value={finance[key]} onChange={(event) => setFinance((current) => ({ ...current, [key]: event.target.value }))} disabled={!allowDirectUpdates}/></label>)}
                    {financeRecordFields.map(([key, label]) => <label className={styles.assetSettingsField} key={key}><span>{label}</span><input type="text" value={finance[key]} onChange={(event) => setFinance((current) => ({ ...current, [key]: event.target.value }))} disabled={!allowDirectUpdates}/></label>)}
                  </div>
                  <p className={styles.accountantFinanceVatNote}>Enter agreement amounts exactly as supplied by the financier.</p>
                </section>
                <section className={styles.accountantFinanceSection}>
                  <div className={styles.accountantFinanceSectionHeader}><h4>Asset link</h4></div>
                  <div className={styles.accountantManageGrid}>
                    <label className={styles.assetSettingsField}><span>How this asset is linked</span><select value={finance.linkRole} onChange={(event) => setFinance((current) => ({ ...current, linkRole: event.target.value }))} disabled={!allowDirectUpdates}><option value="directly_financed">Directly financed</option><option value="financed_acquisition">Included in a financed acquisition</option><option value="collateral_only">Security or collateral only</option></select></label>
                    <label className={styles.assetSettingsField}><span>Allocation date</span><input type="date" value={finance.allocationDate} onChange={(event) => setFinance((current) => ({ ...current, allocationDate: event.target.value }))} disabled={!allowDirectUpdates}/></label>
                    <label className={styles.assetSettingsField}><span>Original finance allocation <small>(optional)</small></span><span className={styles.accountantCurrencyField}><b>R</b><input type="text" inputMode="decimal" value={finance.originalAmountAllocation} onChange={(event) => setFinance((current) => ({ ...current, originalAmountAllocation: event.target.value }))} disabled={!allowDirectUpdates}/></span></label>
                    <label className={styles.assetSettingsField}><span>Current settlement allocation <small>(optional)</small></span><span className={styles.accountantCurrencyField}><b>R</b><input type="text" inputMode="decimal" value={finance.settlementAllocation} onChange={(event) => setFinance((current) => ({ ...current, settlementAllocation: event.target.value }))} disabled={!allowDirectUpdates}/></span></label>
                    <label className={`${styles.assetSettingsField} ${styles.accountantFullField}`}><span>Allocation note</span><input type="text" value={finance.allocationNote} onChange={(event) => setFinance((current) => ({ ...current, allocationNote: event.target.value }))} disabled={!allowDirectUpdates}/></label>
                  </div>
                  {!finance.settlementAllocation ? <p className={styles.accountantFinanceVatNote}>Linked to agreement — no individual finance allocation available. No amount is allocated automatically.</p> : null}
                </section>
              </> : null}
              {error ? <p className={styles.assetSettingsError}>{error}</p> : null}
              <div className={styles.assetSettingsActions}><button type="button" className={styles.secondaryButton} onClick={() => setView('menu')}>Back</button>{allowDirectUpdates ? <button type="submit" className={styles.primaryButton} disabled={busy || loadingFinanceAgreements}>{busy ? 'Saving…' : 'Save finance details'}</button> : null}</div>
            </form>
          ) : null}

          {view === 'accounting' ? (
            <form className={styles.accountantManageForm} onSubmit={saveAccounting}>
              <div className={styles.accountantReadOnlyNotice}>Aim4price does not calculate accounting or tax depreciation. This is the current asset value recorded in the accounting records after depreciation.</div>
              <div className={styles.accountantManageGrid}>
                <label className={styles.assetSettingsField}><span>Original Accounting Cost <small>(optional)</small></span><input inputMode="decimal" value={originalAccountingCost} onChange={(event) => setOriginalAccountingCost(event.target.value)} disabled={!allowDirectUpdates}/></label>
                <label className={styles.assetSettingsField}><span>Accounting Book Value</span><input inputMode="decimal" value={carryingValue} onChange={(event) => setCarryingValue(event.target.value)} disabled={!allowDirectUpdates} required/></label>
                <label className={styles.assetSettingsField}><span>Book-value date</span><input type="date" value={asAtDate} onChange={(event) => setAsAtDate(event.target.value)} disabled={!allowDirectUpdates} required/></label>
                <label className={styles.assetSettingsField}><span>Accumulated depreciation <small>(optional)</small></span><input inputMode="decimal" value={accumulatedDepreciation} onChange={(event) => setAccumulatedDepreciation(event.target.value)} disabled={!allowDirectUpdates}/></label>
                <label className={styles.assetSettingsField}><span>Source accounting system <small>(optional)</small></span><input value={sourceAccountingSystem} onChange={(event) => setSourceAccountingSystem(event.target.value)} disabled={!allowDirectUpdates} placeholder="For example, Sage or Xero"/></label>
                <label className={`${styles.assetSettingsField} ${styles.accountantFullField}`}><span>Source document / reference</span><input value={accountingSource} onChange={(event) => setAccountingSource(event.target.value)} disabled={!allowDirectUpdates}/></label>
                <label className={`${styles.assetSettingsField} ${styles.accountantFullField}`}><span>Accountant note <small>(optional)</small></span><textarea value={accountantNote} onChange={(event) => setAccountantNote(event.target.value)} disabled={!allowDirectUpdates}/></label>
              </div>
              {error ? <p className={styles.assetSettingsError}>{error}</p> : null}
              <div className={styles.assetSettingsActions}><button type="button" className={styles.secondaryButton} onClick={() => setView('menu')}>Back</button>{allowDirectUpdates ? <button type="submit" className={styles.primaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save Accounting Book Value'}</button> : null}</div>
            </form>
          ) : null}

          {view === 'dispose' ? (
            <form className={styles.accountantManageForm} onSubmit={saveLifecycle}>
              <div className={styles.accountantReadOnlyNotice}>Disposed assets leave active totals but remain available in historical records. Finance Agreements are not closed automatically.</div>
              <div className={styles.accountantManageGrid}>
                <label className={styles.assetSettingsField}><span>Reason</span><select value={lifecycleReason} onChange={(event) => { const nextReason = event.target.value; setLifecycleReason(nextReason); if (!['sold', 'traded_in', 'scrapped'].includes(nextReason)) setLifecycleOutcomeInfluence(''); }} disabled={!allowDirectUpdates}><option value="sold">Sold</option><option value="traded_in">Traded in</option><option value="scrapped">Scrapped</option><option value="written_off">Written off</option><option value="stolen">Stolen</option><option value="donated">Donated</option><option value="returned_to_financier">Returned to financier</option><option value="transferred">Transferred out</option><option value="other">Other</option></select></label>
                <label className={styles.assetSettingsField}><span>Effective date</span><input type="date" value={lifecycleDate} onChange={(event) => setLifecycleDate(event.target.value)} disabled={!allowDirectUpdates} required/></label>
                {['sold', 'traded_in', 'scrapped'].includes(lifecycleReason) ? <label className={styles.assetSettingsField}><span>Did Aim4price help with this outcome in any way?</span><select value={lifecycleOutcomeInfluence} onChange={(event) => setLifecycleOutcomeInfluence(event.target.value as '' | 'yes' | 'no' | 'unsure')} disabled={!allowDirectUpdates} required><option value="">Choose an answer</option><option value="yes">Yes</option><option value="no">No</option><option value="unsure">Not sure</option></select></label> : null}
                <label className={styles.assetSettingsField}><span>Disposal proceeds <small>(optional)</small></span><span className={styles.accountantCurrencyField}><b>R</b><input type="text" inputMode="decimal" value={lifecycleAmount} onChange={(event) => setLifecycleAmount(event.target.value)} disabled={!allowDirectUpdates}/></span></label>
                <label className={`${styles.assetSettingsField} ${styles.accountantFullField}`}><span>Note <small>(optional)</small></span><textarea value={lifecycleNote} onChange={(event) => setLifecycleNote(event.target.value)} disabled={!allowDirectUpdates}/></label>
              </div>
              {error ? <p className={styles.assetSettingsError}>{error}</p> : null}
              <div className={styles.assetSettingsActions}><button type="button" className={styles.secondaryButton} onClick={() => setView('menu')}>Back</button>{allowDirectUpdates ? <button type="submit" className={styles.primaryButton} disabled={busy || (['sold', 'traded_in', 'scrapped'].includes(lifecycleReason) && !lifecycleOutcomeInfluence)}>{busy ? 'Saving…' : 'Dispose asset'}</button> : null}</div>
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
                <a className={styles.optionActionButton} href={reportUrl('market-accounting')}><ActionIcon type="report"/><span><strong>Market versus Accounting</strong><small>Market, replacement, Accounting Book Value and finance shown separately.</small></span></a>
                <a className={styles.optionActionButton} href={reportUrl('market-value-trend')}><ActionIcon type="report"/><span><strong>Market Value Trend</strong><small>Saved Aim4price Market Value movement and revaluations.</small></span></a>
                <a className={styles.optionActionButton} href={reportUrl('finance-position')}><ActionIcon type="report"/><span><strong>Finance Position and Commitments</strong><small>Agreement balances, linked assets and future instalments.</small></span></a>
                {includeCostLedger ? <a className={styles.optionActionButton} href={reportUrl('cost-of-ownership')}><ActionIcon type="report"/><span><strong>Cost of Ownership</strong><small>Incurred costs and recurring commitments remain distinct.</small></span></a> : null}
                {includeFuelLedger ? <a className={styles.optionActionButton} href={reportUrl('fuel-report')}><ActionIcon type="report"/><span><strong>Fuel Report</strong><small>Recorded fuel usage and cost summary for this asset.</small></span></a> : null}
              </div>
              <div className={styles.assetSettingsActions}><button type="button" className={styles.secondaryButton} onClick={() => setView('menu')}>Back</button></div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
