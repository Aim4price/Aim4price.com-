import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const source=readFileSync(new URL('../lib/maintenance-asset-lifecycle.ts',import.meta.url),'utf8');
const sql=source.match(/maintenanceAssetLifecycleSql = `([\s\S]*?)`;/)[1];

test('removal cancels upcoming work, retains history, and register moves keep schedules',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create table asset_register_items(id uuid primary key,user_id text,lifecycle_state text,register_id text);
 create table asset_maintenance_records(id int primary key,user_id text,asset_register_item_id uuid,status text,recurring_enabled boolean,updated_at timestamptz);
 insert into asset_register_items values ('00000000-0000-0000-0000-000000000001','owner','active','a'),('00000000-0000-0000-0000-000000000002','owner','disposed','a');
 insert into asset_maintenance_records values (1,'owner','00000000-0000-0000-0000-000000000001','upcoming',true,now()),(2,'owner','00000000-0000-0000-0000-000000000001','done',true,now()),(3,'owner','00000000-0000-0000-0000-000000000002','upcoming',true,now()),(4,'owner','00000000-0000-0000-0000-000000000099','upcoming',true,now());`);
 await db.exec(sql);
 const read=async id=>(await db.query('select status,recurring_enabled from asset_maintenance_records where id=$1',[id])).rows[0];
 assert.equal((await read(3)).status,'cancelled');assert.equal((await read(4)).status,'cancelled');
 await db.exec("update asset_register_items set register_id='b' where id='00000000-0000-0000-0000-000000000001'");
 assert.equal((await read(1)).status,'upcoming');
 await db.exec("update asset_register_items set lifecycle_state='archived' where id='00000000-0000-0000-0000-000000000001'");
 assert.deepEqual(await read(1),{status:'cancelled',recurring_enabled:false});
 assert.deepEqual(await read(2),{status:'done',recurring_enabled:true});
 await db.exec("update asset_register_items set lifecycle_state='active' where id='00000000-0000-0000-0000-000000000001'");
 assert.equal((await read(1)).status,'cancelled');
 await db.exec(sql); // Idempotent installation and cleanup.
 assert.equal((await read(2)).status,'done');
 await db.exec("insert into asset_maintenance_records values (5,'owner','00000000-0000-0000-0000-000000000001','upcoming',true,now());update asset_register_items set user_id='buyer' where id='00000000-0000-0000-0000-000000000001'");
 assert.deepEqual(await read(5),{status:'cancelled',recurring_enabled:false});
 } finally {await db.close();}
});
