import { NextRequest } from 'next/server';
import { loadTeamScope, requireTeamAsset, lockTeamScope, auditTeam } from '../../../../../lib/team-access';
import { teamJson, teamError } from '../../../../../lib/team-access-http';
import { TeamAccessError } from '../../../../../lib/team-access-policy';
import { listAssetMaintenanceRecords, completeAssetMaintenanceRecord, getAssetMaintenanceRecordById } from '../../../../../lib/asset-maintenance';
import { requireBusinessOrigin, businessBody } from '../../../../../lib/business-network-api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = {
    params: {
        membershipId: string;
    };
};
export async function GET(request: NextRequest, { params }: Context) {
    try {
        const scope = await loadTeamScope(params.membershipId, 'viewMaintenance');
        const assetId = request.nextUrl.searchParams.get('assetId') || '';
        await requireTeamAsset(scope, assetId);
        const rows = await listAssetMaintenanceRecords(scope.grant.ownerId, { assetId });
        return teamJson({ records: rows.map(r => ({ id: r.id, title: r.title, type: r.maintenanceType, status: r.status, statusLabel: r.computedStatusLabel, dueDate: r.dueDate, dueUsage: r.dueUsage, usageMetric: r.usageMetric, completedAt: r.completedAtIso, completedBy: r.completedBy, notes: r.notes, completedNotes: r.completedNotes })) });
    }
    catch (error) {
        return teamError(error);
    }
}
export async function POST(request: NextRequest, { params }: Context) {
    try {
        requireBusinessOrigin(request);
        const scope = await loadTeamScope(params.membershipId, 'completeMaintenance');
        const body = await businessBody(request);
        const assetId = String(body.assetId || '');
        const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
        if (!notes || notes.length > 3000)
            throw new TeamAccessError('Describe the work completed (up to 3,000 characters).', 400);
        await requireTeamAsset(scope, assetId);
        const recordId = String(body.recordId || '');
        const record = await getAssetMaintenanceRecordById(scope.grant.ownerId, recordId);
        if (!record || record.assetId !== assetId) throw new TeamAccessError('Maintenance unavailable.', 404);
        const company = typeof body.company === 'string' ? body.company.trim() : '';
        const mechanic = typeof body.mechanic === 'string' ? body.mechanic.trim() : '';
        if (record.maintenanceType === 'service' && (!company || !mechanic || company.length > 150 || mechanic.length > 150)) throw new TeamAccessError('Enter the service company and mechanic.', 400);
        const completionNotes = `${record.maintenanceType === 'checkup' ? 'Checked' : 'Serviced'}: ${notes}${record.maintenanceType === 'service' ? `\nCompany: ${company}\nMechanic: ${mechanic}` : ''}`;
        await completeAssetMaintenanceRecord(scope.grant.ownerId, String(body.recordId || ''), { completedNotes: completionNotes, completedBy: scope.actor.name || scope.actor.email }, {
            assetId,
            before: async client => {
                await lockTeamScope(client, scope, assetId, 'completeMaintenance');
                const live = (await client.query('SELECT status FROM asset_maintenance_records WHERE user_id=$1 AND id::text=$2 AND asset_id=$3 FOR UPDATE', [scope.grant.ownerId,recordId,assetId])).rows[0];
                if (!live || live.status === 'cancelled') throw new TeamAccessError('Maintenance unavailable.',404);
                if (live.status === 'done') throw new TeamAccessError('This work is already completed. Refresh the list.',409);
            },
            after: async (client, record) => { await auditTeam(client, scope.actor, scope.grant, 'Maintenance completed', assetId, { maintenanceId: record.id }); },
        });
        return teamJson({ ok: true });
    }
    catch (error) {
        return teamError(error);
    }
}
