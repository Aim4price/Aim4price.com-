import {getDb} from './db';
import {getSiteOrigin,sendAim4priceEmail} from './email';
export const REPLACEMENT_MAIL_SCHEMA=`CREATE TABLE IF NOT EXISTS asset_replacement_notifications(correction_id uuid PRIMARY KEY,attempted_at timestamptz,sent_at timestamptz,error text);`;
/** Claim before sending; provider key makes retry after an uncertain delivery safe. */
export async function notifyReplacementSuggestion(id:string){
 await getDb().query(REPLACEMENT_MAIL_SCHEMA);
 const row=(await getDb().query("SELECT * FROM dealer_asset_correction_requests WHERE id=$1::uuid AND status='pending' AND replacement_price_changed=true",[id])).rows[0];if(!row)return;
 const claim=await getDb().query(`INSERT INTO asset_replacement_notifications(correction_id,attempted_at) VALUES($1::uuid,now()) ON CONFLICT(correction_id) DO UPDATE SET attempted_at=now() WHERE asset_replacement_notifications.sent_at IS NULL AND asset_replacement_notifications.attempted_at<now()-interval '15 minutes' RETURNING correction_id`,[id]);if(!claim.rows.length)return;
 try{
  if(!process.env.RESEND_API_KEY)throw Error('Email service is not configured.');
  const owner=(await getDb().query('SELECT email FROM "user" WHERE id=$1',[row.owner_user_id])).rows[0];if(!owner?.email)throw Error('Owner email unavailable.');
  const url=`${getSiteOrigin()}/asset-register?assetId=${encodeURIComponent(row.asset_register_item_id)}&valueReview=1&replacementReview=${encodeURIComponent(id)}`;
  await sendAim4priceEmail({to:owner.email,subject:'Review an asset replacement price',text:`A replacement price suggestion is waiting for your approval. Your asset values have not changed. Sign in to review the amount, contributor and reason, and choose whether to keep or recalculate current value: ${url}`,html:`<p>A replacement price suggestion is waiting for your approval.</p><p>Your asset values have not changed. Review the suggestion and choose its effect on current value.</p><p><a href="${url.replaceAll('&','&amp;')}">Sign in to review</a></p>`,idempotencyKey:`replacement-suggestion-${id}`,usage:{accountId:row.owner_user_id,actorId:row.dealer_user_id,eventKey:`replacement-suggestion:${id}`}});
  await getDb().query('UPDATE asset_replacement_notifications SET sent_at=now(),error=NULL WHERE correction_id=$1::uuid',[id]);
 }catch(e){await getDb().query('UPDATE asset_replacement_notifications SET error=$2 WHERE correction_id=$1::uuid',[id,e instanceof Error?e.message:'Delivery failed']);}
}

export async function replacementNotificationStatuses(ids:string[]){
 if(!ids.length)return {} as Record<string,{email_error:string|null;email_sent_at:string|null}>;
 await getDb().query(REPLACEMENT_MAIL_SCHEMA);
 const rows=(await getDb().query('SELECT correction_id,error,sent_at FROM asset_replacement_notifications WHERE correction_id=ANY($1::uuid[])',[ids])).rows;
 return Object.fromEntries(rows.map(row=>[row.correction_id,{email_error:row.error,email_sent_at:row.sent_at}]));
}
