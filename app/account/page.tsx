import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/auth-session';
import AccountClient from './account-client';

export const runtime = 'nodejs';

export default async function AccountPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth#signup');
  }

  return <AccountClient />;
}
