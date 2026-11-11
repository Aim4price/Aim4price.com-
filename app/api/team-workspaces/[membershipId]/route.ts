import { NextRequest } from 'next/server';
import { getDb } from '../../../../lib/db';
import { loadTeamScope, teamAssetList, teamRegisterGroups, lockTeamScope, auditTeam } from '../../../../lib/team-access';
import { teamJson, teamError } from '../../../../lib/team-access-http';
import { validateTeamPatch, TeamAccessError } from '../../../../lib/team-access-policy';
import { updateSharedAssetDetails } from '../../../../lib/asset-register-db';
import { requireBusinessOrigin, businessBody } from '../../../../lib/business-network-api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = {
    params: {
        membershipId: string;
    };
};
export async function GET(_request: NextRequest, { params }: Context) {
    try {
        const scope = await loadTeamScope(params.membershipId);
        const assets = await teamAssetList(scope);
        return teamJson({ name: scope.businessName, logoUrl: scope.logoUrl, accountType: scope.accountType, accountSubtype: scope.accountSubtype, permissions: scope.grant.permissions, assets, groups: await teamRegisterGroups(scope, assets), version: scope.grant.version });
    }
    catch (error) {
        return teamError(error);
    }
}
export async function PATCH(request: NextRequest, { params }: Context) {
    try {
        requireBusinessOrigin(request);
        const scope = await loadTeamScope(params.membershipId);
        const body = await businessBody(request);
        const assetId = String(body.assetId || '');
        if (!body.patch || typeof body.patch !== 'object' || Array.isArray(body.patch))
            throw new TeamAccessError('Invalid asset update.', 400);
        const patch = validateTeamPatch(body.patch as Record<string, unknown>, scope.grant);
        const client = await getDb().connect();
        try {
            await client.query('BEGIN');
            const asset = await lockTeamScope(client, scope, assetId, 'usage' in patch ? 'updateUsage' : 'editDetails');
            if (body.expectedUpdatedAtIso !== undefined && body.expectedUpdatedAtIso !== asset.updatedAtIso) throw new TeamAccessError('This asset has changed. Reopen it before saving.', 409);
            await updateSharedAssetDetails(client, scope.grant.ownerId, assetId, patch);
            await auditTeam(client, scope.actor, scope.grant, 'Asset updated', assetId, { fields: Object.keys(patch) });
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
        // Never return the raw owner asset or before/after financial snapshot.
        return teamJson({ ok: true });
    }
    catch (error) {
        return teamError(error);
    }
}
