import { requireAdminPageAccess } from '../../../lib/account-access';
import { ensureAccountProfileColumns } from '../../../lib/account-profile';
import { listBusinessAccounts } from '../../../lib/business-accounts';
import ReviewCard from './review-client';
import styles from '../../business/page.module.css';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function BusinessAccountsAdmin() { await requireAdminPageAccess(); await ensureAccountProfileColumns(); const accounts = await listBusinessAccounts(); return <main className={styles.page}><nav className={styles.nav}><a href="/admin">Aim4price Admin</a></nav><h1 className={styles.title}>Business verification</h1><p className={styles.intro}>Review free Business accounts. Confirm the email and business evidence before checking Business verified. An online listing alone does not prove ownership.</p><div className={styles.form}>{!accounts.length && <p>No Business accounts awaiting review.</p>}{accounts.map(a => <ReviewCard key={a.user_id} account={JSON.parse(JSON.stringify(a))}/>)}</div></main>; }
