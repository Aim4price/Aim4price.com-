import { NextRequest, NextResponse } from 'next/server';
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
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCoordinate(value: unknown, maxAbsolute: number): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > maxAbsolute) return null;
  return parsed;
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

  if (!partnerUserId) {
    return NextResponse.json({ ok: false, error: 'Choose a dealer before sending.' }, { status: 400 });
  }

  if (operatorName.length < 2) {
    return NextResponse.json({ ok: false, error: 'Enter the manager name before sending to a dealer.' }, { status: 400 });
  }

  try {
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
