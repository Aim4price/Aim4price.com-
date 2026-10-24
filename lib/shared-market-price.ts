import type {NextRequest} from 'next/server';
import {randomUUID} from 'node:crypto';
import {getDb} from './db';
import {getAssetRegisterItemById} from './asset-register-db';
import {assetSaleabilityInput,saleabilityBasis,saleabilityContext,validCurrentSaleabilityAnswers} from './asset-saleability';
import {assessSaleability} from './server/saleability';
import {requireLiveSharedAsset,lockLiveSharedAsset} from './live-shared-asset-access';
import {ExternalLeadAccessError} from './external-lead-access';
import {businessBody,businessJson,requireBusinessOrigin} from './business-network-api';
import {limitBusinessAction} from './business-network';
import {ensureSharedAssetActivity,recordSharedAssetActivity} from './shared-asset-activity';

/** Explicit link permission is checked on read, preview and again within the save transaction. */
export async function sharedMarketPrice(request:NextRequest,target:{token:string;assetId:string}) {
 try {
  if(request.method!=='GET')requireBusinessOrigin(request);
  const scope=await requireLiveSharedAsset(target.token,target.assetId,'marketPrice',true);
  const ownerId=scope.lead.ownerId;
  const asset=await getAssetRegisterItemById(ownerId,target.assetId);
  if(!asset)throw new ExternalLeadAccessError('Asset unavailable.',404);
  if(request.method==='GET')return businessJson({assetId:asset.id,title:asset.title,valuationExVat:asset.value,basis:saleabilityBasis(asset),input:assetSaleabilityInput(asset),context:saleabilityContext(asset)});
  await limitBusinessAction(`shared-market-price:${scope.user.id}`,30);
  const body=await businessBody(request);
  if(!validCurrentSaleabilityAnswers(body.answers))return businessJson({error:'Complete all market price questions.'},400);
  if(body.basis!==saleabilityBasis(asset))return businessJson({error:'Asset details changed. Reopen market price and review your answers.'},409);
  const assessment=assessSaleability(asset,body.answers);
  if(body.preview===true)return businessJson({quote:{priceExVat:assessment.priceExVat,resultLabel:assessment.resultLabel,modelVersion:assessment.modelVersion,...(assessment.ease?{ease:assessment.ease}:{})}});
  const db=getDb();
  await db.query(`CREATE TABLE IF NOT EXISTS asset_saleability_assessments (id bigserial PRIMARY KEY, owner_id text NOT NULL, asset_id uuid NOT NULL REFERENCES asset_register_items(id) ON DELETE CASCADE, actor_id text NOT NULL, assessment jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
  await db.query(`CREATE INDEX IF NOT EXISTS asset_saleability_owner_asset ON asset_saleability_assessments(owner_id,asset_id,id DESC)`);
  await ensureSharedAssetActivity();
  const client=await db.connect();
  try {
   await client.query('BEGIN');
   await lockLiveSharedAsset(client,scope);
   const current=await client.query(`SELECT id FROM asset_register_items WHERE user_id=$1 AND id=$2::uuid AND date_trunc('milliseconds',updated_at)=$3::timestamptz FOR UPDATE`,[ownerId,asset.id,asset.updatedAtIso]);
   if(!current.rows.length)throw new ExternalLeadAccessError('Asset changed while saving. Reopen market price and try again.',409);
   await client.query(`INSERT INTO asset_saleability_assessments(owner_id,asset_id,actor_id,assessment) VALUES($1,$2::uuid,$3,$4::jsonb)`,[ownerId,asset.id,scope.user.id,JSON.stringify(assessment)]);
   await recordSharedAssetActivity(client,{id:randomUUID(),ownerId,assetId:asset.id,actorId:scope.user.id,actorName:scope.user.name||scope.user.email,action:'Market price updated',after:{priceExVat:assessment.priceExVat,assessedAt:assessment.assessedAt}});
   await client.query('COMMIT');
   return businessJson({assessment:{priceExVat:assessment.priceExVat,assessedAt:assessment.assessedAt,needsReview:false}});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }catch(error){
  if(error instanceof ExternalLeadAccessError)return businessJson({error:error.message},error.status);
  console.error('Shared market price failed',error);
  return businessJson({error:'Could not load or save market price. Please try again.'},400);
 }
}
