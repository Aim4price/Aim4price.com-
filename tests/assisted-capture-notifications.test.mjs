import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('owners receive an actionable Cost Ledger link when assisted capture awaits approval', async () => {
  const notifications = await read('lib/notifications.ts');

  assert.match(notifications, /import \{ listCaptureRequests \} from '\.\/capture-requests'/);
  assert.match(notifications, /ownerUserId: userId/);
  assert.match(notifications, /requestTypes: \['invoice'\]/);
  assert.match(notifications, /statuses: \['awaiting_owner'\]/);
  assert.match(notifications, /category: 'capture'/);
  assert.match(notifications, /tone: 'warning'/);
  assert.match(notifications, /captureRequestId: request\.id/);
  assert.match(notifications, /priority: true/);
  assert.match(notifications, /`\/my-invoices\?captureRequestId=\$\{encodeURIComponent\(request\.id\)\}`/);
});

test('capture notifications are durable action items and stale approvals resolve themselves', async () => {
  const inbox = await read('lib/notification-inbox.ts');

  assert.match(inbox, /\|\| item\.captureRequestId/);
  assert.match(inbox, /captureRequestId: item\.captureRequestId/);
  assert.match(inbox, /captureRequestId: asOptionalText\(payload\.captureRequestId\)/);
  assert.match(inbox, /async function resolveStaleCaptureSnapshots/);
  assert.match(inbox, /notification\.category = 'capture'/);
  assert.match(inbox, /notification\.resolved_at is null/);
  assert.match(inbox, /from public\.document_capture_requests request/);
  assert.match(inbox, /request\.status = 'awaiting_owner'/);
  assert.match(inbox, /await resolveStaleCaptureSnapshots\(stateKey, input\.userId\)/);
});

test('notification clients keep capture approval as a generic navigation link', async () => {
  const [header, ownerNotifications] = await Promise.all([
    read('components/AppHeader.tsx'),
    read('app/owner-app/notifications/owner-notifications-client.tsx'),
  ]);

  assert.match(header, /'dealer_cost' \| 'capture' \| 'dealer_correction'/);
  assert.match(header, /captureRequestId\?: string/);
  assert.doesNotMatch(header, /captureRequestId[\s\S]{0,180}notificationApproveButton/);
  assert.match(ownerNotifications, /captureRequestId\?: string/);
  assert.match(ownerNotifications, /item\.category === 'capture' && item\.href/);
  assert.match(ownerNotifications, /item\.category === 'dealer_cost' \|\| item\.category === 'capture'/);
});
