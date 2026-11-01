import {maintenanceAssetAvailable} from './maintenance-asset-lifecycle';
import {AIM4PRICE_EMAIL_FONT_STACK,AIM4PRICE_EMAIL_LOGO_PATH,buildEmailBrandHeader} from './email-brand';
import {getAccountProfile} from './account-profile';
import {canBusinessRead} from './business-accounts';
import {sharingPlan} from './sharing-foundation';
import type {PoolClient} from 'pg';
import {getDb} from './db';
import {ensureAssetMaintenanceTables,getAssetMaintenanceRecordById,listAssetMaintenanceRecords,type AssetMaintenanceRecord} from './asset-maintenance';
import {getSiteOrigin,sendAim4priceEmail} from './email';
import {readLeadPage} from './guest-leads';
import {lockLiveSharedAsset} from './live-shared-asset-access';
import {getAssetRegisterItemById} from './asset-register-db';

export type MaintenanceSource={record_id:string;owner_id:string;asset_id:string;scheduler_id:string;access_id:string|null;share_token:string|null};
let schema:Promise<void>|undefined;
export function ensureMaintenanceReminders(){return schema??=getDb().query(`
 CREATE TABLE IF NOT EXISTS maintenance_reminder_sources(record_id uuid PRIMARY KEY,owner_id text NOT NULL,asset_id uuid NOT NULL,scheduler_id text NOT NULL,access_id uuid,share_token text);
 CREATE INDEX IF NOT EXISTS maintenance_reminder_scheduler_idx ON maintenance_reminder_sources(scheduler_id);
 CREATE TABLE IF NOT EXISTS maintenance_reminder_deliveries(event_key text PRIMARY KEY,record_id uuid NOT NULL,recipient_id text NOT NULL,stage text NOT NULL,first_attempt_at timestamptz NOT NULL DEFAULT now(),attempted_at timestamptz NOT NULL DEFAULT now(),attempts int NOT NULL DEFAULT 1,sent_at timestamptz,error text);
 `).then(()=>{}).catch(e=>{schema=undefined;throw e;});}
