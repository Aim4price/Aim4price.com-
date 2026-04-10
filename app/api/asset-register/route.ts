import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import {
  createManualAssetRegisterItem,
  deleteAssetRegisterItem,
  listAssetRegisterItems,
  type AssetRegisterItemKind,
  type CreateManualAssetInput,
} from '../../../lib/asset-register-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function normalizeKind(value: unknown): AssetRegisterItemKind {
  return value === 'tractor' || value === 'manual' || value === 'property' ? value : 'manual';
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
    photos: Array.isArray(body.photos) ? body.photos : [],
  });

  return NextResponse.json({ ok: true, item });
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

  await deleteAssetRegisterItem(session.user.id, assetId);

  return NextResponse.json({ ok: true });
}
