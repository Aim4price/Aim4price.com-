import { NextResponse } from 'next/server';
import { insuranceApiError, requireInsuranceBrokerUserId } from '../../../../lib/insurance-route-auth';
import { deleteInsuranceShare } from '../../../../lib/insurance-workspaces';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_request: Request, { params }: { params: { shareId: string } }) {
  try {
    const brokerUserId = await requireInsuranceBrokerUserId();
    await deleteInsuranceShare({ brokerUserId, shareId: params.shareId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Insurance shared register delete failed.', error);
    const response = insuranceApiError(error);
    return NextResponse.json({ ok: false, error: response.message }, { status: response.status });
  }
}
