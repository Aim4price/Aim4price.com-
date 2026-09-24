import Link from "next/link";
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
      {canUseEstimateBreakdown(session.user.email) ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <Link href="/valuation" style={{ padding: "12px 20px", borderRadius: 10, background: "#174c3c", color: "#fff", fontWeight: 600 }}>Get estimate</Link>
        </div>
      ) : null}
      <AdminClient key={`${params.status ?? "all"}:${params.account ?? ""}`} initialUsers={users} initialStatus={typeof params.status === "string" ? params.status : "all"} initialAccountId={typeof params.account === "string" ? params.account : ""} />
    </main>
  );
}
