import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { redirectAdminToAdmin } from '../../lib/account-access';
import { getAccountProfile } from '../../lib/account-profile';
import { getServerSession } from '../../lib/auth-session';
import {
  buildMarketplaceListingUrl,
  buildMarketplaceOgImageUrl,
  buildMarketplaceShareDescription,
  DEFAULT_MARKETPLACE_ORIGIN,
  findMarketplaceShareListing,
  formatMarketplaceSharePrice,
  listingDisplayTitle,
  normalizeMarketplaceOrigin,
} from '../../lib/marketplace-share';
import MarketplaceClient from './marketplace-client';

type SearchParamValue = string | string[] | undefined;

type MarketplacePageProps = {
  searchParams?: {
    brand?: SearchParamValue;
    model?: SearchParamValue;
    drive?: SearchParamValue;
    type?: SearchParamValue;
    query?: SearchParamValue;
    listing?: SearchParamValue;
  };
};

function pick(value: SearchParamValue): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim();
  }

  return String(value ?? '').trim();
}

function getMarketplaceRequestOrigin(): string {
  try {
    const requestHeaders = headers();
    const forwardedHost = requestHeaders.get('x-forwarded-host');
    const host = forwardedHost || requestHeaders.get('host');
    const forwardedProto = requestHeaders.get('x-forwarded-proto') || 'https';
    const proto = forwardedProto.split(',')[0]?.trim() || 'https';
    const cleanHost = host?.split(',')[0]?.trim();

    if (cleanHost) {
      return normalizeMarketplaceOrigin(`${proto}://${cleanHost}`);
    }
  } catch {
    // Fall through to environment/default origin.
  }

  return normalizeMarketplaceOrigin(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.RAILWAY_PUBLIC_DOMAIN ||
      process.env.VERCEL_URL ||
      DEFAULT_MARKETPLACE_ORIGIN,
  );
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: MarketplacePageProps): Promise<Metadata> {
  const listingReference = pick(searchParams?.listing);
  const origin = getMarketplaceRequestOrigin();
  const fallbackTitle = 'Aim4price Marketplace';
  const fallbackDescription = 'Browse agricultural, construction and industrial machinery listings on Aim4price.';

  if (!listingReference) {
    return {
      title: 'Marketplace',
      description: fallbackDescription,
      openGraph: {
        title: fallbackTitle,
        description: fallbackDescription,
        url: new URL('/marketplace', origin).toString(),
        siteName: 'Aim4price',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: fallbackTitle,
        description: fallbackDescription,
      },
    };
  }

  const listing = await findMarketplaceShareListing(listingReference);

  if (!listing) {
    return {
      title: 'Marketplace listing',
      description: fallbackDescription,
      openGraph: {
        title: fallbackTitle,
        description: fallbackDescription,
        url: new URL('/marketplace', origin).toString(),
        siteName: 'Aim4price',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: fallbackTitle,
        description: fallbackDescription,
      },
    };
  }

  const listingTitle = listingDisplayTitle(listing);
  const price = formatMarketplaceSharePrice(listing);
  const title = `${listingTitle} - ${price}`;
  const description = buildMarketplaceShareDescription(listing);
  const listingUrl = buildMarketplaceListingUrl(origin, listing);
  const imageUrl = buildMarketplaceOgImageUrl(origin, listing);

  return {
    title,
    description,
    alternates: {
      canonical: listingUrl,
    },
    openGraph: {
      title,
      description,
      url: listingUrl,
      siteName: 'Aim4price',
      type: 'website',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${listingTitle} Aim4price marketplace advert`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  await redirectAdminToAdmin();

  const session = await getServerSession();
  let accountType = session?.user?.id ? 'owner' : 'public';

  if (session?.user?.id) {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });

    accountType = profile.accountType;

    if (profile.accountType !== 'owner' && profile.accountType !== 'dealer') {
      redirect('/leads');
    }
  }

  return (
    <MarketplaceClient
      isSignedIn={Boolean(session?.user?.id)}
      accountType={accountType}
      initialFilters={{
        brand: pick(searchParams?.brand) || pick(searchParams?.query),
        model: pick(searchParams?.model),
        drive: pick(searchParams?.drive),
        type: pick(searchParams?.type),
      }}
    />
  );
}
