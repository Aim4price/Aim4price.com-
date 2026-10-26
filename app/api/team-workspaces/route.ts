import { NextRequest } from 'next/server';
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
        const rows = (await getDb().query(`SELECT * FROM team_access WHERE email=$1 AND (member_user_id IS NULL OR member_user_id=$2) AND status IN ('pending','active') AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at DESC`, [actor.email, actor.id])).rows;
        const workspaces = await Promise.all(rows.map(async (row) => {
            const grant = mapTeamGrant(row);
            const profile = await getAccountProfile({ id: grant.ownerId });
            return { id: grant.id, status: grant.status, name: profile.businessName || profile.displayName || 'Business workspace', permissions: grant.permissions, expiresAt: grant.expiresAt };
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
