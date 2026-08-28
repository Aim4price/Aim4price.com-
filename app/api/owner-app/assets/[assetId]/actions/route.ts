import { NextRequest, NextResponse } from 'next/server';
import {
  getAssetRegisterItemById,
  updateAssetRegisterItemLocation,
  updateAssetRegisterItemMedia,
  type AssetRegisterDocument,
} from '../../../../../../lib/asset-register-db';
import {
  normalizeAssetDocumentCategory,
  normalizeAssetDocumentType,
} from '../../../../../../lib/asset-document-permissions';
import {
  cancelAssetMaintenanceRecord,
  createAssetMaintenanceRecord,
  getAssetMaintenanceRecordById,
  reopenAssetMaintenanceRecord,
  updateAssetMaintenanceRecord,
} from '../../../../../../lib/asset-maintenance';
import { publishAssetRegisterItemToMarketplace } from '../../../../../../lib/marketplace-db';
import { getOwnerAppAccess, ownerAppCan, ownerAppCanAccessAsset } from '../../../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function text(value: unknown) { return String(value ?? '').trim(); }
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function mediaPhotos(value: unknown): string[] {
  return Array.isArray(value) ? Array.from(new Set(value.map(text).filter(Boolean))).slice(0, 12) : [];
}
function mediaDocuments(value: unknown): AssetRegisterDocument[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const item = record(entry);
    const url = text(item.url);
    if (!url) return [];
    return [{
      id: text(item.id) || text(item.uploadId) || url,
      url,
      fileName: text(item.fileName) || 'Document',
      contentType: text(item.contentType) || 'application/octet-stream',
      byteSize: Math.max(0, Math.round(Number(item.byteSize) || 0)),
      uploadedAtIso: text(item.uploadedAtIso) || new Date().toISOString(),
      category: normalizeAssetDocumentCategory(item.category ?? item.documentCategory),
      documentType: normalizeAssetDocumentType(item.documentType ?? item.type),
    }];
  }).slice(0, 20);
}

async function maintenanceIdForAsset(userId: string, assetId: string, value: unknown): Promise<string> {
  const maintenanceId = text(value);
  const maintenance = maintenanceId ? await getAssetMaintenanceRecordById(userId, maintenanceId) : null;
  if (!maintenance || maintenance.assetId !== assetId) throw new Error('Maintenance record not found.');
  return maintenanceId;
}

export async function POST(request: NextRequest, { params }: { params: { assetId: string } }) {
  const access = await getOwnerAppAccess();
  if (!access) return NextResponse.json({ ok: false, error: 'You must sign in to Aim4price Owner.' }, { status: 401 });
  if (!ownerAppCanAccessAsset(access, params.assetId)) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }
  const asset = await getAssetRegisterItemById(access.ownerUserId, params.assetId);
  if (!asset) return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: 'Invalid action details.' }, { status: 400 }); }
  const action = text(body.action);
  const marketplaceAction = action === 'marketplace-publish' || action === 'marketplace-remove';
  if (marketplaceAction && !ownerAppCan(access, 'manage_marketplace')) {
    return NextResponse.json({ ok: false, error: 'Only an Owner / Admin login can manage Marketplace listings.' }, { status: 403 });
  }
  if (!marketplaceAction && !ownerAppCan(access, 'operate')) {
    return NextResponse.json({ ok: false, error: 'This login has View only access.' }, { status: 403 });
  }

  try {
    if (action === 'media') {
      await updateAssetRegisterItemMedia(access.ownerUserId, {
        assetId: params.assetId,
        photos: mediaPhotos(body.photos),
        documents: mediaDocuments(body.documents),
      });
    } else if (action === 'location') {
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Enter valid latitude and longitude values.');
      await updateAssetRegisterItemLocation(access.ownerUserId, {
        assetId: params.assetId,
        latitude,
        longitude,
        locationText: text(body.locationText),
        source: text(body.source) === 'device' ? 'device' : 'manual',
      });
    } else if (action === 'maintenance-create') {
      await createAssetMaintenanceRecord(access.ownerUserId, { ...body, assetId: params.assetId });
    } else if (action === 'maintenance-update') {
      const maintenanceId = await maintenanceIdForAsset(access.ownerUserId, params.assetId, body.maintenanceId);
      await updateAssetMaintenanceRecord(access.ownerUserId, maintenanceId, { ...body, assetId: params.assetId });
    } else if (action === 'maintenance-complete') {
      return NextResponse.json({
        ok: false,
        error: 'Record the completed work, usage and notes before marking maintenance done.',
      }, { status: 400 });
    } else if (action === 'maintenance-cancel') {
      const maintenanceId = await maintenanceIdForAsset(access.ownerUserId, params.assetId, body.maintenanceId);
      await cancelAssetMaintenanceRecord(access.ownerUserId, maintenanceId);
    } else if (action === 'maintenance-reopen') {
      const maintenanceId = await maintenanceIdForAsset(access.ownerUserId, params.assetId, body.maintenanceId);
      await reopenAssetMaintenanceRecord(access.ownerUserId, maintenanceId);
    } else if (action === 'marketplace-publish') {
      await publishAssetRegisterItemToMarketplace({
        userId: access.ownerUserId,
        assetId: params.assetId,
        askingPriceExVat: Math.round(Number(body.askingPriceExVat) || 0) || null,
        marketplaceNotes: text(body.marketplaceNotes) || null,
        sellerPhone: text(body.sellerPhone) || null,
        sellerName: text(body.sellerName) || null,
        sellerCompany: text(body.sellerCompany) || null,
        sellerEmail: text(body.sellerEmail) || null,
        province: text(body.province) || null,
        area: text(body.area) || null,
        photos: asset.photos,
      });
    } else if (action === 'marketplace-remove') {
      return NextResponse.json({
        ok: false,
        error: 'Open Manage advert in Marketplace to record the listing outcome before removing it.',
      }, { status: 409 });
    } else {
      return NextResponse.json({ ok: false, error: 'Unsupported Owner App action.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`Owner App asset action ${action} failed.`, error);
    const code = error instanceof Error ? error.message : '';
    const message = code === 'DUE_DATE_REQUIRED'
      ? 'Select the maintenance due date.'
      : code === 'DUE_USAGE_REQUIRED'
        ? 'Enter the maintenance usage target.'
        : code === 'RECURRING_INTERVAL_REQUIRED'
          ? 'Enter the recurring maintenance interval.'
          : code === 'INVALID_GPS_COORDINATES'
      ? 'Enter valid latitude (-90 to 90) and longitude (-180 to 180) values.'
      : code && !/^[A-Z0-9_]+$/.test(code)
        ? code
        : 'The requested asset action could not be completed.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
