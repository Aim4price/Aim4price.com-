import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getAccountProfile } from './account-profile';
import { isAssetRegisterAccountType } from './asset-register-account-access';
import { listInternalAssetRegisterUploadIds } from './asset-register-uploads';
import { ensureAssetRegisterTables, getSelectedAssetRegister } from './asset-registers';
import { getAssetRegisterItemById, type AssetRegisterDocument, type AssetRegisterItem } from './asset-register-db';
import { isDatabaseSchemaReady } from './database-schema-readiness';
import { getDb } from './db';
import { ensurePartnerAccessTables } from './partner-access';

export type Aim4priceOutcomeInfluence = 'yes' | 'no' | 'unsure';
export type Aim4priceSaleInfluence = Aim4priceOutcomeInfluence;
export type AssetTransferStatus = 'pending' | 'claimed' | 'cancelled' | 'expired';
export type AssetTransferReason = 'sold' | 'traded_in';
export type AssetTransferRecipient = 'owner_or_dealer' | 'dealer';

export type AssetTransferReceipt = {
  id: string;
  assetId: string;
  assetTitle: string;
  assetIdentifier: string;
  assetIdentifierLabel: 'Serial / VIN' | 'Asset ID';
  transferCode: string;
  expiresAtIso: string;
  transferReason: AssetTransferReason;
  recipientAccountType: AssetTransferRecipient;
};

export type OutgoingAssetTransfer = {
  id: string;
  assetId: string;
  assetTitle: string;
  assetIdentifier: string;
  assetIdentifierLabel: 'Serial / VIN' | 'Asset ID';
  codeHint: string;
  status: AssetTransferStatus;
  expiresAtIso: string;
  createdAtIso: string;
  claimedAtIso: string | null;
  transferReason: AssetTransferReason;
  recipientAccountType: AssetTransferRecipient;
};

export type ClaimedAssetTransfer = {
  assetId: string;
  assetTitle: string;
  registerId: string;
  redirectTo: string;
};

export type AdminAssetAllocationResult = {
  assetId: string;
  assetTitle: string;
  buyerUserId: string;
  buyerRegisterId: string;
};

type TransferOfferRow = {
  id: string;
  asset_register_item_id: string;
  seller_user_id: string;
  buyer_user_id: string | null;
  sale_event_id: string | null;
  asset_title: string;
  asset_identifier: string;
  asset_identifier_label: string;
  asset_identifier_normalized: string;
  code_hash: string;
  code_hint: string;
  transfer_reason: string;
  recipient_account_type: string;
  transferable_upload_ids: unknown;
  status: string;
  expires_at: string;
  created_at: string;
  claimed_at: string | null;
};

type LockedAssetRow = {
  id: string;
  user_id: string;
  register_id: string | null;
  valuation_run_id: string | number | null;
  lifecycle_state: string | null;
  documents: unknown;
};

const TRANSFER_VALID_DAYS = 30;
const MAX_FAILED_CLAIM_ATTEMPTS = 10;
const CLAIM_ATTEMPT_WINDOW_MINUTES = 15;
const DATABASE_RETRY_ATTEMPTS = 3;
const TRANSIENT_DATABASE_ERROR_CODES = new Set(['40P01', '40001']);

let transferSchemaPromise: Promise<void> | null = null;

function postgresErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  return String((error as { code?: unknown }).code ?? '');
}

function isTransientDatabaseError(error: unknown): boolean {
  return TRANSIENT_DATABASE_ERROR_CODES.has(postgresErrorCode(error));
}

