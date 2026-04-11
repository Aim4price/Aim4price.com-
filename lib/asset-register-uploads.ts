import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getDb } from './db';

export const MAX_ASSET_REGISTER_PHOTOS = 12;
export const MAX_ASSET_REGISTER_UPLOADS = MAX_ASSET_REGISTER_PHOTOS;
export const MAX_ASSET_REGISTER_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_ASSET_REGISTER_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const ASSET_REGISTER_OBJECT_PREFIX = 'asset-register';
const ASSET_REGISTER_SIGNED_GET_SECONDS = 60 * 10;

export type AssetRegisterUploadInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
};

export type AssetRegisterUpload = {
  id: string;
  userId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  createdAtIso: string;
};

type NormalizedLegacyUploadRow = {
  id: string;
  user_id: string;
  file_name: string;
  content_type: string;
  byte_size: string | number;
  file_bytes: Buffer | Uint8Array | string;
  created_at: string;
};

declare global {
  // eslint-disable-next-line no-var
  var aim4priceAssetRegisterS3Client: S3Client | undefined;
}

let hasEnsuredLegacyAssetRegisterUploadsTable = false;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asBuffer(value: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  return Buffer.from(String(value ?? ''), 'binary');
}

function isPgErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function parseBoolean(value: string, fallback = false): boolean {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function firstDefined(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = asText(value);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function sanitizeFileName(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'asset-photo';
}

function buildAssetRegisterObjectKey(uploadId: string): string {
  return `${ASSET_REGISTER_OBJECT_PREFIX}/${uploadId}`;
}

function getAssetRegisterStorageConfig() {
  const bucket = firstDefined(
    process.env.ASSET_STORAGE_S3_BUCKET,
    process.env.BUCKET,
    process.env.S3_BUCKET,
  );

  const endpoint = firstDefined(
    process.env.ASSET_STORAGE_S3_ENDPOINT,
    process.env.ENDPOINT,
    process.env.S3_ENDPOINT,
    process.env.AWS_ENDPOINT_URL_S3,
  );

  const region = firstDefined(
    process.env.ASSET_STORAGE_S3_REGION,
    process.env.REGION,
    process.env.AWS_REGION,
    process.env.AWS_DEFAULT_REGION,
    'auto',
  );

  const accessKeyId = firstDefined(
    process.env.ASSET_STORAGE_S3_ACCESS_KEY_ID,
    process.env.ACCESS_KEY_ID,
    process.env.AWS_ACCESS_KEY_ID,
  );

  const secretAccessKey = firstDefined(
    process.env.ASSET_STORAGE_S3_SECRET_ACCESS_KEY,
    process.env.SECRET_ACCESS_KEY,
    process.env.AWS_SECRET_ACCESS_KEY,
  );

  const forcePathStyle = parseBoolean(
    firstDefined(
      process.env.ASSET_STORAGE_S3_FORCE_PATH_STYLE,
      process.env.S3_FORCE_PATH_STYLE,
    ),
    false,
  );

  return {
    bucket,
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
  };
}

export function hasAssetRegisterObjectStorageConfig(): boolean {
  const config = getAssetRegisterStorageConfig();

  return Boolean(
    config.bucket &&
      config.endpoint &&
      config.region &&
      config.accessKeyId &&
      config.secretAccessKey,
  );
}

function getAssetRegisterS3Client(): S3Client {
  if (global.aim4priceAssetRegisterS3Client) {
    return global.aim4priceAssetRegisterS3Client;
  }

  const config = getAssetRegisterStorageConfig();

  if (!hasAssetRegisterObjectStorageConfig()) {
    throw new Error(
      'Asset object storage variables are missing. Add ASSET_STORAGE_S3_BUCKET, ASSET_STORAGE_S3_ENDPOINT, ASSET_STORAGE_S3_REGION, ASSET_STORAGE_S3_ACCESS_KEY_ID and ASSET_STORAGE_S3_SECRET_ACCESS_KEY to the app service.',
    );
  }

  global.aim4priceAssetRegisterS3Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return global.aim4priceAssetRegisterS3Client;
}

function getAssetRegisterBucketName(): string {
  const { bucket } = getAssetRegisterStorageConfig();

  if (!bucket) {
    throw new Error('Asset object storage bucket is missing. Add ASSET_STORAGE_S3_BUCKET to the app service.');
  }

  return bucket;
}

async function ensureLegacyAssetRegisterUploadsTable(): Promise<void> {
  if (hasEnsuredLegacyAssetRegisterUploadsTable) {
    return;
  }

  const db = getDb();

  await db.query(`
    create table if not exists asset_register_uploads (
      id text primary key,
      user_id text not null,
      file_name text not null,
      mime_type text not null,
      size_bytes integer not null,
      data bytea not null,
      created_at timestamptz not null default now()
    )
  `);

  await db.query(`
    create index if not exists asset_register_uploads_user_id_created_at_idx
      on asset_register_uploads (user_id, created_at desc)
  `);

  hasEnsuredLegacyAssetRegisterUploadsTable = true;
}

function mapLegacyRowToUpload(row: NormalizedLegacyUploadRow): AssetRegisterUpload {
  return {
    id: row.id,
    userId: row.user_id,
    fileName: row.file_name,
    contentType: row.content_type,
    byteSize: asNumber(row.byte_size),
    createdAtIso: row.created_at,
  };
}

export function buildAssetRegisterUploadUrl(uploadId: string): string {
  return `/api/asset-register/uploads/${encodeURIComponent(uploadId)}`;
}

export function extractAssetRegisterUploadIdFromUrl(value: string): string | null {
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
    .map((photo) => extractAssetRegisterUploadIdFromUrl(photo))
    .filter((uploadId): uploadId is string => Boolean(uploadId))
    .filter((uploadId) => {
      if (seen.has(uploadId)) {
        return false;
      }

      seen.add(uploadId);
      return true;
    });
}

async function insertLegacyAssetRegisterUpload(input: {
  id: string;
  userId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  fileBytes: Buffer;
}): Promise<void> {
  await ensureLegacyAssetRegisterUploadsTable();

  const db = getDb();

  try {
    await db.query(
      `
        insert into asset_register_uploads (
          id,
          user_id,
          file_name,
          mime_type,
          size_bytes,
          data
        )
        values ($1, $2, $3, $4, $5, $6)
      `,
      [input.id, input.userId, input.fileName, input.contentType, input.byteSize, input.fileBytes],
    );
    return;
  } catch (error) {
    if (!isPgErrorCode(error, '42703')) {
      throw error;
    }
  }

  await db.query(
    `
      insert into asset_register_uploads (
        id,
        user_id,
        file_name,
        content_type,
        byte_size,
        file_bytes
      )
      values ($1, $2, $3, $4, $5, $6)
    `,
    [input.id, input.userId, input.fileName, input.contentType, input.byteSize, input.fileBytes],
  );
}

async function createAssetRegisterUploadFromBuffer(input: {
  userId: string;
  fileName: string;
  contentType: string;
  fileBytes: Buffer;
}): Promise<AssetRegisterUpload> {
  const id = randomUUID();
  const safeFileName = sanitizeFileName(input.fileName || `${id}.bin`);
  const byteSize = input.fileBytes.byteLength;

  if (hasAssetRegisterObjectStorageConfig()) {
    const client = getAssetRegisterS3Client();
    const bucket = getAssetRegisterBucketName();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: buildAssetRegisterObjectKey(id),
        Body: input.fileBytes,
        ContentType: input.contentType,
        ContentDisposition: `inline; filename="${safeFileName}"`,
        CacheControl: 'public, max-age=31536000, immutable',
        Metadata: {
          userId: input.userId.slice(0, 128),
          originalFileName: safeFileName.slice(0, 240),
        },
      }),
    );

    return {
      id,
      userId: input.userId,
      fileName: safeFileName,
      contentType: input.contentType,
      byteSize,
      createdAtIso: new Date().toISOString(),
    };
  }

  await insertLegacyAssetRegisterUpload({
    id,
    userId: input.userId,
    fileName: safeFileName,
    contentType: input.contentType,
    byteSize,
    fileBytes: input.fileBytes,
  });

  return {
    id,
    userId: input.userId,
    fileName: safeFileName,
    contentType: input.contentType,
    byteSize,
    createdAtIso: new Date().toISOString(),
  };
}

