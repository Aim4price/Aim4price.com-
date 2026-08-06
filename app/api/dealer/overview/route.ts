import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getDealerAppSession } from '../../../../lib/dealer-app-session';
import { listDealerOverview } from '../../../../lib/dealer-overview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Sign in to the Dealer App.' }, { status: 401 });
  }

  const dealerAppSession = await getDealerAppSession();
  const overview = await listDealerOverview({
    dealerUserId: session.user.id,
    currentStaffId: dealerAppSession?.staffId ?? null,
    role: dealerAppSession?.role ?? 'owner',
  });
  return NextResponse.json({ ok: true, overview });
}
