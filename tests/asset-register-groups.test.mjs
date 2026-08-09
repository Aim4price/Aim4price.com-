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
});

test('group metadata and counted-value rules are present in PDF and Excel exports', async () => {
  const source = await readFile(new URL('../app/api/asset-register/export/route.ts', import.meta.url), 'utf8');
  assert.match(source, /name: 'Asset Groups'/);
  assert.match(source, /Counts in register total/);
  assert.match(source, /const COUNTS_IN_REGISTER_TOTAL_COLUMN = 'AC'/);
  assert.match(source, /SUMIF\(\$\{countsInRegisterTotalRange\},"Yes"/);
  assert.match(source, /drawPdfAssetGroupHeading/);
  assert.match(source, /Accounting note/);
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
});

test('quick controls use clear chevrons, balanced spacing, and concise hover labels', async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
  ]);
  assert.match(client, /data-tooltip=\{primaryIsFlagged \? 'Remove flag' : 'Flag asset'\}/);
  assert.match(client, /data-tooltip="Move asset"/);
  assert.match(client, /data-tooltip=\{canManageAssetGroups \? 'Create group' : 'Groups unavailable'\}/);
  assert.match(client, /'Show excl\. VAT' : 'Show incl\. VAT'/);
  assert.match(client, /ChevronDownIcon className=\{styles\.assetGroupCollapseChevron\}/);
  assert.match(client, /styles\.assetDetailsChevron/);
  assert.doesNotMatch(client, /<span aria-hidden="true">\{isCollapsed \? '⌄' : '⌃'\}<\/span>/);
  assert.match(styles, /\.assetSideActions,\s*\.assetGroupSideActions \{\s*gap: 0\.3rem;\s*padding: 0\.28rem;/);
  assert.match(styles, /\.controlTooltip::after[\s\S]*?content: attr\(data-tooltip\)/);
  assert.match(styles, /\.cardViewDetailsButton \.assetDetailsChevron/);
  assert.match(styles, /\[aria-expanded="true"\] \.customSelectChevron/);
});
