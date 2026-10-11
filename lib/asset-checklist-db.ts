import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { isDatabaseSchemaReady } from './database-schema-readiness';
import { validateAssetChecklistItem, type AssetChecklistItem } from './asset-checklist';

let ready: Promise<void> | undefined;
export function ensureAssetChecklistItems(): Promise<void> {
  if (!ready) ready = (async () => {
    const db = getDb();
    if (await isDatabaseSchemaReady(() => db.query('select id, user_id, asset_id, mode, label, description, source_id, hidden, revision from public.asset_checklist_items limit 0'))) return;
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
      await client.query(`ALTER TABLE public.asset_checklist_items ADD COLUMN IF NOT EXISTS source_id text`);
      await client.query(`ALTER TABLE public.asset_checklist_items ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false`);
      await client.query(`ALTER TABLE public.asset_checklist_items ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0`);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS asset_checklist_source_idx ON public.asset_checklist_items(user_id,asset_id,mode,source_id)`);
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
  const { rows } = await getDb().query<AssetChecklistItem>(`select c.id, c.mode, c.label, c.description, c.source_id AS "sourceId", c.hidden, c.revision
    from public.asset_checklist_items c join public.asset_register_items a on a.id = c.asset_id and a.user_id = c.user_id
    where c.user_id = $1 and c.asset_id = $2::uuid order by c.created_at, c.id`, [userId, assetId]);
  return rows;
}

export async function addAssetChecklistItem(userId: string, assetId: string, input: unknown, checkAccess?: () => Promise<void>): Promise<AssetChecklistItem> {
  const item = validateAssetChecklistItem(input);
  await assertChecklistAssetOwner(userId, assetId);
  await ensureAssetChecklistItems();
  const client = await getDb().connect();
  try {
    await client.query('begin');
    // Serialise additions for this asset, including ownership transfers, without a global lock.
    const owned = await client.query('select id from public.asset_register_items where user_id = $1 and id = $2::uuid for update', [userId, assetId]);
    if (!owned.rows.length) throw new Error('ASSET_NOT_FOUND');
    await checkAccess?.();
    const count = await client.query<{ count: string }>('select count(*) from public.asset_checklist_items where user_id = $1 and asset_id = $2::uuid and source_id IS NULL', [userId, assetId]);
    if (Number(count.rows[0].count) >= 60) throw new Error('This asset already has 60 custom items. Remove an item before adding another.');
    const result = await client.query<AssetChecklistItem>(`insert into public.asset_checklist_items (id, user_id, asset_id, mode, label, description)
      values ($1::uuid, $2, $3::uuid, $4, $5, $6) returning id, mode, label, description`, [randomUUID(), userId, assetId, item.mode, item.label, item.description]);
    await client.query('commit');
    return result.rows[0];
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}

export async function removeAssetChecklistItem(userId: string, assetId: string, itemId: string, checkAccess?: () => Promise<void>) {
  await assertChecklistAssetOwner(userId, assetId);
  await ensureAssetChecklistItems();
  await checkAccess?.();
  const result = await getDb().query(`delete from public.asset_checklist_items c using public.asset_register_items a
    where c.id::text = $3 and c.user_id = $1 and c.asset_id = $2::uuid and a.id = c.asset_id and a.user_id = c.user_id returning c.id`, [userId, assetId, itemId]);
  if (!result.rows.length) throw new Error('ITEM_NOT_FOUND');
}

/** Changes only this asset's checklist; catalogue entries remain untouched. */
export async function changeAssetChecklistItem(userId: string, assetId: string, input: unknown, checkAccess?: () => Promise<void>) {
  const body = input as Record<string, unknown>;
  const item = validateAssetChecklistItem(body);
  const optionId = body.optionId;
  if (typeof optionId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(optionId) || !['edit', 'delete'].includes(String(body.action)) || !Number.isInteger(body.revision) || Number(body.revision) < 0) throw new Error('Enter an item with valid details.');
  await assertChecklistAssetOwner(userId, assetId);
  await ensureAssetChecklistItems();
  const client = await getDb().connect();
  try {
    await client.query('begin');
    const owned = await client.query('select id from public.asset_register_items where user_id=$1 and id=$2::uuid for update', [userId, assetId]);
    if (!owned.rows.length) throw new Error('ASSET_NOT_FOUND');
    await checkAccess?.();
    const custom = optionId.startsWith('asset_custom_');
    const rows = await client.query<AssetChecklistItem>(`select id, revision from asset_checklist_items where user_id=$1 and asset_id=$2::uuid and mode=$3 and ${custom ? 'id::text=$4 AND source_id IS NULL' : 'source_id=$4'} for update`, [userId, assetId, item.mode, custom ? optionId.slice(13) : optionId]);
    const existing = rows.rows[0];
    if (custom && !existing) throw new Error('ITEM_NOT_FOUND');
    if ((existing?.revision ?? 0) !== body.revision) throw new Error('ITEM_CHANGED');
    if (custom && body.action === 'delete') {
      await client.query('delete from asset_checklist_items where id=$1::uuid', [existing.id]);
    } else if (existing) {
      await client.query('update asset_checklist_items set label=$2, description=$3, hidden=$4, revision=revision+1 where id=$1::uuid', [existing.id, item.label, item.description, body.action === 'delete']);
    } else {
      const count = await client.query('select count(*) from asset_checklist_items where user_id=$1 and asset_id=$2::uuid and source_id IS NOT NULL', [userId, assetId]);
      if (Number(count.rows[0].count) >= 300) throw new Error('This asset already has 300 checklist changes.');
      await client.query('insert into asset_checklist_items(id,user_id,asset_id,mode,label,description,source_id,hidden,revision) values($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8,1)', [randomUUID(),userId,assetId,item.mode,item.label,item.description,optionId,body.action === 'delete']);
    }
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
  return listAssetChecklistItems(userId, assetId);
}
