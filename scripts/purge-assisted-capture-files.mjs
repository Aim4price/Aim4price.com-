#!/usr/bin/env node

import pg from 'pg';

const { Pool } = pg;
const apply = process.argv.includes('--apply');
const requestedBatch = Number(process.env.AIM4PRICE_CAPTURE_PURGE_BATCH ?? 25);
const batchSize = Math.min(100, Math.max(1, Number.isFinite(requestedBatch) ? Math.floor(requestedBatch) : 25));
const CAPTURE_UPLOAD_CATEGORIES = [
  'assisted-invoice-capture',
  'assisted-fuel-slip-capture',
  'dealer-assisted-invoice-capture',
];
const QUARANTINE_KEY_PATTERN = /^v1\/capture-quarantine\/[0-9a-f]{2}\/20\d{2}\/(?:0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LEGACY_UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BUCKET_UPLOAD_ID_PATTERN = /^bkt-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function firstEnvironmentValue(...values) {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function createPool() {
  const hasParts = process.env.PGHOST
    && process.env.PGPORT
    && process.env.PGUSER
    && process.env.PGPASSWORD
    && process.env.PGDATABASE;
  if (hasParts) {
    return new Pool({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: false,
      connectionTimeoutMillis: 10_000,
    });
  }
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false,
      connectionTimeoutMillis: 10_000,
    });
  }
  throw new Error('Database connection variables are missing.');
}

function readBucketConfig() {
  const config = {
    bucket: firstEnvironmentValue(
      process.env.AIM4PRICE_BUCKET_NAME,
      process.env.AWS_S3_BUCKET_NAME,
      process.env.BUCKET,
    ),
    endpoint: firstEnvironmentValue(
      process.env.AIM4PRICE_BUCKET_ENDPOINT,
      process.env.AWS_ENDPOINT_URL,
      process.env.ENDPOINT,
    ),
    region: firstEnvironmentValue(
      process.env.AIM4PRICE_BUCKET_REGION,
      process.env.AWS_DEFAULT_REGION,
      process.env.REGION,
      'auto',
    ),
    accessKeyId: firstEnvironmentValue(
      process.env.AIM4PRICE_BUCKET_ACCESS_KEY_ID,
      process.env.AWS_ACCESS_KEY_ID,
      process.env.ACCESS_KEY_ID,
    ),
    secretAccessKey: firstEnvironmentValue(
      process.env.AIM4PRICE_BUCKET_SECRET_ACCESS_KEY,
      process.env.AWS_SECRET_ACCESS_KEY,
      process.env.SECRET_ACCESS_KEY,
    ),
    forcePathStyle: firstEnvironmentValue(process.env.AWS_S3_FORCE_PATH_STYLE).toLowerCase() === 'true'
      || firstEnvironmentValue(process.env.AWS_S3_URL_STYLE).toLowerCase() === 'path',
  };
  const endpoint = new URL(config.endpoint);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) {
    throw new Error('Bucket endpoint must be an HTTPS URL without embedded credentials.');
  }
  if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) {
    throw new Error('Bucket purge configuration is incomplete.');
  }
  return config;
}

async function createBucketClient() {
  const sdk = await import('@aws-sdk/client-s3');
  const config = readBucketConfig();
  return {
    sdk,
    config,
    client: new sdk.S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
  };
}

function sanitizedPurgeError(error) {
  // Do not persist SDK messages, URLs, credentials, request headers or stack
  // traces. The error class and HTTP status are enough for operations.
  const candidate = error && typeof error === 'object' ? error : {};
  const name = String(candidate.name ?? 'Error').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 60) || 'Error';
  const status = Number(candidate.$metadata?.httpStatusCode);
  return Number.isInteger(status) ? `${name} (HTTP ${status})` : name;
}

async function readDueSummary(pool) {
  const result = await pool.query(`
    select
      (select count(*)::bigint
         from public.capture_quarantine_object_purge_queue
        where purged_at is null and cancelled_at is null and purge_after <= now()) as quarantine_due,
      (select count(*)::bigint
         from public.capture_asset_upload_cleanup_queue
        where cleaned_at is null and cancelled_at is null and cleanup_after <= now()) as uploads_due
  `);
  return result.rows[0] ?? { quarantine_due: 0, uploads_due: 0 };
}

