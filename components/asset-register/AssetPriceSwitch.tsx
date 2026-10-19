'use client';
import {useState} from 'react';
import PricingVatToggle from '../PricingVatToggle';
import {pricingVatAmount} from '../../lib/pricing-vat';
import type {SavedSaleability} from '../../lib/asset-saleability';
import styles from './AssetPriceSwitch.module.css';
export type AssetPriceView = 'fair' | 'market' | 'replacement';
function PriceIcon({kind='fair'}:{kind?:AssetPriceView}) {
 const path=kind==='replacement'?'M12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8M7.5 5.5l9 5':kind==='market'?'M3 3h7l11 11-7 7L3 10ZM7 7h.01':'M12 3v18M7 21h10M3 7h18M5 7l-3 7h6ZM19 7l-3 7h6Z';
 return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>;
}
type Props={value:number;manual:boolean;view:AssetPriceView;onViewChange:(value:AssetPriceView)=>void;replacementPrice:number|null;replacementParts?:{asset:number;extras:number}|null;onEditReplacement:()=>void;onRecalculate:()=>void;included:boolean;onVatChange:(value:boolean)=>void;saved?:SavedSaleability;stale:boolean;onCalculate:()=>void;canCalculate:boolean;loading:boolean;error:boolean};
export default function AssetPriceSwitch({value,manual,view,onViewChange,replacementPrice,replacementParts,onEditReplacement,onRecalculate,included,onVatChange,saved,stale,onCalculate,canCalculate,loading,error}:Props) {
 const [showInfo,setShowInfo]=useState(false);
 const market=view==='market',replacement=view==='replacement';
 const amount=market?saved?.priceExVat:replacement?replacementPrice??undefined:value;
 const money=(amount:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(pricingVatAmount(amount,included));
 const descriptions={replacement:'Estimated cost of a comparable new asset.',fair:manual?'Your manually entered asset value.':'Estimated current fair value.',market:'Estimated selling price. Actual offers may differ.'};
 const explanations={replacement:'The saved replacement price used for this asset. Includes extras where recorded in the replacement total. Check against a current supplier quotation; the accuracy of this input affects the valuation.',fair:manual?'Your manually entered value. It is not an Aim4price calculation or a guaranteed selling price.':'Estimated fair value based on replacement cost, age, usage and condition. Accuracy depends on the details supplied. Not a guaranteed selling price.',market:'An indicative asking price based on your saleability answers. Buyer demand, location, timing and negotiation may affect the final selling price.'};
 const labels={replacement:'Replacement',fair:manual?'Manual value':'Fair value',market:'Market estimate'};
 const valueSwitch = (<div className={styles.switch} role="group" aria-label="Value basis">
   {(['replacement','fair','market'] as const).map(kind=><button key={kind} data-kind={kind} type="button" title={explanations[kind]} aria-pressed={view===kind} onClick={()=>{setShowInfo(false);onViewChange(kind);}}><PriceIcon kind={kind}/><span>{labels[kind]}</span></button>)}
  </div>);
 return <section className={styles.panel} data-view={view} aria-label="Asset valuation">
  <div className={styles.valueContent}>
  {amount!==undefined?<>
   <div className={styles.amountRow}><strong aria-live="polite">{money(amount)}</strong><PricingVatToggle included={included} onChange={onVatChange}/></div>
   {valueSwitch}
   {replacement&&replacementParts?<p className={styles.breakdown}>Asset {money(replacementParts.asset)} <span>+ Extras {money(replacementParts.extras)}</span></p>:null}
   <div className={styles.summaryRow}>
   <div className={styles.explanation}><p className={styles.note}>{descriptions[view]}</p><button type="button" className={styles.info} title={explanations[view]} aria-label={`About ${labels[view].toLowerCase()}`} aria-expanded={showInfo} onClick={()=>setShowInfo(current=>!current)}>i</button></div>
   <div className={styles.meta}>
    {market&&saved?<><span>Assessed {new Date(saved.assessedAt).toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'})}</span>{stale?<span className={styles.stale}>Review needed</span>:null}</>:null}
    {canCalculate?<button type="button" onClick={replacement?onEditReplacement:market?onCalculate:onRecalculate}>{replacement?'Edit replacement price':market?'Update market estimate':manual?'Edit manual value':'Recalculate value'}</button>:null}
   </div>
   </div>
   {showInfo?<p className={styles.note} role="note">{explanations[view]}</p>:null}
  </>:<div className={styles.empty}><strong>{replacement?'Replacement price not set':loading?'Loading assessment…':error?'Assessment unavailable':'What could it sell for?'}</strong>{valueSwitch}<p>{replacement?'Add the cost of a comparable new asset.':error?'Reload to try again.':canCalculate?'Answer a few questions to estimate a selling price.':'No saved market estimate yet.'}</p>{canCalculate&&(replacement||!loading&&!error)?<button type="button" onClick={replacement?onEditReplacement:onCalculate}><PriceIcon kind={view}/>{replacement?'Add replacement price':'Calculate market estimate'}</button>:null}</div>}
  </div>
 </section>;
}
