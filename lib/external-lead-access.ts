import { sharingPlan } from './sharing-foundation';
import { liveShareOwnershipSql } from './asset-share-links';
import { getServerSession } from './auth-session';
import { getAccountProfile } from './account-profile';
import { canBusinessRead, canBusinessContribute } from './business-accounts';
import { getAssetRegisterAccountAccess } from './asset-register-account-access';
import { readLeadPage } from './guest-leads';
import { getDb } from './db';
import { normalizeExternalPermissions, type ExternalSharePermission } from './external-share-permissions';
export type ExternalLeadAccess = 'read-only' | 'signup-required' | 'request-access' | 'sign-in' | 'verify-email' | 'approval-required' | 'wrong-recipient' | 'suspended' | 'owner' | 'active';
export class ExternalLeadAccessError extends Error {
    constructor(message: string, readonly status: number) { super(message); }
}
type Lead = NonNullable<Awaited<ReturnType<typeof readLeadPage>>>;
export async function externalLeadAccess(lead: Lead) {
    const session = await getServerSession({ requireActive: false, allowDealerApp: true, allowOwnerApp: true });
    const user = session?.user;
    const result = (access: ExternalLeadAccess) => ({ access, user: user || null });
    if (!user) return result('sign-in');
    if (user.id === lead.ownerId && await getAssetRegisterAccountAccess(session!))
        return result('owner');
    // Untargeted links carry the sender-selected permissions for signed-in recipients.
    const unbound = Boolean(lead.details && !lead.details.recipientEmail && !lead.details.recipientUserId && (['owner-approval','signed-in'].includes(lead.details.accessMode || '') || lead.details.recipientWhatsApp));
    if (lead.details && !unbound && (!lead.details?.recipientEmail || user.email.toLowerCase() !== lead.details.recipientEmail.toLowerCase() || (lead.details.recipientUserId && lead.details.recipientUserId !== user.id)))
        return result('wrong-recipient');
    // A normal signed-in account satisfies identity access; mailbox verification is separate.
    if (!user.email) return result('sign-in');
    const profile = await getAccountProfile(user);
    const plan = await sharingPlan(user.id, profile.accountType);
    if (plan === 'free' && user.emailVerified !== true) return result('verify-email');
    if (profile.accountStatus === 'suspended')
        return result('suspended');
    if (!lead.details) return result('read-only');
    if (profile.accountType === 'business') {
        if (!(await canBusinessRead(user))) return result('suspended');
        if (unbound) return result('active');
        return result(await canBusinessContribute(user) ? 'active' : 'read-only');
    }
    if (profile.accountType === 'dealer' && plan === 'free')
        return result('active');
    const active = await getServerSession({ requireActive: true, allowDealerApp: true, allowOwnerApp: true });
    return result(active?.user.id === user.id && profile.accountStatus === 'active' ? 'active' : 'approval-required');
}
export function leadAllows(lead: Lead, permission: ExternalSharePermission): boolean {
    if (lead.details?.permissions)
        return normalizeExternalPermissions(lead.details.permissions)[permission] === true;
    // Older links retain their chosen reports/documents, but now require signed-in account access.
    return permission === 'reports' ? lead.reports.length > 0 : permission === 'documents' && lead.details?.allowSubmissions === true;
}
export async function requireExternalLeadAction(token: string, permission: ExternalSharePermission) {
    const lead = await readLeadPage(token);
    if (!lead)
        throw new ExternalLeadAccessError('This action was not shared or the enquiry is no longer available.', lead ? 403 : 404);
    const { access, user } = await externalLeadAccess(lead);
    if (!user || (access !== 'owner' && (access !== 'active' || !leadAllows(lead,permission))))
        throw new ExternalLeadAccessError('This action requires the recipient’s signed-in, approved account.', user ? 403 : 401);
    return { lead, user };
}
// Reuse the existing owner approval and revaluation workflow for external proposals.
export async function resolveExternalCorrectionAccess(input: {
    dealerUserId: string;
    sourceId: string;
    field: string;
}) {
    const match = /^([A-Za-z0-9_-]{43}):([0-9a-f-]{36}|\d{1,2})$/i.exec(input.sourceId);
    const permission = input.field === 'serialNumber' ? 'serialNumber' : input.field === 'replacementPriceExVat' ? 'replacementPrice' : null;
    if (!match || !permission) return null;
    const { lead, user } = await requireExternalLeadAction(match[1], permission);
    if (user.id !== input.dealerUserId) return null;
    const asset = /^\d+$/.test(match[2])
      ? lead.share.assets[Number(match[2])]
      : lead.share.assets.find(asset => asset.assetId === match[2]);
    return asset?.assetId ? { owner_user_id: lead.ownerId, asset_register_item_id: asset.assetId } : null;
}

