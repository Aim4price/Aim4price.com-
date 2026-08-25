import Link from 'next/link';
import { redirect } from 'next/navigation';
import AssetRegisterClient from '../../asset-register/asset-register-client';
import { getAssetRegisterAccountAccess } from '../../../lib/asset-register-account-access';
import { getServerSession } from '../../../lib/auth-session';
import styles from './inventory.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerInventoryPage() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');

  const access = await getAssetRegisterAccountAccess(session);
  if (!access || access.accountType !== 'dealer') redirect('/dealer');

  return (
    <div className={styles.page}>
      <header className={styles.contextBar}>
        <div>
          <span>Dealer-owned stock</span>
          <strong>My Inventory</strong>
          <p>Trade-ins and dealer-owned assets stay separate from managed client registers.</p>
        </div>
        <Link href="/dealer/inventory/transfers" prefetch={false}>Claim or send asset</Link>
      </header>
      <AssetRegisterClient showAppHeader={false} registerManagementHref="/dealer/inventory/registers" />
    </div>
  );
}
