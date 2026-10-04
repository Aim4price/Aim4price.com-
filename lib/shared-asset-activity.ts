import type { PoolClient } from 'pg';
import { getDb } from './db';
let ready:Promise<void>|undefined;
export function ensureSharedAssetActivity() { return ready??=getDb().query(`CREATE TABLE IF NOT EXISTS shared_asset_activity(id uuid PRIMARY KEY,owner_id text NOT NULL,asset_id uuid NOT NULL,actor_id text NOT NULL,actor_name text NOT NULL,action text NOT NULL,before_data jsonb NOT NULL DEFAULT '{}',after_data jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()); ALTER TABLE shared_asset_activity ADD COLUMN IF NOT EXISTS transaction_id bigint; ALTER TABLE shared_asset_activity ALTER COLUMN transaction_id SET DEFAULT txid_current(); CREATE INDEX IF NOT EXISTS shared_asset_activity_asset ON shared_asset_activity(owner_id,asset_id,created_at DESC)`).then(()=>{}).catch(e=>{ready=undefined;throw e;}); }
export async function recordSharedAssetActivity(client: PoolClient, input: {
    id: string;
    ownerId: string;
    assetId: string;
    actorId: string;
    actorName: string;
    action: string;
    before?: unknown;
    after?: unknown;
}) {
    await client.query(`INSERT INTO shared_asset_activity(id,owner_id,asset_id,actor_id,actor_name,action,before_data,after_data) VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,$7::jsonb,$8::jsonb) ON CONFLICT(id) DO NOTHING`, [input.id, input.ownerId, input.assetId, input.actorId, input.actorName, input.action, JSON.stringify(input.before || {}), JSON.stringify(input.after || {})]);
}
