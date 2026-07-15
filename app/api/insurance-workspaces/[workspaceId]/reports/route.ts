import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getServerSession } from '../../../../../lib/auth-session';
import { createInsuranceReportSnapshot } from '../../../../../lib/insurance-report';
import { insuranceApiError, requireInsuranceBrokerUserId } from '../../../../../lib/insurance-route-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: { workspaceId: string } }) {
  try {
    const brokerUserId = await requireInsuranceBrokerUserId();
    const session = await getServerSession({ requireActive: true });
    const profile = await getAccountProfile({ id: brokerUserId, name: session?.user?.name, email: session?.user?.email });
    const body = (await request.json()) as { type?: unknown };
    const type = body.type === 'detailed' ? 'detailed' : 'summary';
    const report = await createInsuranceReportSnapshot({
      brokerUserId,
      workspaceId: params.workspaceId,
      type,
      broker: {
        displayName: profile.displayName,
        businessName: profile.businessName,
        email: profile.marketplaceEmail || session?.user?.email || '',
        phone: profile.phone,
        logoUrl: profile.logoUrl,
      },
    });
    return NextResponse.json({ ok: true, report, url: `/api/insurance-reports/${report.id}` });
  } catch (error) {
    console.error('Insurance report generation failed.', error);
    const response = insuranceApiError(error);
    return NextResponse.json({ ok: false, error: response.message }, { status: response.status });
  }
}
