import { notFound, redirect } from 'next/navigation';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import { getDealerAppSession } from '../../../../lib/dealer-app-session';
import { dealerRoleCan } from '../../../../lib/dealer-app-access';
import { getDealerTrackedAsset } from '../../../../lib/dealer-maintenance-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DealerTrackedAssetPage({ params }: { params: { accessId: string } }) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');
  const dealerAppSession = await getDealerAppSession();
  if (dealerAppSession && !dealerRoleCan(dealerAppSession.role, 'maintenance')) redirect('/dealer');
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') redirect('/dealer/login');
  const accessId = String(params.accessId ?? '').trim();
  if (!(await getDealerTrackedAsset(session.user.id, accessId))) notFound();
  redirect(`/dealer/maintenance?open=${encodeURIComponent(accessId)}`);
}
