import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/auth-session';
import UsersClient from './users-client';

export const runtime = 'nodejs';

export default async function UsersPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth#signup');
  }

  return <UsersClient />;
}
