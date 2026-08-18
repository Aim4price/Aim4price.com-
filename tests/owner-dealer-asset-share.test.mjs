import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const routeSource = fs.readFileSync(path.join(root, 'app/api/asset-leads/route.ts'), 'utf8');
const registerSource = fs.readFileSync(path.join(root, 'app/asset-register/asset-register-client.tsx'), 'utf8');
const selectorSource = fs.readFileSync(path.join(root, 'components/DealerAssetShareSelection.tsx'), 'utf8');
const selectorStyles = fs.readFileSync(path.join(root, 'components/DealerAssetShareSelection.module.css'), 'utf8');

test('bulk dealer sharing is owner-only, bounded and ownership checked before creating a lead', () => {
  assert.match(routeSource, /const MAX_DEALER_SHARE_ASSETS = 250/);
  assert.match(routeSource, /Array\.from\(new Set\(/);
  assert.match(routeSource, /leadType !== 'replacement_quote'/);
  assert.match(routeSource, /profile\.accountType !== 'owner' \|\| isOwnerAppSession\(session\)/);
  assert.match(routeSource, /dealerShareAssetIds\.map\(\(selectedAssetId\) => getAssetRegisterItemById\(session\.user\.id, selectedAssetId\)\)/);
  assert.ok(
    routeSource.indexOf('ownedAssets.some') < routeSource.indexOf('const leads = []'),
    'all selected assets must be verified before the lead is written',
  );
});

test('one dealer lead grants the same revocable permissions to every selected asset', () => {
  assert.match(routeSource, /const trackingAssetIds = dealerShareAssetIds\.length \? dealerShareAssetIds : \[assetId\]/);
  assert.match(routeSource, /for \(let index = 0; index < trackingAssetIds\.length; index \+= 10\)/);
  assert.match(routeSource, /const grantedBatch = await Promise\.all/);
  assert.match(routeSource, /permissions: trackingPermissions/);
  assert.match(routeSource, /trackingAccesses,/);
  assert.match(routeSource, /sharedAssetCount: dealerShareAssetIds\.length \|\| 1/);
});

test('owner register dealer flow supports selected or all assets', () => {
  assert.match(registerSource, /selectedDealerShareAssetIds/);
  assert.match(registerSource, /setSelectedDealerShareAssetIds\([\s\S]*?leadType === 'replacement_quote' \|\| leadType === 'license_renewal'[\s\S]*?eligibleShareAssets\.map/);
  assert.match(registerSource, /<DealerAssetShareSelection/);
  assert.match(registerSource, /isSelectedRegisterAssetShare \? selectedDealerShareAssetIds : undefined/);
  assert.match(registerSource, /Access stays revocable/);
  assert.match(registerSource, /Choose at least one asset to share with the \$\{formatQuotePartnerType/);
});

test('asset selector is accessible and remains usable for long registers', () => {
  assert.match(selectorSource, /type="checkbox"/);
  assert.match(selectorSource, /Select all/);
  assert.match(selectorSource, /Clear all/);
  assert.match(selectorSource, /Serial \$\{asset\.serialNumber\}/);
  assert.match(selectorSource, /Reg \$\{asset\.registrationNumber\}/);
  assert.match(selectorStyles, /overflow-y: auto/);
  assert.match(selectorStyles, /scrollbar-width: thin/);
  assert.match(selectorStyles, /::-webkit-scrollbar-thumb/);
});
