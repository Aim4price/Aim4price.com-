import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Overview Clear asks the correct follow-up for maintenance and problems', async () => {
  const [confirmation, styles] = await Promise.all([
    read('app/field-manager/overview-clear-confirmation.tsx'),
    read('app/field-manager/page.module.css'),
  ]);

  assert.match(confirmation, /step.*'confirm' \| 'completion'/);
  assert.match(confirmation, /isProblem[\s\S]*?'Has the problem been dealt with\?'/);
  assert.match(confirmation, /'Was it completed\?'/);
  assert.match(confirmation, /Not sure<\/strong> clears the reminder without saving maintenance\./);
  assert.match(confirmation, /outcome: 'clear'/);
  assert.match(confirmation, /outcome: 'completed'/);
  assert.match(confirmation, /onClick=\{onCancel\}[\s\S]*?>\s*Not yet\s*</);
  assert.match(confirmation, /outcome: 'problem_done'[\s\S]*?Yes, done/);
  assert.match(confirmation, /This clears it for the Owner and all Field Managers\./);
  assert.doesNotMatch(confirmation, /No, just clear/);
  assert.match(confirmation, /className=\{styles\.overviewConfirmClose\}[\s\S]*?onClick=\{onCancel\}[\s\S]*?disabled=\{isClearing\}[\s\S]*?aria-label="Close Overview clear confirmation"/);
  assert.match(styles, /\.overviewConfirmCard\[data-step='completion'\]/);
  assert.match(styles, /\.overviewConfirmScope legend \{[\s\S]*?margin-bottom: 8px/);
  assert.match(styles, /\.overviewConfirmClose \{[\s\S]*?position: absolute/);
  assert.match(styles, /white-space: nowrap/);
});

test('scheduled maintenance Not sure only dismisses while Yes records basic work and keeps recurrence', async () => {
  const [dealerRoute, fieldRoute, ownerRoute, maintenance] = await Promise.all([
    read('app/api/dealer/overview/clear/route.ts'),
    read('app/api/field-manager/overview/dismiss/route.ts'),
    read('app/api/owner-app/attention/route.ts'),
    read('lib/asset-maintenance.ts'),
  ]);

  for (const route of [dealerRoute, fieldRoute, ownerRoute]) {
    assert.match(route, /if \([^)]*Outcome === 'completed'\)|if \(outcome === 'completed'\)/);
    assert.match(route, /completeAssetMaintenanceRecord\(/);
    assert.match(route, /unknownMaintenanceCompletionNote\(item\.type\)/);
    assert.match(route, /allowUnknownDetails: true/);
    assert.match(route, /else if \([^)]*Outcome === 'problem_done'\)|else if \(outcome === 'problem_done'\)/);
    assert.match(route, /if \(item\.type === 'problem'\) throw new Error\('OVERVIEW_PROBLEM_NOT_DONE'\)/);
  }

  assert.match(maintenance, /Check-up done, no additional information available\./);
  assert.match(maintenance, /Service done, no additional information available\./);
  assert.match(maintenance, /const nextRecord = await createNextRecurringRecord\(client, userId, completed\)/);
});

test('Dealer Overview uses the same maintenance and problem Clear decisions, not Notifications', async () => {
  const [client, overview, notificationRoute, notificationInbox] = await Promise.all([
    read('app/dealer/overview/dealer-overview-client.tsx'),
    read('lib/dealer-overview.ts'),
    read('app/api/dealer/maintenance/notifications/route.ts'),
    read('lib/dealer-maintenance-notification-inbox.ts'),
  ]);

  assert.match(client, /<OverviewClearConfirmation/);
  assert.match(client, /fetch\('\/api\/dealer\/overview\/clear'/);
  assert.match(overview, /dealer_overview_dismissals/);
  assert.match(overview, /dismissDealerOverviewItem/);
  assert.doesNotMatch(notificationRoute, /completed|clearDealerMaintenanceNotificationsForViewer/);
  assert.doesNotMatch(notificationInbox, /recordStandaloneAssetMaintenanceCompletion|unknownMaintenanceCompletionNote/);
});

test('Overview clears can be shared across Owner and Field Manager viewers', async () => {
  const [ownerOverview, fieldOverview, ownerRoute] = await Promise.all([
    read('lib/owner-app-overview.ts'),
    read('lib/field-manager-overview.ts'),
    read('app/api/owner-app/attention/route.ts'),
  ]);

  assert.match(ownerOverview, /ALL_OVERVIEW_VIEWERS_KEY = 'everyone'/);
  assert.match(ownerOverview, /viewer_key = any\(\$2::text\[\]\)/);
  assert.match(fieldOverview, /listOwnerAppOverviewGlobalDismissalKeys/);
  assert.match(fieldOverview, /dismissOwnerAppOverviewSourceForEveryone\(/);
  assert.match(ownerRoute, /body\.clearForEveryone === true && access\.accessRole === 'admin'/);
});
