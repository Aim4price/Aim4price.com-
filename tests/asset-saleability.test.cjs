const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{randomUUID}=require('node:crypto');
function load(file,mocks={}){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>{if(n in mocks)return mocks[n];throw Error('Unexpected import '+n);},exports);return exports;}
const model=load('lib/asset-saleability.ts',{'./saleability':load('lib/saleability.ts')});
const answers={saleArea:'province',similarAssetsAvailable:'one_to_three',realisticBuyerPool:'moderate',currentDemand:'normal',modelFamiliarity:'common',desiredTimeline:'60',sellingPriority:'balanced'};
const asset={id:randomUUID(),value:459000,hours:null,lifeWorkedPercent:50,condition:'good',yearModel:null,replacementPriceExVat:1000000,specsJson:{},updatedAtIso:'2026-10-19T10:00:00.123Z'};
test('saved assessment uses the calculator and detects meaningful changes only',()=>{
 const saved=model.assessSaleability(asset,answers);assert(saved.priceExVat>0);assert(saved.lowExVat<=saved.highExVat);
 assert.equal(model.saleabilityBasis({...asset,title:'Renamed'}),saved.basis);
 for(const change of [{value:400000},{lifeWorkedPercent:60},{condition:'fair'},{yearModel:2020},{replacementPriceExVat:900000}])assert.notEqual(model.saleabilityBasis({...asset,...change}),saved.basis);
 assert.equal(model.validSaleabilityAnswers({...answers,currentDemand:'invented'}),false);
 assert.equal(model.validSaleabilityAnswers({}),false);
 assert.throws(()=>model.assessSaleability({...asset,value:0},answers));
});
test('assessment API persists history, scopes access and rejects stale or forged saves',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 try{
 await db.exec('CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text,updated_at timestamptz)');
 await db.query('INSERT INTO asset_register_items VALUES($1,$2,$3)',[asset.id,'owner','2026-10-19T10:00:00.123456Z']);
 let session=null,allowed=true,origin=true,current={...asset};
 const api=load('app/api/asset-register/saleability/route.ts',{
 '../../../../lib/auth-session':{getServerSession:async()=>session,isOwnerAppSession:s=>!!s.ownerApp},
 '../../../../lib/asset-register-account-access':{getAssetRegisterAccountAccess:async()=>true},
 '../../../../lib/owner-app-access':{getOwnerAppAccess:async()=>({}),ownerAppCan:()=>allowed,ownerAppCanAccessAsset:()=>allowed},
 '../../../../lib/business-network-api':{businessJson:(data,status=200)=>({data,status}),businessBody:async r=>r.body,requireBusinessOrigin:()=>{if(!origin)throw Error('origin');}},
 '../../../../lib/db':{getDb:()=>db},'../../../../lib/asset-register-db':{getAssetRegisterItemById:async(owner,id)=>owner==='owner'&&id===asset.id?current:null},'../../../../lib/asset-saleability':model,
 });
 const req={method:'POST',body:{assetId:asset.id,answers,basis:model.saleabilityBasis(asset),priceExVat:1,ownerId:'someone-else'}};
 assert.equal((await api.POST(req)).status,401);
 session={user:{id:'owner'}};
 origin=false;assert.equal((await api.POST(req)).status,403);origin=true;
 assert.equal((await api.POST({...req,body:{...req.body,answers:{}}})).status,400);
 assert.equal((await api.POST({...req,body:{...req.body,basis:'old'}})).status,409);
 let result=await api.POST(req);assert.equal(result.status,200);assert.notEqual(result.data.assessment.priceExVat,1);
 result=await api.GET({method:'GET'});assert.equal(result.data.items.length,1);
 await api.POST(req);assert.equal((await db.query('SELECT count(*) FROM asset_saleability_assessments')).rows[0].count,2);
 assert.equal((await api.GET({method:'GET'})).data.items.length,1);
 session={user:{id:'foreign'}};assert.equal((await api.GET({method:'GET'})).data.items.length,0);assert.equal((await api.POST(req)).status,404);
 session={user:{id:'owner'},ownerApp:{ownerAppUserId:'staff'}};allowed=false;assert.equal((await api.POST(req)).status,403);allowed=true;
 await db.query('UPDATE asset_register_items SET updated_at=now()');assert.equal((await api.POST(req)).status,409);
 await db.query('DELETE FROM asset_register_items');assert.equal((await db.query('SELECT count(*) FROM asset_saleability_assessments')).rows[0].count,0);
 }finally{await db.close();}
});