export async function createAssetRegisterUpload(input: {
  userId: string;
  file: File;
}): Promise<AssetRegisterUpload> {
  const contentType = asText(input.file.type).toLowerCase();
  const fileName = asText(input.file.name) || 'asset-photo';
  const fileBytes = Buffer.from(await input.file.arrayBuffer());

  return createAssetRegisterUploadFromBuffer({
    userId: input.userId,
    fileName,
    contentType,
    fileBytes,
  });
}

export async function saveAssetRegisterUploads(
  userId: string,
  uploads: AssetRegisterUploadInput[],
): Promise<string[]> {
  if (!uploads.length) {
    return [];
  }

  const urls: string[] = [];

  for (const upload of uploads.slice(0, MAX_ASSET_REGISTER_UPLOADS)) {
    const saved = await createAssetRegisterUploadFromBuffer({
      userId,
      fileName: upload.fileName,
      contentType: upload.mimeType,
      fileBytes: upload.data,
    });

    urls.push(buildAssetRegisterUploadUrl(saved.id));
  }

  return urls;
}

export async function createAssetRegisterSignedGetUrl(uploadId: string): Promise<string | null> {
  if (!uploadId || !hasAssetRegisterObjectStorageConfig()) {
    return null;
  }

  const client = getAssetRegisterS3Client();
  const bucket = getAssetRegisterBucketName();

  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: buildAssetRegisterObjectKey(uploadId),
      }),
      { expiresIn: ASSET_REGISTER_SIGNED_GET_SECONDS },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'NoSuchKey') {
      return null;
    }

    throw error;
  }
}

