import { NextRequest, NextResponse } from 'next/server';
import {
  CAPTURE_REQUEST_STATUSES,
  listCaptureRequests,
  type CaptureRequestType,
} from '../../../lib/capture-requests';
import { toCaptureRequestStatusView } from '../../../lib/capture-request-view';
import { getOwnerAppAccess, ownerAppCan, ownerAppCanAccessAsset } from '../../../lib/owner-app-access';
import {
  getWorkspaceAssetIds,
  resolveOwnerWorkspaceContext,
} from '../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPEN_STATUSES = CAPTURE_REQUEST_STATUSES.filter((status) => (
  !['completed', 'declined', 'rejected', 'cancelled'].includes(status)
));

function requestType(value: string | null): CaptureRequestType | undefined {
  return value === 'invoice' || value === 'fuel_slip' ? value : undefined;
}

export async function GET(request: NextRequest) {
  const requestedType = requestType(request.nextUrl.searchParams.get('requestType'));
  const activeOnly = request.nextUrl.searchParams.get('active') === '1';
  const resolved = await resolveOwnerWorkspaceContext(request, {
    ledger: requestedType === 'invoice'
      ? 'cost'
      : requestedType === 'fuel_slip'
        ? 'fuel'
        : undefined,
  });
  if (!resolved.ok) return resolved.response;
  const ownerAppAccess = resolved.context.accountantAccess ? null : await getOwnerAppAccess();
  if (!resolved.context.accountantAccess && !ownerAppAccess) {
    return NextResponse.json({ ok: false, error: 'Owner or shared accountant access is required.' }, { status: 403 });
  }

  try {
    const [requests, allowedAssetIds] = await Promise.all([
      listCaptureRequests({
        ownerUserId: resolved.context.ownerUserId,
        requestTypes: requestedType ? [requestedType] : undefined,
        statuses: activeOnly ? OPEN_STATUSES : undefined,
        limit: 100,
      }),
      getWorkspaceAssetIds(resolved.context),
    ]);
    const visibleRequests = requests.filter((capture) => {
      if (resolved.context.accountantAccess) {
        const ledgerShared = capture.requestType === 'invoice'
          ? resolved.context.accountantAccess.includeCostLedger
          : resolved.context.accountantAccess.includeFuelLedger;
        if (!ledgerShared) return false;
      }
      if (allowedAssetIds && capture.assetId && !allowedAssetIds.has(capture.assetId)) return false;
      if (ownerAppAccess?.sessionKind === 'owner-app-user' && ownerAppAccess.assetScope === 'selected') {
        return Boolean(capture.assetId && ownerAppCanAccessAsset(ownerAppAccess, capture.assetId));
      }
      return true;
    });

    return NextResponse.json({
      ok: true,
      requests: visibleRequests.map((capture) => toCaptureRequestStatusView(capture, {
        canRetract: Boolean(
          ownerAppAccess
          && ownerAppCan(ownerAppAccess, 'manage_finance')
          && capture.submissionChannel === 'owner_upload'
          && capture.ownerUserId === ownerAppAccess.ownerUserId
        ),
      })),
    });
  } catch (error) {
    console.error('Aim4price capture status load failed.', error);
    return NextResponse.json({ ok: false, error: 'Capture status is temporarily unavailable.' }, { status: 500 });
  }
}
