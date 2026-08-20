import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getServerSession } from '../../../../../lib/auth-session';
import {
  approveCaptureRequestForOwner,
  declineCaptureRequestForOwner,
} from '../../../../../lib/capture-finalization';
import { getCaptureRequestDetail, type CaptureRequestDetail } from '../../../../../lib/capture-requests';
import {
  getOwnerAppAccess,
  ownerAppCan,
  ownerAppCanAccessAsset,
  type OwnerAppAccess,
} from '../../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { requestId?: string } };

function cleanText(value: unknown, maxLength = 2_000): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function payloadText(payload: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = cleanText(payload[key], 2_000);
    if (value) return value;
  }
  return '';
}

async function getOwnerActor(): Promise<{
  actorType: 'owner';
  userId: string;
  displayName: string;
  ownerAppAccess: OwnerAppAccess;
} | null> {
  const session = await getServerSession({ requireActive: true, allowOwnerApp: true });
  if (!session?.user?.id) return null;
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'owner' || profile.accountStatus !== 'active') return null;
  const ownerAppAccess = await getOwnerAppAccess();
  if (!ownerAppAccess || ownerAppAccess.ownerUserId !== session.user.id) return null;
  return {
    actorType: 'owner',
    userId: session.user.id,
    displayName: cleanText(ownerAppAccess.displayName || session.user.name, 180) || 'Asset owner',
    ownerAppAccess,
  };
}

function ownerAppCanReachCapture(request: CaptureRequestDetail, access: OwnerAppAccess): boolean {
  if (access.sessionKind !== 'owner-app-user') return true;
  if (access.assetScope !== 'selected') return true;
  return Boolean(request.assetId && ownerAppCanAccessAsset(access, request.assetId));
}

function ownerCanReview(request: CaptureRequestDetail, ownerUserId: string): boolean {
  if (request.ownerUserId !== ownerUserId) return false;
  if (request.submissionChannel !== 'dealer_upload' && request.submissionChannel !== 'public_drop') {
    return false;
  }
  if (request.status === 'awaiting_owner' || request.status === 'completed' || request.status === 'declined') {
    return true;
  }
  return request.status === 'in_progress'
    && request.events.some((event) => event.eventType === 'owner_approved');
}

function reviewFields(request: CaptureRequestDetail): Record<string, string> {
  const captured = request.capturedPayload;
  const candidate = request.candidatePayload;
  if (request.requestType === 'invoice') {
    return {
      supplierName: payloadText(captured, 'supplierName', 'supplier'),
      invoiceNumber: payloadText(captured, 'invoiceNumber', 'documentNumber'),
      documentDate: payloadText(captured, 'invoiceDate', 'documentDate'),
      subtotalExVat: payloadText(captured, 'subtotalExVat', 'subtotal'),
      vatAmount: payloadText(captured, 'vatAmount', 'vat'),
      totalIncVat: payloadText(captured, 'totalIncVat', 'totalAmount', 'total'),
      notes: payloadText(captured, 'notes', 'description'),
    };
  }
  return {
    supplierName: payloadText(captured, 'supplierName', 'supplier'),
    slipNumber: payloadText(captured, 'slipNumber', 'invoiceNumber', 'transactionNumber'),
    documentDate: payloadText(captured, 'documentDate', 'invoiceDate'),
    fuelType: payloadText(captured, 'fuelType'),
    litres: payloadText(captured, 'litres'),
    vatAmount: payloadText(captured, 'vatAmount', 'vat'),
    totalAmount: payloadText(captured, 'totalAmount', 'totalIncVat', 'total'),
    operatorName: payloadText(candidate, 'operatorName'),
    activityText: payloadText(candidate, 'activityText') || payloadText(captured, 'activity', 'activityText'),
    workAreaText: payloadText(candidate, 'workAreaText'),
  };
}

