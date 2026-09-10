const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function load(file,mocks={}){
 const filename=path.resolve(file),exports={};
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 const req=name=>Object.hasOwn(mocks,name)?mocks[name]:name.startsWith('.')?load(path.resolve(path.dirname(filename),name+'.ts'),mocks):require(name);
 new Function('require','exports','module',code)(req,exports,{exports});return exports;
}
const {NextRequest}=require('next/server');
const asset={title:'2020 Toyota Hilux',publicAssetCode:'A4P-TEST123',plateLabel:'TEST'};
function routeFixture({signedIn=true,allowed=true,record=asset}={}){
 return load('app/api/asset-register/qr/route.ts',{
  '../../../../lib/account-profile':{},
  '../../../../lib/asset-register-account-access':{getAssetRegisterAccountAccess:async()=>allowed},
  '../../../../lib/auth-session':{getServerSession:async()=>signedIn?{user:{id:'owner'}}:null},
  '../../../../lib/asset-register-db':{getAssetRegisterItemById:async()=>record},
  '../../../../lib/partner-access':{},
 });
}
function request(format){return new NextRequest('https://www.aim4price.com/api/asset-register/qr?assetId=asset&format='+format);}
test('asset QR preview, download and print render locally without network calls',async()=>{
 const originalFetch=global.fetch;global.fetch=async()=>{throw Error('QR generation must be local');};
 try{
  const route=routeFixture();
  const svg=await route.GET(request('svg'));
  assert.equal(svg.status,200);assert.match(svg.headers.get('content-type'),/image\/svg\+xml/);
  assert.match(await svg.text(),/<svg[^>]+viewBox=/);
  const png=await route.GET(request('png'));
  assert.equal(png.status,200);
  const buffer=Buffer.from(await png.arrayBuffer());
  assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(buffer.readUInt32BE(16),1200);assert.equal(buffer.readUInt32BE(20),1200);
  const print=await route.GET(request('print'));
  assert.equal(print.status,200);assert.match(await print.text(),/data:image\/png;base64,/);
 }finally{global.fetch=originalFetch;}
});
test('QR rendering retains account access and missing-code checks',async()=>{
 for(const [options,status] of [[{signedIn:false},401],[{allowed:false},403],[{record:null},404],[{record:{...asset,publicAssetCode:''}},409]]){
  assert.equal((await routeFixture(options).GET(request('svg'))).status,status);
 }
});
test('fuel QR preview and print use the same local renderer',async()=>{
 const route=load('app/api/fuel/storage/[storageId]/qr/route.ts',{
  '../../../../../../lib/fuel-ledger':{getFuelStorageById:async()=>({name:'Diesel tank',publicFuelStorageCode:'FUEL-123',fuelType:'diesel',capacityLitres:1000})},
  '../../../../../../lib/owner-workspace-access':{resolveOwnerWorkspaceContext:async()=>({ok:true,context:{ownerUserId:'owner'}})},
 });
 for(const format of ['svg','png','print']) {
  const response=await route.GET(new NextRequest('https://www.aim4price.com/api/fuel/storage/tank/qr?format='+format),{params:{storageId:'tank'}});
  assert.equal(response.status,200);
  if(format==='print')assert.match(await response.text(),/data:image\/png;base64,/);
 }
});
