import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { getAccountProfile } from '../../lib/account-profile';
import { requireActivePageAccess } from '../../lib/account-access';
import AssetDiscoveryClient from './asset-discovery-client';
import { workspaceStyles } from '../../components/WorkspacePrimitives';
import leadStyles from '../leads/page.module.css';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AssetDiscoveryPage() {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'dealer' && profile.accountType !== 'owner') {
    redirect('/leads');
  }

  return (
    <main className={`${workspaceStyles.page} ${leadStyles.leadsPage} ${leadStyles.dealerOwnerParity} ${styles.page}`}>
      <AppHeader active="asset-discovery" />
      <AssetDiscoveryClient />
    </main>
  );
}
