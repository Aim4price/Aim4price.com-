import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {getDb} from './db';
import {ensureAssetHistorySchema,setAssetHistoryActor} from './asset-history-schema';
import {ensureSharedAssetActivity,recordSharedAssetActivity} from './shared-asset-activity';
import {getAssetRegisterItemById,saveApprovedAssetValue} from './asset-register-db';
import {revalueAssetRegisterItem} from './asset-register-revaluation';
import {readApprovedValueBaseline,applyApprovedValueBaseline} from './approved-value-baseline';

/** Restore a recorded valuation basis, never reset its depreciation date to today. */
export async function restoreAssetValueHistory(ownerId:string,assetId:string,eventId:string,actor:{id:string;name:string},body:Record<string,unknown>,guard?:(client:PoolClient)=>Promise<void>){
 await ensureAssetHistorySchema();await ensureSharedAssetActivity();
 const db=getDb();
 const event=(await db.query(`SELECT s.* FROM shared_asset_activity s WHERE s.owner_id=$2 AND s.asset_id=$3::uuid AND (s.id=$1::uuid OR EXISTS(SELECT 1 FROM asset_history_events h WHERE h.id=$1::uuid AND h.owner_id=s.owner_id AND h.asset_id=s.asset_id AND h.category='values' AND h.transaction_id=s.transaction_id)) AND s.action LIKE 'Value %' ORDER BY s.created_at DESC LIMIT 1`,[eventId,ownerId,assetId])).rows[0];
 if(!event||!Object.prototype.hasOwnProperty.call(event.before_data||{},'baseline')||!Object.prototype.hasOwnProperty.call(event.after_data||{},'baseline')||!Number.isFinite(event.before_data.amount)||event.before_data.amount<0||event.before_data.replacementPrice!==event.after_data.replacementPrice&&event.after_data.replacementPrice!=null)throw Error('This history entry has no previous current value that can be restored safely.');
 const initial=await getAssetRegisterItemById(ownerId,assetId);if(!initial)throw Error('Asset unavailable.');
 const previous=event.before_data.baseline;
 const baseline=readApprovedValueBaseline({approved_value_baseline:previous});
 if(previous&&!baseline)throw Error('This history entry has no valid previous valuation.');
 const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
 if(!same(readApprovedValueBaseline(initial.specsJson),event.after_data.baseline)||Number(initial.replacementPriceExVat)!==Number(event.before_data.replacementPrice))throw Error('Newer changes exist. Review the latest value change before restoring this one.');
 // A reset has no baseline identifier: use later decisions to reject stale/double restores too.
 if((await db.query(`SELECT 1 FROM shared_asset_activity WHERE owner_id=$1 AND asset_id=$2::uuid AND action LIKE 'Value %' AND after_data ? 'baseline' AND (created_at,id)>($3::timestamptz,$4::uuid) LIMIT 1`,[ownerId,assetId,event.created_at,event.id])).rows.length)throw Error('Newer changes exist. Restore the latest value change first.');
 const manual=initial.selectedMethod==='manual';
 const amount=manual?event.before_data.amount:applyApprovedValueBaseline((await revalueAssetRegisterItem({userId:ownerId,assetId,previewOnly:true,ignoreApprovedBaseline:true})).newValueExVat,{approved_value_baseline:baseline});
 if(!Number.isFinite(amount)||amount<0)throw Error('This history entry cannot be restored with the current valuation.');
 const preview={currentValue:initial.value,previousValue:amount,manual,revision:initial.updatedAtIso};
 if(body.action==='previewValueRestore')return preview;
 if(body.confirmed!==true)throw Error('Confirm the restoration first.');
 if(body.revision!==preview.revision||body.expectedValue!==amount)throw Error('Newer changes exist. Open the restoration again to see the latest value.');
 const client=await db.connect();
 try{await client.query('BEGIN');if(guard)await guard(client);
 await client.query('SELECT id FROM asset_register_items WHERE id=$1::uuid AND user_id=$2 FOR UPDATE',[assetId,ownerId]);
 const current=await getAssetRegisterItemById(ownerId,assetId,client);
 if(!current||current.updatedAtIso!==initial.updatedAtIso)throw Error('Newer changes exist. Open the restoration again.');
 await setAssetHistoryActor(client,actor.id,actor.name,'History correction');
 await saveApprovedAssetValue(client,current,amount,baseline);
 await recordSharedAssetActivity(client,{id:randomUUID(),ownerId,assetId,actorId:actor.id,actorName:actor.name,action:'Value restored',before:{amount:current.value,replacementPrice:current.replacementPriceExVat,baseline:readApprovedValueBaseline(current.specsJson)},after:{amount,replacementPrice:current.replacementPriceExVat,baseline,reason:'Owner restored the previous value from history',restoredFrom:eventId}});
 await client.query('COMMIT');return {ok:true,...preview};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