function responseDetail(request: CaptureRequestDetail) {
  return {
    id: request.id,
    publicReference: request.publicReference,
    requestType: request.requestType,
    submissionChannel: request.submissionChannel,
    status: request.status,
    target: {
      assetId: request.assetId,
      fuelStorageId: request.fuelStorageId,
      label: payloadText(request.capturedPayload, 'assetDisplayName', 'fuelStorageDisplayName')
        || payloadText(request.candidatePayload, 'targetLabel')
        || request.assetReference,
    },
    contributor: {
      type: request.sender.type,
      name: request.sender.businessName || request.sender.name,
    },
    verifiedFields: reviewFields(request),
    submittedAtIso: request.submittedAtIso,
    verifiedAtIso: request.updatedAtIso,
    files: request.files
      .filter((file) => file.securityStatus === 'clean')
      .map((file) => ({
        id: file.id,
        fileName: file.originalFileName,
        contentType: file.contentType,
        byteSize: file.byteSize,
        previewUrl: `/api/capture-requests/${encodeURIComponent(request.id)}/files/${encodeURIComponent(file.id)}`,
      })),
    output: request.status === 'completed'
      ? {
          type: request.requestType,
          id: request.finalInvoiceId ?? request.finalFuelSlipId,
          href: request.requestType === 'invoice' ? '/my-invoices' : '/fuel',
        }
      : null,
  };
}

function captureDecisionError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : '';
  if (code === 'CAPTURE_REQUEST_NOT_FOUND') {
    return NextResponse.json({ ok: false, error: 'This capture request was not found.' }, { status: 404 });
  }
  if (
    code.includes('DECISION')
    || code.includes('STATUS')
    || code.includes('ALREADY')
    || code.includes('CLAIMED')
  ) {
    return NextResponse.json({ ok: false, error: 'This document can no longer be decided in its current state.' }, { status: 409 });
  }
  if (code.startsWith('CAPTURE_')) {
    return NextResponse.json({ ok: false, error: 'The verified document could not be saved. Aim4price has been notified.' }, { status: 422 });
  }
  console.error('Owner capture decision failed.', error);
  return NextResponse.json({ ok: false, error: 'Failed to save this document decision.' }, { status: 500 });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const actor = await getOwnerActor();
  if (!actor) return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
  const requestId = cleanText(context.params.requestId, 80);
  try {
    const capture = requestId ? await getCaptureRequestDetail(requestId) : null;
    if (
      !capture
      || !ownerCanReview(capture, actor.userId)
      || !ownerAppCanReachCapture(capture, actor.ownerAppAccess)
    ) {
      return NextResponse.json({ ok: false, error: 'This capture request was not found.' }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, request: responseDetail(capture) },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    return captureDecisionError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const actor = await getOwnerActor();
  if (!actor) return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
  if (
    actor.ownerAppAccess.sessionKind === 'owner-app-user'
    && !ownerAppCan(actor.ownerAppAccess, 'manage_finance')
  ) {
    return NextResponse.json({ ok: false, error: 'Only an Owner / Admin login can decide ledger documents.' }, { status: 403 });
  }
  const requestId = cleanText(context.params.requestId, 80);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const decision = cleanText(body?.decision, 20).toLowerCase();
  if (decision !== 'approve' && decision !== 'decline') {
    return NextResponse.json({ ok: false, error: 'Choose whether to approve or decline this document.' }, { status: 400 });
  }

  try {
    const capture = requestId ? await getCaptureRequestDetail(requestId) : null;
    if (
      !capture
      || !ownerCanReview(capture, actor.userId)
      || !ownerAppCanReachCapture(capture, actor.ownerAppAccess)
    ) {
      return NextResponse.json({ ok: false, error: 'This capture request was not found.' }, { status: 404 });
    }

    if (decision === 'decline') {
      const declined = await declineCaptureRequestForOwner(
        requestId,
        actor,
        cleanText(body?.reason, 1_000),
      );
      const detail = await getCaptureRequestDetail(declined.id);
      return NextResponse.json({
        ok: true,
        status: 'declined',
        request: detail ? responseDetail(detail) : null,
        message: 'The document was declined and was not added to your ledger.',
      });
    }

    const finalized = await approveCaptureRequestForOwner(requestId, actor);
    const detail = await getCaptureRequestDetail(finalized.request.id);
    return NextResponse.json({
      ok: true,
      status: finalized.outcome,
      outputId: finalized.outputId ?? null,
      request: detail ? responseDetail(detail) : null,
      message: finalized.request.requestType === 'invoice'
        ? 'The verified invoice was added to your Cost Ledger.'
        : 'The verified fuel slip was added to your Fuel Ledger.',
    });
  } catch (error) {
    return captureDecisionError(error);
  }
}
