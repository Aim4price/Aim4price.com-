'use client';
import PricingVatToggle from '../PricingVatToggle';
import {pricingVatAmount} from '../../lib/pricing-vat';
import type {SavedSaleability} from '../../lib/asset-saleability';
import styles from './AssetPriceSwitch.module.css';
function PriceIcon({market=false}:{market?:boolean}) {return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={market?'M3 3h7l11 11-7 7L3 10ZM7 7h.01':'M12 3v18M7 21h10M3 7h18M5 7l-3 7h6ZM19 7l-3 7h6Z'}/></svg>;}
export default function AssetPriceSwitch({value,manual,market,onMarketChange,included,onVatChange,saved,stale,onCalculate,canCalculate,loading,error}:{value:number;manual:boolean;market:boolean;onMarketChange:(value:boolean)=>void;included:boolean;onVatChange:(value:boolean)=>void;saved?:SavedSaleability;stale:boolean;onCalculate:()=>void;canCalculate:boolean;loading:boolean;error:boolean}) {
 const amount=market?saved?.priceExVat:value;
 const disclaimer=market?'An indicative asking price based on your saleability answers. Actual offers may differ.':manual?'Your manually entered value. It is not an Aim4price calculation or a guaranteed selling price.':'Estimated fair value based on replacement cost, age, usage and condition. Not a guaranteed selling price.';
 return <section className={styles.panel} data-market={market} aria-label="Asset valuation">
  <div className={styles.switch} role="group" aria-label="Value basis">
   <button type="button" aria-pressed={!market} onClick={()=>onMarketChange(false)}><PriceIcon/>{manual?'Manual value':'Fair value'}</button>
   <button type="button" aria-pressed={market} onClick={()=>onMarketChange(true)}><PriceIcon market/>Market estimate</button>
  </div>
  {amount!==undefined?<>
   <div className={styles.amountRow}><strong aria-live="polite">{new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(pricingVatAmount(amount,included))}</strong><PricingVatToggle included={included} onChange={onVatChange}/></div>
   <p className={styles.note}>{disclaimer}</p>
   {market&&saved?<div className={styles.meta}><span>Assessed {new Date(saved.assessedAt).toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'})}</span>{stale?<span className={styles.stale}>Review needed</span>:null}{canCalculate?<button type="button" onClick={onCalculate}>Update</button>:null}</div>:null}
  </>:<div className={styles.empty}><strong>{loading?'Loading assessment…':error?'Assessment unavailable':'What could it sell for?'}</strong><p>{error?'Reload to try again.':canCalculate?'Answer a few questions to estimate a selling price.':'No saved market estimate yet.'}</p>{canCalculate&&!loading&&!error?<button type="button" onClick={onCalculate}><PriceIcon market/>Calculate market estimate</button>:null}</div>}
 </section>;
}
