const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,deps={}) {const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(name=>deps[name]??require(name),mod,mod.exports);return mod.exports;}
const tracker=load('lib/ownership-budget-tracker.ts');
const report=load('lib/my-invoices-report.ts',{'./ownership-budget-tracker.ts':tracker,'./report-theme.ts':{REPORT_THEME_CSS:''}});
const budget={id:'b',assetId:'a',period:'monthly',periodLabel:'September 2026',periodStart:'2026-09-01',periodEnd:'2026-10-01',amount:1000,warningPercent:80,includeFuelSlipCosts:false};
const cost=(id,date,amount,extra={})=>({id,invoiceDate:date,createdAtIso:date+'T12:00:00Z',assetId:'a',assetTitle:'Tractor',supplierName:'Supplier',invoiceNumber:id,totalIncVat:amount,source:'manual',blocks:[],usageMetric:'hours',...extra});
const costs=[cost('3','2026-09-03',300),cost('1','2026-09-01',500),cost('2','2026-09-02',350)];
const options={title:'Cost of Ownership',subtitle:'Umbrella',generatedAt:'16 September 2026',ownerDetails:{businessName:'Example'},selectedAsset:null,assetLabel:'Equipment',dateRangeLabel:'September 2026',summary:{invoiceCount:3,totalSpent:1150,maintenanceSpend:0,partsSpend:0,repairSpend:0,vatTotal:0},invoices:costs,budgets:[budget],includeFuelSlipCosts:true};
test('spend progresses chronologically with warning and actual overspend',()=>{const r=tracker.buildOwnershipBudgetTracker(costs,[budget]);assert.equal(r.get('1')[0].spent,500);assert.equal(r.get('2')[0].status,'warning');assert.equal(r.get('3')[0].overBy,150);assert.equal(r.get('3')[0].percent,115);});
test('umbrella assets and overlapping monthly/annual limits are independent',()=>{const rows=[...costs,cost('other','2026-09-02',800,{assetId:'other'}),cost('prior','2026-08-01',100)];const r=tracker.buildOwnershipBudgetTracker(rows,[budget,{...budget,id:'year',period:'annual',periodStart:'2026-01-01',periodEnd:'2027-01-01',amount:5000},{...budget,id:'overall',assetId:null}]);assert.deepEqual(r.get('3').map(x=>x.spent),[1150,1250]);assert.equal(r.get('other').length,0);});
test('fuel exclusions leave the bar unchanged and end date is exclusive',()=>{const r=tracker.buildOwnershipBudgetTracker([...costs,cost('fuel','2026-09-04',100,{source:'fuel_slip'}),cost('old','2026-08-31',800),cost('next','2026-10-01',600),cost('undated',null,100)],[budget]);assert.equal(r.get('fuel')[0].spent,1150);assert.equal(r.get('fuel')[0].excluded,true);for(const id of ['old','next','undated'])assert.deepEqual(r.get(id),[]);});
test('PDF and workbook include earlier costs outside selected report filter',()=>{const o={...options,invoices:[costs[0]],budgetInvoices:costs};const html=report.buildMyInvoicesReportHtml(o);assert.match(html,/115% used/);assert.match(html,/width="600" height="12" rx="6" fill="#b44242"/);const sheet=report.buildMyInvoicesWorkbook(o).find(x=>x.name==='Budget Tracker');assert.equal(sheet.rows[4][6].value,1150);assert.equal(sheet.rows[4][9].value,1.15);assert.equal(sheet.dataBars[0].max,1);});
test('missing budgets are explicit, and untrusted labels are escaped',()=>{const html=report.buildMyInvoicesReportHtml({...options,budgets:[]});assert.match(html,/No asset budget available/);const injected=report.buildMyInvoicesReportHtml({...options,budgets:[{...budget,periodLabel:'<img onerror=alert(1)>'}]});assert.ok(!injected.includes('<img onerror'));assert.match(injected,/&lt;img onerror/);});
test('same-day order is deterministic and reaching exactly 100 percent is not overspend',()=>{const rows=[cost('b','2026-09-01',500),cost('a','2026-09-01',500)];const r=tracker.buildOwnershipBudgetTracker(rows,[budget]);assert.equal(r.get('a')[0].spent,500);assert.equal(r.get('b')[0].remaining,0);assert.equal(r.get('b')[0].overBy,0);assert.equal(r.get('b')[0].status,'reached');});
test('Excel exports native percentage bars with fixed 100 percent scale and status colours',()=>{const sheets=report.buildMyInvoicesWorkbook(options);const xlsx=load('lib/simple-xlsx.ts');const xml=xlsx.createXlsxWorkbook(sheets).toString();assert.match(xml, /type="dataBar"/);assert.match(xml, /val="1"/);assert.match(xml, /FFB44242/);assert.match(xml, /FFA76B12/);assert.match(xml, /FF197454/);});
if(process.env.OWNERSHIP_REPORT_FIXTURE){const realReport=load('lib/my-invoices-report.ts',{'./ownership-budget-tracker.ts':tracker,'./report-theme.ts':load('lib/report-theme.ts')});fs.writeFileSync('/tmp/ownership-budget.html',realReport.buildMyInvoicesReportHtml(options));const xlsx=load('lib/simple-xlsx.ts');fs.writeFileSync('/tmp/ownership-budget.xlsx',xlsx.createXlsxWorkbook(realReport.buildMyInvoicesWorkbook(options)));}
test('single and umbrella routes scope budget history to authorized assets and do not send alerts',async()=>{
  let captured;
  const {NextRequest,NextResponse}=require('next/server');
  const assets=[{id:'a',title:'Tractor'},{id:'private',title:'Private asset'}];
  const route=load('app/api/my-invoices/report/route.ts',{
    'next/server':{NextResponse},
    '../../../../lib/owner-workspace-access':{resolveOwnerWorkspaceContext:async()=>({ok:true,context:{ownerUserId:'owner',actorName:'Example'}}),filterCostLedgerForWorkspace:async(_,data)=>({...data,assets:data.assets.filter(a=>a.id==='a'),invoices:data.invoices.filter(i=>i.assetId==='a')})},
    '../../../../lib/owner-app-access':{getOwnerAppAccess:async()=>null},
    '../../../../lib/ownership-budget-tracker':tracker,
    '../../../../lib/cost-budgets':{listCostBudgetHistory:async(id)=>{assert.equal(id,'owner');return [budget,{...budget,id:'private-budget',assetId:'private'}];}},
    '../../../../lib/account-profile':{getAccountProfile:async()=>({})},
    '../../../../lib/asset-registers':{getAssetRegisterReportLogoUrl:async()=>''},
    '../../../../lib/my-invoices':{listMyInvoicesData:async()=>({assets,invoices:[...costs,cost('private','2026-09-01',90000,{assetId:'private'})],summary:options.summary}),calculateMyInvoiceSummary:()=>options.summary},
    '../../../../lib/my-invoices-report':{buildMyInvoicesOwnerDetails:()=>({}),buildMyInvoicesWorkbook:o=>{captured=o;return [];},buildMyInvoicesReportHtml:()=>''},
    '../../../../lib/simple-xlsx':{createXlsxWorkbook:()=>Buffer.from('xlsx')},
    '../../../../lib/report-logo':{resolveReportLogoUrlForHtml:async()=>''},
    '../../../../lib/dealer-maintenance-tracker':{},
    '../../../../lib/asset-groups':{getAssetGroupById:async()=>({name:'Umbrella',members:[{assetId:'a'}]})},
    '../../../../lib/report-pdf':{},
  });
  for(const scope of ['assetId=a','groupId=group']){const url=new URL('https://example.com/api/my-invoices/report?format=xlsx&'+scope);const res=await route.GET(new NextRequest(url));assert.equal(res.status,200);assert.deepEqual(captured.budgets.map(b=>b.id),['b:2026-09-01']);assert.ok(captured.budgetInvoices.every(i=>i.assetId==='a'));assert.equal(captured.budgetInvoices.length,3);}
});

