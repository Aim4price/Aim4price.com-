import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppAccountPage() {
  const access = await requireOwnerAppPageAccess();
  return (
    <main className={styles.page}>
      <OwnerAppNav showBack={false} showSignOut />
      <div className={styles.content}>
        <section className={styles.hero}><h1>Account</h1><p>Signed in as {access.displayName}.</p></section>
        <section className={styles.section}>
          <a className={styles.secondaryButton} href="/owner-app/notifications">Notifications</a>
          <h2>Owner App access</h2>
          <p>{access.sessionKind === 'owner-app-user' ? 'The account owner manages which assets and tools you can access.' : 'You’re signed in with your owner account.'}</p>
        </section>
      </div>
    </main>
  );
}
