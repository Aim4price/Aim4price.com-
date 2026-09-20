const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
// Execute the production completion function with a deterministic transaction boundary.
function completion({prior=null,status='done',receipt=false}={}) {
  const file=ts.createSourceFile('maintenance.ts',fs.readFileSync('lib/asset-maintenance.ts','utf8'),ts.ScriptTarget.Latest,true);
  const fn=file.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='completeAssetMaintenanceRecord');
  const queries=[];
  const client={release(){},async query(sql,values){queries.push(sql);if(sql.includes('select maintenance_id::text'))return {rows:prior?[{maintenance_id:prior}]:[],rowCount:prior?1:0};if(sql.includes('select 1 from public.app_offline_completions'))return {rows:[],rowCount:receipt?1:0};return {rows:[],rowCount:0};}};
  const mocks={ensureAssetMaintenanceTables:async()=>{},getDb:()=>({query:async()=>({rows:[]}),connect:async()=>client}),getAssetMaintenanceRecordByIdWithClient:async()=>({id:'task',assetId:'asset',status,maintenanceType:'service'}),asText:v=>String(v||''),createNextRecurringRecord:async()=>null};
  const module={exports:{}};const js=ts.transpileModule(fn.getText(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  Function('exports',...Object.keys(mocks),js)(module.exports,...Object.values(mocks));return {save:module.exports.completeAssetMaintenanceRecord,queries};
}
const key='a'.repeat(64);
test('retry of an already-confirmed dealer completion returns success without a second update',async()=>{
  const {save,queries}=completion({prior:'task',receipt:true});
  const r=await save('owner','task',{offlineEventId:key},{assetId:'asset'});
  assert.equal(r.completed.status,'done');assert.equal(queries.some(q=>q.includes('update public.asset_maintenance_records')),false);assert.ok(queries.includes('commit'));
});
test('a task completed elsewhere is a conflict, not a false confirmation of offline work',async()=>{
  const {save,queries}=completion();await assert.rejects(save('owner','task',{offlineEventId:key},{assetId:'asset'}),/COMPLETION_ALREADY_RECORDED/);assert.ok(queries.includes('rollback'));
});
test('reusing an event ID for another maintenance task cannot change that task',async()=>{
  const {save,queries}=completion({prior:'different-task',status:'upcoming'});await assert.rejects(save('owner','task',{offlineEventId:key},{assetId:'asset'}),/COMPLETION_EVENT_REUSED/);assert.ok(queries.includes('rollback'));assert.equal(queries.some(q=>q.includes('update public.asset_maintenance_records')),false);
});
