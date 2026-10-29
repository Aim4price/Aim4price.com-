const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const load=require('./helpers/load-ts.cjs');
const {normalizeAdvertPublication}=load('lib/advert-publication.ts');
const body={id:'12345678-1234-4123-8123-123456789012',details:{title:'Loader',year:'2021',usage:'30',usageUnit:'percent',condition:'good',askingPrice:'500000',vatLabel:'vat-included',description:'Test',contactName:'Dealer',phone:'0820000000',email:'',businessName:'Dealer'},photos:['/api/asset-register/uploads/bkt-12345678-1234-4123-8123-123456789012'],brand:{templateId:'photo-first'},province:'Western Cape',area:'George'};
test('publication keeps canonical ex VAT and explicit branding without trusting a supplied rating',()=>{
 const value=normalizeAdvertPublication({...body,showDealRating:true,aim4priceValueExVat:999999});
 assert.equal(value.details.askingPrice,'500000');assert.equal(value.brand.vatLabel,'vat-included');
 assert.equal(value.brand.phone,body.details.phone);assert.equal(value.aim4priceValueExVat,undefined);
});
test('publication rejects missing photos, transient URLs and invalid values',()=>{
 for(const patch of [{id:'other'},{photos:[]},{photos:['blob:local']},{photos:['https://foreign.example/photo']},{details:{...body.details,askingPrice:'Infinity'}},{details:{...body.details,usage:'101'}},{details:{...body.details,phone:''}}]) assert.throws(()=>normalizeAdvertPublication({...body,...patch}));
});
test('publishing requires authenticated active dealer and both app permissions; preserves showroom privacy',async()=>{
 let session=null,profile={accountType:'dealer',accountStatus:'active'},allowed=true,calls=0;
 const {POST}=load('app/api/ad-studio/publish/route.ts',{
  'next/server':{NextResponse:{json:(body,opt={})=>({body,status:opt.status||200})}},
  '../../../../lib/auth-session':{getServerSession:async()=>session,isDealerAppSession:s=>!!s.dealerApp},
  '../../../../lib/dealer-app-access':{dealerRoleCan:()=>allowed},
  '../../../../lib/account-profile':{getAccountProfile:async()=>profile},
  '../../../../lib/marketplace-db':{publishStudioAdvert:async(user,value)=>{calls++;assert.equal(user,'seller');assert.equal(value.id,body.id);return {id:value.id};}},
  '../../../../lib/middleman-showroom-db':{getOrCreateMiddlemanShowroom:async()=>({slug:'dealer',isPublic:false})},
 });
 const request={headers:new Headers({origin:'https://example.com'}),nextUrl:{origin:'https://example.com'},json:async()=>body};
 assert.equal((await POST(request)).status,401);
 session={user:{id:'seller'}};profile.accountType='owner';assert.equal((await POST(request)).status,403);
 profile.accountType='dealer';session.dealerApp={role:'staff'};allowed=false;assert.equal((await POST(request)).status,403);
 allowed=true;const result=await POST(request);assert.equal(result.status,200);assert.equal(result.body.showroomPublic,false);assert.equal(calls,1);
 assert.equal((await POST({...request,headers:new Headers({origin:'https://foreign.example'})})).status,403);assert.equal(calls,1);
});
test('listing-only publication uses stable identity, owner-scoped updates and never reactivates removed adverts',async()=>{
 const source=fs.readFileSync('lib/marketplace-db.ts','utf8');
 const fn=source.slice(source.indexOf('export async function publishStudioAdvert('));
 const js=ts.transpileModule(fn,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 let sql,params,blocked=false;
 const module={exports:{}};
 new Function('exports','getDb','ensureMarketplaceColumns','buildMarketplaceListing',js)(module.exports,
 ()=>({query:async(s,p)=>{sql=s;params=p;return {rows:blocked?[]:[{id:p[0]}]};}}),async()=>{},row=>row);
 const publish=module.exports.publishStudioAdvert,value=normalizeAdvertPublication(body);
 assert.deepEqual(await publish('seller',value),await publish('seller',value));
 assert.equal(params[0],body.id);assert.equal(params[1],'seller');assert.equal(params[4],500000);
 assert.match(sql,/on conflict \(id\) do update/);assert.match(sql,/marketplace_listings.user_id=excluded.user_id/);assert.match(sql,/marketplace_listings.status='live'/);
 assert.doesNotMatch(sql,/insert into asset_register_items/);
 const specs=JSON.parse(params[13]);assert.equal(specs.showDealRating,false);assert.equal(specs.lifeWorkedPercent,30);
 blocked=true;await assert.rejects(publish('other',value));
});
