import type {NextRequest} from 'next/server';
import {getDb} from './db';
import {contributionScope, type ContributionTarget} from './shared-asset-contributions';
import {requireLiveSharedAsset} from './live-shared-asset-access';
import {listIssueNotesForAssets} from './asset-issue-notes';
import {ensureFuelLedgerTables} from './fuel-ledger';
import {ensureSharedAssetActivity,recordSharedAssetActivity} from './shared-asset-activity';
import {ensureSharingFoundation,recordSharingUsage} from './sharing-foundation';
import {businessJson,businessError,businessBody,requireBusinessOrigin} from './business-network-api';
import {ExternalLeadAccessError} from './external-lead-access';
import {limitBusinessAction} from './business-network';
let storageReady:Promise<void>|null=null;
function ensureProblemStorage(){
 if(!storageReady)storageReady=(async()=>{
  await ensureFuelLedgerTables();
  await getDb().query(`DO $$ BEGIN
   IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.asset_scan_events'::regclass AND conname='asset_scan_events_actor_type_check' AND pg_get_constraintdef(oid) NOT LIKE '%shared_asset%') THEN
    ALTER TABLE public.asset_scan_events DROP CONSTRAINT asset_scan_events_actor_type_check;
    ALTER TABLE public.asset_scan_events ADD CONSTRAINT asset_scan_events_actor_type_check CHECK(actor_type IN ('scan_pin','owner_session','field_manager','admin_session','shared_asset')) NOT VALID;
   END IF;
  END $$`);
 })().catch(error=>{storageReady=null;throw error;});
 return storageReady;
}
export async function sharedAssetProblems(request:NextRequest,target:ContributionTarget){
 try {
  if(request.method==='GET') {
   const scope='token' in target ? await requireLiveSharedAsset(target.token,target.assetId,'loggedProblems') : await contributionScope(target,'loggedProblems');
   return businessJson({items:await listIssueNotesForAssets([scope.assetId],{includeNoted:true})});
  }
  requireBusinessOrigin(request);
  const scope=await contributionScope(target,'loggedProblems');
  await limitBusinessAction(`shared-problem:${scope.user.id}`,30);
  const body=await businessBody(request),id=String(body.requestId||'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('Reopen the form and try again.');
  const resolving=body.action==='resolve',note=String(body.note||'').trim();
  if(!resolving&&(body.action!=='log'||!note||note.length>4000))throw Error('Enter a problem of up to 4,000 characters.');
  if(resolving&&(!/^[0-9a-f-]{36}$/i.test(String(body.problemId||''))||body.confirmed!==true))throw Error('Confirm that this problem is resolved.');
  await ensureProblemStorage();await ensureSharedAssetActivity();await ensureSharingFoundation();
  const client=await getDb().connect();
  try {
   await client.query('BEGIN');await scope.lock(client);
   const owned=await client.query('SELECT id FROM asset_register_items WHERE id=$1::uuid AND user_id=$2 FOR SHARE',[scope.assetId,scope.ownerId]);
   if(!owned.rows.length)throw new ExternalLeadAccessError('Asset unavailable.',404);
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[id]);
   const previous=(await client.query('SELECT owner_id,asset_id,actor_id,action FROM shared_asset_activity WHERE id=$1::uuid',[id])).rows[0];
   const action=resolving?'Problem resolved':'Problem logged';
   if(previous&&(previous.owner_id!==scope.ownerId||previous.asset_id!==scope.assetId||previous.actor_id!==scope.user.id||previous.action!==action))throw Error('Invalid save identifier.');
   if(!previous){
    if(resolving){
     const result=await client.query(`UPDATE asset_scan_events SET issue_noted_at=coalesce(issue_noted_at,now()) WHERE id=$1::uuid AND asset_id=$2::uuid AND lower(coalesce(note,'')) LIKE '%notes%problems:%' RETURNING id`,[body.problemId,scope.assetId]);
     if(!result.rows.length)throw new ExternalLeadAccessError('Problem unavailable.',404);
    }else{
     await client.query(`INSERT INTO asset_scan_events(id,asset_id,actor_type,operator_name,note) VALUES($1::uuid,$2::uuid,'shared_asset',$3,$4)`,[id,scope.assetId,scope.user.name||scope.user.email,`Notes/Problems: ${note}`]);
    }
    await recordSharedAssetActivity(client,{id,ownerId:scope.ownerId,assetId:scope.assetId,actorId:scope.user.id,actorName:scope.user.name||scope.user.email,action,after:resolving?{problemId:body.problemId}:{problemId:id,note}});
    await recordSharingUsage({accountId:scope.user.id,actorId:scope.user.id,assetId:scope.assetId,token:scope.token,metric:'contribution',eventKey:`problem:${id}`},client);
   }
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  return businessJson({ok:true,items:await listIssueNotesForAssets([scope.assetId],{includeNoted:true})});
 }catch(error){return error instanceof ExternalLeadAccessError?businessJson({error:error.message},error.status):businessError(error);}
}
