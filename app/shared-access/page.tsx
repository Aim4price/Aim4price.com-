import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/auth-session';
import SharedAccessClient from './shared-access-client';

export const runtime = 'nodejs';

export default async function SharedAccessPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth#signup');
  }

  return <SharedAccessClient />;
}
