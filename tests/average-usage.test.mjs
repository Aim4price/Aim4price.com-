import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {trackingRuntimeModule} from './helpers/tracking-runtime.mjs';
const math=await import(trackingRuntimeModule('average-usage-math','__averageDb'));
const db=new PGlite();
await db.exec(`CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text,title text,hours numeric(14,2),kind text,specs_json jsonb DEFAULT '{}',updated_at timestamptz DEFAULT now());`);
const adapter={query:async(q,args)=>{if(!args&&q.includes('CREATE TABLE')){await db.exec(q);return{rows:[]};}return db.query(q,args);}};
globalThis.__averageDb=adapter;
const schema=await import(trackingRuntimeModule('asset-tracking-usage-schema','__averageDb'));
await db.exec(schema.TRACKING_USAGE_SCHEMA);
const api=await import(trackingRuntimeModule('average-usage','__averageDb'));
const tracking=await import(trackingRuntimeModule('asset-tracking-usage','__averageDb'));
async function fixture(metric='km') {const id=crypto.randomUUID();await db.query("INSERT INTO asset_register_items(id,user_id,hours,kind,specs_json) VALUES($1,'owner',90000,'vehicle',$2)",[id,JSON.stringify({usageMode:metric})]);return id;}
async function tx(fn){await db.exec('BEGIN');try{const r=await fn();await db.exec('COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}
const input={action:'enable',reading:90000,readingDate:'2026-01-05',dailyUsage:100,workingDays:[1,2,3,4,5]};
async function config(id,patch={}){return tx(()=>api.configureAverageUsage(adapter,'owner',id,{...input,...patch}));}
async function status(id,owner='owner'){return tracking.trackingUsageStatus(adapter,owner,id);}

test('20,000 km at 100 per weekday takes 200 working days / 280 calendar days',()=>{assert.equal(math.workingDaysBetween('2026-01-05','2026-10-12',[1,2,3,4,5]),200);assert.equal(math.estimatedServiceDate(90000,110000,100,[1,2,3,4,5],'2026-01-05'),'2026-10-10');assert.equal(math.estimatedAverageUsage(90000,'2026-01-05',100,[1,2,3,4,5],'2026-01-12'),90500);});
test('South African midnight, weekends, leap days and age suggestion',()=>{assert.equal(math.usageToday(new Date('2026-01-04T22:00:00Z')),'2026-01-05');assert.equal(math.workingDaysBetween('2024-02-28','2024-03-01',[0,1,2,3,4,5,6]),2);assert.equal(math.workingDaysBetween('2026-01-10','2026-01-12',[1,2,3,4,5]),0);assert.equal(math.suggestedDailyUsage(500,'2026-01-05','2026-01-12',[1,2,3,4,5]),100);assert.equal(math.suggestedDailyUsage(100,'2026-01-05','2026-01-05',[1]),null);assert.equal(math.validUsageDate('2026-02-30','2026-12-01'),false);assert.equal(math.validUsageDate('2027-01-01','2026-12-01'),false);});
test('off by default; cannot enable unsupported metrics or invalid inputs',async()=>{const id=await fixture();assert.equal((await status(id)).enabled,false);await tx(()=>api.refreshAverageUsage(adapter,'owner',id));assert.equal((await status(id)).reading,90000);for(const patch of [{dailyUsage:0},{dailyUsage:Infinity},{reading:-1},{workingDays:[]},{workingDays:[1,1]},{workingDays:[7]},{readingDate:'2099-01-01'},{reading:null}])await assert.rejects(config(id,patch));for(const metric of ['percentage','not_applicable'])await assert.rejects(config(await fixture(metric)),/only available/);await assert.rejects(config(await fixture('hours'),{dailyUsage:25}),/24 hours/);});
test('calendar projection is idempotent and catches up missed days',async()=>{const id=await fixture();await config(id);await tx(()=>api.refreshAverageUsage(adapter,'owner',id,'2026-01-12'));assert.equal((await status(id)).reading,90500);await tx(()=>api.refreshAverageUsage(adapter,'owner',id,'2026-01-12'));assert.equal((await status(id)).reading,90500);await tx(()=>api.refreshAverageUsage(adapter,'owner',id,'2026-01-19'));assert.equal((await status(id)).reading,91000);assert.equal((await status(id)).estimated,true);});
test('fuel/service/manual actual lower than estimate resets baseline; identical actual also wins',async()=>{const id=await fixture();await config(id);await db.query('UPDATE asset_register_items SET hours=90100 WHERE id=$1',[id]);assert.equal((await status(id)).baselineValue,90100);assert.equal((await status(id)).estimated,false);await tx(async()=>{await db.query("SELECT set_config('aim4price.confirm_usage','on',true)");await db.query('UPDATE asset_register_items SET hours=hours WHERE id=$1',[id]);});assert.equal((await status(id)).baselineValue,90100);const date=math.usageToday();await tx(()=>api.refreshAverageUsage(adapter,'owner',id,date));assert.equal((await status(id)).reading,90100);assert.equal((await status(id)).dailyUsage,100);});
test('pause freezes usage; confirmation while paused does not enable it; resume needs actual reading',async()=>{const id=await fixture();await config(id);await config(id,{action:'pause'});const reading=(await status(id)).reading;await tx(()=>api.refreshAverageUsage(adapter,'owner',id,'2027-01-01'));assert.equal((await status(id)).reading,reading);await config(id,{action:'confirm',reading:90200,readingDate:math.usageToday()});assert.equal((await status(id)).enabled,false);assert.equal((await status(id)).reading,90200);await assert.rejects(config(id,{reading:undefined}));});
test('GPS ingestion cannot add to average mode, and tracking UI cannot enable or pause it',async()=>{const id=await fixture();await config(id);const before=(await status(id)).reading;await tx(()=>tracking.refreshTrackingUsage(adapter,'owner',id,[new Date().toISOString()]));assert.equal((await status(id)).reading,before);for(const action of ['enable','pause','confirm'])await assert.rejects(tx(()=>tracking.configureTrackingUsage(adapter,'owner',id,{action,enabled:true,reading:90000})),/AVERAGE_USAGE_ACTIVE/);});
test('ownership change disables estimation; metric changes stop worker',async()=>{const id=await fixture();await config(id);await db.query("UPDATE asset_register_items SET user_id='buyer' WHERE id=$1",[id]);assert.equal((await status(id,'buyer')).enabled,false);await assert.rejects(config(id),/unavailable/);const other=await fixture();await config(other);await db.query("UPDATE asset_register_items SET specs_json=specs_json||'{\"usageMode\":\"percentage\"}' WHERE id=$1",[other]);await tx(()=>api.refreshAverageUsage(adapter,'owner',other));assert.equal((await status(other)).enabled,false);});
test('unrelated edits cannot forge or clear estimated provenance',async()=>{const id=await fixture();await config(id);await db.query("UPDATE asset_register_items SET title='Renamed',specs_json='{}' WHERE id=$1",[id]);assert.equal((await status(id)).estimated,true);});
test.after(()=>db.close());

test('service evidence resets an estimate; historical services do not; confirmed readings cannot regress',async()=>{
 const {readFileSync}=await import('node:fs');const ts=(await import('typescript')).default;
 const source=readFileSync('lib/asset-maintenance.ts','utf8');
 const helper=source.slice(source.indexOf('async function confirmMaintenanceMeterReading('),source.indexOf('export async function recordStandaloneAssetMaintenanceCompletion('));
 const meter=await import(trackingRuntimeModule('asset-usage','__averageDb'));
 const confirm=new Function('resolveAssetUsage','confirmedAssetUsage','todayJohannesburgDateOnly',ts.transpileModule(helper+'\nreturn confirmMaintenanceMeterReading;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(meter.resolveAssetUsage,meter.confirmedAssetUsage,math.usageToday);
 const id=await fixture();await config(id);const initial=(await status(id)).reading;
 await tx(()=>confirm(adapter,'owner',id,90100,'2025-01-01','km'));assert.equal((await status(id)).reading,initial);
 await tx(()=>confirm(adapter,'owner',id,90100,math.usageToday(),'km'));assert.equal((await status(id)).reading,90100);assert.equal((await status(id)).estimated,false);
 await assert.rejects(tx(()=>confirm(adapter,'owner',id,90099,math.usageToday(),'km')),/LOWER_THAN_CURRENT/);
 await tx(()=>confirm(adapter,'owner',id,99999,math.usageToday(),'hours'));assert.equal((await status(id)).reading,90100);
});
test('paused average estimation can switch back to GPS without counting average usage again',async()=>{
 const id=await fixture();await config(id);await config(id,{action:'pause'});
 await tx(()=>tracking.configureTrackingUsage(adapter,'owner',id,{action:'enable',enabled:true,reading:90050}));
 assert.equal((await status(id)).mode,'tracking');assert.equal((await status(id)).reading,90050);
 await tx(()=>api.refreshAverageUsage(adapter,'owner',id));assert.equal((await status(id)).reading,90050);
});
