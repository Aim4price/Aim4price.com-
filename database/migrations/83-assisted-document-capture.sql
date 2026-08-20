-- Human-verified document capture foundation for Cost Ledger invoices, fuel
-- slips and no-account Invoice Drop submissions.
--
-- Capture workflow state is deliberately separate from OCR/extraction state.
-- A request cannot be marked completed until it is linked to exactly one
-- canonical invoice or fuel-slip record.

begin;

create extension if not exists pgcrypto;

-- Composite keys let the database prove that a matched asset or fuel store
-- belongs to the owner recorded on the capture request.
create unique index if not exists idx_asset_register_items_id_user_unique
  on public.asset_register_items (id, user_id);

create unique index if not exists idx_fuel_storage_units_id_user_unique
  on public.fuel_storage_units (id, user_id);

create table if not exists public.asset_invoice_drop_codes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  asset_register_item_id uuid not null,
  code_hash text not null,
  code_last_four text not null,
  is_active boolean not null default true,
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_by_actor_type text not null,
  created_by_user_id text,
  created_by_display_name text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by_user_id text,

  constraint asset_invoice_drop_codes_owner_check
    check (btrim(owner_user_id) <> ''),
  constraint asset_invoice_drop_codes_hash_check
    check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint asset_invoice_drop_codes_last_four_check
    check (code_last_four ~ '^[A-Z0-9]{4}$'),
  constraint asset_invoice_drop_codes_actor_type_check
    check (created_by_actor_type in ('admin', 'owner', 'system')),
  constraint asset_invoice_drop_codes_actor_name_check
    check (btrim(created_by_display_name) <> ''),
  constraint asset_invoice_drop_codes_use_count_check
    check (use_count >= 0),
  constraint asset_invoice_drop_codes_active_timestamp_check
    check (
      (is_active = true and revoked_at is null)
      or (is_active = false and revoked_at is not null)
    ),
  constraint asset_invoice_drop_codes_asset_owner_fkey
    foreign key (asset_register_item_id, owner_user_id)
    references public.asset_register_items (id, user_id)
    on delete cascade
);

create unique index if not exists idx_asset_invoice_drop_codes_hash
  on public.asset_invoice_drop_codes (code_hash);

create unique index if not exists idx_asset_invoice_drop_codes_one_active_asset
  on public.asset_invoice_drop_codes (asset_register_item_id)
  where is_active = true;

create index if not exists idx_asset_invoice_drop_codes_owner_asset
  on public.asset_invoice_drop_codes (owner_user_id, asset_register_item_id, created_at desc);

-- A database-backed throttle keeps the unauthenticated upload allowance
-- consistent across Railway replicas and process restarts. Only a keyed hash
-- of the connection address is retained.
create table if not exists public.public_invoice_drop_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1,
  updated_at timestamptz not null default now(),

  constraint public_invoice_drop_rate_limits_key_check
    check (rate_key ~ '^[0-9a-f]{64}$'),
  constraint public_invoice_drop_rate_limits_count_check
    check (request_count > 0 and request_count <= 1000000)
);

create index if not exists idx_public_invoice_drop_rate_limits_updated
  on public.public_invoice_drop_rate_limits (updated_at);

