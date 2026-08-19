-- Create the catalog used by new Bucket-only Asset Register uploads.
--
-- This migration is deliberately separate from public.asset_register_uploads:
-- the legacy table and its PostgreSQL bytea payload remain unchanged. There is
-- no backfill, no object-store connection, and no Bucket write in this step.

begin;

-- Fail quickly rather than waiting behind an active upload or long-running DDL.
set local lock_timeout = '5s';
set local statement_timeout = '5min';

do $preflight$
declare
  relation_kind text;
begin
  if to_regclass('public.asset_register_uploads') is null then
    raise exception 'Refusing Bucket catalog migration: public.asset_register_uploads is missing; migration 80 is required';
  end if;

  select relation.relkind::text
  into relation_kind
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'asset_register_uploads';

  if relation_kind <> 'r' then
    raise exception 'Refusing Bucket catalog migration: public.asset_register_uploads is not an ordinary table';
  end if;

  -- Keep the migration-80 schema stable while its catalog contract is checked.
  -- ACCESS SHARE does not alter rows and only conflicts with destructive DDL.
  lock table public.asset_register_uploads in access share mode;

  if exists (
    select 1
    from (
      values
        ('id',                 'text',        'NO'),
        ('user_id',            'text',        'NO'),
        ('file_name',          'text',        'NO'),
        ('content_type',       'text',        'NO'),
        ('byte_size',          'int4',        'NO'),
        ('data',               'bytea',       'NO'),
        ('created_at',         'timestamptz', 'NO'),
        ('storage_state',      'text',        'NO'),
        ('object_key',         'text',        'YES'),
        ('content_sha256',     'text',        'YES'),
        ('object_etag',        'text',        'YES'),
        ('object_verified_at', 'timestamptz', 'YES'),
        ('upload_category',    'text',        'NO'),
        ('deleted_at',         'timestamptz', 'YES'),
        ('purge_after',        'timestamptz', 'YES')
    ) as expected(column_name, udt_name, is_nullable)
    left join information_schema.columns as actual
      on actual.table_schema = 'public'
     and actual.table_name = 'asset_register_uploads'
     and actual.column_name = expected.column_name
    where actual.column_name is null
       or actual.udt_name <> expected.udt_name
       or actual.is_nullable <> expected.is_nullable
  ) then
    raise exception 'Refusing Bucket catalog migration: public.asset_register_uploads is incompatible with migration 80';
  end if;

  if exists (
    select 1
    from (
      values
        ('asset_register_uploads_storage_state_check'),
        ('asset_register_uploads_verified_object_check'),
        ('asset_register_uploads_object_key_check'),
        ('asset_register_uploads_purge_window_check')
    ) as expected(constraint_name)
    where not exists (
      select 1
      from pg_catalog.pg_constraint as constraint_record
      where constraint_record.conrelid = 'public.asset_register_uploads'::regclass
        and constraint_record.conname = expected.constraint_name
        and constraint_record.contype = 'c'
        and constraint_record.convalidated
    )
  ) then
    raise exception 'Refusing Bucket catalog migration: required migration-80 constraints are missing or unvalidated';
  end if;

  if to_regclass('public.asset_register_uploads_object_key_uidx') is null
     or to_regclass('public.asset_upload_object_purge_queue') is null then
    raise exception 'Refusing Bucket catalog migration: required migration-80 index or purge queue is missing';
  end if;

  -- CREATE TABLE IF NOT EXISTS must not silently accept a view, partition, or
  -- other relation that happens to use the intended catalog name.
  if to_regclass('public.asset_register_bucket_uploads') is not null then
    select relation.relkind::text
    into relation_kind
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'asset_register_bucket_uploads';

    if relation_kind <> 'r' then
      raise exception 'Refusing Bucket catalog migration: public.asset_register_bucket_uploads exists but is not an ordinary table';
    end if;
  end if;

  if to_regclass('public.asset_register_bucket_upload_purge_queue') is not null then
    select relation.relkind::text
    into relation_kind
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'asset_register_bucket_upload_purge_queue';

    if relation_kind <> 'r' then
      raise exception 'Refusing Bucket catalog migration: public.asset_register_bucket_upload_purge_queue exists but is not an ordinary table';
    end if;
  end if;

  if to_regclass('public.asset_register_bucket_deleted_accounts') is not null then
    select relation.relkind::text
    into relation_kind
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'asset_register_bucket_deleted_accounts';

    if relation_kind <> 'r' then
      raise exception 'Refusing Bucket catalog migration: public.asset_register_bucket_deleted_accounts exists but is not an ordinary table';
    end if;
  end if;
