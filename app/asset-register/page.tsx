import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../lib/account-profile';
import { getServerSession } from '../../lib/auth-session';
import AssetRegisterClient from './asset-register-client';

export const runtime = 'nodejs';

export default async function AssetRegisterPage() {
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

  return <AssetRegisterClient />;
}
