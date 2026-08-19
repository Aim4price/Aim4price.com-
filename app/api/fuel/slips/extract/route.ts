import { NextResponse } from 'next/server';
import {
  ALLOWED_ASSET_REGISTER_IMAGE_TYPES,
  MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES,
  createAssetRegisterUpload,
} from '../../../../../lib/asset-register-uploads';
import { extractFuelSlipFromUpload } from '../../../../../lib/fuel-slip-extraction';
import { resolveOwnerWorkspaceContext } from '../../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FUEL_SLIP_UPLOAD_MIME_TYPES = new Set<string>([
  'application/pdf',
  'text/plain',
  'image/jpg',
  ...ALLOWED_ASSET_REGISTER_IMAGE_TYPES,
]);

const FUEL_SLIP_UPLOAD_EXTENSIONS = new Set(['.pdf', '.txt', '.jpg', '.jpeg', '.png', '.webp']);

type FormFile = File & {
  size: number;
  type: string;
  name: string;
};

function isUploadFile(value: FormDataEntryValue | null): value is FormFile {
  return Boolean(value && typeof value !== 'string' && typeof value.arrayBuffer === 'function');
}

function pickUploadFile(formData: FormData): FormFile | null {
  const primary = formData.get('file');
  if (isUploadFile(primary)) return primary;

  for (const value of formData.values()) {
    if (isUploadFile(value)) return value;
  }

  return null;
}

function fuelSlipFileExtension(fileName: string): string {
  const normalized = String(fileName ?? '').trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf('.');
  return dotIndex >= 0 ? normalized.slice(dotIndex) : '';
}

function isAllowedFuelSlipUpload(file: FormFile): boolean {
  const contentType = String(file.type ?? '').trim().toLowerCase();
  return FUEL_SLIP_UPLOAD_MIME_TYPES.has(contentType) || FUEL_SLIP_UPLOAD_EXTENSIONS.has(fuelSlipFileExtension(file.name));
}

export async function POST(request: Request) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid fuel slip upload form data.' }, { status: 400 });
  }

  const file = pickUploadFile(formData);

  if (!file) {
    return NextResponse.json({ ok: false, error: 'Choose a fuel slip PDF or photo to upload.' }, { status: 400 });
  }

  if (!isAllowedFuelSlipUpload(file)) {
    return NextResponse.json({ ok: false, error: 'Upload a PDF, TXT, JPG, PNG or WEBP fuel slip.' }, { status: 400 });
  }

  if (file.size > MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: 'The fuel slip file is too large for this upload.' }, { status: 400 });
  }

  try {
    const upload = await createAssetRegisterUpload({ userId: resolved.context.ownerUserId, file, category: 'fuel-slip' });
    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractFuelSlipFromUpload({
      data: buffer,
      contentType: upload.contentType || file.type,
      fileName: upload.fileName || file.name,
    });

    return NextResponse.json({
      ok: true,
      upload: {
        uploadId: upload.id,
        documentFileUrl: upload.url,
        originalFilename: upload.fileName,
        contentType: upload.contentType,
        byteSize: upload.byteSize,
      },
      extraction,
    });
  } catch (error) {
    console.error('Aim4price fuel slip extraction failed.', error);
    return NextResponse.json(
      { ok: false, error: 'Aim4price could not save or read this fuel slip. Try another file or use manual capture.' },
      { status: 500 },
    );
  }
}
