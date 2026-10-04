'use client';
import CardVatToggle from '../CardVatToggle';
import {pricingVatAmount} from '../../lib/pricing-vat';
import asset from '../../app/asset-register/page.module.css';
import leads from '../../app/leads/page.module.css';
import styles from './SharedCardValue.module.css';
export default function SharedCardValue({value,included,onToggle}:{value:number|null;included:boolean;onToggle:()=>void}) {
 return <div className={`${asset.valueBlock} ${leads.leadValueBlock} ${styles.value}`}>
  <strong>{value==null?'Not saved':`R ${new Intl.NumberFormat('en-ZA',{maximumFractionDigits:0}).format(pricingVatAmount(value,included)).replace(/[,\s]/g,' ')}`}</strong>
  <span>{included?'Incl. VAT':'Excl. VAT'}</span>
  <CardVatToggle included={included} onToggle={onToggle}/>
 </div>;
}
