import { getDb } from './db';
import { ensureBillingSchema, processSignupInvoices, mapInvoice } from './billing';
import { renderReportHtmlToPdf } from './report-pdf';
import { getSiteOrigin } from './email';
import { billingEscape } from './billing-report';
import { money } from './billing-shared';

export async function billingPdf(id: string): Promise<Buffer> {
  await ensureBillingSchema();
  const row=(await getDb().query('select pdf,report_html from aim4price_billing_invoices where id=$1',[id])).rows[0];
  if(!row?.report_html)throw new Error('Invoice has not been issued.');
  if(row.pdf)return Buffer.from(row.pdf);
  const pdf=await renderReportHtmlToPdf(row.report_html);
  // The first stored PDF wins, including concurrent preview/send renders.
  const result=await getDb().query('update aim4price_billing_invoices set pdf=coalesce(pdf,$2) where id=$1 returning pdf',[id,pdf]);
  return Buffer.from(result.rows[0].pdf);
}
export async function dispatchBillingMail(): Promise<void> {
  await ensureBillingSchema();
  for(let i=0;i<5;i++) {
    const db=await getDb().connect();let mail;
    try {
      await db.query('begin');
      const result=await db.query(`select m.* from aim4price_billing_mail m where
        ((status in ('queued','retry') and next_attempt_at<=now()) or (status='sending' and locked_until<now()))
        order by created_at for update skip locked limit 1`);
      mail=result.rows[0];
      if(!mail){await db.query('commit');break;}
      if(mail.first_attempt_at && Date.now()-new Date(mail.first_attempt_at).getTime()>23*3600000){
        await db.query("update aim4price_billing_mail set status='needs_review',last_error='Automatic retry window expired. Check Resend before resending.' where id=$1",[mail.id]);await db.query('commit');continue;
      }
      await db.query("update aim4price_billing_mail set status='sending',locked_until=now()+interval '5 minutes',attempts=attempts+1 where id=$1",[mail.id]);await db.query('commit');
    } catch(error){await db.query('rollback');throw error;} finally{db.release();}
    try {
      const invoice=(await getDb().query('select * from aim4price_billing_invoices where id=$1',[mail.invoice_id])).rows[0];
      if(invoice?.status!=='issued'||!invoice.user_id)throw new Error('Invoice is void or the account was deleted. Review required.');
      const key=process.env.RESEND_API_KEY?.trim();
      if(!key)throw new Error('RESEND_API_KEY is not configured.');
      let payload=mail.payload;
      if(!payload){
        const pdf=await billingPdf(invoice.id),url=getSiteOrigin()+'/billing';
        payload=JSON.stringify({from:process.env.AIM4PRICE_BILLING_EMAIL_FROM||process.env.AIM4PRICE_EMAIL_FROM||'Aim4price <billing@aim4price.com>',to:[invoice.customer.email],reply_to:invoice.issuer.email,subject:`Aim4price invoice ${invoice.number}`,text:`Hi ${invoice.customer.name},\n\nYour Aim4price invoice ${invoice.number} is attached.\nTotal: ${money(Number(invoice.total_cents))}\nDue: ${mapInvoice(invoice).dueDate}\nNo VAT applicable.\n\nBank: ${invoice.issuer.bank}\nAccount: ${invoice.issuer.accountNumber}\nReference: ${invoice.number}\n\nSign in to view your invoices: ${url}\n\n${invoice.issuer.email}`,html:`<div style="font-family:Arial,sans-serif;color:#173c32;max-width:600px;padding:24px;border:1px solid #d6e4dd"><h1>Aim4price Invoice</h1><p>Hi ${billingEscape(invoice.customer.name)},</p><p>Your invoice <strong>${billingEscape(invoice.number)}</strong> is attached.</p><p>Total: <strong>${billingEscape(money(Number(invoice.total_cents)))}</strong></p><p>No VAT applicable.</p><p>Please use your invoice number as the payment reference.</p><p><a href="${billingEscape(url)}">View invoices and payment status</a></p><p>${billingEscape(invoice.issuer.email)}</p></div>`,attachments:[{filename:`${invoice.number}.pdf`,content:pdf.toString('base64')}]});
        await getDb().query('update aim4price_billing_mail set payload=$2 where id=$1',[mail.id,payload]);
      }
      // Freeze the body before the first provider call. Retries reuse both bytes and key.
      await getDb().query('update aim4price_billing_mail set first_attempt_at=coalesce(first_attempt_at,now()) where id=$1',[mail.id]);
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`aim4price-invoice-${mail.id}`},body:payload,signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error(`Resend returned HTTP ${response.status}.`);
      const result=await response.json() as {id?:string};if(!result.id)throw new Error('Resend did not return an email reference.');
      await getDb().query("update aim4price_billing_mail set status='accepted',provider_id=$2,accepted_at=now(),locked_until=null,last_error=null where id=$1",[mail.id,result.id]);
    }catch(error){
      const message=error instanceof Error?error.message:'Email could not be sent.';
      await getDb().query("update aim4price_billing_mail set status=$2,last_error=$3,locked_until=null,next_attempt_at=now()+interval '5 minutes' where id=$1",[mail.id,(mail.attempts>=4||message.includes('Review required'))?'needs_review':'retry',message.slice(0,300)]);
    }
  }
}
export async function startBillingSender() {
  if(process.env.NODE_ENV!=='production'||process.env.AIM4PRICE_BILLING_DISABLED==='1')return;
  const state=globalThis as typeof globalThis & {aim4priceBillingTimer?:ReturnType<typeof setInterval>};if(state.aim4priceBillingTimer)return;
  let running=false;
  state.aim4priceBillingTimer=setInterval(async()=>{if(running)return;running=true;try{await processSignupInvoices();await dispatchBillingMail();}catch{console.warn('Billing sender unavailable; will retry.');}finally{running=false;}},30000);
  state.aim4priceBillingTimer.unref();
}
