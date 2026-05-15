import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/auth-session';
import LeadsClient from './leads-client';

export const runtime = 'nodejs';

export default async function LeadsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth#signup');
  }

  return <LeadsClient />;
}
