import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  leadsClient,
  leadsStyles,
  maintenanceClient,
  registerGateway,
  registerClient,
  registerStyles,
  registerManagementPage,
  registerManagementClient,
] = await Promise.all([
  read('app/leads/leads-client.tsx'),
  read('app/leads/page.module.css'),
  read('components/DealerMaintenanceTrackerClient.tsx'),
  read('app/asset-register/dealer-register-gateway.tsx'),
  read('app/asset-register/asset-register-client.tsx'),
  read('app/asset-register/page.module.css'),
  read('app/asset-registers/page.tsx'),
  read('app/asset-registers/asset-registers-client.tsx'),
]);

test('lead cards present status and identifiers without pills', () => {
  assert.doesNotMatch(leadsClient, /leadStatusBadge|leadStatusLabel|leadStatusClass/);
  assert.doesNotMatch(leadsStyles, /\.leadStatusBadge/);
  assert.match(leadsClient, /className=\{styles\.leadAssetIdentifier\}/);

  const identifierRule = leadsStyles.match(/\.leadAssetIdentifier \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.doesNotMatch(identifierRule, /border|background|border-radius|padding/);
  assert.match(leadsStyles, /\.leadAssetIdentifier::before \{[\s\S]*?content: '·'/);
});

test('Maintenance uses concise attention copy and the Leads filter control', () => {
  assert.match(maintenanceClient, /Due, overdue, or awaiting usage\./);
  assert.doesNotMatch(maintenanceClient, /Overdue, due now, due soon, or waiting for a usage reading\./);
  assert.match(maintenanceClient, /<path d="M4 5h16M7 12h10M10 19h4" \/>/);
  assert.match(maintenanceClient, /<circle cx="15" cy="5" r="1\.5" \/>/);

  const filterButton = maintenanceClient.match(/<button type="button" className=\{`\$\{assetStyles\.secondaryButton\} \$\{assetStyles\.filterTriggerButton\}[\s\S]*?<\/button>/)?.[0] ?? '';
  assert.match(filterButton, /workspaceStyles\.actionMint/);
  assert.match(filterButton, /leadStyles\.leadFilterButton/);
  assert.match(filterButton, /<FilterIcon/);
  assert.doesNotMatch(filterButton, /ChevronDownIcon|filterChevron/);
});

test('dealer Asset Register gateway reuses the Marketplace entry design without videos', () => {
  assert.match(registerGateway, /import valuationStyles from '\.\.\/valuation\/page\.module\.css'/);
  assert.match(registerGateway, /import entryStyles from '\.\.\/marketplace\/marketplace-entry\.module\.css'/);
  assert.match(registerGateway, /entryStyles\.entryContainer/);
  assert.match(registerGateway, /valuationStyles\.sectorBigCard/);
  assert.match(registerGateway, /entryStyles\.entryChoiceCard/);
  assert.match(registerGateway, /Dealer Asset Register/);
  assert.match(registerGateway, /Client Asset Registers/);
  assert.doesNotMatch(registerGateway, /<video/);
});

test('dealer registers use meaningful titles without decorative pills or combined-register controls', () => {
  assert.match(registerClient, /dealerRegisterMode === 'dealer'[\s\S]*?\? 'Dealer Asset Register'/);
  assert.match(registerClient, /const registerPageTitle = isLoading[\s\S]*?: savedRegisterTitle;/);
  assert.doesNotMatch(registerClient, /`\$\{savedRegisterTitle\} Asset Register`/);
  assert.doesNotMatch(registerClient, /styles\.dealerRegisterContextPill/);
  assert.match(registerClient, /if \(dealerRegisterMode\) \{[\s\S]*?return null;/);
  assert.match(registerClient, /const canManageAssetGroups =[\s\S]*?!dealerRegisterMode/);
  assert.match(registerClient, /\{canManageAssetGroups \? \([\s\S]*?<UmbrellaIcon/);
  assert.match(registerClient, /\{canShareActiveRegister && !dealerRegisterMode \? \(/);
  assert.doesNotMatch(registerClient, /disabled=\{!canManageAssetGroups \|\| isMovingAssetRegister\}/);
  assert.doesNotMatch(registerClient, /disabled=\{!groupAnchorAsset \|\| !canManageAssetGroups\}/);
  assert.doesNotMatch(registerGateway, /<span>Client Asset Registers<\/span>|<b>Open<\/b>/);
  assert.match(registerGateway, /Open register <span aria-hidden="true">→<\/span>/);
});

test('dealer register management removes the combined register while preserving each client register', () => {
  assert.match(registerManagementPage, /showCombinedRegister=\{profile\.accountType !== "dealer"\}/);
  assert.match(registerManagementClient, /showCombinedRegister = true/);
  assert.match(registerManagementClient, /if \(!showCombinedRegister \|\| !registers\.length\) return null;/);
  assert.match(registerManagementClient, /\{combinedRegister \? \([\s\S]*?\) : null\}\s*\{visibleRegisters\.map/);
  assert.match(registerManagementClient, /\{showCombinedRegister \? \([\s\S]*?Merge specific Asset Registers/);
});

test('client register picker uses the owner modal controls without an Open pill', () => {
  assert.match(registerGateway, /className=\{`\$\{styles\.modalHeader\} \$\{styles\.dealerClientPickerHeader\}`\}/);
  assert.match(registerGateway, /className=\{styles\.modalCloseButton\}/);
  assert.match(registerGateway, /<CloseIcon className=\{styles\.buttonIcon\} \/>/);
  assert.match(registerStyles, /\.dealerClientPickerHeader > \.modalCloseButton \{[\s\S]*?flex: 0 0 auto;/);
  assert.doesNotMatch(registerGateway, /<b style=/);
});

test('Leads opens shared photos with the owner Asset Register viewer', () => {
  assert.equal((leadsClient.match(/assetStyles\.photoViewerOverlay/g) ?? []).length, 2);
  assert.equal((leadsClient.match(/assetStyles\.photoViewerModal/g) ?? []).length, 2);
  assert.equal((leadsClient.match(/assetStyles\.photoViewerStage/g) ?? []).length, 2);
  assert.equal((leadsClient.match(/assetStyles\.photoViewerImage/g) ?? []).length, 2);
  assert.equal((leadsClient.match(/assetStyles\.photoViewerCloseButton/g) ?? []).length, 2);
  assert.equal((leadsClient.match(/assetStyles\.photoViewerCounter/g) ?? []).length, 2);
  assert.doesNotMatch(leadsClient, /styles\.leadPhotoModal/);
});
