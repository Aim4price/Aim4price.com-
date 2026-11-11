const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,mocks={}){const out={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(name in mocks)return mocks[name];throw Error('Unexpected dependency '+name)},out);return out;}
const policy=load('lib/team-access-policy.ts');
const mobile=load('lib/manager-mobile-policy.ts');
const project=load('lib/manager-permissions.ts',{'./team-access-policy':policy});
for(const [role,template] of Object.entries(policy.TEAM_TEMPLATES))test(`${role}: native action gates match its individual permissions`,()=>{
 const can=key=>template.permissions[key]===true;
 for(const [section,key] of Object.entries({usage:'updateUsage',details:'editDetails',location:'updateLocation',maintenance:'viewMaintenance',reports:'exportAssets'}))assert.equal(mobile.managerAssetSectionAllowed(section,false,can),can(key));
 for(const section of ['finance','insurance','licence','delete','marketplace','pricing','activity'])assert.equal(mobile.managerAssetSectionAllowed(section,false,can),false);
 assert.equal(mobile.managerAssetSectionAllowed('media',false,can),can('viewPhotos')||can('uploadPhotos')||can('uploadDocuments'));
});
test('owner retains all native management sections',()=>{
 for(const section of ['usage','details','location','maintenance','media','reports','finance','insurance','delete','pricing'])assert.equal(mobile.managerAssetSectionAllowed(section,true,()=>false),true);
});
test('locations only project real native field names when allowed; values stay independent',()=>{
 const asset={id:'a',value:99999,replacementPriceExVat:199999,lastKnownLat:-33,lastKnownLng:22,specsJson:{secret:'hidden'}};
 const denied=project.projectManagerAsset(asset,policy.EMPTY_TEAM_PERMISSIONS);
 assert.equal(denied.lastKnownLat,undefined);assert.equal(denied.value,null);
 const granted=project.projectManagerAsset(asset,{...policy.EMPTY_TEAM_PERMISSIONS,viewMap:true});
 assert.equal(granted.lastKnownLat,-33);assert.equal(granted.lastKnownLng,22);assert.equal(granted.value,null);assert.equal(granted.specsJson.secret,undefined);
});
function routeFixture(permissions,{stale=false,revoked=false}={}){
 let saved=null;const events=[];
 const client={query:async sql=>{events.push(sql);return {rows:[]}},release:()=>events.push('release')};
 const scope={actor:{id:'manager:m'},grant:{ownerId:'owner',permissions}};
 const route=load('app/api/team-workspaces/[membershipId]/route.ts',{
 'next/server':{},'../../../../lib/db':{getDb:()=>({connect:async()=>client})},
 '../../../../lib/team-access':{loadTeamScope:async()=>scope,lockTeamScope:async(_client,_scope,_id,key)=>{if(revoked)throw new policy.TeamAccessError('Access revoked',403);policy.assertTeamPermission(scope.grant,key);return {updatedAtIso:stale?'new':'revision'}},auditTeam:async()=>{}},
 '../../../../lib/team-access-http':{teamJson:body=>({status:200,body}),teamError:error=>({status:error.status||403,body:{error:error.message}})},
 '../../../../lib/team-access-policy':policy,
 '../../../../lib/asset-register-db':{updateSharedAssetDetails:async(_client,_owner,_id,patch)=>{saved=patch}},
 '../../../../lib/business-network-api':{requireBusinessOrigin:()=>{},businessBody:request=>request.json()},
 });
 return {run:patch=>route.PATCH({json:async()=>({assetId:'a',patch,expectedUpdatedAtIso:'revision'})},{params:{membershipId:'m'}}),saved:()=>saved,events};
}
test('operator can save a usage-only patch and cannot smuggle financial/detail fields',async()=>{
 const fixture=routeFixture(policy.TEAM_TEMPLATES.operator.permissions);
 assert.equal((await fixture.run({usage:1401})).status,200);assert.deepEqual(fixture.saved(),{usage:1401});
 for(const patch of [{value:1},{usage:1402,title:'changed'},{photos:[]},{usageMetric:'km'}])assert.notEqual((await fixture.run(patch)).status,200);
 assert.deepEqual(fixture.saved(),{usage:1401});
});
test('view-only cannot update usage; stale revisions and revoked grants cannot write',async()=>{
 for(const [permissions,options] of [[policy.EMPTY_TEAM_PERMISSIONS,{}],[policy.TEAM_TEMPLATES.operator.permissions,{stale:true}],[policy.TEAM_TEMPLATES.operator.permissions,{revoked:true}]]){
 const fixture=routeFixture(permissions,options);assert.notEqual((await fixture.run({usage:1401})).status,200);assert.equal(fixture.saved(),null);
 }
});
test('office can edit identity without a financial payload',async()=>{
 const fixture=routeFixture(policy.TEAM_TEMPLATES.office.permissions);assert.equal((await fixture.run({title:'Updated tractor',yearModel:2021})).status,200);assert.deepEqual(fixture.saved(),{title:'Updated tractor',yearModel:2021});
});
