import { getAccountProfile } from './account-profile';
import { getAssetRegisterItemById, type AssetRegisterItem } from './asset-register-db';
import { ensureAssetRegisterTables } from './asset-registers';
import { getDb } from './db';
import { ensurePartnerAccessTables } from './partner-access';
import {
  createAssetTransferOffer,
  type Aim4priceSaleInfluence,
  type AssetTransferReceipt,
} from './asset-transfers';

export type AssetAcquisitionDetails = {
  eventId: string;
  newlyAcquired: boolean;
  acquisitionDate: string;
  acquisitionAmountExVat: number | null;
  note: string;
  sourceDocumentReference: string;
  updatedAtIso: string;
};

export type AssetDisposalReason =
  | 'sold' | 'traded_in' | 'scrapped' | 'written_off' | 'stolen' | 'donated'
  | 'returned_to_financier' | 'transferred' | 'mistake_duplicate' | 'created_in_error'
  | 'import_error' | 'test_record' | 'other';

export type AssetLifecycleReportItem = {
  id: string;
  assetId: string;
  assetTitle: string;
  eventType: 'acquired' | 'existing_added' | 'disposed' | 'deleted_duplicate';
  reason: string;
  effectiveDate: string;
  amountExVat: number | null;
  note: string;
  sourceDocumentReference: string;
  actorName: string;
  actorOrganisation: string;
  createdAtIso: string;
};

type LifecycleRow = {
  id: string;
  asset_register_item_id: string;
  event_type: AssetLifecycleReportItem['eventType'];
  reason: string | null;
  effective_date: string;
  amount_ex_vat: string | number | null;
  note: string | null;
  source_document_reference: string | null;
  actor_name: string | null;
  actor_organisation: string | null;
  asset_snapshot_json: unknown;
  created_at: string;
};

let lifecycleSchemaPromise: Promise<void> | null = null;

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function optionalAmount(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || text(value) === '') return null;
  const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function dateOnly(value: unknown): string {
  const date = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
}

function assetSnapshot(asset: AssetRegisterItem): Record<string, unknown> {
  return {
    id: asset.id,
    title: asset.title,
    kind: asset.kind,
    registerId: asset.registerId,
    value: asset.value,
    replacementPriceExVat: asset.replacementPriceExVat,
    brandName: asset.brandName,
    modelName: asset.modelName,
    yearModel: asset.yearModel,
    serialNumber: asset.serialNumber,
    isFinanced: asset.isFinanced,
    documents: asset.documents,
    createdAtIso: asset.createdAtIso,
    updatedAtIso: asset.updatedAtIso,
  };
}

