import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getAssetRegisterAccountAccess } from '../../../../lib/asset-register-account-access';
import { workspaceRole } from '../../../../lib/workspace-navigation';
import { listReceivedSharedEnquiries } from '../../../../lib/guest-leads';
import { ensurePartnerAccessTables } from '../../../../lib/partner-access';
import { ensureDealerMaintenanceTrackerTables } from '../../../../lib/dealer-maintenance-tracker';
import { getDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession({ allowBusinessWorkspace: true });
  if (!session?.user) return NextResponse.json({ error: 'Sign in to choose a client asset.' }, { status: 401 });
  const profile = await getAccountProfile(session.user);
  if (workspaceRole(profile.accountType, profile.accountSubtype) !== 'business' || !await getAssetRegisterAccountAccess(session)) {
    return NextResponse.json({ error: 'Business account required.' }, { status: 403 });
  }
  await Promise.all([ensurePartnerAccessTables(), ensureDealerMaintenanceTrackerTables()]);
  const [shares, leads] = await Promise.all([
    listReceivedSharedEnquiries({ documentUploadsOnly: true }),
    getDb().query<{id:string; asset_id:string; title:string; client:string}>(`
      SELECT DISTINCT ON (asset.id) lead.id, asset.id AS asset_id, asset.title,
        coalesce(nullif(lead.owner_contact_name,''), nullif(profile.business_name,''), nullif(profile.display_name,''), 'Client') AS client
      FROM asset_leads lead
      JOIN dealer_maintenance_access grant_row ON grant_row.asset_register_item_id = lead.asset_register_item_id
        AND grant_row.owner_user_id = lead.owner_user_id AND grant_row.dealer_user_id = lead.partner_user_id
      JOIN asset_register_items asset ON asset.id = lead.asset_register_item_id AND asset.user_id = lead.owner_user_id
      LEFT JOIN account_profiles profile ON profile.user_id = lead.owner_user_id
      WHERE lead.partner_user_id = $1 AND grant_row.is_active AND grant_row.can_add_documents
        AND coalesce(to_jsonb(asset)->>'lifecycle_state','active') = 'active'
      ORDER BY asset.id, lead.created_at DESC, lead.id
    `,[session.user.id]),
  ]);
  const options = shares.flatMap(share => share.assets.filter(asset => asset.id).map(asset => ({
    id: asset.id, title: asset.title, client: share.sender || 'Client',
    endpoint: `/api/asset-share-links/${share.token}/assets/${asset.id}/documents`,
  })));
  for (const lead of leads.rows) {
    options.push({ id:lead.asset_id, title:lead.title || 'Shared asset', client:lead.client, endpoint:`/api/asset-leads/${lead.id}/documents` });
  }
  const unique = new Map(options.map(option => [option.id, option]));
  return NextResponse.json({ assets: [...unique.values()].sort((a,b) => a.client.localeCompare(b.client) || a.title.localeCompare(b.title)) });
}
