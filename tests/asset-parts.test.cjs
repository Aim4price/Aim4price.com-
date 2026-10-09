const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const {PGlite} = require('@electric-sql/pglite');
function load(file,mocks={}) { const exports={}; const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText; new Function('require','exports',code)(name=>name in mocks?mocks[name]:require(name),exports); return exports; }
const validation=load('lib/asset-parts.ts');
const permissions=load('lib/external-share-permissions.ts');
const asset='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222', maintenance='33333333-3333-4333-8333-333333333333';
const draft={requestId:'44444444-4444-4444-8444-444444444444',itemKey:'oil_filter',name:'Oil filter',partNumber:'ABC-001',brand:'Example'};
class AccessError extends Error {constructor(message,status){super(message);this.status=status;}}
test('parts permissions are explicit and read-only links never acquire add access',()=>{
 assert.equal(permissions.normalizeExternalPermissions({maintenanceReports:true}).viewParts,false);
 assert.equal(permissions.normalizeExternalPermissions({viewParts:'true'}).viewParts,false);
 const read=permissions.readOnlyAssetLinkPermissions({viewParts:true,addParts:true});
 assert.equal(read.viewParts,true);assert.equal(read.addParts,false);
});
test('parts input preserves leading zeros and rejects malformed/oversized values',()=>{
 assert.equal(validation.validateAssetPart({...draft,partNumber:' 001-ABC '}).partNumber,'001-ABC');
 for(const patch of [{name:''},{partNumber:123},{notes:'x'.repeat(2001)},{requestId:'bad'},{maintenanceId:'bad'}]) assert.throws(()=>validation.validateAssetPart({...draft,...patch}));
});
test('parts persist against the live asset; permissions, ownership, record links and retries are enforced',async()=>{
 const db=new PGlite();
 await db.exec(`CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text); CREATE TABLE asset_maintenance_records(id uuid PRIMARY KEY,user_id text,asset_register_item_id uuid,title text,maintenance_type text,status text,created_at timestamptz DEFAULT now()); INSERT INTO asset_register_items VALUES ('${asset}','owner'),('${other}','other'); INSERT INTO asset_maintenance_records(id,user_id,asset_register_item_id,title,maintenance_type,status) VALUES ('${maintenance}','other','${other}','Other private service','service','completed');`);
 const client={query:async(sql,args)=>sql.includes('CREATE TABLE IF NOT EXISTS public.asset_parts')?db.exec(sql):sql.includes('pg_advisory_xact_lock')?{rows:[]}:db.query(sql,args),release(){}};
 const pool={...client,connect:async()=>client};
 let user={id:'owner',email:'owner@example.com'}, allowed=new Set(),revoked=false;
 const events=[],usage=[];
 const seed=load('lib/maintenance-catalogue-seed.ts');
 const catalogue=load('lib/maintenance-catalogue.ts',{'./maintenance-catalogue-seed':seed});
 const api=load('lib/asset-parts-api.ts',{
 './db':{getDb:()=>pool},'./auth-session':{getServerSession:async()=>user?{user}:null},
 './asset-register-db':{getAssetRegisterItemById:async(owner,id)=>{const result=await db.query('SELECT * FROM asset_register_items WHERE id=$1 AND user_id=$2',[id,owner]);return result.rows.length?{id,maintenanceIdentity:{source:'advanced',familyId:38,sector:'agricultural'}}:null;}},
 './shared-asset-contributions':{contributionScope:async(target,permission)=>{if(!allowed.has(permission))throw new AccessError('Denied',403);return {ownerId:'owner',assetId:asset,user:{id:'recipient',email:'recipient@example.com'},lock:async()=>{if(revoked)throw new AccessError('Revoked',403);}};}},
 './external-lead-access':{ExternalLeadAccessError:AccessError},
 './business-network-api':{businessJson:(data,status=200)=>({data,status}),businessError:e=>({status:400,data:{error:e.message}}),businessBody:async r=>r.body,requireBusinessOrigin:r=>{if(r.origin!=='trusted')throw new AccessError('Origin',403);}},
 './business-network':{limitBusinessAction:async()=>{}},'./maintenance-catalogue-db':{getMaintenanceCatalogue:async()=>seed.maintenanceCatalogueSeed},'./maintenance-catalogue':catalogue,
 './asset-checklist-db':{listAssetChecklistItems:async()=>[]},'./asset-maintenance':{ensureAssetMaintenanceTables:async()=>{}},
 './shared-asset-activity':{ensureSharedAssetActivity:async()=>{},recordSharedAssetActivity:async(c,e)=>events.push(e)},'./sharing-foundation':{ensureSharingFoundation:async()=>{},recordSharingUsage:async e=>usage.push(e)},'./asset-parts':validation
 });
 const call=(method,body=draft,target={ownerAssetId:asset},origin='trusted')=>api.assetPartsRequest({method,body,origin},target);
 try {
  assert.equal((await call('POST')).status,200);
  assert.equal((await call('POST')).status,200);
  assert.equal((await db.query('SELECT * FROM asset_parts')).rows.length,1);
  assert.equal(events.length,1);
  let read=await call('GET');assert.equal(read.data.parts[0].partNumber,'ABC-001');assert.ok(read.data.suggestions.some(s=>s.id==='oil_filter'));assert.equal(read.data.maintenance.length,0);
  const linked={...draft,requestId:'55555555-5555-4555-8555-555555555555',maintenanceId:maintenance};
  assert.equal((await call('POST',linked)).status,400);
  await db.query('UPDATE asset_maintenance_records SET user_id=$1,asset_register_item_id=$2 WHERE id=$3',['owner',asset,maintenance]);
  assert.equal((await call('POST',linked)).status,200);
  const lead={leadId:'lead'};
  assert.equal((await call('GET',draft,lead)).status,403);
  allowed=new Set(['viewParts']);read=await call('GET',draft,lead);assert.equal(read.data.parts.length,2);assert.equal(read.data.canAdd,false);assert.equal(read.data.maintenance.length,0);
  assert.equal((await call('POST',draft,lead)).status,403);
  allowed=new Set(['addParts']);read=await call('GET',draft,lead);assert.deepEqual(read.data.parts,[]);assert.equal(read.data.canAdd,true);
  const added={...draft,requestId:'66666666-6666-4666-8666-666666666666'};
  assert.equal((await call('POST',added,lead,'foreign')).status,403);
  assert.equal((await call('POST',added,lead)).status,200);assert.equal(usage.length,1);
  assert.equal((await call('POST',draft,lead)).status,400); // another actor's request ID
  revoked=true;assert.equal((await call('POST',{...added,requestId:'77777777-7777-4777-8777-777777777777'},lead)).status,403);
  assert.equal((await call('GET',draft,lead)).status,403);
  user={id:'other',email:'other@example.com'};assert.equal((await call('GET')).status,404);
  user=null;assert.equal((await call('GET')).status,401);
 } finally {await db.close();}
});
