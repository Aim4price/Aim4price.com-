import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import styles from '../owner-app.module.css';
import OwnerAssetsClient from './owner-assets-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAssetsPage({ searchParams }: { searchParams?: { q?: string | string[] } }) {
  await requireOwnerAppPageAccess();
  const initialQuery = Array.isArray(searchParams?.q) ? searchParams?.q[0] ?? '' : searchParams?.q ?? '';
  return (
    <main className={styles.page}>
      <OwnerAppNav />
      <OwnerAssetsClient initialQuery={initialQuery} />
    </main>
  );
}
