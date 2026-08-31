import AdminNavigation from "../../../components/AdminNavigation";
import { requireAdminPageAccess } from "../../../lib/account-access";
import { getAdminAssetMapReport } from "../../../lib/admin-global-assets";
import AdminAssetMapClient from "./admin-asset-map-client";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminAssetMapPage() {
  await requireAdminPageAccess();
  const report = await getAdminAssetMapReport();

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <h1>Asset Map</h1>
          </div>
          <AdminNavigation active="asset-map" />
        </header>

        <AdminAssetMapClient initialReport={report} />
      </section>
    </main>
  );
}
