const test=require('node:test'),assert=require('node:assert/strict'),load=require('./helpers/load-ts.cjs');
const {realisticSellingAssessment,sellingPriceComparison}=load('lib/selling-price.ts');
const {saleabilityBasis}=load('lib/asset-saleability.ts');
const asset={id:'a',userId:'owner',kind:'equipment',value:100000,hours:500,condition:'good',yearModel:2020,specsJson:{}};
const saved={priceExVat:80000,assessedAt:'2026-10-29T10:00:00Z',basis:saleabilityBasis(asset),answers:{sellingRoute:'direct'}};
test('only current normal-sale assessments qualify; trade-in and auction never become benchmarks',()=>{
 assert.equal(realisticSellingAssessment(asset,saved).needsReview,false);
 for(const route of ['dealer','auction','',undefined])assert.equal(realisticSellingAssessment(asset,{...saved,answers:{sellingRoute:route}}),null);
 assert.equal(realisticSellingAssessment({...asset,hours:900},saved).needsReview,true);
 for(const price of [NaN,Infinity,0,-1])assert.equal(realisticSellingAssessment(asset,{...saved,priceExVat:price}),null);
});
test('realistic takes priority, ideal only has a percentage, stale and missing have no strip',()=>{
 const input={askingPriceExVat:90000,aim4priceValueExVat:120000,realisticSellingPriceExVat:100000};
 assert.equal(sellingPriceComparison(input).label,'Good value');
 assert.equal(sellingPriceComparison({...input,askingPriceExVat:95000}).label,'Fair value');
 assert.equal(sellingPriceComparison({...input,askingPriceExVat:105000}).label,'Fair value');
 assert.equal(sellingPriceComparison(input).difference,'10% below realistic selling price');
 assert.equal(sellingPriceComparison({...input,askingPriceExVat:100000}).label,'Fair value');
 assert.equal(sellingPriceComparison({...input,askingPriceExVat:106000}).label,'Above estimate');
 assert.equal(sellingPriceComparison({...input,realisticSellingPriceExVat:null}).label,'Ideal price comparison');
 assert.equal(sellingPriceComparison({...input,sellingPriceNeedsReview:true}),null);
 assert.equal(sellingPriceComparison({askingPriceExVat:100}),null);
});
test('batch loader scopes reads by owner and asset and does not expose private answers',async()=>{
 let params;
 const {withRealisticSellingAssessments}=load('lib/realistic-selling-assessments.ts',{'./db':{getDb:()=>({query:async(sql,args)=>{assert.match(sql,/s.owner_id=requested.owner_id AND s.asset_id=requested.asset_id/);params=args;return {rows:[{owner_id:'owner',asset_id:'a',assessment:saved}]};}})}});
 const [result]=await withRealisticSellingAssessments([asset]);
 assert.deepEqual(params,[['owner'],['a']]);assert.equal(result.realisticSellingAssessment.priceExVat,80000);
 assert.equal(result.realisticSellingAssessment.answers,undefined);
});
