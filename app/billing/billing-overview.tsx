import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import BillingInvoiceCard from '../../components/BillingInvoiceCard';
import type { BillingInvoice } from '../../lib/billing-shared';
import styles from './page.module.css';

export default function BillingOverview({invoices,total,page,preparing}:{invoices:BillingInvoice[];total:number;page:number;preparing:boolean}) {
 return <><AppHeader active="none"/><main className={styles.page}>
  <div className={styles.shell}>
   <header className={styles.header}>
    <div><span className={styles.eyebrow}>Aim4price Billing</span><h1>Your invoices</h1><p>Invoices, payment details and recorded payments.</p></div>
    <Link className={styles.button} href="/account">My account</Link>
   </header>
   <section className={styles.panel} aria-label="Your invoices">
    <div className={styles.listHeader}><h2>Invoice history</h2><span>{total} {total===1?'invoice':'invoices'}</span></div>
    {preparing?<p className={styles.notice} role="status">Your signup invoice is being prepared. Refresh shortly to view it here.</p>:null}
    <div className={styles.list}>{invoices.map(invoice=><BillingInvoiceCard key={invoice.id} invoice={invoice}/>)}</div>
    {!invoices.length&&!preparing?<div className={styles.empty}><h3>No invoices yet</h3><p>Issued invoices and their payment details will appear here.</p></div>:null}
    {page>1||page*50<total?<nav className={styles.pagination} aria-label="Invoice pages">{page>1?<Link className={styles.button} href={'/billing?page='+(page-1)}>Previous</Link>:null}<span>Page {page}</span>{page*50<total?<Link className={styles.button} href={'/billing?page='+(page+1)}>Next</Link>:null}</nav>:null}
   </section>
   <p className={styles.note}>Payments appear once verified by Aim4price. Questions? <a href="mailto:Aim4price@gmail.com">Email billing support</a>.</p>
  </div>
 </main></>;
}
