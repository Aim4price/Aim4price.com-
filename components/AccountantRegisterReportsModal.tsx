'use client';

import styles from '../app/asset-register/page.module.css';

type Props = {
  shareId: string;
  registerName: string;
  includeFuelLedger: boolean;
  includeCostLedger: boolean;
  onClose: () => void;
};

function ReportIcon() {
  return <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 20h14"/></svg>;
}

export default function AccountantRegisterReportsModal({ shareId, registerName, includeFuelLedger, includeCostLedger, onClose }: Props) {
  const root = `/api/accountant/registers/${encodeURIComponent(shareId)}/reports`;
  const href = (kind: string) => `${root}?kind=${encodeURIComponent(kind)}`;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalBackdrop} onClick={onClose}/>
      <section className={styles.optionsModal} role="dialog" aria-modal="true" aria-labelledby="accountant-register-reports-title">
        <div className={`${styles.modalHeader} ${styles.optionsModalHeader}`}>
          <div className={styles.modalHeaderText}><h3 id="accountant-register-reports-title">Download reports</h3><p>{registerName}</p></div>
          <button type="button" className={styles.modalCloseButton} onClick={onClose} aria-label="Close reports">×</button>
        </div>
        <div className={`${styles.modalScrollBody} ${styles.optionsScrollBody}`}>
          <div className={styles.optionsContent}>
            <div className={`${styles.optionsGrid} ${styles.assetOptionsGrid}`}>
              <a className={`${styles.optionActionButton} ${styles.optionFeaturedButton}`} href={href('depreciation')}><ReportIcon/><span><strong>Asset Depreciation Schedule</strong><small>Aim4price market-value movement, not tax depreciation.</small></span></a>
              <a className={styles.optionActionButton} href={href('additions-disposals')}><ReportIcon/><span><strong>Additions &amp; Disposals</strong><small>Acquisitions, additions and retained disposal history.</small></span></a>
              <a className={styles.optionActionButton} href={href('financed-paid-off')}><ReportIcon/><span><strong>Financed versus Paid Off</strong><small>Finance status, balances and group facility references.</small></span></a>
              <a className={styles.optionActionButton} href={href('market-accounting')}><ReportIcon/><span><strong>Market Value versus Accounting Value</strong><small>Market, replacement, carrying and finance values kept separate.</small></span></a>
              {includeCostLedger ? <a className={styles.optionActionButton} href={href('cost-of-ownership')}><ReportIcon/><span><strong>Cost of Ownership</strong><small>Recorded maintenance, parts, repairs and other costs.</small></span></a> : null}
              {includeFuelLedger ? <a className={styles.optionActionButton} href={href('fuel')}><ReportIcon/><span><strong>Fuel Report</strong><small>Read-only recorded fuel issues and supporting records.</small></span></a> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
