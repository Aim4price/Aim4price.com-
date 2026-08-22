-- Specific document types for searchable, asset-linked Document Vault uploads.
--
-- Existing records remain valid with a null document_type. New application
-- writes map each specific type to the existing broad category, preserving
-- current category filters, permissions and download behaviour.

begin;

alter table public.account_documents
  add column if not exists document_type text;

alter table public.account_documents
  drop constraint if exists account_documents_document_type_check;

alter table public.account_documents
  add constraint account_documents_document_type_check
  check (
    document_type is null
    or document_type in (
      'licence-disc',
      'registration-certificate',
      'roadworthy-certificate',
      'operating-permit',
      'insurance-policy',
      'insurance-schedule',
      'insurance-claim',
      'finance-agreement',
      'finance-statement',
      'settlement-letter',
      'invoice-proof-of-purchase',
      'ownership-certificate',
      'service-record',
      'inspection-report',
      'valuation-report',
      'warranty-certificate',
      'contract-agreement',
      'company-registration',
      'tax-document',
      'accounting-record',
      'other'
    )
  ) not valid;

alter table public.account_documents
  validate constraint account_documents_document_type_check;

create index if not exists idx_account_documents_user_document_type
  on public.account_documents (user_id, document_type, updated_at desc)
  where deleted_at is null and document_type is not null;

comment on column public.account_documents.document_type is
  'Optional specific taxonomy value. Null identifies a legacy broad-category record.';

commit;
