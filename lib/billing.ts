import { ownerHosting, businessHosting, hostedRegisterBand } from './hosting-pricing';
import { randomUUID } from 'node:crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import { getDb } from './db';
import { ensureAdminWorkTrackerSchema } from './admin-work-tracker';
import { BILLING_SCHEMA_SQL } from './billing-schema';
import { BILLING_ISSUER, BILLING_ACCOUNT_TYPES, cleanCustomer, cleanLines, dateKey, validDate, nextBillingDate, type BillingInvoice, type BillingPlan, type BillingLine, nextAgreementDate, billingAccountCustomer } from './billing-shared';
import { buildBillingInvoiceHtml } from './billing-report';

export class BillingError extends Error {}
export function billingId(value: unknown): string {
  const id = String(value ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BillingError('Invalid invoice or request reference.');
  return id;
}
let schema: Promise<void> | undefined;
export function ensureBillingSchema(): Promise<void> {
  if (!schema) schema = (async () => {
    const db = await getDb().connect();
    try { await db.query('begin'); await db.query("select pg_advisory_xact_lock(hashtext('aim4price-billing-schema-v1'))"); await db.query(BILLING_SCHEMA_SQL);
      await db.query(`create table if not exists aim4price_signup_terms(id boolean primary key default true check(id),trial_days integer not null default 30,monthly_credits integer not null default 500,referral_credits integer not null default 50,version integer not null default 1)`);
      await db.query('insert into aim4price_signup_terms(id) values(true) on conflict do nothing');
      const offers=[...ownerHosting.map((band,i)=>({key:'owner-band-'+(i+1),name:'Owner · '+band.range+' assets',rates:band})),{key:'business-standard',name:'Paid Business',rates:businessHosting}];
      for(const offer of offers){
        for(const period of ['monthly','annual'] as const){
          await db.query('insert into aim4price_billing_plans(account_type,description,amount_cents,interval,due_days,enabled) values($1,$2,$3,$4,7,true) on conflict do nothing',[offer.key+'-'+period,offer.name,offer.rates[period==='annual'?'annually':'monthly'],period]);
        }
      }
      await db.query(`create table if not exists aim4price_subscription_mail (
        event_key text primary key,user_id text references "user"(id) on delete cascade,subject text not null,body text not null,
        next_attempt_at timestamptz not null default now(),created_at timestamptz not null default now(),sent_at timestamptz)`);
      await db.query('create table if not exists aim4price_billing_controls(user_id text primary key references "user"(id) on delete cascade, held boolean not null, version integer not null default 1)');
       await db.query('alter table aim4price_billing_agreements add column if not exists include_hosted_registers boolean not null default false'); await db.query('commit'); }
    catch(error) { await db.query('rollback'); throw error; } finally { db.release(); }
  })().catch(error => { schema = undefined; throw error; });
  return schema;
}
async function transaction<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  await ensureBillingSchema(); const db = await getDb().connect();
  try { await db.query('begin'); const result = await fn(db); await db.query('commit'); return result; }
  catch(error) { await db.query('rollback'); throw error; } finally { db.release(); }
}
export function mapInvoice(row: QueryResultRow): BillingInvoice {
  return { id:row.id, userId:row.user_id, number:row.number, status:row.status, customer:row.customer, lines:row.lines, totalCents:Number(row.total_cents), paidCents:Number(row.paid_cents), dueDate:typeof row.due_date === 'string' ? row.due_date.slice(0,10) : dateKey(row.due_date), issuedAt:row.issued_at?.toISOString?.() ?? row.issued_at, createdAt:row.created_at?.toISOString?.() ?? row.created_at, note:row.note, deliveryStatus:row.delivery_status ?? null, version:row.version, voidReason:row.void_reason, accountStatus:row.account_status??undefined, contactPhone:row.contact_phone??undefined, contactEmail:row.contact_email??undefined };
}
async function event(db: PoolClient, id: string, actor: string, action: string, detail='') {
  await db.query('insert into aim4price_billing_events(invoice_id,actor_id,action,detail) values($1,$2,$3,$4)',[id,actor,action,detail]);
}
export async function signupTerms() {
  await ensureBillingSchema();
  return (await getDb().query('select trial_days,monthly_credits,referral_credits,version from aim4price_signup_terms where id')).rows[0];
}
export async function saveSignupTerms(input:Record<string,unknown>,actor:string){
  const values=[input.trial_days,input.monthly_credits,input.referral_credits].map(Number);
  if(values.some(v=>!Number.isSafeInteger(v)||v<1)||values[0]>365||values.slice(1).some(v=>v>100000))throw new BillingError('Use 1–365 trial days and 1–100,000 credits.');
  await transaction(async db=>{
    const result=await db.query('update aim4price_signup_terms set trial_days=$1,monthly_credits=$2,referral_credits=$3,version=version+1 where id and version=$4 returning id',[...values,input.version]);
    if(!result.rowCount)throw new BillingError('Signup terms changed. Refresh before saving.');
    await db.query("insert into aim4price_billing_agreement_events(actor_id,action,detail) values($1,'signup_terms',$2)",[actor,JSON.stringify(values)]);
  });
}
export async function listBillingPlans(onlyEnabled=false): Promise<BillingPlan[]> {
  await ensureBillingSchema(); const result = await getDb().query('select * from aim4price_billing_plans order by account_type');
  return result.rows.filter(r=>(['owner','dealer'].includes(r.account_type)||/^(owner-band-[123]|business-standard)-(monthly|annual)$/.test(r.account_type)) && (!onlyEnabled||r.enabled)).map(r=>({key:r.account_type,accountType:r.account_type==='dealer'||r.account_type.startsWith('business-')?'business':'owner',description:r.account_type==='dealer'?r.description.replace(/\bDealer\b/gi,'Business'):r.description,amountCents:Number(r.amount_cents),interval:r.interval,dueDays:r.due_days,version:r.version,enabled:r.enabled}));
}
export async function saveBillingPlan(input: Record<string, unknown>): Promise<void> {
  const accountType=input.accountType==='dealer'?'business':String(input.accountType),description=String(input.description ?? '').trim(),amount=Number(input.amountCents),days=Number(input.dueDays),interval=String(input.interval);
  if (!(BILLING_ACCOUNT_TYPES as readonly string[]).includes(accountType)||!description||description.length>200||!Number.isSafeInteger(amount)||amount<=0||amount>999999999||!Number.isInteger(days)||days<0||days>90||!['once','monthly','annual'].includes(interval)||typeof input.enabled!=='boolean') throw new BillingError('Check the plan description, amount, payment terms and billing interval.');
  const key=String(input.key??(accountType==='business'?'dealer':'owner'));
  const validKey=accountType==='owner'?/^(owner|owner-band-[123]-(annual|monthly))$/:/^(dealer|business-standard-(annual|monthly))$/;
  if(!validKey.test(key) || (key.includes('-')&&!key.endsWith('-'+interval)))throw new BillingError('Check the plan and billing interval.');
  await ensureBillingSchema();
  await getDb().query(`insert into aim4price_billing_plans(account_type,description,amount_cents,interval,due_days,enabled) values($1,$2,$3,$4,$5,$6)
    on conflict(account_type) do update set description=$2,amount_cents=$3,interval=$4,due_days=$5,enabled=$6,version=aim4price_billing_plans.version+1,updated_at=now()`,[key,description,amount,interval,days,input.enabled]);
}
export async function listBillingInvoices(userId: string | null, includeDrafts: boolean, page=1) {
  await ensureBillingSchema();
  if (!Number.isInteger(page)||page<1||page>100000) throw new BillingError('Invalid page.');
  const where="($1::text is null or user_id=$1) and ($2::boolean or status<>'draft')";
  const [rows,total]=await Promise.all([
    getDb().query(`select i.id,i.user_id,i.number,i.status,i.customer,i.lines,i.total_cents,i.paid_cents,i.due_date,i.issued_at,i.created_at,i.note,i.version,i.void_reason, (select ap.account_status from account_profiles ap where ap.user_id=i.user_id) as account_status, (select ap.phone from account_profiles ap where ap.user_id=i.user_id) as contact_phone, (select u.email from "user" u where u.id=i.user_id) as contact_email, (select status from aim4price_billing_mail m where m.invoice_id=i.id order by created_at desc limit 1) as delivery_status from aim4price_billing_invoices i where ${where} order by created_at desc,id desc limit 50 offset $3`,[userId,includeDrafts,(page-1)*50]),
    getDb().query(`select count(*)::integer as total from aim4price_billing_invoices where ${where}`,[userId,includeDrafts]),
  ]);
  return { invoices:rows.rows.map(mapInvoice), total:total.rows[0].total, page };
}
export async function getBillingInvoice(id: string, userId: string | null, admin: boolean) {
  await ensureBillingSchema();
  const result=await getDb().query('select * from aim4price_billing_invoices where id=$1 and ($2::boolean or (user_id=$3 and status<>\'draft\'))',[billingId(id),admin,userId]);
  if (!result.rows[0]) throw new BillingError('Invoice not found.');
  return result.rows[0];
}
export async function getBillingWorkspace(userId: string) {
  await Promise.all([ensureBillingSchema(), ensureAdminWorkTrackerSchema()]);
  const profile=await getDb().query(`select u.id,u.name,u.email,p.customer,p.next_billing_date,p.interval,p.amount_cents,to_jsonb(ap) as account_profile from "user" u left join aim4price_billing_profiles p on p.user_id=u.id left join account_profiles ap on ap.user_id=u.id where u.id=$1`,[userId]);
  if (!profile.rows[0]) throw new BillingError('Account not found.');
  const work=await getDb().query(`select s.id,s.started_at,s.duration_seconds,s.note from admin_work_sessions s
    where s.client_user_id=$1 and s.stopped_at is not null and not exists(select 1 from aim4price_billing_work w where w.work_session_id=s.id) order by s.started_at desc limit 200`,[userId]);
  const p=profile.rows[0];
  const accountCustomer=billingAccountCustomer(p,p.account_profile??{});
  const control=(await getDb().query('select held,version from aim4price_billing_controls where user_id=$1',[userId])).rows[0];
  const selected=(await getDb().query("select quote->'plan' as plan from aim4price_billing_signup_jobs where user_id=$1",[userId])).rows[0]?.plan;
  const ap=p.account_profile;
  const planLabel=selected ? selected.description+' · '+selected.interval : ap?.account_type==='owner'&&ap.owner_trial_requested ? 'Owner trial' : ap?.account_type==='business'?'Free Business':ap?.account_type==='dealer'?(ap.account_subtype==='equipment-middleman'?'Free Middleman':'Paid Business'):'Owner';
  return { planLabel,accessStatus:ap?.account_status,control:control??{held:false,version:0}, signupType:p.account_profile?.account_type, trialEnd:p.account_profile?.owner_trial_ends_at??null, supportsHostedRegisters:p.account_profile?.account_type === 'dealer' && p.account_profile?.account_subtype !== 'equipment-middleman', agreement:await getBillingAgreement(userId), agreementHistory:(await getDb().query('select action,detail,created_at from aim4price_billing_agreement_events where user_id=$1 order by id desc limit 20',[userId])).rows, accountCustomer, customer:{...accountCustomer,...p.customer,businessName:p.customer?.businessName||accountCustomer.businessName,address:p.customer?.address||accountCustomer.address,reference:''}, nextBillingDate:p.next_billing_date, interval:p.interval ?? 'once', amountCents:Number(p.amount_cents ?? 0), work:work.rows };
}
async function billingHeld(db: PoolClient, userId: string) {
  await db.query('select pg_advisory_xact_lock(hashtext($1))',['billing-control:'+userId]);
  return (await db.query('select held from aim4price_billing_controls where user_id=$1',[userId])).rows[0]?.held === true;
}

