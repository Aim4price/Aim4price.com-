import { redirect } from 'next/navigation';
import MarketplaceClient from '../../marketplace/marketplace-client';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';
import mobile from '../owner-mobile.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppMarketplacePage() {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCan(access, 'manage_marketplace')) redirect('/owner-app');
  return (
    <div className={styles.module}>
      <OwnerAppNav />
      <section className={`${mobile.dashboard} ${mobile.intro}`}><h1>Marketplace</h1><p>Browse and manage adverts.</p></section>
      <MarketplaceClient
        isSignedIn
        accountType="owner"
        ownerAppMode
        initialFilters={{ brand: '', model: '', drive: '', type: '' }}
      />
    </div>
  );
}
