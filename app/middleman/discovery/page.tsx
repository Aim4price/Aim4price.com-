import { redirect } from 'next/navigation';
import { getServerSession } from '../../../lib/auth-session';
import { getDealerAppSession } from '../../../lib/dealer-app-session';
import { dealerRoleCan } from '../../../lib/dealer-app-access';
import { getAccountProfile } from '../../../lib/account-profile';
import { isMiddlemanAccountSubtype } from '../../../lib/middleman-account';
import AssetDiscoveryClient from '../../asset-discovery/asset-discovery-client';
import styles from '../../dealer/dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerDiscoveryPage() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/middleman/login');
  const dealerAppSession = await getDealerAppSession();
  if (dealerAppSession && !dealerRoleCan(dealerAppSession.role, 'discovery')) redirect('/middleman');

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') redirect('/middleman/login');

  return (
    <div className={`${styles.module} ${styles.compactWorkspace}`}>
      <main>
        <AssetDiscoveryClient dealerAppMode />
      </main>
    </div>
  );
}


