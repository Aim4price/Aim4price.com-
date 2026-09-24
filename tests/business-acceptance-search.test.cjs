const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,mocks){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(name=>mocks[name]??require(name),exports);return exports;}
test('public acceptance search enforces origin, query and both rate limits before Google lookup',async()=>{
 const originalFetch=global.fetch,originalKey=process.env.GOOGLE_PLACES_API_KEY;let calls=[],limits=[],limited=false;
 const mod=load('app/api/business-network/accept/search/route.ts',{
 '../../../../../lib/business-network-api':{
  requireBusinessOrigin:r=>{if(r.headers.get('origin')!=='https://aim4price.com')throw Error('Origin rejected');},
  businessBody:r=>r.json(),businessJson:(body,status=200)=>Response.json(body,{status}),businessError:e=>Response.json({error:e.message},{status:400})},
 '../../../../../lib/business-network':{limitBusinessAction:async(key,limit)=>{limits.push([key,limit]);if(limited)throw Error('Rate limit');}},
 '../../../../../lib/business-network-shared':{businessText:(s,n=200)=>String(s||'').trim().slice(0,n)},
 });
 const request=(query,origin='https://aim4price.com')=>new Request('https://aim4price.com/api/business-network/accept/search',{method:'POST',headers:{origin,'Content-Type':'application/json','x-forwarded-for':'127.0.0.1'},body:JSON.stringify({query})});
 try{
 process.env.GOOGLE_PLACES_API_KEY='test-only';global.fetch=async(url,options)=>{calls.push({url,options});return Response.json({places:[{id:'one'}]});};
 assert.equal((await mod.POST(request('Workshop','https://foreign.example'))).status,400);
 assert.equal((await mod.POST(request('a'))).status,400);assert.equal(calls.length,0);
 const response=await mod.POST(request('Workshop George'));assert.equal(response.status,200);assert.equal((await response.json()).places[0].id,'one');
 assert.deepEqual(limits.map(x=>x[1]),[10,200]);assert.equal(JSON.parse(calls[0].options.body).maxResultCount,5);
 limited=true;assert.equal((await mod.POST(request('Workshop George'))).status,400);assert.equal(calls.length,1);
 limited=false;delete process.env.GOOGLE_PLACES_API_KEY;assert.equal((await mod.POST(request('Workshop George'))).status,503);assert.equal(calls.length,1);
 }finally{global.fetch=originalFetch;if(originalKey===undefined)delete process.env.GOOGLE_PLACES_API_KEY;else process.env.GOOGLE_PLACES_API_KEY=originalKey;}
});
