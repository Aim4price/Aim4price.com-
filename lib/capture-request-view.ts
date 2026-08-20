import type { CaptureRequest } from './capture-requests';

export type CaptureRequestStatusView = {
  id: string;
  referenceCode: string;
  requestType: CaptureRequest['requestType'];
  status: CaptureRequest['status'];
  targetLabel: string;
  submittedAtIso: string;
  dueAtIso: string;
  outputRecordId: string | null;
};

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function toCaptureRequestStatusView(request: CaptureRequest): CaptureRequestStatusView {
  return {
    id: request.id,
    referenceCode: request.publicReference,
    requestType: request.requestType,
    status: request.status,
    targetLabel: asText(request.candidatePayload.targetLabel)
      || asText(request.assetReference)
      || (request.requestType === 'fuel_slip' ? 'Fuel slip' : 'Invoice'),
    submittedAtIso: request.submittedAtIso,
    dueAtIso: request.dueAtIso,
    outputRecordId: request.finalInvoiceId || request.finalFuelSlipId,
  };
}
