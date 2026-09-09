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
  assert.match(source, /label: 'Overview'/);
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
  assert.match(styles, /\.homeShell\.homeShell \{[\s\S]*?flex-direction: column;[\s\S]*?box-sizing: border-box;[\s\S]*?calc\(82px \+ env\(safe-area-inset-top\)\)[\s\S]*?max\(12px, env\(safe-area-inset-right\)\)[\s\S]*?max\(12px, env\(safe-area-inset-left\)\)/);
  assert.match(styles, /\.homeContent \{[\s\S]*?flex: 1 0 auto;[\s\S]*?width: min\(100%, 560px\);[\s\S]*?min-width: 0/);
  assert.match(styles, /@media \(min-width: 600px\)[\s\S]*?\.homeShell\.homeShell \{[\s\S]*?padding-top: calc\(90px \+ env\(safe-area-inset-top\)\)[\s\S]*?max\(24px, env\(safe-area-inset-right\)\)[\s\S]*?max\(24px, env\(safe-area-inset-left\)\)/);
  assert.match(styles, /\.homeLauncher \{[\s\S]*?width: min\(100%, 400px\)[\s\S]*?min-width: 0/);
  assert.match(styles, /\.homeLauncher \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(styles, /\.homeLauncher \{[^}]*grid-template-columns: repeat\(2/);
});

test('Dealer App notifications reuse the Owner App notification experience', () => {
  const page = read('app/dealer/notifications/page.tsx');
  const source = read('app/dealer/notifications/dealer-maintenance-notifications-client.tsx');
  const styles = read('app/dealer/dealer.module.css');
  assert.match(page, /styles\.notificationOwnerPage/);
  assert.match(source, /owner-app\/owner-app\.module\.css/);
  assert.doesNotMatch(source, /maintenance-tracker\.module\.css/);
  assert.match(source, /styles\.notificationContent/);
  assert.match(source, /styles\.markCheckedButton/);
  assert.match(source, /styles\.notificationSectionHeading/);
  assert.match(source, /styles\.notificationCardNew/);
  assert.match(source, /formatNotificationTime/);
  assert.match(source, /items\.filter\(\(notification\) => !notification\.isRead\)/);
  assert.match(source, /handleMarkChecked/);
  assert.match(styles, /\.notificationOwnerPage\.notificationOwnerPage \{[\s\S]*?--owner-page-gutter: 28px;[\s\S]*?--owner-content-gap: 14px/);
  assert.match(styles, /@media \(max-width: 390px\)[\s\S]*?--owner-page-gutter: 20px/);
  assert.match(styles, /@media \(min-width: 600px\)[\s\S]*?--owner-page-gutter: 48px/);
});

test('Dealer Maintenance summaries apply filters and focus the open asset', () => {
  const source = read('components/DealerMaintenanceTrackerClient.tsx');
  assert.match(source, /title=\{dealerAppMode \? 'MAINTENANCE' : 'MAINTENANCE TRACKING'\}/);
  assert.match(source, /chooseStatusFilter\('attention'\)/);
  assert.match(source, /chooseStatusFilter\('all'\)/);
  assert.match(source, /chooseStatusFilter\('no_open'\)/);
  assert.match(source, /dealerAppMode \? 'Due' : 'Nothing due'/);
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
  assert.match(source, /Owner, Sales, Parts or Technician/);
  assert.match(source, /ROLE_OPTIONS/);
  assert.match(source, /role: 'technician'/);
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


test('Dealer App Leads keeps every mobile action clear and reachable', () => {
  const page = read('app/dealer/leads/page.tsx');
  const source = read('app/leads/leads-client.tsx');
  const styles = read('app/leads/page.module.css');
  const dealerStyles = read('app/dealer/dealer.module.css');
  const correctionSource = read('components/DealerAssetCorrectionEditor.tsx');
  const correctionStyles = read('components/DealerAssetCorrectionEditor.module.css');

  assert.match(page, /styles\.leadsModule/);
  assert.match(dealerStyles, /\.leadsModule\.leadsModule \{[\s\S]*?padding-top: 0/);
  assert.match(dealerStyles, /\.maintenanceModule\.maintenanceModule \{[\s\S]*?padding-top: 0/);
  assert.match(source, /dealerAppMode \? 'LEADS SYSTEM' : 'LEAD MANAGEMENT SYSTEM'/);
  assert.match(source, /<h1>LEAD MANAGEMENT SYSTEM<\/h1>/);
  assert.match(source, /nativeSelect=\{dealerAppMode\}/);
  assert.match(source, /className=\{styles\.leadFilterNativeSelect\}/);
  assert.match(source, />\s*Reset\s*</);
  assert.match(source, />\s*Apply\s*</);
  assert.doesNotMatch(source, /Reset filters|Apply filters/);
  assert.match(styles, /\.dealerAppLeads \.leadSummaryFilterButton \{[\s\S]*?text-align: center/);
  assert.match(styles, /\.trackingLeadActionsSingle\.trackingLeadActionsClosed \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.leadNoteBody textarea:focus \{[\s\S]*?min-height: 12rem/);
  assert.match(source, /styles\.leadManageOverlay/);
  assert.match(source, /styles\.leadManageScrollBody/);
  assert.match(styles, /\.leadManageScrollBody \{[\s\S]*?overflow-y: auto/);
  assert.doesNotMatch(source, /leadEmailRecipientIcon/);
  assert.doesNotMatch(correctionSource, /modalIconShell|modalKicker/);
  assert.match(correctionStyles, /text-only[\s\S]*?\.modalTitleGroup \{[\s\S]*?display: block/);
});


test('Dealer App Leads follow-up keeps narrow screens spacious and collision free', () => {
  const nav = read('app/dealer/dealer-nav.tsx');
  const source = read('app/leads/leads-client.tsx');
  const styles = read('app/leads/page.module.css');
  const dealerStyles = read('app/dealer/dealer.module.css');

  assert.match(nav, /pathname\.startsWith\('\/dealer\/leads'\)/);
  assert.match(nav, /styles\.navLeadsSurface/);
  assert.match(dealerStyles, /\.navLeadsSurface\.navLeadsSurface \{[\s\S]*?background: rgba\(246, 250, 247, 0\.98\)[\s\S]*?box-shadow: none/);
  assert.match(styles, /\.dealerAppLeads \.leadsTitlePanel \{[\s\S]*?text-align: center/);
  assert.match(source, /styles\.leadNoteOverlay/);
  assert.match(styles, /\.leadNoteModal\.leadNoteModal \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) auto/);
  assert.match(styles, /\.leadNoteBody\.leadNoteBody \{[\s\S]*?overflow-y: auto/);
  assert.match(styles, /\.leadManageModal\.leadManageModal \{[\s\S]*?max-width: 68rem/);
  assert.match(styles, /\.leadManageModal \.manageOptionsGrid > button \{[\s\S]*?min-height: 7rem/);
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*?\.dealerAppLeads \.trackingLeadActionsClosed,[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
});

test('Dealer App Maintenance and Dealer desktop dialogs keep their own rules', () => {
  const page = read('app/dealer/maintenance/page.tsx');
  const nav = read('app/dealer/dealer-nav.tsx');
  const dealerStyles = read('app/dealer/dealer.module.css');
  const maintenanceSource = read('components/DealerMaintenanceTrackerClient.tsx');
  const maintenanceStyles = read('components/DealerMaintenanceTrackerClient.module.css');
  const leadsSource = read('app/leads/leads-client.tsx');
  const leadsStyles = read('app/leads/page.module.css');

  assert.match(page, /dealerStyles\.maintenanceModule/);
  assert.match(nav, /pathname\.startsWith\('\/dealer\/maintenance'\)/);
  assert.match(dealerStyles, /\.leadsModule\.leadsModule \{[\s\S]*?padding-top: 0/);
  assert.match(dealerStyles, /\.maintenanceModule\.maintenanceModule \{[\s\S]*?padding-top: 0/);

  assert.match(maintenanceSource, /dealerAppMode \? 'MAINTENANCE' : 'MAINTENANCE TRACKING'/);
  assert.match(maintenanceSource, /dealerAppMode \? 'Attention' : 'Needs attention'/);
  assert.match(maintenanceSource, /dealerAppMode \? 'Tracked' : 'Tracked equipment'/);
  assert.match(maintenanceSource, /dealerAppMode \? 'Due' : 'Nothing due'/);
  assert.match(maintenanceSource, /nativeSelect=\{dealerAppMode\}/);
  assert.match(maintenanceSource, /dealerAppMode \? 'Clear' : 'Clear filters'/);
  assert.match(maintenanceSource, /dealerAppMode \? 'Apply' : 'Apply filters'/);
  assert.match(maintenanceStyles, /\.dealerApp \.maintenanceTitlePanel \{[\s\S]*?text-align: center/);
  assert.match(maintenanceStyles, /\.dealerApp \.trackerManageModal\.trackerManageModal \{[\s\S]*?height: min\(50rem/);
  assert.match(maintenanceStyles, /\.dealerDesktop \.trackerManageModal\.trackerManageModal \{[\s\S]*?max-width: 60rem/);
  assert.match(maintenanceStyles, /\.dealerDesktop \.trackerManageModal \[class\*='optionActionButton'\] \{[\s\S]*?min-height: 5\.25rem/);

  assert.match(leadsSource, /if \(dealerAppMode\) \{[\s\S]*?window\.location\.href = `mailto:/);
  assert.match(leadsSource, /dealerWorkspaceMode && !accountantWorkspaceMode \? styles\.dealerDesktopLeads/);
  assert.match(leadsStyles, /\.dealerDesktopLeads \.leadManageModal\.leadManageModal \{[\s\S]*?max-width: 60rem/);
  assert.match(leadsStyles, /\.dealerDesktopLeads \.leadManageModal \.manageOptionsGrid > button \{[\s\S]*?min-height: 5\.25rem/);
});

test('Dealer Leads and Maintenance keep search, service details and desktop actions concise', () => {
  const leadsSource = read('app/leads/leads-client.tsx');
  const maintenanceSource = read('components/DealerMaintenanceTrackerClient.tsx');
  const maintenanceStyles = read('components/DealerMaintenanceTrackerClient.module.css');
  const trackerSource = read('lib/dealer-maintenance-tracker.ts');

  assert.match(leadsSource, /function searchableAssetSnapshotText[\s\S]*?serialNumber[\s\S]*?registrationNumber/);
  assert.match(leadsSource, /registerLeadAssets\(lead\)\.map\(searchableAssetSnapshotText\)/);
  assert.ok(leadsSource.includes("query.replace(/[^a-z0-9]/g, '')"));
  assert.match(leadsSource, /placeholder="Search business, asset, serial or registration"/);
  assert.match(leadsSource, /<small>Choose a report\.<\/small>/);

  assert.match(trackerSource, /registrationNumber: string/);
  assert.match(trackerSource, /registrationNumber: asset\.licenseRegistrationNumber/);
  assert.match(maintenanceSource, /asset\.registrationNumber/);
  assert.ok(maintenanceSource.includes("searchText.replace(/[^a-z0-9]/g, '')"));
  assert.match(maintenanceSource, /placeholder="Search business, asset, serial or registration"/);
  assert.match(maintenanceSource, /<span>Registration<\/span><strong>\{asset\.registrationNumber/);
  assert.match(maintenanceSource, /Current Usage:/);
  assert.match(maintenanceSource, /<span>Current usage<\/span>/);
  assert.match(maintenanceSource, /<span>Service due<\/span>/);
  assert.match(maintenanceSource, /asset\.nextMaintenance\?\.recurringEnabled \? \([\s\S]*?<span>Recurring<\/span><strong>\{recurringLabel\(asset\.nextMaintenance\)\}/);
  assert.doesNotMatch(maintenanceSource, /Recurring service|<strong>Not recurring<\/strong>/);
  assert.doesNotMatch(maintenanceSource, /<span>Quick view<\/span>/);
  assert.doesNotMatch(maintenanceSource, /<h3>Upcoming maintenance<\/h3>/);

  assert.match(maintenanceSource, /Message the owner on WhatsApp\./);
  assert.match(maintenanceSource, /Send a schedule for owner approval\./);
  assert.match(maintenanceSource, /Download maintenance history\./);
  assert.match(maintenanceStyles, /\.dealerDesktop \.trackerManageModal \[class\*='optionActionButton'\] small \{[\s\S]*?white-space: nowrap/);
  assert.match(maintenanceStyles, /\.trackerSectionsIntro h3 \{[\s\S]*?font-family:[\s\S]*?font-weight: 850/);
});
