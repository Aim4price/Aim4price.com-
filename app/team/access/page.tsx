import { redirect } from 'next/navigation';
import { getAnyServerSession } from '../../../lib/auth-session';
import { getManagedTeamActor } from '../../../lib/team-login';
import { canManageTeamAccess } from '../../../lib/team-access';
import MyAccessClient from './my-access-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'My access | Aim4price', robots: { index: false, follow: false } };

export default async function MyAccessPage() {
  const session = await getAnyServerSession();
  if (session?.user && await canManageTeamAccess()) redirect('/account');
  const managed = session?.user ? null : await getManagedTeamActor();
  const email = session?.user?.email || managed?.username || managed?.email;
  if (!email) redirect('/team');
  return <><MyAccessClient email={email} name={session?.user?.name || managed?.name || ''} managed={Boolean(managed)} /></>;
}
