import { NextResponse } from 'next/server';
import {
  ALLOWED_ASSET_REGISTER_IMAGE_TYPES,
  MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES,
  createAssetRegisterUpload,
} from '../../../../../lib/asset-register-uploads';
import { getDealerCostRequestContext } from '../../../../../lib/dealer-cost-request';
import { getDealerCostAssetAccess } from '../../../../../lib/dealer-costs';
import {
  createInvoiceDocumentRecord,
  type MyInvoiceSource,
} from '../../../../../lib/my-invoices';

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

export async function POST(request: Request) {
  const context = await getDealerCostRequestContext();
  if (!context) {
    return NextResponse.json({ ok: false, error: 'Dealer sign-in is required.' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid upload form data.' }, { status: 400 });
  }

  const assetId = String(formData.get('assetId') ?? '').trim();
  const file = pickUploadFile(formData);
  const access = assetId
    ? await getDealerCostAssetAccess(context.actor.dealerUserId, assetId)
    : null;

  if (!access) {
    return NextResponse.json({ ok: false, error: 'This asset is not currently shared with your dealership.' }, { status: 404 });
  }
  if (!file) {
    return NextResponse.json({ ok: false, error: 'Choose a PDF or photo to upload.' }, { status: 400 });
  }
  if (!INVOICE_UPLOAD_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, error: 'Upload a PDF, JPG, PNG or WEBP invoice/photo file.' }, { status: 400 });
  }
  if (file.size > MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: 'The invoice/photo file is too large for this upload.' }, { status: 400 });
  }

  try {
    const upload = await createAssetRegisterUpload({ userId: access.owner_user_id, file, category: 'dealer-cost' });
    const document = await createInvoiceDocumentRecord({
      userId: access.owner_user_id,
      assetId,
      uploadId: upload.id,
      uploadUrl: upload.url,
      fileName: upload.fileName,
      contentType: upload.contentType,
      byteSize: upload.byteSize,
      source: normalizeSource(formData.get('source')),
      actor: {
        dealerUserId: context.actor.dealerUserId,
        dealerStaffId: context.actor.dealerStaffId,
        displayName: context.actor.displayName,
      },
    });
    return NextResponse.json({ ok: true, document });
  } catch (error) {
    console.error('Aim4price Dealer Costs upload failed.', error);
    return NextResponse.json({ ok: false, error: 'The invoice/photo upload could not be saved.' }, { status: 500 });
  }
}
