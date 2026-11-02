import {getDb} from './db';
import {getSiteOrigin,sendAim4priceEmail} from './email';
import {buildEmailBrandHeader,AIM4PRICE_EMAIL_FONT_STACK,AIM4PRICE_EMAIL_LOGO_PATH} from './email-brand';
import {ensureAssetMaintenanceTables,listAssetMaintenanceRecords,getAssetMaintenanceRecordById} from './asset-maintenance';
import {getAssetRegisterItemById} from './asset-register-db';
import {listIssueNotesForAssets} from './asset-issue-notes';
import {maintenanceAssetAvailable} from './maintenance-asset-lifecycle';
import {maintenanceEmailsAllowed,maintenancePreferenceLink,type AssetEmailCategory} from './maintenance-email-preferences';
import {assetEmailRecipients,trackingEmailPermission,type AssetEmailKind} from './maintenance-email-access';
import {ensureMaintenanceReminders,maintenanceReminderEmail,maintenanceSource,reminderStage,reminderHref,MAINTENANCE_TEST_EMAIL} from './maintenance-reminders';

type Event={event_key:string;owner_id:string;asset_id:string;record_id:string;kind:AssetEmailKind;actor_id:string|null;actor_name:string|null;created_at:string|Date};
type Message={subject:string;text:string;html:string};
export function emailRollout(){
 const test=process.env.MAINTENANCE_REMINDER_TEST_MODE==='true';
 const since=process.env[test?'MAINTENANCE_REMINDER_TEST_SINCE':'MAINTENANCE_REMINDER_ROLLOUT_SINCE']||'';
 return {test,since,enabled:(test||process.env.MAINTENANCE_REMINDER_ENABLED==='true')&&Number.isFinite(Date.parse(since))};
}
let ready:Promise<void>|undefined;
export function ensureAssetEmailDelivery(){return ready??=getDb().query(`
 CREATE TABLE IF NOT EXISTS asset_email_rollout(id text PRIMARY KEY,started_at timestamptz NOT NULL DEFAULT now());
 INSERT INTO asset_email_rollout(id) VALUES('activity-v1') ON CONFLICT DO NOTHING;
 CREATE TABLE IF NOT EXISTS asset_email_events(event_key text PRIMARY KEY,owner_id text NOT NULL,asset_id uuid NOT NULL,record_id text NOT NULL,kind text NOT NULL,actor_id text,actor_name text,created_at timestamptz NOT NULL);
 CREATE TABLE IF NOT EXISTS asset_email_deliveries(event_key text NOT NULL,recipient_id text NOT NULL,payload jsonb NOT NULL,first_attempt_at timestamptz NOT NULL DEFAULT now(),attempted_at timestamptz NOT NULL DEFAULT now(),attempts int NOT NULL DEFAULT 1,sent_at timestamptz,error text,PRIMARY KEY(event_key,recipient_id));
 CREATE INDEX IF NOT EXISTS asset_email_events_recent ON asset_email_events(created_at);
 `).then(()=>{}).catch(e=>{ready=undefined;throw e;});}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function assetActivityEmail(input:{kind:AssetEmailKind;assetTitle:string;description:string;actor:string;when:string;url:string;photoUrl?:string;preferences:{asset:string;account:string;all:string}}):Message{
 const title=input.kind==='problem_logged'?'Problem reported':input.kind==='problem_resolved'?'Problem resolved':'Maintenance completed';
 const subject=`${title}: ${input.assetTitle}`;
 const details=`${input.actor} · ${input.when}`;
 const action=input.kind.startsWith('problem_')?'View problem':'View maintenance';
 const links=`Stop these updates for this asset: ${input.preferences.asset}\nStop these updates for your account: ${input.preferences.account}\nStop all asset updates for this asset: ${input.preferences.all}`;
 return {subject,text:`${subject}\n${details}\n\n${input.description}\n\n${action}: ${input.url}\n\n${links}\nYour records stay saved. These links also let you turn emails back on.`,html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f2f6f3;color:#173c32;font-family:${AIM4PRICE_EMAIL_FONT_STACK}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:white;border:1px solid #d7e5dc;border-radius:12px">${buildEmailBrandHeader(new URL(AIM4PRICE_EMAIL_LOGO_PATH,getSiteOrigin()).toString())}<tr><td style="padding:24px"><p style="color:#a65315;font-weight:700;margin:0 0 12px">${title}</p><h1 style="font-size:25px;margin:0 0 12px">${escape(input.assetTitle)}</h1><p style="font-size:14px;color:#486357">${escape(details)}</p><p style="padding:18px;background:#fff8ef;border:1px solid #f0dcc3;border-radius:10px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere">${escape(input.description)}</p>${input.photoUrl?`<img src="${escape(input.photoUrl)}" alt="Photo attached to this problem" style="display:block;width:100%;max-width:552px;height:auto;border-radius:10px;margin:16px 0">`:""}<a href="${escape(input.url)}" style="display:block;padding:16px;background:#1a654d;color:white;text-align:center;text-decoration:none;border-radius:8px;font-weight:700">${action}</a><p style="font-size:14px;line-height:1.7;margin-top:24px"><a style="color:#1a654d" href="${escape(input.preferences.asset)}">Stop these updates for this asset</a><br><a style="color:#1a654d" href="${escape(input.preferences.account)}">Stop these updates for my account</a><br><a style="color:#1a654d" href="${escape(input.preferences.all)}">Stop all asset updates for this asset</a></p><p style="font-size:14px;color:#486357">Your records stay saved. You can turn emails back on using these links.</p></td></tr></table></td></tr></table></body></html>`};
}
// Canonical history records are committed with the work. Read transitions, not ordinary edits.
export async function collectAssetEmailEvents(since:string){
 await getDb().query(`INSERT INTO asset_email_events(event_key,owner_id,asset_id,record_id,kind,actor_id,actor_name,created_at)
 SELECT kind||':'||h.record_id,h.owner_id,h.asset_id,h.record_id,kind,
 coalesce(h.actor_id,scan.actor_id,CASE WHEN h.after_data->>'actor_type'='owner_session' THEN h.owner_id END),
 coalesce(h.actor_name,scan.actor_name,h.after_data->>'operator_name',h.after_data->>'completed_by'),h.created_at
 FROM asset_history_events h LEFT JOIN LATERAL (SELECT sh.actor_id,sh.actor_name FROM asset_history_events sh WHERE sh.record_table='asset_scan_events' AND sh.record_id=h.after_data->>'source_scan_event_id' AND sh.operation='INSERT' AND sh.owner_id=h.owner_id AND sh.asset_id=h.asset_id ORDER BY sh.created_at LIMIT 1) scan ON true CROSS JOIN LATERAL (SELECT CASE
 WHEN h.record_table='asset_scan_events' AND h.operation='INSERT' AND coalesce(h.after_data->>'note','') ~* 'notes[[:space:]]*/[[:space:]]*problems[[:space:]]*:' THEN 'problem_logged'
 WHEN h.record_table='asset_scan_events' AND h.operation='UPDATE' AND nullif(h.before_data->>'issue_noted_at','') IS NULL AND nullif(h.after_data->>'issue_noted_at','') IS NOT NULL AND coalesce(h.after_data->>'note','') ~* 'notes[[:space:]]*/[[:space:]]*problems[[:space:]]*:' THEN 'problem_resolved'
 WHEN h.record_table='asset_maintenance_records' AND h.operation IN ('INSERT','UPDATE') AND h.after_data->>'status'='done' AND coalesce(h.before_data->>'status','')<>'done' THEN 'maintenance_completed' END AS kind) k
 WHERE kind IS NOT NULL AND h.asset_id IS NOT NULL
 AND h.created_at>=greatest($1::timestamptz,(SELECT started_at FROM asset_email_rollout WHERE id='activity-v1'))
 AND h.source NOT ILIKE '%correction%'
 AND NOT EXISTS(SELECT 1 FROM asset_email_events e WHERE e.event_key=k.kind||':'||h.record_id)
 ORDER BY h.created_at,h.id LIMIT 200 ON CONFLICT DO NOTHING`,[since]);
}
export function recipientEligible(email:string,recipientId:string,actorId:string|null,test:boolean){return recipientId!==actorId&&(!test||email.trim().toLowerCase()===MAINTENANCE_TEST_EMAIL);}
export const CLAIM_ASSET_EMAIL_SQL=`INSERT INTO asset_email_deliveries(event_key,recipient_id,payload) VALUES($1,$2,$3::jsonb)
 ON CONFLICT(event_key,recipient_id) DO UPDATE SET attempted_at=now(),attempts=asset_email_deliveries.attempts+1
 WHERE asset_email_deliveries.sent_at IS NULL AND asset_email_deliveries.attempted_at<now()-interval '15 minutes'
 AND asset_email_deliveries.first_attempt_at>now()-interval '23 hours' AND asset_email_deliveries.attempts<10 RETURNING payload`;
async function sendEvent(e:Event,test:boolean,since:string){
 let sent=0,failed=0;
 const category:AssetEmailCategory=e.kind.startsWith('problem_')?'problems':'maintenance';
 for(const user of await assetEmailRecipients(e.owner_id,e.asset_id)){
  if(!recipientEligible(user.email,user.id,e.actor_id,test))continue;
  const eligible=async()=>{
   const identity=(await getDb().query('SELECT email FROM "user" WHERE id=$1',[user.id])).rows[0];
   return !!identity&&identity.email===user.email&&recipientEligible(identity.email,user.id,e.actor_id,test)
    &&await maintenanceAssetAvailable(e.owner_id,e.asset_id)
    &&await trackingEmailPermission(e.owner_id,e.asset_id,user.id,e.kind)
    &&await maintenanceEmailsAllowed(user.id,e.asset_id,category);
  };
  if(!await eligible())continue;
  const asset=await getAssetRegisterItemById(e.owner_id,e.asset_id);if(!asset)continue;
  const current=async()=>{
   if(e.kind==='reminder'||e.kind==='maintenance_completed'){
    const r=await getAssetMaintenanceRecordById(e.owner_id,e.record_id);
    return r&&r.assetId===e.asset_id&&(e.kind==='reminder'?!!reminderStage(r)&&Date.parse(r.updatedAtIso)>=Date.parse(since):r.status==='done')?r:null;
   }
   const p=(await listIssueNotesForAssets([e.asset_id],{includeNoted:true})).find(p=>p.id===e.record_id);
   return p&&(e.kind==='problem_logged'?!p.notedAtIso:!!p.notedAtIso)?p:null;
  };
  const record=await current();if(!record)continue;
  // Existing pilot soon/due deliveries count as the one reminder already sent.
  if(e.kind==='reminder'&&(await getDb().query('SELECT 1 FROM maintenance_reminder_deliveries WHERE record_id=$1::uuid AND recipient_id=$2 AND (sent_at IS NOT NULL OR attempts>0) LIMIT 1',[e.record_id,user.id])).rows.length)continue;
  const preferences={asset:await maintenancePreferenceLink(user.id,e.asset_id,category),account:await maintenancePreferenceLink(user.id,'',category),all:await maintenancePreferenceLink(user.id,e.asset_id,'all')};
  let message:Message;
  if(e.kind==='reminder'){
   const r=record as NonNullable<Awaited<ReturnType<typeof getAssetMaintenanceRecordById>>>;
   const source=await maintenanceSource(r.id);
   const scheduler=(await getDb().query('SELECT name,email FROM "user" WHERE id=$1',[source?.scheduler_id||e.owner_id])).rows[0];
   message=maintenanceReminderEmail(r,asset.serialNumber||'',scheduler?.name||'The owner',getSiteOrigin()+reminderHref(r.id),preferences);
  }else{
   const description='note' in record?record.note:record.title;
   const photos=e.kind.startsWith('problem_')?(await getDb().query("SELECT photo_urls FROM asset_scan_events WHERE id=$1::uuid AND asset_id=$2::uuid",[e.record_id,e.asset_id])).rows[0]?.photo_urls:null;
   const photo=Array.isArray(photos)?photos.find((p:unknown)=>typeof p==='string'&&(p.startsWith('/')&&!p.startsWith('//')||p.startsWith('https://'))):undefined;
   const photoUrl=photo?new URL(photo,getSiteOrigin()).toString():undefined;
   message=assetActivityEmail({kind:e.kind,assetTitle:asset.title,description,photoUrl,actor:e.actor_name||'An asset team member',when:new Date(e.created_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}),url:getSiteOrigin()+(e.kind==='maintenance_completed'?reminderHref(e.record_id):`/asset-problem/${encodeURIComponent(e.record_id)}`),preferences});
  }
  const claim=await getDb().query(CLAIM_ASSET_EMAIL_SQL,[e.event_key,user.id,JSON.stringify({email:user.email,...message})]);if(!claim.rows.length)continue;
  try{
   if(!await eligible()||!await current())continue;
   const payload=claim.rows[0].payload;
   // Persisted content and recipient make provider retries identical, even after edits.
   if(payload.email!==user.email)continue;
   if(!process.env.RESEND_API_KEY)throw Error('Email service is not configured.');
   await sendAim4priceEmail({to:payload.email,subject:payload.subject,text:payload.text,html:payload.html,idempotencyKey:`asset:${e.event_key}:${user.id}`,usage:{accountId:e.owner_id,actorId:e.actor_id||e.owner_id,eventKey:`asset:${e.event_key}:${user.id}`}});
   await getDb().query('UPDATE asset_email_deliveries SET sent_at=now(),error=NULL WHERE event_key=$1 AND recipient_id=$2',[e.event_key,user.id]);sent++;
  }catch(error){failed++;await getDb().query('UPDATE asset_email_deliveries SET error=$3 WHERE event_key=$1 AND recipient_id=$2',[e.event_key,user.id,error instanceof Error?error.message:'Delivery failed']);}
 }
 return {sent,failed};
}
export async function sendAssetEmailBatch(after=''){
 const rollout=emailRollout();if(!rollout.enabled)return {sent:0,failed:0,next:null,disabled:true};
 await ensureAssetMaintenanceTables();await ensureMaintenanceReminders();await ensureAssetEmailDelivery();
 const allowedOwners=(process.env.MAINTENANCE_REMINDER_OWNER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
 const owners=(await getDb().query(`SELECT DISTINCT user_id FROM asset_maintenance_records WHERE status='upcoming' AND user_id>$1 AND (cardinality($2::text[])=0 OR user_id=ANY($2::text[])) ORDER BY user_id LIMIT 20`,[after,allowedOwners])).rows;
 let sent=0,failed=0;
 for(const owner of owners)for(const r of await listAssetMaintenanceRecords(owner.user_id,{status:'upcoming'})){
  if(!reminderStage(r)||Date.parse(r.updatedAtIso)<Date.parse(rollout.since))continue;
  const result=await sendEvent({event_key:`reminder:${r.id}`,owner_id:owner.user_id,asset_id:r.assetId,record_id:r.id,kind:'reminder',actor_id:null,actor_name:null,created_at:r.updatedAtIso},rollout.test,rollout.since);
  sent+=result.sent;failed+=result.failed;
 }
 await collectAssetEmailEvents(rollout.since);
 const events=(await getDb().query(`SELECT * FROM asset_email_events WHERE created_at>=greatest($1::timestamptz,now()-interval '23 hours') AND (cardinality($2::text[])=0 OR owner_id=ANY($2::text[])) ORDER BY created_at,event_key`,[rollout.since,allowedOwners])).rows as Event[];
 for(const event of events){const result=await sendEvent(event,rollout.test,rollout.since);sent+=result.sent;failed+=result.failed;}
 return {sent,failed,next:owners.length===20?owners.at(-1).user_id:null};
}
