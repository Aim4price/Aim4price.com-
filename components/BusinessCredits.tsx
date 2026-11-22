import {sharingUsageSummary} from '../lib/sharing-foundation';
import {creditBalance,creditHistory,creditLimitsActive,creditTransaction,MONTHLY_BUSINESS_CREDITS,workspaceForCredits} from '../lib/business-credits';

import styles from '../app/business/page.module.css';
const date=(value:Date,withTime=false)=>new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',...(withTime?{timeStyle:'short' as const}:{}),timeZone:'Africa/Johannesburg'}).format(new Date(value));
export async function getBusinessCredits(userId:string){
 return creditTransaction(async db=>{
   const workspace=await workspaceForCredits(db,userId);
   const balance=await creditBalance(db,workspace.id);
   return {workspace,balance:{...balance,limit:MONTHLY_BUSINESS_CREDITS+Number(balance.bonus||0)},history:await creditHistory(db,workspace.id)};
 }).catch(error=>{
   if(error instanceof Error&&error.message==='This Business workspace is unavailable.')return null;
   throw error;
 });
}

export default async function BusinessCredits({userId,data}:{userId:string;data:Awaited<ReturnType<typeof getBusinessCredits>>}){
 if(!data)return <section className={styles.panel}><h2>Credits</h2><p>Your Business workspace is unavailable.</p></section>;
 const {workspace,balance,history}=data;
 const usage=await sharingUsageSummary(userId);
 return <section id="business-credits" className={styles.panel}><h2>Credits</h2>
 {workspace.paid_since?<p><strong>Paid Business</strong> · No monthly credit limit</p>:<>
 <p><strong>{Math.max(0,balance.limit-balance.used-balance.held)} of {balance.limit} credits available</strong> · Resets {date(balance.resets)}</p>
 <p>{creditLimitsActive()?'One credit per Manage visit, sent message or completed share.':'Trial period · Usage is tracked and access stays open.'}</p>
 {Number(balance.bonus)>0&&<p>{balance.bonus} referral credits earned this month.</p>}
 {balance.held>0&&<p>{balance.held} reserved for sharing in progress.</p>}
 <p><strong>Add team members with Paid Business.</strong></p>
 </>}
 <h3>Your usage</h3><dl className={styles.usageStats}>{([['Assets received',usage.asset_received],['Uploads',usage.upload],['Contributions',usage.contribution]] as const).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value?.count || 0}</dd></div>)}</dl>
 <details className={styles.details}><summary>Recent credit activity</summary>{history.length?<ul>{history.map((entry,index)=><li key={index}>{date(entry.created_at,true)} · {entry.name||'Account member'} · {{manage:'Opened Manage',send:'Sent message',share:'Shared asset'}[entry.action as 'manage'|'send'|'share']} · {entry.units} credit{entry.units===1?'':'s'}</li>)}</ul>:<p>No credit activity yet.</p>}</details></section>;
}
