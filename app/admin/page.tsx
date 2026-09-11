import { requireAdminPageAccess } from "../../lib/account-access";
import { listAdminUsers } from "../../lib/admin-users";
import BusinessInvite from "../../components/business-network/BusinessInvite";
import AdminClient from "./admin-client";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminPageAccess();
  const users = await listAdminUsers();

  return (
    <main className={styles.page}>
      <a href="/admin/businesses">
        Manage business directory · Add business manually
      </a>
      <BusinessInvite />
      <AdminClient initialUsers={users} />
    </main>
  );
}
