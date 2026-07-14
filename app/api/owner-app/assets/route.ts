import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getAssetRegisterItemById, listAssetRegisterItems, type AssetRegisterItem } from '../../../../lib/asset-register-db';
import { listAssetRegisters } from '../../../../lib/asset-registers';
import { getServerSession } from '../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in to use the Aim4price App.' }, { status: 401 });
}

function safePhotoUrl(value: string | null | undefined): string {
  const url = String(value ?? '').trim();
  if (!url || url.toLowerCase().startsWith('data:')) return '';
  return url;
}

function assetUsage(item: AssetRegisterItem) {
  const specs = item.specsJson && typeof item.specsJson === 'object' ? item.specsJson : {};
  const metricText = String(specs.usageMetric ?? specs.usage_metric ?? '').trim().toLowerCase();
  const metric = metricText === 'km' || metricText === 'kilometres' || metricText === 'kilometers'
    ? 'km'
    : item.kind === 'property' || item.kind === 'stock' || item.kind === 'tools'
      ? 'percentage'
      : 'hours';
  const value = metric === 'percentage'
    ? item.lifeWorkedPercent
    : item.hours ?? item.estimatedHours;

  return {
    metric,
    value: typeof value === 'number' && Number.isFinite(value) ? value : null,
  };
}

function listAsset(item: AssetRegisterItem, registerName: string) {
  const usage = assetUsage(item);

  return {
    id: item.id,
    registerId: item.registerId,
    registerName,
    title: item.title,
    kind: item.kind,
    categoryLabel: item.equipmentFamilyLabel,
    brandName: item.brandName,
    modelName: item.modelName || item.typedModelName,
    yearModel: item.yearModel,
    condition: item.condition,
    value: item.value,
    replacementPriceExVat: item.replacementPriceExVat,
    usageValue: usage.value,
    usageMetric: usage.metric,
    isInsured: item.isInsured,
    insuredValueExVat: item.insuredValueExVat,
    isFinanced: item.isFinanced,
    isLicensed: item.isLicensed,
    licenseRegistrationNumber: item.licenseRegistrationNumber,
    serialNumber: item.serialNumber,
    documentCount: item.documents.length,
    photoCount: item.photos.length,
    lastScannedAtIso: item.lastScannedAtIso,
    lastKnownLocationText: item.lastKnownLocationText,
    updatedAtIso: item.updatedAtIso,
  };
}

function detailedAsset(item: AssetRegisterItem, registerName: string) {
  return {
    ...listAsset(item, registerName),
    photos: item.photos.map(safePhotoUrl).filter(Boolean).slice(0, 8),
    documents: item.documents.map((document) => ({
      id: document.id,
      url: document.url,
      fileName: document.fileName,
      contentType: document.contentType,
      uploadedAtIso: document.uploadedAtIso,
    })),
    note: item.note,
    financeNote: item.financeNote,
    plateLabel: item.plateLabel,
    publicAssetCode: item.publicAssetCode,
    lastKnownLat: item.lastKnownLat,
    lastKnownLng: item.lastKnownLng,
    fuelPercent: item.fuelPercent,
  };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession({ requireActive: true });
  if (!session?.user?.id) return unauthorized();

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'owner') {
    return NextResponse.json({ ok: false, error: 'The Aim4price App is available to owner accounts.' }, { status: 403 });
  }

  try {
    const assetId = String(request.nextUrl.searchParams.get('assetId') ?? '').trim();
    const registers = await listAssetRegisters(session.user.id);
    const registerNameById = new Map(registers.map((register) => [register.id, register.businessName || 'Asset Register']));

    if (assetId) {
      const item = await getAssetRegisterItemById(session.user.id, assetId);
      if (!item) {
        return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        asset: detailedAsset(item, item.registerId ? registerNameById.get(item.registerId) || 'Asset Register' : 'Asset Register'),
      });
    }

    const groupedItems = await Promise.all(
      registers.map(async (register) => ({
        register,
        items: await listAssetRegisterItems(session.user.id, register.id),
      })),
    );

    const assets = groupedItems.flatMap(({ register, items }) =>
      items.map((item) => listAsset(item, register.businessName || 'Asset Register')),
    );

    return NextResponse.json({
      ok: true,
      profile: {
        displayName: profile.displayName,
        businessName: profile.businessName,
      },
      registers: registers.map((register) => ({
        id: register.id,
        name: register.businessName || 'Asset Register',
        isSelected: register.isSelected,
        assetCount: register.assetCount,
        totalValue: register.totalValue,
        totalReplacementPrice: register.totalReplacementPrice,
      })),
      assets,
      summary: {
        assetCount: assets.length,
        totalValue: assets.reduce((sum, asset) => sum + Number(asset.value || 0), 0),
        totalReplacementPrice: assets.reduce((sum, asset) => sum + Number(asset.replacementPriceExVat || 0), 0),
      },
    });
  } catch (error) {
    console.error('Aim4price owner app assets failed.', error);
    return NextResponse.json({ ok: false, error: 'The owner app assets could not be loaded.' }, { status: 500 });
  }
}
