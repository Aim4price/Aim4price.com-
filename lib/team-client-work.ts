import { createHash } from 'node:crypto';
import { getDb } from './db';
import { ensurePartnerAccessTables } from './partner-access';
import { ensureGuestLeadSchema } from './guest-lead-schema';
import { readPublicAssetShare } from './asset-share-links';
import { canBusinessRead } from './business-accounts';
import { getAccountProfile } from './account-profile';
import { teamAccountKind } from './team-account-policy';
import { clientWorkSelected, projectClientAsset, type TeamClientWork } from './team-client-policy';
import { EMPTY_TEAM_PERMISSIONS, type TeamGrant } from './team-access-policy';

/** Share tokens, raw snapshots, private messages, files and URLs never leave this adapter. */
export async function listTeamClientWork(ownerId: string, grant?: TeamGrant): Promise<TeamClientWork[]> {
  const profile = await getAccountProfile({ id: ownerId });
  const kind = teamAccountKind(profile.accountType, profile.accountSubtype);
  if (!kind || kind === 'owner' || profile.accountStatus !== 'active') return [];
  if (grant && (grant.ownerId !== ownerId || !grant.permissions.viewClientWork)) return [];
  const user = (await getDb().query('SELECT id,email,"emailVerified" FROM "user" WHERE id=$1', [ownerId])).rows[0];
  if (!user || (kind === 'business' && !await canBusinessRead(user))) return [];
  await ensurePartnerAccessTables();
  await ensureGuestLeadSchema();
  const permissions = grant?.permissions || { ...EMPTY_TEAM_PERMISSIONS, viewClientWork: true };
  const selected = (id: string) => !grant || clientWorkSelected(grant, id);
  // A deleted/transferred asset no longer belongs to the sender. Do not expose saved snapshots.
  const enquiries = (await getDb().query(`SELECT l.id::text,l.status,l.asset_snapshot_json,l.included_sections_json,
    l.owner_contact_name,l.owner_contact_email,l.owner_contact_phone,p.business_name,p.display_name
    FROM asset_leads l JOIN asset_register_items a ON a.id=l.asset_register_item_id AND a.user_id=l.owner_user_id
    JOIN account_profiles p ON p.user_id=l.owner_user_id AND p.account_status='active'
    WHERE l.partner_user_id=$1 AND l.status NOT IN ('closed','declined')
    AND coalesce(to_jsonb(a)->>'lifecycle_state','active')='active' ORDER BY l.created_at DESC`, [ownerId])).rows;
  const result: TeamClientWork[] = enquiries.filter(row => selected('lead:' + row.id)).map(row => {
    const snapshot = row.asset_snapshot_json || {}, sections = row.included_sections_json || {};
    const text = (value: unknown) => typeof value === 'string' ? value : '';
    const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
    return { id: 'lead:' + row.id, kind: 'enquiry', status: row.status, title: text(snapshot.title) || 'Client enquiry', client: row.business_name || row.display_name || 'Client',
      assets: sections.assetDetails === true ? [projectClientAsset({ title: text(snapshot.title), serialNumber: text(snapshot.serialNumber), yearModel: money(snapshot.yearModel), usage: typeof snapshot.hours === 'number' && Number.isFinite(snapshot.hours) ? String(snapshot.hours) : '', condition: text(snapshot.condition), valueExVat: sections.valuationSummary === true ? money(snapshot.selectedValueExVat) ?? money(snapshot.value) : null, replacementPriceExVat: sections.valuationSummary === true ? money(snapshot.replacementPriceExVat) : null }, permissions)] : [],
      ...(permissions.viewClientContacts ? { contact: { name: row.owner_contact_name || '', email: row.owner_contact_email || '', phone: row.owner_contact_phone || '' } } : {}),
      canRespond: permissions.manageClientEnquiries,
    };
  });
  // Only explicitly addressed shares are delegated. Public links and bearer-token possession do not count.
  const shares = (await getDb().query(`SELECT s.token,s.lead_details FROM asset_share_links s
    JOIN account_profiles p ON p.user_id=s.user_id AND p.account_status='active'
    WHERE s.revoked_at IS NULL AND s.history_deleted_at IS NULL AND
    lower(s.lead_details->>'recipientEmail')=lower($2) AND (coalesce(s.lead_details->>'recipientUserId','')='' OR s.lead_details->>'recipientUserId'=$1)
    ORDER BY s.created_at DESC`, [ownerId, user.email])).rows;
  for (const row of shares) {
    const id = 'share:' + createHash('sha256').update(row.token).digest('hex');
    if (!selected(id)) continue;
    const share = await readPublicAssetShare(row.token);
    if (!share) continue;
    const stillAddressed = (await getDb().query(`SELECT s.token FROM asset_share_links s JOIN account_profiles p ON p.user_id=s.user_id AND p.account_status='active'
      WHERE s.token=$1 AND s.revoked_at IS NULL AND s.history_deleted_at IS NULL AND lower(s.lead_details->>'recipientEmail')=lower($3)
      AND (coalesce(s.lead_details->>'recipientUserId','')='' OR s.lead_details->>'recipientUserId'=$2)`, [row.token, ownerId, user.email])).rows.length;
    if (!stillAddressed) continue;
    result.push({ id, kind: 'shared-assets', title: share.umbrellaName || 'Shared assets', client: share.senderName || 'Client', status: 'Shared',
      assets: share.assets.map(asset => projectClientAsset(asset, permissions)), canRespond: false,
      ...(permissions.viewClientContacts ? { contact: { name: row.lead_details.replyName || '', email: row.lead_details.replyEmail || '', phone: row.lead_details.replyPhone || '' } } : {}),
    });
  }
  return result;
}
