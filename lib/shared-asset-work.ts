import type { NextRequest } from 'next/server';
import { resolveAssetUsage } from './asset-usage';
import { getDb } from './db';
import { contributionScope, type ContributionTarget } from './shared-asset-contributions';
import { getAssetRegisterItemById, updateSharedAssetDetails } from './asset-register-db';
import { mapMyInvoiceAssetOption } from './my-invoices';
import { maintenanceIdentity } from './maintenance-catalogue';
import { listAssetChecklistItems } from './asset-checklist-db';
import { recordStandaloneAssetMaintenanceCompletion } from './asset-maintenance';
import { ensureSharedAssetActivity, recordSharedAssetActivity } from './shared-asset-activity';
import { ensureSharingFoundation, recordSharingUsage } from './sharing-foundation';
import { businessJson, businessError, requireBusinessOrigin, businessBody } from './business-network-api';
import { ExternalLeadAccessError } from './external-lead-access';
import { limitBusinessAction } from './business-network';
const fields = ['yearModel', 'usage', 'condition'] as const;
export async function sharedAssetWork(request: NextRequest, target: ContributionTarget, action: 'details' | 'maintenance' | 'history' | 'checklist') {
    try {
        if (request.method !== 'GET')
            requireBusinessOrigin(request);
        let detailsScope: Awaited<ReturnType<typeof contributionScope>> | null = null;
        try { detailsScope = await contributionScope(target, 'updateDetails'); } catch (e) { if (!(e instanceof ExternalLeadAccessError)) throw e; }
        let locationScope: Awaited<ReturnType<typeof contributionScope>> | null = null;
        if(action === 'history') { try { locationScope = await contributionScope(target,'location'); } catch(e) { if(!(e instanceof ExternalLeadAccessError)) throw e; } }
        const scopes = await Promise.all(fields.map(async (field) => { try {
            return detailsScope || await contributionScope(target, field);
        }
        catch (e) {
            if (e instanceof ExternalLeadAccessError)
                return null;
            throw e;
        } }));
        let maintenance: Awaited<ReturnType<typeof contributionScope>> | null = null;
        try {
            maintenance = await contributionScope(target, 'addMaintenance');
        }
        catch (e) {
            if (!(e instanceof ExternalLeadAccessError))
                throw e;
        }
        const scope = action === 'maintenance' || action === 'checklist' ? maintenance : scopes.find(Boolean) || maintenance || locationScope;
        if (!scope)
            throw new ExternalLeadAccessError('The owner has not enabled this action.', 403);
        const asset = await getAssetRegisterItemById(scope.ownerId, scope.assetId);
        if (!asset)
            throw new ExternalLeadAccessError('Asset unavailable.', 404);
        if (request.method === 'GET') {
            if (action === 'checklist')
                return businessJson({ items: await listAssetChecklistItems(scope.ownerId, scope.assetId) });
            if (action === 'history') {
                await ensureSharedAssetActivity();
                return businessJson({ items: (await getDb().query('SELECT actor_name,action,before_data,after_data,created_at FROM shared_asset_activity WHERE owner_id=$1 AND asset_id=$2::uuid ORDER BY created_at DESC LIMIT 100', [scope.ownerId, scope.assetId])).rows.filter(row => row.action.startsWith('Value ') ? scope.user.id === scope.ownerId : ['finance updated','insurance updated','license updated'].includes(row.action) ? Boolean(detailsScope) : row.action === 'Location updated' ? Boolean(locationScope) : true) });
            }
            let canAddPhotos = false;
            if(action==='details') { try { await contributionScope(target,'addPhotos'); canAddPhotos=true; } catch(error) { if(!(error instanceof ExternalLeadAccessError)) throw error; } }
            const usage = resolveAssetUsage(asset);
            return businessJson({ asset: { ...mapMyInvoiceAssetOption(asset), usageMetric: usage.metric === 'not_applicable' ? 'none' : usage.metric, usageReading: usage.value, condition: asset.condition || '', maintenanceIdentity: maintenanceIdentity(asset) }, permissions: {...Object.fromEntries(fields.map((f, i) => [f, Boolean(scopes[i])])), updateDetails: Boolean(detailsScope), addPhotos: canAddPhotos} });
        }
        await limitBusinessAction(`shared-work:${scope.user.id}`, 30);
        const body = await businessBody(request), id = String(body.requestId || body.clientEventId || '');
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
            throw new Error('Reopen the form and try again.');
        await ensureSharedAssetActivity();
        await ensureSharingFoundation();
        const base = { id, ownerId: scope.ownerId, assetId: scope.assetId, actorId: scope.user.id, actorName: scope.user.name || scope.user.email };
        if (action === 'maintenance') {
            if (!['service', 'checkup'].includes(String(body.maintenanceType)))
                throw new Error('Choose service or check-up.');
            const date = String(body.completedAt || '');
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' }))
                throw new Error('Enter a valid completion date that is not in the future.');
            if (body.completedUsage != null && (typeof body.completedUsage !== 'number' || !Number.isFinite(body.completedUsage) || body.completedUsage < 0))
                throw new Error('Enter a valid usage reading.');
            const record = await recordStandaloneAssetMaintenanceCompletion(scope.ownerId, { assetId: scope.assetId, maintenanceType: body.maintenanceType, completedAt: date, completedUsage: body.completedUsage, completedNotes: body.completedNotes, completedBy: body.completedBy, maintenanceWork: body.maintenanceWork, sourceScanEventId: id }, { before: async (client) => {
                    await scope.lock(client);
                    const owned = await client.query('SELECT id FROM asset_register_items WHERE id=$1::uuid AND user_id=$2 FOR SHARE', [scope.assetId, scope.ownerId]);
                    if (!owned.rows.length)
                        throw new ExternalLeadAccessError('Asset unavailable.', 404);
                    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
                    const previous = (await client.query('SELECT asset_register_item_id FROM asset_maintenance_records WHERE user_id=$1 AND source_scan_event_id=$2::uuid', [scope.ownerId, id])).rows[0];
                    const event = (await client.query('SELECT owner_id,asset_id,actor_id,action FROM shared_asset_activity WHERE id=$1::uuid', [id])).rows[0];
                    if (previous && (!event || previous.asset_register_item_id !== scope.assetId))
                        throw new Error('Invalid save identifier.');
                    if (event && (event.owner_id !== scope.ownerId || event.asset_id !== scope.assetId || event.actor_id !== scope.user.id || event.action !== 'Maintenance completed'))
                        throw new Error('Invalid save identifier.');
                }, after: async (client, record) => { await recordSharedAssetActivity(client, { ...base, action: 'Maintenance completed', after: { recordId: record.id, title: record.title, date } }); await recordSharingUsage({ accountId: scope.user.id, actorId: scope.user.id, assetId: scope.assetId, token: scope.token, metric: 'contribution', eventKey: `maintenance:${record.id}` }, client); } });
            return businessJson({ ok: true, record });
        }
        if (action !== 'details')
            throw new Error('Invalid action.');
        const patch = body.patch as Record<string, unknown>;
        if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Object.keys(patch).length || Object.keys(patch).some(f => !fields.includes(f as typeof fields[number])))
            throw new Error('Choose valid asset details.');
        for (const [i, f] of fields.entries())
            if (f in patch && !scopes[i])
                throw new ExternalLeadAccessError(`The owner has not enabled ${f} updates.`, 403);
        if ('yearModel' in patch && patch.yearModel !== null && (!Number.isInteger(patch.yearModel) || Number(patch.yearModel) < 1800 || Number(patch.yearModel) > new Date().getFullYear() + 1))
            throw new Error('Enter a valid year.');
        if ('usage' in patch && (typeof patch.usage !== 'number' || !Number.isFinite(patch.usage) || patch.usage < 0))
            throw new Error('Enter a valid usage reading.');
        if ('condition' in patch && !['excellent', 'good', 'fair', 'used', 'serious'].includes(String(patch.condition)))
            throw new Error('Choose a valid condition.');
        const client = await getDb().connect();
        try {
            await client.query('BEGIN');
            for (const [i, f] of fields.entries())
                if (f in patch)
                    await scopes[i]!.lock(client);
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
            const prior = (await client.query('SELECT owner_id,asset_id,actor_id,action FROM shared_asset_activity WHERE id=$1::uuid', [id])).rows[0];
            if (prior) {
                if (prior.owner_id !== scope.ownerId || prior.asset_id !== scope.assetId || prior.actor_id !== scope.user.id || prior.action !== 'Asset details updated')
                    throw new Error('Invalid save identifier.');
            }
            else {
                const result = await updateSharedAssetDetails(client, scope.ownerId, scope.assetId, patch);
                await recordSharedAssetActivity(client, { ...base, action: 'Asset details updated', before: result.before, after: result.after });
                await recordSharingUsage({ accountId: scope.user.id, actorId: scope.user.id, assetId: scope.assetId, token: scope.token, metric: 'contribution', eventKey: `details:${id}` }, client);
            }
            await client.query('COMMIT');
            return businessJson({ ok: true });
        }
        catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
        finally {
            client.release();
        }
    }
    catch (e) {
        return e instanceof ExternalLeadAccessError ? businessJson({ error: e.message }, e.status) : businessError(e);
    }
}
