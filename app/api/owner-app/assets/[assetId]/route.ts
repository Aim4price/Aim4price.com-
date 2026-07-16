import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAssetRegisterItem,
  getAssetRegisterItemById,
  updateAssetRegisterItem,
  type AssetRegisterDocument,
  type AssetRegisterItemKind,
} from '../../../../../lib/asset-register-db';
import { deleteUnreferencedAssetRegisterUploads, listInternalAssetRegisterUploadIds } from '../../../../../lib/asset-register-uploads';
import { listAssetMaintenanceData } from '../../../../../lib/asset-maintenance';
import { getAssetRegisterForUser, listAssetRegisters, moveAssetRegisterItems } from '../../../../../lib/asset-registers';
import { getOwnerAppAccess } from '../../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = new Set<AssetRegisterItemKind>(['tractor', 'equipment', 'manual', 'property', 'vehicle', 'tools', 'stock']);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string { return String(value ?? '').trim(); }
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function boolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(text(value).toLowerCase());
}
function kind(value: unknown, fallback: AssetRegisterItemKind): AssetRegisterItemKind {
  const normalized = text(value).toLowerCase() as AssetRegisterItemKind;
  return KINDS.has(normalized) ? normalized : fallback;
}
function photos(value: unknown): string[] {
  return Array.isArray(value) ? Array.from(new Set(value.map(text).filter(Boolean))).slice(0, 12) : [];
}
function documents(value: unknown): AssetRegisterDocument[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const record = asRecord(entry);
    const url = text(record.url);
    if (!url) return [];
    return [{
      id: text(record.id) || text(record.uploadId) || url,
      url,
      fileName: text(record.fileName) || 'Document',
      contentType: text(record.contentType) || 'application/octet-stream',
      byteSize: Math.max(0, Math.round(Number(record.byteSize) || 0)),
      uploadedAtIso: text(record.uploadedAtIso) || new Date().toISOString(),
    }];
  }).slice(0, 20);
}

async function loadDetail(ownerUserId: string, assetId: string) {
  const item = await getAssetRegisterItemById(ownerUserId, assetId);
  if (!item) return null;
  const [registers, maintenance] = await Promise.all([
    listAssetRegisters(ownerUserId),
    listAssetMaintenanceData(ownerUserId, { assetId }),
  ]);
  const register = item.registerId ? await getAssetRegisterForUser(ownerUserId, item.registerId) : null;
  return {
    item,
    register,
    registers,
    maintenance: maintenance.records,
    maintenanceSummary: maintenance.summary,
  };
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must sign in to Aim4price Owner.' }, { status: 401 });
}
function notFound() {
  return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
}

