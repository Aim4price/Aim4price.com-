import type { NextRequest } from 'next/server';
import { getOwnerAppAccess, ownerAppCan, ownerAppCanAccessAsset } from './owner-app-access';
import { requireActiveFieldManagerSession } from './field-manager-session';
import { fieldManagerCan, getFieldManagerAssetForOpen } from './field-manager';
import { getServerSession, isDealerAppSession } from './auth-session';
import { dealerRoleCan } from './dealer-app-access';
import { getAccountProfile } from './account-profile';
import { getDealerTrackedAsset } from './dealer-maintenance-tracker';
import { ExternalLeadAccessError } from './external-lead-access';

export type MaintenanceApp = 'owner' | 'field-manager' | 'dealer';
export async function resolveAppMaintenanceAccess(request: NextRequest, app: MaintenanceApp, id: string) {
  if (app === 'owner') {
    const access = await getOwnerAppAccess();
    if (!access) throw new ExternalLeadAccessError('Sign in to the Owner App.', 401);
    if (!ownerAppCan(access, 'view') || !ownerAppCanAccessAsset(access, id)) throw new ExternalLeadAccessError('This asset is not available to this login.', 403);
    return { ownerId: access.ownerUserId, assetId: id, canRecord: ownerAppCan(access, 'operate'), canSchedule: ownerAppCan(access, 'operate'), canEdit: ownerAppCan(access, 'operate'), canRemove: ownerAppCan(access, 'operate') };
  }
  if (app === 'field-manager') {
    const access = await requireActiveFieldManagerSession(request);
    if (!access.ok) throw new ExternalLeadAccessError(access.error, access.status);
    const asset = await getFieldManagerAssetForOpen({ ownerUserId: access.session.ownerUserId, managerId: access.session.managerId, assetId: id });
    if (!asset) throw new ExternalLeadAccessError('This asset is not assigned to this login.', 403);
    const canRecord = await fieldManagerCan(access.session.managerId, 'record_work');
    return { ownerId: access.session.ownerUserId, assetId: asset.id, canRecord, canSchedule: await fieldManagerCan(access.session.managerId, 'schedule_maintenance'), canEdit: canRecord, canRemove: false };
  }
  const session = await getServerSession({ allowDealerApp: true });
  if (!session) throw new ExternalLeadAccessError('Sign in to the Dealer App.', 401);
  if (isDealerAppSession(session) && !dealerRoleCan(session.dealerApp.role, 'maintenance')) throw new ExternalLeadAccessError('Maintenance access is not enabled for this login.', 403);
  const profile = await getAccountProfile(session.user);
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') throw new ExternalLeadAccessError('Dealer access is not available.', 403);
  const asset = await getDealerTrackedAsset(session.user.id, id);
  if (!asset || !(asset.permissions.canAddMaintenance || asset.permissions.canCreateMaintenanceSchedules || asset.permissions.canViewMaintenanceReports)) throw new ExternalLeadAccessError('The owner has not shared maintenance access.', 403);
  return { ownerId: asset.ownerUserId, assetId: asset.assetId, canRecord: !!asset.permissions.canAddMaintenance, canSchedule: !!asset.permissions.canCreateMaintenanceSchedules, canEdit: !!asset.permissions.canAddMaintenance, canRemove: false };
}
