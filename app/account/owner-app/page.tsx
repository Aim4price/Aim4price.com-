import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession, isOwnerAppSession } from '../../../lib/auth-session';
import OwnerAppAccessClient from './owner-app-access-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppAccessPage() {
  const session = await getServerSession();
  if (!session?.user?.id || isOwnerAppSession(session)) redirect('/owner-app/login');
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (profile.accountType !== 'owner' || profile.accountStatus !== 'active') redirect('/account');
  return <OwnerAppAccessClient />;
}
