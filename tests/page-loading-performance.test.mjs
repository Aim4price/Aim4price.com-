import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('runtime table guards use a read-only schema probe before fallback DDL', async () => {
  const files = await Promise.all([
    read('lib/account-profile.ts'),
    read('lib/partner-access.ts'),
    read('lib/dealer-asset-corrections.ts'),
    read('lib/dealer-maintenance-tracker.ts'),
    read('lib/asset-maintenance.ts'),
    read('lib/field-manager.ts'),
  ]);

  for (const source of files) {
    const readinessIndex = source.indexOf('isDatabaseSchemaReady');
    const fallbackDdlIndex = source.indexOf('create table if not exists');
    assert.notEqual(readinessIndex, -1);
    assert.notEqual(fallbackDdlIndex, -1);
    assert.ok(readinessIndex < fallbackDdlIndex);
  }

  const accountProfile = files[0];
  const partnerAccess = files[1];
  assert.match(accountProfile, /accountProfileColumnsPromise: Promise<void> \| null/);
  assert.match(partnerAccess, /partnerAccessTablesPromise: Promise<void> \| null/);
});

test('database connections fail promptly instead of leaving pages spinning forever', async () => {
  const database = await read('lib/db.ts');

  assert.match(database, /connectionTimeoutMillis: 10_000/g);
  assert.match(database, /idleTimeoutMillis: 30_000/g);
  assert.match(database, /keepAlive: true/g);
});

test('lead list removes embedded logos and hydrates independent data concurrently', async () => {
  const partnerAccess = await read('lib/partner-access.ts');

  assert.match(partnerAccess, /asset_snapshot_json - 'logoUrl' as asset_snapshot_json/);
  assert.match(partnerAccess, /assetSnapshot\.logoUrl = `\/api\/asset-leads\/\$\{row\.id\}\/logo`/);
  assert.match(partnerAccess, /const \[attachmentLeads, correctionLeads, maintenanceLeads\] = await Promise\.all/);
  assert.match(partnerAccess, /getAssetLeadLogoForUser/);
  assert.match(partnerAccess, /owner_user_id = \$2 or partner_user_id = \$2/);
  assert.match(partnerAccess, /asset_register_item_id = any\(\$2::uuid\[\]\)/);
});

test('Dealer Leads renders the first page before enriching the remaining inbox', async () => {
  const [leadsPage, leadsClient, partnerAccess] = await Promise.all([
    read('app/leads/page.tsx'),
    read('app/leads/leads-client.tsx'),
    read('lib/partner-access.ts'),
  ]);

  assert.match(leadsPage, /INITIAL_LEAD_BATCH_SIZE = 10/);
  assert.match(leadsPage, /limit: INITIAL_LEAD_BATCH_SIZE \+ 1/);
  assert.match(leadsPage, /initialLeadsHaveMore=/);
  assert.match(leadsClient, /loadData\(false, true\)/);
  assert.match(leadsClient, /if \(!background\) setIsLoading\(true\)/);
  assert.match(partnerAccess, /options: \{ limit\?: number \} = \{\}/);
  assert.match(partnerAccess, /order by l\.created_at desc\$\{limitSql\}/);
});

test('Dealer lead actions and report flow match the Owner experience', async () => {
  const [leadsClient, leadsStyles, costReport, maintenanceReport, ownerRegister] = await Promise.all([
    read('app/leads/leads-client.tsx'),
    read('app/leads/page.module.css'),
    read('components/DealerCostOfOwnershipReportModal.tsx'),
    read('components/DealerMaintenanceReportModal.tsx'),
    read('app/asset-register/asset-register-client.tsx'),
  ]);

  const ownerGear = ownerRegister.match(/<path d="M12\.22 2h-\.44[^\n]+/u)?.[0];
  assert.ok(ownerGear);
  assert.match(leadsClient, /<strong>Schedule maintenance<\/strong>/);
  assert.doesNotMatch(leadsClient, /<strong>Call client<\/strong>/);
  assert.ok(leadsClient.includes(ownerGear));
  assert.match(leadsStyles, /\.leadManageModal \{[\s\S]*max-width: 92rem !important/);
  assert.match(leadsStyles, /\.leadsPage \.leadAssetCard \.leadManageButton \{[\s\S]*#e6f8ef/);

  for (const reportSource of [costReport, maintenanceReport]) {
    assert.match(reportSource, /\/brand\/pdf\.png/);
    assert.match(reportSource, /\/brand\/sheet\.png/);
    assert.match(reportSource, /Choose export format/);
    assert.match(reportSource, /Report timeline/);
    assert.match(reportSource, />\s*Back\s*</);
    assert.match(reportSource, />\s*Cancel\s*</);
  }
});

test('lead logos are served lazily through an authenticated route', async () => {
  const route = await read('app/api/asset-leads/[leadId]/logo/route.ts');

  assert.match(route, /getServerSession/);
  assert.match(route, /getAssetLeadLogoForUser/);
  assert.match(route, /Cache-Control/);
});

test('lead and dealer routes provide immediate loading feedback', async () => {
  const [leadsLoading, dealerLoading, trackingLoading, component] = await Promise.all([
    read('app/leads/loading.tsx'),
    read('app/dealer/loading.tsx'),
    read('app/tracking/loading.tsx'),
    read('components/PageLoadingState.tsx'),
  ]);

  assert.match(leadsLoading, /Loading My Leads/);
  assert.match(dealerLoading, /Loading Dealer workspace/);
  assert.match(trackingLoading, /Loading maintenance/);
  assert.match(component, /aria-busy="true"/);
});

test('heavy lead modals are split out of the initial client bundle', async () => {
  const leadsClient = await read('app/leads/leads-client.tsx');

  assert.match(leadsClient, /import dynamic from 'next\/dynamic'/);
  assert.match(leadsClient, /dynamic\(\s*\(\) => import\('\.\.\/\.\.\/components\/DealerMaintenanceReportModal'\)/);
  assert.doesNotMatch(leadsClient, /import DealerMaintenanceReportModal from/);
});
