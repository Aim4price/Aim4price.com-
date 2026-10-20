import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const source=readFileSync(new URL('../lib/asset-location-history-db.ts',import.meta.url),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const load=(s,mocks)=>{const exports={};new Function('require','exports',compile(s))(name=>{if(!(name in mocks))throw Error(name);return mocks[name];},exports);return exports;};
const lib=load(source,{'./db':{},'./fuel-ledger':{}});
const asset='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',entry='33333333-3333-4333-8333-333333333333';
test('location deletion is owner/asset scoped and preserves the underlying activity',async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text); CREATE TABLE asset_scan_events(id uuid PRIMARY KEY,asset_id uuid,latitude double precision,longitude double precision,activity_text text,location_history_deleted_at timestamptz);');
 await db.query('INSERT INTO asset_register_items VALUES ($1,$2),($3,$2)',[asset,'owner',other]);
 await db.query('INSERT INTO asset_scan_events(id,asset_id,latitude,longitude,activity_text) VALUES ($1,$2,-33,22,\'Fuel filled\')',[entry,asset]);
 assert.equal((await db.query(lib.DELETE_LOCATION_HISTORY_SQL,['stranger',asset,entry])).rows.length,0);
 assert.equal((await db.query(lib.DELETE_LOCATION_HISTORY_SQL,['owner',other,entry])).rows.length,0);
 assert.equal((await db.query(lib.DELETE_LOCATION_HISTORY_SQL,['owner',asset,entry])).rows.length,1);
 assert.equal((await db.query(lib.DELETE_LOCATION_HISTORY_SQL,['owner',asset,entry])).rows.length,0);
 const row=(await db.query('SELECT * FROM asset_scan_events')).rows[0];assert.equal(row.activity_text,'Fuel filled');assert.equal(row.latitude,-33);assert.ok(row.location_history_deleted_at);
 assert.equal((await db.query('SELECT id FROM asset_scan_events WHERE location_history_deleted_at IS NULL')).rows.length,0);
 }finally{await db.close();}
});
const routeSource=readFileSync(new URL('../app/api/asset-register/[assetId]/locations/route.ts',import.meta.url),'utf8');
test('delete API rejects untrusted origins, missing sessions, inaccessible assets and malformed IDs',async()=>{
 let session={user:{id:'owner'}},allowed=true,found=true,calls=0;
 const route=load(routeSource,{
 'next/server':{NextResponse:{}},
 '../../../../../lib/auth-session':{getServerSession:async()=>session},
 '../../../../../lib/asset-register-account-access':{getAssetRegisterAccountAccess:async()=>allowed},
 '../../../../../lib/asset-register-db':{getAssetRegisterItemById:async()=>found?{id:asset}:null},
 '../../../../../lib/db':{},
 '../../../../../lib/asset-tracking-history':load(readFileSync('lib/asset-tracking-history.ts','utf8'),{}),
 '../../../../../lib/asset-location-history-db':{deleteLocationHistoryEntry:async()=>{calls++;return true;},deleteAllLocationHistory:async(owner,id,snapshot)=>{assert.equal(owner,'owner');assert.equal(id,asset);assert.equal(snapshot,'2026-10-19T00:00:00.000Z');calls++;return 2005;}},
 '../../../../../lib/trusted-request-origin':{isTrustedRequestOrigin:(o)=>o==='https://www.aim4price.com'},
 '../../../../../lib/business-network-api':{businessJson:(body,status=200)=>({body,status}),businessError:()=>({status:500})},
 });
 const req=(origin='https://www.aim4price.com',id=entry)=>({headers:new Headers({origin}),nextUrl:new URL('https://www.aim4price.com/api/location?entryId='+id)});
 const context={params:{assetId:asset}};
 assert.equal((await route.DELETE(req('https://evil.example'),context)).status,403);
 session=null;assert.equal((await route.DELETE(req(),context)).status,403);session={user:{id:'owner'}};
 allowed=false;assert.equal((await route.DELETE(req(),context)).status,403);allowed=true;
 found=false;assert.equal((await route.DELETE(req(),context)).status,404);found=true;
 assert.equal((await route.DELETE(req(undefined,'bad'),context)).status,400);assert.equal(calls,0);
 assert.equal((await route.DELETE(req(),context)).status,200);assert.equal(calls,1);
 const bulk=q=>({headers:new Headers({origin:'https://www.aim4price.com'}),nextUrl:new URL('https://www.aim4price.com/api/location?'+q)});
 for(const q of ['scope=all','scope=unknown','scope=all&snapshotAt=2099-01-01T00:00:00.000Z','scope=all&snapshotAt=2026-10-19T00:00:00.000Z&entryId='+entry,'scope=all&snapshotAt=2026-10-19T00:00:00.000Z&from=2026-10-19'])assert.equal((await route.DELETE(bulk(q),context)).status,400);
 assert.equal(calls,1);
 const all=bulk('scope=all&snapshotAt=2026-10-19T00:00:00.000Z');
 session=null;assert.equal((await route.DELETE(all,context)).status,403);session={user:{id:'owner'}};
 found=false;assert.equal((await route.DELETE(all,context)).status,404);found=true;
 all.headers.set('origin','https://evil.example');assert.equal((await route.DELETE(all,context)).status,403);all.headers.set('origin','https://www.aim4price.com');
 const response=await route.DELETE(all,context);assert.equal(response.status,200);assert.equal(response.body.deleted,2005);assert.equal(calls,2);
 assert.match(routeSource,/e\.location_history_deleted_at IS NULL/);
});
