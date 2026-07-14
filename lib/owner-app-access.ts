import { redirect } from 'next/navigation';
import { getAccountProfile } from './account-profile';
import { getServerSession, isOwnerAppSession } from './auth-session';

export type OwnerAppAccess = {
  ownerUserId: string;
  displayName: string;
  ownerAppUserId: string | null;
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

  return {
    ownerUserId: session.user.id,
    displayName: isOwnerAppSession(session)
      ? session.ownerApp.displayName
      : profile.businessName || profile.displayName || profile.name || 'Owner',
    ownerAppUserId: isOwnerAppSession(session) ? session.ownerApp.ownerAppUserId : null,
    sessionKind: isOwnerAppSession(session) ? 'owner-app-user' : 'account',
  };
}

export async function requireOwnerAppPageAccess(): Promise<OwnerAppAccess> {
  const access = await getOwnerAppAccess();
  if (!access) redirect('/owner-app/login');
  return access;
}