/** Only the owner may bind an untargeted invitation to one signed-in account. */
export async function requestExternalLeadAccess(token: string) {
    const lead = await readLeadPage(token);
    if (!lead || !lead.details) throw new ExternalLeadAccessError('This enquiry is unavailable.', 404);
    const { access, user } = await externalLeadAccess(lead);
    if (access !== 'request-access' || !user) throw new ExternalLeadAccessError('Sign in with your account to request access.', 403);
    const profile = await getAccountProfile(user);
    const result = await getDb().query(`INSERT INTO asset_share_access_requests(token,user_id,email,business_name)
      SELECT token,$2,$3,$4 FROM asset_share_links s WHERE token=$1 AND revoked_at IS NULL
      AND (lead_details->>'accessMode'='owner-approval' OR coalesce(lead_details->>'recipientWhatsApp','')<>'')
      AND coalesce(lead_details->>'recipientEmail','')='' AND coalesce(lead_details->>'recipientUserId','')=''
      AND ${liveShareOwnershipSql()}
      ON CONFLICT(token,user_id) DO UPDATE SET email=EXCLUDED.email,business_name=EXCLUDED.business_name WHERE asset_share_access_requests.status='pending'
      RETURNING status`, [token,user.id,user.email.toLowerCase(),profile.businessName||user.name||user.email]);
    if (!result.rows.length) throw new ExternalLeadAccessError('This invitation is assigned, disabled or your request was declined.', 403);
}
export async function listExternalAccessRequests(token: string) {
    const lead = await readLeadPage(token);
    if (!lead || (await externalLeadAccess(lead)).access !== 'owner') throw new ExternalLeadAccessError('This action requires the asset owner.', 403);
    return (await getDb().query<{user_id:string;email:string;business_name:string;status:string}>(`SELECT user_id,email,business_name,status FROM asset_share_access_requests WHERE token=$1 ORDER BY created_at LIMIT 100`, [token])).rows;
}
export async function reviewExternalAccessRequest(token: string, userId: string, decision: string) {
    if (!['approved','rejected'].includes(decision) || !userId) throw new ExternalLeadAccessError('Choose a recipient and an access decision.', 400);
    const lead = await readLeadPage(token);
    const {access,user} = lead ? await externalLeadAccess(lead) : {access:null,user:null};
    if (access !== 'owner' || !user) throw new ExternalLeadAccessError('This action requires the asset owner.', 403);
    const db = await getDb().connect();
    try {
        await db.query('BEGIN');
        const row = (await db.query(`SELECT token FROM asset_share_links s WHERE token=$1 AND user_id=$2 AND revoked_at IS NULL
          AND (lead_details->>'accessMode'='owner-approval' OR coalesce(lead_details->>'recipientWhatsApp','')<>'')
      AND coalesce(lead_details->>'recipientEmail','')='' AND coalesce(lead_details->>'recipientUserId','')=''
          AND ${liveShareOwnershipSql()} FOR UPDATE`, [token,user.id])).rows[0];
        if (!row) throw new ExternalLeadAccessError('This invitation is already assigned or unavailable.', 409);
        const request = (await db.query(`UPDATE asset_share_access_requests SET status=$3,reviewed_at=now() WHERE token=$1 AND user_id=$2 AND status='pending' RETURNING email,business_name`, [token,userId,decision])).rows[0];
        if (!request) throw new ExternalLeadAccessError('This access request has already been reviewed.', 409);
        if (decision === 'approved') {
            await db.query(`UPDATE asset_share_links SET lead_details=lead_details || $2::jsonb WHERE token=$1`, [token,JSON.stringify({recipientUserId:userId,recipientEmail:request.email,recipientName:request.business_name})]);
            await db.query(`UPDATE asset_share_access_requests SET status='rejected',reviewed_at=now() WHERE token=$1 AND status='pending'`, [token]);
        }
        await db.query('COMMIT');
    } catch(error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
}
