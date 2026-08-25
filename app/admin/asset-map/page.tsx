import AdminNavigation from "../../../components/AdminNavigation";
import { requireAdminPageAccess } from "../../../lib/account-access";
import { getAdminAssetMapReport } from "../../../lib/admin-global-assets";
import AdminAssetMapClient from "./admin-asset-map-client";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatGeneratedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default async function AdminAssetMapPage() {
  await requireAdminPageAccess();
  const report = await getAdminAssetMapReport();

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <p>Aim4price admin</p>
            <h1>Global Asset Map</h1>
            <span>
              Every account, register and saved asset · Updated {formatGeneratedAt(report.generatedAtIso)}
            </span>
          </div>
          <AdminNavigation active="asset-map" />
        </header>

        <AdminAssetMapClient initialReport={report} />
      </section>
    </main>
  );
}