async function waitBeforeDatabaseRetry(attempt: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
}

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeIdentifier(value: unknown): string {
  return cleanText(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeTransferCode(value: unknown): string {
  return cleanText(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function generateTransferCode(): string {
  const compact = randomBytes(8).toString('hex').toUpperCase();
  return `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}`;
}

function hashTransferCode(offerId: string, code: string): string {
  return createHash('sha256')
    .update(`${offerId}:${normalizeTransferCode(code)}`, 'utf8')
    .digest('hex');
}

function transferCodeMatches(offerId: string, candidate: unknown, expectedHash: string): boolean {
  const candidateHash = Buffer.from(hashTransferCode(offerId, cleanText(candidate)), 'hex');
  const savedHash = Buffer.from(cleanText(expectedHash), 'hex');
  return candidateHash.length === savedHash.length && timingSafeEqual(candidateHash, savedHash);
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(cleanText).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function portableDocuments(value: unknown): AssetRegisterDocument[] {
  const source = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  return source.filter((entry): entry is AssetRegisterDocument => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const category = cleanText((entry as { category?: unknown }).category).toLowerCase();
    return category === 'licensing' || category === 'other' || category === '';
  });
}

function statusFromRow(row: TransferOfferRow): AssetTransferStatus {
  const saved = cleanText(row.status).toLowerCase();
  if (saved === 'claimed' || saved === 'cancelled') return saved;
  return new Date(row.expires_at).getTime() <= Date.now() ? 'expired' : 'pending';
}

function transferReasonFromRow(row: Pick<TransferOfferRow, 'transfer_reason'>): AssetTransferReason {
  return cleanText(row.transfer_reason).toLowerCase() === 'traded_in' ? 'traded_in' : 'sold';
}

function recipientFromRow(row: Pick<TransferOfferRow, 'recipient_account_type'>): AssetTransferRecipient {
  return cleanText(row.recipient_account_type).toLowerCase() === 'dealer' ? 'dealer' : 'owner_or_dealer';
}

function snapshotForTransfer(asset: AssetRegisterItem): Record<string, unknown> {
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
    documents: portableDocuments(asset.documents),
    createdAtIso: asset.createdAtIso,
    updatedAtIso: asset.updatedAtIso,
  };
}

function chooseAssetIdentifier(asset: AssetRegisterItem) {
  const serialNumber = cleanText(asset.serialNumber);
  const publicAssetCode = cleanText(asset.publicAssetCode);
  const assetIdentifier = serialNumber || publicAssetCode;
  if (!assetIdentifier) throw new Error('ASSET_TRANSFER_IDENTIFIER_REQUIRED');
  return {
    assetIdentifier,
    assetIdentifierLabel: serialNumber ? 'Serial / VIN' as const : 'Asset ID' as const,
    assetIdentifierNormalized: normalizeIdentifier(assetIdentifier),
  };
}

async function ensureAssetTransferSchemaOnce(): Promise<void> {
  await ensureAssetRegisterTables();
  await ensurePartnerAccessTables();
  const db = getDb();
  const schemaReady = await isDatabaseSchemaReady(() => db.query(`
    with offer_schema as (
      select id, asset_register_item_id, seller_user_id, buyer_user_id,
             sale_event_id, asset_title, asset_identifier,
             asset_identifier_label, asset_identifier_normalized, code_hash,
             code_hint, transfer_reason, recipient_account_type,
             transferable_upload_ids, status, expires_at, created_at,
             updated_at, claimed_at, cancelled_at
      from public.asset_transfer_offers
      where false
    ), attempt_schema as (
      select id, claimant_user_id, identifier_fingerprint, was_successful,
             attempted_at
      from public.asset_transfer_claim_attempts
      where false
    ), lifecycle_schema as (
      select aim4price_sale_influence, aim4price_outcome_influence,
             original_owner_user_id, transfer_status, transfer_offer_id,
             transferred_to_user_id
      from public.asset_lifecycle_events
      where false
    )
    select 1
    from offer_schema
    cross join attempt_schema
    cross join lifecycle_schema
  `));
  if (schemaReady) return;

  await db.query(`create extension if not exists pgcrypto`);
  await db.query(`
    create table if not exists public.asset_transfer_offers (
      id uuid primary key,
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      seller_user_id text not null,
      buyer_user_id text,
      sale_event_id uuid,
      asset_title text not null,
      asset_identifier text not null,
      asset_identifier_label text not null,
      asset_identifier_normalized text not null,
      code_hash text not null,
      code_hint text not null,
      transfer_reason text not null default 'sold',
      recipient_account_type text not null default 'owner_or_dealer',
      transferable_upload_ids jsonb not null default '[]'::jsonb,
      status text not null default 'pending',
      expires_at timestamptz not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      claimed_at timestamptz,
      cancelled_at timestamptz,
      check (status in ('pending', 'claimed', 'cancelled'))
    )
  `);
  await db.query(`
    alter table public.asset_transfer_offers
      add column if not exists transfer_reason text not null default 'sold',
      add column if not exists recipient_account_type text not null default 'owner_or_dealer'
  `);
  await db.query(`
    create unique index if not exists idx_asset_transfer_one_pending_per_asset
      on public.asset_transfer_offers(asset_register_item_id)
      where status = 'pending'
  `);
  await db.query(`create index if not exists idx_asset_transfer_seller_status on public.asset_transfer_offers(seller_user_id, status, created_at desc)`);
  await db.query(`create index if not exists idx_asset_transfer_identifier on public.asset_transfer_offers(asset_identifier_normalized, status, expires_at desc)`);
  await db.query(`
    create table if not exists public.asset_transfer_claim_attempts (
      id uuid primary key default gen_random_uuid(),
      claimant_user_id text not null,
      identifier_fingerprint text not null,
      was_successful boolean not null default false,
      attempted_at timestamptz not null default now()
    )
  `);
  await db.query(`create index if not exists idx_asset_transfer_claim_attempts_user_time on public.asset_transfer_claim_attempts(claimant_user_id, attempted_at desc)`);
  await db.query(`
    alter table public.asset_lifecycle_events
      add column if not exists aim4price_sale_influence text,
      add column if not exists aim4price_outcome_influence text,
      add column if not exists original_owner_user_id text,
      add column if not exists transfer_status text,
      add column if not exists transfer_offer_id uuid,
      add column if not exists transferred_to_user_id text
  `);
}

export async function ensureAssetTransferSchema(): Promise<void> {
  let lastError: unknown = new Error('ASSET_TRANSFER_SCHEMA_UNAVAILABLE');

  for (let attempt = 0; attempt < DATABASE_RETRY_ATTEMPTS; attempt += 1) {
    if (!transferSchemaPromise) {
      transferSchemaPromise = ensureAssetTransferSchemaOnce().catch((error) => {
        transferSchemaPromise = null;
        throw error;
      });
    }

    try {
      return await transferSchemaPromise;
    } catch (error) {
      lastError = error;
      if (!isTransientDatabaseError(error) || attempt === DATABASE_RETRY_ATTEMPTS - 1) {
        throw error;
      }
      await waitBeforeDatabaseRetry(attempt);
    }
  }

  throw lastError;
}

export async function createAssetTransferOffer(input: {
  sellerUserId: string;
  asset: AssetRegisterItem;
  disposalDate: string;
  disposalAmountExVat: number | null;
  note: string;
  aim4priceSaleInfluence: Aim4priceSaleInfluence;
  transferReason: AssetTransferReason;
  actorUserId: string;
  actorName: string;
  actorOrganisation: string;
}): Promise<AssetTransferReceipt> {
  await ensureAssetTransferSchema();
  const identifier = chooseAssetIdentifier(input.asset);
  const offerId = randomUUID();
  const transferCode = generateTransferCode();
  const codeHash = hashTransferCode(offerId, transferCode);
  const codeHint = normalizeTransferCode(transferCode).slice(-4);
  const uploadIds = listInternalAssetRegisterUploadIds([
    ...input.asset.photos,
    ...portableDocuments(input.asset.documents).map((document) => document.url),
  ]);
  const recipientAccountType: AssetTransferRecipient = input.transferReason === 'traded_in'
    ? 'dealer'
    : 'owner_or_dealer';
  const client = await getDb().connect();

  try {
    await client.query('begin');
    const existing = await client.query(
      `select id from public.asset_transfer_offers
       where asset_register_item_id = $1::uuid and status = 'pending' for update`,
      [input.asset.id],
    );
    if (existing.rows[0]) throw new Error('ASSET_TRANSFER_ALREADY_PENDING');

    const offer = await client.query<{ expires_at: string }>(
      `insert into public.asset_transfer_offers
         (id, asset_register_item_id, seller_user_id, asset_title, asset_identifier,
          asset_identifier_label, asset_identifier_normalized, code_hash, code_hint,
          transfer_reason, recipient_account_type, transferable_upload_ids, status, expires_at, created_at, updated_at)
       values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb,
               'pending', now() + ($13::text || ' days')::interval, now(), now())
       returning expires_at::text`,
      [offerId, input.asset.id, input.sellerUserId, input.asset.title, identifier.assetIdentifier,
        identifier.assetIdentifierLabel, identifier.assetIdentifierNormalized, codeHash, codeHint,
        input.transferReason, recipientAccountType, JSON.stringify(uploadIds), String(TRANSFER_VALID_DAYS)],
    );

    const lifecycle = await client.query<{ id: string }>(
      `insert into public.asset_lifecycle_events
         (owner_user_id, register_id, asset_register_item_id, event_type, reason, effective_date,
          amount_ex_vat, note, actor_user_id, actor_name, actor_organisation, asset_snapshot_json,
          aim4price_sale_influence, aim4price_outcome_influence, original_owner_user_id,
          transfer_status, transfer_offer_id, created_at)
       values ($1, $2::uuid, $3::uuid, 'disposed', $4, $5::date, $6, $7, $8, $9, $10,
               $11::jsonb, $12, $12, $1, 'pending', $13::uuid, now())
       returning id::text`,
      [input.sellerUserId, input.asset.registerId, input.asset.id, input.transferReason, input.disposalDate,
        input.disposalAmountExVat, input.note || null, input.actorUserId, input.actorName,
        input.actorOrganisation, JSON.stringify(snapshotForTransfer(input.asset)),
        input.aim4priceSaleInfluence, offerId],
    );

    await client.query(
      `update public.asset_transfer_offers set sale_event_id = $2::uuid, updated_at = now() where id = $1::uuid`,
      [offerId, lifecycle.rows[0]?.id],
    );
    const assetUpdate = await client.query<{ id: string }>(
      `update public.asset_register_items
       set lifecycle_state = 'disposed', updated_at = now(),
           marketplace_status = case when marketplace_status is null then null else 'withdrawn' end
       where id = $1::uuid and user_id = $2 and coalesce(lifecycle_state, 'active') = 'active'
       returning id::text`,
      [input.asset.id, input.sellerUserId],
    );
    if (!assetUpdate.rows[0]) throw new Error('ASSET_NOT_FOUND');
    await client.query(
      `insert into public.access_audit_events
         (owner_user_id, actor_user_id, event_type, entity_type, entity_id, metadata_json, created_at)
       values ($1, $2, 'asset_transfer_prepared', 'asset_register_item', $3, $4::jsonb, now())`,
      [input.sellerUserId, input.actorUserId, input.asset.id, JSON.stringify({
        transferOfferId: offerId,
        assetTitle: input.asset.title,
        aim4priceSaleInfluence: input.aim4priceSaleInfluence,
        transferReason: input.transferReason,
        recipientAccountType,
        expiresAtIso: offer.rows[0]?.expires_at,
      })],
    );
    if (input.asset.registerId) {
      await client.query(`update public.asset_registers set updated_at = now() where id = $1::uuid and user_id = $2`, [input.asset.registerId, input.sellerUserId]);
    }
    await client.query('commit');

    return {
      id: offerId,
      assetId: input.asset.id,
      assetTitle: input.asset.title,
      assetIdentifier: identifier.assetIdentifier,
      assetIdentifierLabel: identifier.assetIdentifierLabel,
      transferCode,
      expiresAtIso: offer.rows[0]?.expires_at || new Date(Date.now() + TRANSFER_VALID_DAYS * 86_400_000).toISOString(),
      transferReason: input.transferReason,
      recipientAccountType,
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function mapOutgoingTransfer(row: TransferOfferRow): OutgoingAssetTransfer {
  return {
    id: row.id,
    assetId: row.asset_register_item_id,
    assetTitle: cleanText(row.asset_title) || 'Asset',
    assetIdentifier: cleanText(row.asset_identifier),
    assetIdentifierLabel: row.asset_identifier_label === 'Serial / VIN' ? 'Serial / VIN' : 'Asset ID',
    codeHint: cleanText(row.code_hint),
    status: statusFromRow(row),
    expiresAtIso: row.expires_at,
    createdAtIso: row.created_at,
    claimedAtIso: row.claimed_at,
    transferReason: transferReasonFromRow(row),
    recipientAccountType: recipientFromRow(row),
  };
}

export async function listOutgoingAssetTransfers(sellerUserId: string): Promise<OutgoingAssetTransfer[]> {
  await ensureAssetTransferSchema();
  const result = await getDb().query<TransferOfferRow>(
    `select id::text, asset_register_item_id::text, seller_user_id, buyer_user_id,
            sale_event_id::text, asset_title, asset_identifier, asset_identifier_label,
            asset_identifier_normalized, code_hash, code_hint, transfer_reason, recipient_account_type, transferable_upload_ids,
            status, expires_at::text, created_at::text, claimed_at::text
     from public.asset_transfer_offers
     where seller_user_id = $1
     order by created_at desc limit 100`,
    [sellerUserId],
  );
  return result.rows.map(mapOutgoingTransfer);
}

async function recordClaimAttempt(userId: string, identifier: string, wasSuccessful: boolean) {
  await getDb().query(
    `insert into public.asset_transfer_claim_attempts
       (claimant_user_id, identifier_fingerprint, was_successful, attempted_at)
     values ($1, $2, $3, now())`,
    [userId, createHash('sha256').update(normalizeIdentifier(identifier), 'utf8').digest('hex'), wasSuccessful],
  ).catch(() => undefined);
}

async function enforceClaimRateLimit(userId: string) {
  const result = await getDb().query<{ failed_count: string | number }>(
    `select count(*)::integer as failed_count
     from public.asset_transfer_claim_attempts
     where claimant_user_id = $1 and was_successful = false
       and attempted_at > now() - ($2::text || ' minutes')::interval`,
    [userId, String(CLAIM_ATTEMPT_WINDOW_MINUTES)],
  );
  if (Number(result.rows[0]?.failed_count || 0) >= MAX_FAILED_CLAIM_ATTEMPTS) {
    throw new Error('ASSET_TRANSFER_RATE_LIMITED');
  }
}

async function tableExists(client: PoolClient, tableName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(`select to_regclass($1) is not null as exists`, [`public.${tableName}`]);
  return result.rows[0]?.exists === true;
}

async function transferPortableHistory(input: {
  client: PoolClient;
  sellerUserId: string;
  buyerUserId: string;
  buyerRegisterId: string;
  assetId: string;
  valuationRunId: string | number | null;
  uploadIds: string[];
}) {
  const { client, sellerUserId, buyerUserId, buyerRegisterId, assetId, valuationRunId, uploadIds } = input;

  if (await tableExists(client, 'asset_maintenance_records')) {
    await client.query(
      `update public.asset_maintenance_records
       set user_id = $1,
           assigned_field_manager_id = case when status = 'upcoming' then null else assigned_field_manager_id end,
           assigned_name = case when status = 'upcoming' then null else assigned_name end,
           updated_at = now()
       where user_id = $2 and asset_register_item_id = $3::uuid`,
      [buyerUserId, sellerUserId, assetId],
    );
  }
  if (await tableExists(client, 'asset_depreciation_snapshots')) {
    await client.query(
      `update public.asset_depreciation_snapshots set user_id = $1, register_id = $2::uuid
       where user_id = $3 and asset_register_item_id = $4::uuid`,
      [buyerUserId, buyerRegisterId, sellerUserId, assetId],
    );
  }
  if (valuationRunId !== null && await tableExists(client, 'valuation_runs')) {
    await client.query(`update public.valuation_runs set user_id = $1 where id = $2 and user_id = $3`, [buyerUserId, valuationRunId, sellerUserId]);
  }
  if (uploadIds.length && await tableExists(client, 'asset_register_uploads')) {
    await client.query(`update public.asset_register_uploads set user_id = $1 where user_id = $2 and id = any($3::text[])`, [buyerUserId, sellerUserId, uploadIds]);
  }
  if (uploadIds.length && await tableExists(client, 'asset_register_bucket_uploads')) {
    await client.query(`update public.asset_register_bucket_uploads set user_id = $1 where user_id = $2 and id = any($3::text[])`, [buyerUserId, sellerUserId, uploadIds]);
  }
  await client.query(
    `update public.asset_lifecycle_events
     set owner_user_id = $1,
         register_id = $2::uuid,
         asset_snapshot_json = (coalesce(asset_snapshot_json, '{}'::jsonb) - 'documents' - 'isFinanced' - 'isInsured')
           || jsonb_build_object('documents', '[]'::jsonb, 'isFinanced', false, 'isInsured', false)
     where owner_user_id = $3 and asset_register_item_id = $4::uuid`,
    [buyerUserId, buyerRegisterId, sellerUserId, assetId],
  );
}

async function clearSellerOnlyRelationships(client: PoolClient, sellerUserId: string, assetId: string) {
  if (await tableExists(client, 'asset_group_members')) {
    await client.query(`delete from public.asset_group_members where asset_id = $1::uuid`, [assetId]);
  }
  if (await tableExists(client, 'dealer_maintenance_access')) {
    await client.query(`delete from public.dealer_maintenance_access where owner_user_id = $1 and asset_register_item_id = $2::uuid`, [sellerUserId, assetId]);
  }
  if (await tableExists(client, 'marketplace_listings')) {
    await client.query(
      `update public.marketplace_listings set status = 'withdrawn', updated_at = now()
       where asset_register_item_id = $1::uuid`,
      [assetId],
    );
  }
}

export async function adminAllocateDisposedAsset(input: {
  lifecycleEventId: string;
  assetId: string;
  sellerUserId: string;
  buyerUserId: string;
  adminUserId: string;
  adminName: string;
}): Promise<AdminAssetAllocationResult> {
  await ensureAssetTransferSchema();
  if (input.sellerUserId === input.buyerUserId) throw new Error('ADMIN_ASSET_ALLOCATION_SAME_ACCOUNT');
  const assetRecord = await getAssetRegisterItemById(input.sellerUserId, input.assetId);
  const buyerProfile = await getAccountProfile({ id: input.buyerUserId });
  if (!assetRecord) throw new Error('ADMIN_ASSET_ALLOCATION_NOT_FOUND');
  if (!isAssetRegisterAccountType(buyerProfile.accountType) || buyerProfile.accountStatus !== 'active') {
    throw new Error('ADMIN_ASSET_ALLOCATION_ACCOUNT_REQUIRED');
  }
  const buyerRegister = await getSelectedAssetRegister(input.buyerUserId);
  const uploadIds = listInternalAssetRegisterUploadIds([
    ...assetRecord.photos,
    ...portableDocuments(assetRecord.documents).map((document) => document.url),
  ]);
  let lastError: unknown = new Error('ADMIN_ASSET_ALLOCATION_FAILED');

  for (let attempt = 0; attempt < DATABASE_RETRY_ATTEMPTS; attempt += 1) {
    const client = await getDb().connect();

    try {
      await client.query('begin');
      const lifecycle = await client.query<{ id: string; transfer_offer_id: string | null }>(
        `select id::text, transfer_offer_id::text
         from public.asset_lifecycle_events
         where id = $1::uuid and asset_register_item_id = $2::uuid
           and event_type = 'disposed' and reason = 'sold'
           and coalesce(original_owner_user_id, owner_user_id) = $3
         for update`,
        [input.lifecycleEventId, input.assetId, input.sellerUserId],
      );
      if (!lifecycle.rows[0]) throw new Error('ADMIN_ASSET_ALLOCATION_NOT_FOUND');

      const assetResult = await client.query<LockedAssetRow>(
        `select id::text, user_id, register_id::text, valuation_run_id, lifecycle_state, documents
         from public.asset_register_items where id = $1::uuid for update`,
        [input.assetId],
      );
      const asset = assetResult.rows[0];
      if (!asset || asset.user_id !== input.sellerUserId || !['disposed', 'transfer_pending'].includes(cleanText(asset.lifecycle_state))) {
        throw new Error('ADMIN_ASSET_ALLOCATION_NOT_AVAILABLE');
      }

      await client.query(
        `update public.asset_lifecycle_events
         set original_owner_user_id = owner_user_id
         where owner_user_id = $1 and asset_register_item_id = $2::uuid
           and original_owner_user_id is null`,
        [input.sellerUserId, input.assetId],
      );
      await transferPortableHistory({
        client,
        sellerUserId: input.sellerUserId,
        buyerUserId: input.buyerUserId,
        buyerRegisterId: buyerRegister.id,
        assetId: input.assetId,
        valuationRunId: asset.valuation_run_id,
        uploadIds,
      });
      await clearSellerOnlyRelationships(client, input.sellerUserId, input.assetId);
      await client.query(
        `update public.asset_register_items
         set user_id = $1, register_id = $2::uuid, lifecycle_state = 'active', qr_status = 'transferred',
             documents = $5::jsonb,
             is_financed = false, finance_note = '', is_insured = false, insured_value_ex_vat = null,
             seller_phone = '', marketplace_status = case when marketplace_status is null then null else 'withdrawn' end,
             marketplace_seller_name = '', marketplace_seller_company = '', marketplace_seller_email = '',
             updated_at = now()
         where id = $3::uuid and user_id = $4`,
        [input.buyerUserId, buyerRegister.id, input.assetId, input.sellerUserId, JSON.stringify(portableDocuments(assetRecord.documents))],
      );
      if (lifecycle.rows[0].transfer_offer_id) {
        await client.query(
          `update public.asset_transfer_offers
           set status = 'claimed', buyer_user_id = $2, claimed_at = now(), cancelled_at = null, updated_at = now()
           where id = $1::uuid`,
          [lifecycle.rows[0].transfer_offer_id, input.buyerUserId],
        );
      }
      await client.query(
        `update public.asset_lifecycle_events
         set transfer_status = 'claimed', transferred_to_user_id = $2
         where id = $1::uuid`,
        [input.lifecycleEventId, input.buyerUserId],
      );
      await client.query(
        `insert into public.access_audit_events
           (owner_user_id, actor_user_id, event_type, entity_type, entity_id, metadata_json, created_at)
         values
           ($1, $3, 'asset_admin_allocated_out', 'asset_register_item', $4, $5::jsonb, now()),
           ($2, $3, 'asset_admin_allocated_in', 'asset_register_item', $4, $6::jsonb, now())`,
        [input.sellerUserId, input.buyerUserId, input.adminUserId, input.assetId,
          JSON.stringify({ lifecycleEventId: input.lifecycleEventId, buyerUserId: input.buyerUserId, adminName: input.adminName }),
          JSON.stringify({ lifecycleEventId: input.lifecycleEventId, sellerUserId: input.sellerUserId, adminName: input.adminName })],
      );
      if (asset.register_id) {
        await client.query(`update public.asset_registers set updated_at = now() where id = $1::uuid and user_id = $2`, [asset.register_id, input.sellerUserId]);
      }
      await client.query(`update public.asset_registers set updated_at = now() where id = $1::uuid and user_id = $2`, [buyerRegister.id, input.buyerUserId]);
      await client.query('commit');
      return { assetId: input.assetId, assetTitle: assetRecord.title, buyerUserId: input.buyerUserId, buyerRegisterId: buyerRegister.id };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      lastError = error;
      if (!isTransientDatabaseError(error) || attempt === DATABASE_RETRY_ATTEMPTS - 1) {
        throw error;
      }
    } finally {
      client.release();
    }

    await waitBeforeDatabaseRetry(attempt);
  }

  throw lastError;
}

export async function adminDeleteSoldAsset(input: {
  lifecycleEventId: string;
  assetId: string;
  sellerUserId: string;
  adminUserId: string;
  adminName: string;
}): Promise<void> {
  await ensureAssetTransferSchema();
  const client = await getDb().connect();
  try {
    await client.query('begin');
    const lifecycle = await client.query<{ id: string; transfer_offer_id: string | null }>(
      `select id::text, transfer_offer_id::text
       from public.asset_lifecycle_events
       where id = $1::uuid and asset_register_item_id = $2::uuid
         and event_type = 'disposed' and reason = 'sold'
         and coalesce(original_owner_user_id, owner_user_id) = $3
       for update`,
      [input.lifecycleEventId, input.assetId, input.sellerUserId],
    );
    if (!lifecycle.rows[0]) throw new Error('ADMIN_SOLD_ASSET_NOT_FOUND');
    const asset = await client.query<LockedAssetRow>(
      `select id::text, user_id, register_id::text, valuation_run_id, lifecycle_state, documents
       from public.asset_register_items where id = $1::uuid for update`,
      [input.assetId],
    );
    const lockedAsset = asset.rows[0];
    if (!lockedAsset || lockedAsset.user_id !== input.sellerUserId || !['disposed', 'transfer_pending'].includes(cleanText(lockedAsset.lifecycle_state))) {
      throw new Error('ADMIN_SOLD_ASSET_DELETE_NOT_AVAILABLE');
    }
    await client.query(
      `update public.asset_transfer_offers
       set status = 'cancelled', cancelled_at = now(), updated_at = now()
       where asset_register_item_id = $1::uuid and status = 'pending'`,
      [input.assetId],
    );
    await client.query(
      `update public.asset_lifecycle_events
       set event_type = 'deleted_duplicate', reason = 'admin_deleted_sold_record',
           transfer_status = case when transfer_status is null then null else 'cancelled' end
       where id = $1::uuid`,
      [input.lifecycleEventId],
    );
    await client.query(
      `update public.asset_register_items
       set lifecycle_state = 'archived', qr_status = 'deleted', updated_at = now(),
           marketplace_status = case when marketplace_status is null then null else 'withdrawn' end
       where id = $1::uuid and user_id = $2`,
      [input.assetId, input.sellerUserId],
    );
    await client.query(
      `insert into public.access_audit_events
         (owner_user_id, actor_user_id, event_type, entity_type, entity_id, metadata_json, created_at)
       values ($1, $2, 'admin_sold_asset_deleted', 'asset_register_item', $3, $4::jsonb, now())`,
      [input.sellerUserId, input.adminUserId, input.assetId,
        JSON.stringify({ lifecycleEventId: input.lifecycleEventId, adminName: input.adminName, retainedForAudit: true })],
    );
    if (lockedAsset.register_id) {
      await client.query(`update public.asset_registers set updated_at = now() where id = $1::uuid and user_id = $2`, [lockedAsset.register_id, input.sellerUserId]);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function claimAssetTransfer(input: {
  buyerUserId: string;
  buyerName?: string | null;
  buyerEmail?: string | null;
  assetIdentifier: unknown;
  transferCode: unknown;
}): Promise<ClaimedAssetTransfer> {
  await ensureAssetTransferSchema();
  await enforceClaimRateLimit(input.buyerUserId);
  const normalizedIdentifier = normalizeIdentifier(input.assetIdentifier);
  const normalizedCode = normalizeTransferCode(input.transferCode);
  if (!normalizedIdentifier || normalizedCode.length !== 16) {
    await recordClaimAttempt(input.buyerUserId, normalizedIdentifier, false);
    throw new Error('ASSET_TRANSFER_INVALID_CREDENTIALS');
  }

  const buyerProfile = await getAccountProfile({ id: input.buyerUserId, name: input.buyerName, email: input.buyerEmail });
  if (!isAssetRegisterAccountType(buyerProfile.accountType) || buyerProfile.accountStatus !== 'active') {
    throw new Error('ASSET_TRANSFER_ACCOUNT_REQUIRED');
  }
  const buyerRegister = await getSelectedAssetRegister(input.buyerUserId);
  const client = await getDb().connect();

  try {
    await client.query('begin');
    const offers = await client.query<TransferOfferRow>(
      `select id::text, asset_register_item_id::text, seller_user_id, buyer_user_id,
              sale_event_id::text, asset_title, asset_identifier, asset_identifier_label,
              asset_identifier_normalized, code_hash, code_hint, transfer_reason, recipient_account_type, transferable_upload_ids,
              status, expires_at::text, created_at::text, claimed_at::text
       from public.asset_transfer_offers
       where asset_identifier_normalized = $1 and status = 'pending'
       order by created_at desc limit 20 for update`,
      [normalizedIdentifier],
    );
    const offer = offers.rows.find((row) => transferCodeMatches(row.id, normalizedCode, row.code_hash));
    if (!offer || new Date(offer.expires_at).getTime() <= Date.now()) throw new Error('ASSET_TRANSFER_INVALID_CREDENTIALS');
    if (offer.seller_user_id === input.buyerUserId) throw new Error('ASSET_TRANSFER_SELF_CLAIM');
    if (recipientFromRow(offer) === 'dealer' && buyerProfile.accountType !== 'dealer') {
      throw new Error('ASSET_TRANSFER_DEALER_ACCOUNT_REQUIRED');
    }

    const assetResult = await client.query<LockedAssetRow>(
      `select id::text, user_id, register_id::text, valuation_run_id, lifecycle_state, documents
       from public.asset_register_items where id = $1::uuid for update`,
      [offer.asset_register_item_id],
    );
    const asset = assetResult.rows[0];
    if (!asset || asset.user_id !== offer.seller_user_id
        || !['disposed', 'transfer_pending'].includes(cleanText(asset.lifecycle_state))) {
      throw new Error('ASSET_TRANSFER_INVALID_CREDENTIALS');
    }

    const uploadIds = stringArray(offer.transferable_upload_ids);
    await transferPortableHistory({
      client,
      sellerUserId: offer.seller_user_id,
      buyerUserId: input.buyerUserId,
      buyerRegisterId: buyerRegister.id,
      assetId: asset.id,
      valuationRunId: asset.valuation_run_id,
      uploadIds,
    });
    await clearSellerOnlyRelationships(client, offer.seller_user_id, asset.id);
    await client.query(
      `update public.asset_register_items
       set user_id = $1, register_id = $2::uuid, lifecycle_state = 'active', qr_status = 'transferred',
           documents = $5::jsonb,
           is_financed = false, finance_note = '', is_insured = false, insured_value_ex_vat = null,
           seller_phone = '', marketplace_status = case when marketplace_status is null then null else 'withdrawn' end,
           marketplace_seller_name = '', marketplace_seller_company = '', marketplace_seller_email = '',
           updated_at = now()
       where id = $3::uuid and user_id = $4`,
      [input.buyerUserId, buyerRegister.id, asset.id, offer.seller_user_id, JSON.stringify(portableDocuments(asset.documents))],
    );
    await client.query(
      `update public.asset_transfer_offers
       set status = 'claimed', buyer_user_id = $2, claimed_at = now(), updated_at = now()
       where id = $1::uuid and status = 'pending'`,
      [offer.id, input.buyerUserId],
    );
    await client.query(
      `update public.asset_lifecycle_events
       set transfer_status = 'claimed', transferred_to_user_id = $2
       where transfer_offer_id = $1::uuid`,
      [offer.id, input.buyerUserId],
    );
    await client.query(
      `insert into public.access_audit_events
         (owner_user_id, actor_user_id, event_type, entity_type, entity_id, metadata_json, created_at)
       values
         ($1, $2, 'asset_transferred_out', 'asset_register_item', $3, $4::jsonb, now()),
         ($2, $2, 'asset_transferred_in', 'asset_register_item', $3, $5::jsonb, now())`,
      [offer.seller_user_id, input.buyerUserId, asset.id,
        JSON.stringify({ transferOfferId: offer.id, assetTitle: offer.asset_title, buyerUserId: input.buyerUserId }),
        JSON.stringify({ transferOfferId: offer.id, assetTitle: offer.asset_title, sellerUserId: offer.seller_user_id })],
    );
    if (asset.register_id) {
      await client.query(`update public.asset_registers set updated_at = now() where id = $1::uuid and user_id = $2`, [asset.register_id, offer.seller_user_id]);
    }
    await client.query(`update public.asset_registers set updated_at = now() where id = $1::uuid and user_id = $2`, [buyerRegister.id, input.buyerUserId]);
    await client.query('commit');
    await recordClaimAttempt(input.buyerUserId, normalizedIdentifier, true);

    return {
      assetId: asset.id,
      assetTitle: cleanText(offer.asset_title) || 'Asset',
      registerId: buyerRegister.id,
      redirectTo: buyerProfile.accountType === 'dealer'
        ? `/dealer/inventory?assetId=${encodeURIComponent(asset.id)}`
        : `/asset-register?assetId=${encodeURIComponent(asset.id)}`,
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    await recordClaimAttempt(input.buyerUserId, normalizedIdentifier, false);
    throw error;
  } finally {
    client.release();
  }
}

export async function regenerateAssetTransferCode(input: { sellerUserId: string; transferId: string }): Promise<AssetTransferReceipt> {
  await ensureAssetTransferSchema();
  const transferCode = generateTransferCode();
  const codeHint = normalizeTransferCode(transferCode).slice(-4);
  const codeHash = hashTransferCode(input.transferId, transferCode);
  const result = await getDb().query<TransferOfferRow>(
    `update public.asset_transfer_offers
     set code_hash = $3, code_hint = $4, status = 'pending',
         expires_at = now() + ($5::text || ' days')::interval, updated_at = now()
     where id = $1::uuid and seller_user_id = $2 and status = 'pending'
     returning id::text, asset_register_item_id::text, seller_user_id, buyer_user_id,
               sale_event_id::text, asset_title, asset_identifier, asset_identifier_label,
               asset_identifier_normalized, code_hash, code_hint, transfer_reason, recipient_account_type, transferable_upload_ids,
               status, expires_at::text, created_at::text, claimed_at::text`,
    [input.transferId, input.sellerUserId, codeHash, codeHint, String(TRANSFER_VALID_DAYS)],
  );
  const row = result.rows[0];
  if (!row) throw new Error('ASSET_TRANSFER_NOT_FOUND');
  return {
    id: row.id,
    assetId: row.asset_register_item_id,
    assetTitle: row.asset_title,
    assetIdentifier: row.asset_identifier,
    assetIdentifierLabel: row.asset_identifier_label === 'Serial / VIN' ? 'Serial / VIN' : 'Asset ID',
    transferCode,
    expiresAtIso: row.expires_at,
    transferReason: transferReasonFromRow(row),
    recipientAccountType: recipientFromRow(row),
  };
}

export async function cancelAssetTransfer(input: { sellerUserId: string; transferId: string }): Promise<void> {
  await ensureAssetTransferSchema();
  const client = await getDb().connect();
  try {
    await client.query('begin');
    const result = await client.query<{ asset_register_item_id: string; sale_event_id: string | null }>(
      `update public.asset_transfer_offers
       set status = 'cancelled', cancelled_at = now(), updated_at = now()
       where id = $1::uuid and seller_user_id = $2 and status = 'pending'
       returning asset_register_item_id::text, sale_event_id::text`,
      [input.transferId, input.sellerUserId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('ASSET_TRANSFER_NOT_FOUND');
    await client.query(
      `update public.asset_register_items set lifecycle_state = 'disposed', updated_at = now()
       where id = $1::uuid and user_id = $2 and lifecycle_state = 'transfer_pending'`,
      [row.asset_register_item_id, input.sellerUserId],
    );
    if (row.sale_event_id) {
      await client.query(`update public.asset_lifecycle_events set transfer_status = 'cancelled' where id = $1::uuid`, [row.sale_event_id]);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
