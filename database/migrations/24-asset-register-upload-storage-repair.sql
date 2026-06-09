-- Repairs live databases where public.asset_register_uploads already existed
-- without the expected data bytea column.
--
-- Symptom fixed:
--   column "data" of relation "asset_register_uploads" does not exist
--
-- This migration is safe to run more than once from DBeaver.

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
    'file_data',
    'upload_data',
    'blob_data',
    'binary_data',
    'file_bytes',
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
where id is null
   or file_name is null
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

do $$
begin
  if not exists (
    select 1
    from public.asset_register_uploads
    where id is null
       or user_id is null
       or file_name is null
       or content_type is null
       or byte_size is null
       or created_at is null
  ) then
    alter table public.asset_register_uploads
      alter column id set not null,
      alter column user_id set not null,
      alter column file_name set not null,
      alter column content_type set not null,
      alter column byte_size set not null,
      alter column created_at set not null;
  end if;

  if not exists (
    select 1
    from public.asset_register_uploads
    where data is null
  ) then
    alter table public.asset_register_uploads
      alter column data set not null;
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class table_row on table_row.oid = constraint_row.conrelid
    join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'public'
      and table_row.relname = 'asset_register_uploads'
      and constraint_row.contype = 'p'
  )
  and not exists (
    select 1
    from public.asset_register_uploads
    where id is null
  )
  and not exists (
    select 1
    from (
      select id
      from public.asset_register_uploads
      group by id
      having count(*) > 1
    ) duplicate_ids
  ) then
    alter table public.asset_register_uploads
      add constraint asset_register_uploads_pkey primary key (id);
  end if;
end $$;

create index if not exists asset_register_uploads_user_id_created_at_idx
  on public.asset_register_uploads (user_id, created_at desc);

comment on table public.asset_register_uploads is
  'Binary storage for Asset Register photos, documents and register logos. Asset JSON stores only the short API URL.';

comment on column public.asset_register_uploads.data is
  'Raw uploaded file bytes streamed by /api/asset-register/uploads/<id>.';

commit;
