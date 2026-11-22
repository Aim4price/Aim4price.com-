import { businessToolProfile } from '../../../../lib/business-tool-profile';
import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { listDealerTrackedAssets } from '../../../../lib/dealer-maintenance-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession({allowBusinessWorkspace:true,  allowDealerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Dealer App login is required.' }, { status: 401 });
  }

  const profile = await businessToolProfile(session);
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    return NextResponse.json({ ok: false, error: 'Dealer App access is not available.' }, { status: 403 });
  }

  try {
    const assets = await listDealerTrackedAssets(session.user.id);
    return NextResponse.json({ ok: true, assets });
  } catch (error) {
    console.error('Dealer maintenance tracker GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load the Maintenance Tracker.' }, { status: 500 });
  }
}