test('historical monthly and annual budgets follow cost dates and reset at calendar boundaries',()=>{
 const rows=[cost('aug','2025-08-20',400),cost('sep','2025-09-02',300),cost('jan','2026-01-02',200)];
 const versions=[{...budget,effectiveFrom:'2025-01-01',effectiveTo:null},{...budget,id:'annual',period:'annual',amount:5000,effectiveFrom:'2025-01-01'}];
 const r=tracker.buildOwnershipBudgetTracker(rows,tracker.expandOwnershipBudgetHistory(rows,versions));
 assert.deepEqual(r.get('sep').map(s=>s.spent),[300,700]);
 assert.deepEqual(r.get('jan').map(s=>s.spent),[200,200]);
 assert.equal(r.get('aug')[0].budget.periodLabel,'August 2025');
});
test('revision boundaries use the correct amount and fuel rule without resetting period spend',()=>{
 const rows=[cost('early','2026-09-01',500),cost('fuel','2026-09-02',200,{source:'fuel_slip'}),cost('changed','2026-09-15',300),cost('deleted','2026-09-20',100)];
 const versions=[{...budget,id:'b:1',effectiveFrom:'2026-09-01',effectiveTo:'2026-09-15'},
 {...budget,id:'b:2',amount:2000,includeFuelSlipCosts:true,effectiveFrom:'2026-09-15',effectiveTo:'2026-09-20'}];
 const r=tracker.buildOwnershipBudgetTracker(rows,tracker.expandOwnershipBudgetHistory(rows,versions));
 assert.equal(r.get('fuel')[0].spent,500);assert.equal(r.get('fuel')[0].budget.amount,1000);
 assert.equal(r.get('changed').length,1);assert.equal(r.get('changed')[0].spent,1000);assert.equal(r.get('changed')[0].budget.amount,2000);
 assert.deepEqual(r.get('deleted'),[]);
});
test('unknown legacy periods and superseded same-day versions are not invented',()=>{
 const rows=[cost('unknown','2026-08-15',100),cost('known','2026-09-15',200)];
 const versions=[{...budget,id:'old',effectiveFrom:'2026-09-15',effectiveTo:'2026-09-15'},
 {...budget,id:'known',effectiveFrom:'2026-09-15'}];
 const r=tracker.buildOwnershipBudgetTracker(rows,tracker.expandOwnershipBudgetHistory(rows,versions));
 assert.deepEqual(r.get('unknown'),[]);assert.equal(r.get('known').length,1);
});
