import {replacementNotificationStatuses} from './asset-replacement-mail';
import {setAssetHistoryActor} from './asset-history-schema';
import {ensureDealerAssetCorrectionTables,listPendingOwnerAssetCorrections} from './dealer-asset-corrections';
import {createHash} from 'node:crypto';
import {getAccountProfile} from './account-profile';
import {getDb} from './db';
import {getAssetRegisterItemById,saveApprovedAssetValue,type AssetRegisterItem} from './asset-register-db';
import {revalueAssetRegisterItem} from './asset-register-revaluation';
import {applyApprovedValueBaseline,readApprovedValueBaseline,type ApprovedValueBaseline} from './approved-value-baseline';
import {ensureSharedAssetActivity,recordSharedAssetActivity} from './shared-asset-activity';
import {captureAssetDepreciationLogEntry} from './asset-depreciation-timeline';
import {contributionScope,type ContributionTarget} from './shared-asset-contributions';
import {ensureSharingFoundation,recordSharingUsage} from './sharing-foundation';
import {limitBusinessAction} from './business-network';

export const VALUE_REQUEST_SCHEMA = `CREATE TABLE IF NOT EXISTS asset_value_requests (
 id uuid PRIMARY KEY, owner_id text NOT NULL, asset_id uuid NOT NULL, actor_id text NOT NULL,
 actor_name text NOT NULL, amount numeric NOT NULL CHECK(amount >= 0), reason text NOT NULL,
 submitted_value numeric NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
 decided_by text, decision_reason text, created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
 email_attempted_at timestamptz, email_sent_at timestamptz, email_error text
);
CREATE INDEX IF NOT EXISTS asset_value_requests_owner_pending ON asset_value_requests(owner_id,status,created_at DESC);`;
let ready:Promise<void>|undefined;
export function ensureValueRequests(){return ready??=(async()=>{await getDb().query(VALUE_REQUEST_SCHEMA);await ensureDealerAssetCorrectionTables();})().catch(e=>{ready=undefined;throw e});}
export function valueAmount(value:unknown):number {if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12)throw Error('Enter a value from R0 to R1 trillion, excluding VAT.');return Math.round(value);}
export function valueReason(value:unknown):string {if(typeof value!=='string'||value.trim().length<3||value.length>1500)throw Error('Please give a short reason (3–1500 characters).');return value.trim();}
export function valueRequestId(value:unknown):string {if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw Error('Reopen the form and try again.');return value;}
export async function listValueRequests(ownerId:string,assetId?:string){await ensureValueRequests();return (await getDb().query(`SELECT r.*,a.title FROM asset_value_requests r JOIN asset_register_items a ON a.id=r.asset_id AND a.user_id=r.owner_id WHERE r.owner_id=$1 ${assetId?'AND r.asset_id=$2::uuid':''} ORDER BY (r.status='pending') DESC,r.created_at DESC LIMIT 100`,assetId?[ownerId,assetId]:[ownerId])).rows;}
export async function readAssetValueReview(ownerId:string,assetId:string){
 const asset=await getAssetRegisterItemById(ownerId,assetId);if(!asset)throw Error('Asset unavailable.');
 await ensureSharedAssetActivity();
 const history=(await getDb().query("SELECT id,actor_name,action,before_data,after_data,created_at FROM shared_asset_activity WHERE owner_id=$1 AND asset_id=$2::uuid AND action LIKE 'Value %' ORDER BY created_at DESC LIMIT 50",[ownerId,assetId])).rows;
 const replacementRequests=(await listPendingOwnerAssetCorrections(ownerId,[assetId])).filter(r=>r.replacementPriceChanged);
 const delivery=await replacementNotificationStatuses(replacementRequests.map(r=>r.id));
 return {asset:{id:asset.id,title:asset.title,value:asset.value,replacementPrice:asset.replacementPriceExVat,revision:asset.updatedAtIso,manual:asset.selectedMethod==='manual',baseline:readApprovedValueBaseline(asset.specsJson)},requests:await listValueRequests(ownerId,assetId),replacementRequests:replacementRequests.map(r=>({...r,...delivery[r.id]})),history};
}
export async function suggestAssetValue(target:ContributionTarget,body:Record<string,unknown>){
 const scope=await contributionScope(target,'suggestValue');await limitBusinessAction(`value-suggestion:${scope.user.id}`,20);
 const amount=valueAmount(body.amount),reason=valueReason(body.reason),id=valueRequestId(body.requestId);
 await ensureValueRequests();await ensureSharedAssetActivity();await ensureSharingFoundation();const client=await getDb().connect();
 try{await client.query('BEGIN');await scope.lock(client);await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[id]);
  const prior=(await client.query('SELECT * FROM asset_value_requests WHERE id=$1::uuid',[id])).rows[0];
  if(prior){if(prior.owner_id!==scope.ownerId||prior.asset_id!==scope.assetId||prior.actor_id!==scope.user.id||Number(prior.amount)!==amount||prior.reason!==reason)throw Error('Invalid save identifier.');await client.query('COMMIT');return {id,ownerId:scope.ownerId,created:false,direct:prior.decision_reason==='Permitted manual-value update'};}
  const asset=await getAssetRegisterItemById(scope.ownerId,scope.assetId,client);if(!asset)throw Error('Asset unavailable.');
  if(asset.selectedMethod==='manual'&&(body.confirmed!==true||body.revision!==asset.updatedAtIso))throw Error('This manual value needs confirmation against the latest asset. Reload and try again.');
  const profile=await getAccountProfile(scope.user);
  const actorName=[scope.user.name||scope.user.email,profile.businessName].filter(Boolean).join(' · ');
  await client.query('INSERT INTO asset_value_requests(id,owner_id,asset_id,actor_id,actor_name,amount,reason,submitted_value) VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8)',[id,scope.ownerId,scope.assetId,scope.user.id,actorName,amount,reason,asset.value]);
  const direct=asset.selectedMethod==='manual';
  if(direct){
   const baseline:ApprovedValueBaseline={version:1,amount,modelValue:null,date:new Date().toISOString(),actorId:scope.user.id,actorName,reason,eventId:id,usage:asset.hours??asset.lifeWorkedPercent,condition:asset.condition,replacementPrice:asset.replacementPriceExVat};
   await setAssetHistoryActor(client,scope.user.id,actorName,scope.token?'Shared link':'Leads');
   await saveApprovedAssetValue(client,asset,amount,baseline);
   await client.query("UPDATE asset_value_requests SET status='approved',decided_by=$2,decision_reason=$3,decided_at=now() WHERE id=$1::uuid",[id,scope.user.id,'Permitted manual-value update']);
   await recordSharedAssetActivity(client,{id,ownerId:scope.ownerId,assetId:scope.assetId,actorId:scope.user.id,actorName,action:'Value manual update',before:{amount:asset.value,replacementPrice:asset.replacementPriceExVat},after:{amount,reason,baseline}});
  }
  await recordSharingUsage({accountId:scope.user.id,actorId:scope.user.id,assetId:scope.assetId,token:scope.token,metric:'contribution',eventKey:`value-suggestion:${id}`},client);
  await client.query('COMMIT');return {id,ownerId:scope.ownerId,created:true,direct};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function previewReplacementValue(ownerId:string,assetId:string,replacementPrice:number){
 const asset=await getAssetRegisterItemById(ownerId,assetId);if(!asset)throw Error('Asset unavailable.');
 if(replacementPrice<=0)throw Error('Replacement price must be greater than zero.');
 if(asset.selectedMethod==='manual')return {revision:asset.updatedAtIso,currentValue:asset.value,recalculatedValue:null};
 const result=await revalueAssetRegisterItem({userId:ownerId,assetId,previewOnly:true,replacementPriceExVat:replacementPrice});
 return {revision:asset.updatedAtIso,currentValue:asset.value,recalculatedValue:result.newValueExVat};
}
/** One decision writer for owner and admin. An HTTP caller never supplies owner scope implicitly. */
export async function decideAssetValue(ownerId:string,assetId:string,actor:{id:string;name:string},body:Record<string,unknown>){
 const id=valueRequestId(body.requestId),kind=String(body.action||''),reason=valueReason(body.reason);
 if(!['override','approve','decline','replacement','restoreManual','resetAim4price','declineReplacement'].includes(kind))throw Error('Choose a valid value action.');
 await ensureValueRequests();await ensureSharedAssetActivity();
 const initial=await getAssetRegisterItemById(ownerId,assetId);if(!initial)throw Error('Asset unavailable.');
 if(kind==='restoreManual'&&initial.selectedMethod!=='manual')throw Error('Choose Return to Aim4price for an automatically valued asset.');
 if(kind==='resetAim4price'&&initial.selectedMethod==='manual')throw Error('Manual assets need a supported Aim4price valuation before automatic values can be used.');
 const restoreId=kind==='restoreManual'?valueRequestId(body.historyId):null;
 const history=restoreId?(await getDb().query("SELECT before_data FROM shared_asset_activity WHERE id=$1::uuid AND owner_id=$2 AND asset_id=$3::uuid AND action LIKE 'Value %'",[restoreId,ownerId,assetId])).rows[0]:null;
 if(restoreId&&(!history||typeof history.before_data?.amount!=='number'))throw Error('This history entry has no restorable manual value.');
 const legacyId=body.legacyCorrectionId?valueRequestId(body.legacyCorrectionId):null;
 if(legacyId){if(!['replacement','declineReplacement'].includes(kind))throw Error('Choose a replacement-price action.');await ensureDealerAssetCorrectionTables();}
 if(kind==='declineReplacement'&&!legacyId)throw Error('Choose a replacement suggestion.');
 const proposalId=kind==='approve'||kind==='decline'?valueRequestId(body.proposalId):null;
 const proposal=proposalId?(await getDb().query('SELECT * FROM asset_value_requests WHERE id=$1::uuid AND owner_id=$2 AND asset_id=$3::uuid',[proposalId,ownerId,assetId])).rows[0]:null;
 if(proposalId&&!proposal)throw Error('Suggestion unavailable.');
 if(typeof body.revision!=='string'||!body.revision)throw Error('Reopen the review to load the latest asset.');
 let amount=kind==='restoreManual'?valueAmount(history.before_data.amount):kind==='approve'?Number(proposal.amount):kind==='override'?valueAmount(body.amount):initial.value;
 const replacementPrice=kind==='replacement'?valueAmount(body.replacementPrice):undefined;
 if(replacementPrice!==undefined&&replacementPrice<=0)throw Error('Replacement price must be greater than zero.');
 if(kind==='replacement'&&!['keep','recalculate'].includes(String(body.mode)))throw Error('Choose whether to keep or recalculate current value.');
 let rawModel:number|null=null;
 if(!['decline','declineReplacement'].includes(kind)&&initial.selectedMethod!=='manual'){
  const raw=await revalueAssetRegisterItem({userId:ownerId,assetId,previewOnly:true,ignoreApprovedBaseline:true,replacementPriceExVat:replacementPrice});rawModel=raw.newValueExVat;
  if(!(rawModel>0))throw Error('This asset needs a supported positive depreciation calculation before a baseline can be set.');
 }
 if(kind==='resetAim4price'){amount=rawModel!;if(body.expectedValue!==amount)throw Error('This Aim4price calculation changed. Preview it again before confirming.');}
 if(kind==='replacement'&&body.mode==='recalculate'){
  if(rawModel===null)throw Error('Manual values use Override current value. Choose Keep current value here.');
  amount=applyApprovedValueBaseline(rawModel,initial.specsJson);
 }
 const requestSignature=createHash('sha256').update(JSON.stringify({kind,reason,proposalId,legacyId,restoreId,amount:body.amount??null,replacementPrice:body.replacementPrice??null,mode:body.mode??null,revision:body.revision??null})).digest('hex');
 const after:Record<string,unknown>={amount,reason,kind,restoredFrom:restoreId,proposalId,legacyCorrectionId:legacyId,suggestedBy:proposal?.actor_name??null,replacementPrice:replacementPrice??null,mode:body.mode??null,requestSignature};
 const client=await getDb().connect();let saved:AssetRegisterItem|undefined;
 try{await client.query('BEGIN');await setAssetHistoryActor(client,actor.id,actor.name,'Value review');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[id]);
  const prior=(await client.query('SELECT owner_id,asset_id,actor_id,after_data FROM shared_asset_activity WHERE id=$1::uuid',[id])).rows[0];
  if(prior){if(prior.owner_id!==ownerId||prior.asset_id!==assetId||prior.actor_id!==actor.id||prior.after_data?.requestSignature!==requestSignature)throw Error('Invalid save identifier.');await client.query('COMMIT');return {ok:true};}
  const asset=await getAssetRegisterItemById(ownerId,assetId,client);if(!asset)throw Error('Asset unavailable.');
  if(asset.updatedAtIso!==body.revision||asset.updatedAtIso!==initial.updatedAtIso)throw Error('This asset changed. Reload the review and confirm its latest value.');
  if(proposalId){const pending=(await client.query("SELECT id FROM asset_value_requests WHERE id=$1::uuid AND owner_id=$2 AND asset_id=$3::uuid AND status='pending' FOR UPDATE",[proposalId,ownerId,assetId])).rows[0];if(!pending)throw Error('This suggestion has already been reviewed.');}
  if(legacyId){
   const correction=(await client.query("SELECT id,proposed_replacement_price_ex_vat,reason FROM dealer_asset_correction_requests WHERE id=$1::uuid AND owner_user_id=$2 AND asset_register_item_id=$3::uuid AND status='pending' AND replacement_price_changed=true FOR UPDATE",[legacyId,ownerId,assetId])).rows[0];
   if(!correction||(kind==='replacement'&&Number(correction.proposed_replacement_price_ex_vat)!==replacementPrice))throw Error('This replacement suggestion changed or was already reviewed.');
   after.suggestionReason=correction.reason||null;
   await client.query("UPDATE dealer_asset_correction_requests SET status=$3,resolved_by_user_id=$2,resolved_at=now(),revaluation_status='not_required',updated_at=now() WHERE id=$1::uuid",[legacyId,actor.id,kind==='declineReplacement'?'rejected':'accepted']);
  }
  if(!['decline','declineReplacement'].includes(kind)){
   const baseline:ApprovedValueBaseline={version:1,amount,modelValue:rawModel,date:new Date().toISOString(),actorId:actor.id,actorName:actor.name,reason,eventId:id,usage:asset.hours??asset.lifeWorkedPercent,condition:asset.condition,replacementPrice:replacementPrice??asset.replacementPriceExVat};
   after.baseline=kind==='resetAim4price'?null:baseline;
   saved=await saveApprovedAssetValue(client,asset,amount,kind==='resetAim4price'?null:baseline,replacementPrice);
  }
  if(proposalId)await client.query('UPDATE asset_value_requests SET status=$2,decided_by=$3,decision_reason=$4,decided_at=now() WHERE id=$1::uuid',[proposalId,kind==='approve'?'approved':'declined',actor.id,reason]);
  await recordSharedAssetActivity(client,{id,ownerId,assetId,actorId:actor.id,actorName:actor.name,action:`Value ${kind==='declineReplacement'?'replacement suggestion declined':kind==='approve'?'suggestion approved':kind==='decline'?'suggestion declined':kind==='replacement'?'replacement changed':kind==='restoreManual'?'manual value restored':kind==='resetAim4price'?'returned to Aim4price':'overridden'}`,before:{amount:asset.value,replacementPrice:asset.replacementPriceExVat,baseline:readApprovedValueBaseline(asset.specsJson)},after});
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 if(saved)await captureAssetDepreciationLogEntry({asset:saved,previousAsset:initial,eventType:'approved_value_changed',eventSource:'owner-value-review',metadata:{actorId:actor.id,actorName:actor.name,...after}}).catch(e=>console.error('Saved value; depreciation timeline refresh failed',e));
 return {ok:true,item:saved&&legacyId?{...saved,dealerAssetCorrection:null}:saved};
}

export async function previewAim4priceReset(ownerId:string,assetId:string){
 const asset=await getAssetRegisterItemById(ownerId,assetId);if(!asset)throw Error('Asset unavailable.');if(asset.selectedMethod==='manual')throw Error('Manual assets need a supported Aim4price valuation first.');
 const result=await revalueAssetRegisterItem({userId:ownerId,assetId,previewOnly:true,ignoreApprovedBaseline:true});
 return {revision:asset.updatedAtIso,currentValue:asset.value,recalculatedValue:result.newValueExVat};
}
