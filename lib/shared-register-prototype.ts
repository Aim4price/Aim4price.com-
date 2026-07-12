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

export function demoSharedRegisterLead(partnerUserId: string): SharedRegisterLead {
  const now = new Date().toISOString();
  const assets: SharedRegisterAsset[] = [
    {
      id: 'demo-pivot-b1',
      title: 'Bashan B1 four-tower pivot',
      kind: 'Irrigation equipment',
      equipmentFamilyLabel: 'Centre pivot',
      value: 550000,
      replacementPriceExVat: 600000,
      condition: 'good',
      serialNumber: 'B1-04T',
      isInsured: false,
      specsJson: { insuranceStatus: 'unknown', location: 'Spitskop Farm' },
      updatedAtIso: now,
    },
    {
      id: 'demo-solar-battery',
      title: '245 kW solar battery bank',
      kind: 'Solar and electrical',
      equipmentFamilyLabel: 'Solar storage',
      value: 1435000,
      replacementPriceExVat: 1435000,
      condition: 'excellent',
      isInsured: false,
      specsJson: { insuranceStatus: 'unknown', location: 'Skimmelkrans Dairy' },
      updatedAtIso: now,
    },
    {
      id: 'demo-feed-shed',
      title: 'Spitskop feed storage shed',
      kind: 'Property',
      equipmentFamilyLabel: 'Agricultural building',
      value: 3468679,
      replacementPriceExVat: 3468679,
      condition: 'good',
      isInsured: false,
      specsJson: { insuranceStatus: 'unknown', location: 'Spitskop Farm' },
      updatedAtIso: now,
    },
    {
      id: 'demo-hilux',
      title: '2013 Toyota Hilux 2.5 4x4',
      kind: 'Vehicle',
      equipmentFamilyLabel: 'Light commercial vehicle',
      value: 123456,
      replacementPriceExVat: 200000,
      condition: 'good',
      licenseRegistrationNumber: 'CAW 124120',
      isInsured: true,
      specsJson: { insuranceStatus: 'yes', location: 'Skimmelkrans Dairy' },
      updatedAtIso: now,
    },
    {
      id: 'demo-mccormick',
      title: 'McCormick MC115',
      kind: 'Equipment',
      equipmentFamilyLabel: 'Tractor',
      value: 123750,
      replacementPriceExVat: 1100000,
      condition: 'fair',
      licenseRegistrationNumber: 'CAW 18917',
      isInsured: false,
      specsJson: { insuranceStatus: 'no', location: 'Skimmelkrans Dairy' },
      updatedAtIso: now,
    },
    {
      id: 'demo-milking-table',
      title: 'Rockwood rotary milking table',
      kind: 'Dairy equipment',
      equipmentFamilyLabel: 'Milking equipment',
      value: 1500000,
      replacementPriceExVat: 1500000,
      condition: 'good',
      isInsured: false,
      specsJson: { insuranceStatus: 'no', location: 'Skimmelkrans Dairy' },
      updatedAtIso: now,
    },
  ];
  const totalValue = assets.reduce((sum, asset) => sum + asNumber(asset.value), 0);
  const totalReplacementValue = assets.reduce((sum, asset) => sum + asNumber(asset.replacementPriceExVat), 0);

  return {
    id: 'demo',
    ownerUserId: 'demo-owner',
    partnerUserId,
    leadType: 'insurance',
    status: 'viewed',
    assetSnapshot: {},
    includedSections: {
      registerLead: true,
      source: 'full_asset_register',
      registerSnapshot: {
        snapshotType: 'full_asset_register',
        title: 'Full Asset Register',
        generatedAtIso: now,
        ownerName: 'Skimmelkrans Boerdery (Prototype)',
        ownerMeta: 'Western Cape · Agriculture and dairy',
        assetCount: assets.length,
        totalValue,
        totalValueInclVat: totalValue * 1.15,
        totalReplacementValue,
        totalReplacementValueInclVat: totalReplacementValue * 1.15,
        assets,
      },
    },
    ownerMessage: 'Please review the register for our upcoming insurance renewal.',
    ownerName: 'H J Kuyler',
    ownerBusinessName: 'Skimmelkrans Boerdery (Prototype)',
    ownerEmail: 'owner@example.com',
    ownerPhone: '',
    ownerProvince: 'Western Cape',
    ownerTownCity: '',
    createdAtIso: now,
    updatedAtIso: now,
  };
}
