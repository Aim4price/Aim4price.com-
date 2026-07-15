import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';
import OwnerNotificationsClient from './owner-notifications-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerNotificationsPage() {
  const access = await requireOwnerAppPageAccess();
  const notificationViewerId = access.ownerAppUserId ?? access.ownerUserId;

  return (
    <main className={styles.page}>
      <OwnerAppNav />
      <OwnerNotificationsClient viewerId={notificationViewerId} />
    </main>
  );
}
