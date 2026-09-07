'use client';

import { useEffect, useState } from 'react';
import styles from '../app/asset-register/page.module.css';
import { workspaceStyles } from './WorkspacePrimitives';

type Props = {
  shareId: string;
  registerName: string;
  includeFuelLedger: boolean;
  includeCostLedger: boolean;
  workspaceMode?: boolean;
  onClose: () => void;
};

type FinancialSummaryResponse = {
  ok: boolean;
  summary?: {
    activeAssetCount: number;
    accountingBookValueCoverage: number;
    financeAgreementCount: number;
    totalMarketValue: number;
    totalReplacementValue: number;
    totalAccountingBookValue: number;
    totalFinanceSettlement: number;
    estimatedNetAssetEquity: number;
    annualRecurringCommitments: number;
    annualFinanceCommitments: number;
    dataStatus: 'attention_required' | 'needs_information' | 'accountant_review' | 'up_to_date';
    partial: boolean;
  };
  attentionItems?: Array<{
    key: string;
    title: string;
    assetTitle?: string;
    assetId?: string;
    agreementId?: string;
    severity: 'information' | 'review' | 'attention';
  }>;
};

function money(value: number): string {
  return `R ${Math.round(Number(value || 0)).toLocaleString('en-ZA')}`;
}

function ReportIcon() {
  return <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 20h14"/></svg>;
}

function CloseIcon() {
  return <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round"/></svg>;
}

