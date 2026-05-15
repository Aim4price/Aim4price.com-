import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../lib/account-profile';
import { getServerSession } from '../../lib/auth-session';
import SharedAccessClient from './shared-access-client';

export const runtime = 'nodejs';

export default async function SharedAccessPage() {
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
    redirect('/shared-registers');
  }

  return <SharedAccessClient />;
}
