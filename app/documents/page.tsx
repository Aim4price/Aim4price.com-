import { DesktopWorkspaceProvider } from '../../components/DesktopWorkspace';
import { getDesktopScope, desktopWorkspace } from '../../lib/desktop-workspace';
import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../lib/account-profile';
import { requireActivePageAccess } from '../../lib/account-access';
import { normalizeInternalReturnPath, readSingleSearchParam } from '../../lib/internal-return-path';
import DocumentsClient from './documents-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DocumentsPageProps = {
  searchParams?: {
    desktopMembershipId?: string;
    assetId?: string | string[];
    returnTo?: string | string[];
  };
};

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const desktop = await getDesktopScope(searchParams?.desktopMembershipId);
  if (desktop) return <DesktopWorkspaceProvider workspace={desktopWorkspace(desktop)}><DocumentsClient initialAssetId={readSingleSearchParam(searchParams?.assetId)} /></DesktopWorkspaceProvider>;
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'owner') {
    redirect('/account');
  }

  const initialAssetId = readSingleSearchParam(searchParams?.assetId).slice(0, 120);
  const initialReturnTo = normalizeInternalReturnPath(searchParams?.returnTo);

  return <DocumentsClient initialAssetId={initialAssetId} initialReturnTo={initialReturnTo} />;
}
