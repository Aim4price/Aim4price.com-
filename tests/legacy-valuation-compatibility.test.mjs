import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { hydrateLegacyValuationRow as hydrate, normalizeSavedValuationMethod, legacyValuationRecoveryReason } from '../lib/asset-register-legacy-valuation.ts';

function loader(mocks) {
  const cache = new Map();
  function load(path) {
    path = resolve(path);
    if (mocks[path]) return mocks[path];
    if (cache.has(path)) return cache.get(path);
    const module = {exports:{}};
    cache.set(path, module.exports);
    const js = ts.transpileModule(readFileSync(path, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020}}).outputText;
    new Function('require','module','exports',js)(name => {
      assert.ok(name.startsWith('.'), `Unexpected import ${name}`);
      return load(resolve(dirname(path), name + '.ts'));
    }, module, module.exports);
    return module.exports;
  }
  return name => load(resolve('lib', name + '.ts'));
}
const asset = (extra={}) => ({id:'asset-1', userId:'owner-1', valuationRunId:null, selectedMethod:'aim4price', kind:'tractor', equipmentFamilyKey:'tractors', equipmentModelId:null, brandName:'Brand', modelName:'Model', typedModelName:'', yearModel:2020, hours:1800, condition:'good', powerKw:70, tractorType:'utility', drive:'4WD', cab:'Cab', replacementPriceExVat:600000, value:320000, maxLifetimeHours:12000, lifeWorkedPercent:null, specsJson:{}, notes:'Keep service note', documents:[{id:'doc-1'}], ...extra});
const row = extra => ({user_id:'owner-1', valuation_run_id:7, selected_method:'department', specs_json:{}, legacy_valuation_run:{id:7,user_id:'owner-1',condition:'good',hours:1400,power_kw:70,year_model:2020,max_lifetime_hours:12000,valuation_payload:{input:{specsJson:{usageMetricType:'hours'},userReplacementPriceExVat:600000}}},...extra});

test('historical methods remain valued; explicit manual values stay manual', () => {
  for (const method of ['aim4price','market','department']) assert.equal(normalizeSavedValuationMethod(method),'aim4price');
  assert.equal(normalizeSavedValuationMethod('manual'),'manual');
  const manual = row({selected_method:'manual'});
  assert.equal(hydrate(manual),manual);
});
test('empty asset specifications recover original inputs without replacing updates or notes', () => {
  const source = row({hours:0,condition:'fair',value:123456,notes:['one','two'],documents:[1],specs_json:{powerKw:90, userReplacementPriceExVat:700000}});
  const restored=hydrate(source);
  assert.equal(restored.hours,0); assert.equal(restored.condition,'fair');
  assert.equal(restored.power_kw,90); assert.equal(restored.replacement_price_used_ex_vat,700000);
  assert.equal(restored.year_model,2020); assert.equal(restored.max_lifetime_hours,12000);
  assert.equal(restored.specs_json.usageMetricType,'hours');
  assert.equal(restored.value,123456); assert.equal(restored.notes,source.notes); assert.equal(restored.documents,source.documents);
  assert.equal(source.power_kw,undefined);
});
test('unknown year and owner/link boundaries are respected', () => {
  assert.equal(hydrate(row({specs_json:{yearModelUnknown:true}})).year_model,undefined);
  for(const extra of [{user_id:'someone-else'},{valuation_run_id:8},{legacy_valuation_run:null}]) {
    const source=row(extra); assert.equal(hydrate(source),source);
  }
});

