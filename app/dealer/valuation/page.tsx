import { redirect } from 'next/navigation';
import { getServerSession } from '../../../lib/auth-session';
import { getAccountProfile } from '../../../lib/account-profile';
import ValuationClient from '../../valuation/valuation-client';
import DealerNav from '../dealer-nav';
import styles from '../dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerValuationPage() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') redirect('/dealer/login');

  return (
    <div className={styles.module}>
      <DealerNav />
      <ValuationClient dealerAppMode />
    </div>
  );
}
