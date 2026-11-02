import {maintenanceEmailsAllowed,maintenancePreferenceLink} from './maintenance-email-preferences';
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
export function maintenanceReminderEmail(r:AssetMaintenanceRecord,serial:string,scheduler:string,url:string,preferences?:{asset:string;account:string;all?:string}){
 const status=r.computedStatus==='overdue'?'Maintenance overdue':reminderStage(r)==='soon'?'Maintenance almost due':'Maintenance due';
 const unit=r.usageMetric==='percentage'?'%':r.usageMetric||r.assetUsageMetric;
 const rows:[string,string][]=[['Asset',r.assetTitle],['Work required',r.title],['Due',maintenanceDueLabel(r).replace(/^Due(?: at)? /,'')]];
 if(serial)rows.push(['Serial / VIN',serial]);
 if(r.triggerType==='usage'&&r.currentUsage!==null)rows.push(['Last recorded usage',`${r.currentUsage.toLocaleString('en-ZA')} ${unit}`]);
 if(r.recurringEnabled&&r.recurringIntervalValue&&r.recurringIntervalUnit)rows.push(['Repeats',`Every ${r.recurringIntervalValue.toLocaleString('en-ZA')} ${r.recurringIntervalUnit==='percentage'?'%':r.recurringIntervalUnit}`]);
 if(r.assignedName)rows.push(['Assigned to',r.assignedName]);
 if(scheduler)rows.push(['Scheduled by',scheduler]);
 const guidance=r.triggerType==='usage'?'This reminder uses your last recorded usage. Update the reading in Aim4price if it has changed.':'Review the scheduled work and record it once completed.';
 const subject=`${status}: ${r.assetTitle} — ${r.title} · ${maintenanceDueLabel(r)}`;
 const preferenceText=preferences?`\n\nStop reminders for this asset: ${preferences.asset}\nStop all maintenance emails for this account: ${preferences.account}\n${preferences.all?`Stop all asset updates for this asset: ${preferences.all}\n`:""}Your schedules stay saved. These links also let you turn reminders back on.`:'';
 const preferenceHtml=preferences?`<p style="margin:18px 0 8px;padding-top:16px;border-top:1px solid #e2ebe5;font-size:14px;line-height:1.6"><a href="${escape(preferences.asset)}" style="color:#1a654d">Stop reminders for this asset</a></p><p style="margin:0 0 8px;font-size:14px;line-height:1.6"><a href="${escape(preferences.account)}" style="color:#1a654d">Stop all maintenance emails for this account</a></p>${preferences.all?`<p style="font-size:14px;line-height:1.6"><a href="${escape(preferences.all)}" style="color:#1a654d">Stop all asset updates for this asset</a></p>`:""}<p style="margin:0;color:#486357;font-size:14px;line-height:1.6">Your schedules stay saved. You can turn reminders back on using these links.</p>`:'';
 const text=`${status}\n\n${rows.map(([label,value])=>label+': '+value).join('\n')}\n\n${guidance}\n\nView maintenance: ${url}\n\nSign in to view the latest status. If this work is already completed, record it in Aim4price to stop reminders.${preferenceText}`;
 const badge=r.computedStatus==='overdue'?'Overdue':reminderStage(r)==='soon'?'Due soon':'Due now';
 const accent=r.computedStatus==='overdue'?'#a63832':'#a65315';
 const summary=r.triggerType==='usage'&&typeof r.dueUsage==='number'&&typeof r.currentUsage==='number'?`${Math.abs(r.dueUsage-r.currentUsage).toLocaleString('en-ZA')} ${unit==='%'?'percentage points':unit} ${r.dueUsage<r.currentUsage?'overdue':r.dueUsage===r.currentUsage?'— due now':'remaining'}`:maintenanceDueLabel(r);
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:620px){.reminder-body{padding:20px 18px!important}.reminder-title{font-size:23px!important}.reminder-action{width:100%!important}}</style></head>
 <body style="margin:0;background:#f2f6f3;font-family:${AIM4PRICE_EMAIL_FONT_STACK};color:#173c32">
 <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
 <!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
 <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:white;border:1px solid #d7e5dc;border-radius:12px">
 ${buildEmailBrandHeader(new URL(AIM4PRICE_EMAIL_LOGO_PATH,getSiteOrigin()).toString())}
 <tr><td class="reminder-body" style="padding:22px 30px;font-family:${AIM4PRICE_EMAIL_FONT_STACK}">
 <p style="margin:0 0 12px"><span style="display:inline-block;padding:6px 12px;border-radius:20px;background:#fff3e6;color:${accent};font-family:${AIM4PRICE_EMAIL_FONT_STACK};font-size:14px;font-weight:700;line-height:20px">${badge}</span></p>
 <h1 class="reminder-title" style="margin:0 0 8px;color:#173c32;font-family:${AIM4PRICE_EMAIL_FONT_STACK};font-size:26px;line-height:1.3;font-weight:700">${escape(r.assetTitle)}</h1>
 <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#486357;font-family:${AIM4PRICE_EMAIL_FONT_STACK}">${escape(r.title)}</p>
 <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 12px;background:#fff8ef;border:1px solid #f0dcc3;border-radius:10px"><tr><td style="padding:14px 18px;font-family:${AIM4PRICE_EMAIL_FONT_STACK}"><p style="margin:0 0 4px;font-size:23px;line-height:1.3;font-weight:700;color:${accent}">${escape(summary)}</p>${r.triggerType==='usage'?`<p style="margin:0;font-size:14px;line-height:1.5;color:#486357">${escape(maintenanceDueLabel(r))}</p>`:''}</td></tr></table>
 <table role="presentation" cellspacing="0" cellpadding="0" class="reminder-action" width="100%" style="margin:16px 0 18px"><tr><td align="center" bgcolor="#1a654d" style="border-radius:6px;mso-padding-alt:15px 24px"><a href="${escape(url)}" style="display:block;padding:15px 24px;color:white;text-decoration:none;font-family:${AIM4PRICE_EMAIL_FONT_STACK};font-size:15px;font-weight:bold">View maintenance</a></td></tr></table>
 <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
 ${rows.filter(([label])=>!['Asset','Work required','Due'].includes(label)).map(([label,value])=>`<tr><th scope="row" align="left" valign="top" style="padding:9px 12px 9px 0;border-bottom:1px solid #e2ebe5;font-family:${AIM4PRICE_EMAIL_FONT_STACK};font-size:14px;color:#486357;font-weight:500;width:42%">${escape(label)}</th><td style="padding:9px 0;border-bottom:1px solid #e2ebe5;font-family:${AIM4PRICE_EMAIL_FONT_STACK};font-size:15px;color:#173c32;font-weight:600;line-height:1.5;overflow-wrap:anywhere">${escape(value)}</td></tr>`).join('')}
 </table>
 <p style="margin:16px 0 0;color:#486357;font-size:14px;line-height:1.6">${escape(guidance)} Already done? Record the work in Aim4price to stop reminders.</p>
 <p style="margin:16px 0 0;color:#486357;font-size:14px;line-height:1.6">Button not working? <a href="${escape(url)}" style="color:#1a654d">Open maintenance in Aim4price</a>.</p>
 ${preferenceHtml}
 </td></tr></table><!--[if mso]></td></tr></table><![endif]-->
 </td></tr></table></body></html>`;
 return {subject,text,html};
}
export async function listMaintenanceReminderNotifications(userId:string){await ensureAssetMaintenanceTables();await ensureMaintenanceReminders();const owners=(await getDb().query('SELECT DISTINCT owner_id FROM maintenance_reminder_sources WHERE scheduler_id=$1',[userId])).rows.map(r=>r.owner_id);const user=(await getDb().query('SELECT id,email FROM "user" WHERE id=$1',[userId])).rows[0];if(!user)return [];
 const items=[];for(const owner of new Set([userId,...owners]))for(const r of await listAssetMaintenanceRecords(owner,{status:'upcoming'})){const stage=reminderStage(r);if(!stage||!await maintenanceAssetAvailable(owner,r.assetId))continue;const source=await maintenanceSource(r.id);if(owner!==userId&&(!source||!await schedulerPermission(source,user)))continue;const who=source?(await getDb().query('SELECT name,email FROM "user" WHERE id=$1',[source.scheduler_id])).rows[0]:null;items.push({id:`maintenance-reminder:${r.id}:${stage}`,category:'maintenance' as const,tone:'warning' as const,title:r.computedStatus==='overdue'?'Maintenance overdue':stage==='soon'?'Maintenance due soon':'Maintenance due now',body:`${r.assetTitle}: ${r.title}. ${maintenanceDueLabel(r)}.${who?` Scheduled by ${who.name||who.email}.`:''}`,href:reminderHref(r.id),createdAtIso:r.updatedAtIso,assetId:r.assetId,actionRequired:true});}return items;}
export const MAINTENANCE_TEST_EMAIL='kallageldenhuys@gmail.com';
export function maintenanceReminderTestEnabled(){
 return process.env.MAINTENANCE_REMINDER_TEST_MODE==='true'&&Number.isFinite(Date.parse(process.env.MAINTENANCE_REMINDER_TEST_SINCE||''));
}
function testRecordEligible(r:AssetMaintenanceRecord){
 return Date.parse(r.updatedAtIso)>=Date.parse(process.env.MAINTENANCE_REMINDER_TEST_SINCE||'');
}
/** Shared entry point for the cron route and restricted pilot timer. */
export async function sendMaintenanceReminderBatch(after=''){
 const {sendAssetEmailBatch}=await import('./maintenance-email-delivery');
 return sendAssetEmailBatch(after);
}
