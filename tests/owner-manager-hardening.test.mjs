import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  fieldManager,
  fieldManagerSession,
  fieldManagerLogin,
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
  read('lib/field-manager.ts'),
  read('lib/field-manager-session.ts'),
  read('app/api/field-manager/login/route.ts'),
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

test('Field Manager passwords are hash-only and reset sessions', () => {
  assert.doesNotMatch(fieldManager, /savedPassword/);
  assert.match(fieldManager, /drop column if exists password_display/);
  assert.doesNotMatch(fieldManagerUi, /savedPassword|Saved password/);
  assert.match(fieldManagerUi, /Leave blank to keep the current/);
  assert.match(migration, /DROP COLUMN IF EXISTS password_display/);
  assert.match(fieldManager, /session_version = session_version \+ case/);
  assert.match(fieldManagerSession, /manager\.sessionVersion !== claims\.sessionVersion/);
});

test('Field Manager sign-in is throttled after repeated failures', () => {
  assert.match(fieldManager, /FIELD_MANAGER_MAX_FAILED_ATTEMPTS = 5/);
  assert.match(fieldManager, /recordFieldManagerLoginFailure/);
  assert.match(fieldManagerLogin, /Too many incorrect attempts\. Try again in 15 minutes/);
});

test('Owner App roles have simple, server-enforced permission presets', () => {
  assert.match(ownerApp, /OwnerAppAccessRole = 'admin' \| 'operations' \| 'view_only'/);
  assert.match(ownerAccess, /operations: \['view', 'operate'\]/);
  assert.match(ownerAccess, /view_only: \['view'\]/);
  assert.match(ownerAccess, /ownerAppCan/);
  assert.match(ownerHome, /TOOLS\.filter\(\(tool\) => !tool\.permission \|\| ownerAppCan/);
  assert.match(ownerAssets, /mode === 'assets' && canAddAssets/);
  assert.match(ownerManagePage, /if \(!canOpen\) redirect/);
});

test('Field Manager assignments cover assets, fuel tanks, and actions', () => {
  assert.match(fieldManager, /field_manager_access_settings/);
  assert.match(fieldManager, /field_manager_fuel_storage_access/);
  assert.match(fieldManager, /assetScope: 'all' \| 'selected'/);
  assert.match(fieldManager, /\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}/);
  assert.match(fieldManager, /FieldManagerPermission = 'record_work' \| 'schedule_maintenance' \| 'record_fuel' \| 'refill_fuel'/);
});

test('Owner Overview supports per-viewer and explicit account-wide clearing', () => {
  assert.match(migration, /viewer_key text NOT NULL/);
  assert.match(ownerApp, /create table if not exists public\.owner_app_overview_dismissals \([\s\S]*viewer_key text not null default 'legacy-owner'/);
  assert.doesNotMatch(ownerApp, /create table if not exists public\.owner_app_users \([\s\S]*parent_owner_user_id[^;]*viewer_key text not null[^;]*display_name/);
  assert.match(overview, /ALL_OVERVIEW_VIEWERS_KEY = 'everyone'/);
  assert.match(overview, /where parent_owner_user_id = \$1 and viewer_key = any\(\$2::text\[\]\)/);
  assert.match(overview, /on conflict \(parent_owner_user_id, viewer_key, source_kind, source_id\)/);
  assert.match(attentionRoute, /access\.viewerKey/);
  assert.match(attentionRoute, /body\.clearForEveryone === true && access\.accessRole === 'admin'/);
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
