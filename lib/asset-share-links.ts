import { sharedMarketAssessments } from './shared-market-assessment';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { getDb } from './db';
import { getAssetGroupById } from './asset-groups';
import { getAssetRegisterItemsByRefs } from './asset-register-db';
import { assetShareSnapshot, parseShareAssetIds } from './asset-share-snapshot';
import type { ExternalAssetShareItem } from './asset-external-share';

export const ASSET_SHARE_SCHEMA = `CREATE TABLE IF NOT EXISTS public.asset_share_links (
  token text PRIMARY KEY,
  user_id text NOT NULL,
  selection_key text NOT NULL,
  asset_ids uuid[] NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
ALTER TABLE public.asset_share_links ADD COLUMN IF NOT EXISTS umbrella_name text;
ALTER TABLE public.asset_share_links ADD COLUMN IF NOT EXISTS history_deleted_at timestamptz;
ALTER TABLE public.asset_share_links ADD COLUMN IF NOT EXISTS umbrella_id uuid;
ALTER TABLE public.asset_share_links ADD COLUMN IF NOT EXISTS include_photos boolean;
ALTER TABLE public.asset_share_links ADD COLUMN IF NOT EXISTS display_options jsonb;
ALTER TABLE public.asset_share_links ADD COLUMN IF NOT EXISTS password_hash text;
CREATE TABLE IF NOT EXISTS public.asset_share_sessions (
  token_hash text PRIMARY KEY,
  share_token text NOT NULL REFERENCES public.asset_share_links(token) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS asset_share_links_active_selection
  ON public.asset_share_links (user_id, selection_key) WHERE revoked_at IS NULL;`;
