import { requireAdminPageAccess } from "../../lib/account-access";
import { listAdminUsers } from "../../lib/admin-users";
import AdminClient from "./admin-client";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  await requireAdminPageAccess();
  const users = await listAdminUsers();

  return (
    <main className={styles.page}>
      <AdminClient key={`${params.status ?? "all"}:${params.account ?? ""}`} initialUsers={users} initialStatus={typeof params.status === "string" ? params.status : "all"} initialAccountId={typeof params.account === "string" ? params.account : ""} />
    </main>
  );
}
