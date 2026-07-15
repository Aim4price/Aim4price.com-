import { notFound, redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { requireActivePageAccess } from '../../../lib/account-access';
import { getOrCreateInsuranceWorkspaceForShare } from '../../../lib/insurance-workspaces';
import SharedRegisterWorkspace from './shared-register-workspace';

export const runtime = 'nodejs';

export default async function SharedRegisterWorkspacePage({ params }: { params: { shareId: string } }) {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });

  if (profile.accountType !== 'insurance') {
    redirect(profile.accountType === 'owner' ? '/asset-register' : '/leads');
  }

  try {
    const workspace = await getOrCreateInsuranceWorkspaceForShare({ brokerUserId: session.user.id, shareId: params.shareId });
    return <SharedRegisterWorkspace initialWorkspace={workspace} />;
  } catch (error) {
    if (error instanceof Error && error.message.includes('NOT_FOUND')) notFound();
    throw error;
  }
}
