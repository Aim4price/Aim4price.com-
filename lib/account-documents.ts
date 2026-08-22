import { randomUUID } from 'node:crypto';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import {
  ACCOUNT_DOCUMENT_CATEGORIES,
  ACCOUNT_DOCUMENT_CATEGORY_LABELS,
  getAccountDocumentType,
  getAccountDocumentTypeCategory,
  isAccountDocumentCategory,
  type AccountDocumentCategory,
  type AccountDocumentType,
} from './account-document-taxonomy';
import { getDb } from './db';

export {
  ACCOUNT_DOCUMENT_CATEGORIES,
  ACCOUNT_DOCUMENT_CATEGORY_LABELS,
  isAccountDocumentCategory,
};
export type { AccountDocumentCategory };

export type AccountDocumentAssetLink = {
  id: string;
  title: string;
  meta: string;
};

export type AccountDocumentAssetOption = AccountDocumentAssetLink;

export type AccountDocument = {
  id: string;
  title: string;
  category: AccountDocumentCategory;
  documentType: AccountDocumentType | null;
  notes: string;
  expiryDate: string | null;
  fileName: string;
  contentType: string;
  byteSize: number;
  assetLinks: AccountDocumentAssetLink[];
  createdAtIso: string;
  updatedAtIso: string;
  deletedAtIso: string | null;
};

export type AccountDocumentSummary = {
  totalDocuments: number;
  expiringSoon: number;
  linkedDocuments: number;
  storageBytes: number;
};

export type AccountDocumentInput = {
  title?: unknown;
  category?: unknown;
  documentType?: unknown;
  notes?: unknown;
  expiryDate?: unknown;
  assetIds?: unknown;
};

export type CreateAccountDocumentInput = AccountDocumentInput & {
  uploadId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
};

type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
};

type AccountDocumentRow = {
  id: string;
  upload_id: string;
  title: string | null;
  category: string | null;
  document_type: string | null;
  notes: string | null;
  expiry_date: string | Date | null;
  file_name: string | null;
  content_type: string | null;
  byte_size: string | number | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  deleted_at: string | Date | null;
};

type AccountDocumentLinkRow = {
  document_id: string;
  asset_id: string;
  asset_title: string | null;
  asset_kind: string | null;
  brand_name: string | null;
  model_name: string | null;
  year_model: string | number | null;
};

type AccountDocumentAssetRow = {
  id: string;
  title: string | null;
  kind: string | null;
  brand_name: string | null;
  model_name: string | null;
  year_model: string | number | null;
};

type AccountDocumentSummaryRow = {
  total_documents: string | number | null;
  expiring_soon: string | number | null;
  linked_documents: string | number | null;
  storage_bytes: string | number | null;
};

type UploadReferenceRow = {
  upload_id: string;
};

let accountDocumentTablesPromise: Promise<void> | null = null;
let accountDocumentTableExistsPromise: Promise<boolean> | null = null;
const accountDocumentUploadOwnerCache = new Map<string, string | null>();
const ACCOUNT_DOCUMENT_UPLOAD_OWNER_CACHE_LIMIT = 4_096;

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanNotes(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, 5_000);
}

function numberValue(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isoDate(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return new Date().toISOString();
}

function nullableIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return isoDate(value);
}

function dateOnly(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const normalized = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizeExpiryDate(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error('DOCUMENT_EXPIRY_INVALID');

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error('DOCUMENT_EXPIRY_INVALID');
  }

  return normalized;
}

function normalizeCategory(
  value: unknown,
  options: { fallbackToOther?: boolean } = {},
): AccountDocumentCategory {
  const normalized = cleanText(value, 40).toLowerCase();
  if (isAccountDocumentCategory(normalized)) return normalized;
  if (options.fallbackToOther) return 'other';
  throw new Error('DOCUMENT_CATEGORY_INVALID');
}

function normalizeDocumentType(
  value: unknown,
  options: { required?: boolean } = {},
): AccountDocumentType | null {
  const normalized = cleanText(value, 80).toLowerCase();
  if (!normalized) {
    if (options.required) throw new Error('DOCUMENT_TYPE_REQUIRED');
    return null;
  }

  const documentType = getAccountDocumentType(normalized)?.value;
  if (documentType) return documentType;
  throw new Error('DOCUMENT_TYPE_INVALID');
}

