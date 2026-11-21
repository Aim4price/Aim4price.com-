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

const umbrellaSummary = await read('components/leads/SharedUmbrellaSummary.tsx');

test('sharing an umbrella sends every member asset for all supported partner types', () => {
  assert.match(shareClient, /assetIds: isAssetGroupShare[\s\S]*?\? managedAssetIds/);
  assert.match(leadRoute, /function isAssetGroupShareRequest/);
  assert.match(leadRoute, /assetGroupShare[\s\S]*?\|\| leadType === 'license_renewal'/);
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
  assert.match(leadsClient, /maintenanceAccess\?\.permissions.canAddPhotos/);
  assert.match(leadsClient, /setContribution\(\{lead:managedLead,kind:'photos'\}\)/);
  assert.match(leadsClient, /<SharedAssetContributionDialog/);
  assert.match(leadsClient, /assetStyles\.assetGroupHeader/);
  assert.match(leadsClient, /assetStyles\.assetGroupMemberRow/);
  assert.match(leadsClient, /<SharedUmbrellaSummary/);
  assert.match(umbrellaSummary, /aria-expanded=\{expanded\}/);
  assert.match(leadsClient, /renderLead\(member, true\)/);
});

test('legacy umbrella shares are recognised as independent asset leads without a data migration', () => {
  assert.match(leadsClient, /asText\(snapshot\?\.snapshotType\)\.toLowerCase\(\) === 'asset_group'/);
  assert.match(leadsClient, /if \(isAssetGroupLead\(lead\)\) return false/);
  assert.doesNotMatch(leadsClient, /assetGroupShareInfo|orderAssetGroupLeadChildren/);
});

test('every shared asset counts independently in lead summaries and dealer badges', () => {
  assert.match(leadsClient, /summaryLeads\.filter\(\(lead\) => isNewLead\(lead\)\)\.length/);
  assert.match(leadsClient, /of \{periodLeads\.length\} \{isDealerLeadsMode \? 'shared assets' : 'leads'\} for the selected period/);
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

test('filtering and paginating preserve a complete delivery in sender order', async () => {
  const { default: ts } = await import('typescript');
  const { outputText } = ts.transpileModule(await read('app/leads/shared-asset-rows.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  });
  const { sharedAssetRows } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
  const child = (id, batchId, childIndex, ownerUserId = 'owner') => ({
    id, ownerUserId, partnerUserId: 'dealer',
    includedSections: { assetGroupShare: { name: 'Verkoop', batchId, childIndex } },
  });
  const members = Array.from({ length: 15 }, (_, i) => child(String(i), 'first', i));
  const single = { ...members[0], id: 'single', includedSections: {} };
  const repeated = child('repeated', 'second', 0);
  const otherOwner = child('other', 'first', 0, 'another owner');
  const received = [single, ...members.slice().reverse(), repeated, otherOwner];
  const rows = sharedAssetRows(received, received, true);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].name, null);
  assert.deepEqual(rows[1].members, members);
  assert.deepEqual(sharedAssetRows(received, [members[12]], true)[0].members, members);
  assert.equal(sharedAssetRows(received, received, false).length, received.length);
});
