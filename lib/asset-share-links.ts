import { createHash, randomBytes } from 'node:crypto';
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
ALTER TABLE public.asset_share_links ADD COLUMN IF NOT EXISTS umbrella_id uuid;
ALTER TABLE public.asset_share_links ADD COLUMN IF NOT EXISTS include_photos boolean;
ALTER TABLE public.asset_share_links ADD COLUMN IF NOT EXISTS display_options jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS asset_share_links_active_selection
  ON public.asset_share_links (user_id, selection_key) WHERE revoked_at IS NULL;`;
let schemaReady: Promise<void> | undefined;
export function ensureAssetShareSchema() {
  if (!schemaReady) schemaReady = getDb().query(ASSET_SHARE_SCHEMA).then(() => {}).catch(error => { schemaReady = undefined; throw error; });
  return schemaReady;
}
export type PublicAssetShare = { assets: ExternalAssetShareItem[]; createdAt: string; senderName?: string; umbrellaName?: string; updatedAt?: string };
function selectionKey(ids: string[], includePhotos: boolean, umbrellaId?: string) {
  return createHash('sha256').update(JSON.stringify(umbrellaId ? [ids, includePhotos, umbrellaId] : [ids, includePhotos])).digest('hex');
}
export async function findAssetShareLink(userId: string, ids: string[], includePhotos: boolean) {
  await ensureAssetShareSchema();
  const result = await getDb().query('SELECT token, created_at FROM asset_share_links WHERE user_id = $1 AND selection_key = $2 AND revoked_at IS NULL', [userId, selectionKey(parseShareAssetIds(ids), includePhotos)]);
  return result.rows[0] ?? null;
}
export async function createAssetShareLink(userId: string, assetIds: unknown, includePhotos: boolean, umbrella?: { id: string; name: string }) {
  const ids = parseShareAssetIds(assetIds);
  // Ownership comes from the authenticated account, never from the request body.
  const assets = await getAssetRegisterItemsByRefs(ids.map(assetId => ({ userId, assetId })));
  if (assets.length !== ids.length) throw new Error('ASSET_SHARE_FORBIDDEN');
  await ensureAssetShareSchema();
  const snapshot = ids.map(id => assetShareSnapshot(assets.find(asset => asset.id === id)!, includePhotos));
  const result = await getDb().query(`INSERT INTO asset_share_links (token, user_id, selection_key, asset_ids, snapshot, umbrella_name, umbrella_id, include_photos)
    VALUES ($1, $2, $3, $4::uuid[], $5::jsonb, $6, $7::uuid, $8)
    ON CONFLICT (user_id, selection_key) WHERE revoked_at IS NULL
    DO UPDATE SET selection_key = EXCLUDED.selection_key, umbrella_name = EXCLUDED.umbrella_name, umbrella_id = EXCLUDED.umbrella_id, include_photos = EXCLUDED.include_photos
    RETURNING token, created_at, (SELECT business_name FROM account_profiles WHERE user_id = $2) AS sender_name`, [randomBytes(32).toString('base64url'), userId, selectionKey(ids, includePhotos, umbrella?.id), ids, JSON.stringify(snapshot), umbrella?.name || null, umbrella?.id || null, includePhotos]);
  return result.rows[0];
}
export async function revokeAssetShareLink(userId: string, token: string) {
  await ensureAssetShareSchema();
  await getDb().query('UPDATE asset_share_links SET revoked_at = now() WHERE user_id = $1 AND token = $2 AND revoked_at IS NULL', [userId, token]);
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
  return {
    assets: ids.map(id => {
      const asset = assets.find(item => item.id === id)!;
      const item = assetShareSnapshot(asset, includePhotos);
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
