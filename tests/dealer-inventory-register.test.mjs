import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  access,
  dealerHome,
  inventoryPage,
  inventoryTransfersPage,
  desktopRegisterPage,
  desktopRegisterClient,
  ownerAssetClient,
  lifecycle,
  transfers,
  transferRoute,
  transferPage,
  transferStyles,
  assetRegisters,
  migration,
  adminSales,
  adminRoute,
  dealerMaintenanceAccess,
  maintenanceStatusRoute,
  maintenanceAlertRoute,
  issueNoteRoute,
] = await Promise.all([
  read('lib/asset-register-account-access.ts'),
  read('app/dealer/page.tsx'),
  read('app/dealer/inventory/page.tsx'),
  read('app/dealer/inventory/transfers/page.tsx'),
  read('app/asset-register/page.tsx'),
  read('app/asset-register/asset-register-client.tsx'),
  read('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx'),
  read('lib/asset-lifecycle.ts'),
  read('lib/asset-transfers.ts'),
  read('app/api/asset-transfers/route.ts'),
  read('app/account/asset-transfers/asset-transfers-client.tsx'),
  read('app/account/asset-transfers/page.module.css'),
  read('lib/asset-registers.ts'),
  read('database/migrations/91-dealer-inventory-register.sql'),
  read('lib/admin-asset-sales.ts'),
  read('app/api/admin/sold-assets/route.ts'),
  read('app/api/dealer-maintenance-access/route.ts'),
  read('app/api/asset-maintenance-status/[eventId]/route.ts'),
  read('app/api/maintenance/[maintenanceId]/alert/route.ts'),
  read('app/api/asset-issue-notes/[eventId]/route.ts'),
]);

test('dealer inventory is absent from the app launcher while desktop retains the complete register', () => {
  assert.doesNotMatch(dealerHome, /label: 'Asset Register'/);
  assert.doesNotMatch(dealerHome, /href: '\/dealer\/inventory'/);
  assert.match(inventoryPage, /AssetRegisterClient/);
  assert.match(inventoryPage, /showAppHeader=\{false\}/);
  assert.match(inventoryPage, /Your own stock and trade-ins stay separate from the Asset Registers you manage for clients/);
  assert.match(desktopRegisterPage, /profile\.accountType !== "owner" && profile\.accountType !== "dealer"/);
});

test('only authorised dealer inventory roles can use the shared register APIs', () => {
  assert.match(access, /value === 'owner' \|\| value === 'dealer'/);
  assert.match(access, /profile\.accountStatus !== 'active'/);
  assert.match(access, /dealerRoleCan\(session\.dealerApp\.role, 'inventory'\)/);
  for (const route of [dealerMaintenanceAccess, maintenanceStatusRoute, maintenanceAlertRoute, issueNoteRoute]) {
    assert.match(route, /getAssetRegisterAccountAccess/);
    assert.match(route, /allowDealerApp: true/);
  }
});

test('sold and traded-in assets both offer a deliberate destination step', () => {
  for (const source of [desktopRegisterClient, ownerAssetClient]) {
    assert.match(source, /disposalTransferAvailable/);
    assert.match(source, /Send to dealer inventory/);
    assert.match(source, /Save trade-in & create code/);
    assert.match(source, /only an active Dealer account can claim/);
  }
  assert.match(lifecycle, /\['sold', 'traded_in'\]\.includes\(input\.reason\)/);
  assert.match(lifecycle, /transferReason: input\.reason/);
});

test('trade-in claims are dealer-only and land in dealer inventory', () => {
  assert.match(transfers, /recipientAccountType[\s\S]*input\.transferReason === 'traded_in'/);
  assert.match(transfers, /recipientFromRow\(offer\) === 'dealer'/);
  assert.match(transfers, /buyerProfile\.accountType !== 'dealer'/);
  assert.match(transferRoute, /params\.set\('dealerView', input\.registerIsPrimary \? 'dealer' : 'client'\)/);
  assert.match(transferRoute, /params\.set\('registerId', input\.registerId\)/);
  assert.match(transferRoute, /params\.set\('assetId', input\.assetId\)/);
  assert.match(transferRoute, /ASSET_TRANSFER_DEALER_ACCOUNT_REQUIRED/);
  assert.match(inventoryTransfersPage, /AssetTransfersClient context="dealer"/);
});

