import type { Metadata } from 'next';
import AppHeader from '../../components/AppHeader';
import PricingContent from './pricing-content';
import styles from './pricing.module.css';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Explore Aim4price Owner plans, Dealer and Middleman access, and optional administration services.',
  robots: { index: false, follow: false },
};

export default function PricingPage() {
  return (
    <main className={styles.page}>
      <AppHeader active="none" />
      <PricingContent />
    </main>
  );
}
