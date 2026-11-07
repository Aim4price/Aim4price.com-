import { DesktopWorkspaceProvider } from '../../components/DesktopWorkspace';
import { getDesktopScope, desktopWorkspace } from '../../lib/desktop-workspace';
import { redirect } from 'next/navigation';
import { requireActivePageAccess } from '../../lib/account-access';
import { getAccountProfile } from '../../lib/account-profile';
import MyInvoicesClient from '../my-invoices/my-invoices-client';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function BudgetsPage({searchParams}: {searchParams?: {desktopMembershipId?: string}}) {
  const desktop = await getDesktopScope(searchParams?.desktopMembershipId);
  if (desktop) {
    if (!desktop.grant.permissions.viewBudgets) redirect('/team/access');
    return <DesktopWorkspaceProvider workspace={desktopWorkspace(desktop)}><MyInvoicesClient budgetsPage /></DesktopWorkspaceProvider>;
  }
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (profile.accountType !== 'owner') redirect('/account');
  return <MyInvoicesClient budgetsPage />;
}
