import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [leadsClient, leadsStyles, maintenanceClient, registerGateway, registerClient] = await Promise.all([
  read('app/leads/leads-client.tsx'),
  read('app/leads/page.module.css'),
  read('components/DealerMaintenanceTrackerClient.tsx'),
  read('app/asset-register/dealer-register-gateway.tsx'),
  read('app/asset-register/asset-register-client.tsx'),
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
  assert.match(registerClient, /dealerRegisterMode === 'client'[\s\S]*?`\$\{savedRegisterTitle\} Asset Register`/);
  assert.doesNotMatch(registerClient, /styles\.dealerRegisterContextPill/);
  assert.match(registerClient, /if \(dealerRegisterMode\) \{[\s\S]*?return null;/);
  assert.match(registerClient, /const canManageAssetGroups =[\s\S]*?!dealerRegisterMode/);
  assert.match(registerClient, /\{canManageAssetGroups \? \([\s\S]*?<UmbrellaIcon/);
  assert.doesNotMatch(registerGateway, /<span>Client Asset Registers<\/span>|<b>Open<\/b>/);
  assert.match(registerGateway, /Open register →/);
});
