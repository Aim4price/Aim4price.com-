const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,mocks){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>mocks[name]||require(name),exports);return exports;}
test('market price edits are opt-in and read-only links never inherit editing',()=>{
 const api=load('lib/external-share-permissions.ts',{});
 assert.equal(api.normalizeExternalPermissions({}).marketPrice,false);
 assert.equal(api.normalizeExternalPermissions({marketPrice:'true'}).marketPrice,false);
 assert.equal(api.assetLinkPermissions({marketPrice:true}).marketPrice,true);
 assert.equal(api.readOnlyAssetLinkPermissions({marketPrice:true}).marketPrice,false);
});
test('shared market price checks permissions, recalculates server-side and locks revocation and asset revision before saving',async()=>{
 class Denied extends Error{constructor(message,status=403){super(message);this.status=status;}}
 let allowed=false,revoked=false,changed=false,origin=true;const events=[];
 const client={query:async(sql,args)=>{events.push({sql,args});return {rows:sql.startsWith('SELECT id')&&changed?[]:[{id:'asset'}]};},release:()=>{}};
 const asset={id:'asset',title:'Tractor',value:100000,updatedAtIso:'2026-10-24T00:00:00Z'};
 const assessment={priceExVat:85000,assessedAt:'2026-10-24T01:00:00Z',answers:{private:true},basis:'basis',resultLabel:'Market',modelVersion:'test'};
 const api=load('lib/shared-market-price.ts',{
 './db':{getDb:()=>({query:client.query,connect:async()=>client})},
 './asset-register-db':{getAssetRegisterItemById:async(owner,id)=>{assert.equal(owner,'owner');assert.equal(id,'asset');return asset;}},
 './asset-saleability':{saleabilityBasis:()=> 'basis',assetSaleabilityInput:()=>({condition:'good'}),saleabilityContext:()=>({kind:'tractor'}),validCurrentSaleabilityAnswers:v=>v?.complete===true},
 './server/saleability':{assessSaleability:(a,answers)=>{assert.equal(a,asset);return assessment;}},
 './live-shared-asset-access':{requireLiveSharedAsset:async(token,id,permission,write)=>{assert.equal(permission,'marketPrice');assert.equal(write,true);if(!allowed)throw new Denied('Not allowed');return {lead:{ownerId:'owner'},user:{id:'recipient',name:'Recipient',email:'r@example.test'}};},lockLiveSharedAsset:async()=>{events.push({sql:'LOCK_PERMISSION'});if(revoked)throw new Denied('Revoked');}},
 './external-lead-access':{ExternalLeadAccessError:Denied},
 './business-network-api':{businessJson:(data,status=200)=>({data,status}),businessBody:async r=>r.body,requireBusinessOrigin:()=>{if(!origin)throw new Denied('Origin denied');}},
 './business-network':{limitBusinessAction:async()=>{}},
 './shared-asset-activity':{ensureSharedAssetActivity:async()=>{},recordSharedAssetActivity:async(c,event)=>events.push({sql:'AUDIT',event})}
 });
 const call=(body,method='POST')=>api.sharedMarketPrice({method,body},{token:'token',assetId:'asset'});
 assert.equal((await call(null,'GET')).status,403);
 assert.equal((await call({answers:{complete:true},basis:'basis'})).status,403);
 allowed=true;const read=await call(null,'GET');assert.equal(read.status,200);assert.equal(read.data.answers,undefined);
 assert.equal((await call({answers:{},basis:'basis'})).status,400);
 assert.equal((await call({answers:{complete:true},basis:'stale'})).status,409);
 const input={answers:{complete:true},basis:'basis',priceExVat:1,ownerId:'attacker'};
 const preview=await call({...input,preview:true});assert.equal(preview.data.quote.priceExVat,85000);assert.equal(events.length,0);
 revoked=true;assert.equal((await call(input)).status,403);assert(!events.some(e=>e.sql.startsWith('INSERT INTO asset_saleability')));
 revoked=false;changed=true;assert.equal((await call(input)).status,409);
 changed=false;events.length=0;const saved=await call(input);assert.equal(saved.status,200);assert.equal(saved.data.assessment.answers,undefined);
 const insert=events.find(e=>e.sql.startsWith('INSERT INTO asset_saleability'));assert.equal(insert.args[0],'owner');assert.equal(insert.args[2],'recipient');assert.equal(JSON.parse(insert.args[3]).priceExVat,85000);
 assert(events.findIndex(e=>e.sql==='LOCK_PERMISSION')<events.indexOf(insert));
 assert.equal(events.find(e=>e.sql==='AUDIT').event.actorId,'recipient');
 origin=false;assert.equal((await call(input)).status,403);
});
