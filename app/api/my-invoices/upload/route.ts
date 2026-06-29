import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import {
  ALLOWED_ASSET_REGISTER_IMAGE_TYPES,
  MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES,
  createAssetRegisterUpload,
} from '../../../../lib/asset-register-uploads';
import { createInvoiceDocumentRecord, type MyInvoiceSource } from '../../../../lib/my-invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INVOICE_UPLOAD_MIME_TYPES = new Set<string>([
  'application/pdf',
  ...ALLOWED_ASSET_REGISTER_IMAGE_TYPES,
]);

type FormFile = File & {
  size: number;
  type: string;
  name: string;
};

function isUploadFile(value: FormDataEntryValue | null): value is FormFile {
  return Boolean(value && typeof value !== 'string' && typeof value.arrayBuffer === 'function');
}

function normalizeSource(value: FormDataEntryValue | null): MyInvoiceSource {
  return String(value ?? '').toLowerCase() === 'automatic' ? 'automatic' : 'manual';
}

function pickUploadFile(formData: FormData): FormFile | null {
  const primary = formData.get('file');
  if (isUploadFile(primary)) return primary;

  for (const value of formData.values()) {
    if (isUploadFile(value)) return value;
  }

  return null;
}

async function currentUserId() {
  const session = await getServerSession({ requireActive: true });
  return session?.user?.id ?? '';
}

export async function POST(request: Request) {
  const userId = await currentUserId();

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to upload invoice/photo files.' }, { status: 401 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid upload form data.' }, { status: 400 });
  }

  const assetId = String(formData.get('assetId') ?? '').trim();
  const file = pickUploadFile(formData);

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Choose an asset before uploading an invoice/photo.' }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ ok: false, error: 'Choose a PDF or photo to upload.' }, { status: 400 });
  }

  if (!INVOICE_UPLOAD_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, error: 'Upload a PDF, JPG, PNG or WEBP invoice/photo file.' }, { status: 400 });
  }

  if (file.size > MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: 'The invoice/photo file is too large for this free MVP upload.' }, { status: 400 });
  }

  try {
    const upload = await createAssetRegisterUpload({ userId, file });
    const document = await createInvoiceDocumentRecord({
      userId,
      assetId,
      uploadId: upload.id,
      uploadUrl: upload.url,
      fileName: upload.fileName,
      contentType: upload.contentType,
      byteSize: upload.byteSize,
      source: normalizeSource(formData.get('source')),
    });

    return NextResponse.json({ ok: true, document });
  } catch (error) {
    console.error('Aim4price My Cost Ledger upload failed.', error);
    const message = error instanceof Error && error.message === 'ASSET_NOT_FOUND'
      ? 'The selected asset could not be found for this account.'
      : 'The invoice/photo upload could not be saved.';

    return NextResponse.json({ ok: false, error: message }, { status: message.includes('asset') ? 404 : 500 });
  }
}
