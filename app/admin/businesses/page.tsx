import { requireAdminPageAccess } from "../../../lib/account-access";
import AdminBusinesses from "./businesses-client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireAdminPageAccess();
  return <AdminBusinesses />;
}
