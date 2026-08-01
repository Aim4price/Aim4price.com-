import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getAccountantRegisterData } from '../../../../lib/accountant-workspace';
import { requireActivePageAccess } from '../../../../lib/account-access';
import AssetRegisterClient from '../../../asset-register/asset-register-client';

export const runtime = 'nodejs';

export default async function AccountantRegisterPage({
  params,
  searchParams,
}: {
  params: { shareId: string };
  searchParams?: { registerId?: string; scope?: string };
}) {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile(session.user);
  if (profile.accountType !== 'finance' || profile.accountSubtype !== 'accountant') redirect('/leads');
  try {
    await getAccountantRegisterData(session.user.id, params.shareId, {
      registerId: searchParams?.registerId,
      combined: searchParams?.scope === 'combined',
    });
    return <AssetRegisterClient accountantShareId={params.shareId} />;
  } catch {
    redirect('/leads');
  }
}
