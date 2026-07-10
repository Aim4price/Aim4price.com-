-- Adds owner-only desktop late fuel entries, evidence, balance verification and
-- append-only reconciliation audit fields. Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS public.fuel_storage_units
  ADD COLUMN IF NOT EXISTS balance_verification_status text NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS balance_check_reason text,
  ADD COLUMN IF NOT EXISTS balance_check_source_event_id uuid,
  ADD COLUMN IF NOT EXISTS balance_check_marked_at timestamptz;

UPDATE public.fuel_storage_units
SET balance_verification_status = CASE
  WHEN lower(coalesce(balance_verification_status, '')) = 'needs_check' THEN 'needs_check'
  ELSE 'verified'
END;

ALTER TABLE IF EXISTS public.fuel_storage_units
  DROP CONSTRAINT IF EXISTS fuel_storage_units_balance_verification_status_check;

ALTER TABLE IF EXISTS public.fuel_storage_units
  ADD CONSTRAINT fuel_storage_units_balance_verification_status_check
  CHECK (balance_verification_status IN ('verified', 'needs_check'));

ALTER TABLE IF EXISTS public.fuel_storage_events
  ADD COLUMN IF NOT EXISTS is_late_entry boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS issue_date date,
  ADD COLUMN IF NOT EXISTS issue_time time without time zone,
  ADD COLUMN IF NOT EXISTS issue_time_recorded boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS issue_at timestamptz,
  ADD COLUMN IF NOT EXISTS entry_added_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS added_by_user_id text,
  ADD COLUMN IF NOT EXISTS added_by_name text,
  ADD COLUMN IF NOT EXISTS added_by_email text,
  ADD COLUMN IF NOT EXISTS asset_usage_metric text,
  ADD COLUMN IF NOT EXISTS late_entry_reason text,
  ADD COLUMN IF NOT EXISTS evidence_type text,
  ADD COLUMN IF NOT EXISTS evidence_reference text,
  ADD COLUMN IF NOT EXISTS evidence_status text,
  ADD COLUMN IF NOT EXISTS evidence_id uuid,
  ADD COLUMN IF NOT EXISTS tank_balance_treatment text,
  ADD COLUMN IF NOT EXISTS linked_adjustment_event_id uuid,
  ADD COLUMN IF NOT EXISTS linked_missing_entry_event_id uuid,
  ADD COLUMN IF NOT EXISTS adjustment_kind text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS gps_capture_status text;

UPDATE public.fuel_storage_events
SET
  issue_date = coalesce(issue_date, (created_at AT TIME ZONE 'Africa/Johannesburg')::date),
  issue_at = coalesce(issue_at, created_at),
  entry_added_at = coalesce(entry_added_at, created_at),
  issue_time_recorded = coalesce(issue_time_recorded, true),
  gps_capture_status = coalesce(
    nullif(gps_capture_status, ''),
    CASE WHEN latitude IS NULL OR longitude IS NULL THEN 'not_captured' ELSE 'captured' END
  )
WHERE issue_date IS NULL
   OR issue_at IS NULL
   OR entry_added_at IS NULL
   OR gps_capture_status IS NULL
   OR gps_capture_status = '';

ALTER TABLE IF EXISTS public.fuel_storage_events
  DROP CONSTRAINT IF EXISTS fuel_storage_events_asset_usage_metric_check;

ALTER TABLE IF EXISTS public.fuel_storage_events
  ADD CONSTRAINT fuel_storage_events_asset_usage_metric_check
  CHECK (asset_usage_metric IS NULL OR asset_usage_metric IN ('hours', 'km', 'percentage', 'none'));

ALTER TABLE IF EXISTS public.fuel_storage_events
  DROP CONSTRAINT IF EXISTS fuel_storage_events_evidence_status_check;

ALTER TABLE IF EXISTS public.fuel_storage_events
  ADD CONSTRAINT fuel_storage_events_evidence_status_check
  CHECK (evidence_status IS NULL OR evidence_status IN ('internal_record_only', 'evidence_supplied_review_required'));

ALTER TABLE IF EXISTS public.fuel_storage_events
  DROP CONSTRAINT IF EXISTS fuel_storage_events_tank_balance_treatment_check;

ALTER TABLE IF EXISTS public.fuel_storage_events
  ADD CONSTRAINT fuel_storage_events_tank_balance_treatment_check
  CHECK (tank_balance_treatment IS NULL OR tank_balance_treatment IN ('already_reflected', 'not_yet_reflected', 'not_sure'));

ALTER TABLE IF EXISTS public.fuel_storage_events
  DROP CONSTRAINT IF EXISTS fuel_storage_events_adjustment_kind_check;

ALTER TABLE IF EXISTS public.fuel_storage_events
  ADD CONSTRAINT fuel_storage_events_adjustment_kind_check
  CHECK (adjustment_kind IS NULL OR adjustment_kind IN ('late_entry_balance_correction', 'balance_reconciliation'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_storage_events_user_idempotency
  ON public.fuel_storage_events(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fuel_storage_events_user_issue_date
  ON public.fuel_storage_events(user_id, issue_date DESC, issue_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_fuel_storage_events_linked_missing
  ON public.fuel_storage_events(linked_missing_entry_event_id)
  WHERE linked_missing_entry_event_id IS NOT NULL;

ALTER TABLE IF EXISTS public.asset_scan_events
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_label text,
  ADD COLUMN IF NOT EXISTS issue_date date,
  ADD COLUMN IF NOT EXISTS issue_time text,
  ADD COLUMN IF NOT EXISTS issue_time_recorded boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS asset_usage_reading numeric(14,2),
  ADD COLUMN IF NOT EXISTS asset_usage_metric text,
  ADD COLUMN IF NOT EXISTS entry_added_at timestamptz,
  ADD COLUMN IF NOT EXISTS added_by_user_id text;

ALTER TABLE IF EXISTS public.asset_scan_events
  DROP CONSTRAINT IF EXISTS asset_scan_events_asset_usage_metric_check;

ALTER TABLE IF EXISTS public.asset_scan_events
  ADD CONSTRAINT asset_scan_events_asset_usage_metric_check
  CHECK (asset_usage_metric IS NULL OR asset_usage_metric IN ('hours', 'km', 'percentage', 'none'));

CREATE TABLE IF NOT EXISTS public.fuel_late_entry_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  fuel_storage_event_id uuid NOT NULL UNIQUE REFERENCES public.fuel_storage_events(id) ON DELETE RESTRICT,
  file_name text NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL,
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.fuel_late_entry_evidence
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS fuel_storage_event_id uuid,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS byte_size integer,
  ADD COLUMN IF NOT EXISTS data bytea,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_late_entry_evidence_event
  ON public.fuel_late_entry_evidence(fuel_storage_event_id);

CREATE INDEX IF NOT EXISTS idx_fuel_late_entry_evidence_user_created
  ON public.fuel_late_entry_evidence(user_id, created_at DESC);

COMMENT ON TABLE public.fuel_late_entry_evidence IS
  'Owner-scoped supporting evidence for append-only desktop fuel late entries. Files are served only through an authenticated owner route.';