async function deleteAssetRegisterObject(uploadId: string): Promise<void> {
  if (!uploadId || !hasAssetRegisterObjectStorageConfig()) {
    return;
  }

  const client = getAssetRegisterS3Client();
  const bucket = getAssetRegisterBucketName();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: buildAssetRegisterObjectKey(uploadId),
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'NoSuchKey') {
      return;
    }

    throw error;
  }
}

async function getLegacyAssetRegisterUploadById(uploadId: string): Promise<NormalizedLegacyUploadRow | null> {
  const db = getDb();

  try {
    const result = await db.query<NormalizedLegacyUploadRow>(
      `
        select
          id,
          user_id,
          file_name,
          mime_type as content_type,
          size_bytes as byte_size,
          data as file_bytes,
          created_at
        from asset_register_uploads
        where id = $1
        limit 1
      `,
      [uploadId],
    );

    return result.rows[0] ?? null;
  } catch (error) {
    if (isPgErrorCode(error, '42P01')) {
      return null;
    }

    if (!isPgErrorCode(error, '42703')) {
      throw error;
    }
  }

  const dbFallback = getDb();

  try {
    const result = await dbFallback.query<NormalizedLegacyUploadRow>(
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

    return result.rows[0] ?? null;
  } catch (error) {
    if (isPgErrorCode(error, '42P01')) {
      return null;
    }

    throw error;
  }
}

async function deleteLegacyAssetRegisterUploadById(userId: string, uploadId: string): Promise<void> {
  const db = getDb();

  try {
    await db.query(
      `
        delete from asset_register_uploads
        where id = $1 and user_id = $2
      `,
      [uploadId, userId],
    );
  } catch (error) {
    if (isPgErrorCode(error, '42P01')) {
      return;
    }

    throw error;
  }
}

export async function getLegacyAssetRegisterUploadResponse(uploadId: string): Promise<{
  data: Buffer;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
} | null> {
  const legacyUpload = await getLegacyAssetRegisterUploadById(uploadId);

  if (!legacyUpload) {
    return null;
  }

  return {
    data: asBuffer(legacyUpload.file_bytes),
    mimeType: legacyUpload.content_type,
    sizeBytes: asNumber(legacyUpload.byte_size),
    fileName: legacyUpload.file_name,
  };
}

export async function deleteUnusedAssetRegisterUploads(
  userId: string,
  photoUrls: string[],
  excludeAssetId?: number,
): Promise<void> {
  const uploadIds = listInternalAssetRegisterUploadIds(photoUrls);

  if (!uploadIds.length) {
    return;
  }

  const db = getDb();

  for (const uploadId of uploadIds) {
    const usage = await db.query<{ id: string }>(
      `
        select id
        from asset_register_items
        where user_id = $1
          and ($2::integer is null or id <> $2)
          and photos ? $3
        limit 1
      `,
      [userId, excludeAssetId ?? null, buildAssetRegisterUploadUrl(uploadId)],
    );

    if (usage.rowCount) {
      continue;
    }

    await deleteAssetRegisterObject(uploadId);
    await deleteLegacyAssetRegisterUploadById(userId, uploadId);
  }
}

export async function deleteUnreferencedAssetRegisterUploads(input: {
  userId: string;
  uploadIds: string[];
  excludeAssetId?: number | null;
}): Promise<void> {
  if (!input.uploadIds.length) {
    return;
  }

  await deleteUnusedAssetRegisterUploads(
    input.userId,
    input.uploadIds.map((uploadId) => buildAssetRegisterUploadUrl(uploadId)),
    input.excludeAssetId ?? undefined,
  );
}

export async function getAssetRegisterUploadById(uploadId: string): Promise<AssetRegisterUpload | null> {
  const legacyUpload = await getLegacyAssetRegisterUploadById(uploadId);
  return legacyUpload ? mapLegacyRowToUpload(legacyUpload) : null;
}
