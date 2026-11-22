import type { Metadata } from 'next';
import AppHeader from '../../components/AppHeader';
import { getAnyServerSession } from '../../lib/auth-session';
import PricingContent from './pricing-content';
import { pricingAudience } from '../../lib/subscription-options';
import { MONTHLY_BUSINESS_CREDITS } from '../../lib/business-credits';
import styles from './pricing.module.css';

// The shared header reads search params and the visitor's session.
// Match the request-time rendering used by the other public website pages.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Subscriptions',
  description: 'Compare Aim4price Owner, Free Business and Paid Business subscriptions, client hosting and optional assistance.',
  robots: { index: false, follow: false },
};

export default async function PricingPage({ searchParams }: { searchParams?: { audience?: string } }) {
  const session = await getAnyServerSession();
  const initialAudience = pricingAudience(searchParams?.audience);
  return (
    <main className={styles.page}>
      <AppHeader active="none" />
      <PricingContent signedIn={Boolean(session?.user?.id)} initialAudience={initialAudience} freeBusinessCredits={MONTHLY_BUSINESS_CREDITS} />
    </main>
  );
}
