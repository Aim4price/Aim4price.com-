import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession } from '../../../lib/auth-session';
import { getDealerAppSession } from '../../../lib/dealer-app-session';
import { dealerRoleCan } from '../../../lib/dealer-app-access';
import { listDealerMaintenanceNotificationsForViewer } from '../../../lib/dealer-maintenance-notification-inbox';
import DealerMaintenanceNotificationsClient from './dealer-maintenance-notifications-client';
import styles from '../dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerNotificationsPage() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');
  const dealerAppSession = await getDealerAppSession();
  if (dealerAppSession && !dealerRoleCan(dealerAppSession.role, 'notifications')) redirect('/dealer');

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    redirect('/dealer/login');
  }

  const notifications = await listDealerMaintenanceNotificationsForViewer({
    dealerUserId: session.user.id,
    viewerKey: dealerAppSession
      ? `dealer-staff:${dealerAppSession.staffId}`
      : `account:${session.user.id}`,
    staffId: dealerAppSession?.staffId ?? null,
  });

  return (
    <main className={`${styles.module} ${styles.notificationOwnerPage}`}>
      <DealerMaintenanceNotificationsClient notifications={notifications} />
    </main>
  );
}
