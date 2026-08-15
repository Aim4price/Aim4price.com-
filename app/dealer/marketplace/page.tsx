import { redirect } from 'next/navigation';
import { getServerSession } from '../../../lib/auth-session';
import { getDealerAppSession } from '../../../lib/dealer-app-session';
import { dealerRoleCan } from '../../../lib/dealer-app-access';
import { getAccountProfile } from '../../../lib/account-profile';
import { isMiddlemanAccountSubtype } from '../../../lib/middleman-account';
import MarketplaceClient from '../../marketplace/marketplace-client';
import styles from '../dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerMarketplacePage() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');
  const dealerAppSession = await getDealerAppSession();
  if (dealerAppSession && !dealerRoleCan(dealerAppSession.role, 'marketplace')) redirect('/dealer');

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') redirect('/dealer/login');
  if (isMiddlemanAccountSubtype(profile.accountSubtype)) redirect('/dealer/showroom');

  return (
    <div className={styles.module}>
      <MarketplaceClient
        isSignedIn
        accountType="dealer"
        dealerAppMode
        initialFilters={{ brand: '', model: '', drive: '', type: '' }}
      />
    </div>
  );
}
