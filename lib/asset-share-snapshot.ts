import type { AssetRegisterItem } from './asset-register-db';
import type { ExternalAssetShareItem } from './asset-external-share';
import { formatResolvedAssetUsage, resolveAssetUsage } from './asset-usage';
import { conditionLabel } from './tractor-logic';

/** Explicit public allowlist. Never spread an asset record into a public response. */
export function assetShareSnapshot(asset: AssetRegisterItem, includePhotos: boolean): ExternalAssetShareItem {
  return {
    title: asset.title,
    financeStatus: String(asset.specsJson?.financeStatus ?? asset.specsJson?.finance_status ?? (typeof asset.isFinanced === 'boolean' ? asset.isFinanced ? 'yes' : 'no' : 'unknown')),
    insuranceStatus: String(asset.specsJson?.insuranceStatus ?? asset.specsJson?.insurance_status ?? (typeof asset.isInsured === 'boolean' ? asset.isInsured ? 'yes' : 'no' : 'unknown')),
    licenseStatus: asset.kind === 'property' ? 'not_applicable' : String(asset.specsJson?.licenseStatus ?? asset.specsJson?.license_status ?? (typeof asset.isLicensed === 'boolean' ? asset.isLicensed ? 'yes' : 'no' : 'unknown')),
    mapped: Number.isFinite(asset.lastKnownLat) && Number.isFinite(asset.lastKnownLng),
    serialNumber: asset.serialNumber,
    yearModel: asset.yearModel,
    usage: formatResolvedAssetUsage(resolveAssetUsage(asset), 'Not saved'),
    condition: asset.condition ? conditionLabel(asset.condition) : 'Not saved',
    replacementPriceExVat: asset.replacementPriceExVat,
    valueExVat: asset.value,
    photoUrls: includePhotos ? asset.photos.filter(url => {
      if (/^\/api\/asset-register\/uploads\/[a-zA-Z0-9-]+$/.test(url)) return true;
      try { return new URL(url).protocol === 'https:'; } catch { return false; }
    }).slice(0, 12) : [],
    publicUrl: null,
  };
}

export function parseShareAssetIds(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 100 ||
    value.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    throw new Error('Select between 1 and 100 saved assets.');
  }
  return [...new Set(value.map(id => id.toLowerCase()))].sort();
}
