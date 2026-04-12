import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import {
  listPublishedMarketplaceAssetListings,
  publishAssetRegisterItemToMarketplace,
  removeAssetRegisterItemFromMarketplace,
} from '../../../lib/marketplace-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ErrorLike = {
  message?: unknown;
  detail?: unknown;
  hint?: unknown;
  code?: unknown;
  table?: unknown;
  column?: unknown;
  constraint?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function formatUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    const details = error as ErrorLike;
    return [
      error.message,
      typeof details.detail === 'string' ? details.detail : '',
      typeof details.hint === 'string' ? `hint: ${details.hint}` : '',
      typeof details.column === 'string' ? `column: ${details.column}` : '',
      typeof details.table === 'string' ? `table: ${details.table}` : '',
      typeof details.constraint === 'string' ? `constraint: ${details.constraint}` : '',
      typeof details.code === 'string' ? `code: ${details.code}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
  }

  if (typeof error === 'object' && error !== null) {
    const details = error as ErrorLike;
    const parts = [
      typeof details.message === 'string' ? details.message : '',
      typeof details.detail === 'string' ? details.detail : '',
      typeof details.hint === 'string' ? `hint: ${details.hint}` : '',
      typeof details.column === 'string' ? `column: ${details.column}` : '',
      typeof details.table === 'string' ? `table: ${details.table}` : '',
      typeof details.constraint === 'string' ? `constraint: ${details.constraint}` : '',
      typeof details.code === 'string' ? `code: ${details.code}` : '',
    ].filter(Boolean);

    if (parts.length) {
      return parts.join(' | ');
    }
  }

  return fallback;
}

async function getOptionalSession() {
  try {
    return await getServerSession();
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getOptionalSession();

  try {
    const listings = await listPublishedMarketplaceAssetListings({
      viewerUserId: session?.user?.id ?? null,
      exposeContact: Boolean(session?.user?.id),
    });

    return NextResponse.json({ ok: true, listings });
  } catch (error) {
    console.error('marketplace GET failed', error);
    return NextResponse.json(
      { ok: false, error: formatUnknownError(error, 'Failed to load marketplace.') },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const body = (await request.json()) as { assetId?: unknown };
  const assetId = String(body.assetId ?? '').trim();

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Valid asset id is required.' }, { status: 400 });
  }

  try {
    const listing = await publishAssetRegisterItemToMarketplace({
      userId: session.user.id,
      assetId,
    });

    return NextResponse.json({
      ok: true,
      assetId,
      marketplaceStatus: 'live',
      listing,
    });
  } catch (error) {
    const message = formatUnknownError(error, 'Failed to send asset to marketplace.');
    const status = message.includes('ASSET_NOT_FOUND') ? 404 : 400;

    console.error('marketplace POST failed', error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const assetId = String(searchParams.get('assetId') ?? '').trim();

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Valid asset id is required.' }, { status: 400 });
  }

  try {
    await removeAssetRegisterItemFromMarketplace({
      userId: session.user.id,
      assetId,
    });

    return NextResponse.json({
      ok: true,
      assetId,
      marketplaceStatus: 'draft',
    });
  } catch (error) {
    const message = formatUnknownError(error, 'Failed to remove marketplace listing.');
    const status = message.includes('ASSET_NOT_FOUND') ? 404 : 400;

    console.error('marketplace DELETE failed', error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
