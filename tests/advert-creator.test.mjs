import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
async function load(path, dependencies = {}) {
  const source = await fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports','module','require',js)(module.exports,module,(key) => { if (!(key in dependencies)) throw Error(key); return dependencies[key]; });
  return module.exports;
}
const details = { title:'Example machine',year:'2020',usage:'3000',usageUnit:'hours',condition:'good',askingPrice:'500000',vatLabel:'plus-vat',location:'',description:'',contactName:'Seller',phone:'0820000000',email:'',businessName:'Seller' };
const estimate = { id:'1',title:details.title,year:details.year,usage:details.usage,usageUnit:details.usageUnit,condition:details.condition,valueExVat:500000,createdAt:'2026-10-27T00:00:00Z' };
test('direct adverts validate without any estimate or asset register ID',async()=>{
 const {advertDetailsError}=await load('lib/advert-creator.ts');
 assert.equal(advertDetailsError(details),'');
 for (const askingPrice of ['','0','-1','NaN','Infinity']) assert.ok(advertDetailsError({...details,askingPrice}));
 assert.ok(advertDetailsError({...details,usage:'101',usageUnit:'percent'}));
 assert.ok(advertDetailsError({...details,phone:''}));
});
test('ratings only apply to matching positive estimates; pricing and style may change',async()=>{
 const {estimateMatchesAdvert}=await load('lib/advert-creator.ts');
 assert.equal(estimateMatchesAdvert(null,details),false);
 assert.equal(estimateMatchesAdvert(estimate,details),true);
 assert.equal(estimateMatchesAdvert(estimate,{...details,askingPrice:'450000',vatLabel:'vat-included'}),true);
 for(const key of ['title','year','usage','usageUnit','condition']) assert.equal(estimateMatchesAdvert(estimate,{...details,[key]:'changed'}),false);
 for(const valueExVat of [0,-1,NaN,Infinity]) assert.equal(estimateMatchesAdvert({...estimate,valueExVat},details),false);
});
test('estimate endpoint rejects unauthenticated and unauthorized access and scopes results to the seller',async()=>{
 let session=null,profile={accountType:'dealer',accountStatus:'active'},dealer=null,queries=[];
 const {GET}=await load('app/api/ad-studio/estimates/route.ts',{
  'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},
  '../../../../lib/asset-register-db':{listAssetRegisterItems:async userId=>{assert.equal(userId,'seller-123');return [];}},
  '../../../../lib/realistic-selling-assessments':{withRealisticSellingAssessments:async assets=>assets},
  '../../../../lib/auth-session':{getServerSession:async()=>session},
  '../../../../lib/account-profile':{getAccountProfile:async()=>profile},
  '../../../../lib/dealer-app-session':{getDealerAppSession:async()=>dealer},
  '../../../../lib/dealer-app-access':{dealerRoleCan:role=>role==='manager'},
  '../../../../lib/db':{getDb:()=>({query:async(sql,params)=>{queries.push({sql,params});return {rows:[{id:1,brand_name:'Brand',model_name:'Model',year_model:2020,hours:3000,condition:'good',aim4price_value_ex_vat:'500000',created_at:'2026-10-27',valuation_payload:{input:{usage_mode:'percent',life_worked_percent:35}}}]};}})},
 });
 assert.equal((await GET()).status,401);assert.equal(queries.length,0);
 session={user:{id:'seller-123'}};profile.accountStatus='inactive';assert.equal((await GET()).status,403);
 profile.accountStatus='active';dealer={role:'blocked'};assert.equal((await GET()).status,403);assert.equal(queries.length,0);
 dealer={role:'manager'};const response=await GET();assert.equal(response.status,200);assert.deepEqual(queries[0].params,['seller-123']);assert.match(queries[0].sql,/where user_id = \$1/);
 assert.equal(response.body.estimates[0].usageUnit,'percent');assert.equal(response.body.estimates[0].usage,'35');assert.equal(response.body.estimates[0].valueExVat,500000);
});

