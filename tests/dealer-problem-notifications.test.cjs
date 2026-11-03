const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
function load(file, mocks) {
  const exports = {};
  new Function('require', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => name in mocks ? mocks[name] : require(name), exports);
  return exports;
}
test('dealer problem alerts obey live sharing, ownership, lifecycle and resolution; reads are stable', async () => {
  const pg = new PGlite();
  try {
    const query = (sql, args) => pg.query(sql, args);
    const db = { getDb: () => ({ query }) };
    const notes = load('lib/asset-issue-notes.ts', { './db': db });
    const service = load('lib/dealer-problem-notifications.ts', { './db': db, './asset-issue-notes': notes });
    assert.deepEqual(await service.listDealerProblemNotifications('dealer'), []);
    await pg.exec(`
      CREATE TABLE asset_register_items(id uuid PRIMARY KEY, user_id text, title text, lifecycle_state text);
      CREATE TABLE asset_scan_events(id uuid PRIMARY KEY, asset_id uuid, note text, operator_name text, created_at timestamptz DEFAULT now(), issue_noted_at timestamptz);
      CREATE TABLE dealer_maintenance_access(id uuid PRIMARY KEY, asset_register_item_id uuid, owner_user_id text, dealer_user_id text, is_active boolean, can_view_logged_problems boolean);
    `);
    const asset = randomUUID(), event = randomUUID(), access = randomUUID();
    await query('INSERT INTO asset_register_items VALUES($1,$2,$3,$4)', [asset, 'owner', 'Tractor', 'active']);
    await query('INSERT INTO dealer_maintenance_access VALUES($1,$2,$3,$4,true,true)', [access, asset, 'owner', 'dealer']);
    await query('INSERT INTO asset_scan_events(id,asset_id,note,operator_name) VALUES($1,$2,$3,$4)', [event, asset, 'Notes/Problems: Hydraulic leak', 'Owner app']);
    let items = await service.listDealerProblemNotifications('dealer');
    assert.equal(items.length, 1); assert.match(items[0].body, /Hydraulic leak/);
    assert.equal(items[0].status, 'reported_problem');
    const stableId = items[0].id;
    await query('UPDATE asset_scan_events SET note=$1 WHERE id=$2', ['Notes/Problems: Hydraulic leak confirmed', event]);
    assert.equal((await service.listDealerProblemNotifications('dealer'))[0].id, stableId);
    assert.deepEqual(await service.listDealerProblemNotifications('other-dealer'), []);
    for (const [sql, undo] of [
      ['UPDATE dealer_maintenance_access SET is_active=false', 'UPDATE dealer_maintenance_access SET is_active=true'],
      ['UPDATE dealer_maintenance_access SET can_view_logged_problems=false', 'UPDATE dealer_maintenance_access SET can_view_logged_problems=true'],
      ["UPDATE asset_register_items SET user_id='new-owner'", "UPDATE asset_register_items SET user_id='owner'"],
      ["UPDATE asset_register_items SET lifecycle_state='removed'", "UPDATE asset_register_items SET lifecycle_state='active'"],
      ['UPDATE asset_scan_events SET issue_noted_at=now()', 'UPDATE asset_scan_events SET issue_noted_at=null'],
      ["UPDATE asset_scan_events SET created_at=now()-interval '15 days'", 'UPDATE asset_scan_events SET created_at=now()'],
      ["UPDATE asset_scan_events SET note='General note only'", "UPDATE asset_scan_events SET note='Notes/Problems: Hydraulic leak'"],
    ]) {
      await pg.exec(sql); assert.deepEqual(await service.listDealerProblemNotifications('dealer'), [], sql); await pg.exec(undo);
    }
    // Duplicate access records must never duplicate an alert.
    await query('INSERT INTO dealer_maintenance_access VALUES($1,$2,$3,$4,true,true)', [randomUUID(), asset, 'owner', 'dealer']);
    assert.equal((await service.listDealerProblemNotifications('dealer')).length, 1);
    const read = new Set();
    const inbox = load('lib/dealer-maintenance-notification-inbox.ts', {
      './db': db, './dealer-problem-notifications': service,
      './dealer-maintenance-tracker': { listDealerMaintenanceNotifications: async () => [] },
      './app-notification-read-state': {
        listReadNotificationEventKeys: async () => read,
        markNotificationEventKeysRead: async (_, keys) => keys.forEach(key => read.add(key)),
      },
    });
    const viewer = { dealerUserId: 'dealer', viewerKey: 'dealer:test' };
    assert.equal((await inbox.listDealerMaintenanceNotificationsForViewer(viewer))[0].isRead, false);
    await inbox.markDealerMaintenanceNotificationsReadForViewer({ ...viewer, notificationIds: [stableId, 'foreign-event'] });
    assert.equal((await inbox.listDealerMaintenanceNotificationsForViewer(viewer))[0].isRead, true);
    assert.equal(read.size, 1);
  } finally { await pg.close(); }
});
