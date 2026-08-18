import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Desktop quick clear safely records unknown completion details', () => {
  const desktopClient = source('app/maintenance/maintenance-client.tsx');
  const completionRoute = source('app/api/maintenance/[maintenanceId]/complete/route.ts');

  assert.match(desktopClient, /type QuickClearStep = 'confirm' \| 'completion'/);
  assert.match(desktopClient, /Was it completed\?/);
  assert.match(desktopClient, /quickComplete: true/);
  assert.match(desktopClient, /Yes saves a basic completed record\. <strong>Not sure<\/strong> leaves it open/);
  assert.match(completionRoute, /body\.quickComplete === true/);
  assert.match(completionRoute, /unknownMaintenanceCompletionNote\(scheduled\.maintenanceType\)/);
  assert.match(completionRoute, /completedBy: completedByFallback/);
  assert.match(completionRoute, /allowUnknownDetails: true/);
});

test('Desktop maintenance refreshes and reserves red cards for due work', () => {
  const desktopClient = source('app/maintenance/maintenance-client.tsx');
  const styles = source('app/maintenance/page.module.css');

  assert.match(desktopClient, /window\.addEventListener\('focus', refresh\)/);
  assert.match(desktopClient, /document\.addEventListener\('visibilitychange', refresh\)/);
  assert.match(desktopClient, /window\.setInterval\(refresh, 60_000\)/);
  assert.match(desktopClient, /record\.computedStatus === 'due' \|\| record\.computedStatus === 'overdue'/);
  assert.match(desktopClient, /styles\.maintenanceCardDueSoon/);
  assert.match(desktopClient, /styles\.maintenanceCardUpcoming/);
  assert.match(styles, /\.invoiceRow\.maintenanceCardDueSoon/);
  assert.match(styles, /\.invoiceRow\.maintenanceCardUpcoming/);
  assert.match(styles, /\.maintenanceStatusNeutral/);
});

test('Desktop maintenance copy stays compact and four actions use a two-by-two grid', () => {
  const desktopClient = source('app/maintenance/maintenance-client.tsx');
  const styles = source('app/maintenance/page.module.css');
  const refinements = styles.slice(styles.indexOf('/* Desktop maintenance cards and quick-clear spacing. */'));

  assert.match(desktopClient, /Clear this \{typeLabel\(recordPendingQuickClear\.maintenanceType\)\.toLowerCase\(\)\} for/);
  assert.match(desktopClient, /styles\.rowActionsFour/);
  assert.match(refinements, /\.rowActionsFour\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(refinements, /\.maintenanceQuickClearModal \.deleteConfirmBody > p,[\s\S]*?white-space: nowrap/);
});