end
$preflight$;

create table if not exists public.asset_register_bucket_uploads (
  id text not null,
  user_id text not null,
  file_name text not null,
  content_type text not null,
  byte_size bigint not null,
  object_key text,
  content_sha256 text,
  object_etag text,
  storage_state text not null default 'pending',
  upload_category text not null default 'other',
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  deletion_started_at timestamptz,
  last_error text,

  constraint asset_register_bucket_uploads_pkey
    primary key (id),
  constraint asset_register_bucket_uploads_object_key_key
    unique (object_key),
  constraint asset_register_bucket_uploads_id_format_check
    check (id ~ '^bkt-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  constraint asset_register_bucket_uploads_user_id_check
    check (btrim(user_id) <> ''),
  constraint asset_register_bucket_uploads_file_name_check
    check (btrim(file_name) <> ''),
  constraint asset_register_bucket_uploads_content_type_check
    check (btrim(content_type) <> ''),
  constraint asset_register_bucket_uploads_byte_size_check
    check (byte_size > 0),
  constraint asset_register_bucket_uploads_object_key_check
    check (
      object_key is null
      or object_key = (
        'v2/asset-register/' || substring(id from 5 for 2) || '/' || id
      )
    ),
  constraint asset_register_bucket_uploads_content_sha256_check
    check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint asset_register_bucket_uploads_object_etag_check
    check (object_etag is null or btrim(object_etag) <> ''),
  constraint asset_register_bucket_uploads_storage_state_check
    check (storage_state in ('pending', 'ready', 'deleting', 'delete_failed')),
  constraint asset_register_bucket_uploads_upload_category_check
    check (btrim(upload_category) <> ''),
  constraint asset_register_bucket_uploads_last_error_check
    check (last_error is null or btrim(last_error) <> ''),
  constraint asset_register_bucket_uploads_verified_metadata_check
    check (
      verified_at is null
      or (object_key is not null and content_sha256 is not null)
    ),
  constraint asset_register_bucket_uploads_timestamp_order_check
    check (
      (verified_at is null or verified_at >= created_at)
      and (deletion_started_at is null or deletion_started_at >= created_at)
    ),
  constraint asset_register_bucket_uploads_state_metadata_check
    check (
      (
        storage_state = 'pending'
        and deletion_started_at is null
      )
      or (
        storage_state = 'ready'
        and object_key is not null
        and content_sha256 is not null
        and verified_at is not null
        and deletion_started_at is null
        and last_error is null
      )
      or (
        storage_state = 'deleting'
        and object_key is not null
        and content_sha256 is not null
        and verified_at is not null
        and deletion_started_at is not null
        and last_error is null
      )
      or (
        storage_state = 'delete_failed'
        and object_key is not null
        and content_sha256 is not null
        and verified_at is not null
        and deletion_started_at is not null
        and last_error is not null
      )
    )
);

do $validate_catalog$
begin
  -- A rerun is accepted only when the pre-existing catalog has the exact
  -- required column contract. No repair UPDATE or backfill is attempted.
  lock table public.asset_register_bucket_uploads in share mode;

  if exists (
    select 1
    from (
      values
        ('id',                  'text',        'NO'),
        ('user_id',             'text',        'NO'),
        ('file_name',           'text',        'NO'),
        ('content_type',        'text',        'NO'),
        ('byte_size',           'int8',        'NO'),
        ('object_key',          'text',        'YES'),
        ('content_sha256',      'text',        'YES'),
        ('object_etag',         'text',        'YES'),
        ('storage_state',       'text',        'NO'),
        ('upload_category',     'text',        'NO'),
        ('created_at',          'timestamptz', 'NO'),
        ('verified_at',         'timestamptz', 'YES'),
        ('deletion_started_at', 'timestamptz', 'YES'),
        ('last_error',          'text',        'YES')
    ) as expected(column_name, udt_name, is_nullable)
    left join information_schema.columns as actual
      on actual.table_schema = 'public'
     and actual.table_name = 'asset_register_bucket_uploads'
     and actual.column_name = expected.column_name
    where actual.column_name is null
       or actual.udt_name <> expected.udt_name
       or actual.is_nullable <> expected.is_nullable
  ) then
    raise exception 'Refusing Bucket catalog migration: public.asset_register_bucket_uploads has incompatible columns';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_register_bucket_uploads'
      and (
        column_name in ('data', 'file_bytes')
        or udt_name = 'bytea'
      )
  ) then
    raise exception 'Refusing Bucket catalog migration: Bucket-only catalog must not contain PostgreSQL file bytes';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_register_bucket_uploads'
      and column_name = 'storage_state'
      and column_default = '''pending''::text'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_register_bucket_uploads'
      and column_name = 'upload_category'
      and column_default = '''other''::text'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_register_bucket_uploads'
      and column_name = 'created_at'
      and column_default = 'now()'
  ) then
    raise exception 'Refusing Bucket catalog migration: Bucket catalog defaults are incompatible';
  end if;

  if exists (
    select 1
    from (
      values
        ('asset_register_bucket_uploads_pkey', 'p'),
        ('asset_register_bucket_uploads_object_key_key', 'u'),
        ('asset_register_bucket_uploads_id_format_check', 'c'),
        ('asset_register_bucket_uploads_user_id_check', 'c'),
        ('asset_register_bucket_uploads_file_name_check', 'c'),
        ('asset_register_bucket_uploads_content_type_check', 'c'),
        ('asset_register_bucket_uploads_byte_size_check', 'c'),
        ('asset_register_bucket_uploads_object_key_check', 'c'),
        ('asset_register_bucket_uploads_content_sha256_check', 'c'),
        ('asset_register_bucket_uploads_object_etag_check', 'c'),
        ('asset_register_bucket_uploads_storage_state_check', 'c'),
        ('asset_register_bucket_uploads_upload_category_check', 'c'),
        ('asset_register_bucket_uploads_last_error_check', 'c'),
        ('asset_register_bucket_uploads_verified_metadata_check', 'c'),
        ('asset_register_bucket_uploads_timestamp_order_check', 'c'),
        ('asset_register_bucket_uploads_state_metadata_check', 'c')
    ) as expected(constraint_name, constraint_type)
    where not exists (
      select 1
      from pg_catalog.pg_constraint as constraint_record
      where constraint_record.conrelid = 'public.asset_register_bucket_uploads'::regclass
        and constraint_record.conname = expected.constraint_name
        and constraint_record.contype = expected.constraint_type::"char"
        and constraint_record.convalidated
    )
  ) then
    raise exception 'Refusing Bucket catalog migration: Bucket catalog constraints are incompatible';
  end if;
