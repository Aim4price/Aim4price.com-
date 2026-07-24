-- Persistent automatic revaluation state for accepted dealer replacement-price
-- corrections. Existing historical corrections remain not_required.

ALTER TABLE IF EXISTS public.dealer_asset_correction_requests
  ADD COLUMN IF NOT EXISTS revaluation_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS revaluation_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revaluation_last_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS revaluation_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS revaluation_run_id bigint,
  ADD COLUMN IF NOT EXISTS revaluation_previous_run_id bigint,
  ADD COLUMN IF NOT EXISTS revaluation_previous_value_ex_vat numeric(14, 2),
  ADD COLUMN IF NOT EXISTS revaluation_new_value_ex_vat numeric(14, 2),
  ADD COLUMN IF NOT EXISTS revaluation_failure_code text,
  ADD COLUMN IF NOT EXISTS revaluation_failure_message text;

UPDATE public.dealer_asset_correction_requests
SET
  revaluation_status = COALESCE(NULLIF(revaluation_status, ''), 'not_required'),
  revaluation_attempt_count = GREATEST(COALESCE(revaluation_attempt_count, 0), 0)
WHERE revaluation_status IS NULL
   OR revaluation_status = ''
   OR revaluation_attempt_count IS NULL
   OR revaluation_attempt_count < 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dealer_asset_correction_revaluation_status_check'
      AND conrelid = 'public.dealer_asset_correction_requests'::regclass
  ) THEN
    ALTER TABLE public.dealer_asset_correction_requests
      ADD CONSTRAINT dealer_asset_correction_revaluation_status_check
      CHECK (revaluation_status IN ('not_required', 'pending', 'succeeded', 'failed')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dealer_asset_correction_revaluation_attempt_count_check'
      AND conrelid = 'public.dealer_asset_correction_requests'::regclass
  ) THEN
    ALTER TABLE public.dealer_asset_correction_requests
      ADD CONSTRAINT dealer_asset_correction_revaluation_attempt_count_check
      CHECK (revaluation_attempt_count >= 0) NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS dealer_asset_correction_owner_revaluation_idx
  ON public.dealer_asset_correction_requests (
    owner_user_id,
    revaluation_status,
    revaluation_last_attempted_at DESC
  )
  WHERE status = 'accepted' AND replacement_price_changed = true;
