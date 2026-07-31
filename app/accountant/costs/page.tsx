import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { listAccountantRegisters } from '../../../lib/accountant-workspace';
import { requireActivePageAccess } from '../../../lib/account-access';
import AccountantLedgerClient from '../accountant-ledger-client';

export const runtime = 'nodejs';

export default async function AccountantCostsPage() {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile(session.user);
  if (profile.accountType !== 'finance' || profile.accountSubtype !== 'accountant') redirect('/leads');
  return <AccountantLedgerClient kind="cost" initialRegisters={await listAccountantRegisters(session.user.id)} />;
}
