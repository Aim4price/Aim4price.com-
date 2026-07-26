import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { redirectAdminToAdmin } from '../../lib/account-access';
import {
  generateMetadata as generateMarketplaceBrowseMetadata,
  type MarketplacePageProps,
} from './marketplace-browse-page';
import valuationStyles from '../valuation/page.module.css';

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
    <main className={valuationStyles.page}>
      <AppHeader active="marketplace" />

      <div className={valuationStyles.container}>
        <section className={`${valuationStyles.wizardShell} ${valuationStyles.sectorWizardShell}`}>
          <div className={`${valuationStyles.wizardCard} ${valuationStyles.sectorWizardCard}`}>
            <div className={`${valuationStyles.stepContent} ${valuationStyles.sectorStepContent}`}>
              <div className={valuationStyles.sectorStart}>
                <div className={valuationStyles.sectorIntro}>
                  <h1 className={valuationStyles.stepTitle}>Choose an option</h1>
                  <p className={valuationStyles.stepText}>
                    Choose where you want to go. Hover over a card to preview it.
                  </p>
                </div>

                <nav className={valuationStyles.sectorLargeGrid} aria-label="Marketplace choices">
                  <Link
                    href="/asset-discovery"
                    className={`${valuationStyles.sectorBigCard} ${valuationStyles.sectorBigCardLive}`}
                    style={{ textDecoration: 'none' }}
                    aria-label="Open Discovery"
                  >
                    <video
                      className={valuationStyles.sectorVideo}
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="auto"
                    >
                      <source src="/discovery/Aim4price_Discovery.mp4" type="video/mp4" />
                    </video>

                    <span className={valuationStyles.sectorVideoOverlay} />

                    <span className={valuationStyles.sectorBigCardContent}>
                      <span className={valuationStyles.sectorCardTopRow}>
                        <span className={valuationStyles.liveBadge}>Live now</span>
                      </span>

                      <span className={valuationStyles.sectorLabelWrap}>
                        <strong className={valuationStyles.sectorLabel}>Discovery</strong>
                        <span className={valuationStyles.sectorCardHint}>Discover assets</span>
                      </span>
                    </span>
                  </Link>

                  <Link
                    href="/marketplace/browse"
                    className={`${valuationStyles.sectorBigCard} ${valuationStyles.sectorBigCardLive}`}
                    style={{ textDecoration: 'none' }}
                    aria-label="Open Marketplace"
                  >
                    <video
                      className={valuationStyles.sectorVideo}
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="auto"
                    >
                      <source src="/marketplace/Aim4price_Marketplace.mp4" type="video/mp4" />
                    </video>

                    <span className={valuationStyles.sectorVideoOverlay} />

                    <span className={valuationStyles.sectorBigCardContent}>
                      <span className={valuationStyles.sectorCardTopRow}>
                        <span className={valuationStyles.liveBadge}>Live now</span>
                      </span>

                      <span className={valuationStyles.sectorLabelWrap}>
                        <strong className={valuationStyles.sectorLabel}>Marketplace</strong>
                        <span className={valuationStyles.sectorCardHint}>Browse assets for sale</span>
                      </span>
                    </span>
                  </Link>
                </nav>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
