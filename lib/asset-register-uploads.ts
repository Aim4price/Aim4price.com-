import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import {
  createBucketOnlyUploadObjectKey,
  createUploadObjectKey,
  createBucketSignedGetUrl,
  getUploadStorageMode,
  isBucketOnlyNewApproved,
  isBucketWriteCostApproved,
  mirrorUploadToBucket,
  readVerifiedBucketUploadObjectBytes,
  sha256Hex,
  storeBucketOnlyUpload,
} from './upload-object-storage';

export const MAX_ASSET_REGISTER_PHOTOS = 12;
export const MAX_ASSET_REGISTER_DOCUMENTS = 20;
export const MAX_ASSET_REGISTER_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_DOCUMENT_VAULT_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ALLOWED_ASSET_REGISTER_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
export const ALLOWED_ASSET_REGISTER_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
export const ALLOWED_ASSET_REGISTER_DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

const ASSET_REGISTER_UPLOAD_ROUTE_PREFIX = '/api/asset-register/uploads/';
const BUCKET_ONLY_UPLOAD_ID_PREFIX = 'bkt-';
const BUCKET_ONLY_UPLOAD_ID_PATTERN = /^bkt-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const CONTENT_TYPE_BY_EXTENSION = new Map<string, string>([
  ['.pdf', 'application/pdf'],
  ['.doc', 'application/msword'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.xls', 'application/vnd.ms-excel'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['.csv', 'text/csv'],
  ['.txt', 'text/plain'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

const LEGACY_DATA_COLUMN_CANDIDATES = [
  'file_data',
  'upload_data',
  'blob_data',
  'binary_data',
  'file_bytes',
  'bytes',
  'content',
  'body',
];

const LEGACY_FILE_NAME_COLUMN_CANDIDATES = ['filename', 'name', 'original_name', 'original_file_name'];
const LEGACY_CONTENT_TYPE_COLUMN_CANDIDATES = ['mime_type', 'mime', 'type'];
const LEGACY_BYTE_SIZE_COLUMN_CANDIDATES = ['size_bytes', 'size', 'file_size'];

type CreateAssetRegisterUploadInput = {
  userId: string;
  file: File;
  category?: string;
};

type CreatedAssetRegisterUpload = {
  id: string;
  url: string;
  fileName: string;
  contentType: string;
  byteSize: number;
};

export type LegacyAssetRegisterUploadResponse = {
  data: Buffer;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
  disposition: 'inline' | 'attachment';
};

type AssetRegisterUploadRow = {
  data: Buffer | Uint8Array | string | null;
  content_type: string | null;
  byte_size: string | number | null;
  file_name: string | null;
  storage_state?: string | null;
  object_key?: string | null;
};

type BucketOnlyUploadRow = {
  storage_state: string | null;
  object_key: string | null;
  byte_size: string | number | null;
  content_sha256: string | null;
  content_type: string | null;
  file_name: string | null;
};

export type BucketOnlyUploadDownloadResult =
  | { status: 'not-found' }
  | { status: 'unavailable' }
  | { status: 'ready'; url: string };

export type AssetRegisterUploadBytesResult =
  | { status: 'not-found' }
  | { status: 'unavailable' }
  | { status: 'ready'; upload: LegacyAssetRegisterUploadResponse };

type UploadColumnInfo = {
  column_name: string;
  udt_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
};

let ensureAssetRegisterUploadsTablePromise: Promise<void> | null = null;

function sanitizeFileName(value: string): string {
  const cleaned = String(value ?? '')
    .replace(/[\\/\0\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (cleaned || 'asset-register-upload').slice(0, 180);
}

function normalizeUploadCategory(value: string | undefined): string {
  const normalized = String(value ?? 'other')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return (normalized || 'other').slice(0, 60);
}

export function normalizeUploadId(value: string): string {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) {
    return '';
  }

  const withoutRoute = rawValue.includes(ASSET_REGISTER_UPLOAD_ROUTE_PREFIX)
    ? rawValue.split(ASSET_REGISTER_UPLOAD_ROUTE_PREFIX).pop() ?? rawValue
    : rawValue;
  const withoutQuery = withoutRoute.split(/[?#]/)[0] ?? withoutRoute;

  try {
    return decodeURIComponent(withoutQuery).trim();
  } catch {
    return withoutQuery.trim();
  }
}

function normalizeContentType(fileName: string, value: string): string {
  const explicitType = String(value ?? '').trim().toLowerCase();

  if (
    ALLOWED_ASSET_REGISTER_IMAGE_TYPES.has(explicitType)
    || ALLOWED_ASSET_REGISTER_DOCUMENT_TYPES.has(explicitType)
  ) {
    return explicitType;
  }

  return CONTENT_TYPE_BY_EXTENSION.get(getFileExtension(fileName)) ?? 'application/octet-stream';
}

function contentDispositionForType(contentType: string): 'inline' | 'attachment' {
  const normalized = String(contentType ?? '').trim().toLowerCase();
  return ALLOWED_ASSET_REGISTER_IMAGE_TYPES.has(normalized) || normalized === 'application/pdf'
    ? 'inline'
    : 'attachment';
}

function normalizeDatabaseBuffer(value: Buffer | Uint8Array | string | null): Buffer {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  if (typeof value === 'string') {
    return value.startsWith('\\x') ? Buffer.from(value.slice(2), 'hex') : Buffer.from(value, 'binary');
  }

  return Buffer.alloc(0);
}

function quoteIdentifier(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function columnInfoMap(columns: UploadColumnInfo[]): Map<string, UploadColumnInfo> {
  return new Map(columns.map((column) => [column.column_name, column]));
}

async function readUploadTableColumns(): Promise<UploadColumnInfo[]> {
  const result = await getDb().query<UploadColumnInfo>(
    `
      select column_name, udt_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'asset_register_uploads'
    `,
  );

  return result.rows;
}

async function copyLegacyColumnValue(input: {
  targetColumn: string;
  candidateColumns: string[];
  allowedSourceUdtNames?: Set<string>;
  castExpression?: (sourceColumnSql: string) => string;
}): Promise<void> {
  const columns = columnInfoMap(await readUploadTableColumns());

  if (!columns.has(input.targetColumn)) {
    return;
  }

  for (const candidateColumn of input.candidateColumns) {
    const sourceColumn = columns.get(candidateColumn);

    if (!sourceColumn || candidateColumn === input.targetColumn) {
      continue;
    }

    if (input.allowedSourceUdtNames && !input.allowedSourceUdtNames.has(sourceColumn.udt_name)) {
      continue;
    }

    const targetColumnSql = quoteIdentifier(input.targetColumn);
    const sourceColumnSql = quoteIdentifier(candidateColumn);
    const sourceExpressionSql = input.castExpression ? input.castExpression(sourceColumnSql) : sourceColumnSql;

    await getDb().query(`
      update public.asset_register_uploads
      set ${targetColumnSql} = ${sourceExpressionSql}
      where ${targetColumnSql} is null
        and ${sourceColumnSql} is not null
    `);
  }
}


async function relaxLegacyUploadColumnNotNullConstraints(candidateColumns: string[]): Promise<void> {
  const columns = columnInfoMap(await readUploadTableColumns());

  for (const candidateColumn of candidateColumns) {
    const column = columns.get(candidateColumn);

    if (!column || column.is_nullable !== 'NO') {
      continue;
    }

    await getDb().query(`
      alter table public.asset_register_uploads
        alter column ${quoteIdentifier(candidateColumn)} drop not null
    `);
  }
}

type UploadInsertField = {
  name: string;
  value: unknown;
};

function isByteaColumn(column: UploadColumnInfo | undefined): boolean {
  return column?.udt_name === 'bytea';
}

function isTextColumn(column: UploadColumnInfo | undefined): boolean {
  return Boolean(column && ['text', 'varchar', 'bpchar'].includes(column.udt_name));
}

function isNumericColumn(column: UploadColumnInfo | undefined): boolean {
  return Boolean(column && ['int2', 'int4', 'int8', 'numeric', 'float4', 'float8'].includes(column.udt_name));
}

function pushUploadInsertField(input: {
  columns: Map<string, UploadColumnInfo>;
  fields: UploadInsertField[];
  usedColumns: Set<string>;
  columnName: string;
  value: unknown;
  allowColumn?: (column: UploadColumnInfo | undefined) => boolean;
}): void {
  const column = input.columns.get(input.columnName);

  if (!column || input.usedColumns.has(input.columnName)) {
    return;
  }

  if (input.allowColumn && !input.allowColumn(column)) {
    return;
  }

  input.fields.push({ name: input.columnName, value: input.value });
  input.usedColumns.add(input.columnName);
}

async function insertAssetRegisterUploadRow(input: {
  id: string;
  userId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  buffer: Buffer;
  category: string;
}): Promise<void> {
  const columns = columnInfoMap(await readUploadTableColumns());
  const fields: UploadInsertField[] = [];
  const usedColumns = new Set<string>();
  const push = (columnName: string, value: unknown, allowColumn?: (column: UploadColumnInfo | undefined) => boolean) =>
    pushUploadInsertField({ columns, fields, usedColumns, columnName, value, allowColumn });

  push('id', input.id);
  push('user_id', input.userId);
  push('owner_id', input.userId, isTextColumn);
  push('created_by', input.userId, isTextColumn);
  push('uploaded_by', input.userId, isTextColumn);
  push('account_id', input.userId, isTextColumn);

  push('file_name', input.fileName, isTextColumn);
  for (const columnName of LEGACY_FILE_NAME_COLUMN_CANDIDATES) {
    push(columnName, input.fileName, isTextColumn);
  }

  push('content_type', input.contentType, isTextColumn);
  for (const columnName of LEGACY_CONTENT_TYPE_COLUMN_CANDIDATES) {
    push(columnName, input.contentType, isTextColumn);
  }

  push('byte_size', input.byteSize, isNumericColumn);
  for (const columnName of LEGACY_BYTE_SIZE_COLUMN_CANDIDATES) {
    push(columnName, input.byteSize, isNumericColumn);
  }

  // Legacy bytea columns are migration sources only. Writing to them duplicates
  // every upload in PostgreSQL's TOAST storage.
  push('data', input.buffer, isByteaColumn);
  push('storage_state', 'postgres', isTextColumn);
  push('upload_category', input.category, isTextColumn);

  const uploadedAt = new Date();
  push('created_at', uploadedAt);
  push('uploaded_at', uploadedAt);
  push('created_on', uploadedAt);
  push('updated_at', uploadedAt);

  if (!usedColumns.has('data')) {
    throw new Error('Asset register upload storage is missing the canonical data bytea column.');
  }

  const columnSql = fields.map((field) => quoteIdentifier(field.name)).join(', ');
  const valueSql = fields.map((_, index) => `$${index + 1}`).join(', ');

  await getDb().query(
    `insert into public.asset_register_uploads (${columnSql}) values (${valueSql})`,
    fields.map((field) => field.value),
  );
}

async function markAssetRegisterUploadMirrored(input: {
  uploadId: string;
  objectKey: string;
  objectEtag: string | null;
  contentSha256: string;
  verifiedAt: Date;
}): Promise<void> {
  const columns = columnInfoMap(await readUploadTableColumns());
  const requiredColumns = [
    'storage_state',
    'object_key',
    'content_sha256',
    'object_etag',
    'object_verified_at',
  ];

  if (requiredColumns.some((column) => !columns.has(column))) {
    throw new Error('Asset upload object-storage metadata migration has not been applied.');
  }

  const updated = await getDb().query(
    `
      update public.asset_register_uploads
      set
        storage_state = 'dual_verified',
        object_key = $2,
        object_etag = $3,
        content_sha256 = $4,
        object_verified_at = $5
      where id::text = $1
        and storage_state = 'copying'
        and object_key = $2
      returning id
    `,
    [input.uploadId, input.objectKey, input.objectEtag, input.contentSha256, input.verifiedAt],
  );

  if (updated.rowCount !== 1) {
    throw new Error('The upload row changed before its Bucket copy could be marked verified.');
  }
}

async function prepareAssetRegisterUploadMirror(input: {
  uploadId: string;
  objectKey: string;
  contentSha256: string;
}): Promise<void> {
  const updated = await getDb().query(
    `
      update public.asset_register_uploads
      set
        storage_state = 'copying',
        object_key = $2,
        content_sha256 = $3,
        object_etag = null,
        object_verified_at = null
      where id::text = $1
        and data is not null
        and storage_state = 'postgres'
      returning id
    `,
    [input.uploadId, input.objectKey, input.contentSha256],
  );

  if (updated.rowCount !== 1) {
    throw new Error('The upload row could not enter the safe Bucket copying state.');
  }
}

async function assertObjectStorageSchemaReady(): Promise<void> {
  const result = await getDb().query<{
    has_state_constraint: boolean;
    has_verified_constraint: boolean;
    has_key_constraint: boolean;
    has_purge_queue: boolean;
    has_delete_trigger: boolean;
  }>(`
    select
      exists (
        select 1 from pg_constraint
        where conrelid = 'public.asset_register_uploads'::regclass
          and conname = 'asset_register_uploads_storage_state_check'
      ) as has_state_constraint,
      exists (
        select 1 from pg_constraint
        where conrelid = 'public.asset_register_uploads'::regclass
          and conname = 'asset_register_uploads_verified_object_check'
      ) as has_verified_constraint,
      exists (
        select 1 from pg_constraint
        where conrelid = 'public.asset_register_uploads'::regclass
          and conname = 'asset_register_uploads_object_key_check'
      ) as has_key_constraint,
      to_regclass('public.asset_upload_object_purge_queue') is not null as has_purge_queue,
      exists (
        select 1 from pg_trigger
        where tgrelid = 'public.asset_register_uploads'::regclass
          and tgname = 'queue_deleted_asset_upload_object_trigger'
          and not tgisinternal
          and tgenabled <> 'D'
      ) as has_delete_trigger
  `);
  const readiness = result.rows[0];

  if (
    !readiness?.has_state_constraint
    || !readiness.has_verified_constraint
    || !readiness.has_key_constraint
    || !readiness.has_purge_queue
    || !readiness.has_delete_trigger
  ) {
    throw new Error('Migration 80 is not fully applied; Bucket writes and reads remain disabled.');
  }
}

async function assertBucketOnlyCatalogReady(): Promise<void> {
  const result = await getDb().query<{
    has_catalog: boolean;
    has_purge_queue: boolean;
    has_deleted_account_guard: boolean;
    has_id_constraint: boolean;
    has_state_constraint: boolean;
    has_ready_constraint: boolean;
    has_delete_trigger: boolean;
  }>(`
    select
      to_regclass('public.asset_register_bucket_uploads') is not null as has_catalog,
      to_regclass('public.asset_register_bucket_upload_purge_queue') is not null as has_purge_queue,
      to_regclass('public.asset_register_bucket_deleted_accounts') is not null as has_deleted_account_guard,
      exists (
        select 1 from pg_constraint
        where conrelid = to_regclass('public.asset_register_bucket_uploads')
          and conname = 'asset_register_bucket_uploads_id_format_check'
      ) as has_id_constraint,
      exists (
        select 1 from pg_constraint
        where conrelid = to_regclass('public.asset_register_bucket_uploads')
          and conname = 'asset_register_bucket_uploads_storage_state_check'
      ) as has_state_constraint,
      exists (
        select 1 from pg_constraint
        where conrelid = to_regclass('public.asset_register_bucket_uploads')
          and conname = 'asset_register_bucket_uploads_state_metadata_check'
      ) as has_ready_constraint,
      exists (
        select 1 from pg_trigger
        where tgrelid = to_regclass('public.asset_register_bucket_uploads')
          and tgname = 'queue_deleted_bucket_upload_trigger'
          and not tgisinternal
          and tgenabled <> 'D'
      ) as has_delete_trigger
  `);
  const readiness = result.rows[0];

  if (
    !readiness?.has_catalog
    || !readiness.has_purge_queue
    || !readiness.has_deleted_account_guard
    || !readiness.has_id_constraint
    || !readiness.has_state_constraint
    || !readiness.has_ready_constraint
    || !readiness.has_delete_trigger
  ) {
    throw new Error('Migration 81 is not fully applied; Bucket-only writes and reads remain disabled.');
  }
}

async function ensureAssetRegisterUploadsTableOnce(): Promise<void> {
  const db = getDb();

  await db.query(`
    create table if not exists public.asset_register_uploads (
      id text primary key,
      user_id text,
      file_name text,
      content_type text,
      byte_size integer,
      data bytea,
      storage_state text not null default 'postgres',
      object_key text,
      content_sha256 text,
      object_etag text,
      object_verified_at timestamptz,
      upload_category text not null default 'other',
      deleted_at timestamptz,
      purge_after timestamptz,
      created_at timestamptz
    )
  `);

  await db.query(`
    alter table public.asset_register_uploads
      add column if not exists id text,
      add column if not exists user_id text,
      add column if not exists file_name text,
      add column if not exists content_type text,
      add column if not exists byte_size integer,
      add column if not exists data bytea,
      add column if not exists storage_state text not null default 'postgres',
      add column if not exists object_key text,
      add column if not exists content_sha256 text,
      add column if not exists object_etag text,
      add column if not exists object_verified_at timestamptz,
      add column if not exists upload_category text not null default 'other',
      add column if not exists deleted_at timestamptz,
      add column if not exists purge_after timestamptz,
      add column if not exists created_at timestamptz
  `);

  await copyLegacyColumnValue({
    targetColumn: 'data',
    candidateColumns: LEGACY_DATA_COLUMN_CANDIDATES,
    allowedSourceUdtNames: new Set(['bytea']),
  });
  await copyLegacyColumnValue({
    targetColumn: 'file_name',
    candidateColumns: LEGACY_FILE_NAME_COLUMN_CANDIDATES,
    allowedSourceUdtNames: new Set(['text', 'varchar', 'bpchar']),
  });
  await copyLegacyColumnValue({
    targetColumn: 'content_type',
    candidateColumns: LEGACY_CONTENT_TYPE_COLUMN_CANDIDATES,
    allowedSourceUdtNames: new Set(['text', 'varchar', 'bpchar']),
  });
  await copyLegacyColumnValue({
    targetColumn: 'byte_size',
    candidateColumns: LEGACY_BYTE_SIZE_COLUMN_CANDIDATES,
    allowedSourceUdtNames: new Set(['int2', 'int4', 'int8', 'numeric', 'float4', 'float8']),
    castExpression: (sourceColumnSql) => `greatest(0, round(coalesce(${sourceColumnSql}, 0)::numeric)::integer)`,
  });

  await relaxLegacyUploadColumnNotNullConstraints([
    ...LEGACY_DATA_COLUMN_CANDIDATES,
    ...LEGACY_FILE_NAME_COLUMN_CANDIDATES,
    ...LEGACY_CONTENT_TYPE_COLUMN_CANDIDATES,
    ...LEGACY_BYTE_SIZE_COLUMN_CANDIDATES,
    'owner_id',
    'created_by',
    'uploaded_by',
    'account_id',
    'uploaded_at',
    'created_on',
    'updated_at',
  ]);

  await db.query(`
    update public.asset_register_uploads
    set
      file_name = coalesce(nullif(file_name, ''), 'asset-register-upload'),
      content_type = coalesce(nullif(content_type, ''), 'application/octet-stream'),
      byte_size = coalesce(byte_size, octet_length(data), 0),
      created_at = coalesce(created_at, now())
    where id is null
       or file_name is null
       or file_name = ''
       or content_type is null
       or content_type = ''
       or byte_size is null
       or created_at is null
  `);

  await db.query(`
    alter table public.asset_register_uploads
      alter column file_name set default 'asset-register-upload',
      alter column content_type set default 'application/octet-stream',
      alter column byte_size set default 0,
      alter column created_at set default now()
  `);

  await db.query(`
    do $$
    begin
      if not exists (
        select 1
        from public.asset_register_uploads
        where id is null
           or user_id is null
           or file_name is null
           or content_type is null
           or byte_size is null
           or created_at is null
      ) then
        alter table public.asset_register_uploads
          alter column id set not null,
          alter column user_id set not null,
          alter column file_name set not null,
          alter column content_type set not null,
          alter column byte_size set not null,
          alter column created_at set not null;
      end if;

      if not exists (
        select 1
        from public.asset_register_uploads
        where data is null
      ) then
        alter table public.asset_register_uploads
          alter column data set not null;
      end if;
    end $$;
  `);

  await db.query(`
    create index if not exists asset_register_uploads_user_id_created_at_idx
      on public.asset_register_uploads (user_id, created_at desc)
  `);

  await db.query(`
    create unique index if not exists asset_register_uploads_object_key_uidx
      on public.asset_register_uploads (object_key)
      where object_key is not null
  `);

  await db.query(`
    comment on table public.asset_register_uploads is
      'Binary storage for Asset Register photos, documents and register logos. Asset JSON stores only the short API URL.';

    comment on column public.asset_register_uploads.data is
      'Raw uploaded file bytes streamed by /api/asset-register/uploads/<id>.';
  `);
}

async function ensureAssetRegisterUploadsTable(): Promise<void> {
  if (!ensureAssetRegisterUploadsTablePromise) {
    ensureAssetRegisterUploadsTablePromise = ensureAssetRegisterUploadsTableOnce()
      .then(() => undefined)
      .catch((error) => {
        ensureAssetRegisterUploadsTablePromise = null;
        throw error;
      });
  }

  return ensureAssetRegisterUploadsTablePromise;
}

export function getFileExtension(value: string): string {
  const fileName = String(value ?? '').trim().toLowerCase();
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex) : '';
}

export function isAllowedAssetRegisterDocument(file: File): boolean {
  const contentType = String(file.type ?? '').trim().toLowerCase();
  const extension = getFileExtension(file.name);
  return ALLOWED_ASSET_REGISTER_DOCUMENT_TYPES.has(contentType) || ALLOWED_ASSET_REGISTER_DOCUMENT_EXTENSIONS.has(extension);
}

export function isBucketOnlyAssetRegisterUploadId(value: string): boolean {
  return BUCKET_ONLY_UPLOAD_ID_PATTERN.test(normalizeUploadId(value));
}

function bucketUploadErrorMessage(error: unknown): string {
  const candidate = error && typeof error === 'object'
    ? error as { name?: unknown; $metadata?: { httpStatusCode?: unknown } }
    : {};
  const safeName = String(candidate.name ?? 'BucketUploadError')
    .replace(/[^0-9A-Za-z_.-]+/g, '')
    .slice(0, 80) || 'BucketUploadError';
  const rawStatus = Number(candidate.$metadata?.httpStatusCode);
  const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599
    ? ` (HTTP ${rawStatus})`
    : '';

  // Never persist SDK messages, endpoints, request headers, stack traces or
  // credentials. The class and HTTP status are enough to diagnose the row.
  return `Bucket upload failed: ${safeName}${status}`;
}

async function createBucketOnlyAssetRegisterUpload(input: {
  userId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  buffer: Buffer;
  category: string;
}): Promise<CreatedAssetRegisterUpload> {
  if (!isBucketWriteCostApproved() || !isBucketOnlyNewApproved()) {
    throw new Error('Bucket-only upload storage is not fully approved.');
  }

  await assertBucketOnlyCatalogReady();

  const userId = String(input.userId ?? '').trim();
  if (!userId) {
    throw new Error('A valid upload owner is required.');
  }

  if (
    !Number.isSafeInteger(input.byteSize)
    || input.byteSize <= 0
    || input.byteSize > MAX_DOCUMENT_VAULT_UPLOAD_BYTES
  ) {
    throw new Error('Bucket-only upload size is outside the supported range.');
  }

  const id = `bkt-${randomUUID()}`;
  const objectKey = createBucketOnlyUploadObjectKey(id);
  const contentSha256 = sha256Hex(input.buffer);
  const client = await getDb().connect();
  let accountLockHeld = false;
  let discardClient = false;

  try {
    // The same per-account advisory lock is used by account deletion. Holding
    // it across the verified Bucket write prevents a concurrent deletion from
    // losing the only metadata that identifies a possibly-created object.
    accountLockHeld = true;
    await client.query('select pg_advisory_lock(hashtextextended($1, 0))', [userId]);

    // An upload request can be authenticated just before account deletion and
    // then wait on the same lock. The durable deletion tombstone is written by
    // workspace cleanup before its Bucket rows are removed; checking it under
    // this lock closes the gap before Better Auth deletes the user row itself.
    const ownerState = await client.query<{
      owner_exists: boolean;
      deletion_started: boolean;
    }>(
      `
        select
          exists (
            select 1 from public."user" where id::text = $1
          ) as owner_exists,
          exists (
            select 1
            from public.asset_register_bucket_deleted_accounts
            where user_id = $1
          ) as deletion_started
      `,
      [userId],
    );
    const owner = ownerState.rows[0];
    if (!owner?.owner_exists || owner.deletion_started) {
      throw new Error('The upload owner account no longer exists.');
    }

    await client.query(
      `
        insert into public.asset_register_bucket_uploads (
          id,
          user_id,
          file_name,
          content_type,
          byte_size,
          object_key,
          content_sha256,
          storage_state,
          upload_category
        ) values ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
      `,
      [
        id,
        userId,
        input.fileName,
        input.contentType,
        input.byteSize,
        objectKey,
        contentSha256,
        input.category,
      ],
    );

    try {
      const stored = await storeBucketOnlyUpload({
        uploadId: id,
        data: input.buffer,
        contentType: input.contentType,
      });

      if (stored.objectKey !== objectKey || stored.contentSha256 !== contentSha256) {
        throw new Error('The verified Bucket upload metadata does not match its pending catalog row.');
      }

      const updated = await client.query(
        `
          update public.asset_register_bucket_uploads
          set
            storage_state = 'ready',
            object_etag = $2,
            verified_at = now(),
            last_error = null
          where id = $1
            and user_id = $3
            and storage_state = 'pending'
            and object_key = $4
            and content_sha256 = $5
          returning id
        `,
        [id, stored.etag, userId, objectKey, contentSha256],
      );

      if (updated.rowCount !== 1) {
        throw new Error('The Bucket upload catalog row changed before it could be marked ready.');
      }
    } catch (error) {
      try {
        await client.query(
          `
            update public.asset_register_bucket_uploads
            set last_error = $2
            where id = $1
              and storage_state = 'pending'
          `,
          [id, bucketUploadErrorMessage(error)],
        );
      } catch (catalogError) {
        console.error('Bucket upload failure could not be recorded in its pending catalog row', {
          uploadId: id,
          catalogError,
        });
      }

      throw new Error('File storage is temporarily unavailable. Please try again.');
    }

    return {
      id,
      url: buildAssetRegisterUploadUrl(id),
      fileName: input.fileName,
      contentType: input.contentType,
      byteSize: input.byteSize,
    };
  } finally {
    if (accountLockHeld) {
      try {
        await client.query('select pg_advisory_unlock(hashtextextended($1, 0))', [userId]);
      } catch (unlockError) {
        discardClient = true;
        console.error('Bucket upload account lock could not be released explicitly', {
          uploadId: id,
          unlockError,
        });
      }
    }
    // Never return a connection with a possibly-held session advisory lock to
    // the pool. Passing true makes node-postgres destroy it instead.
    client.release(discardClient);
  }
}

export async function createAssetRegisterUpload(
  input: CreateAssetRegisterUploadInput,
): Promise<CreatedAssetRegisterUpload> {
  const fileName = sanitizeFileName(input.file.name);
  const contentType = normalizeContentType(fileName, input.file.type);
  const storageMode = getUploadStorageMode();

  if (
    storageMode === 'bucket-only-new'
    && (!isBucketWriteCostApproved() || !isBucketOnlyNewApproved())
  ) {
    throw new Error('Bucket-only upload storage is not fully approved.');
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const byteSize = buffer.length;
  const category = normalizeUploadCategory(input.category);

  if (storageMode === 'bucket-only-new') {
    return createBucketOnlyAssetRegisterUpload({
      userId: input.userId,
      fileName,
      contentType,
      byteSize,
      buffer,
      category,
    });
  }

  await ensureAssetRegisterUploadsTable();

  const id = randomUUID();

  await insertAssetRegisterUploadRow({
    id,
    userId: input.userId,
    fileName,
    contentType,
    byteSize,
    buffer,
    category,
  });

  if (storageMode !== 'postgres') {
    try {
      if (!isBucketWriteCostApproved()) {
        throw new Error('Bucket writes require explicit cost approval. PostgreSQL copy retained.');
      }
      await assertObjectStorageSchemaReady();
      await prepareAssetRegisterUploadMirror({
        uploadId: id,
        objectKey: createUploadObjectKey(id),
        contentSha256: sha256Hex(buffer),
      });
      const mirrored = await mirrorUploadToBucket({
        uploadId: id,
        data: buffer,
        contentType,
      });
      await markAssetRegisterUploadMirrored({
        uploadId: id,
        objectKey: mirrored.objectKey,
        objectEtag: mirrored.etag,
        contentSha256: mirrored.contentSha256,
        verifiedAt: mirrored.verifiedAt,
      });
    } catch (error) {
      // PostgreSQL was written first and remains authoritative. A bucket or
      // metadata failure must never lose a user's accepted upload.
      console.error('asset register upload mirror failed; PostgreSQL copy retained', {
        uploadId: id,
        error,
      });
    }
  }

  return {
    id,
    url: buildAssetRegisterUploadUrl(id),
    fileName,
    contentType,
    byteSize,
  };
}

export function buildAssetRegisterUploadUrl(uploadId: string): string {
  const normalizedUploadId = normalizeUploadId(uploadId);

  if (!normalizedUploadId) {
    return '';
  }

  if (normalizedUploadId.startsWith(ASSET_REGISTER_UPLOAD_ROUTE_PREFIX)) {
    return normalizedUploadId;
  }

  return `${ASSET_REGISTER_UPLOAD_ROUTE_PREFIX}${encodeURIComponent(normalizedUploadId)}`;
}

export function listInternalAssetRegisterUploadIds(uploads: string[]): string[] {
  const seen = new Set<string>();

  return uploads
    .map((upload) => String(upload ?? '').trim())
    .filter((upload) => upload.includes(ASSET_REGISTER_UPLOAD_ROUTE_PREFIX))
    .map((upload) => normalizeUploadId(upload))
    .filter(Boolean)
    .filter((upload) => {
      if (seen.has(upload)) {
        return false;
      }

      seen.add(upload);
      return true;
    });
}

export async function deleteUnreferencedAssetRegisterUploads(input: {
  userId: string;
  uploadIds: string[];
  excludeAssetId?: string | null;
}): Promise<void> {
  const uploadIds = listInternalAssetRegisterUploadIds(input.uploadIds);

  if (!uploadIds.length) {
    return;
  }

  const legacyUploadIds = uploadIds.filter((uploadId) => !BUCKET_ONLY_UPLOAD_ID_PATTERN.test(uploadId));
  const bucketOnlyUploadIds = uploadIds.filter((uploadId) => BUCKET_ONLY_UPLOAD_ID_PATTERN.test(uploadId));
  const captureCatalog = await getDb().query<{ has_capture_files: boolean }>(`
    select to_regclass('public.document_capture_files') is not null as has_capture_files
  `);
  const captureReferenceGuard = captureCatalog.rows[0]?.has_capture_files
    ? `and not exists (
        select 1
        from public.document_capture_files capture_file
        where capture_file.promoted_upload_id = upload.id::text
      )`
    : '';

  if (legacyUploadIds.length) {
    await ensureAssetRegisterUploadsTable();

    const mirroredCaptureCandidate = await getDb().query<{ exists: boolean }>(
      `select exists (
         select 1
         from public.asset_register_uploads upload
         where upload.user_id = $1
           and upload.id::text = any($2::text[])
           and upload.upload_category = any($3::text[])
           and coalesce(upload.storage_state, 'postgres') <> 'postgres'
       ) as exists`,
      [
        input.userId,
        legacyUploadIds,
        [
          'assisted-invoice-capture',
          'assisted-fuel-slip-capture',
          'dealer-assisted-invoice-capture',
        ],
      ],
    );

    // A verified/copying capture upload may have a private Bucket twin. Only
    // widen cleanup beyond PostgreSQL-only rows after migration 80's durable
    // exact-key purge queue and delete trigger have been proven ready.
    if (mirroredCaptureCandidate.rows[0]?.exists) {
      await assertObjectStorageSchemaReady();
    }

    await getDb().query(
      `
        delete from public.asset_register_uploads upload
        where upload.user_id = $1
          and upload.id::text = any($2::text[])
          and (
            coalesce(upload.storage_state, 'postgres') = 'postgres'
            or (
              upload.upload_category = any($5::text[])
              and upload.storage_state in ('copying', 'dual_verified', 'quarantined')
            )
          )
          and not exists (
            select 1
            from public.asset_register_items item
            where item.user_id = $1
              and ($3::text is null or item.id::text <> $3::text)
              and (
                coalesce(item.photos::text, '') like '%' || $4::text || upload.id::text || '%'
                or coalesce(item.documents::text, '') like '%' || $4::text || upload.id::text || '%'
              )
          )
          ${captureReferenceGuard}
      `,
      [
        input.userId,
        legacyUploadIds,
        input.excludeAssetId ?? null,
        ASSET_REGISTER_UPLOAD_ROUTE_PREFIX,
        [
          'assisted-invoice-capture',
          'assisted-fuel-slip-capture',
          'dealer-assisted-invoice-capture',
        ],
      ],
    );
  }

  if (bucketOnlyUploadIds.length) {
    // Deleting the catalog row invokes migration 81's guarded trigger. The
    // object itself remains recoverable until the delayed purge worker runs.
    await assertBucketOnlyCatalogReady();
    await getDb().query(
      `
        delete from public.asset_register_bucket_uploads upload
        where upload.user_id = $1
          and upload.id = any($2::text[])
          and not exists (
            select 1
            from public.asset_register_items item
            where item.user_id = $1
              and ($3::text is null or item.id::text <> $3::text)
              and (
                coalesce(item.photos::text, '') like '%' || $4::text || upload.id || '%'
                or coalesce(item.documents::text, '') like '%' || $4::text || upload.id || '%'
              )
          )
          ${captureReferenceGuard}
      `,
      [input.userId, bucketOnlyUploadIds, input.excludeAssetId ?? null, ASSET_REGISTER_UPLOAD_ROUTE_PREFIX],
    );
  }
}

export async function resolveBucketOnlyAssetRegisterDownload(
  uploadId: string,
): Promise<BucketOnlyUploadDownloadResult> {
  const normalizedUploadId = normalizeUploadId(uploadId);

  if (!BUCKET_ONLY_UPLOAD_ID_PATTERN.test(normalizedUploadId)) {
    return { status: 'not-found' };
  }

  try {
    await assertBucketOnlyCatalogReady();
  } catch (error) {
    console.error('Bucket-only upload read is unavailable because migration 81 is incomplete', {
      uploadId: normalizedUploadId,
      error,
    });
    return { status: 'unavailable' };
  }

  let row: BucketOnlyUploadRow | undefined;
  try {
    const result = await getDb().query<BucketOnlyUploadRow>(
      `
        select storage_state, object_key, content_type, file_name
        from public.asset_register_bucket_uploads
        where id = $1
        limit 1
      `,
      [normalizedUploadId],
    );
    row = result.rows[0];
  } catch (error) {
    console.error('Bucket-only upload metadata could not be read for download', {
      uploadId: normalizedUploadId,
      error,
    });
    return { status: 'unavailable' };
  }

  // Pending uploads were never accepted by the application. Deletion states
  // are hidden immediately even though their private object may remain in the
  // 30-day recovery queue.
  if (
    row?.storage_state !== 'ready'
    || !row.object_key
    || row.object_key !== createBucketOnlyUploadObjectKey(normalizedUploadId)
  ) {
    return { status: 'not-found' };
  }

  try {
    const fileName = sanitizeFileName(row.file_name ?? 'asset-register-upload');
    const url = await createBucketSignedGetUrl({
      objectKey: row.object_key,
      contentType: normalizeContentType(fileName, String(row.content_type ?? '')),
      fileName,
    });
    return { status: 'ready', url };
  } catch (error) {
    console.error('Bucket-only upload signed URL could not be created', {
      uploadId: normalizedUploadId,
      error,
    });
    return { status: 'unavailable' };
  }
}

async function resolveBucketOnlyAssetRegisterUploadBytes(
  normalizedUploadId: string,
): Promise<AssetRegisterUploadBytesResult> {
  try {
    await assertBucketOnlyCatalogReady();
  } catch (error) {
    console.error('Bucket-only upload byte read is unavailable because migration 81 is incomplete', {
      uploadId: normalizedUploadId,
      error,
    });
    return { status: 'unavailable' };
  }

  let row: BucketOnlyUploadRow | undefined;
  try {
    const result = await getDb().query<BucketOnlyUploadRow>(
      `
        select
          storage_state,
          object_key,
          byte_size,
          content_sha256,
          content_type,
          file_name
        from public.asset_register_bucket_uploads
        where id = $1
          and storage_state = 'ready'
        limit 1
      `,
      [normalizedUploadId],
    );
    row = result.rows[0];
  } catch (error) {
    console.error('Bucket-only upload metadata could not be read', {
      uploadId: normalizedUploadId,
      error,
    });
    return { status: 'unavailable' };
  }

  // Pending uploads were never accepted. Deletion states are hidden
  // immediately, even while their private object remains recoverable.
  if (!row || row.storage_state !== 'ready') {
    return { status: 'not-found' };
  }

  const expectedObjectKey = createBucketOnlyUploadObjectKey(normalizedUploadId);
  if (row.object_key !== expectedObjectKey) {
    console.error('Bucket-only upload metadata contains an unexpected object key', {
      uploadId: normalizedUploadId,
    });
    return { status: 'unavailable' };
  }

  const expectedByteSize = Number(row.byte_size);
  const expectedSha256 = String(row.content_sha256 ?? '').trim().toLowerCase();

  try {
    const data = await readVerifiedBucketUploadObjectBytes({
      objectKey: expectedObjectKey,
      expectedByteSize,
      expectedSha256,
    });
    const fileName = sanitizeFileName(row.file_name ?? 'asset-register-upload');
    const mimeType = normalizeContentType(fileName, String(row.content_type ?? ''));

    return {
      status: 'ready',
      upload: {
        data,
        mimeType,
        sizeBytes: data.length,
        fileName,
        disposition: contentDispositionForType(mimeType),
      },
    };
  } catch (error) {
    console.error('Bucket-only upload bytes could not be read and verified', {
      uploadId: normalizedUploadId,
      error,
    });
    return { status: 'unavailable' };
  }
}

export async function resolveAssetRegisterUploadBytes(
  uploadId: string,
): Promise<AssetRegisterUploadBytesResult> {
  const normalizedUploadId = normalizeUploadId(uploadId);

  if (!normalizedUploadId) {
    return { status: 'not-found' };
  }

  // The namespace boundary is deliberate: a Bucket-only id can never fall
  // through to PostgreSQL, including during a Bucket outage.
  if (normalizedUploadId.toLowerCase().startsWith(BUCKET_ONLY_UPLOAD_ID_PREFIX)) {
    return BUCKET_ONLY_UPLOAD_ID_PATTERN.test(normalizedUploadId)
      ? resolveBucketOnlyAssetRegisterUploadBytes(normalizedUploadId)
      : { status: 'not-found' };
  }

  try {
    const upload = await getLegacyAssetRegisterUploadResponse(normalizedUploadId);
    return upload ? { status: 'ready', upload } : { status: 'not-found' };
  } catch (error) {
    console.error('Legacy asset register upload bytes could not be read', {
      uploadId: normalizedUploadId,
      error,
    });
    return { status: 'unavailable' };
  }
}

export async function createAssetRegisterSignedGetUrl(uploadId: string): Promise<string | null> {
  if (getUploadStorageMode() !== 'bucket-preferred') {
    return null;
  }

  const normalizedUploadId = normalizeUploadId(uploadId);
  if (!normalizedUploadId || normalizedUploadId.toLowerCase().startsWith(BUCKET_ONLY_UPLOAD_ID_PREFIX)) return null;

  await ensureAssetRegisterUploadsTable();

  try {
    await assertObjectStorageSchemaReady();
  } catch (error) {
    console.error('asset register Bucket read disabled because migration 80 is incomplete', error);
    return null;
  }

  const result = await getDb().query<AssetRegisterUploadRow>(
    `
      select storage_state, object_key, content_type, file_name
      from public.asset_register_uploads
      where id::text = $1
        and storage_state = 'dual_verified'
        and object_key is not null
      limit 1
    `,
    [normalizedUploadId],
  );
  const row = result.rows[0];

  if (!row?.object_key) {
    return null;
  }

  try {
    const fileName = sanitizeFileName(row.file_name ?? 'asset-register-upload');
    return await createBucketSignedGetUrl({
      objectKey: row.object_key,
      contentType: normalizeContentType(fileName, String(row.content_type ?? '')),
      fileName,
    });
  } catch (error) {
    console.error('asset register signed bucket URL failed; using PostgreSQL fallback', {
      uploadId: normalizedUploadId,
      error,
    });
    return null;
  }
}

export async function getLegacyAssetRegisterUploadResponse(
  uploadId: string,
): Promise<LegacyAssetRegisterUploadResponse | null> {
  const normalizedUploadId = normalizeUploadId(uploadId);

  if (!normalizedUploadId || normalizedUploadId.toLowerCase().startsWith(BUCKET_ONLY_UPLOAD_ID_PREFIX)) {
    return null;
  }

  await ensureAssetRegisterUploadsTable();

  const result = await getDb().query<AssetRegisterUploadRow>(
    `
      select data, content_type, byte_size, file_name
      from public.asset_register_uploads
      where id::text = $1
      limit 1
    `,
    [normalizedUploadId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const data = normalizeDatabaseBuffer(row.data);

  if (!data.length) {
    return null;
  }

  const fileName = sanitizeFileName(row.file_name ?? 'asset-register-upload');
  const mimeType = normalizeContentType(fileName, String(row.content_type ?? ''));

  return {
    data,
    mimeType,
    sizeBytes: data.length,
    fileName,
    disposition: contentDispositionForType(mimeType),
  };
}
