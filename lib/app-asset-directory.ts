import type { AssetGroup } from './asset-groups-shared';

export type AppAssetDirectoryGroup = {
  id: string;
  name: string;
  primaryAssetId: string;
  memberAssetIds: string[];
  memberCount: number;
};

export function buildAppAssetDirectoryGroups(
  groups: AssetGroup[],
  visibleAssetIds: Iterable<string>,
): AppAssetDirectoryGroup[] {
  const visible = new Set(visibleAssetIds);

  return groups
    .map((group) => {
      const memberAssetIds = group.members
        .filter((member) => visible.has(member.assetId))
        .map((member) => member.assetId);
      const visiblePrimary = group.members.find((member) => (
        member.role === 'primary' && visible.has(member.assetId)
      ))?.assetId;

      return {
        id: group.id,
        name: group.name,
        primaryAssetId: visiblePrimary || memberAssetIds[0] || '',
        memberAssetIds,
        memberCount: memberAssetIds.length,
      };
    })
    .filter((group) => group.memberCount > 0)
    .sort((left, right) => (
      left.name.localeCompare(right.name, 'en-ZA', { sensitivity: 'base' })
      || left.id.localeCompare(right.id)
    ));
}
