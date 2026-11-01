const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
process.env.AIM4PRICE_BASIC_CATALOGUE_RELEASE = 'basic_ballpark_20260907_v1';

function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (file in overrides) return overrides[file];
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'exports', code)(name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name.endsWith('.ts') ? name : name + '.ts')) : require(name), exports);
    return exports;
  }
  return load;
}
const policy = loader()('lib/annual-review-policy.ts');
const basePolicy = { manual: false, yearModel: 2022, unknownYear: false, fixedAge: false, lastValuedAt: '2026-11-01T10:00:00Z', year: 2027 };
test('annual eligibility excludes manual, unknown age, fixed overrides and already-current valuations', () => {
  assert.equal(policy.annualExclusion(basePolicy), null);
  for (const change of [{manual: true}, {yearModel: null}, {unknownYear: true}, {fixedAge: true}, {lastValuedAt: null}, {lastValuedAt: '2027-01-01T00:00:00Z'}]) assert.ok(policy.annualExclusion({...basePolicy, ...change}));
  assert.match(policy.annualExclusion({...basePolicy, lastValuedAt:'2026-12-31T22:30:00Z'}), /Already valued for 2027/);
  assert.equal(policy.annualExclusion({...basePolicy, lastValuedAt:'2027-01-01T00:00:00Z', year:2028}), null);
});
test('VAT conversion and percentage changes support both increases and decreases without doubling VAT', () => {
  assert.equal(policy.priceExVat(115000, true), 100000);
  assert.equal(policy.priceExVat(100000, false), 100000);
  assert.equal(policy.percentagePrice(100000, 5), 105000);
  assert.equal(policy.percentagePrice(100000, -5), 95000);
  for (const value of [NaN, Infinity, -100, -101, 1001]) assert.throws(() => policy.percentagePrice(100000, value));
  for (const value of [0, -1, Infinity]) assert.throws(() => policy.priceExVat(value, false));
  for (const year of [null, 0, 2027.1, 2101]) assert.throws(() => policy.reviewYear(year));
});

