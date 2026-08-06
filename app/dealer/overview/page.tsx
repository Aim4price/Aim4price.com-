import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession } from '../../../lib/auth-session';
import { getDealerAppSession } from '../../../lib/dealer-app-session';
import { listDealerOverview } from '../../../lib/dealer-overview';
import DealerOverviewClient from './dealer-overview-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerOverviewPage() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') redirect('/dealer/login');

  const dealerAppSession = await getDealerAppSession();
  const overview = await listDealerOverview({
    dealerUserId: session.user.id,
    currentStaffId: dealerAppSession?.staffId ?? null,
    role: dealerAppSession?.role ?? 'owner',
  });

  return <DealerOverviewClient initialOverview={overview} />;
}
