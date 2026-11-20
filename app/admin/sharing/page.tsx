import {getDb} from '../../../lib/db';
import {creditLimitsActive,ensureCreditSchema} from '../../../lib/business-credits';
import AdminBusinessCredits,{getAdminBusinessCredits} from '../../../components/AdminBusinessCredits';
import ListingReviews from './listing-reviews';
import { requireAdminPageAccess } from '../../../lib/account-access';
import { sharingAdminAccounts } from '../../../lib/sharing-admin';
import SharingUsage from './usage';
import styles from './sharing.module.css';
export const dynamic='force-dynamic';
export default async function SharingAdmin({searchParams}:{searchParams?:{period?:string}}) {
 const admin=await requireAdminPageAccess();
 const period=searchParams?.period==='all'?'all':'month';
 await ensureCreditSchema();
 const [accounts,credits,paidMembers]=await Promise.all([
   sharingAdminAccounts(period),getAdminBusinessCredits(period),
   getDb().query(`SELECT m.user_id FROM business_workspace_members m JOIN business_workspaces w ON w.id=m.business_id WHERE m.status='active' AND w.paid_since IS NOT NULL`),
 ]);
 const paidIds=new Set(paidMembers.rows.map(row=>row.user_id));
 return <main className={styles.page}>
  <header className={styles.heading}><div><h1>Sharing usage</h1><p>Track shared assets, link opens and account activity.</p></div><span className={styles.badge}>{creditLimitsActive()?'Business credit limits active':'Business credit trial'}</span></header>
  <SharingUsage accounts={accounts.map(account=>account.plan==='free'&&paidIds.has(account.user_id)?{...account,plan:'paid-business'}:account)} period={period} adminId={admin.user.id}/>
  <AdminBusinessCredits {...credits}/>
  <ListingReviews />
  <details className={styles.explanation}><summary>What do these numbers mean?</summary>
   <p><strong>Assets received:</strong> each asset counts once per account, even across different links. This month shows assets first received this month.</p>
   <p><strong>Uploads:</strong> saved files and their uploaded size. Failed saves do not count. This is upload volume, not current storage.</p>
   <p><strong>Changes:</strong> saved asset corrections and maintenance schedules. <strong>Opens:</strong> once per link per signed-in session.</p>
   <p><strong>Emails sent:</strong> tracked sharing emails accepted by the provider, not confirmed delivery. Failed sends are shown separately.</p>
   <p>Month boundaries use South African time. All-time totals remain after sign-out or upgrade. Existing technical rate limits still apply.</p>
  </details>
 </main>;
}
