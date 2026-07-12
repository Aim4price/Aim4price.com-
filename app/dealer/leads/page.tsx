import { redirect } from 'next/navigation';
import { getServerSession } from '../../../lib/auth-session';
import { getAccountProfile } from '../../../lib/account-profile';
import { listAssetLeadsForUser } from '../../../lib/partner-access';
import LeadsClient from '../../leads/leads-client';
import DealerNav from '../dealer-nav';
import styles from '../dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerLeadsPage() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');

  const [profile, initialLeads] = await Promise.all([
    getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    }),
    listAssetLeadsForUser(session.user.id),
  ]);
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') redirect('/dealer/login');

  return (
    <div className={styles.module}>
      <DealerNav />
      <LeadsClient
        dealerAppMode
        initialLeads={initialLeads}
        initialSessionUserId={session.user.id}
        initialAccountTitle={profile.businessName || profile.displayName || profile.name || session.user.name}
      />
    </div>
  );
}
