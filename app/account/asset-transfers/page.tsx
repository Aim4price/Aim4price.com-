import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { isAssetRegisterAccountType } from '../../../lib/asset-register-account-access';
import { requireActivePageAccess } from '../../../lib/account-access';
import AssetTransfersClient from './asset-transfers-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AssetTransfersPage() {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (!isAssetRegisterAccountType(profile.accountType)) redirect('/account');
  return <AssetTransfersClient />;
}
