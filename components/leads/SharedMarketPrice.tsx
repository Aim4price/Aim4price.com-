'use client';
import {useState} from 'react';
import {createPortal} from '../WebsitePortal';
import SharedMarketPriceEditor from './SharedMarketPriceEditor';
import LeadActionDialog from './LeadActionDialog';
import {pricingVatAmount} from '../../lib/pricing-vat';
import type {SharedMarketAssessment} from '../../lib/shared-market-assessment';
import styles from '../asset-register/AssetCardDetails.module.css';
import summaryStyles from './SharedMarketPrice.module.css';

export default function SharedMarketPrice({assessment, assetTitle, vatIncluded, editEndpoint, onSaved}: {assessment?:SharedMarketAssessment;assetTitle:string;vatIncluded:boolean;editEndpoint?:string;onSaved?:()=>void}) {
  const [open,setOpen]=useState(false),[editing,setEditing]=useState(false);
  const [saved,setSaved]=useState<SharedMarketAssessment>();
  assessment=saved||assessment;
  const amount=assessment ? new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(pricingVatAmount(assessment.priceExVat,vatIncluded)) : 'Not assessed';
  const date=assessment ? new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(assessment.assessedAt)) : '';
  return <>
    <div data-needs-review={assessment?.needsReview} className={`${summaryStyles.market} ${styles.marketDetail} ${assessment?.needsReview?styles.marketNeedsUpdate:''}`}>
      <button type="button" className={styles.marketOpen} onClick={()=>setOpen(true)} aria-label={`View saved realistic market price for ${assetTitle}`}>
        <span className={styles.marketHeading}><span className={styles.marketTitle}><strong>Realistic Market Price</strong></span></span>
        <span className={styles.marketAmount}><strong>{amount}</strong><small>{vatIncluded?'Incl. VAT':'Excl. VAT'}</small>{assessment?.needsReview&&<small className={styles.reviewNeeded}>Owner review needed</small>}</span>
      </button>
    </div>
    {open&&createPortal(<LeadActionDialog title="Realistic Market Price" assetTitle={assetTitle} onClose={()=>setOpen(false)} closeLabel="Close market price">
      <div className={summaryStyles.summary}>
        <div className={summaryStyles.amount}><strong>{amount}</strong><span>{vatIncluded?'Incl. VAT':'Excl. VAT'}</span></div>
        {assessment && <p>Assessment saved on {date}.</p>}
        {assessment?.needsReview&&<p className={summaryStyles.review}>The asset details have changed since this assessment. Review the estimate before relying on it.</p>}
        <p>This saved estimate reflects the asset details and selling circumstances at the time of assessment. It is not a guaranteed selling price.</p>
        {editEndpoint ? <button type="button" className={summaryStyles.editButton} onClick={()=>{setOpen(false);setEditing(true);}}>Update market price</button> : <p>The owner has not enabled market price updates for this link.</p>}
      </div>
    </LeadActionDialog>,document.body)}
    {editing && editEndpoint && createPortal(<SharedMarketPriceEditor endpoint={editEndpoint} assetTitle={assetTitle} onClose={()=>setEditing(false)} onSaved={value=>{setSaved(value);onSaved?.();}}/>,document.body)}
  </>;
}