end
$validate_catalog$;

create table if not exists public.asset_register_bucket_upload_purge_queue (
  upload_id text not null,
  user_id text not null,
  object_key text not null,
  byte_size bigint not null,
  queued_at timestamptz not null default now(),
  purge_after timestamptz not null default (now() + interval '30 days'),
  purged_at timestamptz,
  last_error text,

  constraint asset_register_bucket_upload_purge_queue_pkey
    primary key (upload_id),
  constraint asset_register_bucket_upload_purge_queue_object_key_key
    unique (object_key),
  constraint asset_register_bucket_upload_purge_queue_upload_id_format_check
    check (upload_id ~ '^bkt-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  constraint asset_register_bucket_upload_purge_queue_user_id_check
    check (btrim(user_id) <> ''),
  constraint asset_register_bucket_upload_purge_queue_object_key_check
    check (
      object_key = (
        'v2/asset-register/' || substring(upload_id from 5 for 2) || '/' || upload_id
      )
    ),
  constraint asset_register_bucket_upload_purge_queue_byte_size_check
    check (byte_size > 0),
  constraint asset_register_bucket_upload_purge_queue_purge_window_check
    check (
      purge_after >= queued_at
      and (purged_at is null or purged_at >= queued_at)
    ),
  constraint asset_register_bucket_upload_purge_queue_last_error_check
    check (last_error is null or btrim(last_error) <> '')
);

do $validate_purge_queue$
begin
  lock table public.asset_register_bucket_upload_purge_queue in share mode;

  if exists (
    select 1
    from (
      values
        ('upload_id',   'text',        'NO'),
        ('user_id',     'text',        'NO'),
        ('object_key',  'text',        'NO'),
        ('byte_size',   'int8',        'NO'),
        ('queued_at',   'timestamptz', 'NO'),
        ('purge_after', 'timestamptz', 'NO'),
        ('purged_at',   'timestamptz', 'YES'),
        ('last_error',  'text',        'YES')
    ) as expected(column_name, udt_name, is_nullable)
    left join information_schema.columns as actual
      on actual.table_schema = 'public'
     and actual.table_name = 'asset_register_bucket_upload_purge_queue'
     and actual.column_name = expected.column_name
    where actual.column_name is null
       or actual.udt_name <> expected.udt_name
       or actual.is_nullable <> expected.is_nullable
  ) then
    raise exception 'Refusing Bucket catalog migration: Bucket purge queue has incompatible columns';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_register_bucket_upload_purge_queue'
      and column_name = 'queued_at'
      and column_default = 'now()'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_register_bucket_upload_purge_queue'
      and column_name = 'purge_after'
      and column_default like '%30 days%'
  ) then
    raise exception 'Refusing Bucket catalog migration: Bucket purge queue defaults are incompatible';
  end if;

  if exists (
    select 1
    from (
      values
        ('asset_register_bucket_upload_purge_queue_pkey', 'p'),
        ('asset_register_bucket_upload_purge_queue_object_key_key', 'u'),
        ('asset_register_bucket_upload_purge_queue_upload_id_format_check', 'c'),
        ('asset_register_bucket_upload_purge_queue_user_id_check', 'c'),
        ('asset_register_bucket_upload_purge_queue_object_key_check', 'c'),
        ('asset_register_bucket_upload_purge_queue_byte_size_check', 'c'),
        ('asset_register_bucket_upload_purge_queue_purge_window_check', 'c'),
        ('asset_register_bucket_upload_purge_queue_last_error_check', 'c')
    ) as expected(constraint_name, constraint_type)
    where not exists (
      select 1
      from pg_catalog.pg_constraint as constraint_record
      where constraint_record.conrelid = 'public.asset_register_bucket_upload_purge_queue'::regclass
        and constraint_record.conname = expected.constraint_name
        and constraint_record.contype = expected.constraint_type::"char"
        and constraint_record.convalidated
    )
  ) then
    raise exception 'Refusing Bucket catalog migration: Bucket purge queue constraints are incompatible';
  end if;
