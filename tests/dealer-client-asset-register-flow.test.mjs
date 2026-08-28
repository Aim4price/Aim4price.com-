import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  header,
  registerPage,
  registerGateway,
  dealerInventoryPage,
  registerClient,
  valuationClient,
  valuationRoute,
  leadsClient,
  leadsStyles,
] = await Promise.all([
  read('components/AppHeader.tsx'),
  read('app/asset-register/page.tsx'),
  read('app/asset-register/dealer-register-gateway.tsx'),
  read('app/dealer/inventory/page.tsx'),
  read('app/asset-register/asset-register-client.tsx'),
  read('app/valuation/valuation-client.tsx'),
  read('app/api/valuation-runs/route.ts'),
  read('app/leads/leads-client.tsx'),
  read('app/leads/page.module.css'),
]);

test('dealer navigation is consistently named Asset Register', () => {
  assert.match(header, /accountType === 'dealer'[\s\S]*label: 'Asset Register'/);
  assert.doesNotMatch(header, /label: 'My Inventory'/);
});

test('dealer Asset Register sends client management directly to the registers page', () => {
  assert.match(registerPage, /DealerRegisterGateway/);
  assert.match(registerPage, /requestedView === "dealer"/);
  assert.match(registerPage, /requestedView === "client"/);
  assert.match(registerPage, /requestedView === "client"\)[\s\S]*?redirect\("\/asset-registers"\)/);
  assert.match(registerGateway, /Dealer Asset Register/);
  assert.match(registerGateway, /Client Asset Registers/);
  assert.match(registerGateway, /href=\{registerManagementHref\}[\s\S]*?aria-label="Manage Client Asset Registers"/);
  assert.doesNotMatch(registerGateway, /Choose a client register|openClientPicker|isClientPickerOpen/);
  assert.match(registerGateway, /valuationStyles\.sectorBigCard/);
  assert.match(registerGateway, /entryStyles\.entryChoiceCard/);
  assert.doesNotMatch(registerGateway, /<video/);
  assert.match(dealerInventoryPage, /<DealerRegisterGateway/);
  assert.match(dealerInventoryPage, /workspacePath="\/dealer\/inventory"/);
  assert.match(dealerInventoryPage, /redirect\('\/dealer\/inventory\/registers'\)/);
  assert.match(dealerInventoryPage, /dealerRegisterMode=\{registerMode\}/);
});

test('client registers reuse the complete owner Asset Register and keep client switching scoped', () => {
  assert.match(registerPage, /<AssetRegisterClient[\s\S]*dealerRegisterMode="client"/);
  assert.match(registerClient, /dealerRegisterMode\?: 'dealer' \| 'client'/);
  assert.match(registerClient, /dealerRegisterMode === 'client' && register\.isPrimary/);
  assert.match(registerClient, /Change Client Asset Register/);
  assert.match(registerClient, /dealerView=\$\{dealerRegisterMode\}/);
});

test('manual add flow gives dealers explicit dealer and client destinations', () => {
  assert.match(registerClient, /Where should this asset be added\?/);
  assert.match(registerClient, /Add to Dealer Asset Register/);
  assert.match(registerClient, /Add to Client Asset Register/);
  assert.match(registerClient, /dealerClientRegisterOptions/);
  assert.match(registerClient, /params\.set\([\s\S]*'dealerRegisterMode'/);
});

test('dealer estimates can save to either selected register without changing the owner flow', () => {
  assert.match(valuationClient, /normalizedSignedInAccountType === 'dealer'[\s\S]*isAccountantClientWorkspace/);
  assert.match(valuationClient, /Add to Dealer Asset Register/);
  assert.match(valuationClient, /Add to Client Asset Register/);
  assert.match(valuationClient, /Choose a Client Asset Register/);
  assert.match(valuationClient, /savePayload\.registerId = resolvedTargetRegisterId/);
  assert.match(valuationRoute, /accountType === 'owner' \|\| accountType === 'dealer' \|\| Boolean\(accountantAccess\)/);
});

test('shared umbrella assets appear as ordinary independent leads', () => {
  assert.match(leadsClient, /function isAssetGroupLead/);
  assert.match(leadsClient, /if \(isAssetGroupLead\(lead\)\) return false/);
  assert.match(leadsClient, /renderLeadDetails\(lead\)/);
  assert.match(leadsClient, /Replacement Price/);
  assert.match(leadsClient, /styles\.leadAssetIdentifier/);
  assert.doesNotMatch(leadsClient, /styles\.leadStatusBadge|leadStatusLabel|leadStatusClass/);
  assert.doesNotMatch(leadsStyles, /\.leadStatusBadge/);
  assert.doesNotMatch(leadsClient, /Shared umbrella|umbrellaLeadBatchHeader|umbrellaLeadChildThread/i);
  assert.doesNotMatch(leadsStyles, /umbrellaLeadBatchHeader|umbrellaLeadChildThread/i);
});
