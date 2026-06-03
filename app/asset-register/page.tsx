import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../lib/account-profile';
import { getServerSession } from '../../lib/auth-session';
import AssetRegistersClient from './asset-registers-client';

export const runtime = 'nodejs';

export default async function AssetRegistersPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth#signup');
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'owner') {
    redirect('/leads');
  }

  return <AssetRegistersClient />;
}
