import { NextResponse } from 'next/server';
import { insuranceApiError, requireInsuranceBrokerUserId } from '../../../../../lib/insurance-route-auth';
import { getInsuranceWorkspace } from '../../../../../lib/insurance-workspaces';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { workspaceId: string } }) {
  try {
    const brokerUserId = await requireInsuranceBrokerUserId();
    const workspace = await getInsuranceWorkspace(brokerUserId, params.workspaceId);
    return NextResponse.json({ ok: true, assets: workspace.assets });
  } catch (error) {
    const response = insuranceApiError(error);
    return NextResponse.json({ ok: false, error: response.message }, { status: response.status });
  }
}