end
$validate_purge_queue$;

create table if not exists public.asset_register_bucket_deleted_accounts (
  user_id text not null,
  deletion_started_at timestamptz not null default now(),

  constraint asset_register_bucket_deleted_accounts_pkey
    primary key (user_id),
  constraint asset_register_bucket_deleted_accounts_user_id_check
    check (btrim(user_id) <> '')
);

do $validate_deleted_accounts$
begin
  lock table public.asset_register_bucket_deleted_accounts in share mode;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_register_bucket_deleted_accounts'
  ) <> 2 or exists (
    select 1
    from (
      values
        ('user_id',             'text',        'NO'),
        ('deletion_started_at', 'timestamptz', 'NO')
    ) as expected(column_name, udt_name, is_nullable)
    left join information_schema.columns as actual
      on actual.table_schema = 'public'
     and actual.table_name = 'asset_register_bucket_deleted_accounts'
     and actual.column_name = expected.column_name
    where actual.column_name is null
       or actual.udt_name <> expected.udt_name
       or actual.is_nullable <> expected.is_nullable
  ) then
    raise exception 'Refusing Bucket catalog migration: deleted-account tombstone has incompatible columns';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_register_bucket_deleted_accounts'
      and column_name = 'deletion_started_at'
      and column_default = 'now()'
  ) then
    raise exception 'Refusing Bucket catalog migration: deleted-account tombstone default is incompatible';
  end if;

  if exists (
    select 1
    from (
      values
        ('asset_register_bucket_deleted_accounts_pkey', 'p'),
        ('asset_register_bucket_deleted_accounts_user_id_check', 'c')
    ) as expected(constraint_name, constraint_type)
    where not exists (
      select 1
      from pg_catalog.pg_constraint as constraint_record
      where constraint_record.conrelid = 'public.asset_register_bucket_deleted_accounts'::regclass
        and constraint_record.conname = expected.constraint_name
        and constraint_record.contype = expected.constraint_type::"char"
        and constraint_record.convalidated
    )
  ) then
    raise exception 'Refusing Bucket catalog migration: deleted-account tombstone constraints are incompatible';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    where constraint_record.conrelid = 'public.asset_register_bucket_deleted_accounts'::regclass
      and constraint_record.contype = 'f'
  ) then
    raise exception 'Refusing Bucket catalog migration: deleted-account tombstone must not have a foreign key';
  end if;
