import { redirect } from "next/navigation";
import { getAccountProfile } from "../../lib/account-profile";
import { requireActivePageAccess } from "../../lib/account-access";
import { listAssetLeadsForUser } from "../../lib/partner-access";
import LeadsClient from "./leads-client";

export const runtime = "nodejs";

const PARTNER_ACCOUNT_TYPES = new Set(["dealer", "finance", "insurance"]);

export default async function LeadsPage() {
  const { session } = await requireActivePageAccess();

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (!PARTNER_ACCOUNT_TYPES.has(profile.accountType)) {
    redirect("/account");
  }

  const initialLeads = await listAssetLeadsForUser(session.user.id);

  return (
    <LeadsClient
      accountantWorkspaceMode={profile.accountType === "finance" && profile.accountSubtype === "accountant"}
      dealerWorkspaceMode={profile.accountType === "dealer"}
      initialLeads={initialLeads}
      initialSessionUserId={session.user.id}
    />
  );
}
