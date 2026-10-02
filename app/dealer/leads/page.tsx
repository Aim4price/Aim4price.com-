import { redirect } from 'next/navigation';
import { getServerSession } from '../../../lib/auth-session';
import { getDealerAppSession } from '../../../lib/dealer-app-session';
import { dealerRoleCan } from '../../../lib/dealer-app-access';
import { getAccountProfile } from '../../../lib/account-profile';
import { isMiddlemanAccountSubtype } from '../../../lib/middleman-account';
import { listInitialDealerReceivedLeads } from '../../../lib/dealer-leads-initial-load';
import DealerLeadsClient from './dealer-leads-client';
import styles from '../dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INITIAL_LEAD_BATCH_SIZE = 10;

export default async function DealerLeadsPage() {
  const [session, dealerAppSession] = await Promise.all([
    getServerSession({ allowDealerApp: true }),
    getDealerAppSession(),
  ]);
  if (!session?.user?.id && !dealerAppSession?.dealerUserId) redirect('/dealer/login');
  if (dealerAppSession && !dealerRoleCan(dealerAppSession.role, 'leads')) redirect('/dealer');

  const dealerUserId = dealerAppSession?.dealerUserId || session?.user?.id || '';
  const profile = await getAccountProfile({
    id: dealerUserId,
    name: dealerAppSession?.displayName || session?.user?.name || null,
    email: dealerAppSession ? null : session?.user?.email || null,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') redirect('/dealer/login');
  if (isMiddlemanAccountSubtype(profile.accountSubtype)) redirect('/dealer/showroom');
  const initialLeads = await listInitialDealerReceivedLeads(dealerUserId, INITIAL_LEAD_BATCH_SIZE);

  return (
    <div className={`${styles.module} ${styles.leadsModule}`}>
      <DealerLeadsClient dealerUserId={dealerUserId} initialLeads={initialLeads} />
    </div>
  );
}

