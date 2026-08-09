export type AssetGroupValueMode = 'separate' | 'included_in_primary';
export type AssetGroupMemberRole = 'primary' | 'linked';
export type AssetGroupRelationship =
  | 'primary'
  | 'works_with'
  | 'located_at'
  | 'component_of'
  | 'attached_to'
  | 'other';

export type AssetGroupMember = {
  assetId: string;
  role: AssetGroupMemberRole;
  relationship: AssetGroupRelationship;
  sortOrder: number;
};

export type AssetGroup = {
  id: string;
  userId: string;
  registerId: string;
  name: string;
  valueMode: AssetGroupValueMode;
  members: AssetGroupMember[];
  createdAtIso: string;
  updatedAtIso: string;
};

export type AssetGroupSaveInput = {
  groupId?: string | null;
  registerId: string;
  name: string;
  valueMode: AssetGroupValueMode;
  primaryAssetId: string;
  memberIds: string[];
  relationships?: Record<string, AssetGroupRelationship>;
};

export type AssetGroupMembership = {
  group: AssetGroup;
  member: AssetGroupMember;
};

export type AssetGroupExportMeta = {
  id: string;
  name: string;
  role: AssetGroupMemberRole;
  relationship: AssetGroupRelationship;
  valueMode: AssetGroupValueMode;
  primaryAssetId: string;
  memberCount: number;
};

export type GroupAwareAsset = {
  id: string;
  value?: number | null;
  replacementPriceExVat?: number | null;
  assetGroup?: AssetGroupExportMeta | null;
};

export function normalizeAssetGroupValueMode(value: unknown): AssetGroupValueMode {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_') === 'included_in_primary'
    ? 'included_in_primary'
    : 'separate';
}

export function normalizeAssetGroupRelationship(value: unknown): AssetGroupRelationship {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (normalized === 'primary') return 'primary';
  if (normalized === 'located_at') return 'located_at';
  if (normalized === 'component_of') return 'component_of';
  if (normalized === 'attached_to') return 'attached_to';
  if (normalized === 'other') return 'other';
  return 'works_with';
}

export function assetGroupValueModeLabel(valueMode: AssetGroupValueMode): string {
  return valueMode === 'included_in_primary'
    ? 'Linked values included in primary asset'
    : 'Values counted separately';
}

export function assetGroupRelationshipLabel(relationship: AssetGroupRelationship): string {
  switch (relationship) {
    case 'primary':
      return 'Primary asset';
    case 'located_at':
      return 'Located at the primary asset';
    case 'component_of':
      return 'Component of the primary asset';
    case 'attached_to':
      return 'Attached to the primary asset';
    case 'other':
      return 'Linked to the primary asset';
    case 'works_with':
    default:
      return 'Works with the primary asset';
  }
}

export function getAssetGroupPrimaryAssetId(group: AssetGroup): string {
  return group.members.find((member) => member.role === 'primary')?.assetId ?? group.members[0]?.assetId ?? '';
}

export function buildAssetGroupMembershipMap(groups: AssetGroup[]): Map<string, AssetGroupMembership> {
  const result = new Map<string, AssetGroupMembership>();

  groups.forEach((group) => {
    group.members.forEach((member) => {
      result.set(member.assetId, { group, member });
    });
  });

  return result;
}

export function assetCountsTowardRegisterTotal(
  assetId: string,
  groupsOrMemberships: AssetGroup[] | Map<string, AssetGroupMembership>,
): boolean {
  const memberships = groupsOrMemberships instanceof Map
    ? groupsOrMemberships
    : buildAssetGroupMembershipMap(groupsOrMemberships);
  const membership = memberships.get(assetId);

  if (!membership || membership.group.valueMode === 'separate') {
    return true;
  }

  return membership.member.role === 'primary';
}

export function assetCountsTowardRegisterTotalFromMeta(asset: GroupAwareAsset): boolean {
  const group = asset.assetGroup;

  if (!group || group.valueMode === 'separate') {
    return true;
  }

  return group.role === 'primary';
}

export function registerValueForAssets<T extends GroupAwareAsset>(
  assets: T[],
  groupsOrMemberships: AssetGroup[] | Map<string, AssetGroupMembership>,
): number {
  const memberships = groupsOrMemberships instanceof Map
    ? groupsOrMemberships
    : buildAssetGroupMembershipMap(groupsOrMemberships);

  return assets.reduce((sum, asset) => {
    if (!assetCountsTowardRegisterTotal(asset.id, memberships)) return sum;
    const value = Number(asset.value ?? 0);
    return sum + (Number.isFinite(value) ? Math.round(value) : 0);
  }, 0);
}

export function registerValueForDecoratedAssets<T extends GroupAwareAsset>(assets: T[]): number {
  return assets.reduce((sum, asset) => {
    if (!assetCountsTowardRegisterTotalFromMeta(asset)) return sum;
    const value = Number(asset.value ?? 0);
    return sum + (Number.isFinite(value) ? Math.round(value) : 0);
  }, 0);
}

export function groupRegisterValue<T extends GroupAwareAsset>(
  group: AssetGroup,
  assets: T[],
): number {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const memberships = buildAssetGroupMembershipMap([group]);

  return group.members.reduce((sum, member) => {
    const asset = assetById.get(member.assetId);
    if (!asset || !assetCountsTowardRegisterTotal(member.assetId, memberships)) return sum;
    const value = Number(asset.value ?? 0);
    return sum + (Number.isFinite(value) ? Math.round(value) : 0);
  }, 0);
}

export function decorateAssetsWithGroups<T extends GroupAwareAsset>(
  assets: T[],
  groups: AssetGroup[],
): Array<T & { assetGroup: AssetGroupExportMeta | null }> {
  const memberships = buildAssetGroupMembershipMap(groups);

  return assets.map((asset) => {
    const membership = memberships.get(asset.id);

    if (!membership) {
      return { ...asset, assetGroup: null };
    }

    return {
      ...asset,
      assetGroup: {
        id: membership.group.id,
        name: membership.group.name,
        role: membership.member.role,
        relationship: membership.member.relationship,
        valueMode: membership.group.valueMode,
        primaryAssetId: getAssetGroupPrimaryAssetId(membership.group),
        memberCount: membership.group.members.length,
      },
    };
  });
}

export function orderAssetsByGroups<T extends { id: string }>(assets: T[], groups: AssetGroup[]): T[] {
  if (!groups.length || assets.length < 2) return assets;

  const originalIndex = new Map(assets.map((asset, index) => [asset.id, index]));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const membershipByAssetId = buildAssetGroupMembershipMap(groups);
  const emittedGroups = new Set<string>();
  const ordered: T[] = [];

  assets.forEach((asset) => {
    const membership = membershipByAssetId.get(asset.id);

    if (!membership) {
      ordered.push(asset);
      return;
    }

    if (emittedGroups.has(membership.group.id)) {
      return;
    }

    emittedGroups.add(membership.group.id);

    membership.group.members
      .slice()
      .sort((left, right) => {
        if (left.role !== right.role) return left.role === 'primary' ? -1 : 1;
        if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
        return (originalIndex.get(left.assetId) ?? Number.MAX_SAFE_INTEGER)
          - (originalIndex.get(right.assetId) ?? Number.MAX_SAFE_INTEGER);
      })
      .forEach((member) => {
        const memberAsset = assetById.get(member.assetId);
        if (memberAsset) ordered.push(memberAsset);
      });
  });

  return ordered;
}
