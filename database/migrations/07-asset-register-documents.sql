-- Adds asset-level document storage for invoices, NATIS papers, insurance documents,
-- finance agreements and other paperwork attached to Asset Register items.

alter table if exists public.asset_register_items
  add column if not exists documents jsonb not null default '[]'::jsonb;

update public.asset_register_items
set documents = '[]'::jsonb
where documents is null;

comment on column public.asset_register_items.documents is
  'JSON array of uploaded asset documents. Each item stores id, url, fileName, contentType, byteSize and uploadedAtIso.';
