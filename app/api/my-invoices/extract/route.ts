import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { extractInvoiceFromUpload } from '../../../../lib/my-invoices-extraction';
import { getInvoiceDocumentUpload, updateInvoiceDocumentExtraction } from '../../../../lib/my-invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ExtractPayload = {
  documentId?: unknown;
  invoiceDocumentId?: unknown;
};

async function currentUserId() {
  const session = await getServerSession({ requireActive: true });
  return session?.user?.id ?? '';
}

function asDocumentId(payload: ExtractPayload): string {
  return String(payload.documentId ?? payload.invoiceDocumentId ?? '').trim();
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

  if (!documentId) {
    return NextResponse.json({ ok: false, error: 'Choose an uploaded invoice document first.' }, { status: 400 });
  }

  try {
    const upload = await getInvoiceDocumentUpload({ userId, documentId });

    if (!upload) {
      return NextResponse.json({ ok: false, error: 'The uploaded invoice document could not be found.' }, { status: 404 });
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
