const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(name=>{if(!(name in mocks))throw Error(name);return mocks[name]},exports);return exports;}
test('live lead facts require recipient access, preserve owner scope and expose only basic status',async()=>{
 let user=null,allowed=false,active=true,asset={id:'asset',title:'Tractor',isFinanced:true,isInsured:false,isLicensed:true,lastKnownLat:-25,lastKnownLng:28,photos:[],specsJson:{financeStatus:'paid',insurancePolicyNumber:'PRIVATE'},financeNote:'PRIVATE'};
 const snapshot=load('lib/asset-share-snapshot.ts',{'./asset-usage':{resolveAssetUsage:()=>({}),formatResolvedAssetUsage:()=> '1 300 hours'},'./tractor-logic':{conditionLabel:s=>s}});
 const prefix='../../../../../lib/';
 const api=load('app/api/asset-leads/[leadId]/facts/route.ts',{
  [prefix+'auth-session']:{getServerSession:async()=>user?{user}:null},
  [prefix+'account-profile']:{getAccountProfile:async()=>({accountType:'business',accountStatus:active?'active':'blocked'})},
  [prefix+'partner-access']:{getAssetLeadForPartner:async input=>{assert.equal(input.dealerUserId,'recipient');return allowed?{ownerUserId:'owner',assetRegisterItemId:'asset'}:null;}},
  [prefix+'asset-register-db']:{getAssetRegisterItemById:async(owner,id)=>{assert.equal(owner,'owner');assert.equal(id,'asset');return asset;}},
  [prefix+'asset-share-snapshot']:snapshot,
  [prefix+'business-network-api']:{businessJson:(data,status=200)=>({data,status}),businessError:error=>{throw error;}},
 });
 const read=()=>api.GET(new Request('https://test'),{params:{leadId:'lead'}});
 assert.equal((await read()).status,401);user={id:'recipient'};
 assert.equal((await read()).status,403);allowed=true;active=false;
 assert.equal((await read()).status,403);active=true;
 let result=await read();assert.equal(result.status,200);assert.equal(result.data.asset.mapped,true);assert.equal(result.data.asset.financeStatus,'paid');assert.equal(result.data.asset.insuranceStatus,'no');
 assert(!JSON.stringify(result).includes('PRIVATE'));assert(!('lastKnownLat' in result.data.asset));
 asset={...asset,isInsured:true,lastKnownLat:null};result=await read();assert.equal(result.data.asset.insuranceStatus,'yes');assert.equal(result.data.asset.mapped,false);
 asset=null;assert.equal((await read()).status,404);
});