let schemaReady: Promise<void> | undefined;
export function ensureAssetShareSchema() {
  if (!schemaReady) schemaReady = getDb().query(ASSET_SHARE_SCHEMA).then(() => {}).catch(error => { schemaReady = undefined; throw error; });
  return schemaReady;
}
export type PublicAssetShare = { assets: ExternalAssetShareItem[]; createdAt: string; senderName?: string; umbrellaName?: string; updatedAt?: string };
const derivePassword = promisify(scrypt);
const digest = (value:string) => createHash('sha256').update(value).digest('hex');
export const assetSharePasswordCookie = (token:string) => `asset-share-${token.slice(0,16)}`;
export async function hashAssetSharePassword(value:unknown):Promise<string|null> {
  if(value===undefined)return null;
  if(value===''||value===null)return null;
  if(typeof value!=='string'||value.length<8||value.length>128)throw new Error('Use a password with 8–128 characters.');
  const salt=randomBytes(16).toString('hex');
  return `${salt}:${(await derivePassword(value,salt,64) as Buffer).toString('hex')}`;
}
export async function assetSharePasswordIsUnlocked(token:string, ownerId?:string, expectedHash?:string|null):Promise<boolean> {
  await ensureAssetShareSchema();
  let passwordHash=expectedHash;
  if(passwordHash===undefined){
    const row=(await getDb().query('SELECT password_hash FROM asset_share_links WHERE token=$1 AND revoked_at IS NULL',[token])).rows[0];
    passwordHash=row?.password_hash||null;
  }
  if(!passwordHash)return true;
  try {
    const proof=(await cookies()).get(assetSharePasswordCookie(token))?.value||'';
    if(!proof)return false;
    return (await getDb().query('SELECT 1 FROM asset_share_sessions WHERE token_hash=$1 AND share_token=$2 AND expires_at>now()',[digest(proof),token])).rows.length>0;
  } catch { return false; }
}
export async function getAssetSharePasswordState(token:string) {
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))return {exists:false,protected:false,unlocked:false};
  await ensureAssetShareSchema();
  const row=(await getDb().query('SELECT user_id,password_hash FROM asset_share_links WHERE token=$1 AND revoked_at IS NULL',[token])).rows[0];
  if(!row)return {exists:false,protected:false,unlocked:false};
  const protectedLink=Boolean(row.password_hash);
  return {exists:true,protected:protectedLink,unlocked:!protectedLink||await assetSharePasswordIsUnlocked(token,row.user_id,row.password_hash)};
}
export async function unlockAssetSharePassword(token:string,password:unknown) {
  await ensureAssetShareSchema();
  const row=(await getDb().query('SELECT password_hash FROM asset_share_links WHERE token=$1 AND revoked_at IS NULL',[token])).rows[0];
  if(!row)throw new Error('This asset link is unavailable.');
  if(!row.password_hash)return '';
  if(typeof password!=='string'||password.length>128)throw new Error('Enter the link password.');
  const [salt,expected]=String(row.password_hash).split(':');
  const candidate=await derivePassword(password,salt,64) as Buffer;
  if(!timingSafeEqual(candidate,Buffer.from(expected||'','hex')))throw new Error('The password is incorrect.');
  const proof=randomBytes(32).toString('hex');
  await getDb().query('DELETE FROM asset_share_sessions WHERE expires_at<=now()');
  const saved=await getDb().query(`INSERT INTO asset_share_sessions(token_hash,share_token,expires_at)
    SELECT $1,token,now()+interval '8 hours' FROM asset_share_links WHERE token=$2 AND password_hash=$3 AND revoked_at IS NULL RETURNING token_hash`,[digest(proof),token,row.password_hash]);
  if(!saved.rows.length)throw new Error('Link settings changed. Please try again.');
  return proof;
}
function selectionKey(ids: string[], includePhotos: boolean, umbrellaId?: string) {
  return createHash('sha256').update(JSON.stringify(umbrellaId ? [ids, includePhotos, umbrellaId] : [ids, includePhotos])).digest('hex');
}
export async function findAssetShareLink(userId: string, ids: string[], includePhotos: boolean) {
  await ensureAssetShareSchema();
  const result = await getDb().query('SELECT token, created_at, (password_hash IS NOT NULL) AS protected FROM asset_share_links WHERE user_id = $1 AND selection_key = $2 AND revoked_at IS NULL', [userId, selectionKey(parseShareAssetIds(ids), includePhotos)]);
  return result.rows[0] ?? null;
}
export async function createAssetShareLink(userId: string, assetIds: unknown, includePhotos: boolean, umbrella?: { id: string; name: string }, password?: unknown) {
  const ids = parseShareAssetIds(assetIds);
  // Ownership comes from the authenticated account, never from the request body.
  const assets = await getAssetRegisterItemsByRefs(ids.map(assetId => ({ userId, assetId })));
  if (assets.length !== ids.length) throw new Error('ASSET_SHARE_FORBIDDEN');
  await ensureAssetShareSchema();
  const passwordHash=password===undefined?undefined:await hashAssetSharePassword(password);
  const snapshot = ids.map(id => assetShareSnapshot(assets.find(asset => asset.id === id)!, includePhotos));
  const result = await getDb().query(`INSERT INTO asset_share_links (token, user_id, selection_key, asset_ids, snapshot, umbrella_name, umbrella_id, include_photos, password_hash)
    VALUES ($1, $2, $3, $4::uuid[], $5::jsonb, $6, $7::uuid, $8, $10)
    ON CONFLICT (user_id, selection_key) WHERE revoked_at IS NULL
    DO UPDATE SET selection_key = EXCLUDED.selection_key, umbrella_name = EXCLUDED.umbrella_name, umbrella_id = EXCLUDED.umbrella_id, include_photos = EXCLUDED.include_photos,
      password_hash = CASE WHEN $9 THEN $10 ELSE asset_share_links.password_hash END
    RETURNING token, created_at, (password_hash IS NOT NULL) AS protected, (SELECT business_name FROM account_profiles WHERE user_id = $2) AS sender_name`, [randomBytes(32).toString('base64url'), userId, selectionKey(ids, includePhotos, umbrella?.id), ids, JSON.stringify(snapshot), umbrella?.name || null, umbrella?.id || null, includePhotos, passwordHash!==undefined, passwordHash||null]);
  if(passwordHash!==undefined)await getDb().query('DELETE FROM asset_share_sessions WHERE share_token=$1',[result.rows[0].token]);
  return result.rows[0];
}
export async function revokeAssetShareLink(userId: string, token: string) {
  await ensureAssetShareSchema();
  await getDb().query('UPDATE asset_share_links SET revoked_at = now() WHERE user_id = $1 AND token = $2 AND revoked_at IS NULL', [userId, token]);
  await getDb().query('DELETE FROM asset_share_sessions WHERE share_token=$1',[token]);
}
export async function readPublicAssetShare(token: string): Promise<PublicAssetShare | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  await ensureAssetShareSchema();
  const result = await getDb().query(`SELECT s.*, p.business_name AS sender_name FROM asset_share_links s
    LEFT JOIN account_profiles p ON p.user_id = s.user_id
    WHERE token = $1 AND revoked_at IS NULL`, [token]);
  const row = result.rows[0];
  if (!row) return null;
  let ids: string[] = row.asset_ids;
  let umbrellaName = row.umbrella_name || '';
  if (row.umbrella_id) {
    const group = await getAssetGroupById(row.user_id, row.umbrella_id);
    if (!group) return null;
    ids = [...new Set(group.members.map(member => member.assetId))].sort();
    umbrellaName = group.name;
  }
  const assets = ids.length ? await getAssetRegisterItemsByRefs(ids.map(assetId => ({ userId: row.user_id, assetId }))) : [];
  // Fail closed on transfer/deletion. Never return stored snapshot data.
  if (assets.length !== ids.length) return null;
  const includePhotos = row.include_photos ?? (Array.isArray(row.snapshot) && row.snapshot.some((asset: ExternalAssetShareItem) => asset.photoUrls?.length));
  const marketAssessments = await sharedMarketAssessments(row.user_id, assets, row.display_options?.valuation !== false);
  return {
    assets: ids.map(id => {
      const asset = assets.find(item => item.id === id)!;
      const item = assetShareSnapshot(asset, includePhotos);
      if (marketAssessments[id]) item.marketAssessment = marketAssessments[id];
      if (row.display_options?.valuation === false) { item.valueExVat = null; item.replacementPriceExVat = null; }
      if (row.display_options?.replacementPrice === false) item.replacementPriceExVat = null;
      if (row.display_options?.mainPhotoOnly === true) item.photoUrls = item.photoUrls.slice(0, 1);
      return { ...item, assetId: id };
    }),
    umbrellaName,
    senderName: (row.sender_name || '').trim().slice(0, 120),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: assets.map(asset => asset.updatedAtIso || '').sort().at(-1) || undefined,
  };
}

/** Recheck ownership in sensitive writes without relying on a saved selection. */
export function liveShareOwnershipSql(alias = 's') {
  return `((${alias}.umbrella_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM asset_groups g WHERE g.id=${alias}.umbrella_id AND g.user_id=${alias}.user_id
  )) OR (${alias}.umbrella_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM unnest(${alias}.asset_ids) requested(id) WHERE NOT EXISTS (
      SELECT 1 FROM asset_register_items a WHERE a.id=requested.id AND a.user_id=${alias}.user_id
    )
  )))`;
}
