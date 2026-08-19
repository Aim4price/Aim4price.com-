import { createHash } from 'node:crypto';

export type UploadStorageMode = 'postgres' | 'mirror' | 'bucket-preferred';

type BucketConfig = {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

type MirroredUpload = {
  objectKey: string;
  etag: string | null;
  contentSha256: string;
  verifiedAt: Date;
};

type S3Sdk = typeof import('@aws-sdk/client-s3');

let s3Client: import('@aws-sdk/client-s3').S3Client | null = null;
let s3SdkPromise: Promise<S3Sdk> | null = null;
let cachedConfigKey = '';

function firstEnvironmentValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }

  return '';
}

export function getUploadStorageMode(): UploadStorageMode {
  const mode = String(process.env.AIM4PRICE_UPLOAD_STORAGE_MODE ?? 'postgres')
    .trim()
    .toLowerCase();

  if (mode === 'mirror' || mode === 'bucket-preferred') {
    return mode;
  }

  return 'postgres';
}

export function isBucketWriteCostApproved(): boolean {
  return process.env.AIM4PRICE_ALLOW_BUCKET_WRITES === 'YES_I_ACCEPT_COST';
}

export function createUploadObjectKey(uploadId: string): string {
  const id = String(uploadId ?? '').trim().toLowerCase();

  if (!/^[a-z0-9-]{20,80}$/.test(id)) {
    throw new Error('Cannot create an object key for an invalid upload id.');
  }

  return `v1/asset-register/${id.slice(0, 2)}/${id}`;
}

export function sha256Hex(value: Buffer | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function readBucketConfig(): BucketConfig {
  const bucket = firstEnvironmentValue(
    process.env.AIM4PRICE_BUCKET_NAME,
    process.env.AWS_S3_BUCKET_NAME,
    process.env.BUCKET,
  );
  const endpoint = firstEnvironmentValue(
    process.env.AIM4PRICE_BUCKET_ENDPOINT,
    process.env.AWS_ENDPOINT_URL,
    process.env.ENDPOINT,
  );
  const region = firstEnvironmentValue(
    process.env.AIM4PRICE_BUCKET_REGION,
    process.env.AWS_DEFAULT_REGION,
    process.env.REGION,
    'auto',
  );
  const accessKeyId = firstEnvironmentValue(
    process.env.AIM4PRICE_BUCKET_ACCESS_KEY_ID,
    process.env.AWS_ACCESS_KEY_ID,
    process.env.ACCESS_KEY_ID,
  );
  const secretAccessKey = firstEnvironmentValue(
    process.env.AIM4PRICE_BUCKET_SECRET_ACCESS_KEY,
    process.env.AWS_SECRET_ACCESS_KEY,
    process.env.SECRET_ACCESS_KEY,
  );
  const urlStyle = firstEnvironmentValue(process.env.AWS_S3_URL_STYLE).toLowerCase();
  const pathStyle = firstEnvironmentValue(process.env.AWS_S3_FORCE_PATH_STYLE).toLowerCase();

  const missing = [
    ['bucket name', bucket],
    ['endpoint', endpoint],
    ['access key id', accessKeyId],
    ['secret access key', secretAccessKey],
  ].filter(([, value]) => !value).map(([label]) => label);

  if (missing.length) {
    throw new Error(`Railway Bucket storage is enabled but ${missing.join(', ')} is missing.`);
  }

  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    throw new Error('Railway Bucket endpoint is not a valid URL.');
  }

  if (parsedEndpoint.protocol !== 'https:' || parsedEndpoint.username || parsedEndpoint.password) {
    throw new Error('Railway Bucket endpoint must be an HTTPS URL without embedded credentials.');
  }

  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error('Railway Bucket name is invalid.');
  }

  return {
    bucket,
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: urlStyle === 'path' || pathStyle === 'true',
  };
}

async function getBucketClient(): Promise<{
  client: import('@aws-sdk/client-s3').S3Client;
  config: BucketConfig;
  sdk: S3Sdk;
}> {
  const config = readBucketConfig();
  const configKey = JSON.stringify(config);
  const sdk = await (s3SdkPromise ??= import('@aws-sdk/client-s3'));

  if (!s3Client || configKey !== cachedConfigKey) {
    s3Client = new sdk.S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    cachedConfigKey = configKey;
  }

  return { client: s3Client, config, sdk };
}

async function downloadObjectBytes(objectKey: string): Promise<Uint8Array> {
  const { client, config, sdk } = await getBucketClient();
  const response = await client.send(new sdk.GetObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
  }));
  const body = response.Body;

  if (!body) {
    throw new Error('Railway Bucket returned an empty verification response.');
  }

  return body.transformToByteArray();
}

export async function mirrorUploadToBucket(input: {
  uploadId: string;
  data: Buffer;
  contentType: string;
}): Promise<MirroredUpload> {
  const objectKey = createUploadObjectKey(input.uploadId);
  const contentSha256 = sha256Hex(input.data);
  const { client, config, sdk } = await getBucketClient();
  let etag: string | null = null;

  try {
    const response = await client.send(new sdk.PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: input.data,
      ContentLength: input.data.length,
      ContentType: input.contentType || 'application/octet-stream',
      IfNoneMatch: '*',
      Metadata: {
        'aim4price-sha256': contentSha256,
      },
    }));
    etag = response.ETag ? String(response.ETag).replace(/^"|"$/g, '') : null;
  } catch (error) {
    const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    const isExistingObject = candidate?.name === 'PreconditionFailed'
      || candidate?.$metadata?.httpStatusCode === 412;
    if (!isExistingObject) throw error;
  }

  // A successful PUT is not enough for migration safety. Read the object back
  // and verify the exact bytes before marking the database row as mirrored.
  const downloaded = await downloadObjectBytes(objectKey);
  const downloadedSha256 = sha256Hex(downloaded);

  if (downloaded.length !== input.data.length || downloadedSha256 !== contentSha256) {
    throw new Error('Railway Bucket verification failed: the copied object does not match PostgreSQL.');
  }

  return {
    objectKey,
    etag,
    contentSha256,
    verifiedAt: new Date(),
  };
}

export async function createBucketSignedGetUrl(input: {
  objectKey: string;
  contentType: string;
  fileName: string;
}): Promise<string> {
  const { client, config, sdk } = await getBucketClient();
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  const safeFileName = String(input.fileName || 'asset-register-upload')
    .replace(/[\\/\0\r\n";]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'asset-register-upload';
  const normalizedContentType = String(input.contentType || 'application/octet-stream').toLowerCase();
  const disposition = normalizedContentType.startsWith('image/') || normalizedContentType === 'application/pdf'
    ? 'inline'
    : 'attachment';

  return getSignedUrl(
    client,
    new sdk.GetObjectCommand({
      Bucket: config.bucket,
      Key: input.objectKey,
      ResponseContentType: normalizedContentType,
      ResponseContentDisposition: `${disposition}; filename="${safeFileName}"`,
    }),
    { expiresIn: 60 },
  );
}
