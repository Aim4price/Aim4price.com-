import { NextRequest, NextResponse } from 'next/server';
import { insuranceApiError, requireInsuranceBrokerUserId } from '../../../../lib/insurance-route-auth';
import { assertInsuranceUuid, parseInsuranceCommand } from '../../../../lib/insurance-validation';
import { executeInsuranceCommand, getInsuranceWorkspace } from '../../../../lib/insurance-workspaces';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: { workspaceId: string } }) {
  try {
    const brokerUserId = await requireInsuranceBrokerUserId();
    const workspaceId = assertInsuranceUuid(params.workspaceId, 'workspaceId');
    return NextResponse.json({ ok: true, workspace: await getInsuranceWorkspace(brokerUserId, workspaceId) });
  } catch (error) {
    const response = insuranceApiError(error);
    return NextResponse.json({ ok: false, error: response.message }, { status: response.status });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { workspaceId: string } }) {
  try {
    const brokerUserId = await requireInsuranceBrokerUserId();
    const workspaceId = assertInsuranceUuid(params.workspaceId, 'workspaceId');
    const command = parseInsuranceCommand(await request.json());
    const workspace = await executeInsuranceCommand({ brokerUserId, workspaceId, command });
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    console.error('Insurance Workspace command failed.', error);
    const response = insuranceApiError(error);
    return NextResponse.json({ ok: false, error: response.message }, { status: response.status });
  }
}
