import { randomUUID } from 'node:crypto';
import { getDb } from './db';

export const MAX_ASSET_REGISTER_PHOTOS = 12;
export const MAX_ASSET_REGISTER_DOCUMENTS = 20;
export const MAX_ASSET_REGISTER_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES = 12 * 1024 * 1024;
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

type CreateAssetRegisterUploadInput = {
  userId: string;
  file: File;
};

type CreatedAssetRegisterUpload = {
  id: string;
  url: string;
  fileName: string;
  contentType: string;
  byteSize: number;
};

type LegacyAssetRegisterUploadResponse = {
  data: Buffer;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
};

type AssetRegisterUploadRow = {
  data: Buffer | Uint8Array | string;
  content_type: string | null;
  byte_size: string | number | null;
  file_name: string | null;
};

let ensureAssetRegisterUploadsTablePromise: Promise<void> | null = null;

function sanitizeFileName(value: string): string {
  const cleaned = String(value ?? '')
    .replace(/[\\/\0\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (cleaned || 'asset-register-upload').slice(0, 180);
}

function normalizeUploadId(value: string): string {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) {
    return '';
  }

  const withoutRoute = rawValue.includes(ASSET_REGISTER_UPLOAD_ROUTE_PREFIX)
    ? rawValue.split(ASSET_REGISTER_UPLOAD_ROUTE_PREFIX).pop() ?? rawValue
    : rawValue;
  const withoutQuery = withoutRoute.split('?')[0] ?? withoutRoute;

  try {
    return decodeURIComponent(withoutQuery).trim();
  } catch {
    return withoutQuery.trim();
  }
}

function normalizeContentType(fileName: string, value: string): string {
  const explicitType = String(value ?? '').trim().toLowerCase();

  if (explicitType) {
    return explicitType;
  }

  return CONTENT_TYPE_BY_EXTENSION.get(getFileExtension(fileName)) ?? 'application/octet-stream';
}

function normalizeDatabaseBuffer(value: Buffer | Uint8Array | string): Buffer {
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

async function ensureAssetRegisterUploadsTable(): Promise<void> {
  if (!ensureAssetRegisterUploadsTablePromise) {
    ensureAssetRegisterUploadsTablePromise = getDb()
      .query(`
        create table if not exists public.asset_register_uploads (
          id text primary key,
          user_id text not null,
          file_name text not null,
          content_type text not null,
          byte_size integer not null,
          data bytea not null,
          created_at timestamptz not null default now()
        );

        create index if not exists asset_register_uploads_user_id_created_at_idx
          on public.asset_register_uploads (user_id, created_at desc);
      `)
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

export async function createAssetRegisterUpload(
  input: CreateAssetRegisterUploadInput,
): Promise<CreatedAssetRegisterUpload> {
  await ensureAssetRegisterUploadsTable();

  const id = randomUUID();
  const fileName = sanitizeFileName(input.file.name);
  const contentType = normalizeContentType(fileName, input.file.type);
  const byteSize = Number(input.file.size) || 0;
  const buffer = Buffer.from(await input.file.arrayBuffer());

  await getDb().query(
    `
      insert into public.asset_register_uploads (
        id,
        user_id,
        file_name,
        content_type,
        byte_size,
        data
      ) values ($1, $2, $3, $4, $5, $6)
    `,
    [id, input.userId, fileName, contentType, byteSize, buffer],
  );

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

  await ensureAssetRegisterUploadsTable();

  await getDb().query(
    `
      delete from public.asset_register_uploads upload
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
    `,
    [input.userId, uploadIds, input.excludeAssetId ?? null, ASSET_REGISTER_UPLOAD_ROUTE_PREFIX],
  );
}

export async function createAssetRegisterSignedGetUrl(_uploadId: string): Promise<string | null> {
  return null;
}

export async function getLegacyAssetRegisterUploadResponse(
  uploadId: string,
): Promise<LegacyAssetRegisterUploadResponse | null> {
  const normalizedUploadId = normalizeUploadId(uploadId);

  if (!normalizedUploadId) {
    return null;
  }

  await ensureAssetRegisterUploadsTable();

  const result = await getDb().query<AssetRegisterUploadRow>(
    `
      select data, content_type, byte_size, file_name
      from public.asset_register_uploads
      where id = $1
      limit 1
    `,
    [normalizedUploadId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const data = normalizeDatabaseBuffer(row.data);

  return {
    data,
    mimeType: String(row.content_type ?? '').trim() || 'application/octet-stream',
    sizeBytes: Math.max(0, Math.round(Number(row.byte_size) || data.length)),
    fileName: sanitizeFileName(row.file_name ?? 'asset-register-upload'),
  };
}
