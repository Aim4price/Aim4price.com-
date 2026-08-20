import { createHash, randomUUID } from 'node:crypto';
import type { PublicInvoiceMimeType } from './public-invoice-drop-security';
import { getDb } from './db';

type BucketConfig = {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

type S3Sdk = typeof import('@aws-sdk/client-s3');

const CAPTURE_KEY_PATTERN = /^v1\/capture-quarantine\/[0-9a-f]{2}\/20\d{2}\/(?:0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_CAPTURE_OBJECT_BYTES = 12 * 1024 * 1024;
const UNATTACHED_CAPTURE_GRACE_MS = 60 * 60 * 1000;

let captureS3Client: import('@aws-sdk/client-s3').S3Client | null = null;
let captureS3SdkPromise: Promise<S3Sdk> | null = null;
let cachedCaptureConfigKey = '';

function firstEnvironmentValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function readCaptureBucketConfig(): BucketConfig {
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
  const forcePathStyle = firstEnvironmentValue(process.env.AWS_S3_FORCE_PATH_STYLE).toLowerCase() === 'true'
    || firstEnvironmentValue(process.env.AWS_S3_URL_STYLE).toLowerCase() === 'path';

  const missing = [
    ['bucket name', bucket],
    ['endpoint', endpoint],
    ['access key id', accessKeyId],
    ['secret access key', secretAccessKey],
  ].filter(([, value]) => !value).map(([label]) => label);

  if (missing.length) {
    throw new Error(`Capture quarantine storage is not configured: ${missing.join(', ')} is missing.`);
  }

  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    throw new Error('Capture quarantine storage endpoint is invalid.');
  }

  if (parsedEndpoint.protocol !== 'https:' || parsedEndpoint.username || parsedEndpoint.password) {
    throw new Error('Capture quarantine storage requires an HTTPS endpoint without embedded credentials.');
  }

  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error('Capture quarantine bucket name is invalid.');
  }

  return { bucket, endpoint, region, accessKeyId, secretAccessKey, forcePathStyle };
}

async function getCaptureBucketClient(): Promise<{
  client: import('@aws-sdk/client-s3').S3Client;
  config: BucketConfig;
  sdk: S3Sdk;
}> {
  const config = readCaptureBucketConfig();
  const configKey = JSON.stringify(config);
  const sdk = await (captureS3SdkPromise ??= import('@aws-sdk/client-s3'));

  if (!captureS3Client || cachedCaptureConfigKey !== configKey) {
    captureS3Client = new sdk.S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    cachedCaptureConfigKey = configKey;
  }

  return { client: captureS3Client, config, sdk };
}

export function createCaptureQuarantineStorageKey(now = new Date()): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const id = randomUUID();
  return `v1/capture-quarantine/${id.slice(0, 2)}/${year}/${month}/${id}`;
}

function validateStorageKey(storageKey: string): string {
  const normalized = String(storageKey || '').trim().toLowerCase();
  if (!CAPTURE_KEY_PATTERN.test(normalized)) {
    throw new Error('Refusing an invalid capture quarantine object key.');
  }
  return normalized;
}

export async function queueCaptureQuarantineFileForPurge(input: {
  storageKey: string;
  purgeAfter?: Date;
  reason: string;
}): Promise<void> {
  const storageKey = validateStorageKey(input.storageKey);
  const purgeAfter = input.purgeAfter instanceof Date && Number.isFinite(input.purgeAfter.getTime())
    ? input.purgeAfter
    : new Date();
  const reason = String(input.reason || 'capture_lifecycle')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, '_')
    .trim()
    .slice(0, 80) || 'capture_lifecycle';

  await getDb().query(
    `select public.queue_capture_quarantine_object($1, $2::timestamptz, $3)`,
    [storageKey, purgeAfter.toISOString(), reason],
  );
}

async function markCaptureQuarantineFilePurged(storageKey: string): Promise<void> {
  await getDb().query(
    `update public.capture_quarantine_object_purge_queue
        set purged_at = now(),
            cancelled_at = null,
            last_error = null
      where storage_key = $1
        and purged_at is null`,
    [storageKey],
  );
}

async function readObjectWithinLimit(input: {
  storageKey: string;
  maximumBytes: number;
}): Promise<Buffer> {
  const storageKey = validateStorageKey(input.storageKey);
  const { client, config, sdk } = await getCaptureBucketClient();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 60_000);

  try {
    const response = await client.send(new sdk.GetObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      Range: `bytes=0-${input.maximumBytes - 1}`,
    }), { abortSignal: abortController.signal });
    const body = response.Body as unknown as AsyncIterable<Uint8Array | string> | undefined;

    if (!body || typeof body[Symbol.asyncIterator] !== 'function') {
      throw new Error('Capture quarantine returned an unsupported object response.');
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of body) {
      const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
      totalBytes += bytes.length;
      if (totalBytes > input.maximumBytes) {
        abortController.abort();
        throw new Error('Capture quarantine object exceeds its verified size.');
      }
      chunks.push(bytes);
    }

    return Buffer.concat(chunks, totalBytes);
  } finally {
    clearTimeout(timeout);
  }
}

