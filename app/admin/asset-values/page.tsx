import AdminNavigation from '../../../components/AdminNavigation';
import {requireAdminPageAccess} from '../../../lib/account-access';
import Client from './values-client';
import styles from '../valuations/page.module.css';
export default async function Page(){await requireAdminPageAccess();return <main className={styles.page}><section className={styles.shell}><header className={styles.topBar}><h1>Asset values</h1><AdminNavigation active="asset-values"/></header><Client/></section></main>}
