import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getDb } from './db';
import { ensurePartsNetwork, PartsError } from './parts-network';
import { ensureBusinessNetwork, limitBusinessAction } from './business-network';
import type { PartsActor } from './parts-network-access';
import { getSiteOrigin } from './email';

const derive = promisify(scrypt);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const PARTS_SHARE_SCHEMA = `
CREATE TABLE IF NOT EXISTS parts_share_links (
 id uuid PRIMARY KEY, network_id uuid NOT NULL REFERENCES parts_networks(id), owner_id text NOT NULL,
 token text UNIQUE NOT NULL, recipient_id text, recipient_name text NOT NULL DEFAULT '',
 password_hash text, allow_download boolean NOT NULL DEFAULT false, allow_enquiry boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 consent_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS parts_share_sessions (
 token_hash text PRIMARY KEY, link_id uuid NOT NULL REFERENCES parts_share_links(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);`;
let ready: Promise<void> | undefined;
async function ensure() {
 await ensurePartsNetwork();
 await ensureBusinessNetwork();
 await (ready ??= getDb().query(PARTS_SHARE_SCHEMA).then(()=>{}).catch(e=>{ready=undefined;throw e;}));
}
export const APPROVED_PARTS_BUSINESS = `EXISTS (SELECT 1 FROM account_directory_listings l JOIN business_network b ON b.id=l.business_id WHERE l.user_id=u.id AND b.status='active' AND b.accepted_at IS NOT NULL)`;
async function passwordHash(value: unknown) {
 if (value === '' || value === undefined) return null;
 if (typeof value !== 'string' || value.length < 8 || value.length > 128) throw new PartsError('Use a password with 8–128 characters.');
 const salt=randomBytes(16).toString('hex');
 return `${salt}:${(await derive(value,salt,64) as Buffer).toString('hex')}`;
}
async function owner(db: any, actor: PartsActor, network: string) {
 if(actor.staff || actor.team || actor.viewerOnly) throw new PartsError('Only the list owner can manage sharing.',403);
 const result=await db.query('SELECT * FROM parts_networks WHERE id=$1 AND created_by=$2 AND list_mode AND NOT archived FOR UPDATE',[network,actor.id]);
 if(!result.rows.length) throw new PartsError('Only the list owner can manage sharing.',403);
}
export async function managePartsShare(actor: PartsActor, network: string, input: Record<string,unknown>) {
 await ensure();
 const password=input.password === undefined ? undefined : await passwordHash(input.password);
 const db=await getDb().connect();
 try {
  await db.query('BEGIN'); await owner(db,actor,network);
  if(input.action==='share-history') {
   const links=(await db.query(`SELECT id,token,recipient_name,recipient_id,created_at,revoked_at,(password_hash IS NOT NULL) AS protected,allow_download,allow_enquiry FROM parts_share_links WHERE network_id=$1 ORDER BY created_at DESC`,[network])).rows;
   await db.query('COMMIT'); return {links:links.map(l=>({...l,url:`${getSiteOrigin()}/parts-share/${l.token}`,token:undefined}))};
  }
  if(input.action==='create-share') {
   if(input.accepted!==true) throw new PartsError('Accept the sharing notice before creating a link.');
   if(!['link','direct'].includes(String(input.channel))) throw new PartsError('Choose a sharing method.');
   let recipient: any;
   if(input.channel==='direct') {
    recipient=(await db.query(`SELECT u.id,p.business_name FROM "user" u JOIN account_profiles p ON p.user_id=u.id WHERE lower(u.email)=lower($1) AND u.id<>$2 AND p.account_status='active' AND p.account_type IN ('dealer','business') AND coalesce(p.account_subtype,'') NOT IN ('middleman','machinery-middleman','equipment-middleman') AND ${APPROVED_PARTS_BUSINESS}`,[String(input.email||''),actor.id])).rows[0];
    if(!recipient) throw new PartsError('Choose an approved business with a directory listing and Aim4price account.');
   }
   const token=randomBytes(32).toString('hex');
   await db.query(`INSERT INTO parts_share_links(id,network_id,owner_id,token,recipient_id,recipient_name,password_hash,allow_download,allow_enquiry) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[randomUUID(),network,actor.id,token,recipient?.id||null,recipient?.business_name||'',password||null,input.allowDownload===true,input.allowEnquiry===true]);
   await db.query("INSERT INTO parts_network_audit(id,network_id,actor_id,action,target) VALUES($1,$2,$3,'create-share',$4)",[randomUUID(),network,actor.id,recipient?.id||'link']);
   await db.query('COMMIT'); return {url:`${getSiteOrigin()}/parts-share/${token}`};
  }
  const link=(await db.query('SELECT id FROM parts_share_links WHERE id=$1 AND network_id=$2 AND owner_id=$3 FOR UPDATE',[input.id,network,actor.id])).rows[0];
  if(!link) throw new PartsError('Share unavailable.',404);
  if(input.action==='revoke-share') await db.query('UPDATE parts_share_links SET revoked_at=now() WHERE id=$1',[link.id]);
  else if(input.action==='delete-share') await db.query('DELETE FROM parts_share_links WHERE id=$1',[link.id]);
  else if(input.action==='update-share') {
   await db.query('UPDATE parts_share_links SET password_hash=CASE WHEN $2 THEN $3 ELSE password_hash END,allow_download=$4,allow_enquiry=$5 WHERE id=$1',[link.id,password!==undefined,password||null,input.allowDownload===true,input.allowEnquiry===true]);
  } else throw new PartsError('Unknown sharing action.');
  // Password changes, permission changes and revocation invalidate all unlocked sessions.
  await db.query('DELETE FROM parts_share_sessions WHERE link_id=$1',[link.id]);
  await db.query('INSERT INTO parts_network_audit(id,network_id,actor_id,action,target) VALUES($1,$2,$3,$4,$5)',[randomUUID(),network,actor.id,String(input.action),String(link.id)]);
  await db.query('COMMIT'); return {ok:true};
 } catch(e) {await db.query('ROLLBACK');throw e;} finally {db.release();}
}
export type PartsShareViewer = {id:string;email:string} | null;
async function linkFor(token: string, viewer: PartsShareViewer) {
 await ensure();
 if(!/^[a-f0-9]{64}$/.test(token)) throw new PartsError('This parts link is unavailable.',404);
 const link=(await getDb().query(`SELECT s.*,n.name,m.business_name,m.vat_included,m.extra_fields FROM parts_share_links s JOIN parts_networks n ON n.id=s.network_id JOIN parts_network_members m ON m.network_id=n.id AND m.dealer_id=n.created_by WHERE s.token=$1 AND s.revoked_at IS NULL AND NOT n.archived AND m.visible AND m.status='active'`,[token])).rows[0];
 if(!link) throw new PartsError('This parts link is unavailable or has been revoked.',404);
 if(link.recipient_id && viewer?.id!==link.recipient_id && viewer?.id!==link.owner_id) throw new PartsError('Sign in with the business account this list was shared with.',401);
 return link;
}
export async function openPartsShare(token:string, viewer:PartsShareViewer, session:string, input:Record<string,unknown>) {
 const link=await linkFor(token,viewer);
 // Welcome metadata only: protected rows remain behind the password check below.
 if(input.action==='landing') {
  const total=Number((await getDb().query('SELECT count(*) FROM parts_network_rows WHERE network_id=$1 AND dealer_id=$2 AND quantity>0',[link.network_id,link.owner_id])).rows[0].count);
  return {name:link.name,owner:link.business_name,total};
 }
 if(input.action==='unlock') {
  await limitBusinessAction(`parts-password:${link.id}`,30);
  if(typeof input.password!=='string'||input.password.length>128) throw new PartsError('Enter the link password.',403);
  if(link.password_hash) {
   const [salt,expected]=link.password_hash.split(':');
   const candidate=await derive(input.password,salt,64) as Buffer;
   if(!timingSafeEqual(candidate,Buffer.from(expected,'hex'))) throw new PartsError('The password is incorrect.',403);
  }
  const proof=randomBytes(32).toString('hex');
  const saved=await getDb().query(`INSERT INTO parts_share_sessions(token_hash,link_id,expires_at) SELECT $1,id,now()+interval '8 hours' FROM parts_share_links WHERE id=$2 AND password_hash IS NOT DISTINCT FROM $3 AND revoked_at IS NULL RETURNING token_hash`,[hash(proof),link.id,link.password_hash]);
  if(!saved.rows.length) throw new PartsError('Link settings changed. Please try again.',423);
  return {proof};
 }
 if(link.password_hash && viewer?.id!==link.owner_id) {
  const valid=(await getDb().query('SELECT 1 FROM parts_share_sessions WHERE token_hash=$1 AND link_id=$2 AND expires_at>now()',[hash(session),link.id])).rows.length;
  if(!valid) throw new PartsError('Enter the password from the list owner.',423);
 }
 const action=String(input.action||'view');
 if(!['view','download','enquire'].includes(action)) throw new PartsError('Unknown action.');
 if(action!=='view') {
  if(!viewer) throw new PartsError('Create a free account or sign in to continue.',401);
  if(!(action==='download'?link.allow_download:link.allow_enquiry)) throw new PartsError('The owner has not allowed this action.',403);
 }
 if(action==='enquire') {
  const message=typeof input.message==='string'?input.message.trim():'';
  if(!message||message.length>2000) throw new PartsError('Enter an enquiry of up to 2,000 characters.');
  if(viewer!.id===link.owner_id) throw new PartsError('This is your own parts list.');
  await limitBusinessAction(`parts-enquiry:${viewer!.id}`,10);
  await getDb().query(`INSERT INTO parts_enquiries(id,network_id,sender_id,recipient_id,part_number,message,reply_email) VALUES($1,$2,$3,$4,$5,$6,$7)`,[randomUUID(),link.network_id,viewer!.id,link.owner_id,'Parts list enquiry',message,viewer!.email]);
  return {ok:true};
 }
 const page=Math.max(0,Math.min(100000,Math.floor(Number(input.page)||0)));
 const fields=(link.extra_fields||[]).filter((f:any)=>!f.private);
 const rows=(await getDb().query(`SELECT part_number,description,brand,quantity,price,details FROM parts_network_rows WHERE network_id=$1 AND dealer_id=$2 AND quantity>0 ORDER BY part_key LIMIT $3 OFFSET $4`,[link.network_id,link.owner_id,action==='download'?50000:30,action==='download'?0:page*30])).rows.map(r=>({...r,details:Object.fromEntries(fields.filter((f:any)=>r.details?.[f.id]).map((f:any)=>[f.label,r.details[f.id]]))}));
 const total=Number((await getDb().query('SELECT count(*) FROM parts_network_rows WHERE network_id=$1 AND dealer_id=$2 AND quantity>0',[link.network_id,link.owner_id])).rows[0].count);
 return {name:link.name,owner:link.business_name,ownerId:link.owner_id,vatIncluded:link.vat_included,allowDownload:link.allow_download,allowEnquiry:link.allow_enquiry,signedIn:!!viewer,rows,total,page};
}
