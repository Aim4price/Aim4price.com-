import {requireAdminPageAccess} from '../../../lib/account-access';
import {getDb} from '../../../lib/db';
import {emailRollout,ensureAssetEmailDelivery} from '../../../lib/maintenance-email-delivery';
import AdminNavigation from '../../../components/AdminNavigation';
import styles from './page.module.css';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const metadata={title:'Asset emails | Aim4price',robots:{index:false,follow:false}};
const timestamp = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function date(value: string | Date | null, fallback = 'Not yet checked') {
  if (!value) return fallback;
  const instant = new Date(value);
  return Number.isFinite(instant.getTime()) ? timestamp.format(instant) + ' SAST' : 'Invalid date';
}

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
 const scope = !rollout.enabled ? 'Sending disabled' : rollout.test ? 'Pilot mailbox only' : 'All eligible accounts';
 const metrics = [
   {label: 'Accepted by email provider', count: totals.accepted, note: 'Inbox delivery is unconfirmed.'},
   {label: 'Pending or retrying', count: totals.pending, note: 'Waiting for a confirmed send.'},
   {label: 'Need review', count: totals.review, note: 'Automatic retries have stopped.'},
 ];

 return (
   <main className={styles.page}>
     <header className={styles.header}>
       <div><h1>Asset emails</h1><p>Maintenance reminders and problem updates.</p></div>
       <AdminNavigation active="asset-emails"/>
     </header>

     <section className={styles.service} aria-labelledby="service-heading" data-state={status}>
       <div className={styles.serviceHeading}>
         <div><h2 id="service-heading">Email service</h2><strong className={styles.status}>{status}</strong></div>
         <a className={styles.refresh} href="/admin/asset-emails">Refresh status</a>
       </div>
       <dl className={styles.facts}>
         <div><dt>Last completed check</dt><dd>{date(worker?.last_finished_at)}</dd></div>
         <div><dt>Sending to</dt><dd>{scope}</dd></div>
         <div><dt>Launch cutoff</dt><dd>{date(rollout.since, 'Not configured')}</dd></div>
       </dl>
       <div className={styles.schedule}>
         <span>Maintenance reminders from <b>07:00 SAST</b></span>
         <span>Problem updates checked <b>every minute</b></span>
       </div>
       {worker?.last_error && <p role="alert" className={styles.error}>{worker.last_error}</p>}
     </section>

     <section className={styles.delivery} aria-labelledby="delivery-heading">
       <h2 id="delivery-heading">Delivery totals</h2>
       <div className={styles.totals}>
         {metrics.map(metric => <article key={metric.label} className={styles.metric}
           data-review={metric.label === 'Need review' && Number(metric.count) > 0}>
           <h3>{metric.label}</h3><strong>{metric.count}</strong><p>{metric.note}</p>
         </article>)}
       </div>
     </section>

     <div className={styles.reports}>
       <section className={styles.panel} aria-labelledby="unfinished-heading">
         <h2 id="unfinished-heading">Unfinished deliveries</h2>
         {failuresResult.rows.length ? <>
           <p>Latest 100 unfinished deliveries. Retries stop after 23 hours or 10 attempts. Check the provider record before resending.</p>
           {failuresResult.rows.map(row => <article className={styles.entry} key={row.event_key + row.recipient_id}>
             <h3>{row.exhausted ? 'Needs review' : 'Pending or retrying'}</h3>
             <dl className={styles.record}>
               <div><dt>Event</dt><dd>{row.event_key}</dd></div>
               <div><dt>Recipient account</dt><dd>{row.recipient_id}</dd></div>
               <div><dt>Attempts</dt><dd>{row.attempts}</dd></div>
               <div><dt>Last attempt</dt><dd>{date(row.attempted_at)}</dd></div>
             </dl>
             <p>{row.error || 'No confirmed send. Check eligibility and provider status.'}</p>
           </article>)}
         </> : <p>No unfinished deliveries.</p>}
       </section>

       <section className={styles.panel} aria-labelledby="errors-heading">
         <h2 id="errors-heading">Processing errors</h2>
         {eventsResult.rows.length ? eventsResult.rows.map(row => <article className={styles.entry} key={row.event_key}>
           <h3>{row.event_key}</h3><p>{row.last_error}</p><p>{date(row.checked_at)}</p>
         </article>) : <p>No recorded event-processing errors.</p>}
       </section>
     </div>
   </main>
 );
}
