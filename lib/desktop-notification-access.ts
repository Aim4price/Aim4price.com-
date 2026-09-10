import { getServerSession, isDealerAppSession, isOwnerAppSession } from './auth-session';
import { currentAppRealm } from './app-realm-server';
import { getAccountProfile } from './account-profile';
import { isMiddlemanAccountSubtype } from './middleman-account';
import type { PushApp, PushCategory } from './push-policy';

export async function desktopNotificationAccount() {
  // Website credentials only. App members cannot change account-wide policy.
  if (await currentAppRealm()) return null;
  const session = await getServerSession();
  if (!session?.user?.id || isDealerAppSession(session) || isOwnerAppSession(session)) return null;
  const profile = await getAccountProfile(session.user);
  if (profile.accountStatus !== 'active' || !['owner','dealer'].includes(profile.accountType)) return null;
  const app: PushApp = profile.accountType === 'owner' ? 'owner' : isMiddlemanAccountSubtype(profile.accountSubtype) ? 'middleman' : 'dealer';
  const categories: PushCategory[] = app === 'owner' ? ['maintenance','licensing','enquiries','approvals']
    : app === 'dealer' ? ['maintenance','enquiries','assignments'] : ['enquiries'];
  return { accountId:session.user.id, app, categories };
}
