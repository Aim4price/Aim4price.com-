import Link from 'next/link';
import { requireOwnerAppPageAccess } from '../../lib/owner-app-access';
import OwnerAppNav from './owner-app-nav';
import OwnerNotificationsLink from './owner-notifications-link';
import styles from './owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOOLS = [
  { label: 'Overview', href: '/owner-app/attention' },
  { label: 'My Assets', href: '/owner-app/assets' },
  { label: 'Get Estimate', href: '/owner-app/valuation' },
  { label: 'Marketplace', href: '/owner-app/marketplace' },
] as const;

export default async function OwnerAppHome() {
  const access = await requireOwnerAppPageAccess();
  const notificationViewerId = access.ownerAppUserId ?? access.ownerUserId;

  return (
    <main className={`${styles.page} ${styles.homePage}`}>
      <OwnerAppNav showBack={false} />
      <div className={`${styles.content} ${styles.homeContent}`}>
        <nav className={styles.homeLauncher} aria-label="Owner tools">
          <OwnerNotificationsLink viewerId={notificationViewerId} />
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
