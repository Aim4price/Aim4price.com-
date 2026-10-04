const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:require(n),exports);return exports;}
test('details enforce separate permissions, locked writes, canonical fields, history and retry-safe usage',async()=>{
 const pg=new PGlite(),id=randomUUID();
 try{
 await pg.exec(`CREATE TABLE "user"(id text PRIMARY KEY);INSERT INTO "user" VALUES('owner'),('recipient');CREATE TABLE asset_register_items(id uuid,user_id text,year_model int,hours numeric,condition text,specs_json jsonb,updated_at timestamptz);`);
 await pg.query('INSERT INTO asset_register_items VALUES($1,$2,2020,100,$3,$4,now())',[id,'owner','good',{}]);
 const query=(s,a)=>/create extension/i.test(s)?Promise.resolve({rows:[]}):a?pg.query(s,a):pg.exec(s).then(r=>r.at(-1));const db={getDb:()=>({query,connect:async()=>({query,release(){}})})};
 const state={allow:{yearModel:true,usage:false,condition:true,addMaintenance:false},revoked:false};class Denied extends Error{constructor(m,status=403){super(m);this.status=status;}}
 const source=fs.readFileSync('lib/asset-register-db.ts','utf8').split('/** Restricted shared edits')[1];const out={};
 const helpers={getAssetRegisterSchema:async()=>({}),buildSelectList:()=>'*',mapAssetRegisterRow:r=>({...r,id:r.id,yearModel:r.year_model,hours:Number(r.hours),condition:r.condition,specsJson:r.specs_json,lifeWorkedPercent:null}),resolveSharedAssetUsage:a=>({metric:'hours',value:a.hours}),normalizeConditionForDb:v=>v,buildYearModelSpecsJson:s=>s,buildValuationStaleReasons:()=>['details'],markValuationNeedsUpdate:s=>({...s,valuationNeedsUpdate:true}),pushField:(fields,_schema,names,value,cast)=>fields.push({name:names[0],value:cast?JSON.stringify(value):value,cast:cast||''}),buildUpdateSetClause:fields=>({clause:fields.map((f,i)=>`${f.name}=$${i+3}${f.cast}`).join(','),values:fields.map(f=>f.value)})};
 new Function(...Object.keys(helpers),'exports',ts.transpileModule('export '+source.slice(source.indexOf('async function')),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(...Object.values(helpers),out);
 const foundation=load('lib/sharing-foundation.ts',{'./db':db});const activity=load('lib/shared-asset-activity.ts',{'./db':db});
 const scope={ownerId:'owner',assetId:id,user:{id:'recipient',name:'Workshop',email:'r@example.test'},token:'link',lock:async()=>{if(state.revoked)throw new Denied('revoked');}};
 const schema=load('lib/asset-history-schema.ts',{'./db':db});const unifiedHistory=load('lib/asset-history.ts',{'./db':db,'./asset-history-schema':schema,'./shared-asset-activity':activity});
 const api=load('lib/shared-asset-work.ts',{'./asset-history-restore':{restoreAssetDetails:async()=>{throw Error('Not exercised by details tests');}},'./asset-history':unifiedHistory,'./db':db,'./shared-asset-contributions':{contributionScope:async(_,p)=>{if(!state.allow[p])throw new Denied('not shared');return scope;}},'./asset-register-db':{...out,getAssetRegisterItemById:async()=>({id,condition:'good'})},'./my-invoices':{mapMyInvoiceAssetOption:()=>({id})},'./maintenance-catalogue':{maintenanceIdentity:()=>({})},'./asset-checklist-db':{},'./asset-usage':{resolveAssetUsage:()=>({metric:'hours',value:100})}, './asset-maintenance':{recordStandaloneAssetMaintenanceCompletion:async(owner,input,hooks)=>{const client={query};await query('BEGIN');try{await hooks.before(client);const prior=(await query('SELECT * FROM asset_maintenance_records WHERE source_scan_event_id=$1',[input.sourceScanEventId])).rows[0];if(prior){await query('COMMIT');return prior;}const record={id:randomUUID(),title:'Check-up'};await query('INSERT INTO asset_maintenance_records VALUES($1,$2,$3,$4)',[record.id,owner,input.assetId,input.sourceScanEventId]);await hooks.after(client,record);await query('COMMIT');return record;}catch(e){await query('ROLLBACK');throw e;}}},'./shared-asset-activity':activity,'./sharing-foundation':foundation,'./business-network-api':{businessJson:(data,status=200)=>({data,status}),businessError:e=>({status:400,error:e.message}),requireBusinessOrigin:()=>{},businessBody:r=>r.json()},'./external-lead-access':{ExternalLeadAccessError:Denied},'./business-network':{limitBusinessAction:async()=>{}}});
 const send=(patch,requestId=randomUUID())=>api.sharedAssetWork(new Request('https://test/details',{method:'POST',body:JSON.stringify({patch,requestId})}),{token:'link',assetId:id},'details');
 assert.equal((await send({usage:120})).status,403);assert.equal((await send({ownerId:'other'})).status,400);assert.equal((await send({yearModel:5000})).status,400);
 assert.equal((await send({title:'Changed title'})).status,403);
 const key=randomUUID();assert.equal((await send({yearModel:2021,condition:'excellent'},key)).status,200);assert.equal((await send({yearModel:2021,condition:'excellent'},key)).status,200);
 let row=(await pg.query('SELECT * FROM asset_register_items')).rows[0];assert.equal(row.year_model,2021);assert.equal(row.condition,'excellent');assert.equal(Number(row.hours),100);assert.equal(row.specs_json.valuationNeedsUpdate,true);
 const history=(await pg.query('SELECT * FROM shared_asset_activity')).rows;assert.equal(history.length,1);assert.equal(history[0].actor_id,'recipient');assert.equal(history[0].before_data.yearModel,2020);assert.equal(history[0].after_data.yearModel,2021);assert.equal((await foundation.sharingUsageSummary('recipient')).contribution.count,1);
 state.allow.usage=true;assert.equal((await send({usage:99})).status,400);assert.equal((await send({usage:120})).status,200);
 await pg.exec('CREATE TABLE asset_maintenance_records(id uuid,user_id text,asset_register_item_id uuid,source_scan_event_id uuid)');
 const complete=(body)=>api.sharedAssetWork(new Request('https://test/maintenance',{method:'POST',body:JSON.stringify(body)}),{token:'link',assetId:id},'maintenance');
 const work={requestId:randomUUID(),maintenanceType:'checkup',completedAt:'2025-01-01',completedUsage:110,completedBy:'Technician',maintenanceWork:{items:['Brakes']}};
 assert.equal((await complete(work)).status,403);state.allow.addMaintenance=true;
 assert.equal((await complete({...work,completedAt:'2025-02-30'})).status,400);
 assert.equal((await complete({...work,maintenanceType:'invalid'})).status,400);
 assert.equal((await complete({...work,requestId:key})).status,400);
 assert.equal((await complete(work)).status,200);assert.equal((await complete(work)).status,200);
 assert.equal((await pg.query('SELECT * FROM asset_maintenance_records')).rows.length,1);
 assert.equal((await pg.query("SELECT * FROM shared_asset_activity WHERE action='Maintenance completed'")).rows.length,1);
 assert.equal((await foundation.sharingUsageSummary('recipient')).contribution.count,3);
 assert.equal((await send({yearModel:2022},work.requestId)).status,400);
 await pg.exec("ALTER TABLE asset_register_items ADD COLUMN title text; CREATE TABLE asset_leads(owner_user_id text,asset_register_item_id uuid,asset_snapshot_json jsonb,updated_at timestamptz);");
 state.allow.updateDetails=true;
 assert.equal((await send({title:'   '})).status,400);
 assert.equal((await send({title:'Updated tractor'})).status,200);
 assert.equal((await pg.query('SELECT title FROM asset_register_items')).rows[0].title,'Updated tractor');
 assert.equal((await pg.query("SELECT after_data FROM shared_asset_activity WHERE action='Asset details updated' ORDER BY created_at DESC LIMIT 1")).rows[0].after_data.title,'Updated tractor');
 state.revoked=true;assert.equal((await complete({...work,requestId:randomUUID()})).status,403);assert.equal((await send({condition:'fair'})).status,403);row=(await pg.query('SELECT * FROM asset_register_items')).rows[0];assert.equal(row.condition,'excellent');
 }finally{await pg.close();}
});
