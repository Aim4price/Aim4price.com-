#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';

const { Pool } = pg;
const apply = process.argv.includes('--apply');
const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='));
const limit = Math.min(500, Math.max(1, Number(limitArgument?.split('=')[1] ?? 25) || 25));
const costApproval = process.env.AIM4PRICE_ALLOW_BUCKET_WRITES === 'YES_I_ACCEPT_COST';

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
    ...config,
    forcePathStyle:
      String(process.env.AWS_S3_URL_STYLE ?? '').toLowerCase() === 'path'
      || String(process.env.AWS_S3_FORCE_PATH_STYLE ?? '').toLowerCase() === 'true',
  };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function objectKey(uploadId) {
  const id = String(uploadId).trim().toLowerCase();
  if (!/^[a-z0-9-]{20,80}$/.test(id)) throw new Error(`Unsafe upload id: ${id}`);
  return `v1/asset-register/${id.slice(0, 2)}/${id}`;
}

async function bodyBytes(body) {
  if (!body) throw new Error('Bucket returned an empty object body.');
  return Buffer.from(await body.transformToByteArray());
}

const pool = createPool();
const client = await pool.connect();
let advisoryLockHeld = false;

try {
  const summary = await client.query(`
    select
      count(*)::bigint as rows_to_copy,
      coalesce(sum(octet_length(data)), 0)::bigint as bytes_to_copy
    from public.asset_register_uploads
    where data is not null
      and coalesce(storage_state, 'postgres') in ('postgres', 'copying')
  `);
  const rowCount = Number(summary.rows[0]?.rows_to_copy ?? 0);
  const byteCount = Number(summary.rows[0]?.bytes_to_copy ?? 0);

  console.log(JSON.stringify({
    mode: apply ? 'APPLY' : 'DRY_RUN',
    eligibleRows: rowCount,
    eligibleBytes: byteCount,
    batchLimit: limit,
    note: apply
      ? 'PostgreSQL bytes will be retained; verified bucket metadata only will be added.'
      : 'No bucket connection or database write was made.',
  }, null, 2));

  if (!apply || rowCount === 0) process.exitCode = 0;
  else {
    if (!costApproval) {
      throw new Error(
        'Bucket copy can create Railway storage and service-egress usage. '
        + 'Set AIM4PRICE_ALLOW_BUCKET_WRITES=YES_I_ACCEPT_COST as well as --apply to continue.',
      );
    }

    const config = readBucketConfig();
    console.log(JSON.stringify({
      approvedBucket: config.bucket,
      approvedEndpoint: config.endpoint,
      warning: 'This APPLY run can create billable Railway usage.',
    }, null, 2));
    const s3 = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    const lockResult = await client.query(`
      select pg_try_advisory_lock(hashtext('aim4price_asset_upload_bucket_migration')) as acquired
    `);
    advisoryLockHeld = Boolean(lockResult.rows[0]?.acquired);
    if (!advisoryLockHeld) {
      throw new Error('Another asset-upload Bucket migration is already running.');
    }

    let copied = 0;
    for (let item = 0; item < limit; item += 1) {
      let transactionOpen = false;
      try {
        await client.query('begin');
        transactionOpen = true;
        const claimed = await client.query(
          `
            with candidate as (
              select id
              from public.asset_register_uploads
              where data is not null
                and coalesce(storage_state, 'postgres') in ('postgres', 'copying')
              order by created_at asc, id::text asc
              for update skip locked
              limit 1
            )
            update public.asset_register_uploads upload
            set storage_state = 'copying'
            from candidate
            where upload.id = candidate.id
            returning upload.id::text, upload.data, upload.content_type
          `,
        );
        const upload = claimed.rows[0];

        if (!upload || claimed.rowCount !== 1) {
          await client.query('rollback');
          transactionOpen = false;
          break;
        }

        const data = Buffer.from(upload.data);
        const key = objectKey(upload.id);
        const expectedSha256 = sha256(data);
        let putEtag = null;

        try {
          const put = await s3.send(new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: data,
            ContentLength: data.length,
            ContentType: upload.content_type || 'application/octet-stream',
            IfNoneMatch: '*',
            Metadata: { 'aim4price-sha256': expectedSha256 },
          }));
          putEtag = put.ETag ? String(put.ETag).replace(/^"|"$/g, '') : null;
        } catch (error) {
          const statusCode = error?.$metadata?.httpStatusCode;
          if (statusCode !== 412 && error?.name !== 'PreconditionFailed') throw error;
        }

        const downloaded = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        const verifiedData = await bodyBytes(downloaded.Body);
        const actualSha256 = sha256(verifiedData);

        if (verifiedData.length !== data.length || actualSha256 !== expectedSha256) {
          await client.query(
            `update public.asset_register_uploads set storage_state = 'quarantined' where id::text = $1`,
            [upload.id],
          );
          await client.query('commit');
          transactionOpen = false;
          throw new Error(`Verification failed for upload ${upload.id}; PostgreSQL copy was retained.`);
        }

        const updated = await client.query(
          `
            update public.asset_register_uploads
            set
              storage_state = 'dual_verified',
              byte_size = $5,
              object_key = $2,
              content_sha256 = $3,
              object_etag = $4,
              object_verified_at = now()
            where id::text = $1
              and data is not null
            returning id
          `,
          [
            upload.id,
            key,
            expectedSha256,
            putEtag || (downloaded.ETag ? String(downloaded.ETag).replace(/^"|"$/g, '') : null),
            data.length,
          ],
        );
        if (updated.rowCount !== 1) {
          throw new Error(`Upload ${upload.id} changed during migration; refusing to mark it verified.`);
        }

        await client.query('commit');
        transactionOpen = false;
        copied += 1;
        console.log(`verified ${copied}/${limit}: ${upload.id}`);
      } catch (error) {
        if (transactionOpen) await client.query('rollback');
        throw error;
      }
    }

    console.log(JSON.stringify({ copied, remainingEstimate: Math.max(0, rowCount - copied) }, null, 2));
  }
} finally {
  if (advisoryLockHeld) {
    await client.query(`select pg_advisory_unlock(hashtext('aim4price_asset_upload_bucket_migration'))`);
  }
  client.release();
  await pool.end();
}
