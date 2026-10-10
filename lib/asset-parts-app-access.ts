import type { NextRequest } from 'next/server';
import type { AssetPartsScope } from './asset-parts-api';
import { getOwnerAppAccess, ownerAppCan, ownerAppCanAccessAsset } from './owner-app-access';
import { requireActiveFieldManagerSession } from './field-manager-session';
import { fieldManagerCan, getFieldManagerAssetForOpen } from './field-manager';
import { dealerRoleCan } from './dealer-app-access';
import { getServerSession, isDealerAppSession } from './auth-session';
import { getAccountProfile } from './account-profile';
import { getDealerTrackedAsset } from './dealer-maintenance-tracker';
import { ExternalLeadAccessError } from './external-lead-access';

type App = 'owner' | 'field-manager' | 'dealer';
// Resolve from the current app login, never from client-supplied owner or actor IDs.
export async function resolveAppPartsAccess(request: NextRequest, app: App, id: string) {
  const writing = request.method === 'POST' && request.nextUrl?.searchParams.get('format') !== 'pdf';
  async function read() {
    if (app === 'owner') {
      const access = await getOwnerAppAccess();
      if (!access) throw new ExternalLeadAccessError('Sign in to the Owner App.', 401);
      if (!ownerAppCan(access, 'view') || !ownerAppCanAccessAsset(access, id)) throw new ExternalLeadAccessError('This asset is not available to this login.', 403);
      return { ownerId: access.ownerUserId, assetId: id, actorId: access.ownerAppUserId ? `owner-app:${access.ownerAppUserId}` : access.ownerUserId, name: access.displayName, canView: true, canAdd: ownerAppCan(access, 'operate'), canReadMaintenance: true };
    }
    if (app === 'field-manager') {
      const access = await requireActiveFieldManagerSession(request);
      if (!access.ok) throw new ExternalLeadAccessError(access.error, access.status);
      const asset = await getFieldManagerAssetForOpen({ ownerUserId: access.session.ownerUserId, managerId: access.session.managerId, assetId: id });
      if (!asset) throw new ExternalLeadAccessError('This asset is not assigned to this Field Manager.', 403);
      return { ownerId: access.session.ownerUserId, assetId: asset.id, actorId: `field-manager:${access.session.managerId}`, name: access.session.displayName, canView: true, canAdd: await fieldManagerCan(access.session.managerId, 'record_work'), canReadMaintenance: true };
    }
    const session = await getServerSession({ allowDealerApp: true });
    if (!session) throw new ExternalLeadAccessError('Sign in to the Dealer App.', 401);
    if (isDealerAppSession(session) && !dealerRoleCan(session.dealerApp.role, 'maintenance')) throw new ExternalLeadAccessError('Maintenance access is not enabled for this login.', 403);
    const profile = await getAccountProfile(session.user);
    if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') throw new ExternalLeadAccessError('Dealer access is not available.', 403);
    const asset = await getDealerTrackedAsset(session.user.id, id);
    if (!asset) throw new ExternalLeadAccessError('This shared asset is no longer available.', 403);
    return { ownerId: asset.ownerUserId, assetId: asset.assetId, actorId: session.user.id, name: session.user.name || session.user.email, canView: !!asset.permissions.canViewParts, canAdd: !!asset.permissions.canAddParts, canReadMaintenance: !!(asset.permissions.canViewMaintenanceReports || asset.permissions.canAddMaintenance) };
  }
  const access = await read();
  const scope: AssetPartsScope = { sharingAccountId: app === 'dealer' ? access.actorId : undefined, ownerId: access.ownerId, assetId: access.assetId, user: { id: access.actorId, name: access.name, email: '' }, lock: async client => {
    const fresh = await read();
    if (fresh.actorId !== access.actorId || fresh.ownerId !== access.ownerId || fresh.assetId !== access.assetId || (writing ? !fresh.canAdd : access.canView ? !fresh.canView : !fresh.canAdd) || (access.canReadMaintenance && !fresh.canReadMaintenance)) throw new ExternalLeadAccessError('Your access has changed. Reopen Parts.', 403);
    if (app === 'dealer') {
      const permission = writing ? 'can_add_parts' : access.canView ? 'can_view_parts' : 'can_add_parts';
      const granted = await client.query(`SELECT id FROM dealer_maintenance_access WHERE id=$1::uuid AND dealer_user_id=$2 AND owner_user_id=$3 AND asset_register_item_id=$4::uuid AND is_active=true AND ${permission}=true ${access.canReadMaintenance ? 'AND (can_view_maintenance_reports=true OR can_add_maintenance=true)' : ''} FOR SHARE`, [id, access.actorId, access.ownerId, access.assetId]);
      if (!granted.rows.length) throw new ExternalLeadAccessError('Parts access is no longer available.', 403);
    }
  } };
  return { scope, canView: access.canView, canAdd: access.canAdd, canReadMaintenance: access.canReadMaintenance };
}
