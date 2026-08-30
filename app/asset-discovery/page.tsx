import AppHeader from '../../components/AppHeader';
import { getAccountProfile } from '../../lib/account-profile';
import { getServerSession } from '../../lib/auth-session';
import AssetDiscoveryClient from './asset-discovery-client';
import { workspaceStyles } from '../../components/WorkspacePrimitives';
import leadStyles from '../leads/page.module.css';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AssetDiscoveryPageProps = {
  searchParams?: {
    openAsset?: string | string[];
    view?: string | string[];
  };
};

function firstSearchValue(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] ?? '' : value ?? '').trim();
}

export default async function AssetDiscoveryPage({
  searchParams,
}: AssetDiscoveryPageProps) {
  const session = await getServerSession({
    allowDealerApp: true,
    allowOwnerApp: true,
  });
  let activeAccountType = '';

  if (session?.user?.id) {
    try {
      const profile = await getAccountProfile({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      });
      if (profile.accountStatus === 'active') {
        activeAccountType = profile.accountType;
      }
    } catch (error) {
      console.error('asset-discovery page profile lookup failed', error);
    }
  }

  return (
    <main className={`${workspaceStyles.page} ${leadStyles.leadsPage} ${leadStyles.dealerOwnerParity} ${styles.page}`}>
      <AppHeader active="asset-discovery" />
      <AssetDiscoveryClient
        initialOpenAssetId={firstSearchValue(searchParams?.openAsset)}
        initialView={
          firstSearchValue(searchParams?.view) === 'recently-advertised'
            ? 'recently-advertised'
            : 'discovery'
        }
        allowRecentAdverts={activeAccountType !== 'licensing'}
      />
    </main>
  );
}
