import { NextRequest } from 'next/server';
import { sharingPlan } from '../../../lib/sharing-foundation';
import { getDb } from '../../../lib/db';
import { requireTeamActor, acceptTeamGrant, mapTeamGrant } from '../../../lib/team-access';
import { ensureTeamAccessSchema } from '../../../lib/team-access-schema';
import { getAccountProfile } from '../../../lib/account-profile';
import { teamJson, teamError } from '../../../lib/team-access-http';
import { requireBusinessOrigin, businessBody } from '../../../lib/business-network-api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const actor = await requireTeamActor();
        await ensureTeamAccessSchema();
        const rows = (await getDb().query(`SELECT * FROM team_access WHERE ((managed_login=true AND id::text=$3) OR (managed_login=false AND email=$1 AND $3='' AND (member_user_id=$2 OR (member_user_id IS NULL AND $4=true)))) AND status IN ('pending','active') AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at DESC`, [actor.email, actor.id, actor.managedGrantId || '', actor.emailVerified])).rows;
        const workspaces = await Promise.all(rows.map(async (row) => {
            const grant = mapTeamGrant(row);
            const profile = await getAccountProfile({ id: grant.ownerId });
            const available = ['owner', 'dealer'].includes(profile.accountType) && profile.accountStatus === 'active' && await sharingPlan(grant.ownerId, profile.accountType) === 'desktop';
            return { available, id: grant.id, status: grant.status, name: profile.businessName || profile.displayName || 'Business workspace', permissions: grant.permissions, expiresAt: grant.expiresAt, displayName: grant.displayName, scope: grant.scope, registerCount: grant.registerIds.length, assetCount: grant.assetIds.length, documentCount: grant.documentIds.length };
        }));
        return teamJson({ email: actor.email, workspaces });
    }
    catch (error) {
        return teamError(error);
    }
}
export async function POST(request: NextRequest) {
    try {
        requireBusinessOrigin(request);
        const actor = await requireTeamActor();
        await ensureTeamAccessSchema();
        const body = await businessBody(request);
        await acceptTeamGrant(actor, String(body.id || ''));
        return teamJson({ ok: true });
    }
    catch (error) {
        return teamError(error);
    }
}
