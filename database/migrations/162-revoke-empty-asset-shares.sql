CREATE OR REPLACE FUNCTION public.revoke_empty_asset_shares_on_removal() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  link record;
  has_survivor boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id = OLD.user_id AND (coalesce(to_jsonb(NEW)->>'lifecycle_state','active') = 'active'
      OR coalesce(to_jsonb(OLD)->>'lifecycle_state','active') <> 'active') THEN RETURN NEW; END IF;
  END IF;
  IF to_regclass('public.dealer_maintenance_access') IS NOT NULL THEN
    UPDATE public.dealer_maintenance_access SET is_active=false, revoked_at=now(), updated_at=now()
      WHERE owner_user_id=OLD.user_id AND asset_register_item_id=OLD.id AND is_active;
  END IF;
  FOR link IN SELECT token, asset_ids, umbrella_id FROM public.asset_share_links
    WHERE user_id=OLD.user_id AND revoked_at IS NULL AND (OLD.id=ANY(asset_ids) OR umbrella_id IS NOT NULL)
    ORDER BY token FOR UPDATE LOOP
    IF link.umbrella_id IS NULL THEN
      SELECT EXISTS(SELECT 1 FROM public.asset_register_items a WHERE a.user_id=OLD.user_id
        AND a.id=ANY(link.asset_ids) AND a.id<>OLD.id AND coalesce(to_jsonb(a)->>'lifecycle_state','active')='active') INTO has_survivor;
    ELSE
      IF to_regclass('public.asset_group_members') IS NULL THEN CONTINUE; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.asset_group_members WHERE group_id=link.umbrella_id AND asset_id=OLD.id) THEN CONTINUE; END IF;
      SELECT EXISTS(SELECT 1 FROM public.asset_group_members m JOIN public.asset_register_items a ON a.id=m.asset_id
        WHERE m.group_id=link.umbrella_id AND a.user_id=OLD.user_id AND a.id<>OLD.id
        AND coalesce(to_jsonb(a)->>'lifecycle_state','active')='active') INTO has_survivor;
    END IF;
    IF NOT has_survivor THEN
      UPDATE public.asset_share_links SET revoked_at=now() WHERE token=link.token;
    END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $fn$;
DO $install$
BEGIN
  IF to_regclass('public.asset_register_items') IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.asset_register_items') AND tgname='revoke_empty_asset_shares') THEN
    CREATE TRIGGER revoke_empty_asset_shares BEFORE UPDATE OR DELETE ON public.asset_register_items
      FOR EACH ROW EXECUTE FUNCTION public.revoke_empty_asset_shares_on_removal();
  END IF;
END $install$;
