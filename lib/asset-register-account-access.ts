import { getAccountProfile, type AccountProfile } from './account-profile';
import { getServerSession, isDealerAppSession } from './auth-session';
import { dealerRoleCan } from './dealer-app-access';

export type AssetRegisterAccountType = 'owner' | 'dealer';

export type AssetRegisterAccountAccess = {
  accountType: AssetRegisterAccountType;
  profile: AccountProfile;
};

type EffectiveSession = Awaited<ReturnType<typeof getServerSession>>;

export function isAssetRegisterAccountType(value: unknown): value is AssetRegisterAccountType {
  return value === 'owner' || value === 'dealer';
}

export async function getAssetRegisterAccountAccess(
  session: EffectiveSession,
): Promise<AssetRegisterAccountAccess | null> {
  if (!session?.user?.id) return null;

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (!isAssetRegisterAccountType(profile.accountType) || profile.accountStatus !== 'active') {
    return null;
  }

  if (isDealerAppSession(session) && !dealerRoleCan(session.dealerApp.role, 'inventory')) {
    return null;
  }

  return { accountType: profile.accountType, profile };
}
