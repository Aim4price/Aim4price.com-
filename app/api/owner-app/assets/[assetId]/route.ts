import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import {
  getAssetRegisterItemById,
  updateAssetRegisterItem,
  type AssetRegisterDocument,
  type AssetRegisterItemKind,
} from '../../../../../lib/asset-register-db';
import {
  normalizeAssetDocumentCategory,
  normalizeAssetDocumentType,
} from '../../../../../lib/asset-document-permissions';
import { disposeOrDeleteAsset, type AssetDisposalReason } from '../../../../../lib/asset-lifecycle';
import { deleteUnreferencedAssetRegisterUploads, listInternalAssetRegisterUploadIds } from '../../../../../lib/asset-register-uploads';
import { resolveAssetUsage, type AssetUsageMetric } from '../../../../../lib/asset-usage';
import { listAssetMaintenanceData } from '../../../../../lib/asset-maintenance';
import { getAssetRegisterForUser, getAssetRegisterReportLogoUrl, listAssetRegisters, moveAssetRegisterItems } from '../../../../../lib/asset-registers';
import { getOwnerAppAccess, ownerAppCan, ownerAppCanAccessAsset } from '../../../../../lib/owner-app-access';
import { listOwnerAssetCorrectionAlerts } from '../../../../../lib/dealer-asset-corrections';

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
function percentageOrNull(value: unknown): number | null {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.min(100, Math.max(0, parsed));
}
function usageMetric(
  value: unknown,
  existing: { kind: string; hours: number | null; lifeWorkedPercent: number | null },
  specsJson: Record<string, unknown>,
): AssetUsageMetric {
  const normalized = text(value).toLowerCase();
  if (['not_applicable', 'not-applicable', 'not applicable', 'n/a', 'na', 'none'].includes(normalized)) return 'not_applicable';
  if (normalized === 'percentage' || normalized === 'percent') return 'percentage';
  if (normalized === 'km' || normalized === 'kms') return 'km';
  if (normalized === 'hours' || normalized === 'hour' || normalized === 'hrs') return 'hours';
  return resolveAssetUsage({ ...existing, specsJson }).metric;
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
      category: normalizeAssetDocumentCategory(record.category ?? record.documentCategory),
      documentType: normalizeAssetDocumentType(record.documentType ?? record.type),
    }];
  }).slice(0, 20);
}

