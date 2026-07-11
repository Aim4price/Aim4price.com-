import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/auth-session';
import { getAccountProfile } from '../../lib/account-profile';
import DealerNav from './dealer-nav';
import styles from './dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEALER_TOOLS = [
  { label: 'Valuation', href: '/dealer/valuation' },
  { label: 'Discovery', href: '/dealer/discovery' },
  { label: 'Leads', href: '/dealer/leads' },
  { label: 'Marketplace', href: '/dealer/marketplace' },
] as const;

export default async function DealerHome() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    redirect('/dealer/login');
  }

  return (
    <main className={styles.shell}>
      <DealerNav showBack={false} />
      <div className={styles.content}>
        <header className={styles.launcherIntro}>
          <span className={styles.eyebrow}>Dealer App</span>
          <h1 className={styles.brand}>Choose a tool</h1>
          <p className={styles.helper}>Everything you need, in one simple place.</p>
        </header>

        <nav className={styles.launcher} aria-label="Dealer tools">
          {DEALER_TOOLS.map((tool) => (
            <Link
              prefetch={false}
              key={tool.href}
              className={styles.card}
              href={tool.href}
            >
              <span>{tool.label}</span>
              <span className={styles.cardArrow} aria-hidden="true">›</span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
