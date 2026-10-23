const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite');
function load(file,mocks={}){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n==='node:crypto'?require(n):n in mocks?mocks[n]:(()=>{throw Error('Missing '+n)})(),exports);return exports;}
async function setup(){
 const pg=new PGlite(),query=(sql,p)=>p?pg.query(sql,p):pg.exec(sql).then(r=>r.at(-1)||{rows:[]});const db={getDb:()=>({query,connect:async()=>({query,release(){}})})};
 await pg.exec(`CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text,specs_json jsonb DEFAULT '{}',hours numeric,updated_at timestamptz DEFAULT now());
 CREATE TABLE asset_invoice_documents(id uuid PRIMARY KEY,user_id text,asset_register_item_id uuid);
 CREATE TABLE asset_invoices(id uuid PRIMARY KEY,user_id text,asset_register_item_id uuid REFERENCES asset_register_items(id),invoice_document_id uuid REFERENCES asset_invoice_documents(id),source text,total_inc_vat numeric(14,2),updated_at timestamptz DEFAULT now());
 CREATE TABLE asset_invoice_blocks(id uuid PRIMARY KEY,invoice_id uuid REFERENCES asset_invoices(id) ON DELETE CASCADE,amount_ex_vat numeric);
 CREATE TABLE fuel_storage_units(id uuid PRIMARY KEY,user_id text,current_litres numeric(12,3),capacity_litres numeric,updated_at timestamptz DEFAULT now());
 CREATE TABLE fuel_storage_events(id uuid PRIMARY KEY,user_id text,asset_register_item_id uuid,storage_id uuid REFERENCES fuel_storage_units(id),fuel_slip_id uuid,event_type text,litres numeric,created_at timestamptz DEFAULT clock_timestamp());
 CREATE TABLE fuel_slips(id uuid PRIMARY KEY,user_id text,asset_register_item_id uuid,asset_invoice_id uuid REFERENCES asset_invoices(id) ON DELETE SET NULL,fuel_storage_event_id uuid,record_status text DEFAULT 'active',voided_at timestamptz,void_reason text,total_amount numeric,updated_at timestamptz DEFAULT now());
 CREATE TABLE asset_scan_events(id uuid PRIMARY KEY,asset_id uuid,fuel_slip_id uuid,fuel_storage_event_id uuid REFERENCES fuel_storage_events(id),note text);
 CREATE TABLE asset_maintenance_records(id uuid PRIMARY KEY,user_id text,asset_register_item_id uuid,status text,generated_from_maintenance_id uuid,source_scan_event_id uuid REFERENCES asset_scan_events(id),completed_at timestamptz,completed_usage numeric,completed_notes text,completed_by text,maintenance_work jsonb,alert_noted_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());`);
 const schema=load('lib/asset-history-schema.ts',{'./db':db});await schema.installAssetHistoryTriggers();
 const engine=load('lib/asset-history-record-correction.ts',{'./db':db,'./asset-history-schema':schema});
 const activity=load('lib/shared-asset-activity.ts',{'./db':db});await activity.ensureSharedAssetActivity();
 const history=load('lib/asset-history.ts',{'./db':db,'./asset-history-schema':schema,'./shared-asset-activity':activity,'./asset-history-fields':load('lib/asset-history-fields.ts')});
 const asset=randomUUID();await pg.query("INSERT INTO asset_register_items(id,user_id,hours) VALUES($1,'owner',1300)",[asset]);
 const event=async(id)=>(await pg.query('SELECT id FROM asset_history_events WHERE record_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[id])).rows[0].id;
 const preview=async(id)=>engine.correctAssetHistoryRecord('owner',asset,await event(id),{id:'owner',name:'Owner'},{action:'previewRecordCorrection'});
 const run=async(id,p)=>engine.correctAssetHistoryRecord('owner',asset,await event(id),{id:'owner',name:'Owner'},{action:'correctRecord',confirmed:true,revision:p.revision,reason:'Correcting a mistake'});
 const correct=async(id)=>run(id,await preview(id));
 return {pg,asset,event,engine,history,preview,run,correct};
}
test('cost retraction removes totals and blocks, restores same IDs, retains documents and records both actions',async()=>{
 const s=await setup();try{const id=randomUUID(),block=randomUUID(),doc=randomUUID();await s.pg.query("INSERT INTO asset_invoice_documents VALUES($1,'owner',$2)",[doc,s.asset]);await s.pg.query("INSERT INTO asset_invoices(id,user_id,asset_register_item_id,invoice_document_id,source,total_inc_vat) VALUES($1,'owner',$2,$3,'manual',115)",[id,s.asset,doc]);await s.pg.query('INSERT INTO asset_invoice_blocks VALUES($1,$2,100)',[block,id]);
 const p=await s.preview(id);assert.equal(p.title,'Retract cost');assert.equal(p.details.total_inc_vat,115);assert.equal((await s.pg.query('SELECT * FROM asset_invoices')).rows.length,1,'preview does not write');
 await s.run(id,p);assert.equal((await s.pg.query('SELECT * FROM asset_invoices')).rows.length,0);assert.equal((await s.pg.query('SELECT * FROM asset_invoice_blocks')).rows.length,0);assert.equal((await s.pg.query('SELECT * FROM asset_invoice_documents')).rows.length,1);
 const h=await s.history.listUnifiedAssetHistory('owner',s.asset);assert.equal(h.items.find(i=>i.recordAction).recordAction,'Restore item');assert.equal(h.items.find(i=>i.recordAction).recordState,'Retracted');
 assert.ok(!(await s.history.listUnifiedAssetHistory('owner',s.asset,{owner:false,actorId:'owner'})).items.some(i=>i.recordAction));
 assert.ok(!JSON.stringify(h).includes('invoice_document_id'),'private snapshots are not returned');
 await assert.rejects(s.run(id,p),/Newer changes/,'double click cannot reverse the correction');await s.correct(id);
 assert.equal((await s.pg.query('SELECT total_inc_vat FROM asset_invoices WHERE id=$1',[id])).rows[0].total_inc_vat,'115.00');assert.equal((await s.pg.query('SELECT id FROM asset_invoice_blocks')).rows[0].id,block);
 assert.deepEqual((await s.pg.query("SELECT operation FROM asset_history_events WHERE operation IN ('RETRACT','RESTORE') ORDER BY created_at")).rows.map(r=>r.operation),['RETRACT','RESTORE']);
 await s.correct(id);await s.correct(id);assert.equal((await s.pg.query('SELECT count(*)::int n FROM asset_invoices')).rows[0].n,1);
 }finally{await s.pg.close();}
});
test('corrections enforce owner/asset, confirmation, reason, preview revision and dependent records',async()=>{
 const s=await setup();try{const id=randomUUID();await s.pg.query("INSERT INTO asset_invoices(id,user_id,asset_register_item_id,source,total_inc_vat) VALUES($1,'owner',$2,'manual',115)",[id,s.asset]);const event=await s.event(id),p=await s.preview(id);
 await assert.rejects(s.engine.correctAssetHistoryRecord('other',s.asset,event,{id:'other',name:'Other'},{action:'previewRecordCorrection'}),/Choose a cost/);
 await assert.rejects(s.engine.correctAssetHistoryRecord('owner',randomUUID(),event,{id:'owner',name:'Owner'},{action:'previewRecordCorrection'}),/Choose a cost/);
 await assert.rejects(s.engine.correctAssetHistoryRecord('owner',s.asset,event,{id:'owner',name:'Owner'},{action:'correctRecord',revision:p.revision}),/Confirm/);
 await assert.rejects(s.engine.correctAssetHistoryRecord('owner',s.asset,event,{id:'owner',name:'Owner'},{action:'correctRecord',confirmed:true,revision:p.revision}),/reason/);
 await s.pg.query('UPDATE asset_invoices SET total_inc_vat=230 WHERE id=$1',[id]);await assert.rejects(s.run(id,p),/Newer changes/);
 await s.pg.exec('CREATE TABLE capture(id uuid PRIMARY KEY,invoice_id uuid REFERENCES asset_invoices(id) ON DELETE SET NULL)');await s.pg.query('INSERT INTO capture VALUES($1,$2)',[randomUUID(),id]);await assert.rejects(s.preview(id),/linked record depends/);
 assert.equal((await s.pg.query('SELECT count(*)::int n FROM asset_invoices')).rows[0].n,1);
 }finally{await s.pg.close();}
});
test('completed service undo and restore preserve completion details and the same recurring child',async()=>{
 const s=await setup();try{const id=randomUUID(),child=randomUUID(),scan=randomUUID();await s.pg.query('INSERT INTO asset_scan_events(id,asset_id,note) VALUES($1,$2,\'Service\')',[scan,s.asset]);await s.pg.query("INSERT INTO asset_maintenance_records(id,user_id,asset_register_item_id,status,source_scan_event_id,completed_at,completed_notes,maintenance_work) VALUES($1,'owner',$2,'done',$3,now(),'Changed oil','[{\"part\":\"filter\"}]')",[id,s.asset,scan]);await s.pg.query("INSERT INTO asset_maintenance_records(id,user_id,asset_register_item_id,status,generated_from_maintenance_id) VALUES($1,'owner',$2,'upcoming',$3)",[child,s.asset,id]);
 assert.equal((await s.preview(id)).title,'Undo completion');await s.correct(id);assert.equal((await s.pg.query('SELECT status FROM asset_maintenance_records WHERE id=$1',[id])).rows[0].status,'upcoming');assert.equal((await s.pg.query('SELECT status FROM asset_maintenance_records WHERE id=$1',[child])).rows[0].status,'cancelled');assert.equal((await s.pg.query('SELECT * FROM asset_scan_events')).rows.length,0);
 assert.equal((await s.preview(id)).title,'Restore completion');await s.correct(id);const restored=(await s.pg.query('SELECT * FROM asset_maintenance_records WHERE id=$1',[id])).rows[0];assert.equal(restored.status,'done');assert.equal(restored.completed_notes,'Changed oil');assert.deepEqual(restored.maintenance_work,[{part:'filter'}]);assert.equal(restored.source_scan_event_id,scan);assert.equal((await s.pg.query('SELECT status FROM asset_maintenance_records WHERE id=$1',[child])).rows[0].status,'upcoming');
 const actions=(await s.history.listUnifiedAssetHistory('owner',s.asset)).items.filter(i=>i.recordId===id&&i.recordAction);assert.equal(actions[0].recordAction,'Undo completion');
 await s.correct(id);await s.correct(id);assert.equal((await s.pg.query('SELECT count(*)::int n FROM asset_maintenance_records')).rows[0].n,2);
 }finally{await s.pg.close();}
});
test('maintenance blocks completed followups and newer edits after retraction; schedules restore',async()=>{
 const s=await setup();try{const id=randomUUID(),child=randomUUID();await s.pg.query("INSERT INTO asset_maintenance_records(id,user_id,asset_register_item_id,status) VALUES($1,'owner',$2,'done')",[id,s.asset]);await s.pg.query("INSERT INTO asset_maintenance_records(id,user_id,asset_register_item_id,status,generated_from_maintenance_id) VALUES($1,'owner',$2,'done',$3)",[child,s.asset,id]);await assert.rejects(s.preview(id),/following recurring service/);
 await s.pg.query("UPDATE asset_maintenance_records SET status='cancelled' WHERE id=$1",[child]);await s.correct(id);await s.pg.query("UPDATE asset_maintenance_records SET completed_notes='new work' WHERE id=$1",[id]);await assert.rejects(s.preview(id),/Newer changes/);
 const schedule=randomUUID();await s.pg.query("INSERT INTO asset_maintenance_records(id,user_id,asset_register_item_id,status) VALUES($1,'owner',$2,'upcoming')",[schedule,s.asset]);assert.equal((await s.preview(schedule)).title,'Retract schedule');await s.correct(schedule);assert.equal((await s.preview(schedule)).title,'Restore schedule');await s.correct(schedule);assert.equal((await s.pg.query('SELECT status FROM asset_maintenance_records WHERE id=$1',[schedule])).rows[0].status,'upcoming');
 }finally{await s.pg.close();}
});
test('fuel retraction removes linked cost/activity and restores exact records while retaining usage',async()=>{
 const s=await setup();try{const id=randomUUID(),cost=randomUUID(),block=randomUUID(),scan=randomUUID();await s.pg.query("INSERT INTO asset_invoices(id,user_id,asset_register_item_id,source,total_inc_vat) VALUES($1,'owner',$2,'fuel_slip',115)",[cost,s.asset]);await s.pg.query('INSERT INTO asset_invoice_blocks VALUES($1,$2,100)',[block,cost]);await s.pg.query("INSERT INTO fuel_slips(id,user_id,asset_register_item_id,asset_invoice_id,total_amount) VALUES($1,'owner',$2,$3,115)",[id,s.asset,cost]);await s.pg.query('INSERT INTO asset_scan_events(id,asset_id,fuel_slip_id) VALUES($1,$2,$3)',[scan,s.asset,id]);await s.pg.query('UPDATE asset_register_items SET specs_json=$2 WHERE id=$1',[s.asset,JSON.stringify({lastFuelSlipId:id,lastFuelSlipNote:'Fuel',unrelated:'keep'})]);
 await assert.rejects(s.preview(cost),/linked fuel slip/);await s.correct(id);assert.equal((await s.pg.query('SELECT record_status FROM fuel_slips')).rows[0].record_status,'voided');assert.equal((await s.pg.query('SELECT * FROM asset_invoices')).rows.length,0);assert.equal((await s.pg.query('SELECT * FROM asset_scan_events')).rows.length,0);assert.deepEqual((await s.pg.query('SELECT specs_json FROM asset_register_items')).rows[0].specs_json,{unrelated:'keep'});
 await s.correct(id);assert.equal((await s.pg.query('SELECT record_status,asset_invoice_id FROM fuel_slips')).rows[0].record_status,'active');assert.equal((await s.pg.query('SELECT id FROM asset_invoices')).rows[0].id,cost);assert.equal((await s.pg.query('SELECT id FROM asset_scan_events')).rows[0].id,scan);assert.equal((await s.pg.query('SELECT hours FROM asset_register_items')).rows[0].hours,'1300');
 }finally{await s.pg.close();}
});
test('stock movement reversal and restoration are exact and block later movements',async()=>{
 const s=await setup();try{const id=randomUUID(),stock=randomUUID(),scan=randomUUID();await s.pg.query("INSERT INTO fuel_storage_units(id,user_id,current_litres,capacity_litres) VALUES($1,'owner',90,200)",[stock]);await s.pg.query("INSERT INTO fuel_storage_events(id,user_id,asset_register_item_id,storage_id,event_type,litres) VALUES($1,'owner',$2,$3,'asset_issue',10)",[id,s.asset,stock]);await s.pg.query('INSERT INTO asset_scan_events(id,asset_id,fuel_storage_event_id) VALUES($1,$2,$3)',[scan,s.asset,id]);await s.correct(id);assert.equal((await s.pg.query('SELECT current_litres FROM fuel_storage_units')).rows[0].current_litres,'100.000');await s.correct(id);assert.equal((await s.pg.query('SELECT current_litres FROM fuel_storage_units')).rows[0].current_litres,'90.000');
 await s.pg.query("INSERT INTO fuel_storage_events(id,user_id,asset_register_item_id,storage_id,event_type,litres) VALUES($1,'owner',$2,$3,'asset_issue',5)",[randomUUID(),s.asset,stock]);await assert.rejects(s.preview(id),/Later fuel movements/);
 }finally{await s.pg.close();}
});
test('a failure partway through a correction rolls back every linked write',async()=>{
 const s=await setup();try{const id=randomUUID(),block=randomUUID();await s.pg.query("INSERT INTO asset_invoices(id,user_id,asset_register_item_id,source,total_inc_vat) VALUES($1,'owner',$2,'manual',115)",[id,s.asset]);await s.pg.query('INSERT INTO asset_invoice_blocks VALUES($1,$2,100)',[block,id]);const p=await s.preview(id);await s.pg.exec("CREATE FUNCTION refuse_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER refusal BEFORE DELETE ON asset_invoices FOR EACH ROW EXECUTE FUNCTION refuse_delete();");await assert.rejects(s.run(id,p),/fixture failure/);assert.equal((await s.pg.query('SELECT * FROM asset_invoice_blocks')).rows.length,1);assert.equal((await s.pg.query('SELECT * FROM asset_invoices')).rows.length,1);assert.equal((await s.pg.query('SELECT * FROM asset_history_corrections')).rows.length,0);
 }finally{await s.pg.close();}
});
test('history correction endpoint enforces account permissions and returns conflicts without writes',async()=>{
 const prefix='../../../../../lib/',event=randomUUID();let calls=0,session={user:{id:'owner',name:'Owner'}},app=false,dealer=false,finance=true,scope=true;
 const mocks={
 'auth-session':{getServerSession:async()=>session,isOwnerAppSession:()=>app,isDealerAppSession:()=>dealer,isAdminSupportSession:()=>false},
 'asset-register-account-access':{getAssetRegisterAccountAccess:async()=>true},
 'asset-register-db':{getAssetRegisterItemById:async()=>({id:'asset'})},
 'owner-app-access':{getOwnerAppAccess:async()=>({permissions:finance?['manage_assets','manage_finance']:['manage_assets']}),ownerAppCan:(a,p)=>a.permissions.includes(p),ownerAppCanAccessAsset:()=>scope},
 'asset-history':{listUnifiedAssetHistory:async(o,a,options)=>options},'asset-history-restore':{restoreAssetDetails:async()=>{throw Error('wrong handler');}},
 'asset-history-record-correction':{correctAssetHistoryRecord:async()=>{calls++;throw Error('History correction: Newer changes exist.');}},
 'business-network-api':{businessJson:(data,status=200)=>({data,status}),businessBody:r=>r.json(),requireBusinessOrigin:()=>{},businessError:e=>{throw e;}}
 };
 const route=load('app/api/asset-register/[assetId]/history/route.ts',Object.fromEntries(Object.entries(mocks).map(([k,v])=>[prefix+k,v])));
 const request={method:'POST',nextUrl:new URL('https://example.test/history'),json:async()=>({eventId:event,action:'correctRecord',confirmed:true})};
 session=null;assert.equal((await route.POST(request,{params:{assetId:'asset'}})).status,403);session={user:{id:'owner',name:'Owner'},ownerApp:{ownerAppUserId:'staff'},dealerApp:{staffId:'staff'}};
 dealer=true;assert.equal((await route.POST(request,{params:{assetId:'asset'}})).status,403);dealer=false;app=true;finance=false;assert.equal((await route.POST(request,{params:{assetId:'asset'}})).status,403);finance=true;scope=false;assert.equal((await route.POST(request,{params:{assetId:'asset'}})).status,403);assert.equal(calls,0);
 scope=true;assert.equal((await route.POST(request,{params:{assetId:'asset'}})).status,409);assert.equal(calls,1);
 dealer=true;app=false;const get=await route.GET({...request,method:'GET'},{params:{assetId:'asset'}});assert.equal(get.data.recordCorrections,false);
});
