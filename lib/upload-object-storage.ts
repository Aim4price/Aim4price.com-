import { createHash } from 'node:crypto';

export type UploadStorageMode = 'postgres' | 'mirror' | 'bucket-preferred' | 'bucket-only-new';

type BucketConfig = {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export type StoredBucketUpload = {
  objectKey: string;
  etag: string | null;
  contentSha256: string;
  verifiedAt: Date;
};

type MirroredUpload = StoredBucketUpload;

type S3Sdk = typeof import('@aws-sdk/client-s3');

let s3Client: import('@aws-sdk/client-s3').S3Client | null = null;
let s3SdkPromise: Promise<S3Sdk> | null = null;
let cachedConfigKey = '';

const BUCKET_ONLY_UPLOAD_ID_PATTERN = /^bkt-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BUCKET_ONLY_OBJECT_KEY_PATTERN = /^v2\/asset-register\/[0-9a-f]{2}\/bkt-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_BUCKET_ONLY_OBJECT_READ_BYTES = 25 * 1024 * 1024;

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

  if (mode === 'mirror' || mode === 'bucket-preferred' || mode === 'bucket-only-new') {
    return mode;
  }

  return 'postgres';
}

export function isBucketWriteCostApproved(): boolean {
  return process.env.AIM4PRICE_ALLOW_BUCKET_WRITES === 'YES_I_ACCEPT_COST';
}

export function isBucketOnlyNewApproved(): boolean {
  return process.env.AIM4PRICE_ALLOW_BUCKET_ONLY === 'YES_I_ACCEPT_NO_POSTGRES_COPY';
}

export function createUploadObjectKey(uploadId: string): string {
  const id = String(uploadId ?? '').trim().toLowerCase();

  if (!/^[a-z0-9-]{20,80}$/.test(id)) {
    throw new Error('Cannot create an object key for an invalid upload id.');
  }

  return `v1/asset-register/${id.slice(0, 2)}/${id}`;
}

export function createBucketOnlyUploadObjectKey(uploadId: string): string {
  const id = String(uploadId ?? '').trim().toLowerCase();

  if (!BUCKET_ONLY_UPLOAD_ID_PATTERN.test(id)) {
    throw new Error('Cannot create a Bucket-only object key for an invalid upload id.');
  }

  const uuidPrefix = id.slice(4, 6);
  return `v2/asset-register/${uuidPrefix}/${id}`;
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
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 60_000);

  try {
    const response = await client.send(new sdk.GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    }), { abortSignal: abortController.signal });
    const body = response.Body;

    if (!body) {
      throw new Error('Railway Bucket returned an empty verification response.');
    }

    // Keep the abort timer active while the response stream is consumed, not
    // merely until its headers arrive.
    return await body.transformToByteArray();
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadObjectBytesWithinLimit(input: {
  objectKey: string;
  maximumBytes: number;
}): Promise<Buffer> {
  const { client, config, sdk } = await getBucketClient();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 60_000);

  try {
    const response = await client.send(new sdk.GetObjectCommand({
      Bucket: config.bucket,
      Key: input.objectKey,
      // Read at most the expected byte count plus one. The extra byte makes a
      // larger-than-catalogued object fail closed without downloading it all.
      Range: `bytes=0-${input.maximumBytes - 1}`,
    }), { abortSignal: abortController.signal });
    const body = response.Body;

    if (!body) {
      throw new Error('Railway Bucket returned an empty object response.');
    }

    if (
      typeof response.ContentLength === 'number'
      && response.ContentLength > input.maximumBytes
    ) {
      throw new Error('Railway Bucket object exceeds its verified size limit.');
    }

    const stream = body as unknown as AsyncIterable<Uint8Array | string>;
    if (typeof stream[Symbol.asyncIterator] !== 'function') {
      throw new Error('Railway Bucket returned an unsupported object stream.');
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of stream) {
      const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
      totalBytes += bytes.length;

      if (totalBytes > input.maximumBytes) {
        abortController.abort();
        throw new Error('Railway Bucket object exceeds its verified size limit.');
      }

      chunks.push(bytes);
    }

    return Buffer.concat(chunks, totalBytes);
  } finally {
    clearTimeout(timeout);
  }
}

