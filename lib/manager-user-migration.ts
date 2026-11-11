import { getDb } from './db';
import { EMPTY_TEAM_PERMISSIONS } from './team-access-policy';

/** One-time identity migration. Historical actor IDs remain unchanged; old sessions are not transferred. */
export async function migrateManagerUsers(): Promise<void> {
  const client = await getDb().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('aim4price-manager-user-migration-v1'))");
    await client.query('CREATE TABLE IF NOT EXISTS manager_user_migrations (source_id uuid PRIMARY KEY, migrated_at timestamptz NOT NULL DEFAULT now())');
    const exists = (await client.query("SELECT to_regclass('public.field_managers') AS name")).rows[0]?.name;
    if (exists) {
      const users = (await client.query(`SELECT fm.*, to_jsonb(settings) AS settings FROM field_managers fm
        LEFT JOIN field_manager_access_settings settings ON settings.field_manager_id=fm.id
        WHERE NOT EXISTS (SELECT 1 FROM manager_user_migrations done WHERE done.source_id=fm.id)`)).rows;
      for (const user of users) {
        const settings = user.settings || {};
        // Do not infer financial access from a legacy fuel recording permission.
        const permissions = { ...EMPTY_TEAM_PERMISSIONS, viewPhotos: true, updateUsage: settings.can_record_work !== false,
          viewMaintenance: true, completeMaintenance: settings.can_record_work !== false, recordMaintenance: settings.can_record_work !== false,
          scheduleMaintenance: settings.can_schedule_maintenance !== false, viewFuel: true, viewFuelStorage: true,
          recordFuelIssues: settings.can_record_fuel !== false, refillFuel: settings.can_refill_fuel !== false };
        await client.query(`INSERT INTO owner_app_users(id,parent_owner_user_id,display_name,username,username_normalized,password_hash,
          is_active,access_role,permissions,session_version,failed_login_attempts,login_locked_until,last_login_at,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,'workshop',$8::jsonb,$9,$10,$11,$12,$13)`,
          [user.id,user.owner_user_id,user.display_name,user.username,user.username_normalized,user.password_hash,user.is_active,
            JSON.stringify(permissions),Number(user.session_version || 1)+1,user.failed_login_attempts || 0,user.login_locked_until,user.last_login_at,user.created_at]);
        await client.query(`INSERT INTO owner_app_user_access_settings(owner_app_user_id,asset_scope) VALUES($1,$2)`, [user.id, settings.asset_scope === 'selected' ? 'selected' : 'all']);
        await client.query(`INSERT INTO owner_app_user_asset_access(owner_app_user_id,asset_id)
          SELECT field_manager_id,asset_id FROM field_manager_asset_access WHERE field_manager_id=$1`, [user.id]);
        await client.query(`INSERT INTO owner_app_user_group_access(owner_app_user_id,group_id)
          SELECT field_manager_id,group_id FROM field_manager_group_access WHERE field_manager_id=$1`, [user.id]);
        if (settings.fuel_scope === 'selected') await client.query(`UPDATE owner_app_users SET fuel_storage_ids=ARRAY(SELECT fuel_storage_id FROM field_manager_fuel_storage_access WHERE field_manager_id=$1) WHERE id=$1`,[user.id]);
        await client.query('INSERT INTO manager_user_migrations(source_id) VALUES($1)',[user.id]);
      }
    }
    const maintenance = (await client.query("SELECT to_regclass('public.asset_maintenance_records') AS name")).rows[0]?.name;
    if (maintenance) await client.query('ALTER TABLE asset_maintenance_records DROP CONSTRAINT IF EXISTS asset_maintenance_records_assigned_field_manager_id_fkey');
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