async function listDueUploadIds(pool) {
  const result = await pool.query(
    `select upload_id
       from public.capture_asset_upload_cleanup_queue
      where cleaned_at is null
        and cancelled_at is null
        and cleanup_after <= now()
      order by cleanup_after asc, queued_at asc, upload_id asc
      limit $1`,
    [batchSize],
  );
  return result.rows.map((row) => String(row.upload_id));
}

async function listDueQuarantineKeys(pool) {
  const result = await pool.query(
    `select storage_key
       from public.capture_quarantine_object_purge_queue
      where purged_at is null
        and cancelled_at is null
        and purge_after <= now()
      order by purge_after asc, queued_at asc, storage_key asc
      limit $1`,
    [batchSize],
  );
  return result.rows.map((row) => String(row.storage_key));
}

async function recordUploadFailure(pool, uploadId, error) {
  await pool.query(
    `update public.capture_asset_upload_cleanup_queue
        set attempt_count = attempt_count + 1,
            last_error = $2
      where upload_id = $1
        and cleaned_at is null`,
    [uploadId, sanitizedPurgeError(error)],
  );
}

async function recordQuarantineFailure(pool, storageKey, error) {
  await pool.query(
    `update public.capture_quarantine_object_purge_queue
        set attempt_count = attempt_count + 1,
            last_error = $2
      where storage_key = $1
        and purged_at is null`,
    [storageKey, sanitizedPurgeError(error)],
  );
}

async function cleanOneCaptureUpload(pool, uploadId) {
  if (!LEGACY_UPLOAD_ID_PATTERN.test(uploadId) && !BUCKET_UPLOAD_ID_PATTERN.test(uploadId)) {
    await recordUploadFailure(pool, uploadId, new Error('InvalidUploadId'));
    return 'failed';
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local lock_timeout = '5s'`);
    await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [`capture-upload:${uploadId}`]);
    const queued = await client.query(
      `select upload_id, owner_user_id
         from public.capture_asset_upload_cleanup_queue
        where upload_id = $1
          and cleaned_at is null
          and cancelled_at is null
          and cleanup_after <= now()
        for update`,
      [uploadId],
    );
    const row = queued.rows[0];
    if (!row) {
      await client.query('commit');
      return 'skipped';
    }

    const referenced = await client.query(
      `select
         exists (
           select 1
           from public.document_capture_files file
           join public.document_capture_requests request on request.id = file.capture_request_id
           where file.promoted_upload_id = $1
             and request.status not in ('declined', 'rejected', 'cancelled')
         )
         or exists (select 1 from public.asset_invoice_documents where upload_id = $1)
         or exists (select 1 from public.fuel_slips where upload_id = $1)
         or exists (select 1 from public.account_documents where upload_id = $1)
         or exists (
           select 1
           from public.asset_register_items item
           where item.user_id = $2
             and (
               coalesce(item.photos::text, '') like '%' || $1 || '%'
               or coalesce(item.documents::text, '') like '%' || $1 || '%'
             )
         ) as referenced`,
      [uploadId, row.owner_user_id],
    );
    if (referenced.rows[0]?.referenced) {
      await client.query(
        `update public.capture_asset_upload_cleanup_queue
            set cancelled_at = now(), last_error = null
          where upload_id = $1`,
        [uploadId],
      );
      await client.query('commit');
      return 'retained';
    }

    const legacy = await client.query(
      `select id::text as id, user_id, upload_category
         from public.asset_register_uploads
        where id::text = $1
        for update`,
      [uploadId],
    );
    const bucket = await client.query(
      `select id, user_id, upload_category
         from public.asset_register_bucket_uploads
        where id = $1
        for update`,
      [uploadId],
    );
    const catalogRows = [...legacy.rows, ...bucket.rows];
    if (catalogRows.length > 1) throw new Error('CaptureUploadCatalogConflict');
    const catalog = catalogRows[0];
    if (catalog && (
      catalog.user_id !== row.owner_user_id
      || !CAPTURE_UPLOAD_CATEGORIES.includes(String(catalog.upload_category))
    )) {
      throw new Error('CaptureUploadIdentityConflict');
    }

    if (catalog) {
      const table = BUCKET_UPLOAD_ID_PATTERN.test(uploadId)
        ? 'public.asset_register_bucket_uploads'
        : 'public.asset_register_uploads';
      await client.query(
        `delete from ${table}
          where id::text = $1
            and user_id = $2
            and upload_category = any($3::text[])`,
        [uploadId, row.owner_user_id, CAPTURE_UPLOAD_CATEGORIES],
      );
    }

    await client.query(
      `update public.capture_asset_upload_cleanup_queue
          set cleaned_at = now(), cancelled_at = null, last_error = null
        where upload_id = $1`,
      [uploadId],
    );
    await client.query('commit');
    return 'cleaned';
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    await recordUploadFailure(pool, uploadId, error);
    return 'failed';
  } finally {
    client.release();
  }
}

async function deleteExactQuarantineObject(bucket, storageKey) {
  if (!QUARANTINE_KEY_PATTERN.test(storageKey)) {
    throw new Error('InvalidQuarantineKey');
  }
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 30_000);
  try {
    // DeleteObject is exact and idempotent. The key comes only from the
    // validated server-side queue, never from a file name or request field.
    await bucket.client.send(new bucket.sdk.DeleteObjectCommand({
      Bucket: bucket.config.bucket,
      Key: storageKey,
    }), { abortSignal: abortController.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function purgeOneQuarantineObject(pool, bucket, storageKey) {
  if (!QUARANTINE_KEY_PATTERN.test(storageKey)) {
    await recordQuarantineFailure(pool, storageKey, new Error('InvalidQuarantineKey'));
    return 'failed';
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local lock_timeout = '5s'`);
    await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [`capture-quarantine:${storageKey}`]);
    const queued = await client.query(
      `select storage_key
         from public.capture_quarantine_object_purge_queue
        where storage_key = $1
          and purged_at is null
          and cancelled_at is null
          and purge_after <= now()
        for update`,
      [storageKey],
    );
    if (!queued.rows[0]) {
      await client.query('commit');
      return 'skipped';
    }

    const live = await client.query(
      `select exists (
         select 1
         from public.document_capture_files file
         join public.document_capture_requests request on request.id = file.capture_request_id
         where file.storage_key = $1
           and file.promoted_upload_id is null
           and request.status not in ('declined', 'rejected', 'cancelled')
       ) as live`,
      [storageKey],
    );
    if (live.rows[0]?.live) {
      await client.query(
        `update public.capture_quarantine_object_purge_queue
            set cancelled_at = now(), last_error = null
          where storage_key = $1`,
        [storageKey],
      );
      await client.query('commit');
      return 'retained';
    }

    await deleteExactQuarantineObject(bucket, storageKey);
    await client.query(
      `update public.capture_quarantine_object_purge_queue
          set purged_at = now(), cancelled_at = null, last_error = null
        where storage_key = $1`,
      [storageKey],
    );
    await client.query('commit');
    return 'purged';
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    await recordQuarantineFailure(pool, storageKey, error);
    return 'failed';
  } finally {
    client.release();
  }
}

