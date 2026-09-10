import { NextRequest, NextResponse } from 'next/server';
import { getDealerCostRequestContext } from '../../../../../lib/dealer-cost-request';
import { getDealerCostAssetAccess } from '../../../../../lib/dealer-costs';
import { getCaptureRequestDetail, sendCaptureCustomerMessage } from '../../../../../lib/capture-requests';
import { toCaptureRequestStatusView } from '../../../../../lib/capture-request-view';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, context: { params: { requestId: string } }) {
  const access = await getDealerCostRequestContext();
  if (!access) return NextResponse.json({ ok: false, error: 'Dealer sign-in is required.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 1000) : '';
  if (!message) return NextResponse.json({ ok: false, error: 'Enter your reply.' }, { status: 400 });
  try {
    const capture = await getCaptureRequestDetail(context.params.requestId);
    if (!capture || capture.submissionChannel !== 'dealer_upload'
      || capture.submittedByUserId !== access.actor.dealerUserId
      || !capture.assetId || !await getDealerCostAssetAccess(access.actor.dealerUserId, capture.assetId)) {
      return NextResponse.json({ ok: false, error: 'This capture request was not found.' }, { status: 404 });
    }
    const saved = await sendCaptureCustomerMessage(capture.id, {
      actor: { actorType: 'dealer', userId: access.actor.dealerUserId, displayName: access.actor.displayName || 'Dealer' },
      action: 'reply', message, expectedVersion: body.version,
      expectedOwnerUserId: capture.ownerUserId, expectedAssetId: capture.assetId,
    });
    return NextResponse.json({ ok: true, request: toCaptureRequestStatusView(saved), message: 'Reply sent to Aim4price.' },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'This request has changed. Refresh the page and try again.' }, { status: 409 });
  }
}
