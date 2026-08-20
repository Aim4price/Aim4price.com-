-- Durable lifecycle guards for assisted-capture source files.
--
-- Public Invoice Drop bytes are staged in a private quarantine prefix before
-- the capture request exists. Authenticated/dealer uploads are likewise
-- created before document_capture_files can link them. These two queues make
-- those short attachment windows recoverable across request failures and
-- process crashes. Existing asset-upload delete triggers remain responsible
-- for the eventual physical purge of promoted upload objects.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '5min';

do $preflight$
begin
  if to_regclass('public.document_capture_requests') is null
     or to_regclass('public.document_capture_files') is null then
    raise exception 'Refusing assisted-capture lifecycle migration: migration 83 is required';
  end if;

  if to_regclass('public.asset_register_uploads') is null
     or to_regclass('public.asset_upload_object_purge_queue') is null then
    raise exception 'Refusing assisted-capture lifecycle migration: migration 80 is required';
  end if;

  if to_regclass('public.asset_register_bucket_uploads') is null
     or to_regclass('public.asset_register_bucket_upload_purge_queue') is null then
    raise exception 'Refusing assisted-capture lifecycle migration: migration 81 is required';
  end if;
end
$preflight$;

create table if not exists public.capture_quarantine_object_purge_queue (
  storage_key text not null,
  queued_at timestamptz not null default now(),
  purge_after timestamptz not null default now(),
  reason text not null,
  attempt_count integer not null default 0,
  last_error text,
  cancelled_at timestamptz,
  purged_at timestamptz,

  constraint capture_quarantine_object_purge_queue_pkey
    primary key (storage_key),
  constraint capture_quarantine_object_purge_queue_key_check
    check (
      storage_key ~ '^v1/capture-quarantine/[0-9a-f]{2}/20[0-9]{2}/(0[1-9]|1[0-2])/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ),
  constraint capture_quarantine_object_purge_queue_reason_check
    check (btrim(reason) <> ''),
  constraint capture_quarantine_object_purge_queue_attempt_check
    check (attempt_count >= 0),
  constraint capture_quarantine_object_purge_queue_time_check
    check (
      purge_after >= queued_at
      and (cancelled_at is null or cancelled_at >= queued_at)
      and (purged_at is null or purged_at >= queued_at)
    ),
  constraint capture_quarantine_object_purge_queue_error_check
    check (last_error is null or btrim(last_error) <> '')
);

create index if not exists capture_quarantine_object_purge_queue_due_idx
  on public.capture_quarantine_object_purge_queue (purge_after, queued_at)
  where purged_at is null and cancelled_at is null;

create table if not exists public.capture_asset_upload_cleanup_queue (
  upload_id text not null,
  owner_user_id text not null,
  queued_at timestamptz not null default now(),
  cleanup_after timestamptz not null default (now() + interval '1 hour'),
  reason text not null,
  attempt_count integer not null default 0,
  last_error text,
  cancelled_at timestamptz,
  cleaned_at timestamptz,

  constraint capture_asset_upload_cleanup_queue_pkey
    primary key (upload_id),
  constraint capture_asset_upload_cleanup_queue_upload_id_check
    check (
      upload_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or upload_id ~ '^bkt-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ),
  constraint capture_asset_upload_cleanup_queue_owner_check
    check (btrim(owner_user_id) <> ''),
  constraint capture_asset_upload_cleanup_queue_reason_check
    check (btrim(reason) <> ''),
  constraint capture_asset_upload_cleanup_queue_attempt_check
    check (attempt_count >= 0),
  constraint capture_asset_upload_cleanup_queue_time_check
    check (
      cleanup_after >= queued_at
      and (cancelled_at is null or cancelled_at >= queued_at)
      and (cleaned_at is null or cleaned_at >= queued_at)
    ),
  constraint capture_asset_upload_cleanup_queue_error_check
    check (last_error is null or btrim(last_error) <> '')
);

create index if not exists capture_asset_upload_cleanup_queue_due_idx
  on public.capture_asset_upload_cleanup_queue (cleanup_after, queued_at)
  where cleaned_at is null and cancelled_at is null;

create or replace function public.queue_capture_quarantine_object(
  input_storage_key text,
  input_purge_after timestamptz,
  input_reason text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
begin
  if input_storage_key is null
     or input_storage_key !~ '^v1/capture-quarantine/[0-9a-f]{2}/20[0-9]{2}/(0[1-9]|1[0-2])/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Refusing to queue an invalid capture quarantine object key';
  end if;

  insert into public.capture_quarantine_object_purge_queue as queued (
    storage_key,
    purge_after,
    reason
  ) values (
    input_storage_key,
    greatest(coalesce(input_purge_after, now()), now()),
    coalesce(nullif(btrim(input_reason), ''), 'capture_lifecycle')
  )
  on conflict (storage_key) do update
  set
    queued_at = least(queued.queued_at, excluded.queued_at),
    purge_after = least(queued.purge_after, excluded.purge_after),
    reason = excluded.reason,
    attempt_count = 0,
    last_error = null,
    cancelled_at = null,
    purged_at = null;
end
$function$;

create or replace function public.queue_capture_asset_upload_cleanup(
  input_upload_id text,
  input_owner_user_id text,
  input_cleanup_after timestamptz,
  input_reason text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
begin
  if input_upload_id is null or not (
    input_upload_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or input_upload_id ~ '^bkt-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'Refusing to queue an invalid assisted-capture upload id';
  end if;

  if btrim(coalesce(input_owner_user_id, '')) = '' then
    raise exception 'Refusing to queue an assisted-capture upload without its owner';
  end if;

  if exists (
    select 1
    from public.capture_asset_upload_cleanup_queue existing
    where existing.upload_id = input_upload_id
      and existing.owner_user_id <> input_owner_user_id
  ) then
    raise exception 'Refusing an assisted-capture upload cleanup owner conflict';
  end if;

  insert into public.capture_asset_upload_cleanup_queue as queued (
    upload_id,
    owner_user_id,
    cleanup_after,
    reason
  ) values (
    input_upload_id,
    input_owner_user_id,
    greatest(coalesce(input_cleanup_after, now()), now()),
    coalesce(nullif(btrim(input_reason), ''), 'capture_lifecycle')
  )
  on conflict (upload_id) do update
  set
    queued_at = least(queued.queued_at, excluded.queued_at),
    cleanup_after = least(queued.cleanup_after, excluded.cleanup_after),
    reason = excluded.reason,
    attempt_count = 0,
    last_error = null,
    cancelled_at = null,
    cleaned_at = null;
end
$function$;

create or replace function public.queue_new_assisted_capture_upload()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
begin
  if new.upload_category in (
    'assisted-invoice-capture',
    'assisted-fuel-slip-capture',
    'dealer-assisted-invoice-capture'
  ) then
    perform public.queue_capture_asset_upload_cleanup(
      new.id::text,
      new.user_id,
      now() + interval '1 hour',
      'unattached_upload'
    );
  end if;
  return new;
end
$function$;

drop trigger if exists queue_new_assisted_capture_legacy_upload_trigger
  on public.asset_register_uploads;
create trigger queue_new_assisted_capture_legacy_upload_trigger
after insert on public.asset_register_uploads
for each row
execute function public.queue_new_assisted_capture_upload();

drop trigger if exists queue_new_assisted_capture_bucket_upload_trigger
  on public.asset_register_bucket_uploads;
create trigger queue_new_assisted_capture_bucket_upload_trigger
after insert on public.asset_register_bucket_uploads
for each row
execute function public.queue_new_assisted_capture_upload();

create or replace function public.track_document_capture_file_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  request_owner_user_id text;
  linked_upload_id text;
  linked_storage_key text;
  prior_upload_id text;
begin
  if tg_op = 'DELETE' then
    linked_upload_id := old.promoted_upload_id;
    linked_storage_key := old.storage_key;
    select request.owner_user_id
      into request_owner_user_id
      from public.document_capture_requests request
      where request.id = old.capture_request_id;
  else
    linked_upload_id := new.promoted_upload_id;
    linked_storage_key := new.storage_key;
    select request.owner_user_id
      into request_owner_user_id
      from public.document_capture_requests request
      where request.id = new.capture_request_id;
  end if;

  if tg_op = 'UPDATE' then
    prior_upload_id := old.promoted_upload_id;
  end if;

  if linked_storage_key ~ '^v1/capture-quarantine/[0-9a-f]{2}/20[0-9]{2}/(0[1-9]|1[0-2])/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    perform pg_advisory_xact_lock(hashtextextended('capture-quarantine:' || linked_storage_key, 0));

    if tg_op = 'INSERT' and linked_upload_id is null then
      if exists (
        select 1
        from public.capture_quarantine_object_purge_queue queued
        where queued.storage_key = linked_storage_key
          and queued.purged_at is not null
      ) then
        raise exception 'The capture quarantine object was already purged before it could be attached';
      end if;

      update public.capture_quarantine_object_purge_queue
      set cancelled_at = now(), last_error = null
      where storage_key = linked_storage_key
        and purged_at is null;
    elsif tg_op = 'DELETE'
       or (tg_op = 'UPDATE' and linked_upload_id is not null and prior_upload_id is null) then
      perform public.queue_capture_quarantine_object(
        linked_storage_key,
        now(),
        case when tg_op = 'DELETE' then 'capture_file_deleted' else 'capture_file_promoted' end
      );
    end if;
  end if;

  if linked_upload_id is not null and (tg_op <> 'UPDATE' or linked_upload_id is distinct from prior_upload_id) then
    perform pg_advisory_xact_lock(hashtextextended('capture-upload:' || linked_upload_id, 0));

    if tg_op = 'DELETE' then
      if request_owner_user_id is not null then
        perform public.queue_capture_asset_upload_cleanup(
          linked_upload_id,
          request_owner_user_id,
          now(),
          'capture_file_deleted'
        );
      end if;
    else
      if exists (
        select 1
        from public.capture_asset_upload_cleanup_queue queued
        where queued.upload_id = linked_upload_id
          and queued.cleaned_at is not null
      ) then
        raise exception 'The assisted-capture upload was already cleaned before it could be attached';
      end if;

      if exists (
        select 1
        from public.capture_asset_upload_cleanup_queue queued
        where queued.upload_id = linked_upload_id
          and request_owner_user_id is not null
          and queued.owner_user_id <> request_owner_user_id
      ) then
        raise exception 'The assisted-capture upload owner does not match its capture request';
      end if;

      update public.capture_asset_upload_cleanup_queue
      set cancelled_at = now(), last_error = null
      where upload_id = linked_upload_id
        and cleaned_at is null;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$function$;

drop trigger if exists track_document_capture_file_lifecycle_trigger
  on public.document_capture_files;
create trigger track_document_capture_file_lifecycle_trigger
after insert or update of promoted_upload_id or delete
on public.document_capture_files
for each row
execute function public.track_document_capture_file_lifecycle();

create or replace function public.queue_terminal_capture_file_cleanup()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  capture_file record;
begin
  if new.status not in ('declined', 'rejected', 'cancelled')
     or new.status is not distinct from old.status then
    return new;
  end if;

  for capture_file in
    select file.storage_key, file.promoted_upload_id
    from public.document_capture_files file
    where file.capture_request_id = new.id
  loop
    if capture_file.storage_key ~ '^v1/capture-quarantine/[0-9a-f]{2}/20[0-9]{2}/(0[1-9]|1[0-2])/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      perform public.queue_capture_quarantine_object(
        capture_file.storage_key,
        now(),
        'terminal_capture_request'
      );
    end if;

    if capture_file.promoted_upload_id is not null and new.owner_user_id is not null then
      perform public.queue_capture_asset_upload_cleanup(
        capture_file.promoted_upload_id,
        new.owner_user_id,
        now(),
        'terminal_capture_request'
      );
    end if;
  end loop;

  return new;
end
$function$;

drop trigger if exists queue_terminal_capture_file_cleanup_trigger
  on public.document_capture_requests;
create trigger queue_terminal_capture_file_cleanup_trigger
after update of status on public.document_capture_requests
for each row
execute function public.queue_terminal_capture_file_cleanup();

comment on table public.capture_quarantine_object_purge_queue is
  'Durable exact-key deletion queue for private public Invoice Drop quarantine objects. Rows survive capture and account deletion.';
comment on table public.capture_asset_upload_cleanup_queue is
  'Short-lived attachment guard for assisted-capture uploads. Deleting a due unreferenced catalog row delegates physical object purge to migrations 80 and 81.';

commit;
