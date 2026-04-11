import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import {
  ALLOWED_ASSET_REGISTER_IMAGE_TYPES,
  MAX_ASSET_REGISTER_PHOTOS,
  MAX_ASSET_REGISTER_UPLOAD_BYTES,
  buildAssetRegisterUploadUrl,
  createAssetRegisterUpload,
} from '../../../../lib/asset-register-uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function isFile(value: FormDataEntryValue): value is File {
  return typeof value !== 'string';
}

function typeLabel(): string {
  return 'JPG, PNG and WEBP';
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const formData = await request.formData();
  const files = formData.getAll('files').filter(isFile);

  if (!files.length) {
    return NextResponse.json({ ok: false, error: 'Select at least one image file.' }, { status: 400 });
  }

  if (files.length > MAX_ASSET_REGISTER_PHOTOS) {
    return NextResponse.json(
      {
        ok: false,
        error: `You can upload a maximum of ${MAX_ASSET_REGISTER_PHOTOS} photos at a time.`,
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

    if (!ALLOWED_ASSET_REGISTER_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Only ${typeLabel()} files are allowed.`,
        },
        { status: 400 },
      );
    }

    if (!file.size) {
      return NextResponse.json({ ok: false, error: 'One of the files is empty.' }, { status: 400 });
    }

    if (file.size > MAX_ASSET_REGISTER_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: `Each image must be ${Math.round(MAX_ASSET_REGISTER_UPLOAD_BYTES / (1024 * 1024))} MB or smaller.`,
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
      url: buildAssetRegisterUploadUrl(saved.id),
      fileName: saved.fileName,
      contentType: saved.contentType,
      byteSize: saved.byteSize,
    });
  }

  return NextResponse.json({ ok: true, uploads });
}
