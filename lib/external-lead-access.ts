import { getServerSession } from './auth-session';
import { getAccountProfile } from './account-profile';
import { canBusinessContribute } from './business-accounts';
import { getAssetRegisterAccountAccess } from './asset-register-account-access';
import { readLeadPage } from './guest-leads';
import { getDb } from './db';
import { normalizeExternalPermissions, type ExternalSharePermission } from './external-share-permissions';
export type ExternalLeadAccess = 'sign-in' | 'verify-email' | 'approval-required' | 'wrong-recipient' | 'suspended' | 'owner' | 'active';
export class ExternalLeadAccessError extends Error {
    constructor(message: string, readonly status: number) { super(message); }
}
type Lead = NonNullable<Awaited<ReturnType<typeof readLeadPage>>>;
export async function externalLeadAccess(lead: Lead) {
    const session = await getServerSession({ requireActive: false, allowDealerApp: true, allowOwnerApp: true });
    const user = session?.user;
    const result = (access: ExternalLeadAccess) => ({ access, user: user || null });
    if (!user)
        return result('sign-in');
    if (user.id === lead.ownerId && await getAssetRegisterAccountAccess(session!))
        return result('owner');
    if (!lead.details?.recipientEmail || user.email.toLowerCase() !== lead.details.recipientEmail.toLowerCase())
        return result('wrong-recipient');
    if (user.emailVerified !== true)
        return result('verify-email');
    const profile = await getAccountProfile(user);
    if (profile.accountStatus === 'suspended')
        return result('suspended');
    if (profile.accountType === 'business')
        return result(await canBusinessContribute(user) ? 'active' : 'approval-required');
    const active = await getServerSession({ requireActive: true, allowDealerApp: true, allowOwnerApp: true });
    return result(active?.user.id === user.id && profile.accountStatus === 'active' ? 'active' : 'approval-required');
}
export function leadAllows(lead: Lead, permission: ExternalSharePermission): boolean {
    if (lead.details?.permissions)
        return normalizeExternalPermissions(lead.details.permissions)[permission];
    // Older links retain their chosen reports/documents, but now require verified account access.
    return permission === 'reports' ? lead.reports.length > 0 : permission === 'documents' && lead.details?.allowSubmissions === true;
}
export async function requireExternalLeadAction(token: string, permission: ExternalSharePermission) {
    const lead = await readLeadPage(token);
    if (!lead || !leadAllows(lead, permission))
        throw new ExternalLeadAccessError('This action was not shared or the enquiry is no longer available.', lead ? 403 : 404);
    const { access, user } = await externalLeadAccess(lead);
    if (access !== 'active' || !user)
        throw new ExternalLeadAccessError('This action requires the recipient’s verified, approved account.', user ? 403 : 401);
    return { lead, user };
}
// Reuse the existing owner approval and revaluation workflow for external proposals.
export async function resolveExternalCorrectionAccess(input: {
    dealerUserId: string;
    sourceId: string;
    field: string;
}) {
    const match = /^([A-Za-z0-9_-]{43}):(\d{1,2})$/.exec(input.sourceId);
    const permission = input.field === 'serialNumber' ? 'serialNumber' : input.field === 'replacementPriceExVat' ? 'replacementPrice' : null;
    if (!match || !permission)
        return null;
    const { lead, user } = await requireExternalLeadAction(match[1], permission);
    if (user.id !== input.dealerUserId)
        return null;
    const row = (await getDb().query<{
        owner_user_id: string;
        asset_register_item_id: string;
    }>(`SELECT user_id AS owner_user_id, asset_ids[$2::int + 1]::text AS asset_register_item_id FROM asset_share_links s
    WHERE token=$1 AND revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM unnest(s.asset_ids) requested(id) WHERE NOT EXISTS(SELECT 1 FROM asset_register_items a WHERE a.id=requested.id AND a.user_id=s.user_id))`, [match[1], Number(match[2])])).rows[0];
    return row?.asset_register_item_id && row.owner_user_id === lead.ownerId ? row : null;
}