create table if not exists public.document_capture_requests (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null,
  request_type text not null,
  submission_channel text not null,
  status text not null default 'submitted',

  owner_user_id text,
  asset_register_item_id uuid,
  fuel_storage_id uuid,
  invoice_drop_code_id uuid references public.asset_invoice_drop_codes(id) on delete set null,
  submitted_by_user_id text,

  sender_type text,
  sender_name text,
  sender_business_name text,
  sender_email text,
  sender_phone text,
  asset_reference text,
  requester_note text not null default '',
  admin_note text not null default '',
  needs_information_reason text,

  candidate_payload jsonb not null default '{}'::jsonb,
  captured_payload jsonb not null default '{}'::jsonb,

  assigned_admin_user_id text,
  assigned_admin_display_name text,
  claimed_at timestamptz,

  final_invoice_id uuid references public.asset_invoices(id) on delete restrict,
  final_fuel_slip_id uuid references public.fuel_slips(id) on delete restrict,

  submitted_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '24 hours'),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  completed_at timestamptz,
  version integer not null default 1,

  constraint document_capture_requests_reference_key unique (public_reference),
  constraint document_capture_requests_reference_check
    check (public_reference ~ '^A4P-(INV|FSL)-[A-Z0-9]{10}$'),
  constraint document_capture_requests_type_check
    check (request_type in ('invoice', 'fuel_slip')),
  constraint document_capture_requests_channel_check
    check (submission_channel in ('owner_upload', 'accountant_upload', 'dealer_upload', 'public_drop')),
  constraint document_capture_requests_status_check
    check (status in (
      'submitted',
      'needs_matching',
      'in_progress',
      'needs_information',
      'awaiting_owner',
      'completed',
      'declined',
      'rejected',
      'cancelled'
    )),
  constraint document_capture_requests_sender_type_check
    check (sender_type is null or sender_type in (
      'owner', 'dealer', 'workshop', 'supplier', 'accountant', 'other'
    )),
  constraint document_capture_requests_payload_objects_check
    check (jsonb_typeof(candidate_payload) = 'object' and jsonb_typeof(captured_payload) = 'object'),
  constraint document_capture_requests_version_check
    check (version > 0),
  constraint document_capture_requests_due_check
    check (due_at >= submitted_at),
  constraint document_capture_requests_assignment_check
    check (
      (assigned_admin_user_id is null and assigned_admin_display_name is null and claimed_at is null)
      or (
        btrim(coalesce(assigned_admin_user_id, '')) <> ''
        and btrim(coalesce(assigned_admin_display_name, '')) <> ''
        and claimed_at is not null
      )
    ),
  constraint document_capture_requests_asset_owner_pair_check
    check (asset_register_item_id is null or owner_user_id is not null),
  constraint document_capture_requests_fuel_owner_pair_check
    check (fuel_storage_id is null or owner_user_id is not null),
  constraint document_capture_requests_target_type_check
    check (
      (request_type = 'invoice' and fuel_storage_id is null)
      or (
        request_type = 'fuel_slip'
        and not (asset_register_item_id is not null and fuel_storage_id is not null)
      )
    ),
  constraint document_capture_requests_drop_code_type_check
    check (invoice_drop_code_id is null or request_type = 'invoice'),
  constraint document_capture_requests_public_identity_check
    check (
      submission_channel <> 'public_drop'
      or (
        request_type = 'invoice'
        and (btrim(coalesce(sender_name, '')) <> '' or btrim(coalesce(sender_business_name, '')) <> '')
        and (btrim(coalesce(sender_email, '')) <> '' or btrim(coalesce(sender_phone, '')) <> '')
      )
    ),
  constraint document_capture_requests_output_check
    check (
      (status = 'completed'
        and resolved_at is not null
        and completed_at is not null
        and (
          (request_type = 'invoice' and final_invoice_id is not null and final_fuel_slip_id is null)
          or
          (request_type = 'fuel_slip' and final_invoice_id is null and final_fuel_slip_id is not null)
        )
      )
      or
      (status <> 'completed'
        and completed_at is null
        and final_invoice_id is null
        and final_fuel_slip_id is null
      )
    ),
  constraint document_capture_requests_resolution_check
    check (
      (status in ('completed', 'declined', 'rejected', 'cancelled') and resolved_at is not null)
      or
      (status not in ('completed', 'declined', 'rejected', 'cancelled') and resolved_at is null)
    ),
  constraint document_capture_requests_asset_owner_fkey
    foreign key (asset_register_item_id, owner_user_id)
    references public.asset_register_items (id, user_id)
    -- Keep the owner scope when an individual asset is removed. Unqualified
    -- SET NULL would clear both columns in this composite key and orphan the
    -- request, its sender details and its private source files.
    on delete set null (asset_register_item_id),
  constraint document_capture_requests_fuel_owner_fkey
    foreign key (fuel_storage_id, owner_user_id)
    references public.fuel_storage_units (id, user_id)
    on delete set null (fuel_storage_id)
);

