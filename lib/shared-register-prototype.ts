import type { AssetLead } from './partner-access';

export type SharedRegisterAsset = Record<string, unknown>;

export type SharedRegisterSnapshot = {
  title: string;
  generatedAtIso: string;
  ownerName: string;
  ownerMeta: string;
  logoUrl: string;
  assetCount: number;
  totalValue: number;
  totalValueInclVat: number;
  totalReplacementValue: number;
  totalReplacementValueInclVat: number;
  assets: SharedRegisterAsset[];
};

export type SharedRegisterLead = Pick<
  AssetLead,
  | 'id'
  | 'ownerUserId'
  | 'partnerUserId'
  | 'leadType'
  | 'status'
  | 'assetSnapshot'
  | 'includedSections'
  | 'ownerMessage'
  | 'ownerName'
  | 'ownerBusinessName'
  | 'ownerEmail'
  | 'ownerPhone'
  | 'ownerProvince'
  | 'ownerTownCity'
  | 'createdAtIso'
  | 'updatedAtIso'
>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sharedRegisterSnapshot(lead: SharedRegisterLead): SharedRegisterSnapshot | null {
  const source = asRecord(lead.includedSections.registerSnapshot) ?? asRecord(lead.assetSnapshot.registerSnapshot);
  if (!source) return null;

  const assets = Array.isArray(source.assets)
    ? source.assets.map((asset) => asRecord(asset)).filter((asset): asset is SharedRegisterAsset => Boolean(asset))
    : [];

  return {
    title: asText(source.title) || 'Full Asset Register',
    generatedAtIso: asText(source.generatedAtIso) || lead.createdAtIso,
    ownerName: asText(source.ownerName) || lead.ownerBusinessName || lead.ownerName,
    ownerMeta: asText(source.ownerMeta),
    logoUrl: asText(source.logoUrl),
    assetCount: Math.round(asNumber(source.assetCount ?? source.totalAssets)) || assets.length,
    totalValue: asNumber(source.totalValue ?? source.registerValue),
    totalValueInclVat: asNumber(source.totalValueInclVat),
    totalReplacementValue: asNumber(source.totalReplacementValue ?? source.replacementValue),
    totalReplacementValueInclVat: asNumber(source.totalReplacementValueInclVat ?? source.replacementValueInclVat),
    assets,
  };
}

export function isSharedInsuranceRegister(lead: SharedRegisterLead): boolean {
  if (lead.leadType !== 'insurance') return false;
  return Boolean(
    sharedRegisterSnapshot(lead) ||
      lead.includedSections.registerLead === true ||
      asText(lead.includedSections.source) === 'full_asset_register',
  );
}