export async function GET(_request: NextRequest, { params }: { params: { assetId: string } }) {
  const access = await getOwnerAppAccess();
  if (!access) return unauthorized();
  try {
    const detail = await loadDetail(access.ownerUserId, params.assetId);
    return detail ? NextResponse.json({ ok: true, ...detail }) : notFound();
  } catch (error) {
    console.error('Owner App asset detail GET failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to load this asset.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { assetId: string } }) {
  const access = await getOwnerAppAccess();
  if (!access) return unauthorized();
  const existing = await getAssetRegisterItemById(access.ownerUserId, params.assetId);
  if (!existing) return notFound();

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: 'Invalid asset details.' }, { status: 400 }); }

  const title = text(body.title);
  const value = Math.round(Number(body.value) || 0);
  const replacementPriceExVat = numberOrNull(body.replacementPriceExVat) ?? existing.replacementPriceExVat;
  if (!title || value <= 0 || !replacementPriceExVat || replacementPriceExVat <= 0) {
    return NextResponse.json({ ok: false, error: 'Asset name, current value and replacement price are required.' }, { status: 400 });
  }

  const specs = { ...asRecord(existing.specsJson), ...asRecord(body.specsJson) };
  const financeStatus = text(specs.financeStatus || specs.finance_status || (boolean(body.isFinanced) ? 'yes' : 'no'));
  const insuranceStatus = text(specs.insuranceStatus || specs.insurance_status || (boolean(body.isInsured) ? 'yes' : 'no'));
  const licenseStatus = text(specs.licenseStatus || specs.license_status || (boolean(body.isLicensed) ? 'yes' : 'no'));
  Object.assign(specs, {
    financeStatus, finance_status: financeStatus,
    insuranceStatus, insurance_status: insuranceStatus, insuredStatus: insuranceStatus, insured_status: insuranceStatus,
    licenseStatus, license_status: licenseStatus, licensedStatus: licenseStatus, licensed_status: licenseStatus,
  });

  const nextPhotos = Object.hasOwn(body, 'photos') ? photos(body.photos) : existing.photos;
  const nextDocuments = Object.hasOwn(body, 'documents') ? documents(body.documents) : existing.documents;
  const removedUploadIds = listInternalAssetRegisterUploadIds([
    ...existing.photos.filter((url) => !nextPhotos.includes(url)),
    ...existing.documents.filter((document) => !nextDocuments.some((next) => next.url === document.url)).map((document) => document.url),
  ]);

  try {
    await updateAssetRegisterItem(access.ownerUserId, {
      assetId: params.assetId,
      kind: kind(body.kind, existing.kind),
      title,
      value,
      replacementPriceExVat,
      note: text(body.note),
      serialNumber: text(body.serialNumber),
      brandName: text(body.brandName),
      modelName: text(body.modelName),
      isFinanced: financeStatus === 'yes',
      financeNote: text(body.financeNote),
      isInsured: insuranceStatus === 'yes',
      insuredValueExVat: insuranceStatus === 'yes' ? numberOrNull(body.insuredValueExVat) : null,
      isLicensed: licenseStatus === 'yes',
      licenseRegistrationNumber: licenseStatus === 'yes' ? text(body.licenseRegistrationNumber) : '',
      photos: nextPhotos,
      documents: nextDocuments,
      yearModel: numberOrNull(body.yearModel),
      hours: numberOrNull(body.hours),
      usageMetric: text(body.usageMetric) === 'km' ? 'km' : 'hours',
      lifeWorkedPercent: numberOrNull(body.lifeWorkedPercent),
      specsJson: specs,
      condition: text(body.condition) as any,
      allowUsageDecrease: boolean(body.allowUsageDecrease),
    });

    const targetRegisterId = text(body.registerId);
    if (targetRegisterId && targetRegisterId !== existing.registerId) {
      await moveAssetRegisterItems({ userId: access.ownerUserId, assetIds: [params.assetId], targetRegisterId });
    }
    await deleteUnreferencedAssetRegisterUploads({ userId: access.ownerUserId, uploadIds: removedUploadIds, excludeAssetId: params.assetId });
    const detail = await loadDetail(access.ownerUserId, params.assetId);
    return detail ? NextResponse.json({ ok: true, ...detail }) : notFound();
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'USAGE_READING_CANNOT_DECREASE' || code === 'LIFE_WORKED_PERCENT_CANNOT_DECREASE') {
      return NextResponse.json({ ok: false, error: 'The usage reading is lower than the saved reading. Confirm the correction before saving.', requiresUsageConfirmation: true }, { status: 409 });
    }
    if (code === 'ASSET_REGISTER_NOT_FOUND') return NextResponse.json({ ok: false, error: 'Asset register not found.' }, { status: 404 });
    console.error('Owner App asset detail PUT failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to update this asset.' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { assetId: string } }) {
  const access = await getOwnerAppAccess();
  if (!access) return unauthorized();
  const existing = await getAssetRegisterItemById(access.ownerUserId, params.assetId);
  if (!existing) return notFound();
  const uploadIds = listInternalAssetRegisterUploadIds([...existing.photos, ...existing.documents.map((document) => document.url)]);
  try {
    await deleteAssetRegisterItem(access.ownerUserId, params.assetId);
    await deleteUnreferencedAssetRegisterUploads({ userId: access.ownerUserId, uploadIds, excludeAssetId: params.assetId }).catch(() => undefined);
    return NextResponse.json({ ok: true, redirectTo: '/owner-app/assets' });
  } catch (error) {
    console.error('Owner App asset detail DELETE failed.', error);
    return NextResponse.json({ ok: false, error: 'Failed to delete this asset.' }, { status: 500 });
  }
}
