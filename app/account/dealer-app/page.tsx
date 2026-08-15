import { redirect } from 'next/navigation';
import { getServerSession, isDealerAppSession } from '../../../lib/auth-session';
import { getAccountProfile } from '../../../lib/account-profile';
import { isMiddlemanAccountSubtype } from '../../../lib/middleman-account';
import DealerAccessClient from './dealer-access-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerAppAccessPage() {
  const session = await getServerSession();
  if (!session?.user?.id || isDealerAppSession(session)) redirect('/dealer');

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    redirect('/account');
  }

  return <DealerAccessClient middlemanMode={isMiddlemanAccountSubtype(profile.accountSubtype)} />;
}
