-- Aim4price Fuel Slip records for Fuel Ledger / Diesel Log.
-- Keeps fuel slips distinct from normal bulk storage invoices through source_type = 'fuel_slip'.

begin;

create extension if not exists pgcrypto;

alter table if exists public.asset_invoice_documents drop constraint if exists asset_invoice_documents_source_check;
alter table if exists public.asset_invoice_documents
  add constraint asset_invoice_documents_source_check check (source in ('manual', 'automatic', 'fuel_slip'));

alter table if exists public.asset_invoices drop constraint if exists asset_invoices_source_check;
alter table if exists public.asset_invoices
  add constraint asset_invoices_source_check check (source in ('manual', 'automatic', 'fuel_slip'));

alter table if exists public.fuel_storage_events
  add column if not exists source_type text,
  add column if not exists source_label text,
  add column if not exists fuel_slip_id uuid,
  add column if not exists total_amount numeric(14,2),
  add column if not exists document_file_url text,
  add column if not exists payment_method text,
  add column if not exists card_number_masked text;

create table if not exists public.fuel_slips (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source_type text not null default 'fuel_slip',
  source_label text not null default 'Fuel Slip',
  target_type text not null,
  asset_register_item_id uuid references public.asset_register_items(id) on delete set null,
  storage_id uuid references public.fuel_storage_units(id) on delete set null,
  fuel_storage_event_id uuid references public.fuel_storage_events(id) on delete set null,
  asset_invoice_id uuid references public.asset_invoices(id) on delete set null,
  invoice_document_id uuid references public.asset_invoice_documents(id) on delete set null,
  upload_id text,
  document_file_url text,
  original_filename text,
  content_type text,
  byte_size integer,
  supplier_name text,
  supplier_vat_number text,
  slip_number text,
  transaction_number text,
  document_date date,
  document_time text,
  fuel_type text,
  litres numeric(12,3) not null,
  price_per_litre numeric(14,4),
  total_amount numeric(14,2) not null,
  vat_amount numeric(14,2),
  vat_included boolean,
  vat_rate numeric(6,2),
  payment_method text,
  card_type text,
  card_number_masked text,
  card_last4 text,
  merchant_number text,
  terminal_number text,
  site_number text,
  odometer_reading numeric(14,2),
  hour_meter_reading numeric(14,2),
  extraction_status text not null default 'manual',
  ocr_confidence numeric(5,2),
  review_required boolean not null default false,
  raw_extracted_text text,
  extraction_warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.fuel_slips
  add column if not exists source_type text not null default 'fuel_slip',
  add column if not exists source_label text not null default 'Fuel Slip',
  add column if not exists target_type text,
  add column if not exists asset_register_item_id uuid,
  add column if not exists storage_id uuid,
  add column if not exists fuel_storage_event_id uuid,
  add column if not exists asset_invoice_id uuid,
  add column if not exists invoice_document_id uuid,
  add column if not exists upload_id text,
  add column if not exists document_file_url text,
  add column if not exists original_filename text,
  add column if not exists content_type text,
  add column if not exists byte_size integer,
  add column if not exists supplier_name text,
  add column if not exists supplier_vat_number text,
  add column if not exists slip_number text,
  add column if not exists transaction_number text,
  add column if not exists document_date date,
  add column if not exists document_time text,
  add column if not exists fuel_type text,
  add column if not exists litres numeric(12,3),
  add column if not exists price_per_litre numeric(14,4),
  add column if not exists total_amount numeric(14,2),
  add column if not exists vat_amount numeric(14,2),
  add column if not exists vat_included boolean,
  add column if not exists vat_rate numeric(6,2),
  add column if not exists payment_method text,
  add column if not exists card_type text,
  add column if not exists card_number_masked text,
  add column if not exists card_last4 text,
  add column if not exists merchant_number text,
  add column if not exists terminal_number text,
  add column if not exists site_number text,
  add column if not exists odometer_reading numeric(14,2),
  add column if not exists hour_meter_reading numeric(14,2),
  add column if not exists extraction_status text not null default 'manual',
  add column if not exists ocr_confidence numeric(5,2),
  add column if not exists review_required boolean not null default false,
  add column if not exists raw_extracted_text text,
  add column if not exists extraction_warnings jsonb not null default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.fuel_storage_events
  alter column litres type numeric(12,3) using litres::numeric(12,3),
  alter column storage_level_before_litres type numeric(12,3) using storage_level_before_litres::numeric(12,3),
  alter column storage_level_after_litres type numeric(12,3) using storage_level_after_litres::numeric(12,3);

alter table if exists public.fuel_slips
  alter column litres type numeric(12,3) using litres::numeric(12,3);

update public.fuel_storage_events
set card_number_masked = '************' || right(regexp_replace(coalesce(card_number_masked, ''), '[^0-9]', '', 'g'), 4)
where card_number_masked is not null
  and length(right(regexp_replace(card_number_masked, '[^0-9]', '', 'g'), 4)) = 4;

update public.fuel_slips
set
  card_last4 = right(regexp_replace(coalesce(nullif(card_last4, ''), card_number_masked, ''), '[^0-9]', '', 'g'), 4),
  card_number_masked = '************' || right(regexp_replace(coalesce(nullif(card_last4, ''), card_number_masked, ''), '[^0-9]', '', 'g'), 4)
where coalesce(card_last4, card_number_masked, '') <> ''
  and length(right(regexp_replace(coalesce(nullif(card_last4, ''), card_number_masked, ''), '[^0-9]', '', 'g'), 4)) = 4;

update public.fuel_slips
set
  source_type = 'fuel_slip',
  source_label = 'Fuel Slip',
  target_type = case when target_type in ('asset', 'storage_tank') then target_type else coalesce(nullif(target_type, ''), 'asset') end,
  extraction_status = case when extraction_status in ('manual', 'extracted', 'needs_review') then extraction_status else 'manual' end,
  litres = greatest(0, coalesce(litres, 0)),
  total_amount = greatest(0, coalesce(total_amount, 0)),
  updated_at = coalesce(updated_at, now()),
  created_at = coalesce(created_at, now());

alter table if exists public.fuel_slips drop constraint if exists fuel_slips_source_type_check;
alter table if exists public.fuel_slips
  add constraint fuel_slips_source_type_check check (source_type = 'fuel_slip');

alter table if exists public.fuel_slips drop constraint if exists fuel_slips_target_type_check;
alter table if exists public.fuel_slips
  add constraint fuel_slips_target_type_check check (target_type in ('asset', 'storage_tank'));

alter table if exists public.fuel_slips drop constraint if exists fuel_slips_extraction_status_check;
alter table if exists public.fuel_slips
  add constraint fuel_slips_extraction_status_check check (extraction_status in ('manual', 'extracted', 'needs_review'));

create index if not exists idx_fuel_storage_events_fuel_slip
  on public.fuel_storage_events(fuel_slip_id)
  where fuel_slip_id is not null;

create index if not exists idx_fuel_slips_user_created
  on public.fuel_slips(user_id, created_at desc);

create index if not exists idx_fuel_slips_asset_created
  on public.fuel_slips(asset_register_item_id, created_at desc)
  where asset_register_item_id is not null;

create index if not exists idx_fuel_slips_storage_created
  on public.fuel_slips(storage_id, created_at desc)
  where storage_id is not null;

commit;
