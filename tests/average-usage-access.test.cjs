const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>{if(n in mocks)return mocks[n];throw Error('Missing mock '+n);},m,m.exports);return m.exports;}
class Response {constructor(body,status=200){this.body=body;this.status=status;}static json(body,opts){return new Response(body,opts?.status);}}
test('average setup is owner-only even when a dealer has usage or maintenance access',async()=>{
 let session={user:{id:'owner'}},active=true;
 const guard=load('lib/asset-tracking-api.ts',{'next/server':{NextResponse:Response},'./auth-session':{getServerSession:async()=>session},'./asset-register-account-access':{getAssetRegisterAccountAccess:async()=>active},'./asset-register-db':{getAssetRegisterItemById:async user=>user==='owner'?{id:'asset'}:null},'./trusted-request-origin':{isTrustedRequestOrigin:(a,b)=>a===b}});
 const request={method:'POST',headers:new Headers({origin:'https://aim4price.com'}),nextUrl:new URL('https://aim4price.com/api/test')},id='20000000-0000-4000-8000-000000000001';
 assert.equal((await guard.trackingOwner(request,id)).ownerId,'owner');
 for(const actor of ['dealer','business','team']){session={user:{id:actor}};assert.equal((await guard.trackingOwner(request,id)).status,404);}
 session={user:{id:'owner'}};active=false;assert.equal((await guard.trackingOwner(request,id)).status,403);active=true;
 assert.equal((await guard.trackingOwner({...request,headers:new Headers({origin:'https://other.example'})},id)).status,403);
 session=null;assert.equal((await guard.trackingOwner(request,id)).status,403);
});
test('UI exposes setup only in Advanced settings and resolves percentage eligibility canonically',()=>{
 const source=fs.readFileSync('app/asset-register/asset-register-client.tsx','utf8');
 assert.match(source,/!desktopAccess && \['hours','km'\]\.includes\(resolveAssetUsage\(editingAsset\)\.metric\)/);
 assert.equal((source.match(/<AssetAverageUsage /g)||[]).length,1);
 assert.match(source,/assetSettingsView === 'average'/);
 const route=fs.readFileSync('app/api/asset-register/[assetId]/average-usage/route.ts','utf8');assert.match(route,/trackingOwner\(request,params.assetId\)/);
});
