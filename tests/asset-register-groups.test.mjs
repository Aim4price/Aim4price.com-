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

async function loadMaintenanceReportBuilders() {
  const source = await readFile(new URL('../lib/asset-maintenance-report.ts', import.meta.url), 'utf8');
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
      { assetId: 'trailer', role: 'linked', relationship: 'attached_to', countsTowardTotal: valueMode === 'separate', sortOrder: 2 },
      { assetId: 'truck', role: 'primary', relationship: 'primary', countsTowardTotal: true, sortOrder: 1 },
      { assetId: 'bowser', role: 'linked', relationship: 'works_with', countsTowardTotal: valueMode === 'separate', sortOrder: 3 },
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

  const alphaGroup = {
    ...group('separate'),
    id: 'alpha-group',
    name: 'Alpha Equipment',
    members: [
      { assetId: 'unrelated', role: 'primary', relationship: 'primary', countsTowardTotal: true, sortOrder: 0 },
    ],
  };
  assert.deepEqual(
    helpers.orderAssetsByGroups(assets, [separateGroup, alphaGroup]).map((asset) => asset.id),
    ['unrelated', 'truck', 'trailer', 'bowser'],
  );
});

test('umbrellas stay visible and unpaginated while standalone assets move between pages', async () => {
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
      countsTowardTotal: true,
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

  const expandedPages = helpers.paginateAssetGroupPageEntries(entries, 2, new Set([umbrella.id]));
  assert.equal(expandedPages.length, 3);
  assert.ok(expandedPages.every((page) => page[0].kind === 'group'));
  assert.ok(expandedPages.every((page) => page[0].group.id === umbrella.id));
  assert.ok(expandedPages.every((page) => (
    page[0].assets.map((asset) => asset.id).join(',') === groupedAssets.map((asset) => asset.id).join(',')
  )));
  assert.deepEqual(
    expandedPages.flatMap((page) => page.filter((entry) => entry.kind === 'asset').map((entry) => entry.asset.id)),
    standaloneAssets.map((asset) => asset.id),
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

test('ordinary umbrellas need no primary and count every grouped asset by default', async () => {
  const helpers = await loadGroupHelpers();
  const tractorGroup = {
    ...group('separate'),
    id: 'tractor-group',
    name: 'Working tractors',
    members: [
      { assetId: 'truck', role: 'member', relationship: 'grouped', countsTowardTotal: true, sortOrder: 0 },
      { assetId: 'trailer', role: 'member', relationship: 'grouped', countsTowardTotal: true, sortOrder: 1 },
      { assetId: 'bowser', role: 'member', relationship: 'grouped', countsTowardTotal: true, sortOrder: 2 },
    ],
  };

  assert.equal(helpers.getAssetGroupPrimaryAssetId(tractorGroup), '');
  assert.equal(helpers.groupRegisterValue(tractorGroup, assets), 472_400);
  assert.equal(helpers.assetGroupValueModeLabel(tractorGroup), 'Every asset counted');
});

test('any member can be excluded without requiring a primary asset', async () => {
  const helpers = await loadGroupHelpers();
  const groupedWithOneExcluded = {
    ...group('separate'),
    id: 'grouped-with-one-excluded',
    members: [
      { assetId: 'truck', role: 'member', relationship: 'grouped', countsTowardTotal: true, sortOrder: 0 },
      { assetId: 'trailer', role: 'member', relationship: 'grouped', countsTowardTotal: false, sortOrder: 1 },
      { assetId: 'bowser', role: 'member', relationship: 'grouped', countsTowardTotal: true, sortOrder: 2 },
    ],
  };

  assert.equal(helpers.getAssetGroupPrimaryAssetId(groupedWithOneExcluded), '');
  assert.equal(helpers.groupRegisterValue(groupedWithOneExcluded, assets), 322_400);
  assert.equal(helpers.assetGroupValueModeLabel(groupedWithOneExcluded), '2 of 3 assets counted');
});

test('a primary may include linked values while other independent assets still count', async () => {
  const helpers = await loadGroupHelpers();
  const buildingGroup = {
    ...group('separate'),
    id: 'building-group',
    members: [
      { assetId: 'truck', role: 'primary', relationship: 'primary', countsTowardTotal: true, sortOrder: 0 },
      { assetId: 'trailer', role: 'linked', relationship: 'component_of', countsTowardTotal: false, sortOrder: 1 },
      { assetId: 'bowser', role: 'member', relationship: 'grouped', countsTowardTotal: true, sortOrder: 2 },
    ],
  };

  assert.equal(helpers.getAssetGroupPrimaryAssetId(buildingGroup), 'truck');
  assert.equal(helpers.groupRegisterValue(buildingGroup, assets), 322_400);
  assert.equal(helpers.assetCountsTowardRegisterTotal('trailer', [buildingGroup]), false);
  assert.equal(helpers.assetCountsTowardRegisterTotal('bowser', [buildingGroup]), true);
});

test('combined and one-asset umbrellas remain visible in their Asset Registers', async () => {
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
      ['trailer', 'linked', 'attached_to'],
      ['bowser', 'linked', 'works_with'],
    ],
  );

  const singleAssetProjection = helpers.projectAssetGroupsToAssets([combinedGroup], [{ id: 'truck' }]);
  assert.equal(singleAssetProjection.length, 1);
  assert.deepEqual(singleAssetProjection[0].members.map((member) => member.assetId), ['truck']);
  const singleAssetEntries = helpers.buildAssetGroupPageEntries([{ id: 'truck' }], singleAssetProjection);
  assert.equal(singleAssetEntries.length, 1);
  assert.equal(singleAssetEntries[0].kind, 'group');
});

test('group persistence validates ownership, optional primaries, per-member counting, and safe unlink behavior', async () => {
  const [persistence, schema, migration] = await Promise.all([
    readFile(new URL('../lib/asset-groups.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/asset-registers.ts', import.meta.url), 'utf8'),
    readFile(new URL('../database/migrations/72-asset-group-member-value-counting.sql', import.meta.url), 'utf8'),
  ]);
  assert.match(persistence, /ASSET_GROUP_REGISTER_MISMATCH/);
  assert.match(persistence, /detachAssetsFromOtherGroups/);
  assert.match(persistence, /memberIds\.length < 1/);
  assert.match(schema, /unique \(asset_id\)/);
  assert.match(schema, /unlink_asset_group_on_register_change/);
  assert.match(schema, /role = 'primary'/);
  assert.match(schema, /counts_toward_total boolean not null default true/);
  assert.match(schema, /role in \('primary', 'linked', 'member'\)/);
  assert.match(schema, /relationship in \('primary', 'grouped'/);
  assert.match(schema, /alter column register_id drop not null/);
  assert.match(schema, /asset_group\.register_id is not null/);
  assert.match(schema, /\) < 1;/);
  assert.match(persistence, /register_id is null/);
  assert.match(persistence, /countsTowardTotalByAssetId/);
  assert.match(persistence, /'member',\s*'grouped',\s*true/);
  assert.doesNotMatch(persistence, /ASSET_GROUP_PRIMARY_REQUIRED/);
  assert.doesNotMatch(persistence, /set role = 'primary', relationship = 'primary'/);
  assert.match(migration, /counts_toward_total/);
  assert.match(migration, /value_mode = 'included_in_primary' THEN member\.role = 'primary'/);
  assert.match(migration, /ELSE 'member'/);
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
  assert.match(source, /const COUNTS_IN_REGISTER_TOTAL_COLUMN = 'AB'/);
  assert.doesNotMatch(source, /Group relationship|textCell\('Relationship', 'tableHeader'\)/);
  assert.match(source, /SUMIF\(\$\{countsInRegisterTotalRange\},"Yes"/);
  assert.match(source, /drawPdfAssetGroupHeading/);
  assert.match(source, /Accounting note/);
  assert.match(source, /scope === 'combined'/);
  assert.match(source, /projectAssetGroupsToAssets\(allGroups, combinedAssets\)/);
});

test('the Asset Register exposes create, manage, collapse, search, and clear umbrella counting rules', async () => {
  const [client, modal] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(client, /AssetGroupManagerModal/);
  assert.match(client, /toggleAssetGroupCollapsed/);
  assert.match(client, /document\.addEventListener\('pointerdown', handleOutsideUmbrellaPointerDown\)/);
  assert.match(client, /clickedUmbrella\?\.dataset\.assetGroupId === focusedAssetGroupId/);
  assert.match(client, /data-asset-group-id=\{group\.id\}/);
  assert.match(client, /data-asset-group-id=\{assetGroup\?\.id\}/);
  assert.match(client, /matchingGroupAssetIds/);
  assert.match(client, /Counted value/);
  assert.match(modal, /No primary asset/);
  assert.match(modal, /Choose a primary asset/);
  assert.match(modal, /Every asset is added to the total by default/);
  assert.match(modal, /Primary asset: add to total/);
  assert.match(modal, /Linked to primary: do not add again/);
  assert.match(modal, /Do not add to umbrella total/);
  assert.doesNotMatch(modal, /label="Relationship"|RELATIONSHIP_OPTIONS|assetGroupRelationshipLabel/);
  assert.match(modal, /without deleting their records|grouped asset records[\s\S]*?will remain unchanged/);
  assert.match(client, /combinedMode=\{isCombinedRegisterView\}/);
  assert.match(client, /isResolvedCombinedGroup/);
  assert.match(modal, /Combined value represented by this umbrella/);
  assert.match(modal, /any of your Asset Registers/);
});

test('quick controls use clear chevrons, balanced spacing, and concise hover labels', async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
  ]);
  assert.match(client, /data-tooltip=\{isFlagged \? 'Remove flag' : 'Flag asset'\}/);
  assert.match(client, /data-tooltip="Move asset"/);
  assert.match(client, /data-tooltip="Switch assets"/);
  assert.match(client, /assetGroup\s+\? 'Manage umbrella'/);
  assert.match(client, /isResolvedCombinedGroup\s+\? 'Open combined umbrella'/);
  assert.match(client, /:\s+'Create umbrella'/);
  assert.match(client, /'Show excl\. VAT' : 'Show incl\. VAT'/);
  assert.match(client, /className=\{`\$\{styles\.assetHeaderActions\} \$\{styles\.assetGroupHeaderActions\}`\}/);
  assert.match(client, /data-tooltip=\{isCollapsed \? 'View details' : 'Hide details'\}/);
  assert.match(client, /styles\.assetDetailsChevron/);
  assert.doesNotMatch(client, /assetGroupCollapseButton|assetGroupCollapseChevron/);
  assert.doesNotMatch(client, /<span aria-hidden="true">\{isCollapsed \? '⌄' : '⌃'\}<\/span>/);
  assert.match(styles, /\.assetGroupMemberActions\.assetSideActions/);
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
  assert.match(client, /const groupAnchorAsset = assetsById\.get\(primaryAssetId\)/);
  assert.match(client, /onClick=\{\(\) => groupAnchorAsset && openAssetGroupManager\(groupAnchorAsset\)\}/);
  assert.match(client, /<span>Share<\/span>[\s\S]*?<span>\{isCollapsed \? 'View details' : 'Hide details'\}<\/span>[\s\S]*?<span>Manage<\/span>/);
  assert.match(styles, /\.page \.assetGroupHeaderActions \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(client, /<strong>Counted value \{money\(displayedGroupValue\)\}<\/strong>/);
  assert.doesNotMatch(client, /styles\.assetGroupValueLabel|styles\.assetGroupValueVat/);
  assert.match(styles, /\.assetGroupValue \{[\s\S]*?gap: 0\.18rem;[\s\S]*?text-align: right;/);
  assert.match(styles, /\.assetGroupValue strong \{[\s\S]*?font-size: clamp\(0\.96rem, 1\.25vw, 1\.15rem\);/);
  assert.match(modal, /Edit umbrella/);
  assert.match(modal, /<strong>Manage umbrella<\/strong>/);
  assert.match(modal, /Name, structure and assets/);
  assert.match(modal, /Umbrella name/);
  assert.match(modal, /Choose the umbrella structure/);
  assert.match(modal, /Choose assets/);
  assert.match(modal, /Download reports/);
  assert.match(modal, /Remove umbrella/);
  assert.match(modal, /PDF report/);
  assert.match(modal, /XLSX workbook/);
});

test('the umbrella Manage modal reuses the readable asset Manage and report-format patterns', async () => {
  const [modal, modalStyles, registerStyles] = await Promise.all([
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.module.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
  ]);

  assert.match(modal, /view === 'menu'/);
  assert.match(modal, /import registerStyles from '\.\.\/\.\.\/app\/asset-register\/page\.module\.css'/);
  assert.match(modal, /registerStyles\.optionsModal/);
  assert.match(modal, /registerStyles\.modalOverlay/);
  assert.match(modal, /registerStyles\.optionFeaturedButton/);
  assert.match(modal, /registerStyles\.optionDangerButton/);
  assert.match(modal, /Ungroup without deleting assets/);
  assert.match(modal, /Download umbrella valuation/);
  assert.match(modal, /Download maintenance report/);
  assert.match(modal, /Download fuel report/);
  assert.match(modal, /Download depreciation log/);
  assert.match(modal, /Download cost of ownership report/);
  assert.doesNotMatch(modal, /Saved documents|href="\/documents"/);
  assert.match(modal, /registerStyles\.modalCloseButton/);
  assert.match(modal, /registerStyles\.assetTimelineFormatGrid/);
  assert.match(modal, /registerStyles\.modalCard/);
  assert.match(modal, /src="\/brand\/pdf\.png"/);
  assert.match(modal, /src="\/brand\/sheet\.png"/);
  assert.match(modal, /registerStyles\.assetTimelineSecondaryButton/);
  assert.match(modal, /function AssetGroupMemberSelect/);
  assert.match(modal, /createPortal/);
  assert.match(modal, /type AssetGroupEditorStep = 1 \| 2 \| 3/);
  assert.match(modal, /function AssetGroupEditorProgress/);
  assert.match(modal, /Complete one short step at a time/);
  assert.match(modal, /editorStep === 1/);
  assert.match(modal, /editorStep === 2/);
  assert.match(modal, /editorStep === 3/);
  assert.match(modal, /editorStep < 3 \? 'Next'/);
  assert.match(modal, /hasPrimaryAsset \? 'Role and value' : 'Value in total'/);
  assert.match(modal, /countsTowardTotalByAssetId/);
  assert.match(modal, /primaryAssetId: hasPrimaryAsset \? primaryAssetId : null/);
  assert.doesNotMatch(modal, /label="Relationship"|RELATIONSHIP_OPTIONS|assetGroupRelationshipLabel/);
  assert.doesNotMatch(modal, /<select value=\{asset\.id === primaryAssetId/);
  assert.match(modalStyles, /\.memberSelectMenu \{[\s\S]*?position: fixed;[\s\S]*?z-index: 1400;/);
  assert.match(modalStyles, /\.memberSelectOptionActive/);
  assert.match(modalStyles, /\.wizardProgress \{[\s\S]*?display: flex;[\s\S]*?width: 100%;[\s\S]*?max-width: none;/);
  assert.match(modalStyles, /\.wizardProgressStep:not\(:last-child\)::after \{[\s\S]*?flex: 1 1 auto;[\s\S]*?margin: 0 18px;/);
  assert.match(modalStyles, /\.manageMenuGrid \.manageMenuDanger \{[\s\S]*?grid-column: 1 \/ -1;/);
  assert.doesNotMatch(modalStyles, /\.wizardPanel \{[\s\S]*?min-height: clamp\(20rem, 43vh, 29rem\)/);
  assert.match(modalStyles, /\.wizardFooter/);
  assert.match(modalStyles, /\.stepNumber \{[\s\S]*?width: 46px;[\s\S]*?height: 46px;/);
  assert.match(modalStyles, /\.stepCopy strong \{[\s\S]*?font-size: 19px/);
  assert.match(modalStyles, /\.manageHeader h3 \{[\s\S]*?font-size: clamp\(2rem, 3\.1vw, 2\.65rem\)/);
  assert.match(modalStyles, /\.manageMenuGrid \.manageMenuAction strong \{[\s\S]*?font-size: 1\.12rem/);
  assert.match(modalStyles, /\.manageMenuGrid \.manageMenuAction \.menuOptionSubtitle \{[\s\S]*?font-size: 0\.94rem/);
  assert.match(modal, /styles\.manageMenuIconTile/);
  assert.match(modal, /styles\.manageMenuEditIcon/);
  assert.match(modal, /styles\.manageMenuReportIcon/);
  assert.match(modal, /styles\.manageMenuRemoveIcon/);
  assert.match(modal, /<i className=\{`\$\{styles\.manageMenuIconTile\}/);
  assert.doesNotMatch(modal, /<span className=\{`\$\{styles\.manageMenuIconTile\}/);
  assert.match(modalStyles, /\.manageMenuIconTile \{[\s\S]*?grid-column: 1;[\s\S]*?justify-self: center;[\s\S]*?width: 46px;[\s\S]*?height: 46px;[\s\S]*?font-style: normal;/);
  assert.match(modalStyles, /\.manageMenuIconGlyph \{[\s\S]*?width: 24px;[\s\S]*?height: 24px;/);
  assert.doesNotMatch(modal, /MembersIcon className=\{`\$\{registerStyles\.buttonIcon\}/);
  assert.match(modalStyles, /\.backdrop \{/);
  assert.match(registerStyles, /\.ownerCommandModal \.optionsModalHeader h3 \{[\s\S]*?font-size: clamp\(2\.05rem, 3\.25vw, 2\.8rem\)/);
  assert.match(registerStyles, /\.ownerCommandModal \.ownerCommandGrid \.ownerCommandAction strong \{[\s\S]*?font-size: 1\.12rem/);
  assert.match(registerStyles, /\.ownerCommandModal \.ownerCommandGrid \.ownerCommandAction small \{[\s\S]*?font-size: 0\.94rem/);
});

test('umbrella report downloads use custom selectors, clear spacing, and the shared maintenance exporter', async () => {
  const [client, modal, modalStyles, maintenanceRoute] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.module.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/maintenance/report/route.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /return `\/api\/maintenance\/report\?\$\{maintenanceParams\.toString\(\)\}`/);
  assert.match(client, /maintenanceSelection === 'upcoming' \|\| maintenanceSelection === 'done'/);
  assert.match(client, /maintenanceParams\.set\('procedureKind', maintenanceSelection\)/);
  assert.match(modal, /function ReportSelect/);
  assert.match(modal, /Completed maintenance/);
  assert.match(modal, /Checked only/);
  assert.match(modal, /Services only/);
  assert.match(modal, /Repairs only/);
  assert.match(maintenanceRoute, /parseProcedureKind/);
  assert.match(maintenanceRoute, /maintenanceRecordProcedureKind\(record\) === procedureKind/);
  assert.match(modal, /registerStyles\.reportSelectMenu/);
  assert.doesNotMatch(modal, /<select value=\{maintenanceType\}/);
  assert.match(modalStyles, /\.reportActions \{[\s\S]*?margin-top: 1\.75rem !important;[\s\S]*?border-top:/);
});

test('umbrella sharing and downloads are limited to grouped assets', async () => {
  const [client, exportRoute] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/asset-register/export/route.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /const assetGroupShareAssets = useMemo/);
  assert.match(client, /source: isAssetGroupShare \? 'asset_group' : 'full_asset_register'/);
  assert.match(client, /snapshotType: isAssetGroupShare \? 'asset_group' : 'full_asset_register'/);
  assert.match(client, /Unrelated assets stay private/);
  assert.match(client, /onDownloadPdf=\{handleDownloadAssetGroupPdf\}/);
  assert.match(client, /onDownloadXlsx=\{handleDownloadAssetGroupXlsx\}/);
  assert.match(client, /onDownloadReport=\{handleDownloadAssetGroupReport\}/);
  assert.match(client, /new URLSearchParams\(\{ groupId: group\.id, report: reportKind, format \}\)/);
  assert.match(client, /new URLSearchParams\(\{ groupId: group\.id, format \}\)/);
  assert.match(client, /async function handleDownloadAssetGroupPdf[\s\S]*?await handleExportPdf\([\s\S]*?'full',[\s\S]*?groupAssets,[\s\S]*?group\.name/);
  assert.match(client, /async function handleExportPdf[\s\S]*?buildAssetRegisterSummaryReportHtml\(reportPayload\)[\s\S]*?externalShareReportScope === 'register' \|\| externalShareReportScope === 'group'/);
  assert.match(client, /params\.set\('groupId', groupId\.trim\(\)\)/);
  assert.match(exportRoute, /const requestedGroupId = cleanText\(params\.get\('groupId'\)\)/);
  assert.match(exportRoute, /requestedGroupAssetIds\.has\(item\.id\)/);
  assert.match(exportRoute, /scopedRawBundles/);
});

test('umbrella-aware pagination keeps every umbrella visible and the full header toggles the group', async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /buildAssetGroupPageEntries\(groupedFilteredAssets, displayAssetGroups\)/);
  assert.match(client, /paginateAssetGroupPageEntries\(registerPaginationEntries, numericPageSize, expandedAssetGroupIds\)/);
  assert.match(client, /umbrellaPaginationEntryCount/);
  assert.match(client, /Standalone assets per page/);
  assert.match(client, /const registerRangeItems = filteredAssets\.length/);
  assert.match(client, /Standalone assets \$\{pageStart \+ 1\}–\$\{pageEnd\} of \$\{standalonePaginationEntryCount\}/);
  assert.match(client, /className=\{styles\.registerRangeSummary\} aria-label=\{registerRangeDescription\}/);
  assert.match(client, /className=\{styles\.registerRangeItem\}/);
  assert.doesNotMatch(client, / · \$\{filteredAssets\.length\} \$\{filteredAssets\.length === 1 \? 'asset' : 'assets'\}/);
  assert.match(styles, /\.heroTotalFooter \.registerRangeSummary \{[\s\S]*?flex-wrap: wrap !important;[\s\S]*?overflow: visible !important;/);
  assert.match(styles, /\.registerRangeSummary \.registerRangeItem \{[\s\S]*?white-space: nowrap;/);
  assert.doesNotMatch(client, /pageSizeForVisibleCardCount/);
  assert.match(client, /visiblePaginationEntries\.flatMap\(\(entry\) => entry\.assets\)/);
  assert.match(client, /target\.closest\('button, a, input, select, textarea, \[role="button"\]'\)/);
  assert.match(client, /onClick=\{\(event\) => \{[\s\S]*?toggleAssetGroupCollapsed\(group\.id\);/);
  assert.match(client, /const nextExpandedGroupIds = willExpand \? new Set\(\[groupId\]\) : new Set<string>\(\)/);
  assert.match(client, /compareUmbrellaAssetsByAttention/);
  assert.match(client, /assets: \[\.\.\.entry\.assets\]\.sort\(compareUmbrellaAssetsByAttention\)/);
  assert.match(client, /styles\.assetGroupHeaderRowMuted/);
  assert.match(styles, /\.assetGroupHeader \{[\s\S]*?cursor: pointer;/);
  assert.match(styles, /\.assetCardRowMuted,\s*\.assetGroupHeaderRowMuted/);
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
  assert.match(persistence, /sourceMemberCount <= 1/);
  assert.match(persistence, /set role = 'member', relationship = 'grouped'/);
  assert.match(persistence, /'member',\s*'grouped',\s*true/);
  assert.doesNotMatch(persistence, /set role = 'primary', relationship = 'primary'/);
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
  assert.match(client, /group\.registerId === null \|\| !group\.members\.some/);
  assert.match(client, /remainingMembers\.map/);
  assert.match(styles, /\.assetRegisterMoveDestinationTabs/);
  assert.match(styles, /\.assetRegisterMoveDestinationTabActive/);
});

test('umbrellas stay first, sort alphabetically, start folded, and expose their unnoted alert count', async () => {
  const [client, styles, helpers] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
    readFile(new URL('../lib/asset-groups-shared.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /const \[expandedAssetGroupIds, setExpandedAssetGroupIds\] = useState<Set<string>>\(\(\) => new Set\(\)\)/);
  assert.match(client, /const isCollapsed = !expandedAssetGroupIds\.has\(group\.id\)/);
  assert.match(client, /const groupUnnotedAlertCount = group\.members\.reduce/);
  assert.match(client, /assetUnnotedAlertCount\(memberAsset\)/);
  assert.match(client, /styles\.registerChangeAlertBadge.*styles\.assetGroupAlertBadge/);
  assert.match(styles, /\.assetGroupUmbrella \{[\s\S]*?position: relative;[\s\S]*?overflow: visible;/);
  assert.match(styles, /\.assetGroupAlertBadge \{/);
  assert.match(helpers, /left\.group\.name\.localeCompare\(right\.group\.name, 'en-ZA'/);
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

test('combined register creation always chooses a real owning register', async () => {
  const [client, valuationClient, valuationRoute] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/valuation/valuation-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/valuation-runs/route.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /const canAddAssetsToActiveRegister = canUseOwnerOnlyAssetActions/);
  assert.match(client, /if \(isCombinedRegisterView\) \{[\s\S]*?setIsAddAssetDestinationModalOpen\(true\)/);
  assert.match(client, /Choose which Asset Register should own the new asset/);
  assert.match(client, /label="Asset Register"[\s\S]*?options=\{addAssetRegisterOptions\}/);
  assert.match(client, /const destinationRegisterId = String\([\s\S]*?addAssetTargetRegisterId/);
  assert.match(client, /destinationRegisterId === COMBINED_REGISTER_ID/);
  assert.match(client, /registerId: destinationRegisterId \|\| null/);
  assert.match(client, /params\.set\('registerId', targetRegisterId\)/);
  assert.match(valuationClient, /if \(accountantRegisterId\) \{\s*savePayload\.registerId = accountantRegisterId;/);
  assert.match(valuationClient, /registerQuery\.set\('registerId', accountantRegisterId\)/);
  assert.match(valuationRoute, /const targetRegister = targetRegisterId\s*\? await getAssetRegisterForUser/);
  assert.match(valuationRoute, /if \(targetRegisterId && !targetRegister\)/);
});

test('umbrella creation is register-wide while member controls target the physical asset', async () => {
  const [client, modal, styles] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /onClick=\{openCreateAssetGroupManager\}[\s\S]*?<span>Create Umbrella<\/span>/);
  assert.match(client, /open=\{isAssetGroupModalOpen\}/);
  assert.match(modal, /if \(!open\) return null;/);
  assert.doesNotMatch(modal, /if \(!open \|\| !anchorAsset\) return null;/);
  assert.match(modal, /if \(hasPrimaryAsset && !primaryAssetId\) \{[\s\S]*?setPrimaryAssetId\(asset\.id\)/);

  const groupHeaderBlock = client.slice(
    client.indexOf("if (row.kind === 'group')"),
    client.indexOf('const asset = row.asset;'),
  );
  assert.doesNotMatch(groupHeaderBlock, /assetGroupSideActions/);
  assert.match(groupHeaderBlock, /openAssetGroupShare\(group\)/);
  assert.match(groupHeaderBlock, /openAssetGroupManager\(groupAnchorAsset\)/);

  const memberCardBlock = client.slice(
    client.indexOf('assetGroupMemberActions'),
    client.indexOf('<div className={styles.assetHeader}>', client.indexOf('assetGroupMemberActions')),
  );
  assert.match(memberCardBlock, /handleAssetFlagToggle\(asset\)/);
  assert.match(memberCardBlock, /openAssetRegisterMoveManager\(asset\)/);
  assert.match(memberCardBlock, /openAssetGroupManager\(asset\)/);
  assert.match(styles, /\.assetCardRow > \.assetCard \{[\s\S]*?padding-left:/);
  assert.match(styles, /\.assetGroupMemberActions\.assetSideActions/);

  const standaloneActionArea = client.slice(
    client.indexOf('return (', client.indexOf('const isMarkingLicenseRenewalAlertNoted')),
    client.indexOf('<article', client.indexOf('const isMarkingLicenseRenewalAlertNoted')),
  );
  assert.doesNotMatch(standaloneActionArea, /assetSideActions/);

  const sharedInCardActions = client.slice(
    client.indexOf('<article', client.indexOf('const isMarkingLicenseRenewalAlertNoted')),
    client.indexOf('<div className={styles.assetHeader}>', client.indexOf('const isMarkingLicenseRenewalAlertNoted')),
  );
  assert.match(sharedInCardActions, /canUseOwnerOnlyAssetActions \|\| isAccountantWorkspace/);
  assert.match(sharedInCardActions, /styles\.assetGroupMemberActions/);
  assert.match(sharedInCardActions, /assetGroup \|\| isResolvedCombinedGroup/);
  assert.doesNotMatch(modal, /disabled=\{unavailable \|\| asset\.id === anchorAsset\?\.id\}/);
  assert.match(modal, /Currently in \$\{existingGroup\?\.name\} — select to move/);
  assert.match(modal, /selectedAssetIds\.length < 1/);
});

test('umbrella drag auto-scroll and asset discovery cover long registers and saved details', async () => {
  const [client, modal] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /ASSET_GROUP_AUTO_SCROLL_EDGE_PX/);
  assert.match(client, /ASSET_GROUP_AUTO_SCROLL_MIN_PX = 8/);
  assert.match(client, /ASSET_GROUP_AUTO_SCROLL_MAX_PX = 64/);
  assert.match(client, /window\.addEventListener\('dragover', handleAssetDragOver\)/);
  assert.match(client, /window\.addEventListener\('wheel', handleAssetDragWheel, \{ passive: false \}\)/);
  assert.match(client, /assetGroupWheelScrollDelta\(event\.deltaY, event\.deltaMode, viewportHeight\)/);
  assert.match(client, /event\.preventDefault\(\);[\s\S]*?window\.scrollBy\(\{ top: scrollDelta, left: 0, behavior: 'auto' \}\)/);
  assert.match(client, /window\.requestAnimationFrame\(runAssetDragAutoScroll\)/);
  assert.match(client, /window\.scrollBy\(\{ top: scrollDelta, left: 0, behavior: 'auto' \}\)/);
  assert.match(client, /const assetGroupModalAssets = useMemo/);
  assert.match(client, /categoryLabel: assetKindLabel\(asset\)/);
  assert.match(client, /serialNumber: asset\.serialNumber/);
  assert.match(client, /registrationNumber: readLicenseRegistrationNumber\(asset\)/);
  assert.match(client, /searchableText: buildSearchableText\(asset\)/);
  assert.match(modal, /function assetMatchesSearch/);
  assert.match(modal, /asset\.notes/);
  assert.match(modal, /asset\.searchableText/);
  assert.match(modal, /Search name, category, serial, registration or notes/);
  assert.match(modal, /asset\.categoryLabel/);
  assert.match(modal, /Serial: \$\{asset\.serialNumber\}/);
  assert.match(modal, /Reg: \$\{asset\.registrationNumber\}/);
});

test('umbrella create and manage forms keep their footer actions fully visible', async () => {
  const styles = await readFile(new URL('../components/asset-register/AssetGroupManagerModal.module.css', import.meta.url), 'utf8');

  assert.match(styles, /\.dialog > form \{[\s\S]*?flex: 1 1 auto;[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden;/);
  assert.match(styles, /\.body \{[\s\S]*?flex: 1 1 auto;[\s\S]*?max-height: none;[\s\S]*?overflow-y: auto;/);
  assert.match(styles, /\.footer \{[\s\S]*?flex: 0 0 auto;[\s\S]*?padding: 18px 36px max\(24px, env\(safe-area-inset-bottom\)\);/);
});

test('asset disposal uses a valid withdrawn marketplace state and keeps database errors private', async () => {
  const [client, styles, lifecycle, route] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
    readFile(new URL('../lib/asset-lifecycle.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/asset-register/route.ts', import.meta.url), 'utf8'),
  ]);
  const deleteHandler = route.slice(route.indexOf('export async function DELETE'));
  const disposalModal = client.slice(client.indexOf('{disposalCandidateAsset ? ('), client.indexOf('{isExportModalOpen ? ('));

  assert.doesNotMatch(lifecycle, /marketplace_status[\s\S]{0,120}'off'/);
  assert.equal((lifecycle.match(/marketplace_status = case when marketplace_status is null then null else 'withdrawn' end/g) ?? []).length, 2);
  assert.match(deleteHandler, /The asset could not be archived\. Please try again\./);
  assert.doesNotMatch(deleteHandler, /formatUnknownError\(error/);
  assert.match(client, /draft\.reason === 'mistake_duplicate'[\s\S]{0,100}\? \{ reason: draft\.reason \}/);
  assert.match(disposalModal, /disposalDraft\.reason !== 'mistake_duplicate' \? \([\s\S]*?assetDisposalFields/);
  assert.match(disposalModal, /No explanation is required\./);
  assert.match(disposalModal, /styles\.assetDisposalOverlay/);
  assert.match(styles, /\.assetDisposalOverlay \{[\s\S]*?width: 100vw !important;[\s\S]*?max-width: none !important;/);
  assert.match(styles, /\.assetDisposalModal \{[\s\S]*?width: min\(60rem, calc\(100vw - 2rem\)\) !important;[\s\S]*?display: flex !important;[\s\S]*?flex-direction: column !important;[\s\S]*?overflow: hidden !important;[\s\S]*?margin-inline: auto !important;/);
  assert.match(styles, /\.assetDisposalBody \{[\s\S]*?flex: 1 1 auto !important;[\s\S]*?min-height: 0 !important;[\s\S]*?overflow-y: auto !important;[\s\S]*?scrollbar-gutter: stable both-edges !important;[\s\S]*?padding: 1\.25rem 2rem 1\.5rem !important;/);
  assert.match(styles, /@media \(max-width: 720px\) \{[\s\S]*?\.assetDisposalBody \{[\s\S]*?scrollbar-gutter: auto !important;/);
});

test('combined Asset Register groups are account-wide, preserve member counting, and project in every output', async () => {
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
  assert.match(persistence, /input\.countsTowardTotalByAssetId/);
  assert.doesNotMatch(persistence, /const valueMode = isCombinedScope \? 'separate'/);
  assert.match(client, /projectAssetGroupsToAssets\(assetGroups, assets\)/);
  assert.match(client, /window\.location\.assign\('\/asset-register\?scope=combined'\)/);
  assert.match(client, /reportAssetGroups = projectAssetGroupsToAssets\(assetGroups, reportAssets\)/);
  assert.match(exportRoute, /combinedGroups = scope === 'combined'/);
  assert.match(accountantWorkspace, /projectAssetGroupsToAssets/);
});


test('umbrella and Maintenance page exports preserve completed maintenance history', async () => {
  const [route, report, maintenance, scanHistory, maintenanceClient, modal] = await Promise.all([
    readFile(new URL('../app/api/maintenance/report/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/asset-maintenance-report.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/asset-maintenance.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/scan-assets.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/maintenance/maintenance-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(route, /scope === 'upcoming' \? 'upcoming' : scope === 'done' \? 'done' : 'all'/);
  assert.match(route, /including stand-alone services, check-ups and repairs/);
  assert.match(route, /includeCompletedScanHistory: true/);
  assert.match(route, /completedScanHistoryAssetIds: groupMemberAssetIds \?\? undefined/);
  assert.match(route, /groupMemberIds\.has\(record\.assetId\)/);
  assert.match(report, /records: records\.filter\(\(record\) => record\.status === 'done'\)/);
  assert.match(report, /title: 'Completed Maintenance'/);
  assert.match(maintenance, /recordStandaloneAssetMaintenanceCompletion/);
  assert.match(maintenance, /listCompletedMaintenanceScanEventsForAssets/);
  assert.match(maintenance, /function mergeCompletedScanHistory/);
  assert.match(maintenance, /scanHistoryMatchesPersistedRecord/);
  assert.match(maintenance, /completedNotes: event\.sourceNote \|\| event\.summary \|\| event\.note/);
  assert.match(scanHistory, /export async function listCompletedMaintenanceScanEventsForAssets/);
  assert.match(scanHistory, /sourceNote: note/);
  assert.match(scanHistory, /const createdAtIso = asIsoTimestamp\(row\.created_at\) \?\? ""/);
  assert.match(scanHistory, /notedAtIso: asIsoTimestamp\(row\.maintenance_noted_at\)/);
  const scanEventMapper = scanHistory.slice(
    scanHistory.indexOf('function mapScanEventRow'),
    scanHistory.indexOf('function splitMaintenanceNoteLines'),
  );
  assert.match(scanEventMapper, /entryAddedAtIso: asIsoTimestamp\(row\.entry_added_at\)/);
  assert.match(scanEventMapper, /createdAtIso,/);
  assert.doesNotMatch(scanEventMapper, /createdAtIso: row\.created_at/);
  assert.match(scanHistory, /coalesce\(to_jsonb\(e\)->>'note', ''\) as note/);
  assert.match(scanHistory, /null::text as maintenance_noted_at/);
  assert.match(scanHistory, /order by e\.created_at desc, e\.id desc/);
  const historyQuery = scanHistory.slice(
    scanHistory.indexOf('export async function listCompletedMaintenanceScanEventsForAssets'),
    scanHistory.indexOf('export async function markAssetMaintenanceStatusNoted'),
  );
  assert.doesNotMatch(historyQuery, /assetMaintenanceStatusSelectSql/);
  assert.doesNotMatch(historyQuery, /inner join/);
  assert.doesNotMatch(historyQuery, /limit \$\{/);
  assert.match(maintenance, /must never block the current[\s\S]*?maintenance report from opening/);
  assert.match(maintenance, /completed maintenance scan history could not be loaded/);
  assert.match(maintenanceClient, /Total maintenance report[\s\S]*?All open and completed maintenance/);
  assert.match(maintenanceClient, /Completed maintenance report/);
  assert.match(modal, /All maintenance/);
  assert.match(modal, /Completed maintenance/);
});

test('maintenance PDF and Excel builders accept PostgreSQL Date timestamps', async () => {
  const { buildAssetMaintenanceReportHtml, buildAssetMaintenanceWorkbook } = await loadMaintenanceReportBuilders();
  const databaseTimestamp = new Date('2026-07-30T08:15:00.000Z');
  const record = {
    id: 'scan-history:event-1',
    status: 'done',
    computedStatus: 'done',
    title: 'Historical service',
    assetTitle: '2013 Landini 5-100H',
    assetMeta: 'Year Model: 2013',
    maintenanceType: 'service',
    triggerType: 'date',
    completedAtIso: databaseTimestamp,
    completedUsage: 14056,
    completedBy: 'Gerald',
    completedNotes: 'Changed engine oil and filters.',
    updatedAtIso: databaseTimestamp,
  };
  const options = {
    title: 'Asset Maintenance Report',
    subtitle: 'Aim4price asset register',
    generatedAt: '10 Aug 2026',
    ownerEmail: 'owner@example.com',
    ownerDetails: {
      businessName: 'Test Owner',
      contactDetails: '',
      businessEmail: 'owner@example.com',
      locationAddress: '',
    },
    logoUrl: '',
    reportScopeLabel: 'Total maintenance report',
    assetLabel: 'All selected assets',
    selectedAsset: null,
    summary: {
      totalCount: 1,
      openCount: 0,
      doneCount: 1,
      dueSoonCount: 0,
      dueCount: 0,
      overdueCount: 0,
    },
    records: [record],
    xlsxUrl: '/api/maintenance/report?format=xlsx',
  };

  const html = buildAssetMaintenanceReportHtml(options);
  const workbook = buildAssetMaintenanceWorkbook(options);

  assert.match(html, /Historical service/);
  assert.match(html, /2013 Landini 5-100H/);
  assert.match(html, /30 Jul 2026/);
  assert.equal(workbook[0].rows.at(-1)[0].value, '2013 Landini 5-100H');
});
