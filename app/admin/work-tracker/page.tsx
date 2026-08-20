import { requireAdminPageAccess } from "../../../lib/account-access";
import { listAdminWorkClients } from "../../../lib/admin-work-tracker";
import WorkTrackerClient from "./work-tracker-client";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminWorkTrackerPage() {
  await requireAdminPageAccess();
  const clients = await listAdminWorkClients();

  return (
    <main className={styles.page}>
      <WorkTrackerClient initialClients={clients} />
    </main>
  );
}
