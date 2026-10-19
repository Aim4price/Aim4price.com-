import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const load=(file,mocks={})=>{const exports={};new Function('require','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(!(name in mocks))throw Error(name);return mocks[name];},exports);return exports;};
const lib=load('lib/asset-tracking-history.ts');
const asset='11111111-1111-4111-8111-111111111111',device='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
test('daily history sorts by SAST capture day, paginates, and deletes only the owner snapshot without touching current position',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE TABLE asset_tracking_devices(id uuid PRIMARY KEY,asset_id uuid,owner_id text);CREATE TABLE asset_tracking_points(device_id uuid,sample_id text,captured_at timestamptz,received_at timestamptz,accuracy real,history_deleted_at timestamptz,PRIMARY KEY(device_id,sample_id));`);
 await db.query('INSERT INTO asset_tracking_devices VALUES ($1,$2,$3),($4,$2,$5)',[device,asset,'owner',other,'stranger']);
 const add=async(id,capture,received='2026-10-19T10:00:00Z',dev=device)=>db.query('INSERT INTO asset_tracking_points VALUES ($1,$2,$3,$4,5,NULL)',[dev,id,capture,received]);
 await add('older','2026-10-18T21:59:00Z');await add('midnight','2026-10-18T22:00:00Z');await add('latest','2026-10-19T08:00:00Z');await add('late-upload','2026-10-19T07:00:00Z','2026-10-19T12:00:00Z');await add('other-owner','2026-10-19T08:00:00Z',undefined,other);
 const args=['owner',asset,null,null,null,'2026-10-19T11:00:00Z'];
 const rows=(await db.query(lib.TRACKING_HISTORY_DAYS_SQL,args)).rows;
 assert.deepEqual(rows.map(r=>[r.day,r.readings]),[['2026-10-19',2],['2026-10-18',1]]);
 assert.deepEqual((await db.query(lib.TRACKING_HISTORY_DAYS_SQL,['owner',asset,null,null,'2026-10-19',args[5]])).rows.map(r=>r.day),['2026-10-18']);
 assert.deepEqual((await db.query(lib.TRACKING_HISTORY_DAYS_SQL,['owner',asset,'2026-10-19','2026-10-19',null,args[5]])).rows.map(r=>r.readings),[2]);
 assert.equal((await db.query(lib.DELETE_TRACKING_DAY_SQL,['unknown',asset,'2026-10-19',args[5]])).rows.length,0);
 assert.equal((await db.query(lib.DELETE_TRACKING_DAY_SQL,['owner',other,'2026-10-19',args[5]])).rows.length,0);
 assert.equal((await db.query(lib.DELETE_TRACKING_DAY_SQL,['owner',asset,'2026-10-19',args[5]])).rows.length,2);
 assert.equal((await db.query(lib.DELETE_TRACKING_DAY_SQL,['owner',asset,'2026-10-19',args[5]])).rows.length,0);
 assert.deepEqual((await db.query(lib.TRACKING_HISTORY_DAYS_SQL,args)).rows.map(r=>r.day),['2026-10-18']);
 assert.equal((await db.query(lib.TRACKING_HISTORY_DAYS_SQL,['owner',asset,null,null,null,'2026-10-19T13:00:00Z'])).rows[0].readings,1);
 const all=(await db.query('SELECT * FROM asset_tracking_points')).rows;
 assert.equal(all.length,5);assert.equal(all.find(r=>r.sample_id==='other-owner').history_deleted_at,null);assert.equal(all.find(r=>r.sample_id==='late-upload').history_deleted_at,null);
 await db.query("INSERT INTO asset_tracking_points(device_id,sample_id,captured_at,received_at,accuracy) VALUES($1,'latest',now(),now(),5) ON CONFLICT DO NOTHING",[device]);
 assert.equal((await db.query('SELECT * FROM asset_tracking_points WHERE history_deleted_at IS NULL AND sample_id=\'latest\'')).rows.length,0);
 // Existing current-position query intentionally sees the retained latest GPS point.
 assert.equal((await db.query('SELECT sample_id FROM asset_tracking_points WHERE device_id=$1 ORDER BY captured_at DESC LIMIT 1',[device])).rows[0].sample_id,'latest');
 }finally{await db.close();}
});
test('tracking history API validates dates, snapshots and access before mutation',async()=>{
 class Response{constructor(body,status=200){this.body=body;this.status=status;}}
 let allowed=true,calls=0;const prefix='../../../../../../lib/';
 const route=load('app/api/asset-register/[assetId]/tracking/history/route.ts',{
 'next/server':{NextResponse:Response},[prefix+'asset-tracking-api']:{trackingOwner:async()=>allowed?{ownerId:'owner',asset:{title:'Tractor'}}:new Response({},403),trackingJson:(body,status)=>new Response(body,status)},
 [prefix+'asset-tracking']:{ensureTrackingTables:async()=>{}},[prefix+'asset-tracking-math']:{summarizeTracking:p=>({readings:p})},[prefix+'asset-movement-report']:{},[prefix+'asset-tracking-history']:lib,[prefix+'db']:{getDb:()=>({query:async()=>{calls++;return {rowCount:1,rows:[]};}})}
 });
 const req=q=>({nextUrl:new URL('https://www.aim4price.com/api/history?'+q)}),ctx={params:{assetId:asset}},valid='day=2026-10-19&snapshotAt=2026-10-19T00:00:00.000Z';
 allowed=false;assert.equal((await route.DELETE(req(valid),ctx)).status,403);allowed=true;
 for(const q of ['day=2026-02-30','day=2026-10-19','day=2026-10-19&snapshotAt=2099-01-01T00:00:00.000Z'])assert.equal((await route.DELETE(req(q),ctx)).status,400);
 assert.equal(calls,0);assert.equal((await route.DELETE(req(valid),ctx)).status,200);assert.equal(calls,1);
 assert.equal((await route.GET(req('view=entries&from=2026-02-30'),ctx)).status,400);
 assert.equal((await route.GET(req('view=entries&from=2026-10-19&to=2026-10-18'),ctx)).status,400);
 const source=readFileSync('app/api/asset-register/[assetId]/tracking/history/route.ts','utf8');assert.match(source,/p\.history_deleted_at IS NULL/);
});