const pool = createPool();
try {
  const due = await readDueSummary(pool);
  if (!apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      quarantineDue: Number(due.quarantine_due),
      captureUploadsDue: Number(due.uploads_due),
      message: 'No S3 module/client was loaded and no database mutation was made.',
    }, null, 2));
  } else {
    const purgeApproved = process.env.AIM4PRICE_ALLOW_CAPTURE_QUARANTINE_PURGE
      === 'YES_I_REVIEWED_CAPTURE_PURGE_QUEUE';
    const bucketCostApproved = process.env.AIM4PRICE_ALLOW_BUCKET_WRITES === 'YES_I_ACCEPT_COST';
    if (!purgeApproved || !bucketCostApproved) {
      throw new Error('Capture purge requires both explicit purge review and Bucket cost approval.');
    }

    const bucket = await createBucketClient();
    const uploadIds = await listDueUploadIds(pool);
    const quarantineKeys = await listDueQuarantineKeys(pool);
    const results = { cleaned: 0, purged: 0, retained: 0, skipped: 0, failed: 0 };
    for (const uploadId of uploadIds) {
      const status = await cleanOneCaptureUpload(pool, uploadId);
      results[status] = (results[status] ?? 0) + 1;
    }
    for (const storageKey of quarantineKeys) {
      const status = await purgeOneQuarantineObject(pool, bucket, storageKey);
      results[status] = (results[status] ?? 0) + 1;
    }
    console.log(JSON.stringify({ mode: 'apply', batchSize, ...results }, null, 2));
  }
} finally {
  await pool.end();
}
