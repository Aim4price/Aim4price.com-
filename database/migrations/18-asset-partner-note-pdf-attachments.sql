-- 18-asset-partner-note-pdf-attachments.sql
-- Allows finance, insurance, dealers and auctioneers to attach a PDF quote to a partner note.

alter table asset_partner_notes
  add column if not exists attachment_file_name text,
  add column if not exists attachment_content_type text,
  add column if not exists attachment_byte_size integer,
  add column if not exists attachment_data bytea;

create index if not exists idx_asset_partner_notes_has_attachment
  on asset_partner_notes(id)
  where attachment_data is not null;
