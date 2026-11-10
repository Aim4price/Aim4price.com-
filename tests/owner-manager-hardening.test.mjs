import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ownerLoginSections = await readFile(new URL('../app/account/owner-login-sections.tsx', import.meta.url), 'utf8');
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  fieldManagerUi,
  ownerApp,
  ownerAccess,
  overview,
  attentionRoute,
  assetActivity,
  activityRoute,
  ownerAssetUi,
  ownerHome,
  ownerAssets,
  ownerManagePage,
  migration,
] = await Promise.all([
  read('app/account/app-access-management-client.tsx'),
  read('lib/owner-app.ts'),
  read('lib/owner-app-access.ts'),
  read('lib/owner-app-overview.ts'),
  read('app/api/owner-app/attention/route.ts'),
  read('lib/asset-activity.ts'),
  read('app/api/owner-app/assets/[assetId]/activity/route.ts'),
  read('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx'),
  read('app/owner-app/page.tsx'),
  read('app/owner-app/assets/owner-assets-client.tsx'),
  read('app/owner-app/assets/[assetId]/manage/[section]/page.tsx'),
  read('database/migrations/66-owner-manager-hardening.sql'),
]);

test('Manager roles use shared granular permissions and asset gates', () => {
  assert.match(ownerAccess, /managerPermissions\(accessRole, managedUser\?\.permissions\)/);
  assert.match(ownerAccess, /permission in access.teamPermissions/);
  assert.match(ownerHome, /ownerAppCan\(access, 'addFuel'\)/);
  assert.match(ownerHome, /ownerAppCan\(access, 'recordMaintenance'\)/);
  assert.match(ownerAssets, /mode === 'assets' && canAddAssets/);
  assert.match(ownerManagePage, /if \(!canOpen\) redirect/);
});

test('Owner Overview supports per-viewer and explicit account-wide clearing', () => {
  assert.match(migration, /viewer_key text NOT NULL/);
  assert.match(ownerApp, /create table if not exists public\.owner_app_overview_dismissals \([\s\S]*viewer_key text not null default 'legacy-owner'/);
  assert.doesNotMatch(ownerApp, /create table if not exists public\.owner_app_users \([\s\S]*parent_owner_user_id[^;]*viewer_key text not null[^;]*display_name/);
  assert.match(overview, /ALL_OVERVIEW_VIEWERS_KEY = 'everyone'/);
  assert.match(overview, /where parent_owner_user_id = \$1 and viewer_key = any\(\$2::text\[\]\)/);
  assert.match(overview, /on conflict \(parent_owner_user_id, viewer_key, source_kind, source_id\)/);
  assert.match(attentionRoute, /access\.viewerKey/);
  assert.match(attentionRoute, /body\.clearForEveryone === true && ownerAppCan\(access, 'manage_assets'\)/);
});

test('Owner asset activity combines work, fuel, maintenance, and lifecycle history', () => {
  assert.match(assetActivity, /listScanActivity/);
  assert.match(assetActivity, /listFuelActivity/);
  assert.match(assetActivity, /listMaintenanceActivity/);
  assert.match(assetActivity, /listLifecycleActivity/);
  assert.match(activityRoute, /getAssetRegisterItemById\(access\.ownerUserId, params\.assetId\)/);
  assert.match(ownerAssetUi, /title: 'Activity'/);
});

test('Owner maintenance completion always routes through recorded physical work', () => {
  assert.doesNotMatch(ownerAssetUi, /action: 'maintenance-complete'/);
  assert.match(ownerAssetUi, />Record work<\/Link>/);
});
