import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin notification sending stays behind the existing admin session guard', async () => {
  const route = await read('app/api/admin/users/route.ts');
  const sendBranch = route.slice(
    route.indexOf('if (action === "send_notification")'),
    route.indexOf('if (action === "open_account")'),
  );

  assert.match(route, /isAim4priceAdminEmail\(session\.user\.email\)/);
  assert.match(route, /const \{ session, response \} = await requireAdminSession\(\)/);
  assert.match(sendBranch, /sendAdminAccountNotification\(\{/);
  assert.match(sendBranch, /targetUserId: userId/);
  assert.match(sendBranch, /senderUserId: session\?\.user\?\.id \|\| ""/);
  assert.match(sendBranch, /A notification message is required/);
  assert.match(sendBranch, /MAX_ADMIN_NOTIFICATION_TITLE_LENGTH/);
  assert.match(sendBranch, /MAX_ADMIN_NOTIFICATION_BODY_LENGTH/);
});

test('admin messages are durable, account-scoped and audit-attributed', async () => {
  const service = await read('lib/admin-account-notifications.ts');

  assert.match(service, /ensureNotificationInboxTables\(\)/);
  assert.match(service, /from "user"[\s\S]*?where id = \$1/);
  assert.match(service, /`account:\$\{target\.id\}`/);
  assert.match(service, /`admin-message:\$\{notificationId\}`/);
  assert.match(service, /'admin_message'/);
  assert.match(service, /action_required,[\s\S]*?false,/);
  assert.match(service, /source: "admin_account_message"/);
  assert.match(service, /senderUserId/);
  assert.match(service, /targetUserId: target\.id/);
});

test('durable admin messages remain new until the recipient checks them', async () => {
  const [inbox, notifications, header] = await Promise.all([
    read('lib/notification-inbox.ts'),
    read('lib/notifications.ts'),
    read('components/AppHeader.tsx'),
  ]);

  assert.match(
    inbox,
    /currentKeys\.has\(row\.event_key\)[\s\S]*?payload\.source === 'admin_account_message'/,
  );
  assert.match(
    inbox,
    /current && !readAtIso && !archivedAtIso[\s\S]*?: 'new'/,
  );
  assert.match(notifications, /\| 'admin_message'/);
  assert.match(header, /type HeaderNotificationCategory = 'admin_message'/);
});

test('the account options modal has a validated notification composer', async () => {
  const [client, styles, ownerClient] = await Promise.all([
    read('app/admin/admin-client.tsx'),
    read('app/admin/page.module.css'),
    read('app/owner-app/notifications/owner-notifications-client.tsx'),
  ]);

  assert.match(client, /Send notification\s*<\/button>/);
  assert.match(client, /id="admin-notification-composer"/);
  assert.match(client, /notificationTitle: title/);
  assert.match(client, /notificationBody: body/);
  assert.match(client, /credentials: "include"/);
  assert.match(client, /maxLength=\{MAX_NOTIFICATION_TITLE_LENGTH\}/);
  assert.match(client, /maxLength=\{MAX_NOTIFICATION_BODY_LENGTH\}/);
  assert.match(client, /role="alert"/);
  assert.match(styles, /\.notificationComposer \{/);
  assert.match(styles, /\.notificationSendButton/);
  assert.match(ownerClient, /\{ value: 'messages', label: 'Messages' \}/);
  assert.match(ownerClient, /item\.category === 'admin_message'/);
  assert.match(ownerClient, /return '\/owner-app\/notifications'/);
});
