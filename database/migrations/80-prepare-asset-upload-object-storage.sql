-- Add object-storage metadata without changing the live storage provider.
--
-- This migration is intentionally additive. PostgreSQL remains authoritative,
-- asset_register_uploads.data remains NOT NULL, and no Railway Bucket is
-- contacted. Apply this before enabling AIM4PRICE_UPLOAD_STORAGE_MODE=mirror.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '5min';

do $migration$
begin
  if to_regclass('public.asset_register_uploads') is null then
    raise exception 'public.asset_register_uploads does not exist';
  end if;

  lock table public.asset_register_uploads in access exclusive mode;

  alter table public.asset_register_uploads
    add column if not exists storage_state text,
    add column if not exists object_key text,
    add column if not exists content_sha256 text,
    add column if not exists object_etag text,
    add column if not exists object_verified_at timestamptz,
    add column if not exists upload_category text,
    add column if not exists deleted_at timestamptz,
    add column if not exists purge_after timestamptz;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_register_uploads'
      and (
        (column_name in (
          'storage_state', 'object_key', 'content_sha256', 'object_etag', 'upload_category'
        ) and udt_name not in ('text', 'varchar', 'bpchar'))
        or
        (column_name in ('object_verified_at', 'deleted_at', 'purge_after') and udt_name <> 'timestamptz')
      )
  ) then
    raise exception 'Refusing migration 80: an object-storage metadata column has an unexpected type';
  end if;

  update public.asset_register_uploads
  set
    storage_state = coalesce(nullif(trim(storage_state), ''), 'postgres'),
    upload_category = coalesce(nullif(trim(upload_category), ''), 'other')
  where storage_state is null
     or trim(storage_state) = ''
     or upload_category is null
     or trim(upload_category) = '';

  if exists (select 1 from public.asset_register_uploads where data is null) then
    raise exception 'Refusing migration 80: PostgreSQL upload data contains null values';
  end if;

  alter table public.asset_register_uploads
    alter column data set not null,
    alter column storage_state set default 'postgres',
    alter column storage_state set not null,
    alter column upload_category set default 'other',
    alter column upload_category set not null;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.asset_register_uploads'::regclass
      and conname = 'asset_register_uploads_storage_state_check'
  ) then
    alter table public.asset_register_uploads
      add constraint asset_register_uploads_storage_state_check
      check (storage_state in ('postgres', 'copying', 'dual_verified', 'quarantined'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.asset_register_uploads'::regclass
      and conname = 'asset_register_uploads_verified_object_check'
  ) then
    alter table public.asset_register_uploads
      add constraint asset_register_uploads_verified_object_check
      check (
        storage_state <> 'dual_verified'
        or (
          object_key is not null
          and content_sha256 is not null
          and content_sha256 ~ '^[0-9a-f]{64}$'
          and object_verified_at is not null
          and data is not null
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.asset_register_uploads'::regclass
      and conname = 'asset_register_uploads_object_key_check'
  ) then
    alter table public.asset_register_uploads
      add constraint asset_register_uploads_object_key_check
      check (object_key is null or object_key ~ '^v1/asset-register/[0-9a-z]{2}/[0-9a-z-]{20,80}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.asset_register_uploads'::regclass
      and conname = 'asset_register_uploads_purge_window_check'
  ) then
    alter table public.asset_register_uploads
      add constraint asset_register_uploads_purge_window_check
      check (purge_after is null or deleted_at is not null);
  end if;
end
$migration$;

create unique index if not exists asset_register_uploads_object_key_uidx
  on public.asset_register_uploads (object_key)
  where object_key is not null;

create index if not exists asset_register_uploads_storage_state_created_at_idx
  on public.asset_register_uploads (storage_state, created_at);

create table if not exists public.asset_upload_object_purge_queue (
  id bigserial primary key,
  object_key text not null,
  requested_at timestamptz not null default now(),
  purge_after timestamptz not null default (now() + interval '30 days'),
  attempt_count integer not null default 0,
  last_error text,
  cancelled_at timestamptz,
  purged_at timestamptz
);

alter table public.asset_upload_object_purge_queue
  add column if not exists cancelled_at timestamptz;

create unique index if not exists asset_upload_object_purge_queue_object_key_uidx
  on public.asset_upload_object_purge_queue (object_key);

create index if not exists asset_upload_object_purge_queue_due_idx
  on public.asset_upload_object_purge_queue (purge_after)
  where purged_at is null and cancelled_at is null;

create or replace function public.queue_deleted_asset_upload_object()
returns trigger
language plpgsql
as $function$
begin
  if old.object_key is not null then
    insert into public.asset_upload_object_purge_queue (object_key)
    values (old.object_key)
    on conflict (object_key) do update
    set
      requested_at = now(),
      purge_after = now() + interval '30 days',
      attempt_count = 0,
      last_error = null,
      cancelled_at = null,
      purged_at = null;
  end if;

  return old;
end
$function$;

drop trigger if exists queue_deleted_asset_upload_object_trigger
  on public.asset_register_uploads;

create trigger queue_deleted_asset_upload_object_trigger
after delete on public.asset_register_uploads
for each row
execute function public.queue_deleted_asset_upload_object();

comment on column public.asset_register_uploads.storage_state is
  'postgres = database only; copying = incomplete copy; dual_verified = exact bucket copy verified; quarantined = manual review required.';

comment on column public.asset_register_uploads.content_sha256 is
  'SHA-256 of the actual uploaded bytes. ETags are diagnostic only and are not trusted as checksums.';

comment on column public.asset_register_uploads.object_key is
  'Opaque Railway Bucket key. Never contains a file name, email address or account id.';

comment on table public.asset_upload_object_purge_queue is
  '30-day application-managed deletion delay for Bucket objects whose upload metadata row was deleted; this queue does not restore metadata.';

commit;
