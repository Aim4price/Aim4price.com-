'use client';

import type {SavedSaleability} from '../../lib/asset-saleability';
import {pricingVatAmount} from '../../lib/pricing-vat';
import AssetDetailIcon from './AssetDetailIcon';
import styles from './AssetCardDetails.module.css';

type Props = {
  saved?: SavedSaleability;
  stale: boolean;
  included: boolean;
  loading: boolean;
  error: boolean;
  canCalculate: boolean;
  onCalculate: () => void;
};

export default function AssetMarketDetail({saved, stale, included, loading, error, canCalculate, onCalculate}: Props) {
  const needsUpdate = Boolean(saved && stale);
  const money = saved ? new Intl.NumberFormat('en-ZA', {style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(pricingVatAmount(saved.priceExVat, included)) : null;
  return <div className={`${styles.marketDetail} ${needsUpdate ? styles.marketNeedsUpdate : ''}`} aria-label="Estimated selling price">
    <button type="button" className={styles.marketOpen} disabled={!canCalculate || (!saved && (loading || error))} onClick={onCalculate} aria-haspopup={canCalculate?'dialog':undefined} aria-label={canCalculate ? (needsUpdate ? 'Update needed: open saleability assessment' : 'Open saleability assessment') : 'Saleability estimate'}>
      <span className={styles.marketHeading}>
        <AssetDetailIcon kind={needsUpdate ? "alert" : "market"}/>
        <span className={styles.marketTitle}><strong>SALEABILITY</strong>{needsUpdate ? <small>Previous estimate</small> : null}</span>
      </span>
      <span className={styles.marketAmount}>
        {saved ? <>
          <strong aria-live="polite">{money}</strong>
          <small>{included ? 'Incl. VAT' : 'Excl. VAT'}</small>
          {needsUpdate ? <small className={styles.reviewNeeded} role="status">Update needed</small> : null}
        </> : loading ? <span role="status">Loading…</span> : error ? <span role="status">Unavailable. Reload to retry.</span> : canCalculate ? <span className={styles.calculateMarket}><AssetDetailIcon kind="calculator"/>Calculate</span> : <span>Not calculated</span>}
      </span>
    </button>
  </div>;
}
