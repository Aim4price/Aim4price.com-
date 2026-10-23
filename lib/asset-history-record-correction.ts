import {createHash,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {getDb} from './db';
import {ensureAssetHistorySchema,setAssetHistoryActor} from './asset-history-schema';

// Snapshots stay server-side. Only the small confirmation summary leaves this module.
type Row=Record<string,any>;
type Change={table:string;id:string;before:Row|null;after:Row|null};
const tables=new Set(['asset_invoice_documents','asset_invoices','asset_invoice_blocks','fuel_slips','fuel_storage_events','fuel_storage_units','asset_scan_events','asset_register_items','asset_maintenance_records']);
const rootTables=new Set(['asset_invoices','fuel_slips','fuel_storage_events','asset_maintenance_records']);
const fail=(message:string):never=>{throw Error(`History correction: ${message}`);};
const quote=(name:string)=>'"'+name.replace(/"/g,'""')+'"';
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const revision=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
async function read(client:PoolClient,table:string,id:string){
 if(!tables.has(table))fail('This record cannot be corrected here.');
 return (await client.query(`SELECT to_jsonb(r) AS data FROM public.${quote(table)} r WHERE id::text=$1 FOR UPDATE`,[id])).rows[0]?.data??null;
}
async function related(client:PoolClient,table:string,where:string,args:unknown[]):Promise<Row[]>{
 return (await client.query(`SELECT to_jsonb(r) AS data FROM public.${quote(table)} r WHERE ${where} ORDER BY id FOR UPDATE`,args)).rows.map(r=>r.data);
}
function assertOwner(row:Row|null,ownerId:string,assetId?:string){
 if(!row||row.user_id!==ownerId||(assetId&&String(row.asset_register_item_id??row.asset_id??row.id)!==assetId))fail('The record is no longer available for this asset.');
}
async function planRetraction(client:PoolClient,ownerId:string,assetId:string,table:string,id:string){
 const root=await read(client,table,id);assertOwner(root,ownerId,assetId);
 const changes:Change[]=[];let title='Retract record',effect='';
 const add=(table:string,row:Row,after:Row|null)=>{if(!changes.some(c=>c.table===table&&c.id===String(row.id)))changes.push({table,id:String(row.id),before:row,after});};
 const invoice=async(row:Row)=>{
  assertOwner(row,ownerId,assetId);
  if(row.invoice_document_id){const doc=await read(client,'asset_invoice_documents',String(row.invoice_document_id));assertOwner(doc,ownerId,assetId);add('asset_invoice_documents',doc,doc);}
  for(const block of await related(client,'asset_invoice_blocks','invoice_id::text=$1',[row.id]))add('asset_invoice_blocks',block,null);
  add('asset_invoices',row,null);
 };
 const scans=async(where:string,args:unknown[])=>{
  for(const row of await related(client,'asset_scan_events',where,args)){
   if(String(row.asset_id)!==assetId)fail('A linked activity belongs to another asset.');
   // A maintenance record may depend on a scan. Never silently orphan it.
   if((await client.query('SELECT 1 FROM asset_maintenance_records WHERE source_scan_event_id::text=$1 AND status<>\'cancelled\' LIMIT 1',[row.id])).rows.length&&table!=='asset_maintenance_records')fail('Linked maintenance must be corrected first.');
   add('asset_scan_events',row,null);
  }
 };
 const movement=async(row:Row)=>{
  assertOwner(row,ownerId,assetId);
  if(row.is_late_entry||row.linked_adjustment_event_id||!['asset_issue','stock_in','opening_balance'].includes(row.event_type))fail('This reconciled fuel movement needs a stock review before it can be retracted.');
  const stock=await read(client,'fuel_storage_units',String(row.storage_id));assertOwner(stock,ownerId);
  if((await client.query('SELECT 1 FROM fuel_storage_events WHERE storage_id=$1::uuid AND id<>$2::uuid AND created_at >= $3::timestamptz LIMIT 1',[row.storage_id,row.id,row.created_at])).rows.length)fail('Later fuel movements exist. Retract them first to preserve stock balances.');
  const litres=Number(stock.current_litres)+(row.event_type==='asset_issue'?1:-1)*Number(row.litres);
  if(!Number.isFinite(litres)||litres<0||(Number(stock.capacity_litres)>0&&litres>Number(stock.capacity_litres)))fail('The reversal would put fuel stock outside its allowed capacity.');
  add('fuel_storage_units',stock,{...stock,current_litres:Math.round(litres*1000)/1000});
  await scans('fuel_storage_event_id::text=$1',[row.id]);add('fuel_storage_events',row,null);
 };
 if(table==='asset_invoices'){
  if(root.source==='fuel_slip'||(await client.query('SELECT 1 FROM fuel_slips WHERE asset_invoice_id::text=$1 LIMIT 1',[id])).rows.length)fail('Retract the linked fuel slip so its cost and fuel records are corrected together.');
  await invoice(root);title='Retract cost';effect='This cost and its line items will stop counting towards costs, budgets and reports. The original document and history stay available.';
 }else if(table==='fuel_slips'){
  if(root.record_status==='voided'||root.voided_at)fail('This fuel slip has already been retracted.');
  const events=await related(client,'fuel_storage_events','fuel_slip_id::text=$1 OR id::text=$2',[id,String(root.fuel_storage_event_id||'')]);
  if(events.length>1)fail('This fuel slip has multiple stock movements and needs a stock review.');
  for(const event of events)await movement(event);
  await scans('fuel_slip_id::text=$1',[id]);
  if(root.asset_invoice_id){const cost=await read(client,'asset_invoices',String(root.asset_invoice_id));if(!cost||cost.source!=='fuel_slip')fail('The linked cost has changed. Review it before retracting this slip.');await invoice(cost);}
  const asset=await read(client,'asset_register_items',assetId);assertOwner(asset,ownerId);
  const specs={...asset.specs_json};
  if(specs.lastFuelSlipId===id||specs.last_fuel_slip_id===id){for(const key of Object.keys(specs))if(key.startsWith('lastFuelSlip')||key.startsWith('last_fuel_slip_'))delete specs[key];add('asset_register_items',asset,{...asset,specs_json:specs});}
  // Keep the slip and its source document, but remove its active side effects.
  add(table,root,{...root,record_status:'voided',voided_at:'2000-01-01T00:00:00.000Z',void_reason:'Retracted from asset history',asset_invoice_id:null,fuel_storage_event_id:null});
  title='Retract fuel entry';effect='This slip and its linked cost and fuel activity will leave active totals. Any eligible stock movement is reversed. Saved asset usage and fuel-level readings are kept.';
 }else if(table==='fuel_storage_events'){
  if(root.fuel_slip_id)fail('Retract the linked fuel slip so all related records stay consistent.');
  await movement(root);title='Retract fuel movement';effect='This movement and its linked activity will be removed from active records and its stock effect reversed. Saved asset usage and fuel-level readings are kept.';
 }else{
  if(root.status==='cancelled')fail('This schedule is already cancelled. Only corrections made here can be restored here.');
  const children=await related(client,table,'user_id=$1 AND generated_from_maintenance_id::text=$2 AND status<>\'cancelled\'',[ownerId,id]);
  for(const child of children){
   if(child.status!=='upcoming'||(child.updated_at!==child.created_at&&!(await client.query("SELECT 1 FROM asset_history_events WHERE owner_id=$1 AND record_table='asset_maintenance_records' AND record_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1",[ownerId,String(child.id)])).rows.length))fail('The following recurring service has been changed or completed. Correct it first.');
   if(child.updated_at!==child.created_at&&(await client.query("SELECT 1 FROM asset_history_events WHERE owner_id=$1 AND record_table='asset_maintenance_records' AND record_id=$2 AND operation='UPDATE' AND source<>'History correction' LIMIT 1",[ownerId,String(child.id)])).rows.length)fail('The following recurring service has been edited. Correct it first.');
   if((await client.query('SELECT 1 FROM asset_maintenance_records WHERE generated_from_maintenance_id=$1::uuid AND status<>\'cancelled\' LIMIT 1',[child.id])).rows.length)fail('Later recurring services exist. Correct them first.');
   add(table,child,{...child,status:'cancelled'});
  }
  if(root.status==='done'){
   if(root.source_scan_event_id)await scans('id::text=$1',[root.source_scan_event_id]);
   add(table,root,{...root,status:'upcoming',completed_at:null,completed_usage:null,completed_notes:null,completed_by:null,maintenance_work:null,source_scan_event_id:null,alert_noted_at:null});
   title='Undo completion';effect='This service returns to upcoming. Its completion activity and untouched next recurring schedule are withdrawn. Restoring brings back the same completion and schedule without duplicates.';
  }else{
   add(table,root,{...root,status:'cancelled'});title='Retract schedule';effect='This schedule stops appearing in upcoming maintenance and reminders. You can restore the same schedule from history.';
  }
 }
 return {changes,title,effect};
}

// Refuse unhandled foreign-key dependencies instead of allowing cascade or SET NULL data loss.
async function checkDependencies(client:PoolClient,changes:Change[]){
 for(const change of changes.filter(c=>c.before&&!c.after)){
  const refs=(await client.query(`SELECT c.conrelid::regclass::text AS table_name,a.attname AS column_name
   FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
   WHERE c.contype='f' AND c.confrelid=$1::regclass`,['public.'+change.table])).rows;
  for(const ref of refs){
   const name=String(ref.table_name).replace(/^public\./,'');
   if(!/^[a-z_]+$/.test(name))fail('A linked record needs review first.');
   const rows=(await client.query(`SELECT to_jsonb(r) AS data FROM public.${quote(name)} r WHERE ${quote(ref.column_name)}::text=$1 FOR UPDATE`,[change.id])).rows;
   for(const {data} of rows){
    const covered=changes.find(c=>c.table===name&&c.id===String(data.id));
    if(!covered||(covered.after&&String(covered.after[ref.column_name])===change.id))fail('A linked record depends on this item. Correct the linked record first.');
   }
  }
 }
}
async function write(client:PoolClient,change:Change,target:Row|null){
 if(!tables.has(change.table))fail('Unsupported saved correction.');
 const table=quote(change.table),current=await read(client,change.table,change.id);
 if(!target){await client.query(`DELETE FROM public.${table} WHERE id::text=$1`,[change.id]);return;}
 if('updated_at' in target)target={...target,updated_at:new Date().toISOString()};
 const keys=Object.keys(target);if(keys.some(k=>! /^[a-z_][a-z0-9_]*$/.test(k)))fail('Unsupported saved field.');
 const columns=keys.map(quote).join(',');
 if(current){const updates=keys.filter(k=>k!=='id'&&!same(current[k],target[k])).map(k=>`${quote(k)}=v.${quote(k)}`).join(',');if(!updates)return;await client.query(`UPDATE public.${table} r SET ${updates} FROM jsonb_populate_record(NULL::public.${table},$2::jsonb) v WHERE r.id::text=$1`,[change.id,JSON.stringify(target)]);}
 else await client.query(`INSERT INTO public.${table} (${columns}) SELECT ${columns} FROM jsonb_populate_record(NULL::public.${table},$1::jsonb)`,[JSON.stringify(target)]);
}
const rank:Record<string,number>={asset_register_items:0,fuel_storage_units:1,asset_scan_events:6,asset_invoices:3,asset_invoice_blocks:4,fuel_storage_events:5,asset_maintenance_records:7,fuel_slips:8};
async function apply(client:PoolClient,changes:Change[],restore:boolean){
 const target=(c:Change)=>restore?c.before:c.after;
 // Clear referencing rows first, then delete children, then restore parents before children.
 const updates=changes.filter(c=>target(c)&& (restore?c.after:c.before)&&!same(c.before,c.after));
 const deletes=changes.filter(c=>!target(c)).sort((a,b)=>rank[b.table]-rank[a.table]);
 const inserts=changes.filter(c=>target(c)&&!(restore?c.after:c.before)).sort((a,b)=>rank[a.table]-rank[b.table]);
 if(!restore){for(const c of updates)await write(client,c,target(c));for(const c of deletes)await write(client,c,null);}
 else {for(const c of inserts)await write(client,c,target(c));for(const c of updates)await write(client,c,target(c));}
}
export async function correctAssetHistoryRecord(ownerId:string,assetId:string,eventId:string,actor:{id:string;name:string},input:{action?:unknown;confirmed?:unknown;revision?:unknown;reason?:unknown}){
 await ensureAssetHistorySchema();const client=await getDb().connect();
 try{
  await client.query('BEGIN');
  // Serialize competing history corrections even when the cost row has been removed.
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[ownerId+':history:'+assetId]);
  const event=(await client.query('SELECT * FROM asset_history_events WHERE id=$1::uuid AND owner_id=$2 AND asset_id=$3::uuid',[eventId,ownerId,assetId])).rows[0];
  if(!event||!rootTables.has(event.record_table))fail('Choose a cost, fuel or maintenance entry.');
  const asset=await read(client,'asset_register_items',assetId);assertOwner(asset,ownerId);
  const receipt=(await client.query('SELECT * FROM asset_history_corrections WHERE owner_id=$1 AND asset_id=$2::uuid AND record_table=$3 AND record_id=$4 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE',[ownerId,assetId,event.record_table,event.record_id])).rows[0];
  const restore=receipt?.state==='retracted';let changes:Change[],title:string,effect:string;
  if(restore){
   changes=receipt.changes;
   for(const c of changes.filter(c=>c.table==='fuel_storage_units'))if((await client.query('SELECT 1 FROM fuel_storage_events WHERE storage_id::text=$1 AND created_at>=$2::timestamptz LIMIT 1',[c.id,receipt.created_at])).rows.length)fail('Later fuel movements exist. Review stock before restoring this item.');
   for(const c of changes)if(!same(await read(client,c.table,c.id),c.after))fail('Newer changes exist. Review the affected records before restoring this item.');
   // A different correction may have consumed a recurring schedule while this one was undone.
   if(event.record_table==='asset_maintenance_records'&&(await client.query("SELECT 1 FROM asset_maintenance_records WHERE user_id=$1 AND generated_from_maintenance_id::text=$2 AND status<>'cancelled' AND NOT (id::text=ANY($3::text[])) LIMIT 1",[ownerId,event.record_id,changes.filter(c=>c.table==='asset_maintenance_records').map(c=>c.id)])).rows.length)fail('A new recurring schedule exists. Review maintenance before restoring.');
   title=receipt.title==='Undo completion'?'Restore completion':receipt.title==='Retract schedule'?'Restore schedule':'Restore item';
   effect='The original record and its linked entries return with their original IDs and dates. Totals and reports include them again; no duplicate is created.';
  }else({changes,title,effect}=await planRetraction(client,ownerId,assetId,event.record_table,event.record_id));
  // Timestamps are assigned on commit, not during preview, so tokens remain stable.
  const token=revision({changes,restore,receipt:receipt?.id,state:receipt?.state});
  if(input.action==='previewRecordCorrection'){
   if(!restore)await checkDependencies(client,changes);
   const original=changes.find(c=>c.table===event.record_table&&c.id===event.record_id)?.before||{};
   const details=Object.fromEntries(['title','supplier_name','invoice_number','invoice_date','total_inc_vat','total_amount','litres','due_date','completed_at'].filter(k=>original[k]!=null).map(k=>[k,original[k]]));
   await client.query('ROLLBACK');return {title,effect,details,revision:token,restoring:restore};
  }
  if(input.action!=='correctRecord'||input.confirmed!==true)fail('Confirm this correction first.');
  if(input.revision!==token)fail('Newer changes exist. Close this confirmation and review the item again.');
  const reason=typeof input.reason==='string'?input.reason.trim().slice(0,500):'';
  if(!reason)fail('Enter a short reason for this correction.');
  await setAssetHistoryActor(client,actor.id,actor.name,'History correction');
  if(!restore){await checkDependencies(client,changes);for(const c of changes)if(c.after&&c.table==='fuel_slips'){c.after.voided_at=new Date().toISOString();c.after.void_reason=reason;}}
  await apply(client,changes,restore);
  if(restore)await client.query("UPDATE asset_history_corrections SET state='restored' WHERE id=$1::uuid",[receipt.id]);
  else {
   // Save database-normalized values (numeric scales and timestamps) for exact conflict checks.
   for(const c of changes)c.after=await read(client,c.table,c.id);
   await client.query("INSERT INTO asset_history_corrections(id,owner_id,asset_id,record_table,record_id,title,state,changes) VALUES($1,$2,$3,$4,$5,$6,'retracted',$7::jsonb)",[randomUUID(),ownerId,assetId,event.record_table,event.record_id,title,JSON.stringify(changes)]);
  }
  await client.query(`INSERT INTO asset_history_events(owner_id,asset_id,category,record_table,record_id,operation,actor_id,actor_name,source,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'History correction',$9::jsonb,$10::jsonb)`,[ownerId,assetId,event.category,event.record_table,event.record_id,restore?'RESTORE':'RETRACT',actor.id,actor.name,JSON.stringify({status:restore?'retracted':'active'}),JSON.stringify({status:restore?'restored':'retracted',reason})]);
  await client.query('COMMIT');return {ok:true,restoring:restore};
 }catch(e){await client.query('ROLLBACK');if(['40P01','40001'].includes((e as {code?:string}).code||''))fail('Another update is in progress. Close this confirmation and try again.');if((e as {code?:string}).code==='23503')fail('A linked record changed or is unavailable. Review it before retrying.');throw e;}finally{client.release();}
}