function normalizeAssetIds(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [];
  const unique = new Set<string>();

  for (const entry of values) {
    const assetId = cleanText(entry, 120);
    if (assetId) unique.add(assetId);
    if (unique.size >= 100) break;
  }

  return [...unique];
}

function buildAssetMeta(row: {
  kind?: string | null;
  asset_kind?: string | null;
  brand_name?: string | null;
  model_name?: string | null;
  year_model?: string | number | null;
}): string {
  const parts = [
    cleanText(row.kind ?? row.asset_kind, 80),
    cleanText(row.brand_name, 100),
    cleanText(row.model_name, 120),
    cleanText(row.year_model, 8),
  ].filter(Boolean);

  return parts.join(' · ');
}

function mapDocumentRow(row: AccountDocumentRow, assetLinks: AccountDocumentAssetLink[]): AccountDocument {
  const documentType = getAccountDocumentType(row.document_type)?.value ?? null;
  return {
    id: String(row.id ?? ''),
    title: cleanText(row.title, 180) || cleanText(row.file_name, 180) || 'Untitled document',
    category: normalizeCategory(row.category, { fallbackToOther: true }),
    documentType,
    notes: cleanNotes(row.notes),
    expiryDate: dateOnly(row.expiry_date),
    fileName: cleanText(row.file_name, 240) || 'document',
    contentType: cleanText(row.content_type, 160) || 'application/octet-stream',
    byteSize: Math.max(0, Math.round(numberValue(row.byte_size))),
    assetLinks,
    createdAtIso: isoDate(row.created_at),
    updatedAtIso: isoDate(row.updated_at ?? row.created_at),
    deletedAtIso: nullableIsoDate(row.deleted_at),
  };
}

function cacheAccountDocumentUploadOwner(uploadId: string, userId: string | null): void {
  if (accountDocumentUploadOwnerCache.has(uploadId)) {
    accountDocumentUploadOwnerCache.delete(uploadId);
  }
  accountDocumentUploadOwnerCache.set(uploadId, userId);

  if (accountDocumentUploadOwnerCache.size > ACCOUNT_DOCUMENT_UPLOAD_OWNER_CACHE_LIMIT) {
    const oldestKey = accountDocumentUploadOwnerCache.keys().next().value as string | undefined;
    if (oldestKey) accountDocumentUploadOwnerCache.delete(oldestKey);
  }
}

async function ensureAccountDocumentTablesOnce(): Promise<void> {
  await getDb().query(`
    create table if not exists public.account_documents (
      id uuid primary key,
      user_id text not null,
      upload_id text not null,
      title text not null,
      category text not null default 'other',
      document_type text,
      notes text not null default '',
      expiry_date date,
      file_name text not null,
      content_type text not null,
      byte_size bigint not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz,
      unique (user_id, upload_id)
    );

    alter table public.account_documents
      add column if not exists document_type text;

    create table if not exists public.account_document_asset_links (
      document_id uuid not null references public.account_documents(id) on delete cascade,
      asset_id text not null,
      created_at timestamptz not null default now(),
      primary key (document_id, asset_id)
    );

    create index if not exists idx_account_documents_user_active_updated
      on public.account_documents (user_id, updated_at desc)
      where deleted_at is null;
    create index if not exists idx_account_documents_user_deleted
      on public.account_documents (user_id, deleted_at desc)
      where deleted_at is not null;
    create index if not exists idx_account_documents_user_expiry
      on public.account_documents (user_id, expiry_date)
      where deleted_at is null and expiry_date is not null;
    create index if not exists idx_account_documents_user_document_type
      on public.account_documents (user_id, document_type, updated_at desc)
      where deleted_at is null and document_type is not null;
    create index if not exists idx_account_documents_upload_id
      on public.account_documents (upload_id);
    create index if not exists idx_account_document_asset_links_asset
      on public.account_document_asset_links (asset_id, document_id);
  `);
}

