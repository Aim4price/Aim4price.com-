import { listAssetGroups } from '../../../lib/asset-groups';
import { buildAppAssetDirectoryGroups } from '../../../lib/app-asset-directory';
import { NextRequest } from 'next/server';
import { getDb } from '../../../lib/db';
import { requireTeamOwner, mapTeamGrant, saveTeamGrant, setTeamGrantStatus, removeTeamGrant, listTeamOwnerAssets } from '../../../lib/team-access';
import { teamJson, teamError } from '../../../lib/team-access-http';
import { TeamAccessError } from '../../../lib/team-access-policy';
import { listAssetRegisters } from '../../../lib/asset-registers';
import { listAccountDocuments } from '../../../lib/account-documents';
import { requireBusinessOrigin, businessBody } from '../../../lib/business-network-api';
import { limitBusinessAction } from '../../../lib/business-network';
import { sendAim4priceEmail, getSiteOrigin } from '../../../lib/email';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const { actor } = await requireTeamOwner();
        const [rows, registers, assets, documents, activity, groups] = await Promise.all([
            getDb().query('SELECT * FROM team_access WHERE owner_id=$1 ORDER BY created_at DESC', [actor.id]),
            listAssetRegisters(actor.id), listTeamOwnerAssets(actor.id), listAccountDocuments(actor.id),
            getDb().query('SELECT a.id,a.actor_email,a.action,a.asset_id,a.details,a.created_at,t.display_name AS target_name,t.email AS target_email FROM team_access_activity a LEFT JOIN team_access t ON t.id=a.membership_id WHERE a.owner_id=$1 ORDER BY a.created_at DESC LIMIT 100', [actor.id]),
            listAssetGroups(actor.id),
        ]);
        return teamJson({ groups: buildAppAssetDirectoryGroups(groups, assets.map(a => a.id)), businessId: actor.id, members: rows.rows.map(mapTeamGrant), registers: registers.map(r => ({ id: r.id, name: r.businessName })), assets: assets.map(a => ({ id: a.id, title: a.title, registerId: a.registerId })), documents: documents.filter(d => !d.deletedAtIso && d.assetLinks.length).map(d => ({ id: d.id, title: d.title, assetIds: d.assetLinks.map(a => a.id) })), activity: activity.rows });
    }
    catch (error) {
        return teamError(error);
    }
}
export async function POST(request: NextRequest) {
    try {
        requireBusinessOrigin(request);
        const { actor, profile } = await requireTeamOwner();
        await limitBusinessAction('team-invite:' + actor.id, 30);
        const body = await businessBody(request);
        if (body.action === 'remove') {
            await removeTeamGrant(actor, String(body.id || ''), Number(body.version));
            return teamJson({ ok: true, warning: 'Desktop user removed. Their access to this business has ended.' });
        }
        let grant;
        if (body.action === 'revoke' || body.action === 'reinvite') {
            grant = await setTeamGrantStatus(actor, String(body.id || ''), Number(body.version), body.action === 'revoke' ? 'revoked' : 'pending');
        }
        else if (body.action === 'save')
            grant = await saveTeamGrant(actor, body);
        else
            throw new TeamAccessError('Unsupported team action.', 400);
        let warning = body.action === 'revoke' ? 'Access revoked.' : grant.managedLogin ? (body.action === 'save' && body.password ? 'Desktop password saved. Share the business sign-in link and password with this person.' : 'Desktop access saved.') : '';
        if (body.sendInvitation === true && grant.status === 'pending') {
            const link = getSiteOrigin() + '/team';
            const name = (profile.businessName || profile.displayName || 'An Aim4price business').replace(/[<>"&]/g, '');
            try {
                await sendAim4priceEmail({ to: grant.email, subject: `${name} invited you to Aim4price`, text: `${name} invited you to their team workspace. Sign in with your existing Aim4price account and accept the invitation at ${link}. Your access is controlled by the business owner.`, html: `<p>${name} invited you to their Aim4price team workspace.</p><p>Sign in with your existing Aim4price account and accept the invitation.</p><p><a href="${link}">Open team workspace</a></p><p>Your access is controlled by the business owner.</p>` });
                warning = 'Invitation sent. This person uses their existing Aim4price password.';
            }
            catch {
                warning = 'Access saved, but the invitation email could not be sent. Copy the team workspace link and share it with this person.';
            }
        }
        return teamJson({ ok: true, member: grant, warning });
    }
    catch (error) {
        return teamError(error);
    }
}
