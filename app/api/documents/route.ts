import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../lib/account-profile';
import {
  createAccountDocument,
  getAccountDocumentSummary,
  isAccountDocumentCategory,
  listAccountDocumentAssetOptions,
  listAccountDocuments,
  removeUnusedAccountDocumentUpload,
  type AccountDocumentInput,
} from '../../../lib/account-documents';
import {
  getAccountDocumentTypeCategory,
  isAccountDocumentType,
} from '../../../lib/account-document-taxonomy';
import {
  MAX_DOCUMENT_VAULT_UPLOAD_BYTES,
  createAssetRegisterUpload,
  isAllowedAssetRegisterDocument,
} from '../../../lib/asset-register-uploads';
import { getServerSession } from '../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

async function requireOwnerUser() {
  const session = await getServerSession();
  if (!session?.user?.id) return { ok: false as const, response: unauthorized() };

  const profile = await getAccountProfile(session.user);
  if (profile.accountType !== 'owner') {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: 'The Document Vault is only available to owner accounts.' },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, userId: session.user.id };
}

function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value) && typeof value !== 'string';
}

function parseAssetIds(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry ?? '').trim()).filter(Boolean) : [];
  } catch {
    throw new Error('DOCUMENT_ASSET_LIST_INVALID');
  }
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';

  if (message === 'DOCUMENT_ASSET_NOT_FOUND') {
    return NextResponse.json({ ok: false, error: 'One of the selected assets could not be found.' }, { status: 404 });
  }
  if (message === 'DOCUMENT_ASSET_LIST_INVALID') {
    return NextResponse.json({ ok: false, error: 'The linked asset selection is invalid.' }, { status: 400 });
  }
  if (message === 'DOCUMENT_EXPIRY_INVALID') {
    return NextResponse.json({ ok: false, error: 'Enter a valid expiry date.' }, { status: 400 });
  }
  if (message === 'DOCUMENT_CATEGORY_INVALID') {
    return NextResponse.json({ ok: false, error: 'Choose a valid document category.' }, { status: 400 });
  }
  if (message === 'DOCUMENT_TYPE_REQUIRED') {
    return NextResponse.json({ ok: false, error: 'Choose the document type before uploading.' }, { status: 400 });
  }
  if (message === 'DOCUMENT_TYPE_INVALID') {
    return NextResponse.json({ ok: false, error: 'Choose a valid document type.' }, { status: 400 });
  }
  if (message === 'DOCUMENT_DESCRIPTION_REQUIRED') {
    return NextResponse.json(
      { ok: false, error: 'Describe the document in Notes when choosing Other document.' },
      { status: 400 },
    );
  }
  if (message === 'DOCUMENT_INPUT_INVALID') {
    return NextResponse.json({ ok: false, error: 'The document details are incomplete.' }, { status: 400 });
  }

  return NextResponse.json(
    { ok: false, error: fallback },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  const owner = await requireOwnerUser();
  if (!owner.ok) return owner.response;

  try {
    const includeDeleted = request.nextUrl.searchParams.get('view') === 'recycle-bin';
    const assetId = String(request.nextUrl.searchParams.get('assetId') ?? '').trim().slice(0, 120);
    const [documents, summary, assets] = await Promise.all([
      listAccountDocuments(owner.userId, { includeDeleted, assetId }),
      getAccountDocumentSummary(owner.userId),
      listAccountDocumentAssetOptions(owner.userId),
    ]);
    const selectedAsset = assetId ? assets.find((asset) => asset.id === assetId) ?? null : null;

    return NextResponse.json({ ok: true, documents, summary, assets, selectedAsset });
  } catch (error) {
    console.error('Aim4price Document Vault GET failed.', error);
    return errorResponse(error, 'The Document Vault could not be loaded.');
  }
}

export async function POST(request: NextRequest) {
  const owner = await requireOwnerUser();
  if (!owner.ok) return owner.response;

  let savedUploadId = '';

  try {
    const formData = await request.formData();
    const fileEntry = formData.get('file');
    if (!isFile(fileEntry)) {
      return NextResponse.json({ ok: false, error: 'Select a document to upload.' }, { status: 400 });
    }
    if (!fileEntry.size) {
      return NextResponse.json({ ok: false, error: 'The selected document is empty.' }, { status: 400 });
    }
    if (!isAllowedAssetRegisterDocument(fileEntry)) {
      return NextResponse.json(
        { ok: false, error: 'Upload a PDF, Word, Excel, CSV, TXT, JPG, PNG or WEBP file.' },
        { status: 400 },
      );
    }
    if (fileEntry.size > MAX_DOCUMENT_VAULT_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: `Documents must be ${Math.round(MAX_DOCUMENT_VAULT_UPLOAD_BYTES / (1024 * 1024))} MB or smaller.`,
        },
        { status: 400 },
      );
    }
    const assetIds = parseAssetIds(formData.get('assetIds'));
    const documentTypeEntry = formData.get('documentType');
    const hasDocumentType = typeof documentTypeEntry === 'string' && Boolean(documentTypeEntry.trim());
    if (assetIds.length && !hasDocumentType) {
      return NextResponse.json({ ok: false, error: 'Choose the document type before uploading.' }, { status: 400 });
    }
    if (hasDocumentType && !isAccountDocumentType(documentTypeEntry)) {
      return NextResponse.json({ ok: false, error: 'Choose a valid document type.' }, { status: 400 });
    }
    const notesEntry = formData.get('notes');
    if (documentTypeEntry === 'other' && (typeof notesEntry !== 'string' || !notesEntry.trim())) {
      return NextResponse.json(
        { ok: false, error: 'Describe the document in Notes when choosing Other document.' },
        { status: 400 },
      );
    }

    const categoryEntry = getAccountDocumentTypeCategory(documentTypeEntry) ?? formData.get('category');
    if (!isAccountDocumentCategory(categoryEntry)) {
      return NextResponse.json({ ok: false, error: 'Choose a valid document category.' }, { status: 400 });
    }

    const input: AccountDocumentInput = {
      title: formData.get('title'),
      category: categoryEntry,
      documentType: documentTypeEntry,
      notes: notesEntry,
      expiryDate: formData.get('expiryDate'),
      assetIds,
    };
    const upload = await createAssetRegisterUpload({
      userId: owner.userId,
      file: fileEntry,
      category: 'account-document',
    });
    savedUploadId = upload.id;
    const document = await createAccountDocument(owner.userId, {
      ...input,
      uploadId: upload.id,
      fileName: upload.fileName,
      contentType: upload.contentType,
      byteSize: upload.byteSize,
    });
    savedUploadId = '';
    const summary = await getAccountDocumentSummary(owner.userId).catch((summaryError) => {
      console.error('Aim4price Document Vault summary refresh failed after upload.', summaryError);
      return undefined;
    });

    return NextResponse.json({ ok: true, document, summary }, { status: 201 });
  } catch (error) {
    if (savedUploadId) {
      try {
        await removeUnusedAccountDocumentUpload(owner.userId, savedUploadId);
      } catch (cleanupError) {
        console.error('Aim4price Document Vault orphan upload cleanup failed.', cleanupError);
      }
    }

    console.error('Aim4price Document Vault POST failed.', error);
    return errorResponse(error, 'The document could not be saved.');
  }
}
