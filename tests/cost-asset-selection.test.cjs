const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {test} = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const source = readFileSync('app/my-invoices/my-invoices-client.tsx', 'utf8');
const ast = ts.createSourceFile('client.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function run(name, initial) {
  let declaration;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(declaration);
  const state = {...initial};
  const context = {...initial};
  for (const setter of declaration.match(/\bset[A-Z]\w+/g) ?? []) {
    const key = setter[3].toLowerCase() + setter.slice(4);
    context[setter] = value => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  }
  vm.runInNewContext(ts.transpile(declaration + `\n${name}();`), context);
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
