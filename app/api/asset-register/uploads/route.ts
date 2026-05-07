import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import {
  ALLOWED_ASSET_REGISTER_IMAGE_TYPES,
  MAX_ASSET_REGISTER_DOCUMENTS,
  MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES,
  MAX_ASSET_REGISTER_PHOTOS,
  MAX_ASSET_REGISTER_UPLOAD_BYTES,
  createAssetRegisterUpload,
  isAllowedAssetRegisterDocument,
} from '../../../../lib/asset-register-uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function isFile(value: FormDataEntryValue): value is File {
  return typeof value !== 'string';
}

function imageTypeLabel(): string {
  return 'JPG, PNG and WEBP';
}

function documentTypeLabel(): string {
  return 'PDF, Word, Excel, CSV, TXT, JPG, PNG and WEBP';
}

function normalizeUploadType(value: FormDataEntryValue | null): 'photo' | 'document' {
  return String(value ?? '').trim().toLowerCase() === 'document' ? 'document' : 'photo';
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const formData = await request.formData();
  const uploadType = normalizeUploadType(formData.get('uploadType'));
  const files = formData.getAll('files').filter(isFile);

  if (!files.length) {
    return NextResponse.json(
      { ok: false, error: uploadType === 'document' ? 'Select at least one document file.' : 'Select at least one image file.' },
      { status: 400 },
    );
  }

  const maxFiles = uploadType === 'document' ? MAX_ASSET_REGISTER_DOCUMENTS : MAX_ASSET_REGISTER_PHOTOS;

  if (files.length > maxFiles) {
    return NextResponse.json(
      {
        ok: false,
        error: `You can upload a maximum of ${maxFiles} ${uploadType === 'document' ? 'documents' : 'photos'} at a time.`,
      },
      { status: 400 },
    );
  }

  const uploads: Array<{
    uploadId: string;
    url: string;
    fileName: string;
    contentType: string;
    byteSize: number;
  }> = [];

  for (const file of files) {
    const contentType = String(file.type ?? '').trim().toLowerCase();

    if (uploadType === 'document') {
      if (!isAllowedAssetRegisterDocument(file)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Only ${documentTypeLabel()} files are allowed.`,
          },
          { status: 400 },
        );
      }
    } else if (!ALLOWED_ASSET_REGISTER_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Only ${imageTypeLabel()} files are allowed.`,
        },
        { status: 400 },
      );
    }

    if (!file.size) {
      return NextResponse.json({ ok: false, error: 'One of the files is empty.' }, { status: 400 });
    }

    const maxBytes = uploadType === 'document' ? MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES : MAX_ASSET_REGISTER_UPLOAD_BYTES;

    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          ok: false,
          error: `Each ${uploadType === 'document' ? 'document' : 'image'} must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller.`,
        },
        { status: 400 },
      );
    }

    const saved = await createAssetRegisterUpload({
      userId: session.user.id,
      file,
    });

    uploads.push({
      uploadId: saved.id,
      url: saved.url,
      fileName: saved.fileName,
      contentType: saved.contentType,
      byteSize: saved.byteSize,
    });
  }

  return NextResponse.json({ ok: true, uploads });
}
