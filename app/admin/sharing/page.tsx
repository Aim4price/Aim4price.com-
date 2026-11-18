import Link from 'next/link';
import { requireAdminPageAccess } from '../../../lib/account-access';
import { sharingAdminAccounts } from '../../../lib/sharing-admin';
import SharingUsage from './usage';
import styles from './sharing.module.css';
export const dynamic='force-dynamic';
export default async function SharingAdmin({searchParams}:{searchParams?:{period?:string}}) {
 const admin=await requireAdminPageAccess();
 const period=searchParams?.period==='all'?'all':'month';
 const accounts=await sharingAdminAccounts(period);
 return <main className={styles.page}>
  <Link className={styles.back} href="/admin/businesses">← Back to businesses</Link>
  <header className={styles.heading}><div><h1>Sharing usage</h1><p>See how accounts use shared assets before setting free limits.</p></div><span className={styles.badge}>Measuring only · no limits enforced</span></header>
  <SharingUsage accounts={accounts} period={period} adminId={admin.user.id}/>
  <details className={styles.explanation}><summary>What do these numbers mean?</summary>
   <p><strong>Assets received:</strong> each asset counts once per account, even across different links. This month shows assets first received this month.</p>
   <p><strong>Uploads:</strong> saved files and their uploaded size. Failed saves do not count. This is upload volume, not current storage.</p>
   <p><strong>Changes:</strong> saved asset corrections and maintenance schedules. <strong>Opens:</strong> once per link per signed-in session.</p>
   <p><strong>Emails sent:</strong> tracked sharing emails accepted by the provider, not confirmed delivery. Failed sends are shown separately.</p>
   <p>Month boundaries use South African time. All-time totals remain after sign-out or upgrade. Existing technical rate limits still apply.</p>
  </details>
 </main>;
}
