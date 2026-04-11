import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import {
  deleteUnreferencedAssetRegisterUploads,
  listInternalAssetRegisterUploadIds,
  MAX_ASSET_REGISTER_PHOTOS,
} from '../../../lib/asset-register-uploads';
import {
  createManualAssetRegisterItem,
  deleteAssetRegisterItem,
  getAssetRegisterItemById,
  listAssetRegisterItems,
  updateAssetRegisterItem,
  type AssetRegisterItemKind,
  type CreateManualAssetInput,
  type UpdateAssetRegisterItemInput,
} from '../../../lib/asset-register-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function normalizeKind(value: unknown): AssetRegisterItemKind {
  return value === 'tractor' || value === 'manual' || value === 'property' ? value : 'manual';
}

function normalizePhotos(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }

      seen.add(entry);
      return true;
    })
    .slice(0, MAX_ASSET_REGISTER_PHOTOS);
}

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const items = await listAssetRegisterItems(session.user.id);

  return NextResponse.json({
    ok: true,
    items,
    summary: {
      count: items.length,
      totalValue: items.reduce((sum, item) => sum + Number(item.value || 0), 0),
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const body = (await request.json()) as Partial<CreateManualAssetInput>;
  const title = String(body.title ?? '').trim();
  const value = Math.round(Number(body.value) || 0);

  if (!title || value <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'title and value are required.',
      },
      { status: 400 },
    );
  }

  const item = await createManualAssetRegisterItem(session.user.id, {
    kind: normalizeKind(body.kind),
    title,
    value,
    note: body.note ?? null,
    serialNumber: body.serialNumber ?? null,
    isFinanced: Boolean(body.isFinanced),
    financeNote: body.financeNote ?? null,
    photos: normalizePhotos(body.photos),
  });

  return NextResponse.json({ ok: true, item });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const body = (await request.json()) as Partial<UpdateAssetRegisterItemInput>;
  const assetId = Math.round(Number(body.assetId) || 0);
  const title = String(body.title ?? '').trim();
  const value = Math.round(Number(body.value) || 0);

  if (assetId <= 0) {
    return NextResponse.json({ ok: false, error: 'Valid asset id is required.' }, { status: 400 });
  }

  if (!title || value <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'title and value are required.',
      },
      { status: 400 },
    );
  }

  const existing = await getAssetRegisterItemById(session.user.id, assetId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }

  const nextPhotos = normalizePhotos(body.photos);
  const removedUploadIds = listInternalAssetRegisterUploadIds(
    existing.photos.filter((photo) => !nextPhotos.includes(photo)),
  );

  try {
    const item = await updateAssetRegisterItem(session.user.id, {
      assetId,
      kind: normalizeKind(body.kind),
      title,
      value,
      note: body.note ?? null,
      serialNumber: body.serialNumber ?? null,
      isFinanced: Boolean(body.isFinanced),
      financeNote: body.financeNote ?? null,
      photos: nextPhotos,
    });

    await deleteUnreferencedAssetRegisterUploads({
      userId: session.user.id,
      uploadIds: removedUploadIds,
      excludeAssetId: assetId,
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: false, error: 'Failed to update asset.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const assetId = Number(searchParams.get('id'));

  if (!Number.isFinite(assetId) || assetId <= 0) {
    return NextResponse.json({ ok: false, error: 'Valid asset id is required.' }, { status: 400 });
  }

  const existing = await getAssetRegisterItemById(session.user.id, assetId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }

  const uploadIds = listInternalAssetRegisterUploadIds(existing.photos);

  await deleteAssetRegisterItem(session.user.id, assetId);
  await deleteUnreferencedAssetRegisterUploads({
    userId: session.user.id,
    uploadIds,
    excludeAssetId: assetId,
  });

  return NextResponse.json({ ok: true });
}
