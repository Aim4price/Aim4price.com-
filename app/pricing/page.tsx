import type { Metadata } from 'next';
import AppHeader from '../../components/AppHeader';
import { getAnyServerSession } from '../../lib/auth-session';
import PricingContent from './pricing-content';
import styles from './pricing.module.css';

// The shared header reads search params and the visitor's session.
// Match the request-time rendering used by the other public website pages.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Explore Aim4price Owner, Dealer and Business accounts, with optional administration services.',
  robots: { index: false, follow: false },
};

export default async function PricingPage({ searchParams }: { searchParams?: { audience?: string } }) {
  const session = await getAnyServerSession();
  const audience = searchParams?.audience;
  const initialAudience = audience === 'owner' || audience === 'dealer' || audience === 'business' ? audience : null;
  return (
    <main className={styles.page}>
      <AppHeader active="none" />
      <PricingContent signedIn={Boolean(session?.user?.id)} initialAudience={initialAudience} />
    </main>
  );
}
