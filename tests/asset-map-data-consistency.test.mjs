import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(source,mocks={}){const exports={};new Function('require','exports',compile(source))(name=>{if(!(name in mocks))throw Error(name);return mocks[name];},exports);return exports;}
const usage=load(read('lib/asset-usage.ts'));
const api=read('app/api/asset-map/route.ts');
const helpers=api.slice(api.indexOf('function readUsageMetric'),api.indexOf('function mapAssetForMap'));
const mapUsage=new Function('resolveAssetUsage','formatResolvedAssetUsage',compile(helpers)+';return item=>({metric:readUsageMetric(item),display:formatUsageDisplay(item)});')(usage.resolveAssetUsage,usage.formatResolvedAssetUsage);
const report=read('app/api/asset-map/report/route.ts');
const reportUsage=new Function('resolveAssetUsage','formatResolvedAssetUsage',compile(report.slice(report.indexOf('function formatUsage('),report.indexOf('function assetTypeLabel')))+';return formatUsage;')(usage.resolveAssetUsage,usage.formatResolvedAssetUsage);
const client=read('app/asset-map/asset-map-client.tsx');
const display=new Function(compile(client.slice(client.indexOf('function buildUsageDisplay'),client.indexOf('function buildUsageMeta')))+';return buildUsageDisplay;')();
test('map follows the register usage basis and never revives a stale meter',()=>{
 const cases=[
  [{kind:'vehicle',hours:0,lifeWorkedPercent:35.5,specsJson:{usageBasis:'percentage'}},'percentage','35,5%'],
  [{kind:'vehicle',hours:123456,lifeWorkedPercent:25,specsJson:{usageBasis:'percentage'}},'percentage','25%'],
  [{kind:'equipment',hours:0,lifeWorkedPercent:40,specsJson:{usageMetricType:'wear_class',usageBasis:'reading'}},'percentage','40%'],
  [{kind:'vehicle',hours:0,specsJson:{}},'km','Usage unknown'],
  [{kind:'tractor',hours:null,specsJson:{}},'hours','Usage unknown'],
  [{kind:'vehicle',hours:0,specsJson:{usageBasis:'reading',usageTypeConfirmed:true}},'km','0 km'],
  [{kind:'vehicle',hours:0,specsJson:{usageBasis:'reading',usageAmount:120572}},'km','120\u00a0572 km'],
  [{kind:'vehicle',hours:900,specsJson:{usageBasis:'not_applicable'}},'not_applicable',''],
  [{kind:'property',hours:0,specsJson:{}},'not_applicable',''],
  [{kind:'tractor',hours:60,specsJson:{usageBasis:'reading',usageMetric:'hours',trackingUsage:{metric:'hours',estimated:true}}},'hours','60 hours · Estimated'],
 ];
 for(const [asset,metric,expected] of cases){const actual=mapUsage(asset);assert.equal(actual.metric,metric);assert.equal(actual.display,expected);assert.equal(reportUsage(asset),expected);assert.equal(display({usageMetric:metric,usageDisplay:actual.display,hours:999}),expected);}
 assert.equal(display({usageMetric:'not_applicable',usageDisplay:'999 km',hours:999}),'');
 assert.equal(display({usageMetric:'km',usageDisplay:'',hours:0}),'Usage unknown');
 assert.match(client,/usageText \? <span>\{usageText\}<\/span> : null/);
 assert.match(client,/buildUsageDisplay\(selectedAsset\) \? <span/);
});
const asset='11111111-1111-4111-8111-111111111111';
const older='22222222-2222-4222-8222-222222222222';
const latest='33333333-3333-4333-8333-333333333333';
async function fixture(run){const db=new PGlite();try{
 await db.exec(`CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text,last_known_lat double precision,last_known_lng double precision,last_known_location_text text,last_scanned_at timestamptz,updated_at timestamptz);
 CREATE TABLE asset_scan_events(id uuid PRIMARY KEY,asset_id uuid,latitude double precision,longitude double precision,location_text text,created_at timestamptz,client_captured_at timestamptz,activity_text text,location_history_deleted_at timestamptz);`);
 await db.query(`INSERT INTO asset_register_items VALUES ($1,'owner',-34,23,'New yard','2026-11-15T10:00:00Z',now())`,[asset]);
 await db.query(`INSERT INTO asset_scan_events VALUES ($1,$3,-33,22,'Old shed','2026-11-14T10:01:00Z','2026-11-14T10:00:00Z','Fuel filled',NULL),($2,$3,-34,23,'New yard','2026-11-15T10:01:00Z','2026-11-15T10:00:00Z','Manual location',NULL)`,[older,latest,asset]);
 const pool={query:(...a)=>db.query(...a),connect:async()=>({query:(...a)=>db.query(...a),release(){}})};
 const lib=load(read('lib/asset-location-history-db.ts'),{'./db':{getDb:()=>pool},'./fuel-ledger':{ensureFuelLedgerTables:async()=>{}}});
 await run(db,lib,pool);
 }finally{await db.close();}}
test('deleting the latest pin restores previous coordinates, note and captured time; deleting the last clears it',()=>fixture(async(db,lib)=>{
 assert.equal(await lib.deleteLocationHistoryEntry('owner',asset,latest),true);
 let row=(await db.query('SELECT * FROM asset_register_items')).rows[0];assert.equal(row.last_known_lat,-33);assert.equal(row.last_known_lng,22);assert.equal(row.last_known_location_text,'Old shed');assert.equal(row.last_scanned_at.toISOString(),'2026-11-14T10:00:00.000Z');
 assert.equal(await lib.deleteLocationHistoryEntry('owner',asset,latest),false);
 assert.equal(await lib.deleteLocationHistoryEntry('owner',asset,older),true);
 row=(await db.query('SELECT * FROM asset_register_items')).rows[0];assert.equal(row.last_known_lat,null);assert.equal(row.last_known_lng,null);assert.equal(row.last_known_location_text,null);
 assert.equal((await db.query('SELECT count(*)::int n FROM asset_scan_events')).rows[0].n,2,'Activity records are retained');
}));
test('older or unauthorized deletion cannot move the current pin',()=>fixture(async(db,lib)=>{
 assert.equal(await lib.deleteLocationHistoryEntry('stranger',asset,latest),false);
 assert.equal(await lib.deleteLocationHistoryEntry('owner',asset,older),true);
 assert.equal((await db.query('SELECT last_known_lat FROM asset_register_items')).rows[0].last_known_lat,-34);
}));
test('a newer separately saved position is not overwritten by history deletion',()=>fixture(async(db,lib)=>{
 await db.query('UPDATE asset_register_items SET last_known_lat=-35,last_known_lng=24');
 await lib.deleteLocationHistoryEntry('owner',asset,latest);
 assert.equal((await db.query('SELECT last_known_lat FROM asset_register_items')).rows[0].last_known_lat,-35);
}));
test('failed pin restoration rolls back the history deletion too',()=>fixture(async(db,lib,pool)=>{
 const connect=pool.connect;pool.connect=async()=>{const c=await connect();return {...c,query:(sql,...args)=>{if(sql===lib.RESTORE_PREVIOUS_LOCATION_SQL)throw Error('fixture failure');return c.query(sql,...args);}}};
 await assert.rejects(()=>lib.deleteLocationHistoryEntry('owner',asset,latest),/fixture failure/);
 assert.equal((await db.query('SELECT location_history_deleted_at FROM asset_scan_events WHERE id=$1',[latest])).rows[0].location_history_deleted_at,null);
}));
