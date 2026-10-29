import { listAssetRegisterItems } from '../../../../lib/asset-register-db';
import { withRealisticSellingAssessments } from '../../../../lib/realistic-selling-assessments';
import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getDealerAppSession } from '../../../../lib/dealer-app-session';
import { dealerRoleCan } from '../../../../lib/dealer-app-access';
import { assetToAdvertSource } from '../../../../lib/advert-source';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });
  const [profile, dealer] = await Promise.all([
    getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email }),
    getDealerAppSession(),
  ]);
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active' || (dealer && (!dealerRoleCan(dealer.role, 'ad_studio') || !dealerRoleCan(dealer.role, 'inventory')))) {
    return NextResponse.json({ ok: false, error: 'Asset Register access is required to import an asset. You can still start manually.' }, { status: 403 });
  }
  try {
    const assets = await withRealisticSellingAssessments(await listAssetRegisterItems(session.user.id));
    return NextResponse.json({ ok: true, assets: assets.map(assetToAdvertSource) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Advert Studio assets failed', error);
    return NextResponse.json({ ok: false, error: 'Could not load assets. You can still start manually.' }, { status: 500 });
  }
}
