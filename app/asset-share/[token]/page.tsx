import type { Metadata } from 'next';
import AssetShareView from './AssetShareView';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Shared asset details',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};
export default function AssetSharePage(props: Pick<Parameters<typeof AssetShareView>[0], 'params' | 'searchParams'>) {
  return <AssetShareView {...props}/>;
}
