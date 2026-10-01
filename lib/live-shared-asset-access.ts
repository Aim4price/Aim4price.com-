import type { PoolClient } from 'pg';
import { externalLeadAccess, leadAllows, ExternalLeadAccessError } from './external-lead-access';
import { readLeadPage } from './guest-leads';
import type { ExternalSharePermission } from './external-share-permissions';

export async function requireLiveSharedAsset(token: string, assetId: string, permission: ExternalSharePermission, write = false) {
  const lead = await readLeadPage(token);
  if (!lead || !leadAllows(lead, permission) || !lead.share.assets.some(asset => asset.assetId === assetId)) throw new ExternalLeadAccessError('This asset permission is no longer available.',403);
  const {access,user} = await externalLeadAccess(lead);
  if (!user || !(write ? access === 'active' : ['active','read-only','owner'].includes(access))) throw new ExternalLeadAccessError('Sign in with an authorised account.',403);
  return {lead,user,token,assetId,permission};
}

/** Recheck the token and current umbrella membership inside any write transaction. */
export async function lockLiveSharedAsset(client: Pick<PoolClient,'query'>, scope: Awaited<ReturnType<typeof requireLiveSharedAsset>>) {
  const result = await client.query(`SELECT token, umbrella_id FROM asset_share_links s WHERE token=$1 AND user_id=$2 AND revoked_at IS NULL
    AND lead_details->'permissions'->>$5='true'
    AND (lead_details->>'recipientUserId'=$3 OR (coalesce(lead_details->>'recipientUserId','')='' AND lower(lead_details->>'recipientEmail')=lower($6)))
    AND ((umbrella_id IS NULL AND asset_ids @> ARRAY[$4::uuid]) OR (umbrella_id IS NOT NULL AND EXISTS(SELECT 1 FROM asset_groups g JOIN asset_group_members m ON m.group_id=g.id WHERE g.id=s.umbrella_id AND g.user_id=$2 AND m.asset_id=$4::uuid)))
    FOR SHARE`,[scope.token,scope.lead.ownerId,scope.user.id,scope.assetId,scope.permission,scope.user.email]);
  if(!result.rows.length) throw new ExternalLeadAccessError('This asset permission is no longer available.',403);
  if (result.rows[0].umbrella_id) {
    const member = await client.query(`SELECT m.asset_id FROM asset_groups g JOIN asset_group_members m ON m.group_id=g.id WHERE g.id=$1 AND g.user_id=$2 AND m.asset_id=$3::uuid FOR SHARE OF g,m`,[result.rows[0].umbrella_id,scope.lead.ownerId,scope.assetId]);
    if (!member.rows.length) throw new ExternalLeadAccessError('This asset is no longer in the shared umbrella.',403);
  }

}
