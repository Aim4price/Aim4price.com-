import type { AssetRegisterItem } from './asset-register-db';
import type { AdvertDetails, AdvertEstimate } from './advert-creator';
import { resolveAssetUsage } from './asset-usage';

export type AdvertSourceAsset = {
  id: string;
  details: Partial<AdvertDetails> & Pick<AdvertDetails, 'title' | 'year'>;
  photos: string[];
  province: string;
  area: string;
  estimate: AdvertEstimate | null;
};

/** Explicit allowlist: never send asset documents, costs or finance data to the creator. */
export function assetToAdvertSource(asset: AssetRegisterItem): AdvertSourceAsset {
  const usage = resolveAssetUsage(asset);
  const identity = {
    title: asset.marketplaceTitle || asset.title || [asset.brandName, asset.modelName].filter(Boolean).join(' '),
    year: asset.yearModel == null ? '' : String(asset.yearModel),
    usage: usage.value == null ? '' : String(usage.value),
    usageUnit: usage.metric === 'percentage' ? 'percent' as const : usage.metric === 'not_applicable' ? 'none' as const : usage.metric,
    condition: asset.condition || 'good',
  };
  const contacts = {
    contactName: asset.marketplaceSellerName, phone: asset.sellerPhone,
    email: asset.marketplaceSellerEmail, businessName: asset.marketplaceSellerCompany,
  };
  const details: AdvertSourceAsset['details'] = {
    ...identity,
    askingPrice: Number(asset.marketplacePriceExVat) > 0 ? String(asset.marketplacePriceExVat) : '',
    description: asset.marketplaceNotes || '',
  };
  for (const key of Object.keys(contacts) as (keyof typeof contacts)[]) {
    if (contacts[key]) details[key] = contacts[key]!;
  }
  const value = Number(asset.aim4priceValueExVat);
  return {
    id: asset.id, details, photos: (asset.photos || []).slice(0, 4),
    province: asset.marketplaceProvince || '', area: asset.marketplaceArea || '',
    estimate: Number.isFinite(value) && value > 0 ? {
      ...identity, id: `asset:${asset.id}`, valueExVat: value, createdAt: asset.updatedAtIso,
      realisticSellingPriceExVat: asset.realisticSellingAssessment?.priceExVat,
      sellingPriceNeedsReview: asset.realisticSellingAssessment?.needsReview,
    } : null,
  };
}
