import { NextRequest, NextResponse } from 'next/server';
import { authorizeScanAccess } from '../../../../lib/scan-auth';
import {
  ALLOWED_ASSET_REGISTER_IMAGE_TYPES,
  MAX_ASSET_REGISTER_PHOTOS,
  MAX_ASSET_REGISTER_UPLOAD_BYTES,
  createAssetRegisterUpload,
} from '../../../../lib/asset-register-uploads';
import { normalizePublicAssetCode } from '../../../../lib/scan-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PreparedUploadFile = {
  file: File;
  contentType: string;
};

function isFile(value: FormDataEntryValue): value is File {
  return typeof value !== 'string';
}

function typeLabel(): string {
  return 'JPG, PNG and WEBP';
}

function validateImageFile(file: File): PreparedUploadFile | { error: string; status: number } {
  const contentType = String(file.type ?? '').trim().toLowerCase();

  if (!ALLOWED_ASSET_REGISTER_IMAGE_TYPES.has(contentType)) {
    return { error: `Only ${typeLabel()} files are allowed.`, status: 400 };
  }

  if (!file.size) {
    return { error: 'One of the files is empty.', status: 400 };
  }

  if (file.size > MAX_ASSET_REGISTER_UPLOAD_BYTES) {
    return {
      error: `Each image must be ${Math.round(MAX_ASSET_REGISTER_UPLOAD_BYTES / (1024 * 1024))} MB or smaller.`,
      status: 400,
    };
  }

  return { file, contentType };
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const publicAssetCode = normalizePublicAssetCode(formData.get('publicAssetCode'));
  const isFieldManagerHint = request.nextUrl.searchParams.get('fieldManager') === '1';
  const fieldManagerAssetId = request.nextUrl.searchParams.get('assetId');
  const access = await authorizeScanAccess(request, publicAssetCode, {
    fieldManagerHint: isFieldManagerHint,
    fieldManagerAssetId,
  });

  if (!access.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: access.error,
        pinRequired: access.pinRequired,
      },
      { status: access.status },
    );
  }

  const files = formData.getAll('files').filter(isFile);

  if (!files.length) {
    return NextResponse.json({ ok: false, error: 'Select at least one image file.' }, { status: 400 });
  }

  if (files.length > MAX_ASSET_REGISTER_PHOTOS) {
    return NextResponse.json(
      { ok: false, error: `You can upload a maximum of ${MAX_ASSET_REGISTER_PHOTOS} photos at a time.` },
      { status: 400 },
    );
  }

  const preparedFiles: PreparedUploadFile[] = [];

  for (const file of files) {
    const validation = validateImageFile(file);

    if ('error' in validation) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: validation.status });
    }

    preparedFiles.push(validation);
  }

  const uploads = await Promise.all(
    preparedFiles.map(async ({ file }) => {
      const saved = await createAssetRegisterUpload({ userId: access.ownerUserId, file });

      return {
        uploadId: saved.id,
        url: saved.url,
        fileName: saved.fileName,
        contentType: saved.contentType,
        byteSize: saved.byteSize,
      };
    }),
  );

  return NextResponse.json({ ok: true, uploads });
}
