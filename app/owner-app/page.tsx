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
    <main className={styles.page}>
      <OwnerAppNav showBack={false} />
      <div className={styles.content}>
        <section className={`${styles.hero} ${styles.heroCenter}`}>
          <p className={styles.eyebrow}>Aim4price Owner</p>
          <h1>Welcome, {access.displayName}</h1>
          <p>Your assets and owner tools in one place.</p>
        </section>

        <form className={styles.searchForm} action="/owner-app/assets">
          <input className={styles.searchInput} name="q" placeholder="Search all assets" aria-label="Search all assets" />
          <button className={styles.primaryButton} type="submit">Search</button>
        </form>

        <Link className={`${styles.panel} ${styles.notificationLink}`} href="/owner-app/notifications">
          <span>Notifications</span><span className={styles.count}>{notifications.length}</span>
        </Link>

        <nav className={styles.launcher} aria-label="Owner tools">
          {TOOLS.map((tool) => <Link key={tool.href} className={styles.launchCard} href={tool.href} prefetch={false}><span>{tool.label}</span><span>›</span></Link>)}
        </nav>

        <Link className={styles.secondaryButton} href="/owner-app/account">Account</Link>
      </div>
    </main>
  );
}
