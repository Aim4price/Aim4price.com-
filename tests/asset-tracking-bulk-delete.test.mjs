import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const load=file=>{const exports={};new Function('require','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(()=>({}),exports);return exports;};
const tracking=load('lib/asset-tracking-history.ts'),locations=load('lib/asset-location-history-db.ts');
const asset='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const phone='33333333-3333-4333-8333-333333333333',oldPhone='44444444-4444-4444-8444-444444444444',otherPhone='55555555-5555-4555-8555-555555555555';
const cutoff='2026-10-19T10:00:00.000Z';
test('delete all is asset/owner scoped, exceeds pagination, preserves new data and keeps the two histories independent',async()=>{
 const db=new PGlite();try{
  await db.exec(`CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text,latitude real);
   CREATE TABLE asset_scan_events(id integer PRIMARY KEY,asset_id uuid,latitude real,longitude real,activity_text text,created_at timestamptz,location_history_deleted_at timestamptz);
   CREATE TABLE asset_tracking_devices(id uuid PRIMARY KEY,asset_id uuid,owner_id text,revoked_at timestamptz);
   CREATE TABLE asset_tracking_points(device_id uuid,sample_id text,captured_at timestamptz,received_at timestamptz,accuracy real,history_deleted_at timestamptz,PRIMARY KEY(device_id,sample_id));`);
  await db.query('INSERT INTO asset_register_items VALUES ($1,\'owner\',-33),($2,\'owner\',-34)',[asset,other]);
  await db.query(`INSERT INTO asset_scan_events SELECT n,$1,-33,22,'Fuel filled','2026-10-18T00:00:00Z',NULL FROM generate_series(1,2005) n`,[asset]);
  await db.query(`INSERT INTO asset_scan_events VALUES (2006,$1,-33,22,'New activity','2026-10-19T11:00:00Z',NULL),(2007,$2,-34,23,'Other asset','2026-10-18T00:00:00Z',NULL)`,[asset,other]);
  await db.query(`INSERT INTO asset_tracking_devices VALUES ($1,$4,'owner',NULL),($2,$4,'owner',now()),($3,$5,'owner',NULL)`,[phone,oldPhone,otherPhone,asset,other]);
  await db.query(`INSERT INTO asset_tracking_points SELECT $1,n::text,'2026-10-18T00:00:00Z','2026-10-18T00:00:00Z',5,NULL FROM generate_series(1,40) n`,[phone]);
  await db.query(`INSERT INTO asset_tracking_points VALUES ($1,'old-phone','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z',90,NULL),($2,'late-upload','2026-10-17T00:00:00Z','2026-10-19T11:00:00Z',5,NULL),($3,'other','2026-10-18T00:00:00Z','2026-10-18T00:00:00Z',5,NULL)`,[oldPhone,phone,otherPhone]);
  for(const sql of [locations.DELETE_ALL_LOCATION_HISTORY_SQL,tracking.DELETE_ALL_TRACKING_HISTORY_SQL]){
   assert.equal((await db.query(sql,['stranger',asset,cutoff])).affectedRows,0);
   assert.equal((await db.query(sql,['owner',phone,cutoff])).affectedRows,0);
  }
  assert.equal((await db.query(locations.DELETE_ALL_LOCATION_HISTORY_SQL,['owner',asset,cutoff])).affectedRows,2005);
  assert.equal((await db.query('SELECT count(*)::int n FROM asset_tracking_points WHERE history_deleted_at IS NULL')).rows[0].n,43,'saved-location deletion leaves tracking untouched');
  assert.equal((await db.query(tracking.DELETE_ALL_TRACKING_HISTORY_SQL,['owner',asset,cutoff])).affectedRows,41,'includes disconnected phones and poor fixes');
  assert.deepEqual((await db.query('SELECT sample_id FROM asset_tracking_points WHERE history_deleted_at IS NULL ORDER BY sample_id')).rows.map(r=>r.sample_id),['late-upload','other']);
  assert.deepEqual((await db.query('SELECT id FROM asset_scan_events WHERE location_history_deleted_at IS NULL ORDER BY id')).rows.map(r=>r.id),[2006,2007]);
  assert.equal((await db.query('SELECT count(*)::int n FROM asset_scan_events WHERE activity_text=\'Fuel filled\'')).rows[0].n,2005,'underlying activity remains');
  assert.equal((await db.query('SELECT latitude FROM asset_register_items WHERE id=$1',[asset])).rows[0].latitude,-33);
  assert.equal((await db.query('SELECT count(*)::int n FROM asset_tracking_devices')).rows[0].n,3,'phone connections are retained');
  for(const sql of [locations.DELETE_ALL_LOCATION_HISTORY_SQL,tracking.DELETE_ALL_TRACKING_HISTORY_SQL])assert.equal((await db.query(sql,['owner',asset,cutoff])).affectedRows,0,'repeated deletion is safe');
  await db.query(`INSERT INTO asset_tracking_points VALUES ($1,'1',now(),now(),5,NULL) ON CONFLICT DO NOTHING`,[phone]);
  assert.equal((await db.query(`SELECT count(*)::int n FROM asset_tracking_points WHERE sample_id='1' AND history_deleted_at IS NULL`)).rows[0].n,0,'upload retry cannot restore deleted history');
 }finally{await db.close();}
});
