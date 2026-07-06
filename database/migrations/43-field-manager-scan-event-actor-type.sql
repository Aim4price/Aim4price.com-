-- 43-field-manager-scan-event-actor-type.sql
-- Field Manager/database compatibility fix.
--
-- Repairs live databases where public.asset_scan_events.actor_type still has an
-- older check constraint that rejects Field Manager scan events.
--
-- Safe to run more than once. This does not delete, rewrite, or backfill any
-- existing scan-event rows, and it does not change public QR scan semantics.

ALTER TABLE IF EXISTS public.asset_scan_events
  DROP CONSTRAINT IF EXISTS asset_scan_events_actor_type_check;

ALTER TABLE IF EXISTS public.asset_scan_events
  ADD CONSTRAINT asset_scan_events_actor_type_check
  CHECK (
    actor_type IN (
      'scan_pin',
      'owner_session',
      'field_manager',
      'admin_session'
    )
  ) NOT VALID;

DO $$
BEGIN
  IF to_regclass('public.asset_scan_events') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.asset_scan_events
      WHERE actor_type IS NULL
         OR actor_type NOT IN (
          'scan_pin',
          'owner_session',
          'field_manager',
          'admin_session'
        )
      LIMIT 1
    ) THEN
      ALTER TABLE public.asset_scan_events
        VALIDATE CONSTRAINT asset_scan_events_actor_type_check;
    ELSE
      RAISE NOTICE 'asset_scan_events_actor_type_check was added as NOT VALID because existing rows contain legacy actor_type values outside the current Aim4price application list.';
    END IF;
  END IF;
END $$;
