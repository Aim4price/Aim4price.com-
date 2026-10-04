-- Capture future changes atomically; pre-existing history is retained.

CREATE TABLE IF NOT EXISTS public.asset_history_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL, asset_id uuid,
 category text NOT NULL, record_table text NOT NULL, record_id text NOT NULL,
 operation text NOT NULL, actor_id text, actor_name text, source text NOT NULL,
 before_data jsonb NOT NULL DEFAULT '{}', after_data jsonb NOT NULL DEFAULT '{}',
 transaction_id bigint NOT NULL DEFAULT txid_current(), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS asset_history_owner_asset ON public.asset_history_events(owner_id,asset_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS asset_history_transaction ON public.asset_history_events(owner_id,asset_id,transaction_id,category);
CREATE INDEX IF NOT EXISTS asset_history_deleted_record ON public.asset_history_events(owner_id,record_table,record_id,created_at DESC) WHERE operation='DELETE';
CREATE OR REPLACE FUNCTION public.capture_asset_history() RETURNS trigger LANGUAGE plpgsql AS $audit$
DECLARE b jsonb := CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 a jsonb := CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
 r jsonb; owner_key text; asset_key text; previous_asset text; cat text:=TG_ARGV[2]; row_id text;
 person text:=nullif(current_setting('aim4price.audit_actor',true),'');
 person_name text:=nullif(current_setting('aim4price.audit_name',true),'');
 origin text:=coalesce(nullif(current_setting('aim4price.audit_source',true),''),'Account or system');
 linked record; doc_data jsonb; operation text:=TG_OP;
BEGIN
 IF TG_OP='UPDATE' AND (b - ARRAY['updated_at','modified_at','last_viewed_at'])=(a - ARRAY['updated_at','modified_at','last_viewed_at']) THEN RETURN NEW; END IF;
 r:=CASE WHEN TG_OP='DELETE' THEN b ELSE a END;

 owner_key:=r->>TG_ARGV[0]; asset_key:=r->>TG_ARGV[1]; previous_asset:=b->>TG_ARGV[1]; row_id:=coalesce(r->>'id',r->>'document_id');
 IF TG_TABLE_NAME='account_document_asset_links' THEN
  SELECT user_id,to_jsonb(d) INTO owner_key,doc_data FROM public.account_documents d WHERE id=(r->>'document_id')::uuid;
  IF TG_OP='INSERT' THEN a:=coalesce(doc_data,'{}'::jsonb); ELSIF TG_OP='DELETE' THEN b:=coalesce(doc_data,'{}'::jsonb); END IF;
 END IF;
 IF owner_key IS NULL AND asset_key ~* '^[0-9a-f-]{36}$' THEN
  SELECT user_id INTO owner_key FROM public.asset_register_items WHERE id=asset_key::uuid;
 END IF;
 IF owner_key IS NULL THEN RETURN coalesce(NEW,OLD); END IF;
 IF TG_TABLE_NAME='asset_register_items' THEN
  IF TG_OP='UPDATE' AND (b->'value' IS DISTINCT FROM a->'value' OR b->'selected_value_ex_vat' IS DISTINCT FROM a->'selected_value_ex_vat' OR b->'replacement_price_ex_vat' IS DISTINCT FROM a->'replacement_price_ex_vat' OR b->'replacement_price_used_ex_vat' IS DISTINCT FROM a->'replacement_price_used_ex_vat' OR b->'specs_json'->'approved_value_baseline' IS DISTINCT FROM a->'specs_json'->'approved_value_baseline') THEN cat:='values';
  ELSIF TG_OP='UPDATE' AND (b->'photos' IS DISTINCT FROM a->'photos' OR b->'documents' IS DISTINCT FROM a->'documents') THEN cat:='documents'; END IF;
 END IF;
 IF TG_OP='UPDATE' AND TG_ARGV[0]<>'' AND b->>TG_ARGV[0] IS DISTINCT FROM a->>TG_ARGV[0] THEN b:='{}'::jsonb;operation:='TRANSFERRED'; END IF;
 IF person_name IS NULL AND TG_OP='INSERT' THEN person_name:=coalesce(r->>'actor_name',r->>'created_by_display_name',r->>'operator_name'); person:=coalesce(r->>'actor_user_id',r->>'created_by_dealer_staff_id',r->>'created_by_dealer_user_id'); END IF;
 IF TG_TABLE_NAME='account_documents' THEN
  FOR linked IN SELECT asset_id FROM public.account_document_asset_links WHERE document_id=(r->>'id')::uuid LOOP
   IF linked.asset_id ~* '^[0-9a-f-]{36}$' THEN INSERT INTO public.asset_history_events(owner_id,asset_id,category,record_table,record_id,operation,actor_id,actor_name,source,before_data,after_data) VALUES(owner_key,linked.asset_id::uuid,cat,TG_TABLE_NAME,row_id,operation,person,person_name,origin,b,a); END IF;
  END LOOP;
 ELSE
  IF asset_key IS NOT NULL AND asset_key !~* '^[0-9a-f-]{36}$' THEN RETURN coalesce(NEW,OLD); END IF;
  INSERT INTO public.asset_history_events(owner_id,asset_id,category,record_table,record_id,operation,actor_id,actor_name,source,before_data,after_data) VALUES(owner_key,asset_key::uuid,cat,TG_TABLE_NAME,row_id,operation,person,person_name,origin,b,a);
  IF TG_OP='UPDATE' AND previous_asset IS DISTINCT FROM asset_key AND previous_asset ~* '^[0-9a-f-]{36}$' THEN
   INSERT INTO public.asset_history_events(owner_id,asset_id,category,record_table,record_id,operation,actor_id,actor_name,source,before_data,after_data) VALUES(owner_key,previous_asset::uuid,cat,TG_TABLE_NAME,row_id,'REASSIGNED',person,person_name,origin,b,a);
  END IF;
 END IF;
 RETURN coalesce(NEW,OLD);
END;
$audit$;
CREATE OR REPLACE FUNCTION public.protect_asset_history() RETURNS trigger LANGUAGE plpgsql AS $protect$
BEGIN RAISE EXCEPTION 'Asset history is append-only. Record a correction instead.'; END;
$protect$;
DO $install$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.asset_history_events') AND tgname='protect_asset_history') THEN
 CREATE TRIGGER protect_asset_history BEFORE UPDATE OR DELETE ON public.asset_history_events FOR EACH ROW EXECUTE FUNCTION public.protect_asset_history();
 END IF;
END $install$;
DO $install$ BEGIN IF to_regclass('public.asset_register_items') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.asset_register_items') AND tgname='capture_asset_history') THEN CREATE TRIGGER capture_asset_history AFTER INSERT OR UPDATE OR DELETE ON public.asset_register_items FOR EACH ROW EXECUTE FUNCTION public.capture_asset_history('user_id','id','details'); END IF; END $install$;
DO $install$ BEGIN IF to_regclass('public.asset_invoices') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.asset_invoices') AND tgname='capture_asset_history') THEN CREATE TRIGGER capture_asset_history AFTER INSERT OR UPDATE OR DELETE ON public.asset_invoices FOR EACH ROW EXECUTE FUNCTION public.capture_asset_history('user_id','asset_register_item_id','costs'); END IF; END $install$;
DO $install$ BEGIN IF to_regclass('public.asset_invoice_documents') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.asset_invoice_documents') AND tgname='capture_asset_history') THEN CREATE TRIGGER capture_asset_history AFTER INSERT OR UPDATE OR DELETE ON public.asset_invoice_documents FOR EACH ROW EXECUTE FUNCTION public.capture_asset_history('user_id','asset_register_item_id','documents'); END IF; END $install$;
DO $install$ BEGIN IF to_regclass('public.fuel_slips') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.fuel_slips') AND tgname='capture_asset_history') THEN CREATE TRIGGER capture_asset_history AFTER INSERT OR UPDATE OR DELETE ON public.fuel_slips FOR EACH ROW EXECUTE FUNCTION public.capture_asset_history('user_id','asset_register_item_id','fuel'); END IF; END $install$;
DO $install$ BEGIN IF to_regclass('public.fuel_storage_events') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.fuel_storage_events') AND tgname='capture_asset_history') THEN CREATE TRIGGER capture_asset_history AFTER INSERT OR UPDATE OR DELETE ON public.fuel_storage_events FOR EACH ROW EXECUTE FUNCTION public.capture_asset_history('user_id','asset_register_item_id','fuel'); END IF; END $install$;
DO $install$ BEGIN IF to_regclass('public.asset_cost_budgets') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.asset_cost_budgets') AND tgname='capture_asset_history') THEN CREATE TRIGGER capture_asset_history AFTER INSERT OR UPDATE OR DELETE ON public.asset_cost_budgets FOR EACH ROW EXECUTE FUNCTION public.capture_asset_history('user_id','asset_register_item_id','budgets'); END IF; END $install$;
DO $install$ BEGIN IF to_regclass('public.asset_maintenance_records') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.asset_maintenance_records') AND tgname='capture_asset_history') THEN CREATE TRIGGER capture_asset_history AFTER INSERT OR UPDATE OR DELETE ON public.asset_maintenance_records FOR EACH ROW EXECUTE FUNCTION public.capture_asset_history('user_id','asset_register_item_id','maintenance'); END IF; END $install$;
DO $install$ BEGIN IF to_regclass('public.asset_scan_events') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.asset_scan_events') AND tgname='capture_asset_history') THEN CREATE TRIGGER capture_asset_history AFTER INSERT OR UPDATE OR DELETE ON public.asset_scan_events FOR EACH ROW EXECUTE FUNCTION public.capture_asset_history('user_id','asset_id','maintenance'); END IF; END $install$;
DO $install$ BEGIN IF to_regclass('public.account_documents') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.account_documents') AND tgname='capture_asset_history') THEN CREATE TRIGGER capture_asset_history BEFORE UPDATE OR DELETE ON public.account_documents FOR EACH ROW EXECUTE FUNCTION public.capture_asset_history('user_id','','documents'); END IF; END $install$;
DO $install$ BEGIN IF to_regclass('public.account_document_asset_links') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.account_document_asset_links') AND tgname='capture_asset_history') THEN CREATE TRIGGER capture_asset_history AFTER INSERT OR UPDATE OR DELETE ON public.account_document_asset_links FOR EACH ROW EXECUTE FUNCTION public.capture_asset_history('','asset_id','documents'); END IF; END $install$;