async function loadDetail(ownerUserId: string, assetId: string) {
  const item = await getAssetRegisterItemById(ownerUserId, assetId);
  if (!item) return null;
  const [registers, maintenance, profile, reportLogoUrl, corrections] = await Promise.all([
    listAssetRegisters(ownerUserId),
    listAssetMaintenanceData(ownerUserId, { assetId }),
    getAccountProfile({ id: ownerUserId }),
    getAssetRegisterReportLogoUrl(ownerUserId, item.registerId),
    listOwnerAssetCorrectionAlerts(ownerUserId, [item.id]),
  ]);
  const register = item.registerId ? await getAssetRegisterForUser(ownerUserId, item.registerId) : null;
  return {
    item: { ...item, dealerAssetCorrection: corrections[0] ?? null },
    register,
    registers,
    maintenance: maintenance.records,
    maintenanceSummary: maintenance.summary,
    ownerContext: {
      businessName: profile.businessName || profile.displayName || profile.name,
      contactName: profile.marketplaceSellerName || profile.displayName || profile.name,
      phone: profile.marketplacePhone || profile.phone,
      email: profile.marketplaceEmail || profile.email,
      province: profile.province,
      area: profile.marketplaceLocation || profile.townCity,
      address: [profile.addressLine1, profile.addressLine2, profile.townCity, profile.province].filter(Boolean).join(', '),
      reportLogoUrl,
    },
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
  if (!ownerAppCanAccessAsset(access, params.assetId)) return notFound();
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
  if (!ownerAppCanAccessAsset(access, params.assetId)) return notFound();
  if (!ownerAppCan(access, 'manage_assets')) return NextResponse.json({ ok: false, error: 'This login has Operations or View only access.' }, { status: 403 });
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
  const selectedUsageMetric = usageMetric(body.usageMetric, existing, specs);
  if (selectedUsageMetric === 'not_applicable') {
    Object.assign(specs, {
      usageMetric: 'not_applicable', usage_metric: 'not_applicable',
      usageUnit: 'not_applicable', usage_unit: 'not_applicable',
      usageMode: 'not_applicable', usage_mode: 'not_applicable',
      usageBasis: 'not_applicable', usage_basis: 'not_applicable',
      selectedUsageMode: 'not_applicable', selected_usage_mode: 'not_applicable',
      selectedUsageBasis: 'not_applicable', selected_usage_basis: 'not_applicable',
      usageApplicable: false, usage_applicable: false,
    });
  } else if (selectedUsageMetric === 'percentage') {
    Object.assign(specs, {
      usageMode: 'percent', usage_mode: 'percent',
      usageBasis: 'percent', usage_basis: 'percent',
      selectedUsageMode: 'percent', selected_usage_mode: 'percent',
      selectedUsageBasis: 'percent', selected_usage_basis: 'percent',
      usageApplicable: true, usage_applicable: true,
    });
  } else {
    Object.assign(specs, {
      usageMetric: selectedUsageMetric, usage_metric: selectedUsageMetric,
      usageUnit: selectedUsageMetric, usage_unit: selectedUsageMetric,
      usageMode: selectedUsageMetric, usage_mode: selectedUsageMetric,
      usageBasis: 'reading', usage_basis: 'reading',
      selectedUsageMode: selectedUsageMetric, selected_usage_mode: selectedUsageMetric,
      selectedUsageBasis: 'reading', selected_usage_basis: 'reading',
      usageApplicable: true, usage_applicable: true,
    });
  }
  if (selectedUsageMetric !== 'percentage') {
    for (const key of [
      'lifeWorkedPercent', 'life_worked_percent', 'workedPercent', 'worked_percent',
      'percentWorked', 'percent_worked', 'lifetimeWorkedPercent', 'lifetime_worked_percent',
      'lifetimeUsedPercent', 'lifetime_used_percent',
    ]) delete specs[key];
  }
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
      hours: selectedUsageMetric === 'percentage' || selectedUsageMetric === 'not_applicable' ? null : numberOrNull(body.hours),
      usageMetric: selectedUsageMetric === 'percentage' || selectedUsageMetric === 'not_applicable'
        ? null
        : selectedUsageMetric === 'km' ? 'km' : 'hours',
      lifeWorkedPercent: selectedUsageMetric === 'percentage' ? percentageOrNull(body.lifeWorkedPercent) : null,
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

export async function DELETE(request: NextRequest, { params }: { params: { assetId: string } }) {
  const access = await getOwnerAppAccess();
  if (!access) return unauthorized();
  if (!ownerAppCanAccessAsset(access, params.assetId)) return notFound();
  if (!ownerAppCan(access, 'manage_assets')) return NextResponse.json({ ok: false, error: 'Only an Owner / Admin login can remove an asset.' }, { status: 403 });
  const existing = await getAssetRegisterItemById(access.ownerUserId, params.assetId);
  if (!existing) return notFound();
  const uploadIds = listInternalAssetRegisterUploadIds([...existing.photos, ...existing.documents.map((document) => document.url)]);
  try {
    let body: Record<string, unknown> = {};
    try { body = await request.json() as Record<string, unknown>; } catch { body = {}; }
    const reason = text(body.reason) as AssetDisposalReason;
    if (!reason) {
      return NextResponse.json({ ok: false, error: 'Choose what happened to the asset before continuing.' }, { status: 400 });
    }
    const aim4priceOutcomeInfluence = text(body.aim4priceOutcomeInfluence ?? body.aim4priceSaleInfluence).toLowerCase();
    const impactQuestionRequired = ['sold', 'traded_in', 'scrapped'].includes(reason);
    if (impactQuestionRequired && !['yes', 'no', 'unsure'].includes(aim4priceOutcomeInfluence)) {
      return NextResponse.json({ ok: false, error: 'Tell us whether Aim4price helped with this outcome.' }, { status: 400 });
    }
    const transferRequested = text(body.transferAction).toLowerCase() === 'claim_code';

    const outcome = await disposeOrDeleteAsset({
      ownerUserId: access.ownerUserId,
      assetId: params.assetId,
      reason,
      disposalDate: body.disposalDate,
      disposalAmountExVat: body.disposalAmountExVat,
      note: body.note,
      actorUserId: access.ownerAppUserId || access.ownerUserId,
      actorName: access.displayName,
      aim4priceOutcomeInfluence: impactQuestionRequired
        ? aim4priceOutcomeInfluence as 'yes' | 'no' | 'unsure'
        : null,
      transferRequested,
    });
    if (outcome.mode === 'deleted') {
      await deleteUnreferencedAssetRegisterUploads({ userId: access.ownerUserId, uploadIds, excludeAssetId: params.assetId }).catch(() => undefined);
    }
    return NextResponse.json({
      ok: true,
      mode: outcome.mode,
      transfer: outcome.transfer,
      redirectTo: outcome.mode === 'transfer_pending' ? undefined : '/owner-app/assets',
    });
  } catch (error) {
    console.error('Owner App asset detail DELETE failed.', error);
    if (error instanceof Error && error.message === 'ASSET_DELETE_HAS_DEPENDENCIES') {
      return NextResponse.json({ ok: false, error: 'This record has linked history or files. Choose the genuine disposal reason so it can be archived safely.' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'ASSET_TRANSFER_ALREADY_PENDING') {
      return NextResponse.json({ ok: false, error: 'A transfer is already waiting for this asset. Open Asset transfers in Account to manage it.' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'ASSET_TRANSFER_IDENTIFIER_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'Add a serial number to this asset before creating a transfer.' }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: 'Failed to delete this asset.' }, { status: 500 });
  }
}
