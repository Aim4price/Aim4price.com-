import { redirect } from 'next/navigation';
import { requireActivePageAccess } from '../../lib/account-access';
import { getAccountProfile } from '../../lib/account-profile';
import { normalizeInternalReturnPath, readSingleSearchParam } from '../../lib/internal-return-path';
import MyInvoicesClient from './my-invoices-client';
import CostEntryChoices from './cost-entry-choices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MyInvoicesPageProps = {
  searchParams?: {
    view?: string | string[];
    invoiceId?: string | string[];
    budgetId?: string | string[];
    captureRequestId?: string | string[];
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

  const hasDirectTarget = initialAssetId || initialOpenAdd
    || readSingleSearchParam(searchParams?.invoiceId)
    || readSingleSearchParam(searchParams?.budgetId)
    || readSingleSearchParam(searchParams?.captureRequestId);
  if (readSingleSearchParam(searchParams?.view) !== 'costs' && !hasDirectTarget) {
    return <CostEntryChoices />;
  }

  return (
    <MyInvoicesClient
      initialAssetId={initialAssetId}
      initialOpenAdd={initialOpenAdd}
      initialReturnTo={initialReturnTo}
    />
  );
}
