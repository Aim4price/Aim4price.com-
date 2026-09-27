import { getDb } from './db';
import { ensureAccountProfileColumns } from './account-profile';
import { BillingError, billingId, ensureBillingSchema } from './billing';

export async function hardDeleteBillingInvoice(input:Record<string,unknown>,actor:string) {
 const id=billingId(input.id),reason=typeof input.reason==='string'?input.reason.trim():'';
 if(reason.length<5||reason.length>500)throw new BillingError('Give a deletion reason between 5 and 500 characters.');
 if(input.confirmed!==true)throw new BillingError('Confirm permanent deletion.');
 await Promise.all([ensureBillingSchema(),ensureAccountProfileColumns()]);
 const db=await getDb().connect();
 try{
  await db.query('begin');
  // Use the same period lock as scheduled generation before taking the invoice lock.
  const initial=(await db.query('select generation_key from aim4price_billing_invoices where id=$1',[id])).rows[0];
  if(initial?.generation_key)await db.query('select pg_advisory_xact_lock(hashtext($1))',['billing-generation:'+initial.generation_key]);
  const row=(await db.query('select * from aim4price_billing_invoices where id=$1 for update',[id])).rows[0];
  if(!row)throw new BillingError('Invoice no longer exists. Refresh billing.');
  if(input.version!==row.version)throw new BillingError('This invoice changed. Refresh before deleting it.');
  if(input.confirmation!==(row.number||'DELETE'))throw new BillingError('Type the invoice number exactly to confirm deletion.');
  const mail=(await db.query('select status from aim4price_billing_mail where invoice_id=$1 for update',[id])).rows;
  if(mail.some(item=>item.status==='sending'))throw new BillingError('Email sending is in progress. Wait for it to finish before deleting this invoice.');
  await db.query('insert into aim4price_billing_deletions(invoice_id,number,generation_key,actor_id,reason) values($1,$2,$3,$4,$5)',[id,row.number,row.generation_key,actor,reason]);
  await db.query('delete from aim4price_billing_mail where invoice_id=$1',[id]);
  await db.query('delete from aim4price_billing_payments where invoice_id=$1',[id]);
  await db.query('delete from aim4price_billing_events where invoice_id=$1',[id]);
  await db.query('delete from aim4price_billing_work where invoice_id=$1',[id]);
  await db.query('update account_profiles set billing_suspension_invoice_id=null,suspension_reason=null,updated_at=now() where billing_suspension_invoice_id=$1',[id]);
  // Inbox tables may not yet exist on a new installation. Read-time filtering also
  // hides stale snapshots created concurrently with this transaction.
  if((await db.query("select to_regclass('public.user_notifications') as table_name")).rows[0]?.table_name)
   await db.query('delete from public.user_notifications where event_key=$1',['billing-invoice:'+id]);
  await db.query('delete from aim4price_billing_invoices where id=$1',[id]);
  await db.query('commit');
 }catch(error){await db.query('rollback');throw error;}finally{db.release();}
}
