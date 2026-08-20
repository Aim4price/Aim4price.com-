import { NextRequest, NextResponse } from 'next/server';
import { CAPTURE_REQUEST_STATUSES, listCaptureRequests } from '../../../../lib/capture-requests';
import { toCaptureRequestStatusView } from '../../../../lib/capture-request-view';
import { getDealerCostRequestContext } from '../../../../lib/dealer-cost-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPEN_STATUSES = CAPTURE_REQUEST_STATUSES.filter((status) => (
  !['completed', 'declined', 'rejected', 'cancelled'].includes(status)
));

export async function GET(request: NextRequest) {
  const context = await getDealerCostRequestContext();
  if (!context) return NextResponse.json({ ok: false, error: 'Dealer sign-in is required.' }, { status: 401 });

  try {
    const requests = await listCaptureRequests({
      submittedByUserId: context.actor.dealerUserId,
      submissionChannels: ['dealer_upload'],
      requestTypes: request.nextUrl.searchParams.get('requestType') === 'fuel_slip' ? ['fuel_slip'] : ['invoice'],
      statuses: request.nextUrl.searchParams.get('active') === '1' ? OPEN_STATUSES : undefined,
      limit: 100,
    });
    return NextResponse.json({ ok: true, requests: requests.map((request) => toCaptureRequestStatusView(request)) });
  } catch (error) {
    console.error('Dealer assisted capture status load failed.', error);
    return NextResponse.json({ ok: false, error: 'Capture status is temporarily unavailable.' }, { status: 500 });
  }
}
