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
  assert.match(leadsClient, /function isAssetGroupLead/);
  assert.match(leadsClient, /if \(isAssetGroupLead\(lead\)\) return false/);
  assert.match(leadsClient, /renderLeadDetails\(lead\)/);
  assert.match(leadsClient, /openLeadQrModal\(managedLead\)/);
  assert.match(leadsClient, /openLeadPhotoUploadModal\(managedLead\)/);
  assert.doesNotMatch(leadsClient, /Shared umbrella|umbrellaLeadBatchHeader|umbrellaLeadChildThread/i);
  assert.doesNotMatch(leadsStyles, /umbrellaLeadBatchHeader|umbrellaLeadChildThread/i);
});

test('legacy umbrella shares are recognised as independent asset leads without a data migration', () => {
  assert.match(leadsClient, /asText\(snapshot\?\.snapshotType\)\.toLowerCase\(\) === 'asset_group'/);
  assert.match(leadsClient, /if \(isAssetGroupLead\(lead\)\) return false/);
  assert.doesNotMatch(leadsClient, /assetGroupShareInfo|orderAssetGroupLeadChildren/);
});

test('every shared asset counts independently in lead summaries and dealer badges', () => {
  assert.match(leadsClient, /summaryLeads\.filter\(\(lead\) => isNewLead\(lead\)\)\.length/);
  assert.match(leadsClient, /of \{periodLeads\.length\} leads for the selected period/);
  assert.match(dealerHome, /const newLeadCount = leads\.filter\([\s\S]*?\)\.length/);
  assert.match(partnerAccess, /from public\.asset_leads[\s\S]*where partner_user_id = \$1/);
  assert.doesNotMatch(partnerAccess, /notification_key|group by notification_key/);
});

test('collapsed leads prioritise the asset, searchable identifiers and owner context', () => {
  assert.match(leadsClient, /function leadAssetIdentifier/);
  assert.match(leadsClient, /<h3>\{assetTitle\(lead\)\}<\/h3>/);
  assert.match(leadsClient, /lead\.ownerBusinessName \|\| ownerDisplayName\(lead\)/);
  assert.match(leadsClient, /Owner message/);
  assert.match(leadsClient, /lead\.ownerMessage/);
  assert.match(leadsClient, /lead\.partnerNotes/);
  assert.match(leadsStyles, /\.leadAssetContext/);
});
