-- Durable current-input recalculation queue. Also installed by the production runtime.

CREATE TABLE IF NOT EXISTS asset_valuation_jobs (
 asset_id uuid PRIMARY KEY REFERENCES asset_register_items(id) ON DELETE CASCADE,
 owner_id text NOT NULL, generation bigint NOT NULL DEFAULT 1,
 attempts integer NOT NULL DEFAULT 0, claim_id uuid, lease_until timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS asset_valuation_jobs_due ON asset_valuation_jobs(next_attempt_at) WHERE attempts < 5;
CREATE OR REPLACE FUNCTION asset_valuation_input_basis(asset jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $basis$
 SELECT jsonb_build_object(
  'fields', (SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) FROM jsonb_each(asset)
    WHERE key = ANY(ARRAY['brand_name','equipment_family_id','year_model','year','hours','engine_hours','condition',
      'life_worked_percent','max_lifetime_hours','replacement_price_used_ex_vat',
      'replacement_price_ex_vat','official_replacement_price_ex_vat','user_replacement_price_ex_vat'])),
  'specs', (SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
    FROM jsonb_each(coalesce(nullif(asset->'specs_json','null'::jsonb),'{}'::jsonb))
    WHERE key ~* '^(brand|unlisted_brand|typed_brand|sector|family|usage|life_?worked|worked_?percent|percent_?worked|lifetime_?(worked|used)|year_?model|advanced_?assumptions|condition_?factor|popularity|expected_?lifetime|max_?lifetime|design_?life|useful_?life|basic_?usage|replacement_?price|user_?replacement|selected_?extras|front_?loader|front_?pto|gps)'
  )
 );
$basis$;
CREATE OR REPLACE FUNCTION queue_asset_valuation() RETURNS trigger LANGUAGE plpgsql AS $queue$
BEGIN
 IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
   DELETE FROM asset_valuation_jobs WHERE asset_id=NEW.id;
 END IF;
 IF coalesce(to_jsonb(NEW)->>'selected_method','')='manual'
    OR current_setting('aim4price.valuation_write',true)='resolved' THEN
   DELETE FROM asset_valuation_jobs WHERE asset_id=NEW.id;
   IF (to_jsonb(OLD)->'hours',to_jsonb(OLD)->'life_worked_percent',to_jsonb(OLD)->'condition') IS DISTINCT FROM
      (to_jsonb(NEW)->'hours',to_jsonb(NEW)->'life_worked_percent',to_jsonb(NEW)->'condition') THEN
     NEW.specs_json := coalesce(NEW.specs_json,'{}'::jsonb) || jsonb_build_object('valuationInputsChangedAt',clock_timestamp());
   END IF;
   NEW.specs_json := coalesce(NEW.specs_json,'{}'::jsonb) ||
     jsonb_build_object('valuationNeedsUpdate',false,'valuation_needs_update',false,'automaticValuationStatus','current');
   RETURN NEW;
 END IF;
 -- Imported/manual records without a valuation method are not opted in.
 IF coalesce(to_jsonb(NEW)->>'selected_method','') NOT IN ('aim4price','market','hybrid') THEN RETURN NEW; END IF;
 IF current_setting('aim4price.valuation_write',true)='status' THEN RETURN NEW; END IF;
 IF OLD.user_id IS NOT DISTINCT FROM NEW.user_id AND
    asset_valuation_input_basis(to_jsonb(OLD)) IS NOT DISTINCT FROM asset_valuation_input_basis(to_jsonb(NEW)) THEN
   -- An old editing draft cannot put a completed valuation back into a queued state.
   NEW.specs_json := (coalesce(NEW.specs_json,'{}'::jsonb) - ARRAY['valuationNeedsUpdate','valuation_needs_update','automaticValuationStatus','valuationInputsChangedAt']) ||
     jsonb_strip_nulls(jsonb_build_object('valuationNeedsUpdate',OLD.specs_json->'valuationNeedsUpdate',
       'valuation_needs_update',OLD.specs_json->'valuation_needs_update','automaticValuationStatus',OLD.specs_json->'automaticValuationStatus','valuationInputsChangedAt',OLD.specs_json->'valuationInputsChangedAt'));
   RETURN NEW;
 END IF;
 INSERT INTO asset_valuation_jobs(asset_id,owner_id) VALUES(NEW.id,NEW.user_id)
 ON CONFLICT(asset_id) DO UPDATE SET owner_id=excluded.owner_id,
   generation=asset_valuation_jobs.generation+1, attempts=0, claim_id=NULL, lease_until=NULL,
   next_attempt_at=now(), last_error=NULL, updated_at=now();
 NEW.specs_json := coalesce(NEW.specs_json,'{}'::jsonb) ||
   jsonb_build_object('valuationNeedsUpdate',true,'valuation_needs_update',true,'automaticValuationStatus','pending',
     'valuationInputsChangedAt',coalesce(nullif(current_setting('aim4price.valuation_input_at',true),''),clock_timestamp()::text));
 RETURN NEW;
END;
$queue$;
DO $install$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='asset_register_items'::regclass AND tgname='queue_asset_valuation') THEN
  CREATE TRIGGER queue_asset_valuation BEFORE UPDATE ON asset_register_items FOR EACH ROW EXECUTE FUNCTION queue_asset_valuation();
 END IF;
END $install$;
-- Recover already flagged assets without touching manual values or resetting retries.
INSERT INTO asset_valuation_jobs(asset_id,owner_id)
SELECT id,user_id FROM asset_register_items
WHERE selected_method IN ('aim4price','market','hybrid')
 AND (specs_json->>'valuationNeedsUpdate'='true' OR specs_json->>'valuation_needs_update'='true')
ON CONFLICT(asset_id) DO NOTHING;
