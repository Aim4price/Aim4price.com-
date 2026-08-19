import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, isDealerAppSession } from '../../../../lib/auth-session';
import {
  ALLOWED_ASSET_REGISTER_IMAGE_TYPES,
  MAX_ASSET_REGISTER_DOCUMENTS,
  MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES,
  MAX_ASSET_REGISTER_PHOTOS,
  MAX_ASSET_REGISTER_UPLOAD_BYTES,
  createAssetRegisterUpload,
  isAllowedAssetRegisterDocument,
} from '../../../../lib/asset-register-uploads';
import { getAssetRegisterForUser, updateAssetRegisterLogo } from '../../../../lib/asset-registers';
import { resolveOwnerWorkspaceContext } from '../../../../lib/owner-workspace-access';

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

type UploadType = 'photo' | 'document' | 'register-logo';

function normalizeUploadType(value: FormDataEntryValue | null): UploadType {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'document') return 'document';
  if (normalized === 'register-logo' || normalized === 'logo') return 'register-logo';
  return 'photo';
}

function uploadTypeNoun(uploadType: UploadType): string {
  if (uploadType === 'document') return 'document';
  if (uploadType === 'register-logo') return 'logo';
  return 'photo';
}

export async function POST(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });

  if (!session?.user?.id) return unauthorized();

  const hasAccountantShare = Boolean(request.nextUrl.searchParams.get('accountantShareId')?.trim());
  const workspace = hasAccountantShare ? await resolveOwnerWorkspaceContext(request) : null;
  if (workspace && !workspace.ok) return workspace.response;
  const ownerUserId = workspace?.ok ? workspace.context.ownerUserId : session.user.id;

  try {
    const formData = await request.formData();
    const uploadType = normalizeUploadType(formData.get('uploadType'));
    const files = formData.getAll('files').filter(isFile);
    const registerId = String(formData.get('registerId') ?? '').trim();

    // Dealer App staff need photo uploads only for the valuation-to-Marketplace
    // workflow. Account documents and register branding remain private.
    if (isDealerAppSession(session) && uploadType !== 'photo') {
      return NextResponse.json(
        { ok: false, error: 'Dealer App staff can only upload Marketplace photos.' },
        { status: 403 },
      );
    }

    if (uploadType === 'register-logo') {
      if (!registerId) {
        return NextResponse.json(
          { ok: false, error: 'Asset register id is required before uploading a logo.' },
          { status: 400 },
        );
      }

      const register = await getAssetRegisterForUser(ownerUserId, registerId);
      if (!register) {
        return NextResponse.json({ ok: false, error: 'Asset register not found.' }, { status: 404 });
      }
    }

    if (!files.length) {
      return NextResponse.json(
        {
          ok: false,
          error: uploadType === 'document'
            ? 'Select at least one document file.'
            : 'Select at least one image file.',
        },
        { status: 400 },
      );
    }

    const maxFiles = uploadType === 'document'
      ? MAX_ASSET_REGISTER_DOCUMENTS
      : uploadType === 'register-logo'
        ? 1
        : MAX_ASSET_REGISTER_PHOTOS;

    if (files.length > maxFiles) {
      const noun = uploadTypeNoun(uploadType);
      return NextResponse.json(
        {
          ok: false,
          error: `You can upload a maximum of ${maxFiles} ${maxFiles === 1 ? noun : `${noun}s`} at a time.`,
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
            { ok: false, error: `Only ${documentTypeLabel()} files are allowed.` },
            { status: 400 },
          );
        }
      } else if (!ALLOWED_ASSET_REGISTER_IMAGE_TYPES.has(contentType)) {
        return NextResponse.json(
          { ok: false, error: `Only ${imageTypeLabel()} files are allowed.` },
          { status: 400 },
        );
      }

      if (!file.size) {
        return NextResponse.json({ ok: false, error: 'One of the files is empty.' }, { status: 400 });
      }

      const maxBytes = uploadType === 'document'
        ? MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES
        : MAX_ASSET_REGISTER_UPLOAD_BYTES;

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
        userId: ownerUserId,
        file,
        category: uploadType,
      });

      uploads.push({
        uploadId: saved.id,
        url: saved.url,
        fileName: saved.fileName,
        contentType: saved.contentType,
        byteSize: saved.byteSize,
      });
    }

    if (uploadType === 'register-logo') {
      const register = await updateAssetRegisterLogo({
        userId: ownerUserId,
        registerId,
        logoUrls: uploads.map((upload) => upload.url),
        showLogosOnRegister: true,
      });

      return NextResponse.json({ ok: true, uploads, register });
    }

    return NextResponse.json({ ok: true, uploads });
  } catch (error) {
    console.error('asset register upload failed', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error && error.message ? error.message : 'Failed to upload file.',
      },
      { status: 500 },
    );
  }
}
