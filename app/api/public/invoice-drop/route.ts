import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  addCaptureRequestFile,
  createCaptureRequest,
  resolveInvoiceDropCode,
  resolveUniqueOwnerInvoiceDropAsset,
  resolveUniqueAssetSerialOrVin,
  transitionCaptureRequest,
  type CaptureEventActor,
  type CaptureSenderType,
} from '../../../../lib/capture-requests';
import {
  deleteCaptureQuarantineFile,
  storeCaptureQuarantineFile,
} from '../../../../lib/capture-quarantine-storage';
import {
  createPublicInvoiceRateLimitKey,
  isPlausiblePublicInvoiceFormTiming,
  isTrustedPublicInvoiceOrigin,
  readPublicInvoiceFormData,
  resolvePublicInvoiceClientAddress,
  validatePublicInvoiceFiles,
} from '../../../../lib/public-invoice-drop-security';
import { consumePublicInvoiceDropRateLimit } from '../../../../lib/public-invoice-drop-rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GENERIC_RECEIPT_MESSAGE =
  'Aim4price will verify and route the invoice within 24 hours. If more information is needed, we will contact you using the details supplied.';
const PUBLIC_ACTOR: CaptureEventActor = {
  actorType: 'public',
  displayName: 'Public invoice sender',
};
const INTAKE_RECOVERY_ACTOR: CaptureEventActor = {
  actorType: 'system',
  displayName: 'Invoice Drop intake recovery',
};
const SENDER_TYPES = new Set<CaptureSenderType>([
  'owner',
  'dealer',
  'workshop',
  'supplier',
  'accountant',
  'other',
]);

function noStoreHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  };
}

function accepted(reference: string): NextResponse {
  return NextResponse.json(
    { ok: true, reference, message: GENERIC_RECEIPT_MESSAGE },
    { status: 202, headers: noStoreHeaders() },
  );
}

function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: noStoreHeaders() },
  );
}

function generateDecoyReference(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = randomBytes(10);
  let suffix = '';
  for (let index = 0; index < bytes.length; index += 1) {
    suffix += alphabet[bytes[index] % alphabet.length];
  }
  return `A4P-INV-${suffix}`;
}

