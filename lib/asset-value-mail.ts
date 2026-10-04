import {getDb} from './db';
import {getSiteOrigin,sendAim4priceEmail} from './email';
import {ensureValueRequests} from './asset-value-requests';
/** Claim once. Failed delivery is visible in admin; approval is always in-app. */
export async function notifyValueSuggestion(id:string){
 await ensureValueRequests();
 const row=(await getDb().query(`UPDATE asset_value_requests SET email_attempted_at=now() WHERE id=$1::uuid AND email_attempted_at IS NULL AND status='pending' RETURNING *`,[id])).rows[0];if(!row)return;
 try{
  if(!process.env.RESEND_API_KEY)throw Error('Email service is not configured.');
  const owner=(await getDb().query('SELECT email FROM "user" WHERE id=$1',[row.owner_id])).rows[0];if(!owner?.email)throw Error('Owner email unavailable.');
  const url=`${getSiteOrigin()}/asset-register?assetId=${encodeURIComponent(row.asset_id)}&valueReview=1`;
  const text=`A current value suggestion is waiting for your approval in Aim4price. Your asset value has not changed. Sign in to review the amount, contributor and reason: ${url}`;
  await sendAim4priceEmail({to:owner.email,subject:'Review an asset value suggestion',text,html:`<p>A current value suggestion is waiting for your approval.</p><p>Your asset value has not changed.</p><p><a href="${url.replaceAll('&','&amp;')}">Sign in to review</a></p>`,idempotencyKey:`value-suggestion-${id}`,usage:{accountId:row.owner_id,actorId:row.actor_id,eventKey:`value-suggestion:${id}`}});
  await getDb().query('UPDATE asset_value_requests SET email_sent_at=now(),email_error=NULL WHERE id=$1::uuid',[id]);
 }catch(e){await getDb().query('UPDATE asset_value_requests SET email_error=$2 WHERE id=$1::uuid',[id,e instanceof Error?e.message:'Delivery failed']);}
}
