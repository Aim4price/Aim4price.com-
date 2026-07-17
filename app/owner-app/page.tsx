import Link from 'next/link';
import { requireOwnerAppPageAccess } from '../../lib/owner-app-access';
import OwnerAppNav from './owner-app-nav';
import OwnerNotificationsLink from './owner-notifications-link';
import styles from './owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOOLS = [
  { label: 'Overview', description: 'See what needs attention', icon: '✓', href: '/owner-app/attention' },
  { label: 'My Assets', description: 'View and manage your register', icon: 'A', href: '/owner-app/assets' },
  { label: 'Get Estimate', description: 'Check a likely market value', icon: 'R', href: '/owner-app/valuation' },
  { label: 'Marketplace', description: 'Explore buying and selling', icon: '↗', href: '/owner-app/marketplace' },
] as const;

export default async function OwnerAppHome() {
  const access = await requireOwnerAppPageAccess();
  const notificationViewerId = access.ownerAppUserId ?? access.ownerUserId;

  return (
    <main className={`${styles.page} ${styles.homePage}`}>
      <OwnerAppNav showBack={false} />
      <div className={`${styles.content} ${styles.homeContent}`}>
        <div className={styles.homeDashboard}>
          <section className={styles.homeWelcome}>
            <span>Aim4price Owner</span>
            <h1>Your assets, at a glance.</h1>
            <p>Everything important is close at hand.</p>
          </section>

          <nav className={styles.homeLauncher} aria-label="Owner tools">
            <OwnerNotificationsLink viewerId={notificationViewerId} />
            {TOOLS.map((tool) => (
              <Link key={tool.href} className={styles.homeLaunchCard} href={tool.href} prefetch={false}>
                <span className={styles.homeLaunchIcon} aria-hidden="true">{tool.icon}</span>
                <span className={styles.homeLaunchCopy}>
                  <strong>{tool.label}</strong>
                  <small>{tool.description}</small>
                </span>
                <span className={styles.homeLaunchArrow} aria-hidden="true">›</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </main>
  );
}
