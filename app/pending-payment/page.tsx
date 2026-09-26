import { redirect } from "next/navigation";
import { getAccountAccess } from "../../lib/account-access";
import { getAnyServerSession } from "../../lib/auth-session";
import { getBillingSuspension } from "../../lib/billing-suspension";
import PendingAccessClient from "./PendingAccessClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PendingPaymentPage() {
  const session = await getAnyServerSession();

  if (!session?.user?.id) {
    redirect("/auth#login");
  }

  const access = await getAccountAccess(session.user);

  if (access.isActive) {
    redirect(access.isAdmin ? "/admin" : "/asset-register");
  }

  return (
    <PendingAccessClient
      suspension={access.status === "suspended" ? await getBillingSuspension(session.user.id) : null}
      email={session.user.email ?? ""}
      statusLabel={access.statusLabel}
      isSuspended={access.status === "suspended"}
    />
  );
}
