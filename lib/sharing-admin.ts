import { getDb } from './db';
import { ensureSharingFoundation } from './sharing-foundation';
import { isAim4priceAdminEmail } from './account-constants';
export async function signOutSharingAccount(actorId:string,userId:string) {
 if(!userId || userId===actorId) throw Error('Choose another account to sign out.');
 await ensureSharingFoundation();
 const db=await getDb().connect();
 try {
  await db.query('BEGIN');
  const user=(await db.query('SELECT email FROM "user" WHERE id=$1 FOR UPDATE',[userId])).rows[0];
  if(!user || isAim4priceAdminEmail(user.email))throw Error('Choose a non-admin account.');
  // Keep revoked IDs so a cached auth cookie cannot restore a deleted session.
  const revoked=await db.query(`INSERT INTO sharing_revoked_sessions(session_id,user_id)
   SELECT id,"userId" FROM "session" WHERE "userId"=$1 ON CONFLICT DO NOTHING RETURNING session_id`,[userId]);
  await db.query('DELETE FROM "session" WHERE "userId"=$1',[userId]);
  await db.query('DELETE FROM sharing_session_activity WHERE user_id=$1',[userId]);
  await db.query("INSERT INTO sharing_admin_events(actor_id,account_id,action,detail) VALUES($1,$2,'sessions_revoked',$3::jsonb)",[actorId,userId,JSON.stringify({sessions:revoked.rows.length})]);
  await db.query('COMMIT');
  return revoked.rows.length;
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
export async function sharingAdminAccounts(period:'month'|'all'='month') {
 await ensureSharingFoundation();
 return (await getDb().query(`SELECT p.user_id,coalesce(nullif(p.business_name,''),u.name,u.email) AS name,u.email,p.account_status,
 coalesce(a.plan,CASE WHEN p.account_type='business' THEN 'free' ELSE 'desktop' END) AS plan,
 coalesce(m.assets,0)::int AS assets,coalesce(m.opens,0)::int AS opens,coalesce(m.uploads,0)::int AS uploads,
 coalesce(m.bytes,0)::text AS bytes,coalesce(m.contributions,0)::int AS contributions,
 coalesce(m.emails,0)::int AS emails,coalesce(m.failed,0)::int AS failed,
 (SELECT max(created_at) FROM sharing_usage_events WHERE account_id=p.user_id) AS last_activity,
 (SELECT count(*)::int FROM "session" s WHERE s."userId"=p.user_id AND s."expiresAt">now()
 AND NOT EXISTS(SELECT 1 FROM sharing_revoked_sessions r WHERE r.session_id=s.id)
 AND (coalesce(a.plan,CASE WHEN p.account_type='business' THEN 'free' ELSE 'desktop' END)<>'free' OR
 (s."createdAt">now()-interval '12 hours' AND NOT EXISTS(SELECT 1 FROM sharing_session_activity sa WHERE sa.session_id=s.id AND (sa.last_seen_at<=now()-interval '30 minutes' OR sa.expires_at<=now()))))) AS sessions
 FROM account_profiles p JOIN "user" u ON u.id=p.user_id LEFT JOIN sharing_account_access a ON a.user_id=p.user_id
 LEFT JOIN LATERAL (SELECT sum(quantity) FILTER(WHERE metric='asset_received') AS assets,
 sum(quantity) FILTER(WHERE metric='enquiry_opened') AS opens,sum(quantity) FILTER(WHERE metric='upload') AS uploads,
 sum(bytes) FILTER(WHERE metric='upload') AS bytes,sum(quantity) FILTER(WHERE metric='contribution') AS contributions,
 sum(quantity) FILTER(WHERE metric='email_accepted') AS emails,sum(quantity) FILTER(WHERE metric='email_failed') AS failed
 FROM sharing_usage_events WHERE account_id=p.user_id AND ($1='all' OR created_at >= (date_trunc('month',now() AT TIME ZONE 'Africa/Johannesburg') AT TIME ZONE 'Africa/Johannesburg'))) m ON true
 WHERE p.account_type IN ('owner','dealer','business') ORDER BY last_activity DESC NULLS LAST,name`,[period])).rows;
}
