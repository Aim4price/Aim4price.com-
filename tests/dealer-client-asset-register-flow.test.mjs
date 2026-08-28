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
  valuationStyles,
  registerStyles,
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
  read('app/valuation/page.module.css'),
  read('app/asset-register/page.module.css'),
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

test('manual add stays scoped to the specific dealer or client register already open', () => {
  assert.doesNotMatch(registerClient, /Where should this asset be added\?|dealerAddDestination|dealerClientRegisterOptions/);
  assert.match(registerClient, /if \(isCombinedRegisterView\)[\s\S]*setIsAddAssetDestinationModalOpen\(true\)/);
  assert.match(registerClient, /const currentRegisterId = String\(activeRegister\?\.id \|\| activeRegisterId \|\| ''\)\.trim\(\)/);
  assert.match(registerClient, /setAddAssetTargetRegisterId\(currentRegisterId\);[\s\S]*setIsAddChoiceModalOpen\(true\)/);
  assert.match(registerClient, /Adding to <strong>\{addAssetTargetRegisterName\}<\/strong>/);
  assert.match(registerClient, /params\.set\([\s\S]*'dealerRegisterMode'/);
  assert.match(registerClient, /registerId: destinationRegisterId \|\| null/);
  assert.match(registerStyles, /Add asset destination context[\s\S]*\.assetUpdateIdentity p strong/);
});

test('dealer estimate actions and client-save dialogs are consistent and use the fresh register selection', () => {
  assert.match(valuationClient, /normalizedSignedInAccountType === 'dealer'[\s\S]*isAccountantClientWorkspace/);
  assert.match(valuationClient, /Add to Dealer Asset Register/);
  assert.match(valuationClient, /Add to Client Asset Register/);
  assert.match(valuationClient, /Choose a client Asset Register/);
  assert.match(valuationClient, /openFinalSaveModal\('asset-register', register\.id\)/);
  assert.match(valuationClient, /targetRegisterId = dealerSaveTargetRegisterId/);
  assert.match(valuationClient, /aria-describedby="dealer-client-register-picker-description"/);
  assert.match(valuationClient, /aria-describedby="final-save-description"/);
  assert.match(valuationClient, /styles\.dealerClientRegisterPickerAction/);
  assert.match(valuationClient, /styles\.finalSaveDestination/);
  assert.doesNotMatch(valuationClient, /Client destination|Final save step/);

  for (const action of ['create-ad', 'dealer-register', 'client-register', 'download-pdf']) {
    assert.match(valuationClient, new RegExp(`data-result-action="${action}"`));
  }

  assert.match(valuationStyles, /\.resultFinalActionsCopy span \{[\s\S]*text-transform: none/);
  assert.match(valuationStyles, /\.resultFinalActionsButtons > button \{[\s\S]*min-height: 3\.75rem/);
  assert.match(valuationStyles, /> \.resultClientRegisterActionButton \{[\s\S]*background: #f0f7f3/);
  assert.match(valuationStyles, /\.dealerClientRegisterPickerAction/);
  assert.match(valuationStyles, /\.finalSaveDestination/);
  assert.doesNotMatch(valuationStyles, /\.finalSaveHeader span \{/);
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
