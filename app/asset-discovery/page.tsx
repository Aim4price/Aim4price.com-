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

type AssetDiscoveryPageProps = {
  searchParams?: {
    openAsset?: string | string[];
  };
};

function firstSearchValue(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] ?? '' : value ?? '').trim();
}

export default async function AssetDiscoveryPage({
  searchParams,
}: AssetDiscoveryPageProps) {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (!['dealer', 'owner', 'licensing'].includes(profile.accountType)) {
    redirect('/leads');
  }

  return (
    <main className={`${workspaceStyles.page} ${leadStyles.leadsPage} ${leadStyles.dealerOwnerParity} ${styles.page}`}>
      <AppHeader active="asset-discovery" />
      <AssetDiscoveryClient
        initialOpenAssetId={firstSearchValue(searchParams?.openAsset)}
      />
    </main>
  );
}
