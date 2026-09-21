import AdminNavigation from '../../../components/AdminNavigation';
import { requireAdminPageAccess } from '../../../lib/account-access';
import { listAdminWorkClients } from '../../../lib/admin-work-tracker';
import BillingClient from './billing-client';
import styles from './page.module.css';
export const runtime='nodejs';export const dynamic='force-dynamic';
export default async function BillingPage({searchParams={}}:{searchParams?:Record<string,string|string[]|undefined>}) {
 await requireAdminPageAccess();const clients=await listAdminWorkClients();
 return <main className={styles.page}><div className={styles.shell}><header className={styles.header}><h1>Billing</h1><AdminNavigation active="billing" /></header><BillingClient key={String(searchParams.account??'')} clients={clients} initialAccount={typeof searchParams.account==='string'?searchParams.account:''} initialWork={typeof searchParams.work==='string'?searchParams.work:''}/></div></main>;
}
