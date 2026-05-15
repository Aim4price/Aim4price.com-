import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/auth-session';
import SharedRegistersClient from './shared-registers-client';

export const runtime = 'nodejs';

export default async function SharedRegistersPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth#signup');
  }

  return <SharedRegistersClient />;
}
