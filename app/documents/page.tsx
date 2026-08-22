import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../lib/account-profile';
import { requireActivePageAccess } from '../../lib/account-access';
import DocumentsClient from './documents-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DocumentsPageProps = {
  searchParams?: {
    assetId?: string | string[];
  };
};

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'owner') {
    redirect('/account');
  }

  const rawAssetId = Array.isArray(searchParams?.assetId) ? searchParams?.assetId[0] : searchParams?.assetId;
  const initialAssetId = String(rawAssetId ?? '').trim().slice(0, 120);

  return <DocumentsClient initialAssetId={initialAssetId} />;
}
