import { NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import { listDealerTrackedAssets } from '../../../../lib/dealer-maintenance-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Dealer App login is required.' }, { status: 401 });
  }

  try {
    const [profile, assets] = await Promise.all([
      getAccountProfile({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      }),
      listDealerTrackedAssets(session.user.id),
    ]);

    if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
      return NextResponse.json({ ok: false, error: 'Dealer App access is not available.' }, { status: 403 });
    }

    return NextResponse.json({ ok: true, assets });
  } catch (error) {
    console.error('Dealer maintenance tracker GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load the Maintenance Tracker.' }, { status: 500 });
  }
}
