import {sharingUsageSummary} from '../lib/sharing-foundation';
import {creditBalance,creditHistory,creditLimitsActive,creditTransaction,MONTHLY_BUSINESS_CREDITS,workspaceForCredits} from '../lib/business-credits';
import {UpgradeBusiness} from './BusinessCreditControls';
import styles from '../app/business/page.module.css';
const date=(value:Date,withTime=false)=>new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',...(withTime?{timeStyle:'short' as const}:{}),timeZone:'Africa/Johannesburg'}).format(new Date(value));
export default async function BusinessCredits({userId}:{userId:string}){
 const data=await creditTransaction(async db=>{
   const workspace=await workspaceForCredits(db,userId);
   return {workspace,balance:await creditBalance(db,workspace.id),history:await creditHistory(db,workspace.id)};
 }).catch(error=>{
   if(error instanceof Error&&error.message==='This Business workspace is unavailable.')return null;
   throw error;
 });
 if(!data)return <section className={styles.panel}><h2>Credits</h2><p>Your Business workspace is unavailable.</p></section>;
 const {workspace,balance,history}=data;
 const usage=await sharingUsageSummary(userId);
 return <section id="business-credits" className={styles.panel}><h2>Credits</h2>
 {workspace.paid_since?<p><strong>Paid Business</strong> · No monthly credit limit</p>:<>
 <p><strong>{Math.max(0,MONTHLY_BUSINESS_CREDITS-balance.used-balance.held)} of {MONTHLY_BUSINESS_CREDITS} credits available</strong> · Resets {date(balance.resets)}</p>
 <p>{creditLimitsActive()?'One credit per Manage visit, sent message or completed share.':'Trial period · Usage is tracked and access stays open.'}</p>
 {balance.held>0&&<p>{balance.held} reserved for sharing in progress.</p>}
 <p><strong>Add team members with Paid Business.</strong></p>
 {workspace.upgrade_requested_at?<p role="status">Upgrade requested · Awaiting Aim4price confirmation</p>:workspace.role==='owner'?<UpgradeBusiness/>:<p>Your business owner can request an upgrade.</p>}</>}
 <h3>Your usage</h3><dl className={styles.usageStats}>{([['Assets received',usage.asset_received],['Uploads',usage.upload],['Contributions',usage.contribution]] as const).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value?.count || 0}</dd></div>)}</dl>
 <details className={styles.details}><summary>Recent credit activity</summary>{history.length?<ul>{history.map((entry,index)=><li key={index}>{date(entry.created_at,true)} · {entry.name||'Account member'} · {{manage:'Opened Manage',send:'Sent message',share:'Shared asset'}[entry.action as 'manage'|'send'|'share']} · {entry.units} credit{entry.units===1?'':'s'}</li>)}</ul>:<p>No credit activity yet.</p>}</details></section>;
}
