import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppAccountPage() {
  const access = await requireOwnerAppPageAccess();
  const roleLabel = { manager: 'Manager', office: 'Office', operator: 'Operator', viewer: 'View only', workshop: 'Workshop', admin: 'Owner / Admin', operations: 'Operations', view_only: 'View only' }[access.accessRole];
  return (
    <main className={styles.page}>
      <OwnerAppNav showBack={false} showSignOut />
      <div className={styles.content}>
        <section className={styles.hero}><h1>Account</h1><p>Signed in as {access.displayName}.</p></section>
        <section className={styles.section}>
          <a className={styles.secondaryButton} href="/owner-app/notifications">Notifications</a>
          <h2>Your access</h2><dl><dt>Signed in as</dt><dd>{access.displayName}</dd><dt>Role</dt><dd>{roleLabel}</dd><dt>Assets</dt><dd>{access.assetScope === 'all' ? 'All assets' : `${access.accessibleAssetIds.length} assigned assets`}</dd></dl>
          <p>{access.sessionKind === 'owner-app-user' ? 'The account owner manages which assets and tools you can access.' : 'You’re signed in with your owner account.'}</p>
        </section>
      </div>
    </main>
  );
}
