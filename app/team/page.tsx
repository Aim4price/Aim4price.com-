import AppHeader from '../../components/AppHeader';
import { getAnyServerSession } from '../../lib/auth-session';
import { getManagedTeamActor } from '../../lib/team-login';
import TeamLogin from '../../components/team/TeamLogin';
import TeamWorkspaceClient from './team-workspace-client';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'My desktop access', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams?: { business?: string } }) {
  const session = await getAnyServerSession();
  const managed = session?.user ? null : await getManagedTeamActor();
  const email = session?.user?.email || managed?.email;
  return <><AppHeader active="none"/>{email ? <TeamWorkspaceClient email={email} managed={Boolean(managed)}/> : <TeamLogin business={typeof searchParams?.business === 'string' ? searchParams.business : ''}/>}</>;
}
