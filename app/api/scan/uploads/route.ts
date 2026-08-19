import { NextRequest, NextResponse } from 'next/server';
import { authorizeFieldManagerScanAccess, authorizeOwnerAppScanAccess, authorizePublicQrScanAccess } from '../../../../lib/scan-auth';
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
  const isOwnerAppHint = request.nextUrl.searchParams.get('ownerApp') === '1';
  const requestedAssetId = request.nextUrl.searchParams.get('assetId');
  const access = isOwnerAppHint
    ? await authorizeOwnerAppScanAccess(request, publicAssetCode, requestedAssetId)
    : isFieldManagerHint
    ? await authorizeFieldManagerScanAccess(
        request,
        publicAssetCode,
        requestedAssetId,
      )
    : await authorizePublicQrScanAccess(request, publicAssetCode);

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

  const uploads: Array<{
    uploadId: string;
    url: string;
    fileName: string;
    contentType: string;
    byteSize: number;
  }> = [];

  // A scan can contain twelve 5 MB images. Process only two at a time so a
  // verified Bucket PUT/read-back does not hold every file buffer and network
  // request in memory simultaneously on the Hobby service.
  for (let offset = 0; offset < preparedFiles.length; offset += 2) {
    const batch = await Promise.all(
      preparedFiles.slice(offset, offset + 2).map(async ({ file }) => {
        const saved = await createAssetRegisterUpload({ userId: access.ownerUserId, file, category: 'scan-photo' });

        return {
          uploadId: saved.id,
          url: saved.url,
          fileName: saved.fileName,
          contentType: saved.contentType,
          byteSize: saved.byteSize,
        };
      }),
    );
    uploads.push(...batch);
  }

  return NextResponse.json({ ok: true, uploads });
}
