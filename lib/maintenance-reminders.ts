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
export function maintenanceReminderEmail(r:AssetMaintenanceRecord,serial:string,scheduler:string,url:string){const status=reminderStage(r)==='soon'?'Maintenance almost due':'Maintenance due';const lines=[r.assetTitle,`Serial / VIN: ${serial||'Not recorded'}`,r.title,maintenanceDueLabel(r),`${scheduler} scheduled this ${r.maintenanceType==='checkup'?'check-up':'service'}.`];return {subject:`${status}: ${r.assetTitle}`,text:`${status}\n\n${lines.join('\n')}\n\nOpen maintenance: ${url}\n\nSign in to view the latest status and record completed work.`,html:`<div style="font-family:Arial,sans-serif;color:#173c32;max-width:600px;margin:auto;padding:28px;border:1px solid #d7e5dc;border-radius:16px"><strong>Aim4price</strong><h2>${status}</h2>${lines.map(line=>`<p>${escape(line)}</p>`).join('')}<p style="margin:28px 0"><a style="background:#176f51;color:white;padding:14px 22px;border-radius:8px;text-decoration:none" href="${escape(url)}">Open maintenance</a></p><p>Sign in to view the latest status and record completed work.</p></div>`};}
export async function listMaintenanceReminderNotifications(userId:string){await ensureAssetMaintenanceTables();await ensureMaintenanceReminders();const owners=(await getDb().query('SELECT DISTINCT owner_id FROM maintenance_reminder_sources WHERE scheduler_id=$1',[userId])).rows.map(r=>r.owner_id);const user=(await getDb().query('SELECT id,email FROM "user" WHERE id=$1',[userId])).rows[0];if(!user)return [];
 const items=[];for(const owner of new Set([userId,...owners]))for(const r of await listAssetMaintenanceRecords(owner,{status:'upcoming'})){const stage=reminderStage(r);if(!stage)continue;const source=await maintenanceSource(r.id);if(owner!==userId&&(!source||!await schedulerPermission(source,user)))continue;const who=source?(await getDb().query('SELECT name,email FROM "user" WHERE id=$1',[source.scheduler_id])).rows[0]:null;items.push({id:`maintenance-reminder:${r.id}:${stage}`,category:'maintenance' as const,tone:'warning' as const,title:stage==='soon'?'Maintenance almost due':'Maintenance due',body:`${r.assetTitle}: ${r.title}. ${maintenanceDueLabel(r)}.${who?` Scheduled by ${who.name||who.email}.`:''}`,href:reminderHref(r.id),createdAtIso:r.updatedAtIso,assetId:r.assetId,actionRequired:true});}return items;}
/** One bounded batch per run. Scheduler supplies the returned owner cursor until complete. */
export async function sendMaintenanceReminderBatch(after=''){
 await ensureAssetMaintenanceTables();await ensureMaintenanceReminders();
 const owners=(await getDb().query(`SELECT DISTINCT user_id FROM asset_maintenance_records WHERE status='upcoming' AND user_id>$1 ORDER BY user_id LIMIT 20`,[after])).rows;
 let sent=0,failed=0;
 for(const owner of owners)for(const original of await listAssetMaintenanceRecords(owner.user_id,{status:'upcoming'})){
  const stage=reminderStage(original);if(!stage)continue;const source=await maintenanceSource(original.id);
  const recipients=(await getDb().query('SELECT id,email,name FROM "user" WHERE id=ANY($1::text[])',[[...new Set([owner.user_id,...source?[source.scheduler_id]:[]])]])).rows;
  const scheduler=recipients.find(u=>u.id===source?.scheduler_id)||recipients.find(u=>u.id===owner.user_id);
  for(const user of recipients){
   const r=await getAssetMaintenanceRecordById(owner.user_id,original.id);if(!r||reminderStage(r)!==stage)continue;
   if(user.id!==owner.user_id&&(!source||!await schedulerPermission(source,user)))continue;
   const key=`maintenance:${r.id}:${user.id}:${stage}`;
   const claim=await getDb().query(`INSERT INTO maintenance_reminder_deliveries(event_key,record_id,recipient_id,stage) VALUES($1,$2::uuid,$3,$4) ON CONFLICT(event_key) DO UPDATE SET attempted_at=now(),attempts=maintenance_reminder_deliveries.attempts+1 WHERE maintenance_reminder_deliveries.sent_at IS NULL AND maintenance_reminder_deliveries.attempted_at<now()-interval '15 minutes' AND maintenance_reminder_deliveries.first_attempt_at>now()-interval '23 hours' AND maintenance_reminder_deliveries.attempts<10 RETURNING event_key`,[key,r.id,user.id,stage]);if(!claim.rows.length)continue;
   try{if(!process.env.RESEND_API_KEY)throw Error('Email service is not configured.');const asset=await getAssetRegisterItemById(owner.user_id,r.assetId);const message=maintenanceReminderEmail(r,asset?.serialNumber||'',scheduler?.name||scheduler?.email||'The owner',getSiteOrigin()+reminderHref(r.id));await sendAim4priceEmail({to:user.email,...message,idempotencyKey:key,usage:{accountId:owner.user_id,actorId:source?.scheduler_id||owner.user_id,eventKey:key}});await getDb().query('UPDATE maintenance_reminder_deliveries SET sent_at=now(),error=NULL WHERE event_key=$1',[key]);sent++;}catch(e){failed++;await getDb().query('UPDATE maintenance_reminder_deliveries SET error=$2 WHERE event_key=$1',[key,e instanceof Error?e.message:'Delivery failed']);}
  }
 }
 return {sent,failed,next:owners.length===20?owners.at(-1).user_id:null};
}
