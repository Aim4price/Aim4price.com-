import { redirectAdminToAdmin } from "../../lib/account-access";
import QuickValuationClient from "./quick-valuation-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ValuationPage() {
  await redirectAdminToAdmin();

  return <QuickValuationClient />;
}
