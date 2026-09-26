'use client';
import { useEffect, useState } from 'react';
import { dateKey, money, moneyToCents, type BillingAgreement, type BillingCustomer } from '../../../lib/billing-shared';
import styles from './page.module.css';

type Props = {
 account: string; customer: BillingCustomer; agreement: BillingAgreement | null;
 busy: boolean; automationPaused: boolean; onDirtyChange:(dirty:boolean)=>void; history:{action:string;detail:{reason?:string};created_at:string}[];
 mutate: (input: Record<string, unknown>, message: string) => Promise<boolean>;
};
export default function AutomaticBilling({account,customer,agreement,busy,automationPaused,mutate,onDirtyChange,history}:Props) {
 const [dirty,setDirty]=useState(false);
 useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false);},[dirty,onDirtyChange]);
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 const [editing,setEditing]=useState(!agreement);
 const [details,setDetails]=useState(agreement?.customer??customer);
 const [lines,setLines]=useState(agreement?.lines.map(l=>({description:l.description,quantity:String(l.quantity),price:(l.unitCents/100).toFixed(2)}))??[{description:'',quantity:'1',price:''}]);
 const [interval,setInterval]=useState<'monthly'|'annual'>(agreement?.interval??'monthly');
 const [next,setNext]=useState(agreement?.nextInvoiceDate??dateKey());
 const [days,setDays]=useState(String(agreement?.dueDays??7));
 const [approved,setApproved]=useState(false),[error,setError]=useState('');
 const [pausing,setPausing]=useState(false),[reason,setReason]=useState('');
 let total=0;try{total=lines.reduce((sum,l)=>sum+moneyToCents(l.price||'0')*Number(l.quantity),0);}catch{}
 async function save(enabled:boolean){
  setError('');
  try{
   const parsed=lines.map(l=>({description:l.description,quantity:Number(l.quantity),unitCents:moneyToCents(l.price)}));
   if(enabled&&!confirm(`Enable automatic ${interval==='annual'?'yearly':'monthly'} invoices of ${money(total)} to ${details.email}, starting ${next}? Each invoice will be issued and emailed automatically.`))return;
   await mutate({action:'save_agreement',userId:account,version:agreement?.version??0,customer:details,lines:parsed,interval,nextInvoiceDate:next,dueDays:Number(days),enabled,approved},enabled?'Automatic billing enabled.':'Billing settings saved. Automatic billing is paused.');
  }catch(e){setError((e as Error).message);}
 }
 return <section className={styles.panel} aria-label="Automatic billing settings" onChange={()=>setDirty(true)}>
  <div className={styles.sectionHeading}><div><h2>Automatic billing</h2><p className={styles.muted}>Agree the charges once. Aim4price creates and emails each scheduled invoice.</p></div><span className={styles.draftLabel}>{agreement?.enabled?'Enabled':agreement?'Paused':'Not set up'}</span></div>
  {automationPaused?<p className={styles.error}>The billing worker is paused in server settings. Scheduled invoices will not run until it is enabled.</p>:null}
  {agreement?.lastError?<p role="alert" className={styles.error}>{agreement.lastError}</p>:null}
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {agreement&&!editing?<>
   <div className={styles.agreementSummary}><div><small>Agreed amount</small><strong>{money(agreement.lines.reduce((n,l)=>n+l.totalCents,0))} / {agreement.interval==='annual'?'year':'month'}</strong></div><div><small>Next invoice</small><strong>{agreement.nextInvoiceDate}</strong></div><div><small>Payment terms</small><strong>{agreement.dueDays} days</strong></div><div><small>Send to</small><strong>{agreement.customer.email}</strong></div></div>
   <div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={()=>setEditing(true)}>{agreement.enabled?'Edit billing settings':'Review & enable'}</button>{agreement.enabled?<button className={styles.button} disabled={busy} onClick={()=>setPausing(true)}>Pause automatic billing</button>:null}</div>
   {pausing?<div className={styles.details}><label className={styles.field}>Pause reason<textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label><p className={styles.muted}>Future invoices will stop. Existing invoices and account access stay as they are.</p><div className={styles.actions}><button className={styles.danger} disabled={busy||!reason.trim()} onClick={()=>void mutate({action:'pause_agreement',userId:account,version:agreement.version,reason},'Automatic billing paused.')}>Confirm pause</button><button className={styles.button} onClick={()=>setPausing(false)}>Cancel</button></div></div>:null}
  </>:<>
   <div className={styles.grid}>{(['businessName','name','email','address','reference'] as const).map(key=><label className={styles.field} key={key}>{key==='businessName'?'Business name (optional)':key==='name'?'Contact / billing name':key==='email'?'Billing email':key==='reference'?'Customer / PO reference (optional)':'Billing address'}{key==='address'?<textarea value={details[key]??''} onChange={e=>setDetails({...details,[key]:e.target.value})}/>:<input value={details[key]??''} type={key==='email'?'email':'text'} onChange={e=>setDetails({...details,[key]:e.target.value})}/>}</label>)}</div>
   <h3 className={styles.sectionLabel}>Recurring charges</h3>
   {lines.map((line,i)=><div className={styles.line} key={i}><label className={styles.field}>Description<input maxLength={400} value={line.description} onChange={e=>setLines(lines.map((l,j)=>j===i?{...l,description:e.target.value}:l))}/></label><label className={styles.field}>Quantity<input inputMode="numeric" value={line.quantity} onChange={e=>setLines(lines.map((l,j)=>j===i?{...l,quantity:e.target.value}:l))}/></label><label className={styles.field}>Unit price (R)<input inputMode="decimal" value={line.price} onChange={e=>setLines(lines.map((l,j)=>j===i?{...l,price:e.target.value}:l))}/></label><button className={styles.button} onClick={()=>{setDirty(true);setLines(lines.filter((_,j)=>j!==i));}}>Remove</button></div>)}
   <button className={styles.button} disabled={lines.length>=40} onClick={()=>{setDirty(true);setLines([...lines,{description:'',quantity:'1',price:''}]);}}>Add line</button>
   <div className={`${styles.grid} ${styles.scheduleFields}`}><label className={styles.field}>Invoice frequency<select value={interval} onChange={e=>setInterval(e.target.value as 'monthly'|'annual')}><option value="monthly">Monthly</option><option value="annual">Yearly</option></select></label><label className={styles.field}>{agreement?'Next invoice date':'First invoice date'}<input type="date" min={dateKey()} value={next} onChange={e=>setNext(e.target.value)}/></label><label className={styles.field}>Days to pay<input type="number" min="0" max="90" value={days} onChange={e=>setDays(e.target.value)}/></label></div>
   <div className={styles.total}><span>Each invoice<small>No VAT applicable</small></span><strong>{money(Number.isFinite(total)?total:0)}</strong></div>
   <p className={styles.muted}>The first invoice is created on the date above, or shortly after saving if you choose today. Changes apply to future invoices only. Past periods can be billed manually.</p>
   <label className={styles.approval}><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/> I confirm the customer agreed to these charges and this schedule.</label>
   <div className={styles.actions}><button className={styles.primary} disabled={busy||!approved||automationPaused} onClick={()=>void save(true)}>Save & enable automatic billing</button><button className={styles.button} disabled={busy} onClick={()=>void save(false)}>Save with automation paused</button>{agreement?<button className={styles.button} disabled={busy} onClick={()=>{if(dirty&&!confirm('Discard unsaved billing changes?'))return;setDirty(false);setDetails(agreement.customer);setLines(agreement.lines.map(l=>({description:l.description,quantity:String(l.quantity),price:(l.unitCents/100).toFixed(2)})));setInterval(agreement.interval);setNext(agreement.nextInvoiceDate);setDays(String(agreement.dueDays));setApproved(false);setEditing(false);}}>Cancel</button>:null}</div>
  </>}
  <p className={styles.muted}>Automatic billing sends invoices. Payments are recorded manually; account access remains under admin control.</p>
 {history.length?<details className={styles.details}><summary>Billing settings history</summary><ul className={styles.history}>{history.map((item,i)=><li key={i}>{new Date(item.created_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})} · {item.action.replace(/_/g,' ')}{item.detail.reason?` · ${item.detail.reason}`:''}</li>)}</ul></details>:null}
 </section>;
}
