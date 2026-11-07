import { NextRequest } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { loadTeamScope, mapTeamGrant, auditTeam, teamIssuerAvailable } from '../../../../../lib/team-access';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { listTeamClientWork } from '../../../../../lib/team-client-work';
import { clientEnquiryStatus, clientWorkSelected } from '../../../../../lib/team-client-policy';
import { teamGrantIsLive, TeamAccessError } from '../../../../../lib/team-access-policy';
import { requireBusinessOrigin, businessBody } from '../../../../../lib/business-network-api';
import { limitBusinessAction } from '../../../../../lib/business-network';
import { teamJson, teamError } from '../../../../../lib/team-access-http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: { membershipId: string } };
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const scope = await loadTeamScope(params.membershipId, 'viewClientWork');
    const items = await listTeamClientWork(scope.grant.ownerId, scope.grant);
    const current = await loadTeamScope(params.membershipId, 'viewClientWork');
    if (current.grant.version !== scope.grant.version) throw new TeamAccessError('Your access changed. Refresh and try again.', 409);
    return teamJson({ items });
  } catch (error) { return teamError(error); }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    requireBusinessOrigin(request);
    const scope = await loadTeamScope(params.membershipId, 'manageClientEnquiries');
    const body = await businessBody(request), id = String(body.id || '');
    if (!/^lead:[0-9a-f-]{36}$/.test(id)) throw new TeamAccessError('Choose a valid enquiry.', 400);
    const status = clientEnquiryStatus(body.status);
    const available = await listTeamClientWork(scope.grant.ownerId, scope.grant);
    if (!available.some(work => work.id === id && work.canRespond)) throw new TeamAccessError('Enquiry unavailable.', 404);
    await limitBusinessAction('team-client-work:' + scope.actor.id, 30);
    const client = await getDb().connect();
    try {
      await client.query('BEGIN');
      const row = (await client.query('SELECT * FROM team_access WHERE id=$1 FOR SHARE', [scope.grant.id])).rows[0];
      if (!row) throw new TeamAccessError('Access unavailable.');
      const grant = mapTeamGrant(row);
      if (!teamGrantIsLive(grant, scope.actor) || grant.version !== scope.grant.version || !clientWorkSelected(grant, id) || !grant.permissions.manageClientEnquiries)
        throw new TeamAccessError('Your access changed. Refresh and try again.', 409);
      if (!await teamIssuerAvailable(grant.ownerId, await getAccountProfile({id:grant.ownerId}))) throw new TeamAccessError('Workspace unavailable.');
      const lead = (await client.query(`SELECT l.id,l.asset_register_item_id FROM asset_leads l
        JOIN asset_register_items a ON a.id=l.asset_register_item_id AND a.user_id=l.owner_user_id
        WHERE l.id::text=$1 AND l.partner_user_id=$2 AND l.status NOT IN ('closed','declined')
        AND coalesce(to_jsonb(a)->>'lifecycle_state','active')='active' FOR UPDATE OF l,a`, [id.slice(5), grant.ownerId])).rows[0];
      if (!lead) throw new TeamAccessError('Enquiry unavailable.', 404);
      // Timestamp identifier comes only from the explicit status allow-list above.
      await client.query(`UPDATE asset_leads SET status=$2,${status}_at=coalesce(${status}_at,now()),updated_at=now() WHERE id=$1`, [lead.id, status]);
      await auditTeam(client, scope.actor, grant, 'Client enquiry status updated', lead.asset_register_item_id, { enquiryId: lead.id, status });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    return teamJson({ ok: true });
  } catch (error) { return teamError(error); }
}
