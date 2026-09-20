import AdminNavigation from "../../../components/AdminNavigation";
import { requireAdminPageAccess } from "../../../lib/account-access";
import CaptureQueueClient from "./capture-queue-client";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminCaptureQueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  await requireAdminPageAccess();

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <h1>Capture Queue</h1>
          </div>

          <AdminNavigation active="capture-queue" />
        </header>

        <CaptureQueueClient key={`${params.status ?? "open"}:${params.owner ?? ""}`} initialStatus={typeof params.status === "string" ? params.status : "open"} initialOwnerId={typeof params.owner === "string" ? params.owner : ""} />
      </section>
    </main>
  );
}
