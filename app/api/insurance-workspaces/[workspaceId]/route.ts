import { NextRequest, NextResponse } from 'next/server';
import { insuranceApiError, requireInsuranceBrokerUserId } from '../../../../lib/insurance-route-auth';
import { getInsuranceWorkspace, updateInsuranceWorkspace } from '../../../../lib/insurance-workspaces';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: { workspaceId: string } }) {
  try {
    const brokerUserId = await requireInsuranceBrokerUserId();
    return NextResponse.json({ ok: true, workspace: await getInsuranceWorkspace(brokerUserId, params.workspaceId) });
  } catch (error) {
    const response = insuranceApiError(error);
    return NextResponse.json({ ok: false, error: response.message }, { status: response.status });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { workspaceId: string } }) {
  try {
    const brokerUserId = await requireInsuranceBrokerUserId();
    const body = (await request.json()) as Record<string, unknown>;
    const workspace = await updateInsuranceWorkspace({ brokerUserId, workspaceId: params.workspaceId, changes: body });
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    console.error('Insurance workspace update failed.', error);
    const response = insuranceApiError(error);
    return NextResponse.json({ ok: false, error: response.message }, { status: response.status });
  }
}