export async function setBillingHold(input: Record<string,unknown>, actor: string) {
  const userId=String(input.userId??''), reason=String(input.reason??'').trim();
  if (!userId || typeof input.held !== 'boolean' || !reason || reason.length>500) throw new BillingError('Select an account and give a short reason.');
  await transaction(async db=>{
    await billingHeld(db,userId);
    const old=(await db.query('select version from aim4price_billing_controls where user_id=$1',[userId])).rows[0];
    if(Number(input.version)!==(old?.version??0))throw new BillingError('Refresh before changing billing.');
    await db.query('insert into aim4price_billing_controls(user_id,held) values($1,$2) on conflict(user_id) do update set held=excluded.held,version=aim4price_billing_controls.version+1',[userId,input.held]);
    if(input.held){
      await db.query('update aim4price_billing_agreements set enabled=false,version=version+1 where user_id=$1 and enabled',[userId]);
      await db.query('update aim4price_billing_signup_jobs set processed_at=now() where user_id=$1 and processed_at is null',[userId]);
    }
    await db.query('insert into aim4price_billing_agreement_events(user_id,actor_id,action,detail) values($1,$2,$3,$4)',[userId,actor,input.held?'billing_held':'billing_released',JSON.stringify({reason})]);
  });
}

export async function createBillingDraft(input: Record<string, unknown>, actor: string): Promise<string> {
  let customer,lines,dueDate;
  try { customer=cleanCustomer(input.customer);lines=Array.isArray(input.lines) && input.lines.length===0 ? [] : cleanLines(input.lines);dueDate=validDate(input.dueDate); } catch(e) { throw new BillingError((e as Error).message); }
  const userId=String(input.userId ?? ''),id=billingId(input.id),note=String(input.note??'').trim();
  if(note.length>1500)throw new BillingError('Keep the invoice note below 1,500 characters.');
  const workIds=Array.isArray(input.workSessionIds)?[...new Set(input.workSessionIds.map(String))].sort():[];
  if(workIds.length>40)throw new BillingError('Select at most 40 work sessions.');
  return transaction(async db=>{
    await db.query('select pg_advisory_xact_lock(hashtext($1))',['billing-draft:'+id]);
    if((await db.query('select 1 from aim4price_billing_deletions where invoice_id=$1',[id])).rowCount)throw new BillingError('This invoice was permanently deleted. Start a new draft.');
    const existing=await db.query('select id,user_id from aim4price_billing_invoices where id=$1',[id]);
    if(existing.rows[0]) { if(existing.rows[0].user_id!==userId)throw new BillingError('This request reference is already used.'); return id; }
    if(!(await db.query('select id from "user" where id=$1',[userId])).rows[0])throw new BillingError('Account not found.');
    const finalLines: BillingLine[]=[...lines];
    if(workIds.length) {
      const rate=Number(input.hourlyRateCents);
      if(!Number.isSafeInteger(rate)||rate<=0||rate>99999999)throw new BillingError('Enter an agreed hourly rate for selected work.');
      const work=await db.query(`select id,note,duration_seconds,stopped_at from admin_work_sessions where id=any($1::text[]) and client_user_id=$2 order by id for update`,[workIds,userId]);
      if(work.rows.length!==workIds.length||work.rows.some(r=>!r.stopped_at||r.duration_seconds<=0))throw new BillingError('Only completed work belonging to this account can be invoiced.');
      for(const row of work.rows) {
        if((await db.query('select 1 from aim4price_billing_work where work_session_id=$1',[row.id])).rowCount)throw new BillingError('Some selected work is already on another invoice.');
        const cents=Math.round(rate*row.duration_seconds/3600);
        if(!Number.isSafeInteger(cents)||cents<1)throw new BillingError('Selected work has no chargeable amount.');
        finalLines.push({description:`Admin work - ${Math.round(row.duration_seconds/60)} minutes${row.note?' - '+String(row.note).slice(0,240):''}`,quantity:1,unitCents:cents,totalCents:cents,workSessionId:row.id});
      }
    }
    try { cleanLines(finalLines); } catch(e) { throw new BillingError((e as Error).message); }
    const total=finalLines.reduce((sum,line)=>sum+line.totalCents,0);
    await db.query(`insert into aim4price_billing_invoices(id,user_id,customer,issuer,lines,total_cents,due_date,note) values($1,$2,$3,$4,$5,$6,$7,$8)`,[id,userId,JSON.stringify(customer),JSON.stringify(BILLING_ISSUER),JSON.stringify(finalLines),total,dueDate,note]);
    for(const workId of workIds)await db.query('insert into aim4price_billing_work(work_session_id,invoice_id) values($1,$2)',[workId,id]);
    await db.query('insert into aim4price_billing_profiles(user_id,customer) values($1,$2) on conflict(user_id) do update set customer=$2,updated_at=now()',[userId,JSON.stringify({...customer,reference:''})]);
    await event(db,id,actor,'draft_created');return id;
  });
}
async function issueLocked(db: PoolClient, row: QueryResultRow, actor: string, sendEmail=true) {
  if(row.status!=='draft')return;
  if(!row.user_id)throw new BillingError('Cannot issue an invoice for a deleted account.');
  if(await billingHeld(db,row.user_id))throw new BillingError('Billing is on hold for this account.');
  const seq=await db.query("select nextval('aim4price_invoice_number_seq')::text as number");
  const issuedAt=new Date().toISOString(),number=`A4P-${dateKey().slice(0,4)}-${seq.rows[0].number.padStart(6,'0')}`;
  const invoice=mapInvoice({...row,status:'issued',number,issued_at:issuedAt});
  const html=await buildBillingInvoiceHtml(invoice,row.issuer);
  await db.query("update aim4price_billing_invoices set status='issued',number=$2,issued_at=$3,report_html=$4,version=version+1 where id=$1",[row.id,number,issuedAt,html]);
  if(sendEmail)await db.query('insert into aim4price_billing_mail(id,invoice_id) values($1,$2)',[randomUUID(),row.id]);
  await event(db,row.id,actor,'issued',number);
}
export async function actOnBillingInvoice(id: string, input: Record<string,unknown>, actor: string) {
  return transaction(async db=>{
    const result=await db.query('select * from aim4price_billing_invoices where id=$1 for update',[billingId(id)]),row=result.rows[0];
    if(!row)throw new BillingError('Invoice not found.');
    const action=input.action;
    if(action==='update_draft') {
      if(row.status!=='draft'||input.version!==row.version)throw new BillingError('This draft changed or was issued. Refresh before editing.');
      let customer,manual,dueDate;
      try {customer=cleanCustomer(input.customer);manual=Array.isArray(input.lines)&&input.lines.length===0?[]:cleanLines(input.lines);dueDate=validDate(input.dueDate);}catch(e){throw new BillingError((e as Error).message);}
      const lines=[...manual,...(row.lines as BillingLine[]).filter(line=>line.workSessionId)];
      try{cleanLines(lines);}catch(e){throw new BillingError((e as Error).message);}
      const note=String(input.note??'').trim();if(note.length>1500)throw new BillingError('Keep the note below 1,500 characters.');
      await db.query('update aim4price_billing_invoices set customer=$2,lines=$3,total_cents=$4,due_date=$5,note=$6,version=version+1 where id=$1',[id,JSON.stringify(customer),JSON.stringify(lines),lines.reduce((sum,line)=>sum+line.totalCents,0),dueDate,note]);
      await event(db,id,actor,'draft_updated');
    } else if(action==='issue') {
      if(row.status!=='draft')return;
      if(input.version!==row.version)throw new BillingError('This draft changed. Refresh before issuing.');
      if(input.sendEmail!==undefined&&typeof input.sendEmail!=='boolean')throw new BillingError('Choose whether to email the invoice.');
      await issueLocked(db,row,actor,input.sendEmail!==false);
    } else if(action==='delete_draft') {
      if(row.status!=='draft')throw new BillingError('Issued invoices cannot be deleted.');
      await db.query('delete from aim4price_billing_events where invoice_id=$1',[id]);
      await db.query('delete from aim4price_billing_invoices where id=$1',[id]);
    } else if(action==='void') {
      if(row.status!=='issued'||Number(row.paid_cents)>0)throw new BillingError('Only unpaid issued invoices can be voided.');
      const reason=String(input.reason??'').trim();if(reason.length<5||reason.length>500)throw new BillingError('Give a reason for voiding this invoice.');
      if((await db.query("select status from aim4price_billing_mail where invoice_id=$1 for update",[id])).rows.some(mail=>mail.status==='sending'))throw new BillingError('Email is being sent. Try again when sending finishes.');
      await db.query("update aim4price_billing_invoices set status='void',void_reason=$2,version=version+1 where id=$1",[id,reason]);
      await db.query("update aim4price_billing_mail set status='needs_review',last_error='Invoice voided' where invoice_id=$1 and status in ('queued','retry')",[id]);
      await db.query('delete from aim4price_billing_work where invoice_id=$1',[id]);await event(db,id,actor,'voided',reason);
    } else if(action==='payment') {
      const paymentId=billingId(input.paymentId),cents=Number(input.amountCents),reference=String(input.reference??'').trim();
      let paymentDate;try { paymentDate=validDate(input.paymentDate); }catch(e){throw new BillingError((e as Error).message);}
      if((await db.query('select 1 from aim4price_billing_payments where id=$1 and invoice_id=$2',[paymentId,id])).rowCount)return;
      if(row.status!=='issued'||!Number.isSafeInteger(cents)||cents<=0||cents>Number(row.total_cents)-Number(row.paid_cents)||!reference||reference.length>200||paymentDate>dateKey())throw new BillingError('Check the payment date, reference and remaining balance.');
      await db.query('insert into aim4price_billing_payments(id,invoice_id,amount_cents,payment_date,reference,actor_id) values($1,$2,$3,$4,$5,$6)',[paymentId,id,cents,paymentDate,reference,actor]);
      await db.query('update aim4price_billing_invoices set paid_cents=paid_cents+$2,version=version+1 where id=$1',[id,cents]);await event(db,id,actor,'payment_recorded',`${cents} cents - ${reference}`);
      if (Number(row.paid_cents)+cents===Number(row.total_cents) && row.user_id) {
        await db.query('insert into aim4price_subscription_mail(event_key,user_id,subject,body) values($1,$2,$3,$4) on conflict do nothing',['paid:'+id,row.user_id,'Aim4price payment received','Payment received in full for invoice '+row.number+'.']);
        if(row.generation_key==='signup:'+row.user_id){
          const job=(await db.query('select quote from aim4price_billing_signup_jobs where user_id=$1',[row.user_id])).rows[0];
          if(job?.quote?.subscription && !await billingHeld(db,row.user_id)){
            const plan:BillingPlan=job.quote.plan;
            const expected=plan.accountType==='business'?'dealer':'owner';
            const profile=await db.query("update account_profiles set account_status='active',owner_trial_requested=false where user_id=$1 and account_type=$2 and account_status in ('active','pending_payment') returning user_id",[row.user_id,expected]);
            const next=nextBillingDate(dateKey(new Date(row.issued_at)),plan.interval);
            if(profile.rowCount && next && next>=dateKey()){
              await db.query(`insert into aim4price_billing_agreements(user_id,customer,lines,interval,anchor_date,next_invoice_date,due_days,enabled)
                values($1,$2,$3,$4,$5,$6,$7,true) on conflict do nothing`,[row.user_id,JSON.stringify(row.customer),JSON.stringify(row.lines),plan.interval,dateKey(new Date(row.issued_at)),next,plan.dueDays]);
            }
          }
        }
      }
    } else if(action==='send') {
      if(row.status!=='issued'||!row.user_id)throw new BillingError('Only issued invoices for existing accounts can be sent.');
      const latest=(await db.query('select * from aim4price_billing_mail where invoice_id=$1 order by created_at desc limit 1 for update',[id])).rows[0];
      if(latest && ['queued','retry','sending'].includes(latest.status))return;
      if(latest && input.confirmed!==true)throw new BillingError('Confirm resending this invoice. A previous email may already have reached the customer.');
      await db.query('insert into aim4price_billing_mail(id,invoice_id) values($1,$2)',[randomUUID(),id]);await event(db,id,actor,'email_queued');
    } else throw new BillingError('Unknown billing action.');
  });
}
export async function billingHistory(id: string) {
  await ensureBillingSchema();billingId(id);
  const [events,payments,mail]=await Promise.all([
    getDb().query('select action,detail,created_at from aim4price_billing_events where invoice_id=$1 order by id desc',[id]),
    getDb().query('select amount_cents,payment_date,reference from aim4price_billing_payments where invoice_id=$1 order by created_at desc',[id]),
    getDb().query('select status,provider_id,attempts,last_error,created_at,accepted_at from aim4price_billing_mail where invoice_id=$1 order by created_at desc',[id]),
  ]);return {events:events.rows,payments:payments.rows,mail:mail.rows};
}
export type SignupBilling = { subscription?: boolean; plan: BillingPlan; customer: ReturnType<typeof cleanCustomer> };
export async function validateSignupBilling(input: Record<string,unknown>): Promise<SignupBilling | null> {
  const requested=String(input.accountType??'owner');
  if(requested==='business' && input.accountAccess!=='desktop') return null;
  const accountType=requested==='dealer'?'business':requested;
  if(!(BILLING_ACCOUNT_TYPES as readonly string[]).includes(accountType))throw new BillingError('Choose a valid account type.');
  if(accountType==='business'&&String(input.accountSubtype??'').replace(/_/g,'-')==='equipment-middleman')return null;
  const plan=(await listBillingPlans(true)).find(p=>p.accountType===accountType && (input.planKey?p.key===input.planKey:!p.key||p.key===(accountType==='business'?'dealer':'owner')));
  if(!plan)return null;
  if(input.billingAccepted!==true||Number(input.billingPlanVersion)!==plan.version)throw new BillingError('Please review and accept the current signup invoice price.');
  try { return {subscription:input.signupPlan==='paid',plan,customer:cleanCustomer({name:input.billingName,email:input.billingEmail,address:input.billingAddress})}; }catch(e){throw new BillingError((e as Error).message);}
}
export async function createSignupInvoice(userId: string, signup: SignupBilling): Promise<void> {
  const {plan,customer}=signup;const start=dateKey(),due=new Date(start+'T00:00:00Z');due.setUTCDate(due.getUTCDate()+plan.dueDays);
  await transaction(async db=>{
    await db.query('select pg_advisory_xact_lock(hashtext($1))',['billing-signup:'+userId]);
    if(await billingHeld(db,userId))return;
    const skipped=await db.query('select 1 from aim4price_billing_signup_jobs where user_id=$1 and processed_at is not null',[userId]);
    if(skipped.rowCount)return;
    const key='signup:'+userId;
    await db.query('select pg_advisory_xact_lock(hashtext($1))',['billing-generation:'+key]);
    if((await db.query('select id from aim4price_billing_invoices where generation_key=$1',[key])).rowCount || (await db.query('select 1 from aim4price_billing_deletions where generation_key=$1',[key])).rowCount)return;
    const id=randomUUID(),lines=[{description:plan.description,quantity:1,unitCents:plan.amountCents,totalCents:plan.amountCents}];
    const row=(await db.query(`insert into aim4price_billing_invoices(id,user_id,customer,issuer,lines,total_cents,due_date,generation_key,note) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,[id,userId,JSON.stringify(customer),JSON.stringify(BILLING_ISSUER),JSON.stringify(lines),plan.amountCents,due.toISOString().slice(0,10),key,`Signup subscription - ${plan.interval === 'once'?'one-time':plan.interval}. No VAT applicable.`])).rows[0];
    await db.query(`insert into aim4price_billing_profiles(user_id,customer,next_billing_date,interval,amount_cents) values($1,$2,$3,$4,$5) on conflict(user_id) do nothing`,[userId,JSON.stringify(customer),nextBillingDate(start,plan.interval),plan.interval,plan.amountCents]);
    await event(db,id,'signup','signup_price_accepted',`Plan version ${plan.version}`);await issueLocked(db,row,'signup');
  });
}

export async function subscribeOwnerTrial(userId:string, input:Record<string,unknown>) {
  const quote=await validateSignupBilling({...input,accountType:'owner',signupPlan:'paid'});
  if(!quote)throw new BillingError('Owner billing is currently unavailable.');
  await transaction(async db=>{
    if(await billingHeld(db,userId))throw new BillingError('Your account has a billing hold. Contact Aim4price to review it.');
    const trial=(await db.query("select owner_trial_ends_at from account_profiles where user_id=$1 and account_type='owner' and account_status='pending_payment' and owner_trial_requested and owner_trial_ends_at is not null for update",[userId])).rows[0];
    if(!trial)throw new BillingError('This account has no verified Owner trial.');
    await db.query('insert into aim4price_billing_signup_jobs(user_id,quote,next_attempt_at) values($1,$2,greatest(now(),$3::timestamptz)) on conflict do nothing',[userId,JSON.stringify(quote),trial.owner_trial_ends_at]);
  });
}

export async function queueSignupInvoice(userId: string, quote: SignupBilling) {
  await ensureBillingSchema();
  await transaction(async db=>{
    if(await billingHeld(db,userId))return;
    await db.query('insert into aim4price_billing_signup_jobs(user_id,quote) values($1,$2) on conflict(user_id) do nothing',[userId,JSON.stringify(quote)]);
  });
}
export async function processSignupInvoices() {
  await ensureBillingSchema();
  const jobs=await getDb().query('select user_id,quote from aim4price_billing_signup_jobs where processed_at is null and next_attempt_at<=now() order by created_at limit 10');
  for(const job of jobs.rows){
    try { await createSignupInvoice(job.user_id,job.quote);await getDb().query('update aim4price_billing_signup_jobs set processed_at=now(),last_error=null where user_id=$1',[job.user_id]); }
    catch { await getDb().query("update aim4price_billing_signup_jobs set next_attempt_at=now()+interval '5 minutes',last_error='Invoice preparation failed; will retry. Admin can review this account.' where user_id=$1",[job.user_id]); }
  }
}

export async function billingPreparationStatus() {
  await ensureBillingSchema();
  const result=await getDb().query(`select count(*)::integer as pending, count(*) filter(where last_error is not null)::integer as failed from aim4price_billing_signup_jobs where processed_at is null`);
  return result.rows[0];
}

function agreementModel(row: QueryResultRow) {
 const day = (value: string | Date) => typeof value === 'string' ? value.slice(0,10) : value.toISOString().slice(0,10);
 return {includeHostedRegisters:row.include_hosted_registers === true,customer:row.customer,lines:row.lines,interval:row.interval,anchorDate:day(row.anchor_date),nextInvoiceDate:day(row.next_invoice_date),dueDays:row.due_days,enabled:row.enabled,version:row.version,lastInvoiceDate:row.last_invoice_date?day(row.last_invoice_date):null,lastError:row.last_error};
}
export async function getBillingAgreement(userId: string) {
 await ensureBillingSchema();
 const result=await getDb().query('select * from aim4price_billing_agreements where user_id=$1',[userId]);
 return result.rows[0]?agreementModel(result.rows[0]):null;
}
export async function saveBillingAgreement(input: Record<string,unknown>, actor: string) {
 const userId=String(input.userId??'');
 let customer,lines,next;
 try {customer=cleanCustomer(input.customer);lines=cleanLines(input.lines);next=validDate(input.nextInvoiceDate);}catch(e){throw new BillingError((e as Error).message);}
 const interval=String(input.interval),days=Number(input.dueDays);
 if(!['monthly','annual'].includes(interval)||!Number.isInteger(days)||days<0||days>90||typeof input.enabled!=='boolean')throw new BillingError('Check the interval and payment terms.');
 if(input.enabled&&input.approved!==true)throw new BillingError('Confirm the customer agreed to these recurring charges.');
 if(next<dateKey())throw new BillingError('Choose today or a future invoice date. Past periods are invoiced manually.');
 await transaction(async db=>{
  await db.query('select pg_advisory_xact_lock(hashtext($1))',['billing-agreement:'+userId]);
  if(!(await db.query('select id from "user" where id=$1',[userId])).rowCount)throw new BillingError('Account not found.');
  if(await billingHeld(db,userId) && input.enabled)throw new BillingError('Release the billing hold before enabling a schedule.');
  const includeHostedRegisters = input.includeHostedRegisters === true;
  if (includeHostedRegisters && !(await db.query("select 1 from account_profiles where user_id=$1 and account_type='dealer' and account_subtype <> 'equipment-middleman'",[userId])).rowCount) throw new BillingError('Hosted registers require a Business account.');
  const old=(await db.query('select * from aim4price_billing_agreements where user_id=$1 for update',[userId])).rows[0];
  if(Number(input.version)!==(old?.version??0))throw new BillingError('Billing settings changed. Refresh before saving.');
  const previous=old?agreementModel(old):null;
  if(previous?.lastInvoiceDate&&next<=previous.lastInvoiceDate)throw new BillingError('This period has already been invoiced. Choose a later date.');
  const anchor=previous&&next===previous.nextInvoiceDate&&interval===previous.interval?previous.anchorDate:next;
  await db.query(`insert into aim4price_billing_agreements(user_id,customer,lines,interval,anchor_date,next_invoice_date,due_days,enabled,include_hosted_registers)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(user_id) do update set customer=$2,lines=$3,interval=$4,anchor_date=$5,next_invoice_date=$6,due_days=$7,enabled=$8,include_hosted_registers=$9,version=aim4price_billing_agreements.version+1,last_error=null,updated_at=now()`,[userId,JSON.stringify(customer),JSON.stringify(lines),interval,anchor,next,days,input.enabled,includeHostedRegisters]);
  await db.query('insert into aim4price_billing_agreement_events(user_id,actor_id,action,detail) values($1,$2,$3,$4)',[userId,actor,input.enabled?'approved':'saved_paused',JSON.stringify({customer,lines,includeHostedRegisters,interval,nextInvoiceDate:next,dueDays:days,previous})]);
 });
}
export async function pauseBillingAgreement(input: Record<string,unknown>, actor: string) {
 const userId=String(input.userId??''),reason=String(input.reason??'').trim();
 if(!reason||reason.length>500)throw new BillingError('Enter a pause reason (up to 500 characters).');
 await transaction(async db=>{
  const result=await db.query('update aim4price_billing_agreements set enabled=false,version=version+1,updated_at=now() where user_id=$1 and version=$2 returning user_id',[userId,Number(input.version)]);
  if(!result.rowCount)throw new BillingError('Billing settings changed. Refresh before pausing.');
  await db.query('insert into aim4price_billing_agreement_events(user_id,actor_id,action,detail) values($1,$2,$3,$4)',[userId,actor,'paused',JSON.stringify({reason})]);
 });
}
async function hostedRegisterLines(db: PoolClient, userId: string, interval: 'monthly' | 'annual') {
 const holder = await db.query("select 1 from account_profiles where user_id=$1 and account_type='dealer' and account_subtype<>'equipment-middleman' and account_status='active'", [userId]);
 if (!holder.rowCount) throw new BillingError('Hosted billing requires an active full Business account. Review the agreement.');
 const registers = await db.query<{ assets: number }>(`
   select count(i.id)::int as assets from asset_registers r
   left join asset_register_items i on i.register_id=r.id and i.user_id=r.user_id
     and coalesce(i.lifecycle_state,'active')='active'
   where r.user_id=$1 and not r.is_primary
   group by r.id`, [userId]);
 const counts = ownerHosting.map(() => 0);
 for (const row of registers.rows) counts[hostedRegisterBand(row.assets)]++;
 return counts.flatMap((quantity, band) => quantity ? [{
   description: 'Hosted client registers · ' + ownerHosting[band].range + ' active assets',
   quantity,
   unitCents: ownerHosting[band][interval === 'annual' ? 'annually' : 'monthly'] / 4,
 }] : []);
}

export async function processRecurringInvoices(today=dateKey()) {
 if(process.env.AIM4PRICE_RECURRING_BILLING_DISABLED==='1')return;
 validDate(today);await ensureBillingSchema();
 const due=await getDb().query('select user_id from aim4price_billing_agreements where enabled and next_invoice_date<=$1 order by next_invoice_date limit 50',[today]);
 for(const item of due.rows){
  try {await transaction(async db=>{
   if(await billingHeld(db,item.user_id))return;
   const row=(await db.query('select * from aim4price_billing_agreements where user_id=$1 and enabled and next_invoice_date<=$2 for update skip locked',[item.user_id,today])).rows[0];
   if(!row)return;
   const a=agreementModel(row),next=nextAgreementDate(a.nextInvoiceDate,a.interval,a.anchorDate);
   // Never silently issue a batch of historic charges after downtime or a pause.
   if(next<=today){
    await db.query("update aim4price_billing_agreements set enabled=false,last_error='Missed billing periods. Review the next date before resuming.',version=version+1 where user_id=$1",[item.user_id]);
    await db.query('insert into aim4price_billing_agreement_events(user_id,actor_id,action,detail) values($1,$2,$3,$4)',[item.user_id,'system','review_required',JSON.stringify({nextInvoiceDate:a.nextInvoiceDate})]);return;
   }
   const hostedLines = a.includeHostedRegisters ? await hostedRegisterLines(db, item.user_id, a.interval) : [];
   const lines=cleanLines([...a.lines, ...hostedLines]),customer=cleanCustomer(a.customer),id=randomUUID(),key=`recurring:${item.user_id}:${a.nextInvoiceDate}`;
   const dueDate=new Date(a.nextInvoiceDate+'T00:00:00Z');dueDate.setUTCDate(dueDate.getUTCDate()+a.dueDays);
   await db.query('select pg_advisory_xact_lock(hashtext($1))',['billing-generation:'+key]);
   const deleted=(await db.query('select 1 from aim4price_billing_deletions where generation_key=$1',[key])).rowCount;
   const invoice=deleted?null:(await db.query(`insert into aim4price_billing_invoices(id,user_id,customer,issuer,lines,total_cents,due_date,generation_key,note)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(generation_key) do nothing returning *`,[id,item.user_id,JSON.stringify(customer),JSON.stringify(BILLING_ISSUER),JSON.stringify(lines),lines.reduce((sum,l)=>sum+l.totalCents,0),dueDate.toISOString().slice(0,10),key,`Recurring billing — ${a.nextInvoiceDate}`])).rows[0];
   if(invoice)await issueLocked(db,invoice,'recurring');
   await db.query('update aim4price_billing_agreements set next_invoice_date=$2,last_invoice_date=$3,last_error=null,version=version+1,updated_at=now() where user_id=$1',[item.user_id,next,a.nextInvoiceDate]);
  });}catch(error){
   const reason=error instanceof RangeError || error instanceof BillingError ? error.message : 'Invoice preparation failed. Automatic retry pending.';
   await getDb().query('update aim4price_billing_agreements set last_error=$2 where user_id=$1',[item.user_id,reason]);
  }
 }
}

export async function listBillingAgreements() {
 await ensureBillingSchema();
 return (await getDb().query(`select a.user_id as "userId", a.customer->>'name' as name, a.enabled,
  to_char(a.next_invoice_date,'YYYY-MM-DD') as "nextInvoiceDate", a.last_error as "lastError"
  from aim4price_billing_agreements a order by (a.last_error is not null) desc,a.next_invoice_date,a.user_id limit 200`)).rows;
}
