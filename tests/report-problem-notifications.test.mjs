import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

test('Manager problem notifications enforce asset scope and only mark visible reports read', async () => {
  let marked;
  const rows = ['allowed','private'].map(assetId => ({ id: assetId, assetId, category: 'qr_scan', title: 'Problem reported', createdAtIso: '2026-01-01' }));
  const deps = {
    './app-notification-history': {},
    './notification-inbox': { listNotificationInbox: async () => rows, updateNotificationInboxState: async input => { marked = input; } },
    './owner-app-access': { ownerAppCan: (access, key) => access.teamPermissions[key] === true },
    './push-access': { currentPushIdentity: async () => null },
    './push-events': {}, './app-notification-state': {},
  };
  const api = {};
  new Function('require','exports',ts.transpileModule(readFileSync(new URL('../lib/owner-notification-inbox.ts', import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name => { assert.ok(name in deps, name); return deps[name]; },api);
  const access = { ownerUserId: 'owner', viewerKey: 'user:staff', sessionKind: 'owner-app-user', assetScope: 'selected', accessibleAssetIds: ['allowed'], teamPermissions: { viewMaintenance: true } };
  const inbox = await api.listOwnerNotificationInbox(access);
  assert.deepEqual(inbox.map(item => item.id), ['allowed']);
  assert.equal(inbox[0].href, '/owner-app/attention');
  await api.markOwnerNotificationsRead(access, 'read', ['allowed','private']);
  assert.equal(marked.userId, 'user:staff');
  assert.deepEqual(marked.notificationIds, ['allowed']);
  access.teamPermissions.viewMaintenance = false;
  assert.deepEqual(await api.listOwnerNotificationInbox(access), []);
});
