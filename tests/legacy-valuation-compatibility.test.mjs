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
    [resolve('lib/db.ts')]:{getDb:()=>({query:async(sql,params)=>{queries.push({sql,params});return {rows:sql.includes('from public.brands')?[{slug:'brand'}]:a.testRun?[a.testRun]:[]};}})},
    [resolve('lib/asset-register-db.ts')]:{getAssetRegisterItemById:async(owner,id)=>owner===a.userId&&id===a.id?a:null, updateAssetRegisterItemFromValuation:async(input)=>{writes.push(input);return {...a,valuationRunId:99};}, updateAssetRegisterItemFromGenericValuation:async(input)=>{writes.push(input);return {...a,valuationRunId:99};}},
    [resolve('lib/server-valuation.ts')]:{runServerValuation:async(input)=>{inputs.push(input);return {model:{brandName:a.brandName,modelName:a.modelName,powerKw:a.powerKw,tractorType:a.tractorType,drive:a.drive,cab:a.cab},aim4priceValueExVat:300000,replacementPriceUsedExVat:600000,maxLifetimeHours:12000};}},
    [resolve('lib/valuation-runs.ts')]:{getSelectedMethodValue:result=>result.aim4priceValueExVat,saveValuationRunFromResult:async(input)=>{writes.push(input);return {runId:99};},saveGenericValuationRunFromResult:async(input)=>{writes.push(input);return {runId:99};}},
    [resolve('lib/generic-valuation.ts')]:{getGenericSelectedMethodValue:result=>result.aim4priceValueExVat,runGenericValuation:async(input)=>{inputs.push(input);return {sector:{key:'agricultural'},family:{usageMetricType:'hours'},brand:{name:a.brandName},typedModelName:a.modelName,specsJson:input.specsJson,year:input.year,yearModelUnknown:input.yearModelUnknown,usageAmount:input.usageAmount,condition:input.condition,aim4priceValueExVat:300000,replacementPriceUsedExVat:600000,maxLifetimeHours:12000};}},
  };
  return {load:loader(mocks), queries,writes,inputs,a};
}
test('missing history recovers Basic inputs without an Advanced model match',async()=>{
  const ctx=setup(); const recovery=ctx.load('asset-register-valuation-recovery');
  const restored=await recovery.recoverLegacyValuationInput('owner-1',ctx.a);
  assert.equal(restored.equipment_model_id,null);
  assert.equal(restored.valuation_payload.input.usageAmount,1800);
  assert.equal(restored.valuation_payload.input.specsJson.basic_recovery,true);
  assert.equal(restored.valuation_payload.input.userReplacementPriceExVat,600000);
  assert.equal(ctx.writes.length,0);
  assert.ok(ctx.queries.every(q=>!q.sql.includes('equipment_models')));
  for (const changes of [{userId:'other'},{selectedMethod:'manual'}]) {
    await assert.rejects(recovery.recoverLegacyValuationInput('owner-1',asset(changes)),/ASSET_NOT_REVALUEABLE/);
  }
  assert.match(legacyValuationRecoveryReason(asset({condition:''})),/condition/);
  assert.match(legacyValuationRecoveryReason(asset({replacementPriceExVat:null})),/replacement price/);
});
test('recovered Basic previews preserve notes; only explicit Save links a new run',async()=>{
  const ctx=setup(); const {revalueAssetRegisterItem}=ctx.load('asset-register-revaluation');
  const result=await revalueAssetRegisterItem({userId:'owner-1',assetId:'asset-1',previewOnly:true});
  assert.equal(result.valuationRunId,null); assert.equal(result.newValueExVat,300000);
  assert.equal(result.item.notes,ctx.a.notes); assert.equal(result.item.documents,ctx.a.documents);
  assert.equal(ctx.a.value,320000); assert.equal(ctx.writes.length,0);
  assert.match(result.warning,/Basic estimate/);
  assert.equal(ctx.inputs[0].basicRecovery,true);
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
test('dangling history links fall back using only the owner asset details',async()=>{
  for(const name of ['asset-register-projection','asset-register-revaluation']) {
    const ctx=setup(asset({valuationRunId:7})); const api=ctx.load(name);
    const action=api.calculateFuturePriceForAsset??api.revalueAssetRegisterItem;
    const result=await action({userId:'owner-1',assetId:'asset-1',targetYear:2030,inflationRatePct:5,previewOnly:true});
    assert.ok(result);
    assert.ok(ctx.queries[0].params.includes('owner-1'));
    assert.match(ctx.queries[0].sql,/user_id\s*=\s*\$[12]/);
    assert.equal(ctx.writes.length,0);
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
test('recovery uses the same Basic numeric calculation, including zero usage',async()=>{
  const queries=[];
  const load=loader({
    [resolve('lib/db.ts')]:{getDb:()=>({query:async(sql)=>{
      queries.push(sql);
      if(sql.includes('public.equipment_families')) return {rows:[{sector_id:1,sector_key:'agricultural',sector_label:'Agriculture',family_id:1,family_key:'tractors',family_label:'Tractors',usage_metric_type:'hours',valuation_mode:'engine_hours',is_propelled:true,catalog_mode:'model_catalog'}]};
      if(sql.includes('public.brands')) return {rows:[{id:1,slug:'claas',name:'Claas'}]};
      throw new Error(`Unexpected catalogue query: ${sql}`);
    }})},
    [resolve('lib/basic-catalogue.ts')]:{getBasicCatalogueFamily:async()=>({sectorId:1,sectorKey:'agricultural',sectorLabel:'Agriculture',familyKey:'small_field_tractor',familyLabel:'Small Field Tractor',usageMetricType:'hours',valuationMode:'engine_hours',isPropelled:true,catalogMode:'generic_specs',basicCatalogue:{releaseKey:'basic_ballpark_20260907_v1',familyKey:'small_field_tractor',familyLabel:'Small Field Tractor',minimumExVat:100000,maximumExVat:1000000,confidence:'low',usageProfile:{version:'v1',primaryMetric:'hours',expectedLifetime:12000}}})},
  });
  const {runGenericValuation}=load('generic-valuation');
  for(const usageAmount of [0,4030]) {
    const input={sectorKey:'agricultural',familyKey:'tractors',brandSlug:'claas',typedModelName:'Axion 850',year:2022,usageAmount,condition:'good',userReplacementPriceExVat:600000,advancedAssumptions:{maxLifetimeUsage:12000}};
    const recovered=await runGenericValuation({...input,basicRecovery:true,specsJson:{catalog_model_id:999}});
    const basic=await runGenericValuation({...input,familyKey:'small_field_tractor',specsJson:{basic_catalogue_release:'basic_ballpark_20260907_v1',basic_specification_level:'standard',basic_usage_basis:'reading'}});
    assert.equal(recovered.aim4priceValueExVat,basic.aim4priceValueExVat);
    assert.equal(recovered.depreciationMethodUsed,'full_depreciation');
    assert.equal(recovered.usageAmount,usageAmount);
    assert.equal(recovered.specsJson.catalog_model_id,undefined);
    assert.equal(recovered.catalogModeUsed,'generic_specs');
  }
  for (const year of [1980, 2030]) {
    for (const [usageAmount, expected] of [[6000,270000],[0,540000]]) {
      const result = await runGenericValuation({sectorKey:'agricultural',familyKey:'tractors',brandSlug:'claas',year,yearModelUnknown:true,usageAmount,condition:'good',userReplacementPriceExVat:600000,basicRecovery:true,advancedAssumptions:{maxLifetimeUsage:12000}});
      assert.equal(result.aim4priceValueExVat,expected);
      assert.equal(result.selectedCalculation.ageDepPct,0);
    }
    const percent = await runGenericValuation({sectorKey:'agricultural',familyKey:'tractors',brandSlug:'claas',year,yearModelUnknown:true,lifeWorkedPercent:50,condition:'good',userReplacementPriceExVat:600000,basicRecovery:true,specsJson:{valuation_mode:'percent_used'}});
    assert.equal(percent.aim4priceValueExVat,270000);
  }
  assert.ok(queries.every(sql=>!sql.includes('equipment_models')));
});
test('saved Basic tractors stay on the Basic path even with a valid history link',async()=>{
  const specs={basic_catalogue_release:'basic_ballpark_20260907_v1',sectorKey:'agricultural',familyKey:'small_field_tractor',brandSlug:'brand'};
  const ctx=setup(asset({valuationRunId:7,specsJson:specs,testRun:{id:7,user_id:'owner-1',equipment_type:'tractor',family_key:'tractors',specs_json:specs,valuation_payload:{input:{sectorKey:'agricultural',familyKey:'small_field_tractor',brandSlug:'brand',specsJson:specs}}}}));
  await ctx.load('asset-register-revaluation').revalueAssetRegisterItem({userId:'owner-1',assetId:'asset-1',previewOnly:true});
  assert.equal(ctx.inputs[0].familyKey,'small_field_tractor');
  assert.equal(ctx.inputs[0].specsJson.basic_catalogue_release,specs.basic_catalogue_release);
  assert.equal(ctx.inputs[0].modelId,undefined);
});
test('the entered replacement price can complete a missing-history Basic preview',async()=>{
  const ctx=setup(asset({valuationRunId:7,replacementPriceExVat:null}));
  await ctx.load('asset-register-revaluation').revalueAssetRegisterItem({userId:'owner-1',assetId:'asset-1',previewOnly:true,replacementPriceExVat:750000});
  assert.equal(ctx.inputs[0].userReplacementPriceExVat,750000);
  assert.equal(ctx.a.replacementPriceExVat,null); assert.equal(ctx.writes.length,0);
});
test('unknown-year older entries use Basic with and without an original history link',async()=>{
  for(const valuationRunId of [null,7]) {
    const ctx=setup(asset({yearModel:null,valuationRunId,specsJson:{yearModel:1980,yearModelUnknown:true},testRun:valuationRunId?{id:7,user_id:'owner-1',equipment_type:'tractor',valuation_payload:{input:{year:1980,modelId:42}}}:undefined}));
    const api=ctx.load('asset-register-revaluation');
    assert.equal(legacyValuationRecoveryReason(ctx.a),null);
    const preview=await api.revalueAssetRegisterItem({userId:'owner-1',assetId:'asset-1',previewOnly:true});
    assert.equal(ctx.inputs[0].basicRecovery,true);
    assert.equal(ctx.inputs[0].yearModelUnknown,true);
    assert.equal(preview.item.yearModel,null);
    assert.equal(preview.item.specsJson.yearModelUnknown,true);
    assert.match(preview.warning,/usage and condition only/);
    assert.equal(ctx.writes.length,0);
    await api.revalueAssetRegisterItem({userId:'owner-1',assetId:'asset-1',previewOnly:false});
    assert.equal(ctx.writes[0].result.yearModelUnknown,true);
    assert.equal(ctx.writes[1].assetId,'asset-1');
    assert.equal(ctx.a.yearModel,null);
  }
});
