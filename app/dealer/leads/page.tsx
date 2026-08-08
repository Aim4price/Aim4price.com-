import { redirect } from 'next/navigation';
import { getServerSession } from '../../../lib/auth-session';
import { getDealerAppSession } from '../../../lib/dealer-app-session';
import { dealerRoleCan } from '../../../lib/dealer-app-access';
import { getAccountProfile } from '../../../lib/account-profile';
import { listAssetLeadsForUser } from '../../../lib/partner-access';
import LeadsClient from '../../leads/leads-client';
import styles from '../dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INITIAL_LEAD_BATCH_SIZE = 10;

export default async function DealerLeadsPage() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');
  const dealerAppSession = await getDealerAppSession();
  if (dealerAppSession && !dealerRoleCan(dealerAppSession.role, 'leads')) redirect('/dealer');

  const [profile, initialLeads] = await Promise.all([
    getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    }),
    listAssetLeadsForUser(session.user.id, { limit: INITIAL_LEAD_BATCH_SIZE + 1 }),
  ]);
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') redirect('/dealer/login');

  return (
    <div className={`${styles.module} ${styles.leadsModule}`}>
      <LeadsClient
        dealerAppMode
        initialLeads={initialLeads.slice(0, INITIAL_LEAD_BATCH_SIZE)}
        initialLeadsHaveMore={initialLeads.length > INITIAL_LEAD_BATCH_SIZE}
        initialSessionUserId={session.user.id}
      />
    </div>
  );
}
