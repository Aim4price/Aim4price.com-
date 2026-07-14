import { redirect } from 'next/navigation';
import { getAccountAccess } from './account-access';
import { getAccountProfile } from './account-profile';
import { getAnyServerSession } from './auth-session';

export async function requireOwnerAppPageAccess() {
  const session = await getAnyServerSession();

  if (!session?.user?.id) {
    redirect('/app/login');
  }

  const access = await getAccountAccess({
    id: session.user.id,
    email: session.user.email,
  });

  if (access.isAdmin) {
    redirect('/admin');
  }

  if (!access.isActive) {
    redirect('/pending-payment');
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'owner') {
    redirect('/account');
  }

  return { session, access, profile };
}
