import {getDb} from './db';

/** Installed after maintenance tables exist; no register/group identifiers are used. */
export const maintenanceAssetLifecycleSql = `
create or replace function public.cancel_removed_asset_maintenance() returns trigger
language plpgsql as $body$
begin
  if coalesce(to_jsonb(NEW)->>'lifecycle_state', 'active') <> 'active'
     or NEW.user_id is distinct from OLD.user_id then
    update public.asset_maintenance_records
    set status = 'cancelled', recurring_enabled = false, updated_at = now()
    where asset_register_item_id = OLD.id and user_id = OLD.user_id
      and coalesce(status, 'upcoming') = 'upcoming';
  end if;
  return NEW;
end;
$body$;
do $install$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.asset_register_items'::regclass
    and tgname = 'cancel_removed_asset_maintenance') then
    create trigger cancel_removed_asset_maintenance after update on public.asset_register_items
      for each row execute function public.cancel_removed_asset_maintenance();
  end if;
end;
$install$;
-- Repair old disposed/archived schedules and legacy orphan rows without touching history.
update public.asset_maintenance_records m
set status = 'cancelled', recurring_enabled = false, updated_at = now()
where coalesce(m.status, 'upcoming') = 'upcoming'
  and not exists (
    select 1 from public.asset_register_items ai
    where ai.id = m.asset_register_item_id and ai.user_id = m.user_id
      and coalesce(to_jsonb(ai)->>'lifecycle_state', 'active') = 'active'
  );
`;

export async function installMaintenanceAssetLifecycle(): Promise<void> {
  await getDb().query(maintenanceAssetLifecycleSql);
}

export async function maintenanceAssetAvailable(ownerId: string, assetId: string): Promise<boolean> {
  const result = await getDb().query(`select id from public.asset_register_items ai
    where ai.id = $1::uuid and ai.user_id = $2
      and coalesce(to_jsonb(ai)->>'lifecycle_state', 'active') = 'active'`, [assetId, ownerId]);
  return result.rows.length > 0;
}
