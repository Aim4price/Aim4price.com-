import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Dealer App Leads paints from received dealer leads and always hydrates the full inbox', async () => {
  const [loader, page, client] = await Promise.all([
    read('lib/dealer-leads-initial-load.ts'),
    read('app/dealer/leads/page.tsx'),
    read('app/leads/leads-client.tsx'),
  ]);

  assert.match(page, /const INITIAL_LEAD_BATCH_SIZE = 10/);
  assert.match(page, /listInitialDealerReceivedLeads\(session\.user\.id, INITIAL_LEAD_BATCH_SIZE\)/);
  assert.match(page, /initialLeads=\{initialLeads\}/);
  assert.match(page, /initialLeadsHaveMore\s*\n/);

  assert.match(loader, /where l\.partner_user_id = \$1/);
  assert.match(loader, /order by l\.created_at desc, l\.id desc/);
  assert.match(loader, /limit \$2/);
  assert.doesNotMatch(loader, /owner_user_id = \$1 or l\.partner_user_id = \$1/);

  assert.match(client, /initialLeadsHaveMore/);
  assert.match(client, /window\.setTimeout\(\(\) => void loadData\(false, true\), 0\)/);
});

test('Dealer Maintenance paints from a ten-asset batch and hydrates full data after render', async () => {
  const [loader, dealerPage, desktopPage, dealerClient, desktopClient] = await Promise.all([
    read('lib/dealer-maintenance-initial-load.ts'),
    read('app/dealer/maintenance/page.tsx'),
    read('app/tracking/page.tsx'),
    read('app/dealer/maintenance/dealer-maintenance-client.tsx'),
    read('app/tracking/tracking-client.tsx'),
  ]);

  assert.match(loader, /DEFAULT_INITIAL_MAINTENANCE_SIZE = 10/);
  assert.match(loader, /limit \$3/);
  assert.match(loader, /getDealerTrackedAsset\(input\.dealerUserId, row\.id\)/);
  assert.match(loader, /hasMore: result\.rows\.length > limit/);

  for (const page of [dealerPage, desktopPage]) {
    assert.match(page, /const INITIAL_MAINTENANCE_BATCH_SIZE = 10/);
    assert.match(page, /listInitialDealerTrackedAssets/);
    assert.match(page, /initialAssetsHaveMore=\{initialLoad\.hasMore\}/);
  }

  for (const client of [dealerClient, desktopClient]) {
    assert.match(client, /if \(!initialAssetsHaveMore\) return undefined/);
    assert.match(client, /fetch\('\/api\/dealer\/maintenance'/);
    assert.match(client, /window\.setTimeout\(\(\) => \{/);
    assert.match(client, /setAssets\(payload\.assets\)/);
  }
});
