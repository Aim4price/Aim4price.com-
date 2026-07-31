import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getAccountantLedger } from '../../../../../lib/accountant-workspace';
import { requireActivePageAccess } from '../../../../../lib/account-access';
import FuelClient from '../../../../fuel/fuel-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AccountantSharedFuelPage({ params }: { params: { shareId: string } }) {
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile(session.user);
  if (profile.accountType !== 'finance' || profile.accountSubtype !== 'accountant') redirect('/leads');

  try {
    await getAccountantLedger({ accountantUserId: session.user.id, shareId: params.shareId, kind: 'fuel' });
  } catch {
    redirect(`/accountant/registers/${encodeURIComponent(params.shareId)}`);
  }

  return <FuelClient addedByLabel={profile.businessName || profile.displayName || 'Accountant'} accountantShareId={params.shareId} />;
}
