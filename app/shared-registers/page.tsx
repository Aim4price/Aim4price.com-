import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../lib/account-profile';
import { requireActivePageAccess } from '../../lib/account-access';
import { listAssetLeadsForUser } from '../../lib/partner-access';
import { isSharedInsuranceRegister } from '../../lib/shared-register-prototype';
import SharedRegistersClient from './shared-registers-client';

export const runtime = 'nodejs';

export default async function SharedRegistersPage() {
  const { session } = await requireActivePageAccess();
  const [profile, leads] = await Promise.all([
    getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email }),
    listAssetLeadsForUser(session.user.id),
  ]);

  if (profile.accountType !== 'insurance') {
    redirect(profile.accountType === 'owner' ? '/asset-register' : '/leads');
  }

  const sharedRegisters = leads.filter(
    (lead) => lead.partnerUserId === session.user.id && isSharedInsuranceRegister(lead),
  );

  return <SharedRegistersClient initialShares={sharedRegisters} />;
}
