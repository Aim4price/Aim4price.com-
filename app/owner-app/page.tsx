import Link from 'next/link';
import { ownerAppCan, requireOwnerAppPageAccess, type OwnerAppPermission } from '../../lib/owner-app-access';
import OwnerAppNav from './owner-app-nav';
import OwnerNotificationsLink from './owner-notifications-link';
import OwnerOverviewLink from './owner-overview-link';
import AppHomeIcon, { AppHomeChevron } from '../../components/AppHomeIcon';
import launcherStyles from '../../components/AppHomeLauncher.module.css';
import styles from './owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOOLS: Array<{ label: string; href: string; permission?: OwnerAppPermission }> = [
  { label: 'My Assets', href: '/owner-app/assets' },
  { label: 'Maintenance & Fuel', href: '/owner-app/operations', permission: 'operate' },
  { label: 'Get Estimate', href: '/owner-app/valuation', permission: 'manage_assets' },
  { label: 'Discover Assets', href: '/owner-app/discovery' },
  { label: 'Marketplace', href: '/owner-app/marketplace', permission: 'manage_marketplace' },
];

export default async function OwnerAppHome() {
  const access = await requireOwnerAppPageAccess();
  const notificationViewerId = access.ownerAppUserId ?? access.ownerUserId;
  const tools = TOOLS.filter((tool) => !tool.permission || ownerAppCan(access, tool.permission));

  return (
    <main className={`${styles.page} ${styles.homePage}`}>
      <OwnerAppNav showBack={false} />
      <div className={`${styles.content} ${styles.homeContent}`}>
        <nav className={`${styles.homeLauncher} ${launcherStyles.list}`} aria-label="Owner tools">
          <OwnerNotificationsLink viewerId={notificationViewerId} />
          <OwnerOverviewLink />
          {tools.map((tool) => (
            <Link key={tool.href} className={`${styles.homeLaunchCard} ${launcherStyles.card}`} href={tool.href} prefetch={false}>
              <AppHomeIcon name={tool.href.split("/").pop() ?? "assets"} />
              <strong>{tool.label}</strong>
              <AppHomeChevron />
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
