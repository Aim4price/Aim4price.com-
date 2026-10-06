import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../app/my-invoices/my-invoices-client.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  useEffect(() => {\n    if (!budgetsPage || !canManageBudgets');
const end = source.indexOf('\n  useEffect(', start+5);
const code = ts.transpileModule(source.slice(start,end), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function launch(budgets, assets = [{id:'a'}], loading = false) {
  const calls=[];
  new Function('useEffect','budgetsPage','canManageBudgets','budgetsLoading','budgetLoadError','budgetLaunchAssetId','routeSearchParams','handledAssetBudgetLaunch','budgetAssets','costBudgets','setNotice','openEditBudget','openCreateBudget','assetBudgetLaunchActive','budgetLaunchReturnTo',code)(
    fn=>fn(),true,true,loading,'','a',new URLSearchParams('budgetAction=open'),{current:''},assets,budgets,
    notice=>calls.push(['notice',notice.tone]),budget=>calls.push(['edit',budget.id]),id=>calls.push(['create',id]),{current:false},'/asset-register?assetId=a&mapAction=manage',
  );return calls;
}
test('no asset budget opens creation with that asset selected',()=>assert.deepEqual(launch([{id:'overall',assetId:null}]),[['create','a']]));
test('on-track budget opens management instead of creating a duplicate',()=>assert.deepEqual(launch([{id:'monthly',assetId:'a',status:'on_track'}]),[['edit','monthly']]));
test('multiple periods remain on the asset-scoped budget list',()=>assert.deepEqual(launch([{id:'m',assetId:'a'},{id:'y',assetId:'a'}]),[]));
test('unknown assets cannot open the create flow',()=>assert.deepEqual(launch([],[]),[['notice','error']]));
test('budget launch waits until saved budgets have loaded',()=>assert.deepEqual(launch([],undefined,true),[]));

const closeStart = source.indexOf('  function closeBudgetModal()');
const closeEnd = source.indexOf('  function continueBudgetWizard()', closeStart);
const closeCode = ts.transpileModule(source.slice(closeStart,closeEnd), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function dismissBudget({step=1,editing=false,launched=true,saving=false}={}) {
  const calls=[];
  const values={budgetSaving:saving,budgetWizardStep:step,editingBudgetId:editing?'budget':null,
    goBackBudgetWizard:()=>calls.push('previous-step'),assetBudgetLaunchActive:{current:launched},
    budgetLaunchReturnTo:'/asset-register?assetId=a&mapAction=manage',window:{location:{assign:path=>calls.push(path)}},
    buildEmptyCostBudgetDraft:()=>({})};
  for(const name of ['setBudgetModalOpen','setBudgetAssetPickerOpen','setBudgetAssetSearch','setBudgetSelectedAssetIds','setBudgetPickerAssetIds','setBudgetWizardStep','setEditingBudgetId','setBudgetDraft','setBudgetFormError']) values[name]=()=>calls.push(name);
  new Function(...Object.keys(values),closeCode+';closeBudgetModal();')(...Object.values(values));
  return calls;
}
test('Cancel and close at the launched budget entry step return directly to asset Manage',()=>{
  assert.deepEqual(dismissBudget(),['/asset-register?assetId=a&mapAction=manage']);
  assert.deepEqual(dismissBudget({editing:true,step:2}),['/asset-register?assetId=a&mapAction=manage']);
});
test('later budget steps return one step without resetting the draft or leaving the page',()=>assert.deepEqual(dismissBudget({step:3}),['previous-step']));
test('normal budget-page dialogs close locally and saving prevents dismissal',()=>{
  assert.ok(dismissBudget({launched:false}).includes('setBudgetModalOpen'));
  assert.deepEqual(dismissBudget({saving:true}),[]);
});
