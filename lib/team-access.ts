import { getManagedTeamActor, hashTeamPassword } from './team-login';
import type { PoolClient } from 'pg';
import { getDb } from './db';
import { setAssetHistoryActor } from './asset-history-schema';
import { getAnyServerSession } from './auth-session';
import { getAccountProfile } from './account-profile';
import { sharingPlan } from './sharing-foundation';
import { listAssetGroups } from './asset-groups';
import { projectTeamGroups } from './team-register';
import { listAssetRegisters } from './asset-registers';
import { getAssetRegisterItemById, listAssetRegisterItemsForRegisters, type AssetRegisterItem } from './asset-register-db';
import { listAccountDocuments } from './account-documents';
import { resolveAssetUsage } from './asset-usage';
import { ensureTeamAccessSchema } from './team-access-schema';
import { TeamAccessError, isDesktopUsername, normalizeTeamPermissions, teamGrantIsLive, teamCanAccessAsset, assertTeamPermission, projectTeamAsset, type TeamActor, type TeamGrant, type TeamPermission } from './team-access-policy';
type TeamGrantRow = {
    managed_login?: boolean;
    username?: string | null;
    id: string;
    owner_id: string;
    email: string | null;
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
    return { managedLogin: row.managed_login === true, id: row.id, ownerId: row.owner_id, email: row.email || '', username: row.username || undefined, displayName: row.display_name, memberUserId: row.member_user_id,
        status: row.status, scope: row.scope, registerIds: row.register_ids, assetIds: row.asset_ids, documentIds: row.document_ids,
        permissions: normalizeTeamPermissions(row.permissions), expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null, version: row.version };
}
export async function requireTeamActor(): Promise<TeamActor> {
    const session = await getAnyServerSession();
    if (!session?.user?.id) {
        const managed = await getManagedTeamActor();
        if (managed) return managed;
        throw new TeamAccessError('Sign in with your own account.', 401);
    }
    const profile = await getAccountProfile(session.user);
    if (profile.accountStatus === 'suspended')
        throw new TeamAccessError('This account is suspended.', 403);
    return { id: session.user.id, email: session.user.email.trim().toLowerCase(), emailVerified: session.user.emailVerified === true, name: session.user.name };
}
export async function requireTeamOwner() {
    const actor = await requireTeamActor();
    if (actor.managedGrantId) throw new TeamAccessError('Only the business owner can manage desktop users.');
    const profile = await getAccountProfile(actor);
    if (!['owner', 'dealer'].includes(profile.accountType) || profile.accountStatus !== 'active' || await sharingPlan(actor.id, profile.accountType) !== 'desktop')
        throw new TeamAccessError('Team access requires an active Owner or Dealer desktop account.');
    await ensureTeamAccessSchema();
    return { actor, profile };
}
/** Use the same eligibility rule as desktop-user administration. */
export async function canManageTeamAccess(): Promise<boolean> {
    try { await requireTeamOwner(); return true; }
    catch (error) {
        if (error instanceof TeamAccessError) return false;
        throw error;
    }
}
export async function auditTeam(client: Pick<PoolClient, 'query'>, actor: TeamActor, grant: TeamGrant, action: string, assetId: string | null = null, details: Record<string, unknown> = {}) {
    await client.query('INSERT INTO team_access_activity(owner_id,membership_id,actor_id,actor_email,asset_id,action,details) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)', [grant.ownerId, grant.id, actor.id, actor.username || actor.email, assetId, action, JSON.stringify({ ...details, targetName: grant.displayName, targetEmail: grant.username || grant.email })]);
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
    return { actor, grant, accountType: profile.accountType, accountSubtype: profile.accountSubtype, logoUrl: profile.logoUrl, businessName: profile.businessName || profile.displayName || 'Team workspace' };
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
export async function listTeamOwnerAssets(ownerId: string, registers?: Awaited<ReturnType<typeof listAssetRegisters>>) {
    const ownerRegisters = registers ?? await listAssetRegisters(ownerId);
    return listAssetRegisterItemsForRegisters(ownerId, ownerRegisters.map(register => register.id));
}
export async function teamAssetList(scope: TeamScope) {
    const registers = await listAssetRegisters(scope.grant.ownerId);
    const assets = (await listTeamOwnerAssets(scope.grant.ownerId, registers)).filter(a => teamCanAccessAsset(scope.grant, a));
    return assets.map(asset => ({
        ...projectTeamAsset(asset, scope.grant, registers.find(r => r.id === asset.registerId)?.businessName || 'Asset register', resolveAssetUsage({ kind: asset.kind, hours: asset.hours, lifeWorkedPercent: asset.lifeWorkedPercent, specsJson: asset.specsJson })),
        registerLogoUrls: registers.find(r => r.id === asset.registerId)?.logoUrls || [],
        registerShowLogos: registers.find(r => r.id === asset.registerId)?.showLogosOnRegister !== false,
        registerIncludedInCombinedTotals: registers.find(r => r.id === asset.registerId)?.includeInCombinedTotals !== false,
    }));
}
export async function teamRegisterGroups(scope: TeamScope, assets: Awaited<ReturnType<typeof teamAssetList>>) {
    return projectTeamGroups(await listAssetGroups(scope.grant.ownerId), assets);
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
    const loginType = body.loginType;
    if (loginType !== undefined && loginType !== 'existing' && loginType !== 'managed') throw new TeamAccessError('Choose how this person will sign in.', 400);
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const usernameLogin = loginType === 'managed' && (!body.id || Boolean(username));
    if (usernameLogin && !isDesktopUsername(username)) throw new TeamAccessError('Use a username of 3–40 characters, such as kuyler@skimmelkrans. Full email addresses are reserved for personal accounts.', 400);
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if ((!usernameLogin && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || email === actor.email)) || !displayName || displayName.length > 100)
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
    const password = typeof body.password === 'string' ? body.password : '';
    if (loginType === 'existing' && password) throw new TeamAccessError('Existing users keep their own Aim4price password.', 400);
    const passwordHash = password ? await hashTeamPassword(password) : null;
    const client = await getDb().connect();
    try {
        await client.query('BEGIN');
        if (usernameLogin && !body.id) {
            // Serialize the availability check across businesses, including revoked logins.
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['desktop-username:' + username]);
            if ((await client.query('SELECT id FROM team_access WHERE username=$1 LIMIT 1', [username])).rows.length)
                throw new TeamAccessError('This username is already in use. Choose another username.', 409);
        }
        // Serialize creation and cap account-level invitation growth.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['team-access:' + actor.id]);
        let row;
        if (body.id) {
            const current = (await client.query('SELECT * FROM team_access WHERE id::text=$1 AND owner_id=$2 FOR UPDATE', [body.id, actor.id])).rows[0];
            if (!current || (current.email || '') !== email || (current.username || '') !== username)
                throw new TeamAccessError('Team member unavailable.', 404);
            if (loginType && (current.managed_login ? loginType !== 'managed' : loginType !== 'existing')) throw new TeamAccessError('A login type cannot be changed. Add a separate user instead.', 400);
            if (!current.managed_login && passwordHash) throw new TeamAccessError('Existing users keep their own Aim4price password.', 400);
            if (current.version !== body.version)
                throw new TeamAccessError('This access changed. Refresh before saving.', 409);
            row = (await client.query(`UPDATE team_access SET display_name=$3,scope=$4,register_ids=$5::jsonb,asset_ids=$6::jsonb,document_ids=$7::jsonb,permissions=$8::jsonb,expires_at=$9,version=version+1,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *`, [current.id, actor.id, displayName, scope, JSON.stringify(registerIds), JSON.stringify(assetIds), JSON.stringify(documentIds), JSON.stringify(permissions), expiresAt])).rows[0];
        }
        else {
            const count = (await client.query('SELECT count(*)::int AS count FROM team_access WHERE owner_id=$1', [actor.id])).rows[0].count;
            if (count >= 500)
                throw new TeamAccessError('This account has reached its desktop user limit.', 400);
            const existing = (await client.query('SELECT id FROM team_access WHERE owner_id=$1 AND ((email=$2 AND $2 IS NOT NULL) OR (username=$3 AND $3 IS NOT NULL))', [actor.id, usernameLogin ? null : email, usernameLogin ? username : null])).rows[0];
            if (existing)
                throw new TeamAccessError('This login already has desktop access. Edit or reactivate that entry.', 409);
            row = (await client.query(`INSERT INTO team_access(owner_id,email,display_name,scope,register_ids,asset_ids,document_ids,permissions,expires_at,username) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10) RETURNING *`, [actor.id, usernameLogin ? null : email, displayName, scope, JSON.stringify(registerIds), JSON.stringify(assetIds), JSON.stringify(documentIds), JSON.stringify(permissions), expiresAt, usernameLogin ? username : null])).rows[0];
        }
        const existingLogin = (await client.query('SELECT id FROM "user" WHERE lower(email)=$1 ORDER BY id LIMIT 1', [email])).rows[0];
        if (!body.id && loginType === 'existing' && !existingLogin) throw new TeamAccessError('No Aim4price account is registered with this email. Check the email or choose Create desktop login.', 400);
        if (row.managed_login || (!body.id && (loginType === 'managed' || !existingLogin))) {
            if (!row.managed_login && !passwordHash) throw new TeamAccessError('Enter an initial password for this new desktop user.', 400);
            if (passwordHash) {
                await client.query('INSERT INTO team_access_logins(grant_id,password_hash) VALUES($1,$2) ON CONFLICT(grant_id) DO UPDATE SET password_hash=excluded.password_hash', [row.id, passwordHash]);
                await client.query('DELETE FROM team_access_sessions WHERE grant_id=$1', [row.id]);
            }
            row = (await client.query("UPDATE team_access SET managed_login=true,status=CASE WHEN status='pending' THEN 'active' ELSE status END,member_user_id=NULL WHERE id=$1 RETURNING *", [row.id])).rows[0];
        } else if (row.status === 'pending' && existingLogin) {
            row = (await client.query("UPDATE team_access SET member_user_id=$2,status='active' WHERE id=$1 RETURNING *", [row.id, existingLogin.id])).rows[0];

        }
        const grant = mapTeamGrant(row);
        if (grant.managedLogin && passwordHash) await auditTeam(client, actor, grant, body.id ? 'Desktop password reset' : 'Desktop login created');
        await auditTeam(client, actor, grant, body.id ? 'Permissions updated' : 'Desktop user added', null, { permissions, scope, registerIds, assetIds, documentIds, expiresAt });
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
        const row = (await client.query(`UPDATE team_access SET status=CASE WHEN $4='pending' AND ((managed_login AND EXISTS (SELECT 1 FROM team_access_logins l WHERE l.grant_id=team_access.id)) OR (NOT managed_login AND EXISTS (SELECT 1 FROM "user" u WHERE u.id=team_access.member_user_id AND lower(u.email)=team_access.email))) THEN 'active' ELSE $4 END,accepted_at=NULL,version=version+1,updated_at=now() WHERE id::text=$1 AND owner_id=$2 AND version=$3 AND ($4='revoked' OR expires_at IS NULL OR expires_at>now()) RETURNING *`, [id, actor.id, version, status])).rows[0];
        if (!row)
            throw new TeamAccessError('Access changed or is unavailable. Refresh and try again.', 409);
        await client.query('DELETE FROM team_access_sessions WHERE grant_id=$1', [row.id]);
        const grant = mapTeamGrant(row);
        await auditTeam(client, actor, grant, status === 'revoked' ? 'Access revoked' : 'Access reactivated');
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
export async function prepareTeamAccessEmail(actor: TeamActor, id: string, version: number) {
    const row = (await getDb().query(`UPDATE team_access SET version=version+1,updated_at=now()
        WHERE id::text=$1 AND owner_id=$2 AND version=$3 AND status='active' AND managed_login=false
        AND member_user_id IS NOT NULL AND (expires_at IS NULL OR expires_at>now()) RETURNING *`, [id, actor.id, version])).rows[0];
    if (!row) throw new TeamAccessError('Access changed or is unavailable. Refresh and try again.', 409);
    return mapTeamGrant(row);
}
export async function acceptTeamGrant(actor: TeamActor, id: string) {
    if (actor.managedGrantId) throw new TeamAccessError('This desktop login already has its assigned access.');
    const client = await getDb().connect();
    try {
        await client.query('BEGIN');
        const row = (await client.query(`UPDATE team_access SET status='active',member_user_id=$3,accepted_at=now(),version=version+1,updated_at=now()
      WHERE id::text=$1 AND email=$2 AND status='pending' AND managed_login=false AND (member_user_id=$3 OR (member_user_id IS NULL AND $4=true)) AND (expires_at IS NULL OR expires_at>now()) RETURNING *`, [id, actor.email, actor.id, actor.emailVerified])).rows[0];
        if (!row)
            throw new TeamAccessError('This access is unavailable or belongs to another email address.');
        const grant = mapTeamGrant(row);
        await auditTeam(client, actor, grant, 'Workspace opened');
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

/** Remove only this business membership; retain the account and audit history. */
export async function removeTeamGrant(actor: TeamActor, id: string, version: number) {
    const client = await getDb().connect();
    try {
        await client.query('BEGIN');
        const row = (await client.query('SELECT * FROM team_access WHERE id::text=$1 AND owner_id=$2 AND version=$3 FOR UPDATE', [id, actor.id, version])).rows[0];
        if (!row) throw new TeamAccessError('Access changed or is unavailable. Refresh and try again.', 409);
        await auditTeam(client, actor, mapTeamGrant(row), 'Desktop user removed', null, { email: row.email || '', username: row.username || undefined, displayName: row.display_name });
        // Credentials and sessions cascade; activity is retained with a nullable membership link.
        await client.query('DELETE FROM team_access WHERE id=$1 AND owner_id=$2', [row.id, actor.id]);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
