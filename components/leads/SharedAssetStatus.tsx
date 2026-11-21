import assetStyles from '../../app/asset-register/page.module.css';
import styles from '../../app/leads/page.module.css';
export type SharedStatus = 'new' | 'viewed' | 'all';
export default function SharedAssetStatus({statusFilter,chooseLeadStatusFilter,newLeadCount,viewedLeadCount,total}:{statusFilter:string;chooseLeadStatusFilter:(status:SharedStatus)=>void;newLeadCount:number;viewedLeadCount:number;total:number}) {
  return (<section className={`${assetStyles.summaryRow} ${assetStyles.heroSummaryRow} ${styles.leadSummaryRow}`} aria-label="Shared asset summary">
              <button type="button" className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${styles.leadOwnerSummaryCard} ${styles.leadOwnerSummaryCardNew} ${styles.leadSummaryFilterButton} ${statusFilter === 'new' ? styles.leadSummaryFilterButtonActive : ''}`} onClick={() => chooseLeadStatusFilter('new')} aria-pressed={statusFilter === 'new'}>
                <span className={assetStyles.heroSummaryHead}>
                  <span className={`${assetStyles.heroSummaryTitle} ${styles.leadOwnerSummaryText}`}>New</span>
                </span>
                <span className={assetStyles.heroSummaryValueRow}>
                  <strong className={`${assetStyles.heroSummaryValue} ${styles.leadOwnerSummaryText}`}>{newLeadCount}</strong>
                </span>
                <span className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${styles.leadOwnerSummaryFooter}`}>
                  <small className={styles.leadOwnerSummaryText}>Shared assets not yet viewed.</small>
                </span>
              </button>

              <button type="button" className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${styles.leadOwnerSummaryCard} ${styles.leadOwnerSummaryCardOpen} ${styles.leadSummaryFilterButton} ${statusFilter === 'viewed' ? styles.leadSummaryFilterButtonActive : ''}`} onClick={() => chooseLeadStatusFilter('viewed')} aria-pressed={statusFilter === 'viewed'}>
                <span className={assetStyles.heroSummaryHead}>
                  <span className={`${assetStyles.heroSummaryTitle} ${styles.leadOwnerSummaryText}`}>Viewed</span>
                </span>
                <span className={assetStyles.heroSummaryValueRow}>
                  <strong className={`${assetStyles.heroSummaryValue} ${styles.leadOwnerSummaryText}`}>{viewedLeadCount}</strong>
                </span>
                <span className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${styles.leadOwnerSummaryFooter}`}>
                  <small className={styles.leadOwnerSummaryText}>Shared assets you have viewed.</small>
                </span>
              </button>

              <button type="button" className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${styles.leadOwnerSummaryCard} ${styles.leadOwnerSummaryCardDone} ${styles.leadSummaryFilterButton} ${statusFilter === 'all' ? styles.leadSummaryFilterButtonActive : ''}`} onClick={() => chooseLeadStatusFilter('all')} aria-pressed={statusFilter === 'all'}>
                <span className={assetStyles.heroSummaryHead}>
                  <span className={`${assetStyles.heroSummaryTitle} ${styles.leadOwnerSummaryText}`}>All shared</span>
                </span>
                <span className={assetStyles.heroSummaryValueRow}>
                  <strong className={`${assetStyles.heroSummaryValue} ${styles.leadOwnerSummaryText}`}>{total}</strong>
                </span>
                <span className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${styles.leadOwnerSummaryFooter}`}>
                  <small className={styles.leadOwnerSummaryText}>All assets shared with you.</small>
                </span>
              </button>
            </section>);
}