function fixture({ basicExtras = false, tractorExtras = false, ambiguousExtras = false, error = false } = {}) {
  const specs = { basic_estimate:true, basic_catalogue_release:'basic_ballpark_20260907_v1', basic_specification_level:'standard', typed_brand_name:'My brand', valuationLastUpdatedAt:'2026-11-01T00:00:00Z',
    ...(basicExtras ? {basic_asset_replacement_price_ex_vat:800000, basic_extra_replacement_price_ex_vat:100000, basic_total_replacement_price_ex_vat:900000, basic_extra_count:2, basic_extras:[{name:'Loader',replacementPriceExVat:75000},{name:'GPS',replacementPriceExVat:25000}]} : {}) };
  const asset = {id:'asset',userId:'owner',kind:tractorExtras?'tractor':'equipment',title:'Test tractor',selectedMethod:'aim4price',valuationRunId:1,yearModel:2022,hours:tractorExtras?1500:null,condition:'good',value:650000,replacementPriceExVat:ambiguousExtras?920000:900000,updatedAtIso:'2026-11-01T00:00:00Z',equipmentFamilyKey:tractorExtras?'tractors':'compact_tractor',typedModelName:'Test',specsJson:tractorExtras?{valuationLastUpdatedAt:'2026-11-01T00:00:00Z'}:specs,lifeWorkedPercent:40};
  const input = {modelId:'42',year:2022,hours:1500,sectorKey:'agricultural',familyKey:asset.equipmentFamilyKey,brandSlug:'unknown',condition:'good',usageAmount:null,lifeWorkedPercent:40,userReplacementPriceExVat:tractorExtras?700000:900000,specsJson:asset.specsJson,
    ...(tractorExtras?{frontPto:true,frontLoader:true,frontLoaderYear:2024,gpsEnabled:true,gpsType:'guidance-only',gpsYear:2025,frontPtoReplacementPriceExVat:50000,frontLoaderReplacementPriceExVat:100000,gpsReplacementPriceExVat:25000,otherExtraName:'Weights',otherExtraReplacementPriceExVat:25000}: {})};
  const output = tractorExtras ? {replacementPriceUsedExVat:700000,totalReplacementPriceUsedExVat:900000,extrasValueExVat:120000} : {};
  const run = {id:1,created_at:'2026-11-01T00:00:00Z',model_id:42,equipment_type:tractorExtras?'tractor':'equipment',sector_key:'agricultural',family_key:asset.equipmentFamilyKey,brand_slug:'unknown',valuation_payload:{input,output}, specs_json:asset.specsJson};
  const queries=[];
  const db = { async query(sql, params) {
    queries.push(sql); assert.match(sql.trim(), /^select/i, 'preview must issue SELECT statements only');
    if (sql.includes('from "user"')) return {rows:params[0]==='owner@example.com'?[{id:'owner',email:'owner@example.com',name:'Owner'}]:[]};
    if (sql.includes('FROM asset_saleability_assessments')) return {rows:[{owner_id:'owner',asset_id:'asset',assessment:{priceExVat:600000,assessedAt:'2026-11-01T00:00:00Z',basis:'old',answers:{sellingRoute:'direct'}}}]};
    if (sql.includes('from valuation_runs')) return {rows:[run]};
    if (sql.includes('from aim4price_basic.releases')) return {rows:[{'?column?':1}]};
    if (sql.includes('from aim4price_basic.families')) { if(error) throw new Error('Catalogue temporarily unavailable'); return {rows:[{family_key:'compact_tractor',label:'Test family',group_key:'test',group_label:'Test',sector_id:1,sector_key:'agricultural',sector_label:'Agriculture',minimum_ex_vat:'100000',maximum_ex_vat:'750000',pricing_as_of:'2026-09-07',confidence:'low'}]}; }
    if (sql.startsWith('select id, slug, name from public.brands')) return {rows:[{id:10,slug:'unknown',name:'Unknown'}]};
    if (sql.includes('from equipment_models') || sql.includes('from public.equipment_models')) return {rows:[{id:42,brand_slug:'test',brand_name:'Test',model_name:'Tractor',tractor_type:'field',drive_type:'4wd',cab_type:'cab',power_kw:75,aim4price_replacement_price_ex_vat:700000,replacement_price_year:2026,specs_json:{},is_generic_fallback:false}]};
    throw new Error('Unexpected query: '+sql);
  }};
  const overrides = {
    [path.resolve('lib/db.ts')]:{getDb:()=>db},
    [path.resolve('lib/asset-register-db.ts')]:{readAnnualReviewAssets: async owner=>{assert.equal(owner,'owner');return [asset];},getAssetRegisterItemById:()=>{throw Error('Preview must use the read-only snapshot');}},
    [path.resolve('lib/asset-revaluation-save.ts')]:{saveAssetRevaluation:()=>{throw Error('Saving prohibited');}},
    [path.resolve('lib/valuation-runs.ts')]:{getSelectedMethodValue:r=>r.aim4priceValueExVat,saveValuationRunFromResult:()=>{throw Error('Saving prohibited');},saveGenericValuationRunFromResult:()=>{throw Error('Saving prohibited');}},
  };
  const load=loader(overrides);
  return {api:load('lib/annual-review-preview.ts'),revalue:load('lib/asset-register-revaluation.ts'),generic:load('lib/generic-valuation.ts'),server:load('lib/server-valuation.ts'),tractors:load('lib/valuation/tractors.ts'),asset,input,run,queries};
}
test('actual Basic engine uses isolated preview year, retains usage, and is repeatable across years',async()=>{
  const f=fixture(); const before=JSON.stringify(f.asset);
  const liveBefore=await f.generic.runGenericValuation(f.input);
  const p27=await f.api.calculateAnnualPreview('owner@example.com',2027,'asset');
  assert.equal(p27.error,null); assert.ok(p27.proposedValue>0);
  const p28=await f.api.calculateAnnualPreview('owner@example.com',2028,'asset');
  assert.ok(p28.proposedValue<p27.proposedValue);
  assert.deepEqual(await f.api.calculateAnnualPreview('owner@example.com',2027,'asset'),p27);
  const liveAfter=await f.generic.runGenericValuation(f.input);
  assert.equal(liveAfter.aim4priceValueExVat,liveBefore.aim4priceValueExVat);
  assert.equal(JSON.stringify(f.asset),before);
  const loaded=await f.api.loadAnnualReview('owner@example.com',2027);
  assert.equal(loaded.rows[0].row.saleability,true);
});
test('Basic extras are added exactly once and only the asset-only replacement changes',async()=>{
  const f=fixture({basicExtras:true});
  const loaded=await f.api.loadAnnualReview('owner@example.com',2027);
  assert.equal(loaded.rows[0].row.replacementPrice,800000);
  const preview=await f.api.calculateAnnualPreview('owner@example.com',2027,'asset',880000);
  const expected=await f.generic.runGenericValuation({...f.input,userReplacementPriceExVat:980000},{baseYear:2027});
  assert.equal(preview.error,null); assert.equal(preview.proposedValue,expected.aim4priceValueExVat);
  assert.equal(preview.replacementPrice,880000);
  const bad=fixture({basicExtras:true,ambiguousExtras:true});
  assert.equal((await bad.api.loadAnnualReview('owner@example.com',2027)).rows[0].row.eligible,false);
});
test('tractor extras preserve custom replacement prices and installation years without double counting',async()=>{
  const f=fixture({tractorExtras:true});
  const loaded=await f.api.loadAnnualReview('owner@example.com',2027);
  assert.equal(loaded.rows[0].row.replacementPrice,700000);
  const preview=await f.api.calculateAnnualPreview('owner@example.com',2027,'asset',770000);
  const expected=await f.server.runServerValuation({...f.input,userReplacementPriceExVat:770000},{baseYear:2027});
  assert.equal(preview.error,null); assert.equal(preview.proposedValue,expected.aim4priceValueExVat);
  const next=await f.server.runServerValuation({...f.input,userReplacementPriceExVat:770000},{baseYear:2028});
  assert.ok(next.frontLoaderValueExVat<expected.frontLoaderValueExVat); assert.ok(next.gpsValueExVat<expected.gpsValueExVat);
});
test('preview rejects wrong owner, changed asset, and any attempt to use simulated year while saving',async()=>{
  const f=fixture();
  await assert.rejects(()=>f.api.calculateAnnualPreview('someone@example.com',2027,'asset'),/matching owner/);
  await assert.rejects(()=>f.api.calculateAnnualPreview('owner@example.com',2027,'other'),/not found/);
  await assert.rejects(()=>f.api.calculateAnnualPreview('owner@example.com',2027,'asset',undefined,'changed'),/asset changed/);
  await assert.rejects(()=>f.revalue.revalueAssetRegisterItem({userId:'owner',assetId:'asset',previewOnly:false},{year:2027,asset:f.asset}),/INVALID_PREVIEW_CONTEXT/);
});
test('calculation failures are per-asset results and do not write anything',async()=>{
  const f=fixture({error:true});
  const result=await f.api.calculateAnnualPreview('owner@example.com',2027,'asset');
  assert.match(result.error,/Catalogue temporarily unavailable/); assert.equal(result.proposedValue,null);
  assert.ok(f.queries.every(sql=>/^select/i.test(sql.trim())));
});
test('both API methods enforce Admin access before loading owner data',async()=>{
  let reads=0;
  const load=loader({
    [path.resolve('lib/admin-api-access.ts')]:{requireAdminApiAccess:async()=>({ok:false,response:{status:403}})},
    [path.resolve('lib/annual-review-preview.ts')]:{loadAnnualReview:()=>reads++,calculateAnnualPreview:()=>reads++},
  });
  const route=load('app/api/admin/annual-review/route.ts');
  assert.equal((await route.GET({})).status,403); assert.equal((await route.POST({})).status,403); assert.equal(reads,0);
});
