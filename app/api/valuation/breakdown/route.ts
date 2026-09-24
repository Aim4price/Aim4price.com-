import { NextRequest, NextResponse } from 'next/server';
import { getAnyServerSession } from '../../../../lib/auth-session';
import { canUseEstimateBreakdown } from '../../../../lib/estimate-breakdown-access';
import { verifyEstimateBreakdown } from '../../../../lib/estimate-breakdown-token';
import { renderEstimateBreakdownPdf } from '../../../../lib/estimate-breakdown-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getAnyServerSession();
  if (!session?.user?.id || !canUseEstimateBreakdown(session.user.email)) {
    return NextResponse.json({ error: 'Breakdown is not available for this account.' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const report = verifyEstimateBreakdown(body.token, session.user.id);
    if (!report) return NextResponse.json({ error: 'Run the estimate again to download its breakdown.' }, { status: 400 });
    const pdf = await renderEstimateBreakdownPdf(report);
    return new NextResponse(Buffer.from(pdf), { headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="Aim4price-estimate-breakdown.pdf"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return NextResponse.json({ error: 'Unable to prepare the breakdown. Please run the estimate again.' }, { status: 400 });
  }
}
