import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession } from '../../../lib/auth-session';
import { listDealerTrackedAssets } from '../../../lib/dealer-maintenance-tracker';
import DealerNav from '../dealer-nav';
import DealerMaintenanceClient from './dealer-maintenance-client';
import dealerStyles from '../dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerMaintenancePage() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') redirect('/dealer/login');
  const assets = await listDealerTrackedAssets(session.user.id);
  return <div className={dealerStyles.module}><DealerNav backLabel="Home" /><DealerMaintenanceClient initialAssets={assets} /></div>;
}
