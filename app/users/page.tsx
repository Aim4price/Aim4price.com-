import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../lib/account-profile';
import { getServerSession } from '../../lib/auth-session';
import UsersClient from './users-client';

export const runtime = 'nodejs';

export default async function UsersPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth#signup');
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType === 'owner') {
    redirect('/asset-register');
  }

  return <UsersClient />;
}
