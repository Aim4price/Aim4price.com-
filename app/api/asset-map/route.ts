import { NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { listAssetRegisterItems, type AssetRegisterItem } from '../../../lib/asset-register-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';

type AssetMapItem = {
  id: string;
  title: string;
  kind: string;
  assetTypeLabel: string;
  plateLabel: string;
  publicAssetCode: string;
  qrStatus: string;
  condition: string;
  financeStatus: AssetStatusChoice;
  insuranceStatus: AssetStatusChoice;
  licenseStatus: AssetStatusChoice;
  hours: number | null;
  fuelPercent: number | null;
  serialNumber: string;
  brandName: string;
  modelName: string;
  typedModelName: string;
  yearModel: number | null;
  lastScannedAtIso: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastKnownLocationText: string;
  updatedAtIso: string;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function hasCoordinates(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeAssetStatusChoice(value: unknown, fallback: AssetStatusChoice = 'unknown'): AssetStatusChoice {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (['yes', 'y', 'true', 'financed', 'insured', 'licensed', 'licenced'].includes(normalized)) {
    return 'yes';
  }

  if (['no', 'n', 'false', 'not_financed', 'not_insured', 'not_licensed', 'not_licenced', 'unfinanced', 'uninsured', 'unlicensed', 'unlicenced'].includes(normalized)) {
    return 'no';
  }

  if (['na', 'n_a', 'not_applicable', 'not_aplicable', 'not_relevant', 'does_not_apply'].includes(normalized)) {
    return 'not_applicable';
  }

  if (['unknown', 'not_sure', 'unsure', 'maybe', ''].includes(normalized)) {
    return normalized ? 'unknown' : fallback;
  }

  return fallback;
}

function readFinanceStatusChoice(item: AssetRegisterItem): AssetStatusChoice {
  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.financeStatus ?? specs.finance_status ?? specs.financedStatus ?? specs.financed_status,
    item.isFinanced ? 'yes' : 'no',
  );
}

function readInsuranceStatusChoice(item: AssetRegisterItem): AssetStatusChoice {
  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.insuranceStatus ?? specs.insurance_status ?? specs.insuredStatus ?? specs.insured_status,
    item.isInsured ? 'yes' : 'no',
  );
}

function readLicenseStatusChoice(item: AssetRegisterItem): AssetStatusChoice {
  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.licenseStatus ??
      specs.license_status ??
      specs.licensedStatus ??
      specs.licensed_status ??
      specs.licenceStatus ??
      specs.licence_status ??
      specs.licencedStatus ??
      specs.licenced_status,
    item.isLicensed ? 'yes' : 'no',
  );
}

function buildAssetTypeLabel(item: AssetRegisterItem): string {
  const family = String(item.equipmentFamilyLabel ?? '').trim();
  if (family) return family;

  const kind = String(item.kind ?? '').trim();
  if (kind) return titleCase(kind);

  return 'Asset';
}

function mapAssetForMap(item: AssetRegisterItem): AssetMapItem {
  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    assetTypeLabel: buildAssetTypeLabel(item),
    plateLabel: item.plateLabel,
    publicAssetCode: item.publicAssetCode,
    qrStatus: item.qrStatus,
    condition: item.condition,
    financeStatus: readFinanceStatusChoice(item),
    insuranceStatus: readInsuranceStatusChoice(item),
    licenseStatus: readLicenseStatusChoice(item),
    hours: item.hours,
    fuelPercent: item.fuelPercent,
    serialNumber: item.serialNumber,
    brandName: item.brandName,
    modelName: item.modelName,
    typedModelName: item.typedModelName,
    yearModel: item.yearModel,
    lastScannedAtIso: item.lastScannedAtIso,
    lastKnownLat: item.lastKnownLat,
    lastKnownLng: item.lastKnownLng,
    lastKnownLocationText: item.lastKnownLocationText,
    updatedAtIso: item.updatedAtIso,
  };
}

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const items = await listAssetRegisterItems(session.user.id);
    const assets = items.map(mapAssetForMap);
    const mappedAssets = assets.filter((asset) => hasCoordinates(asset.lastKnownLat, asset.lastKnownLng));
    const activeMappedAssets = mappedAssets.filter((asset) => asset.qrStatus !== 'deleted');
    const recentlyScannedAssets = assets.filter((asset) => {
      if (!asset.lastScannedAtIso) return false;
      const scannedAt = new Date(asset.lastScannedAtIso).getTime();
      if (Number.isNaN(scannedAt)) return false;
      return Date.now() - scannedAt <= 1000 * 60 * 60 * 24 * 30;
    });

    return NextResponse.json({
      ok: true,
      assets,
      summary: {
        totalAssets: assets.length,
        assetsWithLocation: mappedAssets.length,
        assetsWithoutLocation: Math.max(0, assets.length - mappedAssets.length),
        activeMappedAssets: activeMappedAssets.length,
        scannedLast30Days: recentlyScannedAssets.length,
      },
    });
  } catch (error) {
    console.error('asset map GET failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to load the asset map.' },
      { status: 500 },
    );
  }
}
