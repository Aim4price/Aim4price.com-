import {randomBytes} from 'node:crypto';
import {getDb} from './db';
import {getSiteOrigin} from './email';
export type AssetEmailCategory='maintenance'|'problems'|'all';
let schema:Promise<void>|undefined;
export function ensureMaintenanceEmailPreferences(){
 return schema??=getDb().query(`SELECT pg_advisory_xact_lock(hashtext('maintenance-email-preferences'));
 CREATE TABLE IF NOT EXISTS maintenance_email_preferences(owner_id text NOT NULL,asset_scope text NOT NULL DEFAULT '',enabled boolean NOT NULL DEFAULT true,token text NOT NULL UNIQUE,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_id,asset_scope));
 ALTER TABLE maintenance_email_preferences ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'maintenance';
 ALTER TABLE maintenance_email_preferences DROP CONSTRAINT IF EXISTS maintenance_email_preferences_pkey;
 ALTER TABLE maintenance_email_preferences ADD PRIMARY KEY(owner_id,asset_scope,category);`).then(()=>{}).catch(e=>{schema=undefined;throw e;});
}
// owner_id is the recipient's account, including for a dealer tracking someone else's asset.
export async function maintenanceEmailsAllowed(recipientId:string,assetId:string,category:AssetEmailCategory='maintenance'){
 await ensureMaintenanceEmailPreferences();
 const result=await getDb().query(`SELECT 1 FROM maintenance_email_preferences WHERE owner_id=$1 AND asset_scope=ANY($2::text[]) AND category=ANY($3::text[]) AND enabled=false LIMIT 1`,[recipientId,['',assetId],[category,'all']]);
 return result.rows.length===0;
}
export async function maintenancePreferenceLink(recipientId:string,assetId='',category:AssetEmailCategory='maintenance'){
 await ensureMaintenanceEmailPreferences();
 await getDb().query(`INSERT INTO maintenance_email_preferences(owner_id,asset_scope,category,token) VALUES($1,$2,$3,$4) ON CONFLICT(owner_id,asset_scope,category) DO NOTHING`,[recipientId,assetId,category,randomBytes(32).toString('hex')]);
 const result=await getDb().query('SELECT token FROM maintenance_email_preferences WHERE owner_id=$1 AND asset_scope=$2 AND category=$3',[recipientId,assetId,category]);
 return `${getSiteOrigin()}/maintenance-email-preferences/${result.rows[0].token}`;
}
export async function getMaintenanceEmailPreference(token:string){
 if(!/^[a-f0-9]{64}$/.test(token))return null;
 await ensureMaintenanceEmailPreferences();
 return (await getDb().query('SELECT asset_scope,enabled,category FROM maintenance_email_preferences WHERE token=$1',[token])).rows[0] as {asset_scope:string;enabled:boolean;category:AssetEmailCategory}|undefined;
}
export async function setMaintenanceEmailPreference(token:string,enabled:boolean){
 if(!/^[a-f0-9]{64}$/.test(token))return false;
 await ensureMaintenanceEmailPreferences();
 return (await getDb().query('UPDATE maintenance_email_preferences SET enabled=$2,updated_at=now() WHERE token=$1 RETURNING token',[token,enabled])).rows.length===1;
}
