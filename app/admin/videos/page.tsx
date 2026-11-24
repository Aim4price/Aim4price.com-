import { requireAdminPageAccess } from '../../../lib/account-access';
import AdminNavigation from '../../../components/AdminNavigation';
import { listVideoSlots } from '../../../lib/tutorial-videos';
import { hoverRecordings } from '../../../lib/hover-videos';
import VideoManager from './video-manager';
import styles from './videos.module.css';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const metadata={title:'Video Manager | Aim4price',robots:{index:false,follow:false}};
export default async function Page(){await requireAdminPageAccess();const [slots,owner,business]=await Promise.all([listVideoSlots(),hoverRecordings('owner'),hoverRecordings('business')]);return <main className={styles.page}><header className={styles.heading}><div><h1>Video Manager</h1><p>Manage tutorials and workspace card recordings.</p></div><AdminNavigation active="videos"/></header><VideoManager initialSlots={slots} initialHover={{owner,business}}/></main>;}
