import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(path, dependencies = {}) {
 const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
 const output = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 });
 const module = { exports: {} };
 new Function('require','module','exports', output)(name => dependencies[name] ?? require(name),module,module.exports);
 return module.exports;
}
const tracking = load('lib/budget-tracking.ts');
const reports = load('lib/budget-tracking-report.ts', { './budget-tracking': tracking, './report-theme': { REPORT_THEME_CSS: '' } });
const base = { id:'one', assetId:'tractor', assetTitle:'Tractor', period:'monthly',periodLabel:'September 2026',periodKey:'2026-09',amount:1000,spent:500,remaining:500,overBy:0,percentUsed:50,warningPercent:80,includeFuelSlipCosts:false,status:'on_track' };
const warning = { ...base, id:'two',assetId:null, assetTitle:'All saved assets',status:'warning',spent:850,remaining:150,percentUsed:85 };
const over = { ...base,id:'three',period:'annual',status:'over_budget',spent:1250,remaining:0,overBy:250,percentUsed:125 };
test('budget filters combine search, scope, period and attention without mixing overall budgets', () => {
 assert.deepEqual(tracking.filterTrackedBudgets([base,warning,over],'tractor',{asset:'tractor',period:'annual',status:'attention'}),[over]);
 assert.deepEqual(tracking.filterTrackedBudgets([base,warning,over],'',{...tracking.EMPTY_BUDGET_FILTERS,asset:'overall'}),[warning]);
 assert.deepEqual(tracking.filterTrackedBudgets([base,warning,over],'within budget',tracking.EMPTY_BUDGET_FILTERS),[base]);
 assert.deepEqual(tracking.filterTrackedBudgets([base,warning,over],'missing',tracking.EMPTY_BUDGET_FILTERS),[]);
});
test('reaching the limit is distinguished from overspending', () => {
 assert.equal(tracking.budgetStatusLabel(base),'Within budget');
 assert.equal(tracking.budgetStatusLabel(warning),'Approaching limit');
 assert.equal(tracking.budgetStatusLabel(over),'Over budget');
 assert.equal(tracking.budgetStatusLabel({...base,spent:1000,status:'over_budget'}),'Budget reached');
});
test('PDF escapes asset text and preserves amounts beyond 100 percent', () => {
 const html = reports.buildBudgetReportHtml([{...over,assetTitle:'<script>alert(1)</script>'}],'15 September');
 assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;')); assert.match(html,/125% used/); assert.match(html,/width:100%/); assert.match(html,/250[.,]00/);
});
test('Excel keeps money numeric and percentages correctly scaled', () => {
 const sheet = reports.buildBudgetWorkbook([over],'15 September')[0];
 assert.equal(sheet.rows[4][3].value,1000); assert.equal(sheet.rows[4][6].value,250);
 assert.equal(sheet.rows[4][7].value,1.25); assert.equal(sheet.rows[4][8].value,.8);
 assert.equal(sheet.rows[4][9],false);
});
test('export propagates authorization errors and exports only authorized matching budgets', async () => {
 const {NextResponse} = require('next/server');
 let allowed = false, captured;
 const route = load('app/api/my-invoices/budgets/report/route.ts',{
  '../route': {GET: async () => allowed ? NextResponse.json({budgets:[base,warning]}) : NextResponse.json({error:'Forbidden'},{status:403})},
  '../../../../../lib/budget-tracking':tracking,
  '../../../../../lib/budget-tracking-report':reports,
  '../../../../../lib/simple-xlsx':{createXlsxWorkbook: sheets => {captured=sheets; return Buffer.from('test');}},
  '../../../../../lib/report-pdf':{renderReportHtmlToPdf:async () => Buffer.from('pdf')},
 });
 const request={nextUrl:new URL('https://example.test/api/my-invoices/budgets/report?format=xlsx&asset=overall')};
 assert.equal((await route.GET(request)).status,403); assert.equal(captured,undefined);
 allowed=true; assert.equal((await route.GET(request)).status,200); assert.equal(captured[0].rows.length,5);assert.equal(captured[0].rows[4][0],'All saved assets');
 request.nextUrl.searchParams.set('asset','unauthorized');assert.equal((await route.GET(request)).status,404);
});
