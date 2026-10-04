import type {NextRequest} from 'next/server';
import {getDb} from './db';
import {contributionScope,type ContributionTarget} from './shared-asset-contributions';
import {getAssetRegisterItemById,updateAssetRegisterItemStatusDetails,updateAssetRegisterItemLocation} from './asset-register-db';
import {sharedStatusInput} from './shared-asset-status-input';
import {ensureSharedAssetActivity,recordSharedAssetActivity} from './shared-asset-activity';
import {ensureSharingFoundation,recordSharingUsage} from './sharing-foundation';
import {ensureFuelLedgerTables} from './fuel-ledger';
import {businessJson,businessError,businessBody,requireBusinessOrigin} from './business-network-api';
import {ExternalLeadAccessError} from './external-lead-access';
import {limitBusinessAction} from './business-network';

const paperworkKeys=['financeType','financeCurrentOutstandingExVat','financierName','financeNote','financeBoughtWhen','financeBoughtForExVat','financeOriginalAmountExVat','financeMonthlyPaymentExVat','financeInterestRatePercent','financeTermMonths','financeBalloonPaymentExVat','financeSettlementDate','financeReferenceNumber','insuredValueExVat','insuranceInsurerName','insurancePolicyNumber','insuranceRenewalDate','insuranceNote','licenseRegistrationNumber','licenseRenewalDate','licenseNote'] as const;
function paperwork(asset:NonNullable<Awaited<ReturnType<typeof getAssetRegisterItemById>>>) {
 const specs=asset.specsJson||{};
 const value=(key:string)=>specs[key]??specs[key.replace(/[A-Z]/g,c=>'_'+c.toLowerCase())];
 const draft:Record<string,string>=Object.fromEntries(paperworkKeys.map(key=>[key,String(value(key)??'')]));
 draft.financeStatus=String(value('financeStatus')||(asset.isFinanced?'yes':'unknown'));
 draft.insuranceStatus=String(value('insuranceStatus')||(asset.isInsured?'yes':'unknown'));
 draft.licenseStatus=String(value('licenseStatus')||(asset.isLicensed?'yes':'unknown'));
 draft.insuredValueExVat=String(asset.insuredValueExVat??value('insuredValueExVat')??'');
 draft.licenseRegistrationNumber=asset.licenseRegistrationNumber||draft.licenseRegistrationNumber;
 draft.financeNote=asset.financeNote||draft.financeNote;
 return draft;
}
export async function sharedAssetSettings(request:NextRequest,target:ContributionTarget,action:'paperwork'|'location') {
 try {
  if(request.method!=='GET')requireBusinessOrigin(request);
  const scope=await contributionScope(target,action==='paperwork'?'updateDetails':'location');
  const asset=await getAssetRegisterItemById(scope.ownerId,scope.assetId);
  if(!asset)throw new ExternalLeadAccessError('Asset unavailable.',404);
  if(request.method==='GET')return businessJson({ok:true,title:asset.title,kind:asset.kind,...(action==='paperwork'?{draft:paperwork(asset)}:{location:{latitude:asset.lastKnownLat,longitude:asset.lastKnownLng,locationText:asset.lastKnownLocationText}})});
  await limitBusinessAction(`shared-settings:${scope.user.id}`,30);
  const body=await businessBody(request),id=String(body.requestId||'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new Error('Reopen the form and try again.');
  const status=action==='paperwork'?sharedStatusInput(asset,body):null;
  if(action==='location' && (typeof body.latitude!=='number'||typeof body.longitude!=='number'||!Number.isFinite(body.latitude)||!Number.isFinite(body.longitude)||Math.abs(body.latitude)>90||Math.abs(body.longitude)>180))throw new Error('Enter valid latitude and longitude.');
  if(action==='location' && body.gpsAccuracyMeters!=null && (typeof body.gpsAccuracyMeters!=='number'||!Number.isFinite(body.gpsAccuracyMeters)||body.gpsAccuracyMeters<0))throw new Error('GPS accuracy must be a non-negative number.');
  await ensureSharedAssetActivity();await ensureSharingFoundation();if(action==='location')await ensureFuelLedgerTables();
  const client=await getDb().connect();
  try {
   await client.query('BEGIN');await scope.lock(client);await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[id]);
   const prior=(await client.query('SELECT owner_id,asset_id,actor_id,action FROM shared_asset_activity WHERE id=$1::uuid',[id])).rows[0];
   const label=action==='location'?'Location updated':`${body.section} updated`;
   if(prior){if(prior.owner_id!==scope.ownerId||prior.asset_id!==scope.assetId||prior.actor_id!==scope.user.id||prior.action!==label)throw new Error('Invalid save identifier.');await client.query('COMMIT');return businessJson({ok:true});}
   const current=await getAssetRegisterItemById(scope.ownerId,scope.assetId,client);
   if(!current)throw new ExternalLeadAccessError('Asset unavailable.',404);
   const item=status?await updateAssetRegisterItemStatusDetails(scope.ownerId,sharedStatusInput(current,body),client):await updateAssetRegisterItemLocation(scope.ownerId,{assetId:scope.assetId,latitude:body.latitude as number,longitude:body.longitude as number,gpsAccuracyMeters:(body.gpsAccuracyMeters as number|null|undefined)??null,locationText:typeof body.locationText==='string'?body.locationText.slice(0,180):'',source:body.source==='device'?'device':'manual'},client);
   await recordSharedAssetActivity(client,{id,ownerId:scope.ownerId,assetId:scope.assetId,actorId:scope.user.id,actorName:scope.user.name||scope.user.email,action:label,before:action==='paperwork'?paperwork(current):{latitude:current.lastKnownLat,longitude:current.lastKnownLng},after:action==='paperwork'?paperwork(item):{latitude:item.lastKnownLat,longitude:item.lastKnownLng,locationText:item.lastKnownLocationText}});
   await recordSharingUsage({accountId:scope.user.id,actorId:scope.user.id,assetId:scope.assetId,token:scope.token,metric:'contribution',eventKey:`settings:${id}`},client);
   await client.query('COMMIT');return businessJson({ok:true});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }catch(error){return error instanceof ExternalLeadAccessError?businessJson({error:error.message},error.status):businessError(error);}
}
