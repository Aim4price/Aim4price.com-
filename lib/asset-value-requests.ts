import {ensureDealerAssetCorrectionTables} from './dealer-asset-corrections';
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
export function ensureValueRequests(){return ready??=(async()=>{await getDb().query(VALUE_REQUEST_SCHEMA);})().catch(e=>{ready=undefined;throw e});}
export function valueAmount(value:unknown):number {if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12)throw Error('Enter a value from R0 to R1 trillion, excluding VAT.');return Math.round(value);}
export function valueReason(value:unknown):string {if(typeof value!=='string'||value.trim().length<3||value.length>1500)throw Error('Please give a short reason (3–1500 characters).');return value.trim();}
export function valueRequestId(value:unknown):string {if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw Error('Reopen the form and try again.');return value;}
export async function listValueRequests(ownerId:string,assetId?:string){await ensureValueRequests();return (await getDb().query(`SELECT r.*,a.title FROM asset_value_requests r JOIN asset_register_items a ON a.id=r.asset_id AND a.user_id=r.owner_id WHERE r.owner_id=$1 ${assetId?'AND r.asset_id=$2::uuid':''} ORDER BY (r.status='pending') DESC,r.created_at DESC LIMIT 100`,assetId?[ownerId,assetId]:[ownerId])).rows;}
export async function readAssetValueReview(ownerId:string,assetId:string){
 const asset=await getAssetRegisterItemById(ownerId,assetId);if(!asset)throw Error('Asset unavailable.');
 await ensureSharedAssetActivity();
 const history=(await getDb().query("SELECT id,actor_name,action,before_data,after_data,created_at FROM shared_asset_activity WHERE owner_id=$1 AND asset_id=$2::uuid AND action LIKE 'Value %' ORDER BY created_at DESC LIMIT 50",[ownerId,assetId])).rows;
 return {asset:{id:asset.id,title:asset.title,value:asset.value,replacementPrice:asset.replacementPriceExVat,revision:asset.updatedAtIso,manual:asset.selectedMethod==='manual',baseline:readApprovedValueBaseline(asset.specsJson)},requests:await listValueRequests(ownerId,assetId),history};
}
export async function suggestAssetValue(target:ContributionTarget,body:Record<string,unknown>){
 const scope=await contributionScope(target,'suggestValue');await limitBusinessAction(`value-suggestion:${scope.user.id}`,20);
 const amount=valueAmount(body.amount),reason=valueReason(body.reason),id=valueRequestId(body.requestId);
 await ensureValueRequests();await ensureSharingFoundation();const client=await getDb().connect();
 try{await client.query('BEGIN');await scope.lock(client);await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[id]);
  const prior=(await client.query('SELECT * FROM asset_value_requests WHERE id=$1::uuid',[id])).rows[0];
  if(prior){if(prior.owner_id!==scope.ownerId||prior.asset_id!==scope.assetId||prior.actor_id!==scope.user.id||Number(prior.amount)!==amount||prior.reason!==reason)throw Error('Invalid save identifier.');await client.query('COMMIT');return {id,ownerId:scope.ownerId,created:false};}
  const asset=await getAssetRegisterItemById(scope.ownerId,scope.assetId,client);if(!asset)throw Error('Asset unavailable.');
  const profile=await getAccountProfile(scope.user);
  const actorName=[scope.user.name||scope.user.email,profile.businessName].filter(Boolean).join(' · ');
  await client.query('INSERT INTO asset_value_requests(id,owner_id,asset_id,actor_id,actor_name,amount,reason,submitted_value) VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8)',[id,scope.ownerId,scope.assetId,scope.user.id,actorName,amount,reason,asset.value]);
  await recordSharingUsage({accountId:scope.user.id,actorId:scope.user.id,assetId:scope.assetId,token:scope.token,metric:'contribution',eventKey:`value-suggestion:${id}`},client);
  await client.query('COMMIT');return {id,ownerId:scope.ownerId,created:true};
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
 if(!['override','approve','decline','replacement'].includes(kind))throw Error('Choose a valid value action.');
 await ensureValueRequests();await ensureSharedAssetActivity();
 const initial=await getAssetRegisterItemById(ownerId,assetId);if(!initial)throw Error('Asset unavailable.');
 const legacyId=body.legacyCorrectionId?valueRequestId(body.legacyCorrectionId):null;
 if(legacyId){if(kind!=='replacement')throw Error('Choose a replacement-price action.');await ensureDealerAssetCorrectionTables();}
 const proposalId=kind==='approve'||kind==='decline'?valueRequestId(body.proposalId):null;
 const proposal=proposalId?(await getDb().query('SELECT * FROM asset_value_requests WHERE id=$1::uuid AND owner_id=$2 AND asset_id=$3::uuid',[proposalId,ownerId,assetId])).rows[0]:null;
 if(proposalId&&!proposal)throw Error('Suggestion unavailable.');
 if(typeof body.revision!=='string'||!body.revision)throw Error('Reopen the review to load the latest asset.');
 let amount=kind==='approve'?Number(proposal.amount):kind==='override'?valueAmount(body.amount):initial.value;
 const replacementPrice=kind==='replacement'?valueAmount(body.replacementPrice):undefined;
 if(replacementPrice!==undefined&&replacementPrice<=0)throw Error('Replacement price must be greater than zero.');
 if(kind==='replacement'&&!['keep','recalculate'].includes(String(body.mode)))throw Error('Choose whether to keep or recalculate current value.');
 let rawModel:number|null=null;
 if(kind!=='decline'&&initial.selectedMethod!=='manual'){
  const raw=await revalueAssetRegisterItem({userId:ownerId,assetId,previewOnly:true,ignoreApprovedBaseline:true,replacementPriceExVat:replacementPrice});rawModel=raw.newValueExVat;
  if(!(rawModel>0))throw Error('This asset needs a supported positive depreciation calculation before a baseline can be set.');
 }
 if(kind==='replacement'&&body.mode==='recalculate'){
  if(rawModel===null)throw Error('Manual values use Override current value. Choose Keep current value here.');
  amount=applyApprovedValueBaseline(rawModel,initial.specsJson);
 }
 const requestSignature=createHash('sha256').update(JSON.stringify({kind,reason,proposalId,legacyId,amount:body.amount??null,replacementPrice:body.replacementPrice??null,mode:body.mode??null,revision:body.revision??null})).digest('hex');
 const after:Record<string,unknown>={amount,reason,kind,proposalId,legacyCorrectionId:legacyId,suggestedBy:proposal?.actor_name??null,replacementPrice:replacementPrice??null,mode:body.mode??null,requestSignature};
 const client=await getDb().connect();let saved:AssetRegisterItem|undefined;
 try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[id]);
  const prior=(await client.query('SELECT owner_id,asset_id,actor_id,after_data FROM shared_asset_activity WHERE id=$1::uuid',[id])).rows[0];
  if(prior){if(prior.owner_id!==ownerId||prior.asset_id!==assetId||prior.actor_id!==actor.id||prior.after_data?.requestSignature!==requestSignature)throw Error('Invalid save identifier.');await client.query('COMMIT');return {ok:true};}
  const asset=await getAssetRegisterItemById(ownerId,assetId,client);if(!asset)throw Error('Asset unavailable.');
  if(asset.updatedAtIso!==body.revision||asset.updatedAtIso!==initial.updatedAtIso)throw Error('This asset changed. Reload the review and confirm its latest value.');
  if(proposalId){const pending=(await client.query("SELECT id FROM asset_value_requests WHERE id=$1::uuid AND owner_id=$2 AND asset_id=$3::uuid AND status='pending' FOR UPDATE",[proposalId,ownerId,assetId])).rows[0];if(!pending)throw Error('This suggestion has already been reviewed.');}
  if(legacyId){
   const correction=(await client.query("SELECT id,proposed_replacement_price_ex_vat FROM dealer_asset_correction_requests WHERE id=$1::uuid AND owner_user_id=$2 AND asset_register_item_id=$3::uuid AND status='pending' AND replacement_price_changed=true FOR UPDATE",[legacyId,ownerId,assetId])).rows[0];
   if(!correction||Number(correction.proposed_replacement_price_ex_vat)!==replacementPrice)throw Error('This replacement suggestion changed or was already reviewed.');
   await client.query("UPDATE dealer_asset_correction_requests SET status='accepted',resolved_by_user_id=$2,resolved_at=now(),revaluation_status='not_required',updated_at=now() WHERE id=$1::uuid",[legacyId,actor.id]);
  }
  if(kind!=='decline'){
   const baseline:ApprovedValueBaseline={version:1,amount,modelValue:rawModel,date:new Date().toISOString(),actorId:actor.id,actorName:actor.name,reason,eventId:id,usage:asset.hours??asset.lifeWorkedPercent,condition:asset.condition,replacementPrice:replacementPrice??asset.replacementPriceExVat};
   after.baseline=baseline;
   saved=await saveApprovedAssetValue(client,asset,amount,baseline,replacementPrice);
  }
  if(proposalId)await client.query('UPDATE asset_value_requests SET status=$2,decided_by=$3,decision_reason=$4,decided_at=now() WHERE id=$1::uuid',[proposalId,kind==='approve'?'approved':'declined',actor.id,reason]);
  await recordSharedAssetActivity(client,{id,ownerId,assetId,actorId:actor.id,actorName:actor.name,action:`Value ${kind==='approve'?'suggestion approved':kind==='decline'?'suggestion declined':kind==='replacement'?'replacement changed':'overridden'}`,before:{amount:asset.value,replacementPrice:asset.replacementPriceExVat,baseline:readApprovedValueBaseline(asset.specsJson)},after});
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 if(saved)await captureAssetDepreciationLogEntry({asset:saved,previousAsset:initial,eventType:'approved_value_changed',eventSource:'owner-value-review',metadata:{actorId:actor.id,actorName:actor.name,...after}});
 return {ok:true,item:saved&&legacyId?{...saved,dealerAssetCorrection:null}:saved};
}
