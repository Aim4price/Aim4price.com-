-- Aim4price My Invoices / Cost of Ownership MVP
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.asset_invoice_documents (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
  upload_id text,
  upload_url text,
  file_name text,
  content_type text,
  byte_size integer,
  source text not null default 'manual',
  raw_extracted_text text,
  extraction_status text not null default 'not_extracted',
  extraction_warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint asset_invoice_documents_source_check check (source in ('manual', 'automatic')),
  constraint asset_invoice_documents_extraction_status_check check (
    extraction_status in ('not_extracted', 'extracted', 'failed', 'skipped')
  )
);

create table if not exists public.asset_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
  invoice_document_id uuid references public.asset_invoice_documents(id) on delete set null,
  supplier_name text,
  invoice_number text,
  invoice_date date,
  subtotal_ex_vat numeric(14,2),
  vat_amount numeric(14,2),
  total_inc_vat numeric(14,2) not null default 0,
  usage_reading numeric(14,2),
  usage_metric text,
  source text not null default 'manual',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_invoices_usage_metric_check check (usage_metric is null or usage_metric in ('none', 'hours', 'km')),
  constraint asset_invoices_source_check check (source in ('manual', 'automatic'))
);

create table if not exists public.asset_invoice_blocks (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.asset_invoices(id) on delete cascade,
  block_type text not null,
  description text,
  amount_ex_vat numeric(14,2),
  vat_amount numeric(14,2),
  total_inc_vat numeric(14,2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint asset_invoice_blocks_type_check check (block_type in ('maintenance', 'parts', 'repair', 'other'))
);

alter table public.asset_invoice_documents
  add column if not exists upload_id text,
  add column if not exists upload_url text,
  add column if not exists file_name text,
  add column if not exists content_type text,
  add column if not exists byte_size integer,
  add column if not exists source text not null default 'manual',
  add column if not exists raw_extracted_text text,
  add column if not exists extraction_status text not null default 'not_extracted',
  add column if not exists extraction_warnings jsonb not null default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default now();

alter table public.asset_invoices
  add column if not exists invoice_document_id uuid references public.asset_invoice_documents(id) on delete set null,
  add column if not exists supplier_name text,
  add column if not exists invoice_number text,
  add column if not exists invoice_date date,
  add column if not exists subtotal_ex_vat numeric(14,2),
  add column if not exists vat_amount numeric(14,2),
  add column if not exists total_inc_vat numeric(14,2) not null default 0,
  add column if not exists usage_reading numeric(14,2),
  add column if not exists usage_metric text,
  add column if not exists source text not null default 'manual',
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.asset_invoice_blocks
  add column if not exists description text,
  add column if not exists amount_ex_vat numeric(14,2),
  add column if not exists vat_amount numeric(14,2),
  add column if not exists total_inc_vat numeric(14,2),
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

create index if not exists asset_invoice_documents_user_id_idx
  on public.asset_invoice_documents (user_id);

create index if not exists asset_invoice_documents_asset_register_item_id_idx
  on public.asset_invoice_documents (asset_register_item_id);

create index if not exists asset_invoices_user_id_idx
  on public.asset_invoices (user_id);

create index if not exists asset_invoices_asset_register_item_id_idx
  on public.asset_invoices (asset_register_item_id);

create index if not exists asset_invoices_invoice_date_idx
  on public.asset_invoices (invoice_date);

create index if not exists asset_invoices_invoice_number_idx
  on public.asset_invoices (invoice_number);

create index if not exists asset_invoices_supplier_name_idx
  on public.asset_invoices (supplier_name);

create index if not exists asset_invoice_blocks_invoice_id_idx
  on public.asset_invoice_blocks (invoice_id);

create or replace function public.set_asset_invoices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_asset_invoices_updated_at on public.asset_invoices;
create trigger set_asset_invoices_updated_at
before update on public.asset_invoices
for each row
execute function public.set_asset_invoices_updated_at();
