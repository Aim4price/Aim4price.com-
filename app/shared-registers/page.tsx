import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../lib/account-profile';
import { requireActivePageAccess } from '../../lib/account-access';
import { listInsurancePortfolio } from '../../lib/insurance-workspaces';
import SharedRegistersClient from './shared-registers-client';

export const runtime = 'nodejs';

export default async function SharedRegistersPage() {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });

  if (profile.accountType === 'finance' && profile.accountSubtype === 'accountant') {
    redirect('/accountant/registers');
  }

  if (profile.accountType !== 'insurance') {
    redirect(profile.accountType === 'owner' ? '/asset-register' : '/leads');
  }

  const portfolio = await listInsurancePortfolio(session.user.id);
  return <SharedRegistersClient initialItems={portfolio} />;
}