async function ensureLifecycleSchemaOnce(): Promise<void> {
  await Promise.all([ensureAssetRegisterTables(), ensurePartnerAccessTables()]);
  const db = getDb();
  await db.query(`alter table public.asset_register_items add column if not exists lifecycle_state text not null default 'active'`);
  await db.query(`
    create table if not exists public.asset_lifecycle_events (
      id uuid primary key default gen_random_uuid(), owner_user_id text not null, register_id uuid,
      asset_register_item_id uuid not null, event_type text not null, reason text,
      effective_date date not null, amount_ex_vat numeric(14,2), note text,
      source_document_reference text, actor_user_id text not null, actor_name text,
      actor_organisation text, asset_snapshot_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);
  await db.query(`create index if not exists idx_asset_lifecycle_owner_register_date on public.asset_lifecycle_events(owner_user_id, register_id, effective_date desc, created_at desc)`);
  await db.query(`
    alter table public.asset_lifecycle_events
      add column if not exists aim4price_sale_influence text,
      add column if not exists transfer_status text,
      add column if not exists transfer_offer_id uuid,
      add column if not exists transferred_to_user_id text
  `);
}

export async function ensureAssetLifecycleSchema(): Promise<void> {
  if (!lifecycleSchemaPromise) {
    lifecycleSchemaPromise = ensureLifecycleSchemaOnce().catch((error) => {
      lifecycleSchemaPromise = null;
      throw error;
    });
  }
  return lifecycleSchemaPromise;
}

async function actorDetails(userId: string, fallbackName?: string | null) {
  const profile = await getAccountProfile({ id: userId, name: fallbackName });
  return {
    name: profile.displayName || profile.name || fallbackName || 'Aim4price user',
    organisation: profile.businessName || profile.displayName || profile.name || '',
  };
}

export async function recordManualAssetLifecycle(input: {
  ownerUserId: string;
  asset: AssetRegisterItem;
  newlyAcquired: boolean;
  acquisitionDate?: unknown;
  acquisitionAmountExVat?: unknown;
  note?: unknown;
  sourceDocumentReference?: unknown;
  actorName?: string | null;
}): Promise<AssetAcquisitionDetails> {
  await ensureAssetLifecycleSchema();
  const actor = await actorDetails(input.ownerUserId, input.actorName);
  const eventType = input.newlyAcquired ? 'acquired' : 'existing_added';
  const result = await getDb().query<LifecycleRow>(
    `insert into public.asset_lifecycle_events
       (owner_user_id, register_id, asset_register_item_id, event_type, reason, effective_date,
        amount_ex_vat, note, source_document_reference, actor_user_id, actor_name,
        actor_organisation, asset_snapshot_json, created_at)
     values ($1, $2::uuid, $3::uuid, $4, $5, $6::date, $7, $8, $9, $1, $10, $11, $12::jsonb, now())
     returning id::text, asset_register_item_id::text, event_type, reason, effective_date::text,
               amount_ex_vat, note, source_document_reference, actor_name, actor_organisation,
               asset_snapshot_json, created_at::text`,
    [input.ownerUserId, input.asset.registerId, input.asset.id, eventType,
      input.newlyAcquired ? 'newly_acquired' : 'existing_asset_added',
      dateOnly(input.acquisitionDate || input.asset.createdAtIso), optionalAmount(input.acquisitionAmountExVat),
      text(input.note) || null, text(input.sourceDocumentReference) || null,
      actor.name, actor.organisation, JSON.stringify(assetSnapshot(input.asset))],
  );
  await writeLifecycleAudit(input.ownerUserId, input.ownerUserId, 'asset_acquisition_recorded', input.asset, {
    eventType,
    acquisitionDate: dateOnly(input.acquisitionDate || input.asset.createdAtIso),
    acquisitionAmountExVat: optionalAmount(input.acquisitionAmountExVat),
  });
  return acquisitionFromRow(result.rows[0]);
}

function acquisitionFromRow(row: LifecycleRow): AssetAcquisitionDetails {
  return {
    eventId: row.id,
    newlyAcquired: row.event_type === 'acquired',
    acquisitionDate: dateOnly(row.effective_date),
    acquisitionAmountExVat: optionalAmount(row.amount_ex_vat),
    note: text(row.note),
    sourceDocumentReference: text(row.source_document_reference),
    updatedAtIso: row.created_at,
  };
}

export async function getAssetAcquisitionDetails(ownerUserId: string, assetId: string): Promise<AssetAcquisitionDetails | null> {
  await ensureAssetLifecycleSchema();
  const result = await getDb().query<LifecycleRow>(
    `select id::text, asset_register_item_id::text, event_type, reason, effective_date::text,
            amount_ex_vat, note, source_document_reference, actor_name, actor_organisation,
            asset_snapshot_json, created_at::text
     from public.asset_lifecycle_events
     where owner_user_id = $1 and asset_register_item_id = $2::uuid
       and event_type in ('acquired', 'existing_added')
     order by created_at desc limit 1`,
    [ownerUserId, assetId],
  );
  return result.rows[0] ? acquisitionFromRow(result.rows[0]) : null;
}

export async function saveAssetAcquisitionDetails(input: {
  ownerUserId: string;
  assetId: string;
  newlyAcquired: boolean;
  acquisitionDate: unknown;
  acquisitionAmountExVat?: unknown;
  note?: unknown;
  sourceDocumentReference?: unknown;
  actorName?: string | null;
}): Promise<AssetAcquisitionDetails> {
  await ensureAssetLifecycleSchema();
  const asset = await getAssetRegisterItemById(input.ownerUserId, input.assetId);
  if (!asset) throw new Error('ASSET_NOT_FOUND');
  const current = await getAssetAcquisitionDetails(input.ownerUserId, input.assetId);
  if (!current) {
    return recordManualAssetLifecycle({ ...input, asset });
  }
  const actor = await actorDetails(input.ownerUserId, input.actorName);
  const result = await getDb().query<LifecycleRow>(
    `update public.asset_lifecycle_events
     set event_type = $3, reason = $4, effective_date = $5::date, amount_ex_vat = $6,
         note = $7, source_document_reference = $8, actor_user_id = $1,
         actor_name = $9, actor_organisation = $10, asset_snapshot_json = $11::jsonb,
         created_at = now()
     where id = $2::uuid and owner_user_id = $1
     returning id::text, asset_register_item_id::text, event_type, reason, effective_date::text,
               amount_ex_vat, note, source_document_reference, actor_name, actor_organisation,
               asset_snapshot_json, created_at::text`,
    [input.ownerUserId, current.eventId, input.newlyAcquired ? 'acquired' : 'existing_added',
      input.newlyAcquired ? 'newly_acquired' : 'existing_asset_added', dateOnly(input.acquisitionDate),
      optionalAmount(input.acquisitionAmountExVat), text(input.note) || null,
      text(input.sourceDocumentReference) || null, actor.name, actor.organisation,
      JSON.stringify(assetSnapshot(asset))],
  );
  const saved = acquisitionFromRow(result.rows[0]);
  await writeLifecycleAudit(input.ownerUserId, input.ownerUserId, 'asset_acquisition_updated', asset, {
    previousValue: current,
    newValue: saved,
  });
  return saved;
}

export async function disposeOrDeleteAsset(input: {
  ownerUserId: string;
  assetId: string;
  reason: AssetDisposalReason;
  disposalDate: unknown;
  disposalAmountExVat?: unknown;
  note?: unknown;
  actorUserId?: string | null;
  actorName?: string | null;
  actorOrganisation?: string | null;
  aim4priceSaleInfluence?: Aim4priceSaleInfluence | null;
  transferRequested?: boolean;
}): Promise<{
  mode: 'disposed' | 'deleted' | 'transfer_pending';
  asset: AssetRegisterItem;
  transfer?: AssetTransferReceipt;
}> {
  await ensureAssetLifecycleSchema();
  const asset = await getAssetRegisterItemById(input.ownerUserId, input.assetId);
  if (!asset) throw new Error('ASSET_NOT_FOUND');
  const allowedReasons = new Set<AssetDisposalReason>([
    'sold', 'traded_in', 'scrapped', 'written_off', 'stolen', 'donated', 'returned_to_financier',
    'transferred', 'mistake_duplicate', 'created_in_error', 'import_error', 'test_record', 'other',
  ]);
  if (!allowedReasons.has(input.reason)) throw new Error('DISPOSAL_REASON_REQUIRED');
  const actorUserId = text(input.actorUserId) || input.ownerUserId;
  const actor = input.actorOrganisation
    ? { name: text(input.actorName) || 'Aim4price user', organisation: text(input.actorOrganisation) }
    : await actorDetails(actorUserId, input.actorName);
  const allowedSaleInfluence = new Set<Aim4priceSaleInfluence>(['yes', 'no', 'unsure']);
  if (input.reason === 'sold' && !allowedSaleInfluence.has(input.aim4priceSaleInfluence as Aim4priceSaleInfluence)) {
    throw new Error('AIM4PRICE_SALE_INFLUENCE_REQUIRED');
  }
  if (input.transferRequested && input.reason !== 'sold') throw new Error('ASSET_TRANSFER_REQUIRES_SALE');

  if (input.reason === 'sold' && input.transferRequested) {
    const transfer = await createAssetTransferOffer({
      sellerUserId: input.ownerUserId,
      asset,
      disposalDate: dateOnly(input.disposalDate),
      disposalAmountExVat: optionalAmount(input.disposalAmountExVat),
      note: text(input.note),
      aim4priceSaleInfluence: input.aim4priceSaleInfluence as Aim4priceSaleInfluence,
      actorUserId,
      actorName: actor.name,
      actorOrganisation: actor.organisation,
    });
    return { mode: 'transfer_pending', asset, transfer };
  }
  const deleteRecord = ['mistake_duplicate', 'created_in_error', 'import_error', 'test_record'].includes(input.reason);
  const eventType = deleteRecord ? 'deleted_duplicate' : 'disposed';

  if (deleteRecord) {
    const dependencyResult = await getDb().query<{ has_dependencies: boolean }>(
      `select
         exists (select 1 from public.asset_accounting_values where owner_user_id = $1 and asset_register_item_id = $2::uuid)
         or exists (select 1 from public.asset_finance_agreement_assets where owner_user_id = $1 and asset_register_item_id = $2::uuid)
         or exists (select 1 from public.asset_recurring_commitment_assets where owner_user_id = $1 and asset_register_item_id = $2::uuid)
         or exists (select 1 from public.asset_invoices where user_id = $1 and asset_register_item_id = $2::uuid)
         or exists (select 1 from public.fuel_storage_events where user_id = $1 and asset_register_item_id = $2::text)
         or exists (select 1 from public.fuel_slips where user_id = $1 and asset_register_item_id = $2::uuid)
         or exists (select 1 from public.asset_scan_events where asset_id = $2::uuid)
         as has_dependencies`,
      [input.ownerUserId, asset.id],
    );
    if (dependencyResult.rows[0]?.has_dependencies || asset.documents.length || asset.photos.length) throw new Error('ASSET_DELETE_HAS_DEPENDENCIES');
  }

  await getDb().query(
    `insert into public.asset_lifecycle_events
       (owner_user_id, register_id, asset_register_item_id, event_type, reason, effective_date,
        amount_ex_vat, note, actor_user_id, actor_name, actor_organisation, asset_snapshot_json,
        aim4price_sale_influence, created_at)
     values ($1, $2::uuid, $3::uuid, $4, $5, $6::date, $7, $8, $9, $10, $11, $12::jsonb, $13, now())`,
    [input.ownerUserId, asset.registerId, asset.id, eventType, input.reason, dateOnly(input.disposalDate),
      optionalAmount(input.disposalAmountExVat), text(input.note) || null, actorUserId, actor.name, actor.organisation,
      JSON.stringify(assetSnapshot(asset)), input.reason === 'sold' ? input.aim4priceSaleInfluence : null],
  );

  if (deleteRecord) {
    await getDb().query(
      `update public.asset_register_items
       set lifecycle_state = 'archived', updated_at = now(),
           marketplace_status = case when marketplace_status is null then null else 'withdrawn' end,
           qr_status = 'deleted'
       where user_id = $1 and id = $2::uuid`,
      [input.ownerUserId, asset.id],
    );
  } else {
    await getDb().query(
      `update public.asset_register_items
       set lifecycle_state = 'disposed', updated_at = now(), marketplace_status = case when marketplace_status is null then null else 'withdrawn' end
       where user_id = $1 and id = $2::uuid`,
      [input.ownerUserId, asset.id],
    ).catch(async () => {
      await getDb().query(
        `update public.asset_register_items set lifecycle_state = 'disposed', updated_at = now() where user_id = $1 and id = $2::uuid`,
        [input.ownerUserId, asset.id],
      );
    });
  }

  if (asset.registerId) {
    await getDb().query(`update public.asset_registers set updated_at = now() where user_id = $1 and id = $2::uuid`, [input.ownerUserId, asset.registerId]);
  }
  await writeLifecycleAudit(input.ownerUserId, actorUserId, deleteRecord ? 'asset_record_deleted' : 'asset_disposed', asset, {
    reason: input.reason,
    disposalDate: dateOnly(input.disposalDate),
    disposalAmountExVat: optionalAmount(input.disposalAmountExVat),
    aim4priceSaleInfluence: input.reason === 'sold' ? input.aim4priceSaleInfluence : null,
    retainedForReporting: true,
  });
  return { mode: deleteRecord ? 'deleted' : 'disposed', asset };
}

export async function listAssetLifecycleReport(ownerUserId: string, registerId: string, from?: string | null, to?: string | null): Promise<AssetLifecycleReportItem[]> {
  await ensureAssetLifecycleSchema();
  const params: unknown[] = [ownerUserId, registerId];
  const filters = ['owner_user_id = $1', 'register_id = $2::uuid'];
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    params.push(from);
    filters.push(`effective_date >= $${params.length}::date`);
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    params.push(to);
    filters.push(`effective_date <= $${params.length}::date`);
  }
  const result = await getDb().query<LifecycleRow>(
    `select id::text, asset_register_item_id::text, event_type, reason, effective_date::text,
            amount_ex_vat, note, source_document_reference, actor_name, actor_organisation,
            asset_snapshot_json, created_at::text
     from public.asset_lifecycle_events where ${filters.join(' and ')}
     order by effective_date desc, created_at desc`,
    params,
  );
  return result.rows.map((row) => {
    const snapshot = row.asset_snapshot_json && typeof row.asset_snapshot_json === 'object'
      ? row.asset_snapshot_json as Record<string, unknown>
      : {};
    return {
      id: row.id,
      assetId: row.asset_register_item_id,
      assetTitle: text(snapshot.title) || 'Asset',
      eventType: row.event_type,
      reason: text(row.reason),
      effectiveDate: dateOnly(row.effective_date),
      amountExVat: optionalAmount(row.amount_ex_vat),
      note: text(row.note),
      sourceDocumentReference: text(row.source_document_reference),
      actorName: text(row.actor_name),
      actorOrganisation: text(row.actor_organisation),
      createdAtIso: row.created_at,
    };
  });
}

async function writeLifecycleAudit(ownerUserId: string, actorUserId: string, eventType: string, asset: AssetRegisterItem, metadata: Record<string, unknown>) {
  await getDb().query(
    `insert into public.access_audit_events
       (owner_user_id, actor_user_id, event_type, entity_type, entity_id, metadata_json, created_at)
     values ($1, $2, $3, 'asset_register_item', $4, $5::jsonb, now())`,
    [ownerUserId, actorUserId, eventType, asset.id, JSON.stringify({
      registerId: asset.registerId,
      assetTitle: asset.title,
      ...metadata,
    })],
  );
}
