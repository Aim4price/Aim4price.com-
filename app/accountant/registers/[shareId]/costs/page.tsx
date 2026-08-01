import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getAccountantLedger } from '../../../../../lib/accountant-workspace';
import { requireActivePageAccess } from '../../../../../lib/account-access';
import MyInvoicesClient from '../../../../my-invoices/my-invoices-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AccountantSharedCostsPage({ params, searchParams }: { params: { shareId: string }; searchParams?: { registerId?: string } }) {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile(session.user);
  if (profile.accountType !== 'finance' || profile.accountSubtype !== 'accountant') redirect('/leads');

  try {
    await getAccountantLedger({ accountantUserId: session.user.id, shareId: params.shareId, kind: 'cost', registerId: searchParams?.registerId });
  } catch {
    redirect(`/accountant/registers/${encodeURIComponent(params.shareId)}`);
  }

  return <MyInvoicesClient accountantShareId={params.shareId} accountantRegisterId={searchParams?.registerId} />;
}
