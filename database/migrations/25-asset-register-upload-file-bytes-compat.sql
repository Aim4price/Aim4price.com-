-- Repairs live databases where public.asset_register_uploads has an older
-- file_bytes bytea not-null column in addition to, or instead of, the newer
-- data bytea column.
--
-- Symptom fixed:
--   null value in column "file_bytes" of relation "asset_register_uploads" violates not-null constraint
--
-- Safe to run more than once from DBeaver.

begin;

create table if not exists public.asset_register_uploads (
  id text primary key,
  user_id text,
  file_name text,
  content_type text,
  byte_size integer,
  data bytea,
  created_at timestamptz
);

alter table public.asset_register_uploads
  add column if not exists id text,
  add column if not exists user_id text,
  add column if not exists file_name text,
  add column if not exists content_type text,
  add column if not exists byte_size integer,
  add column if not exists data bytea,
  add column if not exists created_at timestamptz;

do $$
declare
  source_column text;
begin
  foreach source_column in array array[
    'file_bytes',
    'file_data',
    'upload_data',
    'blob_data',
    'binary_data',
    'bytes',
    'content',
    'body'
  ] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'asset_register_uploads'
        and column_name = source_column
        and udt_name = 'bytea'
    ) then
      execute format(
        'update public.asset_register_uploads set data = %I where data is null and %I is not null',
        source_column,
        source_column
      );
    end if;
  end loop;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_register_uploads'
      and column_name = 'file_bytes'
      and udt_name = 'bytea'
  ) then
    execute 'update public.asset_register_uploads set file_bytes = data where file_bytes is null and data is not null';
  end if;
end $$;

do $$
declare
  legacy_column text;
begin
  foreach legacy_column in array array[
    'file_bytes',
    'file_data',
    'upload_data',
    'blob_data',
    'binary_data',
    'bytes',
    'content',
    'body',
    'filename',
    'name',
    'original_name',
    'original_file_name',
    'mime_type',
    'mime',
    'type',
    'size_bytes',
    'size',
    'file_size',
    'owner_id',
    'created_by',
    'uploaded_by',
    'account_id',
    'uploaded_at',
    'created_on',
    'updated_at'
  ] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'asset_register_uploads'
        and column_name = legacy_column
        and is_nullable = 'NO'
    ) then
      execute format(
        'alter table public.asset_register_uploads alter column %I drop not null',
        legacy_column
      );
    end if;
  end loop;
end $$;

do $$
declare
  source_column text;
begin
  foreach source_column in array array['filename', 'name', 'original_name', 'original_file_name'] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'asset_register_uploads'
        and column_name = source_column
        and udt_name in ('text', 'varchar', 'bpchar')
    ) then
      execute format(
        'update public.asset_register_uploads set file_name = %I where file_name is null and %I is not null',
        source_column,
        source_column
      );
    end if;
  end loop;

  foreach source_column in array array['mime_type', 'mime', 'type'] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'asset_register_uploads'
        and column_name = source_column
        and udt_name in ('text', 'varchar', 'bpchar')
    ) then
      execute format(
        'update public.asset_register_uploads set content_type = %I where content_type is null and %I is not null',
        source_column,
        source_column
      );
    end if;
  end loop;

  foreach source_column in array array['size_bytes', 'size', 'file_size'] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'asset_register_uploads'
        and column_name = source_column
        and udt_name in ('int2', 'int4', 'int8', 'numeric', 'float4', 'float8')
    ) then
      execute format(
        'update public.asset_register_uploads set byte_size = greatest(0, round(coalesce(%I, 0)::numeric)::integer) where byte_size is null and %I is not null',
        source_column,
        source_column
      );
    end if;
  end loop;
end $$;

update public.asset_register_uploads
set
  file_name = coalesce(nullif(file_name, ''), 'asset-register-upload'),
  content_type = coalesce(nullif(content_type, ''), 'application/octet-stream'),
  byte_size = coalesce(byte_size, octet_length(data), 0),
  created_at = coalesce(created_at, now())
where file_name is null
   or file_name = ''
   or content_type is null
   or content_type = ''
   or byte_size is null
   or created_at is null;

alter table public.asset_register_uploads
  alter column file_name set default 'asset-register-upload',
  alter column content_type set default 'application/octet-stream',
  alter column byte_size set default 0,
  alter column created_at set default now();

create index if not exists asset_register_uploads_user_id_created_at_idx
  on public.asset_register_uploads (user_id, created_at desc);

comment on table public.asset_register_uploads is
  'Binary storage for Asset Register photos, documents and register logos. Asset JSON stores only the short API URL.';

comment on column public.asset_register_uploads.data is
  'Raw uploaded file bytes streamed by /api/asset-register/uploads/<id>.';

commit;
