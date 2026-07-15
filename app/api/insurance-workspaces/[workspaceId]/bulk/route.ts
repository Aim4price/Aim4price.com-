import { NextRequest, NextResponse } from 'next/server';
import { insuranceApiError, requireInsuranceBrokerUserId } from '../../../../../lib/insurance-route-auth';
import { bulkUpdateInsuranceAssets } from '../../../../../lib/insurance-workspaces';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: { workspaceId: string } }) {
  try {
    const brokerUserId = await requireInsuranceBrokerUserId();
    const body = (await request.json()) as { assetIds?: unknown; changes?: unknown };
    const assetIds = Array.isArray(body.assetIds) ? body.assetIds.map(String) : [];
    const changes = body.changes && typeof body.changes === 'object' ? (body.changes as Record<string, unknown>) : {};
    const workspace = await bulkUpdateInsuranceAssets({ brokerUserId, workspaceId: params.workspaceId, assetIds, changes });
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    console.error('Insurance bulk update failed.', error);
    const response = insuranceApiError(error);
    return NextResponse.json({ ok: false, error: response.message }, { status: response.status });
  }
}
