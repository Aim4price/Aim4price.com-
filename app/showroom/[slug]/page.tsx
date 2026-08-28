import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { PublicMiddlemanShowroom } from '../../../components/MiddlemanShowroomClient';
import { listPublishedMarketplaceAssetListings } from '../../../lib/marketplace-db';
import { getPublicMiddlemanShowroomBySlug } from '../../../lib/middleman-showroom-db';

const getCachedPublicShowroom = cache(getPublicMiddlemanShowroomBySlug);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = { params: { slug: string } };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = params;
  const showroom = await getCachedPublicShowroom(slug);
  return showroom
    ? { title: `${showroom.name} machinery showroom | Aim4price`, description: showroom.bio || `Valuation-backed machinery advertised by ${showroom.name}.` }
    : { title: 'Showroom not found | Aim4price' };
}

export default async function PublicShowroomPage({ params }: PageProps) {
  const { slug } = params;
  const showroom = await getCachedPublicShowroom(slug);
  if (!showroom) notFound();
  const listings = await listPublishedMarketplaceAssetListings({
    sellerUserId: showroom.userId,
    exposeContact: true,
  });
  return <PublicMiddlemanShowroom showroom={showroom} listings={listings} />;
}
