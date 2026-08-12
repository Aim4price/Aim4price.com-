import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { requireActivePageAccess } from '../../lib/account-access';
import { getAccountProfile } from '../../lib/account-profile';
import { getAssetLeadSummaryCountsForPartner } from '../../lib/partner-access';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function LicensingHomePage() {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'licensing') {
    redirect('/account');
  }

  const counts = await getAssetLeadSummaryCountsForPartner(session.user.id, 'license_renewal');
  const accountName = profile.businessName || profile.displayName || 'your workspace';

  return (
    <main className={styles.page}>
      <AppHeader active="home" />
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>Licence renewal workspace</span>
            <h1>Welcome to {accountName}</h1>
            <p>Manage renewal leads or find licensed assets with upcoming renewal dates.</p>
          </div>
          <div className={styles.totalCard}>
            <span>My leads</span>
            <strong>{counts.total}</strong>
          </div>
        </section>

        <section className={styles.stats} aria-label="Lead summary">
          <article>
            <span>New</span>
            <strong>{counts.newLeads}</strong>
          </article>
          <article>
            <span>In progress</span>
            <strong>{counts.inProgress}</strong>
          </article>
          <article>
            <span>Handled</span>
            <strong>{counts.completed}</strong>
          </article>
        </section>

        <section className={styles.actions}>
          <Link href="/leads" className={styles.leadsAction}>
            <span>My Leads</span>
            <strong>Work with accepted renewal requests</strong>
            <small>Open leads →</small>
          </Link>
          <Link href="/asset-discovery" className={styles.discoveryAction}>
            <span>Discovery</span>
            <strong>Find upcoming licence renewals</strong>
            <small>Discover assets →</small>
          </Link>
        </section>
      </div>
    </main>
  );
}