end
$validate_deleted_accounts$;

create index if not exists asset_register_bucket_uploads_user_created_idx
  on public.asset_register_bucket_uploads (user_id, created_at desc);

create index if not exists asset_register_bucket_uploads_state_created_idx
  on public.asset_register_bucket_uploads (storage_state, created_at);

create index if not exists asset_register_bucket_upload_purge_queue_due_idx
  on public.asset_register_bucket_upload_purge_queue (purge_after)
  where purged_at is null;

do $validate_indexes$
begin
  if exists (
    select 1
    from (
      values
        ('asset_register_bucket_uploads_user_created_idx', '(user_id, created_at DESC)'),
        ('asset_register_bucket_uploads_state_created_idx', '(storage_state, created_at)'),
        ('asset_register_bucket_upload_purge_queue_due_idx', '(purge_after)')
    ) as expected(index_name, indexed_columns)
    where not exists (
      select 1
      from pg_catalog.pg_class as index_relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = index_relation.relnamespace
      join pg_catalog.pg_index as index_record
        on index_record.indexrelid = index_relation.oid
      where namespace.nspname = 'public'
        and index_relation.relname = expected.index_name
        and index_record.indrelid = case
          when expected.index_name = 'asset_register_bucket_upload_purge_queue_due_idx'
            then 'public.asset_register_bucket_upload_purge_queue'::regclass
          else 'public.asset_register_bucket_uploads'::regclass
        end
        and index_record.indisvalid
        and index_record.indisready
        and pg_catalog.pg_get_indexdef(index_relation.oid) like '%' || expected.indexed_columns || '%'
        and (
          expected.index_name <> 'asset_register_bucket_upload_purge_queue_due_idx'
          or regexp_replace(
            lower(pg_catalog.pg_get_expr(index_record.indpred, index_record.indrelid)),
            '\s+',
            ' ',
            'g'
          ) in ('purged_at is null', '(purged_at is null)')
        )
    )
  ) then
    raise exception 'Refusing Bucket catalog migration: Bucket catalog indexes are incompatible';
  end if;
end
$validate_indexes$;