-- Canonical records retain the capture request that produced them. These
-- unique provenance links make retries safe: one verified request can create
-- at most one ledger document and one canonical ledger record.
alter table public.asset_invoice_documents
  add column if not exists capture_request_id uuid;

alter table public.asset_invoices
  add column if not exists capture_request_id uuid;

alter table public.fuel_slips
  add column if not exists capture_request_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'asset_invoice_documents_capture_request_fkey'
      and conrelid = 'public.asset_invoice_documents'::regclass
  ) then
    alter table public.asset_invoice_documents
      add constraint asset_invoice_documents_capture_request_fkey
      foreign key (capture_request_id)
      references public.document_capture_requests(id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'asset_invoices_capture_request_fkey'
      and conrelid = 'public.asset_invoices'::regclass
  ) then
    alter table public.asset_invoices
      add constraint asset_invoices_capture_request_fkey
      foreign key (capture_request_id)
      references public.document_capture_requests(id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'fuel_slips_capture_request_fkey'
      and conrelid = 'public.fuel_slips'::regclass
  ) then
    alter table public.fuel_slips
      add constraint fuel_slips_capture_request_fkey
      foreign key (capture_request_id)
      references public.document_capture_requests(id)
      on delete restrict;
  end if;
end
$$;

create unique index if not exists asset_invoice_documents_capture_request_uidx
  on public.asset_invoice_documents (capture_request_id)
  where capture_request_id is not null;

create unique index if not exists asset_invoices_capture_request_uidx
  on public.asset_invoices (capture_request_id)
  where capture_request_id is not null;

create unique index if not exists idx_fuel_slips_capture_request
  on public.fuel_slips (capture_request_id)
  where capture_request_id is not null;

create unique index if not exists idx_document_capture_requests_final_invoice
  on public.document_capture_requests (final_invoice_id)
  where final_invoice_id is not null;

create unique index if not exists idx_document_capture_requests_final_fuel_slip
  on public.document_capture_requests (final_fuel_slip_id)
  where final_fuel_slip_id is not null;

create index if not exists idx_document_capture_requests_open_queue
  on public.document_capture_requests (due_at asc, submitted_at asc)
  where status not in ('completed', 'declined', 'rejected', 'cancelled');

create index if not exists idx_document_capture_requests_status_due
  on public.document_capture_requests (status, due_at asc);

create index if not exists idx_document_capture_requests_owner_updated
  on public.document_capture_requests (owner_user_id, updated_at desc)
  where owner_user_id is not null;

create index if not exists idx_document_capture_requests_asset_updated
  on public.document_capture_requests (asset_register_item_id, updated_at desc)
  where asset_register_item_id is not null;

create index if not exists idx_document_capture_requests_assignee
  on public.document_capture_requests (assigned_admin_user_id, due_at asc)
  where assigned_admin_user_id is not null
    and status not in ('completed', 'declined', 'rejected', 'cancelled');

