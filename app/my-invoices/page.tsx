import { redirect } from 'next/navigation';
import { requireActivePageAccess } from '../../lib/account-access';
import { getAccountProfile } from '../../lib/account-profile';
import { normalizeInternalReturnPath, readSingleSearchParam } from '../../lib/internal-return-path';
import MyInvoicesClient from './my-invoices-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MyInvoicesPageProps = {
  searchParams?: {
    assetId?: string | string[];
    add?: string | string[];
    action?: string | string[];
    returnTo?: string | string[];
  };
};

export default async function MyInvoicesPage({ searchParams }: MyInvoicesPageProps) {
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
    <MyInvoicesClient
      initialAssetId={initialAssetId}
      initialOpenAdd={initialOpenAdd}
      initialReturnTo={initialReturnTo}
    />
  );
}
