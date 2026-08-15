import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { getAccountProfile } from '../../../lib/account-profile';
import {
  listPublishedMarketplaceAssetListings,
  publishAssetRegisterItemToMarketplace,
  removeAssetRegisterItemFromMarketplace,
} from '../../../lib/marketplace-db';
import { MAX_ASSET_REGISTER_PHOTOS } from '../../../lib/asset-register-uploads';
import { isMiddlemanAccountSubtype } from '../../../lib/middleman-account';

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

function normalizePhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const urls: string[] = [];

  for (const item of value) {
    const url = String(item ?? '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_ASSET_REGISTER_PHOTOS) break;
  }

  return urls;
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
    return await getServerSession({ allowDealerApp: true, allowOwnerApp: true });
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getOptionalSession();

  try {
    if (session?.user?.id) {
      const profile = await getAccountProfile({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      });

      if (profile.accountType !== 'owner' && profile.accountType !== 'dealer') {
        return NextResponse.json(
          { ok: false, error: 'Marketplace is only available to owner and dealer accounts.' },
          { status: 403 },
        );
      }
    }

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
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const body = (await request.json()) as {
    assetId?: unknown;
    askingPriceExVat?: unknown;
    marketplaceNotes?: unknown;
    sellerPhone?: unknown;
    sellerName?: unknown;
    sellerCompany?: unknown;
    sellerEmail?: unknown;
    province?: unknown;
    area?: unknown;
    photos?: unknown;
    brandKitId?: unknown;
    showDealRating?: unknown;
  };
  const assetId = String(body.assetId ?? '').trim();

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Valid asset id is required.' }, { status: 400 });
  }

  const askingPriceExVat = Math.round(Number(body.askingPriceExVat) || 0);
  let marketplaceNotes = String(body.marketplaceNotes ?? '').trim();
  let sellerPhone = String(body.sellerPhone ?? '').trim();
  let sellerName = String(body.sellerName ?? '').trim();
  let sellerCompany = String(body.sellerCompany ?? '').trim();
  let sellerEmail = String(body.sellerEmail ?? '').trim();
  let province = String(body.province ?? '').trim();
  let area = String(body.area ?? '').trim();
  const photoUrls = normalizePhotos(body.photos);
  const brandKitId = String(body.brandKitId ?? '').trim();

  try {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });

    const accountType = String(profile.accountType ?? '').trim().toLowerCase();

    if (accountType !== 'owner' && accountType !== 'dealer') {
      return NextResponse.json(
        { ok: false, error: 'Only owner, dealer and auctioneer accounts can send assets to marketplace.' },
        { status: 403 },
      );
    }

    const listing = await publishAssetRegisterItemToMarketplace({
      userId: session.user.id,
      assetId,
      askingPriceExVat: askingPriceExVat > 0 ? askingPriceExVat : null,
      marketplaceNotes: marketplaceNotes || null,
      sellerPhone: sellerPhone || null,
      sellerName: sellerName || null,
      sellerCompany: sellerCompany || null,
      sellerEmail: sellerEmail || null,
      province: province || null,
      area: area || null,
      photos: photoUrls,
      brandKitId: accountType === 'dealer' ? brandKitId || null : null,
      allowBrandKit: accountType === 'dealer',
      showDealRating: body.showDealRating !== false,
      requireValuationSource: isMiddlemanAccountSubtype(profile.accountSubtype),
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
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });

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
