import { NextResponse } from 'next/server';
import { getDealerCostRequestContext } from '../../../../../lib/dealer-cost-request';
import { getDealerCostAssetAccess } from '../../../../../lib/dealer-costs';
import { extractInvoiceFromUpload } from '../../../../../lib/my-invoices-extraction';
import {
  getInvoiceDocumentUpload,
  updateInvoiceDocumentExtraction,
} from '../../../../../lib/my-invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ExtractPayload = {
  documentId?: unknown;
  invoiceDocumentId?: unknown;
  assetId?: unknown;
};

function asText(value: unknown): string {
  return String(value ?? '').trim();
}

export async function POST(request: Request) {
  const context = await getDealerCostRequestContext();
  if (!context) {
    return NextResponse.json({ ok: false, error: 'Dealer sign-in is required.' }, { status: 401 });
  }

  let payload: ExtractPayload;
  try {
    payload = (await request.json()) as ExtractPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid extraction request.' }, { status: 400 });
  }

  const documentId = asText(payload.documentId ?? payload.invoiceDocumentId);
  const assetId = asText(payload.assetId);
  if (!documentId || !assetId) {
    return NextResponse.json({ ok: false, error: 'Choose the shared asset and uploaded invoice/photo first.' }, { status: 400 });
  }

  const access = await getDealerCostAssetAccess(context.actor.dealerUserId, assetId);
  if (!access) {
    return NextResponse.json({ ok: false, error: 'This asset is not currently shared with your dealership.' }, { status: 404 });
  }

  try {
    const upload = await getInvoiceDocumentUpload({
      userId: access.owner_user_id,
      documentId,
      dealerUserId: context.actor.dealerUserId,
    });
    if (!upload || upload.document.assetId !== assetId) {
      return NextResponse.json({ ok: false, error: 'The uploaded invoice/photo could not be found for this shared asset.' }, { status: 404 });
    }

    const extraction = extractInvoiceFromUpload({
      data: upload.data,
      contentType: upload.contentType,
      fileName: upload.fileName,
    });
    const document = await updateInvoiceDocumentExtraction({
      userId: access.owner_user_id,
      documentId,
      rawText: extraction.rawText,
      status: extraction.quality === 'none' ? 'failed' : 'extracted',
      warnings: extraction.warnings,
      dealerUserId: context.actor.dealerUserId,
    });

    return NextResponse.json({ ok: true, extraction, document });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVOICE_DOCUMENT_UPLOAD_UNAVAILABLE') {
      return NextResponse.json(
        {
          ok: false,
          error: 'The uploaded invoice/photo is temporarily unavailable. Please try again shortly.',
        },
        {
          status: 503,
          headers: {
            'Cache-Control': 'private, no-store',
            'Retry-After': '60',
          },
        },
      );
    }

    console.error('Aim4price Dealer Costs extraction failed.', error);
    return NextResponse.json({
      ok: false,
      error: 'Aim4price could not read this invoice/photo automatically. Complete the cost details manually.',
    }, { status: 500 });
  }
}