export async function storeCaptureQuarantineFile(input: {
  data: Buffer;
  contentType: PublicInvoiceMimeType;
}): Promise<{ storageKey: string; sha256: string; byteSize: number }> {
  if (process.env.AIM4PRICE_ALLOW_CAPTURE_QUARANTINE_WRITES !== 'YES_I_ACCEPT_PUBLIC_CAPTURE_STORAGE') {
    throw new Error('Capture quarantine writes have not been explicitly enabled.');
  }

  if (!input.data.length || input.data.length > MAX_CAPTURE_OBJECT_BYTES) {
    throw new Error('Capture quarantine file size is invalid.');
  }

  const storageKey = createCaptureQuarantineStorageKey();
  const sha256 = createHash('sha256').update(input.data).digest('hex');
  const { client, config, sdk } = await getCaptureBucketClient();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 60_000);
  let putError: unknown = null;

  try {
    await client.send(new sdk.PutObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      Body: input.data,
      ContentLength: input.data.length,
      ContentType: input.contentType,
      IfNoneMatch: '*',
      Metadata: {
        'aim4price-sha256': sha256,
        'aim4price-security-status': 'pending',
      },
    }), { abortSignal: abortController.signal });
  } catch (error) {
    // The remote PUT may have completed even if the response was interrupted.
    // Verification below decides whether the exact object is safe to retain.
    putError = error;
  } finally {
    clearTimeout(timeout);
  }

  const putCandidate = putError as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  if (
    putCandidate?.name === 'PreconditionFailed'
    || putCandidate?.$metadata?.httpStatusCode === 412
  ) {
    // Never inspect or delete an object that the conditional PUT confirms was
    // already present. The submission can safely retry with a fresh key.
    throw putError;
  }

  try {
    const verifiedBytes = await readObjectWithinLimit({
      storageKey,
      maximumBytes: input.data.length + 1,
    });

    if (
      verifiedBytes.length !== input.data.length
      || createHash('sha256').update(verifiedBytes).digest('hex') !== sha256
    ) {
      throw new Error('Capture quarantine verification failed after upload.');
    }
  } catch (error) {
    try {
      await client.send(new sdk.DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }));
    } catch (cleanupError) {
      console.error('capture quarantine verification cleanup failed', cleanupError);
    }
    throw putError ?? error;
  }

  try {
    // The object exists before its capture request/file row can be committed.
    // Keep a durable, delayed cleanup intent until the file-link trigger in
    // migration 84 cancels it. A crashed request therefore cannot strand a
    // private quarantine object indefinitely.
    await queueCaptureQuarantineFileForPurge({
      storageKey,
      purgeAfter: new Date(Date.now() + UNATTACHED_CAPTURE_GRACE_MS),
      reason: 'unattached_upload',
    });
  } catch (queueError) {
    try {
      await client.send(new sdk.DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }));
    } catch (cleanupError) {
      console.error('capture quarantine queue failure cleanup failed', cleanupError);
    }
    throw queueError;
  }

  return { storageKey, sha256, byteSize: input.data.length };
}

export async function readCaptureQuarantineFile(input: {
  storageKey: string;
  expectedByteSize: number;
  expectedSha256: string;
}): Promise<Buffer> {
  if (
    !Number.isSafeInteger(input.expectedByteSize)
    || input.expectedByteSize <= 0
    || input.expectedByteSize > MAX_CAPTURE_OBJECT_BYTES
  ) {
    throw new Error('Capture quarantine file has an invalid verified size.');
  }

  const expectedSha256 = String(input.expectedSha256 || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expectedSha256)) {
    throw new Error('Capture quarantine file has an invalid verified hash.');
  }

  const data = await readObjectWithinLimit({
    storageKey: input.storageKey,
    maximumBytes: input.expectedByteSize + 1,
  });

  if (
    data.length !== input.expectedByteSize
    || createHash('sha256').update(data).digest('hex') !== expectedSha256
  ) {
    throw new Error('Capture quarantine file verification failed.');
  }

  return data;
}

export async function createCaptureQuarantineSignedGetUrl(input: {
  storageKey: string;
  contentType: PublicInvoiceMimeType;
  fileName: string;
}): Promise<string> {
  const storageKey = validateStorageKey(input.storageKey);
  const fileName = String(input.fileName || 'invoice')
    .replace(/[\\/\0\r\n";]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150) || 'invoice';
  const { client, config, sdk } = await getCaptureBucketClient();
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

  return getSignedUrl(
    client,
    new sdk.GetObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      ResponseContentType: input.contentType,
      ResponseContentDisposition: `inline; filename="${fileName}"`,
    }),
    { expiresIn: 60 },
  );
}

export async function deleteCaptureQuarantineFile(storageKey: string): Promise<void> {
  const validatedKey = validateStorageKey(storageKey);
  const { client, config, sdk } = await getCaptureBucketClient();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 30_000);

  try {
    try {
      await client.send(new sdk.DeleteObjectCommand({
        Bucket: config.bucket,
        Key: validatedKey,
      }), { abortSignal: abortController.signal });
    } catch (error) {
      // DeleteObject is best-effort here, but loss of the cleanup intent is
      // not. Persist the exact validated key so a bounded worker can retry.
      await queueCaptureQuarantineFileForPurge({
        storageKey: validatedKey,
        reason: 'direct_delete_failed',
      });
      return;
    }

    // A stale queue row is harmless because DeleteObject is idempotent, but
    // marking success avoids an unnecessary later Bucket request.
    await markCaptureQuarantineFilePurged(validatedKey).catch((error) => {
      console.error('capture quarantine purge acknowledgement failed', error);
    });
  } finally {
    clearTimeout(timeout);
  }
}
