import {restoreAssetDetails} from './asset-history-restore';
import {listUnifiedAssetHistory,historyPaperworkFields,type HistoryCategory} from './asset-history';
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
const fields = ['yearModel', 'usage', 'condition', 'title', 'brand', 'model', 'note'] as const;
const identityFields = new Set<string>(['title','brand','model','note']);
export async function sharedAssetWork(request: NextRequest, target: ContributionTarget, action: 'details' | 'maintenance' | 'history' | 'checklist') {
    try {
        if (request.method !== 'GET')
            requireBusinessOrigin(request);
        let detailsScope: Awaited<ReturnType<typeof contributionScope>> | null = null;
        try { detailsScope = await contributionScope(target, 'updateDetails'); } catch (e) { if (!(e instanceof ExternalLeadAccessError)) throw e; }
        let locationScope: Awaited<ReturnType<typeof contributionScope>> | null = null;
        if(action === 'history') { try { locationScope = await contributionScope(target,'location'); } catch(e) { if(!(e instanceof ExternalLeadAccessError)) throw e; } }
        const scopes = await Promise.all(fields.map(async (field) => { try {
            return detailsScope || (identityFields.has(field) ? null : await contributionScope(target, field as 'yearModel'|'usage'|'condition'));
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
        const extras: Record<string, Awaited<ReturnType<typeof contributionScope>> | null> = {};
        if(action==='details'||action==='history') for(const permission of ['serialNumber','replacementPrice','addPhotos','suggestValue','addCosts','loggedProblems'] as const) {
            try { extras[permission]=await contributionScope(target,permission); } catch(e) { if(!(e instanceof ExternalLeadAccessError)) throw e; }
        }
        const scope = action === 'maintenance' || action === 'checklist' ? maintenance : scopes.find(Boolean) || maintenance || locationScope || Object.values(extras).find(Boolean);
        if (!scope)
            throw new ExternalLeadAccessError('The owner has not enabled this action.', 403);
        const asset = await getAssetRegisterItemById(scope.ownerId, scope.assetId);
        if (!asset)
            throw new ExternalLeadAccessError('Asset unavailable.', 404);
        if(action==='history'&&request.method!=='GET'){
            if(scope.user.id!==scope.ownerId)throw new ExternalLeadAccessError('Only the owner can restore history.',403);
            const body=await businessBody(request);if(typeof body.eventId!=='string'||! /^[0-9a-f-]{36}$/i.test(body.eventId))throw new Error('Choose a history entry.');
            if(['previewValueRestore','restoreValue'].includes(String(body.action))){const {restoreAssetValueHistory}=await import('./asset-value-history-restore');try{return businessJson(await restoreAssetValueHistory(scope.ownerId,scope.assetId,body.eventId,{id:scope.user.id,name:scope.user.name||scope.user.email},body,scope.lock));}catch(e){if(e instanceof Error&&/^(Confirm |This history|Asset unavailable|Newer changes)/.test(e.message))throw new ExternalLeadAccessError(e.message,409);throw e;}}
            return businessJson(await restoreAssetDetails(scope.ownerId,scope.assetId,body.eventId,{id:scope.user.id,name:scope.user.name||scope.user.email},body.confirmed===true,scope.lock));
        }
        if (request.method === 'GET') {
            if (action === 'checklist')
                return businessJson({ items: await listAssetChecklistItems(scope.ownerId, scope.assetId) });
            if (action === 'history') {
                const owner=scope.user.id===scope.ownerId;
                const categories:HistoryCategory[]=['details'];
                if(maintenance||extras.loggedProblems)categories.push('maintenance');
                if(detailsScope||extras.addPhotos)categories.push('documents');
                if(extras.suggestValue||extras.replacementPrice)categories.push('values');
                if(extras.addCosts)categories.push('costs');
                const detailFields=[...(detailsScope?[...historyPaperworkFields,'title','brand_name','model_name','note','is_financed','is_insured','is_licensed','insured_value_ex_vat']:[]),...(scopes[0]?['year_model']:[]),...(scopes[1]?['hours']:[]),...(scopes[2]?['condition']:[]),...(locationScope?['last_known_lat','last_known_lng','last_known_location_text']:[]),...(extras.serialNumber?['serial_number']:[]),...(extras.replacementPrice?['replacement_price_ex_vat','replacement_price_used_ex_vat']:[]),...(extras.suggestValue?['value','selected_value_ex_vat','reason','kind']:[])];
                const historyOptions={owner,actorId:scope.user.id,categories:owner?undefined:categories,detailFields,problems:!!extras.loggedProblems,maintenance:!!maintenance,documents:!!detailsScope,before:request.nextUrl.searchParams.get('before')||undefined,category:request.nextUrl.searchParams.get('category')||undefined};
                if(request.nextUrl.searchParams.get('format')==='pdf'){const {assetHistoryPdfResponse}=await import('./asset-history-report');return await assetHistoryPdfResponse(request,scope.ownerId,asset,historyOptions);}
                return businessJson(await listUnifiedAssetHistory(scope.ownerId,scope.assetId,historyOptions));
            }
            const usage = resolveAssetUsage(asset);
            return businessJson({ asset: { ...mapMyInvoiceAssetOption(asset), usageMetric: usage.metric === 'not_applicable' ? 'none' : usage.metric, usageReading: usage.value, condition: asset.condition || '', title:asset.title, serialNumber:asset.serialNumber, brand:asset.brandName, model:asset.modelName, note:detailsScope?asset.note:'', replacementPriceExVat:asset.replacementPriceExVat, currentValue:asset.selectedValueExVat, manual:asset.selectedMethod==='manual',revision:asset.updatedAtIso, insuredValue:detailsScope?asset.insuredValueExVat:null, photos:asset.photos, maintenanceIdentity: maintenanceIdentity(asset) }, permissions: {...Object.fromEntries(fields.map((f, i) => [f, Boolean(scopes[i])])), updateDetails: Boolean(detailsScope), addPhotos: Boolean(extras.addPhotos), serialNumber:Boolean(extras.serialNumber), replacementPrice:Boolean(extras.replacementPrice), addDocuments:Boolean(detailsScope), suggestValue:Boolean(extras.suggestValue), owner:scope.user.id===scope.ownerId} });
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
        for(const field of ['title','brand','model','note']) if(field in patch) {
            if(typeof patch[field] !== 'string' || String(patch[field]).length > (field==='note'?4000:240) || (field==='title'&&!String(patch[field]).trim())) throw new Error('Enter valid asset '+field+'.');
            patch[field]=String(patch[field]).trim();
        }
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
                if('title' in patch)await client.query("UPDATE asset_leads SET asset_snapshot_json=coalesce(asset_snapshot_json,'{}'::jsonb)||$3::jsonb,updated_at=now() WHERE owner_user_id=$1 AND asset_register_item_id=$2::uuid",[scope.ownerId,scope.assetId,JSON.stringify({title:result.item.title,yearModel:result.item.yearModel,condition:result.item.condition})]);
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
