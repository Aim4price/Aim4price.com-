import { createHash, randomBytes } from 'node:crypto';
import { getDb } from './db';
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
CREATE UNIQUE INDEX IF NOT EXISTS asset_share_links_active_selection
  ON public.asset_share_links (user_id, selection_key) WHERE revoked_at IS NULL;`;
let schemaReady: Promise<void> | undefined;
function ensureSchema() {
  if (!schemaReady) schemaReady = getDb().query(ASSET_SHARE_SCHEMA).then(() => {}).catch(error => { schemaReady = undefined; throw error; });
  return schemaReady;
}
export type PublicAssetShare = { assets: ExternalAssetShareItem[]; createdAt: string };
function selectionKey(ids: string[], includePhotos: boolean) {
  return createHash('sha256').update(JSON.stringify([ids, includePhotos])).digest('hex');
}
export async function findAssetShareLink(userId: string, ids: string[], includePhotos: boolean) {
  await ensureSchema();
  const result = await getDb().query('SELECT token, created_at FROM asset_share_links WHERE user_id = $1 AND selection_key = $2 AND revoked_at IS NULL', [userId, selectionKey(parseShareAssetIds(ids), includePhotos)]);
  return result.rows[0] ?? null;
}
export async function createAssetShareLink(userId: string, assetIds: unknown, includePhotos: boolean) {
  const ids = parseShareAssetIds(assetIds);
  // Ownership comes from the authenticated account, never from the request body.
  const assets = await getAssetRegisterItemsByRefs(ids.map(assetId => ({ userId, assetId })));
  if (assets.length !== ids.length) throw new Error('ASSET_SHARE_FORBIDDEN');
  await ensureSchema();
  const snapshot = ids.map(id => assetShareSnapshot(assets.find(asset => asset.id === id)!, includePhotos));
  const result = await getDb().query(`INSERT INTO asset_share_links (token, user_id, selection_key, asset_ids, snapshot)
    VALUES ($1, $2, $3, $4::uuid[], $5::jsonb)
    ON CONFLICT (user_id, selection_key) WHERE revoked_at IS NULL
    DO UPDATE SET selection_key = EXCLUDED.selection_key
    RETURNING token, created_at`, [randomBytes(32).toString('base64url'), userId, selectionKey(ids, includePhotos), ids, JSON.stringify(snapshot)]);
  return result.rows[0];
}
export async function revokeAssetShareLink(userId: string, token: string) {
  await ensureSchema();
  await getDb().query('UPDATE asset_share_links SET revoked_at = now() WHERE user_id = $1 AND token = $2 AND revoked_at IS NULL', [userId, token]);
}
export async function readPublicAssetShare(token: string): Promise<PublicAssetShare | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  await ensureSchema();
  // A transfer or deletion invalidates access even to the older snapshot.
  const result = await getDb().query(`SELECT snapshot, created_at FROM asset_share_links s
    WHERE token = $1 AND revoked_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM unnest(s.asset_ids) AS requested(id)
      WHERE NOT EXISTS (SELECT 1 FROM asset_register_items a WHERE a.id = requested.id AND a.user_id = s.user_id))`, [token]);
  const row = result.rows[0];
  return row ? { assets: row.snapshot, createdAt: new Date(row.created_at).toISOString() } : null;
}
