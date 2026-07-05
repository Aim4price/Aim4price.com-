import { NextRequest, NextResponse } from 'next/server';
import { recordAdminUsageEventSafely } from '../../../../../../lib/admin-usage-events';
import { authorizeScanAccess } from '../../../../../../lib/scan-auth';
import { normalizePublicAssetCode } from '../../../../../../lib/scan-assets';
import { createAssetLead, listPartnerDirectory } from '../../../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    publicAssetCode: string;
  };
};

type DealerShareRequest = {
  partnerUserId?: unknown;
  ownerMessage?: unknown;
  operatorName?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  sharePhotoUrls?: unknown;
};

const MAX_DEALER_SHARE_PHOTOS = 3;
const ASSET_REGISTER_UPLOAD_URL_PREFIX = '/api/asset-register/uploads/';

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCoordinate(value: unknown, maxAbsolute: number): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > maxAbsolute) return null;
  return parsed;
}

function normalizeSharePhotoUrl(value: unknown): string {
  const rawUrl = asText(value).slice(0, 2000);

  if (!rawUrl) {
    return '';
  }

  if (rawUrl.startsWith(ASSET_REGISTER_UPLOAD_URL_PREFIX)) {
    return rawUrl.split('?')[0] ?? rawUrl;
  }

  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  return '';
}

function normalizeSharePhotoUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const urls: string[] = [];

  value.forEach((entry) => {
    const url = normalizeSharePhotoUrl(entry);
    if (!url || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  });

  return urls.slice(0, MAX_DEALER_SHARE_PHOTOS);
}

function buildOwnerMessagePhotoAttachments(photoUrls: string[]): Array<{ type: 'image'; source: 'asset_qr_share'; url: string }> {
  return photoUrls.map((url) => ({
    type: 'image',
    source: 'asset_qr_share',
    url,
  }));
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const publicAssetCode = normalizePublicAssetCode(context.params?.publicAssetCode);
  const access = await authorizeScanAccess(request, publicAssetCode);

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

  if (access.accessMode === 'field_manager') {
    return NextResponse.json(
      { ok: false, error: 'Dealer sharing is not available in Field Manager mode.' },
      { status: 403 },
    );
  }

  const search = request.nextUrl.searchParams.get('search');

  try {
    const partners = await listPartnerDirectory({
      currentUserId: access.ownerUserId,
      partnerType: 'dealer',
      search,
    });

    return NextResponse.json({ ok: true, partners });
  } catch (error) {
    console.error('scan dealer-share GET failed', error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to load dealers.') },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const publicAssetCode = normalizePublicAssetCode(context.params?.publicAssetCode);
  const access = await authorizeScanAccess(request, publicAssetCode);

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

  if (access.accessMode === 'field_manager') {
    return NextResponse.json(
      { ok: false, error: 'Dealer sharing is not available in Field Manager mode.' },
      { status: 403 },
    );
  }

  let body: DealerShareRequest;

  try {
    body = (await request.json()) as DealerShareRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a valid dealer help request.' }, { status: 400 });
  }

  const partnerUserId = asText(body.partnerUserId);
  const operatorName = asText(body.operatorName).slice(0, 80);
  const latitude = normalizeCoordinate(body.latitude, 90);
  const longitude = normalizeCoordinate(body.longitude, 180);
  const locationText = latitude !== null && longitude !== null ? `GPS ${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : '';
  const ownerMessage = asText(body.ownerMessage).slice(0, 1600);
  const sharePhotoUrls = normalizeSharePhotoUrls(body.sharePhotoUrls);

  if (!partnerUserId) {
    return NextResponse.json({ ok: false, error: 'Choose a dealer before sending.' }, { status: 400 });
  }

  if (operatorName.length < 2) {
    return NextResponse.json({ ok: false, error: 'Enter the manager name before sending to a dealer.' }, { status: 400 });
  }

  try {
    const ownerMessageAttachments = buildOwnerMessagePhotoAttachments(sharePhotoUrls);
    const lead = await createAssetLead({
      ownerUserId: access.ownerUserId,
      assetId: access.asset.id,
      partnerUserId,
      leadType: 'replacement_quote',
      ownerMessage: ownerMessage || `${operatorName} requested dealer help from the asset QR page.`,
      includedSections: {
        assetDetails: true,
        valuationSummary: true,
        mainPhoto: true,
        photos: true,
        documents: true,
        scanHistory: true,
        source: 'asset_qr_share',
        sourceLabel: 'Asset QR share',
        requestedHelp: true,
        operatorName,
        publicAssetCode,
        scanLocationText: locationText,
        scanLatitude: latitude,
        scanLongitude: longitude,
        ownerMessagePhotoUrls: sharePhotoUrls,
        messageAttachmentPhotoUrls: sharePhotoUrls,
        sharePhotoUrls,
        ownerSharePhotoUrls: sharePhotoUrls,
        ownerMessageAttachments,
        messageAttachments: ownerMessageAttachments,
        ownerSharePhotoCount: sharePhotoUrls.length,
      },
    });

    await recordAdminUsageEventSafely({
      userId: access.ownerUserId,
      eventType: 'message_sent_qr_share',
      eventSource: 'scan-dealer-share',
      metadata: {
        leadId: lead.id,
        assetId: access.asset.id,
        partnerUserId,
        photoCount: sharePhotoUrls.length,
      },
    });

    return NextResponse.json({ ok: true, lead });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'PARTNER_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Selected dealer could not be found.' }, { status: 404 });
    }

    console.error('scan dealer-share POST failed', error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to send the asset to the dealer.') },
      { status: 500 },
    );
  }
}
