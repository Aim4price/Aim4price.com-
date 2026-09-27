import { requireAdminPageAccess } from "../../../lib/account-access";
import AdminBusinesses from "./businesses-client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams?: { verify?: string } }) {
  await requireAdminPageAccess();
  return <AdminBusinesses initialVerificationOpen={searchParams?.verify === "1"} />;
}
