import {randomBytes} from 'node:crypto';
import {getDb} from './db';
import {getSiteOrigin} from './email';

let schema: Promise<void> | undefined;
export function ensureMaintenanceEmailPreferences() {
  return schema ??= getDb().query(`CREATE TABLE IF NOT EXISTS maintenance_email_preferences (
    owner_id text NOT NULL, asset_scope text NOT NULL DEFAULT '',
    enabled boolean NOT NULL DEFAULT true, token text NOT NULL UNIQUE,
    updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id,asset_scope)
  )`).then(() => {}).catch(error => {schema=undefined; throw error;});
}

export async function maintenanceEmailsAllowed(ownerId: string, assetId: string) {
  await ensureMaintenanceEmailPreferences();
  const result = await getDb().query(`SELECT 1 FROM maintenance_email_preferences
    WHERE owner_id=$1 AND asset_scope=ANY($2::text[]) AND enabled=false LIMIT 1`, [ownerId,['',assetId]]);
  return result.rows.length===0;
}

export async function maintenancePreferenceLink(ownerId: string, assetId='') {
  await ensureMaintenanceEmailPreferences();
  // Opaque, unguessable capability limited to this owner's maintenance email preference.
  await getDb().query(`INSERT INTO maintenance_email_preferences(owner_id,asset_scope,token)
    VALUES($1,$2,$3) ON CONFLICT(owner_id,asset_scope) DO NOTHING`, [ownerId,assetId,randomBytes(32).toString('hex')]);
  const result=await getDb().query('SELECT token FROM maintenance_email_preferences WHERE owner_id=$1 AND asset_scope=$2',[ownerId,assetId]);
  return `${getSiteOrigin()}/maintenance-email-preferences/${result.rows[0].token}`;
}

export async function getMaintenanceEmailPreference(token: string) {
  if(!/^[a-f0-9]{64}$/.test(token)) return null;
  await ensureMaintenanceEmailPreferences();
  return (await getDb().query('SELECT asset_scope,enabled FROM maintenance_email_preferences WHERE token=$1',[token])).rows[0] as {asset_scope:string;enabled:boolean}|undefined;
}

export async function setMaintenanceEmailPreference(token:string, enabled:boolean) {
  if(!/^[a-f0-9]{64}$/.test(token)) return false;
  await ensureMaintenanceEmailPreferences();
  const result=await getDb().query(`UPDATE maintenance_email_preferences SET enabled=$2,updated_at=now() WHERE token=$1 RETURNING token`,[token,enabled]);
  return result.rows.length===1;
}
