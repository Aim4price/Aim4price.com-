-- Optional GPS-based usage estimates. Also installed by the tracking runtime.

CREATE TABLE IF NOT EXISTS public.asset_tracking_usage (
 asset_id uuid PRIMARY KEY REFERENCES public.asset_register_items(id) ON DELETE CASCADE,
 owner_id text NOT NULL, enabled boolean NOT NULL DEFAULT false,
 metric text NOT NULL CHECK(metric IN ('hours','km')),
 baseline_value numeric(14,2) NOT NULL CHECK(baseline_value>=0),
 baseline_at timestamptz NOT NULL, moving_seconds double precision NOT NULL DEFAULT 0, distance_km double precision NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.asset_tracking_usage_buckets (
 asset_id uuid NOT NULL REFERENCES public.asset_tracking_usage(asset_id) ON DELETE CASCADE,
 bucket_start timestamptz NOT NULL, moving_seconds double precision NOT NULL DEFAULT 0,
 distance_km double precision NOT NULL DEFAULT 0, last_tracked_at timestamptz,
 PRIMARY KEY(asset_id,bucket_start)
);
CREATE TABLE IF NOT EXISTS public.asset_tracking_usage_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 asset_id uuid NOT NULL, owner_id text NOT NULL, action text NOT NULL,
 reading numeric(14,2), metric text NOT NULL, baseline_value numeric(14,2),
 baseline_at timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS tracking_usage_events_asset ON public.asset_tracking_usage_events(owner_id,asset_id,id DESC);
CREATE OR REPLACE FUNCTION public.reconcile_tracking_usage_reading() RETURNS trigger LANGUAGE plpgsql AS $usage$
DECLARE config public.asset_tracking_usage%ROWTYPE;
 confirm_reading boolean := current_setting('aim4price.confirm_usage',true)='on';
BEGIN
 IF current_setting('aim4price.tracking_usage_write',true)='on' THEN RETURN NEW; END IF;
 PERFORM set_config('aim4price.confirm_usage','',true);
 SELECT * INTO config FROM public.asset_tracking_usage WHERE asset_id=NEW.id FOR UPDATE;
 IF NOT FOUND THEN
  NEW.specs_json:=coalesce(NEW.specs_json,'{}'::jsonb)-'trackingUsage';
  RETURN NEW;
 END IF;
 -- Metadata is server-owned: unrelated edits cannot forge or erase its source.
 NEW.specs_json:=(coalesce(NEW.specs_json,'{}'::jsonb)-'trackingUsage') ||
  CASE WHEN OLD.specs_json ? 'trackingUsage' THEN jsonb_build_object('trackingUsage',OLD.specs_json->'trackingUsage') ELSE '{}'::jsonb END;
 IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
  UPDATE public.asset_tracking_usage SET enabled=false WHERE asset_id=NEW.id;
  NEW.specs_json:=NEW.specs_json-'trackingUsage';
  RETURN NEW;
 END IF;
 IF NEW.hours IS DISTINCT FROM OLD.hours OR confirm_reading THEN
  INSERT INTO public.asset_tracking_usage_events(asset_id,owner_id,action,reading,metric,baseline_value,baseline_at)
   VALUES(NEW.id,NEW.user_id,'Meter reading confirmed',NEW.hours,config.metric,config.baseline_value,config.baseline_at);
  UPDATE public.asset_tracking_usage SET baseline_value=coalesce(NEW.hours,0),baseline_at=clock_timestamp(),moving_seconds=0,distance_km=0,
   enabled=enabled AND NEW.hours IS NOT NULL,updated_at=clock_timestamp() WHERE asset_id=NEW.id;
  DELETE FROM public.asset_tracking_usage_buckets WHERE asset_id=NEW.id;
  NEW.specs_json:=(NEW.specs_json-'trackingUsage') || jsonb_build_object('hours',NEW.hours,'usageAmount',NEW.hours,
   'usage_amount',NEW.hours,'engine_hours',NEW.hours,'km',NEW.hours,'kilometres',NEW.hours,'kilometers',NEW.hours);
 END IF;

 RETURN NEW;
END $usage$;
DO $install$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.asset_register_items'::regclass AND tgname='reconcile_tracking_usage_reading') THEN
  CREATE TRIGGER reconcile_tracking_usage_reading BEFORE UPDATE ON public.asset_register_items
   FOR EACH ROW EXECUTE FUNCTION public.reconcile_tracking_usage_reading();
 END IF;
END $install$;
