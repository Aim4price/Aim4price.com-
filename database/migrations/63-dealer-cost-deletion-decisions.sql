-- A dealer deletion now removes the cost from the dealer workspace first,
-- while the owner decides whether to keep or permanently delete their copy.
-- Safe to run more than once.

ALTER TABLE public.asset_invoices
  ADD COLUMN IF NOT EXISTS dealer_deletion_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS dealer_deletion_requested_at timestamptz;

ALTER TABLE public.asset_invoices
  DROP CONSTRAINT IF EXISTS asset_invoices_dealer_deletion_status_check;

ALTER TABLE public.asset_invoices
  ADD CONSTRAINT asset_invoices_dealer_deletion_status_check
  CHECK (dealer_deletion_status IN ('active', 'pending', 'kept'));

CREATE INDEX IF NOT EXISTS asset_invoices_dealer_deletion_pending_idx
  ON public.asset_invoices (
    user_id,
    dealer_deletion_status,
    dealer_deletion_requested_at DESC
  )
  WHERE created_by_dealer_user_id IS NOT NULL;