export default function AccountantRegisterReportsModal({ shareId, registerName, includeFuelLedger, includeCostLedger, workspaceMode = false, onClose }: Props) {
  const root = `/api/accountant/registers/${encodeURIComponent(shareId)}/reports`;
  const href = (kind: string) => `${root}?kind=${encodeURIComponent(kind)}`;
  const workspaceClass = (className: string) => workspaceMode ? className : '';
  const [financialSummary, setFinancialSummary] = useState<FinancialSummaryResponse | null>(null);
  const [reviewBusyKey, setReviewBusyKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/accountant/registers/${encodeURIComponent(shareId)}/financial-summary`, { cache: 'no-store' })
      .then(async (response) => response.ok ? await response.json() as FinancialSummaryResponse : null)
      .then((payload) => { if (!cancelled && payload?.ok) setFinancialSummary(payload); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [shareId]);

  const statusLabel = financialSummary?.summary?.dataStatus === 'attention_required' ? 'Needs Attention'
    : financialSummary?.summary?.dataStatus === 'needs_information' ? 'Needs Information'
      : financialSummary?.summary?.dataStatus === 'accountant_review' ? 'Accountant Review' : '';

  async function updateReviewItem(item: NonNullable<FinancialSummaryResponse['attentionItems']>[number], issueStatus: 'reviewed' | 'deferred') {
    setReviewBusyKey(item.key);
    try {
      const deferred = new Date();
      deferred.setUTCDate(deferred.getUTCDate() + 30);
      const response = await fetch(`/api/accountant/registers/${encodeURIComponent(shareId)}/review-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueKey: item.key,
          issueStatus,
          severity: item.severity,
          assetId: item.assetId,
          agreementId: item.agreementId,
          deferredUntil: issueStatus === 'deferred' ? deferred.toISOString().slice(0, 10) : '',
        }),
      });
      const payload = await response.json() as FinancialSummaryResponse;
      if (response.ok && payload.ok) setFinancialSummary(payload);
    } finally {
      setReviewBusyKey('');
    }
  }

  return (
    <div className={`${styles.modalOverlay} ${workspaceClass(workspaceStyles.modalOverlay)}`} data-website-overlay>
      <div className={styles.modalBackdrop} data-website-overlay onClick={onClose}/>
      <section className={`${styles.optionsModal} ${workspaceClass(workspaceStyles.modal)}`} role="dialog" aria-modal="true" aria-labelledby="accountant-register-reports-title">
        <div className={`${styles.modalHeader} ${styles.optionsModalHeader} ${workspaceClass(workspaceStyles.modalHeader)}`}>
          <div className={styles.modalHeaderText}><h3 id="accountant-register-reports-title">Download reports</h3><p>{registerName}</p></div>
          <button type="button" className={`${styles.modalCloseButton} ${workspaceClass(workspaceStyles.modalClose)}`} onClick={onClose} aria-label="Close reports"><CloseIcon/></button>
        </div>
        <div className={`${styles.modalScrollBody} ${styles.optionsScrollBody} ${workspaceClass(workspaceStyles.modalBody)}`}>
          <div className={styles.optionsContent}>
            {financialSummary?.summary ? (
              <section className={styles.accountantFinanceSection} aria-label="Asset and finance summary">
                <div className={styles.accountantFinanceSectionHeader}><div><h4>Asset &amp; Finance Summary</h4><p>{financialSummary.summary.partial ? 'Some totals are incomplete because source information is missing.' : 'Totals reflect the current shared client information.'}</p></div></div>
                <p className={styles.accountantFinanceVatNote}>
                  Market {money(financialSummary.summary.totalMarketValue)} · Replacement {money(financialSummary.summary.totalReplacementValue)} · Accounting Book Value {money(financialSummary.summary.totalAccountingBookValue)} · Finance settlement {money(financialSummary.summary.totalFinanceSettlement)} · Estimated equity {money(financialSummary.summary.estimatedNetAssetEquity)} · Annual commitments {money(financialSummary.summary.annualFinanceCommitments + financialSummary.summary.annualRecurringCommitments)}
                </p>
              </section>
            ) : null}
            {statusLabel && financialSummary?.summary ? (
              <div className={styles.accountantReadOnlyNotice} role="status">
                <strong>{statusLabel}</strong> — {financialSummary.attentionItems?.length ?? 0} review item{financialSummary.attentionItems?.length === 1 ? '' : 's'}.
                {' '}Accounting Book Value coverage is {financialSummary.summary.accountingBookValueCoverage} of {financialSummary.summary.activeAssetCount} assets;
                {' '}{financialSummary.summary.financeAgreementCount} active Finance Agreement{financialSummary.summary.financeAgreementCount === 1 ? '' : 's'} recorded.
                {financialSummary.attentionItems?.slice(0, 3).map((item) => (
                  <div key={item.key}>
                    {item.assetTitle ? `${item.assetTitle}: ` : ''}{item.title}{' '}
                    <button type="button" className={styles.secondaryButton} disabled={reviewBusyKey === item.key} onClick={() => void updateReviewItem(item, 'reviewed')}>Reviewed</button>{' '}
                    <button type="button" className={styles.secondaryButton} disabled={reviewBusyKey === item.key} onClick={() => void updateReviewItem(item, 'deferred')}>Defer 30 days</button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className={`${styles.optionsGrid} ${styles.assetOptionsGrid}`}>
              <a className={`${styles.optionActionButton} ${styles.optionFeaturedButton}`} href={href('market-accounting')}><ReportIcon/><span><strong>Market versus Accounting</strong><small>Market, replacement, Accounting Book Value and finance shown separately.</small></span></a>
              <a className={styles.optionActionButton} href={href('market-value-trend')}><ReportIcon/><span><strong>Market Value Trend</strong><small>Saved Aim4price Market Value movement and revaluations.</small></span></a>
              <a className={styles.optionActionButton} href={href('finance-position')}><ReportIcon/><span><strong>Finance Position and Commitments</strong><small>Agreement balances, linked assets and future instalments.</small></span></a>
              {includeCostLedger ? <a className={styles.optionActionButton} href={href('cost-of-ownership')}><ReportIcon/><span><strong>Cost of Ownership</strong><small>Incurred costs and recurring commitments remain distinct.</small></span></a> : null}
              {includeFuelLedger ? <a className={styles.optionActionButton} href={href('fuel-report')}><ReportIcon/><span><strong>Fuel Report</strong><small>Asset-level fuel usage and recorded cost summary.</small></span></a> : null}
              <a className={styles.optionActionButton} href={href('asset-register')}><ReportIcon/><span><strong>Asset Register</strong><small>Active asset records with ownership, status and values.</small></span></a>
              {includeFuelLedger ? <a className={styles.optionActionButton} href={href('fuel-ledger')}><ReportIcon/><span><strong>Fuel Ledger</strong><small>Detailed storage and asset fuel transactions.</small></span></a> : null}
              {includeCostLedger ? <a className={styles.optionActionButton} href={href('cost-ledger')}><ReportIcon/><span><strong>Cost Ledger</strong><small>Detailed supplier invoices and recorded incurred costs.</small></span></a> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

