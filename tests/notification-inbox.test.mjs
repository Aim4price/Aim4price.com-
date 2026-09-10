import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('fuel schema setup shares one cold-start promise across notification loaders', async () => {
  const fuelLedger = await read('lib/fuel-ledger.ts');

  assert.match(fuelLedger, /let fuelLedgerTablesPromise: Promise<void> \| null = null/);
  assert.match(fuelLedger, /fuelLedgerTablesPromise = ensureFuelLedgerTablesOnce\(\)\.catch/);
  assert.match(fuelLedger, /fuelLedgerTablesPromise = null/);
  assert.doesNotMatch(fuelLedger, /let fuelLedgerTablesEnsured = false/);
});

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
    assert.match(source, /list(?:Owner)?NotificationInbox/);
    assert.match(source, /export async function PATCH/);
    assert.match(source, /mark_read/);
    assert.match(source, /archive/);
    assert.match(source, /resolve/);
  }
});

test('notification surfaces keep desktop search and use simple app controls', async () => {
  const [header, ownerClient, dealerClient, ownerLink] = await Promise.all([
    read('components/AppHeader.tsx'),
    read('app/owner-app/notifications/owner-notifications-client.tsx'),
    read('app/dealer/notifications/dealer-maintenance-notifications-client.tsx'),
    read('app/owner-app/owner-notifications-link.tsx'),
  ]);

  assert.doesNotMatch(header, /aim4price-header-notifications-seen/);
  assert.match(header, /notificationView/);
  assert.match(header, /Search notifications/);
  assert.match(ownerClient, /\['active', 'Active'\]/);
  assert.doesNotMatch(ownerClient, /placeholder="Search"/);
  assert.match(ownerClient, /styles\.notificationTabsTwo/);
  assert.match(ownerClient, /styles\.notificationFilterSelect/);
  assert.doesNotMatch(ownerClient, /Active notifications stay here until they are opened, checked or completed/);
  assert.match(dealerClient, /Maintenance updates and history/);
  assert.match(dealerClient, /<span>Active<\/span>/);
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

test('opening one active notification moves only that item to history', async () => {
  const [header, inbox] = await Promise.all([
    read('components/AppHeader.tsx'),
    read('lib/notification-inbox.ts'),
  ]);

  assert.match(header, /function markNotificationOpened\(notificationId: string\)/);
  assert.match(header, /notificationIds: \[notificationId\]/);
  assert.match(header, /item\.id === notificationId[\s\S]*?state: 'history'/);
  assert.match(header, /notification\.actionRequired && !notification\.resolvedAtIso/);
  assert.match(header, /handleOpenAssetDiscoveryNotification\([\s\S]*?markNotificationOpened\(notificationId\)/);
  assert.match(header, /handleNotificationLinkClick\(notification\.id\)/);
  assert.match(inbox, /current && !readAtIso && !archivedAtIso[\s\S]*?row\.action_required && !resolvedAtIso/);
});

test('app notification pages use compact Overview-style controls and cards', async () => {
  const [ownerClient, dealerClient, ownerStyles, managerClient] = await Promise.all([
    read('app/owner-app/notifications/owner-notifications-client.tsx'),
    read('app/dealer/notifications/dealer-maintenance-notifications-client.tsx'),
    read('app/owner-app/owner-app.module.css'),
    read('app/field-manager/field-manager-overview-client.tsx'),
  ]);

  for (const source of [ownerClient, dealerClient]) {
    assert.doesNotMatch(source, /placeholder="Search"/);
    assert.doesNotMatch(source, /aria-label="Search notifications"/);
  }
  assert.doesNotMatch(ownerClient, /styles\.notificationSearch/);
  assert.doesNotMatch(dealerClient, /styles\.notificationSearch/);
  assert.match(managerClient, /styles\.overviewSearch/);
  for (const source of [ownerClient, dealerClient]) {
    assert.match(source, /styles\.notificationTabsTwo/);
    assert.doesNotMatch(source, /styles\.notificationCardLabels/);
    assert.doesNotMatch(source, /styles\.notificationKind/);
  }
  assert.doesNotMatch(ownerClient, /styles\.notificationTabsOwner/);
  assert.match(ownerClient, /styles\.notificationFilterSelect/);
  assert.match(ownerStyles, /Simplified app notification pages[\s\S]*?\.notificationContent \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
  assert.match(ownerStyles, /Simplified app notification pages[\s\S]*?\.notificationTabs button \{[\s\S]*?min-height: 52px[\s\S]*?flex-direction: row;/);
  assert.match(ownerStyles, /\.notificationCardNew \{[\s\S]*?background: linear-gradient\(180deg, #fffafa 0%, #fff1f1 100%\);/);
  assert.match(ownerStyles, /\.notificationCardPriority \{[\s\S]*?background: linear-gradient\(180deg, #fffdf8 0%, #fff6e5 100%\);/);
});


test('Owner and Dealer notifications keep Active and History while Field Manager returns to Overview', async () => {
  const [ownerClient, dealerClient, managerClient, managerRoute, managerOverview] = await Promise.all([
    read('app/owner-app/notifications/owner-notifications-client.tsx'),
    read('app/dealer/notifications/dealer-maintenance-notifications-client.tsx'),
    read('app/field-manager/field-manager-overview-client.tsx'),
    read('app/api/field-manager/overview/route.ts'),
    read('lib/field-manager-overview.ts'),
  ]);

  assert.match(ownerClient, /type NotificationView = 'active' \| 'history'/);
  assert.match(ownerClient, /\['active', 'Active'\]/);
  assert.match(dealerClient, /<span>Active<\/span>/);
  assert.match(managerClient, /<h1>Overview<\/h1>/);
  assert.match(managerClient, /<h2 id="needs-attention-title">Needs attention<\/h2>/);
  assert.match(managerClient, /<h2 id="upcoming-title">Upcoming<\/h2>/);
  assert.doesNotMatch(managerClient, /type NotificationView/);
  assert.doesNotMatch(managerRoute, /requestedView/);
  assert.match(managerOverview, /return !dismissedKeys\.has\(key\)/);
});

test('Field Manager Overview requires a captured location before service opens', async () => {
  const [managerClient, serviceLocationModal, fuelLocationModal, locationSession, openRoute] = await Promise.all([
    read('app/field-manager/field-manager-overview-client.tsx'),
    read('app/field-manager/field-manager-service-location-modal.tsx'),
    read('components/FuelLocationModal.tsx'),
    read('lib/field-manager-location-session.ts'),
    read('app/api/field-manager/assets/[assetId]/open/route.ts'),
  ]);

  assert.match(managerClient, /setLocationGate\(\{/);
  assert.match(managerClient, /<FieldManagerServiceLocationModal/);
  assert.doesNotMatch(managerClient, /window\.location\.assign\(payload\.redirectTo\)/);
  assert.match(serviceLocationModal, /saveFieldManagerServiceLocation/);
  assert.match(serviceLocationModal, /window\.location\.assign\(redirectTo\)/);
  assert.match(serviceLocationModal, /<FuelLocationModal/);
  assert.match(fuelLocationModal, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(fuelLocationModal, /maximumAge: 0/);
  assert.match(fuelLocationModal, /locationState === 'error'[\s\S]*?\? 'Retry'/);
  assert.match(locationSession, /aim4price_qr_scan_session_v1:/);
  assert.match(locationSession, /latitude: String\(input\.latitude\)/);
  assert.match(openRoute, /publicAssetCode: asset\.publicAssetCode/);
});

