-- Dealer-submitted asset costs remain in the owner's Cost Ledger while keeping
-- dealership and staff provenance separate from the manual/automatic capture method.
-- Safe to run more than once.

ALTER TABLE public.asset_invoice_documents
  ADD COLUMN IF NOT EXISTS created_by_dealer_user_id text,
  ADD COLUMN IF NOT EXISTS created_by_dealer_staff_id text,
  ADD COLUMN IF NOT EXISTS created_by_display_name text;

ALTER TABLE public.asset_invoices
  ADD COLUMN IF NOT EXISTS created_by_dealer_user_id text,
  ADD COLUMN IF NOT EXISTS created_by_dealer_staff_id text,
  ADD COLUMN IF NOT EXISTS created_by_display_name text;

CREATE INDEX IF NOT EXISTS asset_invoice_documents_dealer_idx
  ON public.asset_invoice_documents (created_by_dealer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS asset_invoices_dealer_idx
  ON public.asset_invoices (created_by_dealer_user_id, created_at DESC);
