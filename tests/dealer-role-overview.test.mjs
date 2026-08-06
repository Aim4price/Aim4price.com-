import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Dealer Staff roles preserve the agreed tool visibility', () => {
  const access = read('lib/dealer-app-access.ts');
  const home = read('app/dealer/page.tsx');
  assert.match(access, /technician: new Set\(\['overview', 'maintenance'\]\)/);
  assert.match(access, /sales: new Set\([\s\S]*?'marketplace'[\s\S]*?\)/);
  assert.doesNotMatch(access.match(/sales: new Set\(([\s\S]*?)\),\n  parts:/)?.[1] ?? '', /client_costs/);
  assert.doesNotMatch(access.match(/parts: new Set\(([\s\S]*?)\),\n  technician:/)?.[1] ?? '', /valuation|marketplace/);
  assert.match(home, /\.filter\(\(tool\) => dealerRoleCan\(role, tool\.capability\)\)/);
  const protectedPages = [
    ['app/dealer/leads/page.tsx', 'leads'],
    ['app/dealer/maintenance/page.tsx', 'maintenance'],
    ['app/dealer/valuation/page.tsx', 'valuation'],
    ['app/dealer/discovery/page.tsx', 'discovery'],
    ['app/dealer/marketplace/page.tsx', 'marketplace'],
  ];
  for (const [path, capability] of protectedPages) {
    const page = read(path);
    assert.match(page, new RegExp(`dealerRoleCan\\(dealerAppSession\\.role, '${capability}'\\)`));
  }
});

test('Dealer Staff records store and return an explicit role', () => {
  const source = read('lib/dealer-app.ts');
  const migration = read('database/migrations/62-dealer-staff-roles-problem-assignments.sql');
  const client = read('app/account/dealer-app/dealer-access-client.tsx');
  assert.match(source, /export type DealerStaffRole = 'owner' \| 'sales' \| 'parts' \| 'technician'/);
  assert.match(source, /staff_role=\$7/);
  assert.match(source, /role !== normalizeDealerStaffRole\(row\.staff_role\)/);
  assert.match(migration, /check \(staff_role in \('owner', 'sales', 'parts', 'technician'\)\)/);
  assert.match(client, /Owner \/ Manager/);
  assert.match(client, /Overview and Maintenance only\./);
});

test('Dealer Overview uses the Owner and Field Manager overview structure and styling', () => {
  const source = read('app/dealer/overview/dealer-overview-client.tsx');
  assert.match(source, /import overviewStyles from '\.\.\/\.\.\/field-manager\/page\.module\.css'/);
  assert.match(source, /overviewStyles\.overviewPage/);
  assert.match(source, /overviewStyles\.overviewIntro/);
  assert.match(source, /overviewStyles\.overviewSearch/);
  assert.match(source, /placeholder="Search assets or maintenance"/);
  assert.match(source, />Needs attention</);
  assert.match(source, />Upcoming</);
  assert.match(source, /No matching items need attention\./);
  assert.match(source, /No matching upcoming items\./);
});

test('All Dealer roles receive the same shared problem records while managers control assignment', () => {
  const overview = read('lib/dealer-overview.ts');
  const route = read('app/api/dealer/overview/problems/[problemId]/route.ts');
  const migration = read('database/migrations/62-dealer-staff-roles-problem-assignments.sql');
  assert.match(overview, /problemItems\(assets, assignments\)/);
  assert.match(overview, /canManageAssignments: input\.role === 'owner'/);
  assert.match(overview, /Assigned to \$\{assignedStaffName\}/);
  assert.match(route, /role !== 'owner'/);
  assert.match(route, /Only an owner or manager can assign problems\./);
  assert.match(migration, /unique \(dealer_user_id, issue_note_status_id\)/);
  assert.match(migration, /assigned_staff_id uuid references public\.dealer_app_staff/);
});
