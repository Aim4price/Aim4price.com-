import {valueSuggestionEmail} from './value-suggestion-email';
import {getDb} from './db';
import {getSiteOrigin,sendAim4priceEmail} from './email';
import {ensureValueRequests} from './asset-value-requests';
/** Claim delivery; failed attempts may be retried after 15 minutes. Approval remains in-app. */
export async function notifyValueSuggestion(id:string){
 await ensureValueRequests();
 const row=(await getDb().query(`UPDATE asset_value_requests SET email_attempted_at=now() WHERE id=$1::uuid AND email_sent_at IS NULL AND (email_attempted_at IS NULL OR email_attempted_at<now()-interval '15 minutes') AND status='pending' RETURNING *`,[id])).rows[0];if(!row)return;
 try{
  if(!process.env.RESEND_API_KEY)throw Error('Email service is not configured.');
  const owner=(await getDb().query('SELECT email FROM "user" WHERE id=$1',[row.owner_id])).rows[0];if(!owner?.email)throw Error('Owner email unavailable.');
  const url=`${getSiteOrigin()}/value-review/${encodeURIComponent(row.asset_id)}/${encodeURIComponent(id)}`;
  const asset=(await getDb().query('SELECT title,serial_number FROM asset_register_items WHERE id=$1::uuid AND user_id=$2',[row.asset_id,row.owner_id])).rows[0];if(!asset)throw Error('Asset unavailable.');
  const message=valueSuggestionEmail({title:asset.title,serial:asset.serial_number,actor:row.actor_name,before:Number(row.submitted_value),amount:Number(row.amount),reason:row.reason,url});
  await sendAim4priceEmail({to:owner.email,...message,idempotencyKey:`value-suggestion-${id}`,usage:{accountId:row.owner_id,actorId:row.actor_id,eventKey:`value-suggestion:${id}`}});
  await getDb().query('UPDATE asset_value_requests SET email_sent_at=now(),email_error=NULL WHERE id=$1::uuid',[id]);
 }catch(e){await getDb().query('UPDATE asset_value_requests SET email_error=$2 WHERE id=$1::uuid',[id,e instanceof Error?e.message:'Delivery failed']);}
}
