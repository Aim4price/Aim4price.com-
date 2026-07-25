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
          <header className={styles.heading}>
            <div className={styles.headingCopy}>
              <p>Aim4price Marketplace</p>
              <h1 id="marketplace-choice-title">Where would you like to go?</h1>
              <span>Choose how you would like to browse equipment on Aim4price.</span>
            </div>

            <span className={styles.headingIcon} aria-hidden="true">
              <svg viewBox="0 0 32 32">
                <path d="M5 14h22" />
                <path d="m7.5 6-2.5 8a4 4 0 0 0 7 2.6A4 4 0 0 0 16 19a4 4 0 0 0 4-2.4A4 4 0 0 0 27 14l-2.5-8H7.5Z" />
                <path d="M8 18.5V27h16v-8.5" />
                <path d="M13 27v-5h6v5" />
              </svg>
            </span>
          </header>

          <nav className={styles.choiceGrid} aria-label="Marketplace choices">
            <Link href="/asset-discovery" className={`${styles.choiceCard} ${styles.discoveryCard}`}>
              <div className={styles.choiceCardTop}>
                <span className={styles.choiceIcon} aria-hidden="true">
                  <svg viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="9" />
                    <circle cx="16" cy="16" r="2.5" />
                    <path d="M16 3v3M16 26v3M3 16h3M26 16h3" />
                    <path d="m11.6 20.4 2.7-6.1 6.1-2.7-2.7 6.1-6.1 2.7Z" />
                  </svg>
                </span>
                <span className={styles.choiceEyebrow}>Asset Discovery</span>
              </div>

              <span className={styles.choiceCopy}>
                <strong>Discover Assets</strong>
                <small>Browse equipment shared by participating Aim4price owners.</small>
              </span>

              <span className={styles.choiceAction}>
                <span>Open Discovery</span>
                <span className={styles.choiceArrow} aria-hidden="true">›</span>
              </span>
            </Link>

            <Link href="/marketplace/browse" className={`${styles.choiceCard} ${styles.marketplaceCard}`}>
              <div className={styles.choiceCardTop}>
                <span className={styles.choiceIcon} aria-hidden="true">
                  <svg viewBox="0 0 32 32">
                    <path d="M5 14h22" />
                    <path d="m7.5 6-2.5 8a4 4 0 0 0 7 2.6A4 4 0 0 0 16 19a4 4 0 0 0 4-2.4A4 4 0 0 0 27 14l-2.5-8H7.5Z" />
                    <path d="M8 18.5V27h16v-8.5" />
                    <path d="M13 27v-5h6v5" />
                  </svg>
                </span>
                <span className={styles.choiceEyebrow}>Assets for Sale</span>
              </div>

              <span className={styles.choiceCopy}>
                <strong>Marketplace</strong>
                <small>Browse equipment currently listed for sale across South Africa.</small>
              </span>

              <span className={styles.choiceAction}>
                <span>Open Marketplace</span>
                <span className={styles.choiceArrow} aria-hidden="true">›</span>
              </span>
            </Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
