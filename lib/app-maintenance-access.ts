import type { NextRequest } from 'next/server';
import { getOwnerAppAccess, ownerAppCan, ownerAppCanAccessAsset } from './owner-app-access';
import { getServerSession, isDealerAppSession } from './auth-session';
import { dealerRoleCan } from './dealer-app-access';
import { getAccountProfile } from './account-profile';
import { getDealerTrackedAsset } from './dealer-maintenance-tracker';
import { ExternalLeadAccessError } from './external-lead-access';

export type MaintenanceApp = 'owner' | 'dealer';
export async function resolveAppMaintenanceAccess(request: NextRequest, app: MaintenanceApp, id: string) {
  if (app === 'owner') {
    const access = await getOwnerAppAccess();
    if (!access) throw new ExternalLeadAccessError('Sign in to the Manager App.', 401);
    if (!ownerAppCan(access, 'viewMaintenance') || !ownerAppCanAccessAsset(access, id)) throw new ExternalLeadAccessError('This asset is not available to this login.', 403);
    return { ownerId: access.ownerUserId, assetId: id, canRecord: ownerAppCan(access, 'recordMaintenance'), canSchedule: ownerAppCan(access, 'scheduleMaintenance'), canEdit: ownerAppCan(access, 'scheduleMaintenance'), canRemove: ownerAppCan(access, 'manage_assets') };
  }
  if (app !== 'dealer') throw new ExternalLeadAccessError('This app is no longer available.', 410);
  const session = await getServerSession({ allowDealerApp: true });
  if (!session) throw new ExternalLeadAccessError('Sign in to the Dealer App.', 401);
  if (isDealerAppSession(session) && !dealerRoleCan(session.dealerApp.role, 'maintenance')) throw new ExternalLeadAccessError('Maintenance access is not enabled for this login.', 403);
  const profile = await getAccountProfile(session.user);
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') throw new ExternalLeadAccessError('Dealer access is not available.', 403);
  const asset = await getDealerTrackedAsset(session.user.id, id);
  if (!asset || !(asset.permissions.canAddMaintenance || asset.permissions.canCreateMaintenanceSchedules || asset.permissions.canViewMaintenanceReports)) throw new ExternalLeadAccessError('The owner has not shared maintenance access.', 403);
  return { ownerId: asset.ownerUserId, assetId: asset.assetId, canRecord: !!asset.permissions.canAddMaintenance, canSchedule: !!asset.permissions.canCreateMaintenanceSchedules, canEdit: !!asset.permissions.canAddMaintenance, canRemove: !!asset.permissions.canAddMaintenance };
}
