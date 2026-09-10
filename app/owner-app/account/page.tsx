import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppAccountPage() {
  const access = await requireOwnerAppPageAccess();
  return (
    <main className={styles.page}>
      <OwnerAppNav />
      <div className={styles.content}>
        <section className={styles.hero}><h1>Account</h1><p>Signed in as {access.displayName}.</p></section>
        <section className={styles.section}>
          <a className={styles.secondaryButton} href="/owner-app/notifications">Notifications</a>
          <h2>Owner App access</h2>
          <p>{access.sessionKind === 'owner-app-user' ? 'This is a managed Owner App username.' : 'You opened Aim4price Owner with the active owner account.'}</p>
          <a className={styles.secondaryButton} href="/owner-app/login">Return to sign in</a>
        </section>
      </div>
    </main>
  );
}
