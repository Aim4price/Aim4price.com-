#!/usr/bin/env node

import pg from 'pg';

const { Pool } = pg;
const apply = process.argv.includes('--apply');
const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='));
const limit = Math.min(100, Math.max(1, Number(limitArgument?.split('=')[1] ?? 25) || 25));
const purgeApproved = process.env.AIM4PRICE_ALLOW_BUCKET_PURGE
  === 'YES_I_REVIEWED_30_DAY_QUEUE';
const bucketWritesApproved = process.env.AIM4PRICE_ALLOW_BUCKET_WRITES
  === 'YES_I_ACCEPT_COST';

const SAFE_UPLOAD_ID_PATTERN = /^bkt-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SAFE_OBJECT_KEY_PATTERN = /^v2\/asset-register\/[0-9a-f]{2}\/bkt-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function firstValue(...values) {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }

  return '';
}

function createPool() {
  const hasParts = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE']
    .every((key) => Boolean(process.env[key]));

  if (hasParts) {
    return new Pool({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: false,
      connectionTimeoutMillis: 10_000,
      max: 1,
    });
  }

  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false,
      connectionTimeoutMillis: 10_000,
      max: 1,
    });
  }

  throw new Error('Database connection variables are missing.');
}

function readBucketConfig() {
  const config = {
    bucket: firstValue(
      process.env.AIM4PRICE_BUCKET_NAME,
      process.env.AWS_S3_BUCKET_NAME,
      process.env.BUCKET,
    ),
    endpoint: firstValue(
      process.env.AIM4PRICE_BUCKET_ENDPOINT,
      process.env.AWS_ENDPOINT_URL,
      process.env.ENDPOINT,
    ),
    region: firstValue(
      process.env.AIM4PRICE_BUCKET_REGION,
      process.env.AWS_DEFAULT_REGION,
      process.env.REGION,
      'auto',
    ),
    accessKeyId: firstValue(
      process.env.AIM4PRICE_BUCKET_ACCESS_KEY_ID,
      process.env.AWS_ACCESS_KEY_ID,
      process.env.ACCESS_KEY_ID,
    ),
    secretAccessKey: firstValue(
      process.env.AIM4PRICE_BUCKET_SECRET_ACCESS_KEY,
      process.env.AWS_SECRET_ACCESS_KEY,
      process.env.SECRET_ACCESS_KEY,
    ),
  };
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Bucket configuration is missing: ${missing.join(', ')}`);
  }

  const parsedEndpoint = new URL(config.endpoint);
  if (parsedEndpoint.protocol !== 'https:' || parsedEndpoint.username || parsedEndpoint.password) {
    throw new Error('Bucket endpoint must be an HTTPS URL without embedded credentials.');
  }

  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucket)) {
    throw new Error('Bucket name is invalid.');
  }

  return {
    ...config,
    forcePathStyle:
      String(process.env.AWS_S3_URL_STYLE ?? '').toLowerCase() === 'path'
      || String(process.env.AWS_S3_FORCE_PATH_STYLE ?? '').toLowerCase() === 'true',
  };
}

async function createBucketClient() {
  const config = readBucketConfig();
  const sdk = await import('@aws-sdk/client-s3');
  const client = new sdk.S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return { client, config, sdk };
}

function isSafeObjectIdentity(uploadIdValue, objectKeyValue) {
  const uploadId = String(uploadIdValue ?? '');
  const objectKey = String(objectKeyValue ?? '');

  return SAFE_UPLOAD_ID_PATTERN.test(uploadId)
    && SAFE_OBJECT_KEY_PATTERN.test(objectKey)
    && objectKey === `v2/asset-register/${uploadId.slice(4, 6)}/${uploadId}`;
}

function sanitizedBucketError(error) {
  const candidate = error && typeof error === 'object' ? error : {};
  const safeName = String(candidate.name ?? 'BucketDeleteError')
    .replace(/[^0-9A-Za-z_.-]+/g, '')
    .slice(0, 80) || 'BucketDeleteError';
  const rawStatus = Number(candidate.$metadata?.httpStatusCode);
  const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599
    ? ` (HTTP ${rawStatus})`
    : '';

  // Do not persist SDK messages, URLs, credentials, request headers or stack
  // traces. The error class and HTTP status are sufficient for this audit row.
  return `Bucket object deletion failed: ${safeName}${status}`.slice(0, 500);
}

async function deleteExactObject(bucket, objectKey) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 30_000);

  try {
    await bucket.client.send(
      new bucket.sdk.DeleteObjectCommand({
        Bucket: bucket.config.bucket,
        Key: objectKey,
      }),
      { abortSignal: abortController.signal },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function readDueSummary(pool) {
  const result = await pool.query(`
    select
      count(*)::bigint as due_count,
      coalesce(sum(byte_size), 0)::bigint as due_bytes
    from public.asset_register_bucket_upload_purge_queue
    where purged_at is null
      and purge_after <= now()
  `);

  return {
    dueCount: Number(result.rows[0]?.due_count ?? 0),
    dueBytes: Number(result.rows[0]?.due_bytes ?? 0),
  };
}

async function listDueUploadIds(pool) {
  const result = await pool.query(
    `
      select upload_id
      from public.asset_register_bucket_upload_purge_queue
      where purged_at is null
        and purge_after <= now()
      order by purge_after asc, queued_at asc, upload_id asc
      limit $1
    `,
    [limit],
  );

  return result.rows.map((row) => String(row.upload_id ?? ''));
}

async function setQueueError(client, uploadId, message) {
  await client.query(
    `
      update public.asset_register_bucket_upload_purge_queue
      set last_error = $2
      where upload_id = $1
        and purged_at is null
    `,
    [uploadId, String(message).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 500)],
  );
}

async function purgeOne(pool, bucket, candidateUploadId) {
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query('begin');
    transactionOpen = true;
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '2min'");

    // Catalog writers take a ROW EXCLUSIVE lock. Freeze them before locking a
    // queue row, and hold this lock through DeleteObject, so a matching live
    // metadata row cannot be recreated between the final check and deletion.
    await client.query(
      'lock table public.asset_register_bucket_uploads in share row exclusive mode',
    );

    const selected = await client.query(
      `
        select upload_id, object_key
        from public.asset_register_bucket_upload_purge_queue
        where upload_id = $1
          and purged_at is null
          and purge_after <= now()
        for update
      `,
      [candidateUploadId],
    );
    const row = selected.rows[0];

    if (!row) {
      await client.query('rollback');
      transactionOpen = false;
      return { status: 'stale', uploadId: candidateUploadId };
    }

    const uploadId = String(row.upload_id ?? '');
    const objectKey = String(row.object_key ?? '');

    if (!isSafeObjectIdentity(uploadId, objectKey)) {
      await setQueueError(
        client,
        uploadId,
        'Purge blocked: queue identity failed strict bkt UUID/v2 object-key validation.',
      );
      await client.query('commit');
      transactionOpen = false;
      return { status: 'held', uploadId };
    }

    const live = await client.query(
      `
        select 1
        from public.asset_register_bucket_uploads
        where id = $1
           or object_key = $2
        limit 1
      `,
      [uploadId, objectKey],
    );

    if (live.rowCount) {
      await setQueueError(
        client,
        uploadId,
        'Purge blocked: matching live Bucket upload metadata exists.',
      );
      await client.query('commit');
      transactionOpen = false;
      return { status: 'held', uploadId };
    }

    try {
      // DeleteObject is idempotent. An already-missing exact key is success.
      await deleteExactObject(bucket, objectKey);
    } catch (error) {
      await setQueueError(client, uploadId, sanitizedBucketError(error));
      await client.query('commit');
      transactionOpen = false;
      return { status: 'failed', uploadId };
    }

    const marked = await client.query(
      `
        update public.asset_register_bucket_upload_purge_queue
        set purged_at = now(),
            last_error = null
        where upload_id = $1
          and purged_at is null
          and purge_after <= now()
        returning upload_id
      `,
      [uploadId],
    );

    if (marked.rowCount !== 1) {
      throw new Error('The purge audit row changed before it could be marked complete.');
    }

    await client.query('commit');
    transactionOpen = false;
    return { status: 'purged', uploadId };
  } catch (error) {
    if (transactionOpen) await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

const pool = createPool();

try {
  const summary = await readDueSummary(pool);

  console.log(JSON.stringify({
    mode: apply ? 'APPLY' : 'DRY_RUN',
    dueObjects: summary.dueCount,
    dueBytes: summary.dueBytes,
    batchLimit: limit,
    purgeApproved,
    bucketWritesApproved,
    note: apply
      ? 'Only reviewed Bucket-only queue rows past the 30-day deadline can be purged.'
      : 'No S3 module/client was loaded and no database mutation was made.',
  }, null, 2));

  if (!apply) {
    // Deliberately stop before Bucket configuration, dynamic AWS import, or
    // every database-mutation helper below.
  } else {
    if (!purgeApproved) {
      throw new Error(
        'Apply requires AIM4PRICE_ALLOW_BUCKET_PURGE=YES_I_REVIEWED_30_DAY_QUEUE.',
      );
    }
    if (!bucketWritesApproved) {
      throw new Error(
        'Apply requires AIM4PRICE_ALLOW_BUCKET_WRITES=YES_I_ACCEPT_COST.',
      );
    }

    const candidates = await listDueUploadIds(pool);
    const bucket = candidates.length ? await createBucketClient() : null;
    const results = { purged: 0, held: 0, failed: 0, stale: 0 };

    for (const uploadId of candidates) {
      const result = await purgeOne(pool, bucket, uploadId);
      results[result.status] += 1;
      if (result.status === 'purged') console.log(`purged ${result.uploadId}`);
    }

    console.log(JSON.stringify(results, null, 2));
    if (results.failed > 0) process.exitCode = 1;
  }
} finally {
  await pool.end();
}
