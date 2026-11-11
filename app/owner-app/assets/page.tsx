import TeamWorkspaceClient from '../../team/team-workspace-client';
import { managerTeamActor } from '../../../lib/manager-team-workspace';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';
import OwnerAssetsClient from './owner-assets-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAssetsPage({ searchParams }: { searchParams?: { q?: string | string[] } }) {
  const access = await requireOwnerAppPageAccess();
  const actor = await managerTeamActor(access);
  if (actor) return <div className={styles.page}><OwnerAppNav/><TeamWorkspaceClient embedded managed email={access.displayName} initialWorkspace={actor.managedGrantId}/></div>;
  const initialQuery = Array.isArray(searchParams?.q) ? searchParams?.q[0] ?? '' : searchParams?.q ?? '';
  return (
    <main className={styles.page}>
      <OwnerAppNav />
      <div className={styles.content}><section className={styles.hero}><h1>Assets</h1><p>Find an asset or open a group.</p></section></div>
      <OwnerAssetsClient initialQuery={initialQuery} canAddAssets={ownerAppCan(access, 'manage_assets')} />
    </main>
  );
}
