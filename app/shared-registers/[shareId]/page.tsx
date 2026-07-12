import { notFound, redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { requireActivePageAccess } from '../../../lib/account-access';
import { listAssetLeadsForUser } from '../../../lib/partner-access';
import { demoSharedRegisterLead, isSharedInsuranceRegister } from '../../../lib/shared-register-prototype';
import SharedRegisterWorkspace from './shared-register-workspace';

export const runtime = 'nodejs';

export default async function SharedRegisterWorkspacePage({ params }: { params: { shareId: string } }) {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });

  if (profile.accountType !== 'insurance') {
    redirect(profile.accountType === 'owner' ? '/asset-register' : '/leads');
  }

  if (params.shareId === 'demo') {
    return <SharedRegisterWorkspace share={demoSharedRegisterLead(session.user.id)} />;
  }

  const leads = await listAssetLeadsForUser(session.user.id);
  const share = leads.find(
    (lead) => lead.id === params.shareId && lead.partnerUserId === session.user.id && isSharedInsuranceRegister(lead),
  );

  if (!share) notFound();
  return <SharedRegisterWorkspace share={share} />;
}
