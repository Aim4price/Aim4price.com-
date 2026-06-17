import { redirectAdminToAdmin } from "../../lib/account-access";
import ValuationClient from "./valuation-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ValuationPage() {
  await redirectAdminToAdmin();

  return <ValuationClient />;
}
