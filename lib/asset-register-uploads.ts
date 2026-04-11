import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getDb } from './db';

export const MAX_ASSET_REGISTER_UPLOADS = 12;
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

type LegacyAssetRegisterUploadRow = {
  id: string;
  user_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: string | number;
  data: Buffer | Uint8Array | string;
  created_at: string;
};

type LegacyAssetRegisterUpload = {
  id: string;
  userId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
  createdAtIso: string;
};

declare global {
  // eslint-disable-next-line no-var
  var aim4priceAssetRegisterS3Client: S3Client | undefined;
}

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

  if (typeof value !== 'string') {
    return Buffer.from(value);
  }

  return Buffer.from(String(value ?? ''), 'binary');
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

  return Boolean(config.bucket && config.endpoint && config.region && config.accessKeyId && config.secretAccessKey);
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
    throw new Error(
      'Asset object storage bucket is missing. Add ASSET_STORAGE_S3_BUCKET to the app service.',
    );
  }

  return bucket;
}

export function extractAssetRegisterUploadIdFromUrl(value: string): string | null {
  const match = String(value ?? '')
    .trim()
    .match(/\/api\/asset-register\/uploads\/([a-zA-Z0-9-]+)$/);

  return match?.[1] ?? null;
}

export async function saveAssetRegisterUploads(
  userId: string,
  uploads: AssetRegisterUploadInput[],
): Promise<string[]> {
  if (!uploads.length) {
    return [];
  }

  const client = getAssetRegisterS3Client();
  const bucket = getAssetRegisterBucketName();
  const urls: string[] = [];

  for (const upload of uploads.slice(0, MAX_ASSET_REGISTER_UPLOADS)) {
    const uploadId = randomUUID();
    const objectKey = buildAssetRegisterObjectKey(uploadId);
    const safeFileName = sanitizeFileName(upload.fileName);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: upload.data,
        ContentType: upload.mimeType,
        ContentDisposition: `inline; filename="${safeFileName}"`,
        CacheControl: 'public, max-age=31536000, immutable',
        Metadata: {
          userId: userId.slice(0, 128),
          originalFileName: safeFileName.slice(0, 240),
        },
      }),
    );

    urls.push(`/api/asset-register/uploads/${uploadId}`);
  }

  return urls;
}

export async function createAssetRegisterSignedGetUrl(uploadId: string): Promise<string | null> {
  if (!uploadId || !hasAssetRegisterObjectStorageConfig()) {
    return null;
  }

  const client = getAssetRegisterS3Client();
  const bucket = getAssetRegisterBucketName();
  const objectKey = buildAssetRegisterObjectKey(uploadId);

  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
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

function mapLegacyUploadRow(row: LegacyAssetRegisterUploadRow): LegacyAssetRegisterUpload {
  return {
    id: row.id,
    userId: row.user_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: asNumber(row.size_bytes),
    data: asBuffer(row.data),
    createdAtIso: row.created_at,
  };
}

async function getLegacyAssetRegisterUploadById(uploadId: string): Promise<LegacyAssetRegisterUpload | null> {
  const db = getDb();

  try {
    const result = await db.query<LegacyAssetRegisterUploadRow>(
      `
        select
          id,
          user_id,
          file_name,
          mime_type,
          size_bytes,
          data,
          created_at
        from asset_register_uploads
        where id = $1
        limit 1
      `,
      [uploadId],
    );

    const row = result.rows[0];
    return row ? mapLegacyUploadRow(row) : null;
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '42P01') {
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
    if (typeof error === 'object' && error && 'code' in error && error.code === '42P01') {
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
    data: legacyUpload.data,
    mimeType: legacyUpload.mimeType,
    sizeBytes: legacyUpload.sizeBytes,
    fileName: legacyUpload.fileName,
  };
}

export async function deleteUnusedAssetRegisterUploads(
  userId: string,
  photoUrls: string[],
  excludeAssetId?: number,
): Promise<void> {
  const uploadIds = Array.from(
    new Set(
      photoUrls
        .map((photoUrl) => extractAssetRegisterUploadIdFromUrl(photoUrl))
        .filter((value): value is string => Boolean(value)),
    ),
  );

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
      [userId, excludeAssetId ?? null, `/api/asset-register/uploads/${uploadId}`],
    );

    if (usage.rowCount) {
      continue;
    }

    await deleteAssetRegisterObject(uploadId);
    await deleteLegacyAssetRegisterUploadById(userId, uploadId);
  }
}
