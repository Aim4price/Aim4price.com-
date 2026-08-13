import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Owner notifications stay account-wide but read state follows the active app user', async () => {
  const [route, access, inbox] = await Promise.all([
    read('app/api/owner-app/notifications/route.ts'),
    read('lib/owner-app-access.ts'),
    read('lib/notification-inbox.ts'),
  ]);

  assert.match(access, /viewerKey: ownerAppSession \? `user:\$\{session\.ownerApp\.ownerAppUserId\}` : `account:\$\{session\.user\.id\}`/);
  assert.match(route, /userId: access\.ownerUserId/);
  assert.match(route, /viewerKey: access\.viewerKey/);
  assert.match(route, /userId: access\.viewerKey,[\s\S]*?action,[\s\S]*?notificationIds/);
  assert.match(inbox, /listComputedHeaderNotifications\(\{[\s\S]*?userId: input\.userId,[\s\S]*?accountType: input\.accountType/);
  assert.match(inbox, /const stateKey = inboxStateKey\(input\)/);
});

test('Dealer notifications are dealership-wide with per-staff clearing and assigned problem confirmation', async () => {
  const [route, page, home, inbox, client, readState] = await Promise.all([
    read('app/api/dealer/maintenance/notifications/route.ts'),
    read('app/dealer/notifications/page.tsx'),
    read('app/dealer/page.tsx'),
    read('lib/dealer-maintenance-notification-inbox.ts'),
    read('app/dealer/notifications/dealer-maintenance-notifications-client.tsx'),
    read('lib/app-notification-read-state.ts'),
  ]);

  assert.match(route, /isDealerAppSession\(session\)/);
  assert.match(route, /`dealer-staff:\$\{dealerAppSession\.staffId\}`/);
  assert.match(route, /`account:\$\{session\.user\.id\}`/);
  assert.match(route, /staffId: dealerAppSession\?\.staffId \?\? null/);
  assert.match(page, /const activeStaffId = isDealerAppSession\(session\) \? session\.dealerApp\.staffId : null/);
  assert.match(page, /listDealerMaintenanceNotificationsForViewer/);
  assert.match(page, /viewerKey: activeStaffId[\s\S]*?`dealer-staff:\$\{activeStaffId\}`/);
  assert.match(home, /const activeStaffId = isDealerAppSession\(session\) \? session\.dealerApp\.staffId : null/);
  assert.match(home, /listDealerMaintenanceNotificationsForViewer/);
  assert.match(inbox, /listDealerMaintenanceNotifications\(input\.dealerUserId\)/);
  assert.match(inbox, /public\.dealer_problem_assignments/);
  assert.match(inbox, /assignment\.assigned_staff_id = \$2::uuid/);
  assert.match(inbox, /assignedToViewer: true/);
  assert.match(inbox, /listReadNotificationEventKeys\([\s\S]*?input\.viewerKey/);
  assert.match(client, /markNotificationsChecked\(\[notification\.id\]\)/);
  assert.match(client, /newItems\.map\(\(notification\) => notification\.id\)/);
  assert.match(client, /This notification was specifically assigned to you\. Are you sure you want to clear it\?/);
  assert.match(client, /Some of these notifications were specifically assigned to you\. Are you sure you want to clear them\?/);
  assert.match(readState, /unique \(viewer_key, event_key\)/i);
});

test('Field Manager notifications are shared operationally and match the Owner App notification experience', async () => {
  const [notifications, route, client, ownerClient, home] = await Promise.all([
    read('lib/field-manager-notifications.ts'),
    read('app/api/field-manager/notifications/route.ts'),
    read('app/field-manager/notifications/field-manager-notifications-client.tsx'),
    read('app/owner-app/notifications/owner-notifications-client.tsx'),
    read('app/field-manager/field-manager-home-client.tsx'),
  ]);

  assert.match(notifications, /\['overdue', 'due', 'due_soon'\]\.includes\(record\.computedStatus\)/);
  assert.match(notifications, /isSharedMaintenanceNotification\(record\)[\s\S]*?record\.assignedFieldManagerId === input\.managerId/);
  assert.match(notifications, /const assignedToViewer = record\.assignedFieldManagerId === input\.managerId/);
  assert.match(notifications, /listReadNotificationEventKeys\(viewerKey\(input\.managerId\), keys\)/);
  assert.match(route, /requireActiveFieldManagerSession/);
  assert.match(route, /markFieldManagerNotificationsRead/);
  assert.doesNotMatch(route, /completeAssetMaintenanceRecord|completed:/);
  assert.match(client, /styles from '\.\.\/\.\.\/owner-app\/owner-app\.module\.css'/);
  for (const label of [
    'Notifications',
    'Updates that need your attention.',
    'Active',
    'History',
    'Mark all checked',
    'Clear all',
  ]) {
    assert.ok(client.includes(label), `Field Manager notifications should include ${label}`);
    assert.ok(ownerClient.includes(label), `Owner notifications should include ${label}`);
  }
  assert.match(client, /Just now/);
  assert.doesNotMatch(client, /Was it completed\?|clearRequest|completed/);
  assert.match(home, /\/field-manager\/notifications/);
  assert.match(home, /notificationCount/);
});
