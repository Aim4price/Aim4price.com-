import { redirect } from 'next/navigation';
import { requireActivePageAccess } from '../../../../../lib/account-access';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getAccountantRegisterAccess } from '../../../../../lib/accountant-workspace';
import AssetRegistersClient from '../../../../asset-registers/asset-registers-client';

export const runtime = 'nodejs';

export default async function AccountantAssetRegistersPage({ params }: { params: { shareId: string } }) {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile(session.user);
  if (profile.accountType !== 'finance' || profile.accountSubtype !== 'accountant') redirect('/leads');

  try {
    await getAccountantRegisterAccess({ accountantUserId: session.user.id, shareId: params.shareId });
  } catch {
    redirect('/leads');
  }

  return <AssetRegistersClient accountantShareId={params.shareId} />;
}
