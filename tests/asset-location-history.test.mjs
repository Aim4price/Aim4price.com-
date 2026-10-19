import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const source=readFileSync(new URL('../app/api/asset-register/[assetId]/locations/route.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const assetId='11111111-1111-4111-8111-111111111111';
function setup({signedIn=true,asset=true,rows=[]}={}){
 const calls=[];const exports={};const api={getServerSession:async()=>signedIn?{user:{id:'owner-1'}}:null,getAssetRegisterAccountAccess:async()=>true,getAssetRegisterItemById:async(owner,id)=>{calls.push(['asset',owner,id]);return asset?{id}:null;},ensureLocationHistorySchema:async()=>{},getDb:()=>({query:async(sql,params)=>{calls.push(['query',sql,params]);return {rows};}}),businessJson:(body,status=200)=>({body,status}),businessError:()=>({status:500})};
 vm.runInNewContext(js,{exports,require:()=>api,Date,Number});return {get:query=>exports.GET({nextUrl:new URL('https://example.test/?'+query)},{params:{assetId}}),calls};
}
test('unauthenticated and missing assets never query history',async()=>{for(const config of [{signedIn:false},{asset:false}]){const h=setup(config);const result=await h.get('');assert.ok([403,404].includes(result.status));assert.equal(h.calls.filter(c=>c[0]==='query').length,0);}});
test('rejects reversed and malformed date ranges before querying',async()=>{for(const query of ['from=2026-10-20&to=2026-10-01','from=not-a-date']){const h=setup();assert.equal((await h.get(query)).status,400);assert.equal(h.calls.filter(c=>c[0]==='query').length,0);}});
test('scopes history to owner and asset and filters dates in South African time',async()=>{const h=setup();assert.equal((await h.get('from=2026-10-01&to=2026-10-16')).status,200);const [,sql,params]=h.calls.find(c=>c[0]==='query');assert.equal(params[0],'owner-1');assert.equal(params[1],assetId);assert.equal(params[2],'2026-10-01');assert.match(sql,/a.user_id=\$1 AND a.id=\$2/);assert.match(sql,/Africa\/Johannesburg/);});
test('preserves coordinates and labels manual versus device sources without inventing attribution',async()=>{const h=setup({rows:[{id:'a',latitude:'-33.1',longitude:'22.1',activity_text:'GPS position manually updated',accuracy:null},{id:'b',latitude:0,longitude:0,event_note:'Settings device GPS.',accuracy:12}]});const {body}=await h.get('');assert.equal(body.items[0].source,'Manual pin');assert.equal(body.items[0].latitude,-33.1);assert.equal(body.items[0].actor,'Not recorded');assert.equal(body.items[1].source,'Device GPS');assert.equal(body.items[1].latitude,0);});
test('reports truncation explicitly',async()=>{const h=setup({rows:Array.from({length:2001},(_,id)=>({id,latitude:1,longitude:2,accuracy:null}))});const {body}=await h.get('');assert.equal(body.items.length,2000);assert.equal(body.truncated,true);});

test('rejects unsupported export formats and never silently exports a truncated history',async()=>{const invalid=setup();assert.equal((await invalid.get('format=csv')).status,400);const many=setup({rows:Array.from({length:2001},(_,id)=>({id,latitude:1,longitude:2,accuracy:null}))});assert.equal((await many.get('format=xlsx')).status,409);});


test('specific records stay scoped to the owner and asset',async()=>{
 const h=setup({rows:[{id:'record-1',latitude:1,longitude:2,accuracy:null}]});
 assert.equal((await h.get('entryId=record-1')).status,200);
 const [,sql,params]=h.calls.find(c=>c[0]==='query');
 assert.equal(params[4],'record-1');
 assert.match(sql,/a.user_id=\$1 AND a.id=\$2/);
 assert.match(sql,/e.id::text=\$5/);
 assert.equal((await setup().get('entryId=missing-record')).status,404);
 const invalid=setup();assert.equal((await invalid.get('entryId=%27bad')).status,400);
 assert.equal(invalid.calls.filter(c=>c[0]==='query').length,0);
});
