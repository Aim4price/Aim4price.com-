import type { PoolClient } from 'pg';
import { getDb } from './db';
import { setAssetHistoryActor } from './asset-history-schema';
import { getAnyServerSession } from './auth-session';
import { getAccountProfile } from './account-profile';
import { sharingPlan } from './sharing-foundation';
import { listAssetRegisters } from './asset-registers';
import { getAssetRegisterItemById, listAssetRegisterItems, type AssetRegisterItem } from './asset-register-db';
import { listAccountDocuments } from './account-documents';
import { resolveAssetUsage } from './asset-usage';
import { ensureTeamAccessSchema } from './team-access-schema';
import { TeamAccessError, normalizeTeamPermissions, teamGrantIsLive, teamCanAccessAsset, assertTeamPermission, projectTeamAsset, type TeamActor, type TeamGrant, type TeamPermission } from './team-access-policy';
type TeamGrantRow = {
    id: string;
    owner_id: string;
    email: string;
    display_name: string;
    member_user_id: string | null;
    status: TeamGrant['status'];
    scope: TeamGrant['scope'];
    register_ids: string[];
    asset_ids: string[];
    document_ids: string[];
    permissions: unknown;
    expires_at: Date | string | null;
    version: number;
};
export function mapTeamGrant(row: TeamGrantRow): TeamGrant {
    return { id: row.id, ownerId: row.owner_id, email: row.email, displayName: row.display_name, memberUserId: row.member_user_id,
        status: row.status, scope: row.scope, registerIds: row.register_ids, assetIds: row.asset_ids, documentIds: row.document_ids,
        permissions: normalizeTeamPermissions(row.permissions), expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null, version: row.version };
}
export async function requireTeamActor(): Promise<TeamActor> {
    const session = await getAnyServerSession();
    if (!session?.user?.id)
        throw new TeamAccessError('Sign in with your own account.', 401);
    if (session.user.emailVerified !== true)
        throw new TeamAccessError('Verify your email address before opening a team workspace.', 403);
    const profile = await getAccountProfile(session.user);
    if (profile.accountStatus === 'suspended')
        throw new TeamAccessError('This account is suspended.', 403);
    return { id: session.user.id, email: session.user.email.trim().toLowerCase(), emailVerified: true, name: session.user.name };
}
export async function requireTeamOwner() {
    const actor = await requireTeamActor();
    const profile = await getAccountProfile(actor);
    if (!['owner', 'dealer'].includes(profile.accountType) || profile.accountStatus !== 'active' || await sharingPlan(actor.id, profile.accountType) !== 'desktop')
        throw new TeamAccessError('Team access requires an active Owner or Dealer desktop account.');
    await ensureTeamAccessSchema();
    return { actor, profile };
}
export async function auditTeam(client: Pick<PoolClient, 'query'>, actor: TeamActor, grant: TeamGrant, action: string, assetId: string | null = null, details: Record<string, unknown> = {}) {
    await client.query('INSERT INTO team_access_activity(owner_id,membership_id,actor_id,actor_email,asset_id,action,details) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)', [grant.ownerId, grant.id, actor.id, actor.email, assetId, action, JSON.stringify(details)]);
}
export async function loadTeamScope(membershipId: string, permission?: TeamPermission) {
    const actor = await requireTeamActor();
    await ensureTeamAccessSchema();
    const row = (await getDb().query('SELECT * FROM team_access WHERE id::text=$1', [membershipId])).rows[0];
    if (!row)
        throw new TeamAccessError('Team access is unavailable.');
    const grant = mapTeamGrant(row);
    if (!teamGrantIsLive(grant, actor))
        throw new TeamAccessError('Team access has expired, changed or been revoked.');
    const profile = await getAccountProfile({ id: grant.ownerId });
    if (!['owner', 'dealer'].includes(profile.accountType) || profile.accountStatus !== 'active' || await sharingPlan(grant.ownerId, profile.accountType) !== 'desktop')
        throw new TeamAccessError('This business workspace is unavailable.');
    if (permission)
        assertTeamPermission(grant, permission);
    return { actor, grant, businessName: profile.businessName || profile.displayName || 'Team workspace' };
}
export type TeamScope = Awaited<ReturnType<typeof loadTeamScope>>;
export async function requireTeamAsset(scope: TeamScope, assetId: string, client?: PoolClient): Promise<AssetRegisterItem> {
    const existing = await (client || getDb()).query(`SELECT id FROM asset_register_items WHERE user_id=$1 AND id::text=$2 AND coalesce(to_jsonb(asset_register_items)->>'lifecycle_state','active')='active'${client ? ' FOR UPDATE' : ''}`, [scope.grant.ownerId, assetId]);
    if (!existing.rows.length)
        throw new TeamAccessError('Asset unavailable.', 404);
    const asset = await getAssetRegisterItemById(scope.grant.ownerId, assetId, client);
    if (!asset || !teamCanAccessAsset(scope.grant, asset))
        throw new TeamAccessError('Asset unavailable.', 404);
    return asset;
}
/** Grant lock serializes edits with revocation; asset lock rechecks scope after concurrent moves. */
export async function lockTeamScope(client: PoolClient, scope: TeamScope, assetId: string, permission: TeamPermission) {
    const row = (await client.query('SELECT * FROM team_access WHERE id=$1 FOR SHARE', [scope.grant.id])).rows[0];
    if (!row)
        throw new TeamAccessError('Team access is unavailable.');
    const fresh = mapTeamGrant(row);
    if (!teamGrantIsLive(fresh, scope.actor))
        throw new TeamAccessError('Team access has expired or been revoked.');
    if (fresh.version !== scope.grant.version)
        throw new TeamAccessError('Your permissions changed. Refresh and try again.', 409);
    assertTeamPermission(fresh, permission);
    await setAssetHistoryActor(client, scope.actor.id, scope.actor.name || scope.actor.email, 'team-workspace');
    return requireTeamAsset({ ...scope, grant: fresh }, assetId, client);
}
export async function listTeamOwnerAssets(ownerId: string) {
    const registers = await listAssetRegisters(ownerId);
    const lists = await Promise.all(registers.map(r => listAssetRegisterItems(ownerId, r.id)));
    return [...new Map(lists.flat().map(a => [a.id, a])).values()];
}
export async function teamAssetList(scope: TeamScope) {
    const registers = await listAssetRegisters(scope.grant.ownerId);
    const assets = (await listTeamOwnerAssets(scope.grant.ownerId)).filter(a => teamCanAccessAsset(scope.grant, a));
    return assets.map(asset => projectTeamAsset(asset, scope.grant, registers.find(r => r.id === asset.registerId)?.businessName || 'Asset register', resolveAssetUsage({ kind: asset.kind, hours: asset.hours, lifeWorkedPercent: asset.lifeWorkedPercent, specsJson: asset.specsJson })));
}
export async function teamDocuments(scope: TeamScope) {
    if (!scope.grant.documentIds.length)
        return [];
    const assets = await listTeamOwnerAssets(scope.grant.ownerId);
    const allowed = new Set(assets.filter(a => teamCanAccessAsset(scope.grant, a)).map(a => a.id));
    // Multi-asset documents must not reveal records outside the member's scope.
    return (await listAccountDocuments(scope.grant.ownerId)).filter(d => !d.deletedAtIso && scope.grant.documentIds.includes(d.id) && d.assetLinks.length > 0 && d.assetLinks.every(a => allowed.has(a.id)));
}
function ids(value: unknown): string[] {
    if (!Array.isArray(value) || value.length > 2000 || value.some(v => typeof v !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(v)))
        throw new TeamAccessError('Invalid access selection.', 400);
    return [...new Set(value)];
}
export async function saveTeamGrant(actor: TeamActor, body: Record<string, unknown>) {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || email === actor.email || !displayName || displayName.length > 100)
        throw new TeamAccessError('Enter the person’s name and their own valid email address.', 400);
    const scope = body.scope;
    if (scope !== 'all' && scope !== 'selected')
        throw new TeamAccessError('Choose an asset scope.', 400);
    const registerIds = ids(body.registerIds), assetIds = ids(body.assetIds), documentIds = ids(body.documentIds);
    if (scope === 'selected' && !registerIds.length && !assetIds.length)
        throw new TeamAccessError('Select at least one register or asset.', 400);
    const expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;
    if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()))
        throw new TeamAccessError('Choose an expiry date in the future.', 400);
    const [registers, assets, documents] = await Promise.all([listAssetRegisters(actor.id), listTeamOwnerAssets(actor.id), listAccountDocuments(actor.id)]);
    if (registerIds.some(id => !registers.some(r => r.id === id)) || assetIds.some(id => !assets.some(a => a.id === id)))
        throw new TeamAccessError('Select assets and registers belonging to this account.', 400);
    const selected: Pick<TeamGrant, 'scope' | 'registerIds' | 'assetIds'> = { scope, registerIds, assetIds };
    if (documentIds.some(id => !documents.some(d => d.id === id && !d.deletedAtIso && d.assetLinks.length > 0 && d.assetLinks.every(a => assets.some(asset => asset.id === a.id && teamCanAccessAsset(selected, asset))))))
        throw new TeamAccessError('Approved documents must belong to assets within the selected scope.', 400);
    const permissions = normalizeTeamPermissions(body.permissions);
    const client = await getDb().connect();
    try {
        await client.query('BEGIN');
        // Serialize creation and cap account-level invitation growth.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['team-access:' + actor.id]);
        let row;
        if (body.id) {
            const current = (await client.query('SELECT * FROM team_access WHERE id::text=$1 AND owner_id=$2 FOR UPDATE', [body.id, actor.id])).rows[0];
            if (!current || current.email !== email)
                throw new TeamAccessError('Team member unavailable.', 404);
            if (current.version !== body.version)
                throw new TeamAccessError('This access changed. Refresh before saving.', 409);
            row = (await client.query(`UPDATE team_access SET display_name=$3,scope=$4,register_ids=$5::jsonb,asset_ids=$6::jsonb,document_ids=$7::jsonb,permissions=$8::jsonb,expires_at=$9,version=version+1,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *`, [current.id, actor.id, displayName, scope, JSON.stringify(registerIds), JSON.stringify(assetIds), JSON.stringify(documentIds), JSON.stringify(permissions), expiresAt])).rows[0];
        }
        else {
            const count = (await client.query('SELECT count(*)::int AS count FROM team_access WHERE owner_id=$1', [actor.id])).rows[0].count;
            if (count >= 500)
                throw new TeamAccessError('This account has reached its team invitation limit.', 400);
            const existing = (await client.query('SELECT id FROM team_access WHERE owner_id=$1 AND email=$2', [actor.id, email])).rows[0];
            if (existing)
                throw new TeamAccessError('This email already has an invitation. Edit or reactivate that entry.', 409);
            row = (await client.query(`INSERT INTO team_access(owner_id,email,display_name,scope,register_ids,asset_ids,document_ids,permissions,expires_at) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9) RETURNING *`, [actor.id, email, displayName, scope, JSON.stringify(registerIds), JSON.stringify(assetIds), JSON.stringify(documentIds), JSON.stringify(permissions), expiresAt])).rows[0];
        }
        const grant = mapTeamGrant(row);
        await auditTeam(client, actor, grant, body.id ? 'Permissions updated' : 'Person invited', null, { permissions, scope, registerIds, assetIds, documentIds, expiresAt });
        await client.query('COMMIT');
        return grant;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
export async function setTeamGrantStatus(actor: TeamActor, id: string, version: number, status: 'pending' | 'revoked') {
    const client = await getDb().connect();
    try {
        await client.query('BEGIN');
        const row = (await client.query(`UPDATE team_access SET status=$4,member_user_id=NULL,accepted_at=NULL,version=version+1,updated_at=now() WHERE id::text=$1 AND owner_id=$2 AND version=$3 AND ($4='revoked' OR expires_at IS NULL OR expires_at>now()) RETURNING *`, [id, actor.id, version, status])).rows[0];
        if (!row)
            throw new TeamAccessError('Access changed or is unavailable. Refresh and try again.', 409);
        const grant = mapTeamGrant(row);
        await auditTeam(client, actor, grant, status === 'revoked' ? 'Access revoked' : 'Invitation renewed');
        await client.query('COMMIT');
        return grant;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
export async function acceptTeamGrant(actor: TeamActor, id: string) {
    if (!actor.emailVerified)
        throw new TeamAccessError('Verify your email before accepting an invitation.');
    const client = await getDb().connect();
    try {
        await client.query('BEGIN');
        const row = (await client.query(`UPDATE team_access SET status='active',member_user_id=$3,accepted_at=now(),version=version+1,updated_at=now()
      WHERE id::text=$1 AND email=$2 AND status='pending' AND (member_user_id IS NULL OR member_user_id=$3) AND (expires_at IS NULL OR expires_at>now()) RETURNING *`, [id, actor.email, actor.id])).rows[0];
        if (!row)
            throw new TeamAccessError('This invitation is unavailable or belongs to another email address.');
        const grant = mapTeamGrant(row);
        await auditTeam(client, actor, grant, 'Invitation accepted');
        await client.query('COMMIT');
        return grant;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
