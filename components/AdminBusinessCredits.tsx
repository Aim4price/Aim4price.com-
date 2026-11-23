import {getDb} from '../lib/db';
import {ensureCreditSchema,MONTHLY_BUSINESS_CREDITS} from '../lib/business-credits';
import {UpgradeBusiness} from './BusinessCreditControls';
import styles from '../app/admin/sharing/sharing.module.css';
export async function getAdminBusinessCredits(period:'month'|'all'){
 await ensureCreditSchema();
 const query=getDb();
 const activity = `(SELECT business_id,actor_id,action,units,created_at FROM business_credit_events WHERE state='complete'
   UNION ALL SELECT business_id,actor_id,action,1,created_at FROM business_completed_actions)`;
 const totals=(await query.query(`SELECT owner.email,w.monthly_allowance,sum(e.units)::int AS used, (select coalesce(sum(r.credits),0)::int from business_owner_referrals r where r.business_id=w.id and r.rewarded_at>=(date_trunc('month',now() AT TIME ZONE 'Africa/Johannesburg') AT TIME ZONE 'Africa/Johannesburg')) as bonus FROM ${activity} e
 JOIN business_workspaces w ON w.id=e.business_id JOIN "user" owner ON owner.id=w.owner_user_id
 WHERE w.paid_since IS NULL AND e.created_at>=(date_trunc('month',now() AT TIME ZONE 'Africa/Johannesburg') AT TIME ZONE 'Africa/Johannesburg')
 GROUP BY w.id,owner.email ORDER BY used DESC,owner.email`)).rows;
 const requests=(await query.query(`SELECT w.id,u.email,w.requested_plan FROM business_workspaces w JOIN "user" u ON u.id=w.owner_user_id WHERE upgrade_requested_at IS NOT NULL AND paid_since IS NULL ORDER BY upgrade_requested_at`)).rows;
 const events=(await query.query(`SELECT owner.email AS business,actor.email AS actor,e.action,e.units,e.created_at FROM ${activity} e
 JOIN business_workspaces w ON w.id=e.business_id JOIN "user" owner ON owner.id=w.owner_user_id LEFT JOIN "user" actor ON actor.id=e.actor_id
 WHERE ($1='all' OR e.created_at>=(date_trunc('month',now() AT TIME ZONE 'Africa/Johannesburg') AT TIME ZONE 'Africa/Johannesburg')) ORDER BY e.created_at DESC LIMIT 100`,[period])).rows;
 return {requests,events,totals};
}
export default function AdminBusinessCredits({requests,events,totals}:Awaited<ReturnType<typeof getAdminBusinessCredits>>){
 return <section className={styles.panel}><header className={styles.tableHeading}><h2>Business credits</h2></header>
 <details className={styles.explanation}><summary>Monthly balances · {totals.filter(row=>row.used>=(row.monthly_allowance??MONTHLY_BUSINESS_CREDITS)+Number(row.bonus||0)).length} at their allowance</summary>
 <div className={styles.tableScroll}><table><thead><tr><th>Active Business account</th><th>Used</th><th>Remaining</th></tr></thead><tbody>{totals.map(row=><tr key={row.email}><td>{row.email}</td><td>{row.used}</td><td>{Math.max(0,(row.monthly_allowance??MONTHLY_BUSINESS_CREDITS)+Number(row.bonus||0)-row.used)}</td></tr>)}</tbody></table></div></details>
 {requests.map(row=><p key={row.id}>{row.email} · Upgrade requested {row.requested_plan && <>· {row.requested_plan.description} · R{(row.requested_plan.amount_cents/100).toFixed(2)} {row.requested_plan.interval} </>}<UpgradeBusiness businessId={row.id}/></p>)}
 <details className={styles.explanation}><summary>Recent credit activity</summary><div className={styles.tableScroll}><table><thead><tr>{['Business','Team member','Action','Credits','Date'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{events.map((row,index)=><tr key={index}><td>{row.business}</td><td>{row.actor}</td><td>{row.action}</td><td>{row.units}</td><td>{new Date(row.created_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})}</td></tr>)}</tbody></table>{!events.length&&<p>No credit activity in this period.</p>}</div></details></section>;
}
