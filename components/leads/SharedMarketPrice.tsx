'use client';
import {useState} from 'react';
import {createPortal} from '../WebsitePortal';
import AssetDetailIcon from '../asset-register/AssetDetailIcon';
import LeadActionDialog from './LeadActionDialog';
import {pricingVatAmount} from '../../lib/pricing-vat';
import type {SharedMarketAssessment} from '../../lib/shared-market-assessment';
import styles from '../asset-register/AssetCardDetails.module.css';
import summaryStyles from './SharedMarketPrice.module.css';

export default function SharedMarketPrice({assessment, assetTitle, vatIncluded}: {assessment:SharedMarketAssessment;assetTitle:string;vatIncluded:boolean}) {
  const [open,setOpen]=useState(false);
  const amount=new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(pricingVatAmount(assessment.priceExVat,vatIncluded));
  const date=new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(assessment.assessedAt));
  return <>
    <div data-needs-review={assessment.needsReview} className={`${summaryStyles.market} ${styles.marketDetail} ${assessment.needsReview?styles.marketNeedsUpdate:''}`}>
      <button type="button" className={styles.marketOpen} onClick={()=>setOpen(true)} aria-label={`View saved realistic market value for ${assetTitle}`}>
        <span className={styles.marketHeading}><AssetDetailIcon kind="market"/><span className={styles.marketTitle}><strong>Realistic Market Value</strong></span></span>
        <span className={styles.marketAmount}><strong>{amount}</strong><small>{vatIncluded?'Incl. VAT':'Excl. VAT'}</small>{assessment.needsReview&&<small className={styles.reviewNeeded}>Owner review needed</small>}</span>
      </button>
    </div>
    {open&&createPortal(<LeadActionDialog title="Realistic Market Value" titleIcon={<AssetDetailIcon kind="market"/>} assetTitle={assetTitle} onClose={()=>setOpen(false)} closeLabel="Close market value">
      <div className={summaryStyles.summary}>
        <div className={summaryStyles.amount}><strong>{amount}</strong><span>{vatIncluded?'Incl. VAT':'Excl. VAT'}</span></div>
        <p>Saved by the owner on {date}.</p>
        {assessment.needsReview&&<p className={summaryStyles.review}>The asset details have changed since this assessment. Ask the owner to review the estimate.</p>}
        <p>This saved estimate reflects the asset details and selling circumstances at the time of assessment. It is not a guaranteed selling price.</p>
        <p>Only the owner can update this assessment.</p>
      </div>
    </LeadActionDialog>,document.body)}
  </>;
}
