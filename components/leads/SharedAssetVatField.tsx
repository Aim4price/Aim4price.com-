'use client';
import {useState} from 'react';
import ModalSelect from '../AssetModalSelect';
import styles from '../../app/asset-register/page.module.css';
import refinements from '../../app/asset-register/asset-update-refinements.module.css';
import {pricingVatAmount,pricingInputExVat} from '../../lib/pricing-vat';

// Match the owner editor: whole-rand entry, with the saved amount always excluding VAT.
export default function SharedAssetVatField({label,value,onChange,className='',target,disabled=false}:{label:string;value:string;onChange?:(value:string)=>void;className?:string;target?:string;disabled?:boolean}) {
 const [included,setIncluded]=useState(false);
 const [entry,setEntry]=useState<{canonical:string;included:boolean;text:string}|null>(null);
 const format=(amount:number)=>new Intl.NumberFormat('en-ZA',{maximumFractionDigits:0}).format(amount).replace(/[,\s]/g,' ');
 const displayed=entry?.canonical===value&&entry.included===included?entry.text:value===''?'':format(pricingVatAmount(Number(value),included));
 return <div className={`${styles.field} ${className} ${refinements.vatValueField}`} data-asset-detail-edit-target={target}>
  <span>{label}</span>
  <div className={refinements.vatValueRow}>
   <ModalSelect label={`${label} VAT`} buttonLabel={`${label} VAT`} className={refinements.vatValueSelect} value={included?'included':'excluded'} options={[{value:'excluded',label:'Excl. VAT'},{value:'included',label:'Incl. VAT'}]} onChange={mode=>{setIncluded(mode==='included');setEntry(null);}}/>
   <div className={styles.manualCurrencyInput}><span>R</span><input aria-label={label} type="text" inputMode="numeric" value={displayed} readOnly={!onChange} disabled={disabled} placeholder="Not saved" onChange={event=>{const digits=event.target.value.replace(/[^0-9]/g,'');const text=digits?format(Number(digits)):'';const canonical=digits?String(pricingInputExVat(Number(digits),included)):'';setEntry({canonical,included,text});onChange?.(canonical);}}/></div>
  </div>
 </div>;
}
