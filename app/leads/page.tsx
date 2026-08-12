import { redirect } from "next/navigation";
import { getAccountProfile } from "../../lib/account-profile";
import { requireActivePageAccess } from "../../lib/account-access";
import { listAssetLeadsForUser } from "../../lib/partner-access";
import LeadsClient from "./leads-client";

export const runtime = "nodejs";

const PARTNER_ACCOUNT_TYPES = new Set(["dealer", "finance", "insurance", "licensing"]);
const INITIAL_LEAD_BATCH_SIZE = 10;

export default async function LeadsPage() {
  const { session } = await requireActivePageAccess();

  const [profile, initialLeads] = await Promise.all([
    getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    }),
    listAssetLeadsForUser(session.user.id, { limit: INITIAL_LEAD_BATCH_SIZE + 1 }),
  ]);

  if (!PARTNER_ACCOUNT_TYPES.has(profile.accountType)) {
    redirect("/account");
  }

  return (
    <LeadsClient
      accountantWorkspaceMode={profile.accountType === "finance" && profile.accountSubtype === "accountant"}
      dealerWorkspaceMode={profile.accountType === "dealer"}
      licensingWorkspaceMode={profile.accountType === "licensing"}
      initialLeads={initialLeads.slice(0, INITIAL_LEAD_BATCH_SIZE)}
      initialLeadsHaveMore={initialLeads.length > INITIAL_LEAD_BATCH_SIZE}
      initialSessionUserId={session.user.id}
    />
  );
}
