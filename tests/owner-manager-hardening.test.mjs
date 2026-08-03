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
  migration,
] = await Promise.all([
  read('lib/field-manager.ts'),
  read('lib/field-manager-session.ts'),
  read('app/api/field-manager/login/route.ts'),
  read('app/account/field-manager/field-manager-client.tsx'),
  read('lib/owner-app.ts'),
  read('lib/owner-app-access.ts'),
  read('lib/owner-app-overview.ts'),
  read('app/api/owner-app/attention/route.ts'),
  read('database/migrations/58-owner-manager-hardening.sql'),
]);

test('Field Manager passwords are hash-only and reset sessions', () => {
  assert.doesNotMatch(fieldManager, /password_display|savedPassword/);
  assert.doesNotMatch(fieldManagerUi, /savedPassword|Saved password/);
  assert.match(fieldManagerUi, /Passwords are never displayed/);
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
});

test('Field Manager assignments cover assets, fuel tanks, and actions', () => {
  assert.match(fieldManager, /field_manager_access_settings/);
  assert.match(fieldManager, /field_manager_fuel_storage_access/);
  assert.match(fieldManager, /assetScope: 'all' \| 'selected'/);
  assert.match(fieldManager, /FieldManagerPermission = 'record_work' \| 'schedule_maintenance' \| 'record_fuel' \| 'refill_fuel'/);
});

test('Owner Overview clearing is isolated per viewer', () => {
  assert.match(migration, /viewer_key text NOT NULL/);
  assert.match(overview, /where parent_owner_user_id = \$1 and viewer_key = \$2/);
  assert.match(overview, /on conflict \(parent_owner_user_id, viewer_key, source_kind, source_id\)/);
  assert.match(attentionRoute, /access\.viewerKey/);
});
