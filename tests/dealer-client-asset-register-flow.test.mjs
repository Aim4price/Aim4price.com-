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

test('dealer Asset Register opens a deliberate dealer-or-client gateway', () => {
  assert.match(registerPage, /DealerRegisterGateway/);
  assert.match(registerPage, /requestedView === "dealer"/);
  assert.match(registerPage, /requestedView === "client"/);
  assert.match(registerGateway, /Dealer Asset Register/);
  assert.match(registerGateway, /Client Asset Registers/);
  assert.match(registerGateway, /Choose a client register/);
  assert.match(registerGateway, /register\.id !== dealerRegister\?\.id/);
  assert.match(dealerInventoryPage, /<DealerRegisterGateway/);
  assert.match(dealerInventoryPage, /workspacePath="\/dealer\/inventory"/);
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

test('shared Asset Registers and umbrellas render every included asset as a full card', () => {
  assert.match(leadsClient, /function isAssetGroupLead/);
  assert.match(leadsClient, /function renderRegisterLeadAssetCard/);
  assert.match(leadsClient, /registerAssets\.map\(\(asset, index\) => renderRegisterLeadAssetCard/);
  assert.match(leadsClient, /snapshotAssetPhotos/);
  assert.match(leadsClient, /Replacement Price/);
  assert.match(leadsClient, /Shared umbrella/);
  assert.match(leadsStyles, /\.fullRegisterAssetCard/);
  assert.match(leadsStyles, /\.fullRegisterAssetBody/);
});
