import { redirect } from 'next/navigation';
import { getAccountProfile } from './account-profile';
import { getServerSession, isOwnerAppSession } from './auth-session';
import {
  getOwnerAppAssetAccessSettings,
  getOwnerAppUserById,
  normalizeOwnerAppAccessRole,
  resolveOwnerAppAccessibleAssetIds,
  type OwnerAppAccessRole,
} from './owner-app';

export type OwnerAppPermission = 'view' | 'operate' | 'manage_assets' | 'manage_finance' | 'manage_marketplace' | 'manage_access';

const ROLE_PERMISSIONS: Record<OwnerAppAccessRole, readonly OwnerAppPermission[]> = {
  admin: ['view', 'operate', 'manage_assets', 'manage_finance', 'manage_marketplace', 'manage_access'],
  operations: ['view', 'operate'],
  view_only: ['view'],
};

export type OwnerAppAccess = {
  ownerUserId: string;
  displayName: string;
  ownerAppUserId: string | null;
  accessRole: OwnerAppAccessRole;
  permissions: readonly OwnerAppPermission[];
  viewerKey: string;
  sessionKind: 'account' | 'owner-app-user';
  assetScope: 'all' | 'selected';
  accessibleAssetIds: readonly string[];
};

export async function getOwnerAppAccess(): Promise<OwnerAppAccess | null> {
  const session = await getServerSession({ allowOwnerApp: true });
  if (!session?.user?.id) return null;

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'owner' || profile.accountStatus !== 'active') return null;

  const ownerAppSession = isOwnerAppSession(session);
  const managedUser = ownerAppSession ? await getOwnerAppUserById(session.ownerApp.ownerAppUserId) : null;
  if (ownerAppSession && (!managedUser || !managedUser.is_active || managedUser.parent_owner_user_id !== session.user.id)) return null;
  const accessRole: OwnerAppAccessRole = ownerAppSession ? normalizeOwnerAppAccessRole(managedUser?.access_role) : 'admin';
  const assetAccess = ownerAppSession && accessRole !== 'admin'
    ? await getOwnerAppAssetAccessSettings(session.user.id, session.ownerApp.ownerAppUserId)
    : { assetScope: 'all' as const, assetIds: [], groupIds: [] };
  const accessibleAssetIds = ownerAppSession && assetAccess.assetScope === 'selected'
    ? await resolveOwnerAppAccessibleAssetIds(session.user.id, session.ownerApp.ownerAppUserId)
    : [];

  return {
    ownerUserId: session.user.id,
    displayName: ownerAppSession
      ? session.ownerApp.displayName
      : profile.businessName || profile.displayName || profile.name || 'Owner',
    ownerAppUserId: ownerAppSession ? session.ownerApp.ownerAppUserId : null,
    accessRole,
    permissions: ROLE_PERMISSIONS[accessRole],
    viewerKey: ownerAppSession ? `user:${session.ownerApp.ownerAppUserId}` : `account:${session.user.id}`,
    sessionKind: ownerAppSession ? 'owner-app-user' : 'account',
    assetScope: assetAccess.assetScope,
    accessibleAssetIds,
  };
}

export function ownerAppCan(access: OwnerAppAccess, permission: OwnerAppPermission): boolean {
  return access.permissions.includes(permission);
}

export function ownerAppCanAccessAsset(access: OwnerAppAccess, assetId: unknown): boolean {
  if (access.assetScope === 'all') return true;
  const normalizedAssetId = String(assetId ?? '').trim();
  return Boolean(normalizedAssetId && access.accessibleAssetIds.includes(normalizedAssetId));
}

export async function requireOwnerAppPageAccess(): Promise<OwnerAppAccess> {
  const access = await getOwnerAppAccess();
  if (!access) redirect('/owner-app/login');
  return access;
}
