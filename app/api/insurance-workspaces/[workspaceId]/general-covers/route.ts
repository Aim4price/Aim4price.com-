import { NextRequest, NextResponse } from 'next/server';
import { insuranceApiError, requireInsuranceBrokerUserId } from '../../../../../lib/insurance-route-auth';
import { saveInsuranceGeneralCovers } from '../../../../../lib/insurance-workspaces';

export const runtime = 'nodejs';

export async function PUT(request: NextRequest, { params }: { params: { workspaceId: string } }) {
  try {
    const brokerUserId = await requireInsuranceBrokerUserId();
    const body = (await request.json()) as { covers?: unknown };
    const workspace = await saveInsuranceGeneralCovers({ brokerUserId, workspaceId: params.workspaceId, covers: body.covers });
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    console.error('Insurance general-cover save failed.', error);
    const response = insuranceApiError(error);
    return NextResponse.json({ ok: false, error: response.message }, { status: response.status });
  }
}
