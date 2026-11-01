import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/notifications.ts', import.meta.url), 'utf8');
function compile(start, end) {
  return ts.transpileModule(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
function loaders(leads) {
  const helpers = compile('function asText(', 'function describeFuelEvent(');
  const loaders = compile('async function listOwnerLeadNotifications(', 'async function listOwnerAssetDiscoveryNotifications(');
  return new Function('listAssetLeadsForUser', `${helpers}\nconst RECENT_LEAD_DAYS = 45;\n${loaders}\nreturn {owner: listOwnerLeadNotifications, partner: listPartnerLeadNotifications, normalizeAccountType};`)(async () => leads);
}

for (const leadType of ['replacement_quote', 'insurance', 'finance', 'license_renewal']) {
  test(`${leadType}: sharing and opening use neutral asset wording, including legacy source-less shares`, async () => {
    const lead = {
      id: 'share', ownerUserId: 'owner', partnerUserId: 'partner', leadType,
      status: 'sent', ownerBusinessName: 'Farm', partnerBusinessName: 'Business',
      assetSnapshot: { title: '2022 New Holland TT4.90' }, assetRegisterItemId: 'asset',
      updatedAtIso: new Date().toISOString(), includedSections: {}, ownerMessage: '',
    };
    const api = loaders([lead]);
    const [received] = await api.partner('partner');
    assert.equal(received.title, 'Asset shared with you');
    assert.equal(received.body, 'Farm has shared 2022 New Holland TT4.90 with you.');
    assert.deepEqual(await api.owner('owner'), [], 'Do not claim it was opened before viewing');
    assert.deepEqual(await api.partner('stranger'), []);
    lead.status = 'viewed';
    const [opened] = await api.owner('owner');
    assert.equal(opened.title, 'Asset received and opened');
    assert.equal(opened.body, '2022 New Holland TT4.90 has been received and opened by Business.');
    assert.equal(opened.assetId, 'asset');
    assert.equal(opened.id, `lead-owner:share:viewed:${lead.updatedAtIso}`);
    assert.equal(api.normalizeAccountType('licensing'), 'licensing');
    lead.status = 'quoted';
    assert.equal((await api.owner('owner'))[0].body, 'Business marked 2022 New Holland TT4.90 as handled.');
    lead.status = 'accepted';
    assert.equal((await api.owner('owner'))[0].title, 'Asset received and opened');
    lead.status = 'declined';
    assert.equal((await api.owner('owner'))[0].body, 'Business removed 2022 New Holland TT4.90 from their shared assets. Your Asset Register is unchanged.');
  });
}
