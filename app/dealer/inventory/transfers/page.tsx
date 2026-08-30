import { redirect } from 'next/navigation';
import AssetTransfersClient from '../../../account/asset-transfers/asset-transfers-client';
import { getAssetRegisterAccountAccess } from '../../../../lib/asset-register-account-access';
import { getServerSession } from '../../../../lib/auth-session';
import styles from '../inventory.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerInventoryTransfersPage() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');

  const access = await getAssetRegisterAccountAccess(session);
  if (!access || access.accountType !== 'dealer') redirect('/dealer');

  return (
    <div className={`${styles.page} ${styles.transferPage}`}>
      <AssetTransfersClient context="dealer" isDealerAccount />
    </div>
  );
}
