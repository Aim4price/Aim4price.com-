const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {NextRequest,NextResponse}=require('next/server');
function load(file,mocks){const module={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(name=>{if(!(name in mocks))throw Error('Unexpected dependency '+name);return mocks[name];},module,module.exports);return module.exports;}
const fixture=fs.readFileSync('tests/fuel-report.test.mjs','utf8');
const start=fixture.indexOf('function fuelEvent(');
const event=new Function(fixture.slice(start,fixture.indexOf('\ntest(',start))+';return fuelEvent;')();
function route(){let sheet,query;const ledger={assets:[{id:'a',title:'Selected tractor'}],summary:{currentLitres:9000,totalStorageUnits:4}};
const mod=load('app/api/fuel/report/route.ts',{
  'next/server':{NextResponse},'../../../../lib/report-theme.ts':{REPORT_THEME_CSS:''},
  '../../../../lib/account-profile':{getAccountProfile:async()=>({name:'Owner'})},
  '../../../../lib/asset-registers':{getAssetRegisterReportLogoUrl:async()=>''},
  '../../../../lib/report-logo':{resolveReportLogoUrlForHtml:async()=>''},
  '../../../../lib/simple-xlsx':{reportExcelDate:()=>null,createXlsxWorkbook:s=>{sheet=s;return Buffer.from('PK');}},
  '../../../../lib/owner-workspace-access':{resolveOwnerWorkspaceContext:async()=>({ok:true,context:{ownerUserId:'owner'}}),filterFuelLedgerForWorkspace:async()=>ledger,getWorkspaceAssetIds:async()=>new Set(['a'])},
  '../../../../lib/fuel-ledger':{listFuelLedger:async()=>ledger,getFuelStorageById:async()=>null,listFuelEventsForReport:async(owner,filters)=>{assert.equal(owner,'owner');query=filters;return [event({assetId:'a',assetTitle:'Selected tractor',litres:12}),event({id:'private',assetId:'b',assetTitle:'Private tractor',litres:500}),event({id:'stock',assetId:'',eventType:'stock_in',litres:3000})];}},
});return {get:format=>mod.GET(new NextRequest('https://example.com/api/fuel/report?assetId=a&year=2026&month=9&format='+format)),invalid:()=>mod.GET(new NextRequest('https://example.com/api/fuel/report?assetId=b')),sheet:()=>sheet,query:()=>query};}
test('asset fuel PDF scope excludes private assets and stock movements; timeline reaches query',async()=>{const r=route();const response=await r.get('pdf');assert.equal(response.status,200);const html=await response.text();assert.match(html,/Selected tractor Fuel Report/);assert.doesNotMatch(html,/Private tractor/);assert.match(html,/Not applicable/);assert.equal(r.query().fromIso,'2026-08-31T22:00:00.000Z');assert.equal(r.query().toIso,'2026-09-30T22:00:00.000Z');assert.equal((await r.invalid()).status,404);});
test('asset fuel Excel has only selected asset events and no misleading account stock total',async()=>{const r=route();assert.equal((await r.get('xlsx')).status,200);const text=JSON.stringify(r.sheet());assert.match(text,/Selected tractor/);assert.doesNotMatch(text,/Private tractor/);assert.doesNotMatch(text,/9000/);assert.match(text,/Not applicable/);});
test('maintenance timeline applies completion dates to done work and due dates to scheduled work',()=>{const source=fs.readFileSync('app/api/maintenance/report/route.ts','utf8');const part=source.slice(source.indexOf('function maintenanceRecordReportDate'),source.indexOf('function formatGeneratedDate'));const module={exports:{}};new Function('module',ts.transpileModule(part+'\nmodule.exports={filterRecordsByPeriod};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(module);const records=[{id:'done',status:'done',completedAtIso:'2026-08-31T22:30:00Z',dueDate:'2026-08-10'},{id:'upcoming',status:'upcoming',dueDate:'2026-09-20'},{id:'older',status:'done',completedAtIso:'2026-08-20T10:00:00Z'}];assert.deepEqual(module.exports.filterRecordsByPeriod(records,2026,9).map(r=>r.id),['done','upcoming']);});
