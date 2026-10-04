import {randomUUID} from 'node:crypto';
import {ensureSharedAssetActivity,recordSharedAssetActivity} from './shared-asset-activity';
import {updateSharedAssetDetails} from './asset-register-db';
import {getDb} from './db';
import {setAssetHistoryActor,ensureAssetHistorySchema} from './asset-history-schema';
import {detailsRestore,historyChanges} from './asset-history';
export async function restoreAssetDetails(ownerId:string,assetId:string,eventId:string,actor:{id:string;name:string},confirmed:boolean,guard?:(client:import('pg').PoolClient)=>Promise<void>){
 if(!confirmed)throw Error('Confirm the restoration first.');
 await ensureAssetHistorySchema();await ensureSharedAssetActivity();const client=await getDb().connect();
 try{await client.query('BEGIN');if(guard)await guard(client);await setAssetHistoryActor(client,actor.id,actor.name,'History restoration');
 const event=(await client.query(`SELECT * FROM asset_history_events WHERE id=$1::uuid AND owner_id=$2 AND asset_id=$3::uuid AND record_table='asset_register_items' AND operation='UPDATE'`,[eventId,ownerId,assetId])).rows[0];if(!event)throw Error('This history entry cannot be restored.');
 const current=(await client.query('SELECT * FROM asset_register_items WHERE id=$1::uuid AND user_id=$2 FOR UPDATE',[assetId,ownerId])).rows[0];if(!current)throw Error('Asset unavailable.');
 const keys=historyChanges(event.before_data,event.after_data).filter(k=>detailsRestore.includes(k));if(!keys.length)throw Error('Open the original record to correct this change.');
 for(const k of keys)if(JSON.stringify(current[k])!==JSON.stringify(event.after_data[k]))throw Error('Newer changes exist. Open Update asset to review them before restoring.');
 // Only safe identity fields are restored here. Usage, values and ledger records retain their own rules.
 const names:Record<string,string>={title:'title',year_model:'yearModel',condition:'condition',brand_name:'brand',model_name:'model',note:'note'};
 const patch=Object.fromEntries(keys.map(k=>[names[k],event.before_data[k]??(k==='year_model'?null:'')]));
 const restored=await updateSharedAssetDetails(client,ownerId,assetId,patch);
 await recordSharedAssetActivity(client,{id:randomUUID(),ownerId,assetId,actorId:actor.id,actorName:actor.name,action:'Asset details restored',before:restored.before,after:{...restored.after,reason:'Restored previous details from asset history',restoredFrom:eventId}});
 await client.query('COMMIT');return {ok:true};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