async function putAndVerifyUpload(input: {
  objectKey: string;
  data: Buffer;
  contentType: string;
  mismatchMessage: string;
}): Promise<StoredBucketUpload> {
  const contentSha256 = sha256Hex(input.data);
  const { client, config, sdk } = await getBucketClient();
  let etag: string | null = null;
  let ambiguousPutError: unknown = null;

  try {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 60_000);

    try {
      const response = await client.send(new sdk.PutObjectCommand({
        Bucket: config.bucket,
        Key: input.objectKey,
        Body: input.data,
        ContentLength: input.data.length,
        ContentType: input.contentType || 'application/octet-stream',
        IfNoneMatch: '*',
        Metadata: {
          'aim4price-sha256': contentSha256,
        },
      }), { abortSignal: abortController.signal });
      etag = response.ETag ? String(response.ETag).replace(/^"|"$/g, '') : null;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    const isExistingObject = candidate?.name === 'PreconditionFailed'
      || candidate?.$metadata?.httpStatusCode === 412;
    if (!isExistingObject) ambiguousPutError = error;
  }

  // A conditional PUT may have succeeded before the caller observed a network
  // error, and a pre-existing object is not trusted merely because its key
  // matches. Always read the bytes back and verify the exact content.
  let downloaded: Uint8Array;
  try {
    downloaded = await downloadObjectBytes(input.objectKey);
  } catch (error) {
    throw ambiguousPutError ?? error;
  }
  const downloadedSha256 = sha256Hex(downloaded);

  if (downloaded.length !== input.data.length || downloadedSha256 !== contentSha256) {
    throw new Error(input.mismatchMessage);
  }

  return {
    objectKey: input.objectKey,
    etag,
    contentSha256,
    verifiedAt: new Date(),
  };
}

export async function mirrorUploadToBucket(input: {
  uploadId: string;
  data: Buffer;
  contentType: string;
}): Promise<MirroredUpload> {
  return putAndVerifyUpload({
    objectKey: createUploadObjectKey(input.uploadId),
    data: input.data,
    contentType: input.contentType,
    mismatchMessage: 'Railway Bucket verification failed: the copied object does not match PostgreSQL.',
  });
}

export async function storeBucketOnlyUpload(input: {
  uploadId: string;
  data: Buffer;
  contentType: string;
}): Promise<StoredBucketUpload> {
  if (getUploadStorageMode() !== 'bucket-only-new') {
    throw new Error('Bucket-only upload storage is not enabled.');
  }

  if (!isBucketWriteCostApproved()) {
    throw new Error('Bucket writes require explicit cost approval.');
  }

  if (!isBucketOnlyNewApproved()) {
    throw new Error('Bucket-only writes require explicit no-PostgreSQL-copy approval.');
  }

  return putAndVerifyUpload({
    objectKey: createBucketOnlyUploadObjectKey(input.uploadId),
    data: input.data,
    contentType: input.contentType,
    mismatchMessage: 'Railway Bucket verification failed: the stored Bucket-only upload does not match the accepted bytes.',
  });
}

export async function readVerifiedBucketUploadObjectBytes(input: {
  objectKey: string;
  expectedByteSize: number;
  expectedSha256: string;
}): Promise<Buffer> {
  const objectKey = String(input.objectKey ?? '');
  const expectedSha256 = String(input.expectedSha256 ?? '').trim().toLowerCase();

  if (!BUCKET_ONLY_OBJECT_KEY_PATTERN.test(objectKey)) {
    throw new Error('Refusing to read an object with an invalid Bucket-only key.');
  }

  if (
    !Number.isSafeInteger(input.expectedByteSize)
    || input.expectedByteSize <= 0
    || input.expectedByteSize > MAX_BUCKET_ONLY_OBJECT_READ_BYTES
  ) {
    throw new Error('Refusing to read a Bucket-only object with an invalid verified size.');
  }

  if (!/^[0-9a-f]{64}$/.test(expectedSha256)) {
    throw new Error('Refusing to read a Bucket-only object without a valid verified hash.');
  }

  const data = await downloadObjectBytesWithinLimit({
    objectKey,
    maximumBytes: input.expectedByteSize + 1,
  });

  if (
    data.length !== input.expectedByteSize
    || sha256Hex(data) !== expectedSha256
  ) {
    throw new Error('Railway Bucket read verification failed for the requested upload.');
  }

  return data;
}

export async function deleteBucketUploadObject(input: {
  objectKey: string;
}): Promise<void> {
  const objectKey = String(input.objectKey ?? '');

  if (!BUCKET_ONLY_OBJECT_KEY_PATTERN.test(objectKey)) {
    throw new Error('Refusing to delete an object with an invalid Bucket-only key.');
  }

  const { client, config, sdk } = await getBucketClient();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 30_000);

  // S3 DeleteObject is idempotent: deleting an already-missing exact key is a
  // successful no-op. The caller supplies the key stored in server metadata;
  // this function never reconstructs it from user-controlled fields.
  try {
    await client.send(new sdk.DeleteObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    }), { abortSignal: abortController.signal });
  } finally {
    clearTimeout(timeout);
  }
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
