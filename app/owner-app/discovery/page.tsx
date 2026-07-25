import AssetDiscoveryClient from '../../asset-discovery/asset-discovery-client';
import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppDiscoveryPage() {
  await requireOwnerAppPageAccess();

  return (
    <div className={styles.module}>
      <OwnerAppNav />
      <AssetDiscoveryClient ownerAppMode />
    </div>
  );
}
