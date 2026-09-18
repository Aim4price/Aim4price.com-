import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

test('problem notifications respect asset scope and only mark visible reports read', async () => {
  const marked = [];
  let resolved = false;
  const mocks = {
    './field-manager': { listFieldManagerAssets: async () => [{ id: 'allowed', title: 'Tractor' }] },
    './asset-maintenance': { listAssetMaintenanceRecords: async () => [] },
    './asset-issue-notes': { listOpenIssueNoteGroupsForAssets: async ids => {
      assert.deepEqual(Array.from(ids), ['allowed']);
      return resolved ? [] : [{ assetRegisterItemId: 'allowed', latest: { id: 'report-1', note: 'Oil leak', createdAtIso: '2026-09-18T07:00:00Z' } }];
    } },
    './app-notification-read-state': {
      listReadNotificationEventKeys: async () => new Set(marked),
      markNotificationEventKeysRead: async (viewer, keys) => {
        assert.equal(viewer, 'field-manager:manager-1');
        marked.push(...keys);
      },
    },
  };
  const source = readFileSync(new URL('../lib/field-manager-notifications.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: name => { assert.ok(mocks[name], name); return mocks[name]; } });
  const input = { ownerUserId: 'owner-1', managerId: 'manager-1' };
  const [notification] = await exports.listFieldManagerNotifications(input);
  assert.equal(notification.title, 'Problem reported');
  assert.equal(notification.body, 'Tractor: Oil leak');
  assert.equal(notification.href, '/field-manager/overview');
  assert.equal(notification.isRead, false);
  await exports.markFieldManagerNotificationsRead({ ...input, notificationIds: [notification.id, 'field-manager-problem:private-report'] });
  assert.deepEqual(marked, [notification.id]);
  assert.equal((await exports.listFieldManagerNotifications(input))[0].isRead, true);
  resolved = true;
  assert.equal((await exports.listFieldManagerNotifications(input)).length, 0);
});