export async function ensureAccountDocumentTables(): Promise<void> {
  if (!accountDocumentTablesPromise) {
    accountDocumentTablesPromise = ensureAccountDocumentTablesOnce().catch((error) => {
      accountDocumentTablesPromise = null;
      throw error;
    });
  }

  await accountDocumentTablesPromise;
  accountDocumentTableExistsPromise = Promise.resolve(true);
}

async function assertOwnedAssetIds(queryable: Queryable, userId: string, assetIds: string[]): Promise<void> {
  if (!assetIds.length) return;

  const result = await queryable.query<{ id: string }>(
    `
      select id::text as id
      from public.asset_register_items
      where user_id = $1
        and id::text = any($2::text[])
    `,
    [userId, assetIds],
  );
  const ownedIds = new Set(result.rows.map((row) => String(row.id)));

  if (assetIds.some((assetId) => !ownedIds.has(assetId))) {
    throw new Error('DOCUMENT_ASSET_NOT_FOUND');
  }
}

async function replaceAssetLinks(
  client: PoolClient,
  userId: string,
  documentId: string,
  assetIds: string[],
): Promise<void> {
  await assertOwnedAssetIds(client, userId, assetIds);
  await client.query('delete from public.account_document_asset_links where document_id = $1::uuid', [documentId]);

  if (!assetIds.length) return;

  await client.query(
    `
      insert into public.account_document_asset_links (document_id, asset_id)
      select $1::uuid, asset_id
      from unnest($2::text[]) asset_id
      on conflict (document_id, asset_id) do nothing
    `,
    [documentId, assetIds],
  );
}

