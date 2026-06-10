-- 27-user-message-document-attachments.sql
-- Adds optional document attachments to internal owner messages and ads.
-- Safe to run more than once after migration 26 has created public.account_user_messages.
-- This migration intentionally does not create account_user_messages; run migration 26 first.

begin;

do $$
begin
  if to_regclass('public.account_user_messages') is null then
    raise exception 'Migration 27 requires public.account_user_messages. Run database/migrations/26-users-page-request-controls-and-messages.sql before migration 27.';
  end if;
end
$$;

alter table public.account_user_messages
  add column if not exists document_file_name text,
  add column if not exists document_mime_type text,
  add column if not exists document_size_bytes integer,
  add column if not exists document_bytes bytea;

comment on column public.account_user_messages.document_file_name is 'Original/sanitised filename for an optional message/ad document attachment.';
comment on column public.account_user_messages.document_mime_type is 'MIME type for an optional message/ad document attachment.';
comment on column public.account_user_messages.document_size_bytes is 'Size in bytes for an optional message/ad document attachment.';
comment on column public.account_user_messages.document_bytes is 'Stored optional document attachment bytes for internal user messages and ads.';

commit;
