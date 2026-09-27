import InvoicePreviewButton from './InvoicePreview';
import { billingDate, invoiceState, money, type BillingInvoice } from '../lib/billing-shared';
import styles from './BillingInvoiceCard.module.css';

export default function BillingInvoiceCard({invoice,showPreview=true,embedded=false}:{invoice:BillingInvoice;showPreview?:boolean;embedded?:boolean}) {
 const state=invoiceState(invoice);
 return <article className={`${styles.card} ${embedded?styles.embedded:''}`}>
  {!embedded?<header className={styles.header}><div><span className={styles.eyebrow}>Invoice</span><h3>{invoice.number}</h3>{invoice.customer.businessName?<p>{invoice.customer.businessName}</p>:null}</div><span className={styles.status} data-state={state}>{state}</span></header>:null}
  <div className={styles.body}><div className={styles.balance}><span>Outstanding balance</span><strong>{invoice.status==='void'?'—':money(invoice.totalCents-invoice.paidCents)}</strong><span>Due {billingDate(invoice.dueDate)}</span></div><dl className={styles.details}><div><dt>Invoice total</dt><dd>{money(invoice.totalCents)}</dd></div><div><dt>Recorded payments</dt><dd>{money(invoice.paidCents)}</dd></div>{invoice.customer.reference?<div><dt>Your reference</dt><dd>{invoice.customer.reference}</dd></div>:null}</dl></div>
  <footer className={styles.footer}><span>{invoice.status==='void'?invoice.voidReason:'No VAT applicable'}</span>{showPreview&&invoice.status!=='void'?<InvoicePreviewButton id={invoice.id} number={invoice.number} className={styles.button}/>:null}</footer>
 </article>;
}
