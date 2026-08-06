import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession } from '../../../lib/auth-session';
import { getDealerAppSession } from '../../../lib/dealer-app-session';
import { dealerRoleCan } from '../../../lib/dealer-app-access';
import { listDealerTrackedAssets } from '../../../lib/dealer-maintenance-tracker';
import DealerMaintenanceClient from './dealer-maintenance-client';
import dealerStyles from '../dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerMaintenancePage({ searchParams }: { searchParams?: { open?: string } }) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');
  const dealerAppSession = await getDealerAppSession();
  if (dealerAppSession && !dealerRoleCan(dealerAppSession.role, 'maintenance')) redirect('/dealer');
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') redirect('/dealer/login');
  const assets = await listDealerTrackedAssets(session.user.id);
  return <div className={`${dealerStyles.module} ${dealerStyles.maintenanceModule}`}><DealerMaintenanceClient initialAssets={assets} initialOpenAccessId={String(searchParams?.open ?? '').trim() || null} /></div>;
}
