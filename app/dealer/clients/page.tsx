import { redirect } from 'next/navigation';
import DealerClientsClient from '../../../components/DealerClientsClient';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession } from '../../../lib/auth-session';
import { listDealerTrackedAssets } from '../../../lib/dealer-maintenance-tracker';
import { listAssetLeadsForUser } from '../../../lib/partner-access';
import styles from '../dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerAppClientsPage() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');

  const [profile, leads, assets] = await Promise.all([
    getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email }),
    listAssetLeadsForUser(session.user.id),
    listDealerTrackedAssets(session.user.id),
  ]);

  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    redirect('/dealer/login');
  }

  return (
    <div className={styles.module}>
      <DealerClientsClient
        dealerAppMode
        dealerUserId={session.user.id}
        initialLeads={leads}
        initialAssets={assets}
      />
    </div>
  );
}
