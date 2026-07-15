import Link from 'next/link';
import { getAccountProfile } from '../../lib/account-profile';
import { listHeaderNotifications } from '../../lib/notifications';
import { requireOwnerAppPageAccess } from '../../lib/owner-app-access';
import OwnerAppNav from './owner-app-nav';
import styles from './owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOOLS = [
  { label: 'My Assets', href: '/owner-app/assets' },
  { label: 'Needs Attention', href: '/owner-app/attention' },
  { label: 'Get Estimate', href: '/owner-app/valuation' },
  { label: 'Marketplace', href: '/owner-app/marketplace' },
] as const;

export default async function OwnerAppHome() {
  const access = await requireOwnerAppPageAccess();
  const profile = await getAccountProfile({ id: access.ownerUserId, name: access.displayName, email: null });
  const notifications = await listHeaderNotifications({ userId: access.ownerUserId, accountType: profile.accountType }).catch(() => []);

  return (
    <main className={`${styles.page} ${styles.homePage}`}>
      <OwnerAppNav showBack={false} />
      <div className={`${styles.content} ${styles.homeContent}`}>
        <nav className={styles.homeLauncher} aria-label="Owner tools">
          <Link className={styles.homeLaunchCard} href="/owner-app/notifications" prefetch={false}>
            <strong>Notifications</strong>
            {notifications.length > 0 ? <span className={styles.homeLaunchBadge}>{notifications.length > 99 ? '99+' : notifications.length}</span> : null}
          </Link>
          {TOOLS.map((tool) => (
            <Link key={tool.href} className={styles.homeLaunchCard} href={tool.href} prefetch={false}>
              <strong>{tool.label}</strong>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
