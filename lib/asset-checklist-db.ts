import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { isDatabaseSchemaReady } from './database-schema-readiness';
import { validateAssetChecklistItem, type AssetChecklistItem } from './asset-checklist';

let ready: Promise<void> | undefined;
export function ensureAssetChecklistItems(): Promise<void> {
  if (!ready) ready = (async () => {
    const db = getDb();
    if (await isDatabaseSchemaReady(() => db.query('select id, user_id, asset_id, mode, label, description from public.asset_checklist_items limit 0'))) return;
    const client = await db.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(481172040)');
      await client.query(`CREATE TABLE IF NOT EXISTS public.asset_checklist_items (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  asset_id uuid NOT NULL REFERENCES public.asset_register_items(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('checked', 'serviced', 'repaired')),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);`);
      await client.query(`CREATE INDEX IF NOT EXISTS asset_checklist_items_owner_asset_idx
  ON public.asset_checklist_items (user_id, asset_id);
`);
      await client.query('commit');
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  })().catch(error => { ready = undefined; throw error; });
  return ready;
}

export async function assertChecklistAssetOwner(userId: string, assetId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId)) throw new Error('ASSET_NOT_FOUND');
  const { rows } = await getDb().query('select id from public.asset_register_items where user_id = $1 and id = $2::uuid', [userId, assetId]);
  if (!rows.length) throw new Error('ASSET_NOT_FOUND');
}

export async function listAssetChecklistItems(userId: string, assetId: string): Promise<AssetChecklistItem[]> {
  await assertChecklistAssetOwner(userId, assetId);
  await ensureAssetChecklistItems();
  const { rows } = await getDb().query<AssetChecklistItem>(`select c.id, c.mode, c.label, c.description
    from public.asset_checklist_items c join public.asset_register_items a on a.id = c.asset_id and a.user_id = c.user_id
    where c.user_id = $1 and c.asset_id = $2::uuid order by c.created_at, c.id`, [userId, assetId]);
  return rows;
}

export async function addAssetChecklistItem(userId: string, assetId: string, input: unknown): Promise<AssetChecklistItem> {
  const item = validateAssetChecklistItem(input);
  await assertChecklistAssetOwner(userId, assetId);
  await ensureAssetChecklistItems();
  const client = await getDb().connect();
  try {
    await client.query('begin');
    // Serialise additions for this asset, including ownership transfers, without a global lock.
    const owned = await client.query('select id from public.asset_register_items where user_id = $1 and id = $2::uuid for update', [userId, assetId]);
    if (!owned.rows.length) throw new Error('ASSET_NOT_FOUND');
    const count = await client.query<{ count: string }>('select count(*) from public.asset_checklist_items where user_id = $1 and asset_id = $2::uuid', [userId, assetId]);
    if (Number(count.rows[0].count) >= 60) throw new Error('This asset already has 60 custom items. Remove an item before adding another.');
    const result = await client.query<AssetChecklistItem>(`insert into public.asset_checklist_items (id, user_id, asset_id, mode, label, description)
      values ($1::uuid, $2, $3::uuid, $4, $5, $6) returning id, mode, label, description`, [randomUUID(), userId, assetId, item.mode, item.label, item.description]);
    await client.query('commit');
    return result.rows[0];
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}

export async function removeAssetChecklistItem(userId: string, assetId: string, itemId: string) {
  await assertChecklistAssetOwner(userId, assetId);
  await ensureAssetChecklistItems();
  const result = await getDb().query(`delete from public.asset_checklist_items c using public.asset_register_items a
    where c.id::text = $3 and c.user_id = $1 and c.asset_id = $2::uuid and a.id = c.asset_id and a.user_id = c.user_id returning c.id`, [userId, assetId, itemId]);
  if (!result.rows.length) throw new Error('ITEM_NOT_FOUND');
}
