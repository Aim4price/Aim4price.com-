import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');
function compile(code) { return ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; }
const helpers = source.slice(source.indexOf('function noticeStack'), source.indexOf('function assetListUnnotedAlertCount'));
const { summarize, acknowledge } = new Function('assetNeedsEstimateAttention', 'timestampFromIso', `${compile(helpers)};return {summarize:umbrellaAttentionSummary, acknowledge:acknowledgeAssetNotice};`)(a => Boolean(a.needsEstimate), value => Date.parse(value ?? '') || 0);
const base = { id: 'a', updatedAtIso: '2026-09-01' };
test('summary includes every outstanding category and uses complete notice stacks', () => {
  assert.deepEqual(summarize([{...base, needsEstimate:true, dealerAssetCorrection:{updatedAtIso:'2026-09-15'},
    issueNoteStatuses:[{id:'i1'},{id:'i2'}], latestIssueNoteStatus:{id:'i1'},
    maintenanceStatuses:[{id:'m1'}], openPartnerNotes:[{id:'p1'}],
    maintenanceAlerts:[{id:'r1'},{id:'r2'}], licenseRenewalAlert:{},
  }]), {issues:2, updates:2, actions:2, reminders:3, total:9, latest:Date.parse('2026-09-15')});
});
test('noted records and explicitly empty stacks do not create stale pills', () => {
  assert.equal(summarize([{...base, issueNoteStatuses:[], latestIssueNoteStatus:{id:'old'},
    maintenanceStatuses:[{id:'done',notedAtIso:'2026-09-02'}],
    openPartnerNotes:[{id:'p1',notedAtIso:'2026-09-02'}]}]).total, 0);
});
test('noting the final member update clears umbrella attention immediately', () => {
  const asset = {...base, latestMaintenanceStatus:{id:'m1'}};
  assert.equal(summarize([asset]).updates,1);
  assert.equal(summarize([acknowledge(asset,'maintenance','m1')]).total,0);
});
const block = source.slice(source.indexOf('  const registerPaginationEntries = useMemo('), source.indexOf('  const isShowingAllAssets ='));
const compareSource = block.slice(block.indexOf('.sort((left, right)')+6,block.indexOf('    }),')+5);
function order(entries, summaries) {
  const compare = new Function('umbrellaAttentionById', `return ${compareSource};`)(summaries);
  return [...entries].sort(compare).map(e => e.group?.id ?? e.asset.id);
}
const group = id => ({kind:'group',group:{id}});
test('active umbrellas rise newest first while quiet umbrellas and standalone order stay stable', () => {
  const entries = [group('A'),group('B'),group('C'),group('D'),{kind:'asset',asset:{id:'standalone'}}];
  assert.deepEqual(order(entries,new Map([['B',{total:1,latest:10}],['D',{total:1,latest:20}]])), ['D','B','A','C','standalone']);
  assert.deepEqual(order(entries,new Map()), ['A','B','C','D','standalone']);
});
test('priority and pill summaries use all loaded members, even when a filter hides some', () => {
  const summaryCode = source.slice(source.indexOf('  const umbrellaAttentionById ='),source.indexOf('  const registerPaginationEntries ='));
  assert.match(summaryCode,/new Map\(assets.map/);
  assert.doesNotMatch(summaryCode,/filteredAssets/);
  assert.match(source,/attention\.updates\} to note/);
  assert.match(source,/attention\.actions\} to update/);
});
