import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Dealer and Field Manager clear confirmations ask whether assigned work was completed', async () => {
  const [dealerClient, fieldClient] = await Promise.all([
    read('app/dealer/notifications/dealer-maintenance-notifications-client.tsx'),
    read('app/field-manager/notifications/field-manager-notifications-client.tsx'),
  ]);

  for (const client of [dealerClient, fieldClient]) {
    assert.match(client, /step: 'confirm' \| 'completion'/);
    assert.match(client, /Was it completed\?/);
    assert.match(client, /'Not sure'/);
    assert.match(client, /'Yes'/);
    assert.match(client, /JSON\.stringify\(\{ notificationIds, completed \}\)/);
  }
});

test('Not sure only clears while Yes records Field Manager maintenance and preserves recurrence', async () => {
  const [route, notifications, maintenance] = await Promise.all([
    read('app/api/field-manager/notifications/route.ts'),
    read('lib/field-manager-notifications.ts'),
    read('lib/asset-maintenance.ts'),
  ]);

  assert.match(route, /completed: body\?\.completed === true/);
  assert.match(route, /completedBy: access\.session\.displayName/);
  assert.match(notifications, /if \(input\.completed\)/);
  assert.match(notifications, /record\.assignedFieldManagerId === input\.managerId/);
  assert.match(notifications, /completeAssetMaintenanceRecord\(/);
  assert.match(notifications, /allowUnknownDetails: true/);
  assert.match(maintenance, /const nextRecord = await createNextRecurringRecord\(client, userId, completed\)/);
});

test('Dealer completed work logs a service, resolves the assignment and uses concise report notes', async () => {
  const [route, inbox, maintenance] = await Promise.all([
    read('app/api/dealer/maintenance/notifications/route.ts'),
    read('lib/dealer-maintenance-notification-inbox.ts'),
    read('lib/asset-maintenance.ts'),
  ]);

  assert.match(route, /completed: body\?\.completed === true/);
  assert.match(inbox, /notification\.status === 'assigned_problem'/);
  assert.match(inbox, /recordStandaloneAssetMaintenanceCompletion\(/);
  assert.match(inbox, /maintenanceType: 'service'/);
  assert.match(inbox, /workflow_status = 'resolved'/);
  assert.match(maintenance, /Check-up done, no additional information available\./);
  assert.match(maintenance, /Service done, no additional information available\./);
  assert.match(maintenance, /allowUnknownDetails/);
});
