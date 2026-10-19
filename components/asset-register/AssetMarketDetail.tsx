'use client';

import {useState} from 'react';
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
  const [showInfo, setShowInfo] = useState(false);
  const money = saved ? new Intl.NumberFormat('en-ZA', {style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(pricingVatAmount(saved.priceExVat, included)) : null;
  return <div className={styles.marketDetail} aria-label="Estimated selling price">
    <div className={styles.marketHeading}>
      <AssetDetailIcon kind="market"/>
      <span>Estimated selling price</span>
      <button className={styles.priceInfo} type="button" aria-label="About estimated selling price" aria-expanded={showInfo} onClick={()=>setShowInfo(value=>!value)}>i</button>
    </div>
    <div className={styles.marketAmount}>
      {saved ? <>
        <strong aria-live="polite">{money}</strong>
        <small>{included ? 'Incl. VAT' : 'Excl. VAT'}</small>
        {stale ? <small className={styles.reviewNeeded}>Review needed</small> : null}
        {canCalculate ? <button className={styles.updateMarket} type="button" onClick={onCalculate}>Update estimate</button> : null}
      </> : loading ? <span role="status">Loading…</span> : error ? <span role="status">Unavailable. Reload to retry.</span> : canCalculate ? (
        <button className={styles.calculateMarket} type="button" onClick={onCalculate}><AssetDetailIcon kind="calculator"/>Calculate</button>
      ) : <span>Not calculated</span>}
    </div>
    {showInfo ? <p className={styles.marketInfo} role="note">
      Indicative selling price based on your saleability answers. Actual offers may differ.
      {saved ? <> Assessed {new Date(saved.assessedAt).toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'})}.</> : null}
      {stale ? ' Asset details have changed. Update the estimate.' : null}
    </p> : null}
  </div>;
}
