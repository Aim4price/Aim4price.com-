import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { getAnyServerSession } from '../../lib/auth-session';
import { getManagedTeamActor } from '../../lib/team-login';
import { canManageTeamAccess } from '../../lib/team-access';
import TeamLogin from '../../components/team/TeamLogin';
import TeamWorkspaceClient from './team-workspace-client';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'My desktop access', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams?: { business?: string; workspace?: string } }) {
  const session = await getAnyServerSession();
  const managementAccount = Boolean(session?.user && await canManageTeamAccess());
  const managed = session?.user ? null : await getManagedTeamActor();
  if (managed) redirect('/asset-register');
  const email = session?.user?.email;
  return <>{!managed && <AppHeader active="none"/>}{email ? <TeamWorkspaceClient email={email} managed={Boolean(managed)} managementAccount={managementAccount} initialWorkspace={typeof searchParams?.workspace === "string" ? searchParams.workspace : ""}/> : <TeamLogin business={typeof searchParams?.business === 'string' ? searchParams.business : ''}/>}</>;
}
