import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { getAccountProfile } from '../../lib/account-profile';
import { getServerSession } from '../../lib/auth-session';
import { listDealerTrackedAssets } from '../../lib/dealer-maintenance-tracker';
import TrackingClient from './tracking-client';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function TrackingPage({ searchParams }: { searchParams?: { open?: string } }) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    redirect('/login');
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    redirect('/account');
  }

  const assets = await listDealerTrackedAssets(session.user.id);

  return (
    <div className={styles.screen}>
      <AppHeader active="tracking" />
      <TrackingClient initialAssets={assets} initialOpenAccessId={String(searchParams?.open ?? '').trim() || null} />
    </div>
  );
}
