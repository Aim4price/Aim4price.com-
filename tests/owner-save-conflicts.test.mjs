import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../app/api/owner-app/assets/[assetId]/route.ts', import.meta.url),'utf8');
function fixture({kind='equipment',specs={},replacement=100,revision='current',writeError}={}) {
 const writes=[];
 const item={id:'asset',title:'Asset',kind,value:50,replacementPriceExVat:replacement,updatedAtIso:revision,specsJson:specs,photos:[],documents:[],registerId:null,hours:10};
 const access={ownerUserId:'owner'};
 const dependencies={
 'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status||200})}},
 'owner-app-access':{getOwnerAppAccess:async()=>access,ownerAppCan:()=>true,ownerAppCanAccessAsset:()=>true},
 'asset-register-db':{getAssetRegisterItemById:async()=>item,updateAssetRegisterItem:async(owner,input)=>{assert.equal(owner,'owner');if(writeError)throw Error(writeError);writes.push(input);}},
 'asset-usage':{resolveAssetUsage:()=>({metric:'hours'})},
 'asset-register-uploads':{listInternalAssetRegisterUploadIds:()=>[],deleteUnreferencedAssetRegisterUploads:async()=>{}},
 'asset-registers':{listAssetRegisters:async()=>[],getAssetRegisterReportLogoUrl:async()=>'',getAssetRegisterForUser:async()=>null},
 'asset-maintenance':{listAssetMaintenanceData:async()=>({records:[],summary:{}})},
 'account-profile':{getAccountProfile:async()=>({})},
 'dealer-asset-corrections':{listOwnerAssetCorrectionAlerts:async()=>[]},
 'report-logo':{resolveReportLogoUrlForHtml:()=>''},
 };
 const mod={exports:{}};
 new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>dependencies[name]||dependencies[name.split('/').pop()]||{},mod,mod.exports);
 return {writes,save:body=>mod.exports.PUT({json:async()=>({...item,...body})},{params:{assetId:'asset'}})};
}
test('stale edits cannot overwrite desktop changes',async()=>{const f=fixture();const r=await f.save({updatedAtIso:'old'});assert.equal(r.status,409);assert.equal(r.body.conflict,true);assert.equal(f.writes.length,0);});
test('missing revision cannot silently overwrite an asset',async()=>{const f=fixture();const r=await f.save({updatedAtIso:undefined});assert.equal(r.status,409);assert.equal(f.writes.length,0);});
test('database detects a desktop edit racing after initial validation',async()=>{const f=fixture({writeError:'ASSET_EDIT_CONFLICT'});assert.equal((await f.save({})).status,409);assert.equal(f.writes.length,0);});
for(const setup of [{kind:'stock'},{kind:'property',specs:{propertyAssetSubtype:'land'}},{specs:{replacementPriceNotApplicable:true}}]){
 test(`replacement exemption saves ${JSON.stringify(setup)}`,async()=>{const f=fixture({...setup,replacement:null});const r=await f.save({});assert.equal(r.status,200);assert.equal(f.writes.length,1);assert.equal(f.writes[0].expectedUpdatedAtIso,'current');});
}
test('ordinary equipment still requires replacement price',async()=>{const f=fixture({replacement:null});assert.equal((await f.save({})).status,400);assert.equal(f.writes.length,0);});
