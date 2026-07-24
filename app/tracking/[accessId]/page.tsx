import { notFound, redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession } from '../../../lib/auth-session';
import { getDealerTrackedAsset } from '../../../lib/dealer-maintenance-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function TrackingDetailPage({ params }: { params: { accessId: string } }) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/login');
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') redirect('/account');
  const accessId = String(params.accessId ?? '').trim();
  if (!(await getDealerTrackedAsset(session.user.id, accessId))) notFound();
  redirect(`/tracking?open=${encodeURIComponent(accessId)}`);
}
