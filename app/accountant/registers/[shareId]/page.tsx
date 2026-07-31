import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getAccountantRegisterData } from '../../../../lib/accountant-workspace';
import { requireActivePageAccess } from '../../../../lib/account-access';
import AccountantRegisterClient from './accountant-register-client';

export const runtime = 'nodejs';

export default async function AccountantRegisterPage({ params }: { params: { shareId: string } }) {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile(session.user);
  if (profile.accountType !== 'finance' || profile.accountSubtype !== 'accountant') redirect('/leads');
  try {
    const data = await getAccountantRegisterData(session.user.id, params.shareId);
    return <AccountantRegisterClient initialData={data} shareId={params.shareId} />;
  } catch {
    redirect('/accountant/registers');
  }
}
