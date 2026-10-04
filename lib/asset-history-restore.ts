import {resolveAssetUsage} from './asset-usage';
import {randomUUID} from 'node:crypto';
import {ensureSharedAssetActivity,recordSharedAssetActivity} from './shared-asset-activity';
import {updateSharedAssetDetails} from './asset-register-db';
import {getDb} from './db';
import {setAssetHistoryActor,ensureAssetHistorySchema} from './asset-history-schema';
import {restorableChanges,legacyDetailFields} from './asset-history-fields';

/** Owner-only callers authorize first; link callers also supply their locked access guard. */
export async function restoreAssetDetails(ownerId:string,assetId:string,eventId:string,actor:{id:string;name:string},confirmed:boolean,guard?:(client:import('pg').PoolClient)=>Promise<void>){
 if(!confirmed)throw Error('Confirm the restoration first.');
 await ensureAssetHistorySchema();await ensureSharedAssetActivity();const client=await getDb().connect();
 try{
  await client.query('BEGIN');if(guard)await guard(client);
  await setAssetHistoryActor(client,actor.id,actor.name,'History correction');
  let event=(await client.query(`SELECT * FROM asset_history_events WHERE id=$1::uuid AND owner_id=$2 AND asset_id=$3::uuid AND record_table='asset_register_items' AND operation='UPDATE'`,[eventId,ownerId,assetId])).rows[0];
  let legacy=false;
  if(!event){event=(await client.query("SELECT * FROM shared_asset_activity WHERE id=$1::uuid AND owner_id=$2 AND asset_id=$3::uuid AND action='Asset details updated'",[eventId,ownerId,assetId])).rows[0];legacy=true;}
  if(!event)throw Error('This history entry cannot be retracted.');
  const current=(await client.query('SELECT * FROM asset_register_items WHERE id=$1::uuid AND user_id=$2 FOR UPDATE',[assetId,ownerId])).rows[0];
  if(!current)throw Error('Asset unavailable.');
  const normalize=(data:Record<string,unknown>)=>legacy?Object.fromEntries(Object.entries(data).filter(([key])=>key in legacyDetailFields).map(([key,value])=>[legacyDetailFields[key],value])):data;
  const before=normalize(event.before_data),after=normalize(event.after_data);
  // Legacy shared usage is the resolved metric: hours/km or life-worked percentage.
  const usage=resolveAssetUsage({kind:current.kind,hours:current.hours,lifeWorkedPercent:current.life_worked_percent,specsJson:current.specs_json});
  const percentage=usage.metric==='percentage';
  if(legacy&&percentage){if('hours' in before){before.life_worked_percent=before.hours;delete before.hours;}if('hours' in after){after.life_worked_percent=after.hours;delete after.hours;}}
  const keys=restorableChanges(before,after);if(!keys.length)throw Error('Open the original record to correct this change.');
  const numeric=new Set(['year_model','hours','life_worked_percent']);
  for(const key of keys){
   const currentValue=legacy&&['hours','life_worked_percent'].includes(key)?usage.value:current[key];
   const same=numeric.has(key)&&currentValue!=null&&after[key]!=null?Number(currentValue)===Number(after[key]):JSON.stringify(currentValue)===JSON.stringify(after[key]);
   if(!same)throw Error('Newer changes exist. Open Update asset to review them before retracting this change.');
   if(numeric.has(key)&&before[key]!=null&&(!Number.isFinite(Number(before[key]))||Number(before[key])<0))throw Error('This history entry has no valid previous reading.');
  }
  const names:Record<string,string>={title:'title',year_model:'yearModel',condition:'condition',brand_name:'brand',model_name:'model',note:'note',hours:'usage',life_worked_percent:'usage'};
  const patch=Object.fromEntries(keys.map(key=>[names[key],before[key]!=null&&numeric.has(key)?Number(before[key]):before[key]??(key==='year_model'?null:'')]));
  if(('usage' in patch)&&(typeof patch.usage!=='number'||!Number.isFinite(patch.usage)))throw Error('This history entry has no valid previous reading.');
  const restored=await updateSharedAssetDetails(client,ownerId,assetId,patch,{allowUsageDecrease:true});
  await recordSharedAssetActivity(client,{id:randomUUID(),ownerId,assetId,actorId:actor.id,actorName:actor.name,action:'Asset change retracted',before:restored.before,after:{...restored.after,reason:'Owner restored previous details from asset history',restoredFrom:eventId}});
  await client.query('COMMIT');return {ok:true};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
