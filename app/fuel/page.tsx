import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/auth-session';
import FuelClient from './fuel-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function FuelPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth#signup');
  }

  return <FuelClient />;
}