create table if not exists public.document_capture_files (
  id uuid primary key default gen_random_uuid(),
  capture_request_id uuid not null,
  storage_key text not null,
  original_file_name text not null,
  content_type text not null,
  byte_size bigint not null,
  sha256 text not null,
  page_order integer not null default 0,
  security_status text not null default 'pending',
  security_reason text,
  promoted_upload_id text,
  created_by_actor_type text not null,
  created_by_user_id text,
  created_at timestamptz not null default now(),
  security_checked_at timestamptz,
  security_checked_by_admin_user_id text,

  constraint document_capture_files_request_fkey
    foreign key (capture_request_id)
    references public.document_capture_requests(id)
    on delete restrict,
  constraint document_capture_files_storage_key_key unique (storage_key),
  constraint document_capture_files_name_check
    check (btrim(original_file_name) <> ''),
  constraint document_capture_files_content_type_check
    check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  constraint document_capture_files_byte_size_check
    check (byte_size > 0 and byte_size <= 12582912),
  constraint document_capture_files_sha256_check
    check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint document_capture_files_page_order_check
    check (page_order >= 0 and page_order < 100),
  constraint document_capture_files_security_status_check
    check (security_status in ('pending', 'clean', 'rejected')),
  constraint document_capture_files_actor_type_check
    check (created_by_actor_type in ('admin', 'owner', 'accountant', 'dealer', 'public', 'system')),
  constraint document_capture_files_security_audit_check
    check (
      (security_status = 'pending' and security_checked_at is null and security_checked_by_admin_user_id is null)
      or
      (security_status <> 'pending' and security_checked_at is not null and btrim(coalesce(security_checked_by_admin_user_id, '')) <> '')
    ),
  constraint document_capture_files_request_page_key unique (capture_request_id, page_order),
  constraint document_capture_files_request_hash_key unique (capture_request_id, sha256)
);

create index if not exists idx_document_capture_files_request_created
  on public.document_capture_files (capture_request_id, page_order, created_at);

create index if not exists idx_document_capture_files_pending_security
  on public.document_capture_files (created_at asc)
  where security_status = 'pending';

create table if not exists public.document_capture_events (
  id uuid primary key default gen_random_uuid(),
  capture_request_id uuid not null,
  event_type text not null,
  from_status text,
  to_status text,
  actor_type text not null,
  actor_user_id text,
  actor_display_name text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint document_capture_events_request_fkey
    foreign key (capture_request_id)
    references public.document_capture_requests(id)
    on delete restrict,
  constraint document_capture_events_type_check
    check (event_type in (
      'created',
      'status_changed',
      'claimed',
      'draft_saved',
      'matched',
      'file_added',
      'file_security_updated',
      'information_requested',
      'output_linked',
      'owner_approved',
      'owner_declined',
      'note_added'
    )),
  constraint document_capture_events_status_check
    check (
      (from_status is null or from_status in (
        'submitted', 'needs_matching', 'in_progress', 'needs_information',
        'awaiting_owner', 'completed', 'declined', 'rejected', 'cancelled'
      ))
      and
      (to_status is null or to_status in (
        'submitted', 'needs_matching', 'in_progress', 'needs_information',
        'awaiting_owner', 'completed', 'declined', 'rejected', 'cancelled'
      ))
    ),
  constraint document_capture_events_actor_type_check
    check (actor_type in ('admin', 'owner', 'accountant', 'dealer', 'public', 'system')),
  constraint document_capture_events_actor_name_check
    check (btrim(actor_display_name) <> ''),
  constraint document_capture_events_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_document_capture_events_request_created
  on public.document_capture_events (capture_request_id, created_at asc, id asc);

create or replace function public.set_document_capture_request_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$;

drop trigger if exists set_document_capture_request_updated_at on public.document_capture_requests;
create trigger set_document_capture_request_updated_at
before update on public.document_capture_requests
for each row
execute function public.set_document_capture_request_updated_at();

comment on table public.document_capture_requests is
  'Human-verified workflow state for invoice and fuel-slip documents; never included in financial totals before canonical completion.';
comment on table public.document_capture_files is
  'Private quarantined capture-document metadata. File bytes live in private object storage and are never exposed by public reference.';
comment on table public.document_capture_events is
  'Append-only actor-attributed history for every document capture decision.';
comment on table public.asset_invoice_drop_codes is
  'Revocable contribution-only codes. Only a keyed hash and display-safe final four characters are stored.';
comment on table public.public_invoice_drop_rate_limits is
  'Shared abuse throttle for public Invoice Drop. Keys are HMACs; raw addresses are never stored.';

commit;
