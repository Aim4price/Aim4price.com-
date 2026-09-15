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
  new Function('useEffect','budgetsPage','canManageBudgets','budgetsLoading','budgetLoadError','budgetLaunchAssetId','routeSearchParams','handledAssetBudgetLaunch','budgetAssets','costBudgets','setNotice','openEditBudget','openCreateBudget',code)(
    fn=>fn(),true,true,loading,'','a',new URLSearchParams('budgetAction=open'),{current:''},assets,budgets,
    notice=>calls.push(['notice',notice.tone]),budget=>calls.push(['edit',budget.id]),id=>calls.push(['create',id]),
  );return calls;
}
test('no asset budget opens creation with that asset selected',()=>assert.deepEqual(launch([{id:'overall',assetId:null}]),[['create','a']]));
test('on-track budget opens management instead of creating a duplicate',()=>assert.deepEqual(launch([{id:'monthly',assetId:'a',status:'on_track'}]),[['edit','monthly']]));
test('multiple periods remain on the asset-scoped budget list',()=>assert.deepEqual(launch([{id:'m',assetId:'a'},{id:'y',assetId:'a'}]),[]));
test('unknown assets cannot open the create flow',()=>assert.deepEqual(launch([],[]),[['notice','error']]));
test('budget launch waits until saved budgets have loaded',()=>assert.deepEqual(launch([],undefined,true),[]));
