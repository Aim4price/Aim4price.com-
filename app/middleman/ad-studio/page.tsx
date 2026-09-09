import { redirect } from 'next/navigation';
import AdStudioClient from '../../../components/AdStudioClient';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession } from '../../../lib/auth-session';
import { dealerRoleCan } from '../../../lib/dealer-app-access';
import { getDealerAppSession } from '../../../lib/dealer-app-session';
import { isMiddlemanAccountSubtype } from '../../../lib/middleman-account';
import styles from '../../dealer/dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerAdStudioPage() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/middleman/login');

  const [profile, dealerAppSession] = await Promise.all([
    getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    }),
    getDealerAppSession(),
  ]);

  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') redirect('/middleman/login');
  if (dealerAppSession && !dealerRoleCan(dealerAppSession.role, 'ad_studio')) redirect('/middleman');

  return (
    <div className={`${styles.module} ${styles.compactWorkspace}`}>
      <AdStudioClient
        dealerAppMode
        middlemanMode={isMiddlemanAccountSubtype(profile.accountSubtype)}
      />
    </div>
  );
}

