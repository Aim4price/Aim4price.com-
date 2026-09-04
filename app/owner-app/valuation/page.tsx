import { redirect } from 'next/navigation';
import ValuationClient from '../../valuation/quick-valuation-client';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppValuationPage({ searchParams }: { searchParams?: { from?: string | string[] } }) {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCan(access, 'manage_assets')) redirect('/owner-app');
  const from = Array.isArray(searchParams?.from) ? searchParams?.from[0] : searchParams?.from;
  const returnToAddAsset = from === 'assets';
  return (
    <div className={styles.module}>
      <OwnerAppNav
        backHref={returnToAddAsset ? '/owner-app/assets/add' : '/owner-app'}
        backLabel={returnToAddAsset ? 'Add Asset' : 'Home'}
      />
      <ValuationClient ownerAppMode />
    </div>
  );
}
