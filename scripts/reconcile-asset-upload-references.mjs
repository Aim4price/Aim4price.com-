#!/usr/bin/env node

import { createHash } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

const apply = process.argv.includes('--apply');
const confirmedOrphansArgument = process.argv.find((argument) => argument.startsWith('--confirm-legacy-orphans='));
const confirmedCatalogArgument = process.argv.find((argument) => argument.startsWith('--confirm-catalog='));
const confirmedOrphans = confirmedOrphansArgument
  ? Number(confirmedOrphansArgument.split('=')[1])
  : null;
const confirmedCatalog = String(confirmedCatalogArgument?.split('=')[1] ?? '').trim().toLowerCase();
const applyApproved = process.env.AIM4PRICE_ALLOW_REFERENCE_RECONCILIATION
  === 'YES_I_REVIEWED_THE_DRY_RUN';
const LEGACY_ORPHAN_GRACE_HOURS = 24;
const APPLY_LOCK_NAME = 'aim4price_asset_upload_reference_reconciliation';
const JSON_BUILD_OBJECT_COLUMN_LIMIT = 32;
const JSON_BUILD_ARRAY_ITEM_LIMIT = 64;
const DISCOVERY_EXCLUDED_TABLES = [
  'asset_register_uploads',
  'asset_upload_object_purge_queue',
  'asset_upload_references',
  'asset_upload_reference_rollout',
  'asset_upload_reference_sources',
];

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

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function asCount(value) {
  const count = Number(value ?? 0);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function relationKey(source) {
  return JSON.stringify([source.source_schema, source.source_table]);
}

function relationSql(source) {
  return `${quoteIdentifier(source.source_schema)}.${quoteIdentifier(source.source_table)}`;
}

function expectedSourceSelect(source) {
  const schema = quoteLiteral(source.source_schema);
  const table = quoteLiteral(source.source_table);
  const key = quoteLiteral(source.key_column);

  return `
    select distinct
      found.upload_id,
      ${schema}::text as source_schema,
      ${table}::text as source_table,
      nullif(to_jsonb(source_row) ->> ${key}, '') as source_key
    from ${relationSql(source)} as source_row
    cross join lateral public.asset_upload_ids_from_payload(to_jsonb(source_row)) as found
    where nullif(to_jsonb(source_row) ->> ${key}, '') is not null
  `;
}

function expectedReferencesCte(existingSources) {
  const selects = existingSources.map(expectedSourceSelect);

  if (!selects.length) {
    return `
      select
        null::text as upload_id,
        null::text as source_schema,
        null::text as source_table,
        null::text as source_key
      where false
    `;
  }

  return selects.join('\nunion all\n');
}

function catalogFingerprint(sources, discoveryCatalog) {
  const registeredSources = sources
    .map((source) => ({
      sourceSchema: source.source_schema,
      sourceTable: source.source_table,
      keyColumn: source.key_column,
      required: Boolean(source.required),
      exists: Boolean(source.relation_exists),
      keyExists: Boolean(source.key_exists),
      triggerReady: Boolean(source.trigger_ready),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

  const discoverySchema = discoveryCatalog
    .flatMap((source) => source.columns.map((column) => ({
      sourceSchema: source.source_schema,
      sourceTable: source.source_table,
      columnName: column.column_name,
      dataType: column.data_type,
      udtName: column.udt_name,
      knownUploadId: Boolean(column.is_known_upload_id),
      fullRowVisibility: Boolean(source.full_row_visibility),
    })))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

  return createHash('sha256')
    .update(JSON.stringify({ registeredSources, discoverySchema }))
    .digest('hex')
    .slice(0, 16);
}

async function assertReferenceSchema(client) {
  const result = await client.query(`
    select
      to_regclass('public.asset_register_uploads') is not null as has_uploads,
      to_regclass('public.asset_upload_references') is not null as has_references,
      to_regclass('public.asset_upload_reference_sources') is not null as has_sources,
      to_regclass('public.asset_upload_reference_rollout') is not null as has_rollout,
      to_regprocedure('public.asset_upload_ids_from_payload(jsonb)') is not null as has_extractor,
      to_regprocedure('public.asset_upload_reference_ledger_ready()') is not null as has_readiness
  `);
  const readiness = result.rows[0];

  if (
    !readiness?.has_uploads
    || !readiness.has_references
    || !readiness.has_sources
    || !readiness.has_rollout
    || !readiness.has_extractor
    || !readiness.has_readiness
  ) {
    throw new Error(
      'Migration 81 is not fully applied. Run database/migrations/81-asset-upload-reference-guard.sql first.',
    );
  }
}

async function readSourceCatalog(client) {
  const result = await client.query(`
    select
      sources.source_schema,
      sources.source_table,
      sources.key_column,
      sources.required,
      sources.trigger_installed_at,
      sources.backfilled_at,
      sources.verified_at,
      to_regclass(
        pg_catalog.format('%I.%I', sources.source_schema, sources.source_table)
      ) is not null as relation_exists,
      exists (
        select 1
        from pg_catalog.pg_attribute as attribute
        where attribute.attrelid = to_regclass(
                pg_catalog.format('%I.%I', sources.source_schema, sources.source_table)
              )
          and attribute.attname = sources.key_column
          and attribute.attnum > 0
          and not attribute.attisdropped
      ) as key_exists,
      exists (
        select 1
        from pg_catalog.pg_trigger as trigger
        where trigger.tgrelid = to_regclass(
                pg_catalog.format('%I.%I', sources.source_schema, sources.source_table)
              )
          and trigger.tgname = 'asset_upload_reference_sync_trigger'
          and not trigger.tgisinternal
          and trigger.tgenabled <> 'D'
      ) as trigger_ready
    from public.asset_upload_reference_sources as sources
    order by sources.source_schema, sources.source_table
  `);

  return result.rows.map((source) => ({
    ...source,
    required: Boolean(source.required),
    relation_exists: Boolean(source.relation_exists),
    key_exists: Boolean(source.key_exists),
    trigger_ready: Boolean(source.trigger_ready),
  }));
}

async function readDiscoveryCatalog(client) {
  const result = await client.query(`
    with typed_columns as (
      select
        namespace.nspname as source_schema,
        relation.relname as source_table,
        attribute.attname as column_name,
        attribute.attnum as column_position,
        attribute.atttypid as column_type,
        pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) as data_type,
        column_type.typname as udt_name,
        column_type.typtype as column_type_kind,
        column_type.typbasetype as domain_base_type,
        domain_base_type.typname as domain_base_type_name,
        domain_base_type.typelem as domain_array_element_type,
        domain_array_element_type.typname as domain_array_element_type_name,
        domain_array_element_type.typtype as domain_array_element_type_kind,
        domain_array_domain_base_type.typname as domain_array_domain_base_type_name,
        column_type.typelem as array_element_type,
        array_element_type.typname as array_element_type_name,
        array_element_type.typtype as array_element_type_kind,
        array_domain_base_type.typname as array_domain_base_type_name,
        (
          not relation.relrowsecurity
          or exists (
            select 1
            from pg_catalog.pg_roles as current_role_safety
            where current_role_safety.rolname = current_user
              and (
                current_role_safety.rolsuper
                or current_role_safety.rolbypassrls
                or (
                  current_role_safety.oid = relation.relowner
                  and not relation.relforcerowsecurity
                )
              )
          )
        ) as full_row_visibility
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
      left join pg_catalog.pg_type as array_element_type
        on array_element_type.oid = column_type.typelem
      left join pg_catalog.pg_type as array_domain_base_type
        on array_domain_base_type.oid = array_element_type.typbasetype
      where namespace.nspname = 'public'
        and relation.relkind in ('r', 'p')
        and not relation.relispartition
        and relation.relname <> all($1::text[])
    ), classified_columns as (
      select
        typed_columns.*,
        (
          column_type in (
            'text'::regtype,
            'varchar'::regtype,
            'bpchar'::regtype,
            'json'::regtype,
            'jsonb'::regtype
          )
          or udt_name = 'citext'
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
            and array_domain_base_type_name in ('text', 'varchar', 'bpchar', 'json', 'jsonb', 'citext')
          )
        ) as scannable,
        (
          lower(column_name) ~ 'upload_?id$'
          and (
            column_type in ('text'::regtype, 'varchar'::regtype, 'bpchar'::regtype, 'uuid'::regtype)
            or udt_name = 'citext'
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
        ) as is_known_upload_id
      from typed_columns
    )
    select
      source_schema,
      source_table,
      column_name,
      data_type,
      udt_name,
      is_known_upload_id,
      full_row_visibility
    from classified_columns
    where scannable or is_known_upload_id
    order by source_schema, source_table, column_position
  `, [DISCOVERY_EXCLUDED_TABLES]);

  const grouped = new Map();

  for (const column of result.rows) {
    const key = relationKey(column);
    const source = grouped.get(key) ?? {
      source_schema: column.source_schema,
      source_table: column.source_table,
      full_row_visibility: Boolean(column.full_row_visibility),
      columns: [],
    };
    source.columns.push({
      column_name: column.column_name,
      data_type: column.data_type,
      udt_name: column.udt_name,
      is_known_upload_id: Boolean(column.is_known_upload_id),
    });
    grouped.set(key, source);
  }

  return [...grouped.values()];
}

function chunk(values, limit) {
  const chunks = [];
  for (let offset = 0; offset < values.length; offset += limit) {
    chunks.push(values.slice(offset, offset + limit));
  }
  return chunks;
}

function discoveryObjectExpression(source) {
  return chunk(source.columns, JSON_BUILD_OBJECT_COLUMN_LIMIT)
    .map((columns) => {
      const argumentsSql = columns.flatMap((column) => [
        quoteLiteral(column.column_name),
        `source_row.${quoteIdentifier(column.column_name)}`,
      ]);
      return `jsonb_build_object(${argumentsSql.join(', ')})`;
    })
    .join(' || ');
}

function knownUploadIdsExpression(source) {
  const knownIdColumns = source.columns.filter((column) => column.is_known_upload_id);
  if (!knownIdColumns.length) return `'[]'::jsonb`;

  return chunk(knownIdColumns, JSON_BUILD_ARRAY_ITEM_LIMIT)
    .map((columns) => `jsonb_build_array(${columns.map((column) => (
      `jsonb_build_object('upload_id', source_row.${quoteIdentifier(column.column_name)}::text)`
    )).join(', ')})`)
    .join(' || ');
}

function discoveryPayloadExpression(source) {
  return `jsonb_build_object(
    'scannableColumns', ${discoveryObjectExpression(source)},
    'knownUploadIds', ${knownUploadIdsExpression(source)}
  )`;
}

async function readDiscoveryTableAudit(client, source, registeredSourcesByKey) {
  const registeredSource = registeredSourcesByKey.get(relationKey(source));
  const sourceKeyExpression = registeredSource
    ? `nullif(to_jsonb(source_row) ->> ${quoteLiteral(registeredSource.key_column)}, '')`
    : 'null::text';
  const registeredCandidatesCte = registeredSource
    ? `
      select distinct
        found.upload_id,
        nullif(to_jsonb(source_row) ->> ${quoteLiteral(registeredSource.key_column)}, '') as source_key
      from ${relationSql(source)} as source_row
      cross join lateral public.asset_upload_candidate_ids_from_payload(to_jsonb(source_row)) as found
    `
    : `
      select null::text as upload_id, null::text as source_key
      where false
    `;
  const result = await client.query(`
    with candidates as materialized (
      select found.upload_id, ${sourceKeyExpression} as source_key
      from ${relationSql(source)} as source_row
      cross join lateral public.asset_upload_candidate_ids_from_payload(
        ${discoveryPayloadExpression(source)}
      ) as found
    ),
    distinct_candidates as materialized (
      select distinct upload_id
      from candidates
    ),
    registered_candidates as materialized (
      ${registeredCandidatesCte}
    ),
    untracked_registered_candidates as materialized (
      select distinct candidate.upload_id, candidate.source_key
      from candidates as candidate
      join public.asset_register_uploads as upload
        on upload.id = candidate.upload_id
      left join registered_candidates as registered
        on registered.upload_id = candidate.upload_id
       and registered.source_key is not distinct from candidate.source_key
      where registered.upload_id is null
    ),
    missing_candidates as materialized (
      select candidate.upload_id
      from distinct_candidates as candidate
      left join public.asset_register_uploads as upload
        on upload.id = candidate.upload_id
      where upload.id is null
    )
    select
      (select count(*)::bigint from candidates) as candidate_occurrences,
      (select count(*)::bigint from distinct_candidates) as candidate_upload_ids,
      (
        select count(*)::bigint
        from distinct_candidates as candidate
        join public.asset_register_uploads as upload
          on upload.id = candidate.upload_id
      ) as existing_upload_ids,
      (select count(*)::bigint from missing_candidates) as missing_upload_ids,
      (
        select count(*)::bigint
        from untracked_registered_candidates
      ) as untracked_registered_references
  `);
  const row = result.rows[0] ?? {};

  return {
    source: `${source.source_schema}.${source.source_table}`,
    sourceSchema: source.source_schema,
    sourceTable: source.source_table,
    registered: Boolean(registeredSource),
    scannedColumns: source.columns.map((column) => column.column_name),
    candidateOccurrences: asCount(row.candidate_occurrences),
    candidateUploadIds: asCount(row.candidate_upload_ids),
    existingUploadIds: asCount(row.existing_upload_ids),
    missingUploadIds: asCount(row.missing_upload_ids),
    untrackedRegisteredReferences: asCount(row.untracked_registered_references),
  };
}

async function inspectDiscovery(client, discoveryCatalog, registeredSources) {
  const registeredSourcesByKey = new Map(
    registeredSources.map((source) => [relationKey(source), source]),
  );
  const tables = [];

  for (const source of discoveryCatalog) {
    tables.push(await readDiscoveryTableAudit(client, source, registeredSourcesByKey));
  }

  const tablesWithCandidates = tables.filter((source) => source.candidateUploadIds > 0);
  const unregisteredSourceTables = tablesWithCandidates.filter((source) => !source.registered);
  const missingUploadSourceTables = tablesWithCandidates.filter((source) => source.missingUploadIds > 0);
  const registeredExtractorGaps = tablesWithCandidates.filter((source) => (
    source.registered && source.untrackedRegisteredReferences > 0
  ));
  const incompleteVisibilityTables = discoveryCatalog
    .filter((source) => !source.full_row_visibility)
    .map((source) => `${source.source_schema}.${source.source_table}`);

  return {
    auditedTables: tables.length,
    auditedColumns: discoveryCatalog.reduce((total, source) => total + source.columns.length, 0),
    tablesWithCandidates,
    unregisteredSourceTables,
    missingUploadSourceTables,
    registeredExtractorGaps,
    incompleteVisibilityTables,
  };
}

function discoveryProblems(discovery) {
  const unregistered = discovery.unregisteredSourceTables.map((source) => (
    `${source.source} contains ${source.candidateUploadIds} upload reference candidate(s) `
    + `but is not registered in asset_upload_reference_sources`
  ));
  const missingUploads = discovery.missingUploadSourceTables.map((source) => (
    `${source.source} contains ${source.missingUploadIds} upload reference candidate(s) `
    + 'whose asset_register_uploads metadata row is missing'
  ));
  const extractorGaps = discovery.registeredExtractorGaps.map((source) => (
    `${source.source} contains ${source.untrackedRegisteredReferences} registered reference(s) `
    + 'that the migration 81 row extractor does not track'
  ));
  const incompleteVisibility = discovery.incompleteVisibilityTables.map((source) => (
    `${source} has row-level security that can hide references from the reconciliation role`
  ));

  return [...unregistered, ...missingUploads, ...extractorGaps, ...incompleteVisibility];
}

async function readBlankKeyCount(client, source) {
  if (!source.relation_exists || !source.key_exists) return 0;

  const result = await client.query(`
    select count(*)::bigint as blank_keys
    from ${relationSql(source)} as source_row
    where nullif(to_jsonb(source_row) ->> $1, '') is null
  `, [source.key_column]);

  return asCount(result.rows[0]?.blank_keys);
}

async function inspectCatalog(client, sources) {
  const inspected = [];

  for (const source of sources) {
    inspected.push({
      ...source,
      blank_key_count: await readBlankKeyCount(client, source),
    });
  }

  return inspected;
}

function catalogProblems(sources) {
  const problems = [];

  for (const source of sources) {
    const label = `${source.source_schema}.${source.source_table}`;

    if (source.required && !source.relation_exists) {
      problems.push(`${label} is required but does not exist`);
      continue;
    }
    if (!source.relation_exists) continue;
    if (!source.key_exists) problems.push(`${label} is missing key column ${source.key_column}`);
    if (source.blank_key_count > 0) problems.push(`${label} has ${source.blank_key_count} blank source keys`);
    if (!source.trigger_ready) problems.push(`${label} is missing its enabled reconciliation trigger`);
  }

  return problems;
}

async function readSourceStatistics(client, source) {
  if (!source.relation_exists || !source.key_exists || source.blank_key_count > 0) {
    return {
      source: `${source.source_schema}.${source.source_table}`,
      required: source.required,
      exists: source.relation_exists,
      expectedReferences: 0,
      ledgerReferences: 0,
      missingReferences: 0,
      staleReferences: 0,
      skipped: true,
    };
  }

  const result = await client.query(`
    with expected as (
      ${expectedSourceSelect(source)}
    ),
    ledger as (
      select upload_id, source_schema, source_table, source_key
      from public.asset_upload_references
      where source_schema = $1
        and source_table = $2
        and reference_kind = 'source'
    )
    select
      (select count(*)::bigint from expected) as expected_references,
      (select count(*)::bigint from ledger) as ledger_references,
      (
        select count(*)::bigint
        from expected
        left join ledger using (upload_id, source_schema, source_table, source_key)
        where ledger.upload_id is null
      ) as missing_references,
      (
        select count(*)::bigint
        from ledger
        left join expected using (upload_id, source_schema, source_table, source_key)
        where expected.upload_id is null
      ) as stale_references
  `, [source.source_schema, source.source_table]);
  const row = result.rows[0] ?? {};

  return {
    source: `${source.source_schema}.${source.source_table}`,
    required: source.required,
    exists: true,
    expectedReferences: asCount(row.expected_references),
    ledgerReferences: asCount(row.ledger_references),
    missingReferences: asCount(row.missing_references),
    staleReferences: asCount(row.stale_references),
    skipped: false,
  };
}

async function readReconciliationSummary(client, existingSources) {
  const expectedCte = expectedReferencesCte(existingSources);
  const result = await client.query(`
    with expected_references as (
      ${expectedCte}
    ),
    expected_ids as (
      select distinct upload_id from expected_references
    ),
    source_ledger as (
      select upload_id, source_schema, source_table, source_key
      from public.asset_upload_references
      where reference_kind = 'source'
    )
    select
      (select count(*)::bigint from public.asset_register_uploads) as total_uploads,
      (select count(*)::bigint from expected_references) as raw_references,
      (select count(*)::bigint from expected_ids) as raw_referenced_uploads,
      (select count(*)::bigint from source_ledger) as ledger_source_references,
      (
        select count(*)::bigint
        from expected_references as expected
        left join source_ledger as ledger
          using (upload_id, source_schema, source_table, source_key)
        where ledger.upload_id is null
      ) as missing_ledger_references,
      (
        select count(*)::bigint
        from source_ledger as ledger
        left join expected_references as expected
          using (upload_id, source_schema, source_table, source_key)
        where expected.upload_id is null
      ) as stale_ledger_references,
      (
        select count(*)::bigint
        from public.asset_upload_references
        where reference_kind = 'migration_hold'
      ) as migration_holds,
      (
        select count(*)::bigint
        from public.asset_upload_references as hold
        where hold.reference_kind = 'migration_hold'
          and exists (select 1 from expected_ids where expected_ids.upload_id = hold.upload_id)
      ) as referenced_migration_holds,
      (
        select count(*)::bigint
        from public.asset_upload_references as hold
        where hold.reference_kind = 'migration_hold'
          and not exists (select 1 from expected_ids where expected_ids.upload_id = hold.upload_id)
      ) as legacy_orphan_candidates,
      (
        select count(*)::bigint
        from public.asset_upload_references
        where reference_kind = 'pending'
          and expires_at > now()
      ) as active_pending_holds,
      (
        select count(*)::bigint
        from public.asset_upload_references
        where reference_kind = 'legacy_orphan_hold'
          and expires_at > now()
      ) as active_legacy_orphan_holds,
      (
        select count(*)::bigint
        from public.asset_upload_references
        where reference_kind in ('pending', 'legacy_orphan_hold')
          and expires_at <= now()
      ) as expired_temporary_holds,
      (
        select count(*)::bigint
        from public.asset_register_uploads as upload
        where not exists (
          select 1
          from public.asset_upload_references as reference
          where reference.upload_id = upload.id
            and (reference.expires_at is null or reference.expires_at > now())
        )
      ) as unprotected_uploads,
      public.asset_upload_reference_ledger_ready() as ledger_ready
  `);
  const row = result.rows[0] ?? {};

  return {
    totalUploads: asCount(row.total_uploads),
    rawReferences: asCount(row.raw_references),
    rawReferencedUploads: asCount(row.raw_referenced_uploads),
    ledgerSourceReferences: asCount(row.ledger_source_references),
    missingLedgerReferences: asCount(row.missing_ledger_references),
    staleLedgerReferences: asCount(row.stale_ledger_references),
    migrationHolds: asCount(row.migration_holds),
    referencedMigrationHolds: asCount(row.referenced_migration_holds),
    legacyOrphanCandidates: asCount(row.legacy_orphan_candidates),
    activePendingHolds: asCount(row.active_pending_holds),
    activeLegacyOrphanHolds: asCount(row.active_legacy_orphan_holds),
    expiredTemporaryHolds: asCount(row.expired_temporary_holds),
    unprotectedUploads: asCount(row.unprotected_uploads),
    ledgerReady: Boolean(row.ledger_ready),
  };
}

async function inspect(client) {
  await assertReferenceSchema(client);
  const catalog = await inspectCatalog(client, await readSourceCatalog(client));
  const discoveryCatalog = await readDiscoveryCatalog(client);
  const discovery = await inspectDiscovery(client, discoveryCatalog, catalog);
  const existingSources = catalog.filter((source) => (
    source.relation_exists && source.key_exists && source.blank_key_count === 0
  ));
  const sourceStatistics = [];

  for (const source of catalog) {
    sourceStatistics.push(await readSourceStatistics(client, source));
  }

  return {
    catalog,
    discoveryCatalog,
    discovery,
    catalogHash: catalogFingerprint(catalog, discoveryCatalog),
    catalogProblems: [...catalogProblems(catalog), ...discoveryProblems(discovery)],
    sourceStatistics,
    summary: await readReconciliationSummary(client, existingSources),
  };
}

async function rebuildSourceLedger(client, existingSources) {
  await client.query(`
    delete from public.asset_upload_references
    where reference_kind = 'source'
  `);

  for (const source of existingSources) {
    await client.query(`
      insert into public.asset_upload_references (
        upload_id,
        source_schema,
        source_table,
        source_key,
        reference_kind,
        expires_at,
        first_seen_at,
        last_seen_at
      )
      select
        expected.upload_id,
        expected.source_schema,
        expected.source_table,
        expected.source_key,
        'source',
        null,
        now(),
        now()
      from (
        ${expectedSourceSelect(source)}
      ) as expected
      on conflict on constraint asset_upload_references_pkey do update
      set reference_kind = 'source',
          expires_at = null,
          last_seen_at = excluded.last_seen_at
    `);

    await client.query(`
      update public.asset_upload_reference_sources
      set backfilled_at = now(),
          verified_at = now()
      where source_schema = $1
        and source_table = $2
    `, [source.source_schema, source.source_table]);
  }
}

async function releaseReviewedMigrationHolds(client) {
  const clearedPending = await client.query(`
    delete from public.asset_upload_references as hold
    where hold.reference_kind in ('pending', 'legacy_orphan_hold')
      and exists (
        select 1
        from public.asset_upload_references as source
        where source.upload_id = hold.upload_id
          and source.reference_kind = 'source'
          and source.expires_at is null
      )
  `);

  const releasedReferenced = await client.query(`
    delete from public.asset_upload_references as hold
    where hold.reference_kind = 'migration_hold'
      and exists (
        select 1
        from public.asset_upload_references as source
        where source.upload_id = hold.upload_id
          and source.reference_kind = 'source'
          and source.expires_at is null
      )
  `);

  const heldLegacyOrphans = await client.query(`
    update public.asset_upload_references as hold
    set reference_kind = 'legacy_orphan_hold',
        expires_at = now() + interval '${LEGACY_ORPHAN_GRACE_HOURS} hours',
        last_seen_at = now()
    where hold.reference_kind = 'migration_hold'
      and not exists (
        select 1
        from public.asset_upload_references as source
        where source.upload_id = hold.upload_id
          and source.reference_kind = 'source'
          and source.expires_at is null
      )
  `);

  await client.query(`
    update public.asset_upload_reference_rollout
    set backfill_completed_at = now(),
        holds_released_at = case
          when not exists (
            select 1
            from public.asset_upload_references
            where reference_kind = 'migration_hold'
          ) then coalesce(holds_released_at, now())
          else null
        end
    where singleton
  `);

  return {
    clearedSupersededTemporaryHolds: clearedPending.rowCount,
    releasedReferencedMigrationHolds: releasedReferenced.rowCount,
    legacyOrphansHeldFor24Hours: heldLegacyOrphans.rowCount,
  };
}

async function lockApplySourceTables(client, inspection) {
  const relations = new Map();

  for (const source of [
    ...inspection.catalog.filter((entry) => entry.relation_exists),
    ...inspection.discoveryCatalog,
  ]) {
    if (source.source_schema === 'public' && source.source_table === 'asset_register_uploads') {
      continue;
    }
    relations.set(relationKey(source), {
      source_schema: source.source_schema,
      source_table: source.source_table,
    });
  }

  const sortedRelations = [...relations.values()].sort((left, right) => (
    relationKey(left).localeCompare(relationKey(right))
  ));

  // Source triggers acquire their source table/row before touching an upload.
  // Match that order so reconciliation cannot hold the upload table while it
  // waits for a concurrent source update whose trigger is waiting on uploads.
  for (const source of sortedRelations) {
    await client.query(`lock table ${relationSql(source)} in share row exclusive mode`);
  }

  await client.query('lock table public.asset_register_uploads in share row exclusive mode');
}

function dryRunOutput(inspection) {
  return {
    mode: apply ? 'APPLY_REQUESTED' : 'DRY_RUN',
    bucketContacted: false,
    databaseWritesMade: false,
    legacyOrphanGraceHours: LEGACY_ORPHAN_GRACE_HOURS,
    catalogHash: inspection.catalogHash,
    catalogProblems: inspection.catalogProblems,
    discovery: inspection.discovery,
    summary: inspection.summary,
    sources: inspection.sourceStatistics,
    applyGuard: {
      environment: 'AIM4PRICE_ALLOW_REFERENCE_RECONCILIATION=YES_I_REVIEWED_THE_DRY_RUN',
      arguments: `--apply --confirm-catalog=${inspection.catalogHash} --confirm-legacy-orphans=${inspection.summary.legacyOrphanCandidates}`,
    },
    note: 'This inspection queried PostgreSQL and its public-table catalog only. It did not write to PostgreSQL or initialise a Bucket client.',
  };
}

const pool = createPool();
const client = await pool.connect();
let advisoryLockHeld = false;
let transactionOpen = false;

try {
  const initialInspection = await inspect(client);
  console.log(JSON.stringify(dryRunOutput(initialInspection), null, 2));

  if (apply) {
    if (!applyApproved) {
      throw new Error(
        'Apply requires AIM4PRICE_ALLOW_REFERENCE_RECONCILIATION=YES_I_REVIEWED_THE_DRY_RUN.',
      );
    }
    if (!Number.isSafeInteger(confirmedOrphans) || confirmedOrphans < 0) {
      throw new Error('Apply requires --confirm-legacy-orphans=<exact dry-run count>.');
    }
    if (confirmedCatalog !== initialInspection.catalogHash) {
      throw new Error(
        'The --confirm-catalog value does not match the current registered and discovered source catalog.',
      );
    }
    if (confirmedOrphans !== initialInspection.summary.legacyOrphanCandidates) {
      throw new Error(
        `The confirmed orphan count (${confirmedOrphans}) does not match the current dry run `
        + `(${initialInspection.summary.legacyOrphanCandidates}).`,
      );
    }
    if (initialInspection.catalogProblems.length) {
      throw new Error(`Reference catalog is not safe to apply: ${initialInspection.catalogProblems.join('; ')}`);
    }
    const lockResult = await client.query(
      `select pg_try_advisory_lock(hashtext($1)) as acquired`,
      [APPLY_LOCK_NAME],
    );
    advisoryLockHeld = Boolean(lockResult.rows[0]?.acquired);
    if (!advisoryLockHeld) {
      throw new Error('Another asset-upload reference reconciliation is already running.');
    }

    await client.query('begin isolation level repeatable read');
    transactionOpen = true;
    await client.query(`set local lock_timeout = '5s'`);
    await client.query(`set local statement_timeout = '5min'`);
    // Build the lock scope from the reviewed pre-transaction inspection. This
    // avoids taking a repeatable-read snapshot before waiting for source-table
    // writers; the first inspection snapshot is taken only after those writers
    // have completed and every reviewed source table is locked.
    await lockApplySourceTables(client, initialInspection);

    const stableInspection = await inspect(client);
    if (stableInspection.catalogHash !== confirmedCatalog) {
      throw new Error('The registered or discovered source catalog changed after the dry-run confirmation.');
    }
    if (stableInspection.catalogProblems.length) {
      throw new Error(`Reference catalog became unsafe: ${stableInspection.catalogProblems.join('; ')}`);
    }
    if (stableInspection.summary.legacyOrphanCandidates !== confirmedOrphans) {
      throw new Error(
        'The legacy-orphan count changed while acquiring source locks; rerun the dry run and review again.',
      );
    }

    const existingSources = stableInspection.catalog.filter((source) => source.relation_exists);
    await rebuildSourceLedger(client, existingSources);
    const preReleaseInspection = await inspect(client);
    if (
      preReleaseInspection.summary.missingLedgerReferences > 0
      || preReleaseInspection.summary.staleLedgerReferences > 0
    ) {
      throw new Error('The rebuilt source ledger does not exactly match the registered raw sources.');
    }
    if (preReleaseInspection.summary.legacyOrphanCandidates !== confirmedOrphans) {
      throw new Error('The reviewed legacy-orphan count changed during reconciliation.');
    }

    const changes = await releaseReviewedMigrationHolds(client);
    const finalInspection = await inspect(client);
    if (
      finalInspection.catalogHash !== confirmedCatalog
      || finalInspection.catalogProblems.length !== 0
      || finalInspection.summary.migrationHolds !== 0
      || finalInspection.summary.missingLedgerReferences !== 0
      || finalInspection.summary.staleLedgerReferences !== 0
      || finalInspection.summary.unprotectedUploads !== 0
      || !finalInspection.summary.ledgerReady
    ) {
      throw new Error('Post-reconciliation verification failed; all changes will be rolled back.');
    }

    await client.query('commit');
    transactionOpen = false;
    console.log(JSON.stringify({
      mode: 'APPLIED',
      bucketContacted: false,
      uploadRowsDeleted: 0,
      uploadBytesDeleted: 0,
      ...changes,
      catalogHash: finalInspection.catalogHash,
      summary: finalInspection.summary,
      note: 'Only the normalized reference ledger and rollout marker changed. Legacy orphan bytes remain in PostgreSQL.',
    }, null, 2));
  }
} catch (error) {
  if (transactionOpen) {
    await client.query('rollback').catch(() => undefined);
    transactionOpen = false;
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (advisoryLockHeld) {
    await client.query(`select pg_advisory_unlock(hashtext($1))`, [APPLY_LOCK_NAME]).catch(() => undefined);
  }
  client.release();
  await pool.end();
}
