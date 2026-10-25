const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(n=>{if(n in mocks)return mocks[n];throw Error('Unexpected import '+n)},exports);return exports;}
const shared=load('lib/asset-saleability.ts');
const {quoteSaleability:quote}=load('lib/server/saleability.ts',{'server-only':{},'../asset-saleability':shared});
const answers={modelVersion:2,sellingRoute:'direct',saleArea:'local',desiredTimeline:'60',currentDemand:'normal',similarAssetsAvailable:'unknown',realisticBuyerPool:'unknown',modelFamiliarity:'unknown',sellingPriority:'balanced'};
// Deliberately fictional policy: production rules must never be committed.
process.env.SALEABILITY_POLICY_JSON=JSON.stringify({version:'test-fixture',steps:[
 {name:'adjustment',expression:{cases:[{when:{op:'eq',args:[{get:'answers.currentDemand'},'strong']},then:1.07},{when:{op:'eq',args:[{get:'answers.currentDemand'},'weak']},then:0.91}],otherwise:1}},
],result:{op:'multiply',args:[{get:'value'},{get:'steps.adjustment'}]}});
const fixture=process.env.SALEABILITY_POLICY_JSON;
test('ease score is separate, bounded, versioned and optional for legacy configurations',()=>{
 const before=quote(100000,answers);
 assert.equal(before.ease,undefined);
 process.env.SALEABILITY_EASE_POLICY_JSON=JSON.stringify({version:'test-ease',steps:[],result:72.4});
 const scored=quote(100000,answers);
 assert.equal(scored.priceExVat,before.priceExVat);
 assert.deepEqual(scored.ease,{score:72,version:'test-ease',provisional:true});
 assert.deepEqual(quote(900000,answers).ease,scored.ease);
 assert.equal(quote(100000,{...answers,similarAssetsAvailable:'none'}).ease.provisional,false);
 for(const score of [0,100]){
  process.env.SALEABILITY_EASE_POLICY_JSON=JSON.stringify({version:'test-ease',steps:[],result:score});
  assert.equal(quote(100000,answers).ease.score,score);
 }
 for(const score of [-1,101,'invalid']){
  process.env.SALEABILITY_EASE_POLICY_JSON=JSON.stringify({version:'test-ease',steps:[],result:score});
  const result=quote(100000,answers);assert.equal(result.ease,undefined);assert.equal(result.priceExVat,before.priceExVat);
 }
 delete process.env.SALEABILITY_EASE_POLICY_JSON;
});
test('private policy supports two-way results without exposing its inputs or operations',()=>{
 assert.equal(quote(100000,answers).priceExVat,100000);
 assert.equal(quote(100000,{...answers,currentDemand:'strong'}).priceExVat,107000);
 assert.equal(quote(100000,{...answers,currentDemand:'weak'}).priceExVat,91000);
 assert.equal(quote(100000,{...answers,currentDemand:'unknown'}).priceExVat,100000);
 assert.equal(quote(100000,{...answers,modelFamiliarity:'rare',realisticBuyerPool:'specialist'}).priceExVat,100000);
});
test('missing or malformed private policy fails closed, without returning configuration',()=>{
 for(const policy of ['', '{}', '{', JSON.stringify({version:'test',steps:[],result:{get:'answers.constructor'}}),JSON.stringify({version:'test',steps:[],result:{op:'eval',args:['process.env']}})]){
  process.env.SALEABILITY_POLICY_JSON=policy;assert.throws(()=>quote(100000,answers));
 }
 let expression=1;for(let i=0;i<45;i++)expression={op:'add',args:[expression,1]};
 process.env.SALEABILITY_POLICY_JSON=JSON.stringify({version:'test',steps:[],result:expression});assert.throws(()=>quote(100000,answers));
 process.env.SALEABILITY_POLICY_JSON=fixture;
});
test('interpreter bounds operations and supports predicates and private context rules',()=>{
 process.env.SALEABILITY_POLICY_JSON=JSON.stringify({version:'test',steps:[],result:{cases:[{
  when:{op:'all',args:[{op:'contains',args:[{get:'context.familyKey'},'test']},{op:'any',args:[false,true]}]},
  then:{op:'multiply',args:[{get:'value'},{op:'subtract',args:[1,{op:'max',args:[0.01,0.02]}]}]},
 }],otherwise:{op:'min',args:[{get:'value'},90000]}}});
 assert.equal(quote(100000,answers,{familyKey:'test_equipment'}).priceExVat,98000);
 assert.equal(quote(100000,answers).priceExVat,90000);
 process.env.SALEABILITY_POLICY_JSON=fixture;
});
test('rejects invalid values, legacy answers and fabricated routes',()=>{
 for(const value of [0,-1,NaN,Infinity,1e13])assert.throws(()=>quote(value,answers));
 assert.throws(()=>quote(100000,{...answers,modelVersion:undefined}));
 assert.throws(()=>quote(100000,{...answers,sellingRoute:'invented'}));
});
test('public quote endpoint returns only result, validates inputs and rejects foreign origin',async()=>{
 let origin=true, throttled=null;
 const api=load('app/api/saleability/quote/route.ts',{
  '../../../../lib/public-valuation-throttle':{publicValuationThrottle:(_request,kind)=>{assert.equal(kind,'calculation');return throttled;}},
  '../../../../lib/business-network-api':{requireBusinessOrigin:()=>{if(!origin)throw Error();},businessBody:async r=>r.body,businessJson:(data,status=200)=>({data,status})},
  '../../../../lib/asset-saleability':shared,'../../../../lib/server/saleability':{quoteSaleability:quote},
 });
 const req={body:{valuationExVat:180000,answers,context:{kind:'vehicle'},priceExVat:1}};
 const result=await api.POST(req);assert.equal(result.status,200);assert.equal(result.data.quote.priceExVat,180000);
 assert.deepEqual(Object.keys(result.data.quote).sort(),['modelVersion','priceExVat','resultLabel']);
 origin=false;assert.equal((await api.POST(req)).status,403);origin=true;
 assert.equal((await api.POST({body:{...req.body,valuationExVat:'180000'}})).status,400);
 assert.equal((await api.POST({body:{...req.body,context:{kind:{}}}})).status,400);
 throttled=new Response(null,{status:429,headers:{'Retry-After':'60'}});
 assert.equal(await api.POST(req),throttled);
});
