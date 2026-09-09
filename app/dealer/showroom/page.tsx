import { redirect } from 'next/navigation';
import { MiddlemanShowroomManager } from '../../../components/MiddlemanShowroomClient';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession } from '../../../lib/auth-session';
import { dealerRoleCan } from '../../../lib/dealer-app-access';
import { getDealerAppSession } from '../../../lib/dealer-app-session';
import { listPublishedMarketplaceAssetListings } from '../../../lib/marketplace-db';
import { getOrCreateMiddlemanShowroom } from '../../../lib/middleman-showroom-db';
import styles from '../dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerShowroomPage() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');
  const [profile, dealerAppSession] = await Promise.all([
    getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email }),
    getDealerAppSession(),
  ]);
  if (dealerAppSession && !dealerRoleCan(dealerAppSession.role, 'showroom')) redirect('/dealer');
  let showroom;
  try {
    showroom = await getOrCreateMiddlemanShowroom(profile);
  } catch {
    redirect('/dealer');
  }
  const listings = await listPublishedMarketplaceAssetListings({
    viewerUserId: session.user.id,
    sellerUserId: session.user.id,
    exposeContact: true,
  });
  return (
    <div className={`${styles.module} ${styles.compactWorkspace}`}>
      <MiddlemanShowroomManager
        initialShowroom={showroom}
        initialListings={listings}
        dealerAppMode
        advertDesign="saved-brand"
        advertDesignHref={!dealerAppSession || dealerAppSession.role === 'owner' ? '/dealer/ad-studio' : null}
      />
    </div>
  );
}
