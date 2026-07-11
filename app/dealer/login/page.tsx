import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { getAnyServerSession, getServerSession } from '../../../lib/auth-session';
import DealerLoginClient from './dealer-login-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerLoginPage() {
  const accountSession = await getAnyServerSession();

  if (accountSession?.user?.id) {
    const profile = await getAccountProfile({
      id: accountSession.user.id,
      name: accountSession.user.name,
      email: accountSession.user.email,
    });

    if (profile.accountType === 'dealer' && profile.accountStatus === 'active') {
      redirect('/dealer');
    }

    return <DealerLoginClient hasAccountSession />;
  }

  const dealerSession = await getServerSession({ allowDealerApp: true });
  if (dealerSession?.user?.id) redirect('/dealer');

  return <DealerLoginClient />;
}
