import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { getAccountProfile } from '../../../lib/account-profile';
import { canViewOwnerRegister } from '../../../lib/partner-access';
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

  const body = (await request.json()) as {
    assetId?: unknown;
    askingPriceExVat?: unknown;
    marketplaceNotes?: unknown;
    ownerUserId?: unknown;
    sellerPhone?: unknown;
    sellerName?: unknown;
    sellerCompany?: unknown;
    sellerEmail?: unknown;
    province?: unknown;
    area?: unknown;
  };
  const assetId = String(body.assetId ?? '').trim();
  const ownerUserId = String(body.ownerUserId ?? session.user.id).trim() || session.user.id;

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

  try {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    const isSharedRegisterPublish = ownerUserId !== session.user.id;

    if (isSharedRegisterPublish) {
      if (profile.accountType !== 'dealer') {
        return NextResponse.json(
          { ok: false, error: 'Only dealer accounts can send a shared owner asset to marketplace.' },
          { status: 403 },
        );
      }

      const canView = await canViewOwnerRegister(session.user.id, ownerUserId);
      if (!canView) {
        return NextResponse.json({ ok: false, error: 'You do not have access to this owner register.' }, { status: 403 });
      }

      const dealerLabel = profile.businessName || profile.displayName || profile.name || 'Aim4price';
      marketplaceNotes = [`Sent to marketplace by ${dealerLabel} dealer.`, marketplaceNotes].filter(Boolean).join('\n\n');
      sellerName = sellerName || profile.marketplaceSellerName || profile.displayName || profile.name;
      sellerCompany = sellerCompany || profile.businessName || profile.marketplaceSellerName || profile.displayName || profile.name;
      sellerPhone = sellerPhone || profile.marketplacePhone || profile.phone;
      sellerEmail = sellerEmail || profile.marketplaceEmail || profile.email;
      province = province || profile.province;
      area = area || profile.marketplaceLocation || profile.townCity;
    } else if (profile.accountType !== 'owner') {
      return NextResponse.json(
        { ok: false, error: 'Only owner accounts can send their own assets to marketplace.' },
        { status: 403 },
      );
    }

    const listing = await publishAssetRegisterItemToMarketplace({
      userId: ownerUserId,
      assetId,
      askingPriceExVat: askingPriceExVat > 0 ? askingPriceExVat : null,
      marketplaceNotes: marketplaceNotes || null,
      sellerPhone: sellerPhone || null,
      sellerName: sellerName || null,
      sellerCompany: sellerCompany || null,
      sellerEmail: sellerEmail || null,
      province: province || null,
      area: area || null,
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
