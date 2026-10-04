'use client';
import CardVatToggle from '../CardVatToggle';
import {pricingVatAmount} from '../../lib/pricing-vat';
import asset from '../../app/asset-register/page.module.css';
import leads from '../../app/leads/page.module.css';
import styles from './SharedCardValue.module.css';
export default function SharedCardValue({value,included,onToggle,onOpen}:{value:number|null;included:boolean;onToggle:()=>void;onOpen?:()=>void}) {
 return <div className={`${asset.valueBlock} ${leads.leadValueBlock} ${styles.value}`}>
  <strong role={onOpen?'button':undefined} tabIndex={onOpen?0:undefined} aria-label={onOpen?'Change current value':undefined} onClick={onOpen} onKeyDown={e=>{if(onOpen&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onOpen();}}}>{value==null?'Not saved':`R ${new Intl.NumberFormat('en-ZA',{maximumFractionDigits:0}).format(pricingVatAmount(value,included)).replace(/[,\s]/g,' ')}`}</strong>
  <span>{included?'Incl. VAT':'Excl. VAT'}</span>
  <CardVatToggle included={included} onToggle={onToggle}/>
 </div>;
}
