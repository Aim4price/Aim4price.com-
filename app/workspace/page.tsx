import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { getAccountProfile } from '../../lib/account-profile';
import { getServerSession } from '../../lib/auth-session';
import { sharingPlan } from '../../lib/sharing-foundation';
import { receivedAssetsHref, workspaceCards, workspaceRole } from '../../lib/workspace-navigation';
import { getBusinessCredits } from '../../components/BusinessCredits';
import { getManagedTeamActor } from '../../lib/team-login';
import WorkspaceGrid from './workspace-grid';
import styles from './workspace.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title:'Workspace | Aim4price', robots:{index:false,follow:false} };

export default async function WorkspacePage() {
  const session = await getServerSession({requireActive:false});
  if (!session?.user && await getManagedTeamActor()) redirect('/team/access');
  if (!session?.user) redirect('/auth?returnTo=%2Fworkspace#login');
  const profile = await getAccountProfile(session.user);
  if (profile.accountStatus !== 'active') redirect('/pending-payment');
  const plan = await sharingPlan(session.user.id, profile.accountType);
  const role = workspaceRole(profile.accountType, profile.accountSubtype, plan);
  if (!role) redirect('/account');
  const cards = workspaceCards(role, plan === 'free', receivedAssetsHref(profile.accountType, plan));
  const freeBusiness = role === 'business' && plan === 'free';
  const credits = freeBusiness ? await getBusinessCredits(session.user.id) : null;
  const subscription = freeBusiness ? {
    paidSince: null,
    owner: credits?.workspace.role === 'owner',
    pending: Boolean(credits?.workspace.upgrade_requested_at),
    remaining: credits ? Math.max(0, credits.balance.limit - credits.balance.used - credits.balance.held) : null,
    limit: credits?.balance.limit ?? null,
  } : null;
  return <>
    <AppHeader active="workspace"/>
    <main className={styles.shell}>
      <WorkspaceGrid key={session.user.id + role} cards={cards} role={role} userId={session.user.id} subscription={subscription}/>
    </main>
  </>;
}
