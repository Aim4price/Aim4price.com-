import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { getAnyServerSession } from '../../../lib/auth-session';
import { getOwnerAppSession } from '../../../lib/owner-app-session';
import OwnerAppLoginClient from './owner-app-login-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppLoginPage() {
  const accountSession = await getAnyServerSession();
  if (accountSession?.user?.id) {
    const profile = await getAccountProfile({ id: accountSession.user.id, name: accountSession.user.name, email: accountSession.user.email });
    if (profile.accountType === 'owner' && profile.accountStatus === 'active') redirect('/owner-app');
    return <OwnerAppLoginClient hasAccountSession />;
  }
  if (await getOwnerAppSession()) redirect('/owner-app');
  return <OwnerAppLoginClient />;
}
