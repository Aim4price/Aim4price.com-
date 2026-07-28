import { redirect } from "next/navigation";
import { getAccountProfile } from "../../lib/account-profile";
import { requireActivePageAccess } from "../../lib/account-access";
import { listAssetLeadsForUser } from "../../lib/partner-access";
import LeadsClient from "./leads-client";

export const runtime = "nodejs";

const PARTNER_ACCOUNT_TYPES = new Set(["dealer", "finance", "insurance"]);

export default async function LeadsPage() {
  const { session } = await requireActivePageAccess();

  const [profile, initialLeads] = await Promise.all([
    getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    }),
    listAssetLeadsForUser(session.user.id),
  ]);

  if (!PARTNER_ACCOUNT_TYPES.has(profile.accountType)) {
    redirect("/account");
  }

  return (
    <LeadsClient
      dealerWorkspaceMode={profile.accountType === "dealer"}
      initialLeads={initialLeads}
      initialSessionUserId={session.user.id}
    />
  );
}
