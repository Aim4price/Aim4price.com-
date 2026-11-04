import {requireAdminPageAccess} from '../../../lib/account-access';
import {getDb} from '../../../lib/db';
import {emailRollout,ensureAssetEmailDelivery} from '../../../lib/maintenance-email-delivery';
import AdminNavigation from '../../../components/AdminNavigation';
import styles from './page.module.css';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const metadata={title:'Asset emails | Aim4price',robots:{index:false,follow:false}};
const date=(value:string|Date|null)=>value?new Date(value).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})+' SAST':'Not yet';
export default async function Page(){
 await requireAdminPageAccess();
 await ensureAssetEmailDelivery();
 const db=getDb();
 const [workerResult,totalsResult,failuresResult,eventsResult]=await Promise.all([
  db.query("SELECT *,last_finished_at < now()-interval '5 minutes' AS stale FROM asset_email_worker WHERE id='sender'"),
  db.query("SELECT count(*) FILTER(WHERE sent_at IS NOT NULL) AS accepted,count(*) FILTER(WHERE sent_at IS NULL AND first_attempt_at>now()-interval '23 hours' AND attempts<10) AS pending,count(*) FILTER(WHERE sent_at IS NULL AND (first_attempt_at<=now()-interval '23 hours' OR attempts>=10)) AS review FROM asset_email_deliveries"),
  db.query("SELECT event_key,recipient_id,attempts,first_attempt_at,attempted_at,error,first_attempt_at<=now()-interval '23 hours' OR attempts>=10 AS exhausted FROM asset_email_deliveries WHERE sent_at IS NULL ORDER BY attempted_at DESC LIMIT 100"),
  db.query("SELECT event_key,checked_at,last_error FROM asset_email_events WHERE last_error IS NOT NULL ORDER BY checked_at DESC LIMIT 50")
 ]);
 const worker=workerResult.rows[0],totals=totalsResult.rows[0],rollout=emailRollout();
 const status=!rollout.enabled?'Disabled':!worker?.last_finished_at||worker.stale?'Needs attention':worker.last_error||worker.last_failed?'Check failures':'Running';
 return <main className={styles.page}><header className={styles.header}><div><h1>Asset emails</h1><p>Maintenance reminders and problem updates.</p></div><AdminNavigation active="asset-emails"/></header>
 <section className={styles.card}><h2>{status}</h2><p>{rollout.test?'Pilot mailbox only':rollout.enabled?'All eligible accounts':'Sending is disabled'} · Launch cutoff: {rollout.since||'Not configured'}</p><p>Last completed check: {date(worker?.last_finished_at)}</p>{worker?.last_error&&<p role="alert">{worker.last_error}</p>}<p>Maintenance reminders run from 07:00 SAST. Problem updates are checked every minute. Refresh this page for the latest status.</p><a href="/admin/asset-emails">Refresh status</a></section>
 <section className={styles.totals} aria-label="Delivery totals"><div className={styles.card}><strong>{totals.accepted}</strong><span>Accepted by email provider</span></div><div className={styles.card}><strong>{totals.pending}</strong><span>Pending or retrying</span></div><div className={styles.card}><strong>{totals.review}</strong><span>Need review</span></div></section>
 <section className={styles.card}><h2>Unfinished deliveries</h2><p>Latest 100 attempts. Provider acceptance does not confirm inbox delivery. Attempts stop after 23 hours or 10 tries to prevent duplicates; review the provider record before resending.</p>{failuresResult.rows.length?failuresResult.rows.map(row=><article className={styles.entry} key={row.event_key+row.recipient_id}><h3>{row.exhausted?'Needs review':'Pending / retrying'} · {row.attempts} attempts</h3><p>Event: {row.event_key}<br/>Recipient account: {row.recipient_id}<br/>Last attempt: {date(row.attempted_at)}</p><p>{row.error||'No confirmed send. Check eligibility and provider status.'}</p></article>):<p>No unfinished deliveries.</p>}</section>
 <section className={styles.card}><h2>Processing errors</h2>{eventsResult.rows.length?eventsResult.rows.map(row=><article className={styles.entry} key={row.event_key}><h3>{row.event_key}</h3><p>{row.last_error}</p><p>{date(row.checked_at)}</p></article>):<p>No recorded event-processing errors.</p>}</section>
 </main>;
}
