import BillingOverview from './billing-overview';
import { redirect } from 'next/navigation';
import { getAnyServerSession } from '../../lib/auth-session';
import { listBillingInvoices, ensureBillingSchema } from '../../lib/billing';
import { getDb } from '../../lib/db';
export const runtime='nodejs';export const dynamic='force-dynamic';
export default async function BillingPage({searchParams={}}:{searchParams?:Record<string,string|string[]|undefined>}){
 const session=await getAnyServerSession();if(!session?.user?.id)redirect('/auth#login');
 const page=Math.max(1,Math.min(100000,Number(searchParams.page)||1));
 const {invoices,total}=await listBillingInvoices(session.user.id,false,Math.trunc(page));
 await ensureBillingSchema();
 const preparing=(await getDb().query('select 1 from aim4price_billing_signup_jobs where user_id=$1 and processed_at is null',[session.user.id])).rowCount;
 return <BillingOverview invoices={invoices} total={total} page={page} preparing={Boolean(preparing)}/>;
}
