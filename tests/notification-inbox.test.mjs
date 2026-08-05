import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('notification inbox persists user state and history', async () => {
  const [inbox, migration] = await Promise.all([
    read('lib/notification-inbox.ts'),
    read('database/migrations/67-notification-inbox.sql'),
  ]);

  assert.match(inbox, /listComputedHeaderNotifications/);
  assert.match(inbox, /state: NotificationInboxState/);
  assert.match(inbox, /actionRequired: boolean/);
  assert.match(inbox, /read_at = coalesce\(read_at, now\(\)\)/);
  assert.match(inbox, /archived_at = coalesce\(archived_at, now\(\)\)/);
  assert.match(inbox, /and action_required = false/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.user_notifications/);
  assert.match(migration, /UNIQUE \(user_id, event_key\)/);
});

test('notification APIs expose durable state mutations', async () => {
  const [desktopRoute, ownerRoute] = await Promise.all([
    read('app/api/notifications/route.ts'),
    read('app/api/owner-app/notifications/route.ts'),
  ]);

  for (const source of [desktopRoute, ownerRoute]) {
    assert.match(source, /listNotificationInbox/);
    assert.match(source, /export async function PATCH/);
    assert.match(source, /mark_read/);
    assert.match(source, /archive/);
    assert.match(source, /resolve/);
  }
});

test('notification surfaces separate active work and searchable history', async () => {
  const [header, ownerClient, dealerClient, ownerLink] = await Promise.all([
    read('components/AppHeader.tsx'),
    read('app/owner-app/notifications/owner-notifications-client.tsx'),
    read('app/dealer/notifications/dealer-maintenance-notifications-client.tsx'),
    read('app/owner-app/owner-notifications-link.tsx'),
  ]);

  assert.doesNotMatch(header, /aim4price-header-notifications-seen/);
  assert.match(header, /notificationView/);
  assert.match(header, /Search notifications/);
  assert.match(ownerClient, /Needs Action/);
  assert.match(ownerClient, /Search assets, clients or notifications/);
  assert.match(ownerClient, /Checked and cleared notifications remain searchable in History/);
  assert.match(dealerClient, /Maintenance alerts and checked history/);
  assert.match(dealerClient, /Search assets or maintenance alerts/);
  assert.match(ownerLink, /needsActionCount/);
});

test('notification modal keeps status, list and pagination in separate responsive rows', async () => {
  const styles = await read('components/AppHeader.module.css');

  assert.match(styles, /Notification modal spacing and alignment refinement/);
  assert.match(styles, /grid-template-rows: auto auto auto minmax\(0, 1fr\) auto/);
  assert.match(styles, /\.notificationInboxControls \{[\s\S]*?border-radius: 1\.35rem/);
  assert.match(styles, /\.notificationMetaRow \{[\s\S]*?border-top: 1px solid/);
  assert.match(styles, /@media \(max-width: 720px\) \{[\s\S]*?\.notificationListHeader \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
});

