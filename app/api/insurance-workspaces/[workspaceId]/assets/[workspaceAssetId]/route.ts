import { NextRequest, NextResponse } from 'next/server';
import { insuranceApiError, requireInsuranceBrokerUserId } from '../../../../../../lib/insurance-route-auth';
import { saveInsuranceAssetReview } from '../../../../../../lib/insurance-workspaces';

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: { workspaceId: string; workspaceAssetId: string } },
) {
  try {
    const brokerUserId = await requireInsuranceBrokerUserId();
    const body = (await request.json()) as Record<string, unknown>;
    const review = body.review && typeof body.review === 'object' ? (body.review as Record<string, unknown>) : {};
    const workspace = await saveInsuranceAssetReview({
      brokerUserId,
      workspaceId: params.workspaceId,
      workspaceAssetId: params.workspaceAssetId,
      review,
      options: body.options,
    });
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    console.error('Insurance asset review save failed.', error);
    const response = insuranceApiError(error);
    return NextResponse.json({ ok: false, error: response.message }, { status: response.status });
  }
}
