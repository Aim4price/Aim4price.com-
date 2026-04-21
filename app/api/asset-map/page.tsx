import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/auth-session';
import AssetMapClient from './asset-map-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AssetMapPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth#signup');
  }

  return <AssetMapClient />;
}
