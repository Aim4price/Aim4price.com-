import { redirect } from 'next/navigation';
import { requireActivePageAccess } from '../../lib/account-access';
import { getAccountProfile } from '../../lib/account-profile';
import { normalizeInternalReturnPath, readSingleSearchParam } from '../../lib/internal-return-path';
import MaintenanceClient from './maintenance-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MaintenancePageProps = {
  searchParams?: {
    assetId?: string | string[];
    add?: string | string[];
    action?: string | string[];
    returnTo?: string | string[];
  };
};

export default async function MaintenancePage({ searchParams }: MaintenancePageProps) {
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
  const requestedAction = readSingleSearchParam(searchParams?.action).toLowerCase();
  const initialOpenAdd = Boolean(initialAssetId)
    && (readSingleSearchParam(searchParams?.add) === '1' || requestedAction === 'add');
  const initialReturnTo = normalizeInternalReturnPath(searchParams?.returnTo);

  return (
    <MaintenanceClient
      initialAssetId={initialAssetId}
      initialOpenAdd={initialOpenAdd}
      initialReturnTo={initialReturnTo}
    />
  );
}