test('wizard validates only the fields belonging to the current step', async () => {
 const {advertStepErrors}=await load('lib/advert-creator.ts');
 assert.deepEqual(advertStepErrors({...details,contactName:'',phone:'',email:'bad'},1),{});
 assert.deepEqual(advertStepErrors({...details,title:'',askingPrice:''},2,1),{});
 assert.deepEqual(Object.keys(advertStepErrors({...details,title:'',year:'1700',usage:'101',usageUnit:'percent',askingPrice:'0'},1)).sort(),['askingPrice','title','usage','year']);
 assert.deepEqual(Object.keys(advertStepErrors({...details,contactName:'',phone:'',email:'bad'},2,0)).sort(),['contactName','email','phone','photos']);
 assert.deepEqual(advertStepErrors(details,2,1),{});
});

test('asset imports preserve usage and listing price without exposing private fields or inventing ratings', async () => {
 const usage = await load('lib/asset-usage.ts');
 const {assetToAdvertSource} = await load('lib/advert-source.ts', {'./asset-usage': usage});
 const asset = {id:'asset-1',title:'Loader',yearModel:2020,condition:'good',hours:200,photos:['one','two','three','four','five'],
  specsJson:{usageMode:'percent'},lifeWorkedPercent:35,marketplacePriceExVat:250000,aim4priceValueExVat:null,value:400000,
  documents:['private'],financeBalance:123,updatedAtIso:'2026-10-29',marketplaceSellerName:'Seller'};
 const before=JSON.stringify(asset), result=assetToAdvertSource(asset);
 assert.equal(result.details.usageUnit,'percent'); assert.equal(result.details.usage,'35');
 assert.equal(result.details.askingPrice,'250000'); assert.equal(result.estimate,null);
 assert.equal(result.photos.length,4); assert.equal(result.details.contactName,'Seller');
 assert.equal(JSON.stringify(asset),before); assert.ok(!JSON.stringify(result).includes('private'));
 const estimated=assetToAdvertSource({...asset,marketplacePriceExVat:null,aim4priceValueExVat:400000,realisticSellingAssessment:{priceExVat:300000,needsReview:true}});
 assert.equal(estimated.details.askingPrice,''); assert.equal(estimated.estimate.valueExVat,400000);
 assert.equal(estimated.estimate.sellingPriceNeedsReview,true);
});

test('asset import requires studio and inventory access and reads only the signed-in seller', async () => {
 let session=null, dealer=null, reads=0;
 const {GET}=await load('app/api/ad-studio/assets/route.ts', {
  'next/server':{NextResponse:{json:(body,options={})=>({body,...options,status:options.status??200})}},
  '../../../../lib/auth-session':{getServerSession:async()=>session},
  '../../../../lib/account-profile':{getAccountProfile:async()=>({accountType:'dealer',accountStatus:'active'})},
  '../../../../lib/dealer-app-session':{getDealerAppSession:async()=>dealer},
  '../../../../lib/dealer-app-access':{dealerRoleCan:(role,permission)=>role==='manager'||permission==='ad_studio'},
  '../../../../lib/asset-register-db':{listAssetRegisterItems:async id=>{assert.equal(id,'seller-1');reads++;return [{id:'asset-1'}];}},
  '../../../../lib/realistic-selling-assessments':{withRealisticSellingAssessments:async assets=>assets},
  '../../../../lib/advert-source':{assetToAdvertSource:asset=>({id:asset.id})},
 });
 assert.equal((await GET()).status,401); session={user:{id:'seller-1'}};dealer={role:'studio-only'};
 assert.equal((await GET()).status,403); assert.equal(reads,0);
 dealer={role:'manager'}; const response=await GET();assert.equal(response.status,200);assert.equal(reads,1);
 assert.deepEqual(response.body.assets,[{id:'asset-1'}]);assert.equal(response.headers['Cache-Control'],'private, no-store');
});
