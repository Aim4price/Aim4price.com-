import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Dealer desktop keeps Leads, Maintenance and Client Costs without a Clients workspace', () => {
  const source = read('components/AppHeader.tsx');
  assert.match(source, /key: 'tracking', href: '\/tracking', label: 'Maintenance'/);
  assert.match(source, /key: 'cost', href: '\/dealer-costs', label: 'Client Costs'/);
  assert.doesNotMatch(source, /dealer-clients|key: 'clients'/);
  assert.match(source, /const navWindowSize = isAccountantWorkspace \? navItems\.length : NAV_WINDOW_SIZE/);
});

test('Dealer App home separates daily work from secondary tools', () => {
  const source = read('app/dealer/page.tsx');
  assert.match(source, /<h2>Work<\/h2>/);
  assert.match(source, /<h2>More dealer tools<\/h2>/);
  assert.doesNotMatch(source, /href: '\/dealer\/clients'|label: 'Clients'/);
  assert.match(source, /label: 'Client Costs'/);
  assert.match(source, /newLeadCount/);
  assert.match(source, /attentionCount/);
});

test('Dealer Maintenance summaries apply filters and focus the open asset', () => {
  const source = read('components/DealerMaintenanceTrackerClient.tsx');
  assert.match(source, /chooseStatusFilter\('attention'\)/);
  assert.match(source, /chooseStatusFilter\('all'\)/);
  assert.match(source, /chooseStatusFilter\('no_open'\)/);
  assert.match(source, /openAccessId && !isOpen \? styles\.trackerCardMuted/);
});

test('Dealer Leads summaries use stable counts and focus the open lead', () => {
  const source = read('app/leads/leads-client.tsx');
  assert.match(source, /const summaryLeads = useMemo/);
  assert.match(source, /chooseLeadStatusFilter\('new'\)/);
  assert.match(source, /chooseLeadStatusFilter\('open'\)/);
  assert.match(source, /chooseLeadStatusFilter\('completed'\)/);
  assert.match(source, /openLeadId && !isLeadOpen \? styles\.leadThreadMuted/);
});

test('Owner Asset Register and Discovery use the same focused-card pattern', () => {
  const registerSource = read('app/asset-register/asset-register-client.tsx');
  const discoverySource = read('app/asset-discovery/asset-discovery-client.tsx');
  assert.match(registerSource, /expandedAssetId && !isExpanded \? styles\.assetCardRowMuted/);
  assert.match(discoverySource, /expandedAssetId && expandedAssetId !== asset\.id \? styles\.discoveryCardMuted/);
});

test('Dealer staff access focuses one managed login at a time', () => {
  const source = read('app/account/dealer-app/dealer-access-client.tsx');
  assert.match(source, /expandedManagerId \? styles\.focusMuted/);
  assert.match(source, /expandedManagerId && !isExpanded \? styles\.managerCardMuted/);
  assert.match(source, /Get Estimate, Discovery, Leads, Client Costs, Maintenance/);
});

test('Dealer desktop uses neutral summary wording and concise cost search copy', () => {
  const leadsSource = read('app/leads/leads-client.tsx');
  const maintenanceSource = read('components/DealerMaintenanceTrackerClient.tsx');
  const costsSource = read('app/my-invoices/my-invoices-client.tsx');
  assert.doesNotMatch(leadsSource, /Tap to show/);
  assert.doesNotMatch(maintenanceSource, /Tap to show/);
  assert.match(costsSource, /Search client, asset or invoice/);
});

test('Dealer login enters Leads directly while preserving explicit redirects', () => {
  const source = read('app/auth/auth-client.tsx');
  assert.match(source, /authenticatedSession\?\.accountType === "dealer"/);
  assert.match(source, /!getSafeReturnTo\(\)/);
  assert.match(source, /getAbsoluteUrl\("\/leads"\)/);
  assert.match(source, /normalizeEmail\(email\) !== ADMIN_EMAIL/);
});

test('Dealer page requests deduplicate auth work and load independent data together', () => {
  const sessionSource = read('lib/auth-session.ts');
  const accessSource = read('lib/account-access.ts');
  const leadsPageSource = read('app/leads/page.tsx');
  const trackingPageSource = read('app/tracking/page.tsx');
  assert.match(sessionSource, /const session = options\.authSession \?\? await readAuthSession\(\)/);
  assert.match(accessSource, /getServerSession\(\{ requireActive: false, authSession: realSession \}\)/);
  assert.match(accessSource, /const \[effectiveSession, access\] = await Promise\.all/);
  assert.match(leadsPageSource, /const \[profile, initialLeads\] = await Promise\.all/);
  assert.match(trackingPageSource, /const \[profile, assets\] = await Promise\.all/);
});
