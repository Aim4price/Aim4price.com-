import { NextRequest, NextResponse } from 'next/server';
import { recordAdminUsageEventSafely } from '../../../../../../lib/admin-usage-events';
import {
  authorizeFieldManagerScanAccess,
  authorizePublicQrScanAccess,
} from '../../../../../../lib/scan-auth';
import { normalizePublicAssetCode } from '../../../../../../lib/scan-assets';
import {
  grantDealerMaintenanceTracking,
  listOwnerDealerMaintenanceAccess,
  revokeDealerMaintenanceTracking,
  updateDealerMaintenancePermissions,
  type DealerMaintenancePermissions,
} from '../../../../../../lib/dealer-maintenance-tracker';
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
  trackMaintenance?: unknown;
  trackingPermissions?: unknown;
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

function readPermissions(value: unknown): DealerMaintenancePermissions | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const permissions = value as Record<string, unknown>;
  const keys = [
    'canViewLoggedProblems',
    'canViewMaintenanceReports',
    'canViewCostOfOwnership',
    'canCreateMaintenanceSchedules',
    'canUpdateSerial',
    'canUpdateReplacementPrice',
  ] as const;
  if (keys.some((key) => typeof permissions[key] !== 'boolean')) return null;
  return {
    canViewLoggedProblems: permissions.canViewLoggedProblems as boolean,
    canViewMaintenanceReports: permissions.canViewMaintenanceReports as boolean,
    canViewCostOfOwnership: permissions.canViewCostOfOwnership as boolean,
    canCreateMaintenanceSchedules: permissions.canCreateMaintenanceSchedules as boolean,
    canUpdateSerial: permissions.canUpdateSerial as boolean,
    canUpdateReplacementPrice: permissions.canUpdateReplacementPrice as boolean,
  };
}

async function authorizeDealerShareAccess(request: NextRequest, publicAssetCode: string) {
  const fieldManager = request.nextUrl.searchParams.get('fieldManager') === '1';
  const assetId = request.nextUrl.searchParams.get('assetId');
  return fieldManager
    ? authorizeFieldManagerScanAccess(request, publicAssetCode, assetId)
    : authorizePublicQrScanAccess(request, publicAssetCode);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const publicAssetCode = normalizePublicAssetCode(context.params?.publicAssetCode);
  const access = await authorizeDealerShareAccess(request, publicAssetCode);

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
      // QR sharing grants dealer tracking; outside businesses use the owner email-share flow.
      includeExternal: false,
      search,
    });

    const trackingAccess = await listOwnerDealerMaintenanceAccess(access.ownerUserId, access.asset.id);
    return NextResponse.json({ ok: true, partners, trackingAccess });
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
  const access = await authorizeDealerShareAccess(request, publicAssetCode);

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
  const operatorName = (access.fieldManagerDisplayName || asText(body.operatorName)).slice(0, 80);
  const latitude = normalizeCoordinate(body.latitude, 90);
  const longitude = normalizeCoordinate(body.longitude, 180);
  const locationText = latitude !== null && longitude !== null ? `GPS ${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : '';
  const ownerMessage = asText(body.ownerMessage).slice(0, 1600);
  const sharePhotoUrls = normalizeSharePhotoUrls(body.sharePhotoUrls);
  const trackMaintenance = body.trackMaintenance === true;
  const trackingPermissions = readPermissions(body.trackingPermissions);

  if (trackMaintenance && body.trackingPermissions && !trackingPermissions) {
    return NextResponse.json({ ok: false, error: 'Choose valid dealer tracking permissions.' }, { status: 400 });
  }

  if (!partnerUserId) {
    return NextResponse.json({ ok: false, error: 'Choose a dealer before sending.' }, { status: 400 });
  }

  if (operatorName.length < 2) {
    return NextResponse.json({ ok: false, error: 'Enter your name before sending to a dealer.' }, { status: 400 });
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
        maintenanceTrackingEnabled: trackMaintenance,
      },
    });

    const trackingAccess = trackMaintenance
      ? await grantDealerMaintenanceTracking({
          ownerUserId: access.ownerUserId,
          dealerUserId: partnerUserId,
          assetId: access.asset.id,
          actorType: access.accessMode === 'field_manager' ? 'field_manager' : 'owner',
          actorId: access.fieldManagerId ?? access.ownerUserId,
          actorName: operatorName,
          permissions: trackingPermissions,
        })
      : null;

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

    return NextResponse.json({ ok: true, lead, trackingAccess });
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const publicAssetCode = normalizePublicAssetCode(context.params?.publicAssetCode);
  const access = await authorizeDealerShareAccess(request, publicAssetCode);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error, pinRequired: access.pinRequired }, { status: access.status });
  }
  if (access.accessMode === 'scan_pin') {
    return NextResponse.json({ ok: false, error: 'Only the owner or a Field Manager can change dealer tracking.' }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as {
    accessId?: unknown;
    permissions?: unknown;
  } | null;
  const accessId = asText(body?.accessId);
  const permissions = readPermissions(body?.permissions);
  if (!accessId || !permissions) {
    return NextResponse.json({ ok: false, error: 'Choose a tracked dealer and valid permissions.' }, { status: 400 });
  }
  try {
    const trackingAccess = await updateDealerMaintenancePermissions({
      ownerUserId: access.ownerUserId,
      assetId: access.asset.id,
      accessId,
      permissions,
    });
    if (!trackingAccess) {
      return NextResponse.json({ ok: false, error: 'This dealer tracking access was not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, trackingAccess });
  } catch (error) {
    console.error('scan dealer-share PATCH failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to save dealer tracking permissions.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const publicAssetCode = normalizePublicAssetCode(context.params?.publicAssetCode);
  const access = await authorizeDealerShareAccess(request, publicAssetCode);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error, pinRequired: access.pinRequired }, { status: access.status });
  }
  if (access.accessMode === 'scan_pin') {
    return NextResponse.json({ ok: false, error: 'Only the owner or a Field Manager can change dealer tracking.' }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as {
    partnerUserId?: unknown;
    accessId?: unknown;
  } | null;
  const partnerUserId = asText(body?.partnerUserId);
  const accessId = asText(body?.accessId);
  if (!partnerUserId && !accessId) return NextResponse.json({ ok: false, error: 'Choose a tracked dealer.' }, { status: 400 });
  try {
    const revoked = await revokeDealerMaintenanceTracking({
      ownerUserId: access.ownerUserId,
      assetId: access.asset.id,
      dealerUserId: partnerUserId,
      accessId,
    });
    return NextResponse.json({ ok: true, revoked });
  } catch (error) {
    console.error('scan dealer-share DELETE failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to stop dealer tracking.' }, { status: 500 });
  }
}
