import { NextResponse } from 'next/server';
import { extractInvoiceFromUpload } from '../../../../lib/my-invoices-extraction';
import { getAssetRegisterItemById } from '../../../../lib/asset-register-db';
import { getInvoiceDocumentUpload, updateInvoiceDocumentExtraction } from '../../../../lib/my-invoices';
import { assertWorkspaceAssetAccess, resolveOwnerWorkspaceContext } from '../../../../lib/owner-workspace-access';

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

function asDocumentId(payload: ExtractPayload): string {
  return asText(payload.documentId ?? payload.invoiceDocumentId);
}

export async function POST(request: Request) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'cost' });
  if (!resolved.ok) return resolved.response;
  const { context } = resolved;

  let payload: ExtractPayload;

  try {
    payload = (await request.json()) as ExtractPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid extraction request.' }, { status: 400 });
  }

  const documentId = asDocumentId(payload);
  const assetId = asText(payload.assetId);

  if (!documentId) {
    return NextResponse.json({ ok: false, error: 'Choose an uploaded invoice/photo document first.' }, { status: 400 });
  }

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Choose the asset before extracting cost details.' }, { status: 400 });
  }

  try {
    await assertWorkspaceAssetAccess(context, assetId);
    const asset = await getAssetRegisterItemById(context.ownerUserId, assetId);

    if (!asset) {
      return NextResponse.json({ ok: false, error: 'The selected asset could not be found for this account.' }, { status: 404 });
    }

    const upload = await getInvoiceDocumentUpload({ userId: context.ownerUserId, documentId });

    if (!upload || upload.document.assetId !== assetId) {
      return NextResponse.json({ ok: false, error: 'The uploaded invoice/photo document could not be found for this asset.' }, { status: 404 });
    }

    const extraction = extractInvoiceFromUpload({
      data: upload.data,
      contentType: upload.contentType,
      fileName: upload.fileName,
    });

    const status = extraction.quality === 'none' ? 'failed' : 'extracted';
    const document = await updateInvoiceDocumentExtraction({
      userId: context.ownerUserId,
      documentId,
      rawText: extraction.rawText,
      status,
      warnings: extraction.warnings,
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

    console.error('Aim4price My Cost Ledger extraction failed.', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Aim4price could not read this invoice/photo automatically. You can still complete the cost details manually.',
      },
      { status: 500 },
    );
  }
}
