import { NextResponse } from 'next/server';
import { buildInsuranceReportHtml, getInsuranceReportSnapshot, safeReportFilename } from '../../../../lib/insurance-report';
import { insuranceApiError, requireInsuranceBrokerUserId } from '../../../../lib/insurance-route-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { reportId: string } }) {
  try {
    const brokerUserId = await requireInsuranceBrokerUserId();
    const report = await getInsuranceReportSnapshot(brokerUserId, params.reportId);
    return new NextResponse(buildInsuranceReportHtml(report.payload), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${safeReportFilename(report.filename)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const response = insuranceApiError(error);
    return NextResponse.json({ ok: false, error: response.message }, { status: response.status });
  }
}