create or replace function public.queue_deleted_bucket_upload()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
begin
  -- A pending row without an object key cannot identify a Bucket object and
  -- therefore has nothing that can be queued for physical deletion.
  if old.object_key is null then
    return old;
  end if;

  -- The same opaque object key must never be reassigned to another upload.
  -- Raising here rolls back the catalog DELETE instead of losing the only
  -- trustworthy mapping to a private object.
  if exists (
    select 1
    from public.asset_register_bucket_upload_purge_queue as queued
    where queued.object_key = old.object_key
      and (
        queued.upload_id <> old.id
        or queued.user_id <> old.user_id
        or queued.byte_size <> old.byte_size
      )
  ) then
    raise exception 'Refusing to queue Bucket upload %: object-key identity conflicts with an existing purge entry', old.id;
  end if;

  insert into public.asset_register_bucket_upload_purge_queue as queued (
    upload_id,
    user_id,
    object_key,
    byte_size
  ) values (
    old.id,
    old.user_id,
    old.object_key,
    old.byte_size
  )
  on conflict (object_key) do update
  set
    queued_at = least(queued.queued_at, excluded.queued_at),
    purge_after = least(queued.purge_after, excluded.purge_after),
    purged_at = null,
    last_error = null;

  return old;
end
$function$;

do $install_delete_trigger$
begin
  if exists (
    select 1
    from pg_catalog.pg_trigger as trigger_record
    where trigger_record.tgrelid = 'public.asset_register_bucket_uploads'::regclass
      and trigger_record.tgname = 'queue_deleted_bucket_upload_trigger'
      and not trigger_record.tgisinternal
  ) then
    if not exists (
      select 1
      from pg_catalog.pg_trigger as trigger_record
      where trigger_record.tgrelid = 'public.asset_register_bucket_uploads'::regclass
        and trigger_record.tgname = 'queue_deleted_bucket_upload_trigger'
        and not trigger_record.tgisinternal
        and trigger_record.tgenabled = 'O'
        and trigger_record.tgtype = 9
        and trigger_record.tgfoid = 'public.queue_deleted_bucket_upload()'::regprocedure
    ) then
      raise exception 'Refusing Bucket catalog migration: queue_deleted_bucket_upload_trigger is incompatible';
    end if;
  else
    execute $trigger$
      create trigger queue_deleted_bucket_upload_trigger
      after delete on public.asset_register_bucket_uploads
      for each row
      execute function public.queue_deleted_bucket_upload()
    $trigger$;
  end if;
end
$install_delete_trigger$;

do $validate_delete_guard$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure_record
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure_record.pronamespace
    join pg_catalog.pg_language as language_record
      on language_record.oid = procedure_record.prolang
    where namespace.nspname = 'public'
      and procedure_record.proname = 'queue_deleted_bucket_upload'
      and procedure_record.prokind = 'f'
      and procedure_record.pronargs = 0
      and procedure_record.prorettype = 'trigger'::regtype
      and language_record.lanname = 'plpgsql'
      and not procedure_record.prosecdef
      and procedure_record.proconfig @> array['search_path=pg_catalog, public']::text[]
  ) then
    raise exception 'Refusing Bucket catalog migration: queue_deleted_bucket_upload() is not a SECURITY INVOKER trigger function';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_record
    where trigger_record.tgrelid = 'public.asset_register_bucket_uploads'::regclass
      and trigger_record.tgname = 'queue_deleted_bucket_upload_trigger'
      and not trigger_record.tgisinternal
      and trigger_record.tgenabled = 'O'
      and trigger_record.tgtype = 9
      and trigger_record.tgfoid = 'public.queue_deleted_bucket_upload()'::regprocedure
  ) then
    raise exception 'Refusing Bucket catalog migration: queue_deleted_bucket_upload_trigger was not installed safely';
  end if;
end
$validate_delete_guard$;

comment on table public.asset_register_bucket_uploads is
  'Metadata catalog for new Asset Register uploads stored only in a Railway Bucket. It contains no file bytes and does not replace or backfill asset_register_uploads.';

comment on column public.asset_register_bucket_uploads.id is
  'Application-generated opaque identifier in canonical bkt-<UUIDv4> form.';

