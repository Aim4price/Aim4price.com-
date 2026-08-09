import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function loadGroupHelpers() {
  const source = await readFile(new URL('../lib/asset-groups-shared.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function('module', 'exports', output)(loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const assets = [
  { id: 'trailer', value: 150_000 },
  { id: 'unrelated', value: 75_000 },
  { id: 'truck', value: 122_400 },
  { id: 'bowser', value: 200_000 },
];

function group(valueMode) {
  return {
    id: `group-${valueMode}`,
    userId: 'owner-1',
    registerId: 'register-1',
    name: 'Farm Transport Set',
    valueMode,
    members: [
      { assetId: 'trailer', role: 'linked', relationship: 'attached_to', sortOrder: 2 },
      { assetId: 'truck', role: 'primary', relationship: 'primary', sortOrder: 1 },
      { assetId: 'bowser', role: 'linked', relationship: 'works_with', sortOrder: 3 },
    ],
    createdAtIso: '2026-08-09T00:00:00.000Z',
    updatedAtIso: '2026-08-09T00:00:00.000Z',
  };
}

test('separate-value groups count every member and order the primary first', async () => {
  const helpers = await loadGroupHelpers();
  const separateGroup = group('separate');
  assert.equal(helpers.registerValueForAssets(assets, [separateGroup]), 547_400);
  assert.equal(helpers.groupRegisterValue(separateGroup, assets), 472_400);
  assert.deepEqual(
    helpers.orderAssetsByGroups(assets, [separateGroup]).map((asset) => asset.id),
    ['truck', 'trailer', 'bowser', 'unrelated'],
  );
  assert.deepEqual(
    helpers.orderAssetsByGroups(
      [assets[1], assets[0], assets[2], assets[3]],
      [separateGroup],
    ).map((asset) => asset.id),
    ['truck', 'trailer', 'bowser', 'unrelated'],
  );
});

test('included-in-primary groups prevent register-value double counting', async () => {
  const helpers = await loadGroupHelpers();
  const includedGroup = group('included_in_primary');
  const memberships = helpers.buildAssetGroupMembershipMap([includedGroup]);
  assert.equal(helpers.registerValueForAssets(assets, memberships), 197_400);
  assert.equal(helpers.groupRegisterValue(includedGroup, assets), 122_400);
  assert.equal(helpers.assetCountsTowardRegisterTotal('truck', memberships), true);
  assert.equal(helpers.assetCountsTowardRegisterTotal('trailer', memberships), false);
});

test('combined umbrellas split safely by visible register and resolve for a single visible member', async () => {
  const helpers = await loadGroupHelpers();
  const combinedGroup = {
    ...group('separate'),
    id: 'combined-group',
    registerId: null,
  };

  const registerOneProjection = helpers.projectAssetGroupsToAssets(
    [combinedGroup],
    [{ id: 'trailer' }, { id: 'bowser' }],
  );
  assert.equal(registerOneProjection.length, 1);
  assert.equal(registerOneProjection[0].registerId, null);
  assert.deepEqual(
    registerOneProjection[0].members.map((member) => [member.assetId, member.role, member.relationship]),
    [
      ['trailer', 'primary', 'primary'],
      ['bowser', 'linked', 'works_with'],
    ],
  );

  assert.deepEqual(
    helpers.projectAssetGroupsToAssets([combinedGroup], [{ id: 'truck' }]),
    [],
  );
});

test('group persistence validates ownership, membership, and safe unlink behavior', async () => {
  const [persistence, schema] = await Promise.all([
    readFile(new URL('../lib/asset-groups.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/asset-registers.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(persistence, /ASSET_GROUP_REGISTER_MISMATCH/);
  assert.match(persistence, /ASSET_GROUP_ALREADY_LINKED/);
  assert.match(schema, /unique \(asset_id\)/);
  assert.match(schema, /unlink_asset_group_on_register_change/);
  assert.match(schema, /role = 'primary'/);
  assert.match(schema, /alter column register_id drop not null/);
  assert.match(schema, /asset_group\.register_id is not null/);
  assert.match(persistence, /register_id is null/);
  assert.match(persistence, /value_mode = case when \$3::boolean then 'separate'/);
});

test('group metadata and counted-value rules are present in PDF and Excel exports', async () => {
  const source = await readFile(new URL('../app/api/asset-register/export/route.ts', import.meta.url), 'utf8');
  assert.match(source, /name: 'Asset Groups'/);
  assert.match(source, /Counts in register total/);
  assert.match(source, /const COUNTS_IN_REGISTER_TOTAL_COLUMN = 'AC'/);
  assert.match(source, /SUMIF\(\$\{countsInRegisterTotalRange\},"Yes"/);
  assert.match(source, /drawPdfAssetGroupHeading/);
  assert.match(source, /Accounting note/);
  assert.match(source, /scope === 'combined'/);
  assert.match(source, /projectAssetGroupsToAssets\(allGroups, combinedAssets\)/);
});

test('the Asset Register exposes create, manage, collapse, search, and relationship UI', async () => {
  const [client, modal] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(client, /AssetGroupManagerModal/);
  assert.match(client, /toggleAssetGroupCollapsed/);
  assert.match(client, /matchingGroupAssetIds/);
  assert.match(client, /Counted value/);
  assert.match(modal, /Count every asset separately/);
  assert.match(modal, /Linked assets are included in the primary value/);
  assert.match(modal, /The assets and their records will not be deleted|Remove group/);
  assert.match(client, /combinedMode=\{isCombinedRegisterView\}/);
  assert.match(client, /isResolvedCombinedGroup/);
  assert.match(modal, /Combined umbrella/);
  assert.match(modal, /any of your Asset Registers/);
});

test('quick controls use clear chevrons, balanced spacing, and concise hover labels', async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
  ]);
  assert.match(client, /data-tooltip=\{primaryIsFlagged \? 'Remove flag' : 'Flag asset'\}/);
  assert.match(client, /data-tooltip="Move asset"/);
  assert.match(client, /isResolvedCombinedGroup \? 'Open combined group' : 'Create group'/);
  assert.match(client, /'Show excl\. VAT' : 'Show incl\. VAT'/);
  assert.match(client, /ChevronDownIcon className=\{styles\.assetGroupCollapseChevron\}/);
  assert.match(client, /styles\.assetDetailsChevron/);
  assert.doesNotMatch(client, /<span aria-hidden="true">\{isCollapsed \? '⌄' : '⌃'\}<\/span>/);
  assert.match(styles, /\.assetSideActions,\s*\.assetGroupSideActions \{\s*gap: 0\.3rem;\s*padding: 0\.28rem;/);
  assert.match(styles, /\.controlTooltip::after[\s\S]*?content: attr\(data-tooltip\)/);
  assert.match(styles, /\.cardViewDetailsButton \.assetDetailsChevron/);
  assert.match(styles, /\[aria-expanded="true"\] \.customSelectChevron/);
});

test('assets can be dragged into groups without breaking group integrity', async () => {
  const [client, route, persistence, styles] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/asset-groups/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/asset-groups.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
  ]);
  assert.match(client, /draggable=\{canManageAssetGroups && !isSavingAssetGroup\}/);
  assert.match(client, /method: 'PATCH'/);
  assert.match(client, /Drop asset here/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /moveAssetToGroup/);
  assert.match(persistence, /sourceMemberCount <= 2/);
  assert.match(persistence, /set role = 'primary', relationship = 'primary'/);
  assert.match(persistence, /'linked',\s*'works_with'/);
  assert.match(styles, /\.assetGroupHeaderRowDropTarget \.assetGroupHeader/);
});

test('the Switch flow can move an asset into an available umbrella', async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /type AssetMoveDestination = 'register' \| 'umbrella'/);
  assert.match(client, /label="Target umbrella"/);
  assert.match(client, /Move to Umbrella/);
  assert.match(client, /buildAssetGroupsApiUrl\(accountantShareId, undefined, combinedScope\)/);
  assert.match(client, /targetGroupId: targetGroup\.id/);
  assert.match(client, /group\.registerId === null\s*\? group/);
  assert.match(styles, /\.assetRegisterMoveDestinationTabs/);
  assert.match(styles, /\.assetRegisterMoveDestinationTabActive/);
});

test('umbrellas stay first, start folded, and expose their unnoted alert count', async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /const \[expandedAssetGroupIds, setExpandedAssetGroupIds\] = useState<Set<string>>\(\(\) => new Set\(\)\)/);
  assert.match(client, /group && !expandedAssetGroupIds\.has\(group\.id\)/);
  assert.match(client, /const isCollapsed = !expandedAssetGroupIds\.has\(group\.id\)/);
  assert.match(client, /const groupUnnotedAlertCount = group\.members\.reduce/);
  assert.match(client, /assetUnnotedAlertCount\(memberAsset\)/);
  assert.match(client, /styles\.registerChangeAlertBadge.*styles\.assetGroupAlertBadge/);
  assert.match(styles, /\.assetGroupUmbrella \{[\s\S]*?position: relative;[\s\S]*?overflow: visible;/);
  assert.match(styles, /\.assetGroupAlertBadge \{/);
});

test('View details stays on one line inside grouped cards', async () => {
  const styles = await readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8');
  assert.match(
    styles,
    /\.page \.assetHeaderActions \.cardViewDetailsButton > span \{[\s\S]*?white-space: nowrap !important;/,
  );
  assert.match(
    styles,
    /\.page \.assetHeaderActions \.cardOptionsButton,[\s\S]*?\.cardViewDetailsButton,[\s\S]*?\.cardManageButton \{[\s\S]*?height: 3\.35rem;/,
  );
  assert.match(styles, /width: min\(32rem, 100%\)/);
});

test('combined Asset Register groups are account-wide, separately counted, and projected in every output', async () => {
  const [route, client, persistence, exportRoute, accountantWorkspace] = await Promise.all([
    readFile(new URL('../app/api/asset-groups/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../lib/asset-groups.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/asset-register/export/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/accountant-workspace.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(route, /isCombinedGroupRequest/);
  assert.match(route, /scope: combined \? 'combined' : 'register'/);
  assert.match(persistence, /const storedRegisterId = registerId \|\| null/);
  assert.match(persistence, /const valueMode = isCombinedScope \? 'separate'/);
  assert.match(client, /projectAssetGroupsToAssets\(assetGroups, assets\)/);
  assert.match(client, /window\.location\.assign\('\/asset-register\?scope=combined'\)/);
  assert.match(client, /reportAssetGroups = projectAssetGroupsToAssets\(assetGroups, reportAssets\)/);
  assert.match(exportRoute, /combinedGroups = scope === 'combined'/);
  assert.match(accountantWorkspace, /projectAssetGroupsToAssets/);
});
