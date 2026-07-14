import MarketplaceClient from '../../marketplace/marketplace-client';
import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppMarketplacePage() {
  await requireOwnerAppPageAccess();
  return (
    <div className={styles.module}>
      <OwnerAppNav />
      <MarketplaceClient
        isSignedIn
        accountType="owner"
        ownerAppMode
        initialFilters={{ brand: '', model: '', drive: '', type: '' }}
      />
    </div>
  );
}
