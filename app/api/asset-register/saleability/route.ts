import type {NextRequest} from 'next/server';
import {getServerSession,isOwnerAppSession} from '../../../../lib/auth-session';
import {getAssetRegisterAccountAccess} from '../../../../lib/asset-register-account-access';
import {getOwnerAppAccess,ownerAppCan,ownerAppCanAccessAsset} from '../../../../lib/owner-app-access';
import {businessBody,businessJson,requireBusinessOrigin} from '../../../../lib/business-network-api';
import {getDb} from '../../../../lib/db';
import {getAssetRegisterItemById} from '../../../../lib/asset-register-db';
import {saleabilityBasis,validCurrentSaleabilityAnswers} from '../../../../lib/asset-saleability';
import {assessSaleability} from '../../../../lib/server/saleability';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:NextRequest){
 try {
  if(request.method==='POST'){try{requireBusinessOrigin(request);}catch{return businessJson({error:'This request must be sent from Aim4price.'},403);}}
  const session=await getServerSession({allowOwnerApp:true,allowDealerApp:true});
  if(!session?.user)return businessJson({error:'Sign in to access assessments.'},401);
  if(!await getAssetRegisterAccountAccess(session))return businessJson({error:'Asset access required.'},403);
  const access=isOwnerAppSession(session)?await getOwnerAppAccess():null;
  if(isOwnerAppSession(session)&&(!access||!ownerAppCan(access,'manage_assets')))return businessJson({error:'Asset access required.'},403);
  const db=getDb();
  await db.query(`CREATE TABLE IF NOT EXISTS asset_saleability_assessments (id bigserial PRIMARY KEY, owner_id text NOT NULL, asset_id uuid NOT NULL REFERENCES asset_register_items(id) ON DELETE CASCADE, actor_id text NOT NULL, assessment jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
  await db.query(`CREATE INDEX IF NOT EXISTS asset_saleability_owner_asset ON asset_saleability_assessments(owner_id,asset_id,id DESC)`);
  if(request.method==='GET'){
   const rows=(await db.query(`SELECT DISTINCT ON (s.asset_id) s.asset_id,s.assessment FROM asset_saleability_assessments s JOIN asset_register_items a ON a.id=s.asset_id AND a.user_id=s.owner_id WHERE s.owner_id=$1 ORDER BY s.asset_id,s.id DESC`,[session.user.id])).rows;
   return businessJson({items:rows.filter(row=>!access||ownerAppCanAccessAsset(access,row.asset_id))});
  }
  const body=await businessBody(request);
  if(typeof body.assetId!=='string'||!validCurrentSaleabilityAnswers(body.answers))return businessJson({error:'Complete all saleability questions.'},400);
  if(access&&!ownerAppCanAccessAsset(access,body.assetId))return businessJson({error:'Asset access required.'},403);
  const asset=await getAssetRegisterItemById(session.user.id,body.assetId);
  if(!asset)return businessJson({error:'Asset unavailable.'},404);
  if(body.basis!==saleabilityBasis(asset))return businessJson({error:'Asset details changed. Reload the register and review your answers.'},409);
  const assessment=assessSaleability(asset,body.answers);
  if(body.preview === true)return businessJson({quote:{priceExVat:assessment.priceExVat,resultLabel:assessment.resultLabel,modelVersion:assessment.modelVersion,...(assessment.ease?{ease:assessment.ease}:{})}});
  // Compare the asset revision atomically; do not attach an assessment to newer details.
  const saved=await db.query(`INSERT INTO asset_saleability_assessments(owner_id,asset_id,actor_id,assessment) SELECT $1,a.id,$3,$4::jsonb FROM asset_register_items a WHERE a.user_id=$1 AND a.id=$2::uuid AND date_trunc('milliseconds',a.updated_at)=$5::timestamptz RETURNING id`,[session.user.id,asset.id,isOwnerAppSession(session)?session.ownerApp.ownerAppUserId:session.user.id,JSON.stringify(assessment),asset.updatedAtIso]);
  if(!saved.rowCount)return businessJson({error:'Asset changed while saving. Reload and try again.'},409);
  return businessJson({assessment});
 }catch(error){console.error('Saleability assessment failed',error);return businessJson({error:'Could not save or load the assessment. Please try again.'},500);}
}
export const GET=handle;
export const POST=handle;
