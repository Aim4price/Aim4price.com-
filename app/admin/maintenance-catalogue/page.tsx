import { requireAdminPageAccess } from "../../../lib/account-access";
import MaintenanceCatalogueClient from "./maintenance-catalogue-client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireAdminPageAccess();
  return <MaintenanceCatalogueClient />;
}