export async function saveMaintenanceSource(client:PoolClient,source:MaintenanceSource){await client.query(`INSERT INTO maintenance_reminder_sources(record_id,owner_id,asset_id,scheduler_id,access_id,share_token) VALUES($1::uuid,$2,$3::uuid,$4,$5::uuid,$6)`,[source.record_id,source.owner_id,source.asset_id,source.scheduler_id,source.access_id,source.share_token]);}
// Recurring records inherit the original scheduler, rather than the person completing a service.
export async function maintenanceSource(id:string):Promise<MaintenanceSource|null>{await ensureMaintenanceReminders();return (await getDb().query(`WITH RECURSIVE chain AS (SELECT id,generated_from_maintenance_id,0 AS depth FROM asset_maintenance_records WHERE id=$1::uuid UNION ALL SELECT r.id,r.generated_from_maintenance_id,c.depth+1 FROM asset_maintenance_records r JOIN chain c ON r.id=c.generated_from_maintenance_id WHERE c.depth<100) SELECT s.* FROM chain JOIN maintenance_reminder_sources s ON s.record_id=chain.id ORDER BY depth LIMIT 1`,[id])).rows[0]||null;}
export function reminderStage(record:Pick<AssetMaintenanceRecord,'status'|'computedStatus'>){return record.status!=='upcoming'?null:record.computedStatus==='due_soon'?'soon':['due','overdue'].includes(record.computedStatus)?'due':null;}
export function reminderHref(id:string){return `/maintenance-reminder/${encodeURIComponent(id)}`;}
export function maintenanceDueLabel(r:AssetMaintenanceRecord){return r.triggerType==='date'?`Due ${r.dueDate}`:`Due at ${r.dueUsage?.toLocaleString('en-ZA')} ${r.usageMetric==='percentage'?'%':r.usageMetric}`;}
export async function schedulerPermission(source:MaintenanceSource,user:{id:string;email:string},write=false,client:Pick<PoolClient,'query'>=getDb()):Promise<boolean>{
 if(user.id!==source.scheduler_id)return false;
 const identity=(await client.query('SELECT id,name,email,\"emailVerified\" FROM \"user\" WHERE id=$1',[user.id])).rows[0];if(!identity)return false;
 const profile=await getAccountProfile(identity);if(profile.accountStatus!=='active')return false;
 const plan=await sharingPlan(identity.id,profile.accountType);if(plan==='free'&&identity.emailVerified!==true)return false;
 if(profile.accountType==='business'&&!await canBusinessRead(identity))return false;
 if(source.share_token){const lead=await readLeadPage(source.share_token);if(!lead||lead.ownerId!==source.owner_id||!lead.share.assets.some(a=>a.assetId===source.asset_id))return false;
 try{await lockLiveSharedAsset(client,{lead,user:user as any,token:source.share_token,assetId:source.asset_id,permission:write?'addMaintenance':'maintenanceSchedules'});return true;}catch{return false;}}
 if(!['dealer','business'].includes(profile.accountType))return false;
 const result=await client.query(`SELECT id FROM dealer_maintenance_access WHERE id=$1::uuid AND owner_user_id=$2 AND asset_register_item_id=$3::uuid AND dealer_user_id=$4 AND is_active=true AND ${write?'can_add_maintenance':'can_create_maintenance_schedules'}=true FOR SHARE`,[source.access_id,source.owner_id,source.asset_id,user.id]);return !!result.rows.length;
}
export async function reminderRecord(id:string){await ensureAssetMaintenanceTables();if(!/^[0-9a-f-]{36}$/i.test(id))return null;const row=(await getDb().query('SELECT user_id FROM asset_maintenance_records WHERE id=$1::uuid',[id])).rows[0];return row?getAssetMaintenanceRecordById(row.user_id,id):null;}
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function maintenanceReminderEmail(r:AssetMaintenanceRecord,serial:string,scheduler:string,url:string){
 const status=r.computedStatus==='overdue'?'Maintenance overdue':reminderStage(r)==='soon'?'Maintenance almost due':'Maintenance due';
 const unit=r.usageMetric==='percentage'?'%':r.usageMetric||r.assetUsageMetric;
 const rows:[string,string][]=[['Asset',r.assetTitle],['Work required',r.title],['Due',maintenanceDueLabel(r).replace(/^Due(?: at)? /,'')]];
 if(serial)rows.push(['Serial / VIN',serial]);
 if(r.triggerType==='usage'&&r.currentUsage!==null)rows.push(['Last recorded usage',`${r.currentUsage.toLocaleString('en-ZA')} ${unit}`]);
 if(r.recurringEnabled&&r.recurringIntervalValue&&r.recurringIntervalUnit)rows.push(['Repeats',`Every ${r.recurringIntervalValue.toLocaleString('en-ZA')} ${r.recurringIntervalUnit==='percentage'?'%':r.recurringIntervalUnit}`]);
 if(r.assignedName)rows.push(['Assigned to',r.assignedName]);
 if(scheduler)rows.push(['Scheduled by',scheduler]);
 const guidance=r.triggerType==='usage'?'This reminder uses your last recorded usage. Update the reading in Aim4price if it has changed.':'Review the scheduled work and record it once completed.';
 const subject=`${status}: ${r.assetTitle}`;
 const text=`${status}\n\n${rows.map(([label,value])=>label+': '+value).join('\n')}\n\n${guidance}\n\nManage maintenance: ${url}\n\nSign in to view the latest status. If this work is already completed, record it in Aim4price to stop reminders.`;
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
 <body style="margin:0;background:#f2f6f3;font-family:${AIM4PRICE_EMAIL_FONT_STACK};color:#173c32">
 <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
 <!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
 <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:white;border:1px solid #d7e5dc;border-radius:12px">
 ${buildEmailBrandHeader(new URL(AIM4PRICE_EMAIL_LOGO_PATH,getSiteOrigin()).toString())}
 <tr><td style="padding:28px 24px">
 <p style="margin:0 0 12px;color:#a65315;font-size:12px;font-weight:bold;letter-spacing:1px">MAINTENANCE</p>
 <h1 style="margin:0 0 12px;font-size:25px;line-height:1.3">${escape(status)}</h1>
 <p style="margin:0 0 24px;color:#64786f;font-size:14px;line-height:1.6">${escape(guidance)}</p>
 <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
 ${rows.map(([label,value])=>`<tr><th scope="row" align="left" valign="top" style="padding:12px 12px 12px 0;border-bottom:1px solid #e2ebe5;font-size:13px;color:#64786f;font-weight:normal;width:35%">${escape(label)}</th><td style="padding:12px 0;border-bottom:1px solid #e2ebe5;font-size:14px;line-height:1.5;overflow-wrap:anywhere">${escape(value)}</td></tr>`).join('')}
 </table>
 <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td bgcolor="#176f51" style="border-radius:8px;mso-padding-alt:14px 22px"><a href="${escape(url)}" style="display:inline-block;padding:14px 22px;color:white;text-decoration:none;font-size:14px;font-weight:bold">Manage maintenance</a></td></tr></table>
 <p style="margin:0;color:#64786f;font-size:12px;line-height:1.6">Sign in to view the latest status. If this work is already completed, record it in Aim4price to stop reminders.</p>
 <p style="margin:16px 0 0;color:#64786f;font-size:12px;line-height:1.6">Button not working? <a href="${escape(url)}" style="color:#176f51">Open maintenance in Aim4price</a>.</p>
 </td></tr></table><!--[if mso]></td></tr></table><![endif]-->
 </td></tr></table></body></html>`;
 return {subject,text,html};
}
export async function listMaintenanceReminderNotifications(userId:string){await ensureAssetMaintenanceTables();await ensureMaintenanceReminders();const owners=(await getDb().query('SELECT DISTINCT owner_id FROM maintenance_reminder_sources WHERE scheduler_id=$1',[userId])).rows.map(r=>r.owner_id);const user=(await getDb().query('SELECT id,email FROM "user" WHERE id=$1',[userId])).rows[0];if(!user)return [];
 const items=[];for(const owner of new Set([userId,...owners]))for(const r of await listAssetMaintenanceRecords(owner,{status:'upcoming'})){const stage=reminderStage(r);if(!stage||!await maintenanceAssetAvailable(owner,r.assetId))continue;const source=await maintenanceSource(r.id);if(owner!==userId&&(!source||!await schedulerPermission(source,user)))continue;const who=source?(await getDb().query('SELECT name,email FROM "user" WHERE id=$1',[source.scheduler_id])).rows[0]:null;items.push({id:`maintenance-reminder:${r.id}:${stage}`,category:'maintenance' as const,tone:'warning' as const,title:r.computedStatus==='overdue'?'Maintenance overdue':stage==='soon'?'Maintenance due soon':'Maintenance due now',body:`${r.assetTitle}: ${r.title}. ${maintenanceDueLabel(r)}.${who?` Scheduled by ${who.name||who.email}.`:''}`,href:reminderHref(r.id),createdAtIso:r.updatedAtIso,assetId:r.assetId,actionRequired:true});}return items;}
/** One bounded batch per run. Scheduler supplies the returned owner cursor until complete. */
export async function sendMaintenanceReminderBatch(after=''){
 // Explicit rollout switch prevents the first deployment from emailing the backlog.
 if(process.env.MAINTENANCE_REMINDER_ENABLED!=='true')return {sent:0,failed:0,next:null,disabled:true};
 const allowedOwners=(process.env.MAINTENANCE_REMINDER_OWNER_IDS||'').split(',').map(id=>id.trim()).filter(Boolean);
 await ensureAssetMaintenanceTables();await ensureMaintenanceReminders();
 const owners=(await getDb().query(`SELECT DISTINCT user_id FROM asset_maintenance_records WHERE status='upcoming' AND user_id>$1 AND (cardinality($2::text[])=0 OR user_id=ANY($2::text[])) ORDER BY user_id LIMIT 20`,[after,allowedOwners])).rows;
 let sent=0,failed=0;
 for(const owner of owners)for(const original of await listAssetMaintenanceRecords(owner.user_id,{status:'upcoming'})){
  const stage=reminderStage(original);if(!stage||!await maintenanceAssetAvailable(owner.user_id,original.assetId))continue;const source=await maintenanceSource(original.id);
  const recipients=(await getDb().query('SELECT id,email,name FROM "user" WHERE id=$1',[owner.user_id])).rows;
  const scheduler=source?(await getDb().query('SELECT name,email FROM "user" WHERE id=$1',[source.scheduler_id])).rows[0]:recipients[0];
  for(const user of recipients){
   const r=await getAssetMaintenanceRecordById(owner.user_id,original.id);if(!r||reminderStage(r)!==stage)continue;
   if(user.id!==owner.user_id&&(!source||!await schedulerPermission(source,user)))continue;
   const key=`maintenance:${r.id}:${user.id}:${stage}`;
   const claim=await getDb().query(`INSERT INTO maintenance_reminder_deliveries(event_key,record_id,recipient_id,stage) VALUES($1,$2::uuid,$3,$4) ON CONFLICT(event_key) DO UPDATE SET attempted_at=now(),attempts=maintenance_reminder_deliveries.attempts+1 WHERE maintenance_reminder_deliveries.sent_at IS NULL AND maintenance_reminder_deliveries.attempted_at<now()-interval '15 minutes' AND maintenance_reminder_deliveries.first_attempt_at>now()-interval '23 hours' AND maintenance_reminder_deliveries.attempts<10 RETURNING event_key`,[key,r.id,user.id,stage]);if(!claim.rows.length)continue;
   try{if(!process.env.RESEND_API_KEY)throw Error('Email service is not configured.');const asset=await getAssetRegisterItemById(owner.user_id,r.assetId);if(!asset||!await maintenanceAssetAvailable(owner.user_id,r.assetId))continue;const latest=await getAssetMaintenanceRecordById(owner.user_id,r.id);if(!latest||reminderStage(latest)!==stage)continue;const message=maintenanceReminderEmail(r,asset?.serialNumber||'',scheduler?.name||scheduler?.email||'The owner',getSiteOrigin()+reminderHref(r.id));await sendAim4priceEmail({to:user.email,...message,idempotencyKey:key,usage:{accountId:owner.user_id,actorId:source?.scheduler_id||owner.user_id,eventKey:key}});await getDb().query('UPDATE maintenance_reminder_deliveries SET sent_at=now(),error=NULL WHERE event_key=$1',[key]);sent++;}catch(e){failed++;await getDb().query('UPDATE maintenance_reminder_deliveries SET error=$2 WHERE event_key=$1',[key,e instanceof Error?e.message:'Delivery failed']);}
  }
 }
 return {sent,failed,next:owners.length===20?owners.at(-1).user_id:null};
}

