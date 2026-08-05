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

test('Dealer App home mirrors the Owner App launcher without dropping dealer tools', () => {
  const source = read('app/dealer/page.tsx');
  assert.match(source, /styles\.homeLauncher/);
  assert.match(source, /styles\.homeLaunchCard/);
  assert.match(source, /styles\.homeLaunchBadge/);
  assert.doesNotMatch(source, /toolSection|cardCopy|cardArrow|description:/);
  assert.doesNotMatch(source, /href: '\/dealer\/clients'|label: 'Clients'/);
  assert.match(source, /label: 'Notifications'/);
  assert.match(source, /label: 'Leads'/);
  assert.match(source, /label: 'Maintenance'/);
  assert.match(source, /label: 'Get Estimate'/);
  assert.match(source, /label: 'Discover Assets'/);
  assert.match(source, /label: 'Client Costs'/);
  assert.match(source, /label: 'Marketplace'/);
  assert.match(source, /newLeadCount/);
  assert.match(source, /attentionCount/);
});

test('Dealer App top controls follow the Owner App back, home and sign-out flow', () => {
  const source = read('app/dealer/dealer-nav.tsx');
  const styles = read('app/dealer/dealer.module.css');
  assert.match(source, /backIsHome/);
  assert.match(source, /styles\.navPair/);
  assert.match(source, /Dealer App home/);
  assert.doesNotMatch(source, /navBrand|navArrow/);
  assert.match(styles, /\.navButton,[\s\S]*?\.signOut \{[\s\S]*?min-height: 50px/);
  assert.match(styles, /\.navSignOut \{[\s\S]*?position: absolute;[\s\S]*?left: 50%;[\s\S]*?transform: translateX\(-50%\)/);
  assert.match(styles, /\.homeShell\.homeShell \{[\s\S]*?min-height: 100dvh/);
  assert.match(styles, /\.homeLauncher \{[\s\S]*?width: min\(100%, 400px\)/);
  assert.match(styles, /@media \(min-width: 600px\)[\s\S]*?\.homeLauncher \{[\s\S]*?grid-template-columns: repeat\(2/);
});

test('Dealer Maintenance summaries apply filters and focus the open asset', () => {
  const source = read('components/DealerMaintenanceTrackerClient.tsx');
  assert.match(source, /WorkspaceTitlePanel title="MAINTENANCE TRACKING"/);
  assert.match(source, /chooseStatusFilter\('attention'\)/);
  assert.match(source, /chooseStatusFilter\('all'\)/);
  assert.match(source, /chooseStatusFilter\('no_open'\)/);
  assert.match(source, />Nothing due</);
  assert.match(source, /maintenanceStatusGuidance/);
  assert.match(source, /openAccessId && !isOpen \? styles\.trackerCardMuted/);
});

test('Dealer Leads summaries use stable counts and focus the open lead', () => {
  const source = read('app/leads/leads-client.tsx');
  assert.match(source, /const summaryLeads = useMemo/);
  assert.match(source, /chooseLeadStatusFilter\('new'\)/);
  assert.match(source, /chooseLeadStatusFilter\('open'\)/);
  assert.match(source, /chooseLeadStatusFilter\('completed'\)/);
  assert.match(source, /Handled leads/);
  assert.match(source, /Mark handled/);
  assert.doesNotMatch(source, />Completed</);
  assert.doesNotMatch(source, />Mark done</);
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
