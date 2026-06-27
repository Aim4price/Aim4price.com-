import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { extractInvoiceFromUpload } from '../../../../lib/my-invoices-extraction';
import { getAssetRegisterItemById } from '../../../../lib/asset-register-db';
import { getInvoiceDocumentUpload, updateInvoiceDocumentExtraction } from '../../../../lib/my-invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ExtractPayload = {
  documentId?: unknown;
  invoiceDocumentId?: unknown;
  assetId?: unknown;
};

async function currentUserId() {
  const session = await getServerSession({ requireActive: true });
  return session?.user?.id ?? '';
}

function asText(value: unknown): string {
  return String(value ?? '').trim();
}

function asDocumentId(payload: ExtractPayload): string {
  return asText(payload.documentId ?? payload.invoiceDocumentId);
}

export async function POST(request: Request) {
  const userId = await currentUserId();

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to extract invoice data.' }, { status: 401 });
  }

  let payload: ExtractPayload;

  try {
    payload = (await request.json()) as ExtractPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid extraction request.' }, { status: 400 });
  }

  const documentId = asDocumentId(payload);
  const assetId = asText(payload.assetId);

  if (!documentId) {
    return NextResponse.json({ ok: false, error: 'Choose an uploaded invoice document first.' }, { status: 400 });
  }

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Choose the asset before extracting invoice data.' }, { status: 400 });
  }

  try {
    const asset = await getAssetRegisterItemById(userId, assetId);

    if (!asset) {
      return NextResponse.json({ ok: false, error: 'The selected asset could not be found for this account.' }, { status: 404 });
    }

    const upload = await getInvoiceDocumentUpload({ userId, documentId });

    if (!upload || upload.document.assetId !== assetId) {
      return NextResponse.json({ ok: false, error: 'The uploaded invoice document could not be found for this asset.' }, { status: 404 });
    }

    const extraction = extractInvoiceFromUpload({
      data: upload.data,
      contentType: upload.contentType,
      fileName: upload.fileName,
    });

    const status = extraction.quality === 'none' ? 'failed' : 'extracted';
    const document = await updateInvoiceDocumentExtraction({
      userId,
      documentId,
      rawText: extraction.rawText,
      status,
      warnings: extraction.warnings,
    });

    return NextResponse.json({ ok: true, extraction, document });
  } catch (error) {
    console.error('Aim4price My Invoices extraction failed.', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Aim4price could not read this invoice automatically. You can still complete the invoice manually.',
      },
      { status: 500 },
    );
  }
}
