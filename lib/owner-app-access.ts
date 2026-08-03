import { redirect } from 'next/navigation';
import { getAccountProfile } from './account-profile';
import { getServerSession, isOwnerAppSession } from './auth-session';
import { getOwnerAppUserById, normalizeOwnerAppAccessRole, type OwnerAppAccessRole } from './owner-app';

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
  };
}

export function ownerAppCan(access: OwnerAppAccess, permission: OwnerAppPermission): boolean {
  return access.permissions.includes(permission);
}

export async function requireOwnerAppPageAccess(): Promise<OwnerAppAccess> {
  const access = await getOwnerAppAccess();
  if (!access) redirect('/owner-app/login');
  return access;
}
