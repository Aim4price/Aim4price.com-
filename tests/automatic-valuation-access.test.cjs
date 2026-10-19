const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(n=>{
    if(n in mocks)return mocks[n];throw Error(`Unexpected dependency: ${n}`);
  },exports);
  return exports;
}
test('revalue endpoint requires trusted origin, manage permission and asset scope before calculating', async () => {
  let trusted=true, manage=true, scoped=true, signedIn=true, calls=0;
  const api=load('app/api/asset-register/revalue/route.ts', {
    'next/server':{NextResponse:{json:(body,init={})=>({body,status:init.status||200})}},
    '../../../../lib/business-network-api':{requireBusinessOrigin:()=>{if(!trusted)throw Error('foreign origin');}},
    '../../../../lib/owner-app-access':{getOwnerAppAccess:async()=>({}),ownerAppCan:()=>manage,ownerAppCanAccessAsset:()=>scoped},
    '../../../../lib/auth-session':{getServerSession:async()=>signedIn?{user:{id:'owner'},ownerApp:{ownerAppUserId:'staff'}}:null,isOwnerAppSession:()=>true},
    '../../../../lib/asset-register-account-access':{getAssetRegisterAccountAccess:async()=>true},
    '../../../../lib/asset-register-revaluation':{revalueAssetRegisterItem:async input=>{calls++;assert.equal(input.userId,'owner');return {item:{id:'asset'}};}},
    '../../../../lib/asset-register-alerts':{attachOpenAssetAlerts:async(owner,items)=>items},
    '../../../../lib/asset-register-valuation-recovery':{LegacyValuationRecoveryError:class extends Error{}},
  });
  const request={json:async()=>({assetId:'asset',userId:'foreign-owner'})};
  trusted=false;assert.equal((await api.POST(request)).status,403);trusted=true;
  signedIn=false;assert.equal((await api.POST(request)).status,401);signedIn=true;
  manage=false;assert.equal((await api.POST(request)).status,403);manage=true;
  scoped=false;assert.equal((await api.POST(request)).status,403);scoped=true;
  assert.equal(calls,0);assert.equal((await api.POST(request)).status,200);assert.equal(calls,1);
});

test('runtime and SQL migration include every persistent current-input route without public worker access',()=>{
  const schema=fs.readFileSync('lib/automatic-valuation-schema.ts','utf8').split('export const AUTOMATIC_VALUATION_SCHEMA = `')[1].split('`;')[0];
  assert.equal(fs.readFileSync('database/migrations/140-automatic-asset-valuations.sql','utf8').split('\n').slice(1).join('\n'),schema);
  assert.match(fs.readFileSync('instrumentation.ts','utf8'),/await startAutomaticValuations\(\)/);
  const runtime=fs.readFileSync('lib/automatic-valuation-runtime.ts','utf8');
  assert.match(runtime,/phase-production-build/);assert.match(runtime,/AIM4PRICE_AUTOMATIC_VALUATIONS_DISABLED/);
  const scan=fs.readFileSync('lib/scan-assets.ts','utf8').split('export async function saveScanAssetEvent')[1];
  assert.match(scan,/FOR UPDATE OF a/);
  const db=fs.readFileSync('lib/asset-register-db.ts','utf8').split('export async function updateAssetRegisterItem(')[1].split('export async function updateAssetRegisterItemFromValuation')[0];
  assert.match(db,/getAssetRegisterItemById\(userId, input.assetId, transaction\)/);
  assert.match(db,/existing.selectedMethod === 'manual' \? Math.round\(Number\(input.value\) \|\| 0\) : existing.value/);
});

test('status distinguishes queued, retrying and failed values',()=>{
  const status=load('lib/automatic-valuation-status.ts',{});
  assert.equal(status.automaticValuationLabel({automaticValuationStatus:'pending'}),'Value update queued');
  assert.equal(status.automaticValuationLabel({automaticValuationStatus:'retrying'}),'Value update retrying');
  assert.equal(status.automaticValuationLabel({automaticValuationStatus:'failed'}),'Value needs updating');
  assert.equal(status.automaticValuationPending({automaticValuationStatus:'failed'}),false);
});

test('delayed offline readings are historical; fresh readings remain current',()=>{
  const {isHistoricalScan}=load('lib/scan-current-inputs.ts',{});
  const current={updated_at:'2026-10-19T12:00:00Z',last_scanned_at:'2026-10-19T11:00:00Z'};
  assert.equal(isHistoricalScan('2026-10-19T10:00:00Z',current),true);
  assert.equal(isHistoricalScan('2026-10-19T13:00:00Z',current),false);
  assert.equal(isHistoricalScan(null,current),false);
  assert.equal(isHistoricalScan('2026-10-19T11:30:00Z', {...current,
    specs_json:{valuationInputsChangedAt:'2026-10-19T11:00:00Z'}}),false);
  assert.equal(isHistoricalScan('2026-10-19T10:30:00Z', {...current,
    specs_json:{valuationInputsChangedAt:'2026-10-19T11:00:00Z'}}),true);
  const source=fs.readFileSync('lib/scan-assets.ts','utf8').split('export async function saveScanAssetEvent')[1];
  assert.match(source,/historicalScan \? null : nextHours/);
  assert.match(source,/historicalScan \? null : nextLifeWorkedPercent/);
  assert.match(source,/historicalScan \? null : nextCondition/);
  assert.match(source,/last_scanned_at = greatest/);
});
