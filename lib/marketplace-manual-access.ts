import { getServerSession, isDealerAppSession, isOwnerAppSession } from './auth-session';
import { getAccountProfile } from './account-profile';
import { dealerRoleCan } from './dealer-app-access';
import { getOwnerAppAccess, ownerAppCan } from './owner-app-access';

export async function getMarketplaceManualAccess() {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });
  if (!session?.user?.id) return null;
  if (isDealerAppSession(session) && !dealerRoleCan(session.dealerApp.role, 'marketplace')) return null;
  if (isOwnerAppSession(session)) {
    const access = await getOwnerAppAccess();
    if (!access || !ownerAppCan(access, 'manage_marketplace')) return null;
  }
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (!['owner', 'dealer'].includes(profile.accountType) || profile.accountStatus !== 'active') return null;
  return { userId: session.user.id, profile };
}
