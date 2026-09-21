import Link from 'next/link';
import InvoicePreviewButton from '../../components/InvoicePreview';
import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { getAnyServerSession } from '../../lib/auth-session';
import { listBillingInvoices, ensureBillingSchema } from '../../lib/billing';
import { getDb } from '../../lib/db';
import { money, invoiceState } from '../../lib/billing-shared';
import styles from '../admin/billing/page.module.css';
export const runtime='nodejs';export const dynamic='force-dynamic';
export default async function BillingPage({searchParams={}}:{searchParams?:Record<string,string|string[]|undefined>}){
 const session=await getAnyServerSession();if(!session?.user?.id)redirect('/auth#login');
 const page=Math.max(1,Math.min(100000,Number(searchParams.page)||1));
 const {invoices,total}=await listBillingInvoices(session.user.id,false,Math.trunc(page));
 await ensureBillingSchema();
 const preparing=(await getDb().query('select 1 from aim4price_billing_signup_jobs where user_id=$1 and processed_at is null',[session.user.id])).rowCount;
 return <><AppHeader active="none"/><main className={styles.page}><div className={styles.shell}><header className={styles.header}><h1>Aim4price Billing</h1><Link className={styles.button} href="/account">My account</Link></header><section className={styles.panel}><p>Download your Aim4price invoices and check recorded payments. No VAT applicable.</p>{preparing?<p role="status">Your signup invoice is being prepared. Refresh this page shortly. It will also be emailed to your billing address.</p>:null}<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Invoice</th><th>Due</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Invoice preview</th></tr></thead><tbody>{invoices.map(inv=><tr key={inv.id}><td>{inv.number}</td><td>{inv.dueDate}</td><td>{money(inv.totalCents)}</td><td>{money(inv.paidCents)}</td><td>{inv.status==='void'?'—':money(inv.totalCents-inv.paidCents)}</td><td>{invoiceState(inv)}{inv.status==='void'?<small>{inv.voidReason}</small>:null}</td><td>{inv.status!=='void'?<InvoicePreviewButton className={styles.button} id={inv.id} number={inv.number}/>:null}</td></tr>)}</tbody></table></div>{!invoices.length&&!preparing?<p>No invoices have been issued to your account.</p>:null}<div className={styles.actions}>{page>1?<Link className={styles.button} href={'/billing?page='+(page-1)}>Previous</Link>:null}{page*50<total?<Link className={styles.button} href={'/billing?page='+(page+1)}>Next</Link>:null}</div><p className={styles.muted}>Payments appear after Aim4price verifies receipt. For invoice queries, email <a href="mailto:Aim4price@gmail.com">Aim4price@gmail.com</a>.</p></section></div></main></>;
}
