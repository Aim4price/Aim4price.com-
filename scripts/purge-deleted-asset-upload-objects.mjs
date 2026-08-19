#!/usr/bin/env node

import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';

const { Pool } = pg;
const apply = process.argv.includes('--apply');
const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='));
const limit = Math.min(500, Math.max(1, Number(limitArgument?.split('=')[1] ?? 25) || 25));

function firstValue(...values) {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function createPool() {
  if (['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].every((key) => process.env[key])) {
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
    return new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, connectionTimeoutMillis: 10_000 });
  }

  throw new Error('Database connection variables are missing.');
}

function bucketClient() {
  const config = {
    bucket: firstValue(process.env.AIM4PRICE_BUCKET_NAME, process.env.AWS_S3_BUCKET_NAME, process.env.BUCKET),
    endpoint: firstValue(process.env.AIM4PRICE_BUCKET_ENDPOINT, process.env.AWS_ENDPOINT_URL, process.env.ENDPOINT),
    region: firstValue(process.env.AIM4PRICE_BUCKET_REGION, process.env.AWS_DEFAULT_REGION, process.env.REGION, 'auto'),
    accessKeyId: firstValue(process.env.AIM4PRICE_BUCKET_ACCESS_KEY_ID, process.env.AWS_ACCESS_KEY_ID, process.env.ACCESS_KEY_ID),
    secretAccessKey: firstValue(process.env.AIM4PRICE_BUCKET_SECRET_ACCESS_KEY, process.env.AWS_SECRET_ACCESS_KEY, process.env.SECRET_ACCESS_KEY),
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Bucket configuration is missing: ${missing.join(', ')}`);
  const parsedEndpoint = new URL(config.endpoint);
  if (parsedEndpoint.protocol !== 'https:' || parsedEndpoint.username || parsedEndpoint.password) {
    throw new Error('Bucket endpoint must be an HTTPS URL without embedded credentials.');
  }
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucket)) {
    throw new Error('Bucket name is invalid.');
  }

  return {
    bucket: config.bucket,
    client: new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle:
        String(process.env.AWS_S3_URL_STYLE ?? '').toLowerCase() === 'path'
        || String(process.env.AWS_S3_FORCE_PATH_STYLE ?? '').toLowerCase() === 'true',
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    }),
  };
}

const pool = createPool();

try {
  const due = await pool.query(`
    select count(*)::bigint as due_count
    from public.asset_upload_object_purge_queue
    where purged_at is null
      and cancelled_at is null
      and purge_after <= now()
      and not exists (
        select 1 from public.asset_register_uploads upload
        where upload.object_key = asset_upload_object_purge_queue.object_key
      )
  `);
  const dueCount = Number(due.rows[0]?.due_count ?? 0);
  console.log(JSON.stringify({
    mode: apply ? 'APPLY' : 'DRY_RUN',
    dueObjects: dueCount,
    batchLimit: limit,
    note: apply
      ? 'Only objects past the 30-day recovery window will be removed.'
      : 'No Bucket connection or database write was made.',
  }, null, 2));

  if (apply && dueCount > 0) {
    const bucket = bucketClient();
    const rows = await pool.query(
      `
        select id, object_key
        from public.asset_upload_object_purge_queue
        where purged_at is null
          and cancelled_at is null
          and purge_after <= now()
          and not exists (
            select 1 from public.asset_register_uploads upload
            where upload.object_key = asset_upload_object_purge_queue.object_key
          )
        order by purge_after asc, id asc
        limit $1
      `,
      [limit],
    );

    for (const row of rows.rows) {
      try {
        if (!/^v1\/asset-register\/[0-9a-z]{2}\/[0-9a-z-]{20,80}$/.test(String(row.object_key))) {
          throw new Error(`Refusing to delete an object with an unsafe key: ${row.id}`);
        }

        const liveReference = await pool.query(
          `select 1 from public.asset_register_uploads where object_key = $1 limit 1`,
          [row.object_key],
        );
        if (liveReference.rowCount) {
          await pool.query(
            `
              update public.asset_upload_object_purge_queue
              set cancelled_at = now(), last_error = 'Cancelled because the object key became live again.'
              where id = $1
            `,
            [row.id],
          );
          continue;
        }

        // S3 DeleteObject is idempotent: an already-missing object is success.
        await bucket.client.send(new DeleteObjectCommand({ Bucket: bucket.bucket, Key: row.object_key }));
        await pool.query(
          `
            update public.asset_upload_object_purge_queue
            set purged_at = now(), attempt_count = attempt_count + 1, last_error = null
            where id = $1
          `,
          [row.id],
        );
        console.log(`purged ${row.id}`);
      } catch (error) {
        await pool.query(
          `
            update public.asset_upload_object_purge_queue
            set attempt_count = attempt_count + 1, last_error = left($2, 1000)
            where id = $1
          `,
          [row.id, error instanceof Error ? error.message : String(error)],
        );
        throw error;
      }
    }
  }
} finally {
  await pool.end();
}
