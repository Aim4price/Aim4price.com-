import type { Metadata } from 'next';
import { readPublicAssetShare } from '../../../lib/asset-share-links';
import SharedAssetCards from '../../../components/asset-register/SharedAssetCards';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Shared asset details',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};
export default async function AssetSharePage({ params }: { params: { token: string } }) {
  const share = await readPublicAssetShare(params.token);
  return <SharedAssetCards share={share} />;
}
