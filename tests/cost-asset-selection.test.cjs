const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {test} = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const source = readFileSync('app/my-invoices/my-invoices-client.tsx', 'utf8');
const ast = ts.createSourceFile('client.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function run(name, initial, args = []) {
  let declaration;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(declaration);
  const state = {...initial};
  const context = {...initial, args};
  for (const setter of declaration.match(/\bset[A-Z]\w+/g) ?? []) {
    const key = setter[3].toLowerCase() + setter.slice(4);
    context[setter] = value => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  }
  vm.runInNewContext(ts.transpile(declaration + `\n${name}(...args);`), context);
  return state;
}
test('budget confirmation advances directly for one or multiple assets', () => {
  for (const ids of [['tractor'], ['tractor', 'truck']]) {
    const result = run('confirmBudgetAssetPicker', {editingBudgetId:null, budgetPickerAssetIds:ids, budgetDraft:{}, budgetWizardStep:1});
    assert.equal(result.budgetWizardStep, 2);
    assert.deepEqual(result.budgetSelectedAssetIds, ids);
    assert.equal(result.budgetAssetPickerOpen, false);
  }
});
test('empty selections never advance or clear the current selection', () => {
  for (const [name, initial, step] of [
    ['confirmBudgetAssetPicker', {editingBudgetId:null, budgetPickerAssetIds:[], budgetWizardStep:1}, 'budgetWizardStep'],
    ['confirmRecurringAssetPicker', {recurringPickerAssetIds:[], recurringWizardStep:1}, 'recurringWizardStep'],
  ]) assert.equal(run(name, initial)[step], 1);
});
test('recurring confirmation advances directly and preserves all selected assets', () => {
  const ids = ['tractor', 'truck'];
  const result = run('confirmRecurringAssetPicker', {recurringPickerAssetIds:ids, recurringWizardStep:1});
  assert.equal(result.recurringWizardStep, 2);
  assert.deepEqual(result.recurringAssetIds, ids);
  assert.equal(result.recurringAssetPickerOpen, false);
});

const entryAssets = [{id:'tractor', ownerUserId:'owner'}];
const entryState = {desktop:{allow:()=>true}, dealerMode:true, dealerDefaults:{supplierName:'Dealer'}, costEntryAssets:entryAssets, assets:entryAssets, sourceDraftsRef:{current:{}}, recurringDraftStartedRef:{current:false}, buildEmptyDraft:()=>({source:'manual'})};
test('client costs begin with asset selection, while valid deep links retain their asset', () => {
  assert.equal(run('openAddInvoiceModal', entryState).flow, 'asset-first');
  assert.equal(run('openAddInvoiceModal', entryState, ['unavailable']).flow, 'asset-first');
  const linked = run('openAddInvoiceModal', entryState, ['tractor']);
  assert.equal(linked.flow, 'source-choice');
  assert.equal(linked.selectedAssetId, 'tractor');
});
test('selecting an eligible asset advances to method choice; unavailable IDs cannot advance', () => {
  const initial={flow:'asset-first', selectedAssetId:'', sourceDraftsRef:{current:{}}, costEntryAssets:entryAssets, buildDraftForAsset:(source,id)=>({source,id})};
  const selected=run('selectAssetAndContinue', initial, ['tractor']);
  assert.equal(selected.flow,'source-choice');
  assert.equal(selected.selectedAssetId,'tractor');
  assert.equal(selected.assetLockedForFlow,true);
  assert.equal(run('selectAssetAndContinue', initial, ['unavailable']).flow,'asset-first');
});
test('both capture methods keep the selected asset and reject missing or revoked selections', () => {
  for (const source of ['manual','automatic']) {
    const initial={...entryState, desktop:{workspace:null}, selectedAssetId:'tractor', draft:{source:'manual'}, buildDraftForAsset:(source,id)=>({source,id})};
    const result=run('startFlow',initial,[source]);
    assert.equal(result.flow,source==='manual'?'manual-form':'upload');
    assert.equal(result.selectedAssetId,'tractor');
    for(const id of ['','revoked']) assert.equal(run('startFlow',{...initial,selectedAssetId:id},[source]).flow,'asset-first');
  }
});

test('changing the selected asset clears attachments; reselecting it preserves the draft', () => {
  const initial={flow:'asset-first',selectedAssetId:'old',costEntryAssets:entryAssets,sourceDraftsRef:{current:{}},manualAttachment:'old.pdf',automaticUploadFile:'old.pdf',buildDraftForAsset:(source,id)=>({source,id})};
  const changed=run('selectAssetAndContinue',initial,['tractor']);
  assert.equal(changed.manualAttachment,null);
  assert.equal(changed.automaticUploadFile,null);
  const same=run('selectAssetAndContinue',{...initial,selectedAssetId:'tractor',draft:{totalIncVat:'1150'}},['tractor']);
  assert.equal(same.draft.totalIncVat,'1150');
  assert.equal(same.manualAttachment,'old.pdf');
});
