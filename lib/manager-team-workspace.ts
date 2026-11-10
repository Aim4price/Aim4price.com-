import { getDb } from './db';
import { ensureTeamAccessSchema } from './team-access-schema';
import { getOwnerAppAccess, ownerAppCan, type OwnerAppAccess } from './owner-app-access';
import { getOwnerAppUserById } from './owner-app';
import type { TeamActor } from './team-access-policy';

/** A Manager login uses desktop's existing grant/audit/report machinery, never an owner impersonation. */
export async function managerTeamActor(access?: OwnerAppAccess | null): Promise<TeamActor | null> {
  const current = access ?? await getOwnerAppAccess();
  if (!current?.ownerAppUserId || ownerAppCan(current, 'manage_assets')) return null;
  const user = await getOwnerAppUserById(current.ownerAppUserId);
  if (!user?.is_active || user.parent_owner_user_id !== current.ownerUserId) return null;
  await ensureTeamAccessSchema();
  const result = await getDb().query(`INSERT INTO team_access(id,owner_id,email,username,display_name,managed_login,member_user_id,status,
      scope,register_ids,asset_ids,document_ids,document_access,permissions,version,excluded_document_ids,fuel_storage_ids)
    VALUES($1,$2,NULL,$3,$4,true,NULL,'active',$5,'[]'::jsonb,$6::jsonb,$9::jsonb,$10,$7::jsonb,$8,$11::jsonb,$12::jsonb)
    ON CONFLICT(id) DO UPDATE SET username=excluded.username,display_name=excluded.display_name,status='active',
      scope=excluded.scope,asset_ids=excluded.asset_ids,permissions=excluded.permissions,version=excluded.version,document_ids=excluded.document_ids,document_access=excluded.document_access,excluded_document_ids=excluded.excluded_document_ids,fuel_storage_ids=excluded.fuel_storage_ids
    WHERE team_access.owner_id=excluded.owner_id AND team_access.managed_login=true`,
    [user.id,current.ownerUserId,`manager:${user.id}`,user.display_name,current.assetScope,JSON.stringify(current.accessibleAssetIds),JSON.stringify(current.teamPermissions),user.session_version,JSON.stringify(user.document_ids || []),user.document_access || 'none',JSON.stringify(user.excluded_document_ids || []),user.fuel_storage_ids === null ? null : JSON.stringify(user.fuel_storage_ids)]);
  if (!result.rowCount) throw new Error('Manager workspace identity conflict.');
  return { id: `manager:${user.id}`, managedGrantId: user.id, username: `manager:${user.id}`, email: '', emailVerified: false, name: user.display_name };
}
