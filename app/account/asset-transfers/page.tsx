import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { requireActivePageAccess } from '../../../lib/account-access';
import AssetTransfersClient from './asset-transfers-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AssetTransfersPage() {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (profile.accountType !== 'owner') redirect('/account');
  return <AssetTransfersClient />;
}
