import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { listAccountantRegisters } from '../../../lib/accountant-workspace';
import { requireActivePageAccess } from '../../../lib/account-access';
import AccountantRegistersClient from './accountant-registers-client';

export const runtime = 'nodejs';

export default async function AccountantRegistersPage() {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile(session.user);
  if (profile.accountType !== 'finance' || profile.accountSubtype !== 'accountant') {
    redirect(profile.accountType === 'owner' ? '/asset-register' : '/leads');
  }
  return <AccountantRegistersClient initialRegisters={await listAccountantRegisters(session.user.id)} />;
}
