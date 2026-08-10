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

test('folded umbrellas occupy one page slot and expanded umbrellas stay intact', async () => {
  const helpers = await loadGroupHelpers();
  const groupedAssets = Array.from({ length: 7 }, (_, index) => ({
    id: `grouped-${index + 1}`,
    value: 1_000,
  }));
  const standaloneAssets = Array.from({ length: 5 }, (_, index) => ({
    id: `standalone-${index + 1}`,
    value: 1_000,
  }));
  const umbrella = {
    ...group('separate'),
    id: 'seven-asset-umbrella',
    members: groupedAssets.map((asset, index) => ({
      assetId: asset.id,
      role: index === 0 ? 'primary' : 'linked',
      relationship: index === 0 ? 'primary' : 'works_with',
      sortOrder: index + 1,
    })),
  };
  const entries = helpers.buildAssetGroupPageEntries(
    helpers.orderAssetsByGroups([...groupedAssets, ...standaloneAssets], [umbrella]),
    [umbrella],
  );

  assert.equal(entries.length, 6);
  assert.equal(entries[0].kind, 'group');
  assert.equal(entries[0].assets.length, 7);
  assert.equal(
    entries.reduce(
      (count, entry) => count + helpers.assetGroupPageEntryDisplayCount(entry, new Set()),
      0,
    ),
    6,
  );

  const expandedGroupIds = new Set([umbrella.id]);
  const expandedPages = helpers.paginateAssetGroupPageEntries(entries, 12, expandedGroupIds);
  assert.equal(expandedPages.length, 1);
  assert.equal(
    expandedPages[0].reduce(
      (count, entry) => count + helpers.assetGroupPageEntryDisplayCount(entry, expandedGroupIds),
      0,
    ),
    12,
  );
  assert.deepEqual(expandedPages[0][0].assets.map((asset) => asset.id), groupedAssets.map((asset) => asset.id));
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

test('umbrella membership is not capped at 50 assets', async () => {
  const [persistence, route, client] = await Promise.all([
    readFile(new URL('../lib/asset-groups.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/asset-groups/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(persistence, /MAX_GROUP_MEMBERS|ASSET_GROUP_TOO_MANY_MEMBERS/);
  assert.doesNotMatch(route, /ASSET_GROUP_TOO_MANY_MEMBERS|at most 50 assets/);
  assert.doesNotMatch(client, /members\.length\s*[<>]=?\s*50/);
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
  assert.match(modal, /without deleting their records|linked asset records[\s\S]*?will remain unchanged/);
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
  assert.match(client, /data-tooltip="Switch assets"/);
  assert.match(client, /isResolvedCombinedGroup \? 'Open combined group' : 'Create group'/);
  assert.match(client, /'Show excl\. VAT' : 'Show incl\. VAT'/);
  assert.match(client, /className=\{`\$\{styles\.assetHeaderActions\} \$\{styles\.assetGroupHeaderActions\}`\}/);
  assert.match(client, /data-tooltip=\{isCollapsed \? 'View details' : 'Hide details'\}/);
  assert.match(client, /styles\.assetDetailsChevron/);
  assert.doesNotMatch(client, /assetGroupCollapseButton|assetGroupCollapseChevron/);
  assert.doesNotMatch(client, /<span aria-hidden="true">\{isCollapsed \? '⌄' : '⌃'\}<\/span>/);
  assert.match(styles, /\.assetSideActions,\s*\.assetGroupSideActions \{\s*gap: 0\.3rem;\s*padding: 0\.28rem;/);
  assert.match(styles, /\.controlTooltip::after[\s\S]*?content: attr\(data-tooltip\)/);
  assert.match(styles, /\.cardViewDetailsButton \.assetDetailsChevron/);
  assert.match(styles, /\[aria-expanded="true"\] \.customSelectChevron/);
});

test('umbrella cards expose aligned actions and the Manage modal uses a clear option-card menu', async () => {
  const [client, modal, styles] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /onClick=\{\(\) => openAssetGroupShare\(group\)\}/);
  assert.match(client, /onClick=\{\(\) => toggleAssetGroupCollapsed\(group\.id\)\}/);
  assert.match(client, /onClick=\{\(\) => primaryAsset && openAssetGroupManager\(primaryAsset\)\}/);
  assert.match(client, /<span>Share<\/span>[\s\S]*?<span>\{isCollapsed \? 'View details' : 'Hide details'\}<\/span>[\s\S]*?<span>Manage<\/span>/);
  assert.match(styles, /\.page \.assetGroupHeaderActions \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(modal, /Manage assets/);
  assert.match(modal, /Umbrella settings/);
  assert.match(modal, /Download reports/);
  assert.match(modal, /Remove umbrella/);
  assert.match(modal, /Download PDF/);
  assert.match(modal, /Download Excel/);
});

test('the umbrella Manage modal matches the application option-card pattern', async () => {
  const [modal, modalStyles] = await Promise.all([
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.module.css', import.meta.url), 'utf8'),
  ]);

  assert.match(modal, /view === 'menu'/);
  assert.match(modal, /className=\{`\$\{styles\.menuAction\} \$\{styles\.menuActionPrimary\}`\}/);
  assert.match(modal, /className=\{`\$\{styles\.menuAction\} \$\{styles\.menuActionDanger\}`\}/);
  assert.match(modal, /Ungroup the assets without deleting their records/);
  assert.match(modal, /Only assets linked to \{group\.name\} are included/);
  assert.match(modalStyles, /\.menuGrid,[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(modalStyles, /\.menuAction,[\s\S]*?\.reportMenuAction \{[\s\S]*?min-height: 112px;[\s\S]*?border-radius: 22px;/);
  assert.match(modalStyles, /\.menuActionDanger \{[\s\S]*?border-color: #ffb4ae;/);
});

test('umbrella sharing and downloads are limited to linked assets', async () => {
  const [client, exportRoute] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/asset-register/export/route.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /const assetGroupShareAssets = useMemo/);
  assert.match(client, /source: isAssetGroupShare \? 'asset_group' : 'full_asset_register'/);
  assert.match(client, /snapshotType: isAssetGroupShare \? 'asset_group' : 'full_asset_register'/);
  assert.match(client, /without exposing unrelated assets/);
  assert.match(client, /onDownloadPdf=\{handleDownloadAssetGroupPdf\}/);
  assert.match(client, /onDownloadXlsx=\{handleDownloadAssetGroupXlsx\}/);
  assert.match(client, /params\.set\('groupId', groupId\.trim\(\)\)/);
  assert.match(exportRoute, /const requestedGroupId = cleanText\(params\.get\('groupId'\)\)/);
  assert.match(exportRoute, /requestedGroupAssetIds\.has\(item\.id\)/);
  assert.match(exportRoute, /scopedRawBundles/);
});

test('umbrella-aware pagination expands tiers and the full header toggles the group', async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /buildAssetGroupPageEntries\(groupedFilteredAssets, displayAssetGroups\)/);
  assert.match(client, /paginateAssetGroupPageEntries\(registerPaginationEntries, numericPageSize, expandedAssetGroupIds\)/);
  assert.match(client, /pageSizeForVisibleCardCount\(requiredVisibleCardCount\)/);
  assert.match(client, /visiblePaginationEntries\.flatMap\(\(entry\) => entry\.assets\)/);
  assert.match(client, /target\.closest\('button, a, input, select, textarea, \[role="button"\]'\)/);
  assert.match(client, /onClick=\{\(event\) => \{[\s\S]*?toggleAssetGroupCollapsed\(group\.id\);/);
  assert.match(styles, /\.assetGroupHeader \{[\s\S]*?cursor: pointer;/);
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
