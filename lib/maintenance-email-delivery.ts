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
 SELECT pg_advisory_xact_lock(hashtext('asset-email-delivery-schema'));
 CREATE TABLE IF NOT EXISTS asset_email_rollout(id text PRIMARY KEY,started_at timestamptz NOT NULL DEFAULT now());
 INSERT INTO asset_email_rollout(id) VALUES('activity-v1') ON CONFLICT DO NOTHING;
 CREATE TABLE IF NOT EXISTS asset_email_events(event_key text PRIMARY KEY,owner_id text NOT NULL,asset_id uuid NOT NULL,record_id text NOT NULL,kind text NOT NULL,actor_id text,actor_name text,created_at timestamptz NOT NULL);
 CREATE TABLE IF NOT EXISTS asset_email_deliveries(event_key text NOT NULL,recipient_id text NOT NULL,payload jsonb NOT NULL,first_attempt_at timestamptz NOT NULL DEFAULT now(),attempted_at timestamptz NOT NULL DEFAULT now(),attempts int NOT NULL DEFAULT 1,sent_at timestamptz,error text,PRIMARY KEY(event_key,recipient_id));
 ALTER TABLE asset_email_events ADD COLUMN IF NOT EXISTS checked_at timestamptz;
 ALTER TABLE asset_email_events ADD COLUMN IF NOT EXISTS last_error text;
 CREATE TABLE IF NOT EXISTS asset_email_worker(id text PRIMARY KEY,last_started_at timestamptz,last_finished_at timestamptz,last_error text,last_sent int NOT NULL DEFAULT 0,last_failed int NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS asset_email_events_recent ON asset_email_events(created_at);
 `).then(()=>{}).catch(e=>{ready=undefined;throw e;});}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function assetActivityEmail(input:{kind:AssetEmailKind;assetTitle:string;description:string;actor:string;when:string;url:string;photoUrl?:string;resolutionNote?:string;preferences:{asset:string;account:string;all:string}}):Message{
 const reported=input.kind==='problem_logged';
 const resolved=input.kind==='problem_resolved';
 const title=reported?'Problem reported':resolved?'Problem resolved':'Maintenance completed';
 const subject=`${title}: ${input.assetTitle}`;
 const action=reported||resolved?'View problem':'View maintenance';
 const accent=reported?'#a3262e':'#1a654d';
 const tint=reported?'#fff2f2':'#edf7f1';
 const border=reported?'#efc9cc':'#cce3d5';
 const intro=reported?'A new problem has been reported for this asset.':resolved?'This problem has been marked as resolved.':'Completed work has been recorded for this asset.';
 const noteLabel=resolved?'Original problem':reported?'Reported problem':'Work completed';
 const resolution=resolved?input.resolutionNote?.trim():'';
 const rows:[string,string][]=[[reported?'Reported by':resolved?'Resolved by':'Completed by',input.actor],[reported?'Reported on':resolved?'Resolved on':'Completed on',input.when]];
 const links=`Stop these emails to me for this asset: ${input.preferences.asset}\nStop these emails to me for all assets: ${input.preferences.account}\nStop all asset emails to me for this asset: ${input.preferences.all}`;
 const text=`${subject}\n${intro}\n\n${noteLabel}:\n${input.description}${resolution?`\n\nResolution note:\n${resolution}`:''}\n\n${action}: ${input.url}\n\n${rows.map(([label,value])=>`${label}: ${value}`).join('\n')}\n\n${links}\nYour records stay saved. These links also let you turn emails back on.`;
 const note=(label:string,value:string)=>`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px;background:${tint};border:1px solid ${border};border-radius:10px"><tr><td style="padding:18px;font-family:${AIM4PRICE_EMAIL_FONT_STACK}"><p style="margin:0 0 8px;font-size:14px;line-height:1.5;font-weight:700;color:${accent}">${label}</p><p style="margin:0;color:#173c32;font-size:16px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word">${escape(value).replace(/\r?\n/g,'<br>')}</p></td></tr></table>`;
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:620px){.activity-body{padding:20px 18px!important}.activity-title{font-size:23px!important}}</style></head>
 <body style="margin:0;background:#f2f6f3;color:#173c32;font-family:${AIM4PRICE_EMAIL_FONT_STACK}">
 <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
 <!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
 <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:white;border:1px solid #d7e5dc;border-radius:12px">
 ${buildEmailBrandHeader(new URL(AIM4PRICE_EMAIL_LOGO_PATH,getSiteOrigin()).toString())}
 <tr><td class="activity-body" style="padding:22px 30px;font-family:${AIM4PRICE_EMAIL_FONT_STACK}">
 <p style="margin:0 0 12px"><span style="display:inline-block;padding:6px 12px;border-radius:20px;background:${tint};color:${accent};font-size:14px;font-weight:700;line-height:20px">${title}</span></p>
 <h1 class="activity-title" style="margin:0 0 8px;color:#173c32;font-size:26px;line-height:1.3;font-weight:700;overflow-wrap:anywhere">${escape(input.assetTitle)}</h1>
 <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#486357">${intro}</p>
 ${note(noteLabel,input.description)}
 ${resolution?note('Resolution note',resolution):''}
 <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 18px"><tr><td align="center" bgcolor="#1a654d" style="border-radius:6px;mso-padding-alt:15px 24px"><a href="${escape(input.url)}" style="display:block;padding:15px 24px;color:white;text-decoration:none;font-family:${AIM4PRICE_EMAIL_FONT_STACK};font-size:15px;font-weight:bold">${action}</a></td></tr></table>
 <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows.map(([label,value])=>`<tr><th scope="row" align="left" valign="top" style="padding:10px 12px 10px 0;border-bottom:1px solid #e2ebe5;font-family:${AIM4PRICE_EMAIL_FONT_STACK};font-size:14px;color:#486357;font-weight:500;width:42%">${label}</th><td style="padding:10px 0;border-bottom:1px solid #e2ebe5;font-family:${AIM4PRICE_EMAIL_FONT_STACK};font-size:15px;color:#173c32;font-weight:600;line-height:1.5;overflow-wrap:anywhere">${escape(value)}</td></tr>`).join('')}</table>
 ${input.photoUrl?`<p style="margin:20px 0 10px;font-size:14px;font-weight:700;color:#486357">Attached photo</p><img src="${escape(input.photoUrl)}" alt="Photo attached to this problem" width="538" style="display:block;width:100%;max-width:538px;height:auto;border-radius:10px">`:''}
 <p style="margin:18px 0 0;color:#486357;font-size:14px;line-height:1.6">Button not working? <a href="${escape(input.url)}" style="color:#1a654d">${action} in Aim4price</a>.</p>
 <div style="margin-top:20px;padding-top:18px;border-top:1px solid #e2ebe5">
 <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#173c32">Email preferences</p>
 <p style="margin:0 0 8px;font-size:14px;line-height:1.6"><a style="color:#1a654d" href="${escape(input.preferences.asset)}">Stop these emails to me for this asset</a></p>
 <p style="margin:0 0 8px;font-size:14px;line-height:1.6"><a style="color:#1a654d" href="${escape(input.preferences.account)}">Stop these emails to me for all assets</a></p>
 <p style="margin:0 0 10px;font-size:14px;line-height:1.6"><a style="color:#1a654d" href="${escape(input.preferences.all)}">Stop all asset emails to me for this asset</a></p>
 <p style="margin:0;font-size:14px;line-height:1.6;color:#486357">Your records stay saved. You can turn emails back on using these links.</p>
 </div></td></tr></table><!--[if mso]></td></tr></table><![endif]-->
 </td></tr></table></body></html>`;
 return {subject,text,html};
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
export function recipientEligible(email:string,recipientId:string,actorId:string|null,test:boolean,ownerId?:string,kind?:AssetEmailKind){
 // The owner mailbox is the central destination for problem reports, even when
 // an owner-linked app or the owner account itself recorded the action.
 const ownerProblem=recipientId===ownerId&&(kind==='problem_logged'||kind==='problem_resolved');
 return (recipientId!==actorId||ownerProblem)&&(!test||email.trim().toLowerCase()===MAINTENANCE_TEST_EMAIL);
}
export const CLAIM_ASSET_EMAIL_SQL=`INSERT INTO asset_email_deliveries(event_key,recipient_id,payload) VALUES($1,$2,$3::jsonb)
 ON CONFLICT(event_key,recipient_id) DO UPDATE SET attempted_at=now(),attempts=asset_email_deliveries.attempts+1
 WHERE asset_email_deliveries.sent_at IS NULL AND asset_email_deliveries.attempted_at<now()-interval '15 minutes'
 AND asset_email_deliveries.first_attempt_at>now()-interval '23 hours' AND asset_email_deliveries.attempts<10 RETURNING payload`;
async function sendEvent(e:Event,test:boolean,since:string){
 let sent=0,failed=0;
 const category:AssetEmailCategory=e.kind.startsWith('problem_')?'problems':'maintenance';
 for(const user of await assetEmailRecipients(e.owner_id,e.asset_id)){
  if(!recipientEligible(user.email,user.id,e.actor_id,test,e.owner_id,e.kind))continue;
  const eligible=async()=>{
   const identity=(await getDb().query('SELECT email FROM "user" WHERE id=$1',[user.id])).rows[0];
   return !!identity&&identity.email===user.email&&recipientEligible(identity.email,user.id,e.actor_id,test,e.owner_id,e.kind)
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
   message=assetActivityEmail({kind:e.kind,assetTitle:asset.title,description,photoUrl,resolutionNote:'note' in record?record.resolutionNote:undefined,actor:e.actor_name||'An asset team member',when:new Date(e.created_at).toLocaleString('en-GB',{timeZone:'Africa/Johannesburg',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' SAST',url:getSiteOrigin()+(e.kind==='maintenance_completed'?reminderHref(e.record_id):`/asset-problem/${encodeURIComponent(e.record_id)}`),preferences});
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
export async function sendAssetEmailBatch(after='',includeReminders=true){
 const rollout=emailRollout();if(!rollout.enabled)return {sent:0,failed:0,next:null,disabled:true};
 await ensureAssetMaintenanceTables();await ensureMaintenanceReminders();await ensureAssetEmailDelivery();
 const allowedOwners=(process.env.MAINTENANCE_REMINDER_OWNER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
 const owners=(await getDb().query(`SELECT DISTINCT user_id FROM asset_maintenance_records WHERE status='upcoming' AND user_id>$1 AND (cardinality($2::text[])=0 OR user_id=ANY($2::text[])) ORDER BY user_id LIMIT 20`,[after,allowedOwners])).rows;
 let sent=0,failed=0;
 for(const owner of includeReminders?owners:[])for(const r of await listAssetMaintenanceRecords(owner.user_id,{status:'upcoming'})){
  if(!reminderStage(r)||Date.parse(r.updatedAtIso)<Date.parse(rollout.since))continue;
  try {
  const result=await sendEvent({event_key:`reminder:${r.id}`,owner_id:owner.user_id,asset_id:r.assetId,record_id:r.id,kind:'reminder',actor_id:null,actor_name:null,created_at:r.updatedAtIso},rollout.test,rollout.since);
  sent+=result.sent;failed+=result.failed;
  } catch(error) { failed++;console.error('Maintenance reminder processing failed',{recordId:r.id,error}); }
 }
 await collectAssetEmailEvents(rollout.since);
 const events=(await getDb().query(`SELECT * FROM asset_email_events WHERE created_at>=$1::timestamptz AND (cardinality($2::text[])=0 OR owner_id=ANY($2::text[])) ORDER BY checked_at ASC NULLS FIRST,created_at,event_key LIMIT 200`,[rollout.since,allowedOwners])).rows as Event[];
 for(const event of events){
  try {
   const result=await sendEvent(event,rollout.test,rollout.since);sent+=result.sent;failed+=result.failed;
   await getDb().query('UPDATE asset_email_events SET checked_at=now(),last_error=NULL WHERE event_key=$1',[event.event_key]);
  } catch(error) {
   failed++;
   await getDb().query('UPDATE asset_email_events SET checked_at=now(),last_error=$2 WHERE event_key=$1',[event.event_key,error instanceof Error?error.message:'Event processing failed']);
  }
 }
 return {sent,failed,next:includeReminders&&owners.length===20?owners.at(-1).user_id:null};
}

