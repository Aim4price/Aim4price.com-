-- 27-user-message-document-attachments.sql
-- Adds optional document attachments to internal owner messages and ads.
-- The existing ad image bytea flow remains unchanged.

alter table public.account_user_messages
  add column if not exists document_file_name text,
  add column if not exists document_mime_type text,
  add column if not exists document_size_bytes integer,
  add column if not exists document_bytes bytea;

comment on column public.account_user_messages.document_file_name is 'Original/sanitised filename for an optional message/ad document attachment.';
comment on column public.account_user_messages.document_mime_type is 'MIME type for an optional message/ad document attachment.';
comment on column public.account_user_messages.document_size_bytes is 'Size in bytes for an optional message/ad document attachment.';
comment on column public.account_user_messages.document_bytes is 'Stored optional document attachment bytes for internal user messages and ads.';