comment on column public.asset_register_bucket_uploads.user_id is
  'Owner scope used for authorization. This value must never be embedded in object_key.';

comment on column public.asset_register_bucket_uploads.file_name is
  'Original display name. It is metadata only and must never be embedded in object_key.';

comment on column public.asset_register_bucket_uploads.content_type is
  'Validated media type reported for download handling.';

comment on column public.asset_register_bucket_uploads.byte_size is
  'Expected number of bytes in the Bucket object.';

comment on column public.asset_register_bucket_uploads.object_key is
  'Unique opaque Bucket key. It may be populated while pending and is mandatory once ready.';

comment on column public.asset_register_bucket_uploads.content_sha256 is
  'Lowercase SHA-256 of exact object bytes; mandatory once ready.';

comment on column public.asset_register_bucket_uploads.object_etag is
  'Optional diagnostic object-store ETag. It is not trusted as a content checksum.';

comment on column public.asset_register_bucket_uploads.storage_state is
  'pending permits staged object metadata; ready is verified; deleting and delete_failed require a recorded deletion start.';

comment on column public.asset_register_bucket_uploads.upload_category is
  'Application classification used for reporting and retention policy.';

comment on column public.asset_register_bucket_uploads.created_at is
  'Time the Bucket-only catalog row was created.';

comment on column public.asset_register_bucket_uploads.verified_at is
  'Time an exact object read-back was verified against content_sha256.';

comment on column public.asset_register_bucket_uploads.deletion_started_at is
  'Time application-managed object deletion began; required for deletion states.';

comment on column public.asset_register_bucket_uploads.last_error is
  'Latest non-empty upload or deletion error; mandatory in delete_failed state.';

comment on table public.asset_register_bucket_upload_purge_queue is
  'Minimal metadata retained for 30 days after a Bucket-only catalog row is deleted so the exact private object can be purged safely.';

comment on column public.asset_register_bucket_upload_purge_queue.upload_id is
  'Original bkt-<UUIDv4> upload identity. This queue intentionally has no foreign key to the deleted catalog row.';

comment on column public.asset_register_bucket_upload_purge_queue.user_id is
  'Former owner scope retained only for purge auditing and account-deletion verification.';

comment on column public.asset_register_bucket_upload_purge_queue.object_key is
  'Unique exact private Bucket key copied from deleted server-side metadata.';

comment on column public.asset_register_bucket_upload_purge_queue.byte_size is
  'Expected object bytes copied from the deleted catalog row for cost and purge auditing.';

comment on column public.asset_register_bucket_upload_purge_queue.queued_at is
  'Earliest time this object was queued for deferred deletion.';

comment on column public.asset_register_bucket_upload_purge_queue.purge_after is
  'Earliest allowed physical purge time; repeated queue attempts never postpone it.';

comment on column public.asset_register_bucket_upload_purge_queue.purged_at is
  'Time the exact object was confirmed physically deleted.';

comment on column public.asset_register_bucket_upload_purge_queue.last_error is
  'Latest non-empty physical-purge failure, if any.';

comment on function public.queue_deleted_bucket_upload() is
  'SECURITY INVOKER trigger function that copies exact Bucket metadata into the 30-day purge queue without contacting the Bucket.';

comment on trigger queue_deleted_bucket_upload_trigger on public.asset_register_bucket_uploads is
  'Queues exact object metadata after catalog deletion; an incompatible existing queue identity aborts and rolls back the delete.';

comment on table public.asset_register_bucket_deleted_accounts is
  'Durable account-deletion tombstones used to reject post-hook Bucket uploads while authentication-user deletion completes later outside the workspace cleanup transaction.';

comment on column public.asset_register_bucket_deleted_accounts.user_id is
  'Deleted account scope serialized with the same per-account lock used by Bucket-only uploads; intentionally has no foreign key.';

comment on column public.asset_register_bucket_deleted_accounts.deletion_started_at is
  'Time workspace deletion started; retained so later upload attempts fail closed even before the authentication user is removed.';

commit;