export async function listAccountDocumentAssetOptions(userId: string): Promise<AccountDocumentAssetOption[]> {
  const result = await getDb().query<AccountDocumentAssetRow>(
    `
      select
        id::text as id,
        title,
        kind,
        brand_name,
        model_name,
        year_model
      from public.asset_register_items
      where user_id = $1
      order by lower(coalesce(nullif(btrim(title), ''), 'Untitled asset')), id
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    title: cleanText(row.title, 180) || 'Untitled asset',
    meta: buildAssetMeta(row),
  }));
}

async function listDocumentLinks(userId: string, documentIds: string[]): Promise<Map<string, AccountDocumentAssetLink[]>> {
  const linksByDocument = new Map<string, AccountDocumentAssetLink[]>();
  if (!documentIds.length) return linksByDocument;

  const result = await getDb().query<AccountDocumentLinkRow>(
    `
      select
        link.document_id::text as document_id,
        link.asset_id,
        asset.title as asset_title,
        asset.kind as asset_kind,
        asset.brand_name,
        asset.model_name,
        asset.year_model
      from public.account_document_asset_links link
      join public.account_documents document
        on document.id = link.document_id
       and document.user_id = $1
      left join public.asset_register_items asset
        on asset.user_id = document.user_id
       and asset.id::text = link.asset_id
      where link.document_id::text = any($2::text[])
      order by lower(coalesce(nullif(btrim(asset.title), ''), link.asset_id)), link.asset_id
    `,
    [userId, documentIds],
  );

  for (const row of result.rows) {
    const documentId = String(row.document_id);
    const links = linksByDocument.get(documentId) ?? [];
    links.push({
      id: String(row.asset_id),
      title: cleanText(row.asset_title, 180) || 'Unavailable asset',
      meta: buildAssetMeta(row),
    });
    linksByDocument.set(documentId, links);
  }

  return linksByDocument;
}

export async function purgeExpiredAccountDocuments(userId: string): Promise<number> {
  await ensureAccountDocumentTables();
  const client = await getDb().connect();

  try {
    await client.query('begin');
    const expired = await client.query<UploadReferenceRow>(
      `
        select upload_id
        from public.account_documents
        where user_id = $1
          and deleted_at is not null
          and deleted_at <= now() - interval '90 days'
        for update
      `,
      [userId],
    );
    const uploadIds = expired.rows.map((row) => cleanText(row.upload_id, 160)).filter(Boolean);

    if (!uploadIds.length) {
      await client.query('commit');
      return 0;
    }

    await client.query(
      `
        delete from public.account_documents
        where user_id = $1
          and deleted_at is not null
          and deleted_at <= now() - interval '90 days'
      `,
      [userId],
    );

    const catalogs = await client.query<{ legacy_exists: boolean; bucket_exists: boolean }>(`
      select
        to_regclass('public.asset_register_uploads') is not null as legacy_exists,
        to_regclass('public.asset_register_bucket_uploads') is not null as bucket_exists
    `);

    if (catalogs.rows[0]?.legacy_exists) {
      await client.query(
        'delete from public.asset_register_uploads where user_id = $1 and id::text = any($2::text[])',
        [userId, uploadIds],
      );
    }

    if (catalogs.rows[0]?.bucket_exists) {
      await client.query(
        'delete from public.asset_register_bucket_uploads where user_id = $1 and id = any($2::text[])',
        [userId, uploadIds],
      );
    }

    await client.query('commit');
    return uploadIds.length;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function removeUnusedAccountDocumentUpload(userId: string, uploadId: string): Promise<void> {
  await ensureAccountDocumentTables();
  const normalizedUploadId = cleanText(uploadId, 160);
  if (!normalizedUploadId) return;

  const catalogs = await getDb().query<{ legacy_exists: boolean; bucket_exists: boolean }>(`
    select
      to_regclass('public.asset_register_uploads') is not null as legacy_exists,
      to_regclass('public.asset_register_bucket_uploads') is not null as bucket_exists
  `);

  if (catalogs.rows[0]?.legacy_exists) {
    await getDb().query(
      `
        delete from public.asset_register_uploads upload
        where upload.user_id = $1
          and upload.id::text = $2
          and not exists (
            select 1 from public.account_documents document
            where document.user_id = $1 and document.upload_id = $2
          )
      `,
      [userId, normalizedUploadId],
    );
  }

  if (catalogs.rows[0]?.bucket_exists) {
    await getDb().query(
      `
        delete from public.asset_register_bucket_uploads upload
        where upload.user_id = $1
          and upload.id = $2
          and not exists (
            select 1 from public.account_documents document
            where document.user_id = $1 and document.upload_id = $2
          )
      `,
      [userId, normalizedUploadId],
    );
  }

  cacheAccountDocumentUploadOwner(normalizedUploadId, null);
}

export async function listAccountDocuments(
  userId: string,
  options: { includeDeleted?: boolean; assetId?: string } = {},
): Promise<AccountDocument[]> {
  await ensureAccountDocumentTables();
  await purgeExpiredAccountDocuments(userId);
  const assetId = cleanText(options.assetId, 120);

  const result = await getDb().query<AccountDocumentRow>(
    `
      select
        id::text as id,
        upload_id,
        title,
        category,
        document_type,
        notes,
        expiry_date,
        file_name,
        content_type,
        byte_size,
        created_at,
        updated_at,
        deleted_at
      from public.account_documents
      where user_id = $1
        and ${options.includeDeleted ? 'deleted_at is not null' : 'deleted_at is null'}
        and (
          $2 = ''
          or exists (
            select 1
            from public.account_document_asset_links filtered_link
            where filtered_link.document_id = account_documents.id
              and filtered_link.asset_id = $2
          )
        )
      order by ${options.includeDeleted ? 'deleted_at desc' : 'updated_at desc'}, created_at desc, id desc
    `,
    [userId, assetId],
  );
  const documentIds = result.rows.map((row) => String(row.id));
  const linksByDocument = await listDocumentLinks(userId, documentIds);

  return result.rows.map((row) => mapDocumentRow(row, linksByDocument.get(String(row.id)) ?? []));
}

export async function getAccountDocumentSummary(userId: string): Promise<AccountDocumentSummary> {
  await ensureAccountDocumentTables();
  const result = await getDb().query<AccountDocumentSummaryRow>(
    `
      select
        count(*)::bigint as total_documents,
        count(*) filter (
          where expiry_date is not null
            and expiry_date <= current_date + 60
        )::bigint as expiring_soon,
        count(*) filter (
          where exists (
            select 1
            from public.account_document_asset_links link
            where link.document_id = document.id
          )
        )::bigint as linked_documents,
        coalesce(sum(byte_size), 0)::bigint as storage_bytes
      from public.account_documents document
      where user_id = $1
        and deleted_at is null
    `,
    [userId],
  );
  const row = result.rows[0];

  return {
    totalDocuments: Math.max(0, Math.round(numberValue(row?.total_documents))),
    expiringSoon: Math.max(0, Math.round(numberValue(row?.expiring_soon))),
    linkedDocuments: Math.max(0, Math.round(numberValue(row?.linked_documents))),
    storageBytes: Math.max(0, Math.round(numberValue(row?.storage_bytes))),
  };
}

export async function createAccountDocument(
  userId: string,
  input: CreateAccountDocumentInput,
): Promise<AccountDocument> {
  await ensureAccountDocumentTables();

  const documentId = randomUUID();
  const fileName = cleanText(input.fileName, 240) || 'document';
  const title = cleanText(input.title, 180) || fileName.replace(/\.[^.]+$/, '') || 'Untitled document';
  const notes = cleanNotes(input.notes);
  const expiryDate = normalizeExpiryDate(input.expiryDate);
  const assetIds = normalizeAssetIds(input.assetIds);
  const documentType = normalizeDocumentType(input.documentType, { required: assetIds.length > 0 });
  const category = getAccountDocumentTypeCategory(documentType) ?? normalizeCategory(input.category);
  if (documentType === 'other' && !notes) throw new Error('DOCUMENT_DESCRIPTION_REQUIRED');
  const uploadId = cleanText(input.uploadId, 160);
  const contentType = cleanText(input.contentType, 160) || 'application/octet-stream';
  const byteSize = Math.round(numberValue(input.byteSize));

  if (!uploadId || !title || !fileName || byteSize <= 0) throw new Error('DOCUMENT_INPUT_INVALID');

  const client = await getDb().connect();
  try {
    await client.query('begin');
    await assertOwnedAssetIds(client, userId, assetIds);
    await client.query(
      `
        insert into public.account_documents (
          id,
          user_id,
          upload_id,
          title,
          category,
          document_type,
          notes,
          expiry_date,
          file_name,
          content_type,
          byte_size
        ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11)
      `,
      [documentId, userId, uploadId, title, category, documentType, notes, expiryDate, fileName, contentType, byteSize],
    );
    await replaceAssetLinks(client, userId, documentId, assetIds);
    await client.query('commit');
    cacheAccountDocumentUploadOwner(uploadId, userId);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  const created = await getAccountDocument(userId, documentId);
  if (!created) throw new Error('DOCUMENT_CREATE_FAILED');
  return created;
}

export async function getAccountDocument(userId: string, documentId: string): Promise<AccountDocument | null> {
  await ensureAccountDocumentTables();
  const result = await getDb().query<AccountDocumentRow>(
    `
      select
        id::text as id,
        upload_id,
        title,
        category,
        document_type,
        notes,
        expiry_date,
        file_name,
        content_type,
        byte_size,
        created_at,
        updated_at,
        deleted_at
      from public.account_documents
      where user_id = $1
        and id::text = $2
        and (deleted_at is null or deleted_at > now() - interval '90 days')
      limit 1
    `,
    [userId, cleanText(documentId, 80)],
  );
  const row = result.rows[0];
  if (!row) return null;
  const links = await listDocumentLinks(userId, [String(row.id)]);
  return mapDocumentRow(row, links.get(String(row.id)) ?? []);
}

export async function updateAccountDocument(
  userId: string,
  documentId: string,
  input: AccountDocumentInput,
): Promise<AccountDocument> {
  await ensureAccountDocumentTables();
  const normalizedId = cleanText(documentId, 80);
  const title = cleanText(input.title, 180);
  const documentType = normalizeDocumentType(input.documentType);
  const category = getAccountDocumentTypeCategory(documentType) ?? normalizeCategory(input.category);
  const notes = cleanNotes(input.notes);
  if (documentType === 'other' && !notes) throw new Error('DOCUMENT_DESCRIPTION_REQUIRED');
  const expiryDate = normalizeExpiryDate(input.expiryDate);
  const assetIds = normalizeAssetIds(input.assetIds);
  if (!title) throw new Error('DOCUMENT_TITLE_REQUIRED');

  const client = await getDb().connect();
  try {
    await client.query('begin');
    const updated = await client.query(
      `
        update public.account_documents
        set
          title = $3,
          category = $4,
          document_type = coalesce($5, document_type),
          notes = $6,
          expiry_date = $7::date,
          updated_at = now()
        where user_id = $1
          and id::text = $2
          and deleted_at is null
        returning id
      `,
      [userId, normalizedId, title, category, documentType, notes, expiryDate],
    );
    if (updated.rowCount !== 1) throw new Error('DOCUMENT_NOT_FOUND');
    await replaceAssetLinks(client, userId, normalizedId, assetIds);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  const document = await getAccountDocument(userId, normalizedId);
  if (!document) throw new Error('DOCUMENT_NOT_FOUND');
  return document;
}

export async function moveAccountDocumentToRecycleBin(userId: string, documentId: string): Promise<void> {
  await ensureAccountDocumentTables();
  const result = await getDb().query(
    `
      update public.account_documents
      set deleted_at = now(), updated_at = now()
      where user_id = $1
        and id::text = $2
        and deleted_at is null
      returning id
    `,
    [userId, cleanText(documentId, 80)],
  );
  if (result.rowCount !== 1) throw new Error('DOCUMENT_NOT_FOUND');
}

export async function restoreAccountDocument(userId: string, documentId: string): Promise<AccountDocument> {
  await ensureAccountDocumentTables();
  const normalizedId = cleanText(documentId, 80);
  const result = await getDb().query(
    `
      update public.account_documents
      set deleted_at = null, updated_at = now()
      where user_id = $1
        and id::text = $2
        and deleted_at > now() - interval '90 days'
      returning id
    `,
    [userId, normalizedId],
  );
  if (result.rowCount !== 1) throw new Error('DOCUMENT_NOT_FOUND');

  const document = await getAccountDocument(userId, normalizedId);
  if (!document) throw new Error('DOCUMENT_NOT_FOUND');
  return document;
}

export async function getAccountDocumentUploadReference(
  userId: string,
  documentId: string,
): Promise<{ uploadId: string; fileName: string } | null> {
  await ensureAccountDocumentTables();
  await purgeExpiredAccountDocuments(userId);
  const result = await getDb().query<{ upload_id: string; file_name: string }>(
    `
      select upload_id, file_name
      from public.account_documents
      where user_id = $1
        and id::text = $2
        and (deleted_at is null or deleted_at > now() - interval '90 days')
      limit 1
    `,
    [userId, cleanText(documentId, 80)],
  );
  const row = result.rows[0];
  return row
    ? { uploadId: cleanText(row.upload_id, 160), fileName: cleanText(row.file_name, 240) || 'document' }
    : null;
}

export async function getAccountDocumentUploadOwner(uploadId: string): Promise<string | null> {
  const normalizedUploadId = cleanText(uploadId, 160);
  if (!normalizedUploadId) return null;

  if (accountDocumentUploadOwnerCache.has(normalizedUploadId)) {
    return accountDocumentUploadOwnerCache.get(normalizedUploadId) ?? null;
  }

  if (!accountDocumentTableExistsPromise) {
    accountDocumentTableExistsPromise = getDb()
      .query<{ exists: boolean }>(`select to_regclass('public.account_documents') is not null as exists`)
      .then((result) => Boolean(result.rows[0]?.exists))
      .catch((error) => {
        accountDocumentTableExistsPromise = null;
        throw error;
      });
  }

  if (!await accountDocumentTableExistsPromise) {
    cacheAccountDocumentUploadOwner(normalizedUploadId, null);
    return null;
  }

  const result = await getDb().query<{ user_id: string }>(
    `
      select user_id
      from public.account_documents
      where upload_id = $1
      limit 1
    `,
    [normalizedUploadId],
  );

  const ownerUserId = cleanText(result.rows[0]?.user_id, 160) || null;
  cacheAccountDocumentUploadOwner(normalizedUploadId, ownerUserId);
  return ownerUserId;
}
