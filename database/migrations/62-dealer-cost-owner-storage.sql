-- Dealer-created costs stay visible to the dealership immediately, while the
-- asset owner explicitly decides whether each record also appears in the
-- owner's Cost Ledger. Safe to run more than once.

ALTER TABLE public.asset_invoices
  ADD COLUMN IF NOT EXISTS owner_storage_status text NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS owner_storage_decided_at timestamptz;

-- Preserve the visibility of dealer records created before this consent flow.
UPDATE public.asset_invoices
SET
  owner_storage_status = 'approved',
  owner_storage_decided_at = COALESCE(owner_storage_decided_at, updated_at, created_at)
WHERE created_by_dealer_user_id IS NOT NULL
  AND owner_storage_status = 'owner';

ALTER TABLE public.asset_invoices
  DROP CONSTRAINT IF EXISTS asset_invoices_owner_storage_status_check;

ALTER TABLE public.asset_invoices
  ADD CONSTRAINT asset_invoices_owner_storage_status_check
  CHECK (owner_storage_status IN ('owner', 'pending', 'approved', 'declined'));

CREATE INDEX IF NOT EXISTS asset_invoices_owner_storage_pending_idx
  ON public.asset_invoices (user_id, owner_storage_status, updated_at DESC)
  WHERE created_by_dealer_user_id IS NOT NULL;
