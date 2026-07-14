import { redirect } from 'next/navigation';
import { getAccountAccess } from '../../../lib/account-access';
import { getAccountProfile } from '../../../lib/account-profile';
import { getAnyServerSession } from '../../../lib/auth-session';
import OwnerAppLoginClient from './owner-app-login-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppLoginPage() {
  const session = await getAnyServerSession();

  if (session?.user?.id) {
    const access = await getAccountAccess({ id: session.user.id, email: session.user.email });

    if (access.isAdmin) redirect('/admin');
    if (!access.isActive) redirect('/pending-payment');

    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });

    if (profile.accountType !== 'owner') redirect('/account');

    return <OwnerAppLoginClient hasActiveOwnerSession />;
  }

  return <OwnerAppLoginClient />;
}
