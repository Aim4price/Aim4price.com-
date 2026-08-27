import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  shareClient,
  leadRoute,
  leadsClient,
  leadsStyles,
  dealerHome,
  partnerAccess,
] = await Promise.all([
  read('app/asset-register/asset-register-client.tsx'),
  read('app/api/asset-leads/route.ts'),
  read('app/leads/leads-client.tsx'),
  read('app/leads/page.module.css'),
  read('app/dealer/page.tsx'),
  read('lib/partner-access.ts'),
]);

test('sharing an umbrella sends every member asset for all supported partner types', () => {
  assert.match(shareClient, /assetIds: isAssetGroupShare[\s\S]*?\? managedAssetIds/);
  assert.match(leadRoute, /function isAssetGroupShareRequest/);
  assert.match(leadRoute, /\|\| assetGroupShare[\s\S]*?\|\| leadType === 'license_renewal'/);
  assert.match(leadRoute, /for \(const \[selectedAssetIndex, selectedAssetId\] of leadAssetIds\.entries\(\)\)/);
});

test('each umbrella member is saved as a normal child lead with shared batch metadata', () => {
  assert.match(leadRoute, /randomUUID/);
  assert.match(leadRoute, /function buildAssetGroupChildSections/);
  assert.match(leadRoute, /source: 'asset_group_child'/);
  assert.match(leadRoute, /assetGroupShare: \{/);
  assert.match(leadRoute, /batchId: input\.batchId/);
  assert.match(leadRoute, /childIndex: input\.childIndex/);
  assert.match(leadRoute, /includedSections: leadSections/);
});

test('umbrella children reuse the exact single-asset lead rendering and actions', () => {
  assert.match(leadsClient, /function assetGroupShareInfo/);
  assert.match(leadsClient, /if \(isAssetGroupLead\(lead\)\) return false/);
  assert.match(leadsClient, /className=\{styles\.umbrellaLeadBatchHeader\}/);
  assert.match(leadsClient, /Each asset opens independently with its own photos, information and actions/);
  assert.match(leadsClient, /renderLeadDetails\(lead\)/);
  assert.match(leadsClient, /openLeadQrModal\(managedLead\)/);
  assert.match(leadsClient, /openLeadPhotoUploadModal\(managedLead\)/);
  assert.match(leadsStyles, /\.umbrellaLeadBatchHeader/);
  assert.match(leadsStyles, /\.umbrellaLeadChildThread/);
});

test('legacy umbrella shares are recognised and grouped without a data migration', () => {
  assert.match(leadsClient, /snapshot\?\.generatedAtIso/);
  assert.match(leadsClient, /groupId \|\| asText\(snapshot\?\.title\) \|\| 'asset-group'/);
  assert.match(leadsClient, /function orderAssetGroupLeadChildren/);
});

test('umbrella batches count as one request in lead summaries and dealer badges', () => {
  assert.match(leadsClient, /new Set\(filteredLeads\.map\(\(lead\) => leadNotificationKey\(lead\)\)\)\.size/);
  assert.match(dealerHome, /\.map\(leadNotificationKey\)/);
  assert.match(partnerAccess, /included_sections_json #>> '\{assetGroupShare,batchId\}'/);
  assert.match(partnerAccess, /group by notification_key/);
});
