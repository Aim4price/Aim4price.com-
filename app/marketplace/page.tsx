import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { redirectAdminToAdmin } from '../../lib/account-access';
import {
  generateMetadata as generateMarketplaceBrowseMetadata,
  type MarketplacePageProps,
} from './marketplace-browse-page';
import styles from './marketplace-entry.module.css';

type SearchParamValue = string | string[] | undefined;

const BROWSE_PARAM_KEYS = [
  'brand',
  'model',
  'drive',
  'type',
  'query',
  'listing',
  'preview',
] as const;

type MarketplaceEntryPageProps = {
  searchParams?: Record<string, SearchParamValue>;
};

function firstValue(value: SearchParamValue): string {
  return String(Array.isArray(value) ? value[0] ?? '' : value ?? '').trim();
}

function buildLegacyBrowseQuery(
  searchParams: MarketplaceEntryPageProps['searchParams'],
): string {
  const query = new URLSearchParams();

  for (const key of BROWSE_PARAM_KEYS) {
    const value = firstValue(searchParams?.[key]);
    if (value) query.set(key, value);
  }

  return query.toString();
}

export async function generateMetadata(
  props: MarketplaceEntryPageProps,
): Promise<Metadata> {
  if (firstValue(props.searchParams?.listing)) {
    return generateMarketplaceBrowseMetadata(props as MarketplacePageProps);
  }

  return {
    title: 'Marketplace',
    description: 'Choose whether to discover participating assets or browse Marketplace listings on Aim4price.',
  };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function MarketplaceEntryPage({
  searchParams,
}: MarketplaceEntryPageProps) {
  await redirectAdminToAdmin();

  const legacyBrowseQuery = buildLegacyBrowseQuery(searchParams);
  if (legacyBrowseQuery) {
    redirect(`/marketplace/browse?${legacyBrowseQuery}`);
  }

  return (
    <main className={styles.page}>
      <AppHeader active="marketplace" />

      <section className={styles.choiceSection} aria-labelledby="marketplace-choice-title">
        <div className={styles.choiceShell}>
          <div className={styles.heading}>
            <p>Aim4price Marketplace</p>
            <h1 id="marketplace-choice-title">Where would you like to go?</h1>
          </div>

          <nav className={styles.choiceGrid} aria-label="Marketplace choices">
            <Link href="/asset-discovery" className={styles.choiceCard}>
              <span className={styles.choiceIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="8" />
                  <path d="m9.25 14.75 1.7-3.8 3.8-1.7-1.7 3.8-3.8 1.7Z" />
                </svg>
              </span>
              <strong>Discover</strong>
              <small>Browse participating owners&apos; assets.</small>
              <span className={styles.choiceArrow} aria-hidden="true">›</span>
            </Link>

            <Link href="/marketplace/browse" className={styles.choiceCard}>
              <span className={styles.choiceIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 8.5h14l-1 10H6l-1-10Z" />
                  <path d="M8.5 8.5a3.5 3.5 0 0 1 7 0" />
                </svg>
              </span>
              <strong>Marketplace</strong>
              <small>Browse assets currently listed for sale.</small>
              <span className={styles.choiceArrow} aria-hidden="true">›</span>
            </Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
