import type { CaptureRequest } from './capture-requests';

export type CaptureRequestStatusView = {
  id: string;
  referenceCode: string;
  requestType: CaptureRequest['requestType'];
  status: CaptureRequest['status'];
  canRetract: boolean;
  canReply: boolean;
  version: number;
  informationNeeded: string;
  targetLabel: string;
  submittedAtIso: string;
  dueAtIso: string;
  outputRecordId: string | null;
};

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function toCaptureRequestStatusView(
  request: CaptureRequest,
  options: { canRetract?: boolean; canReply?: boolean } = {},
): CaptureRequestStatusView {
  const isTerminal = ['completed', 'declined', 'rejected', 'cancelled'].includes(request.status);
  return {
    id: request.id,
    referenceCode: request.publicReference,
    requestType: request.requestType,
    status: request.status,
    canRetract: Boolean(options.canRetract && !isTerminal),
    canReply: Boolean(options.canReply && request.status === 'needs_information'),
    version: request.version,
    informationNeeded: request.status === 'needs_information' ? request.needsInformationReason : '',
    targetLabel: asText(request.candidatePayload.targetLabel)
      || asText(request.assetReference)
      || (request.requestType === 'fuel_slip' ? 'Fuel slip' : 'Invoice'),
    submittedAtIso: request.submittedAtIso,
    dueAtIso: request.dueAtIso,
    outputRecordId: request.finalInvoiceId || request.finalFuelSlipId,
  };
}

