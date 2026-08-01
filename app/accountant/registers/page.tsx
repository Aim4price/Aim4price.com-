import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { requireActivePageAccess } from '../../../lib/account-access';
import AccountantRegistersClient from './accountant-registers-client';

export const runtime = 'nodejs';

export default async function AccountantRegistersPage() {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'finance' || profile.accountSubtype !== 'accountant') {
    redirect('/leads');
  }

  return <AccountantRegistersClient />;
}
