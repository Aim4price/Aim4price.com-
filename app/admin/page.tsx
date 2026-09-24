import { canUseEstimateBreakdown } from "../../lib/estimate-breakdown-access";
import { requireAdminPageAccess } from "../../lib/account-access";
import { listAdminUsers } from "../../lib/admin-users";
import AdminClient from "./admin-client";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const session = await requireAdminPageAccess();
  const users = await listAdminUsers();

  return (
    <main className={styles.page}>
      <AdminClient key={`${params.status ?? "all"}:${params.account ?? ""}`} canGetEstimate={canUseEstimateBreakdown(session.user.email)} initialUsers={users} initialStatus={typeof params.status === "string" ? params.status : "all"} initialAccountId={typeof params.account === "string" ? params.account : ""} />
    </main>
  );
}
