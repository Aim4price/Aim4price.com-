const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),exports);return exports;}
test('shared problems preserve owner notes, scoped resolution, retry safety and revoked permissions',async()=>{
 const pg=new PGlite(),assetId=randomUUID(),otherAsset=randomUUID();let allowed=true,revoked=false,usage=0;
 try{
 await pg.exec(`CREATE TABLE asset_register_items(id uuid,user_id text);CREATE TABLE asset_scan_events(id uuid PRIMARY KEY,asset_id uuid,actor_type text CONSTRAINT asset_scan_events_actor_type_check CHECK(actor_type IN ('scan_pin','owner_session','field_manager','admin_session')),operator_name text,note text,issue_noted_at timestamptz,created_at timestamptz DEFAULT now());`);
 await pg.query('INSERT INTO asset_register_items VALUES($1,$2)',[assetId,'owner']);
 const query=(s,a)=>a?pg.query(s,a):pg.exec(s).then(r=>r.at(-1));const db={getDb:()=>({query,connect:async()=>({query,release(){}})})};
 class Denied extends Error{constructor(message,status=403){super(message);this.status=status;}}
 const scope={ownerId:'owner',assetId,user:{id:'recipient',name:'Dealer',email:'dealer@test'},token:'token',lock:async()=>{if(revoked)throw new Denied('Revoked');}};
 const activity=load('lib/shared-asset-activity.ts',{'./db':db}),notes=load('lib/asset-issue-notes.ts',{'./db':db});
 const service=load('lib/shared-asset-problems.ts',{'./db':db,'./shared-asset-contributions':{contributionScope:async()=>{if(!allowed)throw new Denied('Not shared');return scope;}},'./live-shared-asset-access':{requireLiveSharedAsset:async()=>scope},'./asset-issue-notes':notes,'./fuel-ledger':{ensureFuelLedgerTables:async()=>{}},'./shared-asset-activity':activity,'./sharing-foundation':{ensureSharingFoundation:async()=>{},recordSharingUsage:async()=>{usage++;}},'./business-network-api':{businessJson:(data,status=200)=>({data,status}),businessError:error=>({status:400,data:{error:error.message}}),businessBody:async r=>r.body,requireBusinessOrigin:()=>{}},'./external-lead-access':{ExternalLeadAccessError:Denied},'./business-network':{limitBusinessAction:async()=>{}}});
 const send=body=>service.sharedAssetProblems({method:'POST',body},{leadId:'lead'}),id=randomUUID();
 let result=await send({action:'log',note:'Hydraulic leak',requestId:id});assert.equal(result.status,200);assert.equal(result.data.items[0].note,'Hydraulic leak');
 await send({action:'log',note:'Hydraulic leak',requestId:id});assert.equal(usage,1);assert.equal((await notes.listIssueNotesForAssets([assetId])).length,1);
 assert.equal((await send({action:'resolve',problemId:id,requestId:randomUUID()})).status,400);
 const foreignProblem=randomUUID();await pg.query("INSERT INTO asset_scan_events(id,asset_id,note) VALUES($1,$2,'Notes/Problems: Other asset')",[foreignProblem,otherAsset]);
 assert.equal((await send({action:'resolve',problemId:foreignProblem,confirmed:true,requestId:randomUUID()})).status,404);
 const resolution=randomUUID();result=await send({action:'resolve',problemId:id,confirmed:true,requestId:resolution});assert.equal(result.status,200);assert.ok(result.data.items[0].notedAtIso);assert.equal((await notes.listIssueNotesForAssets([assetId])).length,0);await send({action:'resolve',problemId:id,confirmed:true,requestId:resolution});assert.equal(usage,2);
 allowed=false;assert.equal((await send({action:'log',note:'Denied',requestId:randomUUID()})).status,403);allowed=true;revoked=true;assert.equal((await send({action:'log',note:'Revoked',requestId:randomUUID()})).status,403);
 assert.equal((await pg.query('SELECT * FROM shared_asset_activity')).rows.length,2);
 }finally{await pg.close();}
});
test('link report permissions are opt-in and preserve explicit selections',()=>{
 const permissions=load('lib/external-share-permissions.ts',{});
 assert.equal(permissions.assetLinkPermissions().maintenanceReports,false);assert.equal(permissions.assetLinkPermissions().costOfOwnership,false);
 const selected=permissions.assetLinkPermissions({maintenanceReports:true,costOfOwnership:false});assert.equal(selected.maintenanceReports,true);assert.equal(selected.costOfOwnership,false);
});
