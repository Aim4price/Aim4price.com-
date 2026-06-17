import { requireActivePageAccess } from "../../lib/account-access";
import AccountClient from "./account-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  await requireActivePageAccess();

  return <AccountClient />;
}