function readText(formData: FormData, key: string, maxLength: number): string {
  return String(formData.get(key) ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function readNote(formData: FormData, key: string, maxLength: number): string {
  return String(formData.get(key) ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function formFiles(formData: FormData): File[] {
  return formData.getAll('files').filter((value): value is File => (
    typeof value !== 'string'
    && typeof value.arrayBuffer === 'function'
    && typeof value.size === 'number'
  ));
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 160;
}

function isValidMobile(mobile: string): boolean {
  const digitCount = mobile.replace(/\D/g, '').length;
  return digitCount >= 7 && digitCount <= 18;
}

async function deleteStoredFiles(storageKeys: string[]): Promise<void> {
  await Promise.allSettled(storageKeys.map((storageKey) => deleteCaptureQuarantineFile(storageKey)));
}

export async function POST(request: NextRequest) {
  if (!isTrustedPublicInvoiceOrigin({
    originHeader: request.headers.get('origin'),
    secFetchSite: request.headers.get('sec-fetch-site'),
    requestOrigin: request.nextUrl.origin,
  })) {
    return errorResponse('This submission must be sent from Aim4price.', 403);
  }

  let rateKey: string;
  try {
    const clientAddress = resolvePublicInvoiceClientAddress({
      runtimeAddress: request.ip,
      forwardedFor: request.headers.get('x-forwarded-for'),
    });
    rateKey = createPublicInvoiceRateLimitKey({ ipAddress: clientAddress });
  } catch (error) {
    console.error('public invoice drop client identity failed', error);
    return errorResponse('Invoice Drop is temporarily unavailable. Please try again shortly.', 503);
  }
  let rateLimit;
  try {
    rateLimit = await consumePublicInvoiceDropRateLimit(rateKey);
  } catch (error) {
    console.error('public invoice drop rate limiter failed', error);
    return errorResponse('Invoice Drop is temporarily unavailable. Please try again shortly.', 503);
  }

  if (!rateLimit.allowed) {
    const response = errorResponse('Too many invoices were sent from this connection. Please try again later.', 429);
    response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
    return response;
  }

  let formData: FormData;
  try {
    formData = await readPublicInvoiceFormData(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'PUBLIC_INVOICE_REQUEST_TOO_LARGE') {
      return errorResponse('The selected invoice files are too large.', 413);
    }
    if (code === 'PUBLIC_INVOICE_CONTENT_TYPE_INVALID') {
      return errorResponse('The invoice form must be sent as multipart form data.', 415);
    }
    return errorResponse('The invoice form could not be read. Please try again.', 400);
  }

  // A filled honeypot or implausibly fast browser submission receives the same
  // generic receipt shape, without creating a record or disclosing filtering.
  if (
    readText(formData, 'website', 200)
    || !isPlausiblePublicInvoiceFormTiming(readText(formData, 'startedAt', 30))
  ) {
    return accepted(generateDecoyReference());
  }

  const lookupMode = readText(formData, 'lookupMode', 20);
  const invoiceDropCode = readText(formData, 'invoiceDropCode', 80).toUpperCase();
  const assetReference = readText(formData, 'assetReference', 120);
  const assetDescription = readText(formData, 'assetDescription', 160);
  const assetSearchQuery = readText(formData, 'assetSearchQuery', 160);
  const senderName = readText(formData, 'senderName', 120);
  const businessName = readText(formData, 'businessName', 160);
  const senderType = readText(formData, 'senderType', 30) as CaptureSenderType;
  const email = readText(formData, 'email', 160).toLowerCase();
  const mobile = readText(formData, 'mobile', 40);
  const jobReference = readText(formData, 'jobReference', 100);
  const note = readNote(formData, 'note', 600);
  const privacyAccepted = readText(formData, 'privacyAccepted', 10) === 'yes';

  if (lookupMode !== 'code' && lookupMode !== 'reference') {
    return errorResponse('Choose how the asset should be identified.', 400);
  }
  if (lookupMode === 'code' && invoiceDropCode.length < 6) {
    return errorResponse('Enter the Invoice Drop Code provided by the asset owner.', 400);
  }
  if (lookupMode === 'reference' && assetReference.length < 3) {
    return errorResponse('Enter the complete serial number or VIN.', 400);
  }
  if (lookupMode === 'reference' && assetDescription.length < 3) {
    return errorResponse('Enter the asset make and model.', 400);
  }
  if (!senderName) return errorResponse('Enter your name.', 400);
  if (!SENDER_TYPES.has(senderType)) return errorResponse('Choose who is sending the invoice.', 400);
  if (!isValidMobile(mobile)) return errorResponse('Enter a valid mobile number.', 400);
  if (!isValidEmail(email)) return errorResponse('Enter a valid email address.', 400);
  if (!privacyAccepted) return errorResponse('Confirm that the invoice may be sent to Aim4price.', 400);

  let files: Awaited<ReturnType<typeof validatePublicInvoiceFiles>>;
  try {
    files = await validatePublicInvoiceFiles(formFiles(formData));
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'The selected invoice could not be verified.',
      400,
    );
  }

  // Asset resolution is intentionally private. A missing or non-unique match
  // still creates a needs-matching request and receives the identical 202 response.
  let resolvedCode: Awaited<ReturnType<typeof resolveInvoiceDropCode>> = null;
  let resolvedAsset: Awaited<ReturnType<typeof resolveUniqueAssetSerialOrVin>> = null;
  try {
    resolvedCode = lookupMode === 'code'
      ? await resolveInvoiceDropCode(invoiceDropCode)
      : null;
    resolvedAsset = lookupMode === 'reference'
      ? await resolveUniqueAssetSerialOrVin(assetReference)
      : null;
    if (lookupMode === 'code' && resolvedCode?.scope === 'all') {
      if (assetSearchQuery.length < 3) {
        return errorResponse('Describe the asset before continuing.', 400);
      }
      const ownerSearch = await resolveUniqueOwnerInvoiceDropAsset(
        resolvedCode.ownerUserId,
        assetSearchQuery,
      );
      resolvedAsset = ownerSearch.match;
    }
  } catch (error) {
    console.error('public invoice drop asset resolution failed', error);
    return errorResponse('Invoice Drop is temporarily unavailable. Please try again shortly.', 503);
  }
  const storedFiles: Array<{
    storageKey: string;
    sha256: string;
    byteSize: number;
    originalFileName: string;
    contentType: (typeof files)[number]['contentType'];
    pageOrder: number;
  }> = [];
  let createdRequestId: string | null = null;

  try {
    for (const file of files) {
      const stored = await storeCaptureQuarantineFile({
        data: file.data,
        contentType: file.contentType,
      });
      storedFiles.push({
        ...stored,
        originalFileName: file.fileName,
        contentType: file.contentType,
        pageOrder: file.pageOrder,
      });
    }

    const captureRequest = await createCaptureRequest(
      {
        requestType: 'invoice',
        submissionChannel: 'public_drop',
        ownerUserId: resolvedCode?.ownerUserId ?? resolvedAsset?.ownerUserId ?? null,
        assetId: resolvedCode?.assetId ?? resolvedAsset?.assetId ?? null,
        invoiceDropCodeId: resolvedCode?.dropCodeId ?? null,
        sender: {
          type: senderType,
          name: senderName,
          businessName,
          email,
          phone: mobile,
        },
        assetReference: lookupMode === 'reference'
          ? assetReference
          : resolvedCode?.scope === 'all'
            ? assetSearchQuery
            : resolvedCode
              ? null
              : invoiceDropCode,
        requesterNote: note,
        candidatePayload: {
          lookupMode,
          jobReference,
          publicInvoiceDrop: true,
          submittedSerialOrVin: lookupMode === 'reference' ? assetReference : '',
          submittedAssetDescription: lookupMode === 'reference' ? assetDescription : '',
          submittedAssetSearch: lookupMode === 'code' ? assetSearchQuery : '',
          contributionCodeScope: resolvedCode?.scope ?? '',
          assetDisplayName: resolvedAsset?.assetDisplayName ?? assetDescription,
          ownerDisplayName: resolvedAsset?.ownerDisplayName ?? '',
          matchMethod: resolvedCode?.scope === 'asset'
            ? 'invoice_drop_code_asset'
            : resolvedCode?.scope === 'all' && resolvedAsset
              ? 'invoice_drop_code_owner_search'
              : resolvedCode?.scope === 'all'
                ? 'invoice_drop_code_owner_review'
                : resolvedAsset
                  ? 'exact_unique_serial_or_vin'
                  : 'admin_review_required',
        },
      },
      PUBLIC_ACTOR,
    );
    createdRequestId = captureRequest.id;

    for (const file of storedFiles) {
      await addCaptureRequestFile(
        captureRequest.id,
        {
          storageKey: file.storageKey,
          originalFileName: file.originalFileName,
          contentType: file.contentType,
          byteSize: file.byteSize,
          sha256: file.sha256,
          pageOrder: file.pageOrder,
        },
        PUBLIC_ACTOR,
      );
    }

    return accepted(captureRequest.publicReference);
  } catch (error) {
    let requestSafelyClosed = !createdRequestId;
    if (createdRequestId) {
      try {
        await transitionCaptureRequest(createdRequestId, 'rejected', {
          actor: INTAKE_RECOVERY_ACTOR,
          reason: 'Invoice Drop intake did not finish attaching its verified source file.',
        });
        requestSafelyClosed = true;
      } catch (recoveryError) {
        console.error('public invoice drop recovery failed', { createdRequestId, recoveryError });
      }
    }
    if (requestSafelyClosed) {
      await deleteStoredFiles(storedFiles.map((file) => file.storageKey));
    }
    console.error('public invoice drop intake failed', error);
    return errorResponse('Invoice Drop is temporarily unavailable. Please try again shortly.', 503);
  }
}
