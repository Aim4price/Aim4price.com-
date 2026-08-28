import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { MiddlemanShowroomManager } from '../../components/MiddlemanShowroomClient';
import { getAccountProfile } from '../../lib/account-profile';
import { getServerSession, isDealerAppSession } from '../../lib/auth-session';
import { listPublishedMarketplaceAssetListings } from '../../lib/marketplace-db';
import { getOrCreateMiddlemanShowroom } from '../../lib/middleman-showroom-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function MyShowroomPage() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/auth#login');
  if (isDealerAppSession(session)) redirect('/dealer/showroom');
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  let showroom;
  try {
    showroom = await getOrCreateMiddlemanShowroom(profile);
  } catch {
    redirect('/account');
  }
  const listings = await listPublishedMarketplaceAssetListings({
    viewerUserId: session.user.id,
    sellerUserId: session.user.id,
    exposeContact: true,
  });
  return (
    <main>
      <AppHeader active={profile.accountType === 'owner' ? 'account' : 'showroom'} />
      <MiddlemanShowroomManager
        initialShowroom={showroom}
        initialListings={listings}
        advertDesign={profile.accountType === 'dealer' ? 'saved-brand' : 'aim4price-marketplace'}
        advertDesignHref={profile.accountType === 'dealer' ? '/ad-studio' : null}
      />
    </main>
  );
}
