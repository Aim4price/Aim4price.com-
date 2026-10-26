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

function setup(a=asset()) {
  return {a, writes:[], load:loader({
    [resolve('lib/db.ts')]:{getDb:()=>({query:async(sql)=> {
      if(sql.includes('from public.brands')) return {rows:a.testBrands ?? [{slug:'brand'}]};
      throw Error('Unexpected query: '+sql);
    }})},
  })};
}

test('recovery accepts unlisted and ambiguous typed brands without changing the asset', async () => {
  for (const testBrands of [[], [{slug:'one'}, {slug:'two'}]]) {
    const ctx = setup(asset({brandName:'Malcomess', testBrands}));
    const restored = await ctx.load('asset-register-valuation-recovery').recoverLegacyValuationInput('owner-1',ctx.a);
    assert.equal(restored.brand_slug,'unknown');
    assert.equal(restored.specs_json.unlisted_brand_name,'Malcomess');
    assert.equal(restored.valuation_payload.input.specsJson.typed_brand_name,'Malcomess');
    assert.equal(ctx.a.brandName,'Malcomess');
    assert.equal(ctx.writes.length,0);

  }
});
test('known catalogue brands retain their match; missing names request an actionable correction', async () => {
  const ctx=setup();
  assert.equal((await ctx.load('asset-register-valuation-recovery').recoverLegacyValuationInput('owner-1',ctx.a)).brand_slug,'brand');
  const missing=setup(asset({brandName:'',testBrands:[]}));
  await assert.rejects(missing.load('asset-register-valuation-recovery').recoverLegacyValuationInput('owner-1',missing.a), /brand name in asset details/);
});

test('unlisted brand recovery runs the real Basic calculator with the typed identity preserved', async () => {
  const load=loader({
    [resolve('lib/db.ts')]:{getDb:()=>({query:async(sql,params)=>{
      if(sql.includes('public.equipment_families')) return {rows:[{sector_id:1,sector_key:'agricultural',sector_label:'Agriculture',family_id:1,family_key:'tractors',family_label:'Tractors',usage_metric_type:'hours',valuation_mode:'engine_hours',is_propelled:true,catalog_mode:'model_catalog'}]};
      if(sql.includes('public.brands') && sql.includes('lower(trim(name))')) return {rows:[]};
      if(sql.includes('public.brands')) {
        assert.equal(params[0],'unknown');
        return {rows:[{id:1,slug:'unknown',name:'Brand not listed'}]};
      }
      throw new Error(`Unexpected catalogue query: ${sql}`);
    }})},
  });
  const saved=asset({brandName:'Malcomess'});
  const recovered=await load('asset-register-valuation-recovery').recoverLegacyValuationInput('owner-1',saved);
  const result=await load('generic-valuation').runGenericValuation({...recovered.valuation_payload.input,basicRecovery:true});
  assert.equal(result.brand.slug,'unknown');
  assert.equal(result.specsJson.unlisted_brand_name,'Malcomess');
  assert.ok(Number.isFinite(result.aim4priceValueExVat) && result.aim4priceValueExVat > 0);
  assert.equal(result.replacementPriceUsedExVat,600000);
  assert.equal(saved.value,320000);
});
