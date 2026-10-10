import type { NextRequest } from 'next/server';
import type { PoolClient } from 'pg';
import { getDb } from './db';
import { getServerSession } from './auth-session';
import { getAssetRegisterItemById } from './asset-register-db';
import { contributionScope, type ContributionTarget } from './shared-asset-contributions';
import { ExternalLeadAccessError } from './external-lead-access';
import { businessJson, businessError, businessBody, requireBusinessOrigin } from './business-network-api';
import { limitBusinessAction } from './business-network';
import { getMaintenanceCatalogue } from './maintenance-catalogue-db';
import { resolveMaintenanceChecklist } from './maintenance-catalogue';
import { listAssetChecklistItems } from './asset-checklist-db';
import { ensureAssetMaintenanceTables } from './asset-maintenance';
import { ensureSharedAssetActivity, recordSharedAssetActivity } from './shared-asset-activity';
import { ensureSharingFoundation, recordSharingUsage } from './sharing-foundation';
import { validateAssetPart, type AssetPart } from './asset-parts';

let ready: Promise<void> | undefined;
export function ensureAssetParts() {
  if (!ready) ready = getDb().query(`CREATE TABLE IF NOT EXISTS public.asset_parts (
    id uuid PRIMARY KEY, owner_id text NOT NULL,
    asset_id uuid NOT NULL REFERENCES public.asset_register_items(id) ON DELETE CASCADE,
    item_key text NOT NULL, item_label text NOT NULL, name text NOT NULL, part_number text NOT NULL,
    brand text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
    maintenance_id uuid REFERENCES public.asset_maintenance_records(id) ON DELETE SET NULL,
    actor_id text NOT NULL, added_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
  ); CREATE INDEX IF NOT EXISTS asset_parts_asset_idx ON public.asset_parts(owner_id, asset_id, created_at);`).then(() => {}).catch(error => { ready = undefined; throw error; });
  return ready;
}
const columns = `id::text, item_key AS "itemKey", item_label AS "itemLabel", name, part_number AS "partNumber", brand, notes, maintenance_id::text AS "maintenanceId", added_by AS "addedBy", created_at AS "createdAt"`;
export type AssetPartsScope = { ownerId: string; assetId: string; user: { id: string; name?: string | null; email: string }; token?: string; sharingAccountId?: string; lock: (client: PoolClient) => Promise<void> };
async function optionalScope(target: ContributionTarget, permission: 'viewParts' | 'addParts' | 'maintenanceReports' | 'addMaintenance') {
  try { return await contributionScope(target, permission); }
  catch (error) { if (error instanceof ExternalLeadAccessError && error.status === 403) return null; throw error; }
}
export async function assetPartsRequest(request: NextRequest, target: ContributionTarget | { ownerAssetId: string } | { appScope: () => Promise<{ scope: AssetPartsScope; canView: boolean; canAdd: boolean; canReadMaintenance: boolean }> }) {
  try {
    const exporting = request.nextUrl?.searchParams.get('format') === 'pdf';
    const writing = request.method === 'POST' && !exporting;
    if (request.method === 'POST') requireBusinessOrigin(request);
    let scope: AssetPartsScope;
    let canView = true, canAdd = true, canReadMaintenance = true;
    let maintenanceScope: AssetPartsScope | null = null;
    if ('appScope' in target) {
      const app = await target.appScope();
      scope = app.scope; canView = app.canView; canAdd = app.canAdd; canReadMaintenance = app.canReadMaintenance;
      if (writing ? !canAdd : !canView && !canAdd) throw new ExternalLeadAccessError('This login cannot manage parts.', 403);
    } else if ('ownerAssetId' in target) {
      const session = await getServerSession({ requireActive: true });
      if (!session?.user?.id) throw new ExternalLeadAccessError('Sign in to manage parts.', 401);
      const user = session.user;
      scope = { ownerId: user.id, assetId: target.ownerAssetId, user, lock: async client => {
        const result = await client.query('SELECT id FROM asset_register_items WHERE id=$1::uuid AND user_id=$2 FOR UPDATE', [target.ownerAssetId, user.id]);
        if (!result.rows.length) throw new ExternalLeadAccessError('Asset unavailable.', 404);
      } };
    } else {
      const [view, add] = await Promise.all([optionalScope(target, 'viewParts'), optionalScope(target, 'addParts')]);
      canView = !!view; canAdd = !!add;
      const selected = writing ? add : view || add;
      if (!selected) throw new ExternalLeadAccessError('The owner has not enabled this parts action.', 403);
      scope = selected;
      maintenanceScope = await optionalScope(target, 'maintenanceReports') || await optionalScope(target, 'addMaintenance');
      canReadMaintenance = !!maintenanceScope;
    }
    if (exporting && !canView) throw new ExternalLeadAccessError('Parts viewing access is required to download a report.', 403);
    if (!/^[0-9a-f-]{36}$/i.test(scope.assetId)) throw new ExternalLeadAccessError('Asset unavailable.', 404);
    const asset = await getAssetRegisterItemById(scope.ownerId, scope.assetId);
    if (!asset) throw new ExternalLeadAccessError('Asset unavailable.', 404);
    const [catalogue, custom] = await Promise.all([getMaintenanceCatalogue(), listAssetChecklistItems(scope.ownerId, scope.assetId)]);
    const checklist = resolveMaintenanceChecklist(asset, catalogue);
    const suggestions = [...checklist.items.map(item => ({ id: item.id, label: item.label })), ...custom.map(item => ({ id: `asset_custom_${item.id}`, label: item.label }))];
    await ensureAssetMaintenanceTables();
    await ensureAssetParts();
    if (!writing) {
      const client = await getDb().connect();
      let result;
      try {
        await client.query('BEGIN'); await scope.lock(client);
        if (maintenanceScope) await maintenanceScope.lock(client);
        // Recheck ownership on shared reads as well as writes (including asset transfers).
        const owned = await client.query('SELECT id FROM asset_register_items WHERE id=$1::uuid AND user_id=$2 FOR SHARE', [scope.assetId, scope.ownerId]);
        if (!owned.rows.length) throw new ExternalLeadAccessError('Asset unavailable.', 404);
        const parts = canView ? (await client.query<AssetPart>(`SELECT ${columns} FROM asset_parts WHERE owner_id=$1 AND asset_id=$2::uuid ORDER BY created_at DESC, id`, [scope.ownerId, scope.assetId])).rows : [];
        const maintenance = canReadMaintenance ? (await client.query(`SELECT id::text, coalesce(nullif(title,''),maintenance_type) AS title, status FROM asset_maintenance_records WHERE user_id=$1 AND asset_register_item_id=$2::uuid ORDER BY created_at DESC LIMIT 100`, [scope.ownerId, scope.assetId])).rows : [];
        await client.query('COMMIT');
        result = { parts, suggestions, family: checklist.label, canView, canAdd, maintenance };
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
      if (exporting) {
        await limitBusinessAction(`asset-parts-pdf:${scope.user.id}`, 20);
        const body = await businessBody(request);
        if (!Array.isArray(body.partIds) || !body.partIds.length || body.partIds.length > 1000 || body.partIds.some(id => typeof id !== 'string')) throw new Error('Choose parts for the report.');
        const ids = new Set(body.partIds);
        const selected = result.parts.filter(part => ids.has(part.id));
        if (!selected.length || selected.length !== ids.size) throw new Error('This selection includes unavailable parts. Reopen Parts and try again.');
        const { assetPartsPdfResponse } = await import('./asset-parts-pdf');
        return assetPartsPdfResponse(request, scope.ownerId, asset, selected, result.maintenance);
      }
      return businessJson(result);
    }
    await limitBusinessAction(`asset-parts:${scope.user.id}`, 60);
    const input = validateAssetPart(await businessBody(request));
    const suggestion = suggestions.find(item => item.id === input.itemKey);
    if (!suggestion && input.itemKey !== 'other') throw new Error('Choose a maintenance item or Other part.');
    if (input.maintenanceId && !canReadMaintenance) throw new ExternalLeadAccessError('Maintenance access is required to link a record.', 403);
    await ensureSharedAssetActivity(); await ensureSharingFoundation();
    const client = await getDb().connect();
    try {
      await client.query('BEGIN'); await scope.lock(client);
      const owned = await client.query('SELECT id FROM asset_register_items WHERE id=$1::uuid AND user_id=$2 FOR UPDATE', [scope.assetId, scope.ownerId]);
      if (!owned.rows.length) throw new ExternalLeadAccessError('Asset unavailable.', 404);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.id]);
      const prior = (await client.query('SELECT owner_id, asset_id, actor_id FROM asset_parts WHERE id=$1::uuid', [input.id])).rows[0];
      if (prior) {
        if (prior.owner_id !== scope.ownerId || prior.asset_id !== scope.assetId || prior.actor_id !== scope.user.id) throw new Error('This save identifier has already been used.');
        await client.query('COMMIT'); return businessJson({ ok: true });
      }
      if (input.maintenanceId) {
        if (!('ownerAssetId' in target) && !('appScope' in target)) {
          const workScope = await optionalScope(target, 'maintenanceReports') || await optionalScope(target, 'addMaintenance');
          if (!workScope) throw new ExternalLeadAccessError('Maintenance access is no longer available.', 403);
          await workScope.lock(client);
        }
        const record = await client.query('SELECT id FROM asset_maintenance_records WHERE id=$1::uuid AND user_id=$2 AND asset_register_item_id=$3::uuid FOR SHARE', [input.maintenanceId, scope.ownerId, scope.assetId]);
        if (!record.rows.length) throw new Error('Choose maintenance belonging to this asset.');
      }
      const count = await client.query('SELECT count(*) FROM asset_parts WHERE owner_id=$1 AND asset_id=$2::uuid', [scope.ownerId, scope.assetId]);
      if (Number(count.rows[0].count) >= 1000) throw new Error('This asset already has 1,000 parts records.');
      const actorName = scope.user.name || scope.user.email;
      await client.query(`INSERT INTO asset_parts (id, owner_id, asset_id, item_key, item_label, name, part_number, brand, notes, maintenance_id, actor_id, added_by) VALUES ($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8,$9,$10::uuid,$11,$12)`, [input.id,scope.ownerId,scope.assetId,input.itemKey,suggestion?.label || 'Other part',input.name,input.partNumber,input.brand,input.notes,input.maintenanceId,scope.user.id,actorName]);
      await recordSharedAssetActivity(client, { id: input.id, ownerId: scope.ownerId, assetId: scope.assetId, actorId: scope.user.id, actorName, action: 'Part added', after: { name: input.name, partNumber: input.partNumber, maintenanceId: input.maintenanceId } });
      if (scope.sharingAccountId || (!('ownerAssetId' in target) && !('appScope' in target))) await recordSharingUsage({ accountId: scope.user.id, actorId: scope.user.id, assetId: scope.assetId, token: scope.token, metric: 'contribution', eventKey: `part:${input.id}` }, client);
      await client.query('COMMIT'); return businessJson({ ok: true });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  } catch (error) { return error instanceof ExternalLeadAccessError ? businessJson({ error: error.message }, error.status) : businessError(error); }
}