test('dealer claims choose an owned register and safely default to dealer stock', () => {
  const claimStart = transfers.indexOf('export async function claimAssetTransfer');
  const claimEnd = transfers.indexOf('export async function regenerateAssetTransferCode');
  const claimSource = transfers.slice(claimStart, claimEnd);

  assert.match(transferPage, />Save asset to</);
  assert.match(transferPage, /fetch\('\/api\/asset-registers'/);
  assert.match(transferPage, /registers\.find\(\(register\) => register\.isPrimary\)/);
  assert.match(transferPage, /targetRegisterId: claimRegisterId/);
  assert.match(transferPage, /Dealer Asset Register/);
  assert.match(transferPage, /Client Asset Register/);
  assert.match(transferPage, /isDealerAccount/);

  assert.match(transferRoute, /targetRegisterId: body\.targetRegisterId/);
  assert.match(transferRoute, /ASSET_TRANSFER_REGISTER_NOT_FOUND/);
  assert.match(transferRoute, /status: 400/);
  assert.match(claimSource, /buyerProfile\.accountType === 'dealer'[\s\S]*cleanText\(input\.targetRegisterId\)/);
  assert.match(claimSource, /getOrCreatePrimaryAssetRegister\(input\.buyerUserId\)/);
  assert.match(claimSource, /from public\.asset_registers[\s\S]*where user_id = \$1 and id::text = \$2[\s\S]*for share/);
  assert.match(claimSource, /\[input\.buyerUserId, targetBuyerRegisterId\]/);
  assert.match(claimSource, /buyerRegister\.id/);
  assert.match(assetRegisters, /where ar\.user_id = \$1 and ar\.id::text = \$2/);
});

test('dealer register destination is a branded searchable keyboard picker', () => {
  const pickerStart = transferPage.indexOf('function ClaimRegisterPicker');
  const pickerEnd = transferPage.indexOf('function IncomingIcon');
  const picker = transferPage.slice(pickerStart, pickerEnd);

  assert.ok(pickerStart >= 0 && pickerEnd > pickerStart);
  assert.doesNotMatch(picker, /<select\b|<option\b/);
  assert.match(transferPage, /import DropdownOverlay from '\.\.\/\.\.\/\.\.\/components\/DropdownOverlay'/);
  assert.match(picker, /<DropdownOverlay[\s\S]*role="listbox"/);
  assert.match(picker, /anchorRef=\{registerPickerButtonRef\}/);
  assert.match(picker, /type="search"/);
  assert.match(picker, /placeholder="Search Asset Registers…"/);
  assert.match(picker, /role="combobox"/);
  assert.match(picker, /aria-autocomplete="list"/);
  assert.match(picker, /aria-expanded=/);
  assert.match(picker, /aria-controls=/);
  assert.match(picker, /aria-activedescendant=/);
  assert.match(picker, /role="option"/);
  assert.match(picker, /aria-selected=/);
  assert.match(picker, /tabIndex=\{-1\}/);
  assert.match(picker, /No Asset Registers found/);
  assert.match(picker, /aria-live="polite"/);

  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape', 'Tab']) {
    assert.match(picker, new RegExp(`event\\.key === '${key}'`));
  }
  assert.match(picker, /event\.key === 'Escape'[\s\S]*event\.stopPropagation\(\)/);
  assert.match(picker, /closeAndMoveFocus\(event\.shiftKey\)/);
  assert.match(picker, /document\.addEventListener\('pointerdown'/);
  assert.match(picker, /document\.removeEventListener\('pointerdown'/);
  assert.match(picker, /event\.composedPath\(\)\.includes\(pickerRoot\)/);
  assert.match(picker, /onChange\(register\.id\)/);

  assert.match(transferPage, /function claimRegisterMatchesSearch[\s\S]*claimRegisterOptionLabel\(register\)[\s\S]*toLocaleLowerCase\('en-ZA'\)[\s\S]*includes\(normalizedSearch\)/);
  assert.match(transferPage, /registers\.filter\(\(register\) => claimRegisterMatchesSearch\(register, claimRegisterSearch\)\)/);
  assert.match(transferPage, /setClaimRegisterId\(primaryClaimRegisterId\(claimRegisters\)\)/);
  assert.match(transferPage, /targetRegisterId: claimRegisterId/);

  assert.match(transferStyles, /\.registerPickerOptions\s*\{[\s\S]*max-height\s*:/);
  assert.match(transferStyles, /\.registerPickerOptions\s*\{[\s\S]*overflow-y\s*:\s*auto/);
  assert.match(transferStyles, /\.registerPickerOptions\s*\{[\s\S]*scrollbar-width\s*:/);
  assert.match(transferStyles, /\.registerPickerOptions::\-webkit-scrollbar/);
  assert.match(transferStyles, /\.registerPickerOptions::\-webkit-scrollbar-thumb/);
});

test('normal dealers open the desktop register while dealer staff keep an authorised route', () => {
  assert.match(transferRoute, /isDealerAppSession\(access\.session\)/);
  assert.match(transferRoute, /input\.accountType === 'dealer' && input\.dealerAppSession/);
  assert.match(transferRoute, /\? '\/dealer\/inventory'\s*:\s*'\/asset-register'/);
  assert.match(inventoryPage, /AssetRegisterClient/);
  assert.match(desktopRegisterPage, /AssetRegisterClient/);
});

test('portable history moves without private financial documents', () => {
  assert.match(transfers, /category === 'licensing' \|\| category === 'other'/);
  assert.match(transfers, /documents = \$5::jsonb/);
  assert.match(transfers, /is_financed = false/);
  assert.match(transfers, /is_insured = false/);
  assert.doesNotMatch(transfers, /update public\.asset_invoices set user_id/);
});

test('migration records transfer intent and recipient type', () => {
  assert.match(migration, /add column if not exists transfer_reason/);
  assert.match(migration, /add column if not exists recipient_account_type/);
  assert.match(migration, /'sold', 'traded_in'/);
  assert.match(migration, /'owner_or_dealer', 'dealer'/);
});

test('admin allocation can target active Owner or Dealer accounts', () => {
  assert.match(adminSales, /in \('owner', 'dealer'\)/);
  assert.match(adminSales, /const accountType = text\(row\.account_type\) === 'dealer'/);
  assert.match(adminRoute, /active Owner or Dealer account/);
});
