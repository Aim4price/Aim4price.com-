#!/usr/bin/env node

import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';

const { Pool } = pg;
const apply = process.argv.includes('--apply');
const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='));
const limit = Math.min(500, Math.max(1, Number(limitArgument?.split('=')[1] ?? 25) || 25));
const bucketWritesApproved = process.env.AIM4PRICE_ALLOW_BUCKET_WRITES === 'YES_I_ACCEPT_COST';
const applyApproved = process.env.AIM4PRICE_ALLOW_UPLOAD_PURGE === 'YES_I_REVIEWED_THE_DRY_RUN';
const SAFE_UPLOAD_ID_PATTERN = /^[0-9a-z-]{20,80}$/;
const SAFE_OBJECT_KEY_PATTERN = /^v1\/asset-register\/[0-9a-z]{2}\/[0-9a-z-]{20,80}$/;

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

function asCount(value) {
  const count = Number(value ?? 0);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function lockPotentialUploadSourceTables(client) {
  const result = await client.query(`
    with registered_relations as (
      select
        namespace.nspname as source_schema,
        relation.relname as source_table
      from public.asset_upload_reference_sources as sources
      join pg_catalog.pg_namespace as namespace
        on namespace.nspname = sources.source_schema
      join pg_catalog.pg_class as relation
        on relation.relnamespace = namespace.oid
       and relation.relname = sources.source_table
      where relation.relkind in ('r', 'p')
        and not relation.relispartition
    ), typed_columns as (
      select
        namespace.nspname as source_schema,
        relation.relname as source_table,
        attribute.attname as column_name,
        attribute.atttypid as column_type,
        column_type.typname as column_type_name,
        column_type.typtype as column_type_kind,
        column_type.typbasetype as domain_base_type,
        domain_base_type.typname as domain_base_type_name,
        domain_base_type.typelem as domain_array_element_type,
        domain_array_element_type.typname as domain_array_element_type_name,
        domain_array_element_type.typtype as domain_array_element_type_kind,
        domain_array_domain_base_type.typname as domain_array_domain_base_type_name,
        column_type.typelem as array_element_type,
        element_type.typname as array_element_type_name,
        element_type.typtype as array_element_type_kind,
        array_domain_base_type.typname as array_domain_base_type_name
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      join pg_catalog.pg_attribute as attribute
        on attribute.attrelid = relation.oid
       and attribute.attnum > 0
       and not attribute.attisdropped
      join pg_catalog.pg_type as column_type
        on column_type.oid = attribute.atttypid
      left join pg_catalog.pg_type as domain_base_type
        on domain_base_type.oid = column_type.typbasetype
      left join pg_catalog.pg_type as domain_array_element_type
        on domain_array_element_type.oid = domain_base_type.typelem
      left join pg_catalog.pg_type as domain_array_domain_base_type
        on domain_array_domain_base_type.oid = domain_array_element_type.typbasetype
      left join pg_catalog.pg_type as element_type
        on element_type.oid = column_type.typelem
      left join pg_catalog.pg_type as array_domain_base_type
        on array_domain_base_type.oid = element_type.typbasetype
      where namespace.nspname = 'public'
        and relation.relkind in ('r', 'p')
        and not relation.relispartition
        and relation.relname not in (
          'asset_register_uploads',
          'asset_upload_references',
          'asset_upload_reference_sources',
          'asset_upload_reference_rollout',
          'asset_upload_object_purge_queue'
        )
    ), audited_relations as (
      select distinct source_schema, source_table
      from typed_columns
      where
        column_type in (
          'text'::regtype,
          'varchar'::regtype,
          'bpchar'::regtype,
          'json'::regtype,
          'jsonb'::regtype
        )
        or column_type_name = 'citext'
        or (
          column_type_kind = 'd'
          and domain_base_type in (
            'text'::regtype,
            'varchar'::regtype,
            'bpchar'::regtype,
            'json'::regtype,
            'jsonb'::regtype
          )
        )
        or domain_base_type_name = 'citext'
        or (
          column_type_kind = 'd'
          and (
            domain_array_element_type in (
              'text'::regtype,
              'varchar'::regtype,
              'bpchar'::regtype,
              'json'::regtype,
              'jsonb'::regtype
            )
            or domain_array_element_type_name = 'citext'
            or (
              domain_array_element_type_kind = 'd'
              and domain_array_domain_base_type_name in (
                'text', 'varchar', 'bpchar', 'json', 'jsonb', 'citext'
              )
            )
          )
        )
        or array_element_type in (
          'text'::regtype,
          'varchar'::regtype,
          'bpchar'::regtype,
          'json'::regtype,
          'jsonb'::regtype
        )
        or array_element_type_name = 'citext'
        or (
          array_element_type_kind = 'd'
          and array_domain_base_type_name in (
            'text', 'varchar', 'bpchar', 'json', 'jsonb', 'citext'
          )
        )
        or (
          lower(column_name) ~ 'upload_?id$'
          and (
            column_type in (
              'text'::regtype,
              'varchar'::regtype,
              'bpchar'::regtype,
              'uuid'::regtype
            )
            or column_type_name = 'citext'
            or (
              column_type_kind = 'd'
              and domain_base_type in (
                'text'::regtype,
                'varchar'::regtype,
                'bpchar'::regtype,
                'uuid'::regtype
              )
            )
            or domain_base_type_name = 'citext'
          )
        )
    )
    select source_schema, source_table from registered_relations
    union
    select source_schema, source_table from audited_relations
    order by source_schema, source_table
  `);

  for (const source of result.rows) {
    await client.query(
      `lock table ${quoteIdentifier(source.source_schema)}.${quoteIdentifier(source.source_table)} in share row exclusive mode`,
    );
  }

  // Source triggers acquire a source row before touching upload metadata. Lock
  // the catalog after all source tables to preserve that order and prevent an
  // upload row from being recreated between the catalog check and DeleteObject.
  await client.query(
    'lock table public.asset_register_uploads in share row exclusive mode',
  );
}

function isSafeObjectIdentity(uploadIdValue, objectKeyValue) {
  const uploadId = String(uploadIdValue ?? '').trim();
  const objectKey = String(objectKeyValue ?? '').trim();

  return SAFE_UPLOAD_ID_PATTERN.test(uploadId)
    && SAFE_OBJECT_KEY_PATTERN.test(objectKey)
    && objectKey === `v1/asset-register/${uploadId.slice(0, 2)}/${uploadId}`;
}

async function deleteBucketObject(bucket, objectKey) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 30_000);

  try {
    await bucket.client.send(
      new DeleteObjectCommand({ Bucket: bucket.bucket, Key: objectKey }),
      { abortSignal: abortController.signal },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function referenceGuardsReady(queryable) {
  const schema = await queryable.query(`
    select
      to_regclass('public.asset_register_uploads') is not null as has_uploads,
      to_regclass('public.asset_upload_object_purge_queue') is not null as has_queue,
      to_regclass('public.asset_upload_references') is not null as has_references,
      to_regclass('public.asset_upload_reference_sources') is not null as has_sources,
      to_regprocedure('public.asset_upload_reference_ledger_ready()') is not null
        as has_readiness,
      to_regprocedure('public.asset_upload_has_live_reference(text)') is not null
        as has_live_reference,
      to_regprocedure('public.asset_upload_prepare_for_deletion(text)') is not null
        as has_prepare_for_deletion,
      to_regprocedure('public.asset_upload_has_unregistered_catalog_reference(text)') is not null
        as has_catalog_reference,
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'asset_upload_object_purge_queue'
          and column_name = 'upload_id'
          and data_type = 'text'
      ) as has_queue_upload_id
  `);
  const guard = schema.rows[0];

  if (
    !guard?.has_uploads
    || !guard.has_queue
    || !guard.has_references
    || !guard.has_sources
    || !guard.has_readiness
    || !guard.has_live_reference
    || !guard.has_prepare_for_deletion
    || !guard.has_catalog_reference
    || !guard.has_queue_upload_id
  ) {
    return false;
  }

  const readiness = await queryable.query(
    'select public.asset_upload_reference_ledger_ready() as ready',
  );
  return readiness.rows[0]?.ready === true;
}

async function readSummary(pool, guardsReady) {
  if (!guardsReady) {
    return {
      orphansToSchedule: 0,
      dueMetadataRows: 0,
      dueDatabaseCandidates: 0,
      dueBucketCandidates: 0,
      dueObjectQueueRows: 0,
    };
  }

  const result = await pool.query(`
    select
      (
        select count(*)::bigint
        from public.asset_register_uploads
        where deleted_at is null
          and created_at <= now() - interval '24 hours'
          and not public.asset_upload_has_live_reference(id)
      ) as orphans_to_schedule,
      (
        select count(*)::bigint
        from public.asset_register_uploads
        where deleted_at is not null
          and purge_after <= now()
      ) as due_metadata_rows,
      (
        select count(*)::bigint
        from public.asset_register_uploads
        where deleted_at is not null
          and purge_after <= now()
          and object_key is null
      ) as due_database_candidates,
      (
        select count(*)::bigint
        from public.asset_register_uploads
        where deleted_at is not null
          and purge_after <= now()
          and object_key is not null
      ) as due_bucket_candidates,
      (
        select count(*)::bigint
        from public.asset_upload_object_purge_queue
        where purged_at is null
          and cancelled_at is null
          and purge_after <= now()
      ) as due_object_queue_rows
  `);
  const row = result.rows[0] ?? {};

  return {
    // These are deliberately labelled candidates: the authoritative live/raw
    // reference checks run inside each apply transaction, immediately before
    // anything is marked or deleted.
    orphansToSchedule: asCount(row.orphans_to_schedule),
    dueMetadataRows: asCount(row.due_metadata_rows),
    dueDatabaseCandidates: asCount(row.due_database_candidates),
    dueBucketCandidates: asCount(row.due_bucket_candidates),
    dueObjectQueueRows: asCount(row.due_object_queue_rows),
  };
}

async function scheduleAgedUnreferencedUploads(pool) {
  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query('begin');
    inTransaction = true;
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '5min'");
    await lockPotentialUploadSourceTables(client);

    if (!(await referenceGuardsReady(client))) {
      throw new Error('Migration 81 reference guards became unavailable; orphan scheduling stopped fail-closed.');
    }

    // Registered triggers normally revive a soft-deleted upload immediately.
    // This bounded sweep provides the equivalent recovery for a newly added,
    // not-yet-registered public source discovered by the catalog fallback.
    const revived = await client.query(
      `
        with candidates as (
          select upload.id
          from public.asset_register_uploads as upload
          where upload.deleted_at is not null
            and (
              exists (
                select 1
                from public.asset_upload_references as reference
                where reference.upload_id = upload.id
                  and reference.reference_kind = 'source'
              )
              or public.asset_upload_has_unregistered_catalog_reference(upload.id)
            )
          order by upload.deleted_at asc, upload.id asc
          for update skip locked
          limit $1
        )
        update public.asset_register_uploads as upload
        set deleted_at = null,
            purge_after = null
        from candidates
        where upload.id = candidates.id
        returning upload.id
      `,
      [limit],
    );

    const result = await client.query(
      `
        with candidates as (
          select upload.id
          from public.asset_register_uploads as upload
          where upload.deleted_at is null
            and upload.created_at <= now() - interval '24 hours'
            and not public.asset_upload_has_live_reference(upload.id)
          order by upload.created_at asc, upload.id asc
          for update skip locked
          limit $1
        )
        update public.asset_register_uploads as upload
        set deleted_at = now(),
            purge_after = now() + interval '30 days'
        from candidates
        where upload.id = candidates.id
          and upload.deleted_at is null
        returning upload.id
      `,
      [limit],
    );

    await client.query('commit');
    inTransaction = false;
    return {
      scheduled: result.rowCount ?? 0,
      revived: revived.rowCount ?? 0,
    };
  } catch (error) {
    if (inTransaction) await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function listDueSoftDeletedUploadIds(pool, bucketBacked) {
  const result = await pool.query(
    `
      select id
      from public.asset_register_uploads
      where deleted_at is not null
        and purge_after <= now()
        and (($2::boolean and object_key is not null) or (not $2::boolean and object_key is null))
      order by purge_after asc, id asc
      limit $1
    `,
    [limit, bucketBacked],
  );

  return result.rows.map((row) => String(row.id ?? '').trim()).filter(Boolean);
}

async function finalizeSoftDeletedUpload(pool, uploadId, allowBucketBacked) {
  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query('begin');
    inTransaction = true;
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '5min'");

    await lockPotentialUploadSourceTables(client);

    if (!(await referenceGuardsReady(client))) {
      throw new Error('Migration 81 reference guards became unavailable; purge stopped fail-closed.');
    }

    const selected = await client.query(
      `
        select id, object_key
        from public.asset_register_uploads
        where id = $1
          and deleted_at is not null
          and purge_after <= now()
        for update
      `,
      [uploadId],
    );
    const row = selected.rows[0];

    if (!row) {
      await client.query('rollback');
      inTransaction = false;
      return 'stale';
    }

    if (row.object_key && !allowBucketBacked) {
      await client.query('rollback');
      inTransaction = false;
      return 'bucket-cost-not-approved';
    }

    const prepared = await client.query(
      'select public.asset_upload_prepare_for_deletion($1) as prepared',
      [uploadId],
    );
    if (prepared.rows[0]?.prepared !== true) {
      await client.query('rollback');
      inTransaction = false;
      return 'referenced-or-held';
    }

    // prepare_for_deletion performs the ledger and raw-source checks and removes
    // only expired temporary FK rows. Keep this DELETE immediately adjacent and
    // in the same transaction so no unchecked catalog deletion is possible.
    const deleted = await client.query(
      `
        delete from public.asset_register_uploads
        where id = $1
          and deleted_at is not null
          and purge_after <= now()
        returning object_key
      `,
      [uploadId],
    );
    if (deleted.rowCount !== 1) {
      throw new Error(`Upload ${uploadId} changed before its final metadata deletion.`);
    }

    const objectKey = deleted.rows[0]?.object_key;
    if (objectKey) {
      // Migration 81's AFTER DELETE trigger stores upload_id and preserves the
      // soft row's original recovery deadline. Verify that contract instead of
      // creating or advancing queue state in application code.
      const queued = await client.query(
        `
          select id
          from public.asset_upload_object_purge_queue
          where upload_id = $1
            and object_key = $2
            and purged_at is null
            and cancelled_at is null
            and purge_after <= now()
        `,
        [uploadId, objectKey],
      );
      if (queued.rowCount !== 1) {
        throw new Error(`Upload ${uploadId} could not be placed on the guarded object purge queue.`);
      }
    }

    await client.query('commit');
    inTransaction = false;
    return objectKey ? 'bucket-queued' : 'database-purged';
  } catch (error) {
    if (inTransaction) await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function purgeOneQueuedObject(pool, bucket) {
  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query('begin');
    inTransaction = true;
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '5min'");

    // Freeze every registered and catalog-audited public source before the
    // final raw scan. Without these locks an unregistered table could add a new
    // upload URL after the check but before the irreversible object deletion.
    await lockPotentialUploadSourceTables(client);

    if (!(await referenceGuardsReady(client))) {
      throw new Error('Migration 81 reference guards became unavailable; object purge stopped fail-closed.');
    }

    const selected = await client.query(`
      select id, upload_id, object_key
      from public.asset_upload_object_purge_queue
      where purged_at is null
        and cancelled_at is null
        and purge_after <= now()
      order by purge_after asc, id asc
      for update skip locked
      limit 1
    `);
    const row = selected.rows[0];

    if (!row) {
      await client.query('rollback');
      inTransaction = false;
      return { status: 'empty' };
    }

    const uploadId = String(row.upload_id ?? '').trim();
    const objectKey = String(row.object_key ?? '').trim();

    if (!isSafeObjectIdentity(uploadId, objectKey)) {
      const message = `Refusing to delete an object with an unsafe key or upload ID: ${row.id}`;
      await client.query(
        `
          update public.asset_upload_object_purge_queue
          set cancelled_at = now(),
              last_error = left($2, 1000)
          where id = $1
        `,
        [row.id, message],
      );
      await client.query('commit');
      inTransaction = false;
      return { status: 'held', id: row.id, message };
    }

    const catalog = await client.query(
      `
        select id
        from public.asset_register_uploads
        where id = $1 or object_key = $2
        limit 1
      `,
      [uploadId, objectKey],
    );
    if (catalog.rowCount) {
      await client.query(
        `
          update public.asset_upload_object_purge_queue
          set cancelled_at = now(),
              last_error = 'Cancelled because matching upload metadata exists.'
          where id = $1
        `,
        [row.id],
      );
      await client.query('commit');
      inTransaction = false;
      return { status: 'held', id: row.id, message: 'matching upload metadata exists' };
    }

    // This call checks unexpired ledger rows and dynamically scans every
    // registered raw source. It intentionally works after catalog deletion by
    // using the queue's durable upload_id from migration 81.
    const liveReference = await client.query(
      'select public.asset_upload_has_live_reference($1) as live',
      [uploadId],
    );
    if (liveReference.rows[0]?.live !== false) {
      await client.query(
        `
          update public.asset_upload_object_purge_queue
          set cancelled_at = now(),
              last_error = 'Cancelled because a ledger or raw-source reference exists.'
          where id = $1
        `,
        [row.id],
      );
      await client.query('commit');
      inTransaction = false;
      return { status: 'held', id: row.id, message: 'ledger or raw-source reference exists' };
    }

    try {
      // DeleteObject is idempotent: an already-missing object is success.
      await deleteBucketObject(bucket, objectKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await client.query(
        `
          update public.asset_upload_object_purge_queue
          set attempt_count = attempt_count + 1,
              last_error = left($2, 1000),
              purge_after = now() + interval '1 hour'
          where id = $1
        `,
        [row.id, message],
      );
      await client.query('commit');
      inTransaction = false;
      return { status: 'failed', id: row.id, message };
    }

    await client.query(
      `
        update public.asset_upload_object_purge_queue
        set purged_at = now(),
            attempt_count = attempt_count + 1,
            last_error = null
        where id = $1
      `,
      [row.id],
    );
    await client.query('commit');
    inTransaction = false;
    return { status: 'purged', id: row.id };
  } catch (error) {
    if (inTransaction) await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

const pool = createPool();

try {
  const guardsReady = await referenceGuardsReady(pool);
  const summary = await readSummary(pool, guardsReady);

  console.log(JSON.stringify({
    mode: apply ? 'APPLY' : 'DRY_RUN',
    referenceGuardsReady: guardsReady,
    applyApproved,
    bucketWritesApproved,
    batchLimit: limit,
    ...summary,
    note: apply
      ? 'Only uploads past the 30-day recovery window and proven globally unreferenced can be removed.'
      : 'No Bucket connection or database write was made.',
  }, null, 2));

  if (!apply) {
    // Dry-run ends before Bucket configuration is parsed or an S3 client is
    // created. The queries above are read-only.
  } else {
    if (!applyApproved) {
      throw new Error(
        'Apply requires AIM4PRICE_ALLOW_UPLOAD_PURGE=YES_I_REVIEWED_THE_DRY_RUN.',
      );
    }
    if (!guardsReady) {
      throw new Error(
        'Migration 81 reference guards are not ready. Nothing was changed and no Bucket request was made.',
      );
    }

    const scheduling = await scheduleAgedUnreferencedUploads(pool);
    let databasePurged = 0;
    let bucketQueued = 0;
    let guarded = 0;

    for (const uploadId of await listDueSoftDeletedUploadIds(pool, false)) {
      const result = await finalizeSoftDeletedUpload(pool, uploadId, false);
      if (result === 'database-purged') databasePurged += 1;
      if (result === 'referenced-or-held') guarded += 1;
    }

    let purgedObjects = 0;
    let heldObjects = 0;
    let failedObjects = 0;

    const hasDueBucketWork = summary.dueBucketCandidates > 0 || summary.dueObjectQueueRows > 0;

    if (bucketWritesApproved && hasDueBucketWork) {
      // Creating the client validates configuration but does not contact the
      // Bucket. Network requests occur only for due, rechecked queue rows.
      const bucket = bucketClient();

      for (const uploadId of await listDueSoftDeletedUploadIds(pool, true)) {
        const result = await finalizeSoftDeletedUpload(pool, uploadId, true);
        if (result === 'bucket-queued') bucketQueued += 1;
        if (result === 'referenced-or-held') guarded += 1;
      }

      for (let index = 0; index < limit; index += 1) {
        const result = await purgeOneQueuedObject(pool, bucket);
        if (result.status === 'empty') break;
        if (result.status === 'purged') {
          purgedObjects += 1;
          console.log(`purged ${result.id}`);
        } else if (result.status === 'held') {
          heldObjects += 1;
          console.error(result.message);
        } else if (result.status === 'failed') {
          failedObjects += 1;
          console.error(`object purge failed for ${result.id}: ${result.message}`);
        }
      }
    }

    console.log(JSON.stringify({
      scheduledFor30DayRecovery: scheduling.scheduled,
      softDeletesRevived: scheduling.revived,
      databaseRowsPurged: databasePurged,
      bucketRowsQueued: bucketQueued,
      referenceGuardedRows: guarded,
      bucketObjectsPurged: purgedObjects,
      bucketObjectsHeld: heldObjects,
      bucketObjectFailures: failedObjects,
      bucketRowsSkippedWithoutCostApproval:
        bucketWritesApproved ? 0 : summary.dueBucketCandidates + summary.dueObjectQueueRows,
    }, null, 2));

    if (failedObjects > 0) process.exitCode = 1;
  }
} finally {
  await pool.end();
}
