import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

async function loadDirectoryHelpers() {
  const source = await read('lib/app-asset-directory.ts');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function('module', 'exports', output)(loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

test('app umbrella projections keep visible members and sort umbrellas alphabetically', async () => {
  const { buildAppAssetDirectoryGroups } = await loadDirectoryHelpers();
  const groups = [
    {
      id: 'z-group', name: 'Vehicles', members: [
        { assetId: 'vehicle-1', role: 'primary' },
        { assetId: 'vehicle-2', role: 'linked' },
      ],
    },
    {
      id: 'a-group', name: 'Dairy Equipment', members: [
        { assetId: 'dairy-1', role: 'primary' },
      ],
    },
  ];
  const projected = buildAppAssetDirectoryGroups(groups, ['vehicle-2', 'dairy-1']);

  assert.deepEqual(projected.map((group) => group.name), ['Dairy Equipment', 'Vehicles']);
  assert.deepEqual(projected[1].memberAssetIds, ['vehicle-2']);
  assert.equal(projected[1].primaryAssetId, 'vehicle-2');
});

test('Owner and Field Manager asset directories adapt only when umbrellas exist', async () => {
  const [ownerClient, fieldClient, ownerRoute, fieldRoute] = await Promise.all([
    read('app/owner-app/assets/owner-assets-client.tsx'),
    read('app/field-manager/field-manager-assets-client.tsx'),
    read('app/api/owner-app/assets/route.ts'),
    read('app/api/field-manager/assets/route.ts'),
  ]);

  for (const client of [ownerClient, fieldClient]) {
    assert.match(client, /const showDirectoryHome = groups\.length > 0/);
    assert.match(client, /Open umbrella/);
    assert.match(client, /View all assets/);
    assert.match(client, /Umbrella: \{assetGroup\.name\}/);
    assert.match(client, /Back to umbrellas/);
    assert.doesNotMatch(client, /Organised assets/);
  }
  assert.match(ownerRoute, /buildAppAssetDirectoryGroups\(assetGroups, visibleItems\.map/);
  assert.match(fieldRoute, /buildAppAssetDirectoryGroups\(assetGroups, assets\.map/);
});

test('account app access headings stay clean and tile copy stays short', async () => {
  const [accessUi, accessStyles] = await Promise.all([
    read('app/account/app-access-management-client.tsx'),
    read('app/account/app-access-management.module.css'),
  ]);

  assert.doesNotMatch(accessUi, /Dealer account access|Owner account access|Owner operations access/);
  assert.doesNotMatch(accessUi, /modalEyebrow|styles\.eyebrow/);
  assert.match(accessUi, /newDescription: 'Create a login\.'/);
  assert.match(accessUi, /manageDescription: 'Edit access\.'/);
  assert.match(accessStyles, /\.launcherIntro p[\s\S]*white-space: nowrap;/);
  assert.match(accessStyles, /\.actionCopy small[\s\S]*white-space: nowrap;/);
});

test('whole-umbrella access is enforced for Owner App users and Field Managers', async () => {
  const [ownerApp, ownerAccess, fieldManager, accessUi, ownerDetail, ownerActions, ownerNotifications, migration] = await Promise.all([
    read('lib/owner-app.ts'),
    read('lib/owner-app-access.ts'),
    read('lib/field-manager.ts'),
    read('app/account/app-access-management-client.tsx'),
    read('app/api/owner-app/assets/[assetId]/route.ts'),
    read('app/api/owner-app/assets/[assetId]/actions/route.ts'),
    read('app/api/owner-app/notifications/route.ts'),
    read('database/migrations/69-app-umbrella-access.sql'),
  ]);

  assert.match(ownerApp, /owner_app_user_group_access/);
  assert.match(ownerApp, /resolveOwnerAppAccessibleAssetIds/);
  assert.match(ownerApp, /row\.access_role\) === 'admin'[\s\S]*assetScope: 'all'/);
  assert.match(ownerAccess, /ownerAppCanAccessAsset/);
  assert.match(ownerDetail, /ownerAppCanAccessAsset\(access, params\.assetId\)/);
  assert.match(ownerActions, /ownerAppCanAccessAsset\(access, params\.assetId\)/);
  assert.match(ownerNotifications, /allowedAssetIds\.has\(item\.assetId\)/);

  assert.match(fieldManager, /field_manager_group_access/);
  assert.match(fieldManager, /inner join public\.asset_group_members member/);
  assert.match(fieldManager, /groupIds: string\[\]/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.field_manager_group_access/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.owner_app_user_group_access/);

  assert.match(accessUi, /OwnerAppAssetAccessPanel/);
  assert.match(accessUi, /Choosing an umbrella includes its current and future linked assets/);
  assert.match(accessUi, /Owner \/ Admin users always have access to every umbrella and asset/);
});
