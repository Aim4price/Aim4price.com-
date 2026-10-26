import { NextRequest, NextResponse } from 'next/server';
import { loadTeamScope, teamAssetList, auditTeam } from '../../../../../lib/team-access';
import { teamCsv } from '../../../../../lib/team-access-policy';
import { teamError, TEAM_HEADERS } from '../../../../../lib/team-access-http';
import { getDb } from '../../../../../lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: NextRequest, { params }: {
    params: {
        membershipId: string;
    };
}) {
    try {
        const scope = await loadTeamScope(params.membershipId, 'exportAssets');
        const csv = teamCsv(await teamAssetList(scope), scope.grant.permissions.viewValues);
        await auditTeam(getDb(), scope.actor, scope.grant, 'Asset list exported');
        return new NextResponse(csv, { headers: { ...TEAM_HEADERS, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="team-assets.csv"' } });
    }
    catch (error) {
        return teamError(error);
    }
}
