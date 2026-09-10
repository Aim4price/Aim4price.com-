import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import { retractCaptureRequestForOwner } from '../../../../lib/capture-finalization';
import { toCaptureRequestStatusView } from '../../../../lib/capture-request-view';
import {
  getCaptureRequestDetail,
  sendCaptureCustomerMessage,
  type CaptureEventActor,
} from '../../../../lib/capture-requests';
import {
  getOwnerAppAccess,
  ownerAppCan,
  ownerAppCanAccessAsset,
  type OwnerAppAccess,
} from '../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { requestId?: string } };

function cleanText(value: unknown, maxLength = 2_000): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function responseHeaders(): Record<string, string> {
  return { 'Cache-Control': 'private, no-store, max-age=0' };
}

async function getOwnerActor(): Promise<{
  actor: CaptureEventActor & { actorType: 'owner'; userId: string };
  access: OwnerAppAccess;
} | null> {
  const session = await getServerSession({ requireActive: true, allowOwnerApp: true });
  if (!session?.user?.id) return null;
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'owner' || profile.accountStatus !== 'active') return null;
  const access = await getOwnerAppAccess();
  if (!access || access.ownerUserId !== session.user.id) return null;
  return {
    actor: {
      actorType: 'owner',
      userId: session.user.id,
      displayName: cleanText(access.displayName || session.user.name, 180) || 'Asset owner',
    },
    access,
  };
}

function ownerCanReachCapture(
  capture: NonNullable<Awaited<ReturnType<typeof getCaptureRequestDetail>>>,
  access: OwnerAppAccess,
): boolean {
  if (capture.ownerUserId !== access.ownerUserId || capture.submissionChannel !== 'owner_upload') {
    return false;
  }
  if (access.sessionKind !== 'owner-app-user' || access.assetScope !== 'selected') return true;
  return Boolean(capture.assetId && ownerAppCanAccessAsset(access, capture.assetId));
}

function cancellationError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : '';
  if (code === 'CAPTURE_REQUEST_NOT_FOUND' || code === 'CAPTURE_OWNER_SCOPE_FORBIDDEN') {
    return NextResponse.json(
      { ok: false, error: 'This capture request was not found.' },
      { status: 404, headers: responseHeaders() },
    );
  }
  if (
    code === 'CAPTURE_TRANSITION_INVALID'
    || code === 'CAPTURE_REQUEST_CLOSED'
    || code === 'CAPTURE_RETRACTION_INVALID'
    || code === 'CAPTURE_RETRACTION_OUTPUT_EXISTS'
    || code === 'CAPTURE_RETRACTION_DOCUMENT_EXISTS'
  ) {
    return NextResponse.json(
      { ok: false, error: 'This submission can no longer be retracted because its processing has finished.' },
      { status: 409, headers: responseHeaders() },
    );
  }
  if (code.startsWith('CAPTURE_')) {
    return NextResponse.json(
      { ok: false, error: 'This submission could not be retracted.' },
      { status: 422, headers: responseHeaders() },
    );
  }
  console.error('Owner capture retraction failed.', error);
  return NextResponse.json(
    { ok: false, error: 'Failed to retract this submission.' },
    { status: 500, headers: responseHeaders() },
  );
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const resolved = await getOwnerActor();
  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: 'Owner sign-in is required.' },
      { status: 401, headers: responseHeaders() },
    );
  }
  if (!ownerAppCan(resolved.access, 'manage_finance')) {
    return NextResponse.json(
      { ok: false, error: 'Only an Owner / Admin login can retract ledger documents.' },
      { status: 403, headers: responseHeaders() },
    );
  }

  const requestId = cleanText(context.params.requestId, 80);
  try {
    const capture = requestId ? await getCaptureRequestDetail(requestId) : null;
    if (!capture || !ownerCanReachCapture(capture, resolved.access)) {
      return NextResponse.json(
        { ok: false, error: 'This capture request was not found.' },
        { status: 404, headers: responseHeaders() },
      );
    }
    const cancelled = await retractCaptureRequestForOwner(capture.id, resolved.actor);
    return NextResponse.json({
      ok: true,
      status: 'cancelled',
      request: toCaptureRequestStatusView(cancelled),
      message: capture.status === 'cancelled'
        ? 'This submission has already been retracted.'
        : 'Submission retracted. It was removed from active capture work.',
    }, { headers: responseHeaders() });
  } catch (error) {
    return cancellationError(error);
  }
}


export async function PATCH(request: NextRequest, context: RouteContext) {
  const resolved = await getOwnerActor();
  if (!resolved) return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
  if (!ownerAppCan(resolved.access, 'manage_finance')) {
    return NextResponse.json({ ok: false, error: 'Only an Owner / Admin login can reply.' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!cleanText(body?.message, 1000)) return NextResponse.json({ ok: false, error: 'Enter your reply.' }, { status: 400 });
  try {
    const capture = await getCaptureRequestDetail(cleanText(context.params.requestId, 80));
    if (!capture || capture.ownerUserId !== resolved.access.ownerUserId
      || (resolved.access.sessionKind === 'owner-app-user' && resolved.access.assetScope === 'selected'
        && (!capture.assetId || !ownerAppCanAccessAsset(resolved.access, capture.assetId)))) {
      return NextResponse.json({ ok: false, error: 'This capture request was not found.' }, { status: 404 });
    }
    const saved = await sendCaptureCustomerMessage(capture.id, {
      actor: resolved.actor, action: 'reply', message: cleanText(body.message, 1000),
      expectedVersion: body.version, expectedOwnerUserId: capture.ownerUserId, expectedAssetId: capture.assetId,
    });
    return NextResponse.json({ ok: true, request: toCaptureRequestStatusView(saved, { canRetract: capture.submissionChannel === 'owner_upload' }), message: 'Reply sent to Aim4price.' }, { headers: responseHeaders() });
  } catch {
    return NextResponse.json({ ok: false, error: 'This request has changed. Refresh the page and try again.' }, { status: 409 });
  }
}
