import { requireAdminPageAccess } from "../../../lib/account-access";
import { listAdminWorkClients } from "../../../lib/admin-work-tracker";
import WorkTrackerClient from "./work-tracker-client";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminWorkTrackerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  await requireAdminPageAccess();
  const clients = await listAdminWorkClients();

  return (
    <main className={styles.page}>
      <WorkTrackerClient key={String(params.account ?? "")} initialClients={clients} initialAccountId={typeof params.account === "string" ? params.account : ""} />
    </main>
  );
}
