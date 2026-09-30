import Link from 'next/link';
import { requireAdminPageAccess } from '../../../lib/account-access';
import { sharingAllowances } from '../../../lib/sharing-foundation';
import { getDb } from '../../../lib/db';
import SharingSettings from './settings';
import styles from '../../business/page.module.css';
export const dynamic = 'force-dynamic';
export default async function SharingAdmin() {
    await requireAdminPageAccess();
    const allowances = await sharingAllowances();
    const accounts = (await getDb().query(`SELECT p.user_id,p.business_name,u.email,coalesce(a.plan,CASE WHEN p.account_type='business' THEN 'free' ELSE 'desktop' END) AS plan,
  count(e.id) FILTER(WHERE e.metric='asset_received')::int AS assets,
  count(e.id) FILTER(WHERE e.metric='upload')::int AS uploads,
  coalesce(sum(e.bytes) FILTER(WHERE e.metric='upload'),0)::text AS bytes,
  count(e.id) FILTER(WHERE e.metric='contribution')::int AS interactions,
  count(e.id) FILTER(WHERE e.metric='email_attempt')::int AS emails
  FROM account_profiles p JOIN "user" u ON u.id=p.user_id LEFT JOIN sharing_account_access a ON a.user_id=p.user_id
  LEFT JOIN sharing_usage_events e ON e.account_id=p.user_id WHERE p.account_type IN ('owner','dealer','business')
  GROUP BY p.user_id,p.business_name,u.email,a.plan,p.account_type ORDER BY p.business_name,u.email LIMIT 200`)).rows;
    return <main className={styles.page}><Link href="/admin/businesses">Back to businesses</Link><h1>Sharing usage & access</h1>
 <section className={styles.panel}><h2>Draft free allowances</h2><p>Observation only: these values never block access. Leave blank until the allowance is decided. Counts below are lifetime totals; they do not reset on sign-out or upgrade.</p><SharingSettings initial={allowances}/></section>
 <section className={styles.panel}><h2>Accounts</h2>{accounts.map(account => <details key={account.user_id} className={styles.lead}><summary>{account.business_name || account.email} · {account.plan}</summary><p>{account.email}</p><p>{account.assets} assets · {account.uploads} uploads ({account.bytes} bytes) · {account.interactions} contributions · {account.emails} email attempts</p>{account.plan === 'free' && <SharingSettings accountId={account.user_id}/>}</details>)}</section>
 </main>;
}
