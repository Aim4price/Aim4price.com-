-- Stores asset-register uploads outside the asset JSON payload.
-- Asset rows keep a short URL such as /api/asset-register/uploads/<upload-id>,
-- while the binary file is streamed from this table when opened.

create table if not exists public.asset_register_uploads (
  id text primary key,
  user_id text not null,
  file_name text not null,
  content_type text not null,
  byte_size integer not null,
  data bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists asset_register_uploads_user_id_created_at_idx
  on public.asset_register_uploads (user_id, created_at desc);

comment on table public.asset_register_uploads is
  'Binary storage for Asset Register photos, documents and register logos. Asset JSON stores only the short API URL.';

comment on column public.asset_register_uploads.data is
  'Raw uploaded file bytes streamed by /api/asset-register/uploads/<id>.';
