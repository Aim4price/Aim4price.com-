import { NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import { getDealerAppSession } from '../../../../lib/dealer-app-session';
import { listAssetLeadsForUser } from '../../../../lib/partner-access';
import { isMiddlemanAccountSubtype } from '../../../../lib/middleman-account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveDealerUserId(): Promise<string | null> {
  const dealerAppSession = await getDealerAppSession();
  if (dealerAppSession?.dealerUserId) return dealerAppSession.dealerUserId;

  const session = await getServerSession();
  if (!session?.user?.id) return null;

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') return null;

  return session.user.id;
}

export async function GET() {
  const dealerUserId = await resolveDealerUserId();
  if (!dealerUserId) {
    return NextResponse.json({ ok: false, error: 'Dealer App login is required.' }, { status: 401 });
  }

  try {
    const profile = await getAccountProfile({ id: dealerUserId });
    if (isMiddlemanAccountSubtype(profile.accountSubtype)) {
      return NextResponse.json({ ok: false, error: 'Leads are available to paid dealer accounts.' }, { status: 403 });
    }
    const leads = await listAssetLeadsForUser(dealerUserId);
    return NextResponse.json({
      ok: true,
      dealerUserId,
      leads: leads.filter((lead) => lead.partnerUserId === dealerUserId),
    });
  } catch (error) {
    console.error('Dealer App leads GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load Dealer leads.' }, { status: 500 });
  }
}

