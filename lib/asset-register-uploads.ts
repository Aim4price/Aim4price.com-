import { randomUUID } from 'node:crypto';
import { getDb } from './db';

export const MAX_ASSET_REGISTER_PHOTOS = 12;
export const MAX_ASSET_REGISTER_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_ASSET_REGISTER_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type AssetRegisterUpload = {
  id: string;
  userId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  createdAtIso: string;
  fileBytes?: Buffer;
};

type AssetRegisterUploadRow = {
  id: string;
  user_id: string;
  file_name: string;
  content_type: string;
  byte_size: string | number;
  file_bytes?: Buffer;
  created_at: string;
};

type ReferenceRow = {
  is_referenced: boolean;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeFileName(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'asset-image';
}

function mapRow(row: AssetRegisterUploadRow): AssetRegisterUpload {
  return {
    id: row.id,
    userId: row.user_id,
    fileName: row.file_name,
    contentType: row.content_type,
    byteSize: asNumber(row.byte_size),
    createdAtIso: row.created_at,
    fileBytes: row.file_bytes,
  };
}

export function buildAssetRegisterUploadUrl(uploadId: string): string {
  return `/api/asset-register/uploads/${encodeURIComponent(uploadId)}`;
}

export function extractAssetRegisterUploadId(value: string): string | null {
  const raw = asText(value);

  if (!raw) {
    return null;
  }

  const pattern = /^\/api\/asset-register\/uploads\/([^/?#]+)$/;

  try {
    const url =
      raw.startsWith('http://') || raw.startsWith('https://')
        ? new URL(raw)
        : new URL(raw, 'http://localhost');
    const match = url.pathname.match(pattern);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    const match = raw.match(pattern);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

export function listInternalAssetRegisterUploadIds(photos: string[]): string[] {
  const seen = new Set<string>();

  return photos
    .map((photo) => extractAssetRegisterUploadId(photo))
    .filter((uploadId): uploadId is string => Boolean(uploadId))
    .filter((uploadId) => {
      if (seen.has(uploadId)) {
        return false;
      }

      seen.add(uploadId);
      return true;
    });
}

export async function createAssetRegisterUpload(input: {
  userId: string;
  file: File;
}): Promise<AssetRegisterUpload> {
  const uploadId = randomUUID();
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const contentType = asText(input.file.type).toLowerCase();
  const fileName = sanitizeFileName(asText(input.file.name) || `${uploadId}.bin`);
  const db = getDb();

  const result = await db.query<AssetRegisterUploadRow>(
    `
      insert into asset_register_uploads (
        id,
        user_id,
        file_name,
        content_type,
        byte_size,
        file_bytes,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6, now())
      returning id, user_id, file_name, content_type, byte_size, file_bytes, created_at
    `,
    [uploadId, input.userId, fileName, contentType, buffer.byteLength, buffer],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error('UPLOAD_CREATE_FAILED');
  }

  return mapRow(row);
}

export async function getAssetRegisterUploadById(uploadId: string): Promise<AssetRegisterUpload | null> {
  const db = getDb();
  const result = await db.query<AssetRegisterUploadRow>(
    `
      select
        id,
        user_id,
        file_name,
        content_type,
        byte_size,
        file_bytes,
        created_at
      from asset_register_uploads
      where id = $1
      limit 1
    `,
    [uploadId],
  );

  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export async function deleteAssetRegisterUploadsByIds(userId: string, uploadIds: string[]): Promise<void> {
  const ids = Array.from(new Set(uploadIds.map((value) => asText(value)).filter(Boolean)));

  if (!ids.length) {
    return;
  }

  const db = getDb();
  await db.query(
    `
      delete from asset_register_uploads
      where user_id = $1 and id = any($2::text[])
    `,
    [userId, ids],
  );
}

async function isUploadReferencedByAnyOtherAsset(input: {
  userId: string;
  uploadUrl: string;
  excludeAssetId?: number | null;
}): Promise<boolean> {
  const db = getDb();
  const result = await db.query<ReferenceRow>(
    `
      select exists(
        select 1
        from asset_register_items
        where user_id = $1
          and ($2::bigint is null or id <> $2)
          and photos ? $3
      ) as is_referenced
    `,
    [input.userId, input.excludeAssetId ?? null, input.uploadUrl],
  );

  return Boolean(result.rows[0]?.is_referenced);
}

export async function deleteUnreferencedAssetRegisterUploads(input: {
  userId: string;
  uploadIds: string[];
  excludeAssetId?: number | null;
}): Promise<void> {
  const ids = Array.from(new Set(input.uploadIds.map((value) => asText(value)).filter(Boolean)));

  if (!ids.length) {
    return;
  }

  const removableIds: string[] = [];

  for (const uploadId of ids) {
    const uploadUrl = buildAssetRegisterUploadUrl(uploadId);
    const isReferenced = await isUploadReferencedByAnyOtherAsset({
      userId: input.userId,
      uploadUrl,
      excludeAssetId: input.excludeAssetId ?? null,
    });

    if (!isReferenced) {
      removableIds.push(uploadId);
    }
  }

  await deleteAssetRegisterUploadsByIds(input.userId, removableIds);
}
