-- Owner-controlled account Document Vault.
--
-- Files continue to use the hardened Asset Register upload catalogs. This
-- migration stores private document metadata, optional asset links and the
-- 90-day recycle-bin state without duplicating file bytes.

begin;

create extension if not exists pgcrypto;

create table if not exists public.account_documents (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  upload_id text not null,
  title text not null,
  category text not null default 'other',
  notes text not null default '',
  expiry_date date,
  file_name text not null,
  content_type text not null,
  byte_size bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint account_documents_user_id_check
    check (btrim(user_id) <> ''),
  constraint account_documents_upload_id_check
    check (btrim(upload_id) <> ''),
  constraint account_documents_title_check
    check (btrim(title) <> ''),
  constraint account_documents_category_check
    check (category in (
      'business',
      'insurance',
      'finance',
      'licence',
      'tax-accounting',
      'ownership',
      'contract',
      'warranty',
      'other'
    )),
  constraint account_documents_file_name_check
    check (btrim(file_name) <> ''),
  constraint account_documents_content_type_check
    check (btrim(content_type) <> ''),
  constraint account_documents_byte_size_check
    check (byte_size > 0),
  constraint account_documents_timestamp_order_check
    check (updated_at >= created_at and (deleted_at is null or deleted_at >= created_at)),
  constraint account_documents_user_upload_key
    unique (user_id, upload_id)
);

create table if not exists public.account_document_asset_links (
  document_id uuid not null references public.account_documents(id) on delete cascade,
  asset_id text not null,
  created_at timestamptz not null default now(),

  constraint account_document_asset_links_asset_id_check
    check (btrim(asset_id) <> ''),
  constraint account_document_asset_links_pkey
    primary key (document_id, asset_id)
);

create index if not exists idx_account_documents_user_active_updated
  on public.account_documents (user_id, updated_at desc)
  where deleted_at is null;

create index if not exists idx_account_documents_user_deleted
  on public.account_documents (user_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists idx_account_documents_user_category
  on public.account_documents (user_id, category, updated_at desc)
  where deleted_at is null;

create index if not exists idx_account_documents_user_expiry
  on public.account_documents (user_id, expiry_date)
  where deleted_at is null and expiry_date is not null;

create index if not exists idx_account_documents_upload_id
  on public.account_documents (upload_id);

create index if not exists idx_account_document_asset_links_asset
  on public.account_document_asset_links (asset_id, document_id);

comment on table public.account_documents is
  'Owner-only account Document Vault metadata. File bytes remain in the Asset Register upload catalogs.';
comment on column public.account_documents.deleted_at is
  'Soft-delete timestamp. Documents are recoverable for 90 days before their metadata and upload catalog entry are purged.';

commit;