function setup(a=asset(), matches=[{id:42,aim4price_replacement_price_ex_vat:650000}]) {
  const queries=[], writes=[], inputs=[];
  const mocks={
    [resolve('lib/db.ts')]:{getDb:()=>({query:async(sql,params)=>{queries.push({sql,params});return {rows:sql.includes('from public.equipment_models')?matches:[]};}})},
    [resolve('lib/asset-register-db.ts')]:{getAssetRegisterItemById:async(owner,id)=>owner===a.userId&&id===a.id?a:null, updateAssetRegisterItemFromValuation:async(input)=>{writes.push(input);return {...a,valuationRunId:99};}},
    [resolve('lib/server-valuation.ts')]:{runServerValuation:async(input)=>{inputs.push(input);return {model:{brandName:a.brandName,modelName:a.modelName,powerKw:a.powerKw,tractorType:a.tractorType,drive:a.drive,cab:a.cab},aim4priceValueExVat:300000,replacementPriceUsedExVat:600000,maxLifetimeHours:12000};}},
    [resolve('lib/valuation-runs.ts')]:{getSelectedMethodValue:result=>result.aim4priceValueExVat,saveValuationRunFromResult:async(input)=>{writes.push(input);return {runId:99};}},
    [resolve('lib/generic-valuation.ts')]:{},
  };
  return {load:loader(mocks), queries,writes,inputs,a};
}
test('no-history recovery uses one exact catalogue match and never writes',async()=>{
  const ctx=setup(); const recovery=ctx.load('asset-register-valuation-recovery');
  const restored=await recovery.recoverLegacyValuationInput('owner-1',ctx.a);
  assert.equal(restored.valuation_payload.input.modelId,42);
  assert.equal(restored.valuation_payload.input.hours,1800);
  assert.equal(restored.valuation_payload.input.userReplacementPriceExVat,600000);
  assert.equal(ctx.writes.length,0);
  assert.deepEqual(ctx.queries[0].params,[null,'Brand','Model',70,'utility','4WD','Cab']);
  for (const changes of [{userId:'other'},{selectedMethod:'manual'},{valuationRunId:8}]) {
    await assert.rejects(recovery.recoverLegacyValuationInput('owner-1',asset(changes)),/ASSET_NOT_REVALUEABLE/);
  }
  for (const matches of [[],[{id:1},{id:2}]]) {
    const other=setup(asset(),matches);
    await assert.rejects(other.load('asset-register-valuation-recovery').recoverLegacyValuationInput('owner-1',other.a),/cannot be matched/);
  }
  assert.match(legacyValuationRecoveryReason(asset({condition:''})),/condition/);
});
test('recovered revaluation previews preserve notes; only explicit Save links a new run',async()=>{
  const ctx=setup(); const {revalueAssetRegisterItem}=ctx.load('asset-register-revaluation');
  const result=await revalueAssetRegisterItem({userId:'owner-1',assetId:'asset-1',previewOnly:true});
  assert.equal(result.valuationRunId,null); assert.equal(result.newValueExVat,300000);
  assert.equal(result.item.notes,ctx.a.notes); assert.equal(result.item.documents,ctx.a.documents);
  assert.equal(ctx.a.value,320000); assert.equal(ctx.writes.length,0);
  assert.match(result.warning,/history was unavailable/);
  assert.equal(ctx.inputs[0].modelId,'42');
  await revalueAssetRegisterItem({userId:'owner-1',assetId:'asset-1',previewOnly:false});
  assert.equal(ctx.writes.length,2); assert.equal(ctx.writes[1].assetId,'asset-1');
  assert.equal(ctx.writes[1].valuationRunId,99); assert.equal(ctx.writes[1].userId,'owner-1');
});
test('legacy non-tractor hour projection keeps hours and anchors to current saved value',async()=>{
  const ctx=setup(asset({kind:'equipment',equipmentFamilyKey:'generators',valuationRunId:null,specsJson:{sectorKey:'construction',familyKey:'generators',brandSlug:'brand',usageMetricType:'hours'}}));
  const result=await ctx.load('asset-register-projection').calculateFuturePriceForAsset({userId:'owner-1',assetId:'asset-1',targetYear:new Date().getFullYear()+1,inflationRatePct:5,extraHours:500});
  assert.equal(result.usageMetric,'hours'); assert.equal(result.current.retailExVat,320000);
  assert.equal(result.projected.hours,2300); assert.ok(result.projected.retailExVat>0);
  assert.equal(ctx.writes.length,0);
});
test('missing linked history fails closed and is queried with the account id',async()=>{
  for(const name of ['asset-register-projection','asset-register-revaluation']) {
    const ctx=setup(asset({valuationRunId:7})); const api=ctx.load(name);
    const action=api.calculateFuturePriceForAsset??api.revalueAssetRegisterItem;
    await assert.rejects(action({userId:'owner-1',assetId:'asset-1',targetYear:2030,inflationRatePct:5,previewOnly:true}),/VALUATION_RUN_NOT_FOUND/);
    assert.ok(ctx.queries[0].params.includes('owner-1'));
    assert.match(ctx.queries[0].sql,/user_id\s*=\s*\$[12]/);
    assert.equal(ctx.inputs.length,0); assert.equal(ctx.writes.length,0);
  }
});
test('schema compatibility resolves both historical links and scopes every valuation fallback',()=>{
  const source=readFileSync('lib/asset-register-db.ts','utf8');
  const body=source.slice(source.indexOf('function buildSelectList('),source.indexOf('function setField('));
  const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
  const select=Function('resolveColumn',`${js}; return buildSelectList;`)((schema,...names)=>names.find(name=>schema.columnNames.has(name))??null);
  const sql=select({columnNames:new Set(['id','user_id','valuation_run_id','run_id','specs_json'])});
  assert.match(sql,/coalesce\(asset_register_items.valuation_run_id, asset_register_items.run_id,/);
  assert.match(sql,/valuationLastRunId/); assert.match(sql,/valuation_last_run_id/);
  assert.ok(sql.includes("'^[1-9][0-9]{0,14}$'"));
  for(const fallback of sql.matchAll(/from valuation_runs vr where ([\s\S]*?) limit 1/g)) {
    assert.match(fallback[1],/vr.user_id = asset_register_items.user_id/);
  }
  const noOwner=select({columnNames:new Set(['id','run_id'])});
  assert.match(noOwner,/and false limit 1/);
});
test('unlinked historical tractors can project without saving or creating history',async()=>{
  const ctx=setup();
  const result=await ctx.load('asset-register-projection').calculateFuturePriceForAsset({userId:'owner-1',assetId:'asset-1',targetYear:new Date().getFullYear()+1,inflationRatePct:5,extraHours:250});
  assert.equal(result.usageMetric,'hours'); assert.equal(result.current.retailExVat,320000);
  assert.equal(result.projected.hours,2050); assert.ok(result.projected.retailExVat>0);
  assert.equal(ctx.writes.length,0); assert.equal(ctx.a.valuationRunId,null);
});
