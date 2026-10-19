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
 [prefix+'asset-tracking']:{ensureTrackingTables:async()=>{}},[prefix+'asset-tracking-math']:{summarizeTracking:p=>({readings:p})},[prefix+'asset-movement-report']:{},[prefix+'asset-tracking-history']:lib,[prefix+'asset-tracking-journeys']:load('lib/asset-tracking-journeys.ts',{'./asset-tracking-math':load('lib/asset-tracking-math.ts')}),[prefix+'db']:{getDb:()=>({query:async()=>{calls++;return {rowCount:1,rows:[]};}})}
 });
 const req=q=>({nextUrl:new URL('https://www.aim4price.com/api/history?'+q)}),ctx={params:{assetId:asset}},valid='day=2026-10-19&snapshotAt=2026-10-19T00:00:00.000Z';
 allowed=false;assert.equal((await route.DELETE(req(valid),ctx)).status,403);allowed=true;
 for(const q of ['day=2026-02-30','day=2026-10-19','day=2026-10-19&snapshotAt=2099-01-01T00:00:00.000Z'])assert.equal((await route.DELETE(req(q),ctx)).status,400);
 assert.equal(calls,0);assert.equal((await route.DELETE(req(valid),ctx)).status,200);assert.equal(calls,1);
 assert.equal((await route.GET(req('view=entries&from=2026-02-30'),ctx)).status,400);
 assert.equal((await route.GET(req('view=entries&from=2026-10-19&to=2026-10-18'),ctx)).status,400);
 const source=readFileSync('app/api/asset-register/[assetId]/tracking/history/route.ts','utf8');assert.match(source,/p\.history_deleted_at IS NULL/);
});
test('sessions remain separate on the same day, survive midnight, paginate ties and delete only the selected snapshot',async()=>{
 const db=new PGlite();
 const session='44444444-4444-4444-8444-444444444444',second='55555555-5555-4555-8555-555555555555';
 try{
 await db.exec('CREATE TABLE asset_tracking_devices(id uuid PRIMARY KEY,asset_id uuid,owner_id text);CREATE TABLE asset_tracking_points(device_id uuid,session_id uuid,sample_id text,captured_at timestamptz,received_at timestamptz,accuracy real,history_deleted_at timestamptz,latitude real DEFAULT 0,longitude real DEFAULT 0);');
 await db.query('INSERT INTO asset_tracking_devices VALUES($1,$2,$3),($4,$2,$3)',[device,asset,'owner',other]);
 const add=(dev,sid,id,at,received='2026-10-19T12:00:00Z')=>db.query('INSERT INTO asset_tracking_points(device_id,session_id,sample_id,captured_at,received_at,accuracy,history_deleted_at) VALUES($1,$2,$3,$4,$5,5,NULL)',[dev,sid,id,at,received]);
 await add(device,session,'before-midnight','2026-10-18T21:50:00Z');
 await add(device,session,'after-midnight','2026-10-18T22:10:00Z');
 await add(device,second,'morning','2026-10-19T08:00:00Z');
 await add(other,second,'other-phone','2026-10-19T08:00:00Z');
 await add(device,second,'late','2026-10-19T08:01:00Z','2026-10-19T14:00:00Z');
 const snapshot='2026-10-19T13:00:00.000Z';
 const args=['owner',asset,null,null,null,snapshot];
 const rows=(await db.query(lib.TRACKING_HISTORY_SESSIONS_SQL,args)).rows;
 assert.equal(rows.length,3);
 assert.deepEqual(rows.map(r=>r.readings),[1,1,2]);
 assert.equal(rows[2].day,'2026-10-18');assert.equal(rows[2].end_day,'2026-10-19');
 const cursor=[new Date(rows[0].last_captured_at).toISOString(),rows[0].device_id,rows[0].session_id].join('|');
 assert.equal(lib.validSessionCursor(cursor),true);
 assert.equal(lib.validSessionCursor(cursor+'|extra'),false);
 const next=(await db.query(lib.TRACKING_HISTORY_SESSIONS_SQL,['owner',asset,null,null,cursor,snapshot])).rows;
 assert.equal(next.length,2);assert.equal(next[0].device_id,device);
 assert.equal((await db.query(lib.TRACKING_HISTORY_SESSIONS_SQL,['stranger',asset,null,null,null,snapshot])).rows.length,0);
 const filtered=(await db.query(lib.TRACKING_HISTORY_SESSIONS_SQL,['owner',asset,'2026-10-19','2026-10-19',null,snapshot])).rows;
 assert.equal(filtered[2].readings,1);

 class Response{constructor(body,options){this.body=body;this.status=options?.status||200;}}
 const prefix='../../../../../../lib/';
 const route=load('app/api/asset-register/[assetId]/tracking/history/route.ts',{
 'next/server':{NextResponse:Response},[prefix+'asset-tracking-api']:{trackingOwner:async()=>({ownerId:'owner',asset:{title:'Tractor'}}),trackingJson:(body,status)=>new Response(body,{status})},
 [prefix+'asset-tracking']:{ensureTrackingTables:async()=>{}},[prefix+'asset-tracking-math']:load('lib/asset-tracking-math.ts'),
 [prefix+'asset-movement-report']:{buildMovementWorkbook:r=>r},[prefix+'asset-tracking-history']:lib,[prefix+'asset-tracking-journeys']:load('lib/asset-tracking-journeys.ts',{'./asset-tracking-math':load('lib/asset-tracking-math.ts')}),
 [prefix+'db']:{getDb:()=>({query:async(sql,args)=>{const r=await db.query(sql,args);return {...r,rowCount:r.rows.length};}})}
 });
 const query=new URLSearchParams({from:'2026-10-19',to:'2026-10-19',deviceId:device,sessionId:second,snapshotAt:snapshot});
 for(const format of ['', 'xlsx']){
   query.set('format',format);
   const response=await route.GET({nextUrl:new URL('https://example.test/history?'+query)},{params:{assetId:asset}});
   assert.equal(response.status,200);
   assert.equal(response.body.readings.length,1,'route and download include only the selected phone/session snapshot');
   assert.equal(response.body.readings[0].sessionId,second);
   assert.equal(response.body.readings[0].deviceId,device);
 }

 const bounded=new URLSearchParams({from:'2026-10-18',to:'2026-10-19',deviceId:device,sessionId:session,snapshotAt:snapshot,startAt:'2026-10-18T21:50:00.000Z',endAt:'2026-10-18T21:50:00.000Z'});
 const boundedReport=await route.GET({nextUrl:new URL('https://example.test/history?'+bounded)},{params:{assetId:asset}});
 assert.equal(boundedReport.body.readings.length,1,'journey route uses exact capture bounds within an activation');
 const removed=await route.DELETE({nextUrl:new URL('https://example.test/history?'+bounded)},{params:{assetId:asset}});
 assert.equal(removed.status,200);
 assert.equal((await db.query("SELECT count(*)::integer AS n FROM asset_tracking_points WHERE sample_id='after-midnight' AND history_deleted_at IS NULL")).rows[0].n,1,'deleting one journey preserves another in the same activation');
 const journeyPage=await route.GET({nextUrl:new URL('https://example.test/history?'+new URLSearchParams({view:'journeys',from:'2026-10-18',to:'2026-10-19',snapshotAt:snapshot}))},{params:{assetId:asset}});
 assert.equal(journeyPage.status,200);
 assert.equal(journeyPage.body.items.length,3);
 assert(journeyPage.body.items.every(e=>e.startAt&&e.endAt&&e.id&&e.kind));
 const del=['owner',asset,device,second,'2026-10-19','2026-10-19',snapshot];
 assert.equal((await db.query(lib.DELETE_TRACKING_SESSION_SQL,['stranger',...del.slice(1)])).rows.length,0);
 assert.equal((await db.query(lib.DELETE_TRACKING_SESSION_SQL,del)).rows.length,1);
 const remaining=(await db.query('SELECT sample_id FROM asset_tracking_points WHERE history_deleted_at IS NULL ORDER BY sample_id')).rows.map(r=>r.sample_id);
 assert.deepEqual(remaining,['after-midnight','late','other-phone']);
 }finally{await db.close();}
});
