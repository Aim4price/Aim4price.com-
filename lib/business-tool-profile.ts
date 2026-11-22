import { getAccountProfile } from './account-profile';
import { canBusinessRead } from './business-accounts';
import { ensureCreditSchema } from './business-credits';
import { isDealerAppSession, isOwnerAppSession, type getServerSession } from './auth-session';

type Session = NonNullable<Awaited<ReturnType<typeof getServerSession>>>;

/** Only personal workspace tools use the dealer layout for a Free Business owner. */
export async function businessToolProfile(session: Session) {
  const profile = await getAccountProfile(session.user);
  if (profile.accountType === 'business' && !isDealerAppSession(session) && !isOwnerAppSession(session) && await canBusinessRead(session.user)) {
    await ensureCreditSchema();
    return {...profile, accountType: 'dealer' as const};
  }
  return profile;
}
