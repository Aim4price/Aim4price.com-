import type { TeamAsset, TeamPermissions } from './team-access-policy';
import type { AssetGroup } from './asset-groups-shared';
import type { RegisterAsset } from '../app/asset-register/asset-register-client';
import type { AssetRegisterSummary } from './asset-registers';

export type TeamRegisterData = {
  name: string;
  permissions: TeamPermissions;
  assets: TeamAsset[];
  groups?: AssetGroup[];
  version: number;
};

/** Keep the owner's hierarchy, but never expose inaccessible members or owner metadata. */
export function projectTeamGroups(groups: AssetGroup[], assets: TeamAsset[]): AssetGroup[] {
  const allowed = new Set(assets.map(asset => asset.id));
  return groups.flatMap(group => {
    const members = group.members.filter(member => allowed.has(member.assetId));
    if (!members.length) return [];
    // A hidden primary must not cause an accessible member's value to be counted as its value.
    const primaryVisible = members.some(member => member.role === 'primary');
    return [{ id: group.id, name: group.name, registerId: group.registerId, userId: '',
      valueMode: primaryVisible ? group.valueMode : 'separate' as const,
      isFlagged: group.isFlagged === true,
      members: members.map(member => ({ assetId: member.assetId, role: member.role,
        relationship: member.relationship, countsTowardTotal: member.countsTowardTotal, sortOrder: member.sortOrder })),
      createdAtIso: '', updatedAtIso: '' }];
  });
}

/** Adapt the safe team projection to the existing register renderer. Never accept raw owner JSON. */
export function desktopRegisterAssets(data: TeamRegisterData, membership: string): RegisterAsset[] {
  return data.assets.map(asset => ({
    id: asset.id, userId: '', registerId: asset.registerId, registerName: asset.registerName,
    valuationRunId: null, sectorId: null, equipmentFamilyId: null, equipmentFamilyKey: '', equipmentFamilyLabel: '',
    equipmentModelId: null, typedModelName: '', normalizedTypedModelName: '', specsJson: {includeInRegisterTotal: asset.includeInRegisterTotal !== false},
    registerIncludedInCombinedTotals: asset.registerIncludedInCombinedTotals !== false,
    depreciationMethodUsed: '', lifeWorkedPercent: asset.usageMetric === 'percentage' ? asset.usage : null,
    lifeRemainingPercent: null, estimatedHours: null, maxLifetimeHours: null,
    kind: (['tractor','equipment','manual','property','vehicle','tools','stock'].includes(asset.kind || '') ? asset.kind : 'equipment') as RegisterAsset['kind'],
    title: asset.title, value: asset.values?.current ?? 0, selectedMethod: 'aim4price',
    selectedValueExVat: asset.values?.current ?? 0, replacementPriceExVat: asset.values?.replacement ?? null,
    brandName: asset.brand, modelName: asset.model, drive: '', tractorType: '', cab: '', powerKw: null,
    yearModel: asset.year, hours: asset.usage, condition: asset.condition as RegisterAsset['condition'],
    aim4priceValueExVat: asset.values?.current ?? null, marketMidExVat: null, note: '', serialNumber: asset.serial,
    isFinanced: false, isInsured: false, insuredValueExVat: asset.values?.insured ?? null, isLicensed: false,
    licenseRegistrationNumber: asset.registration, financeNote: '', sellerPhone: '', marketplaceNotes: '',
    marketplaceStatus: '', marketplacePriceExVat: null, marketplaceSellerName: '', marketplaceSellerCompany: '',
    marketplaceSellerEmail: '', marketplaceProvince: '', marketplaceArea: '',
    photos: Array.from({length: asset.photoCount}, (_, index) => `/api/team-workspaces/${encodeURIComponent(membership)}/photos?assetId=${encodeURIComponent(asset.id)}&index=${index}`),
    documents: [], publicAssetCode: '', plateLabel: '', qrStatus: '', lastScannedAtIso: null,
    lastKnownLat: null, lastKnownLng: null, lastKnownLocationText: '', fuelPercent: null, createdAtIso: '', updatedAtIso: '',
  }));
}

export function desktopRegisterSummaries(data: TeamRegisterData): AssetRegisterSummary[] {
  const registers = new Map<string, AssetRegisterSummary>();
  for (const asset of data.assets) {
    if (!asset.registerId) continue;
    const register = registers.get(asset.registerId) || {
      id: asset.registerId, userId: '', businessName: asset.registerName, email: '', phone: '', addressLine1: '',
      logoUrls: [], showLogosOnRegister: false, includeInCombinedTotals: asset.registerIncludedInCombinedTotals !== false, isPrimary: false, isSelected: false,
      assetCount: 0, totalValue: 0, totalReplacementPrice: 0, unnotedAlertCount: 0, createdAtIso: '', updatedAtIso: '',
    };
    register.assetCount++;
    if (asset.includeInRegisterTotal !== false) register.totalValue += asset.values?.current ?? 0;
    if (asset.includeInRegisterTotal !== false) register.totalReplacementPrice += asset.values?.replacement ?? 0;
    registers.set(asset.registerId, register);
  }
  return [...registers.values()];
}
